"""Audit Log API — Admin-only, read-only access to the global audit trail."""
import json
from math import ceil
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database import get_db
from models import AuditLog

router = APIRouter()


@router.get("/")
def list_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    resource_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """List audit log entries with pagination and filters. Admin only."""
    q = db.query(AuditLog)

    if action:
        q = q.filter(AuditLog.action == action)
    if resource_type:
        q = q.filter(AuditLog.resource_type == resource_type)
    if resource_id:
        q = q.filter(AuditLog.resource_id == resource_id)
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)

    total = q.count()
    entries = q.order_by(desc(AuditLog.timestamp)).offset((page - 1) * per_page).limit(per_page).all()

    return {
        "items": [
            {
                "id": e.id,
                "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                "user_id": e.user_id,
                "user_email": e.user_email,
                "action": e.action,
                "resource_type": e.resource_type,
                "resource_id": e.resource_id,
                "old_values": json.loads(e.old_values) if e.old_values else None,
                "new_values": json.loads(e.new_values) if e.new_values else None,
                "ip_address": e.ip_address,
                "metadata": json.loads(e.metadata_json) if e.metadata_json else None,
            }
            for e in entries
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": ceil(total / per_page) if per_page else 0,
    }


@router.get("/actions/")
def list_audit_actions(db: Session = Depends(get_db)):
    """Return distinct action types for filter dropdowns."""
    actions = db.query(AuditLog.action).distinct().all()
    return [a[0] for a in actions]


@router.get("/resource-types/")
def list_resource_types(db: Session = Depends(get_db)):
    """Return distinct resource types for filter dropdowns."""
    types = db.query(AuditLog.resource_type).distinct().all()
    return [t[0] for t in types]
