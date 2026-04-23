# Client Dashboard

**Type:** page
**Portal:** client (`/client-portal/*` — `user_type === 'CLIENT'`)
**Route:** `/client-portal/` → `ClientDashboard`
**Vue file:** [frontend/src/views/client/ClientDashboard.vue](../../../frontend/src/views/client/ClientDashboard.vue)
**Line count:** 150
**Migration wave:** Wave 2 (client portal)
**Risk level:** low (read-only summary; no mutations; no sensitive pricing data exposed)

## Purpose (one sentence)
Landing page for authenticated clients: shows three real-time counters (active orders, total orders, in-transit orders) and a 5-row recent orders table, with a shortcut to start a new inquiry.

## Layout (top→bottom, left→right, exhaustive)

### Outer container
`p-6 max-w-6xl mx-auto` — rendered inside `ClientLayout`'s `<router-view />` slot.

**Zone 1 — Header row**
- Left side: `h1` "Welcome, {user.full_name || 'Client'}" (`text-2xl font-bold text-slate-800`) + `p` "Your order overview and recent activity" (`text-sm text-slate-400`).
- Right side: `<router-link to="/client-portal/orders/new">` styled as an emerald-600 pill button with `pi-plus` icon — label "New Inquiry".

**Zone 2 — Stats grid** (`grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8`)

Three stat cards, each: white rounded-xl card, icon tile on the right, label + number on the left.

| Card | Label | Number color | Icon | Value derivation |
|---|---|---|---|---|
| 1 | Active Orders | `text-emerald-600` | `pi-shopping-cart` (emerald bg-50) | `orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED' && !o.deleted_at).length` |
| 2 | Total Orders | `text-blue-600` | `pi-list` (blue bg-50) | `data.total || orders.length` |
| 3 | In Transit | `text-violet-600` | `pi-send` (violet bg-50) | `orders.filter(o => SHIPPING_STATUSES.has(o.status)).length` — `SHIPPING_STATUSES` = LOADED, SAILED, ARRIVED, CUSTOMS_FILED, CLEARED, DELIVERED, AFTER_SALES, COMPLETED |

> `stats.total_value` ref is declared but never populated or rendered — fourth card is absent from the template.

**Zone 3 — Recent Orders table** (`bg-white rounded-xl border border-slate-200 shadow-sm`)

- Table header row: `pi-clock` icon + "Recent Orders" heading; "View all →" link to `/client-portal/orders` (emerald-600 text).
- **Loading state** (while `loading === true`): `pi-spinner pi-spin text-2xl` + "Loading your orders...".
- **Empty state** (`recentOrders.length === 0`): `pi-inbox text-3xl text-slate-200` + "No orders yet. Start by creating your first inquiry!" + inline "Create Inquiry" link to `/client-portal/orders/new`.
- **Populated table** columns: Order # | Status | Items _(hidden on xs)_ | Created _(hidden on sm)_ | Action

Table rows (up to 5): each row `@click` navigates to `/client-portal/orders/{order.id}`. "View →" link in Action column uses `@click.stop` to avoid double-navigation.

## Data displayed

| Field | Source | Format | Notes |
|---|---|---|---|
| `user.full_name` | `useAuth().user` | plain string | falls back to `'Client'` |
| `stats.active_orders` | computed from `ordersApi.list()` response | integer | client-side filter |
| `stats.total_orders` | `data.total \|\| orders.length` | integer | prefers server-side count |
| `stats.pending_shipments` | computed from `ordersApi.list()` response | integer | client-side filter on `SHIPPING_STATUSES` |
| `order.order_number` | `ordersApi.list()` | monospace string | fallback `'—'` |
| `order.client_reference` | `ordersApi.list()` | plain string `text-[10px]` | shown next to order_number if present |
| `order.status` | `ordersApi.list()` → `CLIENT_STATUS_LABELS` / `getStatusLabel()` | status badge | colors from `CLIENT_STATUS_COLORS` |
| `order.item_count` | `ordersApi.list()` | integer | fallback `0` |
| `order.created_at` | `ordersApi.list()` → `formatDate()` | formatted date string | |

**Pricing fields:** none visible. No `selling_total_inr`, `factory_price`, or margin data is rendered on this page.

## Interactions (every clickable/typeable element)

| Trigger | Action | API call | Result |
|---|---|---|---|
| Click "New Inquiry" (header) | navigate | none | `/client-portal/orders/new` |
| Click table row | `$router.push('/client-portal/orders/{order.id}')` | none | navigate to order detail |
| Click "View →" (action column) | navigate (`.stop` prevents row click) | none | `/client-portal/orders/{order.id}` |
| Click "View all →" (table header) | navigate | none | `/client-portal/orders` |
| Click "Create Inquiry" (empty state) | navigate | none | `/client-portal/orders/new` |

## Modals/dialogs triggered

None.

## API endpoints consumed

| Method | Endpoint | Via | Params | Notes |
|---|---|---|---|---|
| GET | `/api/orders/` | `ordersApi.list()` | `limit: 10` | Returns envelope `{ items/orders, total }`. Array path: `data.items \|\| data.orders \|\| (Array.isArray(data) ? data : [])`. Response is sliced to 5 for `recentOrders`. |

> Per D-001 (Option B): in Next.js this becomes `client.orders.list({ limit: 10 })` via the generated SDK.

## Composables consumed

- **`useAuth`** — reads `user` ref (`user.full_name`) for the welcome heading. No write operations.

## PrimeVue components consumed

None. All UI is hand-rolled Tailwind + PrimeIcons icon classes (`pi-shopping-cart`, `pi-list`, `pi-send`, `pi-plus`, `pi-clock`, `pi-inbox`, `pi-spinner pi-spin`, `pi-arrow-right`).

## Local state

- `stats: ref({ active_orders: 0, total_orders: 0, pending_shipments: 0, total_value: 0 })` — `total_value` is never written.
- `recentOrders: ref([])` — populated with `orders.slice(0, 5)`.
- `loading: ref(true)` — set to `false` in the `finally`-equivalent `loadData()` tail.

No `computed`, `watch`, or `onUnmounted`.

## Permissions / role gating

- Route is under `ClientLayout`, which the global `router.beforeEach` guard restricts to `user_type === 'CLIENT'` ([router/index.js:373-388](../../../frontend/src/router/index.js#L373)).
- No per-field permission checks on this page — the backend's `/api/orders/` endpoint already scopes results to the authenticated client's tenant.
- No SUPER_ADMIN / ADMIN gate needed — this route is physically unreachable to INTERNAL users.

## Bilingual labels (Tamil + English pairs)

| Key | en | ta | Type |
|---|---|---|---|
| `client.dashboard.welcome` | "Welcome, {name}" | `""` | `PortalString` |
| `client.dashboard.subtitle` | "Your order overview and recent activity" | `""` | `PortalString` |
| `client.dashboard.new_inquiry` | "New Inquiry" | `""` | `PortalString` |
| `client.dashboard.stat_active` | "Active Orders" | `""` | `PortalString` |
| `client.dashboard.stat_total` | "Total Orders" | `""` | `PortalString` |
| `client.dashboard.stat_in_transit` | "In Transit" | `""` | `PortalString` |
| `client.dashboard.recent_title` | "Recent Orders" | `""` | `PortalString` |
| `client.dashboard.view_all` | "View all" | `""` | `PortalString` |
| `client.dashboard.empty_title` | "No orders yet. Start by creating your first inquiry!" | `""` | `PortalString` |
| `client.dashboard.create_inquiry` | "Create Inquiry" | `""` | `PortalString` |
| `client.dashboard.loading` | "Loading your orders..." | `""` | `PortalString` |

[UNCLEAR — needs Sachin review: Tamil translations required for all `PortalString` entries before Wave 2 is migration-ready (D-005).]

## Empty / error / loading states

- **Loading:** spinner + "Loading your orders..." inside the table zone; stats cards are visible but show `0` while loading.
- **Empty (no orders):** `pi-inbox` icon + copy + inline CTA; stats remain `0` because `ordersApi.list()` returned an empty set.
- **Error:** silently swallowed (`catch (_e) { /* ignore */ }`); `loading` is set to `false` and all values stay at their zero defaults. [UNCLEAR — needs Sachin review: should a client-visible error message appear when the dashboard load fails?]

## Business rules (non-obvious)

1. **Stats are client-side aggregations, not server-side aggregates.** `active_orders` and `pending_shipments` are filtered from the same 10-item page used for the table — meaning they may undercount if the client has more than 10 orders. `total_orders` uses `data.total` (server-side count) and is accurate, but the other two counters are not.
2. **Deleted orders are excluded from stats silently.** The `active_orders` filter explicitly checks `!o.deleted_at`.
3. **`total_value` is dead state.** The ref is declared and initialized to `0` but is never written and has no corresponding UI card.

## Known quirks

- **Undercounting risk on stats:** active\_orders and pending\_shipments counts are derived from a `limit: 10` fetch. A client with 50+ orders will see incorrect stat numbers. The internal Dashboard uses `dashboardApi` (dedicated summary endpoint); the client portal has no equivalent.
- **No explicit error UI** if `ordersApi.list()` fails — all state silently stays at zero defaults.
- `recentOrders` is `orders.slice(0, 5)` — always at most 5 rows regardless of the `limit: 10` fetch.

## Migration notes

- **D-001:** `ordersApi.list({ limit: 10 })` → `client.orders.list({ limit: 10 })` via generated SDK.
- **D-005:** All visible strings are `PortalString`; Tamil translations must be non-empty before merge.
- **Layer 2 components needed:** `StatCard`, `RecentOrdersTable`, `StatusBadge`, `GradientCTAButton`.
- **Fix in Next.js:** Replace the undercounting stats with a dedicated `client.dashboard.summary()` SDK call backed by a new or existing `/api/orders/summary/` endpoint — return pre-aggregated `{ active_orders, total_orders, in_transit_orders }` from the server. Do not re-derive from a paginated list.
- **Open questions for Sachin:**
  1. Should dashboard stats be accurate across all orders (requires a dedicated summary endpoint) or is the current page-1 approximation acceptable?
  2. Should a client see a toast/error banner when the dashboard load fails?
  3. Tamil copy for all labels — translator review needed before Wave 2 ships.
