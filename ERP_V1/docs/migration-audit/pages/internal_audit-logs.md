# Audit Logs

**Type:** page
**Portal:** internal
**Route:** `/audit-logs` (`meta.roles: ['ADMIN']`)
**Vue file:** [frontend/src/views/AuditLogs.vue](../../../frontend/src/views/AuditLogs.vue)
**Line count:** 209
**Migration wave:** Wave 1 (ADMIN read-only)
**Risk level:** low (read-only)

## Purpose (one sentence)
ADMIN-only audit trail viewer with two sub-views — a paginated filterable log table and an embedded knowledge-graph iframe — showing who did what (including before/after JSON diffs per entry).

## Layout (top→bottom, left→right, exhaustive)

### Shell
`<div class="space-y-4">`

### Zone 1 — Header (`flex items-center justify-between`)
- Left:
  - Title `Audit Trail` (text-lg bold) with a leading indigo SVG document icon.
  - View toggle pill row (below title): two pill-buttons `Audit Logs` (slate-800 when active) / `Knowledge Graph` (indigo-600 when active). Binds `activeView` to `'logs'` or `'graph'`.
- Right (visible only when `activeView === 'logs'`):
  - `<select v-model="filterAction">` — `All Actions` + options from `availableActions` (loaded via `auditApi.getActions`).
  - `<select v-model="filterResourceType">` — `All Resources` + options from `availableTypes` (via `auditApi.getResourceTypes`). Both reset `page` on change.

### Zone 2A — Knowledge Graph view (`v-if="activeView === 'graph'"`)
- Card header (`bg-white rounded-xl border`): title `Codebase Knowledge Graph`, subtitle `Interactive visualization of code architecture, relationships, and communities`.
- `Open Full Screen` anchor → `/graphify/graph.html` in new tab.
- `<iframe src="/graphify/graph.html" style="height: 75vh;">` — embedded static asset.

### Zone 2B — Audit Logs view (`v-if="activeView === 'logs'"`)
- Loading: `p-8 text-center text-slate-400` with `Loading audit logs...`.
- Empty: `p-8 text-center text-slate-400` with `No audit entries found`.
- Populated: table inside `bg-white rounded-xl border border-slate-200 shadow-sm`.

Table columns:
| Column | Cell |
|---|---|
| (toggle) | chevron `rotate-90` when expanded |
| Timestamp | `formatDate(entry.timestamp)` → `dd mmm yyyy hh:mm:ss` (`en-IN` locale, hour12 by default) |
| User | `entry.user_email || entry.user_id` |
| Action | colored pill via `actionColor()` (red DELETE, emerald CREATE, blue CHANGE/UPDATE, amber JUMP/BACK, slate otherwise) |
| Resource | `entry.resource_type` in `capitalize` |
| ID | `entry.resource_id.substring(0, 12) + '…'` (truncated) |

Row click toggles `expandedId`. Expanded detail row (`<tr v-if="expandedId === entry.id">`) spans all 6 columns and shows, side-by-side:
- **Previous State** — red-50 `<pre>` of `formatJson(entry.old_values)` (when non-null).
- **New State** — emerald-50 `<pre>` of `formatJson(entry.new_values)` (when non-null).
- **Context** — slate-100 `<pre>` of `formatJson(entry.metadata)`. Spans full width if neither old nor new values are present.

Footer strip in expanded row: `IP: {entry.ip_address}` (if any) and `Full ID: {entry.id}`.

### Zone 3 — Pagination (below table, only when `totalPages > 1`)
`flex items-center justify-between px-4 py-3 bg-slate-50 border-t`. Left: `Page {page} of {totalPages} ({total} entries)`. Right: `Prev` / `Next` buttons (disabled at boundaries).

## Data displayed
| Field | Source (api/index.js export.method) | Format | Notes |
|---|---|---|---|
| Entries | `auditApi.list({page, per_page, action?, resource_type?})` | `{items: [{id, timestamp, user_email, user_id, action, resource_type, resource_id, old_values, new_values, metadata, ip_address}], total}` | — |
| Available actions | `auditApi.getActions` | `string[]` | e.g., `ORDER_CREATE`, `ORDER_DELETE`, `ORDER_STAGE_CHANGE`, `USER_UPDATE` |
| Available resource types | `auditApi.getResourceTypes` | `string[]` | e.g., `order`, `user`, `payment`, `client` |

## Interactions
| Trigger | Action | API call | Result |
|---|---|---|---|
| Click `Audit Logs` / `Knowledge Graph` pills | sets `activeView` | none | re-renders zone |
| Change action filter | resets `page = 1`, `watch` fires `loadLogs` | `auditApi.list` | |
| Change resource filter | same | same | |
| Click table row | `toggleExpand(id)` | none | open/close inline diff panel |
| Click `Prev` | `page--` (triggers watch) | `auditApi.list` | |
| Click `Next` | `page++` | `auditApi.list` | |
| Click `Open Full Screen` | native anchor | none | new tab to `/graphify/graph.html` |

## Modals/dialogs triggered (inline)
None. The "expanded diff" is an in-table row, not a dialog.

## API endpoints consumed (from src/api/index.js)
- `auditApi.list` (paginated log rows)
- `auditApi.getActions` (filter options)
- `auditApi.getResourceTypes` (filter options)

All 3 of the 3 `auditApi` methods are exercised here.

## Composables consumed
None.

## PrimeVue components consumed
None. Hand-rolled table. Icons use inline SVG (document icon) and PrimeIcons (`pi-list`, `pi-share-alt`, `pi-external-link`, `pi-file`).

## Local state (refs, reactive, computed, watch)
- `activeView: ref('logs')`.
- List: `loading`, `entries`, `total`, `page: ref(1)`, `perPage: ref(50)`, `expandedId`.
- Filters: `filterAction`, `filterResourceType`, `availableActions`, `availableTypes`.
- `totalPages: computed(() => Math.ceil(total / perPage))`.
- `watch([page, filterAction, filterResourceType], loadLogs)` — refetch on any filter/page change.

Helpers: `formatDate`, `actionColor`, `formatJson`.

## Permissions/role gating
- Route: `meta.roles: ['ADMIN']`.
- Sidebar exposure: ADMIN only.
- Backend endpoints should enforce the same; ADMIN read-only.

## Bilingual labels (Tamil + English pairs)
None.

## Empty/error/loading states
- Loading: `Loading audit logs...` centered.
- Empty: `No audit entries found` centered.
- Error: silently caught (`catch (e) { console.error(...) }` line 31). **No user-facing error banner.** [UNCLEAR — needs Sachin review: fine for an internal ADMIN page, but a future improvement.]
- Filter options failure: silently swallowed (line 46).

## Business rules (the non-obvious ones)
1. **Two-pane side-by-side diff** is the primary value — red for `old_values`, emerald for `new_values`. When one is absent (create vs delete), the other still renders; `metadata` spans full-width when both are absent.
2. **Knowledge Graph is shipped to admins via iframe.** The static HTML lives in `/graphify/graph.html`, built by the backend. Important for architecture/code review — not user-audit but process-audit.
3. **Action color taxonomy** is keyword-based — any action string containing `DELETE`/`CREATE`/`CHANGE`/`UPDATE`/`JUMP`/`BACK` gets the corresponding color. `ORDER_STAGE_CHANGE` → blue (because of `CHANGE`). `ORDER_STAGE_JUMP` → amber (because of `JUMP`).
4. **`page, filterAction, filterResourceType` are watched together** — any change refetches. Because `page` is in the watch, there's a minor redundant-fetch risk: changing a filter resets `page` to 1 and fires the watch for both `filterAction` and `page` (via `watch`, Vue batches). In practice Vue batches into a single effect, so only one network call. Worth verifying in tests.
5. **The `expandedId` state is per-row** — only one row can be expanded at a time. Re-click the same row to collapse.

## Known quirks
- **`perPage` is a ref but never editable** — frozen at 50. There's no page-size picker. Adding one would be trivial.
- **`entry.resource_id?.substring(0, 12)` is for display only.** The full ID appears in the expanded panel as `Full ID`.
- **Knowledge Graph tab hosts an iframe to a backend-generated static asset.** The migration will need to preserve or recreate this route.
- **Pagination is Prev/Next only** — no page-number list.
- **Filters are single-select** — no multi-select for actions or resource types.
- **No export (CSV / JSON / XLSX)** even though auditing typically benefits from bulk export. [UNCLEAR — needs Sachin review.]
- **No date-range filter.** Users search by action and resource type, not by time. [UNCLEAR — needs Sachin review: sounds like an obvious missing feature.]

## Migration notes
- **Claude Design template mapping:** **Ledger** (classic paginated read-only table with expanders).
- **Layer 2 components needed:** `FilteredTable`, `RowExpander` (expandable row), `JsonDiffView` (reusable for other diff surfaces), `PagePager` (Prev/Next), `PillTabBar` (for the Logs / Graph toggle), `IframeCard` (for the graph embed).
- **New Layer 1 strings to add:** `audit.title`, `audit.pills.logs`, `audit.pills.graph`, `audit.filter.all_actions`, `audit.filter.all_resources`, column headers, `audit.loading`, `audit.empty`, `audit.page_of_n`, `audit.prev`, `audit.next`, `audit.diff.previous`, `audit.diff.new`, `audit.diff.context`, `audit.full_id`, `audit.ip`, Knowledge Graph card title + subtitle + `Open Full Screen` + `Report`.
- **Open questions for Sachin:**
  1. Do we need CSV/JSON export?
  2. Do we need date-range filter / free-text search?
  3. Does the knowledge-graph view stay, or move out of this page into a separate dev-only route?
  4. Would user-filter (by user email) be useful in addition to action+resource?
