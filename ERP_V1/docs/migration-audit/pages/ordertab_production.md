# Profile: ordertab_production

## Metadata
- **Source file:** `frontend/src/components/order/ProductionTab.vue`
- **Lines:** 122
- **Type:** component (sub-tab)
- **Portal:** internal
- **Tab slug:** `production`
- **Parent shell:** `OrderDetail.vue`
- **Wave:** Wave 8
- **Profile generated:** 2026-04-22

---

## Purpose

Displays and allows editing of factory production progress for an order. Shows a progress percentage from the backend, renders a visual progress bar, and provides date inputs for setting production start and target completion dates. The tab self-guards with a local `isProductionStage` computed — if the order status is not in a recognized production status, the tab renders nothing (null render).

---

## Layout / visual structure

```
┌────────────────────────────────────────────────────┐
│ Production Progress Card                           │
│                                                    │
│  Progress bar (indigo; red when overdue)           │
│  Progress % label                                  │
│  [Overdue badge — if target date passed]           │
│                                                    │
│  Start Date input    Target Date input             │
│  [Save Dates]                                      │
│                                                    │
│  (No content rendered if !isProductionStage)       │
└────────────────────────────────────────────────────┘
```

---

## Data displayed

| Field | Source |
|---|---|
| Progress percentage | `productionProgress.percent` from `productionApi.getProgress` |
| Start date | `startDateInput` (editable input, pre-filled from API) |
| Target date | `targetDateInput` (editable input, pre-filled from API) |
| Overdue status | Computed: `target_date < today && percent < 100` |
| Progress bar color | Indigo normally; red when overdue |

---

## Interactions

| Action | Handler | API |
|---|---|---|
| Mount | `loadProductionProgress()` | `productionApi.getProgress(orderId)` |
| Save dates | `setProductionDates()` | `productionApi.setDates(orderId, { start_date, target_date })` |

No search, filter, pagination, or modal interactions.

---

## Modals / dialogs triggered

None.

---

## API endpoints consumed

| Endpoint | Purpose |
|---|---|
| `GET /api/production/progress/{orderId}/` | Load current production progress and dates |
| `POST /api/production/dates/{orderId}/` | Set production start and target dates |

---

## Composables consumed

None. Props provide all required data.

---

## PrimeVue components consumed

PrimeVue Icons (`pi-*`) for iconography. No PrimeVue form or overlay components — date inputs are native `<input type="date">`.

---

## Local state

```javascript
const props = defineProps({
  orderId: { type: String, required: true },
  order: { type: Object, required: true },
})

const productionProgress = ref(null)
const startDateInput = ref('')
const targetDateInput = ref('')
const settingTarget = ref(false)   // Loading state for date save

const isProductionStage = computed(() => {
  const prodStatuses = [
    'FACTORY_ORDERED', 'PRODUCTION_60', 'PRODUCTION_80', 'PRODUCTION_90',
    'PLAN_PACKING', 'FINAL_PI', 'PRODUCTION_100'
  ]
  return prodStatuses.includes(props.order?.status)
})
```

---

## Permissions / role gating

No role gate within the component. Tab visibility is controlled by the parent shell: `production` slug is added to `availableTabs` only when `isProductionStage` is true at the shell level. The component also has its own `isProductionStage` guard — if the shell somehow shows the tab for a non-production status, the component renders nothing.

All INTERNAL roles that can see the tab can also save dates. No write-action role restriction observed.

---

## Bilingual labels (InternalString)

None. All labels English-only.

---

## Empty / error / loading states

- **Non-production stage**: Template renders nothing (`v-if="isProductionStage"` at root). No placeholder shown.
- **Loading progress**: `productionProgress` is null until `loadProductionProgress()` resolves; progress bar and percentage display are conditionally rendered.
- **Save error**: `settingTarget` returns to false; error appears to be handled with a console.error only (P-002 pattern — not surfaced to user). [UNCLEAR — confirm error handling in setProductionDates()]
- **No API data**: If `productionProgress` is null after load, the progress bar and percentage section are hidden.

---

## Business rules

1. **Self-guarded rendering**: The component independently evaluates whether the order is in a production stage using a hardcoded status list. This duplicates the logic in the parent shell's `availableTabs` computed. The local guard is a safety net but creates a maintenance point: the production status list is defined in two places.
2. **Overdue detection**: If `targetDateInput` is set and is earlier than today, and `productionProgress.percent < 100`, the progress bar turns red and an overdue badge is displayed.
3. **Date save**: Both start and target dates are submitted together in one API call via `setProductionDates()`. If only one is changed, both are still submitted.
4. **Progress source**: Progress percentage comes from the backend (`productionApi.getProgress`) — the factory is presumably updating this via their portal. The internal user cannot edit the percentage directly from this tab.

---

## Known quirks / bugs

### Q-001 — Duplicated production status list (P-001 instance)
```javascript
// ProductionTab.vue:
const prodStatuses = ['FACTORY_ORDERED', 'PRODUCTION_60', ...]

// OrderDetail.vue (parent shell):
const isProductionStage = computed(() => ...)  // same status list
```
The production status list is defined once in the shell (`availableTabs` computed) and again locally in this component. If a new status is added to the production stage range, it must be added in both places. This is a P-001 (duplicate utility) instance for status constants — the status list should come from `utils/constants.js`.

### Q-002 — No error feedback for date save failure
`setProductionDates()` catches errors with `console.error` only. If the API call fails, the user sees no notification — the "Save" button simply stops spinning. Replace with a toast notification or inline error message.

---

## Dead code / unused state

None. At 122 lines, this component is tightly scoped with no extraneous code.

---

## Duplicate or inline utilities

- `isProductionStage` computed: duplicates the status array from the parent shell's `availableTabs`. Action: export a `PRODUCTION_STATUSES` constant from `utils/constants.js` and import it in both places. (P-001 instance)

---

## Migration notes

1. **Extract PRODUCTION_STATUSES constant**: Define `export const PRODUCTION_STATUSES = ['FACTORY_ORDERED', 'PRODUCTION_60', ...]` in `utils/constants.js` (or the Next.js SDK types package). Import in both the shell's tab visibility logic and this component's `isProductionStage` guard. Single source of truth.

2. **Progress percentage editing**: Currently the factory updates progress via their portal. If the internal team needs to override progress (e.g., factory hasn't updated), add an editable percentage field here with a `productionApi.setProgress(orderId, percent)` call.

3. **Date validation**: In the Next.js rebuild, add client-side validation: `target_date` must be after `start_date`; `start_date` should not be in the future if production is already in progress. Use Zod schema validation on form submission.

4. **Error handling (P-002)**: Replace `console.error` in `setProductionDates()` with a `toast.error('Failed to save production dates')` notification. Use the shared toast system established in Wave 0.

5. **Progress bar component**: Extract the progress bar (percentage + color logic + overdue detection) into a shared `<ProductionProgressBar percent={n} targetDate={d} />` component. The same visual likely appears in factory portal views.

6. **Component size is good**: At 122 lines, this component is already at an ideal size. No splitting needed in the migration. Port 1:1 as a focused Next.js client component.
