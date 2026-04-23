"""HarvestERP — Order Schemas.

All Pydantic models for order endpoints. Moved from routers/orders.py
to centralize schema definitions. Field names and types are unchanged.
"""
from __future__ import annotations

from typing import Optional, List

from pydantic import BaseModel, ConfigDict, Field


# ── Response Models ───────────────────────────────


class OrderItemResponse(BaseModel):
    """Single order item — used in detail view and item lists."""

    id: str
    order_id: str
    product_id: Optional[str] = None
    quantity: int
    factory_price: Optional[float] = None
    client_factory_price: Optional[float] = None
    markup_percent: Optional[float] = None
    selling_price: Optional[float] = None
    selling_price_inr: Optional[float] = None
    factory_image_path: Optional[str] = None
    status: str
    pi_item_status: Optional[str] = None
    pi_addition_lot: Optional[int] = None
    notes: Optional[str] = None
    cancel_note: Optional[str] = None
    # Joined product info (snapshot or live fallback)
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    material: Optional[str] = None
    category: Optional[str] = None
    part_type: Optional[str] = None
    dimension: Optional[str] = None
    variant_note: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class OrderResponse(BaseModel):
    """Full order detail — matches serialize_order() output exactly."""

    id: str
    order_number: Optional[str] = None
    client_id: str
    factory_id: Optional[str] = None
    status: str
    currency: str
    exchange_rate: Optional[float] = None
    exchange_rate_date: Optional[str] = None
    po_reference: Optional[str] = None
    notes: Optional[str] = None
    reopen_count: int = 0
    last_reopen_reason: Optional[str] = None
    igst_credit_amount: float = 0
    igst_credit_claimed: bool = False
    completed_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    # Joined info
    client_name: Optional[str] = None
    factory_name: Optional[str] = None
    item_count: int = 0
    total_value_cny: float = 0
    # Stage info
    stage_number: int = 0
    stage_name: str = ""
    highest_unlocked_stage: Optional[str] = None
    # PI staleness
    pi_stale: bool = False
    # Optimistic locking
    version: int = 1
    # Deletion & client reference
    client_reference: Optional[str] = None
    deletion_reason: Optional[str] = None
    deleted_by: Optional[str] = None
    deleted_at: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class OrderListItem(BaseModel):
    """Minimal order for list views — subset of OrderResponse."""

    id: str
    order_number: Optional[str] = None
    status: str
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    factory_name: Optional[str] = None
    stage_number: int = 0
    stage_name: str = ""
    total_value_cny: float = 0
    item_count: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class OrderListResponse(BaseModel):
    """Paginated order list response."""

    orders: list[OrderListItem]
    total: int
    page: int
    per_page: int
    pages: int


# ── Request Models ────────────────────────────────


class OrderItemCreate(BaseModel):
    product_id: str
    quantity: int
    notes: Optional[str] = None


class OrderCreate(BaseModel):
    client_id: str
    factory_id: Optional[str] = None
    currency: str = "CNY"
    po_reference: Optional[str] = None
    notes: Optional[str] = None
    client_reference: Optional[str] = None
    items: List[OrderItemCreate] = Field(default=[], max_length=500)


class OrderUpdate(BaseModel):
    client_id: Optional[str] = None
    factory_id: Optional[str] = None
    currency: Optional[str] = None
    po_reference: Optional[str] = None
    notes: Optional[str] = None


class OrderAddItems(BaseModel):
    items: List[OrderItemCreate]


class OrderUpdateItem(BaseModel):
    quantity: Optional[int] = None
    notes: Optional[str] = None


class OrderRemoveItem(BaseModel):
    cancel_note: Optional[str] = None


class MigrateItemRequest(BaseModel):
    order_item_id: str
    reason: str  # NOT_PRODUCED or NO_SPACE


class MigrateItemsRequest(BaseModel):
    items: List[MigrateItemRequest]


class BulkTextAddRequest(BaseModel):
    lines: List[str]  # "CODE [QTY]" per line


class BulkTextApplyRequest(BaseModel):
    items: List[OrderItemCreate]  # [{product_id, quantity}]


class UndoMigrateRequest(BaseModel):
    order_item_ids: List[str]


class ItemPriceUpdate(BaseModel):
    factory_price: Optional[float] = None
    markup_percent: Optional[float] = None
    selling_price_inr: Optional[float] = None


# ── Stage Transition Requests ─────────────────────


class StageTransitionRequest(BaseModel):
    notes: Optional[str] = None
    transition_reason: Optional[str] = None
    acknowledge_warnings: bool = False


class OrderReopenRequest(BaseModel):
    reason: str


class GoBackRequest(BaseModel):
    reason: Optional[str] = None


class JumpToStageRequest(BaseModel):
    target_status: str
    reason: Optional[str] = None


# ── Packing Requests ─────────────────────────────


class UpdatePackingItemRequest(BaseModel):
    package_number: Optional[str] = None
    factory_ready_qty: Optional[int] = None


class SplitPackingItemRequest(BaseModel):
    splits: List[dict]  # [{"qty": 250, "package_number": "1"}, ...]


class ShippingDecisionRequest(BaseModel):
    decision: str  # SHIP_CARRY_FORWARD, SHIP_CANCEL_BALANCE, WAIT
    cancel_reason: Optional[str] = None


class ManualPackingItem(BaseModel):
    order_item_id: str
    factory_ready_qty: int = Field(ge=0)
    package_number: Optional[str] = None


class ManualPackingListRequest(BaseModel):
    items: List[ManualPackingItem]


# ── Client Portal Requests ───────────────────────


class ClientOrderItemCreate(BaseModel):
    product_id: str
    quantity: int = Field(ge=1)


class QuickAddItemCreate(BaseModel):
    product_code: str
    product_name: str
    quantity: int = Field(ge=1, default=1)


class ClientOrderCreate(BaseModel):
    po_reference: Optional[str] = None
    client_reference: Optional[str] = None
    items: List[ClientOrderItemCreate] = Field(default=[], max_length=500)
    quick_add_items: List[QuickAddItemCreate] = Field(default=[], max_length=100)


# ── Miscellaneous Requests ───────────────────────


class ApproveInquiryRequest(BaseModel):
    factory_id: Optional[str] = None
    currency: str = "USD"


class DeleteOrderRequest(BaseModel):
    reason: str = ""


class ProductionDatesIn(BaseModel):
    started_at: Optional[str] = None
    target_date: Optional[str] = None
