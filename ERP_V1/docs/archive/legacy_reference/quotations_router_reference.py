"""
HarvestERP — Quotations Router
Proforma Invoice generation with configurable markup engine.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import date, datetime
from database import get_db
from models import ProformaInvoice, Order, OrderItem
from schemas import PICreate, PIOut

router = APIRouter(prefix="/api/quotations", tags=["Quotations"])

_pi_counter = 0

def _next_pi_number(db: Session) -> str:
    global _pi_counter
    count = db.query(func.count(ProformaInvoice.id)).scalar() or 0
    _pi_counter = count + 1
    year = datetime.utcnow().year
    return f"PI-{year}-{_pi_counter:04d}"


@router.get("/", response_model=list[PIOut])
def list_pis(
    order_id: str | None = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    q = db.query(ProformaInvoice)
    if order_id:
        q = q.filter(ProformaInvoice.order_id == order_id)
    return q.order_by(ProformaInvoice.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/{pi_id}", response_model=PIOut)
def get_pi(pi_id: str, db: Session = Depends(get_db)):
    pi = db.query(ProformaInvoice).filter(ProformaInvoice.id == pi_id).first()
    if not pi:
        raise HTTPException(404, "PI not found")
    return pi


@router.post("/", response_model=PIOut, status_code=201)
def create_pi(payload: PICreate, db: Session = Depends(get_db)):
    order = db.query(Order).options(joinedload(Order.items)).filter(Order.id == payload.order_id).first()
    if not order:
        raise HTTPException(400, "Order not found")

    # Calculate totals with markup
    total_cny = sum(item.total_price_cny for item in order.items)
    markup_multiplier = 1 + (payload.markup_value / 100)
    total_inr = total_cny * payload.exchange_rate * markup_multiplier

    pi = ProformaInvoice(
        pi_number=_next_pi_number(db),
        order_id=order.id,
        issue_date=date.today(),
        exchange_rate_locked=payload.exchange_rate,
        total_cny=round(total_cny, 2),
        total_inr=round(total_inr, 2),
        markup_type=payload.markup_type,
        markup_value=payload.markup_value,
        payment_terms=payload.payment_terms,
        delivery_terms=payload.delivery_terms,
        validity_days=payload.validity_days,
        status="DRAFT",
    )
    db.add(pi)

    # Update order with PI info
    order.pi_number = pi.pi_number
    order.pi_date = pi.issue_date
    order.exchange_rate = payload.exchange_rate
    if order.status == "DRAFT":
        order.status = "PENDING_PI"

    db.commit()
    db.refresh(pi)
    return pi


@router.post("/{pi_id}/approve", response_model=PIOut)
def approve_pi(pi_id: str, db: Session = Depends(get_db)):
    pi = db.query(ProformaInvoice).filter(ProformaInvoice.id == pi_id).first()
    if not pi:
        raise HTTPException(404, "PI not found")
    pi.status = "APPROVED"
    pi.approved_at = datetime.utcnow()

    order = db.query(Order).filter(Order.id == pi.order_id).first()
    if order:
        order.status = "ADVANCE_PENDING"
        order.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(pi)
    return pi


@router.post("/{pi_id}/reject", response_model=PIOut)
def reject_pi(pi_id: str, db: Session = Depends(get_db)):
    pi = db.query(ProformaInvoice).filter(ProformaInvoice.id == pi_id).first()
    if not pi:
        raise HTTPException(404, "PI not found")
    pi.status = "REJECTED"
    db.commit()
    db.refresh(pi)
    return pi
