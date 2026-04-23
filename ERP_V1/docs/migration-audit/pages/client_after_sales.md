# Page Profile 8 of 9 — `client_after_sales.md`

**Type:** page
**Portal:** client (`/client-portal/*` — `user_type === 'CLIENT'`)
**Route:** `/client-portal/after-sales` → `ClientAfterSales`
**Vue file:** [frontend/src/views/client/ClientAfterSales.vue](../../../frontend/src/views/client/ClientAfterSales.vue)
**Line count:** 367
**Migration wave:** Wave 2 (client portal)
**Risk level:** medium (read-only; claim_value visible — client's own claim data; `show_after_sales` enforced at backend — G-003 CLOSED 2026-04-21; frontend route guard still absent)

---

## Purpose (one sentence)

After-sales claims for the authenticated client, grouped by order in a collapsible multi-accordion, with aggregate summary cards and per-claim detail including issue type, quantities, carry-forward stepper, and a hover tooltip for in-flight destination orders.

---

## Layout (top→bottom, left→right, exhaustive)

### Outer container
`p-6 max-w-6xl mx-auto` — rendered inside `ClientLayout`'s `<router-view />` slot.

**Zone 1 — Header row** (`flex items-center justify-between mb-6`)
- Left: `h1` "After-Sales Claims" (`text-2xl font-bold text-slate-800`) + `p` subtitle ("Track your product issues and resolutions across all orders", `text-sm text-slate-500`).
- Right: Refresh button (`pi-refresh` icon, `pi-spin` class applied while `loading`, `disabled` while loading, `text-sm border border-slate-200 rounded-lg`).

**Zone 2 — Loading state** (`v-if="loading"`)
- Centred: `pi-spinner pi-spin text-2xl` + "Loading claims..." (`text-sm`).

**Zone 3 — Summary cards** (shown when `claims.length > 0`, `grid grid-cols-2 md:grid-cols-5 gap-3 mb-6`)
5 cards, each `bg-white rounded-xl border`:
| Card | Left border accent | Label | Value |
|---|---|---|---|
| Total Claims | none | "Total Claims" | `summary.total` (slate-800) |
| Open | amber-400 | "Open" + "Awaiting review" sub-label | `summary.open` (amber-700) |
| In Progress | blue-400 | "In Progress" + "Being reviewed" | `summary.in_progress` (blue-700) |
| Resolved | emerald-400 | "Resolved" + "Completed" | `summary.resolved` (emerald-700) |
| Claim Value | rose-400 | "Claim Value" + "Total affected" | `formatINR(summary.total_value)` (rose-700) |

**Zone 4 — Accordion** (`space-y-3`, `v-for group in orderGroups`)
Per-order card: white `rounded-xl border shadow-sm`.
- **Order header** (clickable `@click="toggleOrder(group.order_id)"`):
  - Left: emerald file icon (`pi-file`) | `h3` `group.order_number` (bold) + claim count + status mini-badges (amber "N Open" / blue "N In Progress" / emerald "N Resolved", each conditional).
  - Right: "Claim Value" label + `formatINR(group.total_claim_value)` | "View Order" link button (navigates to `/client-portal/orders/{group.order_id}`, `@click.stop`) | `pi-chevron-up/down`.
- **Expanded detail table** (`v-if="expandedOrders.has(group.order_id)"`, `border-t border-slate-100`):
  - Columns (9): Product | Issue | Sent | Received | Claim Qty | Value | Resolution | Status | Progress
  - Per-claim row:
    - **Product**: `item.product_code` (monospace `text-[10px] text-slate-400`) + `item.product_name` (`text-xs text-slate-700`).
    - **Issue**: `issueIcon(item.objection_type)` + `issueColor(item.objection_type)` + `formatType(item.objection_type)`. Falls back to "—" if absent.
    - **Sent**: `item.sent_qty` (fallback `'—'`).
    - **Received**: `item.received_qty` (red bold if < `sent_qty`).
    - **Claim Qty**: `item.affected_quantity` (rose if > 0).
    - **Value**: `formatINR(item.claim_value)` (rose if > 0, else "—").
    - **Resolution**: `formatType(item.resolution_type)` in slate badge, fallback "Pending" (`text-slate-300`).
    - **Status**: `formatType(item.status)` in `statusColors` badge (OPEN=amber, IN_PROGRESS=blue, RESOLVED=emerald, CLOSED=slate).
    - **Progress**: 3-step carry-forward stepper (Pending → In Order → Fulfilled) when `stepperState(item) >= 0`; "—" otherwise. Stepper has CSS hover tooltip showing `item.added_to_order_number` + stage category + `orderStageLabel(item.added_to_order_status)` when `item.added_to_order_number` is present.
  - **Footer row** (`tfoot bg-slate-50`): "Order Total" (cols 1–4) | `group.total_claim_qty` | `formatINR(group.total_claim_value)`.

**Zone 5 — Empty state** (`v-else`, claims.length === 0 after load)
- Centred: emerald `w-16 h-16` circle + `pi-check-circle text-2xl text-emerald-500`.
- `h2` "No active claims" + `p` explanatory text.

---

## Data displayed

| Field | Source | Format | Notes |
|---|---|---|---|
| `summary.total` | computed from `claims` | integer | Total Claims summary card |
| `summary.open` | computed from `claims` | integer | Open summary card |
| `summary.in_progress` | computed from `claims` | integer | In Progress summary card |
| `summary.resolved` | computed from `claims` | integer | Resolved summary card |
| `summary.total_value` | computed from `claims` | `formatINR()` (INR ₹) | Claim Value summary card |
| `group.order_number` | `afterSalesApi.list()` | plain string | Accordion header; fallback `'-'` |
| `group.items.length` | computed | integer + "claim(s)" | Accordion header |
| `group.open / in_progress / resolved` | computed per group | integer mini-badges | Accordion header, each conditional |
| `group.total_claim_value` | computed per group | `formatINR()` | Accordion header |
| `item.product_code` | `afterSalesApi.list()` | monospace `text-[10px]` | Detail table column |
| `item.product_name` | `afterSalesApi.list()` | `text-xs` | Detail table column |
| `item.objection_type` | `afterSalesApi.list()` → `issueIcon()` / `issueColor()` / `formatType()` | icon + coloured label | Issue column; "—" if absent |
| `item.sent_qty` | `afterSalesApi.list()` | integer | Fallback `'—'` |
| `item.received_qty` | `afterSalesApi.list()` | integer | Red bold if < `sent_qty` |
| `item.affected_quantity` | `afterSalesApi.list()` | integer | Rose when > 0 |
| `item.claim_value` | `afterSalesApi.list()` | `formatINR()` | [UNCLEAR] — pre-computed by backend serialiser or derived from `selling_price_inr × affected_quantity`? Verify in `_serialize_item()` in `aftersales.py` |
| `item.resolution_type` | `afterSalesApi.list()` → `formatType()` | slate pill badge | Fallback "Pending" |
| `item.status` | `afterSalesApi.list()` → `formatType()` + `statusColors` | coloured pill badge | OPEN / IN_PROGRESS / RESOLVED / CLOSED |
| `item.carry_forward_status` | `afterSalesApi.list()` | drives `stepperState()` | PENDING / ADDED_TO_ORDER / FULFILLED |
| `item.added_to_order_number` | `afterSalesApi.list()` | plain string | Hover tooltip only; conditional |
| `item.added_to_order_status` | `afterSalesApi.list()` → `orderStageLabel()` + `stageCategory()` | stage label + category | Hover tooltip only; [UNCLEAR] whether always populated for all carry-forward states |
| `group.total_claim_qty` | computed per group | integer | Footer row |

**Pricing fields:** `claim_value` (INR) is intentionally rendered — this is the client's own claim value, not factory cost data. `factory_price` and `factory_markup_percent` are not present.

---

## Interactions (every clickable/typeable element)

| Trigger | Action | API call | Result |
|---|---|---|---|
| Page mount (`onMounted`) | `loadClaims()` | `GET /api/aftersales/?limit=200` | `claims` populated; `summary` + `orderGroups` computed |
| Click "Refresh" button | `loadClaims()` | `GET /api/aftersales/?limit=200` | `claims` reloaded; button shows `pi-spin` while loading |
| Click order group header | `toggleOrder(group.order_id)` | None | `expandedOrders` Set updated; accordion expands or collapses |
| Click "View Order" button | `goToOrder(group.order_id)` (`@click.stop`) | None | Navigate to `/client-portal/orders/{group.order_id}` |
| Hover stepper row (CSS `group-hover`) | — | None | Tooltip appears if `item.added_to_order_number` is set; shows destination order number + stage |

---

## Modals/dialogs triggered

None.

---

## API endpoints consumed

| Method | Path | Module | Notes |
|---|---|---|---|
| GET | `/api/aftersales/?limit=200` | `afterSalesApi.list` | **G-003 CLOSED 2026-04-21:** enforces `portal_permissions.show_after_sales` for CLIENT callers — False → 403. CLIENT RLS also scopes results to `current_user.client_id`. |

---

## Composables consumed

- **`useRouter`** (`vue-router`) — used by `goToOrder(orderId)` to navigate to the order detail page. No other write operations.

---

## PrimeVue components consumed

None. All UI is hand-rolled Tailwind + PrimeIcons icon classes (`pi-refresh`, `pi-spinner pi-spin`, `pi-file`, `pi-chevron-up`, `pi-chevron-down`, `pi-check-circle`, `pi-box`, `pi-exclamation-triangle`, `pi-flag`, `pi-calculator`, `pi-info-circle`, `pi-clock`, `pi-shopping-cart`, `pi-check`).

---

## Local state

| Name | Type | Initial | Purpose |
|---|---|---|---|
| `claims` | `ref([])` | `[]` | Flat list of after-sales items returned from API |
| `loading` | `ref(true)` | `true` | Global loading gate |
| `expandedOrders` | `ref(new Set())` | `new Set()` | Set of expanded order IDs (multi-accordion) |

**Computed values:**

| Name | Derives from | Purpose |
|---|---|---|
| `orderGroups` | `claims` | Groups claims by `c.order_id \|\| c.order_number \|\| 'unknown'`; accumulates per-group counts (open / in_progress / resolved) and total claim qty/value |
| `summary` | `claims` | Totals across all claims: count, status breakdown, `total_value` |

No `watch` or `onUnmounted`.

---

## Permissions / role gating

**Portal permission:** `show_after_sales`

**Frontend enforcement:** None. No route guard in `router/index.js` and no `portalPerms` check in the component.

**Backend enforcement (G-003 CLOSED 2026-04-21):**
- `GET /api/aftersales/` (`list_all_aftersales`) — `portal_permissions.show_after_sales` checked for CLIENT callers; False → 403.
- `GET /api/aftersales/client/orders/{id}/` (`client_get_aftersales`) — same enforcement added.

**Migration requirement (Wave 0):** Add `show_after_sales` route guard to `/client-portal/after-sales` in `router/index.js` before production rollout.

---

## Bilingual labels (Tamil + English pairs)

All strings are English-only, hardcoded in the template. No i18n infrastructure.

| String | Location | Type | `en` | `ta` |
|---|---|---|---|---|
| Page title | `<h1>` | PortalString | "After-Sales Claims" | "" |
| Page subtitle | `<p>` | PortalString | "Track your product issues and resolutions across all orders" | "" |
| Refresh button | `<button>` | PortalString | "Refresh" | "" |
| Loading copy | template | PortalString | "Loading claims…" | "" |
| Summary card: Total Claims | template | PortalString | "Total Claims" | "" |
| Summary card: Open | template | PortalString | "Open" | "" |
| Summary card: sub-label | template | PortalString | "Awaiting review" | "" |
| Summary card: In Progress | template | PortalString | "In Progress" | "" |
| Summary card: sub-label | template | PortalString | "Being reviewed" | "" |
| Summary card: Resolved | template | PortalString | "Resolved" | "" |
| Summary card: sub-label | template | PortalString | "Completed" | "" |
| Summary card: Claim Value | template | PortalString | "Claim Value" | "" |
| Summary card: sub-label | template | PortalString | "Total affected" | "" |
| Table header: Product | `<th>` | PortalString | "Product" | "" |
| Table header: Issue | `<th>` | PortalString | "Issue" | "" |
| Table header: Sent | `<th>` | PortalString | "Sent" | "" |
| Table header: Received | `<th>` | PortalString | "Received" | "" |
| Table header: Claim Qty | `<th>` | PortalString | "Claim Qty" | "" |
| Table header: Value | `<th>` | PortalString | "Value" | "" |
| Table header: Resolution | `<th>` | PortalString | "Resolution" | "" |
| Table header: Status | `<th>` | PortalString | "Status" | "" |
| Table header: Progress | `<th>` | PortalString | "Progress" | "" |
| Resolution: fallback | template | PortalString | "Pending" | "" |
| Stepper: Pending | `STEPPER_STEPS` | PortalString | "Pending" | "" |
| Stepper: In Order | `STEPPER_STEPS` | PortalString | "In Order" | "" |
| Stepper: Fulfilled | `STEPPER_STEPS` | PortalString | "Fulfilled" | "" |
| Empty heading | `<h2>` | PortalString | "No active claims" | "" |
| Empty body | `<p>` | PortalString | "If you experience any issues with delivered products, you can submit a claim from the order detail page." | "" |
| Footer row: Order Total | `<td>` | PortalString | "Order Total" | "" |

[UNCLEAR — `orderStageLabel()` and `stageCategory()` produce hardcoded stage labels ('Draft', 'Inquiry', 'Pricing', 'Production', 'Transit', 'Customs', 'Delivery', etc.) that appear in the stepper hover tooltip. These are portal-visible PortalString values not yet catalogued above. Raise with Sachin for D-005 Tamil review.]

---

## Empty / error / loading states

| State | Trigger | Rendered to user? | Notes |
|---|---|---|---|
| Loading | `loading === true` | Yes — spinner + "Loading claims…" | `loading` initialises `true` |
| Empty | `claims.length === 0` after load | Yes — "No active claims" illustration + explanatory text | Covers both genuine empty state and load failure — no distinction shown to user |
| Load failure | `catch (_e) { claims.value = [] }` | No — **P-002**: silently swallowed. User sees "No active claims" on network failure, not an error. | Refresh button is present but shows no failure feedback. |

---

## Business rules (non-obvious)

- **Grouping key fallback:** Claims group by `c.order_id || c.order_number || 'unknown'`. If `order_id` is null but `order_number` is set, and two claims share the same `order_number` but different `order_id` values, they will be incorrectly split into separate groups. Fragile if the API ever returns inconsistent data.
- **`limit: 200` hard cap:** All claims are fetched in a single request. No pagination. For clients with many orders and long after-sales histories this is a latency and scalability risk.
- **Multi-accordion:** `expandedOrders` is a `Set` — multiple order groups can be open simultaneously. Contrast with `ClientShipments.vue` which uses a scalar and allows only one.
- **Carry-forward tooltip:** The stepper shows a hover tooltip with `item.added_to_order_number` and `item.added_to_order_status` when the carry-forward is in progress or fulfilled. These fields come from the backend serialiser. [UNCLEAR] whether they are always populated for all carry-forward states — verify in `_serialize_item()` in `aftersales.py`.
- **`claim_value` source:** The template renders `item.claim_value` directly. [UNCLEAR] whether this field is pre-computed by the backend serialiser or requires client-side calculation from `selling_price_inr × affected_quantity`. Important for the Next.js SDK type definition — verify in `_serialize_item()`.

---

## Known quirks

- **`stepperState` returns 0 for RESOLVED claims without carry-forward:** When `status === 'RESOLVED'` and `carry_forward_status` is absent, `stepperState` returns `0` (Pending). This renders the "Pending" step as active for resolved claims that had no carry-forward (e.g. cash refunds). The `v-if="stepperState(item) >= 0"` gate does not filter this case because `0 >= 0` is true. Intent is [UNCLEAR] — see migration note 2.
- **Mis-grouping risk on null `order_id`:** Grouping key fallback `c.order_id || c.order_number || 'unknown'` can produce duplicate groups if `order_id` is null but `order_number` matches across different logical orders.
- **Hard limit with no pagination indicator:** `limit: 200` is silently truncating — there is no "showing N of total" indicator and no server-side pagination.
- **No error feedback:** `catch (_e) { claims.value = [] }` silently resets state. The Refresh button provides no indication of whether the last reload succeeded or failed.

---

## Dead code / unused state

`stepperState` returns `0` (maps to "Pending" stepper step) when `item.status === 'RESOLVED'` but `carry_forward_status` is absent. This renders the "Pending" step as active for resolved claims that have no carry-forward process. Intent is [UNCLEAR] — a resolved claim that was handled by refund (not replacement or carry-forward) arguably should not show a carry-forward stepper at all. The `v-if="stepperState(item) >= 0"` gate does not filter this case out because `stepperState` returns `0`, not `-1`.

---

## Duplicate or inline utilities

- **`formatINR(val)`** — defined inline at line 85. Duplicates `formatINR` exported from `frontend/src/utils/formatters.js`. **P-001 (third occurrence** — also in `ClientLedger.vue`).
- **`formatType(type)`** — inline string formatter (underscores → spaces, title-case). No equivalent in `formatters.js`. Appears to be used in multiple portal views; [UNCLEAR full scope — verify during CROSS_CUTTING pass].
- **`issueIcon(type)` / `issueColor(type)`** — inline display helpers keyed to `AfterSalesItem.objection_type` values. After-sales domain specific; no shared equivalent found.
- **`orderStageLabel(status)` / `stageCategory(status)`** — inline order-stage display maps. Almost certainly duplicated in `ClientOrderDetail.vue` and other order-aware views. Candidate for shared `order-status.ts` constants module. [UNCLEAR full scope.]
- **`STEPPER_STEPS` constant / `stepperState` function** — logically identical to the same definitions in `ClientReturnsPending.vue`. **New pattern P-005:** carry-forward stepper duplicated across at minimum two pages. Candidate for a shared `<CarryForwardStepper>` component.

---

## Migration notes / open questions

1. **Route guard required (Wave 0 blocker):** Add `show_after_sales` check to `/client-portal/after-sales` in `router/index.js`.
2. **Resolve `stepperState` ambiguity for RESOLVED items:** When `status === 'RESOLVED'` and `carry_forward_status` is absent, current behaviour shows "Pending" stepper step. Confirm with Sachin whether this is intentional or should show "—" (hidden stepper).
3. **Verify `claim_value` computation:** Read `_serialize_item()` in `aftersales.py` to confirm field source before defining the SDK type.
4. **Extract `<CarryForwardStepper>` component:** `STEPPER_STEPS` + `stepperState` are identical to `ClientReturnsPending.vue`. Extract to a shared component. See P-005.
5. **Extract shared display utilities:** `formatINR` → `utils/formatters.js`. `formatType`, `orderStageLabel`, `stageCategory` → shared order-status/display constants module.
6. **Add error state:** Replace the silent `catch` with a user-visible error (inline banner or toast). The Refresh button should indicate failure when it occurs.
7. **Pagination:** Consider paginated or virtualised list for clients with large after-sales histories. The current 200-item hard limit with no server-side pagination is a latency risk.
8. **Bilingual gap — tooltip stage labels:** `orderStageLabel()` and `stageCategory()` produce hardcoded English stage labels that appear in the stepper hover tooltip. These require Tamil translations and should be added to the bilingual catalogue before Wave 2 ships (D-005).
