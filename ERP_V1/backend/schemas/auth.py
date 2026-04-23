"""HarvestERP — Auth Schemas."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


# ── Requests ──────────────────────────────────────


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Responses ─────────────────────────────────────


class LoginUserInfo(BaseModel):
    """User info embedded in login response."""

    id: str
    email: str
    full_name: str
    role: str
    user_type: str
    client_id: Optional[str] = None
    factory_id: Optional[str] = None
    portal: str


class TokenResponse(BaseModel):
    """POST /api/auth/login response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: LoginUserInfo


class RefreshResponse(BaseModel):
    """POST /api/auth/refresh response."""

    access_token: str
    token_type: str = "bearer"


class PortalPermissions(BaseModel):
    """Client portal feature toggles."""

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


class UserMeResponse(BaseModel):
    """GET /api/auth/me response."""

    id: str
    email: str
    roles: list[str]
    role: str
    user_type: str
    client_id: Optional[str] = None
    factory_id: Optional[str] = None
    tenant_id: str
    client_type: Optional[str] = None
    portal_permissions: Optional[PortalPermissions] = None
