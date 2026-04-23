"""
Item Query API — per-item chat threads between client and admin.
Supports query types, attachments, and status workflow (OPEN → REPLIED → RESOLVED).
"""
import json
import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import mimetypes

from database import get_db
from models import Order, OrderItem, ItemQuery, ItemQueryMessage, Notification
from core.security import CurrentUser, get_current_user
from rate_limiter import limiter
from schemas.queries import CreateQueryRequest, ReplyQueryRequest, QueryResponse, QueryMessageResponse
from config import UPLOAD_DIR

router = APIRouter()


def _batch_or_create_notification(db: Session, *, user_role: str, client_id: str = None,
                                   title: str, message: str, notification_type: str,
                                   resource_type: str, resource_id: str, meta_json: str):
    """WhatsApp-style notification batching.
    If an unread notification exists for the same resource + type + meta, increment its count
    and update message/timestamp instead of creating a new one."""
    existing_q = db.query(Notification).filter(
        Notification.user_role == user_role,
        Notification.notification_type == notification_type,
        Notification.resource_type == resource_type,
        Notification.resource_id == resource_id,
        Notification.is_read == False,
    )
    if client_id:
        existing_q = existing_q.filter(Notification.client_id == client_id)
    if meta_json:
        existing_q = existing_q.filter(Notification.meta_json == meta_json)

    existing = existing_q.first()
    if existing:
        existing.count = (existing.count or 1) + 1
        existing.message = message
        existing.updated_at = datetime.utcnow()
    else:
        db.add(Notification(
            user_role=user_role,
            client_id=client_id,
            title=title,
            message=message,
            notification_type=notification_type,
            resource_type=resource_type,
            resource_id=resource_id,
            meta_json=meta_json,
        ))


def _serialize_query(q: ItemQuery, db: Session) -> dict:
    """Serialize a query with messages and joined product info."""
    oi = db.query(OrderItem).filter(OrderItem.id == q.order_item_id).first() if q.order_item_id else None
    messages = []
    for m in q.messages:
        att = None
        if m.attachments:
            try:
                att = json.loads(m.attachments)
            except (json.JSONDecodeError, TypeError):
                att = None
        messages.append({
            "id": m.id,
            "query_id": m.query_id,
            "sender_id": m.sender_id,
            "sender_role": m.sender_role,
            "sender_name": m.sender_name,
            "message": m.message,
            "attachments": att,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })

    return {
        "id": q.id,
        "order_id": q.order_id,
        "order_item_id": q.order_item_id,
        "product_id": q.product_id,
        "query_type": q.query_type,
        "status": q.status,
        "subject": q.subject,
        "created_by_id": q.created_by_id,
        "created_by_role": q.created_by_role,
        "created_at": q.created_at.isoformat() if q.created_at else None,
        "updated_at": q.updated_at.isoformat() if q.updated_at else None,
        "resolved_at": q.resolved_at.isoformat() if q.resolved_at else None,
        "resolution_remark": q.resolution_remark,
        "messages": messages,
        "product_code": oi.product_code_snapshot if oi else None,
        "product_name": oi.product_name_snapshot if oi else None,
        "message_count": len(messages),
        "last_message_at": messages[-1]["created_at"] if messages else None,
    }


@router.post("/{order_id}/queries/")
def create_query(
    order_id: str,
    data: CreateQueryRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Create a new query thread with the first message."""
    order = db.query(Order).filter(Order.id == order_id, Order.deleted_at.is_(None)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # RLS: client can only query own orders
    if current_user.user_type == "CLIENT" and order.client_id != current_user.client_id:
        raise HTTPException(status_code=403, detail="Access denied")

    query = ItemQuery(
        order_id=order_id,
        order_item_id=data.order_item_id,
        product_id=data.product_id,
        query_type=data.query_type,
        subject=data.subject,
        created_by_id=current_user.id,
        created_by_role=current_user.user_type,
    )
    db.add(query)
    db.flush()

    msg = ItemQueryMessage(
        query_id=query.id,
        sender_id=current_user.id,
        sender_role=current_user.user_type,
        sender_name=current_user.email,
        message=data.message,
    )
    db.add(msg)

    # Notify opposite role
    meta = json.dumps({"query_id": query.id})
    if current_user.user_type == "CLIENT":
        _batch_or_create_notification(
            db, user_role="ADMIN",
            title=f"{order.order_number} - New Query",
            message=f"Client query: {data.subject}",
            notification_type="ITEM_QUERY_CREATED",
            resource_type="order", resource_id=order_id, meta_json=meta,
        )
    else:
        _batch_or_create_notification(
            db, user_role="CLIENT", client_id=order.client_id,
            title=f"{order.order_number} - New Query from Team",
            message=f"Our team has a question: {data.subject}",
            notification_type="ITEM_QUERY_CREATED",
            resource_type="order", resource_id=order_id, meta_json=meta,
        )

    db.commit()
    return _serialize_query(query, db)


@router.get("/{order_id}/queries/")
def list_queries(
    order_id: str,
    status: Optional[str] = Query(None),
    order_item_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """List queries for an order. Optionally filter by item or status."""
    order = db.query(Order).filter(Order.id == order_id, Order.deleted_at.is_(None)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.user_type == "CLIENT" and order.client_id != current_user.client_id:
        raise HTTPException(status_code=403, detail="Access denied")

    q = db.query(ItemQuery).filter(ItemQuery.order_id == order_id)
    if status:
        q = q.filter(ItemQuery.status == status)
    if order_item_id:
        q = q.filter(ItemQuery.order_item_id == order_item_id)
    queries = q.order_by(ItemQuery.created_at.desc()).all()

    return [_serialize_query(query, db) for query in queries]


@router.get("/{order_id}/queries/summary/")
def get_query_summary(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get query counts by status for tab badge."""
    order = db.query(Order).filter(Order.id == order_id, Order.deleted_at.is_(None)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.user_type == "CLIENT" and order.client_id != current_user.client_id:
        raise HTTPException(status_code=403, detail="Access denied")

    open_count = db.query(ItemQuery).filter(ItemQuery.order_id == order_id, ItemQuery.status == "OPEN").count()
    replied_count = db.query(ItemQuery).filter(ItemQuery.order_id == order_id, ItemQuery.status == "REPLIED").count()
    resolved_count = db.query(ItemQuery).filter(ItemQuery.order_id == order_id, ItemQuery.status == "RESOLVED").count()

    return {
        "open": open_count,
        "replied": replied_count,
        "resolved": resolved_count,
        "total": open_count + replied_count + resolved_count,
    }


@router.get("/{order_id}/queries/{query_id}/")
def get_query(
    order_id: str,
    query_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get a single query with all messages."""
    query = db.query(ItemQuery).filter(
        ItemQuery.id == query_id, ItemQuery.order_id == order_id
    ).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    order = db.query(Order).filter(Order.id == order_id).first()
    if current_user.user_type == "CLIENT" and order.client_id != current_user.client_id:
        raise HTTPException(status_code=403, detail="Access denied")

    return _serialize_query(query, db)


@router.post("/{order_id}/queries/{query_id}/reply/")
def reply_to_query(
    order_id: str,
    query_id: str,
    data: ReplyQueryRequest,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Add a text reply to a query thread."""
    query = db.query(ItemQuery).filter(
        ItemQuery.id == query_id, ItemQuery.order_id == order_id
    ).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    order = db.query(Order).filter(Order.id == order_id).first()
    if current_user.user_type == "CLIENT" and order.client_id != current_user.client_id:
        raise HTTPException(status_code=403, detail="Access denied")

    msg = ItemQueryMessage(
        query_id=query.id,
        sender_id=current_user.id,
        sender_role=current_user.user_type,
        sender_name=current_user.email,
        message=data.message,
    )
    db.add(msg)

    # Auto-update status
    if current_user.user_type != query.created_by_role and query.status == "OPEN":
        query.status = "REPLIED"
    elif current_user.user_type == query.created_by_role and query.status == "REPLIED":
        query.status = "OPEN"  # Follow-up reopens
    query.updated_at = datetime.utcnow()

    # Notify opposite role (batched)
    meta = json.dumps({"query_id": query.id})
    if current_user.user_type == "CLIENT":
        _batch_or_create_notification(
            db, user_role="ADMIN",
            title=f"{order.order_number} - Query Reply",
            message=f"Client replied: {query.subject}",
            notification_type="ITEM_QUERY_REPLY",
            resource_type="order", resource_id=order_id, meta_json=meta,
        )
    else:
        _batch_or_create_notification(
            db, user_role="CLIENT", client_id=order.client_id,
            title=f"{order.order_number} - Query Reply",
            message=f"Our team replied: {query.subject}",
            notification_type="ITEM_QUERY_REPLY",
            resource_type="order", resource_id=order_id, meta_json=meta,
        )

    db.commit()
    return _serialize_query(query, db)


@router.post("/{order_id}/queries/{query_id}/reply/upload/")
@limiter.limit("20/hour")
async def reply_with_attachment(
    request: Request,
    order_id: str,
    query_id: str,
    message: str = "",
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Reply with a file attachment (image, video, PDF)."""
    query = db.query(ItemQuery).filter(
        ItemQuery.id == query_id, ItemQuery.order_id == order_id
    ).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    order = db.query(Order).filter(Order.id == order_id).first()
    if current_user.user_type == "CLIENT" and order.client_id != current_user.client_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Validate file type + save with size limit
    from core.file_upload import validate_file_type, stream_upload_to_disk, ALLOWED_ALL_EXTENSIONS
    from pathlib import Path as _Path
    ext = validate_file_type(file.filename, ALLOWED_ALL_EXTENSIONS)
    upload_dir = os.path.join(str(UPLOAD_DIR), "orders", order_id, "queries", query_id)
    os.makedirs(upload_dir, exist_ok=True)
    filename = f"att_{uuid.uuid4().hex[:8]}{ext}"
    filepath = _Path(os.path.join(upload_dir, filename))
    await stream_upload_to_disk(file, filepath, max_size=50 * 1024 * 1024)  # 50MB max

    relative_path = f"orders/{order_id}/queries/{query_id}/{filename}"

    msg = ItemQueryMessage(
        query_id=query.id,
        sender_id=current_user.id,
        sender_role=current_user.user_type,
        sender_name=current_user.email,
        message=message or f"Attached: {file.filename}",
        attachments=json.dumps([relative_path]),
    )
    db.add(msg)

    # Auto-update status
    if current_user.user_type != query.created_by_role and query.status == "OPEN":
        query.status = "REPLIED"
    query.updated_at = datetime.utcnow()

    # Notify (batched)
    meta = json.dumps({"query_id": query.id})
    if current_user.user_type == "CLIENT":
        _batch_or_create_notification(
            db, user_role="ADMIN",
            title=f"{order.order_number} - Query Attachment",
            message=f"Client attached a file: {query.subject}",
            notification_type="ITEM_QUERY_REPLY",
            resource_type="order", resource_id=order_id, meta_json=meta,
        )
    else:
        _batch_or_create_notification(
            db, user_role="CLIENT", client_id=order.client_id,
            title=f"{order.order_number} - Query Attachment",
            message=f"Our team attached a file: {query.subject}",
            notification_type="ITEM_QUERY_REPLY",
            resource_type="order", resource_id=order_id, meta_json=meta,
        )

    db.commit()
    return _serialize_query(query, db)


@router.put("/{order_id}/queries/{query_id}/resolve/")
def resolve_query(
    order_id: str,
    query_id: str,
    remark: str = Query("", description="Resolution conclusion remark"),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Mark a query as resolved with a conclusion remark. Only admin/factory can resolve."""
    if current_user.user_type == "CLIENT":
        raise HTTPException(status_code=403, detail="Only admin or factory can resolve queries")

    query = db.query(ItemQuery).filter(
        ItemQuery.id == query_id, ItemQuery.order_id == order_id
    ).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    query.status = "RESOLVED"
    query.resolution_remark = remark or None
    query.resolved_at = datetime.utcnow()
    query.updated_at = datetime.utcnow()
    db.commit()

    return _serialize_query(query, db)


@router.put("/{order_id}/queries/{query_id}/reopen/")
def reopen_query(
    order_id: str,
    query_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Reopen a resolved query."""
    query = db.query(ItemQuery).filter(
        ItemQuery.id == query_id, ItemQuery.order_id == order_id
    ).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    order = db.query(Order).filter(Order.id == order_id).first()
    if current_user.user_type == "CLIENT" and order.client_id != current_user.client_id:
        raise HTTPException(status_code=403, detail="Access denied")

    query.status = "OPEN"
    query.resolved_at = None
    query.updated_at = datetime.utcnow()
    db.commit()
    return _serialize_query(query, db)


@router.delete("/{order_id}/queries/{query_id}/")
def delete_query(
    order_id: str,
    query_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Delete a query and all its messages. Only the creator or admin can delete."""
    query = db.query(ItemQuery).filter(
        ItemQuery.id == query_id, ItemQuery.order_id == order_id
    ).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    order = db.query(Order).filter(Order.id == order_id).first()
    if current_user.user_type == "CLIENT" and order.client_id != current_user.client_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Only creator or admin can delete
    if current_user.user_type == "CLIENT" and query.created_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the query creator can delete it")

    # Delete messages first
    db.query(ItemQueryMessage).filter(ItemQueryMessage.query_id == query_id).delete()
    db.delete(query)
    db.commit()
    return {"deleted": True, "id": query_id}


@router.post("/{order_id}/queries/inline/")
def inline_query(
    order_id: str,
    order_item_id: str,
    message: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Quick inline query — creates or appends to the latest open query for this item.
    Like typing into the Excel query column."""
    order = db.query(Order).filter(Order.id == order_id, Order.deleted_at.is_(None)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.user_type == "CLIENT" and order.client_id != current_user.client_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Find existing open query for this item
    existing = db.query(ItemQuery).filter(
        ItemQuery.order_id == order_id,
        ItemQuery.order_item_id == order_item_id,
        ItemQuery.status.in_(["OPEN", "REPLIED"]),
    ).order_by(ItemQuery.created_at.desc()).first()

    if existing:
        # Append reply to existing thread
        msg = ItemQueryMessage(
            query_id=existing.id,
            sender_id=current_user.id,
            sender_role=current_user.user_type,
            sender_name=current_user.email,
            message=message,
        )
        db.add(msg)
        # Auto-update status
        if current_user.user_type != existing.created_by_role and existing.status == "OPEN":
            existing.status = "REPLIED"
        elif current_user.user_type == existing.created_by_role and existing.status == "REPLIED":
            existing.status = "OPEN"
        existing.updated_at = datetime.utcnow()

        # Batched notification
        meta = json.dumps({"query_id": existing.id})
        target_role = "ADMIN" if current_user.user_type == "CLIENT" else "CLIENT"
        _batch_or_create_notification(
            db, user_role=target_role,
            client_id=order.client_id if target_role == "CLIENT" else None,
            title=f"{order.order_number} - Query Reply",
            message=f"{'Client' if current_user.user_type == 'CLIENT' else 'Team'} replied: {existing.subject}",
            notification_type="ITEM_QUERY_REPLY",
            resource_type="order", resource_id=order_id, meta_json=meta,
        )

        db.commit()
        return _serialize_query(existing, db)
    else:
        # Create new query
        oi = db.query(OrderItem).filter(OrderItem.id == order_item_id).first()
        subject = f"Query: {oi.product_code_snapshot}" if oi else "Query"
        query = ItemQuery(
            order_id=order_id,
            order_item_id=order_item_id,
            product_id=oi.product_id if oi else None,
            query_type="GENERAL",
            subject=subject,
            created_by_id=current_user.id,
            created_by_role=current_user.user_type,
        )
        db.add(query)
        db.flush()

        msg = ItemQueryMessage(
            query_id=query.id,
            sender_id=current_user.id,
            sender_role=current_user.user_type,
            sender_name=current_user.email,
            message=message,
        )
        db.add(msg)

        meta = json.dumps({"query_id": query.id})
        target_role = "ADMIN" if current_user.user_type == "CLIENT" else "CLIENT"
        _batch_or_create_notification(
            db, user_role=target_role,
            client_id=order.client_id if target_role == "CLIENT" else None,
            title=f"{order.order_number} - New Query",
            message=f"{'Client' if current_user.user_type == 'CLIENT' else 'Team'}: {message[:100]}",
            notification_type="ITEM_QUERY_CREATED",
            resource_type="order", resource_id=order_id, meta_json=meta,
        )

        db.commit()
        return _serialize_query(query, db)


@router.get("/{order_id}/queries/{query_id}/attachments/{filename}")
def download_query_attachment(
    order_id: str,
    query_id: str,
    filename: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Authenticated download of a query thread attachment (image, video, or file).
    CLIENT users can only access attachments on their own orders.
    """
    # Validate no path traversal in URL parameters
    if ".." in order_id or ".." in query_id:
        raise HTTPException(status_code=400, detail="Invalid path component")

    query = db.query(ItemQuery).filter(
        ItemQuery.id == query_id,
        ItemQuery.order_id == order_id,
    ).first()
    if not query:
        raise HTTPException(status_code=404, detail="Query not found")

    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if current_user.user_type == "CLIENT" and order.client_id != current_user.client_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Sanitize filename to prevent path traversal
    safe_filename = os.path.basename(filename)
    if not safe_filename or safe_filename != filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    full_path = UPLOAD_DIR / "orders" / order_id / "queries" / query_id / safe_filename
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="Attachment not found")

    mime_type = mimetypes.guess_type(str(full_path))[0] or "application/octet-stream"
    return FileResponse(path=str(full_path), filename=safe_filename, media_type=mime_type)


@router.get("/{order_id}/queries/inline-status/")
def get_inline_query_status(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Get per-item query status for the inline column display.
    Returns: { item_id: { status, last_query, last_reply, query_id } }"""
    order = db.query(Order).filter(Order.id == order_id, Order.deleted_at.is_(None)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.user_type == "CLIENT" and order.client_id != current_user.client_id:
        raise HTTPException(status_code=403, detail="Access denied")

    all_queries = db.query(ItemQuery).filter(
        ItemQuery.order_id == order_id,
        ItemQuery.order_item_id.isnot(None),
    ).all()

    result = {}
    for q in all_queries:
        item_id = q.order_item_id
        if item_id not in result or q.status in ("OPEN", "REPLIED"):
            msgs = sorted(q.messages, key=lambda m: m.created_at) if q.messages else []
            # Last query from creator
            last_query_msg = None
            last_reply_msg = None
            for m in reversed(msgs):
                if m.sender_role == q.created_by_role and not last_query_msg:
                    last_query_msg = m.message
                elif m.sender_role != q.created_by_role and not last_reply_msg:
                    last_reply_msg = m.message
                if last_query_msg and last_reply_msg:
                    break

            result[item_id] = {
                "status": q.status,
                "query_id": q.id,
                "last_query": last_query_msg,
                "last_reply": last_reply_msg,
                "message_count": len(msgs),
                "subject": q.subject,
                "query_type": q.query_type,
                "resolution_remark": q.resolution_remark,
            }

    return result
