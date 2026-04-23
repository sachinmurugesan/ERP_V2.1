# Authorization Surface Audit — HarvestERP Backend

**Audit date:** 2026-04-21  
**Scope:** All endpoints in `backend/routers/*.py`  
**Patches already applied:** Patch 1 (dashboard CNY scoping), Patch 2 (S-1 ADMIN global bypass removed)

---

## Router-level dependency map (from `main.py`)

| Router prefix | Router | Enforced dependency |
|---|---|---|
| `/api/auth` | auth.py | **PUBLIC** |
| `/api/dashboard` | dashboard.py | `get_current_user` |
| `/api/orders` | orders.py, queries.py | `get_current_user` |
| `/api/products` | products.py | `get_current_user` |
| `/api/factories` | factories.py | `get_current_user` |
| `/api/clients` | clients.py | `get_current_user` |
| `/api/documents` | documents.py | `get_current_user` |
| `/api/excel` | excel.py | `require_operations` → ADMIN\|OPERATIONS |
| `/api/shipping` | shipping.py | `get_current_user` |
| `/api/customs` | customs.py | `get_current_user` |
| `/api/unloaded-items` | unloaded.py | `get_current_user` |
| `/api/aftersales` | aftersales.py | `get_current_user` |
| `/api/finance` (main) | finance.py (router) | `require_finance` → ADMIN\|FINANCE |
| `/api/finance` (client) | finance.py (client_router) | `get_current_user` |
| `/api` | landed_cost.py | `get_current_user` |
| `/api/settings` | settings.py | `require_admin` → ADMIN |
| `/api/audit` | audit.py | `require_admin` |
| `/api/users` | users.py | `require_admin` |
| `/api/notifications` | notifications.py | `get_current_user` |

---

## Endpoint table — non-OK rows first

**Status codes:**  
`AUTH_TOO_PERMISSIVE` = role too broad for the data returned  
`PATCHED` = fixed by Patch 1 or 2 (was non-OK)  
`OK` = correct per D-004

### ✅ RESOLVED (Patch 18, 2026-04-22) — Finance: factory financial data (Cluster A / D-009)

**Pre-patch finding (corrected):** The original audit recorded auth check as "ROLE: FINANCE (router)" and missed that all 9 endpoints also carry `Depends(require_factory_financial) = require_role([SUPER_ADMIN, FINANCE])` at the endpoint level. Additionally, the original analysis did not account for the SUPER_ADMIN bypass in `has_any_role()` — SUPER_ADMIN was already passing the router-level `require_finance` check implicitly.

**True pre-patch effective access:** SUPER_ADMIN | FINANCE (not "FINANCE only" as originally stated).

**D-009 fix:** `require_finance` widened from `[ADMIN, FINANCE]` to `[SUPER_ADMIN, ADMIN, FINANCE]` in `core/security.py`. SUPER_ADMIN access is now explicit at the router layer. ADMIN continues to be blocked by the endpoint-level `require_factory_financial = require_role([SUPER_ADMIN, FINANCE])`. D-004 compliance maintained.

| Method | Path | File:Line | Auth check (post-patch) | Effective access | Status |
|---|---|---|---|---|---|
| GET | `/api/finance/factory-ledger/{factory_id}/` | finance.py:1479 | Router: SUPER_ADMIN\|ADMIN\|FINANCE + Endpoint: SUPER_ADMIN\|FINANCE | **SUPER_ADMIN\|FINANCE** | **RESOLVED** |
| GET | `/api/finance/factory-ledger/{factory_id}/download/` | finance.py:1839 | Same dual-dep | **SUPER_ADMIN\|FINANCE** | **RESOLVED** |
| GET | `/api/finance/orders/{order_id}/factory-payments/` | finance.py:728 | Same dual-dep | **SUPER_ADMIN\|FINANCE** | **RESOLVED** |
| POST | `/api/finance/orders/{order_id}/factory-payments/` | finance.py:808 | Same dual-dep | **SUPER_ADMIN\|FINANCE** | **RESOLVED** |
| PUT | `/api/finance/orders/{order_id}/factory-payments/{payment_id}/` | finance.py:891 | Same dual-dep | **SUPER_ADMIN\|FINANCE** | **RESOLVED** |
| DELETE | `/api/finance/orders/{order_id}/factory-payments/{payment_id}/` | finance.py:854 | Same dual-dep | **SUPER_ADMIN\|FINANCE** | **RESOLVED** |
| GET | `/api/finance/orders/{order_id}/payment-audit-log/` | finance.py:956 | Same dual-dep | **SUPER_ADMIN\|FINANCE** | **RESOLVED** |
| GET | `/api/finance/factories/{factory_id}/credits/` | finance.py:1388 | Same dual-dep | **SUPER_ADMIN\|FINANCE** | **RESOLVED** |
| POST | `/api/finance/orders/{order_id}/apply-factory-credit/` | finance.py:1414 | Same dual-dep | **SUPER_ADMIN\|FINANCE** | **RESOLVED** |

Verified: 27/27 test matrix passes. Test file: `backend/tests/test_d009_cluster_a_factory_ledger.py`

### AUTH_TOO_PERMISSIVE — Excel: PI download (Cluster B)

D-004 `download_pi_excel` requires **SUPER_ADMIN, FINANCE, or OPERATIONS** plus per-order ownership. Current `require_operations = require_role([ADMIN, OPERATIONS])` excludes FINANCE and includes ADMIN; no ownership check exists.

| Method | Path | File:Line | Auth check | Sensitive data | Should require | Status |
|---|---|---|---|---|---|---|
| POST | `/api/excel/generate-pi/{order_id}/` | excel.py:457 | ROLE: OPERATIONS (router) — no `current_user` param | YES — JSON response includes factory pricing fields | ROLE: SUPER_ADMIN\|FINANCE\|OPERATIONS + per-order ownership | **AUTH_TOO_PERMISSIVE** |
| GET | `/api/excel/download-pi/{order_id}/` | excel.py:602 | ROLE: OPERATIONS (router) — no `current_user` param, no ownership check | YES — serves Excel file with factory_price columns | ROLE: SUPER_ADMIN\|FINANCE\|OPERATIONS + per-order ownership | **AUTH_TOO_PERMISSIVE** |
| GET | `/api/excel/download-pi-with-images/{order_id}/` | excel.py:618 | ROLE: OPERATIONS (router) — no `current_user` param, no ownership check | YES — same as above | ROLE: SUPER_ADMIN\|FINANCE\|OPERATIONS + per-order ownership | **AUTH_TOO_PERMISSIVE** |

### AUTH_TOO_PERMISSIVE — Orders: pricing write/read (Cluster C)

No role check — any authenticated user (including CLIENT, FACTORY) can call these pricing mutation endpoints via the router-level `get_current_user`.

| Method | Path | File:Line | Auth check | Sensitive data | Should require | Status |
|---|---|---|---|---|---|---|
| PUT | `/api/orders/{order_id}/items/{item_id}/prices/` | orders.py:1998 | AUTH_ONLY — no role check | YES — reads/writes factory_price, markup_percent, selling_price_inr | ROLE: SUPER_ADMIN\|FINANCE | **AUTH_TOO_PERMISSIVE** |
| POST | `/api/orders/{order_id}/recalculate-prices/` | orders.py:2059 | AUTH_ONLY — no role check | YES — recalculates and returns factory_price-derived values | ROLE: SUPER_ADMIN\|FINANCE | **AUTH_TOO_PERMISSIVE** |
| POST | `/api/orders/{order_id}/copy-previous-prices/` | orders.py:2142 | AUTH_ONLY — no role check | YES — copies and returns factory_price/markup_percent from past orders | ROLE: SUPER_ADMIN\|FINANCE | **AUTH_TOO_PERMISSIVE** |
| POST | `/api/orders/{order_id}/parse-price-excel/` | orders.py:2290 | AUTH_ONLY — no role check | YES — parses uploaded Excel, returns matched factory_price rows | ROLE: SUPER_ADMIN\|FINANCE | **AUTH_TOO_PERMISSIVE** |

### AUTH_TOO_PERMISSIVE — Clients: markup fields in GET response (Cluster D)

`ClientResponse` schema (schemas/clients.py:30) includes `factory_markup_percent` and `sourcing_commission_percent`. These are returned to any authenticated user with no field-level stripping.

| Method | Path | File:Line | Auth check | Sensitive data | Should require | Status |
|---|---|---|---|---|---|---|
| GET | `/api/clients/` | clients.py:22 | AUTH_ONLY | YES — `factory_markup_percent`, `sourcing_commission_percent` in every row | Strip fields unless ADMIN\|SUPER_ADMIN | **AUTH_TOO_PERMISSIVE** |
| GET | `/api/clients/search/` | clients.py:57 | AUTH_ONLY | YES — same | Strip fields unless ADMIN\|SUPER_ADMIN | **AUTH_TOO_PERMISSIVE** |
| GET | `/api/clients/{client_id}/` | clients.py:72 | AUTH_ONLY | YES — same | Strip fields unless ADMIN\|SUPER_ADMIN | **AUTH_TOO_PERMISSIVE** |

### PATCHED — Orders: item mutation role check (Cluster E) — 2026-04-21

All 7 endpoints now reject non-INTERNAL tokens with 403. `current_user.user_type != "INTERNAL"` guard added to each function. Verified live.

| Method | Path | File:Line | Auth check | Sensitive data | Status |
|---|---|---|---|---|---|
| POST | `/api/orders/{order_id}/fetch-pending-items/` | orders.py:1365 | INTERNAL only | NO | **PATCHED** |
| POST | `/api/orders/{order_id}/bulk-text-add/` | orders.py:1410 | INTERNAL only | NO | **PATCHED** |
| POST | `/api/orders/{order_id}/bulk-text-add/apply/` | orders.py:1511 | INTERNAL only | NO | **PATCHED** |
| POST | `/api/orders/{order_id}/items/{item_id}/confirm/` | orders.py:1650 | INTERNAL only | NO | **PATCHED** |
| PUT | `/api/orders/{order_id}/items/{item_id}/` | orders.py:1851 | INTERNAL only | NO | **PATCHED** |
| PUT | `/api/orders/{order_id}/items/{item_id}/remove/` | orders.py:1889 | INTERNAL only | NO | **PATCHED** |
| DELETE | `/api/orders/{order_id}/items/{item_id}/` | orders.py:1943 | INTERNAL only | NO | **PATCHED** |

### AUTH_TOO_PERMISSIVE — Dashboard: no tenant scoping on aggregate/feed endpoints (Cluster F)

Three dashboard endpoints have no `current_user` parameter, so tenant-scoped filtering is impossible. CLIENT A can see CLIENT B's pending inquiries and all-tenant status counts.

| Method | Path | File:Line | Auth check | Sensitive data | Should require | Status |
|---|---|---|---|---|---|---|
| GET | `/api/dashboard/summary/` | dashboard.py:39 | AUTH_ONLY — no tenant scope | NO (aggregate counts only) | AUTH_ONLY + tenant scoping for CLIENT/FACTORY | **AUTH_TOO_PERMISSIVE** |
| GET | `/api/dashboard/client-inquiries/` | dashboard.py:162 | AUTH_ONLY — no tenant scope, no role check | NO (order metadata, client names, PO refs) | ROLE: ADMIN\|OPERATIONS | **AUTH_TOO_PERMISSIVE** |
| GET | `/api/dashboard/recent-activity/` | dashboard.py:191 | AUTH_ONLY — no tenant scope | NO (stage transitions only) | AUTH_ONLY + tenant scoping for CLIENT/FACTORY | **AUTH_TOO_PERMISSIVE** |

### PATCHED

| Method | Path | File:Line | Patch | Status |
|---|---|---|---|---|
| GET | `/api/dashboard/recent-orders/` | dashboard.py:81 | Patch 1 — tenant scoping + CNY stripped for non-INTERNAL | **PATCHED** |
| GET | `/api/dashboard/active-shipments/` | dashboard.py:117 | Patch 1 — tenant scoping + CNY stripped for non-INTERNAL | **PATCHED** |
| (global) | `require_role()` / `has_any_role()` / `has_role()` | core/security.py:56,60,238 | Patch 2 — ADMIN global bypass removed | **PATCHED** |

---

## OK endpoints

### auth.py — `/api/auth`

| Method | Path | File:Line | Auth check | Sensitive | Status |
|---|---|---|---|---|---|
| POST | `/api/auth/login` | auth.py:23 | PUBLIC | NO | OK |
| POST | `/api/auth/refresh` | auth.py:112 | PUBLIC | NO | OK |
| POST | `/api/auth/logout` | auth.py:146 | PUBLIC | NO | OK |
| GET | `/api/auth/me` | auth.py:172 | AUTH_ONLY | NO | OK |

### dashboard.py — `/api/dashboard`

| Method | Path | File:Line | Auth check | Sensitive | Status |
|---|---|---|---|---|---|
| GET | `/api/dashboard/recent-orders/` | dashboard.py:81 | CUSTOM (tenant scope + INTERNAL-only CNY) | YES | PATCHED |
| GET | `/api/dashboard/active-shipments/` | dashboard.py:117 | CUSTOM (tenant scope + INTERNAL-only CNY) | YES | PATCHED |

### orders.py — `/api/orders` (OK endpoints only)

| Method | Path | File:Line | Auth check | Sensitive | Status |
|---|---|---|---|---|---|
| GET | `/api/orders/status-counts/` | orders.py:366 | AUTH_ONLY | NO | OK |
| GET | `/api/orders/my-ledger/` | orders.py:383 | AUTH_ONLY | NO (selling_price_inr only) | OK |
| GET | `/api/orders/reconciliation/{order_id}/` | orders.py:492 | AUTH_ONLY | NO | OK |
| GET | `/api/orders/{order_id}/` | orders.py:643 | CUSTOM (transparency mask + filter_for_role) | YES | OK |
| POST | `/api/orders/client-inquiry/` | orders.py:677 | AUTH_ONLY | NO | OK |
| GET | `/api/orders/{order_id}/product-requests/` | orders.py:792 | AUTH_ONLY | NO | OK |
| POST | `/api/orders/{order_id}/approve-inquiry/` | orders.py:826 | CUSTOM (inline ADMIN\|OPERATIONS check) | NO | OK |
| POST | `/api/orders/` | orders.py:902 | CUSTOM (inline manage_orders check) | NO | OK |
| PUT | `/api/orders/{order_id}/` | orders.py:1000 | CUSTOM (inline manage_orders check) | NO | OK |
| DELETE | `/api/orders/{order_id}/` | orders.py:1053 | CUSTOM (inline manage_orders check) | NO | OK |
| PUT | `/api/orders/{order_id}/delete-reason/` | orders.py:1145 | AUTH_ONLY | NO | OK |
| POST | `/api/orders/{order_id}/items/` | orders.py:1521 | CUSTOM (inline manage_orders check) | NO | OK |
| POST | `/api/orders/{order_id}/items/bulk-confirm/` | orders.py:1712 | AUTH_ONLY | NO | OK |
| POST | `/api/orders/{order_id}/items/send-prices/` | orders.py:1811 | AUTH_ONLY | NO (selling price only) | OK |
| POST | `/api/orders/{order_id}/reset-aftersales-prices/` | orders.py:2246 | AUTH_ONLY | NO | OK |
| GET | `/api/orders/{order_id}/next-stages/` | orders.py:2394 | AUTH_ONLY | NO | OK |
| PUT | `/api/orders/{order_id}/transition/` | orders.py:2405 | CUSTOM (inline manage_orders check) | NO | OK |
| PUT | `/api/orders/{order_id}/reopen/` | orders.py:2447 | CUSTOM | NO | OK |
| PUT | `/api/orders/{order_id}/go-back/` | orders.py:2478 | CUSTOM | NO | OK |
| PUT | `/api/orders/{order_id}/jump-to-stage/` | orders.py:2510 | CUSTOM | NO | OK |
| GET | `/api/orders/{order_id}/activity-feed/` | orders.py:2543 | AUTH_ONLY | NO | OK |
| GET | `/api/orders/{order_id}/timeline/` | orders.py:2785 | AUTH_ONLY | NO | OK |
| POST | `/api/orders/{order_id}/packing-list/upload/` | orders.py:2855 | CUSTOM | NO | OK |
| POST | `/api/orders/{order_id}/packing-list/manual/` | orders.py:3049 | CUSTOM | NO | OK |
| GET | `/api/orders/{order_id}/packing-list/client-summary/` | orders.py:3150 | CUSTOM | NO | OK |
| GET | `/api/orders/{order_id}/packing-list/` | orders.py:3270 | CUSTOM | NO | OK |
| DELETE | `/api/orders/{order_id}/packing-list/` | orders.py:3348 | CUSTOM | NO | OK |
| PATCH | `/api/orders/{order_id}/packing-list/items/{item_id}/` | orders.py:3376 | CUSTOM | NO | OK |
| POST | `/api/orders/{order_id}/packing-list/items/{item_id}/split/` | orders.py:3435 | CUSTOM | NO | OK |
| POST | `/api/orders/{order_id}/packing-list/items/{item_id}/unsplit/` | orders.py:3490 | CUSTOM | NO | OK |
| POST | `/api/orders/{order_id}/packing-list/items/{item_id}/decision/` | orders.py:3517 | CUSTOM | NO | OK |
| GET | `/api/orders/{order_id}/packing-list/download-excel/` | orders.py:3664 | CUSTOM | NO | OK |
| GET | `/api/orders/{order_id}/packing-list/download-pdf/` | orders.py:3878 | CUSTOM | NO | OK |
| POST | `/api/orders/{order_id}/migrate-items/` | orders.py:4047 | CUSTOM | NO | OK |
| POST | `/api/orders/{order_id}/undo-migrate/` | orders.py:4153 | CUSTOM | NO | OK |
| GET | `/api/orders/{order_id}/production-progress/` | orders.py:4223 | AUTH_ONLY | NO | OK |
| PUT | `/api/orders/{order_id}/production-dates/` | orders.py:4262 | CUSTOM | NO | OK |
| GET | `/api/orders/{order_id}/download-pi/` | orders.py:4316 | AUTH_ONLY + ownership check | YES | OK |
| GET | `/api/orders/{order_id}/download-pi-with-images/` | orders.py:4336 | AUTH_ONLY + ownership check | YES | OK |

### queries.py — `/api/orders` (all OK)

| Method | Path | File:Line | Auth check | Sensitive | Status |
|---|---|---|---|---|---|
| POST | `/api/orders/{order_id}/queries/` | queries.py:104 | AUTH_ONLY | NO | OK |
| GET | `/api/orders/{order_id}/queries/` | queries.py:164 | AUTH_ONLY | NO | OK |
| GET | `/api/orders/{order_id}/queries/summary/` | queries.py:190 | AUTH_ONLY | NO | OK |
| GET | `/api/orders/{order_id}/queries/{query_id}/` | queries.py:216 | AUTH_ONLY | NO | OK |
| POST | `/api/orders/{order_id}/queries/{query_id}/reply/` | queries.py:237 | AUTH_ONLY | NO | OK |
| POST | `/api/orders/{order_id}/queries/{query_id}/reply/upload/` | queries.py:295 | AUTH_ONLY | NO | OK |
| PUT | `/api/orders/{order_id}/queries/{query_id}/resolve/` | queries.py:367 | AUTH_ONLY | NO | OK |
| PUT | `/api/orders/{order_id}/queries/{query_id}/reopen/` | queries.py:394 | AUTH_ONLY | NO | OK |
| DELETE | `/api/orders/{order_id}/queries/{query_id}/` | queries.py:419 | AUTH_ONLY | NO | OK |
| POST | `/api/orders/{order_id}/queries/inline/` | queries.py:448 | AUTH_ONLY | NO | OK |
| GET | `/api/orders/{order_id}/queries/inline-status/` | queries.py:543 | AUTH_ONLY | NO | OK |
| GET | `/api/orders/{order_id}/queries/{query_id}/attachments/{filename}` | queries.py | CUSTOM (AUTH_ONLY + CLIENT cross-tenant check + `..` path traversal guard) | NO | OK — **Patch 14 (G-019, 2026-04-22)** |

### products.py — `/api/products` (all OK — inline role checks for mutations)

All 31 endpoints: AUTH_ONLY (reads) or CUSTOM inline INTERNAL + ADMIN|SUPER_ADMIN check (writes). No pricing data returned. All OK.

**Correction (Patch 10 — G-011, 2026-04-22):** The original classification "CUSTOM inline ADMIN|OPERATIONS check (writes). All OK." was inaccurate. All 12 mutation endpoints had no `current_user` dep at all (AUTH_ONLY only via router-level dep). 4 review endpoints had `current_user` but no role check. 1 upload endpoint had `current_user` but no INTERNAL guard. All 17 guards added in Patch 10. Status is now correct.

**Added (Patch 14 — G-019, 2026-04-22):** `GET /api/products/file/?path=` — AUTH_ONLY + `products/` prefix whitelist + `..` path traversal guard. `FileResponse` stream. All API responses now emit `/api/products/file/?path=products/...` URLs via `_prod_url()` helper — no bare `/uploads/` paths in any products.py response.

### factories.py — `/api/factories` (all OK)

All 6 endpoints: AUTH_ONLY (reads) or CUSTOM inline INTERNAL + role check (writes). All OK.

**Correction (Patch 11 — G-012, 2026-04-22):** The original classification "CUSTOM inline ADMIN|OPERATIONS check (writes). All OK." was inaccurate — the 3 mutation handlers had no `current_user` dep at all. Guards added in Patch 11: `create_factory` → INTERNAL + ADMIN|SUPER_ADMIN; `update_factory` → INTERNAL + ADMIN|OPERATIONS|SUPER_ADMIN; `delete_factory` → INTERNAL + SUPER_ADMIN only. Status is now correct.

### clients.py — `/api/clients` (mutations OK; reads non-OK — see Cluster D above)

| Method | Path | File:Line | Auth check | Sensitive | Status |
|---|---|---|---|---|---|
| POST | `/api/clients/` | clients.py:80 | CUSTOM (inline ADMIN check) | NO | OK |
| PUT | `/api/clients/{client_id}/` | clients.py:97 | CUSTOM (inline ADMIN check) | NO | OK |
| DELETE | `/api/clients/{client_id}/` | clients.py:159 | CUSTOM (inline ADMIN check) | NO | OK |
| GET | `/api/clients/{client_id}/categories/` | clients.py:171 | AUTH_ONLY | NO | OK |
| PUT | `/api/clients/{client_id}/categories/` | clients.py:184 | CUSTOM | NO | OK |
| GET | `/api/clients/{client_id}/brands/` | clients.py:217 | AUTH_ONLY | NO | OK |
| PUT | `/api/clients/{client_id}/brands/` | clients.py:231 | CUSTOM | NO | OK |
| GET | `/api/clients/{client_id}/product-access/` | clients.py:273 | AUTH_ONLY | NO | OK |
| GET | `/api/clients/{client_id}/portal-permissions/` | clients.py:321 | AUTH_ONLY | NO | OK |
| PUT | `/api/clients/{client_id}/portal-permissions/` | clients.py:334 | CUSTOM | NO | OK |

### documents.py, customs.py — all OK

No sensitive financial data returned. AUTH_ONLY or CUSTOM inline role checks on mutations. All OK.

### shipping.py — G-002 CLOSED 2026-04-21 | G-014 CLOSED 2026-04-22 | G-019 file download added 2026-04-22

`list_shipments` now enforces `portal_permissions.show_shipping` for CLIENT callers. Verified 4/4.

Transport service provider mutation guards added (Patch 13 — G-014). Verified 21/21.

**Added (Patch 14 — G-019, 2026-04-22):** `GET /api/shipping/shipping-documents/{doc_id}/download/` — `Depends(get_current_user)` + CLIENT `show_shipping` portal permission check + FACTORY block + `FileResponse` stream. Path traversal safe (uses `Path(doc.file_path).name`). OK.

### unloaded.py — G-007 CLOSED 2026-04-22

`list_unloaded_items` and `get_pending_for_order` now enforce CLIENT/FACTORY ownership (absent param → force to own ID; mismatched → 403). `factory_price` stripped from CLIENT and FACTORY responses. Verified 9/9.

### aftersales.py — `/api/aftersales` (all OK)

All 12 endpoints: AUTH_ONLY or CUSTOM ADMIN|OPERATIONS inline checks. No factory pricing in responses. All OK.

**Added (Patch 14 — G-019, 2026-04-22):** `GET /api/aftersales/orders/{order_id}/photos/{filename}` — `Depends(get_current_user)` + `_check_order_access()` RLS (CLIENT cross-tenant check; FACTORY check) + `os.path.basename()` path traversal guard + `FileResponse` stream. OK.

### finance.py — `/api/finance` (OK endpoints only)

| Method | Path | File:Line | Auth check | Sensitive | Status |
|---|---|---|---|---|---|
| GET | `/api/finance/orders/{order_id}/payments/` | finance.py:46 | AUTH_ONLY (client_router) | NO | OK |
| POST | `/api/finance/orders/{order_id}/payments/` | finance.py:355 | AUTH_ONLY + inline FINANCE check | NO | OK |
| DELETE | `/api/finance/orders/{order_id}/payments/{payment_id}/` | finance.py:412 | AUTH_ONLY + inline check | NO | OK |
| PUT | `/api/finance/orders/{order_id}/payments/{payment_id}/` | finance.py:455 | AUTH_ONLY + inline check | NO | OK |
| POST | `/api/finance/payments/{payment_id}/verify/` | finance.py:640 | ROLE: FINANCE (router) | NO | OK |
| GET | `/api/finance/orders/{order_id}/pi-history/` | finance.py:982 | ROLE: FINANCE (router) | NO (INR totals only) | OK |
| GET | `/api/finance/exchange-rates/` | finance.py:1029 | ROLE: FINANCE (router) | NO | OK |
| GET | `/api/finance/clients/{client_id}/credits/` | finance.py:1044 | ROLE: FINANCE (router) | NO | OK |
| POST | `/api/finance/orders/{order_id}/apply-credit/` | finance.py:1070 | ROLE: FINANCE (router) | NO | OK |
| GET | `/api/finance/receivables/` | finance.py:1163 | ROLE: FINANCE (router) | NO (INR only) | OK |
| GET | `/api/finance/client-ledger/{client_id}/` | finance.py:1253 | ROLE: FINANCE (router) | NO | OK |
| GET | `/api/finance/client-ledger/{client_id}/download/` | finance.py:1619 | ROLE: FINANCE (router) | NO | OK |

### landed_cost.py — `/api`

| Method | Path | File:Line | Auth check | Sensitive | Status |
|---|---|---|---|---|---|
| GET | `/api/orders/{order_id}/landed-cost/` | landed_cost.py:44 | CUSTOM (inline allowlist SA\|ADMIN\|FINANCE + CLIENT ownership) | NO (uses client_factory_price, not real factory_price) | OK |
| GET | `/api/orders/{order_id}/landed-cost/download/` | landed_cost.py:219 | CUSTOM (delegates to above) | NO | OK |

### settings.py, audit.py, users.py — all OK

All under `require_admin` (ADMIN or SUPER_ADMIN). No factory pricing data returned. All OK.

### notifications.py — all OK

All AUTH_ONLY. No sensitive data. All OK.

---

## Summary counts

| Status | Count |
|---|---|
| AUTH_TOO_PERMISSIVE | **13** (was 22; Cluster A closed by Patch 18 — D-009) |
| PATCHED / RESOLVED | 22 (2 endpoints + 1 systemic fix + 7 Cluster E + 3 Cluster G + 9 Cluster A) |
| OK | ~174 (+4 authenticated file-download endpoints added by Patch 14 — G-019) |
| **Total endpoints** | **~206** |

**G-019 CLOSED (Patch 14, 2026-04-22):** The `/uploads/` StaticFiles mount (unauthenticated, bypassed DI) has been removed. 4 new authenticated download endpoints added (shipping docs, after-sales photos, query attachments, product files). Payment proof endpoint was already authenticated. nginx `location /uploads/` set to `internal;` in all 3 server blocks. 6 frontend Vue files updated. 0 bare `/uploads/` URL constructions remain in the codebase.

---

## Endpoint groups that need the same fix

### Cluster A — Factory financial data: apply `require_role([SUPER_ADMIN, FINANCE])` per-endpoint

**File:** `backend/routers/finance.py`  
**Root problem:** `require_finance = require_role([ADMIN, FINANCE])` — ADMIN included. D-004 explicitly excludes ADMIN from factory ledger access.  
**Fix:** Add `Depends(require_role([UserRole.SUPER_ADMIN, UserRole.FINANCE]))` as a **per-endpoint** dependency on each of the 9 affected functions. The router-level `require_finance` stays unchanged (needed for other non-factory finance endpoints).

Endpoints (9):
- `GET/GET /api/finance/factory-ledger/{factory_id}/` + `/download/`
- `GET/POST/PUT/DELETE /api/finance/orders/{order_id}/factory-payments/` + `/{payment_id}/`
- `GET /api/finance/orders/{order_id}/payment-audit-log/`
- `GET /api/finance/factories/{factory_id}/credits/`
- `POST /api/finance/orders/{order_id}/apply-factory-credit/`

---

### Cluster B — PI Excel download: ownership check + correct role set

**File:** `backend/routers/excel.py`  
**Root problem:** No `current_user` param → no ownership check. FINANCE excluded from allowed roles. No per-order scoping.  
**Fix:** Add `current_user: CurrentUser = Depends(get_current_user)` to each function. Add ownership guard: non-INTERNAL users can only access their own orders. The router-level `require_operations` needs a new companion `require_pi_download = require_role([SUPER_ADMIN, FINANCE, OPERATIONS])` added per-endpoint — or change the router-level dependency for these three routes.

Endpoints (3):
- `POST /api/excel/generate-pi/{order_id}/`
- `GET /api/excel/download-pi/{order_id}/`
- `GET /api/excel/download-pi-with-images/{order_id}/`

---

### Cluster C — Order pricing: add role guard to pricing mutation endpoints

**File:** `backend/routers/orders.py`  
**Root problem:** No role check on pricing mutation endpoints — any authenticated user including CLIENT/FACTORY can read and write real factory prices.  
**Fix:** Add `current_user: CurrentUser = Depends(get_current_user)` (already on router, but not in function params for these 4) and an inline role check: `if not current_user.has_any_role([UserRole.SUPER_ADMIN, UserRole.FINANCE]): raise HTTPException(403)`.

Endpoints (4):
- `PUT /api/orders/{order_id}/items/{item_id}/prices/`
- `POST /api/orders/{order_id}/recalculate-prices/`
- `POST /api/orders/{order_id}/copy-previous-prices/`
- `POST /api/orders/{order_id}/parse-price-excel/`

---

### Cluster D — Client markup fields: strip from response for non-admin callers

**Files:** `backend/routers/clients.py`, `backend/schemas/clients.py`  
**Root problem:** `ClientResponse` includes `factory_markup_percent` and `sourcing_commission_percent`. These are returned to every authenticated user (including CLIENT and FACTORY users).  
**Fix (option A):** Add a `ClientPublicResponse` schema without markup fields. Return `ClientPublicResponse` for non-ADMIN callers, `ClientResponse` for ADMIN|SUPER_ADMIN callers.  
**Fix (option B):** Add `current_user` param to GET endpoints and null out sensitive fields: `if current_user.user_type != "INTERNAL": resp.factory_markup_percent = None`.

Endpoints (3):
- `GET /api/clients/`
- `GET /api/clients/search/`
- `GET /api/clients/{client_id}/`

---

### Cluster E — Order item mutation: add inline role check

**File:** `backend/routers/orders.py`  
**Root problem:** 7 item-mutation endpoints have no role check — a CLIENT or FACTORY user can confirm, edit, or delete any order item on any order.  
**Fix:** Add `current_user: CurrentUser = Depends(get_current_user)` param and inline check `if not current_user.has_any_role([UserRole.ADMIN, UserRole.OPERATIONS]): raise HTTPException(403)`.

Endpoints (7):
- `POST /api/orders/{order_id}/fetch-pending-items/`
- `POST /api/orders/{order_id}/bulk-text-add/`
- `POST /api/orders/{order_id}/bulk-text-add/apply/`
- `POST /api/orders/{order_id}/items/{item_id}/confirm/`
- `PUT /api/orders/{order_id}/items/{item_id}/`
- `PUT /api/orders/{order_id}/items/{item_id}/remove/`
- `DELETE /api/orders/{order_id}/items/{item_id}/`

---

### Cluster F — Dashboard aggregate endpoints: add tenant scoping

**File:** `backend/routers/dashboard.py`  
**Root problem:** Three dashboard endpoints have no `current_user` parameter and therefore cannot apply tenant scoping. CLIENT A can observe CLIENT B's inquiry counts, inquiry list, and recent activity.  
**Fix:** Add `current_user: CurrentUser = Depends(get_current_user)` to each function. Apply `_apply_tenant_scope()` for ORDER queries. Restrict `client-inquiries` to ADMIN|OPERATIONS only (it's an internal workflow endpoint, not a client-facing one).

Endpoints (3):
- `GET /api/dashboard/summary/` — add tenant-scoped counting
- `GET /api/dashboard/client-inquiries/` — add ADMIN|OPERATIONS role check
- `GET /api/dashboard/recent-activity/` — add tenant scoping

---

## Recommended patch sequence (Patches 3–5)

| Patch | Cluster(s) | Risk | Endpoints |
|---|---|---|---|
| Patch 3 | A (factory ledger/payments) | Medium — per-endpoint dependency override | 9 |
| Patch 4 | B (PI download) + C (pricing mutations) + E (item mutation) | Medium — add params + guards | 14 |
| Patch 5 | D (client markup schema) + F (dashboard scoping) | Low | 6 |
