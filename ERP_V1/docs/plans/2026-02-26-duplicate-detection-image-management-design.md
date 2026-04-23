# Duplicate Detection & Image Management Design

**Date**: 2026-02-26
**Status**: Approved
**Approach**: Parse-Time Detection + Pre-Apply Resolution (Approach A)

## Problem Statement

The Factory Excel import has several gaps:
1. **No duplicate code detection** — FACTORY_EXCEL parse doesn't track `seen_codes` (unlike CLIENT_EXCEL). Duplicate part codes in the same file silently create issues.
2. **No image dedup** — Identical images anchored to the same row in Excel get saved multiple times per product.
3. **No image conflict detection** — Re-importing an Excel with changed images silently overwrites or duplicates without user awareness.
4. **No multi-image support from Excel** — Legitimate multiple images per product (e.g., front/side views) were being treated as duplicates and blocked.

## User Requirements (from brainstorming Q&A)

| Question | Decision |
|----------|----------|
| Duplicate codes in same Excel | Warn & let user choose: keep first or keep last |
| Keep both duplicate codes? | Never — codes must be unique |
| Re-import with different image | Ask user each time (side-by-side comparison) |
| Multiple photos per product | Excel supports multiple + manual upload |
| Duplicate image detection | Hash-based auto-dedup (MD5) |

## Architecture: Parse-Time Detection + Pre-Apply Resolution

All detection happens during parse. User resolves everything in the parse summary UI before clicking Apply. Apply executes user's choices cleanly.

```
Excel Upload → Parse (detect all issues) → Review & Resolve → Apply (execute choices)
                  │                              │
                  ├─ Duplicate codes found        ├─ User picks keep first/last
                  ├─ Exact duplicate images       │   (auto: hash dedup)
                  ├─ Image conflicts with DB      ├─ User picks replace/keep/both
                  └─ Multi-image per product      └─ All kept (different hashes)
```

## Data Model Changes

### ProductImage table — add `image_hash` column

```sql
ALTER TABLE product_images ADD COLUMN image_hash VARCHAR(32);
```

- MD5 hex digest of raw image bytes
- Stored on every ProductImage (import and manual upload)
- Enables instant duplicate detection: same hash + same product_id = duplicate

### Parse Result JSON — new keys

```json
{
  "results": [...],
  "summary": {...},
  "duplicate_codes": [
    {
      "code": "W3.5D-01D-01-07-00 (Swing)",
      "rows": [15, 42],
      "indices": [14, 41]
    }
  ],
  "image_conflicts": [
    {
      "product_id": "abc-123",
      "code": "XYZ-001",
      "existing_hash": "a1b2c3...",
      "existing_thumbnail_url": "/uploads/products/abc-123/thumb_img.jpg",
      "new_hash": "d4e5f6...",
      "new_image_preview": "base64_or_temp_url"
    }
  ]
}
```

## Backend Parse Changes

### 1. Duplicate Code Detection (in `_process_factory_excel`)

Add `seen_codes = {}` tracking (matching CLIENT_EXCEL pattern):

```python
seen_codes = {}  # code -> first row index

for idx, row in enumerate(rows):
    code = row["code"]
    if code in seen_codes:
        results[idx]["is_duplicate"] = True
        results[idx]["first_occurrence_row"] = seen_codes[code]
        # Still parse the row (user needs to see it)
    else:
        seen_codes[code] = idx
```

Build `duplicate_codes` list from flagged results.

### 2. Image Auto-Dedup (parse PASS 2)

After reading `img._data()`, compute hash:

```python
import hashlib

raw_bytes = img._data()
image_hash = hashlib.md5(raw_bytes).hexdigest()

# Track per-product
product_image_hashes = defaultdict(set)  # pid -> set of hashes

if image_hash in product_image_hashes[pid]:
    # Exact duplicate — auto-skip
    summary["images_duplicate_skipped"] += 1
    continue

product_image_hashes[pid].add(image_hash)
# Save image as normal, store hash
```

### 3. Image Conflict Detection (new PASS 3)

After images extracted, before returning parse result:

```python
# For products that already exist in DB
existing_product_ids = [r["matched_product_id"] for r in results if r.get("matched_product_id")]
existing_images = db.query(ProductImage).filter(
    ProductImage.product_id.in_(existing_product_ids),
    ProductImage.source_type == "FACTORY_EXCEL"
).all()

existing_image_map = {}  # pid -> {hash, thumbnail_url}
for img in existing_images:
    existing_image_map[img.product_id] = {
        "hash": img.image_hash,
        "thumbnail_url": f"/uploads/{img.thumbnail_path or img.image_path}"
    }

image_conflicts = []
for pid, new_hashes in product_image_hashes.items():
    if pid in existing_image_map:
        existing = existing_image_map[pid]
        if existing["hash"] and existing["hash"] not in new_hashes:
            image_conflicts.append({
                "product_id": pid,
                "code": ...,
                "existing_hash": existing["hash"],
                "existing_thumbnail_url": existing["thumbnail_url"],
                "new_hash": list(new_hashes)[0],
                "new_image_preview": ...
            })
```

## Frontend UI Changes (ExcelUpload.vue)

### A. Duplicate Code Warning Banner

Amber banner shown above product table when `duplicate_codes.length > 0`:

```
⚠️ 2 duplicate part codes found in this Excel

W3.5D-01D-01-07-00 (Swing) — rows 15, 42
  ○ Keep first (row 15)  ○ Keep last (row 42)

W2.5K-02HB-10-05-01-00 — rows 8, 51
  ○ Keep first (row 8)   ○ Keep last (row 51)
```

- Default: "Keep first"
- Duplicate rows highlighted with amber background in product table
- Apply button disabled until all duplicates have a selection

### B. Image Conflict Panel

Shown when `image_conflicts.length > 0`:

```
📷 5 products have different images than currently saved

[Current thumb] → [New thumb]   XYZ-123
  ○ Keep current  ○ Replace with new  ○ Keep both

[Current thumb] → [New thumb]   ABC-456
  ○ Keep current  ○ Replace with new  ○ Keep both
```

- Default: "Replace with new"
- Side-by-side thumbnail comparison
- Doesn't block Apply (has default selection)

### C. Updated Summary Cards

```
Images Found: 41 unique  |  Duplicates Auto-Removed: 30  |  Conflicts: 5 ⚠️
```

## Backend Apply Changes

### Apply Payload

```json
{
  "duplicate_resolutions": {
    "W3.5D-01D-01-07-00 (Swing)": "keep_first",
    "W2.5K-02HB-10-05-01-00": "keep_last"
  },
  "image_conflict_resolutions": {
    "product_id_abc": "replace",
    "product_id_def": "keep_current",
    "product_id_ghi": "keep_both"
  }
}
```

### Apply Logic

1. **Duplicate codes**: Filter results list based on resolutions before creating products
   - `keep_first`: skip all indices except the first for that code
   - `keep_last`: skip all indices except the last for that code

2. **Image saving**: After product creation, during image save phase:
   - `replace`: delete old ProductImage records + files from disk, save new
   - `keep_current`: skip saving new image for this product
   - `keep_both`: save new image alongside existing

3. **Always**: Store `image_hash` on every saved ProductImage record

### Updated Response

```json
{
  "products_created": 40,
  "products_reactivated": 12,
  "duplicates_skipped": 2,
  "images_saved": 38,
  "images_replaced": 3,
  "images_kept_existing": 1,
  "images_kept_both": 1
}
```

## Manual Upload Hash Support

In `products.py` image upload endpoint, also compute and store `image_hash`:

```python
raw_bytes = await file.read()
image_hash = hashlib.md5(raw_bytes).hexdigest()
# ... save image ...
db_image.image_hash = image_hash
```

## Out of Scope (Future)

- Cross-product duplicate image detection (same image on different products)
- Bulk image management page
- Perceptual/similarity hashing (only exact MD5 match for now)
- Image versioning / history

## Files to Modify

| File | Change |
|------|--------|
| `backend/models.py` | Add `image_hash` column to ProductImage |
| `backend/main.py` | ALTER TABLE migration for `image_hash` |
| `backend/routers/excel.py` | Duplicate code detection, image hashing, conflict detection, apply resolution logic |
| `backend/routers/products.py` | Hash on manual upload, return hash in API |
| `frontend/src/views/orders/ExcelUpload.vue` | Duplicate banner, image conflict panel, summary cards, resolution payload |
