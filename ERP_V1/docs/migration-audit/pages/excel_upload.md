## Metadata

| Field | Value |
|-------|-------|
| Type | component |
| Portal | internal |
| Route | `/orders/:id/upload-excel` · `/products/upload-excel` |
| Source file | `frontend/src/views/orders/ExcelUpload.vue` |
| Line count | 1,011 |
| Migration wave | Wave 6 |
| Risk | medium |

---

## Purpose

Route-level orchestrator for Excel file ingestion. Supports two independent mount contexts: an **order upload** context (`/orders/:id/upload-excel`, where `orderId` is present) and a **product bulk-upload** context (`/products/upload-excel`, where `isProductMode = true`). In both contexts the component handles file selection, upload, optional AI column mapping (FACTORY_EXCEL only), poll-driven job status, conflict resolution (via `<ConflictResolutionPanel>`), result review (via `<ParsedResultsTable>`), and final apply.

---

## Layout

Single-page full-width form:

1. **Header bar** — page title + mode label (Order Upload / Product Upload)
2. **Upload zone** — drag-and-drop file area; job type selector (CLIENT_EXCEL / FACTORY_EXCEL)
3. **Column mapping overlay** — `<ColumnMappingDialog>` (conditionally rendered after FACTORY_EXCEL upload if `needs_review` fields returned by AI)
4. **Status / progress section** — polling indicator, cancel button, error banner
5. **Results area** — `<ConflictResolutionPanel>` (if conflicts) + `<ParsedResultsTable>` (parsed rows, row selection, delete-selected)
6. **Action bar** — Apply button, restore-from-bin link (product mode only)

---

## Data displayed

**No props — route-level view.** All data sourced from local state, route params, and API calls.

| Field | Source | Notes |
|-------|--------|-------|
| Job status | `excelApi.getJob(jobId)` polled every 2 s | Drives progress bar and phase transitions |
| Parsed result rows | `results.result_data` | Filtered by `pendingOnly` query param when present |
| Conflict groups | Computed from `results` | Passed to ConflictResolutionPanel |
| AI column mapping | `excelApi.analyzeColumns` response | Shown in ColumnMappingDialog if `needs_review.length > 0` |
| Order detail | `ordersApi.get(orderId)` | Used in order-context mode to populate header; not loaded in product mode |
| Result summary | `results.result_summary` | Counts (matched, new, conflicts, duplicates); WARNING: mutated in `deleteSelected()` — see Known quirks |

---

## Interactions

**No emits — route-level view.**

| Action | Trigger | Outcome |
|--------|---------|---------|
| File drop / select | File input or drag zone | Calls `excelApi.upload`; starts polling on success |
| Job type select | Dropdown | Sets `jobType`; determines CLIENT_EXCEL vs FACTORY_EXCEL flow |
| AI column confirm | ColumnMappingDialog `@confirm` | Calls `excelApi.reparseJob(jobId, confirmedMapping)`; starts polling |
| AI column skip | ColumnMappingDialog `@skip` / `@close` | Calls `excelApi.reparseJob(jobId)` with no mapping; starts polling |
| Cancel job | Cancel button | Calls `excelApi.cancelJob(jobId)`; stops polling |
| Delete selected rows | ParsedResultsTable `@deleteSelected` | Removes rows from `results.result_data`; mutates `results.result_summary` (quirk) |
| Apply parsed data | Apply button | Calls `excelApi.applyParsedData(jobId, payload)` with selections + resolutions |
| Restore from bin | Restore link | Calls `productsApi.restoreFromBin()` (product mode only) |
| Conflict resolution | ConflictResolutionPanel | Emits `update:variantResolutions`, `update:rowOverrides`, `process`; parent updates local state |
| Open image viewer | Click image thumbnail | Adds `window keydown` listener; `viewerImage` set |
| Close image viewer | Escape / close button | Removes `window keydown` listener; `viewerImage = null` |

---

## Modals / dialogs triggered

| Modal | Trigger | Notes |
|-------|---------|-------|
| `<ColumnMappingDialog>` | `showMappingDialog && mappingResult` | Conditionally rendered (v-if); FACTORY_EXCEL only; appears when `needs_review.length > 0` |
| Image lightbox (inline) | Click on product image in results | Uses `viewerImage` state + keydown navigation; implemented inline, not as a separate component |

---

## API endpoints consumed

| Method | Endpoint | When |
|--------|----------|------|
| POST | `/excel/upload/` | On file select; params: file, orderId?, jobType, skipProcessing |
| POST | `/excel/analyze-columns/` | FACTORY_EXCEL only; after upload completes; params: filePath, schemaType='product' |
| POST | `/excel/jobs/{jobId}/reparse/` | After column mapping confirmed or skipped |
| GET | `/excel/jobs/{jobId}/` | Polling every 2 s while job is processing |
| DELETE | `/excel/jobs/{jobId}/` | Cancel button |
| POST | `/excel/apply/{jobId}/` | Apply button |
| POST | `/excel/analyze-conflicts/` | Via `useConflictAnalysis` composable (triggered internally) |
| GET | `/orders/{orderId}/` | Order-context mode; fetches order detail for header |
| POST | `/products/restore-from-bin/` | Product mode; restore-from-bin action |

---

## Composables consumed

| Composable | Source | Returned values used |
|------------|--------|---------------------|
| `useConflictAnalysis` | `composables/useConflictAnalysis.js` | `aiResolutions`, `analyzingConflicts`, `aiResolutionSource`, `aiStats`, `triggerAiConflictAnalysis` |
| `useRoute` | vue-router | `route.params.id` (orderId), `route.query.pendingOnly` |

---

## PrimeVue components consumed

[UNCLEAR] — not verified from source. Likely: `FileUpload` or custom drag-drop zone, `ProgressBar`, `Button`, `Dropdown`, `DataTable`-derived elements via sub-components. Confirm from template scan in Wave 0.

---

## Local state

| Variable | Type | Purpose |
|----------|------|---------|
| `jobType` | ref(String) | 'CLIENT_EXCEL' or 'FACTORY_EXCEL' |
| `jobId` | ref(String\|null) | Active job ID from upload response |
| `jobStatus` | ref(String\|null) | Latest status from polling (PENDING, PROCESSING, DONE, FAILED, CANCELLED) |
| `results` | ref(Object\|null) | Full job result payload (`result_data`, `result_summary`, `conflicts`) |
| `applied` | ref(Boolean) | True after successful `applyParsedData` |
| `selectedRows` | ref(Set) | Row indices selected for apply |
| `variantResolutions` | ref(Object) | `{rowIdx: resolution}` — per-row conflict resolution choices |
| `rowOverrides` | ref(Object) | `{rowIdx: {field: value}}` — per-row field overrides for add_new resolution |
| `duplicateResolutions` | ref(Object) | [UNCLEAR] — may be used in apply payload; verify in Wave 0 |
| `imageConflictResolutions` | ref(Object) | [UNCLEAR] — image-specific conflict handling; verify in Wave 0 |
| `showMappingDialog` | ref(Boolean) | Controls ColumnMappingDialog visibility |
| `mappingResult` | ref(Object\|null) | AI analyze-columns response; passed as prop to ColumnMappingDialog |
| `analyzingColumns` | ref(Boolean) | True while analyzeColumns API call in flight |
| `viewerImage` | ref(String\|null) | URL of image in lightbox; null when closed |
| `isProductMode` | computed(Boolean) | `!orderId` — true when mounted at /products/upload-excel |

---

## Permissions / role gating

| Gate | Scope |
|------|-------|
| Router-level `require_operations` (ADMIN \| OPERATIONS) | All excel endpoints; enforced in backend router |
| D-004: factory cost fields (factory_price, CNY fields, markup) | Restricted to SUPER_ADMIN \| FINANCE; enforced in backend apply handler; frontend renders factory columns in factory mode without client-side gate (acceptable — backend is authoritative) |

---

## Bilingual labels (InternalString)

[UNCLEAR] — InternalString keys for this view not extracted. Verify during Wave 0. Expect: upload zone placeholder, job type labels, status messages, apply button, cancel button, error messages.

---

## Empty / error / loading states

| State | Trigger | Handling |
|-------|---------|---------|
| Pre-upload idle | Component mount, no file selected | Upload zone shown; results area hidden |
| Uploading | File selected, upload in progress | Progress indicator; upload zone disabled |
| Polling | Job processing | 2 s interval spinner; cancel available |
| AI analysis in progress | `analyzingColumns = true` | Spinner overlay; ColumnMappingDialog not yet shown |
| Job FAILED | Polling returns FAILED status | Error banner with message; polling stops |
| Job CANCELLED | Cancel action | Resets to idle |
| No conflicts | Job DONE, no conflict groups | ConflictResolutionPanel not rendered |
| Upload error | `excelApi.upload` throws | `alert()` shown — D-003 instance; replace with toast in Next.js |
| Apply error | `excelApi.applyParsedData` throws | `alert()` shown — D-003 instance |
| Restore error | `productsApi.restoreFromBin` throws | `alert()` shown — D-003 instance |

---

## Business rules

1. `isProductMode = computed(() => !orderId)` — mount context determined solely by route param presence; no explicit prop.
2. CLIENT_EXCEL jobs expect three columns: Barcode, Code, Qty. No AI column mapping triggered.
3. FACTORY_EXCEL jobs expect full product details + images + AI column analysis. `analyzeColumnsFlow` runs after upload.
4. If `analyzeColumns` returns `needs_review.length === 0`, job is immediately reparsed with confirmed mapping; dialog not shown.
5. If `analyzeColumns` throws, fallback is `reparseJob(jobId)` with no mapping; processing continues silently.
6. `pendingOnly` query param (`?pendingOnly=1`): filters `result_data` to rows whose product code matches pending items in the order. Summary counts are not refiltered — they reflect the full job, not the filtered view (silent discrepancy).
7. AI conflict analysis (`useConflictAnalysis`) is triggered separately after job completes and conflicts are present.
8. `applied = true` is a one-way latch — no un-apply action.
9. Product mode includes a restore-from-bin shortcut (products may be soft-deleted before re-upload).

---

## Known quirks

| # | Quirk | Location | Impact |
|---|-------|----------|--------|
| Q-1 | `var conflictGroups` hoisting hack | ~line 547 | `var` used so composable call can reference a value computed after it in declaration order. Forward-reference workaround; harmless but confusing. |
| Q-2 | `deleteSelected()` mutates `results.value.result_summary` directly | ~line 517 | Immutability violation; reactive consistency risk. Replace with spread in Next.js. |
| Q-3 | Image viewer `keydown` listener leak | `openImageViewer` / `onBeforeUnmount` | `onBeforeUnmount` calls `stopPolling()` but does NOT remove keydown listener. If component unmounts while viewer is open, listener orphans. |
| Q-4 | `alert()` for errors | upload, apply, restore handlers | D-003 instance × 3. Replace with `useToast` or inline error state in Next.js. |
| Q-5 | Fixed-interval polling (2 s, no backoff) | `startPolling` / `setInterval` | P-019: long-running jobs hit backend every 2 s indefinitely. Use TanStack Query `refetchInterval` with backoff, or SSE. |
| Q-6 | `pendingOnly` summary count mismatch | `pendingOnly` filter branch | `result_summary` counts not filtered; UI shows mismatched total vs visible rows. |

---

## Dead code / unused state

| Item | Notes |
|------|-------|
| `conflictGroups` argument in `useConflictAnalysis(results, variantResolutions, conflictGroups)` call | Composable never reads this parameter internally — dead argument. Composable rebuilds conflict groups from `results` itself. Remove in Next.js. |
| `duplicateResolutions` and `imageConflictResolutions` state | [UNCLEAR] — may be used in apply payload; flag for Wave 0 verification before removal. |

---

## Duplicate or inline utilities

- `analyzeColumnsFlow` is an inline async function — not a composable. If column mapping is needed elsewhere, extract to `useColumnMapping` composable in Next.js.
- `startPolling` / `stopPolling` are inline interval wrappers — extract to `useJobPoller` composable (addresses P-019 simultaneously).

---

## Migration notes

1. **Split mount contexts** — implement as two Next.js routes: `/orders/[id]/upload-excel` (page) and `/products/upload-excel` (page). Share an `<ExcelUploadFlow>` component between them; pass `orderId` as prop (null for product mode). Eliminates the implicit `isProductMode` hack.
2. **Replace polling with TanStack Query** — `refetchInterval` + exponential backoff; or use SSE for job status stream (P-019).
3. **Replace `alert()`** — use `useToast` from shadcn or a global notification system (D-003).
4. **Fix listener leak** — call `window.removeEventListener` in cleanup; use a composable that self-cleans via `useEffect` return.
5. **Fix immutability** — replace `results.value.result_summary.x -= n` with a spread update.
6. **Remove dead argument** — do not pass `conflictGroups` to `useConflictAnalysis`; update composable signature.
7. **Factory cost gating** — D-004: add client-side conditional rendering for factory cost columns gated on `SUPER_ADMIN | FINANCE` role check in Next.js; backend remains authoritative.
8. **Verify `duplicateResolutions` / `imageConflictResolutions`** — determine if used in apply payload; document or remove in Wave 0.
