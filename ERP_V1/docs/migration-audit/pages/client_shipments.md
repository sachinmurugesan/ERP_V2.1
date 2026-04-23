# Page Profile 7 of 9 — `client_shipments.md`

**Type:** page
**Portal:** client (`/client-portal/*` — `user_type === 'CLIENT'`)
**Route:** `/client-portal/shipments` → `ClientShipments`
**Vue file:** [frontend/src/views/client/ClientShipments.vue](../../../frontend/src/views/client/ClientShipments.vue)
**Line count:** 321
**Migration wave:** Wave 2 (client portal)
**Risk level:** medium (read-only; no pricing data; `show_shipping` enforced at backend — G-002 CLOSED 2026-04-21; frontend route guard for `show_shipping` still absent)

---

## Purpose (one sentence)

Shipment tracking page showing the authenticated client's orders in three groups — Active, Upcoming, and Completed — with expandable per-order cards revealing animated route visualisation, sailing phase progress, vessel/container details, and a loaded-items table.

---

## Layout (top→bottom, left→right, exhaustive)

### Outer container
`p-6 max-w-6xl mx-auto` — rendered inside `ClientLayout`'s `<router-view />` slot.

**Zone 1 — Header row** (`flex items-center justify-between mb-6`)
- `h1` "Shipment Tracking" (`text-2xl font-bold text-slate-800`)
- `p` "Track your orders from port to doorstep" (`text-sm text-slate-400`)
- No action buttons.

**Zone 2 — Loading state** (`v-if="loading"`)
- Centred: `pi-spinner pi-spin text-2xl` + "Loading shipments..." (`text-sm`).

**Zone 3 — Global empty state** (`v-else-if="orders.length === 0"`)
- Centred: blue/cyan gradient circle with `pi-send text-3xl text-blue-400`.
- `h2` "No active shipments" + `p` subtitle "Once your orders are booked, live tracking will appear here."

**Zone 4 — Content area** (`v-else space-y-8`)

**Sub-zone 4a — Active Shipments** (`v-if="activeShipments.length"`)
- Section row: pulsing blue dot (`w-2 h-2 rounded-full bg-blue-500 animate-pulse`) + uppercase "ACTIVE SHIPMENTS" label + blue count badge.
- Per-order card (`v-for order in activeShipments`): white `rounded-xl border shadow-sm`, `ring-2 ring-blue-200` when expanded, `hover:shadow-md` otherwise.
  - **Card header** (clickable `@click="toggle(order.id)"`):
    - Left: blue circle `pi-send` icon | `h3` `order.order_number` (bold) + `p` `order.po_reference` + item count (`text-xs text-slate-400`).
    - Right: status badge (`labels[order.status] || order.status`, `colors[order.status]`) + `pi-chevron-up/down`.
  - **Mini 4-step phase stepper** (Booked → Loaded → In Transit → Arrived): filled emerald dot with check when complete, outlined emerald ring when current, slate when future.
  - **Expanded detail** (`v-if="expandedId === order.id"`), or "Details loading..." when `ships(order.id)` is empty:
    - **Route visualisation**: blue/cyan gradient box — origin port (left, `pi-upload`) + animated horizontal progress bar with `pi-send` vessel icon positioned at 15% / 55% / 95% for LOADED / SAILED / ARRIVED + destination port (right, `pi-download`). ETD/ATD below left; ETA/ATA below right.
    - **Sailing Progress Panel**: container_type badge + route heading; horizontal progress bar (0% / 33% / 66% / 100% for no-phase / LOADED / SAILED / ARRIVED); 3 phase cards (Loaded / Sailed / Arrived) each showing completion date or status copy.
    - **Details grid** (2–4 cols): Vessel (+ voyage_number) | Container (+ container_type) | B/L Number | Items Loaded (product count + unit sum).
    - **Items in Container table**: "Items in Container" header bar; columns: Product (code + name) | Ordered | Loaded.

**Sub-zone 4b — Upcoming** (`v-if="upcomingShipments.length"`)
- Section row: cyan dot + uppercase "UPCOMING" + cyan count badge.
- Per-order card: `pi-calendar text-cyan-600` icon; "Preparing" cyan badge.
  - Expanded: 4-col grid (Container Type / Route / Est. Departure / Est. Arrival), or "Container booking in progress — details coming soon." placeholder if no shipment records.

**Sub-zone 4c — Completed** (`v-if="completedShipments.length"`)
- Section row: emerald dot + uppercase "COMPLETED" + emerald count badge.
- Per-order card: `pi-check-circle text-emerald-600` icon; 80% opacity until expanded/hovered.
  - Expanded: grid (Vessel / Container / Route / Arrived date), or "No shipment data recorded." placeholder.

---

## Data displayed

| Field | Source | Format | Notes |
|---|---|---|---|
| `order.order_number` | `ordersApi.list()` | bold string | Card header |
| `order.po_reference` | `ordersApi.list()` | plain string | Sub-header, may be empty |
| `order.item_count` | `ordersApi.list()` | integer | Sub-header, fallback `0` |
| `order.status` | `ordersApi.list()` → `labels` map | badge, `colors` map | `AFTER_SALES` and `COMPLETED` absent from `labels`/`colors` — render as raw enum string with default `bg-emerald-100` badge |
| `s.port_of_loading` | `shipmentsApi.list()` | plain string | Fallback `'Origin'` |
| `s.port_of_discharge` | `shipmentsApi.list()` | plain string | Fallback `'Destination'` |
| `s.etd` | `shipmentsApi.list()` | `fmtDate()` → `dd MMM yyyy` | Conditional — shown if present |
| `s.atd` | `shipmentsApi.list()` | `fmtDate()` | Conditional |
| `s.eta` | `shipmentsApi.list()` | `fmtDate()` | Conditional |
| `s.ata` | `shipmentsApi.list()` | `fmtDate()` | Conditional |
| `s.phase \|\| s.sailing_phase` | `shipmentsApi.list()` | drives progress bar % and phase card states | Field name ambiguous — two names tried; canonical unknown. See Known quirks. |
| `s.container_type` | `shipmentsApi.list()` | plain string | Badge in Sailing Progress Panel header |
| `s.vessel_name` | `shipmentsApi.list()` | plain string | Conditional details grid cell |
| `s.voyage_number` | `shipmentsApi.list()` | plain string | Sub-label under vessel; conditional |
| `s.container_number` | `shipmentsApi.list()` | plain string | Conditional details grid cell |
| `s.bl_number` | `shipmentsApi.list()` | plain string | Conditional details grid cell |
| `s.items` (array) | `shipmentsApi.list()` | count + `allocated_qty` sum | "Items Loaded" grid cell |
| `item.product_code` | nested in `s.items` | monospace `text-xs` | Items in Container table |
| `item.product_name` | nested in `s.items` | plain string | Items in Container table |
| `item.ordered_qty` | nested in `s.items` | integer | Items in Container table |
| `item.allocated_qty` | nested in `s.items` | integer bold | Items in Container table |
| `s.loading_date` | `shipmentsApi.list()` | `fmtDate()` | Fallback in Loaded phase card: `s.atd \|\| s.loading_date` |

**Pricing fields:** none rendered or transmitted on this page.

---

## Interactions (every clickable/typeable element)

| Trigger | Action | API call | Result |
|---|---|---|---|
| Page mount (`onMounted`) | `loadShipments()` | `GET /api/orders/?limit=50` then N × `GET /api/shipping/orders/{id}/shipments/` in parallel | All orders and all shipment records loaded eagerly into state |
| Click order card header | `toggle(order.id)` | None — data already loaded | Toggles `expandedId`; expands or collapses the card |

No search, filter, refresh, or navigation interactions in this component.

---

## Modals/dialogs triggered

None.

---

## API endpoints consumed

| Method | Path | Module | Notes |
|---|---|---|---|
| GET | `/api/orders/?limit=50` | `ordersApi.list` | Returns all client orders; CLIENT RLS scoped by `current_user.client_id`. Filtered client-side to `SHIPPING_STATUSES`. |
| GET | `/api/shipping/orders/{order_id}/shipments/` | `shipmentsApi.list` | Per-order shipment detail. **G-002 CLOSED 2026-04-21:** `portal_permissions.show_shipping` enforced for CLIENT callers — False → 403. |

`ordersApi.list` resolves first; then N `shipmentsApi.list` calls fire concurrently via `Promise.all` for every matching order.

---

## Composables consumed

None. `ordersApi` and `shipmentsApi` imported directly from `../../api`.

---

## PrimeVue components consumed

None. All UI is hand-rolled Tailwind + PrimeIcons icon classes (`pi-send`, `pi-spinner pi-spin`, `pi-calendar`, `pi-check-circle`, `pi-chevron-up`, `pi-chevron-down`, `pi-upload`, `pi-download`, `pi-arrow-right`, `pi-info-circle`, `pi-check`).

---

## Local state

| Name | Type | Initial | Purpose |
|---|---|---|---|
| `orders` | `ref([])` | `[]` | Orders filtered to `SHIPPING_STATUSES` |
| `shipmentData` | `ref({})` | `{}` | Map `order_id → shipments[]` populated after fan-out |
| `loading` | `ref(true)` | `true` | Global loading gate |
| `expandedId` | `ref(null)` | `null` | Currently expanded order ID (single-accordion — scalar, not Set) |

**Computed values:**

| Name | Derives from | Purpose |
|---|---|---|
| `activeShipments` | `orders` | Filter: LOADED, SAILED, ARRIVED |
| `upcomingShipments` | `orders` | Filter: BOOKED only |
| `completedShipments` | `orders` | Filter: CUSTOMS_FILED, CLEARED, DELIVERED, AFTER_SALES, COMPLETED |

No `watch` or `onUnmounted`.

---

## Permissions / role gating

**Portal permission:** `show_shipping`

**Frontend enforcement:** None. No route guard in `router/index.js` and no `portalPerms` check in the component. A CLIENT with `show_shipping=False` can navigate to `/client-portal/shipments` directly.

**Backend enforcement (G-002 CLOSED 2026-04-21):** `GET /api/shipping/orders/{order_id}/shipments/` now checks `portal_permissions.show_shipping` for CLIENT callers — False → 403. `ordersApi.list` is not gated by `show_shipping`; it uses standard CLIENT RLS only.

**Residual gap:** With no route guard, a CLIENT with `show_shipping=False` sees the page shell and their order cards (because `ordersApi.list` is ungated). Expanding a card triggers `shipmentsApi.list` which returns 403; that error is silently swallowed, leaving the card in a permanent "Details loading…" state. The page is misleading but leaks no shipment data.

**Migration requirement (Wave 0):** Add `show_shipping` route guard to `/client-portal/shipments` in `router/index.js` before production rollout of the new frontend.

---

## Bilingual labels (Tamil + English pairs)

All strings are English-only, hardcoded in the template. No i18n infrastructure.

| String | Location | Type | `en` | `ta` |
|---|---|---|---|---|
| Page title | `<h1>` | PortalString | "Shipment Tracking" | "" |
| Page subtitle | `<p>` | PortalString | "Track your orders from port to doorstep" | "" |
| Loading copy | template | PortalString | "Loading shipments…" | "" |
| Empty heading | `<h2>` | PortalString | "No active shipments" | "" |
| Empty body | `<p>` | PortalString | "Once your orders are booked, live tracking will appear here." | "" |
| Section label: Active | `<h2>` | PortalString | "Active Shipments" | "" |
| Section label: Upcoming | `<h2>` | PortalString | "Upcoming" | "" |
| Section label: Completed | `<h2>` | PortalString | "Completed" | "" |
| Phase: Booked | `phases` array | PortalString | "Booked" | "" |
| Phase: Loaded | `phases` array | PortalString | "Loaded" | "" |
| Phase: In Transit | `phases` array | PortalString | "In Transit" | "" |
| Phase: Arrived | `phases` array | PortalString | "Arrived" | "" |
| Phase card: Loaded | template | PortalString | "Loaded" | "" |
| Phase card: Sailed | template | PortalString | "Sailed" | "" |
| Phase card: Arrived | template | PortalString | "Arrived" | "" |
| Active card: no shipment | template | PortalString | "Details loading…" | "" |
| Upcoming: no shipment | template | PortalString | "Container booking in progress — details coming soon." | "" |
| Completed: no data | template | PortalString | "No shipment data recorded." | "" |
| Detail field: Vessel | template | PortalString | "Vessel" | "" |
| Detail field: Container | template | PortalString | "Container" | "" |
| Detail field: B/L Number | template | PortalString | "B/L Number" | "" |
| Detail field: Items Loaded | template | PortalString | "Items Loaded" | "" |
| Detail field: Est. Departure | template | PortalString | "Est. Departure" | "" |
| Detail field: Est. Arrival | template | PortalString | "Est. Arrival" | "" |
| Detail field: Route | template | PortalString | "Route" | "" |
| Detail field: Container Type | template | PortalString | "Container Type" | "" |
| Table header: Product | `<th>` | PortalString | "Product" | "" |
| Table header: Ordered | `<th>` | PortalString | "Ordered" | "" |
| Table header: Loaded | `<th>` | PortalString | "Loaded" | "" |

---

## Empty / error / loading states

| State | Trigger | Rendered to user? | Notes |
|---|---|---|---|
| Loading | `loading === true` | Yes — spinner + "Loading shipments…" | `loading` initialises `true`; set `false` in `finally` |
| Global empty | `orders.length === 0` after load | Yes — illustration + "No active shipments" | Shown only when all three sections are empty |
| Per-order shipment empty | `ships(order.id).length === 0` | Partially — **copy bug:** active orders show "Details loading…" even after the API has already returned empty | Upcoming orders show "Container booking in progress — details coming soon." which is accurate. Active orders should say "No shipment records." |
| Outer load failure | `catch (_) { /* ignore */ }` | No — **P-002**: silent swallow. User sees global empty state, not an error. | No error toast, no retry button |
| Per-order load failure | `.catch(() => ({ id, data: [] }))` | No — silently falls back to empty `[]` for that order | Indistinguishable from "no shipments" |

---

## Business rules (non-obvious)

- **Client-side status filter with hard limit:** The component fetches up to 50 orders and filters to `SHIPPING_STATUSES` client-side. If a client has more than 50 total orders, orders beyond position 50 are silently absent from the shipment view even if they are actively in transit. `limit: 50` is not user-adjustable.
- **Single accordion:** Only one order can be expanded at a time. `expandedId` is a scalar ref — toggling a second card collapses the first. Contrast with `ClientAfterSales.vue` which uses a `Set` and allows multi-expand.
- **Hardcoded progress animation:** The animated vessel icon on the route line uses hardcoded widths (LOADED=15%, SAILED=55%, ARRIVED=95%). Not derived from ETD/ETA. Purely cosmetic.
- **Phase field ambiguity:** The detail panel reads `s.phase || s.sailing_phase` throughout — two different field names tried for the same concept. This suggests the API field was renamed at some point and the component was not fully updated, or both fields co-exist in different shipment records. [UNCLEAR — verify the authoritative field name in `_serialize_shipment()` in `backend/routers/shipping.py`.]
- **Fan-out pattern:** `shipmentData` is populated by N parallel queries after the orders list resolves. This is N+1 at the HTTP level. In the current Vue app this is acceptable; in the Next.js rebuild this maps to a parent `useQuery` + N dependent queries, or a single batch endpoint if one can be added to the backend.
- **Eager loading:** All shipment records for all matching orders are fetched on mount. Expand/collapse is purely client-side — no lazy loading per card.

---

## Known quirks

- **"Details loading…" copy bug:** Active orders with no shipment records (API returned empty array) continue to show "Details loading…" — the same text used during the actual fetch. Should read "No shipment records." to avoid implying a pending load.
- **`AFTER_SALES` / `COMPLETED` missing from display maps:** Both statuses are present in `SHIPPING_STATUSES` (orders render in `completedShipments`), but neither appears in the `labels` or `colors` lookup objects. Orders in these statuses display the raw enum string (`"AFTER_SALES"`, `"COMPLETED"`) with a default `bg-emerald-100 text-emerald-700` badge.
- **Phase field ambiguity (`s.phase || s.sailing_phase`):** The same two-field fallback is repeated in the progress bar width, the percentage display, and all three phase card conditionals. The canonical field name in the backend serialiser is unresolved; one of the two names is likely stale.
- **No error feedback:** A network failure on either `ordersApi.list` or any `shipmentsApi.list` call is silently swallowed — the user sees no toast, no retry button, and no indication that data may be incomplete.

---

## Dead code / unused state

`AFTER_SALES` and `COMPLETED` are present in `SHIPPING_STATUSES` and render in `completedShipments`, but both are **absent from the `labels` and `colors` maps**. Orders in those statuses display the raw enum string (`"AFTER_SALES"`, `"COMPLETED"`) and fall back to the `'bg-emerald-100 text-emerald-700'` default colour. Not dead code — these orders render — but the display is degraded.

---

## Duplicate or inline utilities

- **`fmtDate(d)`** — defined inline at line 64. Duplicates `formatDate` exported from `frontend/src/utils/formatters.js`. **P-001.**
- **`labels` / `colors` status maps** — inline lookup tables. No shared equivalent in utils. Should be extracted to a shared order-status constants module for the Next.js rebuild; the same status-to-label and status-to-colour mappings likely appear in `ClientOrderDetail.vue` and other order-aware views.

---

## Migration notes / open questions

1. **Route guard required (Wave 0 blocker):** Add `show_shipping` check to `/client-portal/shipments` in `router/index.js`.
2. **Fix "Details loading…" copy:** For active orders where the shipment API has returned with no records, replace with "No shipment records." to avoid implying a pending load.
3. **Extend `labels` and `colors` maps:** Add `AFTER_SALES` and `COMPLETED` entries.
4. **Replace `fmtDate` with `formatDate`:** Use `frontend/src/utils/formatters.js:formatDate` (or its Next.js equivalent).
5. **Resolve phase field ambiguity:** Read `_serialize_shipment()` in `shipping.py` to determine canonical field name (`phase` or `sailing_phase`). Use the single name in the Next.js SDK type.
6. **Backend status filter:** Move `SHIPPING_STATUSES` filter to the server to avoid the 50-order client-side limit silently dropping in-transit orders.
7. **N+1 fan-out:** Consider a `/api/shipping/orders/batch-shipments/` endpoint or restructuring the orders list response to embed shipment summaries, eliminating the per-order fan-out.
