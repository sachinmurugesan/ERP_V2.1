"""
HarvestERP — Common Schema Foundations

Provides base classes and generic response wrappers used across all schema modules.
"""
from __future__ import annotations

from typing import Generic, TypeVar, Optional

from pydantic import BaseModel, ConfigDict


T = TypeVar("T")


class BaseSchema(BaseModel):
    """Base for all schemas that can be built from ORM models."""

    model_config = ConfigDict(from_attributes=True)


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard paginated list response envelope."""

    items: list[T]
    total: int
    page: int
    per_page: int
    pages: int


class MessageResponse(BaseModel):
    """Simple success/message response."""

    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    """Structured error response body."""

    detail: str
    code: Optional[str] = None
