# Profile: ordertab_dashboard

## Metadata
- **Source file:** `frontend/src/components/order/OrderDashboardTab.vue`
- **Lines:** 552
- **Type:** component (sub-tab)
- **Portal:** internal
- **Tab slug:** `dashboard`
- **Parent shell:** `OrderDetail.vue`
- **Wave:** Wave 8
- **Profile generated:** 2026-04-22

---

## Purpose

Read-only executive summary tab for an order. Aggregates payment, shipment, customs, and carry-forward data into a single visual dashboard. No mutations — the tab only calls read APIs on mount and renders derived statistics. Designed for quick status assessment without navigating sub-tabs.

---

## Layout / visual structure

```
┌──────────────────────────────────────────────────────────────┐
│ 3-column dark hero card                                      │
│  [Client Payment ring SVG]  [Factory & Costs]  [Order Prog] │
├──────────────────────────────────────────────────────────────┤
│ Shipment Tracker                                             │
│  Animated ship route: Origin → Port → Destination           │
│  Per-shipment: container no., ETD, ETA, status badge        │
├──────────────────────────────────────────────────────────────┤
│ Customs & Duty                                               │
│  BOE value flow: FOB → CIF → AV → Total Duty → IGST        │
│  One row per shipment that has a BOE entry                   │
├──────────────────────────────────────────────────────────────┤
│ Carried Forward Items                                        │
│  Lists items with notes matching carry-forward patterns      │
│  Badges: Unloaded (amber) / After-Sales (rose)              │
└──────────────────────────────────────────────────────────────┘
```

---

## Data displayed

| Section | Fields rendered |
|---|---|
| Client payment ring | `cs.pi_total_inr`, `cs.total_paid_inr`, `cs.balance_inr`, `cs.paid_percent` (SVG arc) |
| Factory & Costs | `fs.factory_total_inr`, `fs.factory_total_cny`, `fs.total_paid_inr`, `estProfit` (computed) |
| Order progress | `order.status`, `order.stage_number`, `order.item_count`, `order.reopen_count` |
| Shipment tracker | `shipments[].container_number`, `etd`, `eta`, `status`, animated CSS route |
| Customs per shipment | `boe.fob_value`, `boe.cif_value`, `boe.assessable_value`, `boe.total_duty`, `boe.igst_amount` |
| Carried forward | `order.items[]` filtered by `getCarryForwardInfo(item)` — parses `item.notes` strings |

---

## Interactions

This tab is entirely read-only:
- `onMounted`: `Promise.all([paymentsApi.list, paymentsApi.factoryList, shipmentsApi.list])` — parallel fetch
- Per-shipment: `customsApi.getBoe(shipment.id)` called in sequence after shipments load
- No user mutation actions; no emit calls to parent
- No search, filter, or sort inputs

---

## Modals / dialogs triggered

None. The dashboard tab contains no interactive dialogs.

---

## API endpoints consumed

| Endpoint | Method | Purpose |
|---|---|---|
| `GET /api/payments/?order_id={id}` | paymentsApi.list | Client payment summary |
| `GET /api/payments/factory/?order_id={id}` | paymentsApi.factoryList | Factory payment summary |
| `GET /api/shipments/?order_id={id}` | shipmentsApi.list | Shipment list for tracker |
| `GET /api/customs/boe/{shipment_id}/` | customsApi.getBoe | BOE data per shipment (N calls) |

Note: `customsApi.getBoe` is called once per shipment — N+1 pattern. If an order has 5 shipments, 5 sequential BOE fetches occur after the shipment list loads. No batching or consolidation.

---

## Composables consumed

None directly. Props provide all order data. No `useAuth` call — role checks are implicit (tab is visible to all INTERNAL roles as the first tab).

---

## PrimeVue components consumed

PrimeVue Icons (`pi-*`) used for iconography. No PrimeVue interactive components (forms, overlays, tables) observed in this tab.

---

## Local state

```javascript
const cs = ref({})           // Client payment summary object
const fs = ref({})           // Factory payment summary object
const shipments = ref([])
const boeData = ref({})      // Map: shipment.id → BOE object
const loading = ref(true)

const estProfit = computed(() => {
  const pi = cs.value.pi_total_inr || 0
  const factory = fs.value.factory_total_inr || 0  // [D-004 concern — see Quirks]
  const duty = totalDuty.value || 0
  return pi - factory - duty
})
const totalDuty = computed(() => ...)  // Sum of boe.total_duty across shipments

// Inline formatters (P-001 instances):
const fmt = (v) => { ... }      // currency formatting
const fmtLakh = (v) => { ... }  // lakh-unit formatting
const fmtDate = (d) => { ... }  // date formatting

// Carry-forward detection:
function getCarryForwardInfo(item) {
  // Parses item.notes: "Carried from ORD-xxx" → { type: 'unloaded', from: 'ORD-xxx' }
  //                    "After-Sales (...) from ORD-xxx" → { type: 'aftersales', from: 'ORD-xxx' }
}
```

---

## Permissions / role gating

No role gate in this component. The tab is visible to all INTERNAL roles because `availableTabs` always includes `dashboard` regardless of role.

**D-010 RATIFIED 2026-04-22:** OPERATIONS cannot see `estProfit` (factory cost exposure via `factory_total_inr`). The Factory & Costs panel must be hidden for OPERATIONS in the Next.js rebuild. Backend is authoritative — **backend patch APPLIED 2026-04-22** (`finance.py` `list_payments()`: six factory cost fields in `summary` are `null` for OPERATIONS callers); frontend gate is defence-in-depth (Wave 0 frontend task remaining).

**Props received:**
```javascript
const props = defineProps({
  orderId: String,
  order: Object,
  timeline: Object    // Passed from shell for order-progress section
})
```

---

## Bilingual labels (InternalString)

None. All labels English-only.

---

## Empty / error / loading states

- **Loading:** `loading` ref controls visibility of content sections; spinner shown while `Promise.all` resolves.
- **No shipments:** Shipment tracker section collapses or shows placeholder text if `shipments.length === 0`.
- **No BOE data:** Customs section hidden per-shipment if `boeData[s.id]` is absent.
- **No carry-forward items:** Carried Forward section hidden if no items match the note-parsing pattern.
- **API error:** No explicit error state observed; failed fetches may silently leave sections empty. Raw `e.response.data.detail` logging in console (P-002 pattern; not surfaced to user).

---

## Business rules

1. **Parallel mount fetches**: Client payments, factory payments, and shipments are fetched in `Promise.all`. Per-shipment BOE calls follow serially after shipment list resolves.
2. **Profit estimate formula**: `estProfit = PI total (INR) − factory total (INR) − total customs duty`. This is a rough estimate; does not account for shipping costs, freight, or other overhead.
3. **Carry-forward detection**: Reads `item.notes` text using string pattern matching. This is brittle — any change to the note template in the backend will break detection silently.
4. **Timeline prop**: The `timeline` prop is passed from the shell (already fetched by `ordersApi.timeline`) and used for the Order Progress section. The tab does not re-fetch it.

---

## Known quirks / bugs

### Q-001 — D-004 concern: factory_total_inr rendered to OPERATIONS role — RESOLVED 2026-04-22 via D-010
```javascript
const estProfit = computed(() => {
  const factory = fs.value.factory_total_inr || 0   // factory cost aggregate
  return pi - factory - duty
})
```
`factory_total_inr` is the aggregate factory cost for the order. Per D-004, factory cost data is restricted to SUPER_ADMIN, FINANCE, and ADMIN roles. The Dashboard tab is visible to all INTERNAL roles including OPERATIONS (no role gate on the `dashboard` slug in `availableTabs`). OPERATIONS users currently see a computed profit figure that exposes the factory cost structure.

**RESOLVED 2026-04-22 via D-010:** OPERATIONS cannot see `estProfit`. Decision rationale: Scenario 2 (growing team, external hires expected) — margin visibility belongs with the finance function, not logistics execution.

Backend: Serialiser must strip `factory_total_inr` for OPERATIONS role callers on dashboard/payment-summary endpoints. Tracked in `SECURITY_BACKLOG.md` under D-010 Wave 0 backend tasks.

Frontend: DashboardTab must hide the Factory & Costs panel (estProfit row) when `current_user.role === 'OPERATIONS'`. Backend enforcement is the primary control; frontend is defence-in-depth. In the Next.js rebuild use `hasPermission(user, 'view_factory_real_pricing')` (D-004 matrix) — OPERATIONS is not in the allowed set.

### Q-002 — P-001: Inline formatter functions
```javascript
const fmt = (v) => { ... }
const fmtLakh = (v) => { ... }
const fmtDate = (d) => { ... }
```
Three formatting functions defined inline in this component. `formatCurrency` and `formatDate` exist in `utils/formatters.js`. These are P-001 (duplicate utilities) violations. The `fmtLakh` function may be a genuine new utility (lakh-unit display not found in formatters.js — unverified).

### Q-003 — N+1 BOE fetch pattern
`customsApi.getBoe(shipment.id)` called per shipment in a loop. For an order with N shipments, N sequential GET requests hit the backend. No batching endpoint exists. For the typical case (1–3 shipments) this is acceptable, but orders with many shipments will produce serial waterfall fetches.

### Q-004 — Brittle carry-forward note parsing
Carry-forward type detection parses `item.notes` strings using pattern matching. The note format is generated by backend logic and not schema-enforced. If the backend note template changes (e.g., "Carried from" → "Carry forward from"), the detection silently fails and items lose their carry-forward badge.

---

## Dead code / unused state

None observed. All state refs are written and read. The `timeline` prop is passed but may be unused if the Order Progress section reads directly from `order.status` and `order.stage_number`.

---

## Duplicate or inline utilities

- `fmt`, `fmtLakh`, `fmtDate` — inline formatters. `fmt` and `fmtDate` are duplicates of `formatCurrency` / `formatDate` from `utils/formatters.js`. `fmtLakh` may be novel. All three should be moved to the shared formatters module or replaced with existing exports. (P-001 pattern)

---

## Migration notes

1. **D-010 RATIFIED 2026-04-22 — backend patch APPLIED:** OPERATIONS cannot see `estProfit`. Backend fix: `finance.py` `list_payments()` — six factory cost fields (`original_factory_total_cny/inr`, `revised_factory_total_cny/inr`, `factory_paid_inr`, `revised_factory_balance_inr`) are `null` for OPERATIONS callers (2026-04-22). In the Next.js rebuild, gate the Factory & Costs panel using `hasPermission(user, 'view_factory_real_pricing')` (D-004 permission matrix) as defence-in-depth (Wave 0 frontend task — see `SECURITY_BACKLOG.md` Task 3).
2. **Replace note-parsing with structured API data**: The carry-forward detection should use a structured field on the order item (e.g., `item.carry_forward_type: 'unloaded' | 'aftersales' | null`) rather than parsing `item.notes` text. Add this field to the Next.js SDK type and ensure the backend serializes it.
3. **N+1 → batch endpoint**: Add `GET /api/customs/boe/?shipment_ids=id1,id2,id3` to batch BOE lookups. The Next.js rebuild should use a single fetch for all BOE data.
4. **Inline formatters → shared**: Replace `fmt`, `fmtLakh`, `fmtDate` with imports from the shared formatting library. Define `formatLakh` in `utils/formatters` if not already present.
5. **SVG ring chart**: The client payment ring uses custom inline SVG. In Next.js, replace with a lightweight chart component (Recharts `RadialBarChart` or similar) to avoid maintaining custom SVG arc math.
6. **Server-side data aggregation**: In the Next.js rebuild, the dashboard data (payment summary, shipment list, BOE) should be fetched server-side in a single `GET /api/orders/{id}/dashboard/` endpoint returning all sections as one JSON object. Eliminates the 4-call (+ N BOE) waterfall.
