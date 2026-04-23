"""
Document Module API (Level 2C)
Upload/download/list documents per order. Relative file paths, organized by order_id.
"""
import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from models import Document, Order
from config import UPLOAD_DIR, MAX_UPLOAD_SIZE
from core.file_upload import sanitize_filename, stream_upload_to_disk
from core.security import get_current_user, CurrentUser
from rate_limiter import limiter

router = APIRouter()


def _verify_doc_access(order: Order, current_user: CurrentUser):
    """RLS for documents: client/factory can only access own orders."""
    if current_user.user_type == "CLIENT" and order.client_id != current_user.client_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.user_type == "FACTORY" and order.factory_id != getattr(current_user, 'factory_id', None):
        raise HTTPException(status_code=403, detail="Access denied")


# ========================================
# Endpoints
# ========================================

@router.get("/orders/{order_id}/")
def list_documents(order_id: str, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    """List all documents for an order"""
    order = db.query(Order).filter(Order.id == order_id, Order.deleted_at.is_(None)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    _verify_doc_access(order, current_user)

    docs = db.query(Document).filter(Document.order_id == order_id).order_by(
        Document.uploaded_at.desc()
    ).all()

    return [
        {
            "id": d.id,
            "order_id": d.order_id,
            "doc_type": d.doc_type,
            "filename": d.filename,
            "file_size": d.file_size,
            "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
        }
        for d in docs
    ]


@router.post("/orders/{order_id}/")
@limiter.limit("30/hour")
async def upload_document(
    request: Request,
    order_id: str,
    file: UploadFile = File(...),
    document_type: str = Form(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Upload a document for an order"""
    order = db.query(Order).filter(Order.id == order_id, Order.deleted_at.is_(None)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    _verify_doc_access(order, current_user)

    # Build safe destination path
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_filename = f"{timestamp}_{sanitize_filename(file.filename)}"
    file_path = UPLOAD_DIR / "orders" / order_id / safe_filename

    # Stream to disk (shared utility handles chunking + size validation + cleanup)
    file_size = await stream_upload_to_disk(file, file_path, MAX_UPLOAD_SIZE)

    # Store relative path in DB
    relative_path = f"orders/{order_id}/{safe_filename}"

    doc = Document(
        order_id=order_id,
        doc_type=document_type,
        file_path=relative_path,
        filename=file.filename,
        file_size=file_size,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return {
        "id": doc.id,
        "order_id": doc.order_id,
        "doc_type": doc.doc_type,
        "filename": doc.filename,
        "file_size": doc.file_size,
        "uploaded_at": doc.uploaded_at.isoformat(),
    }


@router.get("/{doc_id}/download/")
def download_document(doc_id: str, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    """Download a document by ID"""
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    # RLS check via order
    order = db.query(Order).filter(Order.id == doc.order_id).first()
    if order:
        _verify_doc_access(order, current_user)

    full_path = UPLOAD_DIR / doc.file_path

    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=str(full_path),
        filename=doc.filename,
        media_type="application/octet-stream",
    )


@router.delete("/{doc_id}/")
def delete_document(doc_id: str, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    """Delete a document — admin only"""
    if current_user.role not in ("ADMIN", "SUPER_ADMIN", "OPERATIONS"):
        raise HTTPException(status_code=403, detail="Only admin can delete documents")
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file from disk
    full_path = UPLOAD_DIR / doc.file_path
    if full_path.exists():
        os.remove(full_path)

    # Delete from DB
    db.delete(doc)
    db.commit()
    return {"message": "Document deleted"}
