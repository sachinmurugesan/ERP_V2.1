# Payment Enhancements + Finance Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add stage transition safety (confirm + go back + underpayment warnings), client credit tracking, and a full Finance section with receivables, client/factory ledgers, and downloadable statements.

**Architecture:** Three phases — Phase 1 modifies existing orders.py transition logic and OrderDetail.vue to add confirm/go-back/warnings. Phase 2 adds a client_credits table and hooks into finance.py. Phase 3 creates new Finance views (Receivables, ClientLedger, FactoryLedger) with backend ledger endpoints and Excel/PDF export.

**Tech Stack:** Vue 3 + Tailwind CSS | FastAPI + SQLAlchemy + Pydantic | openpyxl (Excel) + reportlab (PDF) | SQLite

---

## Phase 1: Stage Transition Safety

### Task 1: Backend — Add REVERSE_TRANSITIONS and go-back endpoint

**Files:**
- Modify: `backend/routers/orders.py:688-708` (VALID_TRANSITIONS area)
- Modify: `backend/routers/orders.py` (add new endpoint after reopen)

**Step 1: Add REVERSE_TRANSITIONS map after VALID_TRANSITIONS (line ~709)**

```python
# Reverse transitions — go back exactly one stage
REVERSE_TRANSITIONS = {
    OrderStatus.PENDING_PI.value: OrderStatus.DRAFT.value,
    OrderStatus.PI_SENT.value: OrderStatus.PENDING_PI.value,
    OrderStatus.ADVANCE_PENDING.value: OrderStatus.PI_SENT.value,
    OrderStatus.ADVANCE_RECEIVED.value: OrderStatus.ADVANCE_PENDING.value,
    OrderStatus.FACTORY_ORDERED.value: OrderStatus.ADVANCE_RECEIVED.value,
    OrderStatus.PRODUCTION_60.value: OrderStatus.FACTORY_ORDERED.value,
    OrderStatus.PRODUCTION_80.value: OrderStatus.PRODUCTION_60.value,
    OrderStatus.PRODUCTION_90.value: OrderStatus.PRODUCTION_80.value,
    OrderStatus.PRODUCTION_100.value: OrderStatus.PRODUCTION_90.value,
    OrderStatus.BOOKED.value: OrderStatus.PRODUCTION_100.value,
    OrderStatus.LOADED.value: OrderStatus.BOOKED.value,
    OrderStatus.SAILED.value: OrderStatus.LOADED.value,
    OrderStatus.ARRIVED.value: OrderStatus.SAILED.value,
    OrderStatus.CUSTOMS_FILED.value: OrderStatus.ARRIVED.value,
    OrderStatus.CLEARED.value: OrderStatus.CUSTOMS_FILED.value,
    OrderStatus.DELIVERED.value: OrderStatus.CLEARED.value,
    OrderStatus.COMPLETED.value: OrderStatus.DELIVERED.value,
}
```

**Step 2: Add go-back endpoint (after the reopen endpoint, ~line 858)**

```python
class GoBackRequest(BaseModel):
    reason: Optional[str] = None

@router.put("/{order_id}/go-back/")
def go_back_stage(order_id: str, req: GoBackRequest, db: Session = Depends(get_db)):
    """Reverse order to previous stage."""
    order = db.query(Order).options(
        joinedload(Order.items)
    ).filter(Order.id == order_id, Order.deleted_at.is_(None)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    prev_status = REVERSE_TRANSITIONS.get(order.status)
    if not prev_status:
        raise HTTPException(status_code=400, detail=f"Cannot go back from {order.status}")

    old_status = order.status
    order.status = prev_status

    # Clear completed_at if going back from COMPLETED
    if old_status == OrderStatus.COMPLETED.value:
        order.completed_at = None

    db.commit()

    order = db.query(Order).options(
        joinedload(Order.client),
        joinedload(Order.factory),
        joinedload(Order.items).joinedload(OrderItem.product),
    ).filter(Order.id == order.id).first()

    return serialize_order(order, db)
```

**Step 3: Update next_stages endpoint to also return previous stage (line ~751)**

Modify the return value to include `prev_stage`:
```python
    prev_status = REVERSE_TRANSITIONS.get(order.status)
    prev_stage = None
    if prev_status:
        info = get_stage_info(prev_status)
        prev_stage = {"status": prev_status, "stage": info[0], "name": info[1]}

    return {
        "current_status": order.status,
        "current_stage": get_stage_info(order.status),
        "next_stages": [...],
        "prev_stage": prev_stage,
    }
```

**Step 4: Add GoBackRequest to imports/schemas section at top of file**

Ensure `Optional` from typing and `GoBackRequest` BaseModel are available.

**Step 5: Test via curl**

```bash
# Get next stages (should now include prev_stage)
curl -s http://localhost:8000/api/orders/{ORDER_ID}/next-stages/ | python -m json.tool

# Go back one stage
curl -s -X PUT http://localhost:8000/api/orders/{ORDER_ID}/go-back/ \
  -H "Content-Type: application/json" -d '{"reason":"testing"}' | python -m json.tool
```

**Step 6: Commit**
```bash
git add backend/routers/orders.py
git commit -m "feat: add go-back stage transition with REVERSE_TRANSITIONS map"
```

---

### Task 2: Backend — Add underpayment warnings to transition validation

**Files:**
- Modify: `backend/routers/orders.py:711-748` (validate_transition function)
- Modify: `backend/routers/orders.py:769-828` (transition_order endpoint)

**Step 1: Change validate_transition to return both errors and warnings**

```python
def validate_transition(order: Order, target_status: str, db: Session):
    """Run validation rules before allowing a stage transition."""
    errors = []
    warnings = []

    # ... existing validation checks ...

    # ADVANCE_PENDING → ADVANCE_RECEIVED: At least one payment must exist
    elif target_status == OrderStatus.ADVANCE_RECEIVED.value:
        payment_count = db.query(func.count(Payment.id)).filter(
            Payment.order_id == order.id
        ).scalar()
        if payment_count == 0:
            errors.append("At least one payment must be recorded")
        else:
            # Check for underpayment
            pi = db.query(ProformaInvoice).filter(
                ProformaInvoice.order_id == order.id
            ).first()
            if pi and pi.total_inr > 0:
                total_paid = db.query(func.coalesce(func.sum(Payment.amount_inr), 0)).filter(
                    Payment.order_id == order.id
                ).scalar()
                if total_paid < pi.total_inr:
                    balance = round(pi.total_inr - total_paid, 2)
                    warnings.append({
                        "type": "UNDERPAYMENT",
                        "message": f"Outstanding balance: Rs {balance:,.2f}",
                        "balance": balance,
                        "pi_total": pi.total_inr,
                        "total_paid": total_paid,
                    })

    return errors, warnings
```

**Step 2: Update transition_order endpoint to handle warnings**

Add `transition_reason` to `StageTransitionRequest`:
```python
class StageTransitionRequest(BaseModel):
    notes: Optional[str] = None
    transition_reason: Optional[str] = None  # Required when warnings exist
    acknowledge_warnings: bool = False  # Client confirms warnings
```

In the transition endpoint, after validation:
```python
    errors, warnings = validate_transition(order, target_status, db)
    if errors:
        raise HTTPException(status_code=400, detail={"validation_errors": errors})

    # If warnings exist and client hasn't acknowledged them, return warnings
    if warnings and not req.acknowledge_warnings:
        return JSONResponse(status_code=200, content={
            "status": "warnings",
            "warnings": warnings,
            "message": "Transition requires acknowledgment",
        })
```

Add `from fastapi.responses import JSONResponse` to imports.

**Step 3: Test**
```bash
# Attempt transition with underpayment — should return warnings
curl -s -X PUT "http://localhost:8000/api/orders/{ORDER_ID}/transition/?target_status=ADVANCE_RECEIVED" \
  -H "Content-Type: application/json" -d '{}' | python -m json.tool

# Acknowledge and proceed
curl -s -X PUT "http://localhost:8000/api/orders/{ORDER_ID}/transition/?target_status=ADVANCE_RECEIVED" \
  -H "Content-Type: application/json" \
  -d '{"acknowledge_warnings":true,"transition_reason":"Client promised balance next week"}' | python -m json.tool
```

**Step 4: Commit**
```bash
git add backend/routers/orders.py
git commit -m "feat: add underpayment warnings with reason requirement on stage transitions"
```

---

### Task 3: Frontend — Add ordersApi.goBack and update transitionTo

**Files:**
- Modify: `frontend/src/api/index.js:25-59` (ordersApi section)

**Step 1: Add goBack method to ordersApi**

```javascript
// Stage transitions
nextStage: (id) => api.get(`/orders/${id}/next-stages/`),
transition: (id, targetStatus, data) =>
  api.put(`/orders/${id}/transition/?target_status=${targetStatus}`, data),
goBack: (id, data) => api.put(`/orders/${id}/go-back/`, data),
reopen: (id, data) => api.put(`/orders/${id}/reopen/`, data),
```

**Step 2: Commit**
```bash
git add frontend/src/api/index.js
git commit -m "feat: add goBack API method for stage reversal"
```

---

### Task 4: Frontend — Confirmation dialog + Go Back button + Warning modal

**Files:**
- Modify: `frontend/src/views/orders/OrderDetail.vue`

This is the largest frontend change. Touches:
- State: add `prevStage`, `showTransitionConfirm`, `pendingTransition`, `showWarningModal`, `transitionWarnings`, `transitionReason`, `showGoBackConfirm`
- Functions: replace direct `transitionTo` with `confirmTransition` → modal → `executeTransition`; add `confirmGoBack` → modal → `executeGoBack`; add warning handling
- Template: modify Next Stage Buttons to use confirm; add Go Back button; add Confirmation Modal; add Warning Modal

**Step 1: Add new state variables (after existing transitioning ref)**

```javascript
const prevStage = ref(null)
const showTransitionConfirm = ref(false)
const pendingTransition = ref(null) // { status, stage, name }
const showGoBackConfirm = ref(false)
const showWarningModal = ref(false)
const transitionWarnings = ref([])
const transitionReason = ref('')
```

**Step 2: Update loadOrder to capture prevStage**

In the loadOrder function, after nextStages assignment:
```javascript
nextStages.value = nextRes.data?.next_stages || []
prevStage.value = nextRes.data?.prev_stage || null
```

**Step 3: Replace transitionTo with confirm flow**

```javascript
function confirmTransition(ns) {
  pendingTransition.value = ns
  showTransitionConfirm.value = true
}

async function executeTransition() {
  showTransitionConfirm.value = false
  if (!pendingTransition.value) return

  transitioning.value = true
  transitionError.value = ''
  try {
    const res = await ordersApi.transition(orderId, pendingTransition.value.status, {
      acknowledge_warnings: false,
    })

    // Check if backend returned warnings (not a full transition)
    if (res.data?.status === 'warnings') {
      transitionWarnings.value = res.data.warnings
      transitionReason.value = ''
      showWarningModal.value = true
      return
    }

    // Success — reload
    pendingTransition.value = null
    await loadOrder()
    // Reload payments if at Stage 4+
    if (isStage4Plus.value) loadPayments()
    if (isStage6Plus.value) loadFactoryPayments()
  } catch (err) {
    const detail = err.response?.data?.detail
    if (typeof detail === 'object' && detail.validation_errors) {
      transitionError.value = detail.validation_errors.join(', ')
    } else {
      transitionError.value = typeof detail === 'string' ? detail : 'Transition failed'
    }
  } finally {
    transitioning.value = false
  }
}

async function executeTransitionWithWarnings() {
  if (!transitionReason.value.trim()) return
  showWarningModal.value = false
  transitioning.value = true
  transitionError.value = ''
  try {
    await ordersApi.transition(orderId, pendingTransition.value.status, {
      acknowledge_warnings: true,
      transition_reason: transitionReason.value.trim(),
    })
    pendingTransition.value = null
    transitionWarnings.value = []
    transitionReason.value = ''
    await loadOrder()
    if (isStage4Plus.value) loadPayments()
    if (isStage6Plus.value) loadFactoryPayments()
  } catch (err) {
    transitionError.value = err.response?.data?.detail || 'Transition failed'
  } finally {
    transitioning.value = false
  }
}

function confirmGoBack() {
  showGoBackConfirm.value = true
}

async function executeGoBack() {
  showGoBackConfirm.value = false
  transitioning.value = true
  transitionError.value = ''
  try {
    await ordersApi.goBack(orderId, { reason: 'Stage reversal' })
    await loadOrder()
    if (isStage4Plus.value) loadPayments()
    if (isStage6Plus.value) loadFactoryPayments()
  } catch (err) {
    transitionError.value = err.response?.data?.detail || 'Go back failed'
  } finally {
    transitioning.value = false
  }
}
```

**Step 4: Update Next Stage Buttons template (line ~814)**

Replace the existing Next Stage Buttons section with:
```vue
<!-- Next Stage + Go Back Buttons -->
<div v-if="nextStages.length > 0 || prevStage" class="bg-white rounded-xl shadow-sm p-4 mb-6">
  <div class="flex items-center justify-between">
    <!-- Go Back -->
    <div>
      <button
        v-if="prevStage"
        @click="confirmGoBack"
        :disabled="transitioning"
        class="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
      >
        <i class="pi pi-arrow-left text-xs" />
        S{{ prevStage.stage }} · {{ prevStage.name }}
      </button>
    </div>
    <!-- Next Stage -->
    <div class="flex items-center gap-3">
      <span class="text-sm font-medium text-slate-600">Next:</span>
      <button
        v-for="ns in nextStages"
        :key="ns.status"
        @click="confirmTransition(ns)"
        :disabled="transitioning"
        class="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
      >
        <i v-if="transitioning" class="pi pi-spin pi-spinner text-xs" />
        <i v-else class="pi pi-arrow-right text-xs" />
        S{{ ns.stage }} · {{ ns.name }}
      </button>
    </div>
  </div>
</div>
```

**Step 5: Add Confirmation Modal, Go Back Confirm Modal, and Warning Modal (in MODALS section)**

```vue
<!-- Stage Transition Confirmation -->
<div v-if="showTransitionConfirm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showTransitionConfirm = false">
  <div class="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
    <div class="flex items-center gap-3 mb-4">
      <div class="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
        <i class="pi pi-arrow-right text-emerald-600" />
      </div>
      <div>
        <h3 class="text-lg font-semibold text-slate-800">Advance Stage?</h3>
        <p class="text-sm text-slate-500">Move to S{{ pendingTransition?.stage }} · {{ pendingTransition?.name }}</p>
      </div>
    </div>
    <div class="flex gap-3 justify-end">
      <button @click="showTransitionConfirm = false" class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
      <button @click="executeTransition" class="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Confirm</button>
    </div>
  </div>
</div>

<!-- Go Back Confirmation -->
<div v-if="showGoBackConfirm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showGoBackConfirm = false">
  <div class="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
    <div class="flex items-center gap-3 mb-4">
      <div class="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
        <i class="pi pi-arrow-left text-amber-600" />
      </div>
      <div>
        <h3 class="text-lg font-semibold text-slate-800">Go Back?</h3>
        <p class="text-sm text-slate-500">Revert to S{{ prevStage?.stage }} · {{ prevStage?.name }}</p>
      </div>
    </div>
    <div class="flex gap-3 justify-end">
      <button @click="showGoBackConfirm = false" class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
      <button @click="executeGoBack" class="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700">Go Back</button>
    </div>
  </div>
</div>

<!-- Underpayment Warning Modal -->
<div v-if="showWarningModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div class="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
    <div class="px-6 py-4 border-b border-amber-200 bg-amber-50 rounded-t-xl">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-amber-200 rounded-full flex items-center justify-center">
          <i class="pi pi-exclamation-triangle text-amber-700" />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-amber-800">Outstanding Balance</h3>
          <p class="text-sm text-amber-600">Payment is below the PI total</p>
        </div>
      </div>
    </div>
    <div class="px-6 py-4 space-y-3">
      <div v-for="w in transitionWarnings" :key="w.type" class="bg-amber-50 border border-amber-200 rounded-lg p-3">
        <div class="grid grid-cols-3 gap-2 text-sm">
          <div><span class="text-slate-400 text-xs block">PI Total</span><span class="font-semibold">₹{{ w.pi_total?.toLocaleString() }}</span></div>
          <div><span class="text-slate-400 text-xs block">Paid</span><span class="font-semibold text-emerald-700">₹{{ w.total_paid?.toLocaleString() }}</span></div>
          <div><span class="text-slate-400 text-xs block">Balance</span><span class="font-semibold text-red-600">₹{{ w.balance?.toLocaleString() }}</span></div>
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Reason for proceeding <span class="text-red-500">*</span></label>
        <textarea
          v-model="transitionReason"
          rows="2"
          placeholder="e.g., Client promised balance next week..."
          class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
        />
      </div>
    </div>
    <div class="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end">
      <button @click="showWarningModal = false; pendingTransition = null" class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
      <button
        @click="executeTransitionWithWarnings"
        :disabled="!transitionReason.trim()"
        class="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
      >
        Proceed Anyway
      </button>
    </div>
  </div>
</div>
```

**Step 6: Test visually**
- Navigate to an order → verify Next Stage buttons show confirmation
- Verify Go Back button appears (except at DRAFT)
- At Stage 4 with underpayment → verify warning modal appears with reason required

**Step 7: Commit**
```bash
git add frontend/src/views/orders/OrderDetail.vue frontend/src/api/index.js
git commit -m "feat: add stage transition confirmation, go-back, and underpayment warning"
```

---

## Phase 2: Client Credit / Overpayment

### Task 5: Backend — Add ClientCredit model

**Files:**
- Modify: `backend/models.py` (add after FactoryPayment class, ~line 266)
- Modify: `backend/enums.py` (add CreditStatus enum)

**Step 1: Add CreditStatus enum to enums.py**

```python
class CreditStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    APPLIED = "APPLIED"
    EXPIRED = "EXPIRED"
```

**Step 2: Add ClientCredit model to models.py**

```python
class ClientCredit(Base):
    """Tracks client overpayments as credits for future orders"""
    __tablename__ = "client_credits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), index=True)
    source_order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"))
    amount: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default=CreditStatus.AVAILABLE.value)
    applied_to_order_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("orders.id"), nullable=True)
    applied_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

**Step 3: Run server to create table (auto via create_all), then verify**

```bash
python -c "import sqlite3; conn=sqlite3.connect('harvesterpdata.db'); print([c[1] for c in conn.execute('PRAGMA table_info(client_credits)').fetchall()])"
```

**Step 4: Commit**
```bash
git add backend/models.py backend/enums.py
git commit -m "feat: add ClientCredit model for overpayment tracking"
```

---

### Task 6: Backend — Auto-create credit on overpayment + apply credit endpoint

**Files:**
- Modify: `backend/routers/finance.py`

**Step 1: Add auto-credit creation in create_payment**

After `db.commit()` in `create_payment`, add:
```python
    # Check for overpayment → auto-create client credit
    pi = db.query(ProformaInvoice).filter(ProformaInvoice.order_id == order_id).first()
    if pi and pi.total_inr > 0:
        total_paid = db.query(func.coalesce(func.sum(Payment.amount_inr), 0)).filter(
            Payment.order_id == order_id
        ).scalar()
        if total_paid > pi.total_inr:
            surplus = round(total_paid - pi.total_inr, 2)
            # Check if credit already exists for this order
            existing_credit = db.query(ClientCredit).filter(
                ClientCredit.source_order_id == order_id,
                ClientCredit.status == CreditStatus.AVAILABLE.value,
            ).first()
            if existing_credit:
                existing_credit.amount = surplus
            else:
                db.add(ClientCredit(
                    client_id=order.client_id,
                    source_order_id=order_id,
                    amount=surplus,
                    notes=f"Overpayment on {order.order_number or order_id}",
                ))
            db.commit()
```

**Step 2: Add credit endpoints**

```python
@router.get("/clients/{client_id}/credits/")
def list_client_credits(client_id: str, db: Session = Depends(get_db)):
    """List available credits for a client."""
    credits = db.query(ClientCredit).filter(
        ClientCredit.client_id == client_id,
        ClientCredit.status == CreditStatus.AVAILABLE.value,
    ).order_by(ClientCredit.created_at.desc()).all()
    return [...]

@router.post("/orders/{order_id}/apply-credit/")
def apply_credit(order_id: str, data: ApplyCreditRequest, db: Session = Depends(get_db)):
    """Apply an available client credit as advance payment on an order."""
    # Find credit, verify AVAILABLE, create Payment record, mark APPLIED
    ...
```

**Step 3: Add imports for ClientCredit, CreditStatus**

**Step 4: Test**
```bash
# Create payment that causes overpayment
# Check client credits created
curl -s http://localhost:8000/api/finance/clients/{CLIENT_ID}/credits/ | python -m json.tool
```

**Step 5: Commit**
```bash
git add backend/routers/finance.py
git commit -m "feat: auto-create client credit on overpayment + apply credit endpoint"
```

---

## Phase 3: Finance Section

### Task 7: Backend — Receivables + Ledger endpoints

**Files:**
- Modify: `backend/routers/finance.py`

**Step 1: Add receivables endpoint**

```python
@router.get("/receivables/")
def list_receivables(client_id: Optional[str] = None, status: str = "outstanding", db: Session = Depends(get_db)):
    """List all orders with outstanding balances."""
    # Query orders that have a PI, join with payments to calculate outstanding
    # Filter by client_id if provided
    # status: 'outstanding' (balance > 0), 'settled' (balance <= 0), 'all'
    ...
```

**Step 2: Add client ledger endpoint**

```python
@router.get("/client-ledger/{client_id}/")
def get_client_ledger(client_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None, db: Session = Depends(get_db)):
    """Get full payment ledger for a client across all orders."""
    # Query all payments for orders belonging to this client
    # Include: date, order_number, remark, debit/credit, running_balance, method, reference
    ...
```

**Step 3: Add factory ledger endpoint**

```python
@router.get("/factory-ledger/{factory_id}/")
def get_factory_ledger(factory_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None, db: Session = Depends(get_db)):
    """Get full payment ledger for a factory across all orders."""
    # Query all factory payments for orders belonging to this factory
    ...
```

**Step 4: Test all three endpoints**

**Step 5: Commit**
```bash
git add backend/routers/finance.py
git commit -m "feat: add receivables, client ledger, and factory ledger endpoints"
```

---

### Task 8: Backend — Statement downloads (Excel + PDF)

**Files:**
- Modify: `backend/routers/finance.py`
- May need: `pip install reportlab` for PDF generation

**Step 1: Install reportlab**
```bash
pip install reportlab
```

**Step 2: Add Excel download for client ledger**

```python
@router.get("/client-ledger/{client_id}/download/")
def download_client_ledger(client_id: str, format: str = "xlsx", ...):
    """Download client ledger as Excel or PDF."""
    if format == "xlsx":
        # Use openpyxl to create workbook
        # Header: Company name, client info, date range
        # Table: Date, Order#, Remark, Debit, Credit, Balance, Method, Reference
        # Summary row at bottom
        ...
    elif format == "pdf":
        # Use reportlab to create PDF
        # Company header, client details, date range
        # Ledger table, running balance, period totals
        ...
```

**Step 3: Add Excel/PDF download for factory ledger (same pattern)**

**Step 4: Test downloads**
```bash
curl -s "http://localhost:8000/api/finance/client-ledger/{CLIENT_ID}/download/?format=xlsx" -o test_client_ledger.xlsx
curl -s "http://localhost:8000/api/finance/factory-ledger/{FACTORY_ID}/download/?format=pdf" -o test_factory_ledger.pdf
```

**Step 5: Commit**
```bash
git add backend/routers/finance.py
git commit -m "feat: add Excel and PDF statement downloads for client/factory ledgers"
```

---

### Task 9: Frontend — Finance navigation + Router setup

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.vue:9-23`
- Modify: `frontend/src/router/index.js:104-128`
- Create: `frontend/src/views/finance/FinanceLayout.vue` (wrapper with sub-nav)

**Step 1: Update sidebar — replace Receivables with Finance section**

In menuItems array, replace:
```javascript
{ label: 'Receivables', icon: 'pi pi-indian-rupee', route: '/receivables' },
```
With:
```javascript
{ label: 'Finance', icon: 'pi pi-chart-line', route: '/finance' },
```

**Step 2: Update router — add finance routes**

Replace the receivables route with:
```javascript
{
  path: '/finance',
  component: () => import('../views/finance/FinanceLayout.vue'),
  children: [
    { path: '', redirect: '/finance/receivables' },
    { path: 'receivables', name: 'Receivables', component: () => import('../views/finance/Receivables.vue') },
    { path: 'client-ledger', name: 'ClientLedger', component: () => import('../views/finance/ClientLedger.vue') },
    { path: 'factory-ledger', name: 'FactoryLedger', component: () => import('../views/finance/FactoryLedger.vue') },
  ],
  meta: { title: 'Finance', icon: 'pi-chart-line' }
},
```

**Step 3: Create FinanceLayout.vue with sub-navigation tabs**

Horizontal tab bar: Receivables | Client Ledger | Factory Ledger
Below: `<router-view />`

**Step 4: Commit**
```bash
git add frontend/src/components/layout/Sidebar.vue frontend/src/router/index.js frontend/src/views/finance/
git commit -m "feat: add Finance section with sub-navigation and route setup"
```

---

### Task 10: Frontend — Receivables page

**Files:**
- Create: `frontend/src/views/finance/Receivables.vue`
- Modify: `frontend/src/api/index.js` (add financeApi)

**Step 1: Add financeApi to api/index.js**

```javascript
export const financeApi = {
  receivables: (params) => api.get('/finance/receivables/', { params }),
  clientLedger: (clientId, params) => api.get(`/finance/client-ledger/${clientId}/`, { params }),
  factoryLedger: (factoryId, params) => api.get(`/finance/factory-ledger/${factoryId}/`, { params }),
  clientCredits: (clientId) => api.get(`/finance/clients/${clientId}/credits/`),
  downloadClientLedger: (clientId, format, params) =>
    api.get(`/finance/client-ledger/${clientId}/download/`, { params: { format, ...params }, responseType: 'blob' }),
  downloadFactoryLedger: (factoryId, format, params) =>
    api.get(`/finance/factory-ledger/${factoryId}/download/`, { params: { format, ...params }, responseType: 'blob' }),
}
```

**Step 2: Build Receivables.vue**

- Client filter dropdown
- Status filter (Outstanding / Settled / All)
- Data table: Order#, Client, Factory, PI Total, Paid, Outstanding, Last Payment, Days Outstanding
- Summary row with total outstanding
- Unique UI: colored outstanding amounts (red for high, amber for medium, emerald for settled)

**Step 3: Commit**
```bash
git add frontend/src/views/finance/Receivables.vue frontend/src/api/index.js
git commit -m "feat: build Receivables page with filters and summary"
```

---

### Task 11: Frontend — Client Ledger page

**Files:**
- Create: `frontend/src/views/finance/ClientLedger.vue`

**Step 1: Build ClientLedger.vue**

- Client dropdown filter, date range pickers
- Ledger table: Date, Order#, Remark, Debit (INR), Credit (INR), Running Balance, Method, Reference
- Download buttons: "Excel" | "PDF"
- Credits section showing available credits
- Unique UI: debit in red, credit in green, running balance with visual indicator

**Step 2: Commit**
```bash
git add frontend/src/views/finance/ClientLedger.vue
git commit -m "feat: build Client Ledger page with download options"
```

---

### Task 12: Frontend — Factory Ledger page

**Files:**
- Create: `frontend/src/views/finance/FactoryLedger.vue`

**Step 1: Build FactoryLedger.vue**

- Factory dropdown filter, date range pickers
- Ledger table: Date, Order#, Remark, Amount (Original), Rate, Amount (INR), Method, Reference
- Download buttons: "Excel" | "PDF"
- Unique UI: multi-currency display, exchange rate column

**Step 2: Commit**
```bash
git add frontend/src/views/finance/FactoryLedger.vue
git commit -m "feat: build Factory Ledger page with multi-currency support"
```

---

### Task 13: Final verification + cleanup

**Step 1: Full smoke test**
- Stage transitions: confirm dialog, go back, underpayment warning
- Payments: create, delete, overpayment credit creation
- Finance: Receivables loads, Client Ledger loads, Factory Ledger loads
- Downloads: Excel and PDF generate correctly

**Step 2: Code cleanup — remove any debug prints, consolidate imports**

**Step 3: Final commit**
```bash
git add -A
git commit -m "chore: cleanup and verify payment enhancements + finance module"
```

---

## Summary

| Phase | Tasks | Files Changed |
|-------|-------|---------------|
| Phase 1: Stage Safety | Tasks 1-4 | orders.py, OrderDetail.vue, api/index.js |
| Phase 2: Client Credit | Tasks 5-6 | models.py, enums.py, finance.py |
| Phase 3: Finance Section | Tasks 7-12 | finance.py, Sidebar.vue, router, 4 new Vue files |
| Cleanup | Task 13 | All |
