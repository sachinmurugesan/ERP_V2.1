## Metadata

| Field | Value |
|-------|-------|
| Type | component |
| Portal | internal |
| Route | N/A — component not a page |
| Source file | `frontend/src/components/common/ColumnMappingDialog.vue` |
| Line count | 201 |
| Migration wave | Wave 6 |
| Risk | low |

---

## Purpose

Modal dialog that presents AI-suggested column-to-schema-field mappings for FACTORY_EXCEL uploads requiring human review. Receives the raw output of `POST /excel/analyze-columns/` (via parent `ExcelUpload.vue`) and allows the user to confirm or override each uncertain field mapping before the job is reparsed. Makes no API calls itself — all backend interaction occurs in the parent.

---

## Layout

Dialog / modal overlay:

1. **Header** — "Column Mapping Review" title
2. **Confirmed mappings section** — read-only list of high-confidence confirmed fields (no user action required)
3. **Review required section** — per-row dropdowns for each `needs_review` field; confidence badge (yellow = medium, red = low)
4. **Unmapped fields notice** — lists Excel headers the AI could not map; these will be ignored in reparse
5. **Action row** — "Confirm Mapping" button + "Skip AI Mapping" button

---

## Data displayed

**Props:**

| Prop | Type | Required | Default | Notes |
|------|------|----------|---------|-------|
| `mappingResult` | Object | yes | — | AI response shape: `{confirmed: {excel_header: schema_field}, needs_review: [{excel_header, suggested_field, confidence}], unmapped_fields: []}` |
| `schemaType` | String | no | `'product'` | Reserved for future schema types; currently always 'product'; not used inside component |

**Derived display:**

| Field | Source | Notes |
|-------|--------|-------|
| Confirmed mappings | `mappingResult.confirmed` | Static read-only display |
| Review rows | `reviewChoices` (local copy of `mappingResult.needs_review`) | Each row's `selected_field` initialized to `suggested_field`; editable via dropdown |
| Available fields per dropdown | `availableFields` computed | Filters `FIELD_LABELS` keys, removing already-confirmed and already-selected fields to prevent duplicate mapping |
| Unmapped fields | `mappingResult.unmapped_fields` | Read-only notice; these headers will be skipped in reparse |
| Confidence badge | `confidenceBadge(confidence)` | 'medium' → yellow; any other value (low, null) → red. High-confidence items are in `confirmed`, never in `needs_review`. |

**`FIELD_LABELS` schema fields (15):** `product_code`, `barcode`, `product_name`, `product_name_chinese`, `dimension`, `category`, `unit_weight_kg`, `material`, `hs_code`, `quantity`, `unit_price`, `part_type`, `image`, `package`, `description`

---

## Interactions

**Emits:**

| Emit | Payload | When | Listener responsibility |
|------|---------|------|------------------------|
| `confirm` | `{excel_header: schema_field, ...}` merged mapping | User clicks "Confirm Mapping" | Parent calls `excelApi.reparseJob(jobId, mapping)` then starts polling |
| `skip` | — | User clicks "Skip AI Mapping" | Parent calls `excelApi.reparseJob(jobId)` with no mapping |
| `close` | — | Dialog dismissed (X / escape) | Parent treats identically to skip (`onMappingSkip`) |

| Action | Trigger | Outcome |
|--------|---------|---------|
| Override field mapping | Dropdown selection per review row | Updates `reviewChoices[i].selected_field`; `availableFields` recomputes to prevent double-assignment |
| Confirm mapping | Button click | `handleConfirm()` merges `confirmed` + reviewed choices; emits `confirm` |
| Skip mapping | Button click | Emits `skip`; parent reparsing proceeds without AI column mapping |

---

## Modals / dialogs triggered

None.

---

## API endpoints consumed

None. All API interaction delegated to parent (`ExcelUpload.vue`).

---

## Composables consumed

None.

---

## PrimeVue components consumed

[UNCLEAR] — likely `Dialog`, `Dropdown`, `Button`, `Badge` or equivalent. Confirm from template scan in Wave 0.

---

## Local state

| Variable | Type | Purpose |
|----------|------|---------|
| `reviewChoices` | ref(Array) | Editable copy of `mappingResult.needs_review`; each item carries `selected_field` (initialized to `suggested_field`) |

---

## Permissions / role gating

None — component has no role checks. Parent controls when it is rendered (FACTORY_EXCEL flow only; route requires ADMIN|OPERATIONS).

---

## Bilingual labels (InternalString)

[UNCLEAR] — InternalString keys not extracted. Verify during Wave 0. Expect: section headings ("Confirmed Mappings", "Requires Review", "Unmapped Fields"), button labels, confidence badge text, empty-state messages.

---

## Empty / error / loading states

| State | Trigger | Handling |
|-------|---------|---------|
| No `needs_review` items | `mappingResult.needs_review` is empty | Parent guards with `needs_review.length > 0`; if component mounts anyway, review section is empty |
| All items confirmed | AI returns only `confirmed`, no `needs_review` | Parent skips dialog entirely; component never mounts |
| No available fields left | All `FIELD_LABELS` already assigned | Dropdowns render empty options; user should confirm or skip |

---

## Business rules

1. **High-confidence items never shown** — `confirmed` fields are pre-confirmed by the backend AI; only `medium` and `low` confidence items reach `needs_review` and appear in this dialog.
2. **Duplicate mapping prevention** — `availableFields` filters out already-confirmed and already-selected fields. Each schema field can only be assigned to one Excel header.
3. **`handleConfirm` merge** — final mapping = `{ ...mappingResult.confirmed, ...reviewedChoices }`. Review choices overwrite confirmed only on key collision (invariant should prevent this).
4. **`schemaType` prop** — passed by parent but not consumed inside component; reserved for future multi-schema support.
5. **Skipping is non-destructive** — reparse without mapping proceeds with all unmatched headers treated as unmapped; no data is lost.

---

## Known quirks

| # | Quirk | Impact |
|---|-------|--------|
| Q-1 | `confidenceBadge` treats all non-'medium' values as red | If backend ever returns a new confidence level string, it defaults to red rather than a neutral state. Low risk given controlled backend. |
| Q-2 | `close` emit treated identically to `skip` by parent | Dismissing the dialog (X button) silently skips AI mapping with no confirmation prompt. Acceptable for an internal tool. |

---

## Dead code / unused state

None identified.

---

## Duplicate or inline utilities

- `FIELD_LABELS` dict (15 entries, inline constant) — if other components need field label display (e.g., a future column config UI), extract to `lib/excel/fieldLabels.ts` in Next.js.
- `confidenceBadge` is an inline pure function — extract to shared util if confidence badges appear in other Excel-flow components.

---

## Migration notes

1. **Port as a controlled modal** — fits naturally as a shadcn `<Dialog>` in Next.js. Receive `mappingResult` as prop; emit resolution via `onConfirm` / `onSkip` callbacks.
2. **TypeScript interface** — define `ColumnMappingResult`: `{ confirmed: Record<string, string>; needs_review: Array<{excel_header: string; suggested_field: string; confidence: string}>; unmapped_fields: string[] }`.
3. **Extract `FIELD_LABELS`** — move to `lib/excel/fieldLabels.ts`; reuse across upload and mapping components.
4. **`availableFields` dedup** — port as a `useMemo` derived from current selections; Set-based approach translates directly.
5. **`schemaType` prop** — retain for future extensibility; no behavior change needed now.
