# Client Ledger

**Type:** page
**Portal:** client (`/client-portal/*` — `user_type === 'CLIENT'`)
**Route:** `/client-portal/ledger` → `ClientLedger`
**Vue file:** [frontend/src/views/client/ClientLedger.vue](../../../frontend/src/views/client/ClientLedger.vue)
**Line count:** 185
**Migration wave:** Wave 2 (client portal)
**Risk level:** low (read-only financial summary; shows aggregated payment/order totals scoped to the authenticated client; no mutation)

## Purpose (one sentence)
Read-only statement of account: three summary cards (total paid, order total, net position) plus a merged chronological transaction list combining orders and payments fetched from `ordersApi.myLedger()` — the same endpoint as the Payments tab in `ClientOrderDetail`.

## Layout (top→bottom, left→right, exhaustive)

### Outer container
`p-6 max-w-5xl mx-auto` — rendered inside `ClientLayout`'s `<router-view />` slot.

**Zone 1 — Page header**
- `h1` "Statement of Account" (`text-2xl font-bold text-slate-800`).
- `p` "Your payment history and order summaries" (`text-sm text-slate-500`).

**Loading state** (while `loading === true`):
`py-16 text-center text-slate-400`; `pi-spinner pi-spin`; "Loading...".

**Error state** (when `error` is non-empty):
`py-16 text-center text-red-500`; raw error message string (API detail or "Failed to load statement").

**Loaded state** (`v-else-if="ledger"` — all zones below are inside this branch):

**Zone 2 — Disclaimer banner**
`bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 flex items-start gap-2`
- `pi-info-circle text-amber-500`.
- "Order values are **approximate** until order completion. Final totals are calculated after delivery and reconciliation."

**Zone 3 — Summary cards** (`grid grid-cols-1 md:grid-cols-3 gap-4 mb-6`)

| Card | Label | Icon | Color | Value | Sub-row |
|---|---|---|---|---|---|
| 1 | "Total Paid" | `pi-wallet` (emerald-100 bg) | `text-emerald-700` | `summary.total_paid` via `formatINR()` | none |
| 2 | "Order Total" | `pi-shopping-cart` (blue-100 bg) | `text-blue-700` | `summary.total_orders` via `formatINR()` | Est: `total_estimated` (amber, shown if > 0) + Final: `total_final` (emerald, shown if > 0) |
| 3 | "Net Position" | `pi-chart-line` | emerald-100/red-100 bg depending on sign | `Math.abs(summary.net_position)` via `formatINR()` | "Credit (Overpaid)" (emerald) if ≥ 0; "Balance Due" (red) if < 0 |

**Zone 4 — Transactions table** (`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden`)

- Table header section: "Transactions" (`font-bold text-slate-800`) + "{n} entries" (`text-xs text-slate-400`).
- **Empty state** (`transactions.length === 0`): `py-12 text-center text-slate-400 text-sm`; "No transactions yet".
- **Populated table** (`w-full text-sm`):

Table header (`bg-slate-50`) columns: Date | Transaction | Details | Status | Debit (INR) | Credit (INR)

Table rows (`border-t border-slate-50 hover:bg-slate-50/50`) — two row types:

_Order row_ (type === `'order'`):
- Date: `new Date(o.created_at).toLocaleDateString()`.
- Transaction: `pi-file text-blue-500` + "Order {order_number}".
- Details: "{item_count} items".
- Status: APPROX badge (`bg-amber-100 text-amber-700`) if `!is_final`; FINAL badge (`bg-emerald-100 text-emerald-700`) if `is_final`.
- Debit: `formatINR(o.total_inr)` in `text-blue-700`.
- Credit: `—` (`text-slate-300`).

_Payment row_ (type === `'payment'`):
- Date: `new Date(p.payment_date).toLocaleDateString()`.
- Transaction: `pi-arrow-down text-emerald-500` + payment_type (underscores replaced with spaces).
- Details: method (underscores replaced) + `" — " + reference` (if present) + ` (order_number)` (if matched order found in `ledger.orders`).
- Status: CONFIRMED badge (`bg-emerald-100 text-emerald-700`) always.
- Debit: `—` (`text-slate-300`).
- Credit: `formatINR(p.amount_inr)` in `text-emerald-700`.

## Data displayed

| Field | Source | Format | Notes |
|---|---|---|---|
| `summary.total_paid` | `ordersApi.myLedger()` | `formatINR()` | Sum of confirmed payments |
| `summary.total_orders` | `ordersApi.myLedger()` | `formatINR()` | Combined order value |
| `summary.total_estimated` | `ordersApi.myLedger()` | `formatINR()` | Shown only when > 0 |
| `summary.total_final` | `ordersApi.myLedger()` | `formatINR()` | Shown only when > 0 |
| `summary.net_position` | `ordersApi.myLedger()` | `formatINR(Math.abs(...))` | Sign conveyed via color + label |
| `o.order_number` | merged transactions | string | "Order {number}" |
| `o.item_count` | merged transactions | integer | "{n} items" |
| `o.total_inr` | merged transactions | `formatINR()` | Debit column |
| `o.is_final` | merged transactions | boolean → APPROX/FINAL badge | |
| `o.status` | merged transactions | present in row object | **never rendered in table** — dead field |
| `p.payment_date` | merged transactions | `toLocaleDateString()` | Date column |
| `p.payment_type` | merged transactions | underscores → spaces | Transaction label |
| `p.method` | merged transactions | underscores → spaces | Part of Details |
| `p.reference` | merged transactions | plain string | Appended to Details if present |
| `p.amount_inr` | merged transactions | `formatINR()` | Credit column |

**Pricing exposure note:** `total_inr` on order rows and `amount_inr` on payment rows are rendered; these are client-facing amounts (INR totals), not factory prices or margins. No internal-only fields are exposed.

## Interactions (every clickable/typeable element)

None. The page is entirely read-only; no click handlers beyond page mount, no navigation links, no forms.

## Modals/dialogs triggered

None.

## API endpoints consumed

| Method | Endpoint | Via | Params | Notes |
|---|---|---|---|---|
| GET | `/api/orders/my-ledger/` | `ordersApi.myLedger()` | none | Returns `{ orders[], payments[], summary: { total_paid, total_orders, total_estimated, total_final, net_position } }`. Scoped server-side to the authenticated client. Same endpoint called by the Payments tab in `ClientOrderDetail.vue`. |

> Per D-001 (Option B): in Next.js this becomes `client.orders.myLedger()` (or `client.ledger.get()` if the SDK groups it separately) via the generated SDK.

## Composables consumed

None. This page does not call `useAuth`.

## PrimeVue components consumed

None. All UI is hand-rolled Tailwind + PrimeIcons icon classes (`pi-spinner`, `pi-spin`, `pi-info-circle`, `pi-wallet`, `pi-shopping-cart`, `pi-chart-line`, `pi-file`, `pi-arrow-down`).

## Local state

- `loading: ref(true)` — initialized `true`; set `false` after `loadLedger()` completes (success or error).
- `error: ref('')` — populated with `e.response?.data?.detail || 'Failed to load statement'` on API failure.
- `ledger: ref(null)` — full API response object.
- `summary: computed(() => ledger.value?.summary || {})` — summary sub-object; guarded against null.
- `transactions: computed(...)` — client-side merge of `ledger.orders[]` + `ledger.payments[]` into a unified array, sorted by date descending (`new Date(b.date || 0) - new Date(a.date || 0)`). Entries with null/missing dates sort to the bottom.

No `watch`. No `onUnmounted`.

## Permissions / role gating

- Route is under `ClientLayout`; `router.beforeEach` restricts access to `user_type === 'CLIENT'` ([router/index.js:373-388](../../../frontend/src/router/index.js#L373)).
- `ordersApi.myLedger()` endpoint scopes data server-side to the authenticated client.
- No per-field permission checks in this component.
- **[UNCLEAR — needs Sachin review: `ClientOrderDetail.vue` gates the Payments tab on `portalPerms.show_payments`; `ClientLedger.vue` has no such check. A client with `show_payments = false` can still navigate directly to `/client-portal/ledger` and see full payment data. Should the ledger route respect the `show_payments` portal permission?]**

## Bilingual labels (Tamil + English pairs)

| Key | en | ta | Type |
|---|---|---|---|
| `client.ledger.title` | "Statement of Account" | `""` | PortalString |
| `client.ledger.subtitle` | "Your payment history and order summaries" | `""` | PortalString |
| `client.ledger.loading` | "Loading..." | `""` | PortalString |
| `client.ledger.disclaimer` | "Order values are approximate until order completion. Final totals are calculated after delivery and reconciliation." | `""` | PortalString |
| `client.ledger.card_total_paid` | "Total Paid" | `""` | PortalString |
| `client.ledger.card_order_total` | "Order Total" | `""` | PortalString |
| `client.ledger.card_est` | "Est" | `""` | PortalString |
| `client.ledger.card_final` | "Final" | `""` | PortalString |
| `client.ledger.card_net_position` | "Net Position" | `""` | PortalString |
| `client.ledger.net_credit` | "Credit (Overpaid)" | `""` | PortalString |
| `client.ledger.net_due` | "Balance Due" | `""` | PortalString |
| `client.ledger.tx_title` | "Transactions" | `""` | PortalString |
| `client.ledger.tx_entries` | "{n} entries" | `""` | PortalString |
| `client.ledger.tx_empty` | "No transactions yet" | `""` | PortalString |
| `client.ledger.col_date` | "Date" | `""` | PortalString |
| `client.ledger.col_transaction` | "Transaction" | `""` | PortalString |
| `client.ledger.col_details` | "Details" | `""` | PortalString |
| `client.ledger.col_status` | "Status" | `""` | PortalString |
| `client.ledger.col_debit` | "Debit (INR)" | `""` | PortalString |
| `client.ledger.col_credit` | "Credit (INR)" | `""` | PortalString |
| `client.ledger.badge_approx` | "APPROX" | `""` | PortalString |
| `client.ledger.badge_final` | "FINAL" | `""` | PortalString |
| `client.ledger.badge_confirmed` | "CONFIRMED" | `""` | PortalString |
| `client.ledger.error_load` | "Failed to load statement" | `""` | PortalString |

[UNCLEAR — needs Sachin review: Tamil translations required for all `PortalString` entries before Wave 2 is migration-ready (D-005).]

## Empty / error / loading states

- **Loading:** full-page `py-16` centered spinner + "Loading..."; summary cards and transactions table not rendered.
- **Error:** `py-16` centered container with `text-red-500` showing the raw API error detail string (`e.response?.data?.detail`) or the fallback "Failed to load statement". The raw detail string may expose backend implementation details (e.g. "Authentication credentials were not provided."). Summary cards and table are hidden.
- **Empty (no transactions):** summary cards render with `₹0.00` across the board; the table zone shows "No transactions yet".

## Business rules (non-obvious)

1. **`ordersApi.myLedger()` is shared with `ClientOrderDetail` Payments tab.** Both pages call the identical endpoint. No deduplication — if a user has both open simultaneously, two independent API calls are made.
2. **`transactions` is a client-side merge.** The server returns separate `orders[]` and `payments[]` arrays; the computed property joins them and sorts by date descending. The sort key is `b.date || 0`, so missing dates land at the bottom.
3. **Net position is shown as absolute value.** `Math.abs(summary.net_position)` is always displayed; the sign is conveyed through color (emerald = credit, red = balance due) and the sub-label.
4. **`o.status` is populated in each order row object but never rendered.** The table has no order-status column; only APPROX/FINAL/CONFIRMED badges based on `is_final` are shown.
5. **No pagination.** All transactions are fetched and rendered in a single request. Large ledgers will produce a long table with all rows in DOM.

## Known quirks

- **`formatINR` is a local duplicate** of `frontend/src/utils/formatters.js:formatINR`. Both produce `₹X,XX,XXX.XX` via `toLocaleString('en-IN')`. Should be imported from the shared utility.
- **`show_payments` portal permission not respected.** `ClientOrderDetail.vue` gates the Payments tab on `portalPerms.show_payments`; this page has no equivalent guard. A client with payments disabled can still reach full ledger data via the direct URL.
- **Raw API error detail rendered to user.** `e.response?.data?.detail` is set directly into the `error` ref and displayed verbatim. Backend error strings (e.g. "Authentication credentials were not provided.") are shown to clients.
- **No pagination.** Clients with large order histories will receive all rows at once; no server-side page control exists.

## Dead code / unused state

- `o.status` is included in each order entry pushed into `transactions` (line 37: `status: o.status`) but there is no table column or template branch that consumes it.

## Migration notes

- **D-001:** `ordersApi.myLedger()` → `client.orders.myLedger()` (or equivalent SDK method) via generated SDK.
- **D-005:** All visible strings are `PortalString`. Tamil translations required before Wave 2 ships.
- **Layer 2 components needed:** `LedgerSummaryCard`, `TransactionTable`, `TransactionRow`, `AmountCell`.
- **Fix in Next.js — remove `formatINR` duplicate.** Import from the shared formatters utility.
- **Fix in Next.js — respect `show_payments` permission.** Add a route-level or component-level guard that redirects to `/client-portal/` if `portalPerms.show_payments === false`, matching the gate in `ClientOrderDetail.vue`.
- **Fix in Next.js — sanitize error display.** Show a generic user-friendly message (e.g. "Could not load your statement — please try again."); log the raw detail server-side rather than rendering it to the client.
- **Fix in Next.js — remove dead `o.status` from transaction rows**, or add an order status badge column if it provides value to clients.
- **Open questions for Sachin:**
  1. Should `/client-portal/ledger` be gated on the `show_payments` portal permission flag?
  2. Should the transactions list support pagination for clients with many orders?
  3. Tamil copy for all labels — translator review needed before Wave 2 ships.
