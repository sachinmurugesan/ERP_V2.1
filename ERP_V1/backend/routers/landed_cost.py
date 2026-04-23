"""
Landed Cost API — aggregates all costs for transparency client orders.

Available after CLEARED stage. Returns grouped breakdown of:
- Shipment costs (freight, THC, doc fees)
- Customs costs (BOE duty, clearance charges)
- Sourcing commission (% of client factory invoice)
- Per-item proportional cost split
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import config as _config
from database import get_db
from core.security import CurrentUser, get_current_user
from enums import OrderStatus, STAGE_MAP
from models import (
    Order, OrderItem, Client, Shipment,
    BillOfEntry, ClearanceCharges,
)

router = APIRouter()

# Stages at or after CLEARED (stage number >= 14)
_LANDED_COST_STAGES = frozenset({
    OrderStatus.CLEARED.value,
    OrderStatus.DELIVERED.value,
    OrderStatus.AFTER_SALES.value,
    OrderStatus.COMPLETED.value,
    OrderStatus.COMPLETED_EDITING.value,
})


def _to_dec(val) -> Decimal:
    """Convert any numeric to Decimal safely."""
    if val is None:
        return Decimal("0")
    return Decimal(str(val))


@router.get("/orders/{order_id}/landed-cost/")
def get_landed_cost(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get full landed cost breakdown for a transparency client order."""

    # Feature flag check
    if not _config.TRANSPARENCY_ENABLED:
        raise HTTPException(status_code=404, detail="Not found")

    # Fetch order
    order = db.query(Order).filter(
        Order.id == order_id, Order.deleted_at.is_(None)
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Not found")

    # Fetch client
    client = db.query(Client).filter(Client.id == order.client_id).first()
    if not client or client.client_type != "TRANSPARENCY":
        raise HTTPException(status_code=404, detail="Not found")

    # Role check: SUPER_ADMIN, ADMIN, FINANCE, CLIENT (own orders only)
    allowed_internal = {"SUPER_ADMIN", "ADMIN", "FINANCE"}
    if current_user.role not in allowed_internal:
        if current_user.role == "CLIENT":
            if current_user.client_id != order.client_id:
                raise HTTPException(status_code=403, detail="Access denied")
        else:
            raise HTTPException(status_code=403, detail="Access denied")

    # Stage check: must be at or after CLEARED
    if order.status not in _LANDED_COST_STAGES:
        stage_num, stage_name = STAGE_MAP.get(order.status, (0, "Unknown"))
        raise HTTPException(
            status_code=400,
            detail=f"Landed cost is available after customs clearance. "
                   f"Current stage: {stage_name} (stage {stage_num})"
        )

    # ========================================
    # Aggregate costs from related models
    # ========================================

    # Active items
    active_items = [
        i for i in db.query(OrderItem).filter(
            OrderItem.order_id == order_id,
            OrderItem.status == "ACTIVE",
        ).all()
    ]

    # --- Invoice value (based on client_factory_price) ---
    exchange_rate = _to_dec(order.exchange_rate or 1)
    total_client_factory_cny = Decimal("0")
    for item in active_items:
        if item.client_factory_price:
            total_client_factory_cny += _to_dec(item.client_factory_price) * _to_dec(item.quantity)

    invoice_value_inr = (total_client_factory_cny * exchange_rate).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    # --- Shipment costs ---
    shipments = db.query(Shipment).filter(Shipment.order_id == order_id).all()
    freight_inr = sum(_to_dec(s.freight_cost_inr) for s in shipments)
    thc_inr = sum(_to_dec(s.thc_inr) for s in shipments)
    doc_fees_inr = sum(_to_dec(s.doc_fees_inr) for s in shipments)
    total_shipment = freight_inr + thc_inr + doc_fees_inr

    # --- BOE / Customs duty ---
    boe_list = db.query(BillOfEntry).filter(BillOfEntry.order_id == order_id).all()
    total_bcd = sum(_to_dec(b.total_bcd) for b in boe_list)
    total_swc = sum(_to_dec(getattr(b, 'total_swc', 0)) for b in boe_list)
    total_igst = sum(_to_dec(b.total_igst) for b in boe_list)
    total_duty = total_bcd + total_swc + total_igst

    # --- Clearance charges ---
    clearance = db.query(ClearanceCharges).filter(
        ClearanceCharges.order_id == order_id
    ).first()
    cha_fees = _to_dec(clearance.cha_fees) if clearance else Decimal("0")
    cfs_charges = _to_dec(clearance.cfs_charges) if clearance else Decimal("0")
    insurance = _to_dec(clearance.insurance_inr) if clearance else Decimal("0")
    transport = _to_dec(clearance.transport_cost) if clearance else Decimal("0")
    other_charges = _to_dec(clearance.other_charges) if clearance else Decimal("0")
    total_clearance = cha_fees + cfs_charges + insurance + transport + other_charges

    # --- Sourcing commission ---
    commission_rate = _to_dec(client.sourcing_commission_percent or 0)
    commission_amount = (invoice_value_inr * commission_rate / 100).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    # --- Grand totals ---
    total_expenses = total_shipment + total_duty + total_clearance + commission_amount
    grand_total = invoice_value_inr + total_expenses
    expense_percent = (
        (total_expenses / invoice_value_inr * 100).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        if invoice_value_inr > 0 else Decimal("0")
    )

    # ========================================
    # Per-item proportional split
    # ========================================
    items_data = []
    total_all_expenses = total_shipment + total_duty + total_clearance + commission_amount

    for item in active_items:
        cfp = _to_dec(item.client_factory_price) if item.client_factory_price else Decimal("0")
        qty = _to_dec(item.quantity)
        item_value_cny = cfp * qty
        item_value_inr = (item_value_cny * exchange_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        # Proportional share
        if total_client_factory_cny > 0 and cfp > 0:
            proportion = item_value_cny / (total_client_factory_cny)
        else:
            proportion = Decimal("0")

        freight_share = (proportion * total_shipment).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        duty_share = (proportion * total_duty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        clearance_share = (proportion * total_clearance).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        commission_share = (proportion * commission_amount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        total_landed = item_value_inr + freight_share + duty_share + clearance_share + commission_share
        per_unit = (total_landed / qty).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if qty > 0 else Decimal("0")

        items_data.append({
            "product_code": item.product_code_snapshot or "",
            "product_name": item.product_name_snapshot or "",
            "quantity": int(item.quantity),
            "client_factory_price_cny": float(cfp),
            "item_value_inr": float(item_value_inr),
            "freight_share": float(freight_share),
            "duty_share": float(duty_share),
            "clearance_share": float(clearance_share),
            "commission_share": float(commission_share),
            "total_landed_cost": float(total_landed),
            "landed_cost_per_unit": float(per_unit),
        })

    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "client_name": client.company_name,
        "exchange_rate": float(exchange_rate),
        "currency": order.currency or "CNY",

        "invoice": {
            "label": f"Invoice @{float(exchange_rate):.2f}",
            "amount_inr": float(invoice_value_inr),
        },

        "expenses": [
            {"label": "Freight + THC", "amount_inr": float(freight_inr + thc_inr)},
            {"label": "Clearance + CFS", "amount_inr": float(cha_fees + cfs_charges)},
            {"label": f"Sourcing Charge ({float(commission_rate):.1f}%)", "amount_inr": float(commission_amount)},
            {"label": "Duty + IGST", "amount_inr": float(total_duty)},
            {"label": "Transport", "amount_inr": float(transport)},
            {"label": "Miscellaneous", "amount_inr": float(insurance + other_charges + doc_fees_inr)},
        ],

        "summary": {
            "total_bill_inr": float(invoice_value_inr),
            "total_expenses_inr": float(total_expenses),
            "grand_total_inr": float(grand_total),
            "expense_percent": float(expense_percent),
        },

        "items": items_data,
    }


@router.get("/orders/{order_id}/landed-cost/download/")
def download_landed_cost(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Download landed cost as Excel file."""
    from fastapi.responses import StreamingResponse
    from services.landed_cost_excel import generate_landed_cost_excel

    # Reuse the same endpoint logic to get data + do access checks
    data = get_landed_cost(order_id=order_id, db=db, current_user=current_user)

    output = generate_landed_cost_excel(data)
    order_number = data.get("order_number", "unknown")

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="LandedCost_{order_number}.xlsx"'
        },
    )
