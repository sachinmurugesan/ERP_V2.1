# Factory Dashboard

**Type:** page
**Portal:** factory (`/factory-portal/*` — `user_type === 'FACTORY'`)
**Route:** `/factory-portal/` → `FactoryDashboard`
**Vue file:** [frontend/src/views/factory/FactoryDashboard.vue](../../../frontend/src/views/factory/FactoryDashboard.vue)
**Line count:** 82
**Migration wave:** Wave 3 (factory portal)
**Risk level:** low (read-only summary; no pricing data rendered; factory RLS enforced at backend via `get_scoped_query`)

---

## Purpose (one sentence)

Landing page for authenticated factory users showing two real-time order counters (active and total) plus a recent-orders list; a "Pending Updates" counter is declared but never populated and always displays zero.

---

## Layout (top→bottom, left→right, exhaustive)

### Outer container
`p-4 md:p-6 max-w-5xl mx-auto` — rendered inside `FactoryLayout`'s `<router-view />` slot.

**Zone 1 — Header row** (`mb-6`)
- `h1` "Welcome, {user?.full_name || 'Factory'}" (`text-xl md:text-2xl font-bold text-slate-800`)
- `p` "Production overview" (`text-sm text-slate-500`)

**Zone 2 — Stats grid** (`grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8`)

Three stat cards, each: white rounded-xl card with number on top, label beneath.

| Card | Label | Number colour | Colspan (mobile) | Value derivation |
|---|---|---|---|---|
| 1 | Active Orders | `text-indigo-600` | 1 | `orders.filter(o => !['COMPLETED','CANCELLED','DRAFT'].includes(o.status)).length` — client-side from limit:5 fetch |
| 2 | Total Orders | `text-blue-600` | 1 | `data.total \|\| orders.length` — prefers server count |
| 3 | Pending Updates | `text-amber-600` | 2 (`col-span-2 md:col-span-1`) | `stats.pending_milestones` — **always 0; never written. Dead state.** |

**Zone 3 — Recent Orders card** (`bg-white rounded-xl border border-slate-200 shadow-sm`)

- Section header: `h2` "Recent Orders" (`font-bold text-slate-800`) in a bordered row.
- **Loading state** (`v-if="loading"`): centred `pi-spinner pi-spin` + "Loading..."
- **Mobile card list** (`md:hidden divide-y divide-slate-50`): `router-link` per order to `/factory-portal/orders/{o.id}`.
  - Left: `o.order_number` (font-mono, text-sm)
  - Right: status badge (`stageColors[o.status]` or `bg-gray-100 text-gray-700`) with `status.replace(/_/g, ' ')`
  - Below: `{o.item_count || 0} items` (text-xs text-slate-400)
  - **No explicit empty state** — renders nothing when `recentOrders` is empty.
- **Desktop table** (`hidden md:table w-full text-sm`): columns Order # | Status | Items | Action.
  - Each row is a `<tr>` with a "View" `router-link` to `/factory-portal/orders/{o.id}` (text-indigo-600).
  - **No explicit empty state** — tbody renders no rows when empty; no "No recent orders" message.

---

## Data displayed

| Field | Source | Format | Notes |
|---|---|---|---|
| `user?.full_name` | `useAuth().user` | plain string | Falls back to `'Factory'` |
| `stats.active_orders` | computed from `ordersApi.list()` response | integer | Client-side filter from limit:5 — may undercount if factory has >5 orders |
| `stats.total_orders` | `data.total \|\| orders.length` | integer | Prefers server-side count |
| `stats.pending_milestones` | declared ref — never written | integer | Always renders `0`; dead state |
| `o.order_number` | `ordersApi.list()` | font-mono string | — |
| `o.status` | `ordersApi.list()` → `FACTORY_STATUS_COLORS` | status badge | Unknown status falls back to `bg-gray-100 text-gray-700`; rendered as `status.replace(/_/g, ' ')` |
| `o.item_count` | `ordersApi.list()` | integer | Fallback `0` |

**Pricing fields:** None rendered. `factory_total_cny`, `factory_price`, or selling-price data is not displayed on this page.

---

## Interactions (every clickable/typeable element)

| Trigger | Action | API call | Result |
|---|---|---|---|
| Page mount (`onMounted`) | `loadData()` | `GET /api/orders/?limit=5` | Populates `recentOrders` and `stats` |
| Click mobile card row | navigate via `router-link` | none | `/factory-portal/orders/{o.id}` |
| Click "View" (desktop Action column) | navigate via `router-link` | none | `/factory-portal/orders/{o.id}` |

---

## Modals/dialogs triggered

None observed.

---

## API endpoints consumed

| Method | Path | Via | Params | Notes |
|---|---|---|---|---|
| GET | `/api/orders/` | `ordersApi.list()` | `limit: 5` | Backend scopes to `Order.factory_id == current_user.factory_id` via `get_scoped_query`. Returns envelope `{ items/orders, total }`. |

> Per D-001 (Option B): in Next.js this becomes `client.orders.list({ limit: 5 })` via the generated SDK.

---

## Composables consumed

- **`useAuth`** — reads `user` ref (`user?.full_name`) for the welcome heading. No write operations.

---

## PrimeVue components consumed

None — hand-rolled Tailwind + PrimeIcons icon classes (`pi-spinner pi-spin`).

---

## Local state

| Name | Type | Initial | Purpose |
|---|---|---|---|
| `stats` | `ref({ active_orders: 0, total_orders: 0, pending_milestones: 0 })` | all zeros | Dashboard counters; `pending_milestones` never written |
| `recentOrders` | `ref([])` | `[]` | Up to 5 recent orders from list response |
| `loading` | `ref(true)` | `true` | Gates the loading spinner; set to `false` after `loadData` resolves |

No `computed`, `watch`, or `onUnmounted`.

---

## Permissions / role gating

- Route is under `FactoryLayout`, restricted to `user_type === 'FACTORY'` by the global `router.beforeEach` guard ([router/index.js:378-380](../../../frontend/src/router/index.js#L378)).
- `ordersApi.list()` is factory-scoped server-side: `get_scoped_query` applies `Order.factory_id == current_user.factory_id` ([security.py:310-316](../../../backend/core/security.py#L310)).
- Response is filtered by `filter_list_for_role(..., 'FACTORY')` — `FACTORY_HIDDEN_FIELDS` (client identity, selling price, markup) are stripped before the JSON reaches the browser.
- No per-field permission checks in the component — factory users have no visibility into client identity or selling pricing.

---

## Bilingual labels (Tamil + English pairs)

All strings are English-only, hardcoded in the template. No i18n infrastructure.

| Key | en | ta | Type |
|---|---|---|---|
| `factory.dashboard.welcome` | "Welcome, {name}" | "" | `PortalString` |
| `factory.dashboard.subtitle` | "Production overview" | "" | `PortalString` |
| `factory.dashboard.stat_active` | "Active Orders" | "" | `PortalString` |
| `factory.dashboard.stat_total` | "Total Orders" | "" | `PortalString` |
| `factory.dashboard.stat_pending` | "Pending Updates" | "" | `PortalString` |
| `factory.dashboard.recent_title` | "Recent Orders" | "" | `PortalString` |
| `factory.dashboard.loading` | "Loading..." | "" | `PortalString` |
| `factory.dashboard.col_order` | "Order #" | "" | `PortalString` |
| `factory.dashboard.col_status` | "Status" | "" | `PortalString` |
| `factory.dashboard.col_items` | "Items" | "" | `PortalString` |
| `factory.dashboard.col_action` | "Action" | "" | `PortalString` |
| `factory.dashboard.view` | "View" | "" | `PortalString` |

[UNCLEAR — needs Sachin review: Tamil translations required for all `PortalString` entries before Wave 3 is migration-ready (D-005).]

---

## Empty / error / loading states

| State | Trigger | Rendered to user? | Notes |
|---|---|---|---|
| Loading | `loading === true` | Yes — spinner + "Loading..." in Recent Orders zone | Stats cards visible but all show `0` |
| Empty — recent orders | `recentOrders.length === 0` after load | **No** — neither mobile cards nor desktop table renders any message | Silent empty; contrast with `FactoryOrders.vue` which shows "No orders assigned" |
| Error | `catch (_e) { /* ignore */ }` | **No — P-002 (swallow variant)**: no error message; all state stays at zero defaults | No toast, no retry, no user-visible indication of failure |

---

## Business rules (non-obvious)

1. **Stats derived from a limit:5 fetch.** `active_orders` is a client-side filter on at most 5 rows. A factory with more than 5 orders will see an understated active count. `total_orders` uses the server-side `data.total` and is accurate.
2. **`pending_milestones` is always zero.** The ref is initialised but never written; there is no API call that populates it. The "Pending Updates" card is purely decorative.
3. **`DRAFT` orders excluded from active count.** The filter explicitly excludes `COMPLETED`, `CANCELLED`, and `DRAFT`. Client portal's equivalent check does not exclude `DRAFT` — inconsistency between portals.

---

## Known quirks

- **"Pending Updates" always 0:** `stats.pending_milestones` is declared and rendered but never written. No API call fills it. The card is misleading UX.
- **No empty state for recent orders:** When `recentOrders` is empty (new factory with no assigned orders), the card renders with only its header and no body content. Neither mobile nor desktop shows a "No recent orders" message.
- **Active-orders undercount risk:** Same root cause as `ClientDashboard.vue` — stats derived from a paginated list rather than a summary endpoint.

---

## Dead code / unused state

- `stats.pending_milestones` — initialised to `0`, never written to, always renders `0` in the "Pending Updates" card. Should be removed or implemented.

---

## Duplicate or inline utilities

None observed. `FACTORY_STATUS_COLORS` imported from `utils/factoryPortal.js` — not inlined.

---

## Migration notes

1. **D-001:** `ordersApi.list({ limit: 5 })` → `client.orders.list({ limit: 5 })` via generated SDK.
2. **D-005:** All visible strings are `PortalString`; Tamil translations must be non-empty before merge.
3. **Fix undercounting stats:** Replace the limit:5 list-derived stats with a dedicated `client.dashboard.factorySummary()` SDK call backed by a new `/api/orders/factory-summary/` endpoint returning pre-aggregated `{ active_orders, total_orders, pending_milestones }`. Mirrors the `ClientDashboard` fix recommended in Wave 2.
4. **Remove or implement `pending_milestones`:** Either define what "pending milestone" means (production date not submitted? packing not updated?) and wire the backend, or remove the card entirely.
5. **Add empty state for recent orders:** Display "No orders assigned yet." when `recentOrders` is empty.
6. **Fix silent error swallow:** Surface a user-visible error message or toast when `ordersApi.list()` fails (per P-002).
7. **Layer 2 components needed:** `StatCard`, `RecentOrdersTable`, `StatusBadge`.
