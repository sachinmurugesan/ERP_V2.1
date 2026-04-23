# Payment Endpoint Role Gate Audit — finance.py

**Audit date:** 2026-04-22  
**Triggered by:** Wave 8 Session A flag — `ordertab_payments.md` Q-001 [UNCLEAR] on `verifyPayment`  
**Scope:** All payment mutation endpoints in `backend/routers/finance.py`  
**Auditor:** Migration audit pipeline  
**Method:** Direct code read of finance.py + cross-reference against AUTHZ_SURFACE.md and DECISIONS.md D-004

---

## Verdict Summary

**All payment mutation endpoints are correctly gated. No missing role checks.**

The session-summary interim finding that `create_payment` and `delete_payment` had "MISSING GATE" was incorrect — it observed the absence of an *inline* role check without accounting for the router-level `require_finance` dependency that applies to every handler on the main `router`. The final verdict is CLEAN across all 10+ endpoints.

---

## Router dependency context

From `backend/core/security.py`:

```python
require_finance = require_role([UserRole.ADMIN, UserRole.FINANCE])
# Effective access (has_any_role SUPER_ADMIN bypass):  ADMIN | SUPER_ADMIN | FINANCE

require_factory_financial = require_role([UserRole.SUPER_ADMIN, UserRole.FINANCE])
# Effective access:  SUPER_ADMIN | FINANCE  (ADMIN deliberately excluded per D-004)
```

From `main.py` (router-level dependency map from AUTHZ_SURFACE.md):

```
/api/finance  main router  → require_finance     → ADMIN | SA | FINANCE
/api/finance  client_router → get_current_user   → any authenticated user
```

Every handler registered on `router` (the main finance router) inherits `require_finance`. Handlers on `client_router` have `get_current_user` only and must carry their own inline role/type checks.

---

## Full endpoint-by-endpoint table

| Endpoint | Handler | Line | Router | Router-level auth | Inline check | Effective roles | Verdict |
|---|---|---|---|---|---|---|---|
| `POST /orders/{oid}/payments/` | `create_payment` | 355 | main `router` | `require_finance` | **NONE** (not needed) | ADMIN\|SA\|FINANCE | ✅ CLEAN |
| `DELETE /orders/{oid}/payments/{pid}/` | `delete_payment` | 412 | main `router` | `require_finance` | **NONE** (not needed) | ADMIN\|SA\|FINANCE | ✅ CLEAN |
| `PUT /orders/{oid}/payments/{pid}/` | `update_payment` | 455 | main `router` | `require_finance` | `role not in ("ADMIN","SUPER_ADMIN","FINANCE")` | ADMIN\|SA\|FINANCE | ✅ CLEAN (double-gated) |
| `POST /orders/{oid}/submit-payment/` | `submit_payment` | 531 | `client_router` | `get_current_user` | `user_type != "CLIENT"` | CLIENT only | ✅ CLEAN |
| `POST /payments/{pid}/verify/` | `verify_payment` | 640 | main `router` | `require_finance` | `role not in ("ADMIN","SUPER_ADMIN","FINANCE")` | ADMIN\|SA\|FINANCE | ✅ CLEAN (double-gated) |
| `GET /orders/{oid}/factory-payments/` | `list_factory_payments` | 724 | main `router` | `require_finance` | `_: None = Depends(require_factory_financial)` | SA\|FINANCE | ✅ CLEAN |
| `POST /orders/{oid}/factory-payments/` | `create_factory_payment` | 804 | main `router` | `require_finance` | `_: None = Depends(require_factory_financial)` | SA\|FINANCE | ✅ CLEAN |
| `DELETE /orders/{oid}/factory-payments/{pid}/` | `delete_factory_payment` | 850 | main `router` | `require_finance` | `_: None = Depends(require_factory_financial)` | SA\|FINANCE | ✅ CLEAN |
| `PUT /orders/{oid}/factory-payments/{pid}/` | `update_factory_payment` | 887 | main `router` | `require_finance` | `_: None = Depends(require_factory_financial)` | SA\|FINANCE | ✅ CLEAN |
| `GET /orders/{oid}/payment-audit-log/` | `get_payment_audit_log` | 952 | main `router` | `require_finance` | `_: None = Depends(require_factory_financial)` | SA\|FINANCE | ✅ CLEAN |
| `POST /orders/{oid}/apply-credit/` | `apply_credit` | 1070 | main `router` | `require_finance` | **NONE** (not needed) | ADMIN\|SA\|FINANCE | ✅ CLEAN |
| `POST /orders/{oid}/apply-factory-credit/` | `apply_factory_credit` | 1410 | main `router` | `require_finance` | `_: None = Depends(require_factory_financial)` | SA\|FINANCE | ✅ CLEAN |
| `GET /orders/{oid}/payments/` | `list_payments` | 46 | `client_router` | `get_current_user` | **NONE** — read-only, intentionally open to CLIENT | Any authenticated | ✅ CLEAN (read endpoint, data scoped to order) |

---

## D-004 compliance check

D-004 permission matrix entry: `verify_payments: ['SUPER_ADMIN', 'ADMIN', 'FINANCE']`

Actual `verify_payment` effective roles: **ADMIN | SUPER_ADMIN | FINANCE**

**COMPLIANT.** The backend precisely matches the D-004 requirement. OPERATIONS cannot call any payment mutation endpoint — the router-level `require_finance` blocks them at the dependency layer.

---

## verifyPayment [UNCLEAR] — RESOLVED CLEAN

The [UNCLEAR] flag in `ordertab_payments.md` Q-001 asked:

> "Grep `backend/routers/payments.py` for the verify endpoint handler and confirm it has `current_user` parameter with `role in ('FINANCE', 'ADMIN', 'SUPER_ADMIN')` inline check."

**Finding:** No `backend/routers/payments.py` file exists. All payment logic is in `backend/routers/finance.py`.

`verify_payment` at `finance.py:640`:
```python
def verify_payment(payment_id: str, data: VerifyPaymentRequest,
                   current_user: CurrentUser = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    if current_user.role not in ("ADMIN", "SUPER_ADMIN", "FINANCE"):
        raise HTTPException(status_code=403, detail="Not authorized")
```

Additionally protected by router-level `require_finance`. Double-gated. **CLEAN.**

---

## create_payment and delete_payment — interim "MISSING GATE" finding retracted

The interim analysis (before finance.py was fully read) flagged `create_payment` and `delete_payment` as "MISSING GATE" because their function bodies contained no inline role check. This was an incomplete reading:

- Both handlers are registered on `@router` (the main finance router), which carries `require_finance` as its FastAPI router-level dependency.
- Router-level dependencies run before the handler function body, providing ADMIN|SA|FINANCE gating without needing repetition inside each function.
- `update_payment` adds a redundant inline check (defensive duplication), while `create_payment` and `delete_payment` rely on the router level alone — both approaches are correct.
- AUTHZ_SURFACE.md's "OK" classification for all three is verified accurate.

**No G-ticket needed. No patch needed.**

---

## Notable observations (not findings)

### create_payment: immediately VERIFIED status
```python
verification_status=PaymentVerificationStatus.VERIFIED.value,
```
When INTERNAL staff (ADMIN|SA|FINANCE) record a payment via `create_payment`, it is immediately set to VERIFIED. This is intentional design: staff recording a wire transfer that already occurred. The verification workflow (PENDING → APPROVED) applies only to client-submitted payment proofs via `submit_payment` (client_router). No security concern.

### Factory endpoint double-dep pattern
Factory financial endpoints use both the router-level `require_finance` AND a per-endpoint `Depends(require_factory_financial)`. Effective access is the intersection: (ADMIN|SA|FINANCE) ∩ (SA|FINANCE) = **SA|FINANCE**. This correctly excludes ADMIN from factory cost data per D-004.

> Background: The `has_any_role()` SUPER_ADMIN bypass means SA always passes any `has_any_role` check. The D-009 analysis that SUPER_ADMIN was being silently excluded (before `has_any_role` bypass was discovered) is now obsolete. SA passes both deps cleanly.

### AUTHZ_SURFACE.md label inaccuracy (cosmetic)
AUTHZ_SURFACE.md labels `create_payment` and `delete_payment` as "AUTH_ONLY + inline FINANCE check". Accurate labels would be "ROLE: FINANCE (router)" (no inline check). The "OK" verdict is correct; only the description is slightly misleading. Suggest updating during Wave 0 cleanup.

---

## Actions taken

1. [x] `ordertab_payments.md` — Q-001 [UNCLEAR] replaced with VERIFIED CLEAN
2. [x] `ordertab_payments.md` — Permissions table updated; [UNCLEAR] flag removed
3. [x] `ordertab_payments.md` — Security note updated with confirmed finding
4. [ ] Wave 0: Update AUTHZ_SURFACE.md cosmetic label for `create_payment` / `delete_payment` description field
5. [ ] D-009: Note that SUPER_ADMIN exclusion concern is moot — `has_any_role` bypass gives SA access to factory financial endpoints

---

## No new G-tickets or [UNCLEAR] flags opened

This audit closes the only open payment-related [UNCLEAR] item. All payment mutation endpoints are correctly gated. D-004 is satisfied.
