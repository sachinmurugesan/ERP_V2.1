# Order Data Protection: Soft-Delete + Snapshot

**Date:** 2026-02-24
**Status:** COMPLETE
**Problem:** Deleting products from the master list destroys order items and images in existing orders. OrderItem only stores `product_id` references, not product data.

## Design

Two-layer protection: soft-delete keeps Product records alive; snapshot fields on OrderItem preserve data independently.

### Part A: Soft-Delete Protection

**Bulk Delete (`products.py`):**
- Check if product is referenced by any non-DRAFT order (via OrderItem → Order.status != DRAFT)
- If referenced: soft-delete only (`deleted_at = now()`, `is_active = False`). Do NOT delete OrderItems, ProductImages, or image files.
- If NOT referenced (or only DRAFT orders): hard-delete as before (remove all FK records, images, files).
- Response includes count: "X deleted, Y archived (used in active orders)."

**Product List:** Already filters `deleted_at.is_(None)` — no change needed.

**Re-upload Reactivation (`excel.py` apply step):**
- When matching products by `product_code`, also search soft-deleted products.
- If match found: clear `deleted_at`, set `is_active = True`, update changed fields.
- Count as "reactivated" in apply summary.

**Image Protection:** Soft-deleted products keep image files on disk and ProductImage DB records.

### Part B: OrderItem Snapshot Columns

**New columns on `order_items` table:**
- `product_code_snapshot` (String(100), nullable)
- `product_name_snapshot` (String(500), nullable)
- `image_path_snapshot` (String(500), nullable)

**Snapshot trigger:** On DRAFT → PENDING_PI transition, populate snapshot fields for all active OrderItems from their linked Product record. Also copy the first ProductImage path.

**Display logic:** Non-DRAFT orders use snapshot fields with fallback:
```
display_code = item.product_code_snapshot or product.product_code
display_name = item.product_name_snapshot or product.product_name
display_image = item.image_path_snapshot or first_product_image.image_path
```

## Files to Modify

1. `backend/models.py` — Add 3 snapshot columns to OrderItem
2. `backend/routers/products.py` — Change bulk-delete to soft-delete for referenced products
3. `backend/routers/orders.py` — Populate snapshots on DRAFT → PENDING_PI transition
4. `backend/routers/excel.py` — Reactivate soft-deleted products during Apply
5. `frontend/src/views/orders/OrderDetail.vue` — Use snapshot fields for display (with fallback)
6. `backend/routers/excel.py` (PI generation) — Use snapshot fields for PI export
