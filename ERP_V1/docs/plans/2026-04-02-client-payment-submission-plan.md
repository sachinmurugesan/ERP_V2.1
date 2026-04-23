# Client Payment Submission Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow clients to submit payment proof (file + details) through their portal, with admin approval before it counts toward balance.

**Architecture:** Add `verification_status`, `proof_file_path`, `rejection_reason`, `submitted_by` to Payment model. New client-facing submit endpoint accepts multipart form. New admin verify endpoint approves/rejects. Finance totals only count VERIFIED payments.

**Tech Stack:** FastAPI (multipart upload), SQLAlchemy, Alembic, Vue 3, openpyxl existing patterns

---

### Task 1: Alembic Migration — Add verification fields to Payment

**Files:**
- Modify: `backend/models.py` (Payment class, ~line 324)
- Modify: `backend/enums.py` (add VerificationStatus)
- Create: `backend/alembic/versions/xxxx_payment_verification_fields.py`

**Step 1: Add enum**

In `backend/enums.py`, add after PaymentMethod:
```python
class VerificationStatus(str, enum.Enum):
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"
```

**Step 2: Add model fields**

In `backend/models.py`, add to Payment class after `updated_at`:
```python
proof_file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
verification_status: Mapped[str] = mapped_column(
    String(30), default=VerificationStatus.VERIFIED.value, server_default="VERIFIED"
)
rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
submitted_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
```

**Step 3: Create migration**

```python
# alembic/versions/b2c3d4e5f6g7_payment_verification_fields.py
def upgrade():
    with op.batch_alter_table("payments") as batch_op:
        batch_op.add_column(sa.Column("proof_file_path", sa.String(500), nullable=True))
        batch_op.add_column(sa.Column("verification_status", sa.String(30), server_default="VERIFIED", nullable=False))
        batch_op.add_column(sa.Column("rejection_reason", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("submitted_by", sa.String(36), nullable=True))
```

**Step 4: Run migration**

```bash
cd backend && python -m alembic upgrade head
```

**Step 5: Verify**

```bash
python -c "from models import Payment; print('ok')"
```

---

### Task 2: Backend Schemas — PaymentSubmit + VerifyPayment

**Files:**
- Modify: `backend/schemas/finance.py`

**Step 1: Add schemas**

```python
class PaymentSubmitResponse(BaseModel):
    id: str
    order_id: str
    payment_type: str
    amount: float
    currency: str
    exchange_rate: float
    amount_inr: float
    method: str
    reference: Optional[str] = None
    notes: Optional[str] = None
    payment_date: str
    verification_status: str
    proof_file_path: Optional[str] = None
    created_at: str

class VerifyPaymentRequest(BaseModel):
    action: str  # "approve" or "reject"
    reason: Optional[str] = None  # Required when action="reject"
```

**Step 2: Update PaymentOut/PaymentResponse**

Add to existing PaymentOut and PaymentResponse:
```python
verification_status: str = "VERIFIED"
proof_file_path: Optional[str] = None
rejection_reason: Optional[str] = None
submitted_by: Optional[str] = None
```

---

### Task 3: Backend — Client Submit Payment Endpoint

**Files:**
- Modify: `backend/routers/finance.py`

**Step 1: Add imports**

```python
from fastapi import UploadFile, File, Form
from fastapi.responses import FileResponse
from core.file_upload import stream_upload_to_disk, sanitize_filename
from config import UPLOAD_DIR
from enums import VerificationStatus
import uuid as uuid_mod
```

**Step 2: Create submit endpoint**

```python
@router.post("/orders/{order_id}/submit-payment/")
async def submit_payment(
    order_id: str,
    payment_type: str = Form(...),
    amount: float = Form(...),
    currency: str = Form("INR"),
    exchange_rate: float = Form(1.0),
    method: str = Form("BANK_TRANSFER"),
    reference: str = Form(...),
    payment_date: str = Form(...),
    notes: Optional[str] = Form(None),
    proof_file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Client submits a payment with proof file. Goes to PENDING_VERIFICATION."""
    # Auth: CLIENT only
    if current_user.user_type != "CLIENT":
        raise HTTPException(status_code=403, detail="Only clients can submit payments")

    order = db.query(Order).filter(Order.id == order_id, Order.deleted_at.is_(None)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # RLS: client can only submit for their own orders
    if order.client_id != current_user.client_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Validate file type
    allowed_types = {"image/jpeg", "image/png", "application/pdf"}
    if proof_file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, or PDF files are allowed")

    # Save proof file
    proof_dir = UPLOAD_DIR / "payments" / order_id
    proof_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f"{uuid_mod.uuid4().hex[:8]}_{sanitize_filename(proof_file.filename)}"
    proof_path = proof_dir / safe_name
    max_size = 5 * 1024 * 1024  # 5MB
    await stream_upload_to_disk(proof_file, proof_path, max_size)
    relative_path = f"payments/{order_id}/{safe_name}"

    # Create payment record
    amount_inr = round(amount * exchange_rate, 2)
    payment = Payment(
        order_id=order_id,
        payment_type=payment_type,
        amount=amount,
        currency=currency,
        exchange_rate=exchange_rate,
        amount_inr=amount_inr,
        method=method,
        reference=reference,
        notes=notes,
        payment_date=date.fromisoformat(payment_date),
        proof_file_path=relative_path,
        verification_status=VerificationStatus.PENDING_VERIFICATION.value,
        submitted_by=current_user.id,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    # TODO: Send notification to admin about pending payment

    return {
        "id": payment.id,
        "verification_status": payment.verification_status,
        "amount_inr": payment.amount_inr,
        "message": "Payment submitted for verification",
    }
```

---

### Task 4: Backend — Admin Verify + Proof Download Endpoints

**Files:**
- Modify: `backend/routers/finance.py`

**Step 1: Verify endpoint**

```python
@router.post("/payments/{payment_id}/verify/")
def verify_payment(
    payment_id: str,
    data: VerifyPaymentRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin approves or rejects a client-submitted payment."""
    if current_user.role not in ("ADMIN", "SUPER_ADMIN", "FINANCE"):
        raise HTTPException(status_code=403, detail="Not authorized")

    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    if payment.verification_status != VerificationStatus.PENDING_VERIFICATION.value:
        raise HTTPException(status_code=400, detail="Payment is not pending verification")

    if data.action == "approve":
        payment.verification_status = VerificationStatus.VERIFIED.value
        # Recalculate credit (same as admin-created payment)
        _recalculate_credit(payment.order_id, db)
    elif data.action == "reject":
        if not data.reason:
            raise HTTPException(status_code=400, detail="Rejection reason is required")
        payment.verification_status = VerificationStatus.REJECTED.value
        payment.rejection_reason = data.reason
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    db.commit()
    return {"status": payment.verification_status, "message": f"Payment {data.action}d"}
```

**Step 2: Proof download endpoint**

```python
@router.get("/payments/{payment_id}/proof/")
def download_proof(
    payment_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download payment proof file."""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment or not payment.proof_file_path:
        raise HTTPException(status_code=404, detail="Proof not found")

    # RLS: CLIENT can only see own payment proof
    if current_user.user_type == "CLIENT":
        order = db.query(Order).filter(Order.id == payment.order_id).first()
        if not order or order.client_id != current_user.client_id:
            raise HTTPException(status_code=403, detail="Access denied")

    full_path = UPLOAD_DIR / payment.proof_file_path
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=str(full_path),
        filename=os.path.basename(payment.proof_file_path),
    )
```

---

### Task 5: Backend — Fix list_payments Totals

**Files:**
- Modify: `backend/routers/finance.py` (list_payments function)

**Step 1: Exclude non-verified from totals**

In `list_payments()`, change the total_paid calculation:
```python
# Only VERIFIED payments count toward balance
verified_payments = [p for p in payments if getattr(p, 'verification_status', 'VERIFIED') == 'VERIFIED']
total_paid_inr = sum(p.amount_inr for p in verified_payments)
```

**Step 2: Add verification fields to payment_list serialization**

Add to the payment dict comprehension:
```python
"verification_status": getattr(p, 'verification_status', 'VERIFIED'),
"proof_file_path": getattr(p, 'proof_file_path', None),
"rejection_reason": getattr(p, 'rejection_reason', None),
"submitted_by": getattr(p, 'submitted_by', None),
```

**Step 3: Fix admin create_payment**

In existing `create_payment()`, ensure admin-created payments are VERIFIED:
```python
payment = Payment(
    ...existing fields...,
    verification_status=VerificationStatus.VERIFIED.value,
    submitted_by=None,  # admin-created
)
```

---

### Task 6: Frontend — API Methods

**Files:**
- Modify: `frontend/src/api/index.js`

**Step 1: Add payment submission API**

In `paymentsApi` object:
```javascript
submitPayment: (orderId, formData) =>
    api.post(`/finance/orders/${orderId}/submit-payment/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
    }),
verifyPayment: (paymentId, data) =>
    api.post(`/finance/payments/${paymentId}/verify/`, data),
downloadProof: (paymentId) =>
    api.get(`/finance/payments/${paymentId}/proof/`, { responseType: 'blob' }),
```

---

### Task 7: Frontend — Client Submit Payment Modal

**Files:**
- Modify: `frontend/src/views/client/ClientOrderDetail.vue`

**Step 1: Add state refs**

```javascript
const showPaymentModal = ref(false)
const paymentSubmitting = ref(false)
const paymentForm = ref({
    payment_type: 'CLIENT_ADVANCE',
    amount: '',
    currency: 'INR',
    method: 'BANK_TRANSFER',
    reference: '',
    payment_date: new Date().toISOString().split('T')[0],
    notes: '',
})
const proofFile = ref(null)
```

**Step 2: Add submit function**

```javascript
async function submitPayment() {
    if (!proofFile.value || !paymentForm.value.amount || !paymentForm.value.reference) return
    paymentSubmitting.value = true
    try {
        const fd = new FormData()
        fd.append('payment_type', paymentForm.value.payment_type)
        fd.append('amount', paymentForm.value.amount)
        fd.append('currency', paymentForm.value.currency)
        fd.append('exchange_rate', '1.0')
        fd.append('method', paymentForm.value.method)
        fd.append('reference', paymentForm.value.reference)
        fd.append('payment_date', paymentForm.value.payment_date)
        fd.append('notes', paymentForm.value.notes || '')
        fd.append('proof_file', proofFile.value)
        await paymentsApi.submitPayment(orderId, fd)
        showPaymentModal.value = false
        proofFile.value = null
        await loadPayments()
        showToast('success', 'Payment submitted for verification')
    } catch (e) {
        showToast('error', e.response?.data?.detail || 'Failed to submit payment')
    } finally {
        paymentSubmitting.value = false
    }
}
```

**Step 3: Add "Submit Payment" button**

In the payments tab, add button next to or below the Payment Summary:
```html
<button @click="showPaymentModal = true"
    class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2">
    <i class="pi pi-plus text-xs" /> Submit Payment
</button>
```

**Step 4: Add modal template**

Full modal with: payment type select, amount input, method select, reference input, date input, file drop zone, notes textarea, submit/cancel buttons.

**Step 5: Add status badges in payment history**

```html
<td class="px-4 py-2">
    <span v-if="p.verification_status === 'PENDING_VERIFICATION'"
        class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">Pending</span>
    <span v-else-if="p.verification_status === 'VERIFIED'"
        class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">Verified</span>
    <span v-else-if="p.verification_status === 'REJECTED'"
        class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700"
        :title="p.rejection_reason">Rejected</span>
</td>
```

---

### Task 8: Frontend — Admin Pending Verification Section

**Files:**
- Modify: `frontend/src/components/order/PaymentsTab.vue`

**Step 1: Add pending payments computed**

```javascript
const pendingPayments = computed(() =>
    payments.value.filter(p => p.verification_status === 'PENDING_VERIFICATION')
)
```

**Step 2: Add verify/reject functions**

```javascript
async function verifyPayment(paymentId, action, reason = '') {
    try {
        await paymentsApi.verifyPayment(paymentId, { action, reason })
        await loadPayments()
    } catch (e) {
        console.error('Verify failed:', e)
    }
}
```

**Step 3: Add pending section template**

Above the existing Client Payments section, add a "Pending Verification" card with amber border showing each pending payment with [Approve] [Reject] buttons and a [View Proof] link.

**Step 4: Add reject reason input**

Small inline input that appears when admin clicks Reject — requires reason text before confirming.

---

### Task 9: Verification

**Step 1:** `python -m alembic upgrade head` — migration succeeds
**Step 2:** `python -m pytest tests/test_transparency.py -x -q` — all pass
**Step 3:** `npm run build` — zero errors
**Step 4:** Manual test flow:
  - Login as client → go to order → Payments tab → Submit Payment
  - Fill form, upload proof file → submit → see "Pending" badge
  - Login as admin → same order → Payments tab → see Pending section
  - Click Approve → payment moves to verified, totals update
  - Test Reject flow with reason
