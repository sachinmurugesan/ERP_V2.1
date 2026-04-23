# Duplicate Detection & Image Management — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add duplicate part-code detection, image hash-based dedup, and image conflict resolution to Factory Excel import, so users are warned about duplicates and can choose how to handle them before applying.

**Architecture:** Parse-time detection + pre-apply resolution. The parse step detects all issues (duplicate codes, duplicate images, image conflicts with existing DB). The UI shows warnings with resolution controls. Apply executes the user's choices.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 (backend), Vue 3 + Tailwind CSS (frontend), SQLite, Pillow for image processing, hashlib for MD5 hashing.

**Design Doc:** `docs/plans/2026-02-26-duplicate-detection-image-management-design.md`

---

### Task 1: Add `image_hash` Column to ProductImage Model

**Files:**
- Modify: `backend/models.py:713` (after `thumbnail_path` line)
- Modify: `backend/main.py:17-23` (migration block)

**Step 1: Add column to model**

In `backend/models.py`, inside class `ProductImage` (line 706), add after `thumbnail_path` (line 713):

```python
image_hash: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
```

**Step 2: Add ALTER TABLE migration**

In `backend/main.py`, after the existing `thumbnail_path` migration (line 22), add:

```python
if "image_hash" not in _pi_cols:
    with engine.begin() as _conn:
        _conn.execute(text("ALTER TABLE product_images ADD COLUMN image_hash VARCHAR(32)"))
```

**Step 3: Verify migration runs**

Run: `cd C:/Users/sachi/OneDrive/antigravity/Workflow/backend && python -c "from main import app; print('Migration OK')"`
Expected: No errors, `image_hash` column added to DB.

**Step 4: Commit**

```bash
git add backend/models.py backend/main.py
git commit -m "feat: add image_hash column to ProductImage for dedup"
```

---

### Task 2: Add Duplicate Code Detection to Factory Excel Parse

**Files:**
- Modify: `backend/routers/excel.py:400-494` (inside `_process_factory_excel`, PASS 1 row loop)

**Step 1: Add `seen_codes` tracking after `results = []` (line 400)**

Insert after line 402 (`bin_product_ids = []`):

```python
seen_codes = {}  # mfr_code -> first index in results[]
duplicate_codes = {}  # mfr_code -> list of result indices
```

**Step 2: Add duplicate detection inside the row loop**

After `mfr_code` is computed (line 415) and before the `if not mfr_code and not barcode:` check (line 432), insert:

```python
        # Detect duplicate codes within this file
        is_dup_in_file = False
        if mfr_code and mfr_code in seen_codes:
            is_dup_in_file = True
            if mfr_code not in duplicate_codes:
                duplicate_codes[mfr_code] = [seen_codes[mfr_code]]
            duplicate_codes[mfr_code].append(len(results))  # will be this row's index
```

**Step 3: Store the duplicate flag in each result row**

In the `results.append({...})` block (line 476), add the field:

```python
            "is_duplicate_in_file": is_dup_in_file,
```

**Step 4: Track first-seen codes**

After `results.append({...})` (after line 489), add:

```python
        if mfr_code and mfr_code not in seen_codes:
            seen_codes[mfr_code] = len(results) - 1
```

**Step 5: Add `duplicate_codes` to stored parse result**

Before `job.result_summary = json.dumps(summary)` (line 636), add duplicate_codes to summary:

```python
    summary["duplicate_codes"] = [
        {"code": code, "indices": indices, "rows": [results[i]["row"] for i in indices]}
        for code, indices in duplicate_codes.items()
    ]
```

Also add a count to the summary:

```python
    summary["duplicate_code_count"] = len(duplicate_codes)
```

**Step 6: Verify by checking parse output**

Restart backend, upload the factory Excel that has known duplicates. Check `/excel/jobs/{id}/status/` response — `result_summary` should include `duplicate_codes` array and `duplicate_code_count`.

**Step 7: Commit**

```bash
git add backend/routers/excel.py
git commit -m "feat: detect duplicate part codes in factory Excel parse"
```

---

### Task 3: Add Image Hash Computation & Auto-Dedup in Parse PASS 2

**Files:**
- Modify: `backend/routers/excel.py:1` (add `import hashlib`)
- Modify: `backend/routers/excel.py:496-624` (PASS 2 image extraction)

**Step 1: Add hashlib import**

At top of `backend/routers/excel.py`, after `import json` (line 7), add:

```python
import hashlib
```

Also add `from collections import defaultdict` if not already imported.

**Step 2: Add hash tracking data structures**

After `saved_parse_pids = set()` (line 513), add:

```python
            product_image_hashes = defaultdict(set)  # pid -> set of image hashes
```

**Step 3: Compute hash and dedup**

After `image_data = img._data()` succeeds (line 557, after the `if not image_data: continue` on line 561), insert BEFORE `pil_img = PILImage.open(...)` (line 564):

```python
                        # Compute content hash for dedup
                        image_hash = hashlib.md5(image_data).hexdigest()

                        # Auto-dedup: skip exact duplicate images for same product
                        if image_hash in product_image_hashes.get(pid, set()):
                            summary["images_duplicate_skipped"] = summary.get("images_duplicate_skipped", 0) + 1
                            continue

                        product_image_hashes[pid].add(image_hash)
```

**Step 4: Store hash on the DB record**

In the `ProductImage(...)` constructor (line 601-611), add:

```python
                            image_hash=image_hash,
```

**Step 5: Remove the old `saved_parse_pids` single-image-per-product restriction**

Remove or comment out these lines that prevent multiple images per product:
- Line 547-549: `if pid in saved_parse_pids: ... continue` — REMOVE this block
- Line 613: `saved_parse_pids.add(pid)` — REMOVE

The hash-based dedup replaces this. Multiple *different* images per product are now allowed.

**Step 6: Update summary to show dedup stats**

The `images_duplicate_skipped` counter is already being set in step 3. Verify it appears in `result_summary`.

**Step 7: Commit**

```bash
git add backend/routers/excel.py
git commit -m "feat: hash-based image dedup in parse PASS 2 (allows multi-image)"
```

---

### Task 4: Add Image Conflict Detection (Parse PASS 3)

**Files:**
- Modify: `backend/routers/excel.py:625-639` (after PASS 2, before storing results)

**Step 1: Add PASS 3 — image conflict detection**

After the PASS 2 `except` block closes (line 628) and before `db.commit()` (line 630), insert:

```python
    # PASS 3: Detect image conflicts with existing DB images
    image_conflicts = []
    # Collect product IDs that already exist in DB and have new images
    matched_pids_with_images = set()
    for r in results:
        pid = r.get("product_id")
        if pid and r.get("has_image"):
            matched_pids_with_images.add(pid)

    if matched_pids_with_images:
        existing_db_images = db.query(ProductImage).filter(
            ProductImage.product_id.in_(list(matched_pids_with_images)),
            ProductImage.source_type == "FACTORY_EXCEL",
        ).all()

        existing_hash_map = {}  # pid -> {hash, thumbnail_url}
        for db_img in existing_db_images:
            if db_img.image_hash:  # only compare if we have a hash
                existing_hash_map[db_img.product_id] = {
                    "hash": db_img.image_hash,
                    "thumbnail_url": f"/uploads/{db_img.thumbnail_path or db_img.image_path}",
                }

        for pid, new_hashes in product_image_hashes.items():
            if pid in existing_hash_map:
                existing = existing_hash_map[pid]
                # Check if any new hash matches the existing one
                if existing["hash"] not in new_hashes:
                    # Different image — this is a conflict
                    # Find the code for this product
                    code = ""
                    for r in results:
                        if r.get("product_id") == pid:
                            code = r.get("manufacturer_code", "")
                            break
                    image_conflicts.append({
                        "product_id": pid,
                        "code": code,
                        "existing_hash": existing["hash"],
                        "existing_thumbnail_url": existing["thumbnail_url"],
                        "new_hashes": list(new_hashes),
                    })

    summary["image_conflicts"] = image_conflicts
    summary["image_conflict_count"] = len(image_conflicts)
```

**Step 2: Ensure `product_image_hashes` is accessible in PASS 3 scope**

The `product_image_hashes` dict is created inside the `try:` block of PASS 2 (step 3 of Task 3). Move its initialization to BEFORE the try block (after line 505, before line 506) so it's accessible in PASS 3:

```python
    product_image_hashes = defaultdict(set)  # pid -> set of image hashes
```

And remove the one inside the `if ws_full._images:` block.

**Step 3: Commit**

```bash
git add backend/routers/excel.py
git commit -m "feat: detect image conflicts between new Excel and existing DB images"
```

---

### Task 5: Update Apply Endpoint to Accept Resolution Choices

**Files:**
- Modify: `backend/routers/excel.py:645-648` (ApplyParsedDataRequest)
- Modify: `backend/routers/excel.py:676-782` (apply_parsed_data loop)

**Step 1: Extend the request model**

Replace `ApplyParsedDataRequest` (lines 645-648) with:

```python
class ApplyParsedDataRequest(BaseModel):
    job_id: str
    create_new_products: bool = True
    duplicate_resolutions: dict = {}  # {"mfr_code": "keep_first" | "keep_last"}
    image_conflict_resolutions: dict = {}  # {"product_id": "replace" | "keep_current" | "keep_both"}
```

**Step 2: Filter duplicate rows before the main loop**

After `results = json.loads(job.result_data)` (line 676) and before the main `for row_data in results:` loop (line 679), insert:

```python
    # Filter out duplicate rows based on user's resolution choices
    if data.duplicate_resolutions:
        skip_indices = set()
        for mfr_code, resolution in data.duplicate_resolutions.items():
            # Find all indices for this duplicate code
            dup_indices = [i for i, r in enumerate(results) if r.get("manufacturer_code") == mfr_code]
            if len(dup_indices) < 2:
                continue
            if resolution == "keep_first":
                skip_indices.update(dup_indices[1:])  # skip all but first
            elif resolution == "keep_last":
                skip_indices.update(dup_indices[:-1])  # skip all but last
        # Remove skipped rows (iterate in reverse to preserve indices)
        for idx in sorted(skip_indices, reverse=True):
            results.pop(idx)
        applied["duplicates_resolved"] = len(skip_indices)
```

**Step 3: Update `applied` dict initialization**

At line 677, update to include new counters:

```python
    applied = {
        "items_added": 0, "items_updated": 0, "products_created": 0,
        "products_reactivated": 0, "barcodes_saved": 0, "skipped": 0,
        "duplicates_resolved": 0, "images_saved": 0,
        "images_replaced": 0, "images_kept_both": 0,
    }
```

**Step 4: Commit**

```bash
git add backend/routers/excel.py
git commit -m "feat: apply endpoint accepts duplicate resolution choices"
```

---

### Task 6: Update Post-Apply Image Saving with Conflict Resolution & Hashing

**Files:**
- Modify: `backend/routers/excel.py:784-920` (post-apply image extraction section)

**Step 1: Pass `data` to the image saving section**

The `data` variable (ApplyParsedDataRequest) is already in scope. No change needed.

**Step 2: Add hash computation in post-apply image extraction**

After `image_data = img._data()` succeeds (line 851, after `if not image_data: continue`), insert:

```python
                    # Compute content hash
                    image_hash = hashlib.md5(image_data).hexdigest()
```

**Step 3: Replace the `saved_product_ids` single-image block with conflict-aware logic**

Replace the block at lines 846-847 (`if pid in saved_product_ids: continue`) with:

```python
                    # Check image conflict resolution for existing products
                    resolution = data.image_conflict_resolutions.get(pid, "replace")

                    if pid in existing_pids:
                        if resolution == "keep_current":
                            continue  # User chose to keep existing image
                        elif resolution == "replace":
                            # Delete existing images for this product
                            old_images = db.query(ProductImage).filter(
                                ProductImage.product_id == pid,
                                ProductImage.source_type == "FACTORY_EXCEL",
                            ).all()
                            for old_img in old_images:
                                old_file = os.path.join(str(UPLOAD_DIR), old_img.image_path)
                                if os.path.exists(old_file):
                                    os.remove(old_file)
                                if old_img.thumbnail_path:
                                    old_thumb = os.path.join(str(UPLOAD_DIR), old_img.thumbnail_path)
                                    if os.path.exists(old_thumb):
                                        os.remove(old_thumb)
                                db.delete(old_img)
                            applied["images_replaced"] = applied.get("images_replaced", 0) + 1
                        elif resolution == "keep_both":
                            applied["images_kept_both"] = applied.get("images_kept_both", 0) + 1
                            # Fall through to save new image alongside existing

                    # Hash-based dedup: skip if same hash already saved for this product in this batch
                    if pid in saved_product_ids:
                        # Check if this exact image was already saved
                        existing_hash = db.query(ProductImage.image_hash).filter(
                            ProductImage.product_id == pid,
                            ProductImage.image_hash == image_hash,
                        ).first()
                        if existing_hash:
                            continue
```

**Step 4: Store hash on the ProductImage record**

In the `ProductImage(...)` constructor (lines 895-905), add:

```python
                        image_hash=image_hash,
```

**Step 5: Don't skip multi-image products**

The existing `saved_product_ids.add(pid)` (line 906) should remain — it tracks which products we've seen, but the dedup logic now uses hash comparison instead of blanket skip.

**Step 6: Commit**

```bash
git add backend/routers/excel.py
git commit -m "feat: post-apply image saving with conflict resolution and hashing"
```

---

### Task 7: Frontend — Duplicate Code Warning Banner

**Files:**
- Modify: `frontend/src/views/orders/ExcelUpload.vue` (script + template)

**Step 1: Add reactive state for duplicate resolutions**

After `const selectAll = ref(false)` (line 34), add:

```javascript
// Duplicate code resolution choices
const duplicateResolutions = ref({})  // { mfr_code: 'keep_first' | 'keep_last' }
```

**Step 2: Add computed for duplicate code groups**

After `binProductIds` computed (line 291), add:

```javascript
// Duplicate codes detected within the Excel file
const duplicateCodeGroups = computed(() => {
  return results.value?.result_summary?.duplicate_codes || []
})
```

**Step 3: Initialize default resolutions when parse completes**

In the polling success handler (where `autoSelectProblematicRows(data)` is called, around line 128), add after that call:

```javascript
    // Initialize duplicate resolutions to 'keep_first' by default
    if (data.result_summary?.duplicate_codes) {
      const resolutions = {}
      data.result_summary.duplicate_codes.forEach(dup => {
        resolutions[dup.code] = 'keep_first'
      })
      duplicateResolutions.value = resolutions
    }
```

**Step 4: Add the Duplicate Code Warning Banner in template**

After the existing Duplicate/Ambiguous Warning Banner (line 525, before `<!-- Results Table -->`), add:

```html
      <!-- Duplicate Part Code Resolution Banner -->
      <div
        v-if="duplicateCodeGroups.length > 0 && !applied"
        class="mb-3 bg-orange-50 border border-orange-200 rounded-xl p-4"
      >
        <div class="flex items-center gap-2 mb-3">
          <i class="pi pi-copy text-orange-600" />
          <span class="text-sm font-semibold text-orange-800">
            {{ duplicateCodeGroups.length }} duplicate part code{{ duplicateCodeGroups.length > 1 ? 's' : '' }} found in this Excel
          </span>
        </div>
        <div class="space-y-3">
          <div
            v-for="dup in duplicateCodeGroups"
            :key="dup.code"
            class="bg-white rounded-lg border border-orange-100 p-3"
          >
            <div class="text-xs font-mono font-medium text-gray-800 mb-2">
              {{ dup.code }} <span class="text-gray-400">— rows {{ dup.rows.join(', ') }}</span>
            </div>
            <div class="flex gap-4">
              <label class="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  :name="'dup_' + dup.code"
                  value="keep_first"
                  :checked="duplicateResolutions[dup.code] === 'keep_first'"
                  @change="duplicateResolutions[dup.code] = 'keep_first'"
                  class="text-orange-600"
                />
                Keep first (row {{ dup.rows[0] }})
              </label>
              <label class="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  :name="'dup_' + dup.code"
                  value="keep_last"
                  :checked="duplicateResolutions[dup.code] === 'keep_last'"
                  @change="duplicateResolutions[dup.code] = 'keep_last'"
                  class="text-orange-600"
                />
                Keep last (row {{ dup.rows[dup.rows.length - 1] }})
              </label>
            </div>
          </div>
        </div>
      </div>
```

**Step 5: Commit**

```bash
git add frontend/src/views/orders/ExcelUpload.vue
git commit -m "feat: duplicate part code warning banner with keep first/last resolution"
```

---

### Task 8: Frontend — Image Conflict Resolution Panel

**Files:**
- Modify: `frontend/src/views/orders/ExcelUpload.vue` (script + template)

**Step 1: Add reactive state for image conflict resolutions**

After `duplicateResolutions` ref (added in Task 7), add:

```javascript
// Image conflict resolution choices
const imageConflictResolutions = ref({})  // { product_id: 'replace' | 'keep_current' | 'keep_both' }
```

**Step 2: Add computed for image conflicts**

After `duplicateCodeGroups` computed (added in Task 7), add:

```javascript
// Image conflicts between new Excel and existing DB images
const imageConflicts = computed(() => {
  return results.value?.result_summary?.image_conflicts || []
})
```

**Step 3: Initialize default resolutions when parse completes**

In the same polling success handler (alongside duplicate resolution init from Task 7), add:

```javascript
    // Initialize image conflict resolutions to 'replace' by default
    if (data.result_summary?.image_conflicts) {
      const resolutions = {}
      data.result_summary.image_conflicts.forEach(conflict => {
        resolutions[conflict.product_id] = 'replace'
      })
      imageConflictResolutions.value = resolutions
    }
```

**Step 4: Add Image Conflict Panel in template**

After the duplicate code banner (added in Task 7), add:

```html
      <!-- Image Conflict Resolution Panel -->
      <div
        v-if="imageConflicts.length > 0 && !applied"
        class="mb-3 bg-blue-50 border border-blue-200 rounded-xl p-4"
      >
        <div class="flex items-center gap-2 mb-3">
          <i class="pi pi-images text-blue-600" />
          <span class="text-sm font-semibold text-blue-800">
            {{ imageConflicts.length }} product{{ imageConflicts.length > 1 ? 's have' : ' has' }} different images than currently saved
          </span>
        </div>
        <div class="space-y-3">
          <div
            v-for="conflict in imageConflicts"
            :key="conflict.product_id"
            class="bg-white rounded-lg border border-blue-100 p-3"
          >
            <div class="flex items-center gap-4 mb-2">
              <div class="flex items-center gap-3">
                <div class="text-center">
                  <img
                    :src="conflict.existing_thumbnail_url"
                    class="w-12 h-12 object-contain rounded border"
                    alt="Current"
                  />
                  <div class="text-[10px] text-gray-400 mt-0.5">Current</div>
                </div>
                <i class="pi pi-arrow-right text-gray-400 text-xs" />
                <div class="text-center">
                  <div class="w-12 h-12 bg-blue-100 rounded border flex items-center justify-center">
                    <i class="pi pi-image text-blue-400" />
                  </div>
                  <div class="text-[10px] text-gray-400 mt-0.5">New</div>
                </div>
              </div>
              <div class="text-xs font-mono text-gray-700">{{ conflict.code }}</div>
            </div>
            <div class="flex gap-4">
              <label class="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  :name="'img_' + conflict.product_id"
                  value="replace"
                  :checked="imageConflictResolutions[conflict.product_id] === 'replace'"
                  @change="imageConflictResolutions[conflict.product_id] = 'replace'"
                  class="text-blue-600"
                />
                Replace with new
              </label>
              <label class="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  :name="'img_' + conflict.product_id"
                  value="keep_current"
                  :checked="imageConflictResolutions[conflict.product_id] === 'keep_current'"
                  @change="imageConflictResolutions[conflict.product_id] = 'keep_current'"
                  class="text-blue-600"
                />
                Keep current
              </label>
              <label class="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  :name="'img_' + conflict.product_id"
                  value="keep_both"
                  :checked="imageConflictResolutions[conflict.product_id] === 'keep_both'"
                  @change="imageConflictResolutions[conflict.product_id] = 'keep_both'"
                  class="text-blue-600"
                />
                Keep both
              </label>
            </div>
          </div>
        </div>
      </div>
```

**Step 5: Commit**

```bash
git add frontend/src/views/orders/ExcelUpload.vue
git commit -m "feat: image conflict resolution panel with side-by-side comparison"
```

---

### Task 9: Frontend — Update Apply Payload & Summary Cards

**Files:**
- Modify: `frontend/src/views/orders/ExcelUpload.vue` (script + template)

**Step 1: Update the `applyToOrder` function to send resolutions**

Replace the payload in `applyToOrder()` (lines 175-178) with:

```javascript
    const { data } = await excelApi.applyParsedData(jobId.value, {
      job_id: jobId.value,
      create_new_products: true,
      duplicate_resolutions: duplicateResolutions.value,
      image_conflict_resolutions: imageConflictResolutions.value,
    })
```

**Step 2: Update summary cards to show dedup stats**

In the `summaryItems` computed (lines 275-287), update the Images entry and add dedup info:

```javascript
const summaryItems = computed(() => {
  if (!results.value?.result_summary) return []
  const s = results.value.result_summary
  return [
    { label: 'Matched', value: s.matched || 0, color: 'text-green-600' },
    { label: 'New Products', value: s.new_products || 0, color: 'text-blue-600' },
    { label: 'Dup Codes', value: s.duplicate_code_count || 0, color: 'text-orange-600' },
    { label: 'Ambiguous', value: s.ambiguous || 0, color: 'text-red-600' },
    { label: 'No Price', value: s.no_price || 0, color: 'text-orange-600' },
    { label: 'Images', value: s.images_extracted || 0, color: 'text-purple-600' },
    { label: 'Img Dupes Removed', value: s.images_duplicate_skipped || 0, color: 'text-purple-400' },
    { label: 'Img Conflicts', value: s.image_conflict_count || 0, color: 'text-blue-600' },
    { label: 'Errors', value: s.errors || 0, color: 'text-red-500' },
  ].filter(i => i.value > 0)
})
```

**Step 3: Update applied results to show resolution stats**

In the applied results section (lines 635-664), add after the "Images Saved" block (line 655):

```html
          <div v-if="applied.duplicates_resolved > 0">
            <div class="text-lg font-bold text-orange-600">{{ applied.duplicates_resolved }}</div>
            <div class="text-xs text-gray-500">Duplicates Resolved</div>
          </div>
          <div v-if="applied.images_replaced > 0">
            <div class="text-lg font-bold text-blue-600">{{ applied.images_replaced }}</div>
            <div class="text-xs text-gray-500">Images Replaced</div>
          </div>
          <div v-if="applied.images_kept_both > 0">
            <div class="text-lg font-bold text-blue-400">{{ applied.images_kept_both }}</div>
            <div class="text-xs text-gray-500">Images Kept Both</div>
          </div>
```

**Step 4: Commit**

```bash
git add frontend/src/views/orders/ExcelUpload.vue
git commit -m "feat: send resolution payload on apply, update summary cards and applied results"
```

---

### Task 10: Backfill Image Hashes for Existing ProductImage Records

**Files:**
- Modify: `backend/main.py` (one-time migration script)

**Step 1: Add hash backfill migration**

After the `image_hash` column migration (added in Task 1), add:

```python
# Backfill image_hash for existing ProductImage records
from models import ProductImage as _PI
from sqlalchemy.orm import Session as _Sess
_backfill_sess = _Sess(bind=engine)
try:
    _unhashed = _backfill_sess.query(_PI).filter(_PI.image_hash.is_(None), _PI.image_path.isnot(None)).all()
    if _unhashed:
        import hashlib as _hl
        _count = 0
        for _img in _unhashed:
            _fpath = UPLOAD_DIR / _img.image_path
            if _fpath.exists():
                _img.image_hash = _hl.md5(_fpath.read_bytes()).hexdigest()
                _count += 1
        if _count:
            _backfill_sess.commit()
finally:
    _backfill_sess.close()
del _backfill_sess
```

**Step 2: Verify backfill runs**

Run: `cd C:/Users/sachi/OneDrive/antigravity/Workflow/backend && python -c "from main import app; print('Backfill OK')"`
Then verify: `python -c "from database import SessionLocal; from models import ProductImage; s=SessionLocal(); print(s.query(ProductImage).filter(ProductImage.image_hash.isnot(None)).count(), 'hashed'); s.close()"`

**Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: backfill image_hash for existing ProductImage records"
```

---

### Task 11: End-to-End Verification

**Step 1: Restart backend**

Kill existing uvicorn processes and restart:
```bash
cd C:/Users/sachi/OneDrive/antigravity/Workflow/backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Step 2: Test with factory Excel containing duplicates**

Upload the factory Excel file. Verify:
- Parse summary shows `duplicate_code_count` > 0
- Parse summary shows `images_extracted` count (unique images only)
- Parse summary shows `images_duplicate_skipped` count
- `duplicate_codes` array contains the known duplicate codes with correct row numbers

**Step 3: Test frontend UI**

- Duplicate code banner appears with radio buttons (keep first / keep last)
- Summary cards show "Dup Codes" and "Img Dupes Removed" counts
- Image conflict panel appears if re-importing (different images for existing products)

**Step 4: Test apply with resolutions**

Click Apply with default selections. Verify:
- Duplicate rows are filtered correctly (keep_first skips later rows)
- Image conflicts are resolved per user choice
- Applied results show correct counts for duplicates_resolved, images_replaced, etc.

**Step 5: Verify files on disk**

Check `backend/uploads/products/{pid}/` directories:
- Each product has only the expected images (no duplicates)
- Thumbnails exist alongside full-res images
- Products with "replace" resolution have new images, not old ones

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete duplicate detection & image management system"
```
