"""
HarvestERP - All Database Models (32 tables)
Based on PROJECT_KNOWLEDGE.md Section 8 Data Model Summary.
"""
import uuid
from datetime import datetime, date
from typing import Optional, List

from sqlalchemy import (
    String, Integer, Float, Boolean, Text, Date, DateTime, JSON,
    ForeignKey, Index, Numeric,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base
from enums import (
    OrderStatus, Currency, PaymentMethod,
    VerificationStatus, AfterSalesStatus,
    UnloadedItemStatus, WarehouseStockStatus, OrderItemStatus,
    JobStatus, ApprovalStatus, CreditStatus, BoeStatus,
)


def gen_uuid() -> str:
    return str(uuid.uuid4())


# ========================================
# MASTER DATA TABLES
# ========================================

class Product(Base):
    """Product catalog — parent/child variant system.
    parent_id IS NULL  → Parent (group header, NOT orderable)
    parent_id IS NOT NULL → Variant child (orderable, has prices)
    product_code is shared across parent + all its children.
    product_name remains globally unique.
    """
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    parent_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("products.id"), nullable=True, index=True)
    product_code: Mapped[str] = mapped_column(String(50), index=True)  # NOT unique — shared by parent + children
    product_name: Mapped[str] = mapped_column(String(200), unique=True)  # Unique identifier
    product_name_chinese: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # Variant attributes (only meaningful on children)
    part_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)   # "Original", "Copy", "OEM", "Aftermarket"
    dimension: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # "12mm", "32x15mm", "M8"
    material: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    variant_note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # Free-text extras
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)  # Only one child per parent can be True
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    subcategory: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    unit_weight_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    unit_cbm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    standard_packing: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    moq: Mapped[int] = mapped_column(Integer, default=1)
    hs_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    hs_code_description: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    default_factory_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("factories.id"), nullable=True)
    factory_part_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    brand: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    oem_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    compatibility: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    approval_status: Mapped[str] = mapped_column(String(20), default=ApprovalStatus.APPROVED.value)
    requested_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)  # user_id who requested Quick Add
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    parent: Mapped[Optional["Product"]] = relationship("Product", remote_side="Product.id", backref="variants")


class Factory(Base):
    """Factory/Supplier master data"""
    __tablename__ = "factories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    factory_code: Mapped[str] = mapped_column(String(20), unique=True)
    company_name: Mapped[str] = mapped_column(String(200))
    company_name_chinese: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    province: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    country: Mapped[str] = mapped_column(String(50), default="China")
    port_of_loading: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    primary_contact_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    primary_contact_phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    primary_contact_wechat: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    primary_contact_email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    bank_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    bank_account: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    bank_swift: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    quality_rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1-5
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    contacts: Mapped[List["FactoryContact"]] = relationship(back_populates="factory")


class FactoryContact(Base):
    """Additional factory contacts"""
    __tablename__ = "factory_contacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    factory_id: Mapped[str] = mapped_column(String(36), ForeignKey("factories.id"))
    name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    wechat: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    contact_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # sales, shipping, quality

    factory: Mapped["Factory"] = relationship(back_populates="contacts")


class Client(Base):
    """Indian client companies"""
    __tablename__ = "clients"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    company_name: Mapped[str] = mapped_column(String(200))
    gstin: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # OPTIONAL
    iec: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # Import Export Code
    pan: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    pincode: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    contact_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    contact_email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    portal_permissions: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=lambda: {
        "show_payments": False,
        "show_production": False,
        "show_shipping": False,
        "show_after_sales": False,
        "show_files": False,
        "show_packing": False,
    })
    # Transparency pricing (Type 2 clients)
    client_type: Mapped[str] = mapped_column(String(20), default="REGULAR")
    factory_markup_percent: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)
    sourcing_commission_percent: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class Category(Base):
    """Product categories with default markup"""
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    markup_percent: Mapped[float] = mapped_column(Float, default=15.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


# ========================================
# ORDER TABLES
# ========================================

class Order(Base):
    """Main order records — the core entity"""
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_number: Mapped[Optional[str]] = mapped_column(String(20), unique=True, nullable=True)  # Generated at approval
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), index=True)
    factory_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("factories.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default=OrderStatus.DRAFT.value, index=True)
    currency: Mapped[str] = mapped_column(String(5), default=Currency.CNY.value)
    exchange_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    exchange_rate_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    po_reference: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)  # Future: user ID

    # IGST Credit tracking (editable even after close)
    igst_credit_amount: Mapped[float] = mapped_column(Float, default=0)
    igst_credit_claimed: Mapped[bool] = mapped_column(Boolean, default=False)
    igst_claim_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    igst_claim_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Re-open tracking
    reopen_count: Mapped[int] = mapped_column(Integer, default=0)
    last_reopen_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_reopened_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_reopened_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    # Production tracking
    production_started_at: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    production_target_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # PI staleness tracking — set whenever items change post-PI
    items_modified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Highest stage ever reached (high-water mark for stage navigation)
    highest_unlocked_stage: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    # Optimistic locking version — incremented on every stage transition
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False, server_default="1")

    # Deletion tracking
    deletion_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    deleted_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    # Client's own reference name for the order (unique per client)
    client_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Effective PI total — recalculated when items change (excludes UNLOADED/REMOVED)
    effective_pi_total: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Timestamps
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    items: Mapped[List["OrderItem"]] = relationship(back_populates="order")
    client: Mapped["Client"] = relationship()
    factory: Mapped[Optional["Factory"]] = relationship()


class OrderItem(Base):
    """Products in an order with pricing"""
    __tablename__ = "order_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), index=True)
    product_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("products.id"), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer)
    factory_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    client_factory_price: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    markup_percent: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    selling_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    selling_price_inr: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    factory_image_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # Relative path
    status: Mapped[str] = mapped_column(String(20), default=OrderItemStatus.ACTIVE.value)
    pi_item_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # Client approval status
    pi_addition_lot: Mapped[Optional[int]] = mapped_column(nullable=True)  # Lot number for batch-added items (1, 2, 3...)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cancel_note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Snapshot fields — populated on DRAFT → PENDING_PI transition
    # These preserve product data even if the product master record is later changed/deleted.
    # Once populated, snapshot data is the "xerox copy" — master changes won't affect past orders.
    product_code_snapshot: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    product_name_snapshot: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    image_path_snapshot: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    material_snapshot: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    category_snapshot: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # Variant snapshots (new)
    part_type_snapshot: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    dimension_snapshot: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    variant_note_snapshot: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Relationships
    order: Mapped["Order"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship()


class StageOverride(Base):
    """Records when a stage transition proceeds despite warnings (e.g., outstanding balance)"""
    __tablename__ = "stage_overrides"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), index=True)
    from_stage: Mapped[str] = mapped_column(String(30))
    to_stage: Mapped[str] = mapped_column(String(30))
    reason: Mapped[str] = mapped_column(Text)
    warnings_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ProformaInvoice(Base):
    """PI for client — single PI per order, update in-place"""
    __tablename__ = "proforma_invoices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    pi_number: Mapped[str] = mapped_column(String(30), unique=True)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), unique=True)
    exchange_rate: Mapped[float] = mapped_column(Float)
    total_cny: Mapped[float] = mapped_column(Float, default=0)
    total_inr: Mapped[float] = mapped_column(Float, default=0)
    advance_percent: Mapped[float] = mapped_column(Float, default=30)
    advance_amount_inr: Mapped[float] = mapped_column(Float, default=0)
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)


class PIRevision(Base):
    """Snapshot of PI values before each regeneration — tracks PI history"""
    __tablename__ = "pi_revisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), index=True)
    pi_number: Mapped[str] = mapped_column(String(30))
    revision_number: Mapped[int] = mapped_column(Integer, default=1)
    total_cny: Mapped[float] = mapped_column(Float, default=0)
    total_inr: Mapped[float] = mapped_column(Float, default=0)
    exchange_rate: Mapped[float] = mapped_column(Float)
    advance_percent: Mapped[float] = mapped_column(Float, default=30)
    advance_amount_inr: Mapped[float] = mapped_column(Float, default=0)
    item_count: Mapped[int] = mapped_column(Integer, default=0)
    trigger: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ========================================
# PAYMENT TABLES
# ========================================

class Payment(Base):
    """All payment records (client payments)"""
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), index=True)
    payment_type: Mapped[str] = mapped_column(String(30))  # CLIENT_ADVANCE, CLIENT_BALANCE
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(5), default=Currency.INR.value)
    exchange_rate: Mapped[float] = mapped_column(Float, default=1.0)
    amount_inr: Mapped[float] = mapped_column(Float)
    method: Mapped[str] = mapped_column(String(30))  # BANK_TRANSFER, CHEQUE, etc.
    reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payment_date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    proof_file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    verification_status: Mapped[str] = mapped_column(
        String(30), default="VERIFIED", server_default="VERIFIED"
    )
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    submitted_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)


class FactoryPayment(Base):
    """Payments to factory — multiple records per order, each with own method + exchange rate"""
    __tablename__ = "factory_payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), index=True)
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(5), default=Currency.CNY.value)
    exchange_rate: Mapped[float] = mapped_column(Float)
    amount_inr: Mapped[float] = mapped_column(Float)
    method: Mapped[str] = mapped_column(String(30), default=PaymentMethod.BANK_TRANSFER.value)
    reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payment_date: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class PaymentAuditLog(Base):
    """Audit trail for payment create/update/delete operations."""
    __tablename__ = "payment_audit_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    payment_id: Mapped[str] = mapped_column(String(36), index=True)
    payment_table: Mapped[str] = mapped_column(String(20))  # "client" | "factory"
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), index=True)
    action: Mapped[str] = mapped_column(String(10))  # CREATE | UPDATE | DELETE
    before_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    after_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)   # JSON
    changed_fields: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON list
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    """Global immutable audit trail for all state mutations.
    Append-only — no update or delete operations permitted."""
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    user_id: Mapped[str] = mapped_column(String(100), index=True)
    user_email: Mapped[str] = mapped_column(String(200), default="")
    action: Mapped[str] = mapped_column(String(100), index=True)
    resource_type: Mapped[str] = mapped_column(String(50), index=True)
    resource_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    old_values: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    new_values: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_email", "email", unique=True),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # ADMIN, FINANCE, OPERATIONS, CLIENT, FACTORY
    user_type: Mapped[str] = mapped_column(String(20), nullable=False, default="INTERNAL")  # INTERNAL, CLIENT, FACTORY
    client_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("clients.id"), nullable=True)
    factory_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("factories.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    failed_login_count: Mapped[int] = mapped_column(Integer, default=0)
    last_failed_login: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)


class RevokedToken(Base):
    """Server-side JWT revocation list. Keyed by JTI (JWT ID claim).

    A JTI present here means the token has been revoked (logout / password change /
    admin force-logout) and must be rejected even if its signature and expiry check out.
    Rows are cleared by a scheduled job once `expires_at` is past.
    """
    __tablename__ = "revoked_tokens"
    __table_args__ = (
        Index("ix_revoked_tokens_jti", "jti", unique=True),
        Index("ix_revoked_tokens_expires_at", "expires_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    jti: Mapped[str] = mapped_column(String(36), nullable=False)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    token_type: Mapped[str] = mapped_column(String(10), nullable=False)  # "access" | "refresh"
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    reason: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class ClientCredit(Base):
    """Tracks client overpayments as credits for future orders"""
    __tablename__ = "client_credits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), index=True)
    source_order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"))
    amount: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default=CreditStatus.AVAILABLE.value)
    applied_to_order_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("orders.id"), nullable=True)
    applied_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class FactoryCredit(Base):
    """Tracks factory overpayments as credits for future orders"""
    __tablename__ = "factory_credits"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    factory_id: Mapped[str] = mapped_column(String(36), ForeignKey("factories.id"), index=True)
    source_order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"))
    amount: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default=CreditStatus.AVAILABLE.value)
    applied_to_order_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("orders.id"), nullable=True)
    applied_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ========================================
# PRODUCTION TABLES
# ========================================

class PackingList(Base):
    """Factory packing list (from factory Excel)"""
    __tablename__ = "packing_lists"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), unique=True)
    uploaded_date: Mapped[date] = mapped_column(Date)
    total_packages: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    total_gross_weight: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    total_net_weight: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    total_cbm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    items: Mapped[List["PackingListItem"]] = relationship(back_populates="packing_list")


class PackingListItem(Base):
    """Individual items in packing list"""
    __tablename__ = "packing_list_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    packing_list_id: Mapped[str] = mapped_column(String(36), ForeignKey("packing_lists.id"))
    order_item_id: Mapped[str] = mapped_column(String(36), ForeignKey("order_items.id"))
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"))
    ordered_qty: Mapped[int] = mapped_column(Integer)
    factory_ready_qty: Mapped[int] = mapped_column(Integer)
    loaded_qty: Mapped[int] = mapped_column(Integer, default=0)
    unloaded_qty: Mapped[int] = mapped_column(Integer, default=0)
    shortage_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    package_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    packing_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, default="NOT_READY")
    parent_packing_item_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    is_split: Mapped[bool] = mapped_column(Boolean, default=False)
    split_qty: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    shipping_decision: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    cancel_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    packing_list: Mapped["PackingList"] = relationship(back_populates="items")


class UnloadedItem(Base):
    """Items paid for but not shipped — carry forward to next order"""
    __tablename__ = "unloaded_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    original_order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"))
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"))
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    amount_paid_inr: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default=UnloadedItemStatus.PENDING.value)
    added_to_order_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("orders.id"), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # NOT_PRODUCED or NO_SPACE
    factory_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ========================================
# SHIPPING TABLES
# ========================================

class Shipment(Base):
    """Container/shipping records"""
    __tablename__ = "shipments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), index=True)
    container_type: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    container_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # Entered when sailed
    vessel_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    voyage_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    bl_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    port_of_loading: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    port_of_discharge: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    etd: Mapped[Optional[date]] = mapped_column(Date, nullable=True)  # Estimated Time of Departure
    eta: Mapped[Optional[date]] = mapped_column(Date, nullable=True)  # Estimated Time of Arrival
    atd: Mapped[Optional[date]] = mapped_column(Date, nullable=True)  # Actual Time of Departure
    ata: Mapped[Optional[date]] = mapped_column(Date, nullable=True)  # Actual Time of Arrival
    freight_cost_inr: Mapped[float] = mapped_column(Float, default=0)
    thc_inr: Mapped[float] = mapped_column(Float, default=0)
    doc_fees_inr: Mapped[float] = mapped_column(Float, default=0)
    sailing_phase: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # LOADED, SAILED, ARRIVED

    # Service providers (unified)
    freight_forwarder_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("service_providers.id"), nullable=True)
    cha_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("service_providers.id"), nullable=True)
    cfs_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("service_providers.id"), nullable=True)
    transport_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("service_providers.id"), nullable=True)

    # HBL fields
    shipper: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    consignee: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notify_party: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description_of_goods: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    freight_terms: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    seal_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    loading_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    loading_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    cfs_receipt_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    arrival_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    items: Mapped[List["ShipmentItem"]] = relationship(back_populates="shipment")


class ShipmentItem(Base):
    """Items allocated to a container with pallet numbers"""
    __tablename__ = "shipment_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    shipment_id: Mapped[str] = mapped_column(String(36), ForeignKey("shipments.id"))
    packing_list_item_id: Mapped[str] = mapped_column(String(36), ForeignKey("packing_list_items.id"))
    allocated_qty: Mapped[int] = mapped_column(Integer)
    pallet_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # "1"-"50" or "Loose"

    shipment: Mapped["Shipment"] = relationship(back_populates="items")


class ShippingDocument(Base):
    """4 documents from factory for customs: BOL, COO, CI, PL"""
    __tablename__ = "shipping_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"))
    shipment_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("shipments.id"), nullable=True)
    document_type: Mapped[str] = mapped_column(String(10))  # BOL, COO, CI, PL
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")  # PENDING, RECEIVED
    received_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ServiceProvider(Base):
    """Unified service provider — can have multiple roles (Freight Forwarder, CHA, CFS, Transport)"""
    __tablename__ = "service_providers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(String(200))
    contact_person: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    country: Mapped[str] = mapped_column(String(50), default="India")
    bank_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    bank_account: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    ifsc_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    gst_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    pan_number: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)
    roles: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array: ["FREIGHT_FORWARDER", "CHA"]
    operating_ports: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array: ["JNPT", "CHENNAI"]
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, onupdate=datetime.utcnow)


# ========================================
# CUSTOMS TABLES
# ========================================

class CustomsMilestone(Base):
    """Customs clearance log — milestone tracking"""
    __tablename__ = "customs_milestones"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), index=True)
    milestone: Mapped[str] = mapped_column(String(30))  # BE_FILED, DUTY_PAID, OOC_ISSUED, etc.
    status: Mapped[str] = mapped_column(String(20), default="COMPLETED")
    milestone_date: Mapped[date] = mapped_column(Date)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CustomsDocument(Base):
    """Required customs documents — gate documents"""
    __tablename__ = "customs_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"))
    document_type: Mapped[str] = mapped_column(String(20))  # BE, OOC, DO, EWAY_BILL, INVOICE
    file_path: Mapped[str] = mapped_column(String(500))
    filename: Mapped[str] = mapped_column(String(200))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ClearanceCharges(Base):
    """All customs and clearance charges for landed cost"""
    __tablename__ = "clearance_charges"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), unique=True)
    bcd_amount: Mapped[float] = mapped_column(Float, default=0)  # Basic Customs Duty
    sws_amount: Mapped[float] = mapped_column(Float, default=0)  # Social Welfare Surcharge
    igst_amount: Mapped[float] = mapped_column(Float, default=0)  # IGST
    cha_fees: Mapped[float] = mapped_column(Float, default=0)
    cfs_charges: Mapped[float] = mapped_column(Float, default=0)
    thc_charges: Mapped[float] = mapped_column(Float, default=0)  # Terminal Handling
    insurance_inr: Mapped[float] = mapped_column(Float, default=0)
    transport_cost: Mapped[float] = mapped_column(Float, default=0)
    other_charges: Mapped[float] = mapped_column(Float, default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)


class HsnTariff(Base):
    """HSN Tariff master — duty rates per HS code"""
    __tablename__ = "hsn_tariffs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    hsn_code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    description: Mapped[str] = mapped_column(String(500))
    bcd_rate: Mapped[float] = mapped_column(Float, default=0)        # Basic Customs Duty %
    igst_rate: Mapped[float] = mapped_column(Float, default=18.0)    # IGST %
    swc_rate: Mapped[float] = mapped_column(Float, default=10.0)     # Social Welfare Charge % (on BCD)
    effective_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)


class BillOfEntry(Base):
    """Bill of Entry — per-shipment customs declaration"""
    __tablename__ = "bills_of_entry"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    shipment_id: Mapped[str] = mapped_column(String(36), ForeignKey("shipments.id"), index=True)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), index=True)
    be_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    be_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    port_of_import: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    cha_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("service_providers.id"), nullable=True)

    # Exchange rate (CBIC notified USD→INR)
    exchange_rate_usd_inr: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Value fields
    fob_usd: Mapped[float] = mapped_column(Float, default=0)
    fob_inr: Mapped[float] = mapped_column(Float, default=0)
    freight_inr: Mapped[float] = mapped_column(Float, default=0)
    insurance_inr: Mapped[float] = mapped_column(Float, default=0)
    cif_inr: Mapped[float] = mapped_column(Float, default=0)
    landing_charges_inr: Mapped[float] = mapped_column(Float, default=0)
    assessment_value_inr: Mapped[float] = mapped_column(Float, default=0)

    # Duty totals
    total_bcd: Mapped[float] = mapped_column(Float, default=0)
    total_swc: Mapped[float] = mapped_column(Float, default=0)
    total_igst: Mapped[float] = mapped_column(Float, default=0)
    total_duty: Mapped[float] = mapped_column(Float, default=0)

    status: Mapped[str] = mapped_column(String(20), default=BoeStatus.DRAFT.value)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

    # Relationships
    line_items: Mapped[List["BoeLineItem"]] = relationship(back_populates="bill_of_entry", cascade="all, delete-orphan")


class BoeLineItem(Base):
    """BOE line item — one row per individual part/product"""
    __tablename__ = "boe_line_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    boe_id: Mapped[str] = mapped_column(String(36), ForeignKey("bills_of_entry.id"), index=True)

    # Part identification
    shipment_item_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    product_name: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    product_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    hsn_code: Mapped[str] = mapped_column(String(20))
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    unit_price: Mapped[float] = mapped_column(Float, default=0)          # factory purchase price (CNY)
    assessable_value_inr: Mapped[float] = mapped_column(Float, default=0) # unit_price × exchange_rate × qty
    bcd_rate: Mapped[float] = mapped_column(Float, default=0)
    bcd_amount: Mapped[float] = mapped_column(Float, default=0)
    swc_rate: Mapped[float] = mapped_column(Float, default=10.0)
    swc_amount: Mapped[float] = mapped_column(Float, default=0)
    igst_rate: Mapped[float] = mapped_column(Float, default=18.0)
    igst_amount: Mapped[float] = mapped_column(Float, default=0)
    total_duty: Mapped[float] = mapped_column(Float, default=0)

    bill_of_entry: Mapped["BillOfEntry"] = relationship(back_populates="line_items")


# ========================================
# DELIVERY & VERIFICATION TABLES
# ========================================

class ProductVerification(Base):
    """Per-product delivery verification — every item must be checked"""
    __tablename__ = "product_verifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), index=True)
    order_item_id: Mapped[str] = mapped_column(String(36), ForeignKey("order_items.id"))
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"))
    ordered_quantity: Mapped[int] = mapped_column(Integer)
    delivered_quantity: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default=VerificationStatus.PENDING.value)
    objection_type: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    quantity_affected: Mapped[int] = mapped_column(Integer, default=0)
    client_remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    photos: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    verified_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)


class AfterSalesItem(Base):
    """After-sales objection tracking — independent of order lifecycle"""
    __tablename__ = "aftersales_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"))
    order_number: Mapped[str] = mapped_column(String(20))
    order_item_id: Mapped[str] = mapped_column(String(36), ForeignKey("order_items.id"))
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"))
    product_code: Mapped[str] = mapped_column(String(50))
    product_name: Mapped[str] = mapped_column(String(200))
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"))
    client_name: Mapped[str] = mapped_column(String(200))

    ordered_quantity: Mapped[int] = mapped_column(Integer)
    delivered_quantity: Mapped[int] = mapped_column(Integer)
    affected_quantity: Mapped[int] = mapped_column(Integer)
    selling_price_inr: Mapped[float] = mapped_column(Float)
    total_value_inr: Mapped[float] = mapped_column(Float)

    objection_type: Mapped[str] = mapped_column(String(30), index=True)
    description: Mapped[str] = mapped_column(Text)
    client_remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    photos: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    status: Mapped[str] = mapped_column(String(20), default=AfterSalesStatus.OPEN.value, index=True)
    resolution_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolution_amount: Mapped[float] = mapped_column(Float, default=0)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Factory reference for carry-forward lookup
    factory_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("factories.id"), nullable=True, index=True)

    # Quantity tracking (from packing list)
    sent_qty: Mapped[int] = mapped_column(Integer, default=0)
    received_qty: Mapped[int] = mapped_column(Integer, default=0)

    # Carry-forward to next order
    carry_forward_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # PENDING / ADDED_TO_ORDER / FULFILLED
    added_to_order_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("orders.id"), nullable=True)
    carry_forward_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # REPLACEMENT / COMPENSATION
    compensation_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # INR amount for -ve price

    # Link to original AfterSalesItem claim when carried forward into a new order
    source_aftersales_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("aftersales_items.id"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)


# ========================================
# WAREHOUSE & STOCK
# ========================================

class WarehouseStock(Base):
    """Stock tracking from container loading to delivery"""
    __tablename__ = "warehouse_stock"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"))
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default=WarehouseStockStatus.IN_TRANSIT.value)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)


# ========================================
# DOCUMENT MANAGEMENT
# ========================================

class Document(Base):
    """All uploaded/generated documents"""
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("orders.id"), nullable=True)
    shipment_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("shipments.id"), nullable=True)
    doc_type: Mapped[str] = mapped_column(String(50))
    file_path: Mapped[str] = mapped_column(String(500))
    filename: Mapped[str] = mapped_column(String(200))
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ========================================
# SERVICE PROVIDERS
# ========================================

# NOTE: Legacy tables FreightForwarder, CHA, CFSProvider, TransportProvider
# were removed — replaced by unified ServiceProvider table above.

# ========================================
# SETTINGS TABLES
# ========================================

class ExchangeRate(Base):
    """Default currency exchange rates"""
    __tablename__ = "exchange_rates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    from_currency: Mapped[str] = mapped_column(String(5))
    to_currency: Mapped[str] = mapped_column(String(5), default="INR")
    rate: Mapped[float] = mapped_column(Float)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SystemSetting(Base):
    """Key-value system defaults"""
    __tablename__ = "system_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    key: Mapped[str] = mapped_column(String(50), unique=True)
    value: Mapped[str] = mapped_column(String(500))
    data_type: Mapped[str] = mapped_column(String(20), default="string")  # string, int, float, bool


class TransitTime(Base):
    """Default port-to-port transit times"""
    __tablename__ = "transit_times"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    port_of_loading: Mapped[str] = mapped_column(String(100))
    port_of_discharge: Mapped[str] = mapped_column(String(100))
    transit_days: Mapped[int] = mapped_column(Integer)


class ProcessingJob(Base):
    """Background job tracking for Excel processing"""
    __tablename__ = "processing_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("orders.id"), nullable=True)
    job_type: Mapped[str] = mapped_column(String(30))  # CLIENT_EXCEL, FACTORY_EXCEL, PI_GENERATION
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    original_filename: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=JobStatus.PENDING.value)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    total_rows: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    processed_rows: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    result_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string
    result_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)  # G-015: user ID of job creator

    # Relationships
    order: Mapped[Optional["Order"]] = relationship()


class ProductImage(Base):
    """Product image gallery — images extracted from factory Excel responses"""
    __tablename__ = "product_images"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), index=True)
    image_path: Mapped[str] = mapped_column(String(500))
    thumbnail_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    image_hash: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    source_type: Mapped[str] = mapped_column(String(30), default="FACTORY_EXCEL")
    source_order_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("orders.id"), nullable=True)
    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    product: Mapped["Product"] = relationship()


class ClientProductBarcode(Base):
    """Client-specific barcode mapping for products"""
    __tablename__ = "client_product_barcodes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), index=True)
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), index=True)
    barcode_code: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Unique constraint: one barcode per client
    __table_args__ = (
        Index('ix_client_barcode', 'client_id', 'barcode_code', unique=True),
    )

    # Relationships
    client: Mapped["Client"] = relationship()
    product: Mapped["Product"] = relationship()


class ClientCategoryAccess(Base):
    __tablename__ = "client_category_access"
    __table_args__ = (
        Index("ix_cca_client_category", "client_id", "category", unique=True),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)
    category: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ClientBrandAccess(Base):
    __tablename__ = "client_brand_access"
    __table_args__ = (
        Index("ix_cba_client_brand", "client_id", "brand", unique=True),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)
    brand: Mapped[str] = mapped_column(String(200), nullable=False)
    include_no_brand: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ClientProductAccess(Base):
    """Per-product access exceptions for clients (beyond brand-level access)."""
    __tablename__ = "client_product_access"
    __table_args__ = (
        Index("ix_cpa_client_product", "client_id", "product_id", unique=True),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), nullable=False)
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), nullable=False)
    added_via: Mapped[str] = mapped_column(String(20), default="MANUAL")  # MAPPED, MANUAL
    source_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # original Quick Add code
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_unread", "user_id", "is_read"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)  # NULL = all admins
    user_role: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # target role (e.g. ADMIN, CLIENT)
    client_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)  # for client-specific notifications
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(String(50), nullable=False)  # PRODUCT_REVIEW_REQUEST, PRODUCT_APPROVED
    resource_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    resource_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    count: Mapped[int] = mapped_column(Integer, default=1)  # for batching: "5 products confirmed"
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    meta_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON: sub-resource ids, query_id, etc
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow)


class ProductRequest(Base):
    """
    Stores Quick Add product requests from clients.
    Products are NOT created in the products table until admin approves.
    Created when client submits an inquiry with quick-add items.
    """
    __tablename__ = "product_requests"
    __table_args__ = (
        Index("ix_product_requests_order", "order_id"),
        Index("ix_product_requests_client", "client_id"),
        Index("ix_product_requests_status", "status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    product_code: Mapped[str] = mapped_column(String(50))
    product_name: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), index=True)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    mapped_product_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("products.id"), nullable=True)
    created_product_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("products.id"), nullable=True)
    requested_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    requested_by_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    reviewed_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    reject_remark: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ========================================
# Item Queries — per-item chat threads
# ========================================

class ItemQuery(Base):
    __tablename__ = "item_queries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), index=True)
    order_item_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("order_items.id"), nullable=True)
    product_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    query_type: Mapped[str] = mapped_column(String(30), default="GENERAL")
    status: Mapped[str] = mapped_column(String(20), default="OPEN")
    subject: Mapped[str] = mapped_column(String(300), nullable=False)
    created_by_id: Mapped[str] = mapped_column(String(36), nullable=False)
    created_by_role: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    resolution_remark: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # Final conclusion when resolved

    messages: Mapped[List["ItemQueryMessage"]] = relationship(back_populates="query", order_by="ItemQueryMessage.created_at")


class ItemQueryMessage(Base):
    __tablename__ = "item_query_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    query_id: Mapped[str] = mapped_column(String(36), ForeignKey("item_queries.id"), index=True)
    sender_id: Mapped[str] = mapped_column(String(36), nullable=False)
    sender_role: Mapped[str] = mapped_column(String(20), nullable=False)
    sender_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    attachments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    query: Mapped["ItemQuery"] = relationship(back_populates="messages")
