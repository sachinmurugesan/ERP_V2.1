"""
Field-level data stripping for role-based response filtering.

Ensures external users (CLIENT, FACTORY) never see sensitive pricing,
counterparty identity, or internal operational data.
"""

# Fields that CLIENT users must never see
CLIENT_HIDDEN_FIELDS = frozenset({
    "factory_price",
    "factory_price_usd",
    "factory_price_snapshot",
    "markup_percent",
    "markup_percent_snapshot",
    "factory_id",
    "factory_name",
    "factory",
    "factory_payments",
    "factory_ledger",
    "exchange_rate_snapshot",
    "total_value_cny",        # G-010: per-order factory cost aggregate (sum of factory_price×qty)
    "factory_part_number",    # G-017: internal supplier part ref — not needed by CLIENT
    "internal_notes",
    "notes",
    "cancel_note",
    "clearance_charges",
    "freight_cost_inr",
    "thc_inr",
    "doc_fees_inr",
    "bank_name",
    "bank_account",
    "bank_swift",
    "bank_ifsc",
    "ifsc_code",
    "gst_number",
    "pan_number",
    "igst_credit_amount",
    "igst_credit_claimed",
    "igst_claim_date",
    "igst_claim_reference",
})

# Fields that FACTORY users must never see
FACTORY_HIDDEN_FIELDS = frozenset({
    "selling_price_inr",
    "selling_price",
    "selling_price_inr_snapshot",
    "markup_percent",
    "markup_percent_snapshot",
    "client_id",
    "client_name",
    "client",
    "client_payments",
    "client_ledger",
    "client_credits",
    "receivables",
    "factory_part_number",    # G-017: factory-specific part ref — competing factories must not cross-ref
    "internal_notes",
    "notes",
    "cancel_note",
    "compensation_amount",
    "proforma_invoice",
    "pi_total_inr",
    "pi_total_cny",
    "igst_credit_amount",
    "igst_credit_claimed",
    "igst_claim_date",
    "igst_claim_reference",
})


def _strip_fields(data: dict, hidden: frozenset) -> dict:
    """Remove hidden fields from a dict (immutable — returns new dict)."""
    return {k: v for k, v in data.items() if k not in hidden}


def _strip_nested_items(data: dict, hidden: frozenset) -> dict:
    """Strip fields from nested 'items' list if present."""
    result = {**data}
    if "items" in result and isinstance(result["items"], list):
        result["items"] = [
            _strip_fields(item, hidden) if isinstance(item, dict) else item
            for item in result["items"]
        ]
    return result


def filter_for_role(data: dict, role: str) -> dict:
    """Strip sensitive fields from a response dict based on user role.

    Args:
        data: The response dictionary to filter
        role: The user's role (ADMIN, FINANCE, OPERATIONS, CLIENT, FACTORY)

    Returns:
        A new dict with sensitive fields removed. Internal users get unmodified data.
    """
    if role in ("SUPER_ADMIN", "ADMIN", "FINANCE", "OPERATIONS"):
        return data

    if role == "CLIENT":
        result = _strip_fields(data, CLIENT_HIDDEN_FIELDS)
        return _strip_nested_items(result, CLIENT_HIDDEN_FIELDS)

    if role == "FACTORY":
        result = _strip_fields(data, FACTORY_HIDDEN_FIELDS)
        return _strip_nested_items(result, FACTORY_HIDDEN_FIELDS)

    # Unknown role — strip both sets for maximum safety
    combined = CLIENT_HIDDEN_FIELDS | FACTORY_HIDDEN_FIELDS
    result = _strip_fields(data, combined)
    return _strip_nested_items(result, combined)


def filter_list_for_role(data_list: list, role: str) -> list:
    """Apply filter_for_role to a list of dicts."""
    if role in ("SUPER_ADMIN", "ADMIN", "FINANCE", "OPERATIONS"):
        return data_list
    return [filter_for_role(item, role) for item in data_list]
