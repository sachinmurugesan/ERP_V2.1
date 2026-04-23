# Profile: ordertab_files

## Metadata
- **Source file:** `frontend/src/components/order/FilesTab.vue`
- **Lines:** 34
- **Type:** component (sub-tab)
- **Portal:** internal
- **Tab slug:** `files`
- **Parent shell:** `OrderDetail.vue`
- **Wave:** Wave 8 Session C
- **Profile generated:** 2026-04-22

---

## Purpose

Display-only list of documents attached to an order. Renders filename, document type, and file size for each document. Makes no API calls — the parent shell (`OrderDetail.vue`) pre-fetches the document list via `documentsApi.list()` on mount and passes it as the `documents` prop. No download or view links are provided. This is the smallest tab in the order detail shell.

---

## Layout / visual structure

```
┌──────────────────────────────────────────────────┐
│ 📎 Documents (N)                                 │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ 🗒 filename.pdf                              │ │
│ │   doc_type · X.X KB                         │ │
│ └──────────────────────────────────────────────┘ │
│ (repeated per document)                          │
│                                                  │
│ No documents uploaded yet   ← empty state        │
└──────────────────────────────────────────────────┘
```

Each document row: file icon + filename (truncated) + doc_type + formatted file size. No action buttons.

---

## Data displayed

| Field | Source |
|---|---|
| Document list | `documents` prop (pre-fetched by parent shell) |
| Filename | `doc.filename` |
| Document type | `doc.doc_type` |
| File size | `doc.file_size` → `formatFileSize(bytes)` |

Parent shell API call: `documentsApi.list(orderId)` → passed as `documents` prop.

---

## Interactions

None. Read-only display. No click handlers, no file inputs, no API calls.

---

## Modals / dialogs triggered

None.

---

## API endpoints consumed

None. Data is entirely prop-fed.

---

## Composables consumed

None. No script imports at all — `<script setup>` contains only `defineProps` and one utility function.

---

## PrimeVue components consumed

PrimeVue Icons: `pi-paperclip` (header), `pi-file` (per-row). No form or overlay components.

---

## Local state

```javascript
const props = defineProps({
  orderId: { type: String, required: true },   // not used in template
  order: { type: Object, required: true },     // not used in template
  documents: { type: Array, default: () => [] },
})

function formatFileSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
```

No reactive refs. No computed properties. No lifecycle hooks.

---

## Permissions / role gating

None inside the component. Tab visibility is controlled upstream by the parent shell's `availableTabs` computation. Any INTERNAL user with access to the files tab sees the same document list.

---

## Bilingual labels (InternalString)

None.

---

## Empty / error / loading states

| State | Trigger | UI |
|---|---|---|
| Empty | `documents.length === 0` | "No documents uploaded yet" paragraph |

No loading state (prop-fed, parent shell handles loading). No error state.

---

## Business rules

1. **Prop-fed architecture**: Document data is fetched by the parent shell, not by this component. This centralizes the API call and allows the shell to share the document list with other tabs (e.g., if other tabs need a document count or reference).

2. **No download links**: Intentional omission. Documents are listed for reference only in this tab. The shell may provide download access elsewhere (e.g., via a separate documents API endpoint or dedicated document management view).

3. **`formatFileSize()` is local**: The only logic in the component. Converts raw bytes to human-readable string with B/KB/MB tiers.

---

## Known quirks / bugs

### Q-001 — `orderId` and `order` props declared but unused in template

```javascript
const props = defineProps({
  orderId: { type: String, required: true },  // never referenced in template
  order: { type: Object, required: true },    // never referenced in template
  documents: { type: Array, default: () => [] },
})
```

Both `orderId` and `order` are required props but the template only uses `documents`. This pattern is likely future-proofing for when download links are added (which would need `orderId` for URL construction). Document this intent or remove the unused props until needed.

### Q-002 — No download or view links

The tab shows filename and type but provides no way to open or download a file. For a "Files" tab, this limits utility. The absence of download links is also consistent with the G-019 finding — adding bare `/uploads/` download links would expose files without authentication. If download links are added in the Next.js port, they must route through an authenticated endpoint, not a bare `/uploads/` URL.

### Q-003 — No error state for parent API failure

If `documentsApi.list()` fails in the parent shell, the `documents` prop will be `[]` (or undefined defaulting to `[]`). The tab shows "No documents uploaded yet" — indistinguishable from a genuine empty list. The parent shell's error handling is responsible for surfacing load errors.

---

## Dead code / unused state

- `orderId` prop — declared but unused in template (Q-001)
- `order` prop — declared but unused in template (Q-001)

---

## Duplicate or inline utilities

- **`formatFileSize(bytes)`** — inline utility. Check whether it appears elsewhere in the codebase. If unique to this component, acceptable inline (component is 34 lines). If it appears in any other component, extract to `utils/formatters.ts`. **[Check]**: grep codebase for `formatFileSize` to confirm uniqueness.

---

## Migration notes

1. **Prop-fed pattern → React**: Straightforward port. Parent shell passes `documents` as a prop:
   ```tsx
   <FilesTab orderId={orderId} order={order} documents={documents} />
   ```
   Parent fetches with `useQuery(['order-documents', orderId], () => documentsApi.list(orderId))`.

2. **Future download links**: When adding download links in Next.js, use an authenticated API route pattern:
   ```tsx
   <a href={`/api/internal/documents/${doc.id}/download`}>Download</a>
   ```
   The Next.js API route verifies the session and proxies through the backend's authenticated download endpoint. Do **not** construct bare `/uploads/` URLs. (G-019 compliance)

3. **`formatFileSize`**: Import from `src/lib/formatters.ts` in the Next.js port. Add if not already present:
   ```typescript
   export function formatFileSize(bytes: number | null | undefined): string {
     if (!bytes) return '—'
     if (bytes < 1024) return `${bytes} B`
     if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
     return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
   }
   ```

4. **Unused props**: In the Next.js port, either remove `orderId` and `order` props (pass only `documents`) or add a comment explaining they are reserved for future download link implementation.

5. **Component size is ideal**: 34 lines. Port as-is with minimal change. The simplicity is correct — resist adding complexity.
