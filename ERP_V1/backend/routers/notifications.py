"""Notification endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from core.security import CurrentUser, get_current_user

router = APIRouter()


@router.get("/")
def list_notifications(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List notifications for current user."""
    from models import Notification

    q = db.query(Notification).filter(Notification.is_read == False)

    if current_user.role in ("ADMIN", "SUPER_ADMIN", "FINANCE"):
        q = q.filter(
            or_(
                Notification.user_role == "ADMIN",
                Notification.user_id == current_user.id,
            )
        )
    elif current_user.role == "CLIENT":
        q = q.filter(
            or_(
                Notification.user_id == current_user.id,
                Notification.client_id == current_user.client_id,
            ),
            Notification.user_role != "ADMIN",
        )
    else:
        q = q.filter(Notification.user_id == current_user.id)

    notifications = q.order_by(Notification.created_at.desc()).limit(50).all()

    import json as _json
    def _parse_meta(m):
        if not m:
            return None
        try:
            return _json.loads(m)
        except (ValueError, TypeError):
            return None

    return {
        "notifications": [
            {
                "id": n.id,
                "title": n.title,
                "message": n.message,
                "type": n.notification_type,
                "notification_type": n.notification_type,
                "count": n.count,
                "is_read": n.is_read,
                "resource_type": n.resource_type,
                "resource_id": n.resource_id,
                "metadata": _parse_meta(getattr(n, "meta_json", None)),
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notifications
        ],
        "unread_count": len(notifications),
    }


@router.get("/count/")
def unread_count(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get unread notification count."""
    from models import Notification
    from sqlalchemy import func

    q = db.query(func.count(Notification.id)).filter(Notification.is_read == False)

    if current_user.role in ("ADMIN", "SUPER_ADMIN", "FINANCE"):
        q = q.filter(
            or_(
                Notification.user_role == "ADMIN",
                Notification.user_id == current_user.id,
            )
        )
    elif current_user.role == "CLIENT":
        q = q.filter(
            or_(
                Notification.user_id == current_user.id,
                Notification.client_id == current_user.client_id,
            ),
            Notification.user_role != "ADMIN",
        )
    else:
        q = q.filter(Notification.user_id == current_user.id)

    count = q.scalar() or 0
    return {"unread_count": count}


@router.put("/{notification_id}/read/")
def mark_read(
    notification_id: str,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a notification as read."""
    from models import Notification

    notif = db.query(Notification).filter(Notification.id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    db.commit()
    return {"status": "read"}


@router.put("/mark-read-by-resource/")
def mark_read_by_resource(
    resource_type: str,
    resource_id: str,
    notification_type: str = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all notifications for a specific resource as read (e.g. query notifications for an order)."""
    from models import Notification

    q = db.query(Notification).filter(
        Notification.resource_type == resource_type,
        Notification.resource_id == resource_id,
        Notification.is_read == False,
    )
    # Filter by user scope
    if current_user.user_type == "CLIENT":
        q = q.filter(Notification.client_id == current_user.client_id)
    else:
        q = q.filter(Notification.user_role == "ADMIN")
    if notification_type:
        q = q.filter(Notification.notification_type == notification_type)

    count = q.update({"is_read": True})
    db.commit()
    return {"marked_read": count}


@router.put("/read-all/")
def mark_all_read(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all notifications as read for current user."""
    from models import Notification

    q = db.query(Notification).filter(Notification.is_read == False)

    if current_user.role in ("ADMIN", "SUPER_ADMIN", "FINANCE"):
        q = q.filter(
            or_(
                Notification.user_role == "ADMIN",
                Notification.user_id == current_user.id,
            )
        )
    elif current_user.role == "CLIENT":
        q = q.filter(
            or_(
                Notification.user_id == current_user.id,
                Notification.client_id == current_user.client_id,
            ),
            Notification.user_role != "ADMIN",
        )

    count = q.update({"is_read": True}, synchronize_session="fetch")
    db.commit()
    return {"marked_read": count}
