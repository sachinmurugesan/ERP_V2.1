# HarvestERP — Workflow Blueprint

> Reverse-engineered functional specification. Every path traced from UI click to database write.
> Generated: 2026-03-18

---

## Table of Contents

1. [Orders Module](#1-orders-module)
2. [Excel Import Module](#2-excel-import-module)

---

# 1. Orders Module

## 1.1 Order List — User Flow & UI Logic

### Trigger
User clicks **"Orders"** in sidebar or navigates to `/orders`.

### UI Response
- Header with **"+ New Order"** button (routes to `/orders/new`)
- Status filter tabs: All | Draft | Pricing | Payment | Production | Shipping | Customs | Delivered | Completed
- Search bar with 400ms debounce
- Paginated table: Order #, Client (avatar), Factory, Stage (badge), Items, Value (CNY), Created, Actions

### Component & Function Tracing

| Frontend Function | File | Purpose |
|---|---|---|
| `loadOrders()` | `OrderList.vue` | Calls `ordersApi.list({search, status, page, per_page})` |
| `loadStatusCounts()` | `OrderList.vue` | Calls `ordersApi.statusCounts()` for tab badges |
| `onSearchInput()` | `OrderList.vue` | 400ms debounce, resets page, reloads |
| `setStatusFilter(value)` | `OrderList.vue` | Filters by stage group, reloads |
| `getStageStyle(stage)` | `OrderList.vue` | Returns `{bg, text}` CSS for stage badge |

### API & Backend Sync

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/orders/` | GET | List orders with filters |
| `/api/orders/status-counts/` | GET | Count per status group |

### Database Impact
- **Read only**: `orders` table with joins to `clients`, `factories`
- Counts active `order_items` per order

---

## 1.2 Create Order — User Flow & UI Logic

### Trigger
User clicks **"+ New Order"** button → navigates to `/orders/new`.

### UI Response
1. **Client & Factory dropdowns** (required) — populated from `clientsApi.list()` / `factoriesApi.list()`
2. **Quick-create modals** — inline client/factory creation without leaving page
3. **Currency selector** (default: CNY), PO Reference, Notes fields
4. **Item addition area** — 4 methods available (see below)
5. **Carry-forward banner** — auto-appears when client+factory match a previous order with pending items

### 4 Methods to Add Items

| Method | UI | Function | Backend |
|---|---|---|---|
| **Product Search** | Search input with 300ms debounce | `onProductSearch()` → click → `addProduct()` | `productsApi.search(query)` |
| **Bulk Paste** | Modal textarea, paste "CODE QTY" lines | `processBulkPaste()` → resolve conflicts → `closeBulkPaste()` | `productsApi.validateCodes(codes)` |
| **Product Browser** | Modal with paginated catalog, multi-select | `openProductBrowser()` → select → `addBrowserSelected()` | `productsApi.list({page, search, category})` |
| **Quick-Add** | Inline form for missing product | `submitQuickAdd(idx)` | `productsApi.create(form)` |

### Carry-Forward (Auto-Add)

**Watcher** on `[client_id, factory_id]` triggers:
1. Fetches `unloadedApi.getPending(clientId, factoryId)` — items not shipped from previous orders
2. Fetches after-sales items with `carry_forward_status == PENDING`
3. Shows banner: "X items from previous orders can be carried forward"
4. On order create, backend auto-adds these via `_add_pending_items_to_order()`

### Submission

```
Frontend Validation:
  - client_id required
  - factory_id required
  - orderItems.length >= 1

API Call:
  POST /api/orders/
  {
    client_id, factory_id, currency, po_reference, notes,
    items: [{ product_id, quantity, notes }]
  }

Backend Logic (create_order):
  1. Validate client + factory exist
  2. Snapshot exchange rate from system settings
  3. Create Order (status=DRAFT)
  4. Create OrderItems
  5. Auto-carry unloaded + after-sales items
  6. Commit
  7. Return order + carried_count

Frontend: router.push(`/orders/{id}?carried={count}`)
```

### Database Impact

| Table | Operation |
|---|---|
| `orders` | INSERT (status=DRAFT) |
| `order_items` | INSERT (one per item) |
| `unloaded_items` | UPDATE status → ADDED_TO_ORDER |
| `aftersales_items` | UPDATE carry_forward_status → ADDED_TO_ORDER |

---

## 1.3 Order Detail — User Flow & UI Logic

### Trigger
User clicks an order row in list → navigates to `/orders/:id`.

### UI Response
- **Header**: Order #, Stage badge, Client/Factory/PO, Delete (if DRAFT), Reopen (if COMPLETED)
- **Stage Timeline**: 17 visual nodes, clickable for jump navigation
- **Stage Override History**: Collapsed accordion showing acknowledged warnings
- **Transition Controls**: Previous / Next Stage / Jump Forward buttons
- **Tab System**: Progressive tabs based on current stage

### Progressive Tab System

| Tab | Visible When | Purpose |
|---|---|---|
| Dashboard | Always | Order summary, financial overview |
| Order Items | Always | Add/remove items, set prices |
| Payments | After PI_SENT | Track client payments |
| Production | FACTORY_ORDERED through PRODUCTION_100 | Production progress |
| Packing List | PLAN_PACKING+ | Upload/manage packing list |
| Booking | BOOKED+ | Container booking details |
| Sailing | SAILED+ | Vessel tracking |
| Shipping Docs | SAILED+ | BL, CO, insurance docs |
| Customs/BOE | CUSTOMS_FILED+ | Bills of entry, duty calc |
| After-Sales | AFTER_SALES+ | Post-delivery claims |
| Files | Always | Attached documents |

### Contextual Default Tab

`getDefaultTab(status)` returns the most relevant tab for current stage:
- DRAFT/PENDING_PI → "items" tab
- ADVANCE_PENDING → "payments" tab
- PLAN_PACKING → "packing" tab
- SAILED → "shipping-docs" tab
- CUSTOMS_FILED → "customs" tab
- AFTER_SALES → "after-sales" tab

---

## 1.4 The 17-Stage Order Workflow

### Stage Definitions

| # | Status | Name | Group |
|---|---|---|---|
| 1 | `DRAFT` | Draft | Draft |
| 2 | `PENDING_PI` | Pending PI | Pricing |
| 3 | `PI_SENT` | PI Sent | Pricing |
| 4 | `ADVANCE_PENDING` | Advance Pending | Payment |
| 4 | `ADVANCE_RECEIVED` | Advance Received | Payment |
| 5 | `FACTORY_ORDERED` | Factory Ordered | Production |
| 6 | `PRODUCTION_60` | Production 60% | Production |
| 7 | `PRODUCTION_80` | Production 80% | Production |
| 8 | `PRODUCTION_90` | Production 90% | Production |
| 9 | `PLAN_PACKING` | Plan Packing | Production |
| 10 | `FINAL_PI` | Final PI | Production |
| 11 | `PRODUCTION_100` | Production 100% | Production |
| 12 | `BOOKED` | Container Booked | Shipping |
| 13 | `LOADED` | Container Loaded | Shipping |
| 13 | `SAILED` | Sailing | Shipping |
| 13 | `ARRIVED` | Arrived at Port | Shipping |
| 14 | `CUSTOMS_FILED` | Customs Filed | Customs |
| 14 | `CLEARED` | Customs Cleared | Customs |
| 15 | `DELIVERED` | Delivered | Delivered |
| 16 | `AFTER_SALES` | After-Sales | After-Sales |
| 17 | `COMPLETED` | Completed | Completed |
| 17 | `COMPLETED_EDITING` | Completed (Editing) | Completed |

### Stage Transition Flow

```
DRAFT → PENDING_PI → PI_SENT → ADVANCE_PENDING → ADVANCE_RECEIVED
  → FACTORY_ORDERED → PRODUCTION_60 → PRODUCTION_80 → PRODUCTION_90
  → PLAN_PACKING → FINAL_PI → PRODUCTION_100
  → BOOKED → LOADED → SAILED → ARRIVED
  → CUSTOMS_FILED → CLEARED → DELIVERED → AFTER_SALES → COMPLETED
  ↔ COMPLETED_EDITING (bidirectional)
```

### Validation Gates (Hard Blocks)

| Transition | Required | Blocks If |
|---|---|---|
| → PENDING_PI | Client, Factory, 1+ items | Missing any |
| → PI_SENT | All items priced (selling_price_inr) | Any unpriced item |
| → ADVANCE_PENDING | PI must exist | No PI generated |
| → ADVANCE_RECEIVED | 1+ payment recorded | No payments |
| → FINAL_PI | Packing list uploaded | No packing list |

### Warning Gates (Soft — Acknowledgeable)

| Transition | Warning Condition | User Must |
|---|---|---|
| → ADVANCE_RECEIVED | Paid < PI total (underpayment) | Enter reason, acknowledge |
| → PRODUCTION_100 | Client balance not fully paid | Enter reason, acknowledge |
| → BOOKED | Factory underpaid | Enter reason, acknowledge |
| → ARRIVED | Vessel before ETA (early arrival) | Enter reason, acknowledge |
| → COMPLETED | Open after-sales claims exist | Enter reason, acknowledge |
| Any | Items modified since last PI (stale PI) | Enter reason, acknowledge |

### Transition Execution Flow

```
1. Frontend: ordersApi.transition(id, target, {acknowledge_warnings: false})
2. Backend: validate_transition()
   ├─ Hard errors? → 400 {validation_errors: [...]}
   ├─ Soft warnings? → 200 {status: 'warnings', warnings: [...]}
   └─ Clean? → proceed
3. If warnings returned:
   - Frontend shows warning modal with list
   - User enters transition_reason
   - Retry: ordersApi.transition(id, target, {acknowledge_warnings: true, transition_reason})
4. Backend commits:
   - Updates order.status
   - Updates highest_unlocked_stage (high-water mark)
   - Creates StageOverride record (if warnings acknowledged)
   - Special logic per stage (snapshots, order number generation, etc.)
```

### Jump Navigation

- `highest_unlocked_stage` tracks furthest stage ever reached
- **Jump backward**: Any previously-reached stage is reachable
- **Jump forward**: Up to (not beyond) highest_unlocked_stage
- Both require a reason text

---

## 1.5 Snapshot Pattern — Product Data Capture

### When: DRAFT → PENDING_PI Transition

```
Backend: transition_order() detects leaving DRAFT
  For each OrderItem:
    item.product_code_snapshot = product.product_code
    item.product_name_snapshot = product.product_name
    item.material_snapshot = product.material
    item.category_snapshot = product.category
    item.part_type_snapshot = product.part_type
    item.dimension_snapshot = product.dimension
    item.variant_note_snapshot = product.variant_note

    # Image: COPIES file to uploads/orders/{order_id}/
    item.image_path_snapshot = copied_image_path
```

**Purpose**: Protects the order from downstream product changes. Once an order leaves DRAFT, its item data is frozen — editing the master product catalog won't affect existing orders.

---

## 1.6 Pricing Workflow

### Trigger
User is on Order Detail → "Order Items" tab, order in PENDING_PI stage.

### 3 Pricing Methods

**Method 1: Manual Entry**
```
User enters: factory_price_cny=100, markup_percent=20
API: PUT /api/orders/{id}/items/{itemId}/prices/

Backend auto-calculates:
  selling_price_cny = 100 × (1 + 20/100) = 120 CNY
  selling_price_inr = 120 × exchange_rate = 138 INR (at 1.15 rate)
```

**Method 2: Copy Previous Prices**
```
User clicks "Copy Previous Prices" button
API: POST /api/orders/{id}/copy-previous-prices/

Backend:
  For each item → find most recent same-product OrderItem from past same-factory orders
  Copy: factory_price_cny, markup_percent, selling_price_cny, selling_price_inr
  Skip after-sales items (they have fixed pricing)
  Return: {copied: N, not_found: [codes], price_sources: {code: source_order}}
```

**Method 3: Parse Factory Excel**
```
User uploads factory price list Excel
API: POST /api/orders/{id}/parse-price-excel/
Returns: {entries: [{code, price}]}
User maps codes → order items, clicks Apply
```

### After-Sales Fixed Pricing
- REPLACEMENT items: factory=0, selling=0 (free)
- COMPENSATION items: factory=0, selling=-(original_price) (debit/credit)

---

## 1.7 Packing List Workflow

### Trigger
Order reaches PLAN_PACKING stage → "Packing List" tab appears.

### Flow

```
1. User uploads factory packing list Excel
   API: POST /api/orders/{id}/packing-list/upload/

2. Backend: upload_packing_list()
   - Saves file to uploads/orders/{orderId}/
   - Parses Excel: auto-detects columns (part code, qty, package#)
   - Matches rows to order items by product code
   - Creates PackingList + PackingListItem records
   - Tracks: ordered_qty, factory_ready_qty, loaded_qty, unloaded_qty

3. Frontend displays packing list items in tab
   User can:
   - Edit package numbers
   - Update item statuses (NOT_READY → READY → PACKED)
   - Migrate unloaded items to next order
   - Download packing list (Excel/PDF)

4. FINAL_PI transition requires packing list to exist (hard validation)
```

### Database Impact

| Table | Operation |
|---|---|
| `packing_lists` | INSERT (one per order) |
| `packing_list_items` | INSERT (one per matched item) |

---

# 2. Excel Import Module

## 2.1 File Upload — User Flow & UI Logic

### Trigger
User navigates to `/products/upload-excel` (standalone) or `/orders/:id/upload-excel` (order context).

### UI Response
- Drag & drop zone or file browse button
- Job type toggle: CLIENT_EXCEL / FACTORY_EXCEL
- "Upload & Process" button (or "Upload & AI Map" for factory type)

### Component & Function Tracing

| Frontend Function | File | Purpose |
|---|---|---|
| `onDrop(e)` / `onFileInput(e)` | `ExcelUpload.vue` | Validates .xlsx/.xls, sets `selectedFile` |
| `startUpload()` | `ExcelUpload.vue` | Uploads file, starts processing pipeline |

### API & Backend Sync

```
POST /api/excel/upload/
  Body: FormData { file, order_id?, job_type, use_ai_mapping? }

Backend (Lines 110-174):
  1. Validate file extension
  2. Stream file to disk: UPLOAD_DIR/temp/{uuid}.xlsx
  3. Create ProcessingJob (status=PENDING)
  4. Add background task: process_excel_job(job.id)
  5. Return { id, file_path, status }
```

### Database Impact

| Table | Operation |
|---|---|
| `processing_jobs` | INSERT (status=PENDING) |

---

## 2.2 AI Column Mapping — User Flow & UI Logic

### Trigger
Automatic for FACTORY_EXCEL when `useAiMapping=true`.

### Flow

```
1. Frontend: analyzeColumnsFlow(file_path)
   API: POST /api/excel/analyze-columns/
   Body: { file_path, schema_type: "product", sheet_index: 0 }

2. Backend: analyze_columns()
   - Reads first 3 rows (header + 2 samples)
   - Sends to Claude (Haiku 4.5) with tool_use:
     System: "Map Excel columns to product schema fields"
     Tool: map_columns → returns [{excel_column, schema_field, confidence, reason}]
   - High confidence → auto-confirmed
   - Medium/Low → needs_review list

3. If needs_review.length > 0:
   - Frontend shows ColumnMappingDialog
   - User reviews/corrects mappings
   - On confirm: POST /api/excel/jobs/{id}/reparse/ with final mapping

4. Backend saves mapping as sidecar: {file_path}.column_mapping.json
   Restarts parsing with confirmed column positions
```

### Schema Fields (Product)

| Field | Description | Required |
|---|---|---|
| `product_code` | Manufacturer part number | Yes |
| `barcode` | Client barcode | No |
| `product_name` | English description | Yes |
| `product_name_chinese` | Chinese name (中文名称) | No |
| `dimension` | Size/dimension | No |
| `material` | Material type | No |
| `part_type` | Original/Copy/OEM | No |
| `quantity` | Order quantity | No |
| `unit_price` | Factory price | No |
| `unit_weight_kg` | Weight per unit | No |
| `category` | Product category | No |

### Fallback
If Claude API fails (no API key, network error), falls back to keyword matching:
- Scans headers for keywords like "part", "code", "description", "qty", "price"
- Maps first match per field

---

## 2.3 Excel Parsing — Backend Logic

### CLIENT_EXCEL Processing

```
process_client_excel():
  Input: 3-column Excel (barcode, manufacturer_code, quantity)

  For each row:
    1. Extract barcode, mfr_code, qty
    2. Match product:
       - Search Product.product_code == mfr_code (active, not deleted)
       - If 1 match → MATCHED
       - If >1 match → AMBIGUOUS
       - If 0 + barcode + order context:
         Search ClientProductBarcode for this client
         If found → MATCHED via barcode
       - If still unmatched: check Bin (soft-deleted) → bin_matches
    3. Detect in-file duplicates via seen_codes dict
    4. Set match_status: MATCHED | NEW_PRODUCT | AMBIGUOUS | DUPLICATE
```

### FACTORY_EXCEL Processing (3 Passes)

**Pass 1: Parse Row Data**

```
process_factory_excel():

  _detect_column_map():
    1. Check for AI sidecar file: {file_path}.column_mapping.json
       If exists → use build_col_map() to convert AI mapping to col indices
    2. Else → keyword fallback detection
    Returns: { part_no_1: col_idx, description: col_idx, ... }

  _parse_factory_rows():
    For each row:
      1. Extract all fields via col_map
      2. Variant-aware merging:
         key = (mfr_code, description, dimension)
         If key seen → merge into existing row (append category, fill weight)
      3. Match product via _match_product():
         - Search children (parent_id IS NOT NULL) with same code
         - Try exact match on part_type + dimension + material + description
         - If exact → MATCHED (update child fields)
         - If children exist but no exact → NEW_VARIANT
         - Search parents (parent_id IS NULL) with same code
         - If placeholder parent → NEW_VARIANT
         - If no match → NEW_PRODUCT
      4. Build existing_variants list for UI display
      5. Detect in-file duplicates via seen_codes
      6. Prevent NEW_PRODUCT duplicates (same code creates variant instead)
```

**Pass 2: Image Extraction**

```
extract_images_for_rows():
  Strategy A: Drawing-based (openpyxl)
    - Full workbook load
    - Read ws._images array
    - Map anchor row to result index
    - Save image bytes to disk

  Strategy B: RichData (Excel 365 "Place in Cell")
    - Unzip .xlsx file
    - Parse XML: richValueRel.xml.rels → maps rId to image file
    - Parse XML: richValueRel.xml → ordered rId list
    - Parse XML: rdrichvalue.xml → maps rv index to rel index
    - Parse sheet1.xml → find cells with vm attribute → excel row mapping
    - Extract from xl/media/imageN.png

  Priority: Try drawings first. If none found, try richData.

  For each image:
    - Compute MD5 hash
    - Skip if hash already saved for this product (dedup)
    - Save full image + thumbnail to uploads/products/{product_id}/
    - Create ProductImage record
```

**Pass 3: Image Conflict Detection**

```
_detect_image_conflicts():
  For each MATCHED product with new images:
    - Compare new image hash vs existing DB image hash
    - If different → add to image_conflicts list
    - Store: { product_id, code, existing_hash, existing_thumbnail_url, new_hashes }
```

---

## 2.4 Conflict Resolution Panel — User Flow & UI Logic

### Trigger
Automatic after parsing completes, if `hasConflicts` is true.

### UI Response
- Violet-themed panel: "X part codes need resolution"
- **Bulk Action Bar**: Select All checkbox, counter, 3 bulk buttons
- **Sort controls**: Part Code (asc/desc), Row Count
- **Per-group**: Checkbox, part code, row count badge, existing DB variant badges
- **Per-row**: Checkbox, 3 radio options, expandable edit fields

### Conflict Group Structure

```javascript
conflictGroups = computed(() => {
  // Merges two sources:
  // 1. In-file duplicates (same code, different rows in Excel)
  // 2. DB variant conflicts (code exists in DB with different name/dimension)

  Returns: [{
    code: "GB/T1096-2003",
    rows: [{ _idx, description, chinese_name, dimension, material, ... }],
    existingVariants: [{ id, product_name, dimension, material, is_default }],
    source: "file" | "db" | "both"
  }]
})
```

### 3 Resolution Actions Per Row

| Action | Radio | Effect | Editable Fields |
|---|---|---|---|
| `add_new` | "Add as variant" | Creates new variant under parent | Name, Chinese Name, Dimension, Material, Part Type |
| `replace` | "Replace existing" | Overwrites selected existing variant | None (replaces with row data) |
| `duplicate` | "Duplicate (skip)" | Skips row entirely | None |

### AI Conflict Analysis

```
Trigger: triggerAiConflictAnalysis() on conflict detection

API: POST /api/excel/analyze-conflicts/
Body: { groups: [{ code, rows, existingVariants }] }

Backend: analyze_conflicts()
  1. Format each group as human-readable text
  2. Send to Claude with system prompt (expert parts analyst)
  3. Claude returns per-row: { action, confidence, reason }
  4. Fallback: heuristic analysis if API fails
     - Same name+dimension as existing → duplicate
     - Different spec → add_new

Frontend displays:
  - Auto-selects radio buttons based on AI suggestion
  - Shows "✦ Analysis: {reason}" with confidence badge (green/amber/red)
  - Colored left border: green=add_new, red=duplicate, blue=replace
```

### Bulk Actions

```javascript
applyBulkAction(action):
  For each selected conflict row (selectedConflictRows):
    If action === 'replace':
      Find group → use first existing variant as replace target
    Set variantResolutions[idx] = { action, replace_id }
  Reset processed = false (force re-process)
```

---

## 2.5 Process vs Create — Two-Step Flow

### Step 1: "Process" Button (Frontend Only)

```javascript
processResolutions():
  For each result row:
    1. Apply rowOverrides (field corrections)
    2. Apply variantResolutions:
       - "duplicate" → row._resolved = "SKIP_DUPLICATE"
       - "replace" → row._resolved = "REPLACE", row._replaceTarget = replace_id
       - else → row._resolved = "ADD_VARIANT"
    3. Calculate summary:
       - matched, new_products, new_variants, skipped_duplicates, no_price, images

  Set processed = true
  Set processedResults = { ...results with _resolved marks }

  Clear resolved rows from selectedRows (can't select SKIP/REPLACE rows)
  Show green summary bar with filter buttons
```

**No backend call.** This is a preview-only operation.

### Step 2: "Create Products" Button (Database Write)

```javascript
applyToOrder():
  API: POST /api/excel/apply/{job_id}/
  Body: {
    duplicate_resolutions: { "CODE": "keep_first" },
    image_conflict_resolutions: { "product_id": "replace" },
    variant_resolutions: { "0": { action: "add_new", replace_id: null } },
    row_overrides: { "0": { description: "Corrected name" } }
  }
```

### Backend: apply_parsed_data()

```
Phase 1: Filter Duplicates
  For each code in duplicate_resolutions:
    keep_first → remove all but first occurrence
    keep_last → remove all but last occurrence

Phase 2: Process Each Row
  For each remaining row:
    1. Apply rowOverrides
    2. Skip if variantResolution.action === "duplicate"
    3. Skip if match_status in (AMBIGUOUS, DUPLICATE)

    If NEW_VARIANT:
      _handle_new_variant():
        If replace_id → UPDATE existing variant fields
        Else → CREATE new Product (parent_id=existing_parent, is_default=False)

    If NEW_PRODUCT:
      _handle_new_product():
        Check for soft-deleted → reactivate if found
        Create parent Product (placeholder name: "[CODE]")
        Create child Product (actual variant)

    If order context:
      _handle_order_item():
        Create/update OrderItem with snapshot fields

Phase 3: Post-Apply Image Extraction
  post_apply_extract_images():
    Build excel_row → product_id mapping (now that products have IDs)
    Delete old factory-excel images for these products
    Re-extract fresh images from Excel
    Save to disk + create ProductImage records
```

### Database Impact

| Table | Operation | When |
|---|---|---|
| `products` | INSERT (parent placeholder) | NEW_PRODUCT |
| `products` | INSERT (child variant) | NEW_PRODUCT / NEW_VARIANT |
| `products` | UPDATE (fields) | REPLACE action or MATCHED update |
| `products` | UPDATE (reactivate) | Soft-deleted product found |
| `product_images` | DELETE + INSERT | Post-apply image extraction |
| `order_items` | INSERT / UPDATE | Order context only |
| `client_product_barcodes` | INSERT | Barcode mapping |
| `processing_jobs` | UPDATE (result_data) | Save applied state |

---

## 2.6 Image Extraction Deep Dive

### Two Strategies

**Strategy A: Drawing-Based (openpyxl)**
```
- Opens workbook (full load, not read_only)
- Reads ws._images array (openpyxl internal)
- Each image: anchor_row → excel_row, _data() → bytes
- Works for: "Insert Picture" images anchored to cells
```

**Strategy B: RichData (Excel 365 "Place in Cell")**
```
- Unzips .xlsx (it's a ZIP file)
- Parses 4 XML files:
  1. xl/richData/_rels/richValueRel.xml.rels
     → Maps rId1 → ../media/image1.png
  2. xl/richData/richValueRel.xml
     → Ordered list: [rId1, rId2, rId3, ...]
  3. xl/richData/rdrichvalue.xml
     → Rich value entries: rv[0] → rel index 0, rv[1] → rel index 1, ...
  4. xl/worksheets/sheet1.xml
     → Cells with vm="N" attribute → excel_row mapping
     → vm=1 → rv[0] → rel[0] → rId1 → image1.png
- Extracts raw bytes from xl/media/imageN.png
```

**Priority**: Drawing images checked first. RichData only if no drawings found.

### Deduplication
- MD5 hash computed for every image
- If hash matches existing image for same product → skip
- Prevents duplicate images when re-uploading same Excel

### Post-Apply Re-extraction
- During initial parse: images saved with product_id (if MATCHED)
- NEW_PRODUCT rows have no product_id yet → images not saved
- After apply creates products: `post_apply_extract_images()` runs
- Deletes all old factory-excel images for affected products
- Re-extracts fresh images, now with correct product_ids

---

## 2.7 Chinese Name Handling

### Column Detection
```python
# excel_parser.py - keyword detection
if "名称" in header_val or "chinese" in header_val.lower():
    col_map["chinese_name"] = column_index

# column_mapper.py - AI schema
"product_name_chinese": {
    "description": "Product name in Chinese (中文名称)",
    "required": False
}
```

### Storage
- Extracted per row as `chinese_name` field in result data
- Saved to `Product.product_name_chinese` on create/update
- Displayed in conflict resolution panel next to English name

---

## 2.8 Duplicate Detection Logic

### In-File Duplicates (Same Excel File)
```
Method: seen_codes dict tracking code → first_result_idx
If code encountered again:
  duplicate_codes[code] = [first_idx, current_idx, ...]
  Both rows flagged
```

### Variant-Aware Merging
```
Method: variant_key = (mfr_code, description, dimension)
If same key seen:
  Merge into existing row (append category, fill missing weight)
  Map via merged_row_map for image extraction
Result: Identical rows collapsed, only unique variants remain
```

### DB Matching
```
Method: _match_product() searches by product_code
  Children first (variant lookup) → exact field match or NEW_VARIANT
  Parents next (legacy lookup) → MATCHED or NEW_PRODUCT
  Bin check → soft-deleted product available for reactivation
```

### Image Deduplication
```
Method: MD5 hash comparison
  product_image_hashes[product_id] = Set of saved hashes
  If new hash in set → skip (images_duplicate_skipped++)
```

---

## 2.9 Complete Flow Diagram

```
USER DROPS EXCEL FILE
    │
    ▼
selectFile() → validate extension
    │
    ▼
startUpload()
    │
    ├─── FACTORY_EXCEL + AI? ──► POST /analyze-columns/
    │                               │
    │                     ┌─────────┴─────────┐
    │                     │ needs_review?      │
    │                     ▼ YES               ▼ NO
    │              ColumnMappingDialog    Auto-confirmed
    │                     │                   │
    │                     ▼                   │
    │              POST /jobs/{id}/reparse/◄───┘
    │                     │
    └─── CLIENT_EXCEL ────┤
                          │
                          ▼
              process_excel_job() [Background]
              ├─ Parse rows (match products)
              ├─ Extract images (drawing/richData)
              └─ Detect image conflicts
                          │
                          ▼
              Job → COMPLETED (poll every 2s)
                          │
                          ▼
              onJobCompleted()
              ├─ Auto-select problematic rows
              ├─ Initialize resolutions
              └─ Trigger AI conflict analysis
                          │
              ┌───────────┴───────────┐
              │ Conflicts?            │
              ▼ YES                  ▼ NO
    Conflict Resolution Panel     Skip to results
    ├─ AI auto-selects actions
    ├─ User reviews/overrides
    ├─ Bulk select + apply
    └─ Edit row field overrides
              │
              ▼
    "Process" Button (frontend preview)
    ├─ Marks rows: SKIP / REPLACE / ADD
    ├─ Shows green summary bar
    └─ Filters selectable rows
              │
              ▼
    "Create Products" Button
              │
              ▼
    POST /apply/{job_id}/
    ├─ Filter duplicates
    ├─ Create parents + variants
    ├─ Create order items (if order context)
    ├─ Save barcode mappings
    └─ Post-apply image extraction
              │
              ▼
    Products + Images in DB ✓
```

---

## Appendix: Key API Endpoints Reference

### Orders

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/orders/` | List orders (paginated, filterable) |
| POST | `/api/orders/` | Create order (DRAFT) |
| GET | `/api/orders/{id}/` | Get order detail |
| PUT | `/api/orders/{id}/` | Update order fields |
| DELETE | `/api/orders/{id}/` | Delete draft order |
| POST | `/api/orders/{id}/items/` | Add items to order |
| PUT | `/api/orders/{id}/items/{itemId}/prices/` | Update item pricing |
| POST | `/api/orders/{id}/copy-previous-prices/` | Copy prices from past orders |
| PUT | `/api/orders/{id}/transition/` | Advance order stage |
| PUT | `/api/orders/{id}/go-back/` | Go back one stage |
| PUT | `/api/orders/{id}/jump-to-stage/` | Jump to any unlocked stage |
| PUT | `/api/orders/{id}/reopen/` | Reopen completed order |
| GET | `/api/orders/{id}/timeline/` | Get stage timeline |
| GET | `/api/orders/{id}/next-stages/` | Get available transitions |
| GET | `/api/orders/{id}/financial-summary/` | Financial overview |
| POST | `/api/orders/{id}/bulk-text-add/` | Preview bulk paste items |
| POST | `/api/orders/{id}/bulk-text-add/apply/` | Apply bulk paste items |

### Excel Import

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/excel/upload/` | Upload Excel file |
| POST | `/api/excel/analyze-columns/` | AI column mapping |
| GET | `/api/excel/jobs/{id}/` | Poll job status |
| POST | `/api/excel/jobs/{id}/reparse/` | Re-parse with new column mapping |
| POST | `/api/excel/apply/{id}/` | Apply resolutions to DB |
| DELETE | `/api/excel/jobs/{id}/` | Cancel/delete job |

### Packing

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/orders/{id}/packing-list/upload/` | Upload packing list |
| GET | `/api/orders/{id}/packing-list/` | Get packing list |
| DELETE | `/api/orders/{id}/packing-list/` | Delete packing list |
| POST | `/api/orders/{id}/migrate-items/` | Migrate unloaded items |
| GET | `/api/orders/{id}/packing-list/download-excel/` | Download as Excel |
| GET | `/api/orders/{id}/packing-list/download-pdf/` | Download as PDF |
