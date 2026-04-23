# Profile: ordertab_customs

## Metadata
- **Source file:** `frontend/src/components/order/CustomsTab.vue`
- **Lines:** 1,024
- **Type:** component (sub-tab)
- **Portal:** internal
- **Tab slug:** `customs`
- **Parent shell:** `OrderDetail.vue`
- **Wave:** Wave 8 Session C
- **Profile generated:** 2026-04-22

---

## Purpose

Manages Bill of Entry (BOE) creation and editing for customs duty calculation. One BOE form per shipment on the order. Displays per-shipment cards showing the current BOE (if any) and allows INTERNAL staff to create or update it. The core feature is a full client-side duty calculation engine: FOB → CIF → Assessment Value → per-part BCD + SWC + IGST. Items are populated from HSN code groups derived from the shipment's packing list. The tab is only visible when the order is at a customs-relevant stage.

---

## Layout / visual structure

```
┌───────────────────────────────────────────────────┐
│ Customs / Bill of Entry (indigo header)            │
│                                                    │
│ ┌─────────────────────────────────────────────┐   │
│ │ [40HC] Shanghai → Chennai   #TCKU1234567    │   │
│ │                          [FILED] [Edit BOE]  │   │
│ │                                              │   │
│ │ BE Number  BE Date  Exchange Rate  Parts     │   │
│ │                                              │   │
│ │ FOB  Freight  Insurance  CIF  Landing  AV   │   │
│ │                                              │   │
│ │ AV  BCD  SWC  IGST  TOTAL DUTY             │   │
│ │                                              │   │
│ │ Per-part table: Part | HSN | Qty | Price |  │   │
│ │  AV Share | BCD | SWC | IGST | Duty         │   │
│ │                                              │   │
│ │ [Balance Compensation section — purple]      │   │
│ └─────────────────────────────────────────────┘   │
│ (repeated per shipment)                            │
└───────────────────────────────────────────────────┘
```

Edit mode (activeShipmentId === shipment.id):
- Section 1: BOE Header (BE Number, BE Date, Port of Import, Exchange Rate, Status select)
- Section 2: Valuation (FOB auto, Freight editable, Insurance editable/default, CIF auto, Landing 1% auto, AV auto)
- Section 3: HSN picker (group cards) + manual HSN dialog + bulk rate bar + per-part duty table
- Section 4: Duty summary + validation warning + Save BOE / Cancel

---

## Data displayed

| Field | Source |
|---|---|
| Shipments | `shipments[]` from `shipmentsApi.list(orderId)` |
| BOE per shipment | `boeMap[shipmentId]` from `customsApi.getBoe(shipmentId)` |
| HSN groups + items | `hsnItemsMap[shipmentId]` from `customsApi.getHsnItems(shipmentId)` |
| Tariff rates | `tariffs[]` from `customsApi.listTariffs()` |
| Exchange rate (default) | `props.order.exchange_rate` |
| Freight (default) | `hsnItemsMap[shipmentId].freight_cost_inr` |
| Unit price per item | `part.unit_price_cny` from HSN items (see Q-001) |
| BOE status | `boeMap[shipmentId].status` (DRAFT / FILED / ASSESSED / DUTY_PAID / OOC) |
| Duty calculation | `calc` computed (FOB→CIF→AV→per-part duties) |

**BOE statuses:**

| Code | Label |
|---|---|
| DRAFT | Draft |
| FILED | Filed |
| ASSESSED | Assessed |
| DUTY_PAID | Duty Paid |
| OOC | Out of Charge |

---

## Interactions

| Action | Handler | API |
|---|---|---|
| Mount | `loadAll()` | `shipmentsApi.list()` + `customsApi.listTariffs()` (parallel), then per-shipment `getBoe()` + `getHsnItems()` |
| Start editing shipment BOE | `startBoe(shipment)` | — (populates form from `boeMap`) |
| Cancel edit | `cancelBoe()` | — |
| Toggle HSN picker | `showHsnPicker = !showHsnPicker` | — |
| Add HSN group | `addHsnGroup(group)` | — (local state mutation) |
| Add all HSN groups | `addAllHsn(shipmentId)` | — |
| Manual HSN confirm | `confirmManualHsn()` | — |
| Remove line item | `removeLineItem(idx)` | — |
| Select/deselect items | `toggleItem(idx)` | — |
| Bulk rate apply | `applyBulkRates()` | — |
| Save BOE | `saveBoe()` | `customsApi.createBoe(shipmentId, payload)` or `customsApi.updateBoe(boeId, payload)` |

---

## Modals / dialogs triggered

**Manual HSN Entry Dialog** (inline `<div class="fixed inset-0...">`, not PrimeVue Dialog):
- Triggered when `showManualHsn = true` (UNKNOWN HSN group selected or addAllHsn encounters unknown group)
- Shows up to 5 parts preview, input for HSN code, live tariff lookup hint
- Confirm → `confirmManualHsn()` | Cancel → `showManualHsn = false`

No other overlays. The HSN picker is an inline collapsible panel, not a modal.

---

## API endpoints consumed

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/shipments/?order_id={orderId}` | GET | List shipments for order |
| `/api/customs/tariffs/` | GET | Full tariff table by HSN code |
| `/api/customs/shipments/{shipmentId}/boe/` | GET | Get existing BOE (null if none) |
| `/api/customs/shipments/{shipmentId}/hsn-items/` | GET | HSN groups + items + freight |
| `/api/customs/shipments/{shipmentId}/boe/` | POST | Create new BOE |
| `/api/customs/boe/{boeId}/` | PUT | Update existing BOE |

`loadAll()` fetches shipments + tariffs in parallel first, then fans out to per-shipment `getBoe()` + `getHsnItems()` using `Promise.all(shipments.map(...))`. Correct pattern — no N+1.

---

## Composables consumed

None. Direct imports of `shipmentsApi` and `customsApi` from `../../api`.

---

## PrimeVue components consumed

PrimeVue Icons (`pi-*`) for iconography. No PrimeVue form, overlay, or data components.

---

## Local state

```javascript
const props = defineProps({
  orderId: { type: String, required: true },
  order: { type: Object, required: true },
})
const emit = defineEmits(['reload'])

// Data maps
const loading = ref(false)
const saving = ref(false)
const shipments = ref([])
const boeMap = ref({})          // shipmentId → BOE data | null
const hsnItemsMap = ref({})     // shipmentId → { freight_cost_inr, groups }
const tariffs = ref([])
const error = ref('')

// Active BOE form
const activeShipmentId = ref(null)
const boeForm = ref(null)
const lineItems = ref([])
const showHsnPicker = ref(false)

// Manual HSN dialog
const showManualHsn = ref(false)
const manualHsnCode = ref('')
const manualHsnGroup = ref(null)

// Bulk selection + rate change
const selectedItems = ref(new Set())
const bulkBcd = ref('')
const bulkIgst = ref('')
```

**Key computeds:**
```javascript
const isCustomsStage = computed(() => {
  const s = ['ARRIVED', 'CUSTOMS_FILED', 'CLEARED', 'DELIVERED',
    'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING']
  return s.includes(props.order?.status)
})

// Full duty calculation — reactive to all boeForm + lineItems changes
const calc = computed(() => {
  // 1. FOB = Σ (unit_price × exchange_rate × qty)
  // 2. CIF = FOB + freight + insurance (default: 1.125% of FOB)
  // 3. AV = CIF + landing (1% of CIF)
  // 4. Per-part: partAv = (partFob / totalFob) × AV
  //    BCD = partAv × bcd_rate%; SWC = BCD × swc_rate%; IGST = (partAv+BCD+SWC) × igst_rate%
})

const allItemsIncluded = computed(() => includedCount.value >= totalShipmentItems.value && totalShipmentItems.value > 0)
const physicalLineItems = computed(() => lineItems.value.filter(li => !li.is_compensation))
const compensationLineItems = computed(() => lineItems.value.filter(li => li.is_compensation))
```

---

## Permissions / role gating

No component-level role gate. All INTERNAL roles that can access the CustomsTab (as granted by the shell's `availableTabs`) can view BOEs, create BOEs, edit duty rates, and see unit prices (which originate from `unit_price_cny`).

---

## Bilingual labels (InternalString)

None. All labels are English-only and hardcoded.

---

## Empty / error / loading states

| State | Trigger | UI |
|---|---|---|
| Not customs stage | `!isCustomsStage` | Component renders nothing |
| Loading | `loading` | Indigo spinner centered |
| Load error | `loadAll()` fails | Inline error banner (dismissable) |
| Save error | `saveBoe()` fails | Inline error banner |
| No shipments | `!shipments.length` (after load) | "No shipments found" with icon |
| No BOE, not editing | `!boeMap[shipment.id]` | Per-shipment: icon + "Create BOE" prompt |
| No line items in edit | `!lineItems.length` | Dashed empty state: "Click 'Add Items' to select HSN groups" |
| Validation: exchange rate missing | `!Number(boeForm.exchange_rate)` | Sets `error` — prevents save |
| Validation: items incomplete | `!allItemsIncluded` | Amber warning banner in summary section + prevents save |
| Saving | `saving` | Save button shows "Saving..." + disabled |

---

## Business rules

1. **`isCustomsStage` guard**: 7-status list (ARRIVED, CUSTOMS_FILED, CLEARED, DELIVERED, AFTER_SALES, COMPLETED, COMPLETED_EDITING). Defined locally — P-001 instance. Should be `CUSTOMS_VISIBLE_STATUSES` shared constant.

2. **Parallel per-shipment fetch**: `loadAll()` uses `Promise.all(shipments.map(...))` with inner `Promise.all([getBoe, getHsnItems])` per shipment. Correct pattern — not N+1.

3. **`unit_price_cny` as BOE unit price**: When `addHsnGroup()` adds parts to `lineItems`, each item's `unit_price` is set to `part.unit_price_cny`. This is the supplier/factory cost in CNY. All INTERNAL users with CustomsTab access see this data. See Q-001.

4. **Client-side duty calculation**: The `calc` computed performs the full FOB→CIF→AV→duty chain in the browser. The backend re-computes on save. The frontend calc drives live preview only; the saved payload includes per-item `assessable_value_inr` (from `calc.line_items[idx]`) sent to the backend.

5. **Insurance default**: `insurance_inr = null` means 1.125% of FOB. The UI shows "1.125%" hint in the label and the placeholder shows the computed default amount. Override is optional.

6. **Compensation items**: Items with `is_compensation: true` (balance adjustment lines from packing list) are shown in a separate purple section. They are excluded from BOE duty calculations and from the `allItemsIncluded` validation count. They are included in the edit mode table as a read-only reference section.

7. **All-items-included validation**: Save is blocked until `includedCount >= totalShipmentItems`. `includedCount` counts unique `shipment_item_id` values in non-compensation line items. `totalShipmentItems` counts non-compensation items in `hsnItemsMap`.

8. **Manual HSN handling**: UNKNOWN HSN groups (products without HSN codes assigned) require manual entry. `addAllHsn()` handles the first unknown group only — subsequent unknown groups in the same shipment are not auto-queued. User must re-enter via the picker for each unknown group.

9. **Bulk rate change**: Selecting items shows the bulk BCD%/IGST% override bar. `applyBulkRates()` mutates `lineItems[idx].bcd_rate` / `igst_rate` for all selected indices. `selectedItems` index set is rebuilt after `removeLineItem()` to account for index shift.

10. **`emit('reload')` on save**: After successful `saveBoe()`, emits `reload` to parent shell. The parent reloads the order to reflect updated status.

---

## Known quirks / bugs

### Q-001 — `unit_price_cny` as BOE unit price — factory pricing visibility — **[UNCLEAR D-004 family]**

```javascript
lineItems.value.push({
  ...
  unit_price: part.unit_price_cny || 0,  // factory/supplier CNY price
  ...
})
```

`customsApi.getHsnItems(shipmentId)` returns `part.unit_price_cny` — the supplier/factory price per unit in CNY. This value is used directly as `unit_price` in BOE line items and is visible in the editable per-part table to all INTERNAL roles with customs tab access.

**RELATED TO D-010 (2026-04-22):** D-010 ratified that OPERATIONS is excluded from factory cost data — specifically `estProfit` on DashboardTab and the Factory Payments section on PaymentsTab. `unit_price_cny` in the CustomsTab BOE is the same family of factory pricing data but requires a **separate Wave 0 product decision** because it is operationally tied to customs duty calculation.

The question is not whether this is a D-004 leak (it is) — the question is whether customs processing is operationally possible without exposing supplier pricing.

**Two options for Wave 0 decision:**

- **(a) Extend D-010 to CustomsTab:** Restrict BOE creation/editing to ADMIN|FINANCE|SUPER_ADMIN only. OPERATIONS cannot access the CustomsTab. Customs filing becomes a finance function, not a logistics function.
- **(b) Accept `unit_price_cny` exposure as operationally necessary:** OPERATIONS processes customs BOEs and sees supplier pricing as a necessary consequence of duty calculation. Document the explicit exception as a D-010 amendment in DECISIONS.md.

**Decision pending — flag for Wave 0 product decision sprint before CustomsTab migration.**

### Q-002 — `addAllHsn()` handles only the first UNKNOWN group

```javascript
function addAllHsn(shipmentId) {
  const unknownGroups = groups.filter(g => g.hsn_code === 'UNKNOWN')
  // Prompts for first unknown only
  manualHsnGroup.value = unknownGroups[0]
  manualHsnCode.value = ''
  showManualHsn.value = true
  // Remaining unknownGroups[1+] are ignored
}
```

If a shipment has 2+ UNKNOWN groups, `addAllHsn()` prompts for the first only. Subsequent unknown groups remain unprocessed after confirm. User must manually add them from the picker. Not blocked — the all-items-included validation will flag the incomplete state.

### Q-003 — Compensation items not saved to BOE payload

`saveBoe()` filters out compensation items:
```javascript
line_items: lineItems.value.filter(li => !li.is_compensation).map(...)
```
Compensation items shown in the edit form are for reference only and are excluded from the API payload. This is correct behavior, but the UI could be clearer that compensation items are display-only.

### Q-004 — `selectedItems` uses `new Set()` directly (reactivity caveat)

```javascript
const selectedItems = ref(new Set())
// Direct mutation inside toggleItem, removeLineItem, applyBulkRates
selectedItems.value = new Set(selectedItems.value) // creates new Set for reactivity trigger
```
`removeLineItem()` and `applyBulkRates()` correctly replace `selectedItems.value` with a new `Set` instance. `toggleItem()` also creates a new Set: `const s = new Set(selectedItems.value)`. Pattern is functionally correct in Vue 3 — new Set assignment triggers reactivity. No bug.

### Q-005 — Inline `r2()` and `fmt()` utility duplication

Both helper functions are defined locally:
```javascript
function r2(v) { return Math.round(v * 100) / 100 }
function fmt(v) { return v != null ? Number(v).toLocaleString('en-IN', {...}) : '—' }
```
`r2()` is also needed in the `calc` computed internals. Both should move to `utils/formatters.ts`. (P-001 ×2)

---

## Dead code / unused state

None. All 1,024 lines are actively used in the template or calculation logic.

---

## Duplicate or inline utilities

- **`r2(v)`** — inline rounding helper. Extract to `utils/formatters.ts`. (P-001)
- **`fmt(v)`** — inline INR locale formatter. Identical pattern appears in FinalDraftTab, LandedCostTab. Extract as `formatINR()` in `utils/formatters.ts`. (P-001 ×3 instances in Session C)
- **`isCustomsStage` status list** — 7 statuses hardcoded locally. Extract to `CUSTOMS_VISIBLE_STATUSES` constant in `@/types/order-status.ts`. (P-001)
- **`statusColor(status)` function** — BOE status → Tailwind class map. Candidate for shared BOE status helpers.

---

## Migration notes

1. **`calc` computed → `useBoeCalc` hook**: The duty calculation logic is substantial and self-contained. Extract to `src/hooks/useBoeCalc.ts` for testability and reuse (customs filing could appear in factory portal too):
   ```typescript
   function useBoeCalc(boeForm: Ref<BoeFormData>, lineItems: Ref<LineItem[]>) {
     const calc = useMemo(() => computeBoe(boeForm.value, lineItems.value), [boeForm, lineItems])
     return { calc }
   }
   ```

2. **Per-shipment BOE map → React Query**: Cache key `['customs-boe', shipmentId]`. `loadAll()` fans out to per-shipment queries. Use `useQueries(shipments.map(s => ({ queryKey: ['customs-boe', s.id], ... })))`.

3. **HSN picker → separate component**: The picker + manual HSN dialog is 200+ lines. Extract to `<HsnPicker shipmentId={id} onAdd={addItems} />`.

4. **Bulk rate change bar → `<BulkRateBar>`**: Self-contained component with selectedCount, bulkBcd, bulkIgst, onApply.

5. **`unit_price_cny` visibility (D-010 family — Wave 0 product decision required):** Q-001 is captured with two options. If option (a) is chosen (extend D-010 exclusion): gate CustomsTab access to ADMIN|FINANCE|SUPER_ADMIN only — OPERATIONS cannot create or edit BOEs. If option (b) is chosen (accept exposure): display a clear label "Supplier Price (CNY)" to make the data source explicit, and record the OPERATIONS exception as a D-010 amendment in DECISIONS.md. Decision must be made before Wave 8 (CustomsTab) migration begins.

6. **Manual HSN queue**: Fix `addAllHsn()` to queue all UNKNOWN groups and process them sequentially after each `confirmManualHsn()` confirmation.

7. **Shared status constants**: Import `CUSTOMS_VISIBLE_STATUSES` from `@/types/order-status.ts`.

8. **Component size**: 1,024 lines. After extracting HsnPicker and BulkRateBar, the main component should reduce to ~600 lines — within the 800-line threshold.
