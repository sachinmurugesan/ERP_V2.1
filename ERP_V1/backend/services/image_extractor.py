"""
Image extraction from Excel files.

Supports two strategies:
  A) Traditional openpyxl drawing-based images (TwoCellAnchor / OneCellAnchor)
  B) Excel 365 richData cell images (Place Image in Cell)
"""
import hashlib
import io
import os
import re as re_mod
import uuid as uuid_mod
import zipfile
from collections import defaultdict
from typing import Callable, Dict, Optional, Set, Tuple

import openpyxl
from PIL import Image as PILImage

from config import UPLOAD_DIR, THUMBNAIL_MAX_DIM

import logging

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------

def is_web_safe_format(data: bytes) -> bool:
    """Check if image bytes are in a browser-displayable format (JPEG or PNG)."""
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return True
    if data[:2] == b'\xff\xd8':
        return True
    return False


def detect_image_ext(data: bytes) -> str:
    """Detect image format from raw bytes. Returns file extension with dot."""
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return ".png"
    if data[:2] == b'\xff\xd8':
        return ".jpg"
    if data[:3] == b'GIF':
        return ".gif"
    if data[:2] == b'BM':
        return ".bmp"
    if data[:4] == b'\x49\x49\x2a\x00' or data[:4] == b'\x4d\x4d\x00\x2a':
        return ".tiff"
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return ".webp"
    return ".emf"


# ---------------------------------------------------------------------------
# RichData (Excel 365 cell images)
# ---------------------------------------------------------------------------

def extract_richdata_images(file_path: str) -> Dict[int, bytes]:
    """Extract images embedded via Excel 365 'Place Image in Cell' (richData) format.

    These images are NOT visible to openpyxl's ws._images because they use
    the newer richData/metadata XML structure instead of traditional drawing anchors.

    Returns: dict mapping Excel row number (1-based) to raw image bytes.
    """
    result: Dict[int, bytes] = {}

    try:
        zf = zipfile.ZipFile(file_path, 'r')
    except (zipfile.BadZipFile, FileNotFoundError):
        return result

    try:
        zip_names = set(zf.namelist())
        rels_path = 'xl/richData/_rels/richValueRel.xml.rels'
        rv_rel_path = 'xl/richData/richValueRel.xml'
        rdv_path = 'xl/richData/rdrichvalue.xml'

        if not all(p in zip_names for p in [rels_path, rv_rel_path, rdv_path]):
            return result

        # Step 1: Parse richValueRel.xml.rels -> rId -> media file path
        rels_xml = zf.read(rels_path).decode('utf-8')
        rid_to_media: Dict[str, str] = {}
        for m in re_mod.findall(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels_xml):
            media_name = m[1].split('/')[-1]
            rid_to_media[m[0]] = f'xl/media/{media_name}'

        if not rid_to_media:
            return result

        # Step 2: Parse richValueRel.xml -> ordered list of rIds
        rv_rel_xml = zf.read(rv_rel_path).decode('utf-8')
        rel_ids = re_mod.findall(r'r:id="(rId\d+)"', rv_rel_xml)

        # Step 3: Parse rdrichvalue.xml -> rv index -> first value (rel index)
        rdv_xml = zf.read(rdv_path).decode('utf-8')
        rv_first_values = []
        for rv_match in re_mod.finditer(r'<rv[^>]*>(.*?)</rv>', rdv_xml):
            vals = re_mod.findall(r'<v>(\d+)</v>', rv_match.group(1))
            rv_first_values.append(int(vals[0]) if vals else -1)

        # Step 4: Build vm -> media file path mapping
        vm_to_media: Dict[int, str] = {}
        for vm_val in range(1, len(rv_first_values) + 1):
            rv_idx = vm_val - 1
            rel_idx = rv_first_values[rv_idx]
            if 0 <= rel_idx < len(rel_ids):
                rid = rel_ids[rel_idx]
                media_path = rid_to_media.get(rid)
                if media_path and media_path in zip_names:
                    vm_to_media[vm_val] = media_path

        if not vm_to_media:
            return result

        # Step 5: Parse sheet XML to find cells with vm attribute
        sheet_path = None
        for candidate in ['xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml']:
            if candidate in zip_names:
                sheet_path = candidate
                break

        if not sheet_path:
            return result

        sheet_xml = zf.read(sheet_path).decode('utf-8')
        vm_cells = re_mod.findall(r'r="([A-Z]+)(\d+)"[^>]*vm="(\d+)"', sheet_xml)

        # Step 6: For each cell with vm, read the image data from ZIP
        media_cache: Dict[str, bytes] = {}
        for _col, row_str, vm_str in vm_cells:
            excel_row = int(row_str)
            vm_val = int(vm_str)
            media_path = vm_to_media.get(vm_val)
            if not media_path:
                continue
            if media_path not in media_cache:
                media_cache[media_path] = zf.read(media_path)
            if excel_row not in result:
                result[excel_row] = media_cache[media_path]

        logger.info(
            "RichData extraction: found %d rows with images from %d unique media files",
            len(result), len(media_cache),
        )
    except Exception as e:
        logger.warning("RichData image extraction error: %s", e)
    finally:
        zf.close()

    return result


# ---------------------------------------------------------------------------
# Save image to disk + create DB record
# ---------------------------------------------------------------------------

def save_image_to_disk(
    image_data: bytes,
    product_id: str,
    source_type: str,
    source_order_id: Optional[str],
    db,
    ProductImage,
    saved_hashes: Dict[str, Set[str]],
) -> bool:
    """Save an image to disk and create a ProductImage DB record.

    Returns True if an image was saved, False if skipped (duplicate hash).
    """
    image_hash = hashlib.md5(image_data, usedforsecurity=False).hexdigest()
    if image_hash in saved_hashes.get(product_id, set()):
        return False

    img_dir = UPLOAD_DIR / "products" / product_id
    img_dir.mkdir(parents=True, exist_ok=True)

    pil_img = PILImage.open(io.BytesIO(image_data))
    w, h = pil_img.size

    if is_web_safe_format(image_data):
        ext = detect_image_ext(image_data)
        img_filename = f"img_{uuid_mod.uuid4().hex[:8]}{ext}"
        img_path = img_dir / img_filename
        with open(str(img_path), "wb") as f:
            f.write(image_data)
    else:
        img_filename = f"img_{uuid_mod.uuid4().hex[:8]}.png"
        img_path = img_dir / img_filename
        pil_img.save(str(img_path), "PNG")

    thumb_filename = img_filename.replace("img_", "thumb_").rsplit(".", 1)[0] + ".jpg"
    thumb_path = img_dir / thumb_filename
    thumb_img = pil_img.copy()
    thumb_img.thumbnail((THUMBNAIL_MAX_DIM, THUMBNAIL_MAX_DIM), PILImage.LANCZOS)
    if thumb_img.mode in ('RGBA', 'P', 'LA'):
        thumb_img = thumb_img.convert('RGB')
    thumb_img.save(str(thumb_path), "JPEG", quality=80)

    rel_path = f"products/{product_id}/{img_filename}"
    thumb_rel_path = f"products/{product_id}/{thumb_filename}"
    file_size = os.path.getsize(str(img_path))

    db_img = ProductImage(
        product_id=product_id,
        image_path=rel_path,
        thumbnail_path=thumb_rel_path,
        source_type=source_type,
        source_order_id=source_order_id,
        width=w,
        height=h,
        file_size=file_size,
        image_hash=image_hash,
        is_primary=False,
    )
    db.add(db_img)
    saved_hashes.setdefault(product_id, set()).add(image_hash)
    return True


# ---------------------------------------------------------------------------
# Extract images for parsed rows (Pass 2 of factory Excel)
# ---------------------------------------------------------------------------

def extract_images_for_rows(
    file_path: str,
    excel_row_to_result: Dict[int, int],
    results: list,
    summary: dict,
    job_order_id: Optional[str],
    db,
    ProductImage,
    on_progress: Optional[Callable[[int], None]] = None,
) -> Dict[str, Set[str]]:
    """Extract images from an Excel file and save them for matched products.

    Args:
        file_path: Path to the Excel file.
        excel_row_to_result: Mapping from Excel row (1-based) to results index.
        results: The parsed result rows (mutated in place: has_image set to True).
        summary: Summary dict (mutated in place: images_extracted incremented).
        job_order_id: Optional order ID for source tracking.
        db: SQLAlchemy session.
        ProductImage: The ProductImage model class.
        on_progress: Optional callback(progress_percent) for UI updates.

    Returns:
        Dict mapping product_id to set of image hashes that were saved.
    """
    product_image_hashes: Dict[str, Set[str]] = defaultdict(set)

    def _save_for_row(excel_row: int, image_data: bytes):
        result_idx = excel_row_to_result.get(excel_row)
        if result_idx is None:
            return

        result_row = results[result_idx]
        result_row["has_image"] = True

        pid = result_row.get("product_id")
        if not pid:
            return

        image_hash = hashlib.md5(image_data, usedforsecurity=False).hexdigest()
        if image_hash in product_image_hashes.get(pid, set()):
            summary["images_duplicate_skipped"] = summary.get("images_duplicate_skipped", 0) + 1
            # Still set thumbnail for display even if deduped
            if "thumbnail_url" not in result_row:
                existing_img = db.query(ProductImage).filter(
                    ProductImage.product_id == pid,
                    ProductImage.image_hash == image_hash,
                ).first()
                if existing_img:
                    result_row["thumbnail_url"] = f"/api/products/file/?path={existing_img.thumbnail_path or existing_img.image_path}"
            return

        saved = save_image_to_disk(
            image_data, pid, "FACTORY_EXCEL", job_order_id,
            db, ProductImage, dict(product_image_hashes),
        )
        if saved:
            summary["images_extracted"] += 1
            # Store thumbnail URL in result row for frontend display
            newest = db.query(ProductImage).filter(
                ProductImage.product_id == pid,
                ProductImage.image_hash == image_hash,
            ).order_by(ProductImage.created_at.desc()).first()
            if newest:
                result_row["thumbnail_url"] = f"/api/products/file/?path={newest.thumbnail_path or newest.image_path}"
        # Track hash AFTER save attempt — prevents double-dedup bug
        product_image_hashes[pid].add(image_hash)

    images_found = False

    # Strategy A: Traditional openpyxl drawing-based images
    try:
        wb_full = openpyxl.load_workbook(file_path)
        ws_full = wb_full.active

        if ws_full._images:
            images_found = True
            total_images = len(ws_full._images)
            logger.info("PASS2: Found %d drawing-based images", total_images)

            for img_idx, img in enumerate(ws_full._images):
                try:
                    anchor_row = None
                    try:
                        anchor_row = img.anchor._from.row
                    except AttributeError:
                        try:
                            anchor_row = img.anchor.row
                        except AttributeError:
                            pass

                    if anchor_row is None:
                        summary["errors"] += 1
                        continue

                    excel_row = anchor_row + 1
                    try:
                        image_data = img._data()
                    except Exception as e:
                        logger.warning("PASS2 drawing img %d: _data() failed: %s", img_idx, e)
                        image_data = None
                    if not image_data:
                        summary["errors"] += 1
                        continue

                    _save_for_row(excel_row, image_data)
                except Exception as e:
                    logger.warning("PASS2 drawing img %d: error: %s", img_idx, e)
                    summary["errors"] += 1

                if on_progress and img_idx % 3 == 0:
                    on_progress(50 + min(int((img_idx + 1) / max(total_images, 1) * 50), 50))

        wb_full.close()
    except Exception as e:
        logger.warning("PASS2 drawing-based extraction failed: %s", e)
        summary["errors"] += 1

    # Strategy B: Excel 365 richData cell images (when no drawing images found)
    if not images_found:
        try:
            richdata_images = extract_richdata_images(file_path)
            if richdata_images:
                images_found = True
                total_rd = len(richdata_images)
                logger.info("PASS2: Found %d richData cell images", total_rd)

                for rd_idx, (excel_row, image_data) in enumerate(richdata_images.items()):
                    try:
                        _save_for_row(excel_row, image_data)
                    except Exception as e:
                        logger.warning("PASS2 richdata row %d: error: %s", excel_row, e)
                        summary["errors"] += 1

                    if on_progress and rd_idx % 5 == 0:
                        on_progress(50 + min(int((rd_idx + 1) / max(total_rd, 1) * 50), 50))

        except Exception as e:
            logger.warning("PASS2 richData extraction failed: %s", e)
            summary["errors"] += 1

    return product_image_hashes


# ---------------------------------------------------------------------------
# Post-apply image extraction (re-extract from Excel for newly created products)
# ---------------------------------------------------------------------------

def post_apply_extract_images(
    file_path: str,
    results: list,
    job_order_id: Optional[str],
    db,
    Product,
    ProductImage,
) -> Tuple[int, int]:
    """Re-extract images from Excel and save for products that now have IDs.

    This handles newly created products that didn't have product_ids during
    the initial Pass 2 extraction.

    Returns: (images_saved, images_replaced_product_count)
    """
    images_saved = 0
    images_replaced_count = 0

    # Build mapping: Excel row number (1-based) -> product_id
    excel_row_product_map: Dict[int, str] = {}
    for row_data in results:
        pid = row_data.get("product_id")
        if not pid:
            mfr_code = row_data.get("manufacturer_code", "")
            if mfr_code:
                prod = db.query(Product).filter(
                    Product.product_code == mfr_code,
                    Product.parent_id.isnot(None),
                    Product.deleted_at.is_(None),
                ).first()
                if not prod:
                    prod = db.query(Product).filter(
                        Product.product_code == mfr_code,
                        Product.deleted_at.is_(None),
                    ).first()
                if prod:
                    pid = prod.id
        if pid and row_data.get("has_image"):
            excel_row_product_map[row_data["row"]] = pid

    if not excel_row_product_map or not os.path.exists(file_path):
        return images_saved, images_replaced_count

    saved_hashes: Dict[str, Set[str]] = {}
    target_pids = set(excel_row_product_map.values())

    # Step 1: Delete ALL old factory-excel images for these products (clean slate)
    old_images = db.query(ProductImage).filter(
        ProductImage.product_id.in_(list(target_pids)),
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
    if old_images:
        db.flush()
        images_replaced_count = len(set(img.product_id for img in old_images))

    # Step 2: Extract and save fresh images
    def _apply_save(pid: str, image_data: bytes):
        nonlocal images_saved
        ok = save_image_to_disk(
            image_data, pid, "FACTORY_EXCEL", job_order_id,
            db, ProductImage, saved_hashes,
        )
        if ok:
            images_saved += 1

    apply_images_found = False

    # Strategy A: Traditional drawing-based images
    try:
        wb_img = openpyxl.load_workbook(file_path)
        ws_img = wb_img.active

        if ws_img._images:
            apply_images_found = True
            for img in ws_img._images:
                try:
                    anchor_row = None
                    try:
                        anchor_row = img.anchor._from.row
                    except AttributeError:
                        try:
                            anchor_row = img.anchor.row
                        except AttributeError:
                            continue
                    if anchor_row is None:
                        continue

                    excel_row = anchor_row + 1
                    if excel_row not in excel_row_product_map:
                        continue

                    pid = excel_row_product_map[excel_row]
                    try:
                        image_data = img._data()
                    except Exception:
                        image_data = None
                    if not image_data:
                        continue

                    _apply_save(pid, image_data)
                except Exception as e:
                    logger.warning("PostApply drawing image error: %s", e)
                    continue

        wb_img.close()
    except Exception as e:
        logger.warning("PostApply drawing extraction failed: %s", e)

    # Strategy B: Excel 365 richData cell images
    if not apply_images_found:
        try:
            richdata_images = extract_richdata_images(file_path)
            if richdata_images:
                for excel_row, image_data in richdata_images.items():
                    if excel_row not in excel_row_product_map:
                        continue
                    pid = excel_row_product_map[excel_row]
                    try:
                        _apply_save(pid, image_data)
                    except Exception as e:
                        logger.warning("PostApply richdata row %d: %s", excel_row, e)
        except Exception as e:
            logger.warning("PostApply richData extraction failed: %s", e)

    if images_saved > 0:
        db.commit()

    return images_saved, images_replaced_count
