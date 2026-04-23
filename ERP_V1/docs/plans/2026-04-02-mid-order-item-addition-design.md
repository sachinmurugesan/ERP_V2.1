# Mid-Order Item Addition with Confirmation Workflow

## Problem

Once an order hits Factory Ordered (Stage 5), items are locked. But clients often need to add parts mid-production. Currently no way to do this without reopening the entire order.

## Solution

Allow both client and admin to add items mid-production (up to PRODUCTION_90). New items appear in a separate "Pending Additions" section, go through pricing + client confirmation, then merge into the main order.

## Flow

```
CLIENT or ADMIN adds items to order in production (Stage 5-8)
  ↓
Items created with pi_item_status = PENDING
  ↓
Appear in "Pending Additions" tab (above confirmed items)
  ↓
ADMIN sets factory prices (if not already set)
  ↓
CLIENT reviews prices → Confirms or Rejects each item
  ↓
CONFIRMED → pi_item_status = APPROVED → merges into main Order Items
  - PI marked stale → admin regenerates → revision created
  - Payment balance recalculated
  ↓
REJECTED → pi_item_status = REJECTED → stays in history (dimmed)
```

## Data Model

**No new columns.** Use existing `pi_item_status` field on OrderItem (already defined, currently unused).

| pi_item_status | Meaning |
|----------------|---------|
| NULL | Original item — always confirmed (backward compatible) |
| PENDING | Newly added mid-order, awaiting price or client review |
| APPROVED | Client confirmed — merged into main list |
| REJECTED | Client rejected — dimmed in history |

## Rules

1. **Stages allowing mid-order addition:** FACTORY_ORDERED, PRODUCTION_60, PRODUCTION_80, PRODUCTION_90
2. **Original items** (added before FACTORY_ORDERED) keep `pi_item_status = NULL` — always treated as confirmed
3. **New items** get `pi_item_status = PENDING` on creation during these stages
4. **Only APPROVED and NULL items** count toward PI totals, payment calculations, packing
5. **PENDING/REJECTED items** excluded from financial calculations
6. **On confirmation:** PI marked stale → admin regenerates → revision with new totals
7. Either client or admin can add items — same approval flow

## Backend Changes

### 1. New stage gate constant
```python
MID_ORDER_ADD_STAGES = [
    OrderStatus.FACTORY_ORDERED.value,
    OrderStatus.PRODUCTION_60.value,
    OrderStatus.PRODUCTION_80.value,
    OrderStatus.PRODUCTION_90.value,
]
```

### 2. Modify `add_order_items()` endpoint
- If order is in `MID_ORDER_ADD_STAGES`, allow item addition
- Set `pi_item_status = "PENDING"` for items added in these stages
- Mark PI as stale

### 3. New endpoint: confirm/reject pending items
```
POST /orders/{order_id}/items/{item_id}/confirm/
Body: { action: "approve" | "reject" }
```
- Sets `pi_item_status` to APPROVED or REJECTED
- On approve: marks PI as stale
- On reject: item stays but is excluded from everything

### 4. Modify financial calculations
- `calc_effective_pi_total()` — exclude PENDING and REJECTED items
- `list_payments()` — exclude from totals
- `generate_pi()` — only include NULL or APPROVED items
- `stage_engine.py` — payment gate checks only confirmed items

### 5. Modify packing list
- Only APPROVED/NULL items appear in packing list
- PENDING items excluded from packing

## Frontend Changes

### Admin OrderItemsTab
- New "Pending Additions" section above main items table
- Shows items where `pi_item_status === 'PENDING'`
- Admin can set prices on pending items
- Shows REJECTED items dimmed

### Client ClientOrderItemsTab
- New "Pending Additions" section above main items table
- Client sees pending items with prices (when set)
- Confirm/Reject buttons per item (when price is set)
- "Awaiting pricing" label when price not yet set
- After confirmation, item moves to main table on reload

### Computed splits
```javascript
const confirmedItems = computed(() =>
  items.filter(i => i.status === 'ACTIVE' && (!i.pi_item_status || i.pi_item_status === 'APPROVED'))
)
const pendingItems = computed(() =>
  items.filter(i => i.status === 'ACTIVE' && i.pi_item_status === 'PENDING')
)
const rejectedItems = computed(() =>
  items.filter(i => i.status === 'ACTIVE' && i.pi_item_status === 'REJECTED')
)
```

## Files to Modify

| File | Changes |
|------|---------|
| `backend/routers/orders.py` | Extend `ITEM_EDITABLE_STAGES`, add confirm endpoint, modify `add_order_items` |
| `backend/routers/excel.py` | PI generation excludes PENDING/REJECTED items |
| `backend/core/finance_helpers.py` | Exclude PENDING/REJECTED from totals |
| `backend/services/stage_engine.py` | Payment gate excludes PENDING/REJECTED |
| `frontend/src/components/order/OrderItemsTab.vue` | Add Pending Additions section |
| `frontend/src/components/order/ClientOrderItemsTab.vue` | Add Pending Additions section with confirm/reject |
| `frontend/src/api/index.js` | Add confirmItem API method |
