# Design: Smart Credit Application (Apply Full + Auto-Refund)

**Date:** 2026-02-25
**Status:** Approved

## Problem

1. `apply_credit()` applies FULL credit amount, marks it APPLIED — if credit > order balance, surplus is lost
2. Deleting a credit-based payment doesn't restore the credit
3. No auto-refund: overpayment from credit application doesn't create a new available credit

## Solution: Apply Full + Auto-Refund

**Flow (credit = 5000, order balance = 2000):**
1. Apply full 5000 as Payment (method: CREDIT)
2. Mark original credit as APPLIED
3. Overpayment check: total_paid (5000) > pi_total (2000) → surplus = 3000
4. Auto-create NEW credit record: amount=3000, source=current order, status=AVAILABLE
5. Frontend reloads → new 3000 credit appears

**Key: Extract `_recalculate_credit()` helper** called from all payment mutation points:
- `create_payment()` — already has this logic inline
- `apply_credit()` — currently missing, needs addition
- `update_payment()` — already has this logic inline
- `delete_payment()` — already has this logic inline

The helper consolidates the overpayment check + credit create/update/delete logic.

## Files Changed

- `backend/routers/finance.py` — Extract helper, add to apply_credit, cleanup duplicate code
- `frontend/src/views/orders/OrderDetail.vue` — No changes needed (already reloads credits after apply)
