# Security Audit & MNC-Grade Upgrade Path

**System:** HarvestERP v1.0 (Vue 3 + FastAPI + SQLite)
**Date:** 2026-03-22
**Classification:** CONFIDENTIAL

---

## Executive Summary

HarvestERP is **not production-ready**. The system has **4 CRITICAL**, **11 HIGH**, **8 MEDIUM**, and **4 LOW** severity vulnerabilities. The most damaging finding: **zero authentication exists on any endpoint** -- every API route, every uploaded file, every financial record is publicly accessible to anyone who can reach the server.

| Severity | Count | Verdict |
|----------|-------|---------|
| CRITICAL | 4 | **BLOCKS deployment** |
| HIGH | 11 | Must fix before production |
| MEDIUM | 8 | Fix within first sprint |
| LOW | 4 | Fix when convenient |

**Bottom line:** The application is a fully functional ERP with excellent business logic, but it was built with developer-ergonomic defaults (no auth, open CORS, SQLite, public Swagger). It needs a complete security layer before any production deployment.

---

## Part 1: Current Vulnerability Map

### CRITICAL Findings (Deployment Blockers)

#### C1. Live API Key in `.env` File
- **File:** `backend/.env` line 1
- **OWASP:** A02:2021 - Cryptographic Failures
- **Impact:** Anthropic API key exposed. If committed to git or accessed via path traversal, attacker gets unlimited AI API access billed to the account.
- **Action:** Rotate key immediately. Add `detect-secrets` pre-commit hook.

#### C2. Zero Authentication on All 100+ Endpoints
- **Files:** All 13 router modules
- **OWASP:** A07:2021 - Identification and Authentication Failures
- **Impact:** Anyone on the network can read all financial data, create/delete orders, upload files, trigger AI calls. No `get_current_user`, no JWT, no API key, no session -- nothing.
- **Example:** `GET /api/finance/orders/{id}/payments/` returns full payment ledger with zero auth.

#### C3. Zero Authorization / RBAC
- **Files:** All router modules
- **OWASP:** A01:2021 - Broken Access Control
- **Impact:** Even after auth is added, any authenticated user can perform any operation. No roles, no ownership checks, no resource-level authorization.

#### C4. File Upload -- No Content-Type or Magic Byte Validation
- **Files:** `documents.py`, `shipping.py`, `aftersales.py`
- **OWASP:** A04:2021 - Insecure Design
- **Impact:** Attacker can upload web shells, executables, or XXE-crafted files disguised as PDFs/images. Shipping upload uses raw `file.filename` in path construction.

### HIGH Findings

| # | Finding | File(s) | OWASP |
|---|---------|---------|-------|
| H1 | No rate limiting on any endpoint | All routers | A04:2021 |
| H2 | Missing HTTP security headers (no X-Frame-Options, CSP, HSTS, nosniff) | `main.py` | A05:2021 |
| H3 | CORS allows multiple localhost origins + `allow_credentials=True` | `config.py`, `main.py` | A05:2021 |
| H4 | Content-Disposition header injection via unsanitized entity names | `finance.py`, `orders.py` | A03:2021 |
| H5 | All uploaded files publicly served at `/uploads/` with no auth | `main.py:499` | A01:2021 |
| H6 | Client-controlled file_path in analyze-columns endpoint | `excel.py:180-218` | A01:2021 |
| H7 | Unsanitized `file.filename` in shipping upload path | `shipping.py:814` | A01:2021 |
| H8 | No CSRF protection (frontend) | `api/index.js` | A05:2021 |
| H9 | Vulnerable `xlsx@0.18.5` dependency (Prototype Pollution + ReDoS, no fix available) | `package.json` | A06:2021 |
| H10 | No Content Security Policy | `vite.config.js` | A05:2021 |
| H11 | `/tech-stack` route exposes full infrastructure (DB tables, versions, AI model, file paths) | `TechStack.vue` | A05:2021 |

### MEDIUM Findings

| # | Finding | File(s) |
|---|---------|---------|
| M1 | Banking PII stored and returned in plaintext (bank_account, SWIFT, GSTIN, PAN) | `models.py` |
| M2 | Document download serves file from DB-stored path without UPLOAD_DIR bounds check | `documents.py:101-117` |
| M3 | f-string SQL interpolation in startup migration DDL | `main.py:48-52` |
| M4 | PI download uses absolute DB-stored path without bounds check | `excel.py:533-543` |
| M5 | No `max_length` on any Pydantic string field | All schemas |
| M6 | After-sales photo extension from attacker-controlled filename | `aftersales.py:739-741` |
| M7 | Swagger UI + ReDoc publicly exposed | `main.py:464-470` |
| M8 | `console.error` with full response data in 80+ locations visible in production | All components |

### LOW Findings

| # | Finding |
|---|---------|
| L1 | Content-Disposition not RFC 5987 encoded (breaks on CJK names) |
| L2 | MD5 used for image deduplication (should be SHA-256) |
| L3 | SQLite database files in project directory |
| L4 | Blob URLs not revoked in error paths (memory leak) |

---

## Part 2: Target Security Architecture

### Layer 1: Identity & Access Management (IAM)

```
                    Client Browser
                         |
                    [HTTPS/TLS 1.3]
                         |
                   +-----v------+
                   |  Vue SPA   |
                   |  (stores   |
                   |  JWT in    |
                   |  httpOnly  |
                   |  cookie)   |
                   +-----+------+
                         |
              Authorization: Bearer <JWT>
                         |
                   +-----v------+
                   |  FastAPI   |
                   |  Auth      |
                   |  Middleware |
                   +-----+------+
                         |
              get_current_user() dependency
                         |
            +------------+------------+
            |            |            |
     [verify_jwt]  [check_role]  [check_owner]
            |            |            |
     decode token   ADMIN/FINANCE/   resource.owner_id
     check expiry   OPERATIONS/      == current_user.id
     check issuer   VIEWER roles
```

**JWT Architecture:**
- **Access Token:** 15-minute expiry, contains `user_id`, `roles[]`, `tenant_id`
- **Refresh Token:** 7-day expiry, stored in httpOnly secure cookie, rotated on each use
- **Token Storage:** httpOnly + Secure + SameSite=Strict cookie (immune to XSS theft)
- **SSO Ready:** OIDC/SAML integration point via `/auth/sso/callback` endpoint

**Role Definitions:**

| Role | Access |
|------|--------|
| `ADMIN` | Full system access, user management, settings |
| `FINANCE` | Payments, ledgers, invoices, exchange rates |
| `OPERATIONS` | Orders, products, factories, shipping, customs |
| `VIEWER` | Read-only access to assigned orders |

### Layer 2: Zero-Trust API Security

```python
# Every endpoint gets this pattern:
@router.post("/orders/")
def create_order(
    data: OrderCreate,
    current_user: User = Depends(get_current_user),      # Authentication
    _: None = Depends(require_role(["ADMIN", "OPS"])),    # Authorization
    db: Session = Depends(get_db),
):
    # Resource-level check
    audit_log(db, current_user, "ORDER_CREATE", data.dict())
    ...
```

**FastAPI Dependency Chain:**
1. `get_current_user()` -- Extracts + validates JWT from cookie/header
2. `require_role(roles)` -- Checks user.roles intersects required roles
3. `require_owner(resource)` -- Checks resource belongs to user's tenant
4. `audit_log()` -- Records action in immutable audit trail

**Rate Limiting (slowapi):**
- Auth endpoints: 5 req/min per IP
- Write endpoints: 30 req/min per user
- Read endpoints: 100 req/min per user
- Excel upload: 3 req/min per user (AI cost protection)

### Layer 3: Global Immutable Audit Trail

```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(100) NOT NULL,       -- 'ORDER_CREATE', 'PAYMENT_DELETE', etc.
    resource_type VARCHAR(50) NOT NULL,  -- 'order', 'payment', 'product'
    resource_id UUID,
    tenant_id UUID NOT NULL,
    ip_address INET,
    user_agent TEXT,
    old_values JSONB,                    -- Previous state (for updates/deletes)
    new_values JSONB,                    -- New state (for creates/updates)
    metadata JSONB                       -- Additional context
);

-- Immutability: no UPDATE or DELETE allowed
REVOKE UPDATE, DELETE ON audit_log FROM app_user;
```

**Audited Actions:**
- All CREATE, UPDATE, DELETE operations across every table
- Stage transitions with override reasons
- File uploads and downloads
- Authentication events (login, logout, failed attempts)
- Payment mutations (create, modify, delete)
- Excel import apply operations

**SOC2 Compliance Points:**
- Tamper-proof (DB-level REVOKE prevents modification)
- Queryable by time range, user, resource type
- Exportable for compliance auditors
- 90-day hot storage, 7-year cold archive

### Layer 4: Infrastructure Security

**Database Migration: SQLite -> PostgreSQL**
```
Current: SQLite (single file, no encryption, no concurrent writes)
Target:  PostgreSQL 16 (encrypted volumes, connection pooling, row-level security)

Migration Path:
1. Use alembic for schema migration scripts
2. pgcrypto extension for field-level encryption (bank accounts, PAN, GSTIN)
3. Connection pooling via PgBouncer (transaction mode)
4. WAL-level replication for disaster recovery
```

**Secrets Management:**
```
Current: .env file with plaintext API key
Target:  Environment-injected secrets (never on disk)

Required Environment Variables:
- DATABASE_URL (PostgreSQL connection string)
- JWT_SECRET_KEY (256-bit random, rotated quarterly)
- JWT_REFRESH_SECRET (separate key for refresh tokens)
- ANTHROPIC_API_KEY (AI service)
- ENCRYPTION_KEY (for field-level PII encryption)
- SENTRY_DSN (error tracking)
- ALLOWED_ORIGINS (CORS whitelist, comma-separated)

Deployment: Docker secrets / AWS SSM / Vault / Railway secrets
```

**HTTP Security Headers (middleware):**
```python
@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response
```

---

## Part 3: Phased Implementation Plan

### Phase 0: Emergency Fixes (Day 1)
**Zero business logic changes. Security-only.**

- [ ] Rotate the Anthropic API key
- [ ] Add file upload magic byte validation (whitelist: xlsx, pdf, png, jpg)
- [ ] Sanitize all `file.filename` inputs (strip path separators, limit extensions)
- [ ] Add UPLOAD_DIR bounds check to all FileResponse calls
- [ ] Disable Swagger UI in production (`docs_url=None if PROD`)
- [ ] Guard `/tech-stack` route (dev-only or admin-only)
- [ ] Add security headers middleware
- [ ] Strip `console.*` from production builds

### Phase 1: Authentication (Week 1)
**Add JWT auth without changing any business logic.**

- [ ] Create `users` table (id, email, password_hash, roles, is_active)
- [ ] Create `auth` router: `/auth/login`, `/auth/refresh`, `/auth/logout`
- [ ] Implement `get_current_user` FastAPI dependency
- [ ] Add `Depends(get_current_user)` to ALL existing router endpoints
- [ ] Add Vue router guard: redirect to `/login` if no valid token
- [ ] Add axios interceptor: attach JWT to all requests
- [ ] Add token refresh logic (auto-refresh before expiry)
- [ ] Create admin user via CLI seed command

### Phase 2: Authorization & RBAC (Week 2)
**Add role-based access control.**

- [ ] Add `role` column to users table (ADMIN, FINANCE, OPERATIONS, VIEWER)
- [ ] Create `require_role()` FastAPI dependency
- [ ] Map all endpoints to required roles
- [ ] Add frontend route guards per role
- [ ] Hide UI elements based on user role (v-if="hasRole('FINANCE')")

### Phase 3: Audit Trail (Week 3)
**Expand PaymentAuditLog to global audit system.**

- [ ] Create `audit_log` table with JSONB old/new values
- [ ] Create `audit_log()` utility function
- [ ] Add audit logging to all write endpoints
- [ ] Add audit log viewer UI (admin-only)
- [ ] Enforce immutability (no UPDATE/DELETE on audit_log)

### Phase 4: API Hardening (Week 4)
**Rate limiting, input validation, CORS lockdown.**

- [ ] Install and configure `slowapi` rate limiter
- [ ] Add `max_length` to all Pydantic string fields
- [ ] Add numeric range validation to financial fields
- [ ] Restrict CORS to production domain only
- [ ] Add CSRF protection (if using cookies)
- [ ] Replace `xlsx` npm package with `exceljs` or remove client-side parsing
- [ ] Replace MD5 with SHA-256 for image hashing
- [ ] Sanitize Content-Disposition filenames (RFC 5987)

### Phase 5: Infrastructure (Month 2)
**Database migration, encryption, monitoring.**

- [ ] Set up PostgreSQL with encrypted volumes
- [ ] Create alembic migration scripts
- [ ] Migrate data from SQLite to PostgreSQL
- [ ] Add field-level encryption for PII (bank accounts, tax IDs)
- [ ] Move secrets to environment variables / secrets manager
- [ ] Add Sentry for error monitoring
- [ ] Set up HTTPS with auto-renewing certificates
- [ ] Add health check endpoints with auth
- [ ] Configure backup and disaster recovery
- [ ] Serve uploaded files through authenticated download endpoint (not static mount)

### Phase 6: Compliance & Hardening (Month 3)
**SOC2-ready posture.**

- [ ] SSO/OIDC integration for enterprise clients
- [ ] Session management (concurrent session limits, forced logout)
- [ ] Password policy enforcement (complexity, rotation)
- [ ] Data retention policies (auto-archive after configured period)
- [ ] Penetration testing by external firm
- [ ] Security documentation for compliance auditors
- [ ] Dependency vulnerability scanning in CI/CD (Snyk/Dependabot)
- [ ] Pre-commit hooks for secret detection

---

## Risk Matrix

| Phase | Effort | Risk Reduction | Business Impact |
|-------|--------|---------------|-----------------|
| Phase 0 | 1 day | 20% | Zero -- no behavior changes |
| Phase 1 | 1 week | 50% | Login page added |
| Phase 2 | 1 week | 15% | Role-based UI visibility |
| Phase 3 | 1 week | 5% | Audit log viewer added |
| Phase 4 | 1 week | 5% | Validation error messages |
| Phase 5 | 2 weeks | 4% | Database migration downtime |
| Phase 6 | 2 weeks | 1% | SSO login option |

**Total estimated effort:** 8 weeks to MNC-grade security posture.

---

## Appendix: Full Vulnerability Register

| ID | Severity | OWASP | Finding | Phase |
|----|----------|-------|---------|-------|
| C1 | CRITICAL | A02 | API key in .env | 0 |
| C2 | CRITICAL | A07 | No authentication | 1 |
| C3 | CRITICAL | A01 | No authorization/RBAC | 2 |
| C4 | CRITICAL | A04 | No file upload validation | 0 |
| H1 | HIGH | A04 | No rate limiting | 4 |
| H2 | HIGH | A05 | No security headers | 0 |
| H3 | HIGH | A05 | Broad CORS + credentials | 4 |
| H4 | HIGH | A03 | Content-Disposition injection | 4 |
| H5 | HIGH | A01 | Public /uploads/ directory | 5 |
| H6 | HIGH | A01 | Client-controlled file_path | 4 |
| H7 | HIGH | A01 | Unsanitized upload filename | 0 |
| H8 | HIGH | A05 | No CSRF protection | 4 |
| H9 | HIGH | A06 | Vulnerable xlsx dependency | 4 |
| H10 | HIGH | A05 | No CSP | 0 |
| H11 | HIGH | A05 | Tech stack page public | 0 |
| M1 | MEDIUM | A02 | PII in plaintext | 5 |
| M2 | MEDIUM | A01 | Document path traversal | 0 |
| M3 | MEDIUM | A03 | f-string SQL in DDL | 4 |
| M4 | MEDIUM | A01 | PI download path traversal | 0 |
| M5 | MEDIUM | A03 | No max_length on strings | 4 |
| M6 | MEDIUM | A04 | Attacker-controlled file ext | 0 |
| M7 | MEDIUM | A05 | Public Swagger UI | 0 |
| M8 | MEDIUM | A05 | console.error in production | 0 |
| L1 | LOW | A05 | Content-Disposition encoding | 4 |
| L2 | LOW | A02 | MD5 for image hashing | 4 |
| L3 | LOW | A05 | SQLite files in project dir | 5 |
| L4 | LOW | -- | Blob URL memory leak | 4 |

---

*Report generated by parallel security review agents analyzing 14,795 lines of backend Python and 21,718 lines of frontend Vue/JS code across 60+ source files.*
