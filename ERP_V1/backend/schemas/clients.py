"""HarvestERP — Client Schemas."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict


# ── Response Models ───────────────────────────────


class ClientResponse(BaseModel):
    """Full client — matches ClientOut exactly."""

    id: str
    company_name: str
    gstin: Optional[str] = None
    iec: Optional[str] = None
    pan: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool
    client_type: str = "REGULAR"
    factory_markup_percent: Optional[float] = None
    sourcing_commission_percent: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


# Backward compat alias — existing code references ClientOut
ClientOut = ClientResponse


class ClientListResponse(BaseModel):
    """Paginated client list."""

    items: list[ClientResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ── Request Models ────────────────────────────────


class ClientCreate(BaseModel):
    company_name: str
    gstin: Optional[str] = None
    iec: Optional[str] = None
    pan: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    notes: Optional[str] = None
    client_type: str = "REGULAR"
    factory_markup_percent: Optional[float] = None
    sourcing_commission_percent: Optional[float] = None


class PortalPermissionsUpdate(BaseModel):
    # Tab visibility
    show_payments: bool = False
    show_production: bool = False
    show_shipping: bool = False
    show_after_sales: bool = False
    show_files: bool = False
    show_packing: bool = False
    # Order item actions
    items_add: bool = False
    items_bulk_add: bool = False
    items_fetch_pending: bool = False
    items_upload_excel: bool = False
    items_edit_qty: bool = False
    items_remove: bool = False
