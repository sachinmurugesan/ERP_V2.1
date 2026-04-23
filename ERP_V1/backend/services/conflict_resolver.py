"""
AI-powered conflict resolution for Excel import rows.
# v2: Smart spec extraction

Analyzes conflict groups (same part code, different names/dimensions) and
suggests whether each row is a genuine new variant or a duplicate of an
existing product.  Uses Claude tool_use for structured output.
Falls back to simple heuristic matching if API is unavailable.
"""
import logging
from typing import Any

from services.ai_client import call_claude

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Claude tool definition for structured resolution output
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are an expert parts catalog analyst. You understand industrial parts, bearings, fasteners, keys, pins, seals, gears, and similar mechanical components.

You are given conflict groups from an Excel import. Each group has:
- A part code (e.g. GB/T1096-2003)
- Existing variants already in the database
- New rows from the Excel file that share the same part code

Your job: for each new row, determine if it is:
1. "add_new" — A genuinely different variant (different size, dimension, material, or specification). Examples: "Key 4×16" vs "Key C10×63" are different sizes → both are valid variants.
2. "duplicate" — Essentially the same item as an existing variant or another row in the group (same name, same dimensions, just repeated). Skip it.
3. "replace" — Same variant as an existing DB entry but with updated/corrected information. Replace the old one.

Key rules:
- Different dimensions/sizes = different variants (add_new), even if the base name is similar
- Same name + same dimension = duplicate (skip)
- Chinese and English names for the same item are NOT duplicates — they describe the same row
- Pay attention to dimension strings like "4×16", "C10x63", "8h8×16", "10h8×25" — different numbers = different variants
- If a row matches an existing DB variant exactly (same name, same dimension), mark as "duplicate"
- If a row matches an existing DB variant but has updated info, mark as "replace"
"""

_RESOLVE_TOOL = {
    "name": "resolve_conflicts",
    "description": "Provide resolution suggestions for each conflict row",
    "input_schema": {
        "type": "object",
        "required": ["resolutions"],
        "properties": {
            "resolutions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["row_index", "action", "confidence", "reason"],
                    "properties": {
                        "row_index": {
                            "type": "integer",
                            "description": "The _idx of the row from the input",
                        },
                        "action": {
                            "type": "string",
                            "enum": ["add_new", "replace", "duplicate"],
                            "description": "Suggested action for this row",
                        },
                        "confidence": {
                            "type": "string",
                            "enum": ["high", "medium", "low"],
                            "description": "Confidence in this suggestion",
                        },
                        "reason": {
                            "type": "string",
                            "description": "Brief explanation (e.g. 'Different dimension 4×16 vs C10×63')",
                        },
                    },
                },
            },
        },
    },
}


def _build_group_description(group: dict) -> str:
    """Format a single conflict group for the AI prompt."""
    lines = [f"Part Code: {group['code']}"]

    existing = group.get("existing_variants", [])
    if existing:
        lines.append("  Existing DB variants:")
        for ev in existing:
            name = ev.get("name") or ev.get("product_name") or "?"
            dim = ev.get("dimension") or ""
            lines.append(f"    - ID={ev.get('id','?')}: \"{name}\" {f'(dim: {dim})' if dim else ''}")

    rows = group.get("rows", [])
    lines.append("  New Excel rows:")
    for row in rows:
        desc = row.get("description") or row.get("product_name") or "?"
        chinese = row.get("chinese_name") or ""
        dim = row.get("dimension") or ""
        material = row.get("material") or ""
        idx = row.get("_idx", "?")
        parts = [f"_idx={idx}: \"{desc}\""]
        if chinese:
            parts.append(f"Chinese: \"{chinese}\"")
        if dim:
            parts.append(f"dim: {dim}")
        if material:
            parts.append(f"material: {material}")
        lines.append(f"    - {', '.join(parts)}")

    return "\n".join(lines)


def _normalize(s: str) -> str:
    """Normalize a string for comparison: lowercase, strip, collapse whitespace."""
    import re
    return re.sub(r'\s+', ' ', (s or "").strip().lower())


def _extract_spec(desc: str) -> str:
    """Extract dimension/spec part from a description (e.g. '4x16' from 'Key 4x16')."""
    import re
    # Match patterns like 4x16, C10x63, 8h8x16, 10h8x25, Φ100, M12, etc.
    specs = re.findall(r'[\dΦφ][\dx×*.\-/hHcCmM]+[\d]', desc)
    return ' '.join(specs).lower() if specs else ''


def _heuristic_fallback(groups: list[dict]) -> list[dict]:
    """Smart fallback when AI is unavailable.

    Logic:
    - Extract dimension/spec from name (e.g. "Key 4×16" → spec "4×16")
    - Same spec as existing DB variant → duplicate
    - Same spec as another file row → duplicate
    - Different spec → add_new (genuinely different variant)
    """
    resolutions = []
    for group in groups:
        # Build existing variant signatures: name + dimension + extracted spec
        existing_info = []
        for ev in group.get("existing_variants", []):
            name = _normalize(ev.get("name") or ev.get("product_name") or "")
            dim = _normalize(ev.get("dimension") or "")
            spec = _extract_spec(name) or _extract_spec(dim)
            existing_info.append({"name": name, "dim": dim, "spec": spec})

        existing_sigs = set()
        for ei in existing_info:
            existing_sigs.add(f"{ei['name']}|{ei['dim']}")
            if ei['spec']:
                existing_sigs.add(f"spec:{ei['spec']}")

        seen_in_file = {}  # sig -> first row description
        for row in group.get("rows", []):
            desc = _normalize(row.get("description") or row.get("product_name") or "")
            dim = _normalize(row.get("dimension") or "")
            spec = _extract_spec(desc) or _extract_spec(dim)
            full_sig = f"{desc}|{dim}"

            if full_sig in existing_sigs:
                action = "duplicate"
                # Find which existing variant it matches
                match_name = next((ei['name'] for ei in existing_info if f"{ei['name']}|{ei['dim']}" == full_sig), "existing variant")
                reason = f"Same as existing DB variant '{match_name}'"
                confidence = "high"
            elif spec and f"spec:{spec}" in existing_sigs:
                action = "duplicate"
                match_name = next((ei['name'] for ei in existing_info if ei['spec'] == spec), "existing variant")
                reason = f"Same spec ({spec}) as DB variant '{match_name}'"
                confidence = "high"
            elif full_sig in seen_in_file:
                action = "duplicate"
                reason = f"Duplicate of Row {seen_in_file[full_sig]} in this file"
                confidence = "high"
            elif spec and any(s.startswith("spec:") and s == f"spec:{spec}" for s in seen_in_file):
                action = "duplicate"
                reason = f"Same spec ({spec}) as another row in this file"
                confidence = "medium"
            else:
                action = "add_new"
                if spec and existing_info:
                    existing_specs = [ei['spec'] for ei in existing_info if ei['spec']]
                    if existing_specs:
                        reason = f"Different spec ({spec}) from existing ({', '.join(existing_specs)})"
                    else:
                        reason = f"New variant with spec {spec}" if spec else "New variant — not found in DB"
                elif existing_info:
                    reason = f"Different from existing variant(s)"
                else:
                    reason = "New variant — no existing DB match"
                confidence = "medium"
                seen_in_file[full_sig] = row.get("row", row.get("_idx", "?"))
                if spec:
                    seen_in_file[f"spec:{spec}"] = row.get("row", row.get("_idx", "?"))

            resolutions.append({
                "row_index": row.get("_idx", 0),
                "action": action,
                "confidence": confidence,
                "reason": reason,
            })

    return resolutions


def analyze_conflicts(groups: list[dict]) -> dict:
    """Analyze conflict groups and return AI-suggested resolutions.

    Args:
        groups: List of conflict group dicts, each with:
            - code: part code string
            - rows: list of Excel row dicts (each has _idx, description, chinese_name, dimension, etc.)
            - existing_variants: list of existing DB variant dicts (each has id, name, dimension)

    Returns:
        {
            "resolutions": [
                {"row_index": int, "action": str, "confidence": str, "reason": str},
                ...
            ],
            "source": "ai" | "heuristic"
        }
    """
    if not groups:
        return {"resolutions": [], "source": "heuristic"}

    # Build prompt with all conflict groups
    group_descriptions = []
    for g in groups:
        group_descriptions.append(_build_group_description(g))

    user_prompt = (
        "Analyze these conflict groups and suggest a resolution for each row.\n\n"
        + "\n\n".join(group_descriptions)
        + "\n\nFor each row (identified by _idx), suggest: add_new, replace, or duplicate."
    )

    # Scale max_tokens based on number of rows (each row ~50 tokens in response)
    total_rows = sum(len(g.get("rows", [])) for g in groups)
    max_tokens = min(max(1024, total_rows * 80), 8192)

    result = call_claude(_SYSTEM_PROMPT, user_prompt, tools=[_RESOLVE_TOOL], max_tokens=max_tokens)

    if "error" in result:
        logger.warning("AI conflict resolution failed (%s), using heuristic fallback", result["error"])
        return {
            "resolutions": _heuristic_fallback(groups),
            "source": "heuristic",
        }

    resolutions = result.get("resolutions", [])
    if not resolutions:
        logger.warning("AI returned empty resolutions, using heuristic fallback")
        return {
            "resolutions": _heuristic_fallback(groups),
            "source": "heuristic",
        }

    return {
        "resolutions": resolutions,
        "source": "ai",
    }
