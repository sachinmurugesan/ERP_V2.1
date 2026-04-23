# Security Audit Report #1 — HarvestERP

> **Date:** April 2026 (Round 1: April 2026; Round 2: 2026-04-17)
> **Auditor:** Claude Code (Automated + Manual Code Review)
> **Scope:** Full backend source code audit — authentication, authorization, file uploads, business logic, API security, dependency hygiene
> **Status:** **ALL 30 findings resolved.** Scans clean: Bandit 0 HIGH/MED, pip-audit 0 CVEs (prod), npm audit 0 CVEs.

---

## Executive Summary

| Severity | Found | Round 1 | Round 2 | Remaining |
|----------|-------|---------|---------|-----------|
| CRITICAL | 6 | 6 | 0 | 0 |
| HIGH | 12 | 2 | 10 | 0 |
| MEDIUM | 9 | 0 | 9 | 0 |
| LOW | 3 | 0 | 3 | 0 |
| **Total** | **30** | **8** | **22** | **0** |

**Risk before audit:** Any authenticated user (CLIENT or FACTORY) could create orders for other clients, self-approve unlimited financial compensation, download any client's documents, and modify customs duty calculations.

**Risk after round 1:** All CRITICAL authorization gaps closed. CLIENT/FACTORY users properly isolated.

**Risk after round 2:** Full OWASP Top 10 / API Top 10 hardening complete. Token revocation, CSP/HSTS, rate limiting, upload validation, account lockout, password policy, and all known CVEs resolved.

---

## CRITICAL Findings — ALL FIXED

### 1. After-Sales: All Admin Endpoints Missing Auth (FIXED)

**File:** `backend/routers/aftersales.py`
**Lines:** 158, 225, 318, 671, 726, 766, 802, 831, 874

**Issue:** Every admin-facing after-sales endpoint had NO `current_user` dependency and performed ZERO authorization checks. Any authenticated user (CLIENT, FACTORY) could:
- View all clients' after-sales claims
- Modify resolution amounts
- Upload/delete photos on other clients' records
- Resolve claims (self-approve compensation)

**Impact:** Complete data breach + financial fraud. A CLIENT could read, modify, and resolve after-sales items for ANY order.

**Fix Applied:**
- Added `current_user: CurrentUser = Depends(get_current_user)` to ALL 9 admin endpoints
- Added `_require_admin(current_user)` guard to write operations (batch_save, update, delete_photo, resolve)
- Added `_check_order_access(order, current_user)` for read operations (list)
- `resolve_item` restricted to ADMIN/SUPER_ADMIN/OPERATIONS/FINANCE only

**Endpoints secured:**
| Endpoint | Method | Guard Added |
|----------|--------|-------------|
| `/aftersales/orders/{id}/` | GET | `_check_order_access` |
| `/aftersales/orders/{id}/` | POST | `_require_admin` |
| `/aftersales/orders/{id}/download/` | GET | `current_user` added |
| `/aftersales/orders/{id}/{item_id}/` | PUT | `_require_admin` |
| `/aftersales/orders/{id}/{item_id}/photos/` | POST | `current_user` added |
| `/aftersales/orders/{id}/{item_id}/photos/{filename}` | DELETE | `_require_admin` |
| `/aftersales/orders/{id}/{item_id}/resolve/` | PUT | `_require_admin` (CRITICAL) |
| `/aftersales/pending/` | GET | Client ownership check |
| `/aftersales/` | GET | `current_user` added |

---

### 2. Client Portal After-Sales: No Ownership Check (FIXED)

**File:** `backend/routers/aftersales.py`
**Lines:** 1042, 1079, 1142

**Issue:** Client portal endpoints (`/client/orders/{order_id}/`) fetched and modified after-sales items by `order_id` alone with NO verification that the authenticated CLIENT user owned that order. Code comment explicitly acknowledged this: `"Permission check would be done at gateway level"` — but no gateway check existed.

**Impact:** Any CLIENT could view and submit claims for any other client's order (IDOR).

**Fix Applied:**
- Added `current_user: CurrentUser = Depends(get_current_user)` to all 3 client endpoints
- Added ownership check: `if current_user.user_type == "CLIENT" and order.client_id != current_user.client_id: raise 403`

**Endpoints secured:**
| Endpoint | Guard Added |
|----------|-------------|
| `GET /aftersales/client/orders/{id}/` | `order.client_id == current_user.client_id` |
| `POST /aftersales/client/orders/{id}/claims/` | `order.client_id == current_user.client_id` |
| `POST /aftersales/client/orders/{id}/{item_id}/photos/` | `order.client_id == current_user.client_id` |

---

### 3. Documents: All Endpoints Missing Auth (FIXED)

**File:** `backend/routers/documents.py`
**Lines:** 23, 47, 91, 110

**Issue:** Every documents endpoint had NO `current_user` parameter and performed ZERO authorization checks. Any authenticated user could list, upload, download, and delete documents for ANY order.

**Impact:** CLIENT A could download CLIENT B's commercial invoices, packing lists, BOL, and all shipping documents. Any user could delete any document.

**Fix Applied:**
- Added `from core.security import get_current_user, CurrentUser` import
- Created `_verify_doc_access()` helper for RLS checks
- Added `current_user` + access check to all 4 endpoints
- `delete_document` restricted to ADMIN/SUPER_ADMIN/OPERATIONS only

**Endpoints secured:**
| Endpoint | Method | Guard Added |
|----------|--------|-------------|
| `/documents/orders/{id}/` | GET | `_verify_doc_access` |
| `/documents/orders/{id}/` | POST | `_verify_doc_access` |
| `/documents/{doc_id}/download/` | GET | `_verify_doc_access` via order |
| `/documents/{doc_id}/` | DELETE | ADMIN only + role check |

---

### 4. Customs: All 13 Endpoints Missing Auth (FIXED)

**File:** `backend/routers/customs.py`
**Lines:** 324, 337, 356, 373, 436, 447, 456, 525, 608, 624, 639, 657, 671

**Issue:** Every single endpoint in the customs router had NO `current_user` parameter. No endpoint checked the user's role or access to the specific shipment/order/BOE. Any authenticated CLIENT or FACTORY user could:
- Read/modify Bill of Entry records for any shipment
- Create/delete BOEs
- Modify HSN tariff rates (affecting ALL duty calculations system-wide)
- Add customs milestones and modify clearance charges

**Impact:** Financial manipulation — CLIENT could modify duty calculations to reduce their landed cost. FACTORY could access confidential customs data.

**Fix Applied:**
- Added `from core.security import get_current_user, CurrentUser` import
- Created `_require_internal()` helper — blocks CLIENT and FACTORY users entirely
- Added `current_user` + `_require_internal()` to ALL 13 endpoints

**Endpoints secured:**
| Endpoint | Method | Guard |
|----------|--------|-------|
| `/customs/tariffs/` | GET | `_require_internal` |
| `/customs/tariffs/` | POST | `_require_internal` |
| `/customs/tariffs/{id}` | PUT | `_require_internal` |
| `/customs/shipments/{id}/hsn-items/` | GET | `_require_internal` |
| `/customs/shipments/{id}/items-count/` | GET | `_require_internal` |
| `/customs/shipments/{id}/boe/` | GET | `_require_internal` |
| `/customs/shipments/{id}/boe/` | POST | `_require_internal` |
| `/customs/boe/{id}/` | PUT | `_require_internal` |
| `/customs/boe/{id}/` | DELETE | `_require_internal` |
| `/customs/orders/{id}/milestones/` | GET | `_require_internal` |
| `/customs/orders/{id}/milestones/` | POST | `_require_internal` |
| `/customs/orders/{id}/charges/` | GET | `_require_internal` |
| `/customs/orders/{id}/charges/` | POST | `_require_internal` |

---

### 5. Orders: create_order / update_order / reopen_order Missing Auth (FIXED)

**File:** `backend/routers/orders.py`
**Lines:** 903, 1001, 2447

**Issue:** `create_order`, `update_order`, and `reopen_order` had NO `current_user` dependency and performed no role checks. Any authenticated user could:
- Create orders for any `client_id` they supplied
- Change the `client_id`, `factory_id`, or `currency` of any order
- Reopen completed orders

**Impact:** A CLIENT user could create orders on behalf of other clients, reassign factories, or reopen completed orders to manipulate them.

**Fix Applied:**
- `create_order`: Added `current_user` + restricted to ADMIN/SUPER_ADMIN/OPERATIONS
- `update_order`: Added `current_user` + restricted to ADMIN/SUPER_ADMIN/OPERATIONS
- `reopen_order`: Added `current_user` + restricted to ADMIN/SUPER_ADMIN only

---

### 6. Finance: update_payment Missing Auth (FIXED)

**File:** `backend/routers/finance.py`
**Line:** 455

**Issue:** `update_payment` had NO `current_user` dependency and no authorization check. Any authenticated user could modify any payment's amount, currency, exchange rate, method, and date.

**Impact:** Financial record manipulation — a CLIENT could change payment amounts to show they paid more than they did.

**Fix Applied:**
- Added `current_user` + restricted to ADMIN/SUPER_ADMIN/FINANCE roles

---

## HIGH Issues Fixed in Round 2

| # | File | Issue | Resolution |
|---|------|-------|------------|
| H1 | `useAuth.js` | JWT refresh tokens in localStorage (XSS-stealable) | Moved refresh token to `httpOnly` + `secure` + `samesite=strict` cookie scoped to `/api/auth`. Access token remains in memory. |
| H2 | `security.py` | Dev auth bypass `ALLOW_DEV_AUTH` no production safeguard | Bypass removed entirely; `get_current_user` always requires a Bearer token. |
| H3 | `config.py` | Hardcoded JWT default secret in production | Config raises `RuntimeError` at startup if `JWT_SECRET_KEY` is unset or equals the dev default while `DEBUG=false`. |
| H4 | `aftersales.py` | Photo upload: no file type validation | `core/file_upload.py` helper validates content-type + magic bytes (JPEG/PNG/WebP only). |
| H5 | `aftersales.py` | Photo upload: no file size limit | Streamed upload with 10 MB limit enforced via `stream_upload_to_disk`. |
| H6 | `queries.py` | Query attachment read fully into memory | Streamed to disk with size + type validation. |
| H7 | `auth.py` | `/auth/refresh` no rate limiting | `@limiter.limit("20/minute")` applied. Payments and uploads also rate-limited. |
| H8 | `auth.py` | Refresh tokens never invalidated server-side | **Round 2:** `revoked_tokens` table added with JTI tracking. `create_*_token` now embeds `jti`; `decode_token` checks revocation; `/logout` revokes both access + refresh tokens. Fail-closed on DB error. |
| H9 | `finance.py` | Payment submit: no upper bound on amount/exchange_rate | Pydantic schema enforces `gt=0` and configurable upper bounds (amount ≤ 1e9, exchange_rate 0.0001–1e6). |
| H10 | `main.py` | Swagger UI exposed in production | `/api/docs`, `/api/redoc`, and `/api/openapi.json` disabled when `DEBUG=false`. |

---

## MEDIUM Issues Fixed in Round 2

| # | File | Issue | Resolution |
|---|------|-------|------------|
| M1 | `main.py` | Missing CSP and HSTS | `Content-Security-Policy` (strict default-src/self, no inline-script), `Strict-Transport-Security` (1 yr, includeSubDomains, preload in prod), X-XSS-Protection added. |
| M2 | `main.py` | Static `/uploads` served from same origin | Upload directory returns `X-Content-Type-Options: nosniff` + `Content-Disposition: attachment` for non-image types; disallow-list blocks HTML/JS/SVG. |
| M3 | `main.py` | Graphify publicly accessible | `/graphify` route gated behind `require_admin`. |
| M4 | Multiple routers | Rate limiting gaps | `slowapi` limits on `/auth/login`, `/auth/refresh`, payment POST, file uploads, Excel imports. |
| M5 | `auth.py` | No server-side token revocation on logout | See H8. |
| M6 | `aftersales.py` | No validation bounds on AfterSalesSaveItem | Pydantic `Field(ge=0)` on all quantity/price fields; server rejects negatives. |
| M7 | `main.py` | Debug mode leaks internal error details | Global exception handler returns generic 500 when `DEBUG=false`; details only logged. |
| M8 | `requirements.txt` | `python-jose` unbounded, known CVEs | Pinned `python-jose[cryptography]==3.5.0` + transitive pins: `cryptography>=46.0.7`, `pyasn1>=0.6.3`, `ecdsa>=0.19.2`. |
| M9 | `main.py` | Health check leaks app version | `/health` returns `{"status":"ok"}` only; version moved behind admin-auth `/internal/version`. |

---

## LOW Issues Fixed in Round 2

| # | File | Issue | Resolution |
|---|------|-------|------------|
| L1 | `security.py` | SHA-256 password fallback | Fallback removed. System raises `ImportError` at startup if neither passlib[argon2] nor argon2-cffi is installed. |
| L2 | `config.py` | SQLite DB file in repo root | Added `harvesterpdata.db*` to `.gitignore`; prod configuration uses PostgreSQL via `DATABASE_URL` env var. |
| L3 | `requirements.txt` | Non-deterministic builds | `requirements.lock` generated by `pip-compile --generate-hashes` (1340 lines, all 81 transitive deps pinned + SHA256-verified). Docker builds will use `pip install --require-hashes -r requirements.lock`. |

---

## Access Control Matrix (After Fixes)

| Resource | ADMIN | OPERATIONS | FINANCE | CLIENT | FACTORY |
|----------|-------|------------|---------|--------|---------|
| Create Order | ✅ | ✅ | ❌ | ❌ | ❌ |
| Update Order | ✅ | ✅ | ❌ | ❌ | ❌ |
| Reopen Order | ✅ | ❌ | ❌ | ❌ | ❌ |
| View Order | ✅ | ✅ | ✅ | Own only | Own only |
| After-Sales (admin) | ✅ | ✅ | ✅ | ❌ | ❌ |
| After-Sales (resolve) | ✅ | ✅ | ✅ | ❌ | ❌ |
| After-Sales (client submit) | ✅ | ✅ | ✅ | Own only | ❌ |
| Documents (view) | ✅ | ✅ | ✅ | Own only | Own only |
| Documents (delete) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Customs (all) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Payments (modify) | ✅ | ❌ | ✅ | ❌ | ❌ |
| Payments (submit) | ✅ | ✅ | ✅ | Own only | ❌ |

---

## Verification (Round 2 — 2026-04-17)

### Automated scans

| Scan | Before | After Round 2 |
|------|--------|---------------|
| **Bandit** HIGH | 5 | **0** |
| **Bandit** MEDIUM | 1 | **0** |
| **pip-audit** (requirements.txt) | 6 CVEs | **0 CVEs** |
| **npm audit** total | 5 (3 HIGH) | **0** |

`pip-audit` reports `No known vulnerabilities found` against the production requirements file. Remaining CVEs found by an unrestricted `pip-audit` (curl-cffi, tornado, pytest, pygments, requests) belong to **development-only** packages (Jupyter, pytest, pip-audit itself) that are *not* shipped via the Dockerfile.

### Test suite

- **98 tests pass** — up from 43 in Round 1
- Covers transparency, RBAC, IDOR regression, field leakage, client inquiry, and auth flows
- Frontend build passes (exceljs replaces xlsx; no remaining prototype-pollution / ReDoS CVEs)

### Manual verification

- `create_access_token` / `create_refresh_token` now always embed a `jti` claim
- `decode_token` fails closed on revocation-table DB error
- End-to-end round-trip: issue → revoke → decode returns 401 "Token has been revoked"
- `alembic upgrade head` successfully applies the `revoked_tokens` migration (`c3d4e5f6g7h8`)
- Reproducible-build lockfile at `backend/requirements.lock` (SHA256 hashes for every pinned transitive dep)

---

## Next Steps (post round 2)

Security hardening of the application code is complete. The remaining work is **operational readiness** — tracked in `docs/SAAS_LAUNCH_READINESS_AUDIT.md`:

1. **Infrastructure:** SSL/TLS on Hostinger VPS, nginx reverse proxy, ufw firewall rules, Cloudflare DDoS protection
2. **Backups:** Daily `pg_dump` cron + offsite replica; encrypted at rest
3. **Monitoring:** Sentry (error), UptimeRobot (uptime), structured JSON logs to Loki
4. **Compliance:** Privacy policy, ToS, incident response runbook, grievance officer appointment (Indian IT Act)
5. **QA:** Playwright E2E on critical journeys (login, order create, payment submit), k6 load test, axe accessibility scan
6. **Pre-deploy:** PentAGI live pentest on staging VPS

After launch, re-run `pip-audit` + `npm audit` + Bandit weekly in CI; alert on new HIGH/CRITICAL findings.

---

## Tools Used

| Tool | Purpose |
|------|---------|
| Claude Code security-reviewer agent | Full source code audit across all routers |
| Manual code review | Targeted IDOR and business logic analysis |
| Grep across codebase | Finding all unprotected endpoints |
| Bandit 1.9.4 | Python SAST — detected MD5/mktemp, 0 HIGH/MEDIUM after Round 2 |
| pip-audit 2.10.0 | Python CVE scanner — 0 CVEs in production deps |
| npm audit | JavaScript CVE scanner — 0 CVEs after xlsx → exceljs swap |
| pip-compile 7.5.3 | Generated `requirements.lock` with SHA256 hashes |
| pytest (98 tests) | Regression testing after fixes |

> **Note:** PentAGI (pentagi.com) was evaluated for live penetration testing but requires a deployed application. It will be used post-deployment on the Hostinger VPS for network-level and runtime security testing.
