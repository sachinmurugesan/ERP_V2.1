"""Unloaded Items API — items not shipped, carry forward to next order"""
from math import ceil
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, aliased

from core.security import get_current_user, CurrentUser
from database import get_db
from models import UnloadedItem, Order, Product

router = APIRouter()


@router.get("/")
def list_unloaded_items(
    factory_id: Optional[str] = Query(None),
    client_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List unloaded items with pagination and optional filters."""
    # CLIENT RLS: absent client_id → scope to own; mismatched → 403 (D-006)
    if current_user.user_type == "CLIENT":
        if client_id is None:
            client_id = current_user.client_id
        elif client_id != current_user.client_id:
            raise HTTPException(status_code=403, detail="Access denied")
    # FACTORY RLS: absent factory_id → scope to own; mismatched → 403 (D-006)
    elif current_user.user_type == "FACTORY":
        if factory_id is None:
            factory_id = current_user.factory_id
        elif factory_id != current_user.factory_id:
            raise HTTPException(status_code=403, detail="Access denied")

    OrigOrder = aliased(Order)
    AddedOrder = aliased(Order)

    q = (
        db.query(UnloadedItem, Product, OrigOrder, AddedOrder)
        .outerjoin(Product, Product.id == UnloadedItem.product_id)
        .outerjoin(OrigOrder, OrigOrder.id == UnloadedItem.original_order_id)
        .outerjoin(AddedOrder, AddedOrder.id == UnloadedItem.added_to_order_id)
    )

    if factory_id:
        subq = db.query(Order.id).filter(Order.factory_id == factory_id).subquery()
        q = q.filter(UnloadedItem.original_order_id.in_(subq))
    if client_id:
        q = q.filter(UnloadedItem.client_id == client_id)
    if status:
        q = q.filter(UnloadedItem.status == status)

    total = q.count()
    rows = q.order_by(UnloadedItem.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    # Strip factory cost fields from non-INTERNAL callers (D-004)
    include_pricing = current_user.user_type == "INTERNAL"

    result = []
    for ui, product, orig_order, added_order in rows:
        row = {
            "id": ui.id,
            "original_order_id": ui.original_order_id,
            "original_order_number": orig_order.order_number if orig_order else None,
            "client_id": ui.client_id,
            "product_id": ui.product_id,
            "product_code": product.product_code if product else None,
            "product_name": product.product_name if product else None,
            "quantity": ui.quantity,
            "reason": ui.reason,
            "status": ui.status,
            "added_to_order_id": ui.added_to_order_id,
            "added_to_order_number": added_order.order_number if added_order else None,
            "created_at": ui.created_at.isoformat() if ui.created_at else None,
        }
        if include_pricing:
            row["factory_price"] = ui.factory_price
        result.append(row)

    return {
        "items": result,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": ceil(total / per_page) if per_page else 0,
    }


@router.get("/pending/")
def get_pending_for_order(
    client_id: str = Query(...),
    factory_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get PENDING unloaded items for a specific client+factory pair.
    Used when creating a new order to auto-add carry-forward items."""
    # Ownership checks: CLIENT and FACTORY must only query their own data (D-006)
    if current_user.user_type == "CLIENT" and client_id != current_user.client_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.user_type == "FACTORY" and factory_id != current_user.factory_id:
        raise HTTPException(status_code=403, detail="Access denied")

    subq = db.query(Order.id).filter(Order.factory_id == factory_id).subquery()

    rows = (
        db.query(UnloadedItem, Product, Order)
        .outerjoin(Product, Product.id == UnloadedItem.product_id)
        .outerjoin(Order, Order.id == UnloadedItem.original_order_id)
        .filter(
            UnloadedItem.client_id == client_id,
            UnloadedItem.original_order_id.in_(subq),
            UnloadedItem.status == "PENDING",
        )
        .all()
    )

    # Strip factory cost fields from non-INTERNAL callers (D-004)
    include_pricing = current_user.user_type == "INTERNAL"

    result = []
    for ui, product, order in rows:
        row = {
            "id": ui.id,
            "product_id": ui.product_id,
            "product_code": product.product_code if product else None,
            "product_name": product.product_name if product else None,
            "quantity": ui.quantity,
            "reason": ui.reason,
            "original_order_number": order.order_number if order else None,
        }
        if include_pricing:
            row["factory_price"] = ui.factory_price
        result.append(row)

    return {"items": result}
