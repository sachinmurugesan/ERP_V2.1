# Profile: ordertab_sailing

## Metadata
- **Source file:** `frontend/src/components/order/SailingTab.vue`
- **Lines:** 539
- **Type:** component (sub-tab)
- **Portal:** internal
- **Tab slug:** `sailing`
- **Parent shell:** `OrderDetail.vue`
- **Wave:** Wave 8 Session B
- **Profile generated:** 2026-04-22

---

## Purpose

Tracks the three sailing phases (Loaded → Sailed → Arrived) for each container booked on an order. Shows a progress bar per container (computed from ETD to ETA). Provides inline phase forms to record: loading confirmation date, sailed info (container#, seal#, vessel, voyage, B/L number, departure date, revised ETA), and arrival confirmation (arrival date, CFS receipt number, notes). The "Mark as Arrived" action is gated — it is only available when all shipping documents for that container are marked RECEIVED in the ShippingDocsTab. Progress auto-refreshes every 60 seconds.

---

## Layout / visual structure

```
┌──────────────────────────────────────────────────────┐
│ Sailing Progress (blue header)                        │
│                                                       │
│ (per container):                                     │
│  Container header: [40HC] Shanghai → Chennai  #CONT  │
│  [Vessel Name / Voyage]                              │
│                                                       │
│  Progress bar [████████░░░░░░░░] N%                  │
│  ETD: Jan-15        N% · M days remaining   ETA: Feb-1│
│                                                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ ① Loaded    │ │ ② Sailed    │ │ ③ Arrived   │  │
│  │ ──────────── │ │ ──────────── │ │ ──────────── │  │
│  │ [completed] │ │ [current]   │ │ Docs: 3/4   │  │
│  │ or          │ │ [form]       │ │ pending      │  │
│  │ [form]      │ │ or           │ │ or           │  │
│  │ or          │ │ [button]     │ │ [button]     │  │
│  │ Pending     │ │ or Pending   │ │ or Pending   │  │
│  └──────────────┘ └──────────────┘ └──────────────┘  │
│                                                       │
│ Empty state: "No shipments found"                    │
└──────────────────────────────────────────────────────┘
```

Phase card states:
- **completed** (emerald): shows recorded data fields
- **current** (blue, animate-pulse): shows action button or inline form
- **future** (slate): shows "Pending" italic text

---

## Data displayed

| Field | Source |
|---|---|
| Shipment list | `shipments[]` from `shipmentsApi.list` |
| Per-shipment progress | `progressMap[id]` from `shipmentsApi.getProgress(id)` (N+1) |
| Per-shipment docs count | `shippingDocsMap[id][]` from `shipmentsApi.listDocs` |
| Container header fields | `shipment.container_type`, `.port_of_loading`, `.port_of_discharge`, `.container_number`, `.vessel_name`, `.voyage_number` |
| Progress bar | `getProgress(id).percent` |
| Days remaining | `getProgress(id).days_remaining` |
| ETD / Revised ETA | `shipment.etd`, `shipment.revised_eta || shipment.eta` |
| Loaded data | `shipment.loading_date`, `shipment.loading_notes` |
| Sailed data | `shipment.container_number`, `.seal_number`, `.vessel_name`, `.voyage_number`, `.bl_number`, `.actual_departure_date` |
| Arrived data | `shipment.actual_arrival_date`, `.cfs_receipt_number`, `.arrival_notes` |
| Docs gate | `docsReceivedCount(id)` / `docsTotalCount(id)` / `allDocsReceived(id)` |

---

## Interactions

| Action | Handler | API |
|---|---|---|
| Mount | `loadShipments()` → `loadAllProgress()` + `loadShippingDocs()` in parallel | shipmentsApi.list, shipmentsApi.getProgress (×N), shipmentsApi.listDocs |
| Open phase form | `showPhaseForm(shipmentId, phaseType)` | — |
| Cancel phase form | `cancelPhaseForm()` | — |
| Mark as Loaded | `markLoaded(shipmentId)` | `shipmentsApi.markLoaded(id, loadedForm)` |
| Mark as Sailed | `markSailed(shipmentId)` | `shipmentsApi.markSailed(id, sailedForm)` |
| Mark as Arrived | `markArrived(shipmentId)` | `shipmentsApi.markArrived(id, arrivedForm)` |
| Auto-refresh progress | `setInterval(() => loadAllProgress(), 60000)` | `shipmentsApi.getProgress(id)` per shipment |
| Unmount | `clearInterval(refreshInterval)` | — |

---

## Modals / dialogs triggered

None. Phase actions use inline expandable forms within the phase cards, not overlay dialogs.

---

## API endpoints consumed

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/shipments/?order_id={orderId}` | GET | List all containers for the order |
| `/api/shipments/{id}/progress/` | GET | Per-shipment ETD→ETA progress (N+1 loop) |
| `/api/shipments/docs/?order_id={orderId}` | GET | All shipping docs (for Arrived gate) |
| `/api/shipments/{id}/loaded/` | POST | Record loading date + notes |
| `/api/shipments/{id}/sailed/` | POST | Record sailed info (container, vessel, B/L, etc.) |
| `/api/shipments/{id}/arrived/` | POST | Record arrival (date, CFS receipt, notes) |

---

## Composables consumed

- `formatDate` from `../../utils/formatters`

---

## PrimeVue components consumed

PrimeVue Icons (`pi-*`) for iconography. No PrimeVue form or overlay components. All inputs are native HTML `<input>`, `<textarea>`.

---

## Local state

```javascript
const props = defineProps({
  orderId: { type: String, required: true },
  order: { type: Object, required: true },
})
const emit = defineEmits(['reload'])

const loading = ref(false)
const saving = ref(false)
const shipments = ref([])
const progressMap = ref({})          // { [shipmentId]: { percent, days_remaining } }
const shippingDocsMap = ref({})      // { [shipmentId]: docs[] }
const error = ref('')
const refreshInterval = ref(null)

// Phase forms
const sailedForm = ref({ container_number, seal_number, vessel_name,
  voyage_number, bl_number, actual_departure_date, revised_eta })
const arrivedForm = ref({ actual_arrival_date, cfs_receipt_number, arrival_notes })
const loadedForm = ref({ loading_date, loading_notes })

// Active phase form (only one open at a time across all containers)
const activePhaseShipmentId = ref(null)
const activePhaseType = ref(null)    // 'loaded' | 'sailed' | 'arrived'
```

**Key computed:**
```javascript
const isSailingStage = computed(() => {
  const s = ['LOADED', 'SAILED', 'ARRIVED', 'CUSTOMS_FILED', 'CLEARED',
    'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING']
  return s.includes(props.order?.status)
})
```

---

## Permissions / role gating

No role gate within the component. All INTERNAL roles that can see the tab can record any sailing phase. No write-action role restriction observed.

---

## Bilingual labels (InternalString)

None. All labels are English-only.

---

## Empty / error / loading states

| State | Trigger | UI |
|---|---|---|
| Not in sailing stage | `!isSailingStage` | Entire component renders nothing |
| Loading shipments | `loading` | Amber spinner centered |
| Load error | `loadShipments()` fails | Inline `error` banner (dismissable) |
| Phase save error | `markLoaded/Sailed/Arrived()` fails | `error` ref → banner |
| Saving phase | `saving` | "Saving..." in phase action button |
| No shipments | `!shipments.length` | "No shipments found — Book containers first in the Booking tab" |
| Phase: future | computed | "Pending" italic text in card |
| Arrived gate: docs pending | `!allDocsReceived(id)` | Counter "N/M docs received" + "Upload all shipping documents first" |
| Arrived gate: docs complete | `allDocsReceived(id)` | [Mark as Arrived] button enabled |
| Docs load error | `loadShippingDocs()` catch | Silently swallows (`catch {}`) — Arrived button incorrectly disabled if docs fail to load (P-002) |
| Progress load error | `loadAllProgress()` per-shipment catch | Falls back to `{ percent: 0, days_remaining: null }` — shows 0% progress bar |

---

## Business rules

1. **`isSailingStage` guard**: Renders from LOADED onward. The tab is not shown for orders at PLAN_PACKING, FINAL_PI, PRODUCTION_*, or BOOKED.

2. **Phase sequence is strictly sequential**: `getPhaseStatus(shipment, phase)` determines `completed | current | future` based on presence of date fields and `shipment.phase`:
   - **Loaded**: completed if `loading_date` present or phase is SAILED/ARRIVED; current if phase is LOADED.
   - **Sailed**: completed if `actual_departure_date` present or phase is ARRIVED; current if phase is SAILED or loading_date is set.
   - **Arrived**: completed if `actual_arrival_date` present; current if phase is ARRIVED or departure date is set.

3. **Only one phase form open at a time**: `activePhaseShipmentId` + `activePhaseType` track which form is expanded. Opening a new form resets the previous.

4. **"Mark as Arrived" gated on `allDocsReceived(id)`**: The Arrived action button only appears when all shipping docs for that container are RECEIVED (in ShippingDocsTab). If docs are still pending, a counter shows progress and a message prompts to upload docs first. This is a cross-tab dependency.

5. **`allDocsReceived()` guard logic**: `docs.length > 0 && docs.every(d => d.status === 'RECEIVED')`. If `docs.length === 0` (docs failed to load or none exist), returns `false` — Arrived button is blocked. This creates a failure mode if the docs API call silently fails (see Q-002).

6. **Progress auto-refresh**: `setInterval(() => loadAllProgress(), 60000)` fetches per-shipment progress every 60 seconds while the tab is mounted. Useful for long sailing periods where the backend computes ETA progress. Cleared on `onUnmounted`.

7. **Multiple containers**: Each container in `shipments[]` gets its own phase timeline. Phase progression is tracked independently per container.

8. **`revised_eta` field**: Sailed form includes a "Revised ETA" field that overrides the original `eta` for the progress bar calculation (`shipment.revised_eta || shipment.eta`). This accommodates delays.

---

## Known quirks / bugs

### Q-001 — N+1 fetch in `loadAllProgress()` (P-023)
```javascript
for (const s of shipments.value) {
  const res = await shipmentsApi.getProgress(s.id)  // sequential N+1
  map[s.id] = res.data
}
```
Sequential per-shipment progress calls. For an order with 3 containers: 3 sequential requests. This pattern was also noted (informally) in OrderDashboardTab for customs BOE. Formalized as **P-023: N+1 per-entity API fetch in sequential loop**. Backend should provide a bulk progress endpoint (e.g., `GET /api/shipments/progress/?order_id={id}`) or parallel `Promise.all` at minimum.

### Q-002 — `loadShippingDocs()` silently swallows all errors
```javascript
async function loadShippingDocs() {
  try { ... }
  catch { shippingDocsMap.value = {} }  // completely silent
}
```
If the docs endpoint fails, `shippingDocsMap` is empty — `allDocsReceived(id)` returns `false` for all containers (because `docs.length === 0`). The "Mark as Arrived" button is silently blocked. User sees: "0 / 0 docs received — Upload all shipping documents first" with no explanation of the underlying failure. Should at minimum `console.error` and ideally show an error message in the Arrived phase card.

### Q-003 — Phase form: `saving` flag shared across all containers
A single `saving` ref governs the loading state for all phase buttons across all containers. If one container's phase is being saved, all containers' phase buttons show "Saving..." (though only one form can be open at a time, so in practice this is invisible).

### Q-004 — No required field validation before phase submit
`markLoaded()` submits with potentially empty `loading_date`. `markArrived()` allows empty `actual_arrival_date`. Backend may reject these, but error appears post-submit rather than client-side.

---

## Dead code / unused state

None identified.

---

## Duplicate or inline utilities

- **`isSailingStage` hardcoded status list**: Same pattern as ShippingDocsTab (identical list). Extract `SAILING_VISIBLE_STATUSES` constant from Next.js SDK types. Both `SailingTab.vue` and `ShippingDocsTab.vue` define the same `['LOADED', 'SAILED', 'ARRIVED', ...]` array. (P-001 instance ×2)
- **Progress bar rendering**: Very similar progress bar (ETD→ETA) to the production progress bar in ProductionTab. Consider a shared `<ShipmentProgressBar>` component.
- **`getPhaseStatus()` utility**: Phase status logic is standalone and testable. Extract to `utils/shipment-phases.ts` for unit testing.

---

## Migration notes

1. **`setInterval` → React `useEffect` cleanup**:
   ```typescript
   useEffect(() => {
     const id = setInterval(() => loadAllProgress(), 60000)
     return () => clearInterval(id)
   }, [shipments])
   ```

2. **N+1 progress fetch → `Promise.all` or bulk endpoint** (P-023):
   - Immediate fix: `await Promise.all(shipments.map(s => shipmentsApi.getProgress(s.id)))` 
   - Proper fix: `GET /api/shipments/progress/?order_id={id}` returning a map — request this backend endpoint in Wave 0.

3. **Cross-tab `allDocsReceived()` dependency → shared cache**: ShippingDocsTab and SailingTab both call `shipmentsApi.listDocs(orderId)`. Use React Query or SWR with shared cache key `['shipment-docs', orderId]` so both tabs read from the same cached data.

4. **Phase timeline → extract `<ContainerPhaseTimeline>`** component:
   ```typescript
   <ContainerPhaseTimeline
     shipment={shipment}
     progress={progressMap[shipment.id]}
     docs={shippingDocsMap[shipment.id]}
     onMarkLoaded={...}
     onMarkSailed={...}
     onMarkArrived={...}
   />
   ```

5. **Phase form validation**: Add Zod schema per phase before submit. `loadedForm.loading_date` required; `sailedForm.actual_departure_date` and `.bl_number` required; `arrivedForm.actual_arrival_date` required.

6. **Silent docs error → surface in UI**: On `loadShippingDocs()` failure, set a `docsLoadError` flag and show a warning in the Arrived phase card: "Could not load document status — unable to verify" with a Retry button.

7. **`isSailingStage` constant**: Share with `ShippingDocsTab` — one `SAILING_VISIBLE_STATUSES` constant imported by both.

8. **`getPhaseStatus()` → `utils/shipment-phases.ts`**: Pure function, extract and unit test independently.
