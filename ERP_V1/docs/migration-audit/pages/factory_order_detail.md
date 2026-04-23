# Factory Order Detail

**Type:** page
**Portal:** factory (`/factory-portal/*` — `user_type === 'FACTORY'`)
**Route:** `/factory-portal/orders/:id` → `FactoryOrderDetail`
**Vue file:** [frontend/src/views/factory/FactoryOrderDetail.vue](../../../frontend/src/views/factory/FactoryOrderDetail.vue)
**Line count:** 99
**Migration wave:** Wave 3 (factory portal)
**Risk level:** medium (renders `factory_price` per item — factory's own CNY quoted price, intentional per `FACTORY_HIDDEN_FIELDS`; raw backend error rendered to user — P-002; no selling price, markup, or client identity visible)

---

## Purpose (one sentence)

Read-only detail view for a single factory-assigned order, showing the order header with status badge and a line-item table with per-unit and cumulative CNY factory pricing.

---

## Layout (top→bottom, left→right, exhaustive)

### Outer container
`p-4 md:p-6 max-w-6xl mx-auto` — rendered inside `FactoryLayout`'s `<router-view />` slot.

**Back link** (always visible): `"← Back to Orders"` → `/factory-portal/orders` (text-indigo-600). **Hardcoded destination — does not account for navigation from `/production` or `/packing`.**

**Loading state** (`v-if="loading"`):
- Centred: `pi-spinner pi-spin` + "Loading..."

**Error state** (`v-else-if="error"`):
- Centred: `<div class="text-red-500">{{ error }}</div>`
- **P-002:** `error` is set to `e.response?.data?.detail || 'Failed to load order'` — raw backend error detail is rendered directly.

**Order view** (`v-else-if="order"`, template):

**Zone 1 — Order header** (`flex flex-col sm:flex-row ... mb-6`)
- `h1` "Order {order.order_number}" (`text-xl md:text-2xl font-bold text-slate-800`)
- Status badge: `stageColors[order.status]` or `bg-gray-100`; `(order.status || '').replace(/_/g, ' ')`

**Zone 2 — Items table card** (`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6`)

Section header: `h2` "Order Items" in a bordered row.

- **Mobile cards** (`md:hidden divide-y divide-slate-50`): one card per item.
  - Top row: `item.product_code_snapshot || item.product_code` (font-mono text-xs) | unit price `¥N` or `'-'` (right)
  - Middle: `item.product_name_snapshot || item.product_name`
  - Bottom row: `Qty: {item.quantity || 0}` | line total `¥N` or `'-'` (right, font-medium text-slate-700)
  - **No empty state message on mobile** — renders empty container when `order.items` is empty.

- **Desktop table** (`hidden md:table w-full text-sm`): 7 columns + tfoot.

| # | Column | Header | Format |
|---|---|---|---|
| 1 | Row index | `#` | `i + 1` (text-slate-400) |
| 2 | Product code | `Code` | `item.product_code_snapshot \|\| item.product_code \|\| '-'` (font-mono text-xs) |
| 3 | Description | `Description` | `item.product_name_snapshot \|\| item.product_name \|\| '-'` |
| 4 | Category | `Category` | `item.category_snapshot \|\| item.category \|\| '-'` (text-xs text-slate-500) |
| 5 | Quantity | `Qty` | `item.quantity \|\| 0` (right-aligned) |
| 6 | Unit price | `Unit Price (CNY)` | `item.factory_price != null ? '¥' + Number(...).toLocaleString() : '-'` (right, font-medium) |
| 7 | Line total | `Total (CNY)` | `factory_price != null ? '¥' + (price × qty).toLocaleString() : '-'` (right, font-medium) |

Empty row: `v-if="!order.items?.length"` → `<td colspan="7">No items</td>`

**tfoot** (`v-if="order.items?.length"`, `bg-slate-50 border-t-2`):
- "Total" label spanning cols 1–6; grand total CNY computed **inline** in the template via `order.items.reduce((sum, i) => sum + (Number(i.factory_price || 0) * (i.quantity || 0)), 0).toLocaleString()` (bold, right-aligned).

---

## Data displayed

| Field | Source | Format | Notes |
|---|---|---|---|
| `order.order_number` | `ordersApi.get()` | plain string in `h1` | — |
| `order.status` | `ordersApi.get()` → `FACTORY_STATUS_COLORS` | badge | Fallback `bg-gray-100`; `replace(/_/g, ' ')` |
| `item.product_code_snapshot \|\| item.product_code` | `order.items[]` | font-mono text-xs | Snapshot-first fallback |
| `item.product_name_snapshot \|\| item.product_name` | `order.items[]` | plain string | Snapshot-first fallback |
| `item.category_snapshot \|\| item.category` | `order.items[]` | text-xs text-slate-500 | Desktop only; snapshot-first fallback |
| `item.quantity` | `order.items[]` | integer | Fallback `0` |
| `item.factory_price` | `order.items[]` | `¥N` CNY | Factory's own quoted unit price. Intentional. `null` → `'-'`. |
| Line total (computed) | `item.factory_price × item.quantity` | `¥N` CNY | Computed inline in template |
| Grand total (computed) | `reduce` over all items | `¥N` CNY | Computed inline in `tfoot`; only shown when `order.items?.length > 0` |

**Not visible to FACTORY callers** (stripped by `filter_for_role(..., 'FACTORY')`):
`selling_price_inr`, `selling_price`, `markup_percent`, `client_id`, `client_name`, `client`, `pi_total_inr`, `pi_total_cny`, `internal_notes`, `compensation_amount`, and all other `FACTORY_HIDDEN_FIELDS`.

---

## Interactions (every clickable/typeable element)

| Trigger | Action | API call | Result |
|---|---|---|---|
| Page mount (`onMounted`) | `loadOrder()` | `GET /api/orders/{id}` | Populates `order`; sets `error` on failure |
| Click "← Back to Orders" | navigate via `router-link` | none | `/factory-portal/orders` (always — does not return to originating route) |

---

## Modals/dialogs triggered

None observed.

---

## API endpoints consumed

| Method | Path | Via | Params | Notes |
|---|---|---|---|---|
| GET | `/api/orders/{id}` | `ordersApi.get(orderId)` | none | Backend: `verify_resource_access` checks `FACTORY` caller's `factory_id` matches `order.factory_id` ([orders.py:655-657](../../../backend/routers/orders.py#L655)) — unauthorized → 404/403. Response filtered by `filter_for_role(data, 'FACTORY')`. |

> Per D-001 (Option B): in Next.js this becomes `client.orders.get(orderId)` via the generated SDK.

---

## Composables consumed

None. Uses `useRoute()` from Vue Router directly.

---

## PrimeVue components consumed

None — hand-rolled Tailwind + PrimeIcons icon classes (`pi-spinner pi-spin`, `pi-arrow-left`).

---

## Local state

| Name | Type | Initial | Purpose |
|---|---|---|---|
| `orderId` | `route.params.id` (string) | from route | Order ID captured at setup — **not reactive** |
| `order` | `ref(null)` | `null` | Full order object including `items[]` |
| `loading` | `ref(true)` | `true` | Gates loading state |
| `error` | `ref('')` | `''` | Error message — raw `e.response?.data?.detail` or fallback |

No `computed`, `watch`, or `onUnmounted`.

---

## Permissions / role gating

- Route is under `FactoryLayout`, restricted to `user_type === 'FACTORY'` by `router.beforeEach` ([router/index.js:378-380](../../../frontend/src/router/index.js#L378)).
- **Backend ownership check:** `orders.py:655-657` — for `role in ("CLIENT", "FACTORY")`, `verify_resource_access(Order, order_id, db, current_user)` is called. For FACTORY callers, this checks `current_user.factory_id == order.factory_id` ([security.py:274](../../../backend/core/security.py#L274)). A FACTORY user requesting another factory's order receives 403/404.
- **Field stripping:** `filter_for_role(data, 'FACTORY')` strips all `FACTORY_HIDDEN_FIELDS` — factory users cannot see selling prices, client identity, markup, or PI totals.
- `factory_price` is **not** in `FACTORY_HIDDEN_FIELDS` — factory users see their own quoted CNY prices. Intentional.

---

## Bilingual labels (Tamil + English pairs)

All strings are English-only, hardcoded in the template. No i18n infrastructure.

| Key | en | ta | Type |
|---|---|---|---|
| `factory.order_detail.back` | "Back to Orders" | "" | `PortalString` |
| `factory.order_detail.loading` | "Loading..." | "" | `PortalString` |
| `factory.order_detail.title` | "Order {number}" | "" | `PortalString` |
| `factory.order_detail.items_heading` | "Order Items" | "" | `PortalString` |
| `factory.order_detail.col_num` | "#" | "" | `PortalString` |
| `factory.order_detail.col_code` | "Code" | "" | `PortalString` |
| `factory.order_detail.col_description` | "Description" | "" | `PortalString` |
| `factory.order_detail.col_category` | "Category" | "" | `PortalString` |
| `factory.order_detail.col_qty` | "Qty" | "" | `PortalString` |
| `factory.order_detail.col_unit_price` | "Unit Price (CNY)" | "" | `PortalString` |
| `factory.order_detail.col_total` | "Total (CNY)" | "" | `PortalString` |
| `factory.order_detail.no_items` | "No items" | "" | `PortalString` |
| `factory.order_detail.footer_total` | "Total" | "" | `PortalString` |
| `factory.order_detail.mobile_qty` | "Qty:" | "" | `PortalString` |
| `factory.order_detail.error_fallback` | "Failed to load order" | "" | `DialogString` |

[UNCLEAR — needs Sachin review: Tamil translations required for all `PortalString` entries; `error_fallback` must also have a `ta` value as a `DialogString` (D-005).]

---

## Empty / error / loading states

| State | Trigger | Rendered to user? | Notes |
|---|---|---|---|
| Loading | `loading === true` | Yes — spinner + "Loading..." | Full-page centred block |
| Error | `error !== ''` after catch | Yes — **P-002**: `{{ error }}` rendered as `e.response?.data?.detail` or fallback "Failed to load order" | Raw backend error string shown in red; no toast, no retry button |
| Empty items — desktop | `!order.items?.length` | Yes — "No items" in a `colspan="7"` row | — |
| Empty items — mobile | `order.items` empty | **No** — renders empty `div.md:hidden` with no message | Inconsistent with desktop empty state |

---

## Business rules (non-obvious)

1. **`orderId` is non-reactive.** `const orderId = route.params.id` is captured once at component setup. If Vue Router reuses the component instance for navigation between `/factory-portal/orders/A` and `/factory-portal/orders/B` (same route, different param), `loadOrder()` will **not** re-fire and the stale order data will remain. Requires a `watch(() => route.params.id, loadOrder)` or `key` prop on the route to be safe.
2. **Grand total computed inline in the template.** The `tfoot` row uses a `reduce` expression directly in the template rather than a `computed` property. The computed runs on every render cycle.
3. **`factory_price` null guard applied consistently.** Both mobile and desktop check `factory_price != null` before rendering a value — items with no price set show `'-'` in all contexts.
4. **Snapshot-first product fields.** All three product description fields (`product_code`, `product_name`, `category`) use a `snapshot || live` fallback. The snapshot preserves the product data as it was when the order was placed; the live field is a fallback for legacy rows without snapshots.
5. **No mutation capability.** Factory users can only read this page — there is no production update, packing update, or date-submission UI here. Production milestone submission (if it exists) must be in a different component or route not captured in this profile.

---

## Known quirks

- **Back link ignores originating route.** The "← Back to Orders" link always navigates to `/factory-portal/orders`. If the user arrived from `/factory-portal/production` or `/factory-portal/packing`, back navigation drops them on the wrong tab. No `router.back()` or `previousRoute` logic.
- **Non-reactive `orderId`.** See Business rules §1. Vue Router param change without component remount will not re-fetch the order.
- **Empty state inconsistency.** Desktop shows "No items" when `order.items` is empty; mobile renders a blank card container with no message.
- **P-002 error exposure.** `e.response?.data?.detail` from FastAPI is rendered directly. FastAPI detail strings can contain internal model names, SQL constraint names, or stack fragments depending on error type.
- **No edit/action capability.** Factory users cannot submit production updates or packing confirmations from this page. [UNCLEAR — is there a separate production-update flow, or is the factory portal intentionally read-only?]

---

## Dead code / unused state

None observed.

---

## Duplicate or inline utilities

- **Grand total `reduce` in `tfoot`** — computed inline in the template rather than as a `computed()` property. In the Next.js rebuild, extract as `const totalCny = useMemo(() => items.reduce(...), [items])`.
- **Snapshot-first field fallback pattern** (`item.product_code_snapshot || item.product_code`) — repeated 3 times across mobile and desktop renders. In Next.js, normalise at the adapter/SDK layer so the component always reads a single canonical field.

---

## Migration notes

1. **D-001:** `ordersApi.get(orderId)` → `client.orders.get(orderId)` via generated SDK.
2. **D-005:** All visible strings are `PortalString` (labels) or `DialogString` (error fallback); Tamil translations must be non-empty before merge.
3. **Fix P-002 error rendering:** Replace `{{ error }}` with a structured error message that does not expose `e.response?.data?.detail` to the user. Display a user-friendly message; log the raw detail server-side or to a monitoring tool.
4. **Fix non-reactive `orderId`:** In Next.js, use `params.id` from the page's props (server component) or `useParams()` (client component) — both are param-change-aware by default.
5. **Fix back navigation:** Use `router.back()` (with a fallback to `/factory-portal/orders`), or pass the originating route as a query param (`?from=production`) and read it on "Back".
6. **Add mobile empty state:** Render "No items" in the mobile cards section when `order.items` is empty.
7. **Extract grand total to derived value:** Do not compute in the template; use `useMemo` or a server-derived field.
8. **Normalise snapshot fields at adapter layer:** Define `OrderItem` SDK type with single canonical fields (`productCode`, `productName`, `category`) populated by the adapter from snapshot-first logic. Component reads one field, not two with `||`.
9. **Backend field stripping confirmed:** `filter_for_role(data, 'FACTORY')` strips all `FACTORY_HIDDEN_FIELDS`. `factory_price` is not in that set — factory users seeing their own quoted CNY prices is intentional.
10. **[UNCLEAR — needs Sachin review]:** Is the factory portal intended to be entirely read-only, or should `FactoryOrderDetail` eventually include production milestone submission (e.g., "Mark 60% complete", "Upload packing list")? The current file has no mutation logic at all.
