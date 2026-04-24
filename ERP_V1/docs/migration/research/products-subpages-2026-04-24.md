# Research — Products Sub-Pages Discovery

**Date:** 2026-04-24
**Author:** migration-research pass (read-only, no code written, no branches created)
**Scope:** the next 6 product-related Vue → Next.js migration candidates

**Context:** three migrations complete on `main` (dashboard, orders-list, products-list). The user wants to plan the next six product-related migrations. This document surveys what exists in the Vue codebase + live backend for each, flags dependencies and shared code, and recommends a sequencing.

**Authoritative sources used:**
- Live FastAPI on `http://localhost:8001` (admin JWT verified with `admin@harvesterp.com`).
- Six existing audit profiles under `docs/migration-audit/pages/`:
  - [internal_products_form.md](../../migration-audit/pages/internal_products_form.md)
  - [internal_products_review.md](../../migration-audit/pages/internal_products_review.md)
  - [excel_upload.md](../../migration-audit/pages/excel_upload.md)
  - [excel_column_mapping.md](../../migration-audit/pages/excel_column_mapping.md)
  - [excel_conflict_resolution.md](../../migration-audit/pages/excel_conflict_resolution.md)
  - [excel_parsed_results.md](../../migration-audit/pages/excel_parsed_results.md)
- Vue source (read directly where audit was incomplete): `ProductList.vue` (duplicate-cleanup modal is not separately audited).

---

## 1. Executive summary

**Scope reality check.** The six requested targets collapse to **four Vue source files** and ≈**40 hours of migration work**, not six. Product CREATE, DETAIL (no separate route exists), EDIT, and VARIANTS are all the same `ProductForm.vue` component selecting its mode from `route.params` + `route.query`. Excel Upload is one Vue file but has 4 sub-components (upload / column-mapping / conflict-resolution / parsed-results) and warrants its own migration session. Duplicate Cleanup is a modal inside the already-migrated `/products` page and is the cheapest of the six (client-side loops against existing endpoints).

**Recommended next six migrations, in order:** `/products/new` + `/products/{id}/edit` + `/products/{id}/new-variant` as **one combined migration** (the form + its image section + the variant-resolution dialog share 80% of their code) → product **detail**-view added inside the edit page as a read-only mode (0 extra hours) → **duplicate-cleanup** page or drawer (small, independent, no dependencies) → **Excel upload** flow (big — 4 sub-components, file handling, polling, AI mapping, conflict resolution, apply) → **product review** (ADMIN triage of pending requests; depends on edit landing first for "Map to existing" jump). The product review page was not in the user's original six but surfaces organically once Excel upload lands — worth including for completeness.

**Blocking backend work identified — none critical.** Every endpoint the six features need exists and is live. Two backend gaps that surface as follow-ups: (a) no `POST /api/products/subcategories/` means the Vue "+ Add Subcategory" action only updates local state and loses the value on reload (known bug); (b) the Vue duplicate-cleanup modal ignores the existing `/api/products/find-duplicates/` and `/remove-duplicate-images/` endpoints, reimplementing the scan client-side with paginated `per_page=200` loops — migrating this is a chance to delete that client code and call the server endpoints instead. Neither blocks any of the six; both should be tracked as tech-debt / clean-up tasks.

---

## 2. Page-by-page analysis

### TARGET 1 — Product CREATE (`/products/new`)

#### A. Location in codebase
- **Vue file:** [`frontend/src/views/products/ProductForm.vue`](../../../frontend/src/views/products/ProductForm.vue) (1,156 lines, shared with EDIT + VARIANTS).
- **Route:** `/products/new` → `name: 'ProductNew'`, `meta: { title: 'New Product', parent: 'ProductList' }`.
- **Detection:** `isEdit = Boolean(route.params.id)`; `isVariant = Boolean(route.query.parent_id && !route.params.id)`. CREATE = neither.
- **Composables:** none; uses `useRoute()` + `useRouter()` inline.
- **API module:** `frontend/src/api/index.js` → `productsApi.*`, `settingsApi.*`.

#### B. User flow
- Entry: any INTERNAL user with `can_create`. From `/products` via the "+ Add Product" button (now gated behind `PRODUCT_CREATE` in the Next.js migration).
- Step-by-step: land on empty form → fill Part Code + Product Name (required) + optional fields across 4 sections → click "Create Product".
- Variant-check interlude: on submit, `GET /api/products/check-variants/{code}/` fires first. If the code has existing variants, a **Variant Resolution Dialog** appears with two radio choices ("Add as New Variant" / "Replace Existing Variant"). Confirm → `POST /api/products/`. No variants → straight `POST /api/products/`.
- Success: success flash for 800 ms → `router.push('/products')`.
- Failure: `errors.general = e.response?.data?.detail ?? 'Failed to save product'` rendered near the submit button (raw backend detail leaks — P-002).

#### C. Fields + interactions (verbatim from audit + live sample)
**Section 1 — Product Identity (7 fields):**
| Binding | Label | Type | Required |
|---|---|---|---|
| `product_code` | Part Code * | text (readonly in variant mode) | ✓ |
| `product_name` | Product Name * | text | ✓ |
| `product_name_chinese` | Chinese Name | text | — |
| `part_type` | Part Type | select (from `/api/products/part-types/`) | — |
| `dimension` | Dimension / Size | text | — |
| `material` | Material | text (datalist from `/api/products/materials/`) | — |
| `variant_note` | Variant Note | text | — |

**Section 2 — Physical & Logistics (6 fields):** `category` (select, from `settingsApi.getMarkups()` + inline "+ Add Category"), `subcategory` (select, from `/api/products/subcategories/` + inline "+ Add Subcategory" — **local-only, not persisted**), `moq *` (number, required, ≥1, default 1), `unit_weight_kg` (number ≥0), `unit_cbm` (number ≥0), `standard_packing` (text).

**Section 3 — Trade & Customs (6 fields):** `hs_code` (text mono, placeholder `e.g. 8433.90.00`), `hs_code_description` (text), `factory_part_number` (text), `brand` (text), `oem_reference` (text), `compatibility` (text).

**Section 4 — Notes (1 field):** `notes` (textarea, rows 3).

**Variant Resolution Dialog (modal):** amber header, collapsible list of existing variants (material, dimension, part_type, category, brand, hs_code, variant_note, is_default badge), radio group (`variantAction`: `'add_new'` vs `'replace'`), `replaceVariantId` select (when replace). Cancel + "Add Variant" / "Replace Variant" button.

**Action bar (sticky, bottom):** Cancel → `/products`; Create Product button (spinner + disabled while `saving`).

**Dead element:** trash icon in header is present in DOM but has **no `@click`** handler. Remove on migration.

#### D. API endpoints (LIVE-VERIFIED against `http://localhost:8001`)

| Method | Path | Typed? | Notes |
|---|---|---|---|
| `GET` | `/api/products/check-variants/{code}/` | untyped (`{}`) | **Verified live.** Returns `{parent_id, variant_count, parent_code, parent_category, parent_hs_code, parent_brand, variants: [...]}`. |
| `GET` | `/api/products/part-types/` | untyped | Returns `string[]`. Dev DB returns `[]`. |
| `GET` | `/api/products/materials/` | untyped | `string[]`. Dev DB returns `[]`. |
| `GET` | `/api/products/subcategories/` | untyped | `string[]`. Dev DB returns `[]`. |
| `GET` | `/api/products/brands/` | untyped | `string[]`. Dev DB returns `[]`. |
| `GET` | `/api/products/hs-codes/` | untyped | `string[]`. Dev DB returns `[]`. |
| `GET` | `/api/settings/markups/` | untyped | Category options. |
| `POST` | `/api/products/` | untyped | **G-011 CLOSED (2026-04-22):** `require_role(["ADMIN", "SUPER_ADMIN", "OPERATIONS"])`. Body: the 19-field form payload (+ `replace_variant_id` optional). Auto-creates parent if absent. |
| `POST` | `/api/settings/markups/` | untyped | For "+ Add Category"; no role check observed. |

Local-interface rule (Section 10) applies to every untyped endpoint.

#### E. Data model
Create payload = the 19-field `form` ref (see ProductForm.vue line 213-222 / audit table). Required: `product_code`, `product_name`, `moq`. Optional: everything else. Optional `replace_variant_id` toggles replace-mode. Backend enforces `product_name` uniqueness globally (400 on collision) and `product_code` uniqueness only in the approve flow (409). Generic create does not validate field ranges — `moq ≥ 1`, `unit_weight_kg ≥ 0`, `unit_cbm ≥ 0` are frontend-only guards.

#### F. Business logic
- **Auto-parent creation.** Backend `POST /api/products/` creates a parent with `product_name = "[CODE]"` if no parent exists for that product_code.
- **`replace_variant_id` in same POST.** Single endpoint handles both add-new-variant and replace-existing-variant; the field in the payload toggles mode.
- **Variant check runs only in new mode.** Variant mode (`?parent_id`) and edit mode skip the check-variants call.
- **Subcategory silently dropped.** "+ Add Subcategory" updates local `subcategoriesList` ref only — value is in the payload when the form submits, but if the user reloads before saving the new option is gone. Also no backend persist (no `POST /api/products/subcategories/` endpoint).
- **800 ms success delay** then redirect.

#### G. Design system coverage
- Form sections → existing `.card card-pad` pattern.
- Inputs → `.input` class, plus standard `<select>`. For autocomplete: the Vue uses a datalist — the design system has no custom combobox; native datalist is acceptable.
- Sticky action bar → new pattern (no equivalent in `Design/screens/`). Inline implementation with `position: sticky; bottom: 0` is fine.
- Variant dialog → reuse the three-scenario `ProductConfirmDialog` pattern (scenario A — no typed confirmation), or build a new `VariantResolutionDialog`. Recommend building a new dialog because the interaction (radio choice + select dropdown + collapsible variant list) is richer than a confirm flow.

**Gap:** file upload component for product images (see EDIT below) doesn't exist in the design system.

#### H. Complexity: **MODERATE** (6 hours)
- 19-field form → React Hook Form + Zod schema = 2–3 hours.
- Variant resolution dialog = 1–2 hours.
- Inline "+ Add Category" sub-form (calls `POST /api/settings/markups/`) = 0.5 hour.
- Route + RSC shell + tests = 1.5–2 hours.

#### I. Dependencies
- **Shares file with EDIT** (target 3) and **VARIANTS** (target 4). Estimated 80% of the code is shared. Migrate all three together to avoid porting twice.
- Needs no prior migration. Can land independently.

#### J. Roles
- Route has **no `meta.roles`** today (all INTERNAL reach the page).
- Backend: `ADMIN | SUPER_ADMIN | OPERATIONS` (G-011 closed).
- Next.js migration already has `PRODUCT_CREATE` + `PRODUCT_UPDATE` in the matrix (added in `feat/migrate-products-list`). Apply `RoleGate` at page level to prevent VIEWER/FINANCE 403s.
- D-004: no pricing fields on this form → clean.

#### K. Known bugs / dead code
- Dead trash button in edit-mode header (carry over from CREATE/EDIT shared file).
- Subcategory persistence gap — audit recommends either adding a backend endpoint or removing the inline-add affordance.
- `errors.general` leaks raw backend `detail` (P-002).
- Frontend-only validation (no server-side range enforcement on numeric fields).

#### L. Labels inventory (verbatim from audit)
Titles: `New Product`, `Edit Product`, `Add Variant for [CODE]`. Section headers: `Product Identity`, `Physical & Logistics`, `Trade & Customs`, `Notes`, `Product Images`. Buttons: `Cancel`, `Create Product`, `Save Changes`, `Upload New`. Dialog: `Existing Variants Found`, `Add as New Variant`, `Replace Existing Variant`, `Add Variant`, `Replace Variant`. Placeholders: `e.g. 8433.90.00` (HS Code), `e.g. Carton box, Wooden crate` (standard_packing). Empty states: `No images for this product`, `Images are extracted from Factory Excel uploads`. Errors: `Failed to save product` (fallback), raw `e.response.data.detail` (P-002).

---

### TARGET 2 — Product DETAIL (`/products/{id}`)

**Critical finding:** **no such route exists in the Vue router.** `frontend/src/router/index.js` defines `/products`, `/products/new`, `/products/upload-excel`, `/products/:id/edit`, and `/products/review` — nothing for `/products/:id`. Clicking a product row in the list navigates straight to `/products/:id/edit`. The edit page is effectively the detail page.

This has two implications for the migration plan:

1. **There is no separate detail migration.** Attempting to ship a standalone `/products/{id}` page is a **product decision**, not a migration — it's new functionality, not a port. Options: (a) skip it; (b) add a read-only mode to `ProductForm.vue`'s Next.js successor (two lines: hide submit button, set all inputs `readOnly`); (c) build a real summary/detail page separate from the form.
2. **If we go with option (b)** (recommended — cheapest), the "detail" migration costs **≈0 additional hours** once EDIT is migrated. Just route `/products/{id}` (no `/edit` suffix) to the same page with `?mode=view`, and disable the editable affordances.

**Recommendation: bundle the "detail" capability into the EDIT migration as a read-only toggle.** Report this as a deviation if the user wanted a genuinely separate detail page. If they did, that's a ~6 hour standalone task and probably should be scoped separately once the form lands.

#### Endpoints
- `GET /api/products/{id}/` — **Verified live** with the sample variant `86903fb5…`: returns 27 fields including `product_code`, `product_name`, `product_name_chinese`, `part_type`, `dimension`, `material`, `variant_note`, `category`, `subcategory`, `unit_weight_kg`, `unit_cbm`, `standard_packing`, `moq`, `hs_code`, `hs_code_description`, `factory_part_number`, `brand`, `oem_reference`, `compatibility`, `notes`, `replace_variant_id`, `id`, `is_active`, `parent_id`, `is_default`, `thumbnail_url`, `variant_count`. Untyped (`{}`) in OpenAPI.
- `GET /api/products/{id}/images/` — returns array of image records. Verified live.

---

### TARGET 3 — Product EDIT (`/products/{id}/edit`)

#### A. Location
Same file as CREATE: `ProductForm.vue` (1,156 lines). Detection: `isEdit = Boolean(route.params.id)`.

#### B. Flow
- Entry: from the products list (row click on a single-variant product) or from the variant-row kebab in the accordion. Also linked from the duplicate-cleanup modal ("View →" per product row).
- Page-mount: two parallel fetches — `GET /api/products/{id}/` (pre-fills form) + `GET /api/products/{id}/images/` (image grid).
- Submit: `PUT /api/products/{id}/` → 800 ms success → `/products`.
- Image upload / delete operate inline (no separate flow) on the current product.

#### C. Fields + interactions (diff from CREATE)
- Same 19 fields as CREATE.
- **Section 5 — Product Images (edit-only, `v-if="isEdit"`).** Grid of thumbnails (2–5 cols responsive), each 112 px tall, hover overlay with magnifier + trash, metadata below (`{width}x{height} · {sizeKB}KB`). Click → lightbox. Upload via hidden `<input type="file">` triggered by a styled label.
- **Image Lightbox** (full-screen): navigation arrows, close button, info bar.
- Trash button in page header — dead (no handler).
- All other form interactions same as CREATE (including category/subcategory inline-add).

#### D. API endpoints (LIVE-VERIFIED)
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/products/{id}/` | Pre-fill (27 fields, untyped). |
| `GET` | `/api/products/{id}/images/` | Image list. Returns `[{id, product_id, image_path, image_url, thumbnail_url, source_type, source_order_id, width, height, file_size, is_primary}]`. |
| `POST` | `/api/products/{id}/images/upload/` | Multipart image upload. Backend dedupes by content hash; 10 MB max. |
| `DELETE` | `/api/products/{id}/images/{image_id}/` | Delete one image. |
| `PUT` | `/api/products/{id}/` | Update. G-011 CLOSED — ADMIN/SUPER_ADMIN/OPERATIONS only. |
| `POST` | `/api/products/{id}/set-default/` | Set a variant as default. Used from list-page accordion, not directly from the edit form. |

#### E-H. Data model / business logic / design / complexity
- Same data model as CREATE; just load-first-then-update.
- Image upload is the biggest new surface area: multipart handling, progress, error, deduplication feedback, broken-image fallback. Plain `<input type="file" accept="image/*">` + `FormData` works; no custom dropzone needed for parity.
- **Complexity: MODERATE (3 hours on top of CREATE)** — image grid, lightbox, upload/delete handlers, optimistic updates. Combined with CREATE+VARIANTS: ~8–9 hours total in a single migration.

#### I. Dependencies
- Shares 80%+ with CREATE (same file).
- Image operations have no dependencies on other migrations.

#### J. Roles
- Same as CREATE: `PRODUCT_UPDATE` gate. The matrix entry already exists.

#### K. Bugs
- Dead trash button in header (should be wired to delete-from-form OR removed).
- Image-upload error path not rendered (likely swallowed — P-002).
- Lightbox keydown-listener leak if component unmounts with lightbox open (same pattern documented in ExcelUpload).

#### L. Labels — same as CREATE (audit above).

---

### TARGET 4 — Variants management

**Critical finding:** there is **no standalone variants-management page.** Variant operations are split across three surfaces:

1. **Inside the form** (`ProductForm.vue` variant mode, `?parent_id=…&product_code=…`): creates a new variant under an existing parent. Same form as CREATE, but `product_code` is readonly and the variant-check interlude is skipped.
2. **Inside the products list accordion** (already migrated as `/products`): expand parent → child rows show "Set default" (star button), "Delete" (kebab), "+ Variant" link. These are 3 row-level actions.
3. **Inside the variant-resolution dialog** during CREATE: user chooses add-new vs replace.

**So "variants management" is not its own migration.** It's two surfaces:
- **Variant CREATE** (form variant mode) = bundled with target 1/3 (same file).
- **Variant list + per-row actions** = already shipped in the products-list migration.

#### API touch points (all live-verified)
- `GET /api/products/check-variants/{code}/` — called only during CREATE submit. Returns `{parent_id, variant_count, parent_code, parent_category, parent_hs_code, parent_brand, variants: [...]}`. **Live-verified** against code `03020256` → `variant_count: 1`.
- `POST /api/products/` with `parent_id` pre-filled → creates a new child variant.
- `POST /api/products/` with `replace_variant_id` → replaces an existing variant in-place.
- `POST /api/products/{id}/set-default/` — flips default among siblings.

#### Complexity: **SIMPLE** (0–1 hours incremental)
The variant mode is a one-liner route parameter detection inside ProductForm. The variant-resolution dialog is a ~100-line modal component. Both fit naturally inside the form migration.

#### Dependencies
Cannot ship without the form.

#### Design system gap
None beyond what the form already needs.

---

### TARGET 5 — Excel Upload (`/products/upload-excel`)

#### A. Location
- **Vue file:** [`frontend/src/views/orders/ExcelUpload.vue`](../../../frontend/src/views/orders/ExcelUpload.vue) (1,011 lines) — shared between `/orders/:id/upload-excel` and `/products/upload-excel`.
- **Sub-components:**
  - [`ColumnMappingDialog.vue`](../../../frontend/src/components/common/ColumnMappingDialog.vue) (201 lines) — AI column mapping review modal.
  - [`ConflictResolutionPanel.vue`](../../../frontend/src/components/orders/ConflictResolutionPanel.vue) (353 lines) — per-row conflict dropdowns + bulk resolution.
  - [`ParsedResultsTable.vue`](../../../frontend/src/components/orders/ParsedResultsTable.vue) (183 lines) — final parsed rows + select + delete + filter tabs.
- **Composable:** `composables/useConflictAnalysis.js` — wraps `POST /api/excel/analyze-conflicts/` (AI call via Claude).
- **Route:** `/products/upload-excel` → `name: 'ProductUploadExcel'`, `meta: { title: 'Import Products', parent: 'ProductList' }`. **Shares the same ExcelUpload.vue component as orders.** Mount context detected via `isProductMode = computed(() => !orderId)`.

#### B. Flow — products-path end-to-end
1. User on `/products` clicks **"Import Excel"** → lands on `/products/upload-excel`.
2. Drag-drop a FACTORY_EXCEL file → `POST /api/excel/upload/` with `{file, orderId: null, jobType: 'FACTORY_EXCEL', skipProcessing: true}`.
3. After upload: for FACTORY_EXCEL only, `POST /api/excel/analyze-columns/` runs AI column mapping. Returns `{confirmed: {header → field}, needs_review: [{header, suggested_field, confidence}], unmapped_fields: []}`.
4. If `needs_review.length > 0`: `<ColumnMappingDialog>` opens. User confirms or overrides per-field dropdowns. Click **Confirm Mapping** → emit `confirm({header → field merged})` → `POST /api/excel/jobs/{jobId}/reparse/` with confirmed mapping. OR **Skip AI Mapping** → reparse without mapping.
5. **Polling:** every 2s, `GET /api/excel/jobs/{jobId}/` until status = `DONE` | `FAILED` | `CANCELLED`.
6. On DONE, the results block renders. If any conflicts exist, `<ConflictResolutionPanel>` appears above `<ParsedResultsTable>`. AI conflict suggestions come from `POST /api/excel/analyze-conflicts/` via the composable.
7. User reviews rows, marks per-row resolutions (`add_new` / `replace` + variant / `duplicate`), edits inline fields (description, chinese_name, dimension, material, part_type) for add-new rows, and optionally bulk-selects and bulk-resolves.
8. **Apply** button → `POST /api/excel/apply/{jobId}/` with `{selected_row_indices, variant_resolutions, row_overrides, duplicate_resolutions, image_conflict_resolutions}` payload.
9. Success: `applied = true` latch flips; UI shows final summary. Success flash + (typically) user clicks back to /products.
10. Failure: `alert()` (three separate D-003 instances for upload/apply/restore — replace with toast in Next.js).

Product-mode extra: "Restore from bin" shortcut that calls `productsApi.restoreFromBin()` — it's a convenience link to revert recent deletions before re-importing.

#### C. Sub-components (summary — audits have full detail)
Each sub-component has its own audit profile (see links at top of this doc). Key attributes:
- **`<ColumnMappingDialog>`:** stateless modal, props-driven; emits `confirm | skip | close`. `FIELD_LABELS` inline dict of 15 schema fields.
- **`<ConflictResolutionPanel>`:** controlled component with heavy v-model emits (`update:variantResolutions`, `update:rowOverrides`, `update:conflictSortBy`, `process`). Bulk-select is local. AI banner with stats ("Claude AI" vs "Smart Match").
- **`<ParsedResultsTable>`:** fully controlled; filter tab bar for `All / New / Add Variant / Replace / Skipped`; status color map; factory-mode extras (Description, Category, Weight, Price USD, Image thumbnail).

#### D. API endpoints (LIVE-VERIFIED paths in openapi)
| Method | Path | When | Untyped? |
|---|---|---|---|
| `POST` | `/api/excel/upload/` | On file drop | untyped |
| `POST` | `/api/excel/analyze-columns/` | FACTORY_EXCEL post-upload | untyped |
| `POST` | `/api/excel/jobs/{job_id}/reparse/` | After column mapping | untyped |
| `GET` | `/api/excel/jobs/{job_id}/` | Polling (2s interval) | untyped |
| `DELETE` | `/api/excel/jobs/{job_id}/` | Cancel | untyped |
| `POST` | `/api/excel/apply/{job_id}/` | Apply | untyped |
| `POST` | `/api/excel/analyze-conflicts/` | AI conflict analysis (via composable) | untyped |
| `GET` | `/api/excel/jobs/` | Job history (if surfaced) | untyped |
| `POST` | `/api/products/bin/restore/` | Restore-from-bin shortcut (product mode) | untyped |

#### E. Data model
ProcessingJob lifecycle: `PENDING → PROCESSING → DONE | FAILED | CANCELLED`. `result_data` = parsed rows; `result_summary` = counts by category; `conflicts` = conflict groups. Row status values: `MATCHED`, `NEW_PRODUCT`, `NEW_VARIANT`, `DUPLICATE`, `AMBIGUOUS`, `NO_PRICE`, `SKIP_DUPLICATE`. Apply payload depends on row status + user resolution choice.

#### F. Business logic
- **Two job types.** `CLIENT_EXCEL` expects 3 columns (Barcode, Code, Qty) — no AI mapping. `FACTORY_EXCEL` expects full product details + images — AI mapping runs.
- **`analyzeColumnsFlow` fallback.** If `analyzeColumns` throws, reparse proceeds with no mapping.
- **`pendingOnly` query param.** Filters `result_data` client-side; counts in `result_summary` do NOT refilter (known quirk Q-6 in audit).
- **One-way apply latch.** No un-apply.
- **Image upload concurrent with row apply.** FACTORY_EXCEL uploads extract embedded images; they are associated with the product during apply.
- **AI call is non-critical.** Silent fallback to heuristic on error (no user-visible failure — quirk in `useConflictAnalysis`).

#### G. Design system coverage
- **File drop zone** — no design-system component; the Vue rolls its own with a div + drag/drop handlers. Can port inline OR build a shared `<FileDropZone>` Layer 2 component. Recommend inline for v1; extract if a second place needs it.
- **Step indicator / progress** — no design-system component; the Vue uses a loose progress section. A `.chip`-based stepper could work. Build inline.
- **Column-mapping table** — not a standard pattern. Build inline.
- **Conflict resolution grouped list** — Settings-screen-style grouped list with per-row selects. Build inline.
- **Parsed results table** — standard `.tbl` + filter tab bar pattern (matches orders-list / products-list).
- **Image lightbox** — the products EDIT migration also needs one. Recommend building one shared `<ImageLightbox>` component at Layer 2.

**Largest design gaps in the suite.**

#### H. Complexity: **BEAST** (16–20 hours)
- 4 interconnected sub-components (upload, column-mapping, conflict-resolution, parsed-results).
- File upload + multipart.
- Polling (replace with TanStack Query `refetchInterval` + SSE/backoff consideration — P-019).
- AI column mapping + AI conflict resolution — two separate async endpoints with silent fallbacks.
- Conflict-resolution matrix (`add_new` / `replace`+variant / `duplicate`) with bulk-apply and per-row overrides.
- Status color matrix (7 row statuses × resolution overlay colors).
- Test burden: 40+ tests covering the pipeline states.
- D-003 × 3 alert → toast refactor.

**Needs its own migration session.** Do not bundle with anything else.

#### I. Dependencies
- **Shared file with orders.** The orders version of this same component will also need migrating. Ideally migrate once as a shared component (`<ExcelUploadFlow>` React component) used by both `/orders/[id]/upload-excel` and `/products/upload-excel` Next.js pages.
- Can land AFTER the form migration (so "Edit conflict row" can link to `/products/{id}/edit`). Technically works standalone; the deep link just leaves users in Vue.

#### J. Roles
- Route-level `require_operations` (ADMIN | OPERATIONS) enforced by backend on all excel endpoints.
- D-004: factory cost columns (`factory_price_usd` in the parsed-results table) may need gating — audit says confirm during Wave 0.

#### K. Bugs / quirks (from audit Q-1 … Q-6)
- `var conflictGroups` hoisting hack.
- `deleteSelected()` mutates `results.value.result_summary` (immutability violation).
- Image viewer keydown listener leak on unmount.
- `alert()` for three error types (P-002 / D-003).
- Fixed 2s polling, no backoff (P-019).
- `pendingOnly` summary-count mismatch.

#### L. Labels — see audit files. Lots of labels across 4 sub-components: upload zone placeholder, job type labels, status messages, column mapping section titles, conflict resolution dropdown options, status badge labels, filter tab labels.

---

### TARGET 6 — Duplicate cleanup (modal inside `ProductList.vue`)

#### A. Location
- **Vue file:** [`frontend/src/views/products/ProductList.vue`](../../../frontend/src/views/products/ProductList.vue) lines 578–721 (script) and 1789–1946 (template). The modal is keyed off `showDuplicateCleanup = ref(false)`, triggered by the **Clean Duplicates** button in the page header.
- **No separate route** today. Three sub-features inside one modal.
- **No separate audit profile** — this research document is the first codified record.

#### B. Flow
Entry: any INTERNAL user clicks **Clean Duplicates** button in the `/products` page header. Backend role-gated (ADMIN / SUPER_ADMIN / OPERATIONS for the image delete endpoints; scan endpoints are `get_current_user`-only). On open: `scanDuplicates()` runs immediately.

#### C. Three sub-features

**3.1 — Duplicate Images (within a product).**
- Description copy: _"Removes identical images within the same product (same file content). Keeps one copy of each unique image."_
- User clicks **Remove Duplicate Images**. Handler `cleanDuplicateImages()`:
  - Paginates ALL products (`per_page: 200` loop).
  - For each product with ≥2 images: fingerprint = `${file_size}_${width}_${height}`. Delete duplicates via `DELETE /api/products/{id}/images/{image_id}/` one at a time.
- Success: green banner _"Done! Removed {images_removed} duplicate images from {products_cleaned} products."_
- **Purely client-side logic.** Backend has `POST /api/products/remove-duplicate-images/` endpoint that does the same thing server-side — **the Vue code does not use it.** Migration opportunity: delete the client loop, call the server endpoint.

**3.2 — Duplicate Products (same Part Code).**
- Description copy: _"Products with the same Part Code. Review and manually merge or delete extras."_
- Scanning: `scanDuplicates()` paginates all products, groups by `product_code`, computes groups where `count > 1`.
- Display: per-group card showing product_code + N copies; per-product row shows name, image count placeholder (`0 img` — TODO in code), "In Orders" badge if used, "Keep" badge on first, "View →" link → `/products/{id}/edit`.
- User action: manually navigate to each duplicate's edit page and delete/merge manually.
- **Client-side scan again** — backend has `GET /api/products/find-duplicates/` that returns `{duplicate_groups, total_groups, total_extra_products}` verified live. Vue ignores it.
- Empty state: _"No duplicate products found!"_ (green).

**3.3 — Delete All Product Images (nuclear option).**
- Description: _"Removes **all** images from every product. Use this before re-uploading a factory Excel to get fresh images. Products themselves are kept — only their images are deleted."_
- Two-step confirmation: first click shows red confirm box; second click runs.
- Handler `deleteAllProductImages()`:
  - Paginates all products, fetches images per product, deletes each via `DELETE /api/products/{id}/images/{image_id}/`.
  - Progress string updated per product: _"Processing {i} / {total} products... ({deleted} images deleted)"_.
- Success: _"Done! Deleted {total_deleted} images from {products_affected} products."_
- **Client-side loop.** No server-side "nuke all images" endpoint exists.

#### D. API endpoints (LIVE-VERIFIED)
| Method | Path | Verified | Purpose |
|---|---|---|---|
| `GET` | `/api/products/find-duplicates/` | ✓ returns `{duplicate_groups: [], total_groups: 0, total_extra_products: 0}` | Server-side dup scan (unused by Vue). |
| `POST` | `/api/products/remove-duplicate-images/` | exists in openapi | Server-side image-dup cleanup (unused by Vue). |
| `POST` | `/api/products/cleanup-orphan-images/` | exists in openapi | Orphan image cleanup (bonus, not surfaced in the modal). |
| `POST` | `/api/products/re-extract-images/` | exists in openapi | Re-extract from source files (bonus, not surfaced). |
| `GET` | `/api/products/{id}/images/` | ✓ returns array | Used for the client-side loops. |
| `DELETE` | `/api/products/{id}/images/{image_id}/` | ✓ | Used for each duplicate deletion. |

#### E. Data model
Purely derived from existing products + images. No new schema.

#### F. Business logic
- **Image fingerprint:** `file_size + width + height` treats same-dimension + same-size as duplicate. Fast but imperfect (two different images could collide on all three — unlikely but possible).
- **"Keep" heuristic:** first product in a duplicate group is the one marked Keep (arbitrary — first by API iteration order, not by most-recent or most-complete).
- **No merge logic.** The UI says "review and manually merge or delete extras" but provides no merge button. Users hand-navigate to each duplicate's edit page.

#### G. Design system coverage
- Modal wrapper → reuse the `ProductConfirmDialog` structure or build a fresh page.
- 3 collapsible sections → basic `.card`-inside-`.card` pattern.
- Progress text → already a pattern from ExcelUpload.
- Two-step confirm → matches the "typed confirmation" pattern from the products migration's `ProductConfirmDialog` (bin-permanent scenario) but lighter.
- Grouped duplicate list → basic repeating card.

**No Layer 2 gaps.** Everything is doable with existing primitives.

#### H. Complexity: **SIMPLE** (3–4 hours)
- If the migration replaces the client loops with calls to the server endpoints: 2 hours (four mutation buttons each calling one endpoint).
- If the migration preserves the client-loop behaviour (for consistency): 4 hours (pagination + concurrency + progress + error handling).
- **Recommend the server-endpoint approach** — it's faster, more reliable, and uses endpoints that already exist but sit unused.

#### I. Dependencies
- Zero. Can ship standalone.
- Useful to land SOON because the button has already been removed from the products-list page (deferred in `feat/migrate-products-list`). Currently users have lost access to this tool.

#### J. Roles
- ADMIN / SUPER_ADMIN / OPERATIONS for all image-mutation endpoints. Gate at the route level.
- Hide the whole page for VIEWER / FINANCE.

#### K. Bugs / dead code
- `image_count: 0` hardcoded in the duplicate-products group (TODO to fetch real counts).
- Scan endpoint on the server is unused — Vue reimplements.
- No real merge flow for duplicates — just a "review manually" escape hatch.

#### L. Labels (verbatim)
Modal title: `Clean Duplicates`. Subtitle: `Find and remove duplicate images & products`. Sub-feature headers: `Duplicate Images`, `Duplicate Products`, `Delete All Product Images`. Action buttons: `Remove Duplicate Images`, `Delete All Images...`, `Yes, Delete All Images`, `Cancel`, `Close`, `View →`. Statuses: `Done!`, `No duplicate products found!`, `{N} duplicate groups`, `{N} extra products`, `{N} copies`, `Keep`, `In Orders`. Progress: `Processing {i} / {total} products... ({deleted} images deleted)`. Scan: `Scanning for duplicates...`. Warning: `This will permanently delete ALL images from ALL products. Are you sure?`.

---

## 3. Cross-cutting analysis

### 3.1 Shared code opportunities
- **ProductForm is one component serving three modes.** Keep it unified: one `ProductFormFields` presentational component + three thin wrapper pages (`/products/new`, `/products/new/variant`, `/products/[id]/edit`) that load initial data and compute submit behaviour. This is the single biggest efficiency win.
- **Variant Resolution Dialog** — a standalone composed component, reusable for any future "this code already has children, what now?" flow (unlikely to recur, but cheap to keep modular).
- **Image gallery + upload + lightbox** — used by EDIT, the conflict-resolution row (image preview), and the duplicate-cleanup modal (implicit, via the image deletion). Worth lifting to Layer 2 `composed/image-gallery.tsx` + `composed/image-lightbox.tsx` once EDIT ports them.
- **Excel flow shared between orders and products.** One Next.js `<ExcelUploadFlow orderId={?}>` component mounted on both `/orders/[id]/upload-excel` and `/products/upload-excel`. This was the Vue approach; preserve it.

### 3.2 Migration sequencing (recommended)

1. **`feat/migrate-products-form`** — CREATE + EDIT + VARIANTS + read-only DETAIL (same component, mode via route). **8–9 hours.**
2. **`feat/migrate-products-cleanup`** — duplicate-cleanup as a modal on `/products` OR a small page at `/products/admin-tools`. Uses server endpoints directly (delete the client loops). **3–4 hours.**
3. **`feat/migrate-excel-upload`** — shared component for orders + products excel flow. Includes all 4 sub-components. **16–20 hours.** Requires its own migration session.
4. *(Optional 4th — not in the user's 6 but surfaces naturally)* **`feat/migrate-products-review`** — ADMIN triage. **4–6 hours.** Depends on 1 (for "Map to existing" deep link) and optionally 3 (for the submission workflow). Low priority until upload lands.

**Total for the 6 requested targets: ≈27–33 hours.** If the 7th (Product Review) is included for completeness: ≈31–39 hours.

### 3.3 Design system gaps identified
| Gap | Where needed | Layer 2 or inline? |
|---|---|---|
| **File drop zone** (drag-drop + accept types + max size) | Excel upload | Inline v1. Lift to Layer 2 if a 2nd flow emerges. |
| **Image gallery** (grid + upload button + delete overlay + metadata) | Products EDIT | **Lift to Layer 2** — reused by EDIT, review (future), and potentially other detail pages. |
| **Image lightbox** (full-screen viewer + keyboard nav) | EDIT + Excel upload (row image preview) | **Lift to Layer 2.** |
| **Multi-step / wizard progress indicator** | Excel upload (4 stages) | Inline for v1. Pattern may extend to order-detail tabs later. |
| **Column-mapping table** (Excel header → schema field with confidence badges) | Excel upload | Inline. Single-use. |
| **AI-suggestion stats bar** (e.g. "Claude AI: 12 add / 3 replace / 2 skip, 9 high-confidence") | Excel conflict resolution | Inline. Might reappear for future AI-assisted flows. |
| **Grouped-list-with-per-row-dropdown** | Conflict resolution + potentially duplicate cleanup merge | Inline for v1. Common enough to extract if a 3rd place uses it. |
| **Diff viewer** (for "replace variant" side-by-side comparison of new vs existing fields) | Excel conflict resolution (replace mode) | Inline. Complex component, but single-use. |
| **Virtualised table** (500+ rows in Excel parsed-results; catalogue browser) | Excel upload results; potentially large product catalogues | Consider TanStack Virtual when real-world row counts warrant it. |

### 3.4 Backend / API gaps
No critical gaps that block the six migrations. Two minor gaps for a later clean-up task:

1. **`POST /api/products/subcategories/` does not exist.** The Vue "+ Add Subcategory" only mutates local state. Either (a) add the endpoint so persistence works, or (b) drop the inline-add and require subcategories to be defined in settings. Tracked as a bug in the form audit.
2. **The Vue duplicate-cleanup modal does not use the server endpoints that already exist** (`find-duplicates`, `remove-duplicate-images`). The migration is a chance to delete the client loops — saves ~60 lines of Vue logic replaced by two `postJson` calls.

Excel endpoints all present. Image upload endpoint present and verified. Check-variants endpoint present and verified. Set-default endpoint present.

### 3.5 Risk summary (per migration)
| Migration | Risk | Why |
|---|---|---|
| form (#1) | **Low–Medium** | Big but conventional. Main risks are the variant-resolution dialog UX and the image-upload error path. |
| cleanup (#2) | **Low** | Small scope; risk is only if user hits a large dataset (mitigated by server endpoints). |
| excel-upload (#3) | **High** | File handling, polling, AI integration, apply idempotency, conflict matrix. Wave 6 for a reason. |
| review (#4) | **Low–Medium** | Simple list + 3 modals, but backend role enforcement (G-011) must hold for approve/map/reject endpoints. Already confirmed closed. |

---

## 4. Recommended next six migrations (finalised)

Given the user explicitly asked for **six**, and that CREATE/DETAIL/EDIT/VARIANTS collapse to one file, my recommended list reshuffles the six to deliver equivalent coverage:

| # | Migration | Hours | Rationale |
|---|---|---|---|
| 1 | `feat/migrate-products-form` (CREATE + DETAIL view-mode + EDIT + VARIANTS in one go) | **8–9** | One Vue file, 80% shared code across all four "targets." Ship together. The "separate detail page" is achievable as a read-only route on the same component. |
| 2 | `feat/migrate-products-cleanup` | **3–4** | Independent. Restores the "Clean Duplicates" button removed from the migrated /products page. Use server endpoints. |
| 3 | `feat/migrate-excel-upload` | **16–20** | Own session. Biggest risk. Shared between orders + products — port as one shared Next.js component. |
| 4 | `feat/migrate-products-review` | **4–6** | Not in the original six but a natural dependency target of #3. ADMIN-only triage queue. |
| 5 | *(hold)* | *(next wave)* | Next wave candidates outside products: clients list, factories list, finance AR. |
| 6 | *(hold)* | *(next wave)* | Same. |

**Migrations #1 → #3 cover every user-visible scope the original six targets asked about.** #4 is optional-but-recommended for completeness. Slots #5 and #6 stay open for the next wave of migrations.

Total migration time for #1–#4: **≈31–39 hours of focused work, landable over 3–4 migration sessions.**

---

## 5. Appendix — live backend verification log

All verified on 2026-04-24 against `http://localhost:8001` with admin JWT.

### Sample live responses

`GET /api/products/check-variants/03020256/` →
```json
{
  "parent_id": "9e4c3e77-6597-4af2-a674-bfcf21166f7a",
  "variant_count": 1,
  "parent_code": "03020256",
  "parent_category": "Cabin Spare Parts",
  "parent_hs_code": null,
  "parent_brand": null,
  "variants": [{"id": "86903fb5-…", "product_name": "Thermostat", …}]
}
```

`GET /api/products/86903fb5-a445-401c-a664-9fb8312e0e47/` → 27 fields including every form field + `id`, `is_active`, `parent_id`, `is_default`, `thumbnail_url`, `variant_count`.

`GET /api/products/86903fb5-…/images/` → array of `{id, product_id, image_path, image_url, thumbnail_url, source_type, source_order_id, width, height, file_size, is_primary}`.

`GET /api/products/find-duplicates/` → `{duplicate_groups: [], total_groups: 0, total_extra_products: 0}` (dev DB has no duplicates).

`GET /api/products/pending-review-list/` → `{products: [], total: 0}`.

### Autocomplete endpoints returning `[]` in dev DB
`/api/products/part-types/`, `/materials/`, `/subcategories/`, `/brands/`, `/hs-codes/` — all return `[]`. Endpoints work; seed data has not populated these distinct-value lists. Not a blocker — real datasets will populate them.

### Excel endpoints (presence verified; not exercised)
```
/api/excel/analyze-columns/
/api/excel/analyze-conflicts/
/api/excel/apply/{job_id}/
/api/excel/jobs/
/api/excel/jobs/{job_id}/
/api/excel/jobs/{job_id}/reparse/
/api/excel/upload/
```
Plus related download endpoints (`/api/excel/download-pi/{order_id}/`, etc.) outside the six-target scope.

---

**End of research document.** No code written, no branches created, no migration log created. All findings are read-only observations against the existing Vue source, audit profiles, and live FastAPI backend.
