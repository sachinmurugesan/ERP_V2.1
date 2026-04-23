# Query System Improvements Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the query system production-ready with visual status indicators, resolution remarks, professional UI alignment, and query history visible on each item row.

**Architecture:** Extend existing ItemQuery model with `resolution_remark` field. Add query status visual overlay on items table. Clean up the query panel UI to be corporate-grade.

**Tech Stack:** FastAPI, SQLAlchemy, Vue 3, Tailwind CSS

---

## Requirements Summary

| # | Requirement | Description |
|---|-------------|-------------|
| 1 | **Item row query status** | Each item in the table should show a colored indicator: which parts have open/replied/resolved queries |
| 2 | **Photo thumbnails in queries** | Inline image preview in query list table (not just file links) |
| 3 | **Resolution remark on close** | When resolving a query, user must write a conclusion remark (e.g., "Correct photo provided", "Dimension: 45x30mm") |
| 4 | **Remark shown as tag on item** | The final resolution remark becomes a visible tag/column on the item row — like a historical note |
| 5 | **Factory-facing memory** | Query remarks persist as reference for manufacturer — "this part had a query, here's what was concluded" |
| 6 | **Professional query panel UI** | Clean alignment, proper spacing, corporate-grade form layout |

---

### Task 1: Backend — Add resolution_remark to ItemQuery model

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/routers/queries.py` → `resolve_query()` endpoint

**Step 1:** Add `resolution_remark` column to ItemQuery model:
```python
resolution_remark: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
```

**Step 2:** Run SQLite ALTER TABLE to add column.

**Step 3:** Update `resolve_query()` endpoint to accept a `remark` parameter:
```python
@router.put("/{order_id}/queries/{query_id}/resolve/")
def resolve_query(..., remark: str = Query("")):
    query.resolution_remark = remark
    query.status = "RESOLVED"
```

**Step 4:** Update `_serialize_query()` to include `resolution_remark`.

**Step 5:** Update `get_inline_query_status()` to include resolution_remark in the per-item status.

**Step 6:** Verify: `python -c "from routers.queries import router; print('ok')"`

---

### Task 2: Frontend — Resolution remark dialog when closing query

**Files:**
- Modify: `frontend/src/components/order/QueriesTab.vue`

**Step 1:** Replace the simple `resolveQuery(id)` call with a dialog that asks for a remark.

**Step 2:** The dialog should:
- Show the query subject
- Pre-fill remark based on query type:
  - PHOTO_REQUEST → "Correct photo provided"
  - VIDEO_REQUEST → "Video provided"
  - DIMENSION_CHECK → "Dimension: "
  - QUALITY_QUERY → "Quality confirmed — "
  - ALTERNATIVE → "Alternative: "
  - GENERAL → ""
- User edits/confirms the remark
- Submit calls resolve with remark

**Step 3:** Update the API method to pass remark: `resolve: (orderId, queryId, remark) => ...`

---

### Task 3: Frontend — Show resolution remark as tag on item rows

**Files:**
- Modify: `frontend/src/components/order/OrderItemsTab.vue`
- Modify: `frontend/src/components/order/ClientOrderItemsTab.vue`

**Step 1:** In the inline status, show the resolution remark as a small tag next to the product name or in the query column:
```html
<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
  ✓ Correct photo provided
</span>
```

**Step 2:** Multiple resolved queries → show the latest remark. If multiple, show count.

---

### Task 4: Frontend — Image thumbnails in Queries tab table

**Files:**
- Modify: `frontend/src/components/order/QueriesTab.vue`

**Step 1:** In the query list table, check if the latest message has image attachments.

**Step 2:** Show a small 32x32 thumbnail next to the query subject if an image is attached.

**Step 3:** Click thumbnail → opens lightbox.

---

### Task 5: Frontend — Professional query panel UI cleanup

**Files:**
- Modify: `frontend/src/components/order/OrderItemsTab.vue` → query panel
- Modify: `frontend/src/components/order/ClientOrderItemsTab.vue` → query panel

**Step 1:** The "Ask a Question" slide-out panel needs:
- Proper form layout with labels
- Query type as icon buttons (not dropdown) — like a toolbar
- Subject auto-fills from type, hidden when not GENERAL
- Message textarea with proper height
- Send button full-width below textarea
- Proper card spacing for existing threads
- Each thread card: icon + subject + status badge in header row
- Messages inside with proper avatar alignment
- Image previews inline (not just links)
- Reply area styled consistently

**Step 2:** Specific UI fixes:
- Remove duplicate "General" dropdown + Subject input → replace with type icon bar
- Align send button properly
- Add spacing between form and thread list
- Make thread cards consistent height/padding
- Show image thumbnails inline in messages

---

### Task 6: Frontend — Query status visual indicator on item rows

**Files:**
- Modify: `frontend/src/components/order/OrderItemsTab.vue`
- Modify: `frontend/src/components/order/ClientOrderItemsTab.vue`

**Step 1:** Already implemented (red/green badge). Enhance with:
- Show resolution remark text if resolved
- Tooltip on hover showing query summary

---

### Task 7: Build + Test + Verify

**Step 1:** `python -m pytest tests/test_transparency.py -x -q` — all pass
**Step 2:** `npm run build` — zero errors
**Step 3:** Manual test:
  - Create query → resolve with remark → remark shows on item row
  - Image attachments show thumbnails in queries table
  - Panel UI is clean and professional
