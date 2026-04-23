## Metadata

| Field | Value |
|-------|-------|
| Type | component |
| Portal | internal |
| Route | N/A — component not a page |
| Source file | `frontend/src/components/orders/ParsedResultsTable.vue` |
| Line count | 183 |
| Migration wave | Wave 6 |
| Risk | low |

---

## Purpose

Fully controlled table component that renders all rows returned by a completed Excel parse job. Supports row selection (for selective apply), row deletion (remove before apply), status-based row coloring, and a post-process filter tab bar (All / New / Add Variant / Replace / Skipped). Factory Excel mode adds additional columns (Description, Category, Weight, Price USD, Image thumbnail). Owns no state — all selection and filter state is managed by the parent.

---

## Layout

Scrollable table panel within the results area of `<ExcelUpload>`:

1. **Filter tab bar** — All / New / Add Variant / Replace / Skipped tabs with count badges; shown only when `processed = true`
2. **Table toolbar** — total row count display; "Delete selected" button (visible when rows are selected)
3. **Sticky table header** — Select-all checkbox, column headers (column set varies by `isFactoryExcel`)
4. **Table body** — one row per parsed item; `max-h-96 overflow-y-auto` scroll container; sticky header (`top-0 z-10`)

---

## Data displayed

**Props:**

| Prop | Type | Required | Default | Notes |
|------|------|----------|---------|-------|
| `filteredData` | Array | yes | — | Pre-filtered rows from parent (filtered by `resultsFilter` and `pendingOnly` query param in parent) |
| `selectedRows` | Object/Set | yes | — | Set of selected row indices; managed by parent |
| `selectAll` | Boolean | no | `false` | Controls select-all checkbox state |
| `isFactoryExcel` | Boolean | no | `false` | Shows factory-mode extra columns when true |
| `processed` | Boolean | no | `false` | Shows `processedSummary` filter tab bar when true |
| `processedSummary` | Object | no | `null` | `{new_count, variant_count, replace_count, skip_count}` — filter tab counts |
| `resultsFilter` | String | no | `'all'` | Active filter tab: `'all'`, `'new'`, `'variant'`, `'replace'`, `'skipped'` |
| `totalRows` | Number | no | `0` | Total unfiltered row count for display in toolbar |

**Displayed columns (base — all job types):**

| Column | Source field |
|--------|-------------|
| Checkbox | row selection |
| Status badge | `row.status` |
| Product Code | `row.product_code` |
| Barcode | `row.barcode` |
| Product Name | `row.product_name` |
| Quantity | `row.quantity` |

**Factory-mode additional columns (when `isFactoryExcel = true`):**

| Column | Source field |
|--------|-------------|
| Description | `row.description` |
| Category | `row.category` |
| Weight (kg) | `row.unit_weight_kg` |
| Price (USD) | `row.factory_price_usd` |
| Image | thumbnail from `row.image` |

**Row status colors:**

| Status | Background / style |
|--------|--------------------|
| MATCHED | green |
| NEW_PRODUCT | blue |
| NEW_VARIANT | purple |
| DUPLICATE | yellow |
| AMBIGUOUS | red |
| NO_PRICE | orange |
| SKIP_DUPLICATE | gray background, strikethrough text, opacity-50 |

**Row background overrides (resolution state):**

| Condition | Background |
|-----------|-----------|
| SKIP_DUPLICATE status | red-50 |
| REPLACE resolution | amber-50 |
| ADD_VARIANT resolution | blue-50 |
| Selected row | indigo-50 |

---

## Interactions

**Emits:**

| Emit | Payload | When | Listener responsibility |
|------|---------|------|------------------------|
| `toggleSelectAll` | — | Select-all header checkbox clicked | Parent toggles all row indices in/out of `selectedRows` |
| `toggleRow` | `rowIdx` (Number) | Row-level checkbox clicked | Parent adds/removes rowIdx from `selectedRows` |
| `deleteSelected` | — | "Delete selected" button clicked | Parent removes selected rows from `results.result_data` and updates summary counts (WARNING: parent mutates — see ExcelUpload quirk Q-2) |
| `update:resultsFilter` | `filterValue` (String) | Filter tab clicked | Parent updates `resultsFilter` ref |

| Action | Trigger | Outcome |
|--------|---------|---------|
| Select all | Header checkbox | Emits `toggleSelectAll` |
| Select row | Row checkbox | Emits `toggleRow(rowIdx)` |
| Delete selected | Delete button (visible when selection non-empty) | Emits `deleteSelected` |
| Change filter tab | Tab click | Emits `update:resultsFilter` with new filter value |

---

## Modals / dialogs triggered

None.

---

## API endpoints consumed

None.

---

## Composables consumed

None.

---

## PrimeVue components consumed

[UNCLEAR] — likely `Checkbox`, `Button`, `Badge`, and a custom table (not PrimeVue DataTable — layout is custom scrollable). Confirm from template scan in Wave 0.

---

## Local state

None — fully controlled component. All state owned by parent (`ExcelUpload.vue`).

---

## Permissions / role gating

- `factory_price_usd` column is rendered when `isFactoryExcel = true`. This is INTERNAL operations data (ADMIN|OPERATIONS context). D-004 restricts factory cost fields (factory_price CNY, markup) to SUPER_ADMIN|FINANCE; confirm with backend during Wave 0 whether `factory_price_usd` in the operations upload context falls under D-004 scope or is acceptable at ADMIN|OPERATIONS level.

---

## Bilingual labels (InternalString)

[UNCLEAR] — InternalString keys not extracted. Verify during Wave 0. Expect: column headers, status badge labels, filter tab labels ("All", "New", "Add Variant", "Replace", "Skipped"), "Delete selected" button, empty state message, row count display.

---

## Empty / error / loading states

| State | Trigger | Handling |
|-------|---------|---------|
| Empty filtered result | Active filter tab returns no matching rows | [UNCLEAR] — empty state message or hidden table body; verify from source in Wave 0 |
| No rows at all | `filteredData` is empty array | [UNCLEAR] — likely an empty state message; verify from source in Wave 0 |
| Pre-processed | `processed = false` | Filter tab bar hidden; only base column set and row actions shown |
| No selection | `selectedRows` is empty | Delete button hidden |

---

## Business rules

1. Component is fully controlled — no local state; parent owns all selection and filter state.
2. `SKIP_DUPLICATE` rows rendered with red-50 background, strikethrough text, opacity-50 — visually de-emphasized to indicate they will not be applied.
3. `REPLACE` rows rendered with amber-50 background; `ADD_VARIANT` rows with blue-50.
4. Filter tab bar (`processedSummary`) shown only after `processed = true`; counts sourced from `processedSummary` prop (not recomputed from `filteredData`).
5. `isFactoryExcel = true` adds Description, Category, Weight, Price USD, and Image columns. These are operations-context fields; route-level gating (ADMIN|OPERATIONS) is the access control.
6. Table uses `max-h-96 overflow-y-auto` with sticky header — fixed height constraint; may require a virtual scroll solution for very large result sets.
7. `totalRows` prop reflects the full unfiltered count; `filteredData.length` reflects the currently visible count. Displaying both helps user understand filter scope.

---

## Known quirks

| # | Quirk | Impact |
|---|-------|--------|
| Q-1 | `deleteSelected` emit triggers parent immutability violation | Mutation lives in parent (ExcelUpload Q-2); this component is clean — it only emits the event. |
| Q-2 | Sticky header (`top-0 z-10`) inside `max-h-96 overflow-y-auto` container | Sticky positioning inside an overflow container works in modern browsers but requires `overflow: auto` (not `overflow: hidden`) on the scroll parent. Verify rendering in Next.js table implementation. |
| Q-3 | Filter tab counts (`processedSummary`) not derived from `filteredData` | Counts reflect the full post-process summary; when `pendingOnly` mode is active in parent, visible rows are fewer than the counts suggest. Same root cause as ExcelUpload Q-6. |

---

## Dead code / unused state

None identified.

---

## Duplicate or inline utilities

- `statusColor(status)` is an inline function returning Tailwind color class strings. If status coloring is needed in other result tables (future import flows, audit views), extract to `lib/excel/statusColors.ts` in Next.js.

---

## Migration notes

1. **Port as a controlled React component** — all state is prop-driven; translate Vue emits to `onToggleSelectAll`, `onToggleRow`, `onDeleteSelected`, `onFilterChange` callback props.
2. **`update:resultsFilter` v-model** — becomes `onFilterChange(filter: string)` prop in React.
3. **`statusColor` utility** — port as a pure function or a `cn()`-based variant map; extract to `lib/excel/statusColors.ts` for reuse.
4. **Sticky header in scroll container** — verify `position: sticky; top: 0` inside `max-h-96 overflow-y-auto` div; for large datasets (>500 rows) consider TanStack Virtual for windowed rendering.
5. **D-004 scope confirmation** — during Wave 0, confirm whether `factory_price_usd` in this context requires SUPER_ADMIN|FINANCE gate or ADMIN|OPERATIONS is sufficient; document decision in backend auth spec.
6. **Empty state** — add explicit empty state UI for filtered-to-zero results; current behavior unclear from source.
7. **Filter count accuracy** — if `pendingOnly` mode is retained in Next.js, recompute filter tab counts from the filtered data set rather than using the raw `processedSummary` from the job; eliminates Q-3 discrepancy.
