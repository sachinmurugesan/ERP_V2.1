# Profile: ordertab_landed_cost

## Metadata
- **Source file:** `frontend/src/components/order/LandedCostTab.vue`
- **Lines:** 208
- **Type:** component (sub-tab)
- **Portal:** internal
- **Tab slug:** `landed-cost`
- **Parent shell:** `OrderDetail.vue`
- **Wave:** Wave 8 Session C
- **Profile generated:** 2026-04-22

---

## Purpose

Read-only display of the full landed cost breakdown for TRANSPARENCY-type client orders. Shows the total import cost (invoice value + freight + customs duty + clearance + commission) and per-item landed cost with per-unit values. Provides an Excel download of the same data. Triple-gated at shell level: only shown when (1) `order.client_type === 'TRANSPARENCY'`, (2) order status ∈ {CLEARED, DELIVERED, AFTER_SALES, COMPLETED, COMPLETED_EDITING}, and (3) user role ∈ {SUPER_ADMIN, ADMIN, FINANCE}. The component itself has no internal gate — it trusts the shell.

---

## Layout / visual structure

```
┌────────────────────────────────────────────────────┐
│ Landed Cost Breakdown        [Download Excel]      │
│ ORDER-001 · Client Name                            │
│                                                    │
│ [Invoice ₹X] [Expenses ₹X] [Exp% X%] [Total ₹X]  │
│ ← summary cards                                    │
│                                                    │
│ Expense Breakdown table:                           │
│   Invoice | ₹amount                               │
│   Freight | ₹amount                               │
│   Duty    | ₹amount                               │
│   ...                                              │
│   ─────────────────                               │
│   Total Bill | ₹amount                            │
│   Total Expenses | ₹amount                        │
│   ═══════════════                                 │
│   Grand Total | ₹amount  ← emerald footer         │
│                                                    │
│ Per-Item Breakdown table:                          │
│   # | Product | Qty | Value | Freight | Duty |    │
│   Clearance | Commission | Landed Cost | Per Unit  │
└────────────────────────────────────────────────────┘
```

---

## Data displayed

| Field | Source |
|---|---|
| Order number / client name | `data.order_number`, `data.client_name` |
| Invoice summary | `data.invoice.{label, amount_inr}` |
| Expense rows | `data.expenses[]` — `{label, amount_inr}` per row |
| Summary totals | `data.summary.{total_bill_inr, total_expenses_inr, expense_percent, grand_total_inr}` |
| Per-item value | `item.item_value_inr` (transparency-adjusted client price) |
| Per-item freight share | `item.freight_share` |
| Per-item duty share | `item.duty_share` |
| Per-item clearance share | `item.clearance_share` |
| Per-item commission share | `item.commission_share` |
| Per-item total landed cost | `item.total_landed_cost` |
| Per-item per-unit cost | `item.landed_cost_per_unit` |

**No factory pricing fields**: `item_value_inr` is `client_factory_price` (transparency-adjusted), not `factory_price` or any `*_cny` field. The backend enforces this — the landed cost endpoint explicitly uses client-facing prices.

---

## Interactions

| Action | Handler | API |
|---|---|---|
| Mount | `loadData()` | `ordersApi.getLandedCost(orderId)` |
| Download Excel | `downloadExcel()` | `ordersApi.downloadLandedCostExcel(orderId)` |

---

## Modals / dialogs triggered

None.

---

## API endpoints consumed

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/orders/{orderId}/landed-cost/` | GET | Full landed cost breakdown |
| `/api/orders/{orderId}/landed-cost/download/` | GET | Excel blob download |

Backend (`landed_cost.py:44`): inline role allowlist `[SUPER_ADMIN, ADMIN, FINANCE]` plus CLIENT ownership check. AUTHZ_SURFACE.md classification: **OK**.

---

## Composables consumed

None.

---

## PrimeVue components consumed

PrimeVue Icons (`pi-spinner`, `pi-info-circle`, `pi-file-excel`). No form or overlay components.

---

## Local state

```javascript
const props = defineProps({
  orderId: { type: String, required: true },
})

const loading = ref(true)
const error = ref(null)
const data = ref(null)
const downloading = ref(false)
```

No computed properties beyond what the template computes inline. No reactive form state. No polling.

---

## Permissions / role gating

No internal gate. Component is fully dependent on shell enforcement. The triple gate in the shell's `availableTabs`:

1. `order.client_type === 'TRANSPARENCY'`
2. `['CLEARED', 'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING'].includes(order.status)`
3. `['SUPER_ADMIN', 'ADMIN', 'FINANCE'].includes(userRole)`

The backend also enforces all three gates independently. Defense in depth: shell + backend both gate. The component itself adds no third layer — this is acceptable given the consistent enforcement above.

---

## Bilingual labels (InternalString)

None. All labels are English-only.

---

## Empty / error / loading states

| State | Trigger | UI |
|---|---|---|
| Loading | `loading` | Spinner + "Loading landed cost data..." |
| Error (400) | `err.response.status === 400` | `err.response.data.detail` message with amber icon |
| Error (404) | `err.response.status === 404` | "Landed cost not available for this order." |
| Error (other) | Any other HTTP error | `err.response.data.detail` fallback |
| No items | `!data.items?.length` | Per-item table hidden (expense table still shows) |
| Downloading | `downloading` | Excel button shows spinner + "Generating..." |

Error handling correctly distinguishes 400 (bad request — likely bad data state) from 404 (not available yet) from unexpected errors. No silent failures in load path.

---

## Business rules

1. **TRANSPARENCY-only visibility**: The tab is never shown for STANDARD client orders. `client_type` gating ensures standard clients' factory cost structure remains invisible.

2. **`item_value_inr` is transparency-adjusted**: The backend uses `client_factory_price` (the price the client sees for their transparency program) — not the raw factory cost. No actual factory-to-Harvest markup is exposed.

3. **Expense rows are backend-computed**: The `expenses[]` array contains categories (freight, duty, clearance, commission) computed server-side. The component displays them verbatim — no client-side arithmetic.

4. **`expense_percent`** = `total_expenses_inr / total_bill_inr × 100` — backend-computed and delivered as `data.summary.expense_percent`.

5. **Excel download**: Blob URL pattern — same as AfterSalesTab. Creates anchor element, clicks it, revokes URL. Correct pattern.

6. **No edit controls**: Landed cost is a computed view. No mutation endpoints exist for the landed cost breakdown itself.

---

## Known quirks / bugs

### Q-001 — No internal access gate (by design)

The component has no `v-if` role check or status check. This is architecturally intentional — the shell enforces access. If this component were ever mounted outside the shell's tab system (e.g., in a standalone page or test harness), it would render for any user with the correct `orderId`. This is acceptable as long as the backend endpoint itself enforces the triple gate (confirmed via AUTHZ_SURFACE.md). No action required, documented for awareness.

### Q-002 — Excel download fails silently

```javascript
async function downloadExcel() {
  ...
  } catch (err) {
    console.error('Download failed:', err)
    // No user-facing error
  }
}
```

If `downloadLandedCostExcel()` fails, the user sees nothing — the button re-enables silently. Add a catch that sets a brief `error` state or shows a toast.

### Q-003 — `formatLakh()` locale inconsistency

```javascript
function formatLakh(val) {
  if (n >= 100000) return '₹' + (n / 100000).toFixed(2) + 'L'
  if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'K'
  return formatINR(n)
}
```

`formatLakh()` abbreviates using L/K notation — useful for summary cards showing large values. However, the fallthrough to `formatINR()` uses `en-IN` locale formatting, while the L/K branches do not. For values like ₹999,999 the function returns `formatINR(999999)` = `₹9,99,999.00` (en-IN grouping), but ₹1,000,000 returns `₹10.00L`. The cutoff at 100,000 is correct for Indian lakh notation. Behavior is acceptable but the inconsistency in decimal places (`.toFixed(2)` for L, `.toFixed(1)` for K) may confuse. Extract with tests in migration.

---

## Dead code / unused state

None. All 208 lines are actively used.

---

## Duplicate or inline utilities

- **`formatINR(val)`** — inline, P-001 instance. Session C alone has 3 instances: `CustomsTab`, `FinalDraftTab`, `LandedCostTab`. All should import from `utils/formatters.ts`.
- **`formatLakh(val)`** — inline. Not observed in other tabs. Candidate for `utils/formatters.ts` as `formatINRCompact()` or similar. Requires tests for the L/K/full thresholds.

---

## Migration notes

1. **`formatINR` + `formatLakh`**: Import from `src/lib/formatters.ts`. Add both if not present. Add unit tests for `formatLakh` boundary cases (999/1000, 99999/100000, negative values).

2. **Excel download error**: Add catch handling:
   ```typescript
   } catch (err) {
     setDownloadError('Failed to generate Excel. Please try again.')
   }
   ```

3. **React port**: Straightforward. Single `useQuery` hook, two display tables, one download button. No complex state:
   ```tsx
   const { data, isLoading, error } = useQuery(
     ['landed-cost', orderId],
     () => ordersApi.getLandedCost(orderId)
   )
   ```

4. **Shell gate verification**: In Next.js port, verify the shell's `availableTabs` logic replicates all three gates (client_type + status + role) before passing the tab to the tab list. Backend remains the authoritative gate.

5. **No component extraction needed**: 208 lines is well within threshold. Port as a single component with minimal structural change. The expense table and per-item table are simple enough to keep inline.
