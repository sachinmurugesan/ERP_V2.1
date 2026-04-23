# Industrial Architecture Gap Analysis

**System:** HarvestERP v1.0 (FastAPI + Vue 3 + SQLite)
**Date:** 2026-03-22
**Auditor Persona:** Principal DevSecOps Architect
**Classification:** CONFIDENTIAL — INTERNAL USE ONLY

---

## Verdict

This system will crash under enterprise load. The business logic is sound, but the infrastructure is built for a single developer on localhost. Below are the exact points of failure, the attack vectors, and the industrial-grade fixes.

**Critical findings: 12 | High: 14 | Medium: 8**

---

## Vector 1: Memory Exhaustion & OOM Crashes

### 1.1 CRITICAL — `documents.py:59-63` — Full File Read Before Size Check

```python
contents = await file.read()       # Entire file in RAM
file_size = len(contents)
if file_size > MAX_UPLOAD_SIZE:     # Check AFTER memory consumed
```

**Attack:** Upload 4GB file. `file.read()` allocates 4GB in Python heap. 3 concurrent attackers = 12GB. Uvicorn worker OOM-killed.

**Fix:** Chunked streaming with inline size enforcement:
```python
async def upload_document(...):
    file_size = 0
    async with aiofiles.open(file_path, "wb") as out:
        while chunk := await file.read(1_048_576):  # 1MB chunks
            file_size += len(chunk)
            if file_size > MAX_UPLOAD_SIZE:
                file_path.unlink(missing_ok=True)
                raise HTTPException(413, "File too large")
            await out.write(chunk)
```

---

### 1.2 CRITICAL — `shipping.py:816-817` — Full File Read, No Size Limit At All

```python
content = await file.read()       # No MAX_UPLOAD_SIZE check anywhere
file_path.write_bytes(content)
```

**Attack:** Upload 10GB to `PUT /api/shipping/shipping-documents/{doc_id}/upload/`. No size gate exists. Instant OOM.

**Fix:** Same chunked streaming pattern. Import and enforce `MAX_UPLOAD_SIZE`.

---

### 1.3 HIGH — `orders.py:1944-1946` — Packing List Upload, No Size Check

```python
content = file.file.read()   # Synchronous, no size enforcement
f.write(content)
```

**Attack:** 4GB packing list Excel. Blocks event loop AND consumes 4GB RAM.

**Fix:** Chunked streaming + `MAX_UPLOAD_SIZE`.

---

### 1.4 HIGH — `orders.py:1287` — Sync openpyxl Blocks Async Event Loop

```python
async def parse_price_excel(...):
    raw = await file.read()                                    # Full file in RAM
    wb = openpyxl.load_workbook(BytesIO(raw), data_only=True)  # CPU-bound, blocks event loop
    rows = list(ws.iter_rows(min_row=1, values_only=True))     # Materializes ALL rows
```

**Attack:** 10 concurrent price Excel uploads. Each blocks the event loop for 5-10 seconds. All other requests queue behind them. Server appears dead.

**Fix:** Move to thread pool:
```python
result = await asyncio.get_event_loop().run_in_executor(
    None, partial(_parse_excel_sync, raw)
)
```

---

### 1.5 HIGH — `excel.py:244-250` — Full result_data Deserialized on Every Status Poll

```python
def get_job_status(job_id, db):
    job = db.query(ProcessingJob).filter(...).first()
    return serialize_job(job)  # json.loads(job.result_data) — could be 50MB
```

Frontend polls every 2 seconds. A 50,000-row Excel produces ~50MB of `result_data` JSON. Every poll deserializes 50MB, re-serializes to response. 10 concurrent users polling = 500MB/sec of JSON churn.

**Fix:** Split endpoint. Status poll returns metadata only. Result data served from separate endpoint, called once after completion.

---

## Vector 2: Unbounded JSON Payloads (Pydantic Bombs)

### 2.1 HIGH — `excel.py:224-231` — Nested Unbounded Lists

```python
class ConflictGroup(BaseModel):
    code: str                           # no max_length
    rows: List[dict]                    # no max_items, no dict schema
    existing_variants: List[dict] = []  # no max_items

class AnalyzeConflictsRequest(BaseModel):
    groups: List[ConflictGroup]         # no max_items
```

**Attack:** Send `groups` with 10,000 entries, each with 10,000 `rows`. Pydantic deserializes entire structure before any business logic. Estimated: 50GB allocation from a single HTTP request.

**Fix:** `groups: List[ConflictGroup] = Field(..., max_length=1000)`, `rows: List[dict] = Field(..., max_length=500)`

---

### 2.2 HIGH — `excel.py:366-372` — Four Unbounded dict Fields

```python
class ApplyParsedDataRequest(BaseModel):
    duplicate_resolutions: dict = {}    # unlimited keys
    image_conflict_resolutions: dict = {}
    variant_resolutions: dict = {}
    row_overrides: dict = {}
```

**Attack:** Send each dict with 1M keys. 4M dict entries deserialized.

**Fix:** Add `@model_validator` asserting `len(self.row_overrides) < 10000`.

---

### 2.3 MEDIUM — `orders.py:53-59` — Unbounded items List + N*1 DB Queries

```python
items: List[OrderItemCreate] = []   # no max_items
```

**Attack:** POST 100,000 items. Each triggers `db.query(Product)`. = 100,000 sequential DB queries.

**Fix:** `items: List[OrderItemCreate] = Field(default=[], max_length=500)`

---

### 2.4 MEDIUM — All Bulk Endpoints (`products.py:78-88`, `aftersales.py:220`, `shipping.py:487`)

Every endpoint accepting `List[str]` or `List[Model]` lacks `max_length`. Each processes items in a loop with 1-2 DB queries per item.

**Fix:** Add `Field(max_length=N)` to every `List` field in every Pydantic schema.

---

## Vector 3: Unpaginated Database Queries

### 3.1 CRITICAL — `unloaded.py:38` — Loads Entire Table

```python
rows = q.order_by(UnloadedItem.created_at.desc()).all()
```

**Attack:** Table grows to 500,000 rows. Single GET loads all into Python ORM objects (~500 bytes each = 250MB), then serializes to JSON. Server OOM.

**Fix:** Add `page`/`per_page` query params with `.offset().limit()`.

---

### 3.2 HIGH — `orders.py:392-403` — Eager-Loads ALL Order Items

```python
order = db.query(Order).options(
    joinedload(Order.items).joinedload(OrderItem.product),
).filter(...).first()
data["items"] = [serialize_order_item(i) for i in order.items]
```

An order with 5,000 line items returns all 5,000 with full product joins in one response.

**Fix:** Paginate items via separate endpoint `GET /api/orders/{id}/items/?page=1&per_page=100`.

---

### 3.3 HIGH — `shipping.py:377` — N+1+M Query Amplification

```python
shipments = db.query(Shipment).filter(...).all()
return [_serialize_shipment(s, db) for s in shipments]
```

`_serialize_shipment` issues 4+ DB queries per shipment. 100 shipments = 400+ queries per GET request.

**Fix:** Eager-load with `joinedload` + pagination.

---

### 3.4 HIGH — Multiple `.all()` Without Pagination

| Endpoint | File:Line | Table |
|----------|-----------|-------|
| `GET /api/documents/orders/{id}/` | `documents.py:29` | documents |
| `GET /api/aftersales/orders/{id}/` | `aftersales.py:164` | aftersales_items |
| `GET /api/shipping/orders/{id}/shipping-documents/` | `shipping.py:783` | shipping_documents |
| `GET /api/finance/orders/{id}/payments/` | `finance.py:117` | payments |
| `POST /api/products/admin/cleanup-orphan-images/` | `products.py:598` | ALL product_images |
| `POST /api/products/admin/remove-duplicate-images/` | `products.py:539` | ALL product_images |
| `POST /api/products/admin/re-extract-images/` | `products.py:632` | ALL products |

**Fix:** Add pagination to all list endpoints. Move admin full-table operations to background tasks.

---

## Vector 4: IDOR — Insecure Direct Object Reference

### 4.1 CRITICAL — Every Entity Endpoint Lacks Ownership Verification

**Current pattern (universal across all routers):**
```python
order = db.query(Order).filter(Order.id == order_id).first()
```

**Missing pattern:**
```python
order = db.query(Order).filter(
    Order.id == order_id,
    Order.tenant_id == current_user.tenant_id  # MISSING
).first()
```

**Every single endpoint** that takes an entity ID (order, product, client, factory, payment, shipment, document) performs lookup by ID only. Zero tenant/ownership filtering.

**Attack:** Authenticated user A with `tenant_id=ACME` calls `GET /api/orders/{uuid-of-tenant-B-order}`. Gets full order data including financial details of tenant B.

**Where tenant checks MUST be injected (per router):**

| Router | Endpoints Needing Tenant Filter | Count |
|--------|--------------------------------|-------|
| `orders.py` | All CRUD + transitions + packing + price parsing | 25+ |
| `finance.py` | All payments + credits + ledgers + PI | 20+ |
| `shipping.py` | All shipments + documents + providers | 15+ |
| `customs.py` | All BOE + milestones + clearance | 10+ |
| `products.py` | All CRUD + bulk ops + images | 15+ |
| `documents.py` | Upload + download + delete | 5 |
| `clients.py` | All CRUD | 5 |
| `factories.py` | All CRUD | 5 |
| `aftersales.py` | All CRUD + reports | 8 |
| `unloaded.py` | All CRUD | 5 |

**Enterprise fix — Global dependency:**
```python
def get_tenant_filter(current_user = Depends(get_current_user)):
    def apply(query, model):
        return query.filter(model.tenant_id == current_user.tenant_id)
    return apply
```

---

### 4.2 HIGH — Cross-Order Resource Injection

`shipping.py:500-510` — Shipment item allocation:
```python
pli = db.query(PackingListItem).filter(PackingListItem.id == item.packing_list_item_id).first()
```

No check that `pli.packing_list.order_id == shipment.order_id`. Attacker can inject packing list items from Order A into a Shipment for Order B.

---

## Vector 5: Business Logic / State Machine Abuse

### 5.1 CRITICAL — `go-back` Has Zero Gate Validation

**File:** `orders.py:1782-1814`

```python
def go_back_order(order_id, req=None, db=...):
    prev_status = REVERSE_TRANSITIONS.get(order.status)
    order.status = prev_status
    db.commit()
```

**Attack:** Call `go-back` in a loop. Walk order from `PRODUCTION_100` back to `DRAFT`. No re-validation of payments, documents, or milestones. Payments marked "received" remain, but the order is back at DRAFT.

**Fix:** Add `REVERSE_GATE_VALIDATORS` dict. Require reason. Re-validate financial state on backward transitions.

---

### 5.2 CRITICAL — `jump-to-stage` Skips ALL `validate_transition` Logic

**File:** `orders.py:1817-1852`

```python
def jump_to_stage(order_id, req, db):
    order.status = req.target_status  # Direct assignment, no validation
    db.commit()
```

`validate_transition()` (the function with all the payment/document gates) is NEVER called from `jump-to-stage`. Only called from `transition_order`.

**Attack:** Jump from `ARRIVED` directly to `COMPLETED`, skipping customs, BOE, clearance charges, delivery verification, and after-sales.

**Fix:** `jump-to-stage` MUST call `validate_transition()` for forward jumps.

---

### 5.3 HIGH — Payment Gates Are Bypassable Warnings

**File:** `orders.py:1522-1539`

Client balance unpaid at `PRODUCTION_100` is a `warning`, not an `error`. Two-call bypass: first call returns warnings, second call with `acknowledge_warnings: true` bypasses the gate.

**Fix:** Make financial gates configurable as hard errors via system settings. Require manager-level approval for financial warning overrides.

---

### 5.4 HIGH — Packing List Delete Has No Stage Guard

**File:** `orders.py:2170`

Delete packing list works at ANY stage. After `FINAL_PI`, BOE line items reference packing list items via FK. Deleting packing list corrupts customs chain.

**Fix:** Guard: `if order.status not in [PLAN_PACKING, FINAL_PI]: raise 400`

---

### 5.5 HIGH — COMPLETED Reachable Without Customs BOE

`CUSTOMS_FILED -> CLEARED` transition has no `validate_transition` case. No check that a Bill of Entry exists. Order can reach COMPLETED with zero customs documentation.

**Fix:** Add BOE existence check to `validate_transition` for `CLEARED` target.

---

## Vector 6: Race Conditions

### 6.1 CRITICAL — Credit Double-Spend

**File:** `finance.py:907-991`

```python
credit = db.query(ClientCredit).filter(
    ClientCredit.id == data.credit_id,
    ClientCredit.status == "AVAILABLE",
).first()
# ... no lock ...
credit.status = "APPLIED"
```

**Attack:** Two concurrent requests apply same credit to two different orders. Both read `AVAILABLE`, both create payments, both mark `APPLIED`. Credit consumed twice.

**Fix:** `SELECT ... FOR UPDATE`:
```python
credit = db.execute(
    select(ClientCredit).where(...).with_for_update()
).scalar_one_or_none()
```

---

### 6.2 CRITICAL — Credit Recalculation Race

**File:** `finance.py:216-292`

Two concurrent payment creates both trigger `_recalculate_credit`. Both read same `total_paid`, both compute surplus, both INSERT new `ClientCredit`. Duplicate credits created.

**Fix:** Advisory lock on order_id or `INSERT ON CONFLICT DO UPDATE`.

---

### 6.3 HIGH — Stage Transition No Optimistic Lock

**File:** `orders.py:1643-1750`

Two concurrent transitions: one to `PRODUCTION_60`, one to `PRODUCTION_80`. Both read current status, both validate, second commit overwrites first. Stage skipped.

**Fix:** Add `version` column to Order. Conditional UPDATE:
```python
rows = db.query(Order).filter(
    Order.id == order_id,
    Order.status == current_status,
    Order.version == current_version,
).update({"status": target, "version": current_version + 1})
if rows == 0:
    raise HTTPException(409, "Concurrent modification detected")
```

---

### 6.4 HIGH — Excel Import Creates Duplicate Products

Two concurrent imports with same product codes. Both check `existing = None`, both INSERT. No unique constraint on `product_code` in SQLite.

**Fix:** Add `UNIQUE(product_code, parent_id)` constraint. Handle `IntegrityError`.

---

## Vector 7: L7 DDoS / Timeout Resilience

### 7.1 CRITICAL — No Request Timeout or Connection Limit

No `gunicorn.conf.py`, no `uvicorn.toml`, no timeout configuration anywhere. Default uvicorn has no worker timeout. Slowloris attack holds connections indefinitely.

**Fix — `gunicorn.conf.py`:**
```python
workers = 4
worker_class = "uvicorn.workers.UvicornWorker"
timeout = 60
keepalive = 5
max_requests = 1000
max_requests_jitter = 100
```

---

### 7.2 CRITICAL — No Rate Limiting

Zero rate limiting on any endpoint. Most dangerous unprotected endpoints:

| Endpoint | Risk |
|----------|------|
| `POST /api/excel/analyze-columns/` | Anthropic API call per request ($$$) |
| `POST /api/excel/analyze-conflicts/` | Anthropic API call per request ($$$) |
| `POST /api/excel/upload/` | 600MB file + CPU-heavy parsing |
| `POST /api/orders/{id}/parse-price-excel/` | Full Excel in RAM + openpyxl CPU |
| `GET /api/orders/{id}/packing-list/download-excel/` | In-memory workbook with images |

**Attack:** 50 concurrent requests to `analyze-columns` = 50 Claude API calls = hundreds of dollars in minutes.

**Fix:** `slowapi` with per-endpoint limits. AI endpoints: 5/min. Upload: 3/min. Read: 100/min.

---

### 7.3 MEDIUM — No Global Request Body Size Limit

FastAPI/Starlette has no default body size limit. Individual endpoints enforce limits inconsistently (only `excel.py` does it correctly). A 4GB POST to any endpoint without file upload handling will still be buffered.

**Fix:** Add middleware:
```python
@app.middleware("http")
async def limit_body_size(request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > 200 * 1024 * 1024:
        return JSONResponse(status_code=413, content={"detail": "Request too large"})
    return await call_next(request)
```

---

## Consolidated Risk Matrix

| ID | Severity | Vector | Finding | File |
|----|----------|--------|---------|------|
| 1.1 | CRITICAL | OOM | Full file read before size check | `documents.py:59` |
| 1.2 | CRITICAL | OOM | Full file read, no size limit | `shipping.py:816` |
| 3.1 | CRITICAL | OOM | Entire table loaded, no pagination | `unloaded.py:38` |
| 5.1 | CRITICAL | State | `go-back` has zero gate validation | `orders.py:1782` |
| 5.2 | CRITICAL | State | `jump-to-stage` skips all validation | `orders.py:1817` |
| 6.1 | CRITICAL | Race | Credit double-spend (no row lock) | `finance.py:907` |
| 6.2 | CRITICAL | Race | Credit recalculation race (dup insert) | `finance.py:216` |
| 7.1 | CRITICAL | L7 | No request timeout or connection limit | `main.py` |
| 7.2 | CRITICAL | L7 | No rate limiting on any endpoint | All routers |
| 4.1 | CRITICAL | IDOR | Zero tenant/ownership checks on all endpoints | All routers |
| 1.3 | HIGH | OOM | Packing list upload, no size check | `orders.py:1944` |
| 1.4 | HIGH | OOM | Sync openpyxl blocks event loop | `orders.py:1287` |
| 1.5 | HIGH | OOM | 50MB result_data deserialized on every poll | `excel.py:244` |
| 2.1 | HIGH | Payload | Unbounded nested List[dict] | `excel.py:224` |
| 2.2 | HIGH | Payload | Four unbounded dict fields | `excel.py:366` |
| 3.2 | HIGH | OOM | N+1+M query amplification in shipments | `shipping.py:377` |
| 3.3 | HIGH | OOM | 7 endpoints return full tables unbounded | Multiple |
| 4.2 | HIGH | IDOR | Cross-order resource injection | `shipping.py:500` |
| 5.3 | HIGH | State | Payment gates bypassable via warnings | `orders.py:1522` |
| 5.4 | HIGH | State | Packing list delete has no stage guard | `orders.py:2170` |
| 5.5 | HIGH | State | COMPLETED reachable without customs BOE | `orders.py:1454` |
| 6.3 | HIGH | Race | Stage transition no optimistic lock | `orders.py:1643` |
| 6.4 | HIGH | Race | Excel import creates duplicate products | `excel_apply.py` |
| 7.3 | HIGH | L7 | No global request body size limit | `main.py` |
| 2.3 | MEDIUM | Payload | Unbounded items list + N*1 queries | `orders.py:53` |
| 2.4 | MEDIUM | Payload | All bulk endpoints lack max_length | `products.py:78` |
| 3.4 | MEDIUM | OOM | Payments loaded without pagination | `finance.py:117` |
| 3.5 | MEDIUM | OOM | After-sales Excel built fully in memory | `aftersales.py:322` |
| 5.6 | MEDIUM | Config | DEBUG leaks SQL in error responses | `main.py:484` |
| 5.7 | MEDIUM | Config | DEBUG never imported (crash in error handler) | `main.py:486` |
| 5.8 | MEDIUM | Config | CORS localhost origins hardcoded | `config.py:43` |
| 5.9 | MEDIUM | Audit | Payment audit log exposed without auth | `finance.py:770` |

---

## Remediation Priority

### Sprint 0 — Emergency (Before Any Production Traffic)

1. Add chunked file streaming to `documents.py`, `shipping.py`, `orders.py` packing list
2. Add pagination to `unloaded.py` and all `.all()` endpoints
3. Add `slowapi` rate limiting (AI endpoints: 5/min, uploads: 3/min)
4. Configure gunicorn with `timeout=60`, `max_requests=1000`
5. Add global body size middleware (200MB cap)
6. Fix `DEBUG` import bug in `main.py`
7. Add `Field(max_length=N)` to all Pydantic List fields

### Sprint 1 — State Machine Hardening

8. Add gate validation to `go-back` endpoint
9. Call `validate_transition()` from `jump-to-stage`
10. Add stage guard to packing list delete
11. Add BOE existence check for `CLEARED` transition
12. Make financial gates configurable (warning vs error)
13. Add optimistic locking (`version` column) to Order

### Sprint 2 — Financial Integrity

14. Add `SELECT FOR UPDATE` to credit application
15. Add advisory lock to credit recalculation
16. Add `UNIQUE(product_code, parent_id)` constraint
17. Split `get_job_status` into metadata + result endpoints
18. Move sync openpyxl to thread pool executor

### Sprint 3 — Multi-Tenancy

19. Add `tenant_id` column to all tables
20. Create `get_tenant_filter` dependency
21. Apply tenant filter to all 100+ endpoints
22. Add cross-order validation to shipment allocation
23. Environment-drive CORS origins

---

*Generated from parallel security analysis of 14,795 lines of backend Python across 13 router modules, 6 service files, and 32 database models.*
