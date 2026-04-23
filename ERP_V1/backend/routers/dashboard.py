"""Dashboard API endpoints"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from database import get_db
from models import Order, AfterSalesItem
from enums import OrderStatus, AfterSalesStatus, STAGE_MAP, get_stage_info
from core.security import CurrentUser, get_current_user

router = APIRouter()


def _apply_tenant_scope(query, current_user: CurrentUser):
    """Scope an Order query to the calling user's tenant.

    CLIENT and FACTORY users see only orders they own.
    INTERNAL roles (ADMIN / SUPER_ADMIN / FINANCE / OPERATIONS) are unscoped.
    """
    if current_user.user_type == "CLIENT":
        return query.filter(Order.client_id == current_user.client_id)
    if current_user.user_type == "FACTORY":
        return query.filter(Order.factory_id == current_user.factory_id)
    return query


def _compute_total_cny(order: Order) -> float:
    """Sum factory_price * quantity for active items."""
    if not order.items:
        return 0.0
    return sum(
        (i.factory_price or 0) * i.quantity
        for i in order.items
        if i.status == "ACTIVE"
    )


@router.get("/summary/")
def get_dashboard_summary(db: Session = Depends(get_db)):
    """Get dashboard summary stats"""
    total_orders = db.query(func.count(Order.id)).filter(Order.deleted_at.is_(None)).scalar()

    in_production = db.query(func.count(Order.id)).filter(
        Order.status.in_([
            OrderStatus.FACTORY_ORDERED.value,
            OrderStatus.PRODUCTION_60.value,
            OrderStatus.PRODUCTION_80.value,
            OrderStatus.PRODUCTION_90.value,
            OrderStatus.PRODUCTION_100.value,
        ]),
        Order.deleted_at.is_(None)
    ).scalar()

    in_transit = db.query(func.count(Order.id)).filter(
        Order.status.in_([
            OrderStatus.LOADED.value,
            OrderStatus.SAILED.value,
            OrderStatus.ARRIVED.value,
        ]),
        Order.deleted_at.is_(None)
    ).scalar()

    aftersales_open = db.query(func.count(AfterSalesItem.id)).filter(
        AfterSalesItem.status == AfterSalesStatus.OPEN.value
    ).scalar()

    client_inquiries = db.query(func.count(Order.id)).filter(
        Order.status == "CLIENT_DRAFT",
        Order.deleted_at.is_(None),
    ).scalar()

    return {
        "total_orders": total_orders,
        "in_production": in_production,
        "in_transit": in_transit,
        "aftersales_open": aftersales_open,
        "client_inquiries": client_inquiries or 0,
    }


@router.get("/recent-orders/")
def get_recent_orders(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get 10 most recent orders with full details"""
    query = db.query(Order).options(
        joinedload(Order.client),
        joinedload(Order.factory),
        joinedload(Order.items),
    ).filter(Order.deleted_at.is_(None))

    query = _apply_tenant_scope(query, current_user)
    orders = query.order_by(Order.created_at.desc()).limit(10).all()

    show_cny = current_user.user_type == "INTERNAL"
    result = []
    for o in orders:
        stage_number, stage_name = get_stage_info(o.status)
        entry = {
            "id": o.id,
            "order_number": o.order_number,
            "po_reference": o.po_reference,
            "client_name": o.client.company_name if o.client else None,
            "factory_name": o.factory.company_name if o.factory else None,
            "status": o.status,
            "stage_number": stage_number,
            "stage_name": stage_name,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        if show_cny:
            entry["total_value_cny"] = round(_compute_total_cny(o), 2)
        result.append(entry)
    return result


@router.get("/active-shipments/")
def get_active_shipments(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get orders in production or transit stages for dashboard"""
    query = db.query(Order).options(
        joinedload(Order.factory),
        joinedload(Order.items),
    ).filter(
        Order.status.in_([
            OrderStatus.FACTORY_ORDERED.value,
            OrderStatus.PRODUCTION_60.value,
            OrderStatus.PRODUCTION_80.value,
            OrderStatus.PRODUCTION_90.value,
            OrderStatus.PRODUCTION_100.value,
            OrderStatus.LOADED.value,
            OrderStatus.SAILED.value,
            OrderStatus.ARRIVED.value,
        ]),
        Order.deleted_at.is_(None),
    )

    query = _apply_tenant_scope(query, current_user)
    orders = query.order_by(Order.updated_at.desc()).limit(5).all()

    show_cny = current_user.user_type == "INTERNAL"
    result = []
    for o in orders:
        stage_number, stage_name = get_stage_info(o.status)
        entry = {
            "id": o.id,
            "order_number": o.order_number,
            "po_reference": o.po_reference,
            "factory_name": o.factory.company_name if o.factory else None,
            "status": o.status,
            "stage_number": stage_number,
            "stage_name": stage_name,
        }
        if show_cny:
            entry["total_value_cny"] = round(_compute_total_cny(o), 2)
        result.append(entry)
    return result


@router.get("/client-inquiries/")
def list_client_inquiries(db: Session = Depends(get_db)):
    """List pending client inquiries for admin dashboard."""
    from models import Client

    inquiries = db.query(Order).options(
        joinedload(Order.client),
    ).filter(
        Order.status == "CLIENT_DRAFT",
        Order.deleted_at.is_(None),
    ).order_by(Order.created_at.desc()).limit(20).all()

    result = []
    for o in inquiries:
        item_count = len(o.items) if hasattr(o, 'items') and o.items else 0
        result.append({
            "id": o.id,
            "order_number": o.order_number,
            "client_name": o.client.company_name if o.client else "Unknown",
            "client_id": o.client_id,
            "po_reference": o.po_reference,
            "item_count": item_count,
            "status": o.status,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        })

    return {"inquiries": result, "total": len(result)}


@router.get("/recent-activity/")
def get_recent_activity(db: Session = Depends(get_db)):
    """Get recent order updates for activity feed"""
    orders = db.query(Order).filter(
        Order.deleted_at.is_(None)
    ).order_by(Order.updated_at.desc()).limit(8).all()

    result = []
    for o in orders:
        stage_number, stage_name = get_stage_info(o.status)
        result.append({
            "id": o.id,
            "order_number": o.order_number,
            "action": f"Order {o.order_number or o.id[:8]} - {stage_name}",
            "details": f"Stage {stage_number}: {o.status}",
            "updated_at": o.updated_at.isoformat() if o.updated_at else (o.created_at.isoformat() if o.created_at else None),
        })
    return result
