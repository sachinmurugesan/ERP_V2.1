# Factory Orders (shared: Orders / Production / Packing)

**Type:** page (one component, three routes)
**Portal:** factory (`/factory-portal/*` — `user_type === 'FACTORY'`)
**Routes (all three mount this component):**
- `/factory-portal/orders` → `FactoryOrders` (meta.title: `'Orders'`)
- `/factory-portal/production` → `FactoryProduction` (meta.title: `'Production'`)
- `/factory-portal/packing` → `FactoryPacking` (meta.title: `'Packing'`)
**Vue file:** [frontend/src/views/factory/FactoryOrders.vue](../../../frontend/src/views/factory/FactoryOrders.vue)
**Line count:** 69
**Migration wave:** Wave 3 (factory portal)
**Risk level:** medium (desktop column renders `factory_total_cny` — factory's own CNY order value; intentional per `FACTORY_HIDDEN_FIELDS`; no client identity or INR selling price visible)

---

## Purpose (one sentence)

Searchable list of all orders assigned to the authenticated factory, shared verbatim across three routes (Orders, Production, Packing) with no route-context filtering — all three views show identical unfiltered output differentiated only by the router's `meta.title`.

---

## Layout (top→bottom, left→right, exhaustive)

### Outer container
`p-4 md:p-6 max-w-6xl mx-auto` — rendered inside `FactoryLayout`'s `<router-view />` slot.

**Zone 1 — Page title**
- `h1` "Assigned Orders" (`text-xl md:text-2xl font-bold text-slate-800 mb-4 md:mb-6`) — **hardcoded; never reads `meta.title` from the router**. All three routes display this identical heading.

**Zone 2 — Search bar** (`mb-4`)
- `<input v-model="search" @input="loadOrders" placeholder="Search orders..." />` — full-width, fires `loadOrders()` on every keystroke with **no debounce**.

**Zone 3 — Order list card** (`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden`)

- **Loading state** (`v-if="loading"`): centred `pi-spinner pi-spin` + "Loading..."
- **Mobile card list** (`md:hidden divide-y divide-slate-50`):
  - Empty guard: "No orders assigned" when `orders.length === 0 && !loading`
  - Per-order: `router-link` to `/factory-portal/orders/{o.id}`
    - Left: `o.order_number` (font-mono text-sm)
    - Right: status badge (`stageColors[o.status]` or `bg-gray-100 text-gray-700`)
    - Below: `{o.item_count || 0} items` (text-xs text-slate-400)
  - **`factory_total_cny` is NOT shown on mobile.**
- **Desktop table** (`hidden md:table w-full text-sm`): 5 columns.

| Column | Header | Format | Notes |
|---|---|---|---|
| 1 | Order # | font-mono | `o.order_number` |
| 2 | Status | badge | `stageColors[o.status]`; `.replace(/_/g, ' ')` |
| 3 | Items | plain text | `o.item_count \|\| 0` |
| 4 | Total (CNY) | `¥N,NNN` | `o.factory_total_cny ? '¥' + Number(...).toLocaleString() : '-'` — **pricing visible on desktop only** |
| 5 | Action | link | "View" → `/factory-portal/orders/{o.id}` (text-indigo-600) |

Empty row: `v-if="orders.length === 0"` → `<td colspan="5">No orders assigned</td>`

---

## Data displayed

| Field | Source | Format | Notes |
|---|---|---|---|
| `o.order_number` | `ordersApi.list()` | font-mono string | — |
| `o.status` | `ordersApi.list()` → `FACTORY_STATUS_COLORS` | badge | Fallback `bg-gray-100`; rendered as `status.replace(/_/g, ' ')` |
| `o.item_count` | `ordersApi.list()` | integer | Fallback `0` |
| `o.factory_total_cny` | `ordersApi.list()` | `¥N` via `toLocaleString()` or `'-'` | **Desktop only; always renders `'-'`** — API serializes this value as `total_value_cny` (`serialize_order:231`), not `factory_total_cny`. Field is `undefined` in every response row. See Known quirks and G-010. |

**Pricing fields:** `factory_total_cny` column always shows `'-'` due to field name mismatch (see Known quirks). No `selling_price_inr`, `markup_percent`, or client identity visible — stripped by `FACTORY_HIDDEN_FIELDS` in `filter_list_for_role`.

---

## Interactions (every clickable/typeable element)

| Trigger | Action | API call | Result |
|---|---|---|---|
| Page mount (`onMounted`) | `loadOrders()` | `GET /api/orders/?limit=50` | Populates `orders` and `total` |
| Keystroke in search field | `loadOrders()` (no debounce) | `GET /api/orders/?limit=50&search=<value>` | Fires on every character typed; hammers backend with partial queries |
| Click mobile row | navigate via `router-link` | none | `/factory-portal/orders/{o.id}` |
| Click "View" (desktop) | navigate via `router-link` | none | `/factory-portal/orders/{o.id}` |

---

## Modals/dialogs triggered

None observed.

---

## API endpoints consumed

| Method | Path | Via | Params | Notes |
|---|---|---|---|---|
| GET | `/api/orders/` | `ordersApi.list()` | `limit: 50`, optional `search` | Backend scopes to `Order.factory_id == current_user.factory_id` via `get_scoped_query`. `filter_list_for_role(..., 'FACTORY')` strips `FACTORY_HIDDEN_FIELDS`. |

> Per D-001 (Option B): in Next.js this becomes `client.orders.list({ limit: 50, search })` via the generated SDK.

---

## Composables consumed

None.

---

## PrimeVue components consumed

None — hand-rolled Tailwind + PrimeIcons icon classes (`pi-spinner pi-spin`).

---

## Local state

| Name | Type | Initial | Purpose |
|---|---|---|---|
| `orders` | `ref([])` | `[]` | Full list of factory-scoped orders |
| `total` | `ref(0)` | `0` | Populated from `data.total` — **never rendered in the template; dead state** |
| `loading` | `ref(true)` | `true` | Gates loading spinner; toggled in `loadOrders()` |
| `search` | `ref('')` | `''` | Two-way bound to search input; passed as query param |

No `computed`, `watch`, or `onUnmounted`.

---

## Permissions / role gating

- All three routes are under `FactoryLayout`, restricted to `user_type === 'FACTORY'` by `router.beforeEach` ([router/index.js:378-380](../../../frontend/src/router/index.js#L378)).
- Backend `get_scoped_query` enforces `Order.factory_id == current_user.factory_id` — a FACTORY user cannot see orders from other factories ([security.py:310-312](../../../backend/core/security.py#L310)).
- `filter_list_for_role(..., 'FACTORY')` strips `client_id`, `client_name`, `selling_price_inr`, `markup_percent`, and all other `FACTORY_HIDDEN_FIELDS` fields.
- `total_value_cny` (the actual serialized field) is **not** in `FACTORY_HIDDEN_FIELDS` — factory users may legitimately see their own total CNY value. **G-010 CLOSED (2026-04-22):** `total_value_cny` is now in `CLIENT_HIDDEN_FIELDS` in `core/serializers.py` — CLIENT callers no longer receive this field. See G-010 in SECURITY_BACKLOG.md.

---

## Bilingual labels (Tamil + English pairs)

All strings are English-only, hardcoded in the template. No i18n infrastructure.

| Key | en | ta | Type |
|---|---|---|---|
| `factory.orders.title` | "Assigned Orders" | "" | `PortalString` |
| `factory.orders.search_placeholder` | "Search orders..." | "" | `PortalString` |
| `factory.orders.loading` | "Loading..." | "" | `PortalString` |
| `factory.orders.empty` | "No orders assigned" | "" | `PortalString` |
| `factory.orders.col_order` | "Order #" | "" | `PortalString` |
| `factory.orders.col_status` | "Status" | "" | `PortalString` |
| `factory.orders.col_items` | "Items" | "" | `PortalString` |
| `factory.orders.col_total_cny` | "Total (CNY)" | "" | `PortalString` |
| `factory.orders.col_action` | "Action" | "" | `PortalString` |
| `factory.orders.view` | "View" | "" | `PortalString` |

[UNCLEAR — needs Sachin review: Tamil translations required for all `PortalString` entries before Wave 3 is migration-ready (D-005).]

---

## Empty / error / loading states

| State | Trigger | Rendered to user? | Notes |
|---|---|---|---|
| Loading | `loading === true` | Yes — spinner + "Loading..." | Shown on both mobile and desktop sections |
| Empty | `orders.length === 0 && !loading` | Yes — "No orders assigned" | Mobile: separate `v-if` block above the loop. Desktop: `<tr v-if="orders.length === 0">` inline in tbody. |
| Error | `catch (_e) { /* ignore */ }` | **No — P-002 (swallow variant)**: orders stays `[]`; empty state shown instead of error | No toast, no retry button, no distinction between "no orders" and "load failed" |

---

## Business rules (non-obvious)

1. **Limit:50, no pagination.** The component fetches at most 50 orders. A factory with >50 assigned orders will see truncated results with no indication. Same root-cause pattern as `ClientShipments.vue` and `ClientProducts.vue`.
2. **All three routes render identical output.** No status filter is applied based on which route was mounted. The Production route does not filter to `PRODUCTION_*` statuses; the Packing route does not filter to `BOOKED`. The route differentiation is purely cosmetic (sidebar nav highlight, document title via `meta.title`).
3. **Component never reads `meta.title`.** The `<h1>` is hardcoded to "Assigned Orders". A user navigating via the "Production" sidebar item sees "Assigned Orders" as the page heading.
4. **`total` populated but not rendered.** `total.value = data.total` is set in `loadOrders()` but the template has no `{{ total }}` binding. Dead state.
5. **Search re-fetches the full list on every keystroke.** `@input="loadOrders"` has no debounce — each character typed fires a new `ordersApi.list()` call.

---

## Known quirks

- **Three-route reuse with no context differentiation (see Migration notes):** Navigating to `/production` or `/packing` shows the same "Assigned Orders" page as `/orders` with no status filtering. The intent of having separate Production and Packing nav items is completely unimplemented at the component level.
- **`factory_total_cny` field name mismatch (bug):** The template reads `o.factory_total_cny` but `serialize_order` emits `total_value_cny` (`orders.py:231`). The field is `undefined` in every response row — the "Total (CNY)" desktop column always renders `'-'`. Fix: replace `o.factory_total_cny` with `o.total_value_cny` in the template. **G-010 CLOSED (2026-04-22):** `total_value_cny` is now in `CLIENT_HIDDEN_FIELDS` — CLIENT callers no longer receive this field.
- **CNY column mobile/desktop asymmetry:** Even after fixing the field name, the CNY total will remain desktop-only (not shown in mobile cards), giving mobile users less information.
- **No debounce on search:** Every keystroke fires `loadOrders()`. On a slow connection or large dataset this may cause request pile-up or flicker.
- **`total` ref is dead state:** Populated but never used in the template.

---

## Dead code / unused state

- `total: ref(0)` — set from `data.total || orders.value.length` inside `loadOrders()`, but no template binding reads it. Can be removed.

---

## Duplicate or inline utilities

None observed. `FACTORY_STATUS_COLORS` imported from `utils/factoryPortal.js` — not inlined.

---

## Migration notes

1. **Un-merge into three distinct Next.js pages (Wave 0 architecture — D-006 pattern).** Each route should have its own page component that accepts a `statusFilter` prop or uses a shared `<OrderListPage statusFilter={...} />` Layer 2 component:
   - `/factory-portal/orders` — no status filter; full assigned order list
   - `/factory-portal/production` — `status__in=PRODUCTION_60,PRODUCTION_80,PRODUCTION_90,PRODUCTION_100`
   - `/factory-portal/packing` — `status__in=BOOKED`
   Each page should render its own contextual heading (e.g., "Production Queue", "Packing Queue") rather than the shared "Assigned Orders".
2. **Add debounce (300ms) to search input.** Use `useDebounce` from TanStack or a local hook. (Cross-cutting: P-010.)
3. **Add `status__in` query param to `ordersApi.list()` backend.** Required for the un-merge above. The backend already supports `status` as a comma-separated filter (see `orders.py:341-344`).
4. **Fix CNY column field name:** Replace `o.factory_total_cny` → `o.total_value_cny` in the template. **G-010 CLOSED (2026-04-22):** `total_value_cny` is already in `CLIENT_HIDDEN_FIELDS` in `core/serializers.py` — no SDK-level action required.
5. **Remove `total` dead state** or render it as "Showing N of M orders" in the table header once pagination is added.
6. **Add pagination.** Replace `limit: 50` hard ceiling with cursor/page-based pagination and a "Load more" or page control. (Cross-cutting: P-009.)
7. **D-001:** `ordersApi.list()` → `client.orders.list()` via generated SDK.
8. **D-005:** All visible strings are `PortalString`; Tamil translations must be non-empty before merge.
9. **Fix silent error swallow:** Surface a toast or inline error on `ordersApi.list()` failure (P-010).
