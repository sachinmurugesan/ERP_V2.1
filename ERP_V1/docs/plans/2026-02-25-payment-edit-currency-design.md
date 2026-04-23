# Design: Payment Inline Editing & Currency Enhancements

**Date:** 2026-02-25
**Status:** Approved

## Overview

Two enhancements to the payment system:

1. **Inline payment editing** — edit any payment record in-place with a save button
2. **Currency columns + USD normalization** — show currency/rate on factory ledger, compute average exchange rate per order, normalize all factory payments to USD equivalent

---

## 1. Inline Payment Editing

### Behavior

- Each payment row (client and factory) gets an **Edit** icon button alongside Delete
- Clicking Edit switches that row into edit mode: cells become input fields
- **Save** and **Cancel** buttons replace Edit/Delete while editing
- Only one row editable at a time (starting edit on another row cancels the current edit)
- On Save: calls PUT endpoint, recomputes `amount_inr` server-side, reloads list
- On Cancel: reverts to display mode, no API call

### Editable Fields

| Field | Input Type | Notes |
|-------|-----------|-------|
| payment_date | date input | |
| payment_type | select (client only) | CLIENT_ADVANCE / CLIENT_BALANCE |
| method | select | BANK_TRANSFER, CHEQUE, CASH, UPI, LC |
| amount | number input | Original currency amount |
| currency | select | INR/USD/CNY/EUR/GBP/JPY |
| exchange_rate | number input | Auto-fills from settings on currency change |
| reference | text input | |
| notes | text input | Not shown in table, editable in expanded area |

### Backend Changes

- `finance.py`: Add `PaymentUpdate` schema (all fields optional)
- `finance.py`: Add `FactoryPaymentUpdate` schema (all fields optional)
- `finance.py`: Add `PUT /orders/{order_id}/payments/{payment_id}/` — update client payment
- `finance.py`: Add `PUT /orders/{order_id}/factory-payments/{payment_id}/` — update factory payment
- Both recompute `amount_inr = amount * exchange_rate` on save

### Frontend Changes

- `api/index.js`: Add `update()` and `factoryUpdate()` methods
- `OrderDetail.vue`: Add `editingPaymentId`, `editingFactoryPaymentId` refs
- `OrderDetail.vue`: Add `editForm` ref + `startEdit()`, `saveEdit()`, `cancelEdit()` functions
- Template: Conditional rendering — inputs when editing, text when not

---

## 2. Currency Columns & USD Normalization

### USD Normalization Logic

All factory payments are normalized to USD regardless of original payment currency:

```
If currency == USD:
    amount_usd = amount
Else:
    amount_usd = amount_inr / usd_inr_rate
```

Where `usd_inr_rate` is fetched from the ExchangeRate table (the stored USD→INR rate).

### Average Exchange Rate per Order

For factory payments on an order, the average effective exchange rate (USD→INR) is:

```
avg_exchange_rate = total_amount_inr / total_amount_usd
```

This is a weighted average — larger payments carry more weight, which is financially correct.

### Backend Changes

**Factory payments list endpoint** (`GET /orders/{order_id}/factory-payments/`):
- Fetch USD→INR rate from ExchangeRate table
- For each payment, compute and return `amount_usd`
- In summary, add: `total_usd`, `avg_exchange_rate_usd` (= total_inr / total_usd)

**Factory ledger endpoint** (`GET /factory-ledger/{factory_id}/`):
- Each entry already has `amount_foreign`, `currency`, `exchange_rate`
- Add `amount_usd` field to each entry (debit and credit)
- In summary, add `total_debit_usd`, `total_credit_usd`, `net_balance_usd`

**FactoryPaymentOut schema:**
- Add optional `amount_usd: float` field

### Frontend Changes

**FactoryLedger.vue:**
- Add two new columns between Remark and Debit: **Currency** and **Forex Rate**
- These are already returned by backend (`currency`, `exchange_rate`) — just display them
- Credit entries show the payment currency + rate
- Debit entries show the order currency (CNY) + rate

**OrderDetail.vue — Factory Payment Summary:**
- Add to summary card: **Total Paid (USD)**, **Avg Rate (USD→INR)**
- Display `factoryPaymentSummary.total_usd` and `factoryPaymentSummary.avg_exchange_rate_usd`

**OrderDetail.vue — Factory Payment Table:**
- Already shows currency, amount, rate — no changes needed to table columns

---

## Files Affected

| File | Changes |
|------|---------|
| `backend/routers/finance.py` | Add update schemas, PUT endpoints, USD normalization in factory payment list + ledger |
| `frontend/src/api/index.js` | Add `update()`, `factoryUpdate()` API methods |
| `frontend/src/views/orders/OrderDetail.vue` | Inline editing logic + USD summary fields |
| `frontend/src/views/finance/FactoryLedger.vue` | Add Currency + Rate columns, update download Excel/PDF |
