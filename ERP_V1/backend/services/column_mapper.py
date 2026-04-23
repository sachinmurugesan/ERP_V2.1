"""
AI-powered Excel column mapping using Claude tool_use.

Analyzes Excel headers + sample rows and maps them to known schema fields
with confidence levels. Falls back to keyword matching on API failure.
"""
import logging
from typing import Any

from services.ai_client import call_claude

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Schema definitions per import type
# ---------------------------------------------------------------------------

PRODUCT_SCHEMA = {
    "product_code": {"description": "Manufacturer part code, SKU, MFR code, or product number", "required": True},
    "barcode": {"description": "Barcode, client part number, or EAN/UPC code", "required": False},
    "product_name": {"description": "Product name or description in English", "required": True},
    "product_name_chinese": {"description": "Product name in Chinese (中文名称)", "required": False},
    "dimension": {"description": "Size, dimensions, or specifications (e.g. 270*122*70)", "required": False},
    "category": {"description": "Product category or classification", "required": False},
    "unit_weight_kg": {"description": "Weight per unit in kg", "required": False},
    "material": {"description": "Material type (e.g. steel, plastic)", "required": False},
    "hs_code": {"description": "HS tariff code for customs", "required": False},
    "quantity": {"description": "Quantity or QTY", "required": False},
    "unit_price": {"description": "Unit price per item", "required": False},
    "part_type": {"description": "Part type: original or copy/aftermarket", "required": False},
    "image": {"description": "Product image column", "required": False},
}

PRICE_SCHEMA = {
    "product_code": {"description": "Manufacturer part code, SKU, or MFR code", "required": True},
    "unit_price": {"description": "Unit price per item", "required": True},
}

PACKING_SCHEMA = {
    "product_code": {"description": "Manufacturer part code, SKU, or MFR code", "required": True},
    "quantity": {"description": "Quantity of items", "required": False},
    "package": {"description": "Pallet number, package number, carton number, or box number", "required": False},
    "description": {"description": "Product name or description", "required": False},
}

SCHEMAS = {
    "product": PRODUCT_SCHEMA,
    "price": PRICE_SCHEMA,
    "packing": PACKING_SCHEMA,
}

# ---------------------------------------------------------------------------
# Keyword fallback (existing logic extracted)
# ---------------------------------------------------------------------------

_KEYWORD_MAP = {
    "product_code": ["part no", "part code", "mfr", "manufacturer", "sku", "product code"],
    "barcode": ["barcode", "ean", "upc", "client part"],
    "product_name": ["description", "goods", "part name", "product name"],
    "product_name_chinese": ["名称", "chinese", "中文"],
    "dimension": ["dimension", "size", "spec", "规格"],
    "category": ["category", "类别", "分类"],
    "unit_weight_kg": ["weight", "weigh", "重量"],
    "material": ["material", "材质", "材料"],
    "hs_code": ["hs code", "hs_code", "tariff", "海关编码"],
    "quantity": ["quantity", "qty", "数量"],
    "unit_price": ["unit price", "price", "单价"],
    "part_type": ["part type", "type", "original", "copy"],
    "image": ["image", "photo", "picture", "图片"],
    "package": ["pallet", "package", "packing", "pkg", "carton", "箱号"],
    "description": ["description", "goods", "part name"],
}


def _keyword_fallback(
    headers: list[str], schema_type: str
) -> dict[str, dict]:
    """Simple keyword-based column detection (the existing approach)."""
    schema = SCHEMAS.get(schema_type, PRODUCT_SCHEMA)
    confirmed: dict[str, str] = {}

    for ci, raw_header in enumerate(headers):
        val = str(raw_header or "").strip().lower()
        if not val:
            continue
        for field, keywords in _KEYWORD_MAP.items():
            if field not in schema:
                continue
            if any(kw in val for kw in keywords):
                if field not in confirmed.values():
                    confirmed[raw_header] = field
                break

    return {
        "confirmed": confirmed,
        "needs_review": [],
        "unmapped_fields": [
            f for f, info in schema.items()
            if info["required"] and f not in confirmed.values()
        ],
    }


# ---------------------------------------------------------------------------
# AI-powered mapping
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are an expert at mapping Excel spreadsheet columns to database schema fields.
You understand column headers in English, Chinese, abbreviated forms, and industry jargon.
Analyze the provided headers and sample data rows, then map each relevant column to the correct schema field.
Only map columns that you are reasonably confident about — do not force-map irrelevant columns."""

_TOOL_DEF = {
    "name": "map_columns",
    "description": "Map Excel column headers to schema fields with confidence levels",
    "input_schema": {
        "type": "object",
        "required": ["mappings"],
        "properties": {
            "mappings": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["excel_column", "schema_field", "confidence", "reason"],
                    "properties": {
                        "excel_column": {
                            "type": "string",
                            "description": "The exact Excel column header text",
                        },
                        "schema_field": {
                            "type": "string",
                            "description": "The schema field name to map to",
                        },
                        "confidence": {
                            "type": "string",
                            "enum": ["high", "medium", "low"],
                            "description": "Confidence level of the mapping",
                        },
                        "reason": {
                            "type": "string",
                            "description": "Brief explanation for this mapping",
                        },
                    },
                },
            },
        },
    },
}


def analyze_columns(
    headers: list[str],
    sample_rows: list[list[Any]],
    schema_type: str = "product",
) -> dict:
    """Analyze Excel columns using Claude AI and return mapping results.

    Returns:
        {
            "confirmed": {"ExcelHeader": "schema_field", ...},  # high confidence
            "needs_review": [
                {"excel_column": "...", "suggested_field": "...",
                 "confidence": "medium"|"low", "reason": "..."},
                ...
            ],
            "unmapped_fields": ["field1", ...]  # required fields with no mapping
        }
    """
    schema = SCHEMAS.get(schema_type, PRODUCT_SCHEMA)

    # Build the user prompt — only headers + a few sample rows (tiny payload)
    fields_desc = "\n".join(
        f"  - {name}: {info['description']} ({'REQUIRED' if info['required'] else 'optional'})"
        for name, info in schema.items()
    )

    sample_text = ""
    for ri, row in enumerate(sample_rows[:3]):
        vals = [str(v) if v is not None else "" for v in row]
        sample_text += f"  Row {ri + 1}: {vals}\n"

    user_prompt = (
        f"Schema fields to map to:\n{fields_desc}\n\n"
        f"Excel column headers: {[str(h) for h in headers]}\n\n"
        f"Sample data rows:\n{sample_text}\n"
        f"Map each relevant Excel column header to the best matching schema field. "
        f"Only include columns that have a plausible match."
    )

    tool = {**_TOOL_DEF}
    # Restrict schema_field enum to valid fields
    tool_copy = {
        "name": tool["name"],
        "description": tool["description"],
        "input_schema": {
            "type": "object",
            "required": ["mappings"],
            "properties": {
                "mappings": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["excel_column", "schema_field", "confidence", "reason"],
                        "properties": {
                            "excel_column": {"type": "string"},
                            "schema_field": {
                                "type": "string",
                                "enum": list(schema.keys()),
                            },
                            "confidence": {
                                "type": "string",
                                "enum": ["high", "medium", "low"],
                            },
                            "reason": {"type": "string"},
                        },
                    },
                },
            },
        },
    }

    result = call_claude(_SYSTEM_PROMPT, user_prompt, tools=[tool_copy])

    if "error" in result:
        logger.warning("AI mapping failed (%s), using keyword fallback", result["error"])
        return _keyword_fallback(headers, schema_type)

    # Parse AI result into confirmed / needs_review
    mappings = result.get("mappings", [])
    confirmed: dict[str, str] = {}
    needs_review: list[dict] = []
    used_fields: set[str] = set()

    for m in mappings:
        field = m.get("schema_field", "")
        excel_col = m.get("excel_column", "")
        confidence = m.get("confidence", "low")
        reason = m.get("reason", "")

        if field not in schema or field in used_fields:
            continue
        used_fields.add(field)

        if confidence == "high":
            confirmed[excel_col] = field
        else:
            needs_review.append({
                "excel_column": excel_col,
                "suggested_field": field,
                "confidence": confidence,
                "reason": reason,
            })

    unmapped = [
        f for f, info in schema.items()
        if info["required"] and f not in used_fields
    ]

    return {
        "confirmed": confirmed,
        "needs_review": needs_review,
        "unmapped_fields": unmapped,
    }


# ---------------------------------------------------------------------------
# Convert final mapping to internal col_map for parse functions
# ---------------------------------------------------------------------------

# Schema field → internal col_map key for _process_factory_excel
_PRODUCT_FIELD_TO_INTERNAL = {
    "product_code": "part_no_2",    # MFR Part No
    "barcode": "part_no_1",         # Client barcode
    "product_name": "description",
    "product_name_chinese": "chinese_name",
    "dimension": "dimension",
    "category": "category",
    "unit_weight_kg": "weight",
    "material": "material",
    "quantity": "qty",
    "unit_price": "price",
    "part_type": "part_type",
}


def build_col_map(
    headers: list[str],
    final_mapping: dict[str, str],
    schema_type: str = "product",
) -> dict[str, int | None]:
    """Convert final AI mapping {excel_header: schema_field} to col_map {internal_key: col_index}.

    Args:
        headers: List of Excel column headers.
        final_mapping: {excel_header_text: schema_field_name} — the confirmed mapping.
        schema_type: One of "product", "price", "packing".

    Returns:
        col_map dict with integer column indices, compatible with parse functions.
    """
    # Build header text → column index lookup
    header_to_idx = {}
    for ci, h in enumerate(headers):
        header_to_idx[str(h).strip()] = ci

    if schema_type == "product":
        col_map: dict[str, int | None] = {
            "part_no_1": None, "part_no_2": None, "description": None,
            "chinese_name": None, "qty": None, "price": None,
            "part_type": None, "dimension": None, "material": None,
            "variant_note": None, "weight": None, "category": None,
        }
        for excel_header, schema_field in final_mapping.items():
            idx = header_to_idx.get(excel_header)
            if idx is None:
                continue
            internal = _PRODUCT_FIELD_TO_INTERNAL.get(schema_field)
            if internal:
                col_map[internal] = idx

        # If both product_code and barcode map to same column, mirror
        if col_map["part_no_2"] is not None and col_map["part_no_1"] is None:
            col_map["part_no_1"] = col_map["part_no_2"]
        if col_map["part_no_1"] is not None and col_map["part_no_2"] is None:
            col_map["part_no_2"] = col_map["part_no_1"]

        return col_map

    elif schema_type == "price":
        result = {"code_col": None, "price_col": None, "header_row_idx": 0}
        for excel_header, schema_field in final_mapping.items():
            idx = header_to_idx.get(excel_header)
            if idx is None:
                continue
            if schema_field == "product_code":
                result["code_col"] = idx
            elif schema_field == "unit_price":
                result["price_col"] = idx
        return result

    elif schema_type == "packing":
        result = {
            "col_part_code": None, "col_qty": None,
            "col_package": None, "col_description": None,
        }
        field_to_key = {
            "product_code": "col_part_code",
            "quantity": "col_qty",
            "package": "col_package",
            "description": "col_description",
        }
        for excel_header, schema_field in final_mapping.items():
            idx = header_to_idx.get(excel_header)
            if idx is None:
                continue
            key = field_to_key.get(schema_field)
            if key:
                result[key] = idx
        return result

    return {}
