
# Security Backlog — HarvestERP

---

## Security session: 2026-04-20 to 2026-04-22
**Patches shipped:** 18 (14 audit phase + 4 Wave 0)
**CRITICAL severity findings closed:** 1 of 1  
**HIGH severity findings closed:** 13 of 13  
**0 HIGH+ findings open**  
**MEDIUM findings closed Wave 0:** D-009 / Cluster A (Patch 18)
**MEDIUM findings deferred to Wave 0:** 5 remaining (D-010 frontend tasks remaining; Clusters B/C/D/F; G-001, G-005, G-006, G-008, G-009)
**LOW findings closed Wave 0:** G-015 (Patch 15), G-016 (Patch 16), G-017 (Patch 17)
**Next step:** Wave 0 — D-010 frontend (Tasks 3+4), remaining MEDIUM items

---

_Status: Active — must be addressed before any Next.js page reaches production users._

## Patches shipped (all 2026-04-21)

| # | Patch | File | Severity | Finding |
|---|---|---|---|---|
| 1 | Dashboard CNY cross-tenant | `backend/routers/dashboard.py` | HIGH | CLIENT A could see CLIENT B's order totals (CNY) on the dashboard summary |
| 2 | require_role latent bug | `backend/core/security.py` | HIGH | S-1: `require_role()` returned a dependency factory instead of a dependency — role gating silently never fired |
| 3 | Factory ledger to ADMIN | `backend/routers/finance.py` | HIGH | ADMIN (non-SUPER_ADMIN) could read factory cost data (factory_ledger endpoint) |
| 4 | PI download ownership | `backend/routers/excel.py` | HIGH | Any authenticated user could download another client's proforma invoice Excel |
| 5 | G-004 — Item mutation endpoints | `backend/routers/orders.py` | HIGH | 7 order item mutation endpoints (add, bulk-add, fetch-pending, upload-excel, edit-qty, confirm, remove) rejected no non-INTERNAL caller. CLIENT could POST/PATCH/DELETE directly. Verified: 28/28 matrix checks pass. |
| 6 | G-002 — Shipping route bypass | `backend/routers/shipping.py` | HIGH | `list_shipments` had no auth at all. CLIENT with `show_shipping=False` could read shipment data directly. Fix: auth + `portal_permissions.show_shipping` check. Verified: 4/4 matrix checks pass. |
| 7 | G-003 — After-sales route bypass | `backend/routers/aftersales.py` | HIGH | `list_all_aftersales` and `client_get_aftersales` had no `show_after_sales` enforcement. Fix: `portal_permissions.show_after_sales` check in both endpoints. Verified: 4/4 matrix checks pass per endpoint. |
| 8 | G-007 — Unloaded items cross-tenant + factory_price | `backend/routers/unloaded.py` | HIGH | `list_unloaded_items` and `get_pending_for_order` had no CLIENT RLS — absent `client_id` param returned all 25 cross-tenant records; mismatched `client_id` accepted without ownership check. `factory_price` serialised to CLIENT/FACTORY callers. Fix: CLIENT/FACTORY ownership enforcement on both endpoints; `factory_price` stripped for non-INTERNAL callers. Verified: 9/9 matrix checks pass (2026-04-22). |
| 9 | G-010 — `total_value_cny` in CLIENT response | `backend/core/serializers.py` + `frontend/src/views/factory/FactoryOrders.vue` | HIGH | Per-order factory cost aggregate (`sum(factory_price×qty)`) serialised to CLIENT callers via `ordersApi.list()` — not in `CLIENT_HIDDEN_FIELDS`. Also: `FactoryOrders.vue` read stale field `factory_total_cny` (always `undefined`/`'-'`). Fix: added `total_value_cny` to `CLIENT_HIDDEN_FIELDS`; fixed Vue field name to `total_value_cny`. Verified: 6/6 matrix checks pass (2026-04-22). |
| 10 | G-011 — Product mutation + review endpoints: no role enforcement | `backend/routers/products.py` | HIGH | 12 mutation endpoints lacked `current_user` entirely (any valid JWT could create/update/delete products); 4 review endpoints had `current_user` but no ADMIN role check; 1 upload endpoint had `current_user` but no INTERNAL check. Fix: added `current_user` dep + `user_type != INTERNAL → 403` guard to all 13 mutations; added additional `role not in (ADMIN, SUPER_ADMIN) → 403` to all 4 review endpoints. 17 guards total. Syntax-verified clean (2026-04-22). |
| 11 | G-012 — Factory mutation endpoints: no role enforcement | `backend/routers/factories.py` | HIGH | 3 mutation handlers (`create_factory`, `update_factory`, `delete_factory`) had no `current_user` dep — any valid JWT could create, overwrite, or soft-delete factories. Fix: added `CurrentUser`/`get_current_user` import + inline guards: `create_factory` → INTERNAL + ADMIN\|SUPER_ADMIN; `update_factory` → INTERNAL + ADMIN\|OPERATIONS\|SUPER_ADMIN; `delete_factory` → INTERNAL + SUPER_ADMIN only. Syntax-verified clean (2026-04-22). |
| 12 | G-013 — Client mutation endpoints: no role enforcement (CRITICAL) | `backend/routers/clients.py` | **CRITICAL** | **Most severe finding of the entire audit.** 6 mutation handlers had no `current_user` dep. Most critical: `update_portal_permissions` — any authenticated user including a CLIENT user could call `PUT /api/clients/{id}/portal-permissions/` to grant themselves any of 12 portal permission flags (show_payments, items_add, etc.), defeating all prior role and permission checks. Fix: added `CurrentUser`/`get_current_user` import + inline guards to all 6 endpoints: `create_client` → INTERNAL + ADMIN\|SUPER_ADMIN; `update_client` → INTERNAL + ADMIN\|OPERATIONS\|SUPER_ADMIN; `delete_client` → INTERNAL + ADMIN\|SUPER_ADMIN; `set_client_categories` → INTERNAL + ADMIN\|OPERATIONS\|SUPER_ADMIN; `set_client_brands` → INTERNAL + ADMIN\|OPERATIONS\|SUPER_ADMIN; `update_portal_permissions` → INTERNAL + ADMIN\|SUPER_ADMIN ONLY. Syntax-verified clean, 42/42 matrix checks pass (2026-04-22). |
| 13 | G-014 — Transport mutation endpoints: no role enforcement | `backend/routers/shipping.py` | HIGH | 3 transport service provider mutation handlers (`create_service_provider`, `update_service_provider`, `delete_service_provider`) had no `current_user` dep — any valid JWT could create, overwrite, or soft-deactivate service providers. `get_current_user`/`CurrentUser` were already imported. Fix: added inline guards — `create_service_provider` → INTERNAL + ADMIN\|OPERATIONS\|SUPER_ADMIN; `update_service_provider` → INTERNAL + ADMIN\|OPERATIONS\|SUPER_ADMIN; `delete_service_provider` → INTERNAL + ADMIN\|SUPER_ADMIN (soft-delete confirmed — sets `is_active=False` only, ADMIN therefore allowed). Syntax-verified clean, 21/21 matrix checks pass (2026-04-22). |
| 14 | G-019 — Unauthenticated `/uploads/` file serving | `backend/routers/shipping.py`, `aftersales.py`, `queries.py`, `products.py`; `backend/main.py`; `nginx/nginx.conf`; 6 frontend Vue files; `backend/services/image_extractor.py`, `excel_parser.py` | HIGH | All files under `/uploads/` served without authentication in dev (FastAPI `StaticFiles` sub-app bypasses DI entirely) and prod (nginx `alias` with no `auth_request`). Any unauthenticated HTTP client could download BOLs, payment proofs, and order attachments with no token required. Fix: 5 authenticated download endpoints added (`GET /api/shipping/shipping-documents/{id}/download/`, `/api/aftersales/orders/{id}/photos/{filename}`, `/api/orders/{id}/queries/{qid}/attachments/{filename}`, `/api/products/file/`, `/api/finance/payments/{id}/proof/` already existed); `StaticFiles` mount removed from `main.py`; `location /uploads/` changed to `internal;` in all 3 nginx server blocks; 6 Vue files updated; `image_extractor.py` and `excel_parser.py` thumbnail URLs updated. Verified: 16/16 matrix checks pass (2026-04-22). |

---

## Open — deferred to Wave 0

All items below must be either fixed in the existing Vue-served backend, or fixed in the new SDK layer with verified tests, **before any Next.js page reaches production users.**

### G-001 (MEDIUM) — `show_payments` route unguarded

`/client-portal/ledger` has no route guard and no component-level permission check. Client can navigate directly. Backend **already blocks** the API call (`orders.py:397` — `show_payments` enforced server-side), so **no data leaks today.** The UX is broken and the intent of the permission is violated.

**Fix needed (frontend only):** add route guard to `router/index.js` or redirect in `ClientLedger.vue` when `show_payments` is false.

---

### G-005 (MEDIUM) — Tab-level permission gaps

`ordersApi.get()` returns `factory_price` and markup fields to all CLIENT callers regardless of `client_type`. Already tracked under Clusters C and D below. Closing G-005 requires closing C and D.

---

### G-006 (MEDIUM) — `show_production` / `show_files` tab-only enforcement

UI tabs correctly gated by `portalPerms` in `ClientOrderDetail.vue`, but the underlying production and document read endpoints are not backend-enforced. There is no standalone route for these (unlike G-002/G-003), so exposure requires an authenticated CLIENT to call the API directly with a known order ID.

**Fix needed:** add `portal_permissions.show_production` / `show_files` check to the relevant read endpoints in `backend/routers/`.

---

### Cluster C — Order pricing mutations (4 endpoints)

CLIENT/FACTORY can currently write and read the real `factory_price` on order mutation endpoints.

**Fix needed:** role-gate pricing mutations to INTERNAL only; strip `factory_price` from CLIENT/FACTORY reads.

---

### Cluster D — Client markup in GET response (3 endpoints)

`factory_markup_percent` is serialized to all authenticated callers including CLIENT and FACTORY.

**Fix needed:** strip from CLIENT and FACTORY responses via serializer. Policy decision: ADMIN visibility defaults to stripped per D-004 consistency.

---

### Cluster F — Dashboard aggregate endpoints (3 endpoints)

`/summary/`, `/client-inquiries/`, `/recent-activity/` lack tenant scoping (no `current_user` parameter on the handler). CLIENT A can see CLIENT B's pending inquiries and all-tenant status counts.

**Fix needed:** same pattern as Patch 1. Add `current_user: CurrentUser = Depends(get_current_user)` and apply tenant scope filter to each.

---

### G-008 [YES or NO per Sachin's decision] — `show_returns` portal permission

**Product decision:** [YES = add permission / NO = returns data visible to all CLIENT users by design]
**Route:** `/client-portal/returns-pending`
**Current state:** no portal permission flag; all CLIENT users see returns data.
**Ratified:** 2026-04-22

- **If YES:** add `show_returns` field to client `portal_permissions` schema, enforce at backend list endpoint per D-006 pattern, hide menu entry in `ClientLayout.vue` when false.
- **If NO:** document decision; no work required; close entry as "by design."

---

### G-010 (HIGH) — `total_value_cny` not in `CLIENT_HIDDEN_FIELDS` — factory cost aggregate leaks to CLIENT via orders list — **CLOSED 2026-04-22**

**Reclassification note:** Originally logged MEDIUM. Reclassified to HIGH at patch time — "transmitted to browser but not rendered" is the same leak shape as G-007 / P-007, which was HIGH.

**Found:** Wave 3 factory portal security cross-check (2026-04-22)
**Files patched:** `backend/core/serializers.py`, `frontend/src/views/factory/FactoryOrders.vue`

`serialize_order` (`orders.py:201,231`) computes `total_value_cny = sum(factory_price × confirmed_item.quantity)` and includes it in every row of `GET /api/orders/` responses. `CLIENT_HIDDEN_FIELDS` in `core/serializers.py` stripped individual `factory_price` per item but did **not** strip `total_value_cny`. A CLIENT calling `ordersApi.list()` received their own orders with `total_value_cny` present, exposing the per-order factory cost aggregate.

**Scoping note:** `get_scoped_query` ensures CLIENT users only receive their own orders (no cross-tenant risk). However, the factory price total for those orders was visible and should not have been.

**Side note (also fixed):** `FactoryOrders.vue` read `o.factory_total_cny` (stale field name) — the "Total (CNY)" column always rendered `'-'` because the API emits `total_value_cny`. Both the security gap and the broken column are now resolved.

#### Fix applied (2026-04-22)

**`backend/core/serializers.py`:** Added `"total_value_cny"` to `CLIENT_HIDDEN_FIELDS` with inline comment referencing G-010.

**`frontend/src/views/factory/FactoryOrders.vue`:** Changed `o.factory_total_cny` → `o.total_value_cny` on the desktop table CNY column. Added inline comment pointing to `orders.py:231` and the G-010 patch.

#### Patch verification matrix (6/6 pass — 2026-04-22)

| # | Caller | Endpoint | HTTP | `total_value_cny` | Result |
|---|---|---|---|---|---|
| R1 | CLIENT | `GET /api/orders/?limit=5` | **200** | **absent** | PASS |
| R2 | CLIENT | `GET /api/orders/{own_id}/` | **200** | **absent** | PASS |
| R3 | FACTORY | `GET /api/orders/?limit=5` | **200** | **present** | PASS |
| R4 | FACTORY | `GET /api/orders/{own_id}/` | **200** | **present** | PASS |
| R5 | SUPER_ADMIN | `GET /api/orders/?limit=5` | **200** | **present** | PASS |
| R6 | No token | `GET /api/orders/` | **401** | — | PASS |

---

### G-009 (LOW) — Frontend route guards for `show_shipping` and `show_after_sales`

Backend enforcement is in place (Patches 6 + 7 — G-002, G-003). Frontend routes `/client-portal/shipments` and `/client-portal/after-sales` are still reachable via direct URL even when the corresponding portal permission is false. Users see a 403 toast instead of a clean "not available" page.

**Fix needed (frontend only):** add route-level guard in `ClientLayout` or `router/index.js` that checks `portalPerms` and redirects to a neutral page when `show_shipping` or `show_after_sales` is false. UX issue only — no data leak (backend blocks the API call).

**Defer to Wave 0 frontend work.** Same pass as G-001.

---

### G-015 (LOW) ✅ CLOSED 2026-04-22 — Patch 15 — Excel job endpoint ownership check

**Found:** Wave 6 Excel ingestion audit (2026-04-22)
**Patched:** 2026-04-22 — Patch 15
**Endpoints:** `GET /excel/jobs/{jobId}/`, `DELETE /excel/jobs/{jobId}/`
**Router:** `backend/routers/excel.py`

**Fix applied:**

1. **`backend/models.py`** — Added `created_by: Mapped[Optional[str]]` to `ProcessingJob` (VARCHAR 36, nullable, indexed). Comment: `# G-015: user ID of job creator`.

2. **`backend/alembic/versions/a3f8d2e1c9b0_add_created_by_to_processing_jobs.py`** — Migration: `op.add_column('processing_jobs', ...)` + index. Existing rows backfill as NULL (no owner recorded — treated as accessible by ADMIN only).

3. **`backend/routers/excel.py`**:
   - `upload_excel` — added `current_user: CurrentUser = Depends(get_current_user)`, sets `job.created_by = current_user.id` on creation.
   - `get_job_status` — added `current_user` dep; ownership guard: if `job.created_by is not None and job.created_by != current_user.id and role not in (ADMIN, SUPER_ADMIN)` → 403.
   - `cancel_job` — same ownership guard.
   - `JobOut` schema — added `created_by: Optional[str] = None` field.
   - `serialize_job` — includes `created_by` via `getattr`.

**NULL-owner semantics:** Legacy jobs with `created_by=None` skip the ownership check entirely (condition requires `job.created_by is not None`). Any OPERATIONS or ADMIN user can view/cancel them. This is intentional — no owner means no restriction, and forcing ADMIN-only would silently break existing flows.

#### Patch verification matrix (8/8 pass — 2026-04-22)

| # | Setup | Token | Endpoint | Expected | Result |
|---|---|---|---|---|---|
| R1 | OPS-A's job | OPS-A | GET | 200 | PASS |
| R2 | OPS-A's job | OPS-B | GET | 403 | PASS |
| R3 | OPS-A's job | OPS-B | DELETE | 403 | PASS |
| R4 | OPS-A's job | ADMIN | GET | 200 | PASS |
| R5 | OPS-A's job | ADMIN | DELETE | 200 | PASS |
| R6 | Non-existent | any | GET | 404 | PASS |
| R7 | NULL-owner job | ADMIN | GET | 200 | PASS |
| R8 | NULL-owner job | OPS | GET | 200 (NULL skips check) | PASS |

Test file: `backend/tests/test_g015_g016_patches.py`

---

### G-016 (LOW) ✅ CLOSED 2026-04-22 — Patch 16 — Product `notes` field stripped from CLIENT/FACTORY via search

**Found:** Wave 7 Session 2 P-007 follow-up audit (2026-04-22)
**Patched:** 2026-04-22 — Patch 16
**Endpoint:** `GET /api/products/search/` (`backend/routers/products.py`)
**Router:** `backend/routers/products.py`

**Fix applied — `backend/routers/products.py` `search_products()`:**

Added `current_user: CurrentUser = Depends(get_current_user)` to function signature. Changed return statement from `[ProductOut.model_validate(p) for p in products]` to:

```python
results = [ProductOut.model_validate(p).model_dump() for p in products]
return filter_list_for_role(results, current_user.role)
```

`filter_list_for_role` passes INTERNAL roles (ADMIN, FINANCE, OPERATIONS, SUPER_ADMIN) unmodified; strips `CLIENT_HIDDEN_FIELDS` (including `notes`) for CLIENT; strips `FACTORY_HIDDEN_FIELDS` for FACTORY.

**Structural benefit:** Any field added to `ProductOut` that is also in `CLIENT_HIDDEN_FIELDS` will now be automatically stripped — the gate is systemic, not field-by-field.

#### Patch verification matrix (5/5 pass — 2026-04-22)

| # | Endpoint | Token | Expected | Result |
|---|---|---|---|---|
| R1 | `GET /api/products/search/?q=G016` | CLIENT | 200, no `notes` key | PASS |
| R2 | `GET /api/products/search/?q=G016` | FACTORY | 200, no `notes` key | PASS |
| R3 | `GET /api/products/search/?q=G016` | OPERATIONS | 200, `notes` present | PASS |
| R4 | `GET /api/products/search/?q=G016` | ADMIN | 200, `notes` present | PASS |
| R5 | `GET /api/products/search/?q=G016` | No token | 401 | PASS |

Test file: `backend/tests/test_g015_g016_patches.py`

---

### G-017 (LOW) ✅ CLOSED 2026-04-22 — Patch 17 — `factory_part_number` stripped from CLIENT and FACTORY

**Found:** Wave 7 Session 2 P-007 follow-up audit (2026-04-22)
**Patched:** 2026-04-22 — Patch 17
**Decision:** Option 1 — strip from both CLIENT and FACTORY (ratified 2026-04-22)
**Field:** `Product.factory_part_number` (present in `ProductCreate` → `ProductOut`)
**Endpoints covered by fix:** All endpoints returning `ProductOut` that pipe through `filter_for_role` / `filter_list_for_role` — including `GET /api/products/search/` (G-016 gate), `GET /api/products/`, `GET /api/products/{id}/`

#### Frontend usage audit (2026-04-22)

| File | Portal | Usage |
|---|---|---|
| `frontend/src/views/products/ProductForm.vue:58` | INTERNAL admin | Form field default: `factory_part_number: ''` |
| `frontend/src/views/products/ProductForm.vue:256` | INTERNAL admin | Field list for update payload |
| `frontend/src/views/products/ProductForm.vue:773` | INTERNAL admin | `v-model="form.factory_part_number"` — form input |

No client-portal or factory-portal files reference `factory_part_number`. No frontend changes required.

#### Fix applied (2026-04-22) — `backend/core/serializers.py`

Added `"factory_part_number"` to both `CLIENT_HIDDEN_FIELDS` and `FACTORY_HIDDEN_FIELDS` with inline comments referencing G-017:

```python
# CLIENT_HIDDEN_FIELDS
"factory_part_number",    # G-017: internal supplier part ref — not needed by CLIENT

# FACTORY_HIDDEN_FIELDS
"factory_part_number",    # G-017: factory-specific part ref — competing factories must not cross-ref
```

Because `search_products` already applies `filter_list_for_role` (G-016 patch), the stripping is automatic and systemic — any future endpoint that pipes `ProductOut` dicts through the serializer functions will also strip this field.

#### Patch verification matrix (14/14 pass — 2026-04-22)

| # | Layer | Caller | Expected | Result |
|---|---|---|---|---|
| R1 | Serializer unit | — | `"factory_part_number" in CLIENT_HIDDEN_FIELDS` | PASS |
| R2 | Serializer unit | — | `"factory_part_number" in FACTORY_HIDDEN_FIELDS` | PASS |
| R3 | `filter_for_role` | CLIENT | field absent | PASS |
| R4 | `filter_for_role` | FACTORY | field absent | PASS |
| R5 | `filter_for_role` | OPERATIONS | field present, correct value | PASS |
| R6 | `filter_for_role` | ADMIN | field present, correct value | PASS |
| R7 | `filter_for_role` | FINANCE | field present | PASS |
| R8 | `filter_for_role` | UNKNOWN role | field absent (combined strip) | PASS |
| R9 | `GET /api/products/search/` | CLIENT | 200, `factory_part_number` absent | PASS |
| R10 | `GET /api/products/search/` | FACTORY | 200, `factory_part_number` absent | PASS |
| R11 | `GET /api/products/search/` | OPERATIONS | 200, `factory_part_number` = `"FPN-G017-SECRET"` | PASS |
| R12 | `GET /api/products/search/` | ADMIN | 200, `factory_part_number` = `"FPN-G017-SECRET"` | PASS |
| R13 | Broad scan | CLIENT | no result in `/search/` contains field | PASS |
| R14 | Broad scan | FACTORY | no result in `/search/` contains field | PASS |

Test file: `backend/tests/test_g017_factory_part_number.py`

---

### G-019 (HIGH) ✅ CLOSED 2026-04-22 — Unauthenticated `/uploads/` file serving — all portals

**Found:** Wave 8 Session B — `ordertab_shipping_docs.md` Q-001 (2026-04-22)  
**Patched:** 2026-04-22 — Patch 14  
**Verified live:** 2026-04-22  
**Files affected:** `backend/main.py:163`, `nginx/nginx.conf` (3 server blocks)

The `/uploads/` path is served without authentication in both development and production:

- **Development** — `backend/main.py:163`: `app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")` — Starlette `StaticFiles` sub-application bypasses FastAPI dependency injection. No `Depends(get_current_user)` can intercept at this layer. The security-headers middleware runs on responses but cannot validate tokens or reject requests.
- **Production** — `nginx/nginx.conf`: All three portal server blocks (`admin.absodok.com`, `client.absodok.com`, `factory.absodok.com`) contain `location /uploads/ { alias /app/uploads/; }` with no `auth_request` directive. Requests never reach FastAPI; nginx serves files directly from the shared volume.

**Uploads directory structure confirmed:**

```
C:/HarvestERP/uploads/
├── orders/{order-uuid}/     ← PI attachments, item images
├── payments/{order-uuid}/   ← client payment proof PDFs
├── products/
├── shipping/{order-uuid}/   ← BOLs, COOs, CIs, Packing Lists
└── temp/
```

**Live test results (2026-04-22, localhost:8000):**

| Test | Auth header | File type | HTTP | Size |
|---|---|---|---|---|
| Shipping BOL PDF | None | BOL PDF | **200** | 5,487 bytes |
| Payment proof PDF | None | Payment PDF | **200** | 35,629 bytes |
| Order image | None | PNG | **200** | 186,154 bytes |
| Order image | `Bearer FAKE_TOKEN_NOT_REAL` | PNG | **200** | 186,154 bytes |

Token presence has zero effect. The `Authorization` header is not read, parsed, or validated at any layer.

**Impact:** Any unauthenticated HTTP client that can reach the server can download commercial invoices, bills of lading, payment proof PDFs, and order attachments. No tenant isolation exists at the file-serving layer. The only barrier is URL knowledge (order UUID + filename). UUIDs are sequential-ish and enumerable; filenames follow a `{hash}_{original_name}` pattern.

**The only authenticated file pattern in the codebase** is `backend/routers/documents.py:106` (`GET /api/documents/{doc_id}/download/`) — uses `Depends(get_current_user)` + `_verify_doc_access()` RLS. `ShippingDocsTab` was constructing bare `/uploads/` URLs instead of using this pattern.

#### Fix applied (2026-04-22) — Patch 14

**Backend — 5 authenticated download endpoints:**

| Endpoint | File | Access control |
|---|---|---|
| `GET /api/shipping/shipping-documents/{id}/download/` | `shipping.py` | INTERNAL pass-through; CLIENT requires own order + `show_shipping`; FACTORY blocked |
| `GET /api/aftersales/orders/{order_id}/photos/{filename}` | `aftersales.py` | `_check_order_access()` RLS; path traversal guard (`os.path.basename`) |
| `GET /api/orders/{order_id}/queries/{query_id}/attachments/{filename}` | `queries.py` | CLIENT cross-tenant check; `..` path traversal guard |
| `GET /api/products/file/?path=` | `products.py` | `products/` whitelist prefix; `..` guard; `_prod_url()` helper rewrites all API responses |
| `GET /api/finance/payments/{payment_id}/proof/` | `finance.py` | Already existed with full auth + RLS — no change required |

**Dev — `StaticFiles` mount removed:**  
`backend/main.py`: `app.mount("/uploads", StaticFiles(...))` removed. Replaced with inline comment documenting the 5 authenticated endpoints.

**Prod — nginx `internal;` directive:**  
`nginx/nginx.conf`: All 3 `location /uploads/` blocks changed to `internal;`. Direct client access returns 404. Files only reachable via `X-Accel-Redirect` from authenticated API responses.

**Frontend — 6 Vue files updated (0 bare `/uploads/` patterns remain):**
- `ShippingDocsTab.vue` — View + Download href → `/api/shipping/shipping-documents/${doc.id}/download/`
- `AfterSalesTab.vue` — `getPhotoUrl()` → `/api/aftersales/orders/${orderId}/photos/${filename}`
- `ClientOrderDetail.vue` — `lightboxPhotos` computed → `/api/aftersales/orders/${orderId}/photos/${f}`
- `QueriesTab.vue` — `attUrl()` helper added; all 5 attachment usages updated
- `OrderItemsTab.vue` — `getItemImageUrl()` + `attUrl()` added; attachment template updated
- `ClientOrderItemsTab.vue` — same pattern as `OrderItemsTab.vue`

**Backend services — thumbnail URL construction updated:**
- `backend/services/image_extractor.py` — 2 occurrences: `/uploads/products/...` → `/api/products/file/?path=products/...`
- `backend/services/excel_parser.py` — 2 occurrences: same pattern

#### Patch verification matrix (16/16 pass — 2026-04-22)

| Cell | Endpoint | Token | Expected | Actual | Result |
|------|----------|-------|----------|--------|--------|
| 1 | `GET /uploads/...` direct | None | 404 | 404 | PASS |
| 2 | Shipping doc download | ADMIN | 200 | 200 | PASS |
| 3 | Shipping doc download | CLIENT1 (no `show_shipping`) | 403 | 403 | PASS |
| 4 | Shipping doc download | CLIENT2 (wrong client) | 403 | 403 | PASS |
| 5 | Shipping doc download | None | 401 | 401 | PASS |
| 6 | After-sales photo | ADMIN | 200 | 200 | PASS |
| 7 | After-sales photo | CLIENT1 (owns order) | 200 | 200 | PASS |
| 8 | After-sales photo | CLIENT2 (wrong client) | 403 | 403 | PASS |
| 9 | After-sales photo | None | 401 | 401 | PASS |
| 10 | Query attachment | ADMIN | 200 | 200 | PASS |
| 11 | Query attachment | CLIENT2 (owner) | 200 | 200 | PASS |
| 11b | Query attachment | CLIENT1 (wrong client) | 403 | 403 | PASS |
| 12 | Query attachment | None | 401 | 401 | PASS |
| 13 | Product image | ADMIN | 200 | 200 | PASS |
| 14 | Product image | None | 401 | 401 | PASS |
| 15 | Product image path traversal (`../`) | ADMIN | 400 | 400 | PASS |

---

### G-007 (HIGH) — `list_unloaded_items`: no CLIENT RLS, `factory_price` exposed — **CLOSED 2026-04-22**

**Found:** Wave 2 Batch 3 profile of `ClientReturnsPending.vue` (2026-04-21)  
**Verified live:** 2026-04-21 (see runtime evidence below)  
**File:** `backend/routers/unloaded.py` — `list_unloaded_items` (`GET /api/unloaded-items/`)

#### Static analysis

`list_unloaded_items` and `get_pending_for_order` have no `current_user` dependency in the handler body. However, the router is mounted in `main.py:214` with `dependencies=[Depends(get_current_user)]` — so the global dependency enforces token presence at the router level.

#### Runtime evidence (verified 2026-04-21)

| Test | Token | `client_id` param | HTTP | Result |
|---|---|---|---|---|
| No token | — | — | **401** | Global `get_current_user` dependency blocks unauthenticated access. |
| CLIENT token | CLIENT | _(omitted)_ | **200** | Returns **all 25 unloaded records across the DB** — no tenant scoping applied when `client_id` param is absent. `factory_price` non-null in 10/10 rows of the page. |
| CLIENT token | CLIENT | `own client_id` | **200** | Returns 21 records scoped to own client. `factory_price` present and non-null in all rows. |
| CLIENT token | CLIENT | `fabricated other client_id` | **200** | Returns 0 rows (no data for that ID in test DB), but endpoint **does not reject the query** — no ownership verification. In a multi-tenant prod DB this would return that client's records. |
| CLIENT token | CLIENT | fake factory_id | **200** (`/pending/`) | Returns `{"items":[]}`. Same non-rejection pattern. |

#### Confirmed issues

1. **No CLIENT RLS:** When `client_id` is omitted, a CLIENT receives all unloaded records across all tenants — no scope enforced by the handler. In prod with multiple clients this is a direct cross-tenant data leak.
2. **No ownership check on `client_id` param:** A CLIENT can pass any `client_id` value and the endpoint queries it without verifying it matches `current_user.client_id`. Same attack as above with explicit targeting.
3. **`factory_price` exposed to CLIENT callers:** Factory cost data (CNY unit price) is serialised in every row returned to CLIENT users. This is a Cluster C/D-pattern pricing exposure.

#### Partial correction vs. original profile

The original profile (written before this runtime check) claimed "no token required." That claim is **REFUTED** — unauthenticated access is blocked by the router-level dependency. The severity remains HIGH due to issues 1–3 above, but the attack requires a valid CLIENT token, not anonymous access.

#### Fix applied (2026-04-22) — `backend/routers/unloaded.py`

Both handlers now accept `current_user: CurrentUser = Depends(get_current_user)`.

**CLIENT RLS (`list_unloaded_items`):** absent `client_id` → forced to `current_user.client_id`; present but mismatched → 403.

**FACTORY RLS (`list_unloaded_items`):** absent `factory_id` → forced to `current_user.factory_id`; present but mismatched → 403.

**Ownership check (`get_pending_for_order`):** CLIENT `client_id` and FACTORY `factory_id` params validated against `current_user`; mismatch → 403.

**`factory_price` stripped:** field only serialised when `current_user.user_type == "INTERNAL"`. Reference: D-004.

#### Patch verification matrix (9/9 pass — 2026-04-22)

| # | Caller | Endpoint | `client_id` param | HTTP | factory_price | Result |
|---|---|---|---|---|---|---|
| R1 | No token | `list` | — | **401** | — | PASS |
| R2 | No token | `pending` | — | **401** | — | PASS |
| R3 | CLIENT-A | `list` | absent | **200** | absent | Scoped to own 21 records only |
| R4 | CLIENT-A | `list` | own | **200** | absent | PASS |
| R5 | CLIENT-A | `list` | CLIENT-B | **403** | — | PASS |
| R6 | CLIENT-A | `list` | fake | **403** | — | PASS |
| R7 | INTERNAL | `list` | absent | **200** | **present** | All 25 records, factory_price visible |
| R8 | CLIENT-A | `pending` | own | **200** | absent | PASS |
| R9 | CLIENT-A | `pending` | CLIENT-B | **403** | — | PASS |

**Pattern:** Same as Cluster F (no tenant scoping) + Cluster D (pricing field in response).

---

### G-011 (HIGH) ✅ CLOSED 2026-04-22 — Product mutation endpoints: no role enforcement

**Found:** Wave 4 Batch 1 profile generation (2026-04-21)
**Patched:** 2026-04-22 — Patch 10
**Files:** `backend/routers/products.py`

All mutation endpoints in `products.py` lacked an inline `current_user` parameter and therefore had no role check. The router is mounted with `dependencies=[Depends(get_current_user)]` in `main.py:198` — authentication (valid JWT required) is enforced, but **any** valid JWT (CLIENT, FACTORY, or INTERNAL) could call these endpoints.

**Patched endpoints (added `current_user` dep + INTERNAL guard):**
- `POST /api/products/` (create product)
- `PUT /api/products/{id}/` (update product)
- `DELETE /api/products/{id}/` (soft-delete product)
- `POST /api/products/bulk-delete/` (bulk soft-delete)
- `POST /api/products/bulk-update/` (bulk field update)
- `POST /api/products/bin/permanent-delete/` (hard-delete from bin)
- `POST /api/products/bin/restore/` (restore from bin)
- `POST /api/products/{id}/set-default/` (set default variant)
- `POST /api/products/remove-duplicate-images/` (dedup images)
- `POST /api/products/cleanup-orphan-images/`
- `POST /api/products/re-extract-images/`
- `DELETE /api/products/{id}/images/{imageId}/` (delete image)
- `POST /api/products/{id}/images/upload/` (bonus: had `current_user`, missing INTERNAL check)

**Patched endpoints (added INTERNAL guard + ADMIN/SUPER_ADMIN role check):**
- `GET /api/products/pending-review-list/`
- `POST /api/products/product-requests/{id}/approve/`
- `POST /api/products/product-requests/{id}/reject/`
- `POST /api/products/product-requests/{id}/map/`

**Guard pattern used:**
```python
if current_user.user_type != "INTERNAL":
    raise HTTPException(status_code=403, detail="Internal access only")
if current_user.role not in ("ADMIN", "SUPER_ADMIN"):  # review endpoints only
    raise HTTPException(status_code=403, detail="Admin access required")
```

**Note:** `AUTHZ_SURFACE.md` claimed "CUSTOM inline ADMIN|OPERATIONS check (writes). All OK." for products.py. This was inaccurate. Update AUTHZ_SURFACE.md to reflect the new inline guards.

**Verification executed 2026-04-22 — 24/24 access-control outcomes correct**

Matrix methodology note: Because dev DB lacks FACTORY and SUPER_ADMIN user accounts at the time of verification, the FACTORY and SUPER_ADMIN tokens were synthesized via backend `create_access_token` using the JWT secret, not acquired via `POST /api/auth/login`. All other roles used login-flow tokens. Access-control guards fired correctly against all 6 roles on 4 representative endpoints (create, delete, list-pending, approve).

Non-security deviations observed (not patch-related, do not affect CLOSED status):
- `POST /api/products/` returns 200 not 201 (no `status_code` decorator)
- `DELETE /api/products/{id}/` returns 200 not 204 (no `status_code` decorator, returns JSON body)
- `POST /api/products/product-requests/{id}/approve/` returned 404 for ADMIN/SUPER_ADMIN due to empty pending-review queue in dev DB, not due to auth failure (guards fired correctly)

Follow-up cleanup items (non-urgent) added to Follow-up cleanup section below.

---

### G-012 (HIGH) ✅ CLOSED 2026-04-22 — Factory mutation endpoints: no role enforcement

**Found:** Wave 4 Batch 1 profile generation (2026-04-21)
**Patched:** 2026-04-22 — Patch 11
**Files:** `backend/routers/factories.py`

Same pattern as G-011. The factories router is mounted with `dependencies=[Depends(get_current_user)]` in `main.py:200`. The three mutation handlers had no `current_user` parameter:
- `POST /api/factories/` (`create_factory`) — `db: Session = Depends(get_db)` only
- `PUT /api/factories/{id}/` (`update_factory`) — same
- `DELETE /api/factories/{id}/` (`delete_factory`) — same

Any valid JWT (CLIENT, FACTORY, INTERNAL) could create, overwrite, or soft-delete factories.

**Note:** The SECURITY_BACKLOG entry called delete "hard (no bin/restore)" — this is inaccurate. The implementation sets `deleted_at` and `is_active=False` (soft-delete). The risk framing still applies: no restore UI exists, so a malicious delete requires manual DB recovery.

**Guard pattern applied:**
```python
from core.security import CurrentUser, get_current_user

# create_factory — ADMIN or SUPER_ADMIN
if current_user.user_type != "INTERNAL":
    raise HTTPException(status_code=403, detail="Internal access only")
if current_user.role not in ("ADMIN", "SUPER_ADMIN"):
    raise HTTPException(status_code=403, detail="Admin access required")

# update_factory — ADMIN, OPERATIONS, or SUPER_ADMIN
if current_user.user_type != "INTERNAL":
    raise HTTPException(status_code=403, detail="Internal access only")
if current_user.role not in ("ADMIN", "OPERATIONS", "SUPER_ADMIN"):
    raise HTTPException(status_code=403, detail="Admin or Operations access required")

# delete_factory — SUPER_ADMIN only
if current_user.user_type != "INTERNAL":
    raise HTTPException(status_code=403, detail="Internal access only")
if current_user.role != "SUPER_ADMIN":
    raise HTTPException(status_code=403, detail="Super admin access required")
```

**Verification executed 2026-04-22 — 21/21 access-control outcomes correct**

All tokens acquired via `POST /api/auth/login` (real login-flow tokens only). 4 test users created: `admin-test2@harvesterp.com`, `ops-test2@harvesterp.com`, `client-test2@harvesterp.com`, `finance-test2@harvesterp.com` (password `TestPass123!`, Argon2id hash).

| # | Role | POST /api/factories/ | PUT /api/factories/{id}/ | DELETE /api/factories/{id}/ |
|---|---|---|---|---|
| 1 | SUPER_ADMIN | **200** PASS | **200** PASS | **200** PASS |
| 2 | ADMIN | **200** PASS | **200** PASS | **403** PASS |
| 3 | OPERATIONS | **403** PASS | **200** PASS | **403** PASS |
| 4 | FINANCE | **403** PASS | **403** PASS | **403** PASS |
| 5 | CLIENT | **403** PASS | **403** PASS | **403** PASS |
| 6 | FACTORY | **403** PASS | **403** PASS | **403** PASS |

Non-security deviation observed: initial PUT tests returned 400 (not 403) for ADMIN and OPERATIONS due to factory_code uniqueness collision in test data (the test body reused a code that was still active from an earlier create in the same matrix run). Re-run with non-conflicting code confirmed 200. Authorization guards fired correctly in all 21 cells.

---

### G-013 (CRITICAL) ✅ CLOSED 2026-04-22 — Client mutation endpoints: no role enforcement

> **G-013 is the most severe finding of the entire audit. Before this patch, any CLIENT user could rewrite their own portal permissions, defeating all prior role and permission checks.**

**Found:** Wave 4 Batch 2 profile generation (2026-04-22)
**Patched:** 2026-04-22 — Patch 12
**Files:** `backend/routers/clients.py`

All 6 mutation handlers in `clients.py` lacked an inline `current_user` parameter. The clients router is mounted in `main.py` with `dependencies=[Depends(get_current_user)]` — authentication (valid JWT required) is enforced, but **any** valid JWT could call all 6 mutation endpoints.

**Most critical sub-finding:** `update_portal_permissions` (`PUT /api/clients/{id}/portal-permissions/`) had no role check. Any authenticated user — including a CLIENT portal user — could call this endpoint to set any combination of the 12 portal permission flags (`show_payments`, `show_production`, `show_shipping`, `show_after_sales`, `show_files`, `show_packing`, `items_add`, `items_bulk_add`, `items_fetch_pending`, `items_upload_excel`, `items_edit_qty`, `items_remove`) to `true` on their own account. This directly defeated the D-006 portal permission enforcement model and all prior patch work (Patches 1–11).

**Patched endpoints and guards:**

| Endpoint | Method | Path | Guard |
|---|---|---|---|
| `create_client` | POST | `/api/clients/` | INTERNAL + ADMIN\|SUPER_ADMIN |
| `update_client` | PUT | `/api/clients/{id}/` | INTERNAL + ADMIN\|OPERATIONS\|SUPER_ADMIN |
| `delete_client` | DELETE | `/api/clients/{id}/` | INTERNAL + ADMIN\|SUPER_ADMIN |
| `set_client_categories` | PUT | `/api/clients/{id}/categories/` | INTERNAL + ADMIN\|OPERATIONS\|SUPER_ADMIN |
| `set_client_brands` | PUT | `/api/clients/{id}/brands/` | INTERNAL + ADMIN\|OPERATIONS\|SUPER_ADMIN |
| `update_portal_permissions` | PUT | `/api/clients/{id}/portal-permissions/` | INTERNAL + ADMIN\|SUPER_ADMIN ONLY |

**Guard pattern applied (canonical — G-004):**
```python
from core.security import CurrentUser, get_current_user

if current_user.user_type != "INTERNAL":
    raise HTTPException(status_code=403, detail="Internal access only")
if current_user.role not in ("ADMIN", "SUPER_ADMIN"):  # varies per endpoint
    raise HTTPException(status_code=403, detail="Admin access required")
```

**Critical verification — executed before full matrix:**
CLIENT token calling `PUT /api/clients/{cid}/portal-permissions/` with `show_payments: true, items_add: true` → **HTTP 403** ✓ (was HTTP 200 before patch)

**Verification executed 2026-04-22 — 42/42 access-control outcomes correct**

All tokens acquired via `POST /api/auth/login` (real login-flow tokens only). Roles tested: No Auth, CLIENT, FACTORY, FINANCE, OPERATIONS, ADMIN, SUPER_ADMIN.

| Token | create | update | delete | categories | brands | portal_perms |
|---|---|---|---|---|---|---|
| No auth | **401** ✓ | **401** ✓ | **401** ✓ | **401** ✓ | **401** ✓ | **401** ✓ |
| CLIENT | **403** ✓ | **403** ✓ | **403** ✓ | **403** ✓ | **403** ✓ | **403** ✓ |
| FACTORY | **403** ✓ | **403** ✓ | **403** ✓ | **403** ✓ | **403** ✓ | **403** ✓ |
| FINANCE | **403** ✓ | **403** ✓ | **403** ✓ | **403** ✓ | **403** ✓ | **403** ✓ |
| OPERATIONS | **403** ✓ | **200** ✓ | **403** ✓ | **200** ✓ | **200** ✓ | **403** ✓ |
| ADMIN | **200** ✓ | **200** ✓ | **200** ✓ | **200** ✓ | **200** ✓ | **200** ✓ |
| SUPER_ADMIN | **200** ✓ | **200** ✓ | **200** ✓ | **200** ✓ | **200** ✓ | **200** ✓ |

Note: The initial FACTORY token in the matrix script was invalid (corrupted paste in the bash variable). Re-login via `POST /api/auth/login` produced a valid token that confirmed all 6 FACTORY cells return 403. No security significance — the guard fires for any FACTORY-typed user.

---

### G-014 (HIGH) ✅ CLOSED 2026-04-22 — Transport mutation endpoints: no role enforcement

**Found:** Wave 4 Batch 2 profile generation (2026-04-22)  
**Patched:** 2026-04-22 — Patch 13  
**Files:** `backend/routers/shipping.py`

Same pattern as G-011, G-012, G-013 (P-014). The shipping router is mounted with `dependencies=[Depends(get_current_user)]` in `main.py` — authentication is enforced router-wide, but the three transport service provider mutation handlers had no inline `current_user` parameter and therefore no role check. Any valid JWT (CLIENT, FACTORY, or INTERNAL regardless of role) could create, overwrite, or soft-deactivate service providers.

**Patched handlers:**
- `POST /api/shipping/service-providers/` (`create_service_provider`) — `db: Session` only before patch
- `PUT /api/shipping/service-providers/{id}/` (`update_service_provider`) — `db: Session` only before patch
- `DELETE /api/shipping/service-providers/{id}/` (`delete_service_provider`) — `db: Session` only before patch

**Soft-delete decision rationale:** `delete_service_provider` is a confirmed soft-delete (sets `sp.is_active = False` only — docstring says "Soft-delete (set is_active=False)"; no `deleted_at`, no hard row removal). Because the operation is reversible, ADMIN is permitted in addition to SUPER_ADMIN (mirroring G-012/`update_factory` precedent — full deletion restricted to SUPER_ADMIN, soft mutations allowed to ADMIN). OPERATIONS is excluded from delete because deactivating a freight forwarder or CHA mid-shipment is a disruptive irreversible-in-practice action.

**Note:** `get_current_user` and `CurrentUser` were already imported in `shipping.py` (used by the shipment read endpoints patched in G-002). No new import was required for this patch.

**Guard pattern applied (canonical — G-004):**
```python
# create_service_provider and update_service_provider — ADMIN, OPERATIONS, or SUPER_ADMIN
if current_user.user_type != "INTERNAL":
    raise HTTPException(status_code=403, detail="Internal access only")
if current_user.role not in ("ADMIN", "OPERATIONS", "SUPER_ADMIN"):
    raise HTTPException(status_code=403, detail="Admin or Operations access required")

# delete_service_provider — ADMIN or SUPER_ADMIN (soft-delete confirmed)
if current_user.user_type != "INTERNAL":
    raise HTTPException(status_code=403, detail="Internal access only")
if current_user.role not in ("ADMIN", "SUPER_ADMIN"):
    raise HTTPException(status_code=403, detail="Admin access required")
```

**Verification executed 2026-04-22 — 21/21 access-control outcomes correct**

All tokens acquired via `POST /api/auth/login` (real login-flow tokens only). Roles tested: No Auth, CLIENT, FACTORY, FINANCE, OPERATIONS, ADMIN, SUPER_ADMIN.

| # | Role | POST /service-providers/ | PUT /service-providers/{id}/ | DELETE /service-providers/{id}/ |
|---|---|---|---|---|
| 1 | No auth | **401** ✓ | **401** ✓ | **401** ✓ |
| 2 | CLIENT | **403** ✓ | **403** ✓ | **403** ✓ |
| 3 | FACTORY | **403** ✓ | **403** ✓ | **403** ✓ |
| 4 | FINANCE | **403** ✓ | **403** ✓ | **403** ✓ |
| 5 | OPERATIONS | **200** ✓ | **200** ✓ | **403** ✓ |
| 6 | ADMIN | **200** ✓ | **200** ✓ | **200** ✓ |
| 7 | SUPER_ADMIN | **200** ✓ | **200** ✓ | **200** ✓ |

---

## Follow-up cleanup (safe, non-urgent)

- **`orders.py:1664`** — unreachable CLIENT RLS check. The G-004 patch (Patch 5) placed a blanket `user_type != "INTERNAL" → 403` guard before this check in `confirm_order_item`, making the existing CLIENT RLS branch dead code. Remove during next orders.py maintenance pass. No security impact — the guard fires first.

- **products.py create/delete status codes** — `POST /api/products/` returns 200 instead of 201; `DELETE /api/products/{id}/` returns 200 with JSON body instead of 204. Pre-existing, non-security. Fix during next products.py maintenance pass by adding `status_code=201` and `status_code=204` decorators respectively.

- **dev DB seed users** — FACTORY and SUPER_ADMIN user accounts should exist in the dev DB seed script so future verification matrices can use real login tokens instead of synthesized ones.

- **AUTHZ_SURFACE.md terminology** — "manage_orders check" and similar labels use informal shorthand. Actual guards are role-membership-based (`role in [ADMIN, OPERATIONS]`), not named-permission-based. During Wave 0 final pass, normalize AUTHZ_SURFACE.md labels to accurately reflect the underlying check type: `ROLE_CHECK([ADMIN, OPERATIONS])` vs `PERMISSION_CHECK(manage_orders)` vs `ROUTER_DEP(require_internal)`. Low priority; documentation accuracy only.

### D-003 rollout scope (UX — non-security but widespread)

Confirmed instances of native `alert()` / `confirm()` calls across Vue frontend during Wave 8:
- OrderDetail shell: 2
- OrderItemsTab: 4
- PaymentsTab: (count from Session A profile)
- PackingListTab: ~10
- ExcelUpload: 3 (upload, apply, restore errors)

Plus earlier waves — total estimate: 25–40+ instances across the codebase.

Wave 0 action: Implement `<ConfirmDialog>` primitive (per D-003 spec) with `preserveContext` prop. Replace every native `alert`/`confirm` call. Pattern is already spec'd in D-003 DECISIONS.md entry; this is execution work. Schedule after Layer 1 + Layer 2 gallery builds.

---

---

### D-009 / Cluster A ✅ CLOSED 2026-04-22 — Patch 18 — Factory ledger and factory-cost endpoint role gating

**Decision:** D-009 RATIFIED (deferred from audit phase) — SUPER_ADMIN access made explicit  
**Severity:** MEDIUM (auth surface — role gating correctness)  
**Patched:** 2026-04-22 — Patch 18  
**File:** `backend/core/security.py`

#### Pre-patch finding (corrected)

The audit phase documented: *"Effective access = FINANCE only (intersection of router-level ADMIN|FINANCE and endpoint-level SUPER_ADMIN|FINANCE)."* This was **inaccurate** — it did not account for the SUPER_ADMIN bypass in `has_any_role()` (`security.py:60–62`):

```python
def has_any_role(self, roles):
    return bool(set(self.roles) & set(roles)) or UserRole.SUPER_ADMIN in self.roles
```

True pre-patch effective access was already **SUPER_ADMIN | FINANCE**:
- SUPER_ADMIN passed the router-level `require_finance = require_role([ADMIN, FINANCE])` via the bypass (implicit)
- SUPER_ADMIN passed the endpoint-level `require_factory_financial = require_role([SUPER_ADMIN, FINANCE])` explicitly
- ADMIN passed the router-level check explicitly but was **blocked by the endpoint-level** check → 403
- All other roles blocked at router level → 403

D-009 requirement: make SUPER_ADMIN access **explicit**, not reliant solely on the bypass.

#### All 9 Cluster A endpoints — dependency status (confirmed 2026-04-22)

All 9 endpoints already carried `Depends(require_factory_financial)` at the endpoint level (confirmed via grep of finance.py). No endpoint-level changes required.

| Line | Method | Path | Endpoint dep |
|------|--------|------|-------------|
| 729 | GET | `/api/finance/orders/{id}/factory-payments/` | `require_factory_financial` ✅ |
| 809 | POST | `/api/finance/orders/{id}/factory-payments/` | `require_factory_financial` ✅ |
| 855 | DELETE | `/api/finance/orders/{id}/factory-payments/{pid}/` | `require_factory_financial` ✅ |
| 892 | PUT | `/api/finance/orders/{id}/factory-payments/{pid}/` | `require_factory_financial` ✅ |
| 957 | GET | `/api/finance/orders/{id}/payment-audit-log/` | `require_factory_financial` ✅ |
| 1389 | GET | `/api/finance/factories/{id}/credits/` | `require_factory_financial` ✅ |
| 1415 | POST | `/api/finance/orders/{id}/apply-factory-credit/` | `require_factory_financial` ✅ |
| 1485 | GET | `/api/finance/factory-ledger/{id}/` | `require_factory_financial` ✅ |
| 1846 | GET | `/api/finance/factory-ledger/{id}/download/` | `require_factory_financial` ✅ |

#### Fix applied — `backend/core/security.py`

```python
# Before (D-009 OPEN)
require_finance = require_role([UserRole.ADMIN, UserRole.FINANCE])

# After (D-009 CLOSED — Patch 18)
require_finance = require_role([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.FINANCE])
# D-009: SUPER_ADMIN explicit (was implicit via has_any_role bypass)
```

**Behavioral impact:** Zero. SUPER_ADMIN was already passing via bypass. No HTTP status codes change for any role. The change is semantic correctness — SUPER_ADMIN access is now declared at the role list, not inferred from an implicit bypass.

**ADMIN on factory-cost endpoints:** ADMIN still receives 403. ADMIN passes the widened `require_finance` explicitly (ADMIN is in the list), but the endpoint-level `require_factory_financial = require_role([SUPER_ADMIN, FINANCE])` blocks ADMIN — ADMIN is not in that list and ADMIN is not SUPER_ADMIN. D-004 compliance maintained.

#### Patch verification matrix (27/27 pass — 2026-04-22)

| # | Endpoint group | Token | Expected | Result |
|---|---|---|---|---|
| R1 | Factory ledger read | SUPER_ADMIN | 200 or 404 (auth passes) | PASS |
| R2 | Factory ledger read | FINANCE | 200 or 404 | PASS |
| R3 | Factory ledger read | ADMIN | 403 | PASS |
| R4 | Factory ledger read | OPERATIONS | 403 | PASS |
| R5 | Factory ledger read | CLIENT | 403 | PASS |
| R6 | Factory ledger read | FACTORY | 403 | PASS |
| R7 | Factory ledger read | No auth | 401 | PASS |
| R8 | Factory ledger download | SUPER_ADMIN | 200 or 404 | PASS |
| R9 | Factory ledger download | FINANCE | 200 or 404 | PASS |
| R10 | Factory ledger download | ADMIN | 403 | PASS |
| R11 | Factory ledger download | OPERATIONS | 403 | PASS |
| R12 | Factory ledger download | No auth | 401 | PASS |
| R13 | Factory payments list | SUPER_ADMIN | 200 or 404 | PASS |
| R14 | Factory payments list | FINANCE | 200 or 404 | PASS |
| R15 | Factory payments list | ADMIN | 403 | PASS |
| R16 | Factory payments list | OPERATIONS | 403 | PASS |
| R17 | Factory payments list | No auth | 401 | PASS |
| R18 | Factory credits list | SUPER_ADMIN | 200 or 404 | PASS |
| R19 | Factory credits list | FINANCE | 200 or 404 | PASS |
| R20 | Factory credits list | ADMIN | 403 | PASS |
| R21 | Factory credits list | OPERATIONS | 403 | PASS |
| R22 | Factory credits list | No auth | 401 | PASS |
| R23 | Payment audit log | SUPER_ADMIN | 200 or 404 | PASS |
| R24 | Payment audit log | FINANCE | 200 or 404 | PASS |
| R25 | Payment audit log | ADMIN | 403 | PASS |
| R26 | Payment audit log | OPERATIONS | 403 | PASS |
| R27 | Payment audit log | No auth | 401 | PASS |

Test file: `backend/tests/test_d009_cluster_a_factory_ledger.py`  
Full suite: 166 passed, 0 regressions.

---

### D-010 implementation tasks (Wave 0 backend + frontend)

**Decision:** D-010 RATIFIED 2026-04-22 — OPERATIONS excluded from `estProfit` and Factory Payments.
**Severity:** MEDIUM (information disclosure, not privilege escalation).
**Deferred because:** No HIGH+ blast radius; required D-010 product decision before implementation. Decision now ratified — unblocked.

#### Task 1 — `backend/routers/finance.py` — `list_payments()` ✅ COMPLETE 2026-04-22

**Finding:** The factory cost fields do NOT originate from `dashboard.py`. `dashboard.py` endpoints contain no `factory_total_inr` or `estProfit` fields — they return only order counts and CNY order values. The factory cost data shown in OrderDashboardTab is fetched separately via `paymentsApi` → `GET /orders/{order_id}/payments/` (`list_payments()` in `finance.py`). This endpoint's `summary` block returned six factory cost fields unconditionally to all authenticated callers including OPERATIONS.

**Fix applied (2026-04-22) — `backend/routers/finance.py` lines 150–175:**

Added `is_ops = current_user.role == "OPERATIONS"` before the return statement. Six factory cost fields in the `summary` dict are now conditionally `None` for OPERATIONS callers:
```python
# D-010: OPERATIONS role cannot see factory cost or margin fields
is_ops = current_user.role == "OPERATIONS"
# ...
"original_factory_total_cny": None if is_ops else round(original_factory_cny, 2),
"original_factory_total_inr": None if is_ops else original_factory_inr,
"revised_factory_total_cny":  None if is_ops else round(revised_factory_cny, 2),
"revised_factory_total_inr":  None if is_ops else revised_factory_inr,
"factory_paid_inr":           None if is_ops else round(factory_paid_inr, 2),
"revised_factory_balance_inr": None if is_ops else round(revised_factory_inr - factory_paid_inr, 2),
```

Fields remain present as `null` (not omitted) to avoid breaking frontend key-existence checks. All other roles (ADMIN, SUPER_ADMIN, FINANCE, CLIENT, FACTORY) receive the values unchanged.

**Architecture clarification (discovered during implementation):** `finance.router` is registered in `main.py` with `dependencies=[Depends(require_finance)]` where `require_finance = require_role([ADMIN, FINANCE])`. Additionally, `CurrentUser.has_any_role()` has a SUPER_ADMIN bypass (security.py:61-62 — if SUPER_ADMIN is in the user's roles, `has_any_role()` always returns `True`). Therefore:
- OPERATIONS calling any finance router endpoint → **403 at router level** (pre-handler)
- The field-level `is_ops` strip in `list_payments()` is **defence-in-depth** — activates if OPERATIONS is ever added to `require_finance`, and explicitly documents the D-010 exclusion at the data layer.

**Note:** `filter_for_role` / `filter_list_for_role` are imported in `finance.py` but are not called anywhere in the file — pre-existing dead import, unrelated to this patch.

#### Patch verification matrix (14/14 pass — 2026-04-22)

| # | Role | Endpoint | Expected | Actual | Result |
|---|---|---|---|---|---|
| R1 | OPERATIONS | `GET /api/finance/orders/{id}/payments/` | 403 (require_finance) | 403 | PASS |
| R2 | FINANCE | `GET /api/finance/orders/{id}/payments/` | 200, factory fields numeric | 200 ✓ | PASS |
| R3 | ADMIN | `GET /api/finance/orders/{id}/payments/` | 200, factory fields numeric | 200 ✓ | PASS |
| R4 | SUPER_ADMIN | `GET /api/finance/orders/{id}/payments/` | 200, factory fields numeric | 200 ✓ | PASS |
| R5 | OPERATIONS | `GET /api/finance/orders/{id}/factory-payments/` | 403 (require_factory_financial) | 403 | PASS |
| R6 | ADMIN | `GET /api/finance/orders/{id}/factory-payments/` | 403 (not in require_factory_financial) | 403 | PASS |
| R7 | FINANCE | `GET /api/finance/orders/{id}/factory-payments/` | 200 | 200 | PASS |
| R8 | SUPER_ADMIN | `GET /api/finance/orders/{id}/factory-payments/` | 200 (bypass) | 200 | PASS |
| R9 | No token | `GET /api/finance/orders/{id}/payments/` | 401 | 401 | PASS |
| R10 | No token | `GET /api/finance/orders/{id}/factory-payments/` | 401 | 401 | PASS |

Full test file: `backend/tests/test_d010_ops_visibility.py` (14 tests, 112 total suite passes — 0 regressions)

#### Task 2 — `backend/routers/finance.py` — Factory Payments endpoints ✅ CONFIRMED COMPLETE 2026-04-22

**Finding:** All four factory payment endpoints and all factory financial endpoints carry `_: None = Depends(require_factory_financial)`. `require_factory_financial = require_role([UserRole.SUPER_ADMIN, UserRole.FINANCE])` — OPERATIONS is already excluded. No code change required.

Endpoints confirmed gated:
- `GET /orders/{order_id}/factory-payments/` (line 724) — `require_factory_financial`
- `POST /orders/{order_id}/factory-payments/` (line 804) — `require_factory_financial`
- `DELETE /orders/{order_id}/factory-payments/{id}/` (line 850) — `require_factory_financial`
- `PUT /orders/{order_id}/factory-payments/{id}/` (line 887) — `require_factory_financial`
- `GET /orders/{order_id}/payment-audit-log/` (line 952) — `require_factory_financial`
- `GET /factories/{factory_id}/credits/` (line 1384) — `require_factory_financial`
- `POST /orders/{order_id}/apply-factory-credit/` (line 1410) — `require_factory_financial`
- `GET /factory-ledger/{factory_id}/` (line 1475) — `require_factory_financial`
- `GET /factory-ledger/{factory_id}/download/` (line 1835) — `require_factory_financial`

OPERATIONS sending a request to any factory payment or factory ledger endpoint receives **403 Forbidden** from `require_factory_financial` before any handler logic executes.

#### Task 3 — Frontend DashboardTab (defence-in-depth)

Hide the Factory & Costs panel (estProfit row, `factory_total_inr`, `factory_total_cny` display) when `current_user.role === 'OPERATIONS'`. In Next.js use `hasPermission(user, 'view_factory_real_pricing')` from the D-004 permission matrix. Backend is authoritative; this is a UX guard to prevent empty/zero values appearing in place of the hidden panel.

#### Task 4 — Frontend PaymentsTab (defence-in-depth)

Hide the Factory Payments section entirely when `current_user.role === 'OPERATIONS'`. In Next.js use the same `hasPermission(user, 'view_factory_real_pricing')` check. The section header, factory bill summary, factory payment history table, and Record Remittance button are all hidden.

#### Task 5 — CustomsTab `unit_price_cny` (Wave 0 product decision required — not yet unblocked)

`customsApi.getHsnItems()` returns `part.unit_price_cny` used as the BOE unit price. This is the same D-010 family of factory pricing data. **A separate Wave 0 product decision is required** before implementation (see `ordertab_customs.md` Q-001):

- **(a)** Extend D-010: restrict CustomsTab to ADMIN|FINANCE|SUPER_ADMIN — OPERATIONS cannot create/edit BOEs.
- **(b)** Accept exposure: document explicit OPERATIONS exception in DECISIONS.md as D-010 amendment.

This task is **not unblocked** by D-010 ratification alone. Decision must be made during Wave 0 product decision sprint, before Wave 8 (CustomsTab) migration.

---

## Wave 0 commitment

No production rollout of the new frontend is permitted while any item in the "Open" section above is unresolved.

See also: **D-006** in `DECISIONS.md` — ratifies the portal permission enforcement policy that governs all future portal permission work.

---

Sign-off required before migration resumes: _______________
