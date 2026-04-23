# Item Query System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow clients and admins to have threaded conversations about specific order items — asking for photos, dimensions, quality info, alternatives — with attachment support and a dedicated Queries tab.

**Architecture:** New `ItemQuery` + `ItemQueryMessage` models. Per-item chat threads with query type tags (PHOTO_REQUEST, DIMENSION_CHECK, etc.) and status workflow (OPEN → REPLIED → RESOLVED). Two UI access points: a chat icon per item row + a Queries tab showing all threads.

**Tech Stack:** FastAPI, SQLAlchemy, Vue 3, Tailwind CSS

---

### Task 1: Backend — Create ItemQuery and ItemQueryMessage models

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/enums.py`

**Step 1:** Add enums to `enums.py` after `PIItemStatus`:
```python
class QueryType(str, enum.Enum):
    PHOTO_REQUEST = "PHOTO_REQUEST"
    VIDEO_REQUEST = "VIDEO_REQUEST"
    DIMENSION_CHECK = "DIMENSION_CHECK"
    QUALITY_QUERY = "QUALITY_QUERY"
    ALTERNATIVE = "ALTERNATIVE"
    GENERAL = "GENERAL"

class QueryStatus(str, enum.Enum):
    OPEN = "OPEN"
    REPLIED = "REPLIED"
    RESOLVED = "RESOLVED"
```

**Step 2:** Add models to `models.py` (before the `# ===== End =====` or after Notification):
```python
class ItemQuery(Base):
    __tablename__ = "item_queries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    order_id: Mapped[str] = mapped_column(String(36), ForeignKey("orders.id"), index=True)
    order_item_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("order_items.id"), nullable=True)
    product_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    query_type: Mapped[str] = mapped_column(String(30), default="GENERAL")
    status: Mapped[str] = mapped_column(String(20), default="OPEN")
    subject: Mapped[str] = mapped_column(String(300), nullable=False)
    created_by_id: Mapped[str] = mapped_column(String(36), nullable=False)
    created_by_role: Mapped[str] = mapped_column(String(20), nullable=False)  # CLIENT or ADMIN
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    messages: Mapped[List["ItemQueryMessage"]] = relationship(back_populates="query", order_by="ItemQueryMessage.created_at")


class ItemQueryMessage(Base):
    __tablename__ = "item_query_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    query_id: Mapped[str] = mapped_column(String(36), ForeignKey("item_queries.id"), index=True)
    sender_id: Mapped[str] = mapped_column(String(36), nullable=False)
    sender_role: Mapped[str] = mapped_column(String(20), nullable=False)  # CLIENT or ADMIN
    sender_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    attachments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array of file paths
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    query: Mapped["ItemQuery"] = relationship(back_populates="messages")
```

**Step 3:** Run migration:
```bash
python -c "
from database import engine
from sqlalchemy import text
with engine.connect() as conn:
    conn.execute(text('''CREATE TABLE IF NOT EXISTS item_queries (
        id VARCHAR(36) PRIMARY KEY,
        order_id VARCHAR(36) NOT NULL REFERENCES orders(id),
        order_item_id VARCHAR(36) REFERENCES order_items(id),
        product_id VARCHAR(36),
        query_type VARCHAR(30) DEFAULT 'GENERAL',
        status VARCHAR(20) DEFAULT 'OPEN',
        subject VARCHAR(300) NOT NULL,
        created_by_id VARCHAR(36) NOT NULL,
        created_by_role VARCHAR(20) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        resolved_at DATETIME
    )'''))
    conn.execute(text('''CREATE TABLE IF NOT EXISTS item_query_messages (
        id VARCHAR(36) PRIMARY KEY,
        query_id VARCHAR(36) NOT NULL REFERENCES item_queries(id),
        sender_id VARCHAR(36) NOT NULL,
        sender_role VARCHAR(20) NOT NULL,
        sender_name VARCHAR(100),
        message TEXT NOT NULL,
        attachments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )'''))
    conn.execute(text('CREATE INDEX IF NOT EXISTS ix_item_queries_order_id ON item_queries(order_id)'))
    conn.execute(text('CREATE INDEX IF NOT EXISTS ix_item_query_messages_query_id ON item_query_messages(query_id)'))
    conn.commit()
    print('Tables created')
"
```

**Step 4:** Verify: `python -c "from models import ItemQuery, ItemQueryMessage; print('ok')"`

---

### Task 2: Backend — Pydantic schemas for queries

**Files:**
- Create: `backend/schemas/queries.py`

**Step 1:** Create schemas:
```python
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
    # Joined fields
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    message_count: int = 0
    last_message_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
```

---

### Task 3: Backend — Query CRUD router

**Files:**
- Create: `backend/routers/queries.py`
- Modify: `backend/main.py` (register router)

**Step 1:** Create the router with these endpoints:

```python
# POST /api/orders/{order_id}/queries/         — create query + first message
# GET  /api/orders/{order_id}/queries/          — list queries for order
# GET  /api/orders/{order_id}/queries/{id}/     — get single query with messages
# POST /api/orders/{order_id}/queries/{id}/reply/ — add reply message
# POST /api/orders/{order_id}/queries/{id}/reply/upload/ — reply with attachment
# PUT  /api/orders/{order_id}/queries/{id}/resolve/ — mark resolved
# GET  /api/orders/{order_id}/queries/summary/  — counts by status (for tab badge)
```

Key implementation details:

- `create_query`: Creates ItemQuery + first ItemQueryMessage. Sends Notification to opposite role.
- `list_queries`: Returns all queries for an order. CLIENT filtered to own queries. Includes product_code, product_name from OrderItem snapshots. Supports `?status=OPEN` filter.
- `reply_to_query`: Adds ItemQueryMessage. Auto-sets query status to REPLIED if admin replies to OPEN query. Sends notification.
- `reply_with_attachment`: Accepts multipart file upload. Stores in `uploads/orders/{order_id}/queries/{query_id}/`. Adds message with attachments JSON array.
- `resolve_query`: Sets status=RESOLVED, resolved_at. Either role can resolve.
- `get_summary`: Returns `{ open: N, replied: N, resolved: N, total: N }` for tab badge.

**Step 2:** Register in `main.py`:
```python
from routers import queries
app.include_router(queries.router, prefix="/api/orders", tags=["Queries"],
                   dependencies=[Depends(get_current_user)])
```

**Step 3:** Verify: `python -c "from routers.queries import router; print('ok')"`

---

### Task 4: Backend — Serialize query counts into order detail

**Files:**
- Modify: `backend/routers/orders.py` → order detail serializer

**Step 1:** Add `query_counts` to the order detail response (in the `get_order_detail` function):
```python
# After existing serialization
from models import ItemQuery
open_q = db.query(ItemQuery).filter(ItemQuery.order_id == order.id, ItemQuery.status == "OPEN").count()
replied_q = db.query(ItemQuery).filter(ItemQuery.order_id == order.id, ItemQuery.status == "REPLIED").count()
# Add to response dict:
result["query_counts"] = {"open": open_q, "replied": replied_q, "total": open_q + replied_q}
```

**Step 2:** Also add per-item query count to `serialize_order_item()`:
```python
# After the result dict
from models import ItemQuery
result["open_queries"] = db.query(ItemQuery).filter(
    ItemQuery.order_item_id == item.id,
    ItemQuery.status.in_(["OPEN", "REPLIED"]),
).count()
```
Note: This needs a `db` session parameter added to `serialize_order_item()`.

---

### Task 5: Frontend — API methods for queries

**Files:**
- Modify: `frontend/src/api/index.js`

**Step 1:** Add `queriesApi` object:
```javascript
export const queriesApi = {
  list: (orderId, params) => api.get(`/orders/${orderId}/queries/`, { params }),
  get: (orderId, queryId) => api.get(`/orders/${orderId}/queries/${queryId}/`),
  create: (orderId, data) => api.post(`/orders/${orderId}/queries/`, data),
  reply: (orderId, queryId, data) => api.post(`/orders/${orderId}/queries/${queryId}/reply/`, data),
  replyWithAttachment: (orderId, queryId, formData) =>
    api.post(`/orders/${orderId}/queries/${queryId}/reply/upload/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }),
  resolve: (orderId, queryId) => api.put(`/orders/${orderId}/queries/${queryId}/resolve/`),
  summary: (orderId) => api.get(`/orders/${orderId}/queries/summary/`),
}
```

---

### Task 6: Frontend — Per-item query icon on OrderItemsTab (admin)

**Files:**
- Modify: `frontend/src/components/order/OrderItemsTab.vue`

**Step 1:** Add a small chat bubble icon in each row (next to product name or in a new narrow column). Shows orange dot badge if `item.open_queries > 0`.

**Step 2:** Clicking the icon opens a slide-out panel (`showQueryPanel = true, queryPanelItemId = item.id`).

**Step 3:** The slide-out panel:
- Header: product code + name
- "New Query" button → shows form: type dropdown + subject + message textarea
- Thread list: existing queries for this item, sorted by updated_at desc
- Each thread expandable to show messages
- Reply input at bottom of each thread with file attachment button

---

### Task 7: Frontend — Per-item query icon on ClientOrderItemsTab

**Files:**
- Modify: `frontend/src/components/order/ClientOrderItemsTab.vue`

**Step 1:** Same pattern as admin — chat bubble icon per row, slide-out panel for thread.

**Step 2:** Client UI differences:
- Query type shown as friendly labels: "Request Photo", "Ask Dimensions", etc.
- Admin replies shown with "Our Team" label
- Attachment viewer with image lightbox (reuse existing viewer)

---

### Task 8: Frontend — Queries tab component (admin)

**Files:**
- Create: `frontend/src/components/order/QueriesTab.vue`
- Modify: `frontend/src/views/orders/OrderDetail.vue` (add tab)

**Step 1:** Create QueriesTab component:
- Filter bar: status (All / Open / Replied / Resolved), query type dropdown
- Table: #, Item Code, Product, Type, Subject, Status, Last Message, Created
- Click row → expands inline thread or opens side panel
- Bulk actions: resolve selected queries

**Step 2:** Add to admin OrderDetail tabs:
```javascript
t.push({ id: 'queries', label: 'Queries', icon: 'pi-comments', badge: order.value?.query_counts?.open || 0 })
```

---

### Task 9: Frontend — Queries tab component (client)

**Files:**
- Create: `frontend/src/components/order/ClientQueriesTab.vue`
- Modify: `frontend/src/views/client/ClientOrderDetail.vue` (add tab)

**Step 1:** Create ClientQueriesTab — similar to admin but:
- Admin replies labeled "Our Team"
- No bulk actions
- "New Query" button prominent at top

**Step 2:** Add to client portal tabs:
```javascript
t.push({ key: 'queries', label: 'Queries', icon: 'pi-comments' })
```

---

### Task 10: Build + Test + Verify

**Step 1:** `python -m pytest tests/test_transparency.py -x -q` — all pass
**Step 2:** `npm run build` — zero errors
**Step 3:** Manual test:
  - Client opens order → clicks query icon on an item → creates "Photo Request"
  - Admin sees notification → opens query → replies with photo attachment
  - Client sees reply with photo → marks resolved
  - Both sides: Queries tab shows all threads with correct status
  - Badge count shows open queries on tab
