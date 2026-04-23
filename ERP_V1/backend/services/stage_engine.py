"""
HarvestERP — Stage Engine Service
Owns all order stage transition logic: validation gates,
forward/backward navigation, and execution of transitions.

This module has ZERO knowledge of HTTP or FastAPI.
It raises ValueError / PermissionError for business rule violations.
The router layer converts these to HTTPException.
"""
from datetime import date, datetime
from typing import Callable, Optional

import json as json_mod

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_

from enums import (
    OrderStatus,
    AfterSalesStatus,
    STAGE_MAP,
    get_stage_info,
)
from core.audit import log_audit_event
from core.security import CurrentUser
from models import (
    Order,
    OrderItem,
    Product,
    ProductImage,
    ProformaInvoice,
    Payment,
    FactoryPayment,
    PackingList,
    PackingListItem,
    Shipment,
    BillOfEntry,
    ShippingDocument,
    AfterSalesItem,
    StageOverride,
)


# ========================================
# Transition Dictionaries
# ========================================

VALID_TRANSITIONS: dict[str, list[str]] = {
    OrderStatus.DRAFT.value: [OrderStatus.PENDING_PI.value],
    OrderStatus.CLIENT_DRAFT.value: [OrderStatus.DRAFT.value],
    OrderStatus.PENDING_PI.value: [OrderStatus.PI_SENT.value],
    OrderStatus.PI_SENT.value: [OrderStatus.ADVANCE_PENDING.value],
    OrderStatus.ADVANCE_PENDING.value: [OrderStatus.ADVANCE_RECEIVED.value],
    OrderStatus.ADVANCE_RECEIVED.value: [OrderStatus.FACTORY_ORDERED.value],
    OrderStatus.FACTORY_ORDERED.value: [OrderStatus.PRODUCTION_60.value],
    OrderStatus.PRODUCTION_60.value: [OrderStatus.PRODUCTION_80.value],
    OrderStatus.PRODUCTION_80.value: [OrderStatus.PRODUCTION_90.value],
    OrderStatus.PRODUCTION_90.value: [OrderStatus.PLAN_PACKING.value],
    OrderStatus.PLAN_PACKING.value: [OrderStatus.FINAL_PI.value],
    OrderStatus.FINAL_PI.value: [OrderStatus.PRODUCTION_100.value],
    OrderStatus.PRODUCTION_100.value: [OrderStatus.BOOKED.value],
    OrderStatus.BOOKED.value: [OrderStatus.LOADED.value],
    OrderStatus.LOADED.value: [OrderStatus.SAILED.value],
    OrderStatus.SAILED.value: [OrderStatus.ARRIVED.value],
    OrderStatus.ARRIVED.value: [OrderStatus.CUSTOMS_FILED.value],
    OrderStatus.CUSTOMS_FILED.value: [OrderStatus.CLEARED.value],
    OrderStatus.CLEARED.value: [OrderStatus.DELIVERED.value],
    OrderStatus.DELIVERED.value: [OrderStatus.AFTER_SALES.value],
    OrderStatus.AFTER_SALES.value: [OrderStatus.COMPLETED.value],
    OrderStatus.COMPLETED.value: [OrderStatus.COMPLETED_EDITING.value],
    OrderStatus.COMPLETED_EDITING.value: [OrderStatus.COMPLETED.value],
}

REVERSE_TRANSITIONS: dict[str, str] = {
    OrderStatus.PENDING_PI.value: OrderStatus.DRAFT.value,
    OrderStatus.PI_SENT.value: OrderStatus.PENDING_PI.value,
    OrderStatus.ADVANCE_PENDING.value: OrderStatus.PI_SENT.value,
    OrderStatus.ADVANCE_RECEIVED.value: OrderStatus.ADVANCE_PENDING.value,
    OrderStatus.FACTORY_ORDERED.value: OrderStatus.ADVANCE_RECEIVED.value,
    OrderStatus.PRODUCTION_60.value: OrderStatus.FACTORY_ORDERED.value,
    OrderStatus.PRODUCTION_80.value: OrderStatus.PRODUCTION_60.value,
    OrderStatus.PRODUCTION_90.value: OrderStatus.PRODUCTION_80.value,
    OrderStatus.PLAN_PACKING.value: OrderStatus.PRODUCTION_90.value,
    OrderStatus.FINAL_PI.value: OrderStatus.PLAN_PACKING.value,
    OrderStatus.PRODUCTION_100.value: OrderStatus.FINAL_PI.value,
    OrderStatus.BOOKED.value: OrderStatus.PRODUCTION_100.value,
    OrderStatus.LOADED.value: OrderStatus.BOOKED.value,
    OrderStatus.SAILED.value: OrderStatus.LOADED.value,
    OrderStatus.ARRIVED.value: OrderStatus.SAILED.value,
    OrderStatus.CUSTOMS_FILED.value: OrderStatus.ARRIVED.value,
    OrderStatus.CLEARED.value: OrderStatus.CUSTOMS_FILED.value,
    OrderStatus.DELIVERED.value: OrderStatus.CLEARED.value,
    OrderStatus.AFTER_SALES.value: OrderStatus.DELIVERED.value,
    OrderStatus.COMPLETED.value: OrderStatus.AFTER_SALES.value,
}


# ========================================
# Pure Navigation Functions
# ========================================

def get_reachable_previous_stages(current_status: str) -> list[dict]:
    """Walk REVERSE_TRANSITIONS chain to find all stages reachable by going back."""
    reachable: list[dict] = []
    status = current_status
    while True:
        prev = REVERSE_TRANSITIONS.get(status)
        if not prev:
            break
        stage_num, stage_name = get_stage_info(prev)
        reachable.append({"status": prev, "stage": stage_num, "name": stage_name})
        status = prev
    return reachable


def get_reachable_forward_stages(
    current_status: str, highest_unlocked_status: str | None
) -> list[dict]:
    """Walk VALID_TRANSITIONS forward from current up to highest_unlocked."""
    if not highest_unlocked_status or current_status == highest_unlocked_status:
        return []

    # Verify highest_unlocked is actually ahead of current
    chain_check = current_status
    found_ahead = False
    for _ in range(30):
        nxt_list = VALID_TRANSITIONS.get(chain_check, [])
        nxt = nxt_list[0] if nxt_list else None
        if not nxt or nxt == chain_check:
            break
        if nxt == highest_unlocked_status:
            found_ahead = True
            break
        chain_check = nxt
    if not found_ahead:
        return []

    reachable: list[dict] = []
    status = current_status
    seen = {current_status}
    for _ in range(30):
        next_list = VALID_TRANSITIONS.get(status, [])
        if not next_list:
            break
        next_status = next_list[0]
        if next_status in seen:
            break
        seen.add(next_status)
        reachable.append({
            "status": next_status,
            "stage": get_stage_info(next_status)[0],
            "name": get_stage_info(next_status)[1],
        })
        if next_status == highest_unlocked_status:
            break
        status = next_status
    return reachable


def get_next_stages_info(order: Order) -> dict:
    """Build complete stage navigation data for an order."""
    next_statuses = VALID_TRANSITIONS.get(order.status, [])

    prev_status = REVERSE_TRANSITIONS.get(order.status)
    prev_stage = None
    if prev_status:
        prev_stage = {
            "status": prev_status,
            "stage": get_stage_info(prev_status)[0],
            "name": get_stage_info(prev_status)[1],
        }

    return {
        "current_status": order.status,
        "current_stage": get_stage_info(order.status),
        "next_stages": [
            {"status": s, "stage": get_stage_info(s)[0], "name": get_stage_info(s)[1]}
            for s in next_statuses
        ],
        "prev_stage": prev_stage,
        "reachable_previous": get_reachable_previous_stages(order.status),
        "reachable_forward": get_reachable_forward_stages(
            order.status, order.highest_unlocked_stage
        ),
        "highest_unlocked_stage": order.highest_unlocked_stage,
    }


# ========================================
# Validation Gates
# ========================================

def validate_transition(
    order: Order, target_status: str, db: Session
) -> tuple[list[str], list[dict]]:
    """Run validation rules before allowing a stage transition.

    Returns (errors, warnings) tuple. Errors block the transition;
    warnings require user acknowledgement.
    """
    errors: list[str] = []
    warnings: list[dict] = []

    # PI Staleness Check
    if order.items_modified_at:
        pi = db.query(ProformaInvoice).filter(
            ProformaInvoice.order_id == order.id
        ).first()
        if pi and order.items_modified_at > pi.generated_at:
            errors.append(
                "Items have changed since last PI — regenerate PI before advancing"
            )

    # DRAFT → PENDING_PI
    if target_status == OrderStatus.PENDING_PI.value:
        if not order.client_id:
            errors.append("Client is required")
        if not order.factory_id:
            errors.append("Factory must be selected before submitting")
        active_items = [i for i in order.items if i.status == "ACTIVE"]
        if len(active_items) == 0:
            errors.append("Order must have at least one item")

    # PENDING_PI → PI_SENT
    elif target_status == OrderStatus.PI_SENT.value:
        active_items = [i for i in order.items if i.status == "ACTIVE"]
        priceable_items = [
            i for i in active_items
            if not (i.notes and i.notes.startswith("After-Sales"))
        ]
        items_without_price = [
            i for i in priceable_items if not i.selling_price_inr
        ]
        if items_without_price:
            errors.append(
                f"{len(items_without_price)} items are missing selling prices"
            )

    # PI_SENT → ADVANCE_PENDING
    elif target_status == OrderStatus.ADVANCE_PENDING.value:
        pi = db.query(ProformaInvoice).filter(
            ProformaInvoice.order_id == order.id
        ).first()
        if not pi:
            errors.append(
                "Proforma Invoice must be generated before requesting advance"
            )

    # ADVANCE_PENDING → ADVANCE_RECEIVED
    elif target_status == OrderStatus.ADVANCE_RECEIVED.value:
        payment_count = db.query(func.count(Payment.id)).filter(
            Payment.order_id == order.id,
            Payment.verification_status == 'VERIFIED',
        ).scalar()
        if payment_count == 0:
            errors.append("At least one verified payment must be recorded")

        pi = db.query(ProformaInvoice).filter(
            ProformaInvoice.order_id == order.id
        ).first()
        if pi and payment_count > 0:
            total_paid = db.query(
                func.coalesce(func.sum(Payment.amount_inr), 0)
            ).filter(
                Payment.order_id == order.id,
                Payment.verification_status == 'VERIFIED',
            ).scalar()
            if total_paid < pi.total_inr:
                balance = round(pi.total_inr - total_paid, 2)
                warnings.append({
                    "type": "underpayment",
                    "message": (
                        f"Total paid ({total_paid:,.2f} INR) is less than "
                        f"PI total ({pi.total_inr:,.2f} INR). "
                        f"Balance: {balance:,.2f} INR"
                    ),
                    "balance": balance,
                    "pi_total": pi.total_inr,
                    "total_paid": total_paid,
                })

    # PLAN_PACKING → FINAL_PI
    elif target_status == OrderStatus.FINAL_PI.value:
        packing_list = db.query(PackingList).filter(
            PackingList.order_id == order.id
        ).first()
        if not packing_list:
            errors.append(
                "Packing list must be uploaded before advancing to Final PI"
            )

    # FINAL_PI → PRODUCTION_100
    elif target_status == OrderStatus.PRODUCTION_100.value:
        pi = db.query(ProformaInvoice).filter(
            ProformaInvoice.order_id == order.id
        ).first()
        if not pi:
            errors.append(
                "Proforma Invoice must be generated before advancing"
            )
        else:
            total_paid = db.query(
                func.coalesce(func.sum(Payment.amount_inr), 0)
            ).filter(
                Payment.order_id == order.id,
                Payment.verification_status == 'VERIFIED',
            ).scalar()
            if total_paid < pi.total_inr:
                balance = round(pi.total_inr - total_paid, 2)
                warnings.append({
                    "type": "client_balance_unpaid",
                    "message": (
                        f"Client balance of \u20b9{balance:,.2f} remaining "
                        f"(PI Total: \u20b9{pi.total_inr:,.2f}, "
                        f"Paid: \u20b9{total_paid:,.2f})"
                    ),
                    "balance": balance,
                    "pi_total": pi.total_inr,
                    "total_paid": total_paid,
                })

    # PRODUCTION_100 → BOOKED
    elif target_status == OrderStatus.BOOKED.value:
        fp_count = db.query(func.count(FactoryPayment.id)).filter(
            FactoryPayment.order_id == order.id
        ).scalar()
        if fp_count == 0:
            errors.append(
                "At least one factory payment must be recorded before booking"
            )
        else:
            active_items = [i for i in order.items if i.status == "ACTIVE"]
            total_cny = sum(
                (i.factory_price or 0) * i.quantity for i in active_items
            )
            exchange_rate = order.exchange_rate or 1.0
            estimated_total_inr = round(total_cny * exchange_rate, 2)

            total_paid_inr = db.query(
                func.coalesce(func.sum(FactoryPayment.amount_inr), 0)
            ).filter(FactoryPayment.order_id == order.id).scalar()

            if total_paid_inr < estimated_total_inr:
                balance = round(estimated_total_inr - total_paid_inr, 2)
                warnings.append({
                    "type": "factory_underpayment",
                    "message": (
                        f"Factory payment is partial. "
                        f"\u20b9{total_paid_inr:,.2f} paid of "
                        f"\u20b9{estimated_total_inr:,.2f} estimated total. "
                        f"Balance: \u20b9{balance:,.2f}"
                    ),
                    "balance": balance,
                    "estimated_total": estimated_total_inr,
                    "total_paid": total_paid_inr,
                })

    # SAILED → ARRIVED
    elif target_status == OrderStatus.ARRIVED.value:
        shipments = db.query(Shipment).filter(
            Shipment.order_id == order.id
        ).all()
        for s in shipments:
            if s.eta and date.today() < s.eta:
                days_early = (s.eta - date.today()).days
                warnings.append({
                    "type": "early_arrival",
                    "message": (
                        f"ETA is {s.eta.isoformat()} ({days_early} days away). "
                        f"Has the vessel actually arrived?"
                    ),
                    "eta": s.eta.isoformat(),
                    "days_early": days_early,
                })
                break

    # CLEARED → DELIVERED
    elif target_status == OrderStatus.DELIVERED.value:
        shipments = db.query(Shipment).filter(
            Shipment.order_id == order.id
        ).all()
        if not shipments:
            errors.append("No shipments found for this order")
        else:
            boe = db.query(BillOfEntry).filter(
                BillOfEntry.order_id == order.id,
            ).first()
            if not boe:
                errors.append(
                    "Bill of Entry (BOE) must be filed before marking as Delivered"
                )
            elif boe.status != "OOC":
                warnings.append({
                    "type": "boe_not_ooc",
                    "message": (
                        f"BOE status is '{boe.status}' \u2014 typically should be "
                        f"'Out of Charge' before delivery"
                    ),
                })

            ooc_count = db.query(BillOfEntry).filter(
                BillOfEntry.order_id == order.id,
                BillOfEntry.status == "OOC",
            ).count()
            if ooc_count == 0 and boe:
                warnings.append({
                    "type": "missing_ooc",
                    "message": "Out of Charge (OOC) document not yet received",
                })

            do_docs = db.query(ShippingDocument).filter(
                ShippingDocument.order_id == order.id,
                ShippingDocument.document_type == "DELIVERY_ORDER",
                ShippingDocument.status == "RECEIVED",
            ).count()
            if do_docs == 0:
                warnings.append({
                    "type": "missing_do",
                    "message": "Delivery Order (DO) document not yet received",
                })

    # AFTER_SALES → COMPLETED
    elif target_status == OrderStatus.COMPLETED.value:
        open_claims = db.query(func.count(AfterSalesItem.id)).filter(
            AfterSalesItem.order_id == order.id,
            AfterSalesItem.status.in_([
                AfterSalesStatus.OPEN.value,
                AfterSalesStatus.IN_PROGRESS.value,
            ]),
            or_(
                AfterSalesItem.selling_price_inr >= 0,
                AfterSalesItem.selling_price_inr.is_(None),
            ),
        ).scalar()
        if open_claims > 0:
            warnings.append({
                "type": "open_after_sales",
                "message": (
                    f"{open_claims} after-sales claim(s) still open/in-progress"
                ),
            })

    return errors, warnings


# ========================================
# Transition Execution Functions
# ========================================

def execute_transition(
    db: Session,
    order: Order,
    target_status: str,
    user: CurrentUser,
    notes: Optional[str] = None,
    acknowledge_warnings: bool = False,
    transition_reason: Optional[str] = None,
    generate_order_number_fn: Optional[Callable] = None,
    copy_image_fn: Optional[Callable] = None,
) -> dict:
    """Execute a forward stage transition with full validation.

    Returns {"order": Order, "warnings": list} on success,
    or {"status": "warnings", "warnings": list} when unacknowledged warnings exist.
    Raises ValueError on validation failure or invalid transition.
    """
    allowed = VALID_TRANSITIONS.get(order.status, [])
    if target_status not in allowed:
        raise ValueError(
            f"Cannot transition from {order.status} to {target_status}. "
            f"Allowed: {allowed}"
        )

    errors, warnings = validate_transition(order, target_status, db)
    if errors:
        raise ValueError({"validation_errors": errors})

    # Return warnings for user confirmation if not acknowledged
    if warnings and not acknowledge_warnings:
        return {
            "status": "warnings",
            "warnings": warnings,
            "message": (
                "Transition has warnings that require acknowledgement. "
                "Resend with acknowledge_warnings=true to proceed."
            ),
        }

    # Generate order number when leaving DRAFT
    if (
        order.status in (OrderStatus.CLIENT_DRAFT.value, OrderStatus.DRAFT.value)
        and not order.order_number
        and generate_order_number_fn
    ):
        order.order_number = generate_order_number_fn(db)

    # Snapshot product data when DRAFT → PENDING_PI
    if (
        order.status == OrderStatus.DRAFT.value
        and target_status == OrderStatus.PENDING_PI.value
    ):
        for item in order.items:
            if item.status != "ACTIVE":
                continue
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if product:
                item.product_code_snapshot = product.product_code
                item.product_name_snapshot = product.product_name
                item.material_snapshot = product.material
                item.part_type_snapshot = product.part_type
                item.dimension_snapshot = product.dimension
                item.variant_note_snapshot = product.variant_note
                item.category_snapshot = product.category
                # Copy primary image into order folder
                img = db.query(ProductImage).filter(
                    ProductImage.product_id == product.id
                ).order_by(
                    ProductImage.is_primary.desc(), ProductImage.created_at
                ).first()
                if img and copy_image_fn:
                    copied_path = copy_image_fn(order.id, img.image_path)
                    item.image_path_snapshot = copied_path or img.image_path

    current_status = order.status
    order.version = (order.version or 1) + 1
    order.status = target_status

    # Track highest unlocked stage (high-water mark)
    new_stage_num = get_stage_info(target_status)[0]
    current_highest_num = (
        get_stage_info(order.highest_unlocked_stage)[0]
        if order.highest_unlocked_stage
        else 0
    )
    if new_stage_num > current_highest_num:
        order.highest_unlocked_stage = target_status

    # Save override record for acknowledged warnings
    if warnings and acknowledge_warnings and transition_reason:
        db.add(StageOverride(
            order_id=order.id,
            from_stage=current_status,
            to_stage=target_status,
            reason=transition_reason.strip(),
            warnings_json=json_mod.dumps(warnings),
        ))

    # Early arrival: update shipment ETA to today
    if target_status == OrderStatus.ARRIVED.value and acknowledge_warnings:
        shipments = db.query(Shipment).filter(
            Shipment.order_id == order.id
        ).all()
        for s in shipments:
            if s.eta and date.today() < s.eta:
                s.eta = date.today()
            if not s.ata:
                s.ata = date.today()
            s.sailing_phase = "ARRIVED"

    # Final PI: recalculate quantities from actual packed amounts
    if target_status == OrderStatus.FINAL_PI.value:
        packing_items = db.query(PackingListItem).join(PackingList).filter(
            PackingList.order_id == order.id,
            PackingListItem.packing_status != "SPLIT",
        ).all()
        for pi in packing_items:
            oi = db.query(OrderItem).filter(
                OrderItem.id == pi.order_item_id
            ).first()
            if oi and oi.status == "ACTIVE":
                actual_qty = pi.loaded_qty or 0
                if actual_qty != oi.quantity:
                    oi.notes = (
                        (oi.notes or "")
                        + f"\n[Final PI] Qty revised: {oi.quantity} \u2192 {actual_qty}"
                    )
                    oi.quantity = actual_qty
        order.items_modified_at = datetime.utcnow()

    # Mark completed timestamp + fulfill carried items
    if target_status == OrderStatus.COMPLETED.value:
        order.completed_at = datetime.utcnow()

        # Auto-fulfill after-sales items carried into this order
        from models import AfterSalesItem as _ASItem
        from enums import CarryForwardStatus
        carried_items = db.query(_ASItem).filter(
            _ASItem.added_to_order_id == order.id,
            _ASItem.carry_forward_status == CarryForwardStatus.ADDED_TO_ORDER.value,
        ).all()
        for ci in carried_items:
            ci.carry_forward_status = CarryForwardStatus.FULFILLED.value

        # Auto-fulfill unloaded items carried into this order
        from models import UnloadedItem as _UIItem
        unloaded_carried = db.query(_UIItem).filter(
            _UIItem.added_to_order_id == order.id,
            _UIItem.status == "ADDED_TO_ORDER",
        ).all()
        for ui in unloaded_carried:
            ui.status = "SHIPPED"

    # Audit
    log_audit_event(
        db, user, "ORDER_STAGE_CHANGE", "order", order.id,
        old_values={"status": current_status, "version": order.version - 1},
        new_values={"status": target_status, "version": order.version},
        metadata={"reason": transition_reason.strip() if transition_reason else None},
    )

    db.commit()
    return {"order": order, "warnings": warnings}


def execute_go_back(
    db: Session,
    order: Order,
    user: CurrentUser,
    reason: Optional[str] = None,
) -> Order:
    """Move order back to its previous status."""
    prev_status = REVERSE_TRANSITIONS.get(order.status)
    if not prev_status:
        raise ValueError(
            f"Cannot go back from {order.status} \u2014 no previous status defined"
        )

    if order.status == OrderStatus.COMPLETED.value:
        order.completed_at = None

    old_status = order.status
    order.status = prev_status

    log_audit_event(
        db, user, "ORDER_GO_BACK", "order", order.id,
        old_values={"status": old_status},
        new_values={"status": prev_status},
        metadata={"reason": reason},
    )

    db.commit()
    return order


def execute_reopen(db: Session, order: Order, reason: str) -> Order:
    """Re-open a completed order for editing."""
    if order.status != OrderStatus.COMPLETED.value:
        raise ValueError("Only COMPLETED orders can be re-opened")
    if not reason.strip():
        raise ValueError("Reason is required to re-open an order")

    order.status = OrderStatus.COMPLETED_EDITING.value
    order.reopen_count += 1
    order.last_reopen_reason = reason.strip()
    order.last_reopened_at = datetime.utcnow()

    db.commit()
    return order


def execute_jump(
    db: Session,
    order: Order,
    target_status: str,
    user: CurrentUser,
    reason: Optional[str] = None,
) -> Order:
    """Jump order directly to a reachable previous or forward stage."""
    reachable_back = get_reachable_previous_stages(order.status)
    reachable_fwd = get_reachable_forward_stages(
        order.status, order.highest_unlocked_stage
    )
    back_statuses = [r["status"] for r in reachable_back]
    fwd_statuses = [r["status"] for r in reachable_fwd]
    all_reachable = back_statuses + fwd_statuses

    if target_status not in all_reachable:
        raise ValueError(
            f"Cannot jump from {order.status} to {target_status}. "
            f"Not in reachable range."
        )

    # Forward jumps run full validation gates
    is_forward = target_status in fwd_statuses
    if is_forward:
        errors, warnings = validate_transition(order, target_status, db)
        if errors:
            raise ValueError({"errors": errors, "warnings": warnings})

    if order.status == OrderStatus.COMPLETED.value:
        order.completed_at = None

    old_status = order.status
    order.status = target_status

    log_audit_event(
        db, user, "ORDER_JUMP_STAGE", "order", order.id,
        old_values={"status": old_status},
        new_values={"status": target_status},
        metadata={
            "reason": reason if reason else "Direct stage navigation"
        },
    )

    db.commit()
    return order
