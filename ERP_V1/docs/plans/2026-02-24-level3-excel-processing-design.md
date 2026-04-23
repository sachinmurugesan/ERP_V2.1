# Level 3: Excel Processing & PI Generation — Design Doc

**Date**: 2026-02-24
**Status**: COMPLETE
**Depends on**: Level 2 (Order CRUD + Status Engine) — COMPLETE

---

## Problem

The real workflow involves two Excel files:
1. **Client Request** (small, ~50KB): 3 columns — client barcode, manufacturer code, quantity
2. **Factory Response** (large, up to 500MB): 9 columns + embedded images (2-5MB each, ~70 images)

Currently there is NO file processing infrastructure. Files are uploaded synchronously into memory (200MB limit). No background processing, no progress tracking, no image extraction.

---

## Architecture: Upload Fast, Process in Background, Poll for Status

```
User drags Excel file onto upload zone
    |
    v
FastAPI streams file to disk (NOT memory) --> returns job_id instantly (<1 sec)
    |
    v
BackgroundTask starts processing:
    Phase 1: Read Excel headers, detect file type (client vs factory)
    Phase 2: Parse rows, match products by manufacturer code
    Phase 3: Extract images (factory only), resize with Pillow, save to gallery
    Phase 4: Build result summary (matched, new, missing, duplicates)
    |
    v
Frontend polls GET /jobs/{id}/status every 2 sec --> shows progress bar
    |
    v
When complete --> show parsed results table for admin review
```

---

## Data Model Changes

### New Table: `processing_jobs`
```
id              UUID PRIMARY KEY
order_id        FK -> orders.id (nullable for standalone uploads)
job_type        ENUM: CLIENT_EXCEL, FACTORY_EXCEL, PI_GENERATION
file_path       VARCHAR(500) -- path to uploaded file on disk
status          ENUM: PENDING, PROCESSING, COMPLETED, FAILED
progress        INTEGER (0-100)
total_rows      INTEGER (nullable)
processed_rows  INTEGER (nullable)
result_summary  JSON -- { matched: N, new_products: N, duplicates: N, no_price: N, images_extracted: N }
result_data     JSON -- full parsed row data for preview
error_message   TEXT (nullable)
created_at      DATETIME
started_at      DATETIME (nullable)
completed_at    DATETIME (nullable)
```

### New Table: `product_images`
```
id              UUID PRIMARY KEY
product_id      FK -> products.id
image_path      VARCHAR(500) -- relative path: products/{product_id}/img_001.jpg
source_type     ENUM: FACTORY_EXCEL, MANUAL_UPLOAD
source_order_id FK -> orders.id (nullable) -- which order's factory Excel provided this
width           INTEGER
height          INTEGER
file_size       INTEGER (bytes)
is_primary      BOOLEAN DEFAULT FALSE
created_at      DATETIME
```

### New Table: `client_product_barcodes`
```
id              UUID PRIMARY KEY
client_id       FK -> clients.id
product_id      FK -> products.id
barcode_code    VARCHAR(100) -- e.g., "10238dhl"
created_at      DATETIME
UNIQUE(client_id, barcode_code)
```

### Product Model Update
```
approval_status  VARCHAR(20) DEFAULT 'APPROVED'  -- APPROVED, PENDING_APPROVAL, REJECTED
```

---

## API Endpoints

### File Upload & Processing
```
POST   /api/excel/upload/                     -- Stream file to disk, create job, return job_id
GET    /api/excel/jobs/{job_id}/              -- Get job status + progress + results
POST   /api/excel/jobs/{job_id}/process/      -- Trigger processing (after upload)
DELETE  /api/excel/jobs/{job_id}/              -- Cancel/delete job and temp file
```

### Order-Specific Excel Operations
```
POST   /api/orders/{id}/upload-client-excel/  -- Upload + auto-process client request
POST   /api/orders/{id}/upload-factory-excel/ -- Upload + auto-process factory response
GET    /api/orders/{id}/excel-jobs/           -- List all processing jobs for this order
POST   /api/orders/{id}/apply-parsed-data/    -- Apply parsed results to order items (after admin review)
```

### Product Images
```
GET    /api/products/{id}/images/             -- List product images
DELETE /api/products/{id}/images/{img_id}/    -- Delete an image
```

### Product Approval
```
GET    /api/products/pending-approval/        -- List products awaiting approval
PUT    /api/products/{id}/approve/            -- Approve a pending product
PUT    /api/products/{id}/reject/             -- Reject a pending product
```

---

## File Processing Logic

### Client Excel Parser
```
Input:  Client Request.xlsx (Col A=barcode, Col B=manufacturer_code, Col C=quantity)
Output: List of { barcode, manufacturer_code, quantity, match_status, product_id }

match_status values:
  MATCHED        -- manufacturer_code found in products table
  NEW_PRODUCT    -- unknown code, auto-create as PENDING_APPROVAL
  DUPLICATE      -- same code appears 2+ times in this file (flag for admin)
  AMBIGUOUS      -- code matches 2+ products (same code, different material)
```

### Factory Excel Parser
```
Input:  Factory Respond.xlsx (Col A=sl, B=description, C=barcode, D=mfr_code, E=chinese_name, F=image, G=qty, H=unit_price_usd, I=amount)
Output: List of { barcode, manufacturer_code, description, chinese_name, quantity, factory_price_usd, match_status, product_id, images[] }

Additional processing:
  - Extract images from Column F using openpyxl ws._images
  - Map image anchor row to product row
  - Resize images to max 1200px width with Pillow (JPEG, quality=85)
  - Save to uploads/products/{product_id}/
  - Items with no price → flagged as NEEDS_PRICE
```

---

## Frontend Pages

### New Route: `/orders/{id}/upload-excel`
- Drag-and-drop upload zone (accepts .xlsx, .xls)
- Auto-detects file type (client vs factory) by column headers
- Shows upload progress bar during file transfer
- Shows processing progress bar (0-100%) during background parsing
- When done: shows parsed results table with color-coded match statuses
- Admin review buttons: "Apply to Order" / "Cancel"

### Upload Progress States
```
UPLOADING    --> "Uploading file... 45%"     (file transfer progress)
PROCESSING   --> "Processing... 67/56 rows"  (parsing progress from job)
COMPLETED    --> Shows results table
FAILED       --> Shows error message + retry button
```

---

## File Streaming Strategy (for 500MB files)

```python
# Backend: Stream to disk, not memory
@router.post("/upload/")
async def upload_excel(file: UploadFile):
    # Stream in 1MB chunks to temp file
    temp_path = f"uploads/temp/{uuid4()}.xlsx"
    async with aiofiles.open(temp_path, 'wb') as f:
        while chunk := await file.read(1024 * 1024):  # 1MB chunks
            await f.write(chunk)

    # Create job record
    job = ProcessingJob(file_path=temp_path, status="PENDING")
    db.add(job)
    db.commit()

    return {"job_id": job.id}
```

```python
# Background processing with progress updates
def process_excel_background(job_id: str, db_session):
    job = db.get(ProcessingJob, job_id)
    job.status = "PROCESSING"
    db.commit()

    wb = openpyxl.load_workbook(job.file_path, read_only=True, data_only=True)
    ws = wb.active
    total = ws.max_row - 1  # minus header
    job.total_rows = total

    for i, row in enumerate(ws.iter_rows(min_row=2)):
        # ... parse row ...
        job.processed_rows = i + 1
        job.progress = int((i + 1) / total * 100)
        if i % 10 == 0:  # commit progress every 10 rows
            db.commit()

    job.status = "COMPLETED"
    db.commit()
```

---

## Image Extraction Strategy

```python
# For factory Excel with images in Column F
wb = openpyxl.load_workbook(file_path)  # NOT read_only (needed for images)
ws = wb.active

# Map images to rows by anchor position
for img in ws._images:
    row_idx = img.anchor._from.row  # 0-based row
    col_idx = img.anchor._from.col  # 0-based col (F=5)

    # Get image bytes
    image_data = img._data()
    pil_img = Image.open(io.BytesIO(image_data))

    # Resize if larger than 1200px
    if max(pil_img.size) > 1200:
        pil_img.thumbnail((1200, 1200), Image.LANCZOS)

    # Save as JPEG
    save_path = f"uploads/products/{product_id}/img_{uuid4()[:8]}.jpg"
    pil_img.save(save_path, "JPEG", quality=85)
```

---

## Build Order (Step-by-step)

### Step 1: Upload Infrastructure (test first!)
- ProcessingJob model + migration
- Streaming file upload endpoint
- Job status polling endpoint
- Frontend upload page with progress tracking
- **TEST**: Upload a 500MB file, verify it streams to disk without memory issues

### Step 2: Client Excel Parser
- Parse 3-column client request format
- Match products by manufacturer code
- Auto-create new products as PENDING_APPROVAL
- Flag duplicates
- client_product_barcodes table + mapping
- Product approval endpoints
- Frontend: parsed results preview

### Step 3: Factory Excel Parser
- Parse 9-column factory response format
- Extract images from Column F
- Resize and save images to product gallery
- product_images table
- Match factory prices to order items
- Frontend: factory results preview with image thumbnails

### Step 4: Apply Parsed Data to Order
- "Apply to Order" button creates/updates order items from parsed results
- Factory prices populate the pricing table (Stage 2)
- New products get added to catalog
- Images saved to product gallery

### Step 5: PI Generation
- Generate clean Excel PI for client
- Part Code + Description + Qty + Selling Price (INR) + Total
- NO factory data, NO Chinese names, NO images
- Export as Excel (primary) or PDF
- Store generated file as order document

---

## Config Changes

```python
# config.py updates
MAX_UPLOAD_SIZE = 600 * 1024 * 1024   # 600MB (room for 500MB files)
MAX_IMAGE_SIZE = 1200                  # Max dimension for extracted images
IMAGE_QUALITY = 85                     # JPEG quality
CHUNK_SIZE = 1024 * 1024              # 1MB upload chunks
```

```javascript
// vite.config.js - increase proxy timeout
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8000',
      timeout: 600000,  // 10 minutes
    }
  }
}
```

```python
# main.py - increase request body limit
app = FastAPI()
# Add middleware for large file uploads
from starlette.middleware.base import BaseHTTPMiddleware
```
