"""
Global audit logging utility.
Append-only — creates AuditLog records for all critical mutations.
Designed to never crash the parent transaction.
"""
import json
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from core.security import CurrentUser

logger = logging.getLogger("harvestERP.audit")


def _safe_json(data: Optional[dict]) -> Optional[str]:
    """Serialize dict to JSON, stripping non-serializable values."""
    if data is None:
        return None
    try:
        # Strip large nested objects — only keep scalar/small values
        cleaned = {}
        for k, v in data.items():
            if isinstance(v, (str, int, float, bool, type(None))):
                cleaned[k] = v
            elif isinstance(v, (list, dict)):
                serialized = json.dumps(v, default=str)
                if len(serialized) < 5000:
                    cleaned[k] = v
                else:
                    cleaned[k] = f"[{type(v).__name__}: {len(v)} items, truncated]"
            elif isinstance(v, datetime):
                cleaned[k] = v.isoformat()
            else:
                cleaned[k] = str(v)
        return json.dumps(cleaned, default=str, ensure_ascii=False)
    except Exception as e:
        logger.warning(f"Audit JSON serialization failed: {e}")
        return json.dumps({"_serialization_error": str(e)})


def log_audit_event(
    db: Session,
    user: Optional[CurrentUser],
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    ip_address: Optional[str] = None,
    metadata: Optional[dict] = None,
):
    """Record an audit event. Never raises — logs errors to stderr instead.

    Args:
        db: Active database session (will use the same transaction)
        user: The authenticated user performing the action
        action: e.g., 'ORDER_STAGE_CHANGE', 'PAYMENT_CREATE', 'SETTING_UPDATE'
        resource_type: e.g., 'order', 'payment', 'exchange_rate'
        resource_id: UUID of the affected resource
        old_values: Previous state (for updates/deletes)
        new_values: New state (for creates/updates)
        ip_address: Client IP if available
        metadata: Additional context (reason, notes, etc.)
    """
    try:
        from models import AuditLog

        entry = AuditLog(
            timestamp=datetime.utcnow(),
            user_id=user.id if user else "system",
            user_email=user.email if user else "system",
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            old_values=_safe_json(old_values),
            new_values=_safe_json(new_values),
            ip_address=ip_address,
            metadata_json=_safe_json(metadata),
        )
        db.add(entry)
        # Don't commit — let the parent transaction handle it
    except Exception as e:
        logger.error(f"Failed to write audit log: {e}", exc_info=True)
        # Never crash the parent transaction
