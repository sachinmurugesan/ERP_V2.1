# Packing List: Split Items & Partial Shipping Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable splitting order items across pallets, handling partial readiness with three shipping decisions, and auto-recalculating Final PI based on actual packed quantities.

**Architecture:** Add a `parent_packing_item_id` field to PackingListItem for sub-row splits. Add a `shipping_decision` field for partial readiness choices. Final PI recalculation uses `loaded_qty` instead of `ordered_qty` when items have been split or partially shipped.

**Tech Stack:** FastAPI + SQLAlchemy (backend), Vue 3 + Tailwind (frontend), SQLite (dev DB)

---

## Context: Current System

- **1 order item = 1 packing row = 1 pallet** — no splits possible
- **Migration is all-or-nothing** — entire item migrates or stays
- **No partial shipping** — if `factory_ready_qty < ordered_qty`, admin has no decision workflow
- **Final PI uses `ordered_qty`** — doesn't account for actual packed amounts

## What Changes

### Three New Capabilities

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Split Packing** | One order item → multiple sub-rows, each with own pallet/qty |
| 2 | **Partial Shipping Decisions** | Ship+CarryForward, Ship+Cancel, or Wait — per item |
| 3 | **Final PI Auto-Recalc** | Stage 10 recalculates totals from actual packed quantities |

---

## Task 1: Database Schema — Add Split & Decision Fields

**Files:**
- Modify: `backend/models.py:469-486` (PackingListItem model)
- Modify: `backend/enums.py` (add ShippingDecision enum)
- Modify: `backend/main.py` (startup migration)

### Step 1: Add ShippingDecision enum

In `backend/enums.py`, add:

```python
class ShippingDecision(str, enum.Enum):
    NONE = "NONE"                    # No decision needed (fully ready)
    SHIP_CARRY_FORWARD = "SHIP_CARRY_FORWARD"  # Ship ready qty, carry forward balance
    SHIP_CANCEL_BALANCE = "SHIP_CANCEL_BALANCE"  # Ship ready qty, cancel remaining
    WAIT = "WAIT"                    # Don't ship, wait for full qty
```

### Step 2: Add columns to PackingListItem

In `backend/models.py`, add to PackingListItem:

```python
parent_packing_item_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("packing_list_items.id"), nullable=True)
is_split: Mapped[bool] = mapped_column(Boolean, default=False)
split_qty: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # qty for this sub-row
shipping_decision: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)  # ShippingDecision value
cancel_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # reason for SHIP_CANCEL_BALANCE
```

### Step 3: Add startup migration

In `backend/main.py` startup, add column migration (same pattern as existing migrations):

```python
# Split packing migration
for col_name, col_type, col_default in [
    ("parent_packing_item_id", "VARCHAR(36)", None),
    ("is_split", "BOOLEAN", "0"),
    ("split_qty", "INTEGER", None),
    ("shipping_decision", "VARCHAR(30)", None),
    ("cancel_reason", "TEXT", None),
]:
    try:
        db.execute(text(f"ALTER TABLE packing_list_items ADD COLUMN {col_name} {col_type} DEFAULT {col_default}"))
        db.commit()
    except Exception:
        db.rollback()
```

### Step 4: Commit

```bash
git add backend/models.py backend/enums.py backend/main.py
git commit -m "feat: add split packing and shipping decision fields to PackingListItem"
```

---

## Task 2: Backend API — Split Item Endpoint

**Files:**
- Modify: `backend/routers/orders.py` (add split endpoint)

### Step 1: Add request schema

```python
class SplitPackingItemRequest(BaseModel):
    splits: List[dict]  # [{"qty": 250, "package_number": "1"}, {"qty": 250, "package_number": "3"}]
```

### Step 2: Add split endpoint

```python
@router.post("/{order_id}/packing-list/items/{item_id}/split/")
def split_packing_item(
    order_id: str,
    item_id: str,
    data: SplitPackingItemRequest,
    db: Session = Depends(get_db),
):
    """Split a packing list item into multiple sub-rows with different pallet assignments."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or order.status != OrderStatus.PLAN_PACKING.value:
        raise HTTPException(400, "Can only split items during Plan Packing stage")

    parent = db.query(PackingListItem).filter(PackingListItem.id == item_id).first()
    if not parent:
        raise HTTPException(404, "Packing list item not found")
    if parent.is_split:
        raise HTTPException(400, "Item is already a sub-row. Split the parent instead.")

    # Validate total split qty matches factory_ready_qty
    total_split = sum(s["qty"] for s in data.splits)
    if total_split != parent.factory_ready_qty:
        raise HTTPException(400, f"Split quantities ({total_split}) must equal factory ready qty ({parent.factory_ready_qty})")

    if len(data.splits) < 2:
        raise HTTPException(400, "Must split into at least 2 rows")

    # Create sub-rows
    sub_items = []
    for s in data.splits:
        pkg = (s.get("package_number") or "").strip()
        status = "PALLETED" if pkg and pkg != "BULK" else ("LOOSE" if pkg == "BULK" else "NOT_READY")
        sub = PackingListItem(
            packing_list_id=parent.packing_list_id,
            order_item_id=parent.order_item_id,
            product_id=parent.product_id,
            ordered_qty=parent.ordered_qty,  # preserve original ordered qty
            factory_ready_qty=s["qty"],
            loaded_qty=s["qty"] if status in ("PALLETED", "LOOSE") else 0,
            package_number=pkg or None,
            packing_status=status,
            parent_packing_item_id=parent.id,
            is_split=True,
            split_qty=s["qty"],
        )
        db.add(sub)
        sub_items.append(sub)

    # Mark parent as split (hide from active view, keep for reference)
    parent.packing_status = "SPLIT"
    parent.loaded_qty = 0  # children own the loaded qty now

    db.commit()
    return {"split_count": len(sub_items), "parent_id": parent.id}
```

### Step 3: Add unsplit endpoint (undo split)

```python
@router.post("/{order_id}/packing-list/items/{item_id}/unsplit/")
def unsplit_packing_item(
    order_id: str,
    item_id: str,
    db: Session = Depends(get_db),
):
    """Undo a split — delete sub-rows, restore parent."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or order.status != OrderStatus.PLAN_PACKING.value:
        raise HTTPException(400, "Can only unsplit during Plan Packing stage")

    parent = db.query(PackingListItem).filter(PackingListItem.id == item_id).first()
    if not parent or parent.packing_status != "SPLIT":
        raise HTTPException(400, "Item is not split")

    # Delete sub-rows
    db.query(PackingListItem).filter(
        PackingListItem.parent_packing_item_id == parent.id
    ).delete()

    # Restore parent
    parent.packing_status = "NOT_READY"
    parent.loaded_qty = 0
    db.commit()
    return {"status": "unsplit", "parent_id": parent.id}
```

### Step 4: Commit

```bash
git add backend/routers/orders.py
git commit -m "feat: add split/unsplit endpoints for packing list items"
```

---

## Task 3: Backend API — Partial Shipping Decision Endpoint

**Files:**
- Modify: `backend/routers/orders.py`

### Step 1: Add decision request schema

```python
class ShippingDecisionRequest(BaseModel):
    decision: str  # SHIP_CARRY_FORWARD, SHIP_CANCEL_BALANCE, WAIT
    cancel_reason: Optional[str] = None  # required for SHIP_CANCEL_BALANCE
```

### Step 2: Add decision endpoint

```python
@router.post("/{order_id}/packing-list/items/{item_id}/decision/")
def set_shipping_decision(
    order_id: str,
    item_id: str,
    data: ShippingDecisionRequest,
    db: Session = Depends(get_db),
):
    """Set shipping decision for a partially ready item."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order or order.status != OrderStatus.PLAN_PACKING.value:
        raise HTTPException(400, "Decisions only allowed during Plan Packing")

    item = db.query(PackingListItem).filter(PackingListItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item not found")

    if data.decision == "SHIP_CANCEL_BALANCE" and not data.cancel_reason:
        raise HTTPException(400, "Reason required when cancelling balance")

    # Validate item is actually partial (factory_ready_qty < ordered_qty)
    if item.factory_ready_qty >= item.ordered_qty and data.decision != "NONE":
        raise HTTPException(400, "Item is fully ready — no decision needed")

    item.shipping_decision = data.decision
    item.cancel_reason = data.cancel_reason

    if data.decision == "SHIP_CARRY_FORWARD":
        # Ship what's ready, create UnloadedItem for balance
        balance = item.ordered_qty - item.factory_ready_qty
        item.loaded_qty = item.factory_ready_qty

        # Create carry-forward record
        oi = db.query(OrderItem).filter(OrderItem.id == item.order_item_id).first()
        existing = db.query(UnloadedItem).filter(
            UnloadedItem.original_order_id == order_id,
            UnloadedItem.product_id == item.product_id,
            UnloadedItem.reason == "NOT_PRODUCED",
        ).first()
        if not existing:
            ui = UnloadedItem(
                original_order_id=order_id,
                client_id=order.client_id,
                product_id=item.product_id,
                quantity=balance,
                amount_paid_inr=(oi.selling_price_inr or 0) * balance if oi else 0,
                status="PENDING",
                reason="NOT_PRODUCED",
                factory_price_cny=oi.factory_price_cny if oi else None,
            )
            db.add(ui)

    elif data.decision == "SHIP_CANCEL_BALANCE":
        # Ship what's ready, reduce order item quantity
        item.loaded_qty = item.factory_ready_qty
        oi = db.query(OrderItem).filter(OrderItem.id == item.order_item_id).first()
        if oi:
            oi.quantity = item.factory_ready_qty
            oi.notes = f"Qty reduced from {item.ordered_qty} to {item.factory_ready_qty}: {data.cancel_reason}"

    elif data.decision == "WAIT":
        # Don't load — entire item waits
        item.loaded_qty = 0

    db.commit()
    return {"decision": data.decision, "loaded_qty": item.loaded_qty}
```

### Step 3: Commit

```bash
git add backend/routers/orders.py
git commit -m "feat: add shipping decision endpoint for partial readiness"
```

---

## Task 4: Backend — Final PI Auto-Recalculation

**Files:**
- Modify: `backend/routers/orders.py` (stage transition to FINAL_PI)

### Step 1: Find the FINAL_PI transition handler

In the `execute_transition` or `advance_stage` function, add recalculation logic when transitioning to FINAL_PI:

```python
# When transitioning to FINAL_PI stage, recalculate based on actual packed quantities
if target_status == OrderStatus.FINAL_PI.value:
    packing_items = db.query(PackingListItem).join(PackingList).filter(
        PackingList.order_id == order.id,
        PackingListItem.packing_status != "SPLIT",  # skip parent rows
    ).all()

    for pi in packing_items:
        oi = db.query(OrderItem).filter(OrderItem.id == pi.order_item_id).first()
        if oi and oi.status == "ACTIVE":
            actual_qty = pi.loaded_qty or 0
            if actual_qty != oi.quantity:
                oi.notes = (oi.notes or "") + f"\n[Final PI] Qty revised: {oi.quantity} → {actual_qty}"
                oi.quantity = actual_qty

    order.items_modified_at = datetime.utcnow()
    db.commit()
```

### Step 2: Commit

```bash
git add backend/routers/orders.py
git commit -m "feat: auto-recalculate item quantities on Final PI transition"
```

---

## Task 5: Frontend API Layer — Add New Endpoints

**Files:**
- Modify: `frontend/src/api/index.js`

### Step 1: Add to packingApi

```javascript
// Add to packingApi object:
splitItem: (orderId, itemId, splits) =>
  api.post(`/orders/${orderId}/packing-list/items/${itemId}/split/`, { splits }),

unsplitItem: (orderId, itemId) =>
  api.post(`/orders/${orderId}/packing-list/items/${itemId}/unsplit/`),

setDecision: (orderId, itemId, decision, cancelReason) =>
  api.post(`/orders/${orderId}/packing-list/items/${itemId}/decision/`, {
    decision, cancel_reason: cancelReason
  }),
```

### Step 2: Commit

```bash
git add frontend/src/api/index.js
git commit -m "feat: add split, unsplit, and decision API methods"
```

---

## Task 6: Frontend UI — Split Item Flow

**Files:**
- Modify: `frontend/src/components/order/PackingListTab.vue`

### Step 1: Add split state

```javascript
const showSplitDialog = ref(false)
const splitTarget = ref(null)  // the packing item being split
const splitRows = ref([])      // [{qty: 0, package_number: ''}]
```

### Step 2: Add split functions

```javascript
function openSplit(item) {
  splitTarget.value = item
  splitRows.value = [
    { qty: Math.floor(item.factory_ready_qty / 2), package_number: '' },
    { qty: item.factory_ready_qty - Math.floor(item.factory_ready_qty / 2), package_number: '' },
  ]
  showSplitDialog.value = true
}

function addSplitRow() {
  splitRows.value = [...splitRows.value, { qty: 0, package_number: '' }]
}

function removeSplitRow(index) {
  splitRows.value = splitRows.value.filter((_, i) => i !== index)
}

async function confirmSplit() {
  const total = splitRows.value.reduce((s, r) => s + (r.qty || 0), 0)
  if (total !== splitTarget.value.factory_ready_qty) {
    alert(`Total (${total}) must equal factory ready qty (${splitTarget.value.factory_ready_qty})`)
    return
  }
  try {
    await packingApi.splitItem(props.orderId, splitTarget.value.id, splitRows.value)
    showSplitDialog.value = false
    await loadPackingList()
  } catch (err) {
    alert(err.response?.data?.detail || 'Split failed')
  }
}

async function unsplitItem(parentId) {
  if (!confirm('Undo split? Sub-rows will be merged back.')) return
  try {
    await packingApi.unsplitItem(props.orderId, parentId)
    await loadPackingList()
  } catch (err) {
    alert(err.response?.data?.detail || 'Unsplit failed')
  }
}
```

### Step 3: Add split button to table row

In the ACTIONS column, add a split icon button for items that are not already split:

```html
<button v-if="isPlanPacking && isEditing && !item.is_split && item.packing_status !== 'SPLIT'"
  @click="openSplit(item)"
  class="text-purple-500 hover:text-purple-700" title="Split across pallets">
  <i class="pi pi-clone text-xs" />
</button>
```

### Step 4: Add split dialog

```html
<!-- Split Dialog -->
<div v-if="showSplitDialog" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
  <div class="bg-white rounded-xl shadow-xl p-6 w-[500px] max-w-[90vw]">
    <h3 class="font-bold text-lg text-slate-800 mb-1">Split Item Across Pallets</h3>
    <p class="text-sm text-slate-500 mb-4">
      {{ splitTarget?.product_code }} — Total: {{ splitTarget?.factory_ready_qty }} qty
    </p>

    <div v-for="(row, i) in splitRows" :key="i" class="flex items-center gap-3 mb-3">
      <span class="text-xs text-slate-400 w-8">{{ i + 1 }}.</span>
      <input v-model.number="row.qty" type="number" min="1"
        class="w-24 text-sm border rounded px-2 py-1.5 focus:ring-purple-500" placeholder="Qty" />
      <input v-model="row.package_number" type="text"
        class="w-24 text-sm border rounded px-2 py-1.5 focus:ring-purple-500" placeholder="Pallet #" />
      <button v-if="splitRows.length > 2" @click="removeSplitRow(i)" class="text-red-400 hover:text-red-600">
        <i class="pi pi-trash text-xs" />
      </button>
    </div>

    <button @click="addSplitRow" class="text-xs text-purple-600 hover:underline mb-4">+ Add row</button>

    <div class="flex justify-between items-center pt-4 border-t">
      <span class="text-xs" :class="splitRows.reduce((s,r) => s + (r.qty||0), 0) === splitTarget?.factory_ready_qty ? 'text-green-600' : 'text-red-500'">
        Total: {{ splitRows.reduce((s,r) => s + (r.qty||0), 0) }} / {{ splitTarget?.factory_ready_qty }}
      </span>
      <div class="flex gap-2">
        <button @click="showSplitDialog = false" class="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
        <button @click="confirmSplit" class="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700">Split</button>
      </div>
    </div>
  </div>
</div>
```

### Step 5: Style sub-rows differently in the table

In the `<tr>` for each item, add conditional styling:

```html
<tr :class="item.is_split ? 'bg-purple-50/50' : ''">
  <!-- existing cells -->
  <td>
    <!-- Add split badge -->
    <span v-if="item.is_split" class="ml-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-100 text-purple-600">
      Split
    </span>
  </td>
</tr>
```

### Step 6: Commit

```bash
git add frontend/src/components/order/PackingListTab.vue
git commit -m "feat: add split item UI with dialog, sub-row styling, and unsplit"
```

---

## Task 7: Frontend UI — Partial Readiness Decision

**Files:**
- Modify: `frontend/src/components/order/PackingListTab.vue`

### Step 1: Add decision state

```javascript
const showCancelReasonDialog = ref(false)
const cancelReasonTarget = ref(null)
const cancelReasonText = ref('')
```

### Step 2: Detect partial items

```javascript
const isPartiallyReady = (item) =>
  item.factory_ready_qty > 0 && item.factory_ready_qty < item.ordered_qty && !item.is_split
```

### Step 3: Add decision column to table

After the REASON column, add a DECISION column that only appears for partial items:

```html
<td v-if="isPlanPacking && isEditing && isPartiallyReady(item)" class="px-3 py-2">
  <select
    :value="item.shipping_decision || ''"
    @change="setShippingDecision(item, $event.target.value)"
    class="text-xs px-2 py-1 border rounded"
    :class="{
      'border-amber-400 bg-amber-50': item.shipping_decision === 'SHIP_CARRY_FORWARD',
      'border-red-400 bg-red-50': item.shipping_decision === 'SHIP_CANCEL_BALANCE',
      'border-blue-400 bg-blue-50': item.shipping_decision === 'WAIT',
    }">
    <option value="">— Decide —</option>
    <option value="SHIP_CARRY_FORWARD">Ship + Carry Forward</option>
    <option value="SHIP_CANCEL_BALANCE">Ship + Cancel Balance</option>
    <option value="WAIT">Wait for Full</option>
  </select>
  <div class="text-[9px] text-slate-400 mt-0.5">
    Ready: {{ item.factory_ready_qty }} / {{ item.ordered_qty }}
  </div>
</td>
```

### Step 4: Add decision handler

```javascript
async function setShippingDecision(item, decision) {
  if (decision === 'SHIP_CANCEL_BALANCE') {
    cancelReasonTarget.value = item
    cancelReasonText.value = ''
    showCancelReasonDialog.value = true
    return
  }
  try {
    await packingApi.setDecision(props.orderId, item.id, decision)
    item.shipping_decision = decision
    if (decision === 'WAIT') item.loaded_qty = 0
    else item.loaded_qty = item.factory_ready_qty
    await loadPackingList()
  } catch (err) {
    alert(err.response?.data?.detail || 'Failed to set decision')
  }
}

async function confirmCancelBalance() {
  if (!cancelReasonText.value.trim()) {
    alert('Please provide a reason for cancelling the balance')
    return
  }
  try {
    await packingApi.setDecision(
      props.orderId,
      cancelReasonTarget.value.id,
      'SHIP_CANCEL_BALANCE',
      cancelReasonText.value.trim()
    )
    showCancelReasonDialog.value = false
    await loadPackingList()
  } catch (err) {
    alert(err.response?.data?.detail || 'Failed')
  }
}
```

### Step 5: Add cancel reason confirmation dialog

```html
<!-- Cancel Balance Confirmation -->
<div v-if="showCancelReasonDialog" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
  <div class="bg-white rounded-xl shadow-xl p-6 w-[450px]">
    <div class="flex items-center gap-2 mb-3">
      <i class="pi pi-exclamation-triangle text-red-500 text-lg" />
      <h3 class="font-bold text-red-700">Cancel Balance — Irreversible</h3>
    </div>
    <p class="text-sm text-slate-600 mb-2">
      This will permanently reduce <strong>{{ cancelReasonTarget?.product_code }}</strong>
      from {{ cancelReasonTarget?.ordered_qty }} to {{ cancelReasonTarget?.factory_ready_qty }} qty.
    </p>
    <p class="text-xs text-red-600 mb-3">The Final PI will be recalculated on the reduced quantity.</p>
    <textarea v-model="cancelReasonText" rows="3" placeholder="Reason for cancelling balance (required)..."
      class="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-red-500 focus:border-red-500" />
    <div class="flex justify-end gap-2 mt-4">
      <button @click="showCancelReasonDialog = false" class="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
      <button @click="confirmCancelBalance"
        :disabled="!cancelReasonText.trim()"
        class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40">
        Confirm Cancel Balance
      </button>
    </div>
  </div>
</div>
```

### Step 6: Commit

```bash
git add frontend/src/components/order/PackingListTab.vue
git commit -m "feat: add partial readiness decision UI with carry-forward, cancel, wait options"
```

---

## Task 8: Update Packing List Serializer — Include New Fields

**Files:**
- Modify: `backend/routers/orders.py` (packing list GET response)

### Step 1: Update serializer

In the GET packing list response, include new fields:

```python
# In the packing list items serialization, add:
"parent_packing_item_id": item.parent_packing_item_id,
"is_split": item.is_split or False,
"split_qty": item.split_qty,
"shipping_decision": item.shipping_decision,
"cancel_reason": item.cancel_reason,
```

### Step 2: Filter out SPLIT parent rows from active items

```python
# Active items should exclude parent rows that have been split
active_items = [i for i in items if i.packing_status != "SPLIT"]
```

### Step 3: Commit

```bash
git add backend/routers/orders.py
git commit -m "feat: include split and decision fields in packing list response"
```

---

## Task 9: Update Frontend Computed Properties

**Files:**
- Modify: `frontend/src/components/order/PackingListTab.vue`

### Step 1: Update activePackingItems to exclude SPLIT parents

```javascript
const activePackingItems = computed(() =>
  packingItems.value.filter(i =>
    i.order_item_status !== 'UNLOADED' &&
    !i.is_balance_only &&
    i.packing_status !== 'SPLIT'  // hide parent rows that have been split
  )
)
```

### Step 2: Update summaryStats to use loaded_qty from sub-rows

```javascript
// In summaryStats computed, loaded qty should sum from non-SPLIT items only
const loaded = active.filter(i =>
  (i.packing_status === 'PALLETED' || i.packing_status === 'LOOSE') &&
  i.packing_status !== 'SPLIT'
)
```

### Step 3: Add hasPartialItems computed

```javascript
const hasPartialItems = computed(() =>
  activePackingItems.value.some(i => isPartiallyReady(i))
)
```

### Step 4: Commit

```bash
git add frontend/src/components/order/PackingListTab.vue
git commit -m "feat: update computed properties for split items and partial readiness"
```

---

## Task 10: Update Migration — Handle Sub-rows

**Files:**
- Modify: `backend/routers/orders.py` (migrate-items endpoint)

### Step 1: Handle split sub-row migration

When migrating a sub-row (is_split=True), only migrate that sub-row's qty, not the full ordered qty:

```python
# In migrate_items endpoint, update qty calculation:
if packing_item.is_split:
    migrate_qty = packing_item.split_qty or packing_item.factory_ready_qty
else:
    migrate_qty = packing_item.factory_ready_qty
```

### Step 2: Commit

```bash
git add backend/routers/orders.py
git commit -m "feat: handle split sub-row migration with correct quantities"
```

---

## Task 11: Client Notification for Partial Shipping

**Files:**
- Modify: `backend/routers/orders.py` (in set_shipping_decision endpoint)

### Step 1: Add notification on carry-forward and cancel decisions

```python
# After processing SHIP_CARRY_FORWARD or SHIP_CANCEL_BALANCE:
from models import Notification
notif = Notification(
    user_role="CLIENT",
    client_id=order.client_id,
    notification_type="PACKING_DECISION",
    message=f"Order {order.order_number}: {oi.product_code_snapshot or 'Item'} — "
            + ("balance carried forward to next order" if data.decision == "SHIP_CARRY_FORWARD"
               else f"balance cancelled (reason: {data.cancel_reason})"),
    link=f"/client-portal/orders/{order_id}",
)
db.add(notif)
```

### Step 2: Commit

```bash
git add backend/routers/orders.py
git commit -m "feat: notify client on partial shipping decisions"
```

---

## Summary: File Change Map

| File | Changes |
|------|---------|
| `backend/enums.py` | Add `ShippingDecision` enum |
| `backend/models.py` | Add 5 columns to PackingListItem |
| `backend/main.py` | Startup migration for new columns |
| `backend/routers/orders.py` | Add split/unsplit/decision endpoints, update serializer, update migration, update Final PI transition |
| `frontend/src/api/index.js` | Add splitItem, unsplitItem, setDecision methods |
| `frontend/src/components/order/PackingListTab.vue` | Split dialog, decision column, cancel reason dialog, sub-row styling, updated computed properties |

## Execution Order

Tasks 1-4 (backend) can be done sequentially.
Task 5 (API layer) depends on Tasks 2-3.
Tasks 6-7 (frontend UI) depend on Task 5.
Tasks 8-9 (serializer + computed) support Tasks 6-7.
Task 10 (migration update) is independent.
Task 11 (notifications) is independent.

**Recommended parallel batches:**
- Batch 1: Tasks 1, 2, 3, 4 (all backend)
- Batch 2: Tasks 5, 8 (API + serializer wiring)
- Batch 3: Tasks 6, 7, 9 (frontend UI)
- Batch 4: Tasks 10, 11 (migration + notifications)
