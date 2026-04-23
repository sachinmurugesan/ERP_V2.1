# Profile: ordertab_queries

## Metadata
- **Source file:** `frontend/src/components/order/QueriesTab.vue`
- **Lines:** 1,013
- **Type:** component (sub-tab)
- **Portal:** internal
- **Tab slug:** `queries`
- **Parent shell:** `OrderDetail.vue`
- **Wave:** Wave 8 Session C
- **Profile generated:** 2026-04-22

---

## Purpose

Item-level query/thread management for an order. Clients post questions about specific packing-list items; INTERNAL staff replies. The tab combines a query list view (with filter, search, bulk actions, analytics) and a slide-out thread drawer (chat bubbles, file attachments, image lightbox, video player). Also integrates with the notification system (`useNotifications`) to mark related notifications as read on open. Supports URL deep-linking via `?query=<id>` to auto-open a specific thread. No stage gate — visible at all order statuses (shell controls visibility).

---

## Layout / visual structure

```
┌────────────────────────────────────────────────────┐
│ Item Queries      [Analytics] [Export CSV] [Refresh]│
│ [search bar]                                       │
│                                                    │
│ [Open 3] [Replied 1] [Resolved 12] [Avg 2h 30m]   │
│ ← KPI cards                                        │
│                                                    │
│ [Analytics panel — collapsible]                    │
│   Type breakdown bars | Resolution % circle |      │
│   Top queried items                                │
│                                                    │
│ [N selected — Resolve All | Clear] ← sticky bulk bar│
│                                                    │
│ [All] [Open] [Replied] [Resolved] | [Type ▼][Sort ▼]│
│                                                    │
│ Table:                                             │
│ ☐ | Status | Subject+status pill+thumbnail | Item  │
│   | Type | Created by | Messages | Last activity   │
│   | [Resolve] [Open]                               │
│                                                    │
│ ──────────────────────────────────────────── →     │
│   Thread Drawer (right slide-out, max-w-2xl)       │
│   Header: status badge, type, subject, product     │
│           [Resolve] [Delete] [Close]               │
│   Messages: chat bubbles (CLIENT left / Admin right)│
│     Image preview | Video card | File link          │
│   Reply: [📎] [textarea] [Send]                    │
│   (Resolved state): [Reopen] [Delete]              │
│                                                    │
│   Resolve Dialog (modal over drawer)               │
│   Image Lightbox (z-60)                            │
│   Video Player Modal (z-60)                        │
└────────────────────────────────────────────────────┘
```

---

## Data displayed

| Field | Source |
|---|---|
| Query list | `queries[]` from `queriesApi.list(orderId)` |
| Thread messages | `selectedQuery.messages[]` from `queriesApi.get(orderId, queryId)` |
| Query status | `q.status` (OPEN / REPLIED / RESOLVED) |
| Query type | `q.query_type` → `QUERY_TYPE_LABELS` map |
| Subject | `q.subject` |
| Product code / name | `q.product_code`, `q.product_name` |
| Created by | `q.created_by_role` |
| Message count | `q.message_count` |
| Last activity | `q.last_message_at` or `q.created_at` |
| Resolution remark | `q.resolution_remark` |
| Message attachments | `m.attachments[]` — paths, URL via authenticated endpoint `GET /api/queries/{orderId}/{queryId}/attachments/{path}/` (see Q-002) |
| Sender | `m.sender_name`, `m.sender_role` |
| Thumbnail | `getQueryThumbnail(q)` — first image attachment → authenticated endpoint URL (see Q-002) |
| Avg response time | Computed from `messages[0]` and `messages[1]` timestamps |

**Query types:** PHOTO_REQUEST, VIDEO_REQUEST, DIMENSION_CHECK, QUALITY_QUERY, ALTERNATIVE, GENERAL

---

## Interactions

| Action | Handler | API |
|---|---|---|
| Mount | `loadQueries()` | `queriesApi.list(orderId)` |
| Open thread | `openThread(query)` | `queriesApi.get(orderId, queryId)` |
| Send reply | `sendReply(queryId)` | `queriesApi.reply(orderId, queryId, {message})` |
| Attach file + send | `onFileSelect(e)` | `queriesApi.replyWithAttachment(orderId, queryId, formData, message)` |
| Resolve (with remark dialog) | `submitResolve()` | `queriesApi.resolve(orderId, resolveTargetId, remark)` |
| Bulk resolve | `bulkResolveSelected()` | `queriesApi.resolve()` per ID (sequential loop) |
| Reopen | `reopenQuery(queryId)` | `queriesApi.reopen(orderId, queryId)` |
| Delete | `deleteQuery(queryId)` | `queriesApi.delete(orderId, queryId)` |
| Mark notifications read | `markReadByResource(...)` | `useNotifications` composable |
| Poll thread (5s) | `threadPollInterval` | `queriesApi.get(orderId, selectedQuery.id)` |
| Poll list (10s) | `listPollInterval` | `queriesApi.list(orderId)` |
| Export CSV | `exportToCsv()` | Client-side Blob URL |
| Deep-link open | `watch(route.query.query)` | `queriesApi.list()` if not loaded |

---

## Modals / dialogs triggered

**Thread Drawer** (slide-out right panel, `fixed top-0 right-0`, `z-50`):
- Opens on row click or `openThread(query)` / URL deep-link
- Contains: message thread, reply input, resolve/delete actions
- Closes on backdrop click (`z-40`) or close button

**Resolve Dialog** (modal over drawer, `z-[55]`):
- `v-if="showResolveDialog"`
- Pre-fills remark from `REMARK_PRESETS[query_type]`
- Backdrop click closes
- Submit → `submitResolve()`

**Image Lightbox** (`fixed inset-0 z-[60]`):
- Single image, backdrop click closes
- No zoom controls despite `lightboxZoom` ref (Q-006)

**Video Player Modal** (`fixed inset-0 z-[60]`):
- Plays video with `autoplay` + `controls`
- Download link in header
- Backdrop click closes

---

## API endpoints consumed

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/queries/?order_id={orderId}` | GET | List all queries for order |
| `/api/queries/{orderId}/{queryId}/` | GET | Get thread detail (messages + attachments) |
| `/api/queries/{orderId}/{queryId}/reply/` | POST | Post text reply |
| `/api/queries/{orderId}/{queryId}/reply-with-attachment/` | POST | Post reply with file |
| `/api/queries/{orderId}/{queryId}/resolve/` | POST | Resolve with remark |
| `/api/queries/{orderId}/{queryId}/reopen/` | POST | Reopen resolved query |
| `/api/queries/{orderId}/{queryId}/` | DELETE | Delete query + messages |

---

## Composables consumed

- `useNotifications` → `markReadByResource` (from `../../composables/useNotifications`)
- `useRoute` (vue-router) → `route.query.query` for URL deep-link

---

## PrimeVue components consumed

PrimeVue Icons (`pi-*`). No PrimeVue form, overlay, or data components. All modals are hand-rolled.

---

## Local state

```javascript
const props = defineProps({
  orderId: { type: String, required: true },
  order: { type: Object, required: true },
})

// List state
const queries = ref([])
const loading = ref(false)
const searchText = ref('')
const filterStatus = ref('all')
const filterType = ref('')
const sortBy = ref('newest')

// Bulk selection
const selectedIds = ref(new Set())
const bulkResolving = ref(false)

// Analytics panel
const showAnalytics = ref(false)

// Thread drawer
const drawerOpen = ref(false)
const selectedQuery = ref(null)
const uploadingFile = ref(false)
const fileInputRef = ref(null)

// Image lightbox
const lightboxUrl = ref(null)
const lightboxZoom = ref(1)      // tracked but unused in UI — Q-006

// Video player
const videoPlayerUrl = ref(null)
const videoPlayerName = ref('')

// Polling intervals (module-level, not reactive)
let threadPollInterval = null
let listPollInterval = null

// Reply
const replyingTo = ref(null)     // tracked but unused in template — Q-005
const replyMessage = ref('')
const sendingReply = ref(false)

// Resolve dialog
const showResolveDialog = ref(false)
const resolveTargetId = ref(null)
const resolveRemark = ref('')
const resolving = ref(false)
```

**Key computeds:**
```javascript
const filteredQueries = computed(() => {
  // Filter by status, type, search text; sort by newest/oldest/activity
})
const openCount = computed(() => queries.value.filter(q => q.status === 'OPEN').length)
const repliedCount = computed(() => queries.value.filter(q => q.status === 'REPLIED').length)
const resolvedCount = computed(() => queries.value.filter(q => q.status === 'RESOLVED').length)
const resolutionRate = computed(() => Math.round(resolvedCount / queries.length * 100))
const typeBreakdown = computed(() => /* per-type count + percent */)
const topQueriedItems = computed(() => /* top 5 by query count */)
const avgResponseTime = computed(() => /* avg ms between messages[0] and messages[1] */)
```

---

## Permissions / role gating

No component-level role gate. All INTERNAL roles with access to the queries tab can:
- View all query threads
- Reply to threads
- Attach files
- Resolve, reopen, and delete queries
- Bulk resolve

All mutations use `props.orderId` + specific `queryId` — correctly scoped to the order. No cross-tenant write risk.

---

## Bilingual labels (InternalString)

None. All labels and preset remarks are English-only.

---

## Empty / error / loading states

| State | Trigger | UI |
|---|---|---|
| Loading | `loading` | Spinner + "Loading queries..." in list area |
| No queries (no filter) | `filteredQueries.length === 0` | Icon + "Click the chat icon on any item to start a query thread" |
| No queries (with filter) | `filteredQueries.length === 0` + search/filter active | "Try adjusting your filters or search terms" |
| Thread poll error | `catch (e) { /* ignore */ }` | Silent — P-002 |
| List poll error | `catch (e) { /* ignore */ }` | Silent — P-002 |
| Send reply error | `catch (e) { console.error(e) }` | Silent in UI |
| Resolve error | `catch (e) { console.error(e) }` | Silent in UI |

---

## Business rules

1. **Dual polling**: Thread poll (5s) runs when drawer is open. List poll (10s) runs when drawer is closed. The two intervals are mutually exclusive via the `drawerOpen` check at the top of each poll handler.

2. **Thread poll optimization**: Only updates `selectedQuery` if `message_count` or `status` has changed since last fetch — prevents unnecessary re-renders.

3. **Notification mark-read**: On `loadQueries()`, marks both `ITEM_QUERY_REPLY` and `ITEM_QUERY_CREATED` notifications read for the order. On `openThread()`, marks `ITEM_QUERY_REPLY` read. Dual-mark on list load ensures badge counts reset even if a thread isn't opened.

4. **URL deep-link**: `?query=<id>` in URL param auto-opens the thread drawer. Handled both on mount (via `loadQueries()` after load) and via a `watch` on `route.query.query` for SPA navigation to the same page with a different param.

5. **Bulk resolve**: Sequential `for...of` loop calling `queriesApi.resolve()` per ID. Not parallel — sequential to avoid overwhelming the server. Acceptable for typical selection sizes (<20 queries). No per-item error handling; single catch wraps the whole loop.

6. **Resolve remark presets**: The `REMARK_PRESETS` map provides type-specific starter text pre-filled in the resolve dialog. User can edit or clear before submitting.

7. **CSV export**: Client-side, uses `filteredQueries` — respects current filter state. Only exports visible rows.

8. **Analytics panel**: Type breakdown, resolution rate (SVG circle gauge), and top queried items are computed purely from the `queries[]` array in memory. No separate analytics API call.

9. **Attachment path construction**: All attachment display uses the authenticated backend endpoint `GET /api/queries/{orderId}/{queryId}/attachments/{path}/`. The path `att` is a relative path stored in the message (e.g., `queries/orderId/queryId/filename.jpg`). See Q-002.

---

## Known quirks / bugs

### Q-001 — P-019 ×2: dual polling without backoff — HIGH complexity

```javascript
// Thread poll: 5s, no backoff, silent failure
threadPollInterval = setInterval(async () => {
  if (!selectedQuery.value || !drawerOpen.value) return
  try {
    const { data } = await queriesApi.get(props.orderId, selectedQuery.value.id)
    if (data.message_count !== selectedQuery.value.message_count || ...)
      selectedQuery.value = data
  } catch (e) { /* ignore */ }   // P-002: silent failure
}, 5000)

// List poll: 10s, no backoff, silent failure
listPollInterval = setInterval(async () => {
  if (drawerOpen.value) return
  try {
    const { data } = await queriesApi.list(props.orderId)
    queries.value = data
  } catch (e) { /* ignore */ }   // P-002: silent failure
}, 10000)
```

Two concurrent `setInterval` loops. No exponential backoff. No timeout ceiling. If API is slow (>5s response time), the next thread poll fires before the previous resolves — multiple in-flight requests. Silent catch means network outages go unnoticed until the user refreshes manually.

**React Query replacement**: `useQuery(['query-thread', orderId, queryId], fetcher, { refetchInterval: 5000 })` with stale-while-revalidate. The library handles deduplication, failure backoff, and window focus refetch.

### Q-002 — G-019 scope: all message attachment URLs were unauthenticated — **FIXED (G-019 / Patch 14, 2026-04-22)**

Three `/uploads/` URL construction patterns in the thread drawer template:

```javascript
// Image preview
@click="openLightbox('/uploads/' + att)"
<img :src="'/uploads/' + att" />

// Video src
<video :src="'/uploads/' + att" />

// File link
<a :href="'/uploads/' + att" />

// List thumbnail
function getQueryThumbnail(query) {
  // ...
  if (img) return '/uploads/' + img
}
```

All four patterns construct unauthenticated URLs. Any HTTP client can access query attachments without credentials.

**Fix applied (Patch 14, 2026-04-22):** All four `/uploads/` URL constructions replaced with the authenticated backend endpoint `GET /api/queries/{orderId}/{queryId}/attachments/{path}/`. Backend endpoint is auth-gated with `Depends(get_current_user)`. StaticFiles mount removed; nginx `/uploads/` location set to `internal;`. See G-019 in SECURITY_BACKLOG.md for full scope.

### Q-003 — P-020 instance #4: `getInitials(name)` duplicate

```javascript
function getInitials(name) {
  if (!name) return '?'
  const parts = name.split(/[@\s.]/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
```

Identical implementation exists in OrderList.vue (#1), OrderDraft.vue (#2), OrderItemsTab.vue (#3). This is instance #4. Extract to `src/lib/user-helpers.ts` as `getUserInitials(name)`.

### Q-004 — D-003 ×2: `confirm()` in bulkResolveSelected + deleteQuery

```javascript
// bulkResolveSelected
if (!confirm(`Resolve ${selectedIds.value.size} selected queries?`)) return

// deleteQuery
if (!confirm('Delete this query and all its messages? This cannot be undone.')) return
```

Two native `confirm()` calls. Replace with `<ConfirmDialog>` component in Next.js port. Note: deleteQuery also has an `alert()` in the catch block (console.error + `alert(e.response?.data?.detail || ...)`).

### Q-005 — `replyingTo` ref is dead state

```javascript
const replyingTo = ref(null)
```

`replyingTo` is initialized to `null` and never set or read in the template. The reply system uses `replyMessage` + the drawer's thread context — `replyingTo` is vestigial from an earlier implementation that may have had an inline per-query reply input.

### Q-006 — `lightboxZoom` ref is dead state

```javascript
const lightboxZoom = ref(1)
function openLightbox(url) { lightboxUrl.value = url; lightboxZoom.value = 1 }
```

`lightboxZoom` is set to 1 on open but never used in the template. No zoom controls are rendered. Either implement zoom (pinch/scroll) or remove the ref.

### Q-007 — Sequential bulk resolve (minor P-023 variant)

```javascript
for (const id of selectedIds.value) {
  await queriesApi.resolve(props.orderId, id)
}
```

N sequential API calls for bulk resolve. For large selections, could be parallelized with `Promise.all()`. Not technically N+1 on page load (which is P-023), but same inefficiency pattern for bulk operations. Acceptable for current usage but note for migration.

### Q-008 — Reply send errors are silent in UI

```javascript
async function sendReply(queryId) {
  ...
  } catch (e) { console.error(e) }
}
```

If `queriesApi.reply()` fails (network issue, server error), the user sees no feedback — the send button re-enables but the message is lost. Add inline error state.

---

## Dead code / unused state

- **`replyingTo` ref** (line 358) — initialized but never set or read (Q-005)
- **`lightboxZoom` ref** (line 125) — set on open but never used in template (Q-006)

---

## Duplicate or inline utilities

- **`getInitials(name)`** — P-020 instance #4. Extract to `src/lib/user-helpers.ts`.
- **`isImageAttachment(path)`** and **`isVideoAttachment(path)`** — inline regex helpers. AfterSalesTab has `isVideo()` (slightly different). Extract to `src/lib/file-helpers.ts`.
- **`getAge(dateStr)` + `getAgeClass(dateStr)`** — relative time formatting. Candidate for `src/lib/date-helpers.ts`. May overlap with existing `formatDate` utility.
- **`QUERY_TYPE_LABELS`** — local constant. Move to `src/lib/queries.ts`.
- **`REMARK_PRESETS`** — local constant. Move to same file.

---

## Migration notes

1. **Replace dual polling with React Query**:
   ```typescript
   // Thread: refetch every 5s when drawer is open
   useQuery(['query-thread', orderId, queryId], fetcher, {
     refetchInterval: drawerOpen ? 5000 : false,
     refetchIntervalInBackground: false,
   })

   // List: refetch every 10s
   useQuery(['queries', orderId], fetcher, {
     refetchInterval: !drawerOpen ? 10000 : false,
   })
   ```
   Both queries share the cache — when thread polling updates a query, the list cache is automatically invalidated.

2. **Authenticated attachment URLs** ✅ **DONE (G-019 / Patch 14, 2026-04-22)**: All `/uploads/` + `att` constructions replaced with `GET /api/queries/{orderId}/{queryId}/attachments/{path}/` (authenticated). For Next.js migration, proxy through `GET /api/internal/query-attachments/[...path]` or call the backend endpoint directly with the session cookie. (Q-002 resolved)

3. **Extract `getInitials`**: Import from `src/lib/user-helpers.ts`. (P-020 fix)

4. **D-003**: Replace both `confirm()` calls with `<ConfirmDialog>`. Add inline error banners for send/resolve/delete failures.

5. **Thread drawer → separate component**: `<QueryThreadDrawer queryId={id} orderId={orderId} onClose={} />` encapsulates the drawer, message list, reply input, resolve dialog. Reduces main component by ~500 lines.

6. **Analytics panel → `<QueryAnalytics queries={queries} />`**: Isolated panel, can be lazy-loaded.

7. **Resolve dialog → `<ResolveQueryDialog>`**: Reusable modal, used both from list row action and from drawer header.

8. **Remove dead state**: Drop `replyingTo` and `lightboxZoom` in the port.

9. **URL deep-link**: Implement with Next.js `useSearchParams()` hook. On param change, find and open the query thread.

10. **Component size**: 1,013 lines. After extracting drawer, analytics panel, and resolve dialog, the main list component should be ~300 lines.
