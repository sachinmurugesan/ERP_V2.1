"""
HarvestERP - All Enum Definitions
Prevents typos in status fields. Use these everywhere instead of raw strings.
"""
import enum


class OrderStatus(str, enum.Enum):
    """17-stage workflow statuses (20 internal sub-statuses)"""
    # Stage 0 – Client Inquiry
    CLIENT_DRAFT = "CLIENT_DRAFT"
    # Stage 1
    DRAFT = "DRAFT"
    # Stage 2
    PENDING_PI = "PENDING_PI"
    # Stage 3
    PI_SENT = "PI_SENT"
    # Stage 4 (combined)
    ADVANCE_PENDING = "ADVANCE_PENDING"
    ADVANCE_RECEIVED = "ADVANCE_RECEIVED"
    # Stage 5-9 (combined)
    FACTORY_ORDERED = "FACTORY_ORDERED"
    PRODUCTION_60 = "PRODUCTION_60"
    PRODUCTION_80 = "PRODUCTION_80"
    PRODUCTION_90 = "PRODUCTION_90"
    PLAN_PACKING = "PLAN_PACKING"
    # Stage 10 – Final PI (recalculate from packed items)
    FINAL_PI = "FINAL_PI"
    PRODUCTION_100 = "PRODUCTION_100"
    # Stage 12
    BOOKED = "BOOKED"
    # Stage 13 (combined: LOADED→SAILED→ARRIVED)
    LOADED = "LOADED"
    SAILED = "SAILED"
    ARRIVED = "ARRIVED"
    # Stage 14 (combined: CUSTOMS→CLEARED)
    CUSTOMS_FILED = "CUSTOMS_FILED"
    CLEARED = "CLEARED"
    # Stage 15
    DELIVERED = "DELIVERED"
    # Stage 16 — After-Sales Review
    AFTER_SALES = "AFTER_SALES"
    # Stage 17
    COMPLETED = "COMPLETED"
    COMPLETED_EDITING = "COMPLETED_EDITING"


class Currency(str, enum.Enum):
    INR = "INR"
    USD = "USD"
    CNY = "CNY"
    EUR = "EUR"
    GBP = "GBP"
    JPY = "JPY"


class PaymentMethod(str, enum.Enum):
    BANK_TRANSFER = "BANK_TRANSFER"
    CHEQUE = "CHEQUE"
    CASH = "CASH"
    UPI = "UPI"
    LC = "LC"  # Letter of Credit


class PaymentVerificationStatus(str, enum.Enum):
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"


class PaymentType(str, enum.Enum):
    CLIENT_ADVANCE = "CLIENT_ADVANCE"
    CLIENT_BALANCE = "CLIENT_BALANCE"
    FACTORY_PAYMENT = "FACTORY_PAYMENT"


class ContainerType(str, enum.Enum):
    TWENTY_FT = "20FT"
    FORTY_FT = "40FT"
    FORTY_HC = "40HC"


class SailingPhase(str, enum.Enum):
    LOADED = "LOADED"
    SAILED = "SAILED"
    ARRIVED = "ARRIVED"


class CustomsMilestoneType(str, enum.Enum):
    BE_FILED = "BE_FILED"
    UNDER_ASSESSMENT = "UNDER_ASSESSMENT"
    EXAMINATION = "EXAMINATION"
    DUTY_PAID = "DUTY_PAID"
    OOC_ISSUED = "OOC_ISSUED"
    DELIVERY_ORDER = "DELIVERY_ORDER"
    TRANSPORT_READY = "TRANSPORT_READY"


class ShippingDocType(str, enum.Enum):
    BOL = "BOL"  # Bill of Lading
    COO = "COO"  # Certificate of Origin
    CI = "CI"    # Commercial Invoice
    PL = "PL"    # Packing List


class CustomsDocType(str, enum.Enum):
    BE = "BE"              # Bill of Entry
    OOC = "OOC"            # Out of Charge
    DO = "DO"              # Delivery Order
    EWAY_BILL = "EWAY_BILL"
    INVOICE = "INVOICE"


class VerificationStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    OBJECTION = "OBJECTION"


class ObjectionType(str, enum.Enum):
    PRODUCT_MISMATCH = "PRODUCT_MISMATCH"
    PRODUCT_MISSING = "PRODUCT_MISSING"
    QUALITY_ISSUE = "QUALITY_ISSUE"
    PRICE_MISMATCH = "PRICE_MISMATCH"


class AfterSalesStatus(str, enum.Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class ResolutionType(str, enum.Enum):
    REPLACE_NEXT_ORDER = "REPLACE_NEXT_ORDER"       # Free replacement in next order (0 price)
    COMPENSATE_BALANCE = "COMPENSATE_BALANCE"         # Deduct from next order (-ve price)
    PARTIAL_COMPENSATE = "PARTIAL_COMPENSATE"         # Partial balance deduction
    PARTIAL_REPLACEMENT = "PARTIAL_REPLACEMENT"       # Mix: some replaced, some compensated


class CarryForwardStatus(str, enum.Enum):
    PENDING = "PENDING"
    ADDED_TO_ORDER = "ADDED_TO_ORDER"
    FULFILLED = "FULFILLED"


class CarryForwardType(str, enum.Enum):
    REPLACEMENT = "REPLACEMENT"       # selling_price = 0
    COMPENSATION = "COMPENSATION"     # selling_price = -X


class UnloadedItemStatus(str, enum.Enum):
    PENDING = "PENDING"
    ADDED_TO_ORDER = "ADDED_TO_ORDER"
    SHIPPED = "SHIPPED"


class WarehouseStockStatus(str, enum.Enum):
    IN_TRANSIT = "IN_TRANSIT"
    AT_PORT = "AT_PORT"
    CLEARED = "CLEARED"
    DISPATCHED = "DISPATCHED"
    DELIVERED = "DELIVERED"


class OrderItemStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    REMOVED = "REMOVED"
    UNLOADED = "UNLOADED"


class ServiceProviderType(str, enum.Enum):
    FREIGHT_FORWARDER = "FREIGHT_FORWARDER"
    CHA = "CHA"
    CFS = "CFS"
    TRANSPORT = "TRANSPORT"


class PIItemStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"  # Client accepted price, awaiting admin final approval
    APPROVED = "APPROVED"    # Admin approved, merged into main list
    REJECTED = "REJECTED"
    QUERY = "QUERY"
    HOLD = "HOLD"


class QueryType(str, enum.Enum):
    PHOTO_REQUEST = "PHOTO_REQUEST"
    VIDEO_REQUEST = "VIDEO_REQUEST"
    DIMENSION_CHECK = "DIMENSION_CHECK"
    QUALITY_QUERY = "QUALITY_QUERY"
    ALTERNATIVE = "ALTERNATIVE"
    GENERAL = "GENERAL"

class QueryStatus(str, enum.Enum):
    OPEN = "OPEN"
    REPLIED = "REPLIED"
    RESOLVED = "RESOLVED"


class JobType(str, enum.Enum):
    CLIENT_EXCEL = "CLIENT_EXCEL"
    FACTORY_EXCEL = "FACTORY_EXCEL"
    PI_GENERATION = "PI_GENERATION"


class JobStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ApprovalStatus(str, enum.Enum):
    APPROVED = "APPROVED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    REJECTED = "REJECTED"


class ProductRequestStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    MAPPED = "MAPPED"
    REJECTED = "REJECTED"


class CreditStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    APPLIED = "APPLIED"
    EXPIRED = "EXPIRED"


class ShippingDecision(str, enum.Enum):
    NONE = "NONE"
    SHIP_CARRY_FORWARD = "SHIP_CARRY_FORWARD"
    SHIP_CANCEL_BALANCE = "SHIP_CANCEL_BALANCE"
    WAIT = "WAIT"


class BoeStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    FILED = "FILED"
    ASSESSED = "ASSESSED"
    DUTY_PAID = "DUTY_PAID"
    OOC = "OOC"


class ClientType(str, enum.Enum):
    REGULAR = "REGULAR"
    TRANSPARENCY = "TRANSPARENCY"


# ========================================
# Stage Mapping — status → (stage_number, label)
# Canonical source for the 17-stage workflow numbering.
# ========================================
STAGE_MAP = {
    OrderStatus.CLIENT_DRAFT.value: (0, "Client Inquiry"),
    OrderStatus.DRAFT.value: (1, "Draft"),
    OrderStatus.PENDING_PI.value: (2, "Pending PI"),
    OrderStatus.PI_SENT.value: (3, "PI Sent"),
    OrderStatus.ADVANCE_PENDING.value: (4, "Advance Pending"),
    OrderStatus.ADVANCE_RECEIVED.value: (4, "Advance Received"),
    OrderStatus.FACTORY_ORDERED.value: (5, "Factory Ordered"),
    OrderStatus.PRODUCTION_60.value: (6, "Production 60%"),
    OrderStatus.PRODUCTION_80.value: (7, "Production 80%"),
    OrderStatus.PRODUCTION_90.value: (8, "Production 90%"),
    OrderStatus.PLAN_PACKING.value: (9, "Plan Packing"),
    OrderStatus.FINAL_PI.value: (10, "Final PI"),
    OrderStatus.PRODUCTION_100.value: (11, "Production 100%"),
    OrderStatus.BOOKED.value: (12, "Container Booked"),
    OrderStatus.LOADED.value: (13, "Container Loaded"),
    OrderStatus.SAILED.value: (13, "Sailing"),
    OrderStatus.ARRIVED.value: (13, "Arrived at Port"),
    OrderStatus.CUSTOMS_FILED.value: (14, "Customs Filed"),
    OrderStatus.CLEARED.value: (14, "Customs Cleared"),
    OrderStatus.DELIVERED.value: (15, "Delivered"),
    OrderStatus.AFTER_SALES.value: (16, "After-Sales"),
    OrderStatus.COMPLETED.value: (17, "Completed"),
    OrderStatus.COMPLETED_EDITING.value: (17, "Completed (Editing)"),
}


def get_stage_info(status: str):
    """Return (stage_number, label) for a given order status string."""
    return STAGE_MAP.get(status, (0, "Unknown"))
