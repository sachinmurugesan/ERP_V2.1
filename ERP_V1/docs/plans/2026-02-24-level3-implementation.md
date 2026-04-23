# Level 3: Excel Processing & PI Generation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build file upload infrastructure with background processing, then client/factory Excel parsers, pricing engine, and PI generation.

**Architecture:** Stream large Excel files (up to 500MB) to disk without loading into memory. Process in FastAPI BackgroundTasks with progress tracking via polling. Parse rows with openpyxl (read_only mode for speed), extract images with Pillow, save to product gallery.

**Tech Stack:** FastAPI BackgroundTasks, openpyxl 3.1.5, Pillow 11.1.0, SQLite WAL mode for concurrent reads during background writes.

---

## Task 1: Backend Infrastructure — Enums, Model, Config

**Files:**
- Modify: `backend/enums.py` (add JobType, JobStatus, ApprovalStatus)
- Modify: `backend/models.py` (add ProcessingJob, ProductImage, ClientProductBarcode; add approval_status to Product)
- Modify: `backend/config.py` (increase upload limit, add image settings)
- Modify: `backend/main.py` (register excel router, serve product images)

**Step 1: Add new enums to `backend/enums.py`**

Append after `PIItemStatus` class (line 163):

```python
class JobType(str, enum.Enum):
    CLIENT_EXCEL = "CLIENT_EXCEL"
    FACTORY_EXCEL = "FACTORY_EXCEL"
    PI_GENERATION = "PI_GENERATION"


class JobStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ApprovalStatus(str, enum.Enum):
    APPROVED = "APPROVED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    REJECTED = "REJECTED"
```

**Step 2: Add new models to `backend/models.py`**

Add import for new enums at top (line 17-21 area):
```python
from enums import (
    OrderStatus, Currency, PaymentMethod, PaymentType, ContainerType,
    SailingPhase, CustomsMilestoneType, ShippingDocType, CustomsDocType,
    VerificationStatus, ObjectionType, AfterSalesStatus, ResolutionType,
    UnloadedItemStatus, WarehouseStockStatus, OrderItemStatus, PIItemStatus,
    JobType, JobStatus, ApprovalStatus
)
```

Add `approval_status` field to Product model (after `is_active` field, ~line 55):
```python
    approval_status: Mapped[str] = mapped_column(String(20), default=ApprovalStatus.APPROVED.value)
```

Append these new models at end of file (after last model):

```python
class ProcessingJob(Base):
    """Background job tracking for Excel processing"""
    __tablename__ = "processing_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("orders.id"), nullable=True)
    job_type: Mapped[str] = mapped_column(String(30))  # CLIENT_EXCEL, FACTORY_EXCEL, PI_GENERATION
    file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    original_filename: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=JobStatus.PENDING.value)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    total_rows: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    processed_rows: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    result_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string
    result_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    order: Mapped[Optional["Order"]] = relationship()


class ProductImage(Base):
    """Product image gallery — images extracted from factory Excel responses"""
    __tablename__ = "product_images"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), index=True)
    image_path: Mapped[str] = mapped_column(String(500))
    source_type: Mapped[str] = mapped_column(String(30), default="FACTORY_EXCEL")
    source_order_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("orders.id"), nullable=True)
    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    product: Mapped["Product"] = relationship()


class ClientProductBarcode(Base):
    """Client-specific barcode mapping for products"""
    __tablename__ = "client_product_barcodes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    client_id: Mapped[str] = mapped_column(String(36), ForeignKey("clients.id"), index=True)
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), index=True)
    barcode_code: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Unique constraint: one barcode per client
    __table_args__ = (
        Index('ix_client_barcode', 'client_id', 'barcode_code', unique=True),
    )

    # Relationships
    client: Mapped["Client"] = relationship()
    product: Mapped["Product"] = relationship()
```

**Step 3: Update `backend/config.py`**

Replace MAX_UPLOAD_SIZE and add new settings:
```python
# Max file upload size (600MB for large Excel files with images)
MAX_UPLOAD_SIZE = 600 * 1024 * 1024

# Image processing settings
MAX_IMAGE_DIMENSION = 1200  # Max width/height for extracted images
IMAGE_QUALITY = 85  # JPEG quality (1-100)
UPLOAD_CHUNK_SIZE = 1024 * 1024  # 1MB chunks for streaming upload
```

Also add product images directory creation:
```python
(UPLOAD_DIR / "products").mkdir(exist_ok=True)
```
(This line already exists, so just confirm it's there)

**Step 4: Update `backend/main.py`**

Add excel router import and registration. After line 40:
```python
from routers import dashboard, products, factories, clients, settings, orders, documents, excel
```

After line 48 (documents router):
```python
app.include_router(excel.router, prefix="/api/excel", tags=["Excel Processing"])
```

**Step 5: Run DB migration**

```bash
cd "C:\Users\sachi\OneDrive\antigravity\Workflow\backend"
python -X utf8 -c "
from database import engine, Base
from models import ProcessingJob, ProductImage, ClientProductBarcode
from sqlalchemy import text, inspect

# Create new tables
Base.metadata.create_all(bind=engine)

# Add approval_status to products if missing
with engine.connect() as conn:
    cols = [c['name'] for c in inspect(engine).get_columns('products')]
    if 'approval_status' not in cols:
        conn.execute(text('ALTER TABLE products ADD COLUMN approval_status VARCHAR(20) DEFAULT \"APPROVED\"'))
        conn.commit()
        print('Added approval_status to products')
    print('Tables created:', inspect(engine).get_table_names())
"
```

Expected output: Tables listed including processing_jobs, product_images, client_product_barcodes.

---

## Task 2: Excel Router — Upload Endpoint with Streaming

**Files:**
- Create: `backend/routers/excel.py`

**Step 1: Create `backend/routers/excel.py` with streaming upload**

```python
"""
Excel Upload & Processing API (Level 3)
Handles large file uploads (up to 500MB) with background processing.
"""
import os
import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database import get_db, SessionLocal
from models import ProcessingJob, Order, Product, OrderItem, ClientProductBarcode, ProductImage
from enums import JobStatus, JobType, OrderStatus, ApprovalStatus, OrderItemStatus
from config import UPLOAD_DIR, MAX_UPLOAD_SIZE, UPLOAD_CHUNK_SIZE

router = APIRouter()


# ========================================
# Pydantic Schemas
# ========================================
class JobOut(BaseModel):
    id: str
    order_id: Optional[str] = None
    job_type: str
    file_path: Optional[str] = None
    original_filename: Optional[str] = None
    file_size: Optional[int] = None
    status: str
    progress: int
    total_rows: Optional[int] = None
    processed_rows: Optional[int] = None
    result_summary: Optional[dict] = None
    result_data: Optional[list] = None
    error_message: Optional[str] = None
    created_at: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

    class Config:
        from_attributes = True


def serialize_job(job: ProcessingJob) -> dict:
    """Convert job to dict, parsing JSON fields"""
    data = JobOut(
        id=job.id,
        order_id=job.order_id,
        job_type=job.job_type,
        original_filename=job.original_filename,
        file_size=job.file_size,
        status=job.status,
        progress=job.progress,
        total_rows=job.total_rows,
        processed_rows=job.processed_rows,
        result_summary=json.loads(job.result_summary) if job.result_summary else None,
        result_data=json.loads(job.result_data) if job.result_data else None,
        error_message=job.error_message,
        created_at=job.created_at.isoformat() if job.created_at else None,
        started_at=job.started_at.isoformat() if job.started_at else None,
        completed_at=job.completed_at.isoformat() if job.completed_at else None,
    ).model_dump()
    return data


# ========================================
# Upload Endpoint — Streams to Disk
# ========================================
@router.post("/upload/")
async def upload_excel(
    file: UploadFile = File(...),
    order_id: Optional[str] = Query(None),
    job_type: str = Query("CLIENT_EXCEL"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
):
    """Upload an Excel file. Streams to disk in chunks (not memory).
    Returns job_id immediately. Processing happens in background."""

    # Validate file extension
    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only .xlsx and .xls files are accepted")

    # Validate job_type
    if job_type not in [jt.value for jt in JobType]:
        raise HTTPException(status_code=400, detail=f"Invalid job_type. Use: {[jt.value for jt in JobType]}")

    # Validate order exists if order_id provided
    if order_id:
        order = db.query(Order).filter(Order.id == order_id, Order.deleted_at.is_(None)).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

    # Stream file to disk in chunks
    import uuid
    temp_filename = f"{uuid.uuid4()}.xlsx"
    temp_path = UPLOAD_DIR / "temp" / temp_filename
    file_size = 0

    try:
        with open(temp_path, "wb") as f:
            while True:
                chunk = await file.read(UPLOAD_CHUNK_SIZE)
                if not chunk:
                    break
                file_size += len(chunk)
                if file_size > MAX_UPLOAD_SIZE:
                    # Clean up and reject
                    f.close()
                    os.remove(temp_path)
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large. Max size: {MAX_UPLOAD_SIZE // (1024*1024)}MB"
                    )
                f.write(chunk)
    except HTTPException:
        raise
    except Exception as e:
        if temp_path.exists():
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

    # Create processing job
    job = ProcessingJob(
        order_id=order_id,
        job_type=job_type,
        file_path=str(temp_path),
        original_filename=file.filename,
        file_size=file_size,
        status=JobStatus.PENDING.value,
        progress=0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Start background processing
    background_tasks.add_task(process_excel_job, job.id)

    return serialize_job(job)


# ========================================
# Job Status Endpoint — For Polling
# ========================================
@router.get("/jobs/{job_id}/")
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    """Get current status of a processing job. Frontend polls this every 2 seconds."""
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return serialize_job(job)


@router.get("/jobs/")
def list_jobs(
    order_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List processing jobs with optional filters"""
    query = db.query(ProcessingJob)
    if order_id:
        query = query.filter(ProcessingJob.order_id == order_id)
    if status:
        query = query.filter(ProcessingJob.status == status)

    total = query.count()
    jobs = query.order_by(desc(ProcessingJob.created_at)).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    return {
        "items": [serialize_job(j) for j in jobs],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.delete("/jobs/{job_id}/")
def cancel_job(job_id: str, db: Session = Depends(get_db)):
    """Cancel a pending/processing job and clean up temp file"""
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Clean up temp file
    if job.file_path and os.path.exists(job.file_path):
        os.remove(job.file_path)

    db.delete(job)
    db.commit()
    return {"message": "Job cancelled and file deleted"}


# ========================================
# Background Processing Function
# ========================================
def process_excel_job(job_id: str):
    """Background task: Process uploaded Excel file.
    Runs in a thread pool via FastAPI BackgroundTasks.
    Uses its own DB session (not the request session)."""

    db = SessionLocal()
    try:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        if not job:
            return

        job.status = JobStatus.PROCESSING.value
        job.started_at = datetime.utcnow()
        db.commit()

        if job.job_type == JobType.CLIENT_EXCEL.value:
            _process_client_excel(job, db)
        elif job.job_type == JobType.FACTORY_EXCEL.value:
            _process_factory_excel(job, db)
        else:
            job.status = JobStatus.FAILED.value
            job.error_message = f"Unknown job type: {job.job_type}"
            db.commit()

    except Exception as e:
        job.status = JobStatus.FAILED.value
        job.error_message = str(e)
        job.completed_at = datetime.utcnow()
        db.commit()
    finally:
        db.close()


def _process_client_excel(job: ProcessingJob, db: Session):
    """Parse client request Excel: Col A=barcode, Col B=manufacturer_code, Col C=quantity"""
    import openpyxl

    wb = openpyxl.load_workbook(job.file_path, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(min_row=2, values_only=True))
    wb.close()

    total = len(rows)
    job.total_rows = total
    db.commit()

    results = []
    summary = {"matched": 0, "new_products": 0, "duplicates": 0, "ambiguous": 0, "errors": 0}

    # Track codes seen in this file for duplicate detection
    seen_codes = {}

    for i, row in enumerate(rows):
        if len(row) < 3:
            continue

        barcode = str(row[0] or "").strip()
        mfr_code = str(row[1] or "").strip()
        qty_raw = row[2]
        try:
            qty = int(float(qty_raw)) if qty_raw else 0
        except (ValueError, TypeError):
            qty = 0

        if not mfr_code and not barcode:
            continue

        # Match by manufacturer code (primary)
        match_status = "MATCHED"
        product_id = None
        product_name = None

        products_by_code = db.query(Product).filter(
            Product.product_code == mfr_code,
            Product.is_active == True,
            Product.deleted_at.is_(None),
        ).all()

        if len(products_by_code) == 1:
            match_status = "MATCHED"
            product_id = products_by_code[0].id
            product_name = products_by_code[0].product_name
            summary["matched"] += 1
        elif len(products_by_code) > 1:
            match_status = "AMBIGUOUS"
            summary["ambiguous"] += 1
        else:
            # Try barcode lookup via client_product_barcodes
            if barcode and job.order_id:
                order = db.query(Order).filter(Order.id == job.order_id).first()
                if order and order.client_id:
                    barcode_map = db.query(ClientProductBarcode).filter(
                        ClientProductBarcode.client_id == order.client_id,
                        ClientProductBarcode.barcode_code == barcode,
                    ).first()
                    if barcode_map:
                        match_status = "MATCHED"
                        product_id = barcode_map.product_id
                        p = db.query(Product).filter(Product.id == product_id).first()
                        product_name = p.product_name if p else None
                        summary["matched"] += 1

            if match_status != "MATCHED":
                match_status = "NEW_PRODUCT"
                summary["new_products"] += 1

        # Check for duplicates in this file
        code_key = mfr_code or barcode
        if code_key in seen_codes:
            match_status = "DUPLICATE"
            summary["duplicates"] += 1
            # Also reference the first occurrence
            first_idx = seen_codes[code_key]
            if results[first_idx]["match_status"] != "DUPLICATE":
                results[first_idx]["match_status"] = "DUPLICATE"
        seen_codes[code_key] = i

        results.append({
            "row": i + 2,
            "barcode": barcode,
            "manufacturer_code": mfr_code,
            "quantity": qty,
            "match_status": match_status,
            "product_id": product_id,
            "product_name": product_name,
        })

        # Update progress every 5 rows
        if i % 5 == 0 or i == total - 1:
            job.processed_rows = i + 1
            job.progress = min(int((i + 1) / max(total, 1) * 100), 100)
            db.commit()

    job.status = JobStatus.COMPLETED.value
    job.progress = 100
    job.processed_rows = total
    job.result_summary = json.dumps(summary)
    job.result_data = json.dumps(results)
    job.completed_at = datetime.utcnow()
    db.commit()


def _process_factory_excel(job: ProcessingJob, db: Session):
    """Parse factory response Excel: 9 columns + images.
    Two passes: 1) read_only for row data, 2) full load for images."""
    import openpyxl
    from PIL import Image as PILImage
    import io
    import uuid as uuid_mod

    # PASS 1: Read row data (read_only mode for speed)
    wb = openpyxl.load_workbook(job.file_path, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(min_row=2, values_only=True))
    wb.close()

    total = len(rows)
    job.total_rows = total
    db.commit()

    results = []
    summary = {"matched": 0, "new_products": 0, "no_price": 0, "images_extracted": 0, "errors": 0}

    # Parse row data
    for i, row in enumerate(rows):
        if len(row) < 7:
            continue

        sl = row[0]
        description = str(row[1] or "").strip()
        barcode = str(row[2] or "").strip()
        mfr_code = str(row[3] or "").strip()
        chinese_name = str(row[4] or "").strip() if len(row) > 4 else ""
        # row[5] is picture column (images extracted separately)
        qty_raw = row[6] if len(row) > 6 else None
        price_raw = row[7] if len(row) > 7 else None

        try:
            qty = int(float(qty_raw)) if qty_raw else 0
        except (ValueError, TypeError):
            qty = 0

        try:
            factory_price = float(price_raw) if price_raw else None
        except (ValueError, TypeError):
            factory_price = None

        if not mfr_code and not barcode:
            continue

        # Match product
        match_status = "MATCHED"
        product_id = None
        product_name = None

        products_by_code = db.query(Product).filter(
            Product.product_code == mfr_code,
            Product.is_active == True,
            Product.deleted_at.is_(None),
        ).all()

        if len(products_by_code) == 1:
            product_id = products_by_code[0].id
            product_name = products_by_code[0].product_name
            summary["matched"] += 1
            # Update Chinese name if missing
            if chinese_name and not products_by_code[0].product_name_chinese:
                products_by_code[0].product_name_chinese = chinese_name
                db.commit()
        elif len(products_by_code) > 1:
            match_status = "AMBIGUOUS"
        else:
            match_status = "NEW_PRODUCT"
            summary["new_products"] += 1

        if factory_price is None:
            summary["no_price"] += 1

        results.append({
            "row": i + 2,
            "sl": sl,
            "description": description,
            "barcode": barcode,
            "manufacturer_code": mfr_code,
            "chinese_name": chinese_name,
            "quantity": qty,
            "factory_price_usd": factory_price,
            "match_status": match_status,
            "product_id": product_id,
            "product_name": product_name,
            "has_image": False,  # updated in pass 2
        })

        if i % 5 == 0:
            job.processed_rows = i + 1
            job.progress = min(int((i + 1) / max(total, 1) * 50), 50)  # 0-50% for rows
            db.commit()

    # PASS 2: Extract images (full load — needed for _images access)
    job.progress = 50
    db.commit()

    try:
        wb_full = openpyxl.load_workbook(job.file_path)
        ws_full = wb_full.active

        if ws_full._images:
            total_images = len(ws_full._images)
            for img_idx, img in enumerate(ws_full._images):
                try:
                    anchor_row = img.anchor._from.row  # 0-based
                    anchor_col = img.anchor._from.col

                    # Find which result row this image belongs to
                    data_row_idx = anchor_row - 1  # results are 0-based, anchor row 1 = header
                    if 0 <= data_row_idx < len(results):
                        result_row = results[data_row_idx]
                        result_row["has_image"] = True

                        # Only save if product was matched
                        if result_row.get("product_id"):
                            pid = result_row["product_id"]

                            # Create product image directory
                            img_dir = UPLOAD_DIR / "products" / pid
                            img_dir.mkdir(parents=True, exist_ok=True)

                            # Extract and resize image
                            image_data = img._data()
                            pil_img = PILImage.open(io.BytesIO(image_data))

                            # Resize if too large
                            from config import MAX_IMAGE_DIMENSION, IMAGE_QUALITY
                            if max(pil_img.size) > MAX_IMAGE_DIMENSION:
                                pil_img.thumbnail(
                                    (MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION),
                                    PILImage.LANCZOS
                                )

                            # Convert to RGB if needed (for JPEG)
                            if pil_img.mode in ('RGBA', 'P', 'LA'):
                                pil_img = pil_img.convert('RGB')

                            # Save
                            img_filename = f"img_{uuid_mod.uuid4().hex[:8]}.jpg"
                            img_path = img_dir / img_filename
                            pil_img.save(str(img_path), "JPEG", quality=IMAGE_QUALITY)

                            # Save to DB
                            rel_path = f"products/{pid}/{img_filename}"
                            file_size = os.path.getsize(str(img_path))
                            w, h = pil_img.size

                            db_img = ProductImage(
                                product_id=pid,
                                image_path=rel_path,
                                source_type="FACTORY_EXCEL",
                                source_order_id=job.order_id,
                                width=w,
                                height=h,
                                file_size=file_size,
                                is_primary=False,
                            )
                            db.add(db_img)
                            summary["images_extracted"] += 1

                except Exception as img_err:
                    summary["errors"] += 1
                    continue

                # Update progress (50-100% for images)
                if img_idx % 3 == 0:
                    job.progress = 50 + min(int((img_idx + 1) / max(total_images, 1) * 50), 50)
                    db.commit()

        wb_full.close()
    except Exception as img_pass_err:
        # Image extraction failure is non-fatal — row data is still valid
        summary["errors"] += 1

    db.commit()

    job.status = JobStatus.COMPLETED.value
    job.progress = 100
    job.processed_rows = total
    job.result_summary = json.dumps(summary)
    job.result_data = json.dumps(results)
    job.completed_at = datetime.utcnow()
    db.commit()


# ========================================
# Apply Parsed Data to Order
# ========================================
class ApplyParsedDataRequest(BaseModel):
    job_id: str
    create_new_products: bool = True  # auto-create NEW_PRODUCT items as PENDING_APPROVAL


@router.post("/apply/{job_id}/")
def apply_parsed_data(
    job_id: str,
    data: ApplyParsedDataRequest,
    db: Session = Depends(get_db),
):
    """Apply parsed Excel results to an order — creates order items, new products, barcode mappings"""
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != JobStatus.COMPLETED.value:
        raise HTTPException(status_code=400, detail="Job not completed yet")
    if not job.order_id:
        raise HTTPException(status_code=400, detail="Job has no order_id")
    if not job.result_data:
        raise HTTPException(status_code=400, detail="Job has no result data")

    order = db.query(Order).filter(Order.id == job.order_id, Order.deleted_at.is_(None)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    results = json.loads(job.result_data)
    applied = {"items_added": 0, "items_updated": 0, "products_created": 0, "barcodes_saved": 0, "skipped": 0}

    for row_data in results:
        mfr_code = row_data.get("manufacturer_code", "")
        barcode = row_data.get("barcode", "")
        qty = row_data.get("quantity", 0)
        product_id = row_data.get("product_id")
        match_status = row_data.get("match_status", "")
        description = row_data.get("description", "")
        factory_price = row_data.get("factory_price_usd")

        # Skip ambiguous/duplicate — admin must resolve manually
        if match_status in ("AMBIGUOUS", "DUPLICATE"):
            applied["skipped"] += 1
            continue

        # Create new product if needed
        if match_status == "NEW_PRODUCT" and data.create_new_products:
            new_product = Product(
                product_code=mfr_code,
                product_name=description or mfr_code,
                approval_status=ApprovalStatus.PENDING_APPROVAL.value,
            )
            db.add(new_product)
            db.flush()
            product_id = new_product.id
            applied["products_created"] += 1

        if not product_id:
            applied["skipped"] += 1
            continue

        # Save barcode mapping if we have one
        if barcode and order.client_id:
            existing_barcode = db.query(ClientProductBarcode).filter(
                ClientProductBarcode.client_id == order.client_id,
                ClientProductBarcode.barcode_code == barcode,
            ).first()
            if not existing_barcode:
                db.add(ClientProductBarcode(
                    client_id=order.client_id,
                    product_id=product_id,
                    barcode_code=barcode,
                ))
                applied["barcodes_saved"] += 1

        # Check if item already in order
        existing_item = db.query(OrderItem).filter(
            OrderItem.order_id == order.id,
            OrderItem.product_id == product_id,
            OrderItem.status == OrderItemStatus.ACTIVE.value,
        ).first()

        if existing_item:
            # Update quantity and factory price
            if qty > 0:
                existing_item.quantity = qty
            if factory_price is not None:
                existing_item.factory_price_cny = factory_price  # Note: field name is _cny but stores USD too
            applied["items_updated"] += 1
        else:
            # Add new item
            new_item = OrderItem(
                order_id=order.id,
                product_id=product_id,
                quantity=qty if qty > 0 else 1,
            )
            if factory_price is not None:
                new_item.factory_price_cny = factory_price
            db.add(new_item)
            applied["items_added"] += 1

    db.commit()
    return applied
```

**Step 2: Verify syntax**

```bash
cd "C:\Users\sachi\OneDrive\antigravity\Workflow\backend"
python -X utf8 -c "import routers.excel; print('Excel router loaded OK')"
```

---

## Task 3: Vite Config + Frontend API + Upload Route

**Files:**
- Modify: `frontend/vite.config.js` (increase proxy timeout)
- Modify: `frontend/src/api/index.js` (add excel API endpoints)
- Modify: `frontend/src/router/index.js` (add upload route)

**Step 1: Update `frontend/vite.config.js`**

Add timeout to proxy config:
```javascript
proxy: {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
    timeout: 600000,  // 10 minutes for large Excel uploads
  },
  '/uploads': {
    target: 'http://localhost:8000',
    changeOrigin: true,
  }
}
```

**Step 2: Add Excel API to `frontend/src/api/index.js`**

Add after the `ordersApi` block:
```javascript
// ========================================
// Excel Processing API
// ========================================
export const excelApi = {
  upload: (file, orderId, jobType, onProgress) => {
    const formData = new FormData()
    formData.append('file', file)
    const params = new URLSearchParams()
    if (orderId) params.append('order_id', orderId)
    if (jobType) params.append('job_type', jobType)
    return api.post(`/excel/upload/?${params.toString()}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000,  // 10 minutes
      onUploadProgress: onProgress,
    })
  },
  getJob: (jobId) => api.get(`/excel/jobs/${jobId}/`),
  listJobs: (params) => api.get('/excel/jobs/', { params }),
  cancelJob: (jobId) => api.delete(`/excel/jobs/${jobId}/`),
  applyParsedData: (jobId, data) => api.post(`/excel/apply/${jobId}/`, data),
}
```

**Step 3: Add route to `frontend/src/router/index.js`**

After the OrderDetail route (line 30):
```javascript
{
  path: '/orders/:id/upload-excel',
  name: 'ExcelUpload',
  component: () => import('../views/orders/ExcelUpload.vue'),
  meta: { title: 'Upload Excel', parent: 'OrderDetail' },
  props: true
},
```

---

## Task 4: Frontend — ExcelUpload.vue

**Files:**
- Create: `frontend/src/views/orders/ExcelUpload.vue`

This is the main upload page with drag-drop, progress tracking, and results preview. Full component with:
- Drag-and-drop upload zone
- Upload progress bar (file transfer)
- Processing progress bar (background parsing with row count)
- Results preview table with color-coded match statuses
- "Apply to Order" button

**Step 1: Create the full component**

Create `frontend/src/views/orders/ExcelUpload.vue` with:
- File drag-and-drop zone accepting .xlsx files
- Auto-detect file type from headers (client vs factory)
- Upload progress via Axios onUploadProgress
- Poll job status every 2 seconds using setInterval
- Display results table with MATCHED (green), NEW_PRODUCT (blue), DUPLICATE (yellow), AMBIGUOUS (red), NO_PRICE (orange)
- Apply button that calls apply endpoint
- Link back to Order Detail

---

## Task 5: Add Upload Button to OrderDetail.vue

**Files:**
- Modify: `frontend/src/views/orders/OrderDetail.vue`

Add an "Upload Excel" button in the pricing section header (visible at PENDING_PI stage) that links to the upload page:
```html
<router-link
  :to="`/orders/${orderId}/upload-excel`"
  class="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-1"
>
  <i class="pi pi-file-excel text-[10px]" />
  Upload Excel
</router-link>
```

---

## Task 6: Integration Test with Real Files

**Step 1: Test backend startup**
```bash
cd "C:\Users\sachi\OneDrive\antigravity\Workflow\backend"
python -X utf8 -c "
from database import engine, Base
from models import ProcessingJob, ProductImage, ClientProductBarcode
Base.metadata.create_all(bind=engine)
print('All tables created')
"
```

**Step 2: Test upload endpoint with real Client Request.xlsx**
```bash
cd "C:\Users\sachi\OneDrive\antigravity\Workflow\backend"
python -X utf8 -c "
import requests, time, json

BASE = 'http://127.0.0.1:8000/api'

# Upload client Excel
with open('../Test Document/Client Request.xlsx', 'rb') as f:
    r = requests.post(f'{BASE}/excel/upload/', files={'file': f}, params={'job_type': 'CLIENT_EXCEL'})
    print(f'Upload: {r.status_code}')
    job = r.json()
    job_id = job['id']
    print(f'Job ID: {job_id}, Status: {job[\"status\"]}')

# Poll for completion
for _ in range(30):
    time.sleep(1)
    r = requests.get(f'{BASE}/excel/jobs/{job_id}/')
    job = r.json()
    print(f'  Progress: {job[\"progress\"]}% | Status: {job[\"status\"]} | Rows: {job[\"processed_rows\"]}/{job[\"total_rows\"]}')
    if job['status'] in ('COMPLETED', 'FAILED'):
        break

if job['status'] == 'COMPLETED':
    summary = job['result_summary']
    print(f'Summary: {json.dumps(summary, indent=2)}')
    data = job['result_data']
    print(f'Parsed {len(data)} rows')
    for row in data[:5]:
        print(f'  {row[\"manufacturer_code\"]} -> {row[\"match_status\"]}')
else:
    print(f'FAILED: {job[\"error_message\"]}')
"
```

**Step 3: Test upload with real Factory Respond.xlsx**
```bash
cd "C:\Users\sachi\OneDrive\antigravity\Workflow\backend"
python -X utf8 -c "
import requests, time, json

BASE = 'http://127.0.0.1:8000/api'

with open('../Test Document/Factory Respond.xlsx', 'rb') as f:
    r = requests.post(f'{BASE}/excel/upload/', files={'file': f}, params={'job_type': 'FACTORY_EXCEL'})
    job = r.json()
    job_id = job['id']
    print(f'Job ID: {job_id}, File size: {job[\"file_size\"]} bytes')

for _ in range(60):
    time.sleep(1)
    r = requests.get(f'{BASE}/excel/jobs/{job_id}/')
    job = r.json()
    print(f'  Progress: {job[\"progress\"]}% | Status: {job[\"status\"]} | Rows: {job[\"processed_rows\"]}/{job[\"total_rows\"]}')
    if job['status'] in ('COMPLETED', 'FAILED'):
        break

if job['status'] == 'COMPLETED':
    summary = job['result_summary']
    print(f'Summary: {json.dumps(summary, indent=2)}')
    print(f'Images extracted: {summary.get(\"images_extracted\", 0)}')
else:
    print(f'FAILED: {job[\"error_message\"]}')
"
```

**Step 4: Test frontend build**
```bash
cd "C:\Users\sachi\OneDrive\antigravity\Workflow\frontend"
npm run build
```

---

## Task 7: PI Generation (after parsers verified working)

**Files:**
- Add PI generation endpoint to `backend/routers/excel.py`
- Use openpyxl to create clean Excel
- Use reportlab for PDF option

PI endpoint: `POST /api/excel/generate-pi/{order_id}/`
- Generates clean PI with: Part Code, Description, Qty, Selling Price (INR), Total
- NO factory prices, NO Chinese names, NO markup
- Saves as document attached to order
- Returns download link

---

## Build Order Summary

| Task | What | Verify |
|------|------|--------|
| 1 | Backend models + config + enums | Tables created in DB |
| 2 | Excel router with streaming upload + background processing | `python -c "import routers.excel"` |
| 3 | Frontend API + Vite config + route | `npm run build` passes |
| 4 | ExcelUpload.vue component | `npm run build` passes |
| 5 | Upload button in OrderDetail | Visual check |
| 6 | Integration test with real Excel files | Both files parse, images extracted |
| 7 | PI Generation | Clean Excel/PDF output |
