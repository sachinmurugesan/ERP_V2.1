"""HarvestERP — Finance Schemas.

All Pydantic models for finance endpoints. Moved from routers/finance.py
to centralize schema definitions. Field names and types are unchanged.

NOTE: list_payments() and ledger endpoints return complex dynamic structures
with computed summaries. response_model is deferred for those endpoints
until the service layer is extracted.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict


# ── Client Payment Models ─────────────────────────


class PaymentCreate(BaseModel):
    payment_type: str  # CLIENT_ADVANCE or CLIENT_BALANCE
    amount: float
    currency: str = "INR"
    exchange_rate: float = 1.0
    method: str = "BANK_TRANSFER"
    reference: Optional[str] = None
    notes: Optional[str] = None
    payment_date: str  # ISO date string YYYY-MM-DD


class PaymentUpdate(BaseModel):
    payment_type: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    exchange_rate: Optional[float] = None
    method: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    payment_date: Optional[str] = None


class PaymentResponse(BaseModel):
    """Single client payment — matches PaymentOut exactly."""

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
    created_at: str
    verification_status: str = "VERIFIED"
    proof_file_path: Optional[str] = None
    rejection_reason: Optional[str] = None
    submitted_by: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class VerifyPaymentRequest(BaseModel):
    action: str  # "approve" or "reject"
    reason: Optional[str] = None


# Backward compat alias
PaymentOut = PaymentResponse


# ── Factory Payment Models ────────────────────────


class FactoryPaymentCreate(BaseModel):
    amount: float
    currency: str = "CNY"
    exchange_rate: float
    method: str = "BANK_TRANSFER"
    reference: Optional[str] = None
    notes: Optional[str] = None
    payment_date: str  # ISO date string YYYY-MM-DD


class FactoryPaymentUpdate(BaseModel):
    amount: Optional[float] = None
    currency: Optional[str] = None
    exchange_rate: Optional[float] = None
    method: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    payment_date: Optional[str] = None


class FactoryPaymentResponse(BaseModel):
    """Single factory payment — matches FactoryPaymentOut exactly."""

    id: str
    order_id: str
    amount: float
    currency: str
    exchange_rate: float
    amount_inr: float
    amount_usd: Optional[float] = None
    method: str
    reference: Optional[str] = None
    notes: Optional[str] = None
    payment_date: str
    created_at: str

    model_config = ConfigDict(from_attributes=True)


# Backward compat alias
FactoryPaymentOut = FactoryPaymentResponse


# ── Client Credit Models ──────────────────────────


class ClientCreditResponse(BaseModel):
    """Client credit record."""

    id: str
    client_id: str
    source_order_id: str
    amount: float
    status: str
    applied_to_order_id: Optional[str] = None
    applied_at: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    source_order_number: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# Backward compat alias
ClientCreditOut = ClientCreditResponse


class ApplyCreditRequest(BaseModel):
    credit_id: str


# ── Factory Credit Models ─────────────────────────


class FactoryCreditResponse(BaseModel):
    """Factory credit record."""

    id: str
    factory_id: str
    source_order_id: str
    amount: float
    status: str
    applied_to_order_id: Optional[str] = None
    applied_at: Optional[str] = None
    notes: Optional[str] = None
    created_at: str
    source_order_number: Optional[str] = None


# Backward compat alias
FactoryCreditOut = FactoryCreditResponse


class ApplyFactoryCreditRequest(BaseModel):
    credit_id: str
