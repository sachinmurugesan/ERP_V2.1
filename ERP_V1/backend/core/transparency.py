"""
Transparency pricing mask — controls what pricing data each role sees.

For TRANSPARENCY clients:
- SUPER_ADMIN: sees both real factory price + marked-up client price
- ADMIN/OPS/FINANCE: sees marked-up price AS factory price (real hidden)
- CLIENT: existing serializer strips factory_price; client_factory_price passes through

For REGULAR clients: no-op — returns data unchanged.
"""
from typing import Optional

import config


def mask_transparency_pricing(
    data: dict,
    role: str,
    client_type: str,
) -> dict:
    """Mask pricing fields based on role and client type.

    Works on a COPY — never mutates the original dict.
    Handles nested 'items' list if present.
    """
    # Feature flag check
    if not config.TRANSPARENCY_ENABLED:
        return data

    # Regular clients — no masking needed
    if client_type != "TRANSPARENCY":
        return data

    # SUPER_ADMIN sees everything
    if role == "SUPER_ADMIN":
        return data

    # ADMIN/OPS/FINANCE — replace factory_price with client_factory_price
    if role in ("ADMIN", "OPERATIONS", "FINANCE"):
        result = {**data}

        # Mask top-level fields (single item response)
        result = _mask_item_fields(result)

        # Mask nested items list (order response with items[])
        if "items" in result and isinstance(result["items"], list):
            result["items"] = [_mask_item_fields({**item}) for item in result["items"]]

        return result

    # CLIENT — existing serializer handles it (factory_price already stripped)
    return data


def _mask_item_fields(item: dict) -> dict:
    """Replace factory_price with client_factory_price for internal non-super roles."""
    cfp = item.get("client_factory_price")
    if cfp is not None:
        item["factory_price"] = cfp
        del item["client_factory_price"]
    # If client_factory_price is None (not yet calculated), leave factory_price as-is
    return item
