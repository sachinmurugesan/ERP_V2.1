from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime


class CreateQueryRequest(BaseModel):
    order_item_id: Optional[str] = None
    product_id: Optional[str] = None
    query_type: str = "GENERAL"
    subject: str
    message: str


class ReplyQueryRequest(BaseModel):
    message: str


class QueryMessageResponse(BaseModel):
    id: str
    query_id: str
    sender_id: str
    sender_role: str
    sender_name: Optional[str] = None
    message: str
    attachments: Optional[List[str]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class QueryResponse(BaseModel):
    id: str
    order_id: str
    order_item_id: Optional[str] = None
    product_id: Optional[str] = None
    query_type: str
    status: str
    subject: str
    created_by_id: str
    created_by_role: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    messages: List[QueryMessageResponse] = []
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    message_count: int = 0
    last_message_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
