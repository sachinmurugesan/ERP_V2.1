"""Shared finance calculation helpers — single source of truth for PI totals and balances."""

from sqlalchemy import or_
from sqlalchemy.orm import Session
from models import Order, OrderItem, Payment, ProformaInvoice, Client


def _item_client_total(item: OrderItem, is_transparency: bool, rate: float) -> float:
    """Calculate a single item's client-facing total in INR.
    Transparency clients: client_factory_price * exchange_rate * qty
    Regular clients: selling_price_inr * qty
    """
    if is_transparency:
        return round(float(item.client_factory_price or 0) * rate, 2) * (item.quantity or 0)
    return (item.selling_price_inr or 0) * (item.quantity or 0)


def calc_effective_pi_total(order: Order, db: Session) -> float:
    """Calculate the effective PI total from ACTIVE items only.
    For transparency clients, uses client_factory_price * exchange_rate.
    For regular clients, uses selling_price_inr."""
    active_items = db.query(OrderItem).filter(
        OrderItem.order_id == order.id,
        OrderItem.status == "ACTIVE",
        or_(OrderItem.pi_item_status.is_(None), OrderItem.pi_item_status == "APPROVED"),
    ).all()

    client = db.query(Client).filter(Client.id == order.client_id).first()
    is_transparency = client and client.client_type == "TRANSPARENCY"
    rate = order.exchange_rate or 1.0

    return round(sum(_item_client_total(i, is_transparency, rate) for i in active_items), 2)


def calc_original_pi_total(order: Order, db: Session) -> float:
    """Get the original PI total from the ProformaInvoice record (what was invoiced)."""
    pi = db.query(ProformaInvoice).filter(
        ProformaInvoice.order_id == order.id,
    ).order_by(ProformaInvoice.generated_at.desc()).first()
    return round(pi.total_inr or 0, 2) if pi else 0.0


def calc_total_paid(order_id: str, db: Session, exclude_credit: bool = True) -> float:
    """Calculate total INR paid by client for an order.
    Only counts VERIFIED payments — excludes PENDING_VERIFICATION and REJECTED."""
    payments = db.query(Payment).filter(Payment.order_id == order_id).all()
    if exclude_credit:
        payments = [p for p in payments if (p.method or '').upper() != 'CREDIT']
    # Only VERIFIED payments count toward totals
    payments = [p for p in payments if getattr(p, 'verification_status', 'VERIFIED') == 'VERIFIED']
    return round(sum(p.amount_inr or 0 for p in payments), 2)


def calc_order_finance_summary(order: Order, db: Session) -> dict:
    """Single source of truth for order financial summary.
    Used by client portal, admin ledger, and payments tab."""
    effective = calc_effective_pi_total(order, db)
    original = calc_original_pi_total(order, db)
    paid = calc_total_paid(order.id, db)
    balance = round(effective - paid, 2)
    progress = round((paid / effective * 100), 1) if effective > 0 else 0.0
    is_revised = abs(effective - original) > 0.01 if original > 0 else False

    return {
        "original_pi_total": original,
        "effective_pi_total": effective,
        "is_revised": is_revised,
        "total_paid": paid,
        "balance": balance,
        "progress_percent": min(progress, 100.0),
        "is_overpaid": balance < -0.01,
        "overpayment": round(abs(balance), 2) if balance < -0.01 else 0.0,
    }


def update_effective_pi_total(order: Order, db: Session) -> float:
    """Recalculate and persist the effective PI total on the order.
    Call this whenever items change (unload, remove, price update, etc.)."""
    total = calc_effective_pi_total(order, db)
    order.effective_pi_total = total
    return total
