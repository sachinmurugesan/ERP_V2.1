# Mid-Order Item Addition Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow clients and admins to add items to orders mid-production (Stage 5-8), with a Pending Additions section and client confirmation workflow before items merge into the main order.

**Architecture:** Use existing `pi_item_status` field on OrderItem (PENDING/APPROVED/REJECTED). Items added during FACTORY_ORDERED–PRODUCTION_90 get `pi_item_status=PENDING`. Client confirms → APPROVED → merged into main list + PI regenerated. Financial calculations exclude PENDING/REJECTED items.

**Tech Stack:** FastAPI, SQLAlchemy, Vue 3, Tailwind CSS

---

### Task 1: Backend — Extend item addition to mid-production stages

**Files:**
- Modify: `backend/routers/orders.py`

**Step 1:** Add new constant after `ITEM_EDITABLE_STAGES`:
```python
MID_ORDER_ADD_STAGES = [
    OrderStatus.FACTORY_ORDERED.value,
    OrderStatus.PRODUCTION_60.value,
    OrderStatus.PRODUCTION_80.value,
    OrderStatus.PRODUCTION_90.value,
]
```

**Step 2:** In `add_order_items()` function, modify the stage gate:
```python
# Replace the single ITEM_EDITABLE_STAGES check with:
is_editable = order.status in ITEM_EDITABLE_STAGES
is_mid_order = order.status in MID_ORDER_ADD_STAGES
if not is_editable and not is_mid_order:
    raise HTTPException(status_code=400, detail="Items cannot be added at this stage")
```

**Step 3:** After creating the OrderItem, set pi_item_status for mid-order additions:
```python
if is_mid_order:
    new_item.pi_item_status = "PENDING"
    # Mark PI as stale
    order.items_modified_at = datetime.utcnow()
```

**Step 4:** Verify: `python -c "from routers.orders import router; print('ok')"`

---

### Task 2: Backend — Confirm/reject pending items endpoint

**Files:**
- Modify: `backend/routers/orders.py`

**Step 1:** Add new endpoint:
```python
@router.post("/{order_id}/items/{item_id}/confirm/")
def confirm_order_item(
    order_id: str,
    item_id: str,
    action: str = Query(..., regex="^(approve|reject)$"),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Client or admin confirms/rejects a pending mid-order item."""
    order = db.query(Order).filter(Order.id == order_id, Order.deleted_at.is_(None)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # RLS: CLIENT can only confirm own orders
    if current_user.user_type == "CLIENT" and order.client_id != current_user.client_id:
        raise HTTPException(status_code=403, detail="Access denied")

    item = db.query(OrderItem).filter(
        OrderItem.id == item_id,
        OrderItem.order_id == order_id,
        OrderItem.status == "ACTIVE",
        OrderItem.pi_item_status == "PENDING",
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Pending item not found")

    if action == "approve":
        item.pi_item_status = "APPROVED"
        order.items_modified_at = datetime.utcnow()  # Mark PI stale
    else:
        item.pi_item_status = "REJECTED"

    db.commit()
    return {"status": item.pi_item_status, "item_id": item_id}
```

**Step 2:** Add to frontend API (`frontend/src/api/index.js`):
```javascript
confirmItem: (orderId, itemId, action) =>
    api.post(`/orders/${orderId}/items/${itemId}/confirm/?action=${action}`),
```

---

### Task 3: Backend — Exclude PENDING/REJECTED from financial calculations

**Files:**
- Modify: `backend/core/finance_helpers.py`
- Modify: `backend/routers/excel.py` (PI generation)
- Modify: `backend/services/stage_engine.py`

**Step 1:** In `finance_helpers.py` → `calc_effective_pi_total()`, add filter:
```python
active_items = db.query(OrderItem).filter(
    OrderItem.order_id == order.id,
    OrderItem.status == "ACTIVE",
    or_(OrderItem.pi_item_status.is_(None), OrderItem.pi_item_status == "APPROVED"),
).all()
```

**Step 2:** In `excel.py` → `generate_pi()`, add same filter to items query:
```python
items = db.query(OrderItem).filter(
    OrderItem.order_id == order_id,
    OrderItem.status == OrderItemStatus.ACTIVE.value,
    or_(OrderItem.pi_item_status.is_(None), OrderItem.pi_item_status == "APPROVED"),
).all()
```

**Step 3:** Same filter in `download_pi_with_images()`.

**Step 4:** In `stage_engine.py`, payment gate already uses `func.sum(Payment.amount_inr)` — the PI total from `ProformaInvoice.total_inr` is what matters, and that's recalculated from confirmed items only.

---

### Task 4: Backend — Serialize pi_item_status in order item response

**Files:**
- Modify: `backend/routers/orders.py` → `serialize_order_item()`

**Step 1:** Add `pi_item_status` to the serialized response:
```python
result["pi_item_status"] = item.pi_item_status
```

This is needed so the frontend can split items into confirmed vs pending.

---

### Task 5: Frontend Admin — Pending Additions section in OrderItemsTab

**Files:**
- Modify: `frontend/src/components/order/OrderItemsTab.vue`

**Step 1:** Add computed properties:
```javascript
const confirmedItems = computed(() =>
  activeItems.value.filter(i => !i.pi_item_status || i.pi_item_status === 'APPROVED')
)
const pendingAdditions = computed(() =>
  activeItems.value.filter(i => i.pi_item_status === 'PENDING')
)
const rejectedAdditions = computed(() =>
  activeItems.value.filter(i => i.pi_item_status === 'REJECTED')
)
const isMidOrderStage = computed(() =>
  ['FACTORY_ORDERED', 'PRODUCTION_60', 'PRODUCTION_80', 'PRODUCTION_90'].includes(props.order?.status)
)
```

**Step 2:** Add Pending Additions section ABOVE the main Order Items table. Show amber-bordered card with:
- Table: #, Code, Product, Qty, Factory Price (editable), Status, Actions
- Admin can set prices on pending items (same `saveItemPrice` flow)
- Show "Awaiting Client Confirmation" badge when price is set
- Show "Needs Pricing" badge when price is null
- Rejected items shown dimmed with 30% opacity

**Step 3:** For the main Order Items table, use `confirmedItems` (or `sortedItems` filtered) instead of `activeItems` — so PENDING items don't appear there.

**Step 4:** Show "+ Add Item" button in the Pending section when `isMidOrderStage` is true.

---

### Task 6: Frontend Client — Pending Additions section in ClientOrderItemsTab

**Files:**
- Modify: `frontend/src/components/order/ClientOrderItemsTab.vue`

**Step 1:** Add same computed properties as admin (confirmedItems, pendingAdditions, rejectedAdditions, isMidOrderStage).

**Step 2:** Add Pending Additions section above main table:
- Table: #, Code, Product, Qty, Factory (USD), Price (INR), Action
- When price NOT set: show "Awaiting pricing" label (grey)
- When price IS set: show [Confirm] [Reject] buttons
- Rejected items dimmed

**Step 3:** Add confirm/reject handler:
```javascript
async function confirmPendingItem(itemId, action) {
    try {
        await ordersApi.confirmItem(props.orderId, itemId, action)
        loadItems()
        emit('reload')
    } catch (e) { console.error(e) }
}
```

**Step 4:** Main Order Items table uses `confirmedItems` — PENDING items don't appear there.

**Step 5:** The existing "+ Add Item" button should also be visible when `isMidOrderStage` is true.

---

### Task 7: Notification on item confirmation

**Files:**
- Modify: `backend/routers/orders.py` → `confirm_order_item()`

**Step 1:** When client confirms, notify admin:
```python
if current_user.user_type == "CLIENT" and action == "approve":
    db.add(Notification(
        user_role="ADMIN",
        title="Item Confirmed",
        message=f"Client confirmed {item.product_code_snapshot} for {order.order_number}",
        notification_type="ITEM_CONFIRMED",
        resource_type="order",
        resource_id=order_id,
    ))
```

**Step 2:** When admin adds items, notify client:
```python
# In add_order_items(), if is_mid_order and user is admin:
db.add(Notification(
    user_role="CLIENT",
    client_id=order.client_id,
    title="New Items Added",
    message=f"New items added to {order.order_number} — review and confirm",
    notification_type="ITEMS_PENDING_CONFIRMATION",
    resource_type="order",
    resource_id=order_id,
))
```

---

### Task 8: Build + Test + Verify

**Step 1:** `python -m alembic upgrade head` (no migration needed — pi_item_status column exists)
**Step 2:** `python -m pytest tests/test_transparency.py -x -q` — all pass
**Step 3:** `npm run build` — zero errors
**Step 4:** Manual test:
  - Create order → advance to FACTORY_ORDERED
  - Add items as admin → items appear in Pending Additions
  - Set prices → items show "Awaiting Client Confirmation"
  - Login as client → see Pending Additions → Confirm items
  - Items move to main Order Items list
  - Regenerate PI → includes newly confirmed items
  - Reject an item → stays dimmed, excluded from totals
