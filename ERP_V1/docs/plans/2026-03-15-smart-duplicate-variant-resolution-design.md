# Smart Duplicate & Variant Resolution System

**Date:** 2026-03-15
**Status:** Approved
**Scope:** Factory Excel import — duplicate detection, variant resolution, two-step apply flow

---

## Problem

The current Excel import has three issues:

1. **False merging**: Rows with same part code but different products (e.g., `GB/T276-94` = 6 different bearings) were silently merged because the "Name" column wasn't detected and the variant key only used `(code, dimension)`.

2. **No "skip as duplicate" option**: Users can only "Keep first / Keep last" for duplicates, or "Add variant / Replace" for variants. No way to say "this is the same part with mismatched content — skip it."

3. **No preview before commit**: Changes go directly to the database when "Create Products" is clicked. No way to preview what the resolved result looks like.

---

## Design

### Three-Option Resolution

Every conflict (duplicate in file OR variant of existing DB product) gets 3 options:

| Option | Meaning | Action |
|--------|---------|--------|
| Add as New Variant | Genuinely different product | Creates new child under same parent |
| Replace Existing | Better/updated data for same product | Overwrites existing variant fields |
| Mark as Duplicate | Same part, mismatched content | Skips — not added to products |

### Editable Variant Fields

When "Add as New Variant" is selected, the row expands to show editable fields:
- Product Name, Chinese Name, Dimension, Material, Part Type
- Default variant toggle

### Two-Step Flow

```
Upload → Parse → Resolution Panel → [Process] → Updated Preview → [Create Products] → DB
```

- **Process**: Frontend-only. Filters/updates the results table based on user choices. No backend call.
- **Create Products**: Sends resolved data to backend `/apply/` endpoint. Commits to DB.

### Resolution Panel Layout

Groups conflicts by part code. Each group shows:
- All rows with that code (from file or existing DB)
- Per-row: 3 radio options + expandable edit fields
- Existing DB variant shown with star marker for context

### Backend Changes

- Parse phase: `duplicate_codes` summary already populated (fixed earlier)
- Apply phase: Accept "duplicate" as resolution action (skip row)
- Apply phase: Accept edited field overrides per row in variant_resolutions
- No new endpoints needed — "Process" is frontend-only

### What stays the same
- Image conflict resolution (replace/keep/both)
- AI column mapping flow
- Core matching logic
- Client Excel import flow (separate, simpler)

---

## Files to Modify

### Backend
1. `backend/routers/excel.py`
   - `ApplyParsedDataRequest`: Add `row_overrides: dict` for edited fields
   - `apply_parsed_data()`: Handle "duplicate" action in variant_resolutions (skip row)
   - `apply_parsed_data()`: Apply row_overrides to product fields during creation

### Frontend
1. `frontend/src/views/orders/ExcelUpload.vue`
   - Replace current duplicate resolution panel (Keep first/last) with unified 3-option panel
   - Replace current variant resolution panel with 3-option panel
   - Add editable fields expansion for "Add as variant" option
   - Add "Process" button that updates preview table
   - Track `processedResults` (filtered/modified copy of results) separately from raw results
   - "Create Products" sends processedResults + resolutions to backend

---

## Data Flow

```
1. Parse returns: result_data[] with match_status per row
                  duplicate_codes[] with in-file duplicate groups

2. Frontend groups conflicts:
   - In-file duplicates: same code, different content within uploaded file
   - DB variants: same code as existing product but different content

3. User resolves each conflict row: add_variant | replace | duplicate

4. [Process] button:
   - Rows marked "duplicate" → removed from preview or grayed out
   - Rows marked "replace" → status updated to show target
   - Rows marked "add_variant" → edited fields applied
   - Results table re-renders with resolved state

5. [Create Products] button:
   - Sends final resolutions + row_overrides to /apply/ endpoint
   - Backend creates/updates/skips accordingly
```
