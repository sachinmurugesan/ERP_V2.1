# Portal Permissions Audit

_Generated: 2026-04-21_
_Scope: frontend-enforced portal permission fields — HarvestERP Vue frontend + FastAPI backend_
_Method: static analysis (grep + model inspection). No runtime testing._

---

## 1. Permission field inventory

All 12 permission fields live in the `portal_permissions` JSON column on the `clients` table
(see `backend/models.py:140-147`, schema at `backend/schemas/auth.py:53-68`).
All default to `False`. Exposed via `GET /api/auth/me` → `data.portal_permissions`.

An additional field `client_type` (REGULAR | TRANSPARENCY) on the same `clients` table
gates pricing column visibility; it is not part of `portal_permissions` but is treated here
because it has the same frontend-gating pattern.

### Tab-visibility permissions (6)

| Field | Purpose |
|---|---|
| `show_payments` | Payments tab in order detail; Ledger standalone page |
| `show_production` | Production tab in order detail |
| `show_shipping` | Shipping tab in order detail; Shipments standalone page |
| `show_after_sales` | After-Sales tab in order detail; After-Sales standalone page |
| `show_files` | Files tab in order detail |
| `show_packing` | Packing tab in order detail |

### Order-item action permissions (6)

| Field | Purpose |
|---|---|
| `items_add` | Add single item button in ClientOrderItemsTab |
| `items_bulk_add` | Bulk-add items button |
| `items_fetch_pending` | Fetch pending additions button |
| `items_upload_excel` | Excel upload button |
| `items_edit_qty` | Quantity edit on confirmed items |
| `items_remove` | Remove item button |

### Pricing gate (not in portal_permissions)

| Field | Purpose |
|---|---|
| `client_type` | TRANSPARENCY → show factory pricing columns + Landed Cost tab |

---

## 2. Enforcement layers

Two independent layers can block access: **backend** (API refuses the request) and **frontend**
(component hides the route or UI element). Both layers should agree. Where they diverge,
the weaker one defines the effective access control.

### Backend enforcement (confirmed in source)

| Permission | Endpoint enforced | File | Note |
|---|---|---|---|
| `show_payments` | `GET /api/client/ledger/` | `orders.py:397` | Returns 403/error if flag is false |
| `show_packing` | `GET /api/orders/{id}/packing/` | `orders.py:3165` | Returns 403/error if flag is false |
| All others | — | — | **No backend enforcement found** |

### Frontend enforcement (confirmed in source)

| Permission | Menu hidden (ClientLayout) | Route-level guard | Component/tab guard (ClientOrderDetail) |
|---|---|---|---|
| `show_payments` | YES — "Ledger" link (`ClientLayout.vue:68`) | **NO** | YES — Payments tab (`:128`) |
| `show_production` | NO — no standalone route | N/A | YES — Production tab (`:130`) |
| `show_shipping` | YES — "Shipments" link (`ClientLayout.vue:70`) | **NO** | YES — Shipping tab (`:134`) |
| `show_after_sales` | YES — "After-Sales" link (`ClientLayout.vue:72`) | **NO** | YES — After-Sales tab (`:136`) |
| `show_files` | NO — no standalone route | N/A | YES — Files tab (`:141`) |
| `show_packing` | NO — no standalone route | N/A | YES — Packing tab (`:132`) |
| `items_add` | N/A | N/A | YES — `canAdd` prop (`ClientOrderItemsTab.vue:38`) |
| `items_bulk_add` | N/A | N/A | YES — `canBulkAdd` prop (`:39`) |
| `items_fetch_pending` | N/A | N/A | YES — `canFetchPending` prop (`:40`) |
| `items_upload_excel` | N/A | N/A | YES — `canUploadExcel` prop (`:41`) |
| `items_edit_qty` | N/A | N/A | YES — `canEditQty` prop (`:42`) |
| `items_remove` | N/A | N/A | YES — `canRemove` prop (`:43`) |
| `client_type` | N/A | N/A | YES — `isTransparencyClient` computed (`:49`) |

`portalPerms` is read in exactly **two** frontend files:
- `frontend/src/components/layout/ClientLayout.vue` (menu construction)
- `frontend/src/views/client/ClientOrderDetail.vue` (tab construction)

No other Vue file reads `portalPerms`. This is confirmed by full-codebase grep.

---

## 3. Findings table

| Permission field | Routes that respect it | Routes that bypass it | Backend protects? | Severity |
|---|---|---|---|---|
| `show_payments` | ClientOrderDetail Payments tab; ClientLayout menu | **`/client-portal/ledger` — `ClientLedger.vue` makes no permission check** | YES (`orders.py:397`) | **BYPASS** — frontend UX bypass; data blocked by backend |
| `show_production` | ClientOrderDetail Production tab | No standalone route exposed | NO | **BACKEND_BYPASS** — tab-gated in UI; production API endpoints not gated server-side |
| `show_shipping` | ClientOrderDetail Shipping tab; ClientLayout menu | **`/client-portal/shipments` — `ClientShipments.vue` makes no permission check** | NO | **BYPASS (HIGH)** — route navigable; backend does not block; data accessible |
| `show_after_sales` | ClientOrderDetail After-Sales tab; ClientLayout menu | **`/client-portal/after-sales` — `ClientAfterSales.vue` makes no permission check** | NO | **BYPASS (HIGH)** — route navigable; backend does not block; data accessible |
| `show_files` | ClientOrderDetail Files tab | No standalone route exposed | NO | **BACKEND_BYPASS** — tab-gated in UI; documents API not gated server-side |
| `show_packing` | ClientOrderDetail Packing tab | No standalone route exposed | YES (`orders.py:3165`) | **OK** — both layers enforced |
| `items_add` | ClientOrderItemsTab (button hidden) | Direct `POST /api/orders/{id}/items/` | NO | **BACKEND_BYPASS** — UI hidden; endpoint not permission-checked |
| `items_bulk_add` | ClientOrderItemsTab (button hidden) | Direct bulk-add endpoint | NO | **BACKEND_BYPASS** |
| `items_fetch_pending` | ClientOrderItemsTab (button hidden) | Direct pending endpoint | NO | **BACKEND_BYPASS** |
| `items_upload_excel` | ClientOrderItemsTab (button hidden) | Direct upload endpoint | NO | **BACKEND_BYPASS** |
| `items_edit_qty` | ClientOrderItemsTab (button hidden) | Direct PATCH endpoint | NO | **BACKEND_BYPASS** |
| `items_remove` | ClientOrderItemsTab (button hidden) | Direct DELETE endpoint | NO | **BACKEND_BYPASS** |
| `client_type` | ClientOrderItemsTab pricing cols; Landed Cost tab | `ordersApi.get()` returns all price fields to all clients regardless of type | NO | **BACKEND_BYPASS** — pricing data in API response even for REGULAR clients (overlaps Cluster C/D) |

---

## 4. Detailed BYPASS findings

### G-001 — `show_payments`: `/client-portal/ledger` route unguarded

**Severity:** MEDIUM (frontend bypass; backend enforces on the data endpoint)

`ClientLayout.vue:68` hides the "Ledger" menu item when `show_payments` is false.
`ClientLedger.vue` calls `ordersApi.myLedger()` on mount with no permission check.
A client can navigate directly to `/client-portal/ledger` — the page renders, issues the
API call, and the backend returns a 403 (because `orders.py:397` does check). The result
is an error state rendered to the client rather than a redirect. No data leaks, but the
route is navigable and the UX is broken for the "payments disabled" use case.

**Fix:** Add a `show_payments` guard to the `/client-portal/ledger` route in `router/index.js`,
or add a `onMounted` redirect inside `ClientLedger.vue`.

---

### G-002 — `show_shipping`: `/client-portal/shipments` route unguarded + no backend gate

**Severity:** HIGH (true data bypass — backend does not enforce)

`ClientLayout.vue:70` hides the "Shipments" menu item when `show_shipping` is false.
`ClientShipments.vue` has no `portalPerms` check (confirmed: `portalPerms` is read in only
2 files — neither is `ClientShipments.vue`). The backend shipment data endpoints are not
listed among the permission-enforced endpoints. A client can navigate directly to
`/client-portal/shipments` and load real shipment data they are not supposed to see.

**Fix:** Add a `show_shipping` guard to the route in `router/index.js` AND add backend
enforcement to the shipment data endpoints.

---

### G-003 — `show_after_sales`: `/client-portal/after-sales` route unguarded + no backend gate

**Severity:** HIGH (true data bypass — backend does not enforce)

Same pattern as G-002. `ClientLayout.vue:72` hides the "After-Sales" menu item.
`ClientAfterSales.vue` has no `portalPerms` check. Backend after-sales data endpoints
are not permission-enforced. Direct navigation to `/client-portal/after-sales` exposes
after-sales records to clients who should not have access.

**Fix:** Add a `show_after_sales` guard to the route in `router/index.js` AND add backend
enforcement to the after-sales data endpoints.

---

### G-004 — `items_*` (6 fields): UI hidden but backend endpoints unguarded

**Severity:** HIGH (backend bypass — API endpoints accept requests regardless of flags)

`ClientOrderItemsTab.vue:38-43` derives `canAdd`, `canBulkAdd`, etc. from
`props.permissions.*` and hides/disables buttons accordingly. However, no backend
enforcement was found for the underlying item mutation endpoints (add, bulk-add,
fetch-pending, upload-excel, edit-qty, remove). A client with browser dev tools can issue
POST/PATCH/DELETE requests directly and bypass all six action permissions.

**Fix:** Backend item mutation endpoints must check the caller's `portal_permissions`
before executing. This is independent of — and more critical than — the frontend guards.

---

### G-005 — `client_type` pricing: API returns price fields to all clients

**Severity:** HIGH (overlaps Cluster C/D in SECURITY_BACKLOG.md)

`ClientOrderItemsTab.vue` correctly hides factory pricing columns for REGULAR clients
(`isTransparencyClient` computed, line 49). However, `ordersApi.get()` returns the
full item payload including `factory_price`, `factory_markup_percent`, and related fields
to ALL clients regardless of `client_type`. A REGULAR client can read pricing data from
the network response. This is already tracked under Clusters C and D in SECURITY_BACKLOG.md
and is recorded here for completeness.

---

### G-006 — `show_production` / `show_files`: tab-gated but backend endpoints unguarded

**Severity:** MEDIUM (backend bypass; no standalone route reduces frontend exposure)

Neither `show_production` nor `show_files` has a standalone route — the only frontend
exposure is the tab inside `ClientOrderDetail.vue`, which correctly gates both. However,
the underlying production data and document list endpoints are not backend-permission-checked.
A client who knows the API endpoint URLs can retrieve production or file data regardless
of their permission flags.

**Fix:** Add `show_production` and `show_files` checks to the relevant backend endpoints.

---

## 5. Summary counts

| Status | Count | Fields |
|---|---|---|
| OK | 1 | `show_packing` |
| BYPASS (frontend + backend gap) | 2 | `show_shipping`, `show_after_sales` |
| BYPASS (frontend only; backend gates) | 1 | `show_payments` |
| BACKEND_BYPASS (no standalone route; UI gate present) | 8 | `show_production`, `show_files`, all 6 `items_*` |
| BACKEND_BYPASS (overlaps existing Cluster C/D) | 1 | `client_type` pricing |

**Total fields audited: 13** (12 `portal_permissions` keys + `client_type`)

---

## 6. Recommended fix order

1. **G-002 + G-003** (HIGH) — add route guards in `router/index.js` for `/client-portal/shipments` and `/client-portal/after-sales`; add backend permission checks to shipment and after-sales read endpoints. These are true data leaks with no backstop.
2. **G-004** (HIGH) — add backend permission enforcement to all 6 item mutation endpoints. UI-only guards on write operations are insufficient.
3. **G-001** (MEDIUM) — add route guard or `onMounted` redirect to `ClientLedger.vue` for cleaner UX (data is backend-protected, but the broken error state is confusing).
4. **G-006** (MEDIUM) — add backend enforcement to production and document read endpoints.
5. **G-005** — tracked under Cluster C/D; fix with those clusters.

---

_Verified by: static analysis only. Runtime behavior of backend permission checks (orders.py:397, orders.py:3165) not tested — confirm enforcement is a hard 403, not just a UI flag._
