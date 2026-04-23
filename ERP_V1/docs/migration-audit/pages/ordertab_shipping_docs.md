# Profile: ordertab_shipping_docs

## Metadata
- **Source file:** `frontend/src/components/order/ShippingDocsTab.vue`
- **Lines:** 271
- **Type:** component (sub-tab)
- **Portal:** internal
- **Tab slug:** `shipping-docs`
- **Parent shell:** `OrderDetail.vue`
- **Wave:** Wave 8 Session B
- **Profile generated:** 2026-04-22

---

## Purpose

Manages factory shipping documents for all containers booked on an order. Displays document cards (BOL, COO, CI, PL) showing current status (PENDING / RECEIVED). In edit mode: allows file upload to mark a doc as received, manual mark-as-received without a file, replacement of uploaded files, and reverting a received doc back to pending. Shows an overall progress bar (received / total). This tab is tightly coupled to the SailingTab — the "Mark as Arrived" action in SailingTab is blocked until all docs here are RECEIVED.

---

## Layout / visual structure

```
┌────────────────────────────────────────────────────┐
│ Shipping Documents (cyan header)                   │
│ N / M received              [Edit] / [Done]        │
│                                                    │
│ Grid (2 columns):                                  │
│  ┌─────────────────────┐ ┌─────────────────────┐  │
│  │ [icon] Bill of Lading│ │ [icon] Cert. Origin │  │
│  │ PENDING / RECEIVED   │ │ PENDING / RECEIVED   │  │
│  │                     │ │                     │  │
│  │ [Upload Document]   │ │ Received: Jan-15     │  │
│  │ [Mark as Received]  │ │ [View] [Download]   │  │
│  └─────────────────────┘ └─────────────────────┘  │
│  ┌─────────────────────┐ ┌─────────────────────┐  │
│  │ [icon] Comm. Invoice │ │ [icon] Packing List  │  │
│  └─────────────────────┘ └─────────────────────┘  │
│                                                    │
│ ─────────────────────────────────────────────────  │
│ Document collection progress                       │
│ [██████░░░░░░░░░░░░░░] N / M received              │
└────────────────────────────────────────────────────┘
```

Edit mode per card (PENDING doc):
- [Upload Document] button (file input trigger)
- [Mark as Received] button (no file required)

Edit mode per card (RECEIVED doc):
- [Replace File] / [Upload File] button
- [Revert to Pending] button
- Received date + [View] [Download] links (if file_path exists)
- Warning if no file (manually marked)

---

## Data displayed

| Field | Source |
|---|---|
| Document list | `shippingDocs[]` from `shipmentsApi.listDocs` |
| Doc type label | `docLabels[doc.document_type].label` |
| Doc type description | `docLabels[doc.document_type].desc` |
| Doc status | `doc.status` (PENDING / RECEIVED) |
| Received date | `doc.received_date` |
| File link | `doc.id` → `/api/shipping/shipping-documents/${doc.id}/download/` (authenticated) |
| Progress | `receivedCount` / `totalCount` computed |

**Document types and labels:**

| Code | Label | Description |
|---|---|---|
| BOL | Bill of Lading | Shipping contract from carrier |
| COO | Certificate of Origin | Country of manufacture proof |
| CI | Commercial Invoice | Factory invoice for customs |
| PL | Packing List | Detailed packing breakdown |

---

## Interactions

| Action | Handler | API |
|---|---|---|
| Mount | `loadDocs()` | `shipmentsApi.listDocs(orderId)` |
| Upload file | `uploadDoc(doc, event)` | `shipmentsApi.uploadDoc(doc.id, file)` |
| Mark as received (no file) | `markDocStatus(doc, 'RECEIVED')` | `shipmentsApi.updateDocStatus(doc.id, 'RECEIVED')` |
| Revert to pending | `markDocStatus(doc, 'PENDING')` | `shipmentsApi.updateDocStatus(doc.id, 'PENDING')` |
| Toggle edit mode | `isEditing = !isEditing` | — |

---

## Modals / dialogs triggered

None. No overlays. File inputs are triggered programmatically via `fileInputs[doc.id]?.click()`.

---

## API endpoints consumed

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/shipments/docs/?order_id={orderId}` | GET | List all shipping docs for this order |
| `/api/shipments/docs/{docId}/upload/` | POST | Upload file for a document (marks as RECEIVED) |
| `/api/shipments/docs/{docId}/status/` | PUT | Update document status (RECEIVED / PENDING) |

---

## Composables consumed

- `formatDate` from `../../utils/formatters`

---

## PrimeVue components consumed

PrimeVue Icons (`pi-*`) for iconography. No PrimeVue form or overlay components.

---

## Local state

```javascript
const props = defineProps({
  orderId: { type: String, required: true },
  order: { type: Object, required: true },
})

const loading = ref(false)
const isEditing = ref(false)
const shippingDocs = ref([])
const error = ref('')
const uploadingDocId = ref(null)     // which doc is currently uploading
const fileInputs = ref({})           // { [doc.id]: HTMLInputElement, [doc.id + '_replace']: HTMLInputElement }
```

**Key computeds:**
```javascript
const isSailingStage = computed(() => {
  const s = ['LOADED', 'SAILED', 'ARRIVED', 'CUSTOMS_FILED', 'CLEARED',
    'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING']
  return s.includes(props.order?.status)
})
const receivedCount = computed(() => shippingDocs.value.filter(d => d.status === 'RECEIVED').length)
const totalCount = computed(() => shippingDocs.value.length)
```

---

## Permissions / role gating

No role gate within the component. All INTERNAL roles that can see the tab can upload files, mark docs as received, and revert to pending. No write-action role restriction observed.

---

## Bilingual labels (InternalString)

None. All labels are English-only. Document type labels and descriptions are hardcoded English strings.

---

## Empty / error / loading states

| State | Trigger | UI |
|---|---|---|
| Not in sailing stage | `!isSailingStage` | Component renders nothing |
| Loading | `loading` | Cyan spinner centered |
| Load error | `loadDocs()` fails | Inline `error` banner (dismissable) |
| Upload error | `uploadDoc()` fails | Inline `error` banner |
| Status update error | `markDocStatus()` fails | Inline `error` banner |
| Uploading | `uploadingDocId === doc.id` | "Uploading..." spinner on upload button |
| No docs | `!shippingDocs.length` (after load) | "No shipping documents found — Documents will be created automatically when shipments are booked" |
| RECEIVED, no file | `doc.status === 'RECEIVED' && !doc.file_path` | Amber warning "No file uploaded — marked as received manually" |

---

## Business rules

1. **`isSailingStage` guard**: Identical to SailingTab's guard — same 9-status list. This list is independently defined (P-001 instance — should be a shared constant).

2. **Documents are auto-created by the backend**: When a shipment is booked (created), the backend automatically creates document slots (BOL, COO, CI, PL) per shipment. Users cannot add or remove document types. The empty state message reflects this.

3. **File upload implicitly marks RECEIVED**: `shipmentsApi.uploadDoc()` sets the doc status to RECEIVED server-side. No separate status update is needed after upload.

4. **Manual mark-as-received (no file)**: Docs can be marked RECEIVED without uploading a file. The card shows an amber warning indicating the manual receipt. Useful when physical docs are received but not yet scanned.

5. **File replacement in edit mode**: A RECEIVED doc with a file shows a "Replace File" button. Upload triggers `uploadDoc()` which re-uploads and presumably updates `file_path` server-side.

6. **Revert to pending**: In edit mode, a RECEIVED doc can be reverted to PENDING via `markDocStatus(doc, 'PENDING')`. Useful for corrections.

7. **`allDocsReceived()` cross-tab gate**: SailingTab's "Mark as Arrived" action is gated on this tab's `receivedCount === totalCount`. Both tabs call `shipmentsApi.listDocs(orderId)` independently — there is no shared cache.

8. **Flat doc list (no per-shipment grouping)**: All docs across all containers are displayed together. For multi-container orders, there is no UI grouping by shipment. However, each `doc` has a `shipment_id` field available.

9. **`fileInputs` ref map**: Tracks hidden `<input type="file">` elements by doc.id. Each card has two entries: `doc.id` (for upload from PENDING) and `doc.id + '_replace'` (for replacement from RECEIVED). Both trigger the same `uploadDoc(doc, event)` handler.

10. **File serving path**: `<a :href="\`/api/shipping/shipping-documents/${doc.id}/download/\`">` — authenticated download endpoint. Requires valid session cookie; INTERNAL users pass through; CLIENT users require `show_shipping` portal permission on their own order; FACTORY users are blocked. **G-019 fixed (Patch 14, 2026-04-22).**

---

## Known quirks / bugs

### Q-001 — `/uploads/${doc.file_path}` — unauthenticated file access — **FIXED (G-019 / Patch 14, 2026-04-22)**

The View and Download links previously constructed file URLs as `/uploads/${doc.file_path}` using direct string interpolation. Backend audit confirmed the `/uploads/` path was served **without any authentication** in both development and production.

**Root cause (original finding):**
- `backend/main.py:163` — `app.mount("/uploads", StaticFiles(...))` — Starlette `StaticFiles` sub-app bypasses FastAPI DI entirely; no `Depends(get_current_user)` reachable.
- `nginx/nginx.conf` — All 3 server blocks had `location /uploads/ { alias /app/uploads/; }` with no `auth_request` directive — nginx served files directly from the shared volume.

**Live test results at discovery (2026-04-22, localhost:8000 — all now return 404):**

| Test | Auth header | File type | HTTP before fix | HTTP after fix |
|---|---|---|---|---|
| Shipping BOL PDF | None | BOL PDF | **200** (5,487 bytes) | **404** |
| Payment proof PDF | None | Payment PDF | **200** (35,629 bytes) | **404** |
| Order image | None | PNG | **200** (186,154 bytes) | **404** |
| Order image | `Bearer FAKE_TOKEN_NOT_REAL` | PNG | **200** (186,154 bytes) | **404** |

**Fix applied (Patch 14, 2026-04-22):**
- `ShippingDocsTab.vue` — View + Download `<a>` hrefs changed to `` `/api/shipping/shipping-documents/${doc.id}/download/` `` (authenticated `FileResponse` endpoint).
- `backend/routers/shipping.py` — `GET /api/shipping/shipping-documents/{doc_id}/download/` added: `Depends(get_current_user)` + CLIENT `show_shipping` check + FACTORY block + `FileResponse` stream.
- `backend/main.py` — `StaticFiles` mount removed.
- `nginx/nginx.conf` — All 3 `location /uploads/` blocks changed to `internal;`.
- All other file classes (after-sales photos, query attachments, product images) also fixed in same patch — full scope in `SECURITY_BACKLOG.md` G-019 entry.

**Verification (2026-04-22):** Direct `GET /uploads/...` without auth → 404. Shipping doc download with ADMIN token → 200. CLIENT without `show_shipping` → 403. No auth → 401. 16/16 matrix cells pass.

**Migration note update:** Authenticated download endpoint for Next.js is already fully described — backend endpoint exists at `GET /api/shipping/shipping-documents/{id}/download/`. Next.js can proxy directly or use this endpoint with the session cookie.

### Q-002 — No per-shipment grouping for multi-container orders
For orders with multiple containers, the `shippingDocs[]` list is flat. BOL for Container 1 and BOL for Container 2 appear as two separate cards with no label indicating which container they belong to. Users must infer from context. The `doc.shipment_id` field is available but not rendered.

### Q-003 — No loading indicator for `markDocStatus()` calls
`uploadDoc()` sets `uploadingDocId` for per-card loading state. But `markDocStatus()` (mark as received / revert to pending) has no loading indicator — the button responds immediately with a silent API call. If the API is slow, users may click multiple times.

### Q-004 — `fileInputs` ref map using object mutation
```javascript
const fileInputs = ref({})
// Used as: :ref="el => { if (el) fileInputs[doc.id] = el }"
```
`fileInputs` is a `ref({})` but properties are added by direct mutation of the inner object (`fileInputs[doc.id] = el`). This works in Vue 3 because the `ref()` wraps the object reactively, but it bypasses Vue's reactivity for the individual key additions. Since `fileInputs` is only read (never used in a computed or template binding), this is functionally fine — it's just a registry for DOM references.

---

## Dead code / unused state

None. At 271 lines, this component is tightly scoped.

---

## Duplicate or inline utilities

- **`isSailingStage` hardcoded status list**: Identical to the list in `SailingTab.vue`. Both define the same 9-status array independently. Extract `SAILING_VISIBLE_STATUSES` constant from Next.js SDK types and import in both. (P-001 instance ×2)
- **`docLabels` map**: Document type metadata (label + description). Extract to `utils/constants.ts` for reuse in other document-related views (customs, after-sales).
- **`getDocLabel()`, `getDocDescription()`, `getDocIcon()`**: Pure utility functions. Extract to `utils/doc-helpers.ts`.

---

## Migration notes

1. **Authenticated file download** ✅ **DONE (Patch 14, 2026-04-22)**: Vue component updated to use `/api/shipping/shipping-documents/${doc.id}/download/`. Backend endpoint exists and is auth-gated. For Next.js migration, either proxy through an API route (`GET /api/internal/shipping-docs/[docId]/download`) or call the backend endpoint directly with the session cookie. No unauthenticated path exposure remains. (Q-001 resolved)

2. **Per-shipment grouping**: Group `shippingDocs` by `shipment_id` and show a shipment header (container type + route) per group. Especially important for multi-container orders.
   ```typescript
   const docsByShipment = useMemo(() =>
     groupBy(shippingDocs, d => d.shipment_id), [shippingDocs])
   ```

3. **Shared cache with SailingTab**: Use React Query / SWR with cache key `['shipping-docs', orderId]`. Both `ShippingDocsTab` and `SailingTab` read from the same cache. When docs are updated here, SailingTab's `allDocsReceived()` gate automatically reflects the change.

4. **`fileInputs` ref map → React useRef pattern**:
   ```typescript
   const fileInputsRef = useRef<Record<string, HTMLInputElement>>({})
   // In JSX: ref={el => { if (el) fileInputsRef.current[doc.id] = el }}
   ```

5. **Add loading state for `markDocStatus()`**: Track which doc is being status-updated (separate from `uploadingDocId`):
   ```typescript
   const updatingDocId = ref<string | null>(null)
   ```

6. **`docLabels` and utilities → shared constants**: Move to `src/lib/shipping-docs.ts` for reuse across customs, after-sales, and factory portal views.

7. **`isSailingStage` constant**: Share with `SailingTab` — import `SAILING_VISIBLE_STATUSES` from `@/types/order-status.ts`.

8. **Component size is good**: At 271 lines, this is already well-scoped. Port with minimal structural change. Main work is the authenticated file serving and the shared cache integration.
