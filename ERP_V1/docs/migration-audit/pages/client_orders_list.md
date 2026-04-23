# Client Orders List

**Type:** page
**Portal:** client (`/client-portal/*` — `user_type === 'CLIENT'`)
**Route:** `/client-portal/orders` → `ClientOrders`
**Vue file:** [frontend/src/views/client/ClientOrders.vue](../../../frontend/src/views/client/ClientOrders.vue)
**Line count:** 135
**Migration wave:** Wave 2 (client portal)
**Risk level:** low (read-only list; one inline dialog; selling_total_inr is intentionally visible to client)

## Purpose (one sentence)
Searchable, filterable list of all orders belonging to the authenticated client — including soft-deleted (cancelled) orders — with a one-click path to view each order's detail or start a new inquiry.

## Layout (top→bottom, left→right, exhaustive)

### Outer container
`p-6 max-w-6xl mx-auto` — rendered inside `ClientLayout`'s `<router-view />` slot.

**Zone 1 — Header row**
- Left: `h1` "My Orders" (`text-2xl font-bold text-slate-800`).
- Right: `<router-link to="/client-portal/orders/new">` emerald-600 pill button, `pi-plus` icon, label "New Inquiry".

**Zone 2 — Filter bar** (`flex gap-3 mb-4`)
- Free-text `<input>` (flex-1): placeholder "Search orders...", `v-model="search"`, `@input="loadOrders"` (fires on every keystroke).
- `<select>` status filter: `v-model="statusFilter"`, `@change="loadOrders"`. First option "All Status" (value `''`); remaining options from `ORDER_FILTER_OPTIONS` in `clientPortal.js` (12 entries — see constants below).

**Zone 3 — Content area** (conditional)

*Loading:* `pi-spinner pi-spin text-2xl` + "Loading orders..." centered.

*Empty:* `w-16 h-16 rounded-full bg-slate-100` icon tile (`pi-shopping-cart text-2xl text-slate-400`) + "No orders yet" + subtext.

*Populated table* (`bg-white rounded-xl border border-slate-200 shadow-sm`):

Columns: Order # | Status | Items | Total (INR) | Created | Action

| Column | Value | Format | Notes |
|---|---|---|---|---|
| Order # | `o.order_number` | `font-mono font-medium` | fallback `'-'` |
| Status | `o.deleted_at ? 'CANCELLED' : statusLabels[o.status]` | rounded-full badge | cancelled: `bg-red-100 text-red-700`; others: `CLIENT_STATUS_COLORS` |
| Items | `o.item_count` | integer | fallback `0` |
| Total (INR) | `o.selling_total_inr` | `'₹' + Number(...).toLocaleString()` | raw `'-'` if falsy |
| Created | `o.created_at` | `new Date(...).toLocaleDateString()` | raw `'-'` if falsy |
| Action | "See Reason" (cancelled) / "View" link | button / router-link | |

Row behaviour:
- Cancelled rows (`o.deleted_at`): `opacity-50 line-through cursor-pointer`; clicking the row calls `showReason(o)`.
- Normal rows: `hover:bg-slate-50`; row click is not wired — only the "View" link navigates.

**Zone 4 — Cancellation reason dialog** (rendered via `v-if="showDeleteReason"`)

Fixed full-screen overlay (`fixed inset-0 z-50 bg-black/40`), click-outside closes.

Dialog card (`bg-white rounded-2xl shadow-2xl p-6 max-w-md`):
- Icon row: `w-10 h-10 rounded-full bg-red-100` + `pi-ban text-red-600`.
- Heading: "Order Cancelled" / order_number sub-heading.
- Body: `bg-red-50 border border-red-200` block — label "Reason for cancellation:" + `deleteReasonOrder.deletion_reason || 'No reason provided'`.
- Footer: "Cancelled on: {deleted_at formatted}" + "Close" button.

## Data displayed

| Field | Source | Format | Notes |
|---|---|---|---|
| `o.order_number` | `ordersApi.list()` | monospace | |
| `o.status` | → `CLIENT_STATUS_LABELS` | badge | uses `getStatusLabel` fallback |
| `o.deleted_at` | `ordersApi.list()` | truthy check | signals soft-delete |
| `o.item_count` | `ordersApi.list()` | integer | |
| `o.selling_total_inr` | `ordersApi.list()` | INR formatted | **intentionally exposed to client** — selling price, not factory price |
| `o.created_at` | `ordersApi.list()` | locale date | |
| `o.deletion_reason` | `ordersApi.list()` | plain string | shown only in modal |
| `total` (response envelope) | `data.total` | integer | stored in `total` ref but not displayed |

**Security note:** `selling_total_inr` is rendered. Confirm with backend that this field is always the client-facing selling price (not factory COGS). Per D-004, `factory_price`, `factory_markup_percent`, and related fields must be stripped from CLIENT responses at the serializer level before this page renders them.

## Interactions (every clickable/typeable element)

| Trigger | Action | API call | Result |
|---|---|---|---|
| Type in search `<input>` | updates `search`, calls `loadOrders()` on every keystroke | `GET /api/orders/` | table re-renders |
| Change status `<select>` | updates `statusFilter`, calls `loadOrders()` | `GET /api/orders/` | table re-renders |
| Click "New Inquiry" (header) | navigate | none | `/client-portal/orders/new` |
| Click cancelled order row | `showReason(order)` | none | opens deletion reason dialog |
| Click "See Reason" button | `showReason(order)` (`.stop` prevents double trigger) | none | opens deletion reason dialog |
| Click "View" link (normal row) | navigate | none | `/client-portal/orders/{o.id}` |
| Click overlay (dialog) | `showDeleteReason = false` | none | closes dialog |
| Click "Close" (dialog) | `showDeleteReason = false` | none | closes dialog |

## Modals/dialogs triggered

### Cancellation Reason Dialog
- **Trigger:** clicking a cancelled-order row or its "See Reason" button.
- **Data:** `deleteReasonOrder.order_number`, `deletion_reason`, `deleted_at`.
- **Actions:** "Close" only — read-only.
- **D-003 note:** this dialog uses a hand-rolled overlay, not `window.confirm()` or `window.alert()`. No migration to `<ConfirmDialog>` needed (it is informational, not destructive).

## API endpoints consumed

| Method | Endpoint | Via | Params | Notes |
|---|---|---|---|---|
| GET | `/api/orders/` | `ordersApi.list()` | `limit: 50`, `include_deleted: true`, `search?`, `status?` | Called on mount and on every filter/search change. |

> Per D-001 (Option B): in Next.js this becomes `client.orders.list({ limit: 50, includeDeleted: true, search, status })`.

## Composables consumed

None directly. `ordersApi` is imported from `../../api`.

## PrimeVue components consumed

None. All UI is hand-rolled Tailwind + PrimeIcons (`pi-plus`, `pi-spinner pi-spin`, `pi-shopping-cart`, `pi-ban`).

## Local state

- `orders: ref([])` — full list, including soft-deleted.
- `total: ref(0)` — server total count; declared but not rendered (no pagination UI).
- `loading: ref(true)` — controls spinner vs. table.
- `search: ref('')` — bound to free-text input.
- `statusFilter: ref('')` — bound to select.
- `showDeleteReason: ref(false)` — controls cancellation dialog visibility.
- `deleteReasonOrder: ref(null)` — the order object whose reason is being displayed.

No `computed`, `watch`, or lifecycle hooks beyond `onMounted(loadOrders)`.

## Permissions / role gating

- Route restricted to `user_type === 'CLIENT'` by global router guard.
- `include_deleted: true` is always sent — all clients see their own cancelled orders.
- No ADMIN/SUPER_ADMIN gate. The backend scopes to `current_user.client_id`.

## Bilingual labels (Tamil + English pairs)

| Key | en | ta | Type |
|---|---|---|---|
| `client.orders_list.title` | "My Orders" | `""` | `PortalString` |
| `client.orders_list.new_inquiry` | "New Inquiry" | `""` | `PortalString` |
| `client.orders_list.search_placeholder` | "Search orders..." | `""` | `PortalString` |
| `client.orders_list.status_all` | "All Status" | `""` | `PortalString` |
| `client.orders_list.col_order` | "Order #" | `""` | `PortalString` |
| `client.orders_list.col_status` | "Status" | `""` | `PortalString` |
| `client.orders_list.col_items` | "Items" | `""` | `PortalString` |
| `client.orders_list.col_total` | "Total (INR)" | `""` | `PortalString` |
| `client.orders_list.col_created` | "Created" | `""` | `PortalString` |
| `client.orders_list.col_action` | "Action" | `""` | `PortalString` |
| `client.orders_list.cancelled_badge` | "CANCELLED" | `""` | `PortalString` |
| `client.orders_list.see_reason` | "See Reason" | `""` | `PortalString` |
| `client.orders_list.view` | "View" | `""` | `PortalString` |
| `client.orders_list.empty_title` | "No orders yet" | `""` | `PortalString` |
| `client.orders_list.empty_body` | "Once your orders are created, they will appear here with real-time status tracking." | `""` | `PortalString` |
| `client.orders_list.loading` | "Loading orders..." | `""` | `PortalString` |
| `client.orders_list.cancel_modal_title` | "Order Cancelled" | `""` | `DialogString` |
| `client.orders_list.cancel_reason_label` | "Reason for cancellation:" | `""` | `DialogString` |
| `client.orders_list.cancel_no_reason` | "No reason provided" | `""` | `DialogString` |
| `client.orders_list.cancel_date_prefix` | "Cancelled on:" | `""` | `DialogString` |
| `client.orders_list.cancel_close` | "Close" | `""` | `DialogString` |

[UNCLEAR — needs Sachin review: Tamil translations required for all entries before Wave 2 is migration-ready (D-005). `DialogString` entries (`cancel_modal_*`) require non-empty `ta` at the type level.]

## Empty / error / loading states

- **Loading:** full-column spinner replaces both filter bar output and table.
- **Empty:** shown when `orders.length === 0` after load — applies to both "no orders at all" and "no orders matching filters" (no differentiation between the two states).
- **Error:** silently swallowed (`catch (_e) { /* ignore */ }`); shows empty state.

## Business rules (non-obvious)

1. **Cancelled orders are always fetched.** `include_deleted: true` is hardcoded — clients always see their cancelled history, not a filtered view.
2. **No client-side pagination.** `limit: 50` is hardcoded. A client with more than 50 orders sees a truncated list with no indication that results are cut off. `total` ref is populated but not rendered.
3. **Search and status filter are server-side, not client-side.** Every keystroke in the search box fires a new API request. No debounce.
4. **Cancelled rows are not navigable to order detail.** Clicking a cancelled row opens the reason dialog, not the order detail page — even though `ClientOrderDetail.vue` likely handles deleted orders gracefully.
5. **`ORDER_FILTER_OPTIONS` contains `'SHIPPED'` as a value** but no such status exists in `CLIENT_STATUS_LABELS` — it would return zero results when selected. [UNCLEAR — needs Sachin review: dead filter option?]

## Known quirks

- No debounce on search input — fires on every keystroke.
- `total` is fetched but hidden — no pagination indicator or "showing X of Y" text.
- Empty state is generic — does not differentiate "no orders exist" from "no orders match your search".
- `SHIPPED` in `ORDER_FILTER_OPTIONS` has no corresponding status in the system.

## Migration notes

- **D-001:** `ordersApi.list(...)` → `client.orders.list(...)` via generated SDK.
- **D-003:** No `confirm()` / `alert()` calls. Cancellation reason dialog is informational — no `<ConfirmDialog>` migration needed here.
- **D-005:** All strings are `PortalString` or `DialogString`; Tamil required before merge.
- **Layer 2 components needed:** `OrderStatusBadge`, `CancellationReasonModal`, `SearchFilterBar`.
- **Fix in Next.js:** Add debounce (300ms) to the search input to avoid hammering the API.
- **Fix in Next.js:** Add a "showing {n} of {total}" indicator if `total > 50`, or implement cursor-based pagination.
- **Open questions for Sachin:**
  1. Should cancelled orders be navigable to their detail page? The current Vue app blocks navigation.
  2. Is `SHIPPED` in the filter dropdown a bug or a legacy status that should be removed?
  3. Should we differentiate "no orders" vs. "no matching orders" in the empty state?

---

## Dead code / unused state

- `total: ref(0)` — populated from `data.total` in `loadOrders()` but never rendered (no pagination UI). Remove or wire to a "showing X of Y" indicator.

---

## Duplicate or inline utilities

None. At 135 lines, this component is tightly scoped. No inline utility functions observed.
