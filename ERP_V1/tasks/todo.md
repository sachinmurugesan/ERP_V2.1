# After-Sales & Packing List — Lifecycle Improvements Spec

## Overview

This spec covers gaps in the after-sales carry-forward system, compensation balance handling at packing, and the CLOSED status trigger. The Product Variant System (Phases 1-5) is already implemented.

---

## 1. Carry-Forward Lifecycle Fix

### Problem
When a carry-forward item (REPLACEMENT or COMPENSATION) is added to the next order, the system:
- Updates `carry_forward_status = ADDED_TO_ORDER` ✅
- But does NOT create an AfterSalesItem for the new order ❌
- FULFILLED status is defined in enum but never triggered ❌
- If the replacement item has issues again, there's no re-objection chain ❌
- If a REPLACEMENT item can't be loaded during packing, it doesn't revert to PENDING ❌

### Solution

**1A. Create AfterSalesItem for carry-forward items in new order** (`orders.py`)
When auto-adding carry-forward OrderItems during order creation, also create AfterSalesItems
so the new order's after-sales tab can track whether the replacement/compensation was fulfilled.

```python
# After adding carry-forward OrderItem, create an AfterSalesItem linking to new order
asi = AfterSalesItem(
    order_id=order.id,
    order_number=order.order_number,
    order_item_id=new_order_item.id,
    product_id=claim.product_id,
    product_code=claim.product_code,
    product_name=claim.product_name,
    client_id=order.client_id,
    client_name=client_name,
    factory_id=order.factory_id,
    sent_qty=0,  # not yet shipped
    received_qty=0,
    ordered_quantity=claim.affected_quantity or 1,
    delivered_quantity=0,
    selling_price_inr=sell_price,
    affected_quantity=0,
    total_value_inr=0,
    objection_type="",
    description="",
    status=AfterSalesStatus.OPEN.value,
    # Link to original claim for chain tracking
    carry_forward_type=claim.carry_forward_type,
    source_aftersales_id=claim.id,  # NEW FIELD - links to original claim
)
```

**1B. Add `source_aftersales_id` field to AfterSalesItem model** (`models.py`)
```python
source_aftersales_id: Mapped[Optional[str]] = mapped_column(
    String(36), ForeignKey("aftersales_items.id"), nullable=True
)
```
This creates a chain: original claim → new order's AfterSalesItem → fulfillment tracking.

**1C. FULFILLED trigger** (`aftersales.py`)
When all items on the new order's after-sales are marked CLOSED (no objection):
- Find any AfterSalesItem with `source_aftersales_id` pointing to the original claim
- If CLOSED → update original claim's `carry_forward_status = FULFILLED`

Trigger point: In `batch_save_aftersales()`, after marking an item CLOSED, check if
`source_aftersales_id` is set → update the source claim.

**1D. Re-objection chain**
If the carry-forward item in the new order has issues:
- The new order's AfterSalesItem gets an objection_type set → IN_PROGRESS
- A NEW resolution can be applied (replace again, compensate, etc.)
- This creates ANOTHER carry-forward cycle → naturally chains

**1E. Revert REPLACEMENT to PENDING on unload** (packing list logic)
When a REPLACEMENT item (selling_price = 0, from carry-forward) is unloaded from packing:
- Find the original AfterSalesItem via `source_aftersales_id`
- Revert its `carry_forward_status` from `ADDED_TO_ORDER` back to `PENDING`
- Clear `added_to_order_id`
- So the replacement gets picked up again on the next order

---

## 2. Compensation Balance — READ-ONLY on Packing List

### Problem
COMPENSATION items (selling_price < 0) are balance adjustments, NOT physical items.
They should NOT be loadable/unloadable/migratable on the packing list.
They exist on the order only for invoice/ledger calculation.

### Solution

**2A. Packing list item classification** (backend + frontend)
Three item types at packing:
1. **Regular paid item** (`selling_price > 0`) → fully packable, loadable, unloadable
2. **Replacement carry-forward** (`selling_price = 0 + notes contain "After-Sales"`) → packable
3. **Compensation balance** (`selling_price < 0`) → READ-ONLY, no packing interaction

**2B. Backend: Skip compensation items in packing list creation**
When auto-creating PackingListItems from OrderItems, skip items where `selling_price_inr < 0`.
Or include them but mark with a `is_balance_only = True` flag.

**2C. Frontend: Read-only rendering for compensation items**
- Show compensation items in a separate section or with a distinct badge
- No load/unload controls
- Display as "Balance Adjustment: -₹X"
- Grey out or lock the row

---

## 3. CLOSED Status Fix

### Problem
Currently CLOSED is set when `objection_type` is empty (no issue found).
But CLOSED should mean "delivered AND confirmed OK" — not just "no objection recorded yet".

### Solution

**3A. Two-tier CLOSED logic**
- Items auto-populated from packing list start as OPEN (current behavior ✅)
- If user confirms "no issue" → CLOSED (current behavior, acceptable for initial review)
- For carry-forward items: CLOSED only when `source_aftersales_id` item is confirmed OK
  → This triggers FULFILLED on the original claim (see 1C above)

**3B. Status flow clarification**
```
OPEN → user finds no issue → CLOSED (item OK, delivered confirmed)
OPEN → user finds issue → IN_PROGRESS (objection recorded)
IN_PROGRESS → resolution applied → RESOLVED (carry-forward PENDING)
RESOLVED → carry-forward added to order → RESOLVED (carry-forward ADDED_TO_ORDER)
RESOLVED → carry-forward delivered OK → RESOLVED (carry-forward FULFILLED)
```

---

## 4. Migration Items (Already Implemented as UnloadedItems)

The unloaded/migration items system already exists:
- `UnloadedItem` model in models.py ✅
- `UnloadedItemStatus` enum (PENDING, ADDED_TO_ORDER, SHIPPED) ✅
- Auto-add to next order in `create_order()` ✅

No new work needed here — just ensure REPLACEMENT carry-forward items that are unloaded
go through the revert path (1E), not the UnloadedItem path.

---

## Files to Modify

| File | Changes |
|------|---------|
| `backend/models.py` | Add `source_aftersales_id` FK to AfterSalesItem |
| `backend/main.py` | ALTER TABLE migration for new column |
| `backend/routers/orders.py` | Create AfterSalesItem for carry-forward OrderItems |
| `backend/routers/aftersales.py` | FULFILLED trigger in batch_save, revert-on-unload helper |
| `backend/routers/packing.py` | Skip/mark compensation items, revert replacement on unload |

---

## Implementation Order

1. **Model + Migration**: Add `source_aftersales_id` column
2. **Order creation**: Create AfterSalesItem for carry-forward items
3. **FULFILLED trigger**: Update original claim when new order confirms OK
4. **Revert-on-unload**: Revert replacement carry-forward on packing unload
5. **Compensation read-only**: Handle negative-price items on packing list

---

## Verification Scenarios

1. **New order with carry-forward REPLACEMENT**: Creates OrderItem (price=0) + AfterSalesItem linked to original claim
2. **Delivery confirmed OK**: New order after-sales item marked CLOSED → original claim becomes FULFILLED
3. **Re-objection**: New order after-sales item gets objection → IN_PROGRESS → new resolution → chains to next order
4. **Replacement unloaded**: Replacement item removed from packing → original claim reverts to PENDING
5. **Compensation on packing**: Negative-price items shown as read-only balance adjustments
6. **Mixed order**: Regular items + replacement + compensation all handled correctly on packing list

---

## Product Variant System (Completed ✅)

All 5 phases implemented:
- Phase 1: Backend auto-set `is_default` on first child ✅
- Phase 2: Check-variants endpoint + replace support ✅
- Phase 3: ProductForm variant resolution dialog ✅
- Phase 4: Excel import variant resolution ✅
- Phase 5: ExcelUpload variant resolution panel ✅
- ProductList.vue: Separate Material/Size columns with aggregated tags ✅

---

## Code Review & Cleanup (2026-03-09) ✅

### Phase 1: Deep Review — COMPLETED
4 parallel agents (Python, Security, Frontend, Database) ran comprehensive review.
**96 raw findings → 52 deduplicated** (14 CRITICAL, 20 HIGH, 12 MEDIUM, 6 DEAD CODE).
Full report: `tasks/review-report-2026-03-09.md`

### Phase 2: Dead Code Cleanup — COMPLETED
- [x] Removed dead `paymentsApi.receivables` from `api/index.js`
- [x] Migrated `Settings.vue` from raw axios to shared `settingsApi`
- [x] Removed dead filter input from `Settings.vue`
- [x] Deleted 4 legacy model classes from `models.py` (FreightForwarder, CHA, CFSProvider, TransportProvider)
- [x] Removed 5 unused Python imports across 4 backend files
- [x] Fixed DEBUG default from `true` → `false` in `config.py`
- [x] Tightened CORS (specific methods/headers instead of wildcards)
- [x] Error handler conditional on DEBUG mode

### Phase 3: Shared Utility Extraction — COMPLETED
- [x] Created `frontend/src/utils/formatters.js` (formatDate, formatCurrency, formatINR, formatNumber)
- [x] Created `frontend/src/utils/constants.js` (STAGE_MAP, 9 status Sets, INDIAN_STATES, getStageInfo)
- [x] Replaced formatDate in 7 components (OrderList, OrderItemsTab, PaymentsTab, BookingTab, SailingTab, ShippingDocsTab)
- [x] Replaced formatCurrency in 5 components (PaymentsTab, AfterSalesTab, ClientLedger, FactoryLedger, Receivables)
- [x] Replaced indianStates in 2 components (ClientForm, TransportForm)
- [x] Replaced status arrays in 2 components (OrderItemsTab, PaymentsTab) with shared Set imports

### Phase 4: Verification — COMPLETED
- [x] Frontend `vite build` passes clean ✅
- [x] Backend all Python files compile ✅
- [x] All API endpoints verified (dashboard, orders, clients, products) ✅
- [x] Lessons updated: 6 new patterns (#20-#25)

### Remaining from Review (Future Sprints)
See `tasks/review-report-2026-03-09.md` for full priority list:
- Sprint 1: Security fixes (C2 auth, C4 path traversal, C7 file validation)
- Sprint 2: Financial (C1 Float→Decimal for money, C5/C6 race conditions)
- Sprint 3: Performance (C3 N+1 queries, H1 missing indexes, H13 streaming uploads)
- Sprint 4: Quality (H3 remaining status dedup, H5-H7 frontend cleanup, H16 datetime.utcnow)
