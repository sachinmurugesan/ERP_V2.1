# Client Payment Submission with Admin Approval

## Problem

Clients can only VIEW payment history — they cannot submit payments through the portal. Currently only admins can record payments. This creates a manual back-and-forth: client pays → tells admin → admin records it.

## Solution

Allow clients to submit payment proof (file + details) through their portal. Submissions go through admin approval before counting toward the balance.

## Flow

```
CLIENT clicks "Submit Payment" on Payments tab
  → Fills form: amount, method, reference/UTR, date, proof file
  → Uploads proof (JPG/PNG/PDF, max 5MB)
  → Payment created with status: PENDING_VERIFICATION
  → Does NOT count toward balance yet

ADMIN sees pending payment in PaymentsTab
  → Reviews proof file (view/download)
  → Clicks Approve → status: VERIFIED → counts toward balance
  → Or clicks Reject (with reason) → status: REJECTED → client notified
```

## Data Model Changes

### Payment model — 4 new fields (`backend/models.py`):
```python
proof_file_path: Optional[str]      # Relative path: payments/{order_id}/{filename}
verification_status: str            # PENDING_VERIFICATION | VERIFIED | REJECTED (default: VERIFIED for admin-created)
rejection_reason: Optional[str]     # Reason when REJECTED
submitted_by: Optional[str]         # User ID of client who submitted (null for admin-created)
```

### Alembic migration:
- Add 4 nullable columns with defaults
- `verification_status` defaults to `VERIFIED` (existing payments stay verified)

### Enum additions (`backend/enums.py`):
```python
class VerificationStatus(str, enum.Enum):
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"
```

## API Endpoints

### New: Client submit payment
`POST /finance/orders/{order_id}/submit-payment/`
- Auth: CLIENT role only (own orders via RLS)
- Content-Type: multipart/form-data
- Fields: payment_type, amount, currency, method, reference, payment_date, notes, proof_file
- Creates Payment with verification_status=PENDING_VERIFICATION, submitted_by=current_user.id
- File saved to: `uploads/payments/{order_id}/{uuid}_{original_filename}`
- Returns: payment record with status

### New: Admin verify payment
`POST /finance/payments/{payment_id}/verify/`
- Auth: ADMIN/SUPER_ADMIN/FINANCE only
- Body: `{ action: "approve" | "reject", reason: "..." }`
- Approve: sets verification_status=VERIFIED, recalculates credit
- Reject: sets verification_status=REJECTED, rejection_reason=reason

### New: View proof file
`GET /finance/payments/{payment_id}/proof/`
- Auth: ADMIN/SUPER_ADMIN/FINANCE + CLIENT (own payment only)
- Returns: FileResponse with the uploaded proof

### Modified: list_payments
- Exclude PENDING_VERIFICATION and REJECTED from financial totals
- Include all payments in the list with status badge
- Add verification_status, proof_file_path, submitted_by, rejection_reason to response

### Modified: create payment (admin)
- Auto-set verification_status=VERIFIED (admin-created = trusted)
- submitted_by=null (admin-created)

## Client Portal UI

### "Submit Payment" button
- Visible on Payments tab when order is PI_SENT+ and client has show_payments permission
- Opens modal form

### Modal form fields:
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Payment Type | Select | Yes | Advance / Balance |
| Amount | Number | Yes | Any amount |
| Currency | Select | Yes | Default INR |
| Payment Method | Select | Yes | Bank Transfer, UPI, Cheque, Cash, LC |
| Reference | Text | Yes | UTR, cheque no, UPI ref |
| Payment Date | Date | Yes | When transfer was made |
| Proof File | File upload | Yes | JPG/PNG/PDF, max 5MB |
| Notes | Textarea | No | Optional context |

### Payment history — status badges:
- PENDING_VERIFICATION → yellow "Pending" badge
- VERIFIED → green "Verified" badge
- REJECTED → red "Rejected" badge with reason tooltip

## Admin UI

### Pending verification section (PaymentsTab.vue)
- New section above payment history: "Pending Verification (N)"
- Each pending payment shows: date, amount, method, reference, proof link
- Two buttons per payment: [Approve] [Reject]
- Reject opens small input for reason
- On approve: payment moves to verified list, totals update

## Files to Create/Modify

| Action | File |
|--------|------|
| Modify | `backend/models.py` — add 4 fields to Payment |
| Modify | `backend/enums.py` — add VerificationStatus enum |
| Create | `backend/alembic/versions/xxxx_payment_verification.py` |
| Modify | `backend/routers/finance.py` — add submit-payment, verify, proof endpoints; modify list_payments totals |
| Modify | `backend/schemas/finance.py` — add PaymentSubmit, VerifyPayment schemas |
| Modify | `frontend/src/api/index.js` — add submitPayment, verifyPayment, viewProof methods |
| Modify | `frontend/src/views/client/ClientOrderDetail.vue` — add Submit Payment button + modal |
| Modify | `frontend/src/components/order/PaymentsTab.vue` — add Pending Verification section |

## Key Rules

1. Only VERIFIED payments count toward balance/totals
2. Client-submitted payments default to PENDING_VERIFICATION
3. Admin-created payments default to VERIFIED (backward compatible)
4. Existing payments unaffected (migration defaults to VERIFIED)
5. Proof file required for client submissions, optional for admin
6. Max file size: 5MB. Allowed types: JPG, PNG, PDF
