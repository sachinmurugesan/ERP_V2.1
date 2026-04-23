# Profile: ordertab_payments

## Metadata
- **Source file:** `frontend/src/components/order/PaymentsTab.vue`
- **Lines:** 1,454
- **Type:** component (sub-tab)
- **Portal:** internal
- **Tab slug:** `payments`
- **Parent shell:** `OrderDetail.vue`
- **Wave:** Wave 8
- **Profile generated:** 2026-04-22

---

## Purpose

Full payment lifecycle management for an order. Covers client-side payments (advance + balance), factory remittances, PI revision history, credit application (client and factory overpayment credits), pending payment verification (approve/reject client-submitted proofs), and a detailed payment audit log with before/after diff display. This is the primary financial tab for INTERNAL users managing order cash flow.

---

## Layout / visual structure

```
┌─────────────────────────────────────────────────────────────────┐
│ PI Revision History (collapsible)                               │
│   Each revision: PI number, date, total INR, items changed     │
│                                                                 │
│ Revised Proforma Invoice Banner (if revision exists)           │
│   Original PI total (strikethrough) → Revised total           │
│                                                                 │
│ Pending Payment Verifications Panel                             │
│   Client-submitted payments awaiting INTERNAL review           │
│   Per payment: amount, date, proof file link                   │
│   Actions: [Approve] [Reject] (reject → reason inline input)   │
│                                                                 │
│ Client Payments (post-PI) — green-bordered section             │
│   Header: [Excel] [PDF] [Record Payment]                       │
│   Financial Summary: PI Total | Paid | Balance | % | Credits  │
│   Progress bar                                                  │
│   Overpayment surplus notice (when balance < 0)                │
│   Available Credits Banner (credits from other orders)         │
│     Per credit: source order, amount, note, [Apply Credit]    │
│   Payment History Table                                         │
│     # | Date | Type | Method | Amount | Rate | INR | Ref | Sts │
│     Inline edit mode per row (pencil icon)                     │
│     Rejected rows at 30% opacity                               │
│                                                                 │
│ Factory Payments (Stage 6+) — blue-bordered section            │
│   Header: [Excel] [PDF] [Record Remittance]                    │
│   Factory Bill Summary: Bill | Paid | Balance | % | Count      │
│   Progress bar                                                  │
│   Available Factory Credits Banner                              │
│   Factory Payment History Table                                 │
│     # | Date | Method | Amount | Rate | INR | Ref | Actions   │
│     Inline edit mode per row                                    │
│                                                                 │
│ Payment Audit Log (collapsible)                                 │
│   Per entry: action icon, CREATE/UPDATE/DELETE, Client/Factory │
│   Expanded: before/after diff grid for UPDATE; full data for   │
│   CREATE and DELETE                                             │
├─────────────────────────────────────────────────────────────────┤
│ Record Payment Modal (unified for client + factory)             │
│   Type selector | Amount | Currency | Exchange Rate            │
│   Computed INR (read-only) | Method | Reference | Date | Notes │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data displayed

| Section | Fields |
|---|---|
| PI summary | `paymentSummary.pi_total_inr`, `revised_client_total_inr`, `total_paid_inr`, `balance_inr`, `revised_balance_inr`, `has_revisions` |
| Surplus/credit notice | `paymentSummary.revised_balance_inr` (negative = overpayment), `revised_client_total_inr` |
| Credit items | `credit.source_order_number`, `credit.amount`, `credit.notes`, applied status |
| Payment rows | `p.payment_date`, `p.payment_type`, `p.method`, `p.amount`, `p.currency`, `p.exchange_rate`, `p.amount_inr`, `p.reference`, `p.verification_status`, `p.surplus_inr`, `p.utilized_inr` |
| Factory bill | `factoryPaymentSummary.factory_total_inr`, `factory_total_cny`, `factory_currency`, `total_inr`, `balance_inr`, `paid_percent`, `currency_totals`, `remittance_count` |
| Audit log entries | `entry.action` (CREATE/UPDATE/DELETE), `entry.payment_table` (client/factory), `entry.created_at`, `entry.changed_fields`, `entry.before_data`, `entry.after_data` |

---

## Interactions

| Action | Handler | API |
|---|---|---|
| Record client payment | `openPaymentModal('CLIENT_ADVANCE')` → `savePayment()` | `paymentsApi.create` |
| Record factory payment | `openPaymentModal('FACTORY_PAYMENT')` → `savePayment()` | `paymentsApi.factoryCreate` |
| Edit payment (inline) | `startEditPayment(p)` → `saveEditPayment()` | `paymentsApi.create` (update variant) |
| Delete client payment | `deletePayment(id)` | `paymentsApi.delete` |
| Delete factory payment | `deleteFactoryPayment(id)` | `paymentsApi.factoryDelete` |
| Approve pending verification | `handleVerifyPayment(id, 'approve')` | `paymentsApi.verifyPayment` |
| Reject pending verification | `rejectingPaymentId = p.id` → reason input → `handleVerifyPayment(id, 'reject')` | `paymentsApi.verifyPayment` |
| Apply client credit | `applyClientCredit(credit)` | `financeApi.applyCredit` |
| Apply factory credit | `applyFactoryCredit(credit)` | `financeApi.applyFactoryCredit` |
| Download client report | `downloadClientPaymentReport('xlsx' or 'pdf')` | `paymentsApi.downloadPaymentReport` |
| Download factory report | `downloadFactoryPaymentReport('xlsx' or 'pdf')` | `paymentsApi.downloadFactoryPaymentReport` |
| View proof file | `viewProofFile(paymentId)` | backend file URL (implied) |
| Toggle audit log | `toggleAuditLog()` → `loadAuditLog()` on first open | `financeApi.auditLog` |
| Toggle audit detail | `toggleAuditDetail(entry.id)` | none (local expand/collapse) |
| Scroll to section (via highlightSection prop) | `scrollIntoView()` on relevant ref | none |

---

## Modals / dialogs triggered

**Record Payment Modal** — single modal unified for CLIENT_ADVANCE, CLIENT_BALANCE, and FACTORY_PAYMENT types. Selected via the payment type dropdown inside the modal. Fields: type, amount, currency (INR/USD/CNY/EUR/GBP/JPY), exchange rate (disabled when INR), computed INR preview (read-only), method (BANK_TRANSFER/CHEQUE/CASH/UPI/LC), reference, date, notes. Color theme switches between green (client) and blue (factory) based on type.

No other modals. Rejection reason input for payment verification is inline (not a separate modal) — a conditional text input + confirm/cancel buttons appear in the pending verification row.

---

## API endpoints consumed

| Endpoint | Purpose |
|---|---|
| `paymentsApi.list(orderId)` | Load client payment list + summary |
| `paymentsApi.factoryList(orderId)` | Load factory payment list + summary |
| `paymentsApi.create(orderId, form)` | Record new client payment |
| `paymentsApi.factoryCreate(orderId, form)` | Record new factory remittance |
| `paymentsApi.delete(paymentId)` | Delete client payment |
| `paymentsApi.factoryDelete(paymentId)` | Delete factory payment |
| `paymentsApi.verifyPayment(paymentId, { action, reason })` | Approve or reject client-submitted payment |
| `paymentsApi.downloadPaymentReport(orderId, format)` | Download client payment report (xlsx/pdf) |
| `paymentsApi.downloadFactoryPaymentReport(orderId, format)` | Download factory payment report |
| `financeApi.piHistory(orderId)` | PI revision history |
| `financeApi.clientCredits(orderId)` | Available client credits (from this + other orders) |
| `financeApi.factoryCredits(orderId)` | Available factory credits |
| `financeApi.applyCredit(orderId, creditId)` | Apply client credit to this order |
| `financeApi.applyFactoryCredit(orderId, creditId)` | Apply factory credit to this order |
| `financeApi.auditLog(orderId)` | Payment audit log (lazy-loaded on first open) |

---

## Composables consumed

None directly. No `useAuth` import in this component — role-gating is handled at the parent shell level (payments tab only appears post-PI). The `paymentsApi.verifyPayment` action should be FINANCE-gated server-side (see Security note below).

---

## PrimeVue components consumed

PrimeVue Icons (`pi-*`) for iconography throughout. No PrimeVue overlay or form components — all inputs are native HTML, the modal is a custom fixed-overlay Tailwind component.

---

## Local state

```javascript
const payments = ref([])
const factoryPayments = ref([])
const paymentSummary = ref({})
const factoryPaymentSummary = ref({})
const allClientCredits = ref([])
const allFactoryCredits = ref([])
const piHistory = ref([])
const auditLog = ref([])

// Edit mode
const editingPaymentId = ref(null)
const editingFactoryPaymentId = ref(null)
const editForm = ref({})             // Shared form object for inline editing

// Verification
const rejectingPaymentId = ref(null)
const rejectReason = ref('')

// Record payment modal
const showPaymentModal = ref(false)
const paymentForm = ref({ payment_type, amount, currency, exchange_rate, method, reference, payment_date, notes })
const computedAmountInr = computed(() => (amount || 0) * (exchange_rate || 1))
const paymentSaving = ref(false)

// Download state
const downloadingClientReport = ref(false)
const downloadingFactoryReport = ref(false)

// Audit log
const showAuditLog = ref(false)
const expandedAuditId = ref(null)
const auditLogLoaded = ref(false)     // Lazy-load guard

// Credit application
const applyingCredit = ref(false)
const applyingFactoryCredit = ref(false)

// Computed
const revisedPaidPercent = computed(() => ...)
const isOrderFullyPaid = computed(() => ...)
const isFactoryFullyPaid = computed(() => ...)
const totalCreditBalance = computed(() => ...)

// Highlight/scroll
// Props.highlightSection watched → scrollIntoView on addPaymentRef / factoryPaymentRef / piActionsRef
```

---

## Permissions / role gating

| Feature | Gate |
|---|---|
| Tab visibility | Post-PI status (gated by `availableTabs` in parent shell — no role gate) |
| Record client payment | All INTERNAL roles (no client-side role check observed in component) |
| Record factory payment | All INTERNAL roles (displayed when `isStage6Plus`) |
| Verify payment (approve/reject) | **VERIFIED CLEAN** — `verify_payment` (finance.py:640) carries both router-level `require_finance` (ADMIN\|SA\|FINANCE) and an inline `role not in ("ADMIN","SUPER_ADMIN","FINANCE")` check. OPERATIONS cannot call this endpoint. D-004 `verify_payments` permission compliant. See `PAYMENT_AUTHZ_AUDIT.md`. |
| Apply credit | All INTERNAL roles (no client-side role check) |
| Download reports | All INTERNAL roles |

**Security note (RESOLVED 2026-04-22):** `verify_payment` (finance.py:640) is double-gated: router-level `require_finance` (ADMIN|SUPER_ADMIN|FINANCE) + inline `role not in ("ADMIN","SUPER_ADMIN","FINANCE")`. No separate `payments.py` file exists — all payment logic is in `finance.py`. Full audit in `docs/migration-audit/PAYMENT_AUTHZ_AUDIT.md`.

**D-010 RATIFIED 2026-04-22 — backend CONFIRMED COMPLETE:** OPERATIONS cannot see the Factory Payments section. All four factory payment endpoints (`GET/POST/PUT/DELETE /orders/{id}/factory-payments/`) and all factory financial endpoints use `require_factory_financial = require_role([SUPER_ADMIN, FINANCE])` — OPERATIONS already receives 403. No code change required. Frontend hides Factory Payments section for OPERATIONS (defence-in-depth — Wave 0 frontend task remaining). See Q-002 below.

---

## Bilingual labels (InternalString)

None. All labels English-only.

---

## Empty / error / loading states

- **No payments**: Client section shows "No payments recorded yet. Click 'Record Payment' to add one." Factory section shows equivalent message.
- **No pending verifications**: Verification panel hidden.
- **Loading**: Per-section `loading` ref shows spinner while `Promise.all` resolves on mount.
- **Payment save error**: No inline error state confirmed in the 1,454-line component for `savePayment()` failures — errors appear to be logged to console only (P-002 instance). In Next.js, surface via toast or inline banner.
- **Audit log empty**: "No payment changes recorded yet" placeholder with inbox icon.
- **Overpayment**: Inline informational notice below progress bar explains surplus and credit creation — not an error state.
- **Reject without reason**: Confirm Reject button is disabled until `rejectReason.trim()` is non-empty.
- **Credit from same order**: Apply button hidden; replaced with "This order's overpayment" label.
- **Highlight flash**: CSS animation `highlight-flash` (box-shadow pulse over 2.5s) applied to a section when `highlightSection` prop matches. Used for deep-link navigation from other tabs.

---

## Business rules

1. **Payments tab progressive visibility**: Only appears in `availableTabs` when `isPostPI` (order has passed the PI generation stage). Before PI, this tab is absent from the tab strip.
2. **Factory payments section**: Only rendered when `isStage6Plus` (order has reached factory order stage). Client payments section always visible once tab appears.
3. **Revised PI handling**: When `paymentSummary.has_revisions` is true, the UI shows the revised total with the original struck through. Balance and progress percentage are computed against the revised total. Surplus from PI revision (paid more than revised total) is explained inline.
4. **Credit application rules**: Credits from OTHER orders can be applied; credits originating from THIS order are displayed but not applicable (they represent overpayment on this order itself). Apply button hidden when `credit.source_order_id === orderId`.
5. **Inline payment edit**: Clicking the pencil icon on a payment row puts that row in inline edit mode. Edit form is a shared `editForm` ref. Only one row editable at a time. Saving calls the appropriate update endpoint.
6. **Audit log lazy-load**: `loadAuditLog()` is called only on first toggle open (`auditLogLoaded` guard). Subsequent toggles re-render from cached data.
7. **Verification reject flow**: Rejecting is a two-step inline flow — clicking Reject shows a reason input in-row; clicking Confirm Reject (disabled until reason non-empty) submits. Clicking Cancel reverts to approve/reject buttons.
8. **Currency totals for factory**: Factory payment summary shows `currency_totals` — a breakdown of remittances by currency (e.g., CNY: 50000, USD: 1200). This accounts for mixed-currency factory payment scenarios.
9. **Exchange rate auto-disable**: In the payment modal, exchange rate field is disabled (styled as read-only) when currency is INR. Computed INR preview updates reactively.

---

## Known quirks / bugs

### Q-001 — verifyPayment role gate — RESOLVED CLEAN (2026-04-22)

`paymentsApi.verifyPayment` maps to `POST /api/finance/payments/{payment_id}/verify/` at `finance.py:640`. There is no `payments.py` router — all payment logic is in `finance.py`.

Backend enforcement confirmed:
- **Router-level**: `require_finance` dependency on the main finance router → ADMIN|SUPER_ADMIN|FINANCE
- **Inline check**: `if current_user.role not in ("ADMIN", "SUPER_ADMIN", "FINANCE"): raise HTTPException(403)`

OPERATIONS role cannot call this endpoint. D-004 compliance verified. Full audit: `PAYMENT_AUTHZ_AUDIT.md`.

**Remaining UX gap**: No *client-side* role check in `PaymentsTab.vue` — the Approve/Reject buttons are visible to all INTERNAL users. Migration note 4 below addresses defence-in-depth.

### Q-002 — Factory payments expose factory cost data without D-004 role gate — RESOLVED 2026-04-22 via D-010
The Factory Payments section renders `factoryPaymentSummary.factory_total_inr` and `factory_total_cny` (total factory cost) to all INTERNAL users who can view the payments tab. The tab itself has no role gate — any INTERNAL user (including OPERATIONS) who opens an order post-PI can currently see the full factory billing amounts.

**RESOLVED 2026-04-22 via D-010:** OPERATIONS cannot see the Factory Payments section. Decision rationale: Scenario 2 (growing team, external hires expected) — supplier payment amounts belong with the finance function, not logistics execution.

**Backend CONFIRMED COMPLETE (2026-04-22):** All four factory payment endpoints (`GET/POST/PUT/DELETE /orders/{order_id}/factory-payments/`) and all factory financial endpoints carry `_: None = Depends(require_factory_financial)`. `require_factory_financial = require_role([UserRole.SUPER_ADMIN, UserRole.FINANCE])` — OPERATIONS already receives **403 Forbidden** before any handler executes. The `require_finance` guard (ADMIN|FINANCE) applies to `verify_payment` separately. No code change was required for factory payment access control.

Frontend: PaymentsTab must hide the Factory Payments section when `current_user.role === 'OPERATIONS'`. In the Next.js rebuild use `hasPermission(user, 'view_factory_real_pricing')` (D-004 matrix). Backend enforcement is the primary control; frontend is defence-in-depth.

### Q-003 — Shared editForm ref for client and factory payments
Both client and factory payment inline-edit flows use the same `editForm` ref. If a client payment row is in edit mode and the user scrolls to factory payments and clicks edit on a factory payment, the same `editForm` is reused, and the previous edit state is overwritten silently. Only one payment (across both sections) can be in edit mode at a time — but there is no UI enforcement of this constraint.

---

## Dead code / unused state

None identified. All state refs are actively used.

---

## Duplicate or inline utilities

None observed. This component correctly imports `formatDate` and `formatCurrency` from `utils/formatters.js` (not P-001). Inline utility functions observed: `formatPaymentType(type)`, `formatPaymentMethod(method)`, `formatFieldLabel(key)`, `formatFieldValue(val)`, `auditActionColor(action)`, `auditActionIcon(action)` — these are component-local mapping functions. They may be worth extracting to a shared payments utility module if used elsewhere.

---

## Migration notes

1. **Unified payment form → dedicated forms**: The single Record Payment modal handles three payment types via a dropdown. In the Next.js rebuild, split into two separate forms: `RecordClientPaymentForm` and `RecordFactoryRemittanceForm`. This removes the type-conditional rendering and makes each form's required fields clear.

2. **Audit log → dedicated API with pagination**: The audit log loads all entries in one call with no pagination. For orders with hundreds of payment changes, this becomes a large response. Add `page`/`limit` params to the audit log endpoint; implement virtual scroll or pagination in the UI.

3. **Credit application flow**: The current UI requires scrolling to find credits and clicking "Apply Credit" — no confirmation dialog. In the Next.js rebuild, add a confirmation step: "Apply ₹X,XXX credit from ORD-NNN to this order?" to prevent accidental credit application.

4. **verifyPayment role enforcement (server confirmed, UI defence-in-depth needed)**: Backend is correctly gated at ADMIN|SUPER_ADMIN|FINANCE (verified 2026-04-22). In Next.js, add a client-side check using `hasPermission(user, 'verify_payments')` (D-004 matrix) before rendering Approve/Reject buttons. The server check is the primary control; the UI check prevents visual confusion for OPERATIONS users who have tab access but cannot act.

5. **Inline edit state isolation**: Replace shared `editForm` ref with per-row edit state (e.g., `editingRow: { id, form } | null`). Ensure only one row can be in edit mode at a time with explicit enforcement.

6. **PI history section → dedicated sub-view**: The PI revision history table is collapsed by default but could be a high-value feature if made more prominent. In Next.js, consider making PI history accessible via a dedicated nested route (`/orders/[id]/payments/pi-history`) or a sheet panel.

7. **D-010 RATIFIED 2026-04-22 — backend CONFIRMED COMPLETE:** OPERATIONS cannot see Factory Payments. Factory payment endpoints already gate OPERATIONS via `require_factory_financial` — no backend change required. In the Next.js rebuild, gate the Factory Payments section using `hasPermission(user, 'view_factory_real_pricing')` as defence-in-depth (Wave 0 frontend task — see `SECURITY_BACKLOG.md` Task 4).

8. **highlightSection prop → URL hash**: Replace prop-driven `scrollIntoView` with URL hash navigation (`/orders/[id]/payments#factory-payments`). The Next.js router's hash-based scrolling handles this natively.
