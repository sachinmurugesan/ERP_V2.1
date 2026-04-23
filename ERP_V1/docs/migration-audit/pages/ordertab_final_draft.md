# Profile: ordertab_final_draft

## Metadata
- **Source file:** `frontend/src/components/order/FinalDraftTab.vue`
- **Lines:** 284
- **Type:** component (sub-tab)
- **Portal:** internal
- **Tab slug:** `final-draft`
- **Parent shell:** `OrderDetail.vue`
- **Wave:** Wave 8 Session C
- **Profile generated:** 2026-04-22

---

## Purpose

Read-only financial reconciliation summary for a completed order. Aggregates: original vs. shipped vs. carried-forward item counts, financial reconciliation (PI total → payments → claims → net position with advisory banners), claims breakdown detail table, payment history table, and (conditionally) a Factory Cost & Margin section. Single API call on mount. Visible only at COMPLETED / COMPLETED_EDITING (gated by shell).

---

## Layout / visual structure

```
┌──────────────────────────────────────────────────────┐
│ [Dark gradient] Final Draft — Order Reconciliation   │
│ "Complete financial summary after order completion..." │
│                                                      │
│ A. Order Summary                                     │
│    [Original N / Xk units] [Shipped N / Xk] [CF N]  │
│                                                      │
│ B. Financial Reconciliation                          │
│    Original PI:        ₹X                            │
│    Less: Migrated:    -₹X                            │
│    ══ Revised PI:      ₹X ══                         │
│    Payments (N):       ₹X                            │
│    Claims Value:       ₹X  (if > 0)                  │
│    Compensation:      +₹X  (if > 0)                  │
│    Replacement:        ₹X  (if > 0)                  │
│    ── Net Position:   ₹X   (green or red)            │
│    [Advisory banner: credit / balance / replacements] │
│                                                      │
│ C. Claims Breakdown table (if total_claims > 0)      │
│    Product | Issue | Sent | Rec. | Claim Qty |       │
│    Value | Resolution | Status                       │
│                                                      │
│ D. Payment History table                             │
│    Date | Type | Method | Reference | Amount         │
│                                                      │
│ E. Factory Cost & Margin (v-if="hasFactory")         │
│    [Admin Only badge]                                │
│    Factory | Cost CNY | Cost INR | Gross Margin      │
└──────────────────────────────────────────────────────┘
```

---

## Data displayed

All data from single API response `ordersApi.reconciliation(orderId)`:

| Field | Source path |
|---|---|
| Original item count / qty | `data.items.original_count`, `.original_qty` |
| Shipped count / qty | `data.items.shipped_count`, `.shipped_qty` |
| Carried-forward count / qty | `data.items.migrated_count`, `.migrated_qty` |
| Original PI total | `data.reconciliation.original_pi_total` |
| Migrated value | `data.reconciliation.migrated_value` |
| Revised PI total | `data.reconciliation.revised_pi_total` |
| Total paid | `data.reconciliation.total_paid` |
| Total claim value | `data.reconciliation.total_claim_value` |
| Compensate value | `data.reconciliation.compensate_value` |
| Replace value | `data.reconciliation.replace_value` |
| Final net position | `data.reconciliation.final_net_position` |
| Pending replacements | `data.reconciliation.pending_replacements` |
| Payment count | `data.payments.payment_count` |
| Payments list | `data.payments.payments[]` |
| Claims list | `data.claims.items[]` |
| Total claims | `data.claims.total_claims` |
| Factory name | `data.factory.name` (conditional) |
| Factory cost CNY | `data.factory.total_cny` (conditional) |
| Exchange rate | `data.factory.exchange_rate` (conditional) |
| Factory cost INR | `data.factory.total_inr` (conditional) |
| Gross margin INR | `data.factory.margin_inr` (conditional) |
| Margin % | `margin_inr / revised_pi_total × 100` (inline template calc) |

---

## Interactions

| Action | Handler | API |
|---|---|---|
| Mount | `loadReconciliation()` | `ordersApi.reconciliation(orderId)` |

Read-only. No edit controls, no mutations.

---

## Modals / dialogs triggered

None.

---

## API endpoints consumed

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/orders/{orderId}/reconciliation/` | GET | Full reconciliation data |

---

## Composables consumed

None.

---

## PrimeVue components consumed

PrimeVue Icons (`pi-*`). No form, overlay, or data components.

---

## Local state

```javascript
const props = defineProps({ orderId: String, order: Object })

const data = ref(null)
const loading = ref(true)
const error = ref('')

// Shorthand computed accessors
const r = computed(() => data.value?.reconciliation || {})
const hasFactory = computed(() => !!data.value?.factory)
```

No edit state. No mutation handlers. No polling.

---

## Permissions / role gating

No frontend role gate. The factory section (Section E) is conditionally rendered with `v-if="hasFactory"`. The component trusts the backend to include or exclude the `factory` key based on the requester's role. The "Admin Only" label is decorative text — it applies no programmatic access control.

**[UNCLEAR]** — See Q-001.

---

## Bilingual labels (InternalString)

None. All labels are English-only.

---

## Empty / error / loading states

| State | Trigger | UI |
|---|---|---|
| Loading | `loading` | Spinner + "Calculating reconciliation..." |
| Load error | `loadReconciliation()` fails | `error` string displayed, no retry button |
| Net position positive | `r.final_net_position > 0` | Emerald advisory banner (credit balance) |
| Net position negative | `r.final_net_position < 0` | Rose advisory banner (outstanding balance) |
| Pending replacements | `r.pending_replacements > 0` | Blue advisory banner (carry-forward note) |
| No claims | `data.claims.total_claims === 0` | Claims table (Section C) hidden entirely |
| No factory data | `!hasFactory` | Section E hidden entirely |

---

## Business rules

1. **Read-only view**: No mutations. The reconciliation endpoint computes all aggregates server-side. The component displays results only.

2. **Conditional factory section**: Section E only renders when `data.factory` is present in the API response. The backend controls this via role-based response shaping. See Q-001 for the open [UNCLEAR].

3. **Margin % inline calculation**: `{{ r.revised_pi_total > 0 ? Math.round(data.factory.margin_inr / r.revised_pi_total * 100) : 0 }}%` — business logic in the template. Should be a computed.

4. **Claims conditional**: Section C only renders when `data.claims.total_claims > 0`. Empty orders (no flagged issues) show no claims section.

5. **Advisory banners**: Net position > 0 → credit balance message. Net position < 0 → outstanding balance message. Pending replacements → carry-forward note. These are mutually non-exclusive; credit balance and pending replacements can both show simultaneously.

6. **Payment count pluralization**: `data.payments.payment_count` drives "N payment(s)" label — inline ternary in template: `payment_count !== 1 ? 's' : ''`.

7. **`emit` not used**: No `defineEmits`. This component emits nothing — all changes shown are read-only snapshots.

---

## Known quirks / bugs

### Q-001 — Factory section has no frontend role gate — **[UNCLEAR D-004 family]**

```html
<div v-if="hasFactory" class="...">
  <h3>Factory Cost & Margin
    <span class="...">Admin Only</span>
  </h3>
  ...
  <p>Factory: {{ data.factory.name }}</p>
  <p>Factory Cost (CNY): ¥{{ data.factory.total_cny }}</p>
  <p>Factory Cost (INR): {{ formatINR(data.factory.total_inr) }}</p>
  <p>Gross Margin: {{ formatINR(data.factory.margin_inr) }}</p>
```

The "Admin Only" badge is a `<span>` with styling — it does not gate rendering. The entire section renders for any INTERNAL user if `data.factory` is non-null.

**[UNCLEAR]**: Does `GET /api/orders/{orderId}/reconciliation/` omit the `factory` key for non-admin users (FINANCE, OPERATIONS, etc.)? Or does it always include `factory` for all INTERNAL roles?

If the backend always includes `factory` → FINANCE and OPERATIONS roles can see factory cost and margin data. This would be a D-004 violation.

**Action required**: Read `backend/routers/orders.py` reconciliation endpoint handler. Confirm whether `factory` is conditionally included based on `current_user.role`. If not role-gated server-side, this is a HIGH finding.

### Q-002 — Margin % calculation in template

```html
{{ r.revised_pi_total > 0 ? Math.round(data.factory.margin_inr / r.revised_pi_total * 100) : 0 }}% margin
```

Business logic in template. Extract to a computed property `marginPercent` in the Next.js port.

### Q-003 — Error state has no retry mechanism

```html
<div v-else-if="error" class="py-12 text-center text-red-500">{{ error }}</div>
```

No retry button. If `loadReconciliation()` fails transiently, the user must reload the entire page. Add a "Retry" button.

### Q-004 — No export or download

No PDF or Excel export from this view. For completed orders, a financial summary PDF is potentially useful. Not a bug — feature gap. Note for migration planning.

---

## Dead code / unused state

- `props.order` is accepted but not used anywhere in the template or script. Only `props.orderId` is used. Either remove the `order` prop or document that it's reserved.

---

## Duplicate or inline utilities

- **`formatINR(val)`** — inline, P-001 instance. Identical pattern in `LandedCostTab.vue` (same session), `CustomsTab.vue`. All three should import from `utils/formatters.ts`. Extract as `formatINR`.
- **`formatType(type)`** — inline, replaces underscores + title-cases. `(type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())`. Candidate for `utils/formatters.ts` as `formatEnum()` or `humanizeEnum()`. Same pattern appears in several other tabs.

---

## Migration notes

1. **[UNCLEAR] resolution first**: Before porting, audit `backend/routers/orders.py` reconciliation endpoint for factory role gate. If not gated, add backend guard before Next.js port includes the factory section.

2. **Computed margin**: Extract `Math.round(data.factory.margin_inr / r.revised_pi_total * 100)` to a `marginPercent` computed:
   ```typescript
   const marginPercent = useMemo(() =>
     r.revised_pi_total > 0
       ? Math.round((data.factory.margin_inr / r.revised_pi_total) * 100)
       : 0,
     [data])
   ```

3. **Error state**: Add retry button after load error.

4. **`formatINR` + `formatType`**: Import from `src/lib/formatters.ts`. Do not inline.

5. **Factory section role gate (conditional)**: If backend audit confirms factory is always present in response, add frontend role check in Next.js:
   ```tsx
   {hasFactory && session?.user?.role !== 'OPERATIONS' && <FactorySection data={data.factory} />}
   ```
   But prefer backend fix.

6. **Component size is good**: 284 lines. Port with minimal structural change. Main work is the [UNCLEAR] resolution and shared formatter extraction.

7. **Unused `order` prop**: Remove from `defineProps` in Next.js port or add `required: false` with explanation.
