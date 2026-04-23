"""
HarvestERP — Pydantic Schemas (request / response models)
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional


# ────────────── CLIENT ──────────────
class ClientBase(BaseModel):
    name: str
    gstin: Optional[str] = None
    iec: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "India"
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None

class ClientCreate(ClientBase): pass

class ClientOut(ClientBase):
    id: str
    created_at: datetime
    class Config:
        from_attributes = True


# ────────────── PRODUCT ─────────────
class ProductBase(BaseModel):
    part_number: str
    name: str
    category: Optional[str] = None
    hsn_code: Optional[str] = None
    bcd_rate: float = 0.0
    igst_rate: float = 18.0
    unit_price_cny: float = 0.0
    weight_kg: float = 0.0
    cbm: float = 0.0
    description: Optional[str] = None

class ProductCreate(ProductBase): pass

class ProductOut(ProductBase):
    id: str
    created_at: datetime
    class Config:
        from_attributes = True


# ────────────── ORDER ITEM ──────────
class OrderItemBase(BaseModel):
    product_id: str
    quantity: int = Field(gt=0)
    unit_price_cny: float = Field(gt=0)
    markup_percent: float = 15.0
    hsn_code: Optional[str] = None

class OrderItemCreate(OrderItemBase): pass

class OrderItemOut(OrderItemBase):
    id: str
    order_id: str
    unit_price_inr: float
    total_price_cny: float
    total_price_inr: float
    class Config:
        from_attributes = True


# ────────────── ORDER ───────────────
class OrderBase(BaseModel):
    client_id: str
    po_date: date
    po_reference: Optional[str] = None
    currency: str = "INR"
    exchange_rate: Optional[float] = None
    markup_percent: float = 15.0
    advance_percent: float = 30.0
    notes: Optional[str] = None

class OrderCreate(OrderBase):
    items: list[OrderItemCreate] = []

class OrderUpdate(BaseModel):
    status: Optional[str] = None
    po_reference: Optional[str] = None
    exchange_rate: Optional[float] = None
    markup_percent: Optional[float] = None
    advance_percent: Optional[float] = None
    notes: Optional[str] = None

class OrderOut(OrderBase):
    id: str
    order_number: str
    status: str
    pi_number: Optional[str] = None
    pi_date: Optional[date] = None
    total_value: float
    total_value_inr: float
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemOut] = []
    class Config:
        from_attributes = True

class OrderListOut(BaseModel):
    id: str
    order_number: str
    client_id: str
    client_name: Optional[str] = None
    status: str
    po_date: date
    total_value_inr: float
    currency: str
    created_at: datetime
    class Config:
        from_attributes = True


# ────────── PROFORMA INVOICE ────────
class PICreate(BaseModel):
    order_id: str
    exchange_rate: float
    markup_type: str = "FIXED_PERCENT"
    markup_value: float = 15.0
    payment_terms: Optional[str] = "30% advance, 70% against BOL"
    delivery_terms: Optional[str] = "FOB Shanghai"
    validity_days: int = 7

class PIOut(BaseModel):
    id: str
    pi_number: str
    order_id: str
    issue_date: date
    exchange_rate_locked: float
    total_cny: float
    total_inr: float
    markup_type: str
    markup_value: float
    payment_terms: Optional[str]
    delivery_terms: Optional[str]
    validity_days: int
    status: str
    approved_at: Optional[datetime]
    created_at: datetime
    class Config:
        from_attributes = True


# ──────── PRODUCTION MILESTONE ──────
class MilestoneCreate(BaseModel):
    order_id: str
    milestone_percent: int
    expected_date: Optional[date] = None
    actual_date: Optional[date] = None
    notes: Optional[str] = None
    delay_reason: Optional[str] = None

class MilestoneUpdate(BaseModel):
    actual_date: Optional[date] = None
    notes: Optional[str] = None
    delay_reason: Optional[str] = None

class MilestoneOut(BaseModel):
    id: str
    order_id: str
    milestone_percent: int
    expected_date: Optional[date]
    actual_date: Optional[date]
    notes: Optional[str]
    delay_reason: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True


# ────────────── SHIPMENT ────────────
class ShipmentCreate(BaseModel):
    container_number: str
    container_type: str = "40FT"
    vessel_name: Optional[str] = None
    voyage_number: Optional[str] = None
    bol_number: Optional[str] = None
    bol_type: Optional[str] = None
    bol_date: Optional[date] = None
    port_of_loading: str = "Shanghai"
    port_of_discharge: str = "Chennai"
    etd: Optional[date] = None
    eta: Optional[date] = None
    freight_usd: float = 0.0
    order_ids: list[str] = []

class ShipmentOut(BaseModel):
    id: str
    container_number: str
    container_type: str
    max_weight_kg: float
    max_cbm: float
    actual_weight_kg: float
    actual_cbm: float
    seal_number: Optional[str]
    vessel_name: Optional[str]
    voyage_number: Optional[str]
    bol_number: Optional[str]
    bol_type: Optional[str]
    bol_date: Optional[date]
    port_of_loading: str
    port_of_discharge: str
    etd: Optional[date]
    eta: Optional[date]
    status: str
    freight_usd: float
    created_at: datetime
    class Config:
        from_attributes = True


# ────────────── PAYMENT ─────────────
class PaymentCreate(BaseModel):
    order_id: str
    payment_type: str
    amount: float
    currency: str = "INR"
    exchange_rate: float = 1.0
    payment_date: Optional[date] = None
    reference: Optional[str] = None
    notes: Optional[str] = None

class PaymentOut(BaseModel):
    id: str
    order_id: str
    payment_type: str
    amount: float
    currency: str
    exchange_rate: float
    amount_inr: float
    payment_date: Optional[date]
    reference: Optional[str]
    status: str
    notes: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True


# ──────── CUSTOMS CLEARANCE ─────────
class CustomsCreate(BaseModel):
    shipment_id: str
    be_number: Optional[str] = None
    be_date: Optional[date] = None
    assessable_value_inr: float = 0.0
    bcd_rate: float = 0.0
    igst_rate: float = 18.0
    cha_name: Optional[str] = None
    cha_fees: float = 0.0
    cfs_charges: float = 0.0
    thc_charges: float = 0.0
    transport_charges: float = 0.0

class CustomsOut(BaseModel):
    id: str
    shipment_id: str
    be_number: Optional[str]
    be_date: Optional[date]
    assessable_value_inr: float
    bcd_rate: float
    bcd_amount: float
    sws_amount: float
    igst_rate: float
    igst_amount: float
    total_duty: float
    ooc_date: Optional[date]
    igst_credit_claimed: bool
    status: str
    cha_name: Optional[str]
    cha_fees: float
    cfs_charges: float
    thc_charges: float
    transport_charges: float
    created_at: datetime
    class Config:
        from_attributes = True


# ────────────── DOCUMENT ────────────
class DocumentCreate(BaseModel):
    order_id: Optional[str] = None
    shipment_id: Optional[str] = None
    doc_type: str
    filename: str
    notes: Optional[str] = None

class DocumentOut(BaseModel):
    id: str
    order_id: Optional[str]
    shipment_id: Optional[str]
    doc_type: str
    filename: str
    file_size_bytes: int
    version: int
    notes: Optional[str]
    uploaded_at: datetime
    class Config:
        from_attributes = True


# ──────── DELIVERY / CLAIMS ─────────
class DeliveryCreate(BaseModel):
    order_id: str
    delivery_date: date
    delivered_quantity: int = 0
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None
    delivery_notes: Optional[str] = None
    condition: str = "GOOD"

class DeliveryOut(BaseModel):
    id: str
    order_id: str
    delivery_date: date
    delivered_quantity: int
    gps_lat: Optional[float]
    gps_lng: Optional[float]
    delivery_notes: Optional[str]
    condition: str
    created_at: datetime
    class Config:
        from_attributes = True

class ClaimCreate(BaseModel):
    order_id: str
    delivery_id: Optional[str] = None
    claim_type: str
    quantity: int = 0
    description: Optional[str] = None
    claim_value: float = 0.0
    currency: str = "INR"

class ClaimOut(BaseModel):
    id: str
    order_id: str
    delivery_id: Optional[str]
    claim_type: str
    quantity: int
    description: Optional[str]
    claim_value: float
    currency: str
    status: str
    factory_acknowledged: bool
    credit_amount: float
    resolution_notes: Optional[str]
    created_at: datetime
    resolved_at: Optional[datetime]
    class Config:
        from_attributes = True


# ────────── DASHBOARD STATS ─────────
class DashboardStats(BaseModel):
    total_orders: int = 0
    active_orders: int = 0
    pending_payments: int = 0
    in_transit_containers: int = 0
    total_revenue_inr: float = 0.0
    total_payments_inr: float = 0.0
    orders_by_status: dict[str, int] = {}
    recent_orders: list[OrderListOut] = []
