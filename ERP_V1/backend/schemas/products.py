"""HarvestERP — Product Schemas.

All Pydantic models for product endpoints. Moved from routers/products.py
to centralize schema definitions. Field names and types are unchanged.
"""
from __future__ import annotations

from typing import Optional, List

from pydantic import BaseModel, ConfigDict, Field


# ── Response Models ───────────────────────────────


class ProductImageOut(BaseModel):
    """Product image — used in image list and detail views."""

    id: str
    product_id: str
    image_path: str
    image_url: str
    thumbnail_url: Optional[str] = None
    source_type: str
    source_order_id: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    file_size: Optional[int] = None
    is_primary: bool

    model_config = ConfigDict(from_attributes=True)


class CodeValidationResult(BaseModel):
    """Result of product code validation."""

    code: str
    status: str  # FOUND, NOT_FOUND, AMBIGUOUS
    matches: List[dict] = []


# ── Request Models ────────────────────────────────


class ProductCreate(BaseModel):
    product_code: str
    product_name: str
    product_name_chinese: Optional[str] = None
    part_type: Optional[str] = None        # "Original", "Copy", "OEM", "Aftermarket"
    dimension: Optional[str] = None        # "12mm", "32x15mm", "M8"
    material: Optional[str] = None
    variant_note: Optional[str] = None     # Free-text variant info
    category: Optional[str] = None
    subcategory: Optional[str] = None
    unit_weight_kg: Optional[float] = None
    unit_cbm: Optional[float] = None
    standard_packing: Optional[str] = None
    moq: int = 1
    hs_code: Optional[str] = None
    hs_code_description: Optional[str] = None
    factory_part_number: Optional[str] = None
    brand: Optional[str] = None
    oem_reference: Optional[str] = None
    compatibility: Optional[str] = None
    notes: Optional[str] = None
    replace_variant_id: Optional[str] = None  # If set, UPDATE this variant instead of creating new


class ProductOut(ProductCreate):
    """Full product response — inherits all ProductCreate fields plus extras."""

    id: str
    is_active: bool
    parent_id: Optional[str] = None
    is_default: bool = False
    thumbnail_url: Optional[str] = None
    variant_count: Optional[int] = None  # Only set on parent products

    model_config = ConfigDict(from_attributes=True)


class ProductGroupItem(BaseModel):
    """Grouped mode — parent with nested variants."""

    parent: ProductOut
    variants: list[ProductOut] = []


class ProductListResponse(BaseModel):
    """Flat mode paginated product list."""

    items: list[dict]  # ProductOut.model_dump() items
    total: int
    page: int
    per_page: int
    pages: int


class ProductGroupedListResponse(BaseModel):
    """Grouped mode product list."""

    items: list[ProductGroupItem]
    total: int
    page: int
    grouped: bool = True


class BulkDeleteRequest(BaseModel):
    product_ids: List[str] = Field(..., max_length=500)


class BulkUpdateRequest(BaseModel):
    product_ids: List[str] = Field(default=[], max_length=10000)
    product_codes: List[str] = Field(default=[], max_length=10000)  # alternative: select by code
    category: Optional[str] = None
    material: Optional[str] = None
    hs_code: Optional[str] = None
    part_type: Optional[str] = None
    brand: Optional[str] = None


class CodeValidationRequest(BaseModel):
    codes: List[str] = Field(..., max_length=1000)


class MapProductRequestBody(BaseModel):
    target_product_id: str  # the real product to map to


class RejectProductRequestBody(BaseModel):
    remark: Optional[str] = "Product request rejected"


class ApproveProductRequestBody(BaseModel):
    product_name: Optional[str] = None
    product_name_chinese: Optional[str] = None
    category: Optional[str] = None
    material: Optional[str] = None
    dimension: Optional[str] = None
    part_type: Optional[str] = None
    brand: Optional[str] = None
    hs_code: Optional[str] = None
    unit_weight_kg: Optional[float] = None
