# Internal Product Review

**Type:** page (admin workflow)
**Portal:** internal (`user_type === 'INTERNAL'`)
**Route:** `/products/review` → `ProductReview` (meta.title: `'Product Review'`, meta.icon: `'pi-check-square'`, **meta.roles: `['ADMIN']`**)
**Vue file:** [frontend/src/views/products/ProductReview.vue](../../../frontend/src/views/products/ProductReview.vue)
**Line count:** 464
**Migration wave:** Wave 4 (internal master data)
**Risk level:** low — G-011 CLOSED 2026-04-22 (Patch 10): inline `require_role(["ADMIN"])` enforcement added to all product review endpoints; backend now matches the frontend route guard

---

## Purpose

ADMIN-only triage page for processing client-submitted product requests (pending-review products): each request can be approved (creates a new product in the catalog), mapped to an existing product, or rejected with a remark.

---

## Layout

### Outer container
`max-w-4xl mx-auto p-4 md:p-6`

**Zone 1 — Page header**
- `h1` "Product Review"
- Badge showing pending request count

**Zone 2 — Pending list** (`space-y-4`)

**Loading state:** centred spinner + "Loading..."

**Empty state:** pi-check-circle icon + "No pending product requests" (green tone)

**Per-request card** (`bg-white rounded-xl shadow-sm p-5 border border-slate-200`):

Left section:
- `product_code` (font-mono text-lg teal-700)
- `product_name` (text-slate-700)
- `quantity` badge
- Metadata row: client name (`client_name` or "Unknown client"), order reference (`order_reference`), requested by (`requested_by_name`), submitted date (`created_at` formatted)

Right section (action buttons, always visible):
- "Approve" button (emerald) → `openApproveModal(request)` → `showApproveModal = true`
- "Map to Existing" button (blue) → `openMapModal(request)` → `showMapModal = true`
- "Reject" button (red) → `openRejectModal(request)` → `showRejectModal = true`

---

### Approve Modal (`showApproveModal`)

Full-screen overlay with a 9-field form pre-filled from the request:

| Field | Label | Input | Pre-fill source |
|---|---|---|---|
| `product_name` | Product Name | `<input type="text">` | `request.product_name` |
| `product_name_chinese` | Chinese Name | `<input type="text">` | `''` |
| `category` | Category | `<select>` | `''` — options from `productsApi.categories()` |
| `material` | Material | `<input type="text">` | `''` |
| `dimension` | Dimension | `<input type="text">` | `''` |
| `part_type` | Part Type | `<select>` | `''` — options from `productsApi.partTypes()` (via `productsApi.materials()` [UNCLEAR exact call]) |
| `brand` | Brand | `<input type="text">` | `''` — options from `productsApi.brands()` shown as datalist or select |
| `hs_code` | HS Code | `<input type="text">` | `''` |
| `unit_weight_kg` | Weight (kg) | `<input type="number">` | `null` |

Error: `alert(e.response?.data?.detail || 'Failed to approve')` — **P-002 (alert variant)**

Buttons: Cancel | Approve → `handleApprove()` → `productsApi.approveRequest(id, form.value)` → `POST /api/products/product-requests/{id}/approve/`

On success: request removed from `pendingRequests` list (optimistic removal); reload if needed.

---

### Map Modal (`showMapModal`)

Full-screen overlay with a product search/picker:

- Search input → `searchProducts(q)` → `GET /api/products/?search=q` (shows children only — orderable variants)
- Results list: per product shows `product_code` (font-mono), `product_name`, `material`, brand badge
- "Not in access" tag: shown when `isClientAccessible(p)` returns false — **this always returns false** because `clientBrands.value` is hardcoded `[]` and never populated (see Dead code section)
- Click product → `selectedProduct = p`
- "Map to this product" button → `handleMap()` → `productsApi.mapRequest(id, { target_product_id })` → `POST /api/products/product-requests/{id}/map/`

Error: `alert(e.response?.data?.detail || 'Failed to map')` — **P-002 (alert variant)**

---

### Reject Modal (`showRejectModal`)

Simple overlay:
- `remark` textarea (required — button disabled when empty)
- Character count or placeholder: "Reason for rejection..."
- Cancel | Reject button → `handleReject()` → `productsApi.rejectRequest(id, { remark })` → `POST /api/products/product-requests/{id}/reject/`

Error: `alert(e.response?.data?.detail || 'Failed to reject')` — **P-002 (alert variant)**

---

## Data displayed

| Field | Source | Format | Notes |
|---|---|---|---|
| `product_code` | `pendingRequests[i].product_code` | font-mono teal-700 | Client-submitted code |
| `product_name` | `pendingRequests[i].product_name` | text | Client-submitted name |
| `quantity` | `pendingRequests[i].quantity` | badge | Requested quantity |
| `client_name` | `pendingRequests[i].client_name` | text | Resolved at backend from client_id |
| `order_reference` | `pendingRequests[i].order_reference` | text | Order number/PO/id prefix |
| `requested_by_name` | `pendingRequests[i].requested_by_name` | text | User who submitted the request |
| `created_at` | `pendingRequests[i].created_at` | formatted date | ISO string from backend |
| Pending count | `pendingRequests.length` | badge in header | Live count |

No pricing fields in product request data — P-007 checklist clean.

---

## Interactions

| Trigger | Action | API call | Result |
|---|---|---|---|
| Page mount | `loadPendingRequests()` | `GET /api/products/pending-review-list/` | Populates `pendingRequests` |
| "Approve" button | `openApproveModal(req)` | none | Opens approve modal; pre-fills form |
| Approve modal submit | `handleApprove()` | `POST /api/products/product-requests/{id}/approve/` | Creates product; removes from list; notifies client |
| "Map to Existing" button | `openMapModal(req)` | `GET /api/products/?search=...` | Opens map modal; triggers initial search |
| Map search input | `searchProducts(q)` | `GET /api/products/?search=q` | Updates `searchResults` |
| Click product in map results | `selectedProduct = p` | none | Highlights selected product |
| Map modal submit | `handleMap()` | `POST /api/products/product-requests/{id}/map/` | Creates OrderItem; grants access; removes from list |
| "Reject" button | `openRejectModal(req)` | none | Opens reject modal |
| Reject modal submit | `handleReject()` | `POST /api/products/product-requests/{id}/reject/` | Updates status to REJECTED; notifies client; removes from list |
| Any modal Cancel | close modal | none | Clears modal state |

---

## Modals/dialogs triggered

| Modal | Trigger | Purpose |
|---|---|---|
| Approve Modal | "Approve" button on request card | Fill product details and create in catalog |
| Map Modal | "Map to Existing" button on request card | Search for and link to an existing product |
| Reject Modal | "Reject" button on request card | Provide rejection remark |

---

## API endpoints consumed

| Method | Path | Via | Notes |
|---|---|---|---|
| GET | `/api/products/pending-review-list/` | `productsApi.pendingReviewList()` | Returns `{products: [...], total}`. Has `current_user` dep but **no ADMIN role check** — G-011 |
| POST | `/api/products/product-requests/{id}/approve/` | `productsApi.approveRequest(id, data)` | Creates parent+child Product + OrderItem + ClientProductAccess + Notification. G-011 CLOSED (Patch 10): `require_role(["ADMIN"])` enforced |
| POST | `/api/products/product-requests/{id}/reject/` | `productsApi.rejectRequest(id, {remark})` | Updates ProductRequest.status + Notification. G-011 CLOSED (Patch 10): `require_role(["ADMIN"])` enforced |
| POST | `/api/products/product-requests/{id}/map/` | `productsApi.mapRequest(id, {target_product_id})` | Creates OrderItem + ClientProductAccess + Notification. G-011 CLOSED (Patch 10): `require_role(["ADMIN"])` enforced |
| GET | `/api/products/` | `productsApi.list({search, ...})` | In Map modal search; returns orderable variants |
| GET | `/api/products/categories/` | `productsApi.categories()` | Approve modal category dropdown |
| GET | `/api/products/brands/` | `productsApi.brands()` | Approve modal brand input |
| GET | `/api/products/materials/` | `productsApi.materials()` | Approve modal material input |

> Per D-001 (Option B): in Next.js these become `client.products.*` via the generated SDK.

---

## Composables consumed

None. No `useAuth()` import — role enforcement relies entirely on the router guard.

---

## PrimeVue components consumed

None — hand-rolled Tailwind + PrimeIcons (`pi-check-circle`, `pi-spinner pi-spin`, `pi-times`).

---

## Local state

| Name | Type | Initial | Purpose |
|---|---|---|---|
| `pendingRequests` | `ref([])` | `[]` | List of PENDING product requests |
| `loading` | `ref(true)` | `true` | Page loading spinner |
| `showApproveModal` | `ref(false)` | `false` | Approve modal visibility |
| `showMapModal` | `ref(false)` | `false` | Map modal visibility |
| `showRejectModal` | `ref(false)` | `false` | Reject modal visibility |
| `selectedRequest` | `ref(null)` | `null` | Request being actioned |
| `approveForm` | `ref({...})` | 9 empty fields | Approve modal form state |
| `rejectRemark` | `ref('')` | `''` | Reject modal remark text |
| `saving` | `ref(false)` | `false` | Modal action loading state |
| `searchQuery` | `ref('')` | `''` | Map modal search input |
| `searchResults` | `ref([])` | `[]` | Map modal product list |
| `selectedProduct` | `ref(null)` | `null` | Chosen product in map modal |
| `cleaningOrphans` | `ref(false)` | `false` | **Dead state** — comment: "No orphan cleanup needed", never used |
| `clientBrands` | `ref([])` | `[]` | **Dead state** — hardcoded `[]`, never populated; causes `isClientAccessible()` to always return false |

---

## Permissions / role gating

**Frontend:** `meta.roles: ['ADMIN']` on the route is checked in `router.beforeEach` (index.js:391-396):
```js
const hasAccess = to.meta.roles.includes(user.value.role)
                || user.value.role === 'ADMIN'
                || user.value.role === 'SUPER_ADMIN'
```
Result: only ADMIN and SUPER_ADMIN users can navigate to `/products/review`; others are redirected to `/access-denied`. **Frontend enforcement is correct.**

**Backend: G-011 CLOSED (Patch 10, 2026-04-22).** All four review endpoints (`pending-review-list`, `approve`, `reject`, `map`) now enforce `require_role(["ADMIN"])`. Non-ADMIN INTERNAL users (OPERATIONS, FINANCE) receive HTTP 403 if they call these endpoints directly. Frontend guard and backend enforcement now agree.

---

## Bilingual labels (`InternalString`)

All strings English-only. No i18n infrastructure.

| Key | en | ta | Type |
|---|---|---|---|
| `internal.product_review.title` | "Product Review" | "" | `InternalString` |
| `internal.product_review.loading` | "Loading..." | "" | `InternalString` |
| `internal.product_review.empty` | "No pending product requests" | "" | `InternalString` |
| `internal.product_review.btn_approve` | "Approve" | "" | `InternalString` |
| `internal.product_review.btn_map` | "Map to Existing" | "" | `InternalString` |
| `internal.product_review.btn_reject` | "Reject" | "" | `InternalString` |
| `internal.product_review.modal_approve_title` | "Approve Product Request" | "" | `InternalString` |
| `internal.product_review.modal_map_title` | "Map to Existing Product" | "" | `InternalString` |
| `internal.product_review.modal_reject_title` | "Reject Request" | "" | `InternalString` |

[D-005: Tamil can remain `""` for internal pages.]

---

## Empty / error / loading states

| State | Trigger | Rendered to user? | Notes |
|---|---|---|---|
| Loading | `loading === true` | Yes — centred spinner | Page-level |
| Empty | `pendingRequests.length === 0 && !loading` | Yes — "No pending product requests" | Green success tone |
| Approve error | `catch` in `handleApprove()` | **P-002 (alert variant):** `alert(detail)` | Raw backend detail in browser native alert |
| Map error | `catch` in `handleMap()` | **P-002 (alert variant):** `alert(detail)` | Raw backend detail in browser native alert |
| Reject error | `catch` in `handleReject()` | **P-002 (alert variant):** `alert(detail)` | Raw backend detail in browser native alert |
| Load error | `catch` in `loadPendingRequests()` | **No — P-002 (swallow):** `pendingRequests = []`; empty state shown | |

---

## Business rules

1. **Approve creates parent + child product atomically.** `POST /approve/` checks for a duplicate `product_code` first (HTTP 409 if code already exists → user should use Map instead). Then creates parent `[CODE]` + child variant + marks child `is_default = True`. Both are in the same DB transaction.
2. **Map creates the OrderItem.** `POST /map/` does not create a new Product — it links the existing product to the order by creating an `OrderItem` record, grants `ClientProductAccess` if not already present, and notifies the client.
3. **Approve also grants client access.** After creating the product, `approve` checks if the client has brand-level access. If not, it creates a `ClientProductAccess` record for both child and parent.
4. **Approve deduplicates notifications.** If an unread `PRODUCT_APPROVED` notification already exists for that client, it increments a counter rather than creating a new notification.
5. **Reject requires a remark.** The Reject button is disabled when `rejectRemark` is empty. The remark is stored in `ProductRequest.reject_remark` and included in the client notification message.

---

## Known quirks

- **`isClientAccessible()` always returns false.** The function checks `clientBrands.value.includes(p.brand)` but `clientBrands` is hardcoded to `[]` and never populated (no API call). The "Not in access" tag is shown for every product in the map modal, regardless of actual client access. This is dead logic that misleads the reviewer.
- **`cleaningOrphans` dead state.** A ref and a commented-out "orphan cleanup" section exist in the script but are never used. The cleanup was removed but the state ref was left.
- **Alert-based error handling (P-002).** All three action handlers (`handleApprove`, `handleMap`, `handleReject`) use `alert()` for error display — this blocks the browser thread and cannot be styled.
- **No `useAuth()` import.** Role enforcement is entirely frontend route-guard-based. If the guard is misconfigured or bypassed (direct URL navigation, HMR quirks), the page renders for non-ADMIN users with no component-level fallback.

---

## Dead code / unused state

- `cleaningOrphans = ref(false)` — ref declared but never written or read in template. Remove.
- `clientBrands = ref([])` — declared, hardcoded to `[]`, never populated. `isClientAccessible()` depends on it and always returns false. Remove or implement: fetch `ClientBrandAccess` for the request's client_id and populate `clientBrands` on `openMapModal`.

---

## Duplicate or inline utilities

None observed.

---

## Migration notes

1. **Backend role enforcement: G-011 CLOSED (Patch 10, 2026-04-22).** `require_role(["ADMIN"])` is now enforced on `pending-review-list`, `approve`, `reject`, `map` endpoints. No action required before migration.
2. **Replace `alert()` with toast.** Port all three error handlers to a toast/notification component (P-002). Use the shared toast pattern adopted elsewhere in the portal.
3. **Implement or remove `isClientAccessible()`.** Either populate `clientBrands` from the client's actual `ClientBrandAccess` records (via a new API call in `openMapModal`) or remove the "Not in access" tag entirely. The current state actively misleads the reviewer.
4. **Remove dead state.** Delete `cleaningOrphans` and `clientBrands` refs and the associated dead functions.
5. **Add component-level auth guard.** In Next.js, use `redirect()` in the Server Component if the session role is not ADMIN — don't rely solely on middleware.
6. **Approve modal field defaults.** Consider pre-filling `category`, `material`, `brand` from the product request data if it's available — currently all fields start empty, making the approve flow require manual re-entry of data the client already provided.
7. **D-001:** All `productsApi.*` → `client.products.*` via generated SDK.
8. **D-005:** All `InternalString`; Tamil can remain `""`.
