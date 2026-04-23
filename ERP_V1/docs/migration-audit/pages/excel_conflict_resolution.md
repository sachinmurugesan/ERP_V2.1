## Metadata

| Field | Value |
|-------|-------|
| Type | component |
| Portal | internal |
| Route | N/A — component not a page |
| Source file | `frontend/src/components/orders/ConflictResolutionPanel.vue` |
| Line count | 353 |
| Migration wave | Wave 6 |
| Risk | low |

---

## Purpose

Displays all parsed rows that have conflicts (same product code matches multiple existing records or variants) and allows the user to choose a resolution per row: add as new product, replace an existing variant, or skip/mark duplicate. Optionally shows AI-suggested resolutions (from `useConflictAnalysis` / Claude AI) with confidence stats. Bulk selection and bulk-apply actions are supported. Makes no API calls.

---

## Layout

Full-width panel rendered below `<ParsedResultsTable>` in the ExcelUpload results area:

1. **AI analysis banner** — spinner if `analyzingConflicts`; stats bar (add/skip/replace counts + confidence) when analysis complete; source badge ("Claude AI" or "Smart Match")
2. **Sort controls** — sort by product code (alphabetical) or by row count (descending)
3. **Conflict group list** — one collapsible group per conflicting product code
   - **Group header** — product code, row count, group-level bulk-select checkbox
   - **Per-row resolution row** — resolution dropdown (add_new / replace / duplicate-skip); variant selector when replace mode; inline edit fields when add_new mode (description, chinese_name, dimension, material, part_type)
4. **Process button** — triggers `'process'` emit when user is satisfied with all resolutions

---

## Data displayed

**Props:**

| Prop | Type | Required | Default | Notes |
|------|------|----------|---------|-------|
| `conflictGroups` | Array | yes | — | `[{product_code: string, rows: [...]}]` — all conflict groups from parsed job |
| `variantResolutions` | Object | yes | — | `{rowIdx: resolution}` — current resolution per row; managed by parent |
| `rowOverrides` | Object | yes | — | `{rowIdx: {field: value}}` — inline field edits for add_new rows; managed by parent |
| `aiResolutions` | Object | no | `{}` | AI-suggested resolutions keyed by rowIdx: `{action, confidence, reason}` |
| `analyzingConflicts` | Boolean | no | `false` | Shows spinner in AI banner |
| `aiResolutionSource` | String | no | `null` | `'ai'` (Claude AI) or `'heuristic'` (smart fallback) or null (no analysis run) |
| `aiStats` | Object | no | `null` | `{add, skip, replace, highConf}` — counts from AI analysis for stats bar |
| `processed` | Boolean | no | `false` | Locks all controls after process action |
| `conflictSortBy` | String | no | `'code'` | `'code'` or `'rows'`; sort order for group list; managed by parent |

---

## Interactions

**Emits:**

| Emit | Payload | When | Listener responsibility |
|------|---------|------|------------------------|
| `update:variantResolutions` | Updated resolutions object | Per-row resolution change or bulk apply | Parent replaces `variantResolutions` ref |
| `update:rowOverrides` | Updated overrides object | Per-row inline field edit | Parent replaces `rowOverrides` ref |
| `update:conflictSortBy` | `'code'` or `'rows'` | Sort toggle clicked | Parent replaces `conflictSortBy` ref |
| `process` | — | "Process" button clicked | Parent calls apply flow (`excelApi.applyParsedData`) |

| Action | Trigger | Outcome |
|--------|---------|---------|
| Select all conflicts | Header checkbox | `toggleBulkSelectAll()` — fills `selectedConflictRows` Set with all row indices |
| Select group | Group-level checkbox | `toggleConflictGroup(group)` — toggles all rows in that group |
| Select row | Row-level checkbox | `toggleConflictRow(rowIdx)` |
| Set per-row resolution | Dropdown | `setResolution(rowIdx, resolution)` — emits `update:variantResolutions` with spread update |
| Set field override | Inline input (add_new mode) | `setOverride(rowIdx, field, value)` — emits `update:rowOverrides` with spread update |
| Bulk apply action | Bulk action button | `applyBulkAction(action)` — emits `update:variantResolutions` for all selected rows; 'replace' auto-picks first available variant |
| Toggle sort | Sort button | `toggleSort('code')` or `toggleSort('rows')` — emits `update:conflictSortBy` |
| Process | Process button | Emits `'process'` |

---

## Modals / dialogs triggered

None.

---

## API endpoints consumed

None. AI analysis triggered via parent's `useConflictAnalysis` composable; results arrive as props.

---

## Composables consumed

None directly. AI data provided via props from parent's `useConflictAnalysis` instance.

---

## PrimeVue components consumed

[UNCLEAR] — likely `Checkbox`, `Dropdown`, `Button`, `Badge`, `InputText`. Confirm from template scan in Wave 0.

---

## Local state

| Variable | Type | Purpose |
|----------|------|---------|
| `selectedConflictRows` | Set | Row indices selected for bulk action; local to this component; not persisted to parent |

---

## Permissions / role gating

None — component has no role checks. Access controlled by parent route (ADMIN|OPERATIONS via backend `require_operations`).

---

## Bilingual labels (InternalString)

[UNCLEAR] — InternalString keys not extracted. Verify during Wave 0. Expect: resolution option labels (Add New, Replace, Skip/Duplicate), inline field placeholders (description, chinese_name, dimension, material, part_type), sort labels, AI banner text, confidence level labels, Process button.

---

## Empty / error / loading states

| State | Trigger | Handling |
|-------|---------|---------|
| AI analyzing | `analyzingConflicts = true` | Spinner shown in AI banner; controls remain interactive |
| AI complete | `aiStats && aiResolutionSource` | Stats bar rendered with source badge |
| No AI analysis run | `aiResolutionSource = null` | AI banner not shown |
| AI silently failed | Error caught in composable | `aiResolutionSource` stays null; no user-visible error — heuristic fallback applies |
| Processed | `processed = true` | All controls disabled; process button disabled |

---

## Business rules

1. Resolution options per row: `add_new` (add as new product, violet), `replace` (replace existing variant, blue — requires variant selection from dropdown), `duplicate`/`skip` (gray — mark as intentional duplicate or skip row).
2. `'replace'` bulk action auto-picks the first available existing variant for each selected row — user must manually verify replace selections afterward if variant choice matters.
3. `setResolution` and `setOverride` both produce immutable updates via spread before emitting — correct pattern; no direct mutation.
4. Sort by `'code'` (alphabetical product code) or `'rows'` (descending row count); parent owns the sort state via v-model emit.
5. `processed = true` is a one-way latch from parent — UI locks after process; no unlock mechanism in current implementation.
6. AI resolution source distinction: `'ai'` = Claude AI via `POST /excel/analyze-conflicts/`; `'heuristic'` = smart fallback applied when composable catches an error (no API call made).
7. `aiResolutions` prop is applied as suggestions; user can still override any AI-suggested resolution via the per-row dropdown.

---

## Known quirks

| # | Quirk | Impact |
|---|-------|--------|
| Q-1 | `useConflictAnalysis` silently catches all errors | `aiResolutionSource` stays null on API failure; user sees no indication AI failed. Acceptable for a non-critical enhancement feature, but degrades silently. |
| Q-2 | `'replace'` bulk auto-pick always uses first variant | May not be the correct variant for all rows; requires manual review for replace-mode selections after bulk apply. |

---

## Dead code / unused state

None identified within this component.

---

## Duplicate or inline utilities

- Bulk selection logic (`toggleBulkSelectAll`, `toggleConflictGroup`, `toggleConflictRow`) is inline — if multi-select patterns appear in other panels (e.g., future import flows), extract to a `useBulkSelection(items)` composable in Next.js.

---

## Migration notes

1. **Port as a client component** in Next.js (stateful interactions; no server-side data needs).
2. **v-model emit convention** — `update:variantResolutions`, `update:rowOverrides`, `update:conflictSortBy` translate to explicit `onVariantResolutionsChange`, `onRowOverridesChange`, `onSortChange` callback props in React.
3. **Bulk selection state** — `selectedConflictRows` (Set) is local; keep as `useState` in the React component; no global state needed.
4. **`'replace'` bulk auto-pick** — consider surfacing a per-row variant picker in bulk mode instead of always picking first; UX improvement opportunity during migration.
5. **AI error visibility** — surface a visible "AI analysis unavailable" notice when `useConflictAnalysis` fails silently; currently the composable swallows all errors. Add a `aiError` return value from the composable.
6. **Immutable updates** — `setResolution` and `setOverride` already use spread; port this pattern directly to React state setters.
