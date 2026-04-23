# Stage Gates, PI Visibility & Clickable Timeline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add factory payment gate at BOOKED, restrict PI button visibility, and make timeline stages clickable for direct stage jumps.

**Architecture:** Three independent features touching backend (`orders.py`, `finance.py`) and frontend (`OrderDetail.vue`, `api/index.js`). Factory ledger becomes double-entry (debits + credits) matching the client ledger pattern. Timeline circles become clickable with a new `jump-to-stage` backend endpoint.

**Tech Stack:** FastAPI + SQLAlchemy (backend), Vue 3 + Tailwind (frontend)

**Design doc:** `docs/plans/2026-02-25-stage-gates-pi-timeline-design.md`

---

## Task 1: Factory Payment Gate at BOOKED Stage (Backend)

**Files:**
- Modify: `backend/routers/orders.py` — `validate_transition` function (line 740) and imports (line 11)

**Step 1: Add FactoryPayment import**

In `backend/routers/orders.py` line 11, add `FactoryPayment` to the models import:

```python
from models import Order, OrderItem, Product, Client, Factory, ExchangeRate, ProductImage, ProformaInvoice, Payment, FactoryPayment
```

**Step 2: Add BOOKED gate validation**

In `validate_transition()`, BEFORE the `return errors, warnings` line (line 795), add a new `elif` block:

```python
    # PRODUCTION_100 → BOOKED: Must have factory payments
    elif target_status == OrderStatus.BOOKED.value:
        fp_count = db.query(func.count(FactoryPayment.id)).filter(
            FactoryPayment.order_id == order.id
        ).scalar()
        if fp_count == 0:
            errors.append("At least one factory payment must be recorded before booking")
        else:
            # Check for partial payment — compare against order CNY total
            active_items = [i for i in order.items if i.status == "ACTIVE"]
            total_cny = sum((i.factory_price_cny or 0) * i.quantity for i in active_items)
            exchange_rate = order.exchange_rate or 1.0
            estimated_total_inr = round(total_cny * exchange_rate, 2)

            total_paid_inr = db.query(func.coalesce(func.sum(FactoryPayment.amount_inr), 0)).filter(
                FactoryPayment.order_id == order.id
            ).scalar()

            if total_paid_inr < estimated_total_inr:
                balance = round(estimated_total_inr - total_paid_inr, 2)
                warnings.append({
                    "type": "factory_underpayment",
                    "message": f"Factory payment is partial. ₹{total_paid_inr:,.2f} paid of ₹{estimated_total_inr:,.2f} estimated total. Balance: ₹{balance:,.2f}",
                    "balance": balance,
                    "estimated_total": estimated_total_inr,
                    "total_paid": total_paid_inr,
                })
```

**Step 3: Verify backend starts cleanly**

Run: `cd backend && python -c "from routers import orders; print('OK')"`

**Step 4: Test with curl**

```bash
# Test with an order that has no factory payments
curl -s -X PUT "http://localhost:8000/api/orders/{ORDER_ID}/transition/?target_status=BOOKED" \
  -H "Content-Type: application/json" -d '{"acknowledge_warnings":false}'
# Expected: 400 error "At least one factory payment must be recorded"
```

**Step 5: Commit**

```bash
git add backend/routers/orders.py
git commit -m "feat: add factory payment gate validation at BOOKED stage"
```

---

## Task 2: Jump-to-Stage Backend Endpoint

**Files:**
- Modify: `backend/routers/orders.py` — add new schema + endpoint after the `go_back_order` function (after line 962)

**Step 1: Add JumpToStageRequest schema**

After the `GoBackRequest` class (line 133), add:

```python
class JumpToStageRequest(BaseModel):
    target_status: str
    reason: Optional[str] = None
```

**Step 2: Add helper function to walk reverse chain**

After the `REVERSE_TRANSITIONS` dict (after line 737), add:

```python
def get_reachable_previous_stages(current_status: str) -> list:
    """Walk the REVERSE_TRANSITIONS chain to find all stages reachable by going back."""
    reachable = []
    status = current_status
    while True:
        prev = REVERSE_TRANSITIONS.get(status)
        if not prev:
            break
        stage_num, stage_name = get_stage_info(prev)
        reachable.append({"status": prev, "stage": stage_num, "name": stage_name})
        status = prev
    return reachable
```

**Step 3: Add the jump-to-stage endpoint**

After the `go_back_order` function (after line 962), add:

```python
@router.put("/{order_id}/jump-to-stage/")
def jump_to_stage(order_id: str, req: JumpToStageRequest, db: Session = Depends(get_db)):
    """Jump order directly to a previous stage."""
    order = db.query(Order).options(
        joinedload(Order.items).joinedload(OrderItem.product),
        joinedload(Order.client),
        joinedload(Order.factory),
    ).filter(Order.id == order_id, Order.deleted_at.is_(None)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Validate target is a reachable previous stage
    reachable = get_reachable_previous_stages(order.status)
    reachable_statuses = [r["status"] for r in reachable]
    if req.target_status not in reachable_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot jump from {order.status} to {req.target_status}. Only previous stages are allowed."
        )

    # If jumping back from COMPLETED, clear completed_at
    if order.status == OrderStatus.COMPLETED.value:
        order.completed_at = None

    order.status = req.target_status
    db.commit()

    # Re-fetch with all relationships
    order = db.query(Order).options(
        joinedload(Order.client),
        joinedload(Order.factory),
        joinedload(Order.items).joinedload(OrderItem.product),
    ).filter(Order.id == order.id).first()

    return serialize_order(order, db)
```

**Step 4: Update get_next_stages to return all reachable previous stages**

In the `get_next_stages` endpoint (line 798), enhance the response to include all reachable previous stages. Replace the `prev_stage` building logic (lines 807-815) and the return (lines 817-825):

```python
    # Build prev_stage info from REVERSE_TRANSITIONS (single step back)
    prev_status = REVERSE_TRANSITIONS.get(order.status)
    prev_stage = None
    if prev_status:
        prev_stage = {
            "status": prev_status,
            "stage": get_stage_info(prev_status)[0],
            "name": get_stage_info(prev_status)[1],
        }

    # All reachable previous stages (for clickable timeline)
    reachable_prev = get_reachable_previous_stages(order.status)

    return {
        "current_status": order.status,
        "current_stage": get_stage_info(order.status),
        "next_stages": [
            {"status": s, "stage": get_stage_info(s)[0], "name": get_stage_info(s)[1]}
            for s in next_statuses
        ],
        "prev_stage": prev_stage,
        "reachable_previous": reachable_prev,
    }
```

**Step 5: Test with curl**

```bash
# Get reachable previous stages
curl -s "http://localhost:8000/api/orders/{ORDER_ID}/next-stages/" | python -m json.tool

# Test jump (should move order back multiple stages)
curl -s -X PUT "http://localhost:8000/api/orders/{ORDER_ID}/jump-to-stage/" \
  -H "Content-Type: application/json" -d '{"target_status":"DRAFT","reason":"testing"}'
```

**Step 6: Commit**

```bash
git add backend/routers/orders.py
git commit -m "feat: add jump-to-stage endpoint for direct stage navigation"
```

---

## Task 3: Factory Ledger Double-Entry Enhancement (Backend)

**Files:**
- Modify: `backend/routers/finance.py` — `get_factory_ledger` function (line 679)

**Step 1: Rewrite get_factory_ledger to double-entry format**

Replace the `get_factory_ledger` function (lines 679-749) with:

```python
@router.get("/factory-ledger/{factory_id}/")
def get_factory_ledger(
    factory_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get double-entry ledger for a factory: order values as debits, payments as credits."""
    factory = db.query(Factory).filter(Factory.id == factory_id).first()
    if not factory:
        raise HTTPException(status_code=404, detail="Factory not found")

    from enums import OrderStatus

    # Stages at or past FACTORY_ORDERED — these orders have a factory commitment
    factory_committed_statuses = [
        OrderStatus.FACTORY_ORDERED.value,
        OrderStatus.PRODUCTION_60.value, OrderStatus.PRODUCTION_80.value,
        OrderStatus.PRODUCTION_90.value, OrderStatus.PRODUCTION_100.value,
        OrderStatus.BOOKED.value, OrderStatus.LOADED.value, OrderStatus.SAILED.value,
        OrderStatus.ARRIVED.value, OrderStatus.CUSTOMS_FILED.value,
        OrderStatus.CLEARED.value, OrderStatus.DELIVERED.value,
        OrderStatus.COMPLETED.value, OrderStatus.COMPLETED_EDITING.value,
    ]

    # Get orders for this factory that have reached FACTORY_ORDERED or later
    orders = db.query(Order).filter(
        Order.factory_id == factory_id,
        Order.deleted_at.is_(None),
        Order.status.in_(factory_committed_statuses),
    ).all()

    if not orders:
        return {
            "entries": [],
            "summary": {"total_debit": 0, "total_credit": 0, "net_balance": 0},
            "factory_name": factory.company_name,
            "factory_id": factory_id,
        }

    order_ids = [o.id for o in orders]

    # Build all entries: debits (order values) + credits (payments)
    raw_entries = []

    for o in orders:
        active_items = [i for i in o.items if i.status == "ACTIVE"]
        total_cny = sum((i.factory_price_cny or 0) * i.quantity for i in active_items)
        exchange_rate = o.exchange_rate or 1.0
        total_inr = round(total_cny * exchange_rate, 2)
        order_number = o.order_number or o.id[:8]

        # Debit entry: factory order value
        raw_entries.append({
            "date": o.created_at.strftime("%Y-%m-%d"),
            "order_number": order_number,
            "order_id": o.id,
            "remark": f"Factory order for {order_number}",
            "debit": total_inr,
            "credit": 0,
            "amount_foreign": round(total_cny, 2),
            "currency": o.currency or "CNY",
            "exchange_rate": exchange_rate,
            "method": "-",
            "reference": order_number,
            "sort_key": (o.created_at.strftime("%Y-%m-%d"), o.created_at.isoformat(), "0"),
        })

    # Get all factory payments for these orders
    query = db.query(FactoryPayment).filter(FactoryPayment.order_id.in_(order_ids))
    if start_date:
        query = query.filter(FactoryPayment.payment_date >= date.fromisoformat(start_date))
    if end_date:
        query = query.filter(FactoryPayment.payment_date <= date.fromisoformat(end_date))

    payments = query.all()

    order_lookup = {o.id: (o.order_number or o.id[:8]) for o in orders}

    for p in payments:
        order_num = order_lookup.get(p.order_id, p.order_id[:8])
        raw_entries.append({
            "date": p.payment_date.isoformat() if p.payment_date else "",
            "order_number": order_num,
            "order_id": p.order_id,
            "remark": p.notes or f"Payment for {order_num}",
            "debit": 0,
            "credit": round(p.amount_inr, 2),
            "amount_foreign": round(p.amount, 2),
            "currency": p.currency,
            "exchange_rate": p.exchange_rate,
            "method": p.method,
            "reference": p.reference or "-",
            "sort_key": (p.payment_date.isoformat() if p.payment_date else "", p.created_at.isoformat(), "1"),
        })

    # Sort by date, then by created_at, then debits before credits
    raw_entries.sort(key=lambda e: e["sort_key"])

    # Compute running balance
    total_debit = 0
    total_credit = 0
    entries = []
    for e in raw_entries:
        total_debit += e["debit"]
        total_credit += e["credit"]
        running_balance = round(total_debit - total_credit, 2)
        entry = {k: v for k, v in e.items() if k != "sort_key"}
        entry["running_balance"] = running_balance
        entries.append(entry)

    return {
        "entries": entries,
        "summary": {
            "total_debit": round(total_debit, 2),
            "total_credit": round(total_credit, 2),
            "net_balance": round(total_debit - total_credit, 2),
        },
        "factory_name": factory.company_name,
        "factory_id": factory_id,
    }
```

**Step 2: Add OrderItem import to finance.py (if not present)**

At line 16 in `finance.py`, ensure `OrderItem` is imported:

```python
from models import Payment, FactoryPayment, Order, OrderItem, ProformaInvoice, ExchangeRate, ClientCredit, Client, Factory
```

**Step 3: Update factory ledger download helpers**

The download functions call `get_factory_ledger()` internally, so they get the new data. But the Excel/PDF column layout needs updating to match the double-entry format. Update `_generate_factory_ledger_excel` and `_generate_factory_ledger_pdf` to use columns: Date, Order, Remark, Debit (₹), Credit (₹), Balance (₹), Currency, Amount, Rate, Method, Reference.

**Step 4: Test**

```bash
curl -s "http://localhost:8000/api/finance/factory-ledger/{FACTORY_ID}/" | python -m json.tool
# Expected: entries with debit/credit/running_balance fields
```

**Step 5: Commit**

```bash
git add backend/routers/finance.py
git commit -m "feat: enhance factory ledger to double-entry format with running balance"
```

---

## Task 4: Update Factory Ledger Frontend (FactoryLedger.vue)

**Files:**
- Modify: `frontend/src/views/finance/FactoryLedger.vue`

**Step 1: Update the component to match double-entry format**

The FactoryLedger.vue currently shows a single-column payment list. Rewrite it to match the ClientLedger.vue pattern: summary cards (Total Debit, Total Credit, Net Balance) + a table with Date, Order, Remark, Debit, Credit, Balance, Method, Reference columns.

Key changes:
- `summary` ref shape: `{ total_debit: 0, total_credit: 0, net_balance: 0 }`
- Table columns: Date | Order | Remark | Debit (₹) | Credit (₹) | Balance (₹) | Method | Reference
- Summary cards: Total Debit (red), Total Credit (emerald), Net Balance (amber/emerald)
- Footer row with totals

**Step 2: Build and verify**

```bash
cd frontend && npm run build
```

**Step 3: Commit**

```bash
git add frontend/src/views/finance/FactoryLedger.vue
git commit -m "feat: update factory ledger UI to double-entry format"
```

---

## Task 5: PI Section Visibility (Frontend)

**Files:**
- Modify: `frontend/src/views/orders/OrderDetail.vue`

**Step 1: Add canGeneratePI computed**

After the `isPISent` computed (line 579), add:

```javascript
const canGeneratePI = computed(() => isPendingPI.value || isPISent.value)
```

**Step 2: Wrap Generate PI button with v-if**

In the PI section template (around line 928), wrap the Generate PI button:

Change:
```html
<button
  @click="generatePI"
  :disabled="generatingPI"
  ...
```

To:
```html
<button
  v-if="canGeneratePI"
  @click="generatePI"
  :disabled="generatingPI"
  ...
```

**Step 3: Build and verify**

```bash
cd frontend && npm run build
```

**Step 4: Commit**

```bash
git add frontend/src/views/orders/OrderDetail.vue
git commit -m "feat: restrict Generate PI button to PENDING_PI and PI_SENT stages"
```

---

## Task 6: Clickable Timeline + Jump Modal (Frontend)

**Files:**
- Modify: `frontend/src/views/orders/OrderDetail.vue`
- Modify: `frontend/src/api/index.js`

**Step 1: Add jumpToStage API call**

In `frontend/src/api/index.js`, add to the ordersApi object (after the `goBack` line):

```javascript
jumpToStage: (id, data) => api.put(`/orders/${id}/jump-to-stage/`, data),
```

**Step 2: Add jump state variables in OrderDetail.vue**

After the `transitionReason` ref (line 27), add:

```javascript
const showJumpConfirm = ref(false)
const jumpTarget = ref(null) // { status, stage, name }
const reachablePrevious = ref([])
```

**Step 3: Store reachable_previous from next-stages response**

In `loadOrder()` (around line 114), add:

```javascript
reachablePrevious.value = nextRes.data?.reachable_previous || []
```

**Step 4: Add jump functions**

After the `executeGoBack` function (after line 202), add:

```javascript
function confirmJumpToStage(target) {
  jumpTarget.value = target
  showJumpConfirm.value = true
}

async function executeJumpToStage() {
  showJumpConfirm.value = false
  if (!jumpTarget.value) return
  transitioning.value = true
  transitionError.value = ''
  try {
    await ordersApi.jumpToStage(orderId, {
      target_status: jumpTarget.value.status,
      reason: 'Direct stage navigation',
    })
    jumpTarget.value = null
    await loadOrder()
    if (isStage4Plus.value) loadPayments()
    if (isStage6Plus.value) loadFactoryPayments()
  } catch (err) {
    transitionError.value = err.response?.data?.detail || 'Jump failed'
  } finally {
    transitioning.value = false
  }
}
```

**Step 5: Make timeline circles clickable**

Replace the timeline template section (lines 850-872). The completed stage circles get `@click` + `cursor-pointer` + hover ring. Use the `reachablePrevious` array to determine which stages are clickable:

```html
<!-- Stage Timeline -->
<div class="bg-white rounded-xl shadow-sm p-4 mb-6 overflow-x-auto">
  <div class="flex items-center gap-0 min-w-max">
    <template v-for="(stage, idx) in timeline?.timeline" :key="stage.stage">
      <div class="flex items-center">
        <div class="flex flex-col items-center">
          <div
            :class="[
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              stage.status === 'completed' && reachablePrevious.some(r => r.stage === stage.stage)
                ? 'bg-emerald-500 text-white cursor-pointer hover:ring-2 hover:ring-amber-400 hover:ring-offset-1'
                : stage.status === 'completed'
                ? 'bg-emerald-500 text-white'
                : stage.status === 'current'
                ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500'
                : 'bg-slate-100 text-slate-400'
            ]"
            @click="stage.status === 'completed' && reachablePrevious.find(r => r.stage === stage.stage) ? confirmJumpToStage(reachablePrevious.find(r => r.stage === stage.stage)) : null"
            :title="stage.status === 'completed' && reachablePrevious.some(r => r.stage === stage.stage) ? 'Click to jump back to this stage' : ''"
          >
            <i v-if="stage.status === 'completed'" class="pi pi-check text-[10px]" />
            <span v-else>{{ stage.stage }}</span>
          </div>
          <span :class="['text-[10px] mt-1 whitespace-nowrap', stage.status === 'current' ? 'font-semibold text-emerald-700' : 'text-slate-400']">
            {{ stage.name }}
          </span>
        </div>
        <div v-if="idx < timeline.timeline.length - 1" :class="['w-6 h-0.5 mt-[-12px]', stage.status === 'completed' ? 'bg-emerald-500' : 'bg-slate-200']" />
      </div>
    </template>
  </div>
</div>
```

**Step 6: Add Jump Confirmation Modal**

After the existing Underpayment Warning modal (after line 2174), add:

```html
<!-- Jump to Stage Confirmation Modal -->
<div v-if="showJumpConfirm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showJumpConfirm = false">
  <div class="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 text-center">
    <div class="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
      <i class="pi pi-history text-amber-600 text-lg" />
    </div>
    <h3 class="text-lg font-semibold text-slate-800 mb-1">Jump to Stage?</h3>
    <p class="text-sm text-slate-600 mb-5">
      Jump back to <span class="font-semibold">S{{ jumpTarget?.stage }} · {{ jumpTarget?.name }}</span>
      from current stage?
    </p>
    <p class="text-xs text-amber-600 mb-4 bg-amber-50 p-2 rounded-lg">
      <i class="pi pi-exclamation-triangle text-xs" />
      This will revert the order to the selected stage.
    </p>
    <div class="flex gap-3 justify-center">
      <button @click="showJumpConfirm = false" class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
      <button @click="executeJumpToStage" class="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium">Jump Back</button>
    </div>
  </div>
</div>
```

**Step 7: Build and verify**

```bash
cd frontend && npm run build
```

**Step 8: Commit**

```bash
git add frontend/src/views/orders/OrderDetail.vue frontend/src/api/index.js
git commit -m "feat: add clickable timeline stages for direct stage navigation"
```

---

## Task 7: End-to-End Verification

**Step 1: Verify backend starts and all routes registered**

```bash
curl -s http://localhost:8000/openapi.json | python -c "
import sys,json; d=json.load(sys.stdin)
paths=[p for p in d['paths'] if 'jump' in p or 'factory-ledger' in p]
for p in paths: print(p)
"
```
Expected: See `/api/orders/{order_id}/jump-to-stage/` and `/api/finance/factory-ledger/{factory_id}/`

**Step 2: Test factory payment gate**

Test with an order at PRODUCTION_100 that has no factory payments → should get error.

**Step 3: Test jump-to-stage**

Test jumping an order back multiple stages → should succeed.

**Step 4: Test factory ledger double-entry**

```bash
curl -s "http://localhost:8000/api/finance/factory-ledger/{FACTORY_ID}/" | python -m json.tool
```
Expected: entries with debit and credit fields, running_balance.

**Step 5: Test frontend**

- Open OrderDetail → verify Generate PI only shows on PENDING_PI/PI_SENT
- Open OrderDetail → hover completed timeline stages → should show cursor pointer
- Click a completed stage → should show jump confirmation modal
- Visit Finance → Factory Ledger → should show double-entry format

**Step 6: Commit final state if any touchups needed**
