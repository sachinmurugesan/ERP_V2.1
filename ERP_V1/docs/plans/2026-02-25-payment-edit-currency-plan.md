# Implementation Plan: Payment Inline Editing & Currency Enhancements

**Date:** 2026-02-25
**Design:** `2026-02-25-payment-edit-currency-design.md`

## Tasks

### Task 1: Backend — Payment Update Endpoints
**File:** `backend/routers/finance.py`

Add update schemas and PUT endpoints for both payment types:

1. Add `PaymentUpdate` schema (all fields optional except none required)
2. Add `FactoryPaymentUpdate` schema (all fields optional)
3. Add `PUT /orders/{order_id}/payments/{payment_id}/` endpoint:
   - Load payment, verify it belongs to the order
   - Update only provided fields
   - Recompute `amount_inr = amount * exchange_rate`
   - Return updated `PaymentOut`
4. Add `PUT /orders/{order_id}/factory-payments/{payment_id}/` endpoint:
   - Same pattern as client payment update
   - Return updated `FactoryPaymentOut`

### Task 2: Backend — USD Normalization on Factory Payment List
**File:** `backend/routers/finance.py`

Enhance the `GET /orders/{order_id}/factory-payments/` endpoint:

1. Fetch USD→INR rate from `ExchangeRate` table
2. For each payment, compute `amount_usd`:
   - If currency == USD: `amount_usd = amount`
   - Else: `amount_usd = amount_inr / usd_inr_rate`
3. Add `amount_usd` to `FactoryPaymentOut` schema
4. Add to summary: `total_usd`, `avg_exchange_rate_usd` (= total_inr / total_usd)

### Task 3: Backend — USD + Currency Fields on Factory Ledger
**File:** `backend/routers/finance.py`

Enhance `GET /factory-ledger/{factory_id}/`:

1. Fetch USD→INR rate
2. For each entry (debit and credit), compute and add `amount_usd`
3. Add to summary: `total_debit_usd`, `total_credit_usd`, `net_balance_usd`
4. Update Excel and PDF download functions to include Currency, Rate, USD columns

### Task 4: Frontend — API Methods for Payment Update
**File:** `frontend/src/api/index.js`

Add to `paymentsApi`:
- `update: (orderId, paymentId, data) => api.put(`/finance/orders/${orderId}/payments/${paymentId}/`, data)`
- `factoryUpdate: (orderId, paymentId, data) => api.put(`/finance/orders/${orderId}/factory-payments/${paymentId}/`, data)`

### Task 5: Frontend — Inline Payment Editing in OrderDetail
**File:** `frontend/src/views/orders/OrderDetail.vue`

1. Add state: `editingPaymentId`, `editingFactoryPaymentId`, `editForm`
2. Add functions: `startEditPayment(p)`, `saveEditPayment()`, `cancelEditPayment()`
3. Same for factory: `startEditFactoryPayment(p)`, `saveEditFactoryPayment()`, `cancelEditFactoryPayment()`
4. Template: Client payment rows — conditional inputs when editing
5. Template: Factory payment rows — conditional inputs when editing
6. Each row's action column: Edit/Delete when not editing, Save/Cancel when editing
7. Update factory payment summary card with Total Paid (USD) and Avg Rate

### Task 6: Frontend — Factory Ledger Currency Columns
**File:** `frontend/src/views/finance/FactoryLedger.vue`

1. Add Currency and Forex Rate columns to the ledger table (between Remark and Debit)
2. Display `e.currency` and `e.exchange_rate` for each entry
3. Update footer colspan
4. Backend already returns these fields — just need to render them

### Task 7: Verification
End-to-end testing:
1. Edit a client payment — verify amount_inr recalculates
2. Edit a factory payment — verify save works and list refreshes
3. Check factory payment summary shows USD total and avg exchange rate
4. Check factory ledger shows currency and rate columns
5. Verify factory ledger debit/credit USD values are correct
6. Test Excel/PDF download includes new columns
