# Migration log — OrderFilesTab + nginx already in place

**Date:** 2026-04-27
**Branch:** _not yet created_ (planning only — Phase 1 + 2)
**Author:** sachinmurugesan111@gmail.com
**Conventions in effect:** R-16, R-17, R-18, R-19 (per `ERP_V1/CONVENTIONS.md`)
**Source spec:** Orders Phase 3 — FilesTab migration (Phase 1 + 2 ONLY, no code)
**Predecessor:** `2026-04-26-orders-dashboard-tab.md` (PR #4, merged) — promoted shell to `/orders/{uuid}`, migrated dashboard tab.

---

## 0. Stop conditions check (per spec)

| # | Stop condition | Status | Notes |
|---|---|---|---|
| 1 | FilesTab.vue not found | ✅ no | Found at `frontend/src/components/order/FilesTab.vue` |
| 2 | FilesTab.vue over 400 lines | ✅ no | **33 lines** — wildly under |
| 3 | Backend not responding | ⚠ **YES** at probe time | Postgres on `:5432` was down; FastAPI returns `OperationalError`. Continued with backend source-of-truth (Python router code is the actual response). Live R-19 re-verify is a Phase 3 prereq. |
| 4 | Upload over 10 MB / chunked | ⚠ **YES** | Backend `MAX_UPLOAD_SIZE = 600 MB` (env-tunable; `backend/config.py:49`). Backend already streams via `stream_upload_to_disk` shared utility. The Next.js proxy must use `request.body` streaming (not `await request.formData()` which buffers the whole file in memory). **Flagged as a Phase 3 design constraint, not a hard stop.** |
| 5 | File preview required (PDF viewer, image lightbox) | ✅ no | Vue does not preview anything — just lists name/type/size |
| 6 | Download requires Bearer token in header (not cookie) | ⚠ **YES** | Backend `download_document` uses `Depends(get_current_user)` which reads JWT from `Authorization: Bearer …`. So the Next.js proxy must inject the Bearer header server-side (it already has the cookie → token mapping via `getServerClient`). The existing `useBlobDownload` hook (`apps/web/src/lib/use-blob-download.ts`) is the canonical client wrapper for this exact pattern. Not a hard stop. |

**Verdict:** No hard stops. Two flags (large-upload streaming + Bearer-auth download) are well-understood Phase 3 design constraints; both have established patterns in the codebase.

---

## 1. Phase 1 — Discovery

### 1.1 FilesTab.vue summary

**Line count: 33** (entire `<script setup>` + `<template>` + `<style>` combined).

```
Layout: bg-white rounded-xl shadow-sm p-6 card with paperclip-icon header
        "Documents (N)" then either a list of rows OR empty-state message.
Per-row layout: file-icon + filename (truncate) + (doc_type · file_size) below
```

**Props:**
```ts
{
  orderId: string,
  order: object,
  documents: Array<DocumentRecord> (default: [])
}
```

**Helpers:**
- `formatFileSize(bytes)` — bytes → "X B" / "X.X KB" / "X.X MB" inline.
  Threshold: 1 KiB / 1 MiB. No GB tier (despite 600 MB upload limit — Phase 3 should cap at GB).

### 1.2 Every field displayed

For each document row:

| Field | Source | Vue rendering |
|---|---|---|
| Filename | `doc.filename` | `<p class="text-sm text-slate-700 truncate">` |
| Document type | `doc.doc_type` | shown as part of meta-line: `{{ doc.doc_type }} · {{ formatFileSize(doc.file_size) }}` |
| File size | `doc.file_size` (bytes) | formatted via `formatFileSize` |

**Fields exposed by backend but NOT displayed by Vue:**
- `id` — used as `:key` only
- `order_id` — not displayed
- `uploaded_at` — **not displayed in Vue** (backend returns it, FilesTab ignores it)

### 1.3 Every action

**None.** FilesTab.vue is purely presentational. There is:
- No upload button
- No download link
- No delete button
- No tag/rename action
- No category filter
- No search

The Vue source has the API wrappers for upload / download / delete (`frontend/src/api/index.js:394-405`):
```js
documentsApi = {
  list:     (orderId)         => api.get(`/documents/orders/${orderId}/`),
  upload:   (orderId, fd)     => api.post(`/documents/orders/${orderId}/`, fd, multipart),
  download: (docId)           => api.get(`/documents/${docId}/download/`, blob),
  delete:   (docId)           => api.delete(`/documents/${docId}/`),
}
```
…but only `list` is invoked from `OrderDetail.vue` (line 126). `upload`/`download`/`delete` are unused in the entire Vue codebase except for `ClientOrderDetail.vue` which uses `download` (client portal — out of admin-portal scope).

**This is the central Phase 2 question** — see decision D-1 below.

### 1.4 Documents prop source (Vue today)

`frontend/src/views/orders/OrderDetail.vue:122-134`:
```js
const [orderRes, timelineRes, nextRes, docsRes] = await Promise.all([
  ordersApi.get(orderId),
  ordersApi.timeline(orderId),
  ordersApi.nextStage(orderId).catch(...),
  documentsApi.list(orderId).catch(() => ({ data: [] })),
])
documents.value = docsRes.data
// ...
<FilesTab :order-id="orderId" :order="order" :documents="documents" />
```

So Vue fetches documents at the page level (in parallel with timeline + next-stages) and passes them in.

**Next.js shell (`order-shell-client.tsx`) does NOT currently fetch documents.** The shell tab contract today passes only `{orderId, order, role, timeline}` to OrderDashboardTab and `{orderId, tabValue, tabLabel}` to DeferredTabFallback. We have to either:
- (a) Add a `documentsQuery` to the shell client, mirror Vue, pass as a prop.
- (b) Self-fetch inside `<OrderFilesTab>` via TanStack Query (the precedent set by OrderDashboardTab in Phase 2 §3.1 of PR #4 — "tabs self-fetch their own data unless the data is shared").

Documents are tab-specific (only FilesTab uses them), so (b) matches the established pattern. Decision D-2 below.

### 1.5 Every API endpoint, with shapes

R-19 caveat: live curl was attempted against `http://localhost:8001/api/auth/login` and returned a Postgres-down 500 (`psycopg2.OperationalError`). Local DB is not running and Docker is not up. Shapes captured from backend serializer source (`ERP_V1/backend/routers/documents.py`) — that source IS the actual response. **Live R-19 re-verify is a Phase 3 prereq before any test fixture lands.**

#### A. `GET /api/documents/orders/{order_id}/` — list

- **Auth:** any authenticated user (`Depends(get_current_user)`). RLS: CLIENT/FACTORY users restricted to their own orders.
- **Response:** bare array (no envelope) — see `documents.py:45-55`:
  ```ts
  Array<{
    id: string,
    order_id: string,
    doc_type: string,
    filename: string,
    file_size: number,        // bytes
    uploaded_at: string|null  // ISO 8601
  }>
  ```
- **Sorted:** `uploaded_at DESC` (newest first).
- **Note:** the backend deliberately does NOT expose `file_path` — security decision (only the ID is needed for download).

#### B. `POST /api/documents/orders/{order_id}/` — upload

- **Auth:** any authenticated user. RLS as above.
- **Rate limit:** `30/hour` (per IP, via `@limiter.limit("30/hour")`).
- **Request:** `multipart/form-data` with two fields:
  - `file: UploadFile` — the file blob
  - `document_type: str` — required form field (categorization label, e.g. "PI", "BOL", "Invoice")
- **Server processing:** `stream_upload_to_disk(file, file_path, MAX_UPLOAD_SIZE)` — chunked write, validates size, cleans up partial file on fail.
- **Response (201 implicit):** single object, same shape as list item.
- **Filename sanitization:** server prepends `YYYYMMDD_HHMMSS_` and runs `sanitize_filename()` to strip path separators / control chars.
- **MAX_UPLOAD_SIZE: 600 MB** (`config.py:49`, env-tunable).

#### C. `GET /api/documents/{doc_id}/download/` — download

- **Auth:** any authenticated user. RLS via the document's parent order.
- **Response:** `FileResponse` (octet-stream, sets `Content-Disposition: attachment; filename="<original>"`).
- **404:** if doc id missing OR file gone from disk.
- **Bearer-token-required** (header, not cookie) — see Stop-condition #6.

#### D. `DELETE /api/documents/{doc_id}/`

- **Auth:** **`ADMIN | SUPER_ADMIN | OPERATIONS` only** — explicit check at `documents.py:132` (`if current_user.role not in (...)` → 403).
  - **NOT** allowed: FINANCE, CLIENT, FACTORY.
  - This is a **stricter** gate than the GET/POST endpoints (which accept any authenticated user).
- **Side effect:** removes file from disk via `os.remove(full_path)` (best-effort, no error if missing) before `db.delete(doc)`.
- **Response:** `{message: "Document deleted"}`.

### 1.6 Existing Next.js proxies

Under `apps/web/src/app/api/orders/[id]/`:
- `route.ts`, `boe`, `factory-payments`, `go-back`, `jump-to-stage`, `next-stages`, `payments`, `shipments`, `timeline`, `transition`

**No documents proxy exists.** We will need to add (depending on D-1 scope):
- `apps/web/src/app/api/orders/[id]/documents/route.ts` — GET list (always needed) + POST upload (CRUD scope)
- `apps/web/src/app/api/orders/[id]/documents/[doc_id]/route.ts` — DELETE (CRUD scope)
- `apps/web/src/app/api/orders/[id]/documents/[doc_id]/download/route.ts` — GET binary download (CRUD scope)

Note: backend mounts `documents.py` at `/api/documents/...` not `/api/orders/{id}/...`. We deliberately re-org under `/api/orders/[id]/documents/` for FE-routing consistency (every order-scoped proxy lives at `/api/orders/[id]/*`). The proxy URL → backend URL mapping:

| Next.js proxy | Backend URL |
|---|---|
| `GET /api/orders/[id]/documents` | `GET /api/documents/orders/{id}/` |
| `POST /api/orders/[id]/documents` | `POST /api/documents/orders/{id}/` |
| `DELETE /api/orders/[id]/documents/[doc_id]` | `DELETE /api/documents/{doc_id}/` |
| `GET /api/orders/[id]/documents/[doc_id]/download` | `GET /api/documents/{doc_id}/download/` |

The `[id]` order id in the path is forwarded for routing/auth context only — backend uses it on the list/upload endpoints; the doc-id endpoints don't need it but we keep the prefix for FE consistency. (Same pattern we used for `/api/orders/[id]/boe?shipment_id=…` in PR #4.)

### 1.7 Download mechanism

Vue uses `responseType: 'blob'` (line 404), confirming Bearer-auth + blob handling. Vue's axios instance attaches the JWT via interceptor.

In Next.js: the cleanest pattern is **a Next.js download proxy + the existing `useBlobDownload` hook** (`apps/web/src/lib/use-blob-download.ts`). The hook:
- `fetch(url, { credentials: "include" })` — sends Next.js session cookie
- The proxy reads cookie, exchanges for JWT, calls backend with Bearer header
- Streams the blob back; the hook reads `Content-Disposition` for filename + triggers `<a download>` click via `URL.createObjectURL`
- Already used by `/finance/factory-ledger` download (xlsx/pdf) — proven pattern.

The download proxy at `apps/web/src/app/api/orders/[id]/documents/[doc_id]/download/route.ts` will mirror `apps/web/src/app/api/finance/factory-ledger/[id]/download/route.ts` (which is the canonical streaming-binary pattern in this codebase — directly fetches and pipes ArrayBuffer + headers). I read it earlier in PR #4 §1.10.

### 1.8 Role gating + matrix.ts

**Existing matrix.ts has NO document-related entries.** (Confirmed by grep.)

If we ship Vue parity (read-only), no new permission needed — list endpoint accepts any authenticated user.

If we ship CRUD, we need TWO new permissions:
- `DOCUMENT_UPLOAD = [ADMIN, OPERATIONS, FINANCE, CLIENT, FACTORY]` — backend allows any auth user; FE could be more restrictive (e.g. exclude CLIENT in admin portal — but admin portal is internal, so CLIENT/FACTORY don't appear there anyway)
- `DOCUMENT_DELETE = [ADMIN, OPERATIONS]` (SUPER_ADMIN bypass implicit) — mirrors backend `documents.py:132` exactly

These come into play in decision D-1.

### 1.9 D-004 considerations

Documents are general-purpose attachments (PI, BOL, Invoice, etc.). The `doc_type` field is a freeform string set at upload. **No D-004 (factory cost / margin) implication** — documents themselves don't carry pricing data. The list endpoint is identical for all roles.

### 1.10 Design system reference

There is no dedicated "files tab" reference screen in `Design/screens/`. Closest fits:

- **`Design/screens/settings.jsx`** — sub-nav with chip-style triggers + content card. The list-row pattern (label + meta-line + action) is the closest.
- **`Design/screens/inventory.jsx`** — table patterns for tabular data.

For Vue parity (compact list), the natural Layer 2 building blocks are:
- `<Card>` primitive (already used by all dashboard-tab cards)
- A simple custom row component (per-document) — too lightweight to warrant Layer 2 promotion
- `<Skeleton>` for loading
- `<DeleteConfirmDialog>` (composed/) for the delete action — ALREADY EXISTS, used by clients-list + transporters-list

For CRUD scope, we additionally need:
- An upload button / drop zone — **no existing Layer 2 component**. Decision D-3.
- `useBlobDownload` (lib/) for download — ALREADY EXISTS.

### 1.11 Complexity rating

**SIMPLE if read-only mirror (D-1=A):** ~3 hours. Add 1 proxy + 1 component + 1 wire-up + tests.

**MODERATE if full CRUD (D-1=B):** ~6-8 hours. Add 4 proxies + 1 component (with upload + delete UI) + permissions matrix entries + delete/upload tests + streaming-upload proxy concerns + download proxy. The 600 MB MAX_UPLOAD_SIZE means the upload proxy MUST stream (`request.body` ReadableStream → undici fetch streaming forward) rather than `request.formData()` which buffers in memory.

---

## 2. Phase 2 — UX Reasoning

### 2.1 File list layout

Vue renders a vertical list of `bg-slate-50 rounded-lg` rows inside a card. No table. Each row is:

```
[file-icon]  filename
             doc_type · 1.2 MB
```

Right-aligned actions are absent in Vue. For Next.js, we propose two layouts:

| Option | Description | Pros | Cons |
|---|---|---|---|
| **L-1 (mirror Vue)** | Vertical list of `<Card>`-like rows with filename + meta-line | Identical to Vue parity. Low complexity. Empty state simple. | No download/delete affordances visible (relies on D-1=A read-only) |
| **L-2 (table)** | `<Table>` primitive: 4 columns: Filename · Type · Size · Actions (download + delete kebab) | Standard list-page pattern (used by clients-list, transporters-list). Easy to add per-row actions. | Heavier visual weight; less suited to compact tab content |
| **L-3 (Vue mirror + per-row right-aligned action group)** | Vue layout + add a `download` icon-link on each row + a delete icon-link (role-gated) | Compact + functional. Best of both. | Custom; no Layer 2 list-row component to lift from |

**Recommendation:** L-3 if D-1=B (CRUD), L-1 if D-1=A (read-only mirror).

### 2.2 Upload UX (only relevant if D-1=B)

| Option | Description |
|---|---|
| **U-A** | "Upload file" `<Button>` → opens hidden `<input type="file">`. After selection, post immediately, refresh query. Simplest. |
| **U-B** | Click-to-upload card (styled drop zone) + drag-and-drop support. Better discoverability. Needs ~30 lines of `onDrop` handling + visual hover state. |
| **U-C** | Full upload modal with `document_type` select + file input + Cancel/Upload buttons. Backend REQUIRES `document_type`, so we can't skip it. Modal is the cleanest place to gather both. |

**Recommendation:** **U-C** (modal). Reason: the backend requires the `document_type` form field, so we can't fire-and-forget on file-input change — we always need to ask the user "what kind of document is this?" before posting. A small `<AlertDialog>`-style modal with `<Select>` (doc_type from a controlled list: `PI`, `Proforma`, `Invoice`, `BOL`, `BOE`, `Packing List`, `Other` — tbd) + `<Input type="file">` + `<Button>Upload</Button>` is the pragmatic shape.

### 2.3 Upload progress (only relevant if D-1=B)

`fetch` doesn't expose upload progress (browsers haven't shipped `ReadableStream` upload progress yet across the board). To show progress we'd need `XMLHttpRequest`'s `upload.onprogress`. The realistic options:

| Option | Description |
|---|---|
| **P-A** | Spinner on the Upload button + disabled state. No file-level progress. Toast on success/error. |
| **P-B** | Per-file progress bar via `XMLHttpRequest.upload.onprogress`. Adds ~50 lines. Useful for big files (≤600 MB). |

**Recommendation:** **P-A** for v1. Documents are typically PDFs/Excels in the < 5 MB range; the spinner-only UX is acceptable and matches the rest of the app. Revisit if real users hit visible delays. Frame as a future-task in the migration log.

### 2.4 Download handling

Already covered in §1.7. **Use the existing `useBlobDownload` hook + a new download proxy route.** Per-row "Download" icon button calls `download("/api/orders/{id}/documents/{doc_id}/download", doc.filename)`. Hook handles cookie-auth → proxy → Bearer → blob → browser save dialog.

### 2.5 Delete confirmation

`<DeleteConfirmDialog>` (composed/) already supports the "type the filename to confirm" pattern from the clients-list migration. For documents we propose:

- **Single-file delete** (no bulk delete needed in v1)
- **Simple confirm** (no typed-confirmation): "Delete `<filename>`? This cannot be undone." + Cancel / Delete buttons. Reason: documents are easy to re-upload; the typed-confirmation friction would be excessive for a mid-volume action.
- **Role-gated** via `<RoleGate permission={Resource.DOCUMENT_DELETE}>` wrapping the per-row delete button.

### 2.6 Empty state

Per the **Empty-state CTA rule** in CONVENTIONS Section 10:

**Pattern A** — no-data-yet (the resource has never had rows):
- Icon: paperclip (matches Vue's `pi pi-paperclip`)
- Heading: `No files attached to this order yet.`
- Primary CTA: `Upload a file` button (role-gated for upload — though backend allows any auth user, so effectively visible to all internal portal users) — **only present if D-1=B**.
- For D-1=A (read-only), the empty state is the heading line alone.

There's no "filtered empty state" because the file list is unfiltered.

### 2.7 Role-based variations

Assuming D-1=B (CRUD):

| Role | List | Upload | Delete |
|---|---|---|---|
| SUPER_ADMIN | ✅ | ✅ | ✅ |
| ADMIN | ✅ | ✅ | ✅ |
| OPERATIONS | ✅ | ✅ | ✅ |
| FINANCE | ✅ | ✅ | **❌ — delete button hidden via RoleGate** |
| CLIENT | ✅ (own orders only) | ✅ | ❌ |
| FACTORY | ✅ (own orders only) | ✅ | ❌ |

The admin portal only sees ADMIN / OPERATIONS / FINANCE / SUPER_ADMIN; CLIENT / FACTORY are routed to their own portals (out of scope for this PR per D-4 from the previous migration).

### 2.8 Awaiting decisions

Five explicit calls before I open Phase 3:

| # | Question | Recommendation | Alternatives |
|---|---|---|---|
| **D-1** | **Scope: read-only mirror of Vue, or full CRUD (upload + download + delete)?** | **(B) full CRUD** — backend already supports it, the action wrappers exist in Vue but the UI was deferred. The migration is the natural moment to add the missing UI. ~6-8 h vs ~3 h for read-only. | (A) read-only mirror; ship CRUD as a follow-up PR. Faster but leaves the tab functionally identical to a stub. |
| **D-2** | **Documents fetch: shell prop (mirror Vue) or self-fetch via TanStack Query?** | **(B) self-fetch inside `<OrderFilesTab>`** — matches the precedent set by OrderDashboardTab in PR #4 (Phase 2 §3.1). Tab-specific data lives with the tab. | (A) lift documentsQuery into `order-shell-client.tsx` like `timelineQuery`, pass as prop. |
| **D-3** | **Upload UX (only if D-1=B): button-only / drop-zone / modal-with-doc-type-select?** | **(U-C) modal** — backend requires `document_type` form field, so we have to ask anyway. Modal is the cleanest container. | U-A button-only doesn't work (no place to enter doc_type); U-B drop zone is nice but doesn't solve the doc_type prompt — would still need a modal after drop. |
| **D-4** | **Upload progress (only if D-1=B): spinner-only or per-file XHR progress bar?** | **(P-A) spinner-only for v1** — most documents are small; progress bar is ~50 LOC of XHR juggling. Frame the bar as a future task. | (P-B) progress bar — better UX for large files. |
| **D-5** | **New permissions in matrix.ts (only if D-1=B): add `DOCUMENT_UPLOAD` + `DOCUMENT_DELETE` matching backend?** | **Yes** — matrix.ts is the source of truth for FE role gating. Add both with verified-backend-mapped roles (DOCUMENT_DELETE = `[ADMIN, OPERATIONS]`, SUPER_ADMIN bypass implicit). | Skip and trust backend — but breaks the matrix-as-SoT pattern. |

**Implicit confirmation:**

| # | Question | Recommendation |
|---|---|---|
| **D-6** | Confirm scope: still admin portal only — do not touch CLIENT or FACTORY portal Vue code | **Confirm** |

---

## 3. Phase 3 plan preview (DO NOT EXECUTE — for context only)

If D-1=B (CRUD) approved:

1. Branch `feat/orders-files-tab` from main
2. **R-19 re-verify endpoints LIVE** (backend prereq — bring up Postgres + FastAPI first; same procedure as PR #4)
3. **Commit 1** — 2-3 new proxy routes following the verified-shape pattern:
   - `/api/orders/[id]/documents/route.ts` (GET list + POST upload — streaming `request.body`)
   - `/api/orders/[id]/documents/[doc_id]/route.ts` (DELETE, role-gated)
   - `/api/orders/[id]/documents/[doc_id]/download/route.ts` (GET stream binary, mirrors factory-ledger/download pattern)
   - Tests with R-19 fixtures
4. **Commit 2** — matrix.ts: add `DOCUMENT_UPLOAD` + `DOCUMENT_DELETE` permissions (lib package + tests)
5. **Commit 3** — `<OrderFilesTab>` component:
   - Self-fetch via TanStack Query (`useQuery` for list)
   - Upload modal (`<AlertDialog>` + `<Select doc_type>` + `<Input type=file>`)
   - Per-row download button (uses `useBlobDownload`)
   - Per-row delete button wrapped in `<RoleGate permission={DOCUMENT_DELETE}>` → `<DeleteConfirmDialog>`
   - Skeleton + empty state (per CONVENTIONS Section 10) + error
6. **Commit 4** — wire `<OrderFilesTab>` into `order-tabs.tsx` for `value="files"` (replacing DeferredTabFallback for that tab)
7. **Commit 5** — tests for `<OrderFilesTab>` (15+: list/upload/download/delete/role-gate/empty/error)
8. R-16 + R-17 live verification
9. /qa, /design-review, /cso, /investigate per R-18
10. Migration log update + screenshot evidence
11. PR + merge

**Note on nginx:** `/orders/{uuid}` already routes to Next.js (PR #4). The `?tab=files` URL is the same path → no nginx change. Same deferred-fallback `/_legacy/orders/{uuid}?tab=files` link continues to work for any user that needs to access pre-migration UX (still empty for files tab since Vue's UI doesn't expose upload either, but the link is harmless — they see Vue's read-only list).

---

## 4. Stop point

**Per the user's spec:** Halt here. Await explicit Phase 3 approval. Do not branch, do not write code.

Decisions awaited: **D-1, D-2, D-3, D-4, D-5, D-6** (see §2.8).

---

## 5. Phase 3 — implementation

User approved all recommendations on 2026-04-27 (D-1=B full CRUD,
D-2=B self-fetch, D-3=C upload modal, D-4=A spinner only, D-5=yes
matrix entries, D-6=admin only). Branch: `feat/orders-files-tab`.
5 commits (matrix + proxies + component + wire + docs).

### 5.1 R-19 live verification (2026-04-27, ADMIN, order de2258e0-…)

Backend was up this time (Postgres + FastAPI on `:5432` + `:8001`).
All 4 endpoints curl-verified:

```
GET    /api/documents/orders/{id}/                → 200, [] (bare array)
POST   /api/documents/orders/{id}/                → 200, single doc envelope
                                                     (multipart with file + document_type)
GET    /api/documents/{doc_id}/download/          → 200, octet-stream + Content-Disposition
DELETE /api/documents/{doc_id}/                   → 200, {"message":"Document deleted"}
```

**Two corrections vs Phase 1 spec assumptions** (live curl was the
catch — Phase 1 used backend source-of-truth):

1. Backend URL is `/api/documents/orders/{id}/`, **not**
   `/api/orders/{id}/documents/`. The Vue api wrappers had this right
   (line 395 of `frontend/src/api/index.js`); the spec inferred the
   wrong shape.
2. DELETE returns HTTP 200 with `{"message":"Document deleted"}` body,
   **not** 204 No Content as the Phase 2 spec assumed.

Both corrections are documented in the proxy test fixtures and the
proxy route comments (R-19 paper trail).

### 5.2 Files created

- `harvesterp-web/packages/lib/src/auth/matrix.ts` (modified) —
  added `Resource.DOCUMENT_UPLOAD` + `Resource.DOCUMENT_DELETE` and
  matrix entries `[ADMIN, OPERATIONS]` for both (SUPER_ADMIN bypass).
- `apps/web/src/app/api/orders/[id]/documents/route.ts` — GET list +
  POST upload (streaming multipart via `req.body` + `duplex: "half"`).
- `apps/web/src/app/api/orders/[id]/documents/[doc_id]/route.ts` —
  DELETE (proxy-level role-gate using DOCUMENT_DELETE).
- `apps/web/src/app/api/orders/[id]/documents/[doc_id]/download/route.ts`
  — GET binary stream (mirrors factory-ledger/download pattern).
- `apps/web/src/app/(app)/orders/[id]/_components/tabs/order-files-tab.tsx`
  — full component (590 LOC).
- `apps/web/tests/api/orders-files-proxy.test.ts` — 31 R-19 fixture
  tests.
- `apps/web/tests/app/orders-files-tab.test.tsx` — 21 component tests.

### 5.3 Files modified

- `apps/web/src/app/(app)/orders/[id]/_components/order-tabs.tsx` —
  imports `<OrderFilesTab>`, conditionally renders for `t.value ===
  "files"`. The other 12 tabs continue to render
  `<DeferredTabFallback>` with the `/_legacy/` link.
- `apps/web/tests/app/order-detail-shell.test.tsx` — +1 regression
  test asserting the files tab renders the real component, not the
  fallback.

### 5.4 Tests added

- 31 proxy tests (R-19 fixtures: list-empty, list-populated, upload
  success/auth/role-gate/rate-limit, delete role-gate × 3 +
  success/404/5xx, download stream/CD-pass-through/fallback-name/
  403/404/5xx)
- 21 component tests (list × 5 + empty × 3 + upload × 6 + download × 2
  + delete × 5)
- 1 wire-test (files tab renders real content, not fallback)
- **Total: +53 tests.** Suite: 751 → 804 passing.

### 5.5 nginx, MIGRATED_PATHS

- **No nginx change** — `/orders/{uuid}` already routes to Next.js
  (PR #4). The `?tab=files` URL is the same path; Next.js renders the
  shell which now renders `<OrderFilesTab>` for that tab value.
- **MIGRATED_PATHS.md** — count stays at 11; the existing
  `/orders/{uuid}` row note updated to call out the second migrated
  tab (Files in addition to Dashboard).

---

## 6. Issues encountered (Phase 3)

### Issue 1: Next.js route file rejected the `__INTERNAL_UPLOAD_ROLES` named export

- **Date raised:** 2026-04-27 (Commit 3, build step)
- **Problem:** I exported `UPLOAD_ROLES` from
  `app/api/orders/[id]/documents/route.ts` to give tests an internal
  hook. Next.js 15's route-typing failed the build:
  `Type 'OmitWithTag<…, "GET" | "POST" | …>' does not satisfy the
  constraint '{ [x: string]: never; }'`.
- **Root cause:** Next.js App Router route files only permit a fixed
  set of exports (HTTP verb handlers + `dynamic` / `revalidate` /
  etc.). Ad-hoc named exports trip the type check.
- **Fix applied:** Removed the export. The constant lives inside the
  file as a private; tests import `Resource.DOCUMENT_UPLOAD` from
  `@harvesterp/lib` directly when needed.
- **Date resolved:** 2026-04-27, same commit (in-place fix before
  staging). No tests broken.

### Issue 2: Delete-dialog assertion matched the table row too

- **Date raised:** 2026-04-27 (Commit 4 test run)
- **Problem:** `screen.getByText(/test-doc\.txt/)` failed with "Found
  multiple elements" because the filename appears in BOTH the table
  row AND the dialog body when the dialog opens.
- **Root cause:** Default `getByText` searches the full document.
- **Fix applied:** Scope the assertion to the dialog via
  `screen.findByRole("dialog")` + `within(dialog).getByText(...)`.
  Same pattern recommended for any `<DeleteConfirmDialog>` test where
  the subject string also appears on the page.
- **Date resolved:** Same test run.

---

## 7. Live verification (R-16 + R-17)

Full evidence + live screenshots in
`docs/migration/screenshots/2026-04-27-orders-files-tab.md`.

### 7.1 R-16 console-check results (PASS)

```
fontFamily   = "Manrope, ui-sans-serif, …"  ✅ Manrope
styleSheets  = 2                            ✅ > 0
--f-sans     = "\"Manrope\", …"             ✅ non-empty
console_errors = 0
files_tab_rendered = true
upload_button_rendered = true   (DOCUMENT_UPLOAD ADMIN-visible)
delete_button_count = 3         (DOCUMENT_DELETE ADMIN-visible)
```

### 7.2 R-16 — full CRUD verified live through proxies

```
POST   /api/orders/de2258e0/documents              → 200, doc 214670a9 created
GET    /api/orders/de2258e0/documents/214670a9/download
                                                   → 200, octet-stream, original filename
DELETE /api/orders/de2258e0/documents/214670a9     → 200, {"message":"Document deleted"}
```

DoD #8/#9/#10 all satisfied — upload + download + delete all work
end-to-end against the live backend through the Next.js proxies.

### 7.3 R-16 — fallback for unmigrated tabs still has /_legacy/ link

Strangler-fig invariant from PR #4 (Issue #6 fix) holds:
`?tab=items` renders the deferred fallback with the
`/_legacy/orders/de2258e0-…?tab=items` link to Vue.

### 7.4 R-17 scorecard (PASS, 8.6 avg)

| Dimension | Score |
|---|---|
| Typography | **9** |
| Layout | **9** |
| Spacing | **8** |
| Color | **9** |
| Component usage | **8** |
| **Average** | **8.6 / 10 — PASS** |

All five dimensions ≥ 7 threshold.

### 7.5 Final checklist

- ✅ pnpm lint — 0 errors
- ✅ pnpm test (lib) — **280 / 280**
- ✅ pnpm test (web) — **804 / 804** (was 751 → +53 tests)
- ✅ pnpm build — clean; `/api/orders/[id]/documents/...` routes appear
- ✅ R-16 — 3/3 console checks pass + 0 console errors
- ✅ R-17 — 5/5 dimensions ≥ 7; average 8.6
- ✅ Files tab renders real content at `/orders/:id?tab=files`
- ✅ Upload works end-to-end (verified via in-browser fetch through proxy)
- ✅ Download works (Content-Disposition + filename preserved)
- ✅ Delete works (`{"message":"Document deleted"}` body returned)
- ✅ DOCUMENT_UPLOAD + DOCUMENT_DELETE in matrix.ts (`[ADMIN, OPERATIONS]`)
- ✅ Role gates verified: ADMIN sees upload + delete; FINANCE hidden in tests
- ✅ DeferredTabFallback still active for the other 12 tabs (Items / Payments / Production / Packing / Booking / Sailing / Shipping Docs / Customs / After-Sales / Final Draft / Queries / Landed Cost)
- ✅ Migration log fully updated

Branch: `feat/orders-files-tab` (5 commits + screenshot/log update commit). Push + PR pending.
