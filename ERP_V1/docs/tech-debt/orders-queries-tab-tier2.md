# Tech debt — Orders Queries Tab Tier 2 (deferred features)

**Filed:** 2026-04-27
**Predecessor:** `feat/orders-queries-tab` (Tier 1, merged)
**Estimated effort:** 6–8 h
**Priority:** MEDIUM

## Background

Vue's `frontend/src/components/order/QueriesTab.vue` is **1019 LOC**.
Phase 2 of the migration split the work into two tiers to keep the
review surface manageable:

- **Tier 1 (shipped):** read + create + reply (text only) + resolve +
  reopen + delete + deep-link + notification mark-read on mount. ~80%
  of daily-use value.
- **Tier 2 (this doc):** the power-user features that sit on top of
  Tier 1.

## Deferred features

### 1. Reply with file attachment

Backend endpoint `POST /api/orders/{id}/queries/{qid}/reply/upload/?
message=…` exists and is R-19 verified (see migration log §1.5
2026-04-27). Vue uploads the file as multipart `file` field and the
human-readable message as a `?message=` query param.

Backend stores the attachment at
`orders/{order_id}/queries/{query_id}/att_xxxxxxxx.{ext}` and exposes
it at `GET /api/orders/{id}/queries/{qid}/attachments/{filename}`
(Bearer-auth required).

**Implementation sketch:**
- New proxy: `POST /api/orders/[id]/queries/[query_id]/replies/upload/
  route.ts` — streams `req.body` to backend with `?message=` query
  param translation (same pattern as the resolve endpoint).
- New proxy: `GET /api/orders/[id]/queries/[query_id]/attachments/
  [filename]/route.ts` — Bearer-auth + arrayBuffer streaming + CD
  pass-through (same pattern as
  `/api/orders/[id]/documents/[doc_id]/download`).
- ReplyForm: add a paperclip button + hidden file input + selected-file
  badge above the textarea. Submit either text-only or text+file based
  on what's picked.
- Thread: render attachments inline. Image extensions get inline
  `<img src={proxiedUrl}>`; videos get a video thumbnail + play
  button; everything else gets a download link.

### 2. Image lightbox + video player

Vue ships `openLightbox(url)` + `closeLightbox()` + zoom controls,
plus a `videoPlayerUrl` modal. `<ImageLightbox>` already exists in
Layer 2 (`apps/web/src/components/composed/image-lightbox.tsx`) — port
the wiring from Vue but use the existing primitive. Video player is
new — wrap a `<video controls autoplay>` in an AlertDialog-style
modal.

### 3. Bulk select + bulk resolve

Vue exposes a sticky bulk-action bar when `selectedIds.size > 0`. Add:
- Per-card checkbox (only on cards in OPEN or REPLIED status — already
  resolved queries can't be bulk-resolved meaningfully).
- "Select all (filtered)" master checkbox in the header.
- Sticky `<BulkActionBar>` shown above the list when selection is
  non-empty: count badge + "Resolve all" + "Clear selection".
- Resolve-all dispatches the existing PUT `/queries/{qid}/resolve/`
  proxy in a sequential loop (Vue does this — no bulk endpoint
  exists).

No new backend endpoints needed.

### 4. Analytics panel

Vue's collapsible analytics panel has 3 charts:
- **Query type breakdown** — horizontal bars, percent + count per
  query_type (existing `QUERY_TYPE_LABELS` mapping).
- **Resolution rate** — donut chart (SVG circle with
  `stroke-dasharray`) showing `resolvedCount / total * 100`.
- **Top queried items** — top-5 list keyed on `product_code`, with
  total + open counts.

All computed client-side from the already-fetched query list —
**no backend changes needed**. ~80 LOC of computeds + ~120 LOC of
JSX/SVG.

### 5. CSV export

`exportToCsv()` builds a CSV from the filtered list and triggers a
download via `URL.createObjectURL`. ~30 LOC. Same pattern as the
factory-ledger xlsx download (`useBlobDownload`-adjacent), but the
data is already in memory so no backend call is needed.

### 6. Polling refresh

Vue runs:
- 5 s thread polling when a query is expanded
- 10 s list polling otherwise

TanStack Query handles this for free. Add to the `useQuery` config:
```ts
refetchInterval: expandedId ? 5_000 : 10_000,
refetchIntervalInBackground: false,
```

The Tier 1 component currently uses `staleTime: 30_000` with no auto-
refetch. Polling can also wait for Tier 2 — the topbar bell will be
the first place users notice new replies.

## Dependencies

- Tier 1 must be merged first (this PR).
- `<ImageLightbox>` already in Layer 2 — no new primitive needed.
- Bulk operations need no new backend endpoints.
- CSV export is fully client-side.
- The 6 features can land independently (split into 3-4 small PRs)
  or as one Tier 2 PR.

## Test surface (Tier 2)

Estimated +30 component tests: attachment upload (multipart), download
(blob auth), lightbox open/close/zoom, video play, bulk select toggle,
bulk resolve loop, analytics computeds (3 charts), CSV blob trigger,
polling refetch on expand.

## Why not ship Tier 2 in the same PR?

- Tier 1 is 1500 LOC of net-new app code + 853 LOC of tests across 2
  commits. Adding Tier 2 would push it to ~3000 LOC + 1500 LOC of
  tests in one PR — past the practical review limit.
- Tier 1 covers 80% of daily traffic (read + reply + resolve + create
  + delete). Tier 2 is power-user features that benefit fewer users
  per day.
- Each Tier 2 feature is independently testable + independently
  shippable. Splitting reduces blast radius per merge.

## How to schedule

When the next iteration cycle has 6–8 h of capacity, pick this off the
tech-debt list. No deadline; no user-facing blocker. The Tier 1 UI
is fully functional without it.
