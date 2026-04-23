"""HarvestERP — Custom Exception Classes.

Domain exceptions raised by service layer.
Never raise HTTPException in services — raise these instead.
The router layer catches these and converts to HTTPException.
"""
from __future__ import annotations

from typing import Any


class HarvestERPException(Exception):
    """Base exception for all HarvestERP domain errors."""

    def __init__(self, message: str, code: str = "ERROR"):
        self.message = message
        self.code = code
        super().__init__(message)


class EntityNotFoundError(HarvestERPException):
    """Raised when a requested entity does not exist."""

    def __init__(self, entity: str, id: Any):
        super().__init__(
            f"{entity} with id '{id}' not found",
            code="NOT_FOUND",
        )


class DuplicateEntityError(HarvestERPException):
    """Raised when trying to create a duplicate entity."""

    def __init__(self, entity: str, field: str, value: Any):
        super().__init__(
            f"{entity} with {field}='{value}' already exists",
            code="DUPLICATE",
        )


class AccessDeniedError(HarvestERPException):
    """Raised when user lacks permission for an action."""

    def __init__(self, resource: str, action: str):
        super().__init__(
            f"Access denied: cannot {action} {resource}",
            code="ACCESS_DENIED",
        )


class InvalidStageTransitionError(HarvestERPException):
    """Raised when a stage transition is not allowed."""

    def __init__(self, from_status: str, to_status: str):
        super().__init__(
            f"Cannot transition from {from_status} to {to_status}",
            code="INVALID_TRANSITION",
        )


class FileTooLargeError(HarvestERPException):
    """Raised when uploaded file exceeds size limit."""

    def __init__(self, max_mb: int):
        super().__init__(
            f"File too large (max {max_mb}MB)",
            code="FILE_TOO_LARGE",
        )


class ValidationError(HarvestERPException):
    """Raised when business rule validation fails."""

    def __init__(self, message: str):
        super().__init__(message, code="VALIDATION_ERROR")
