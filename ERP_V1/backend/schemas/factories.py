"""HarvestERP — Factory Schemas."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, ConfigDict


# ── Response Models ───────────────────────────────


class FactoryResponse(BaseModel):
    """Full factory — matches FactoryOut exactly."""

    id: str
    factory_code: str
    company_name: str
    company_name_chinese: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    country: str = "China"
    port_of_loading: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_phone: Optional[str] = None
    primary_contact_wechat: Optional[str] = None
    primary_contact_email: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    bank_swift: Optional[str] = None
    quality_rating: Optional[int] = None
    notes: Optional[str] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


# Backward compat alias — existing code references FactoryOut
FactoryOut = FactoryResponse


class FactoryListResponse(BaseModel):
    """Paginated factory list."""

    items: list[FactoryResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ── Request Models ────────────────────────────────


class FactoryCreate(BaseModel):
    factory_code: str
    company_name: str
    company_name_chinese: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    country: str = "China"
    port_of_loading: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_phone: Optional[str] = None
    primary_contact_wechat: Optional[str] = None
    primary_contact_email: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    bank_swift: Optional[str] = None
    quality_rating: Optional[int] = None
    notes: Optional[str] = None
