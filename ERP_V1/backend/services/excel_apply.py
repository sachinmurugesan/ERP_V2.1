"""
Apply parsed Excel results to the database.

Creates products, order items, barcode mappings, and extracts images
for newly created products.
"""
import json
import logging
import os
from typing import Optional

from sqlalchemy.orm import Session

from config import UPLOAD_DIR
from enums import ApprovalStatus, OrderItemStatus, OrderStatus
from models import (
    Order, Product, OrderItem, ClientProductBarcode,
    ProductImage, ProcessingJob,
)
from services.image_extractor import post_apply_extract_images

logger = logging.getLogger(__name__)


def apply_parsed_data(
    job: ProcessingJob,
    order: Optional[Order],
    results: list,
    duplicate_resolutions: dict,
    image_conflict_resolutions: dict,
    variant_resolutions: dict,
    row_overrides: dict,
    create_new_products: bool,
    db: Session,
) -> dict:
    """Apply parsed Excel results to the database.

    Returns a dict with counts of actions taken.
    """
    applied = {
        "items_added": 0, "items_updated": 0, "products_created": 0,
        "products_reactivated": 0, "barcodes_saved": 0, "skipped": 0,
        "duplicates_resolved": 0, "images_saved": 0, "images_unchanged": 0,
        "images_replaced": 0, "images_kept_both": 0,
    }
    saved_barcodes = set()

    # Filter out duplicate rows based on user's resolution choices
    if duplicate_resolutions:
        skip_indices = set()
        for mfr_code, resolution in duplicate_resolutions.items():
            dup_indices = [i for i, r in enumerate(results) if r.get("manufacturer_code") == mfr_code]
            if len(dup_indices) < 2:
                continue
            if resolution == "keep_first":
                skip_indices.update(dup_indices[1:])
            elif resolution == "keep_last":
                skip_indices.update(dup_indices[:-1])
        for idx in sorted(skip_indices, reverse=True):
            results.pop(idx)
        applied["duplicates_resolved"] = len(skip_indices)

    for i, row_data in enumerate(results):
        # Apply user-edited field overrides
        overrides = row_overrides.get(str(i), {})
        if overrides:
            for field_key, field_val in overrides.items():
                if field_key in row_data and field_val is not None:
                    row_data[field_key] = field_val

        mfr_code = row_data.get("manufacturer_code", "")
        barcode = row_data.get("barcode", "")
        qty = row_data.get("quantity", 0)
        product_id = row_data.get("product_id")
        match_status = row_data.get("match_status", "")
        description = row_data.get("description", "")
        factory_price = row_data.get("factory_price_usd")
        row_part_type = row_data.get("part_type", "")
        row_dimension = row_data.get("dimension", "")
        row_material = row_data.get("material", "")
        row_variant_note = row_data.get("variant_note", "")
        row_weight = row_data.get("weight")
        row_category = row_data.get("category", "")
        chinese_name = row_data.get("chinese_name", "")

        # Check if user marked this row as "duplicate" (skip it)
        row_resolution = variant_resolutions.get(str(i), {})
        if row_resolution.get("action") == "duplicate":
            applied["skipped"] += 1
            applied["duplicates_resolved"] += 1
            continue

        if match_status in ("AMBIGUOUS", "DUPLICATE"):
            applied["skipped"] += 1
            continue

        # Create new variant under existing parent
        if match_status == "NEW_VARIANT" and create_new_products:
            product_id = _handle_new_variant(
                i, mfr_code, description, chinese_name,
                row_part_type, row_dimension, row_material,
                row_variant_note, row_weight, row_category,
                variant_resolutions, applied, db,
            )
            if product_id is None and match_status == "NEW_VARIANT":
                # Fall through to NEW_PRODUCT handling
                match_status = "NEW_PRODUCT"

        # Create new product (parent + child)
        if match_status == "NEW_PRODUCT" and create_new_products:
            product_id = _handle_new_product(
                mfr_code, barcode, description, chinese_name,
                row_part_type, row_dimension, row_material,
                row_variant_note, row_weight, row_category,
                applied, db,
            )

        if not product_id:
            applied["skipped"] += 1
            continue

        row_data["product_id"] = product_id

        # Save barcode mapping
        if barcode and order and order.client_id:
            _save_barcode(barcode, order.client_id, product_id, saved_barcodes, applied, db)

        # Handle order items
        if order:
            _handle_order_item(
                order, product_id, mfr_code, description,
                row_part_type, row_dimension, row_material,
                row_variant_note, qty, factory_price, applied, db,
            )

    db.commit()

    # Post-apply image extraction
    try:
        images_saved, images_replaced = post_apply_extract_images(
            job.file_path, results, job.order_id,
            db, Product, ProductImage,
        )
        applied["images_saved"] = images_saved
        if images_replaced > 0:
            applied["images_replaced"] = images_replaced
    except Exception as e:
        logger.warning("PostApply image extraction failed: %s", e)

    return applied


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _handle_new_variant(
    row_idx, mfr_code, description, chinese_name,
    part_type, dimension, material, variant_note,
    weight, category, variant_resolutions, applied, db,
) -> Optional[str]:
    """Handle NEW_VARIANT row. Returns product_id or None if falling through to NEW_PRODUCT."""
    prod_name = description if description and description != mfr_code else mfr_code
    variant_parts = [p for p in [part_type, dimension, material] if p]
    if variant_parts:
        prod_name = f"{prod_name} ({' / '.join(variant_parts)})"

    parent = db.query(Product).filter(
        Product.product_code == mfr_code,
        Product.parent_id.is_(None),
        Product.deleted_at.is_(None),
    ).first()

    if not parent:
        return None  # Fall through to NEW_PRODUCT

    row_idx_str = str(row_idx)
    resolution = variant_resolutions.get(row_idx_str, {})
    res_action = resolution.get("action", "add_new")
    replace_id = resolution.get("replace_id")

    if res_action == "replace" and replace_id:
        existing_v = db.query(Product).filter(
            Product.id == replace_id, Product.deleted_at.is_(None),
        ).first()
        if existing_v:
            if part_type:
                existing_v.part_type = part_type
            if dimension:
                existing_v.dimension = dimension
            if material:
                existing_v.material = material
            if variant_note:
                existing_v.variant_note = variant_note
            if weight is not None and not existing_v.unit_weight_kg:
                existing_v.unit_weight_kg = weight
            if category and not existing_v.category:
                existing_v.category = category
            if prod_name and prod_name != mfr_code:
                existing_v.product_name = prod_name
            applied["variants_replaced"] = applied.get("variants_replaced", 0) + 1
            return existing_v.id
        else:
            applied["skipped"] += 1
            return "SKIP"  # sentinel: skip this row
    else:
        # add_new path
        existing = db.query(Product).filter(Product.product_name == prod_name).first()
        if existing:
            applied["items_updated"] += 1
            return existing.id

        try:
            new_variant = Product(
                product_code=mfr_code,
                product_name=prod_name,
                product_name_chinese=chinese_name or None,
                parent_id=parent.id,
                part_type=part_type or None,
                dimension=dimension or None,
                material=material or None,
                variant_note=variant_note or None,
                category=category or parent.category,
                unit_weight_kg=weight,
                hs_code=parent.hs_code,
                hs_code_description=parent.hs_code_description,
                brand=parent.brand,
                oem_reference=parent.oem_reference,
                approval_status=ApprovalStatus.PENDING_APPROVAL.value,
            )
            db.add(new_variant)
            db.flush()

            sibling_ct = db.query(Product).filter(
                Product.parent_id == parent.id,
                Product.id != new_variant.id,
                Product.deleted_at.is_(None),
            ).count()
            if sibling_ct == 0:
                new_variant.is_default = True

            applied["products_created"] += 1
            return new_variant.id
        except Exception:
            db.rollback()
            applied["skipped"] += 1
            return "SKIP"


def _handle_new_product(
    mfr_code, barcode, description, chinese_name,
    part_type, dimension, material, variant_note,
    weight, category, applied, db,
) -> Optional[str]:
    """Handle NEW_PRODUCT row. Returns product_id or None."""
    prod_name = description if description and description != mfr_code else (mfr_code or barcode)

    # Check for soft-deleted product to reactivate
    soft_deleted = db.query(Product).filter(
        Product.product_code == mfr_code,
        Product.deleted_at.isnot(None),
    ).first()

    if soft_deleted:
        return _reactivate_product(
            soft_deleted, mfr_code, prod_name, description,
            part_type, dimension, material, variant_note,
            weight, category, applied, db,
        )

    # Check for existing product with same name
    existing = db.query(Product).filter(Product.product_name == prod_name).first()
    if existing:
        applied["items_updated"] += 1
        return existing.id

    # Create new parent + child
    try:
        parent = db.query(Product).filter(
            Product.product_code == mfr_code,
            Product.parent_id.is_(None),
            Product.deleted_at.is_(None),
        ).first()
        if not parent:
            parent = Product(
                product_code=mfr_code,
                product_name=f"[{mfr_code}]",
                is_active=True,
                approval_status="APPROVED",
                category=category or None,
            )
            db.add(parent)
            db.flush()

        new_product = Product(
            product_code=mfr_code,
            product_name=prod_name,
            parent_id=parent.id,
            part_type=part_type or None,
            dimension=dimension or None,
            material=material or None,
            variant_note=variant_note or None,
            unit_weight_kg=weight,
            category=category or None,
            notes=description if description and description != prod_name else None,
            approval_status=ApprovalStatus.PENDING_APPROVAL.value,
        )
        db.add(new_product)
        db.flush()

        sibling_ct = db.query(Product).filter(
            Product.parent_id == parent.id,
            Product.id != new_product.id,
            Product.deleted_at.is_(None),
        ).count()
        if sibling_ct == 0:
            new_product.is_default = True

        applied["products_created"] += 1
        return new_product.id
    except Exception:
        db.rollback()
        applied["skipped"] += 1
        return None


def _reactivate_product(
    soft_deleted, mfr_code, prod_name, description,
    part_type, dimension, material, variant_note,
    weight, category, applied, db,
) -> str:
    """Reactivate a soft-deleted product."""
    soft_deleted.deleted_at = None
    soft_deleted.is_active = True
    if description and soft_deleted.product_name == soft_deleted.product_code:
        soft_deleted.product_name = prod_name
    if not soft_deleted.parent_id:
        parent = db.query(Product).filter(
            Product.product_code == mfr_code,
            Product.parent_id.is_(None),
            Product.deleted_at.is_(None),
            Product.id != soft_deleted.id,
        ).first()
        if not parent:
            parent = Product(
                product_code=mfr_code,
                product_name=f"[{mfr_code}]",
                is_active=True,
                approval_status="APPROVED",
            )
            db.add(parent)
            db.flush()
        soft_deleted.parent_id = parent.id
    if part_type and not soft_deleted.part_type:
        soft_deleted.part_type = part_type
    if dimension and not soft_deleted.dimension:
        soft_deleted.dimension = dimension
    if material and not soft_deleted.material:
        soft_deleted.material = material
    if variant_note and not soft_deleted.variant_note:
        soft_deleted.variant_note = variant_note
    if weight is not None and not soft_deleted.unit_weight_kg:
        soft_deleted.unit_weight_kg = weight
    if category and not soft_deleted.category:
        soft_deleted.category = category
    applied["products_reactivated"] += 1
    return soft_deleted.id


def _save_barcode(barcode, client_id, product_id, saved_barcodes, applied, db):
    """Save a client barcode mapping if it doesn't already exist."""
    existing_barcode = db.query(ClientProductBarcode).filter(
        ClientProductBarcode.client_id == client_id,
        ClientProductBarcode.barcode_code == barcode,
    ).first()
    if not existing_barcode and barcode not in saved_barcodes:
        db.add(ClientProductBarcode(
            client_id=client_id,
            product_id=product_id,
            barcode_code=barcode,
        ))
        saved_barcodes.add(barcode)
        applied["barcodes_saved"] += 1


def _handle_order_item(
    order, product_id, mfr_code, description,
    part_type, dimension, material, variant_note,
    qty, factory_price, applied, db,
):
    """Create or update an order item."""
    existing_item = db.query(OrderItem).filter(
        OrderItem.order_id == order.id,
        OrderItem.product_id == product_id,
        OrderItem.status == OrderItemStatus.ACTIVE.value,
    ).first()

    if existing_item:
        if existing_item.notes and existing_item.notes.startswith("After-Sales"):
            return
        if order.status == OrderStatus.DRAFT.value and qty > 0:
            existing_item.quantity = qty
        if factory_price is not None:
            existing_item.factory_price = factory_price
        applied["items_updated"] += 1
    elif order.status == OrderStatus.DRAFT.value:
        # Check for removed item to reactivate
        removed_item = db.query(OrderItem).filter(
            OrderItem.order_id == order.id,
            OrderItem.product_id == product_id,
            OrderItem.status == "REMOVED",
        ).first()

        if removed_item:
            removed_item.status = OrderItemStatus.ACTIVE.value
            removed_item.cancel_note = None
            if qty > 0:
                removed_item.quantity = qty
            if factory_price is not None:
                removed_item.factory_price = factory_price
            applied["items_updated"] += 1
        else:
            prod_obj = db.query(Product).filter(Product.id == product_id).first()
            new_item = OrderItem(
                order_id=order.id,
                product_id=product_id,
                quantity=qty if qty > 0 else 1,
                product_code_snapshot=mfr_code,
                product_name_snapshot=description or (prod_obj.product_name if prod_obj else mfr_code),
                material_snapshot=material or (prod_obj.material if prod_obj else None),
                category_snapshot=prod_obj.category if prod_obj else None,
                part_type_snapshot=part_type or (prod_obj.part_type if prod_obj else None),
                dimension_snapshot=dimension or (prod_obj.dimension if prod_obj else None),
                variant_note_snapshot=variant_note or (prod_obj.variant_note if prod_obj else None),
            )
            if factory_price is not None:
                new_item.factory_price = factory_price
            db.add(new_item)
            applied["items_added"] += 1
