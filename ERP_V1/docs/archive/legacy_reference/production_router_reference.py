"""
HarvestERP — Production Router
Milestone tracking (60/80/90/100%), delay detection.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date, timedelta
from database import get_db
from models import ProductionMilestone, Order
from schemas import MilestoneCreate, MilestoneUpdate, MilestoneOut

router = APIRouter(prefix="/api/production", tags=["Production"])


@router.get("/milestones", response_model=list[MilestoneOut])
def list_milestones(
    order_id: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    q = db.query(ProductionMilestone)
    if order_id:
        q = q.filter(ProductionMilestone.order_id == order_id)
    return q.order_by(
        ProductionMilestone.order_id,
        ProductionMilestone.milestone_percent,
    ).offset(skip).limit(limit).all()


@router.get("/milestones/{milestone_id}", response_model=MilestoneOut)
def get_milestone(milestone_id: str, db: Session = Depends(get_db)):
    m = db.query(ProductionMilestone).filter(ProductionMilestone.id == milestone_id).first()
    if not m:
        raise HTTPException(404, "Milestone not found")
    return m


@router.post("/milestones", response_model=MilestoneOut, status_code=201)
def create_milestone(payload: MilestoneCreate, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.id == payload.order_id).first()
    if not order:
        raise HTTPException(400, "Order not found")
    if payload.milestone_percent not in (60, 80, 90, 100):
        raise HTTPException(400, "Milestone must be 60, 80, 90, or 100")

    existing = db.query(ProductionMilestone).filter(
        ProductionMilestone.order_id == payload.order_id,
        ProductionMilestone.milestone_percent == payload.milestone_percent,
    ).first()
    if existing:
        raise HTTPException(400, "Milestone already exists for this order")

    m = ProductionMilestone(
        order_id=payload.order_id,
        milestone_percent=payload.milestone_percent,
        expected_date=payload.expected_date,
        actual_date=payload.actual_date,
        notes=payload.notes,
        delay_reason=payload.delay_reason,
    )
    db.add(m)

    # Update order status based on milestone
    status_map = {60: "PRODUCTION_60", 80: "PRODUCTION_80", 90: "PRODUCTION_90", 100: "PRODUCTION_100"}
    if payload.actual_date and payload.milestone_percent in status_map:
        order.status = status_map[payload.milestone_percent]

    db.commit()
    db.refresh(m)
    return m


@router.patch("/milestones/{milestone_id}", response_model=MilestoneOut)
def update_milestone(milestone_id: str, payload: MilestoneUpdate, db: Session = Depends(get_db)):
    m = db.query(ProductionMilestone).filter(ProductionMilestone.id == milestone_id).first()
    if not m:
        raise HTTPException(404, "Milestone not found")

    if payload.actual_date is not None:
        m.actual_date = payload.actual_date
    if payload.notes is not None:
        m.notes = payload.notes
    if payload.delay_reason is not None:
        m.delay_reason = payload.delay_reason

    db.commit()
    db.refresh(m)
    return m


@router.get("/delays")
def get_delayed_milestones(db: Session = Depends(get_db)):
    """Return milestones that are > 3 days past expected date with no actual date."""
    threshold = date.today() - timedelta(days=3)
    delayed = db.query(ProductionMilestone).filter(
        ProductionMilestone.expected_date < threshold,
        ProductionMilestone.actual_date.is_(None),
    ).all()
    return [MilestoneOut.model_validate(m) for m in delayed]
