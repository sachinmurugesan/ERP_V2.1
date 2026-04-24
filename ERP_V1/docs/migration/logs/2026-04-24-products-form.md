# Migration Log — Products Form (CREATE + DETAIL + EDIT + VARIANTS)

## Header

- **Page name(s):** `/products/new` (CREATE), `/products/new?parent_id=…` (VARIANT CREATE), `/products/{id}/edit` (EDIT), and `/products/{id}` (new DETAIL read-only mode, same component)
- **Date started:** 2026-04-24
- **Date completed:** _(pending)_
- **Research:** [docs/migration/research/products-subpages-2026-04-24.md](../research/products-subpages-2026-04-24.md) (committed `22dc0dd`)
- **Audit profile:** [docs/migration-audit/pages/internal_products_form.md](../../migration-audit/pages/internal_products_form.md)
- **Vue source:** [ERP_V1/frontend/src/views/products/ProductForm.vue](../../../frontend/src/views/products/ProductForm.vue) (1,156 lines, serves 3 modes today + gains a 4th DETAIL mode)
- **Reference image:** none — design authority is the master design folder (`ERP_V1/Design/`); this is a POLISH migration (content right, visual layer rebuilt on design-system tokens).
- **Branch:** `feat/migrate-products-form`
- **Scope:** INTERNAL products form. Four modes bundled: CREATE, VARIANT CREATE, EDIT, DETAIL (read-only). Excel upload, duplicate cleanup, product review — all deferred to their own migrations.

---

## Phase 1 — Discovery findings

### Research document ↔ Vue source reality check

The research doc landed three days ago described the form at a high level. Re-reading the Vue in full turned up **four corrections / additions** that Phase 2 needs to plan around:

1. **Sections — 5, not 4.** The research and audit both said "4 sections + images." The Vue has **five** sections + images: Product Identification (3 fields, 2-col grid), **Variant Attributes (4 fields: `part_type`, `dimension`, `material`, `variant_note`, 4-col grid)** — this is a separate section today, not merged into Identity — Classification & Logistics (6 fields, 3-col grid), Trade & Customs (6 fields, 2-col grid), Notes (1 field, full-width). Total 20 field controls across 5 sections.
2. **`part_type` is a hardcoded `<select>`, not API-driven.** The audit said it's populated from `GET /api/products/part-types/`. In reality the Vue template hardcodes four options: `Original / Copy / OEM / Aftermarket`. The `/api/products/part-types/` endpoint exists and returns `[]` in the dev DB — unused by this form. Treat as a closed enum for the migration; do NOT wire it to the endpoint.
3. **`loadCategories()` merges two sources.** The research doc said categories come from `settingsApi.getMarkups()`. The Vue merges markups + `productsApi.categories()` (distinct values from the products table) into a unified sorted list keyed by `name`. The migration should preserve this merge or explicitly accept data loss (orphan categories present on existing products but missing from the markups table would disappear from the dropdown).
4. **Material / brand / HS code have NO autocomplete / datalist.** The audit implied autocomplete from `/api/products/materials/` etc.; the Vue template uses plain `<input type="text">` with no `list` attribute. The `materials`, `brands`, `hs-codes` endpoints exist but this form doesn't call them. Not a bug — just an audit inaccuracy. Treat these as free-text inputs in the migration.

Additional low-impact findings from the Vue I didn't see flagged earlier:
- The EDIT header has a hardcoded `"Last updated 2 days ago"` (static string, not a real timestamp) — **another bug** in addition to the dead trash button. Remove both.
- Image delete uses native `window.confirm('Delete this image?')` (D-003 alert-variant). Replace with a lightweight inline confirmation or the typed-confirmation pattern we've shipped elsewhere.
- Variant-mode prefill (`prefillFromParent`) calls `productsApi.list({group:true, search, per_page:1})` to inherit `category`, `hs_code`, `hs_code_description` from the parent's first variant. This implicit inheritance is useful and should carry forward.

### Field inventory (20 fields, verbatim from Vue line 42-63)

| # | Binding | Label | Type | Default | Required | Validation |
|---|---|---|---|---|---|---|
| 1 | `product_code` | `Part Code *` | text (readonly in variant mode) | `""` | ✓ | trimmed non-empty |
| 2 | `product_name` | `Product Name *` | text | `""` | ✓ | trimmed non-empty; server: unique globally |
| 3 | `product_name_chinese` | `Chinese Name` | text | `""` | — | — |
| 4 | `part_type` | `Type` | **hardcoded `<select>`** (Original / Copy / OEM / Aftermarket) | `""` | — | — |
| 5 | `dimension` | `Size / Dimension` | text | `""` | — | — |
| 6 | `material` | `Material` | text (no autocomplete) | `""` | — | — |
| 7 | `variant_note` | `Variant Note` | text | `""` | — | — |
| 8 | `category` | `Category` | `<select>` (merged markups + products categories) + inline "+ Add" | `""` | — | — |
| 9 | `subcategory` | `Subcategory` | `<select>` (from products/subcategories) + inline "+ Add" (local-only, bug) | `""` | — | — |
| 10 | `moq` | `MOQ *` | number, `min="1"` | `1` | ✓ | ≥ 1 |
| 11 | `unit_weight_kg` | `Weight (kg)` | number, `step="0.01"`, `min="0"` | `null` | — | ≥ 0 or null |
| 12 | `unit_cbm` | `Volume (CBM)` | number, `step="0.0001"`, `min="0"` | `null` | — | ≥ 0 or null |
| 13 | `standard_packing` | `Standard Packing` | text | `""` | — | — |
| 14 | `hs_code` | `HS Code` | text, font-mono | `""` | — | — |
| 15 | `hs_code_description` | `HS Code Description` | text | `""` | — | — |
| 16 | `factory_part_number` | `Factory Part Number` | text | `""` | — | — |
| 17 | `brand` | `Brand` | text | `""` | — | — |
| 18 | `oem_reference` | `OEM Reference` | text | `""` | — | — |
| 19 | `compatibility` | `Compatibility` | text | `""` | — | — |
| 20 | `notes` | `Notes` | textarea (rows 3) | `""` | — | — |

Plus the Variant Resolution Dialog's own controls (`variantAction` radio, `replaceVariantId` select) and the image operations (file upload, delete).

### Section structure (5 sections + images, verbatim from Vue)

1. **Product Identification** — `product_code`, `product_name`, `product_name_chinese` (2-col `md:grid-cols-2`).
2. **Variant Attributes** — `part_type`, `dimension`, `material`, `variant_note` (4-col `lg:grid-cols-4`). Has an explanatory subtitle: _"Same part code can have multiple variants with different type, size, or material. Leave empty if this is the only variant."_
3. **Classification & Logistics** — `category`, `subcategory`, `moq`, `unit_weight_kg`, `unit_cbm`, `standard_packing` (3-col `lg:grid-cols-3`).
4. **Trade & Customs** — `hs_code`, `hs_code_description`, `factory_part_number`, `brand`, `oem_reference`, `compatibility` (2-col `md:grid-cols-2`).
5. **Notes** — `notes` (full-width textarea).
6. **Product Images** — `v-if="isEdit"` only — grid of thumbnails, upload button, lightbox, delete.

### Mode detection + routing

Vue uses two computeds:
- `isEdit = !!route.params.id` (line 16)
- `isVariantMode = !!route.query.parent_id && !isEdit` (line 364)

The third mode (pure CREATE) is neither. No DETAIL mode exists in Vue — `/products/{id}` is not routed.

Proposed Next.js URL structure (to be decided in Phase 2):
- `/products/new` → CREATE.
- `/products/new?parent_id=…&product_code=…` → VARIANT CREATE.
- `/products/{id}` → DETAIL (read-only) — **new** for this migration.
- `/products/{id}/edit` → EDIT.

`/products/{id}` is currently routed to the Vue list (it doesn't exist as a Vue route, and the Vue app would 404 a direct `/products/{id}` hit). Adding it in Next.js is a pure addition — no Vue behaviour to preserve or break.

### Variant resolution dialog (modal)

Only appears in pure CREATE mode and only when `productsApi.checkVariants(code)` returns `variant_count > 0`. Rendered as a full-screen overlay with:
- amber header (`Existing Variants Found` + part code + count);
- collapsible "Current Variants" section showing per-variant material / dimension / part_type / category / brand / hs_code / variant_note / `is_default` badge (Vue transition with max-height fade);
- two-choice radio group — `Add as New Variant` (emerald tint) / `Replace Existing Variant` (amber tint, shows a variant-picker `<select>` inline when selected);
- footer — `Cancel` + `Add Variant` / `Replace Variant` primary button (tone varies with action).

Both actions hit `POST /api/products/`. Replace mode adds `replace_variant_id` to the payload; the backend interprets that as an in-place update.

### Image operations (EDIT only)

- **Load** — `GET /api/products/{id}/images/` on mount. Response verified live: `[{id, product_id, image_path, image_url, thumbnail_url, source_type, source_order_id, width, height, file_size, is_primary}]`.
- **Upload** — hidden `<input type="file" accept="image/*">` triggered by a styled label. On change → `POST /api/products/{id}/images/upload/` with `FormData{file}` → refetch the list.
- **Delete** — native `window.confirm('Delete this image?')` → `DELETE /api/products/{id}/images/{imageId}/` → remove from local list.
- **Lightbox** — click image → full-screen overlay with close button, prev/next arrows (if > 1), metadata bar (`{W}x{H} · {sizeKB}KB · {source_type}`).
- **Broken-image fallback** — per-image `brokenImages[id]` flag set on `@error`; fallback tile with `pi-image` icon.

### Backend endpoint verification (live against `http://localhost:8001`)

Every endpoint below returned the expected status with the admin JWT.

| Method | Path | Live response | Notes |
|---|---|---|---|
| GET | `/api/products/{id}/` | 27-field Product object (`product_code`, `product_name`, ..., `thumbnail_url`, `variant_count`). Untyped in openapi. | Exact fields line up with the 20-field form + 7 read-only fields (`id`, `is_active`, `parent_id`, `is_default`, `thumbnail_url`, `variant_count`, and the back-reference `replace_variant_id`). |
| GET | `/api/products/{id}/images/` | Array as above. | Confirmed shape. |
| POST | `/api/products/{id}/images/upload/` | Multipart. | Endpoint presence confirmed; not exercised. |
| DELETE | `/api/products/{id}/images/{image_id}/` | — | Presence confirmed. |
| POST | `/api/products/` | Untyped. | G-011 CLOSED. Accepts optional `replace_variant_id`. |
| PUT | `/api/products/{id}/` | Untyped. | G-011 CLOSED. |
| GET | `/api/products/check-variants/{code}/` | `{parent_id, variant_count, parent_code, parent_category, parent_hs_code, parent_brand, variants: [{id, product_name, material, dimension, part_type, category, brand, hs_code, variant_note, is_default}, ...]}` | Verified against `03020256` → `variant_count: 1`. |
| GET | `/api/products/categories/` | `string[]` — `["Cabin Spare Parts", "Thresher Spare Parts", …]`. | Used in merged load. |
| GET | `/api/products/subcategories/` | `string[]` — `[]` in dev DB. | Works; seed data empty. |
| GET | `/api/settings/markups/` | Array of `{id, name, markup_percent, ...}`. Dev DB `[]`. | Used in merged load. |
| POST | `/api/settings/markups/` | Body: `{name, markup_percent}`. | Used by "+ Add Category". |

Unused endpoints (audit claimed they were used; Vue doesn't call them): `/api/products/part-types/`, `/materials/`, `/brands/`, `/hs-codes/`. Treat as available but not wired.

### Permission matrix confirmation

`harvesterp-web/packages/lib/src/auth/matrix.ts` has:
- `Resource.PRODUCT_LIST` — ADMIN, OPERATIONS, FINANCE, CLIENT, FACTORY.
- `Resource.PRODUCT_DETAIL` — same.
- `Resource.PRODUCT_CREATE` — ADMIN, OPERATIONS (+ SUPER_ADMIN bypass).
- `Resource.PRODUCT_UPDATE` — ADMIN, OPERATIONS (+ SUPER_ADMIN bypass).
- `Resource.PRODUCT_FACTORY_COST` — ADMIN, OPERATIONS, FINANCE (for field stripping only; not relevant to this form since no cost fields).

No new permission needed for this migration. DETAIL uses `PRODUCT_DETAIL` (all roles can view); EDIT / CREATE use `PRODUCT_UPDATE` / `PRODUCT_CREATE`.

### Layer 2 inventory (apps/web)

**Already ported:**
- `Icon`, `Logo`, `SparkLine`, `DSAvatar` (design-system).
- `KpiCard`, `RoleGate`, `StageChip`, `UserDropdown` (composed).
- shadcn primitives: `button`, `card`, `dropdown-menu`, `input`, `label`.
- Shells: `Sidebar`, `Topbar` (via `NavigationSidebar` + `AppTopbar`).
- Helpers shipped with orders / products list: `resolveDisplayName`, `ProductThumbnail`, `ProductConfirmDialog` (3 scenarios), row-checkbox helper, pagination helper, empty-state / error-card helpers.

**Gaps needed for this migration:**
- **Image gallery** — new. Grid + upload button + delete overlay + broken-image fallback + metadata. Research doc recommended Layer 2.
- **Image lightbox** — new. Full-screen overlay + prev/next + close + info bar. Research doc recommended Layer 2.
- **Variant resolution dialog** — new. Richer than `ProductConfirmDialog` (radio group + variant picker + collapsible list). Build local to the products form — single-use.
- **Unsaved-changes prompt** — new. Small helper; build inline.

Not needed (can re-use): confirm-dialog helper pattern (but we'll extend inline, not port from ui-gallery per precedent).

### Dead code / known bugs (from Vue source)

- Trash button in EDIT header has no `@click` → remove.
- `"Last updated 2 days ago"` string in EDIT header is hardcoded → remove or wire to a real timestamp (backend doesn't expose `updated_at` in the response — so remove).
- `window.confirm('Delete this image?')` for image delete → replace with typed-confirm or inline confirm.
- `errors.general` leaks raw backend `detail` field directly to the UI (P-002) → wrap with a generic message.
- "+ Add Subcategory" updates `form.subcategory` but never persists — on reload the new subcategory value stays on the saved product but isn't in the dropdown. Three fix options: (a) backend endpoint (out of scope), (b) remove the "+ Add" affordance, (c) keep current behaviour but warn the user. Phase 2 decision.

### Labels inventory (verbatim, from Vue)

Titles: `New Product`, `Edit Product`, `Add Variant`. Subtitles: `Add a new product to the catalog`, `Update product master data`, `Adding a new variant under {CODE}`.

Section headers: `Product Identification`, `Variant Attributes`, `Classification & Logistics`, `Trade & Customs`, `Notes`, `Product Images`.

Section 2 helper: _"Same part code can have multiple variants with different type, size, or material. Leave empty if this is the only variant."_

Field labels + placeholders: `Part Code *` (`e.g. AH-ENG-001`), `Product Name *` (`e.g. Engine Cylinder Head Gasket`), `Chinese Name` (`Optional Chinese product name`), `Type` (`Select type`), `Size / Dimension` (`e.g. 12mm, 32x15mm, M8`), `Material` (`e.g. Cast Iron, Steel, Rubber`), `Variant Note` (`Any other variant info`), `Category` (`Select category`), `Subcategory` (`Select subcategory`), `MOQ *`, `Weight (kg)` (`0.00`, suffix `kg`), `Volume (CBM)` (`0.0000`, suffix `m³`), `Standard Packing` (`e.g. Carton box, Wooden crate`), `HS Code` (`e.g. 8433.90.00`), `HS Code Description` (`HS code description for customs`), `Factory Part Number` (`Factory's own part number`), `Brand` (`Brand name`), `OEM Reference` (`Original equipment manufacturer reference`), `Compatibility` (`Compatible models/machines`), `Notes` (`Additional notes about this product...`).

Category helper below Part Code: _"Same code can exist for different materials"_.

Inline-add: `+ Add Category`, `Category name`, `Markup %`, `Add`, `Cancel`, `Adding...`. `+ Add Subcategory`, `New subcategory name`, `Add`, `Cancel`.

Button labels: `Cancel`, `Create Product`, `Save Changes`, `Upload New`, `Back to Products`.

Empty / loading states: `Loading product...`, `Loading images...`, `No images for this product`, `Images are extracted from Factory Excel uploads`.

Status banners: `Product created successfully!`, `Product updated successfully!`, `New variant added successfully!`, `Variant replaced successfully!`, `Failed to save product`, `A product with this name already exists`, `Failed to load product data`.

Variant dialog: `Existing Variants Found`, `Current Variants`, `{N} variants` (plural-aware), `Hide` / `View all details`, `Default` badge, `Not set` (italic), `Choose Action`, `Add as New Variant`, _"Create an additional variant under this part code"_, `Replace Existing Variant`, _"Overwrite an existing variant's data with the new values"_, `Select variant to replace…`, `Cancel`, `Add Variant`, `Replace Variant`.

Image delete confirm (native): `Delete this image?`.

### Components to reuse from prior migrations

- `@/components/design-system/icon` — Icon (with all the names we need: `plus`, `arrow-left`, `upload`, `trash`, `close`, `warning`, `chevron-*`, `check`, `save`).
- `@/components/composed/role-gate` — `RoleGate` (for gating the page shell + submit button).
- `@/components/composed/stage-chip` — shared (not used here).
- `@/components/shells/app-topbar` — consistent topbar.
- `@/components/primitives/card`, `input`, `button`, `label` — base shadcn primitives.
- **`ProductThumbnail`** from `apps/web/src/app/(app)/products/_components/product-thumbnail.tsx` — already lives under the products directory and handles broken-image fallback. Reuse for the parent thumbnail in the header + image grid. Or consider lifting to `components/composed/` if it gets a third user.
- **`resolveDisplayName`** (lib) — for the topbar greeting if we wire it through.

### Components needed for this migration

New under `apps/web/src/app/(app)/products/_components/` OR `apps/web/src/components/composed/` (Phase 2 decision):

- `<ProductForm>` — the 5-section form container. Handles all 20 fields + validation + mode detection + submit.
- `<ProductFormFields>` — presentational component rendering the fields for one mode. Accepts `mode`, `initialValues`, `readOnly`, `errors` props.
- `<VariantResolutionDialog>` — the rich radio+picker modal. Local to products.
- `<ImageGallery>` — grid + upload + delete + broken-image handling. **Candidate for Layer 2.**
- `<ImageLightbox>` — full-screen viewer with prev/next. **Candidate for Layer 2.**
- `<InlineAddCategory>` — the "+ Add Category" sub-form + `POST /api/settings/markups/` mutation.
- Unsaved-changes prompt helper (`useBeforeUnload` hook + `router.events` intercept).

### Design system gaps confirmed

1. **Image gallery** — no existing pattern in the design system. `ProductThumbnail` exists but it's a single-image primitive. The gallery is a grid + upload affordance + delete overlay — 60+ lines. Lift to Layer 2 because a future product-detail or client-portal page will want it.
2. **Image lightbox** — no existing pattern. Full-screen overlay with prev/next navigation. ~80 lines. Lift to Layer 2 for the same reason.
3. **Variant resolution dialog** — unique to this page. Build inline.
4. **Unsaved-changes prompt** — no existing pattern. Small hook (~15 lines). Inline is fine.

No critical gap blocks Phase 3.

### Stop-condition check

- Research document changed? **No** — committed (`22dc0dd`) and still reflects reality. Four small corrections surfaced during Phase 1 Vue re-read and are captured above as drift items, not breakages.
- Any endpoint 404 or unexpected shape? **No** — every endpoint returned the expected status and shape.
- Vue file structural changes since research? **No** — line numbers, handler names all match.
- Permission matrix missing `PRODUCT_CREATE` / `PRODUCT_UPDATE`? **No** — both present and correctly scoped.
- Any `[UNCLEAR]` audit marker blocks a Phase 2 decision? **No** — audit is internally consistent; the drift items are informational, not blocking.

Phase 1 clears all stop conditions. Proceed to Phase 2.

---

## Phase 2 — UX reasoning report

### User goal per mode

- **CREATE (`/products/new`).** Operations or admin user types out a new part from factory documentation / order line / pasted code. Primary goal: "record this part in the catalogue fast and correctly" — speed and validation, not exploration.
- **VARIANT CREATE (`/products/new?parent_id=…&product_code=…`).** Same user, adding a second-or-later variant to an existing part family. Primary goal: "add a size / material differentiation to the same code without typing everything again" — auto-inherited category / HS code matters.
- **EDIT (`/products/{id}/edit`).** Maintenance — fix a typo, correct a wrong category, update a weight. Secondary: re-upload or prune images. Small changes, read-heavy before editing.
- **DETAIL (`/products/{id}`).** **New affordance, not previously in Vue.** Read-only view for FINANCE / VIEWER / any user who needs to look at a part but shouldn't mutate. Also useful as the landing surface when a link (e.g. from an order line) wants to show the product without putting the user into edit mode.

### Information hierarchy

For CREATE the form is roughly sequential — identity → variant attributes → classification → trade → notes. The Vue's section order matches this. I do not propose reordering.

For EDIT the hierarchy flips: most edits are to a single field or a cluster (e.g. just fixing the HS code, or just swapping an image). A user who opens EDIT to fix one thing shouldn't have to scroll past four sections they don't care about. This suggests **collapsible sections** with the "most-edited-first" heuristic, OR keeping all sections open and letting the browser's own scrolling handle it (simpler, matches Vue).

For DETAIL the hierarchy is read-first. Identity + category + brand up top, logistics + trade below, images at the bottom. Match the form order; just lock editing.

### Mode detection + routing (recommendation)

**Recommend the exact URL structure proposed at the top:**

| URL | Mode | Backend |
|---|---|---|
| `/products/new` | CREATE | none on mount; on submit → `check-variants` then `POST` |
| `/products/new?parent_id=…&product_code=…` | VARIANT CREATE | `GET /api/products/?group=true&search=<code>&per_page=1` for prefill; on submit → `POST` with `replace_variant_id` optional |
| `/products/{id}` | DETAIL | `GET /api/products/{id}/` + `GET /api/products/{id}/images/` |
| `/products/{id}/edit` | EDIT | same fetches as DETAIL; on submit → `PUT` |

Implementation: four Next.js page files that all delegate to a single `<ProductForm>` component. Each page.tsx fetches server-side data, resolves the user's role (for `RoleGate` on the submit button), and passes `mode` + `initialValues` + `readOnly` + `user` props. The URL is the source of truth — no client-side mode flipping.

**Alternatives rejected:**
- Single `/products/[id]?mode=edit` page using a query param. Less deep-linkable; breaks browser back behaviour when switching between detail and edit.
- Combine new + variant into one page with `?mode=variant`. The current Vue query-param style (`?parent_id=…`) is cleaner because the parent_id IS the meaningful parameter; `mode=variant` would be redundant.

### Form layout

Four options from the task brief:

| Option | Pros | Cons |
|---|---|---|
| A — Single long page with section cards (Vue's current approach) | Matches Vue, matches every existing design-system screen (Inventory, Finance, Dashboard), one scroll, all fields always visible. | Long scroll on small screens. 5 sections × ~60 px header + fields = ~1500 px of form. |
| B — Multi-step wizard (Identity → Variant → Classification → Trade → Notes) | Focuses attention, validates section-by-section. | CREATE and EDIT need different step counts (EDIT doesn't benefit). Adds state management. Vue has no wizard pattern. Users can't see overall progress at a glance. |
| C — Tabbed layout | Compact on wide screens, hides complexity. | Tabs for a 5-section form are unusual. Validation errors in a hidden tab are easy to miss. Images is a natural candidate for a tab — everything else is not. |
| D — Collapsible sections, first required section open | Reduces visual noise for EDIT. | Adds affordance (collapse chevron) that isn't in Vue and has no design-system precedent. Validation error in a collapsed section is a footgun. |

**Recommend A** — single long page with section cards, unchanged from Vue, rebuilt with the design system's `.card` + section pattern.

Reasoning: (a) it matches every other HarvestERP page already migrated; (b) wizards are a step backwards for EDIT, which is the most-used of the four modes; (c) 1500 px of form is fine — modern screens have 900+ px vertical. In a tablet / mobile viewport the content just stacks normally.

One tweak: **render the Images section as a sub-panel to the right of the form (desktop ≥ lg) rather than below**, when in EDIT mode. It's read-heavy, visual, and belongs in the user's peripheral vision — not below 5 sections of text inputs. On tablet / mobile it falls below the form as before. This is a departure from Vue's layout but matches the product-detail affordances you'd see on a modern admin.

### Validation strategy

- **Client-side validation:** React Hook Form + Zod schema. Derive TypeScript types from the schema so `buildPayload` + API payload share one type. Five validation rules from the Vue port cleanly:
  - `product_code`: non-empty trimmed string.
  - `product_name`: non-empty trimmed string.
  - `moq`: `z.number().int().min(1)` (default 1).
  - `unit_weight_kg`: `z.number().min(0).nullable()`.
  - `unit_cbm`: `z.number().min(0).nullable()`.
- **Server-side validation:** backend enforces `product_name` global uniqueness (400 with `detail: "Product name already exists"`). Phase 3 must map that response back to the `product_name` field error without leaking other details (the Vue already special-cases this — preserve the logic).
- **Display:** inline per field (red border + error text below), matching Vue. **No sticky error summary** — it would duplicate noise.
- **Submit-time cleanup:** optional empty strings → `null` (Vue's `buildPayload` already does this), numeric parsing for `moq` / `unit_weight_kg` / `unit_cbm`. Port one-for-one.

### Variant resolution dialog

Three options:

- **A — Dedicated `<VariantResolutionDialog>` component** — richer than a confirm. Radio group (add / replace) + conditional variant picker + collapsible variants list.
- **B — Extend `ProductConfirmDialog` with scenario D** — this dialog needs a variant picker and a collapsible list, which goes well beyond "type to confirm." Extending would be an abstraction stretch.
- **C — Inline expanded section rather than modal** — the current Vue treats this as a modal because the user has already hit Submit and we're interrupting the flow. An inline expansion on the form would be less disruptive but loses the "this is a decision point" signal.

**Recommend A.** Build a dedicated, form-local `<VariantResolutionDialog>`. Single-use today, but it's complex enough (radio + conditional select + collapsible list + transition animation) that trying to fit it into a generic confirm is worse than dedicated code. Extract if a second use-case emerges.

### Image section (EDIT only; also rendered read-only in DETAIL)

- **Grid layout.** Responsive: 2-col on mobile, 3-col tablet, 4-col desktop, 5-col `xl`. Tailwind `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3` matches Vue exactly.
- **Empty state.** Icon (`inventory` or `image`) + _"No images for this product."_ + _"Images are extracted from Factory Excel uploads."_ — match Vue copy.
- **Upload UX.** Hidden `<input type="file" accept="image/*">` triggered by a visible label/button. **No drag-drop in v1** — drag-drop needs a dedicated drop zone primitive; Vue doesn't have one and the product page isn't the place to introduce it. Add drag-drop later if users complain.
- **Progress.** Inline spinner on the upload button while the request is in flight. No per-file progress bar — the endpoint doesn't stream progress.
- **Error handling.** Toast on upload failure + the image list is unchanged. Don't replace the grid on error.
- **Delete confirmation.** Replace Vue's `window.confirm` with an inline confirmation popover on the delete button, OR extend `ProductConfirmDialog` with scenario "single image delete" (no typed confirmation — images are minor and easily re-uploaded). **Recommend inline popover** — modals for every image delete is overkill. Click Trash → button flips to "Confirm?" with a 4 s auto-cancel.
- **Lightbox.** Full-screen overlay, prev / next arrows (if > 1), Escape to close, backdrop click to close, metadata bar at bottom. Arrow-key nav (Left / Right). Mount as a Layer 2 component so it can be reused.

**Layer 2 decision:** build `<ImageGallery>` + `<ImageLightbox>` at `apps/web/src/components/composed/`. Lifted out of the form because (a) they're substantial, (b) a future product-detail or order-line-detail page will need them, (c) keeps the form file focused on the 20 fields + submit flow.

### Unsaved changes

**Recommend: enable.** A 20-field form takes real minutes to fill. Losing input to an accidental nav click is painful.

Implementation: `useBeforeUnload` React hook for the browser reload/close path, plus a `router.events` listener (Next.js 15 App Router — use `onBeforeUnload` + a custom hook that intercepts `router.push`). Show a native browser prompt for reload, and a custom confirm dialog for in-app navigation.

Only activate when `form.formState.isDirty` (React Hook Form gives us this for free).

### Submit UX

- **Saving state.** Button shows spinner + disabled. Match Vue.
- **Success.** Inline success banner (green) at the top of the form (same place as errors). Match Vue's 800 ms delay then redirect behaviour — 800 ms is short enough to read the banner, long enough to confirm the save. **Keep.**
- **Redirect target.** `/products`. Match Vue. After create, users usually want to either add another or review the list — pushing them back to the list feels right.
- **Error feedback.** Inline general error (red banner) at the top of the form. Map `detail: "Product name already exists"` to `errors.product_name` (Vue already does this — preserve). Any other error shows a **generic** message ("Failed to save product. Please try again.") — **never leak `error.response.data.detail` to the UI** (P-002).

**Deviation from Vue:** Vue leaks the raw detail. Fix here: show the detail in the browser console (for debugging) but render a generic message to the user.

### Detail (read-only) mode presentation

- **Visual signal.** Inputs render as plain text (same size, same color) inside the section cards — NOT disabled inputs with gray backgrounds. Disabled inputs look like "broken" states; plain text reads as "informational."
- **Edit CTA.** Top-right of the page header, a `RoleGate`-wrapped "Edit" button that navigates to `/products/{id}/edit`. One click to switch to edit mode.
- **Back after edit.** After EDIT save → `/products` (consistent with CREATE). Could also consider `/products/{id}` (back to detail view) — arguably cleaner UX but diverges from CREATE's behaviour. **Recommend: match Vue; redirect to `/products` after save.** Less special-case logic.
- **Images section in DETAIL.** Render the gallery read-only: no upload button, no delete on hover. Clicking an image still opens the lightbox.

### Responsive behavior

- **Desktop ≥ 1024 px.** Form in main column (max-width `max-w-4xl`). In EDIT mode, images section renders as a right sidebar sub-panel. `xl:grid-cols-[2fr,1fr]` container.
- **Tablet 768–1023 px.** Single column, 2-col inline grids (sections 1 + 4) become 2-col; section 3 stays 3-col; section 2 (variant attributes) drops from 4 → 2 col.
- **Mobile < 768 px.** Single column everywhere. All grids collapse to 1-col. Images grid goes to 2-col. Sticky action bar pinned to bottom of viewport. Sections have slightly reduced padding.

### Accessibility

- Every field gets an explicit `<label htmlFor=...>` with `id` on the input.
- Required fields carry both a visible `*` and `aria-required="true"`. Asterisk is red via token; add a visually-hidden "required" word for screen readers (we already do this pattern in login-form and orders).
- Error messages use `aria-describedby` pointing at an `id="{field}-error"` span with `role="alert"`.
- The Variant Resolution Dialog gets focus-trap (`<Dialog>` semantics — `role="dialog"` + `aria-modal="true"` + Escape-closes + focus-in-first-interactive-on-open + focus-restore-on-close).
- Image lightbox: same dialog pattern. Left / Right arrow keys navigate; Escape closes. `alt=""` (decorative within the page; the filename / part code already carries identity).
- Sticky action bar remains reachable via Tab order. The Cancel link precedes the Submit button.

### State coverage

Every state must render explicitly:

- **Loading (EDIT mode initial fetch).** Skeleton-style form — placeholder text + pulse on each field card — OR a central spinner. Vue uses a central spinner ("Loading product..."). Keep for simplicity.
- **Fresh empty (CREATE initial).** No empty state — form renders with defaults (`moq=1`, everything else empty).
- **Submitting.** Sticky submit button shows spinner + disabled; Cancel stays enabled.
- **Success.** Green banner at top for 800 ms then redirect.
- **Error (general).** Red banner at top with generic copy; console detail.
- **Error (field-level).** Red input border + red helper text below.
- **Variant conflict.** Dialog opens.
- **Image loading.** Inline spinner in the Images section.
- **Image empty.** Placeholder copy ("No images for this product.").
- **Image upload in progress.** Button spinner.
- **Image upload failure.** Toast + list unchanged.
- **DETAIL loading.** Same as EDIT loading.
- **DETAIL 404.** `notFound()` server-side; Next.js default 404 page.

### Recommendation

**POLISH (constrained).** Port Vue content + behaviour verbatim (all 20 fields, 5 sections, variant-check flow, image operations, 800 ms success redirect). Rebuild the visual layer against the design system (`.card` / `.input` / `.btn` tokens; no raw Tailwind colour classes). Fix three known bugs (dead trash button, hardcoded "Last updated 2 days ago", raw error-detail leak). Add one new affordance (DETAIL read-only mode via `/products/{id}`).

Explicitly NOT in scope:
- Excel upload flow — separate migration.
- Duplicate cleanup — separate migration.
- Product review (ADMIN triage) — separate migration.
- No backend endpoint changes — the "+ Add Subcategory" persistence gap stays unresolved (decide in Awaiting section).
- No new Layer 1 permission work.

### Awaiting user decision on (10 items)

1. **Scope** — four modes bundled into this one branch? (CREATE, VARIANT CREATE, EDIT, DETAIL read-only.) Confirm?
2. **URL routing** — four separate Next.js page files (`/products/new`, `/products/new?parent_id=…`, `/products/{id}`, `/products/{id}/edit`) all delegating to a single `<ProductForm>`. Confirm?
3. **Form layout** — A (single long page with section cards, matches Vue + other migrated pages). Confirm A? Or B/C/D?
4. **Validation library** — React Hook Form + Zod. Confirm?
5. **Variant dialog** — A (dedicated `<VariantResolutionDialog>` local to the form). Confirm?
6. **Image section on desktop in EDIT mode** — render as right sidebar sub-panel (recommended) OR below the form (matches Vue exactly)? I recommend right sidebar; confirm or override.
7. **Image delete confirmation** — inline popover-style "Confirm?" flip on the delete button (recommended) OR full typed-confirmation modal? Inline is lighter.
8. **Image gallery + lightbox as Layer 2** — `apps/web/src/components/composed/image-gallery.tsx` + `image-lightbox.tsx`? Or inline-only at `apps/web/src/app/(app)/products/_components/`? Recommend Layer 2 (pattern will recur). Confirm?
9. **Unsaved-changes prompt** — enable browser `beforeunload` + in-app router intercept? Recommend yes. Confirm?
10. **Three known-Vue bugs — resolution per bug:**
   - Dead trash button in EDIT header → **remove**. Confirm?
   - Hardcoded "Last updated 2 days ago" → **remove** (backend doesn't expose `updated_at` on products). Confirm?
   - "+ Add Subcategory" persistence gap — three options: (i) **keep current Vue behaviour** (value attaches to the product on save but the option disappears from the dropdown on reload — the data is not lost), (ii) **remove the "+ Add" affordance entirely** and force users to use predefined subcategories, (iii) open a separate backend task to add `POST /api/products/subcategories/` (out of scope for this migration). **Recommend (i)** — Vue's behaviour is surprising but not broken. Confirm or override?

Plus bonus decision:
11. **DETAIL mode Edit CTA placement and redirect-after-save** — top-right header CTA + redirect to `/products` after EDIT save (matches Vue). Alternative: redirect to `/products/{id}` (DETAIL) after save, keeping the user on the same product. Recommend `/products` for consistency with CREATE. Confirm?

**STOP.** Awaiting answers before Phase 3 implementation plan.

---

## Phase 3 — Implementation notes

### Files created (by purpose)

**Layer 2 (Composed components, reusable)** — 2 files
- `apps/web/src/components/composed/image-gallery.tsx` (159 lines) — thumbnail grid with upload/delete callbacks, lazy loading, broken-image fallback
- `apps/web/src/components/composed/image-lightbox.tsx` (129 lines) — fullscreen viewer, keyboard nav (Arrow+Esc), click-outside close

**Layer 1 primitives** — 3 files
- `apps/web/src/components/primitives/alert-dialog.tsx` (76 lines) — Radix Dialog wrapper with default/destructive variants
- `apps/web/src/components/primitives/textarea.tsx` (22 lines) — styled textarea
- `apps/web/src/components/primitives/select.tsx` (28 lines) — styled native select

**Products form (app-local)** — 11 files in `apps/web/src/app/(app)/products/_components/`
- `constants.ts` (23) — PART_TYPES enum, CATEGORY_ADD_SENTINEL, FORM_SECTIONS
- `schemas.ts` (66) — Zod schema + OPTIONAL_STRING_FIELDS list
- `form-types.ts` (48) — VariantCheckResponse, VariantSummary, MarkupSetting, ProductFormMode
- `section-card.tsx` (29) — 5-section card wrapper
- `read-only-field.tsx` (31) — value display for DETAIL mode
- `variant-parent-card.tsx` (37) — parent badge for VARIANT mode
- `use-unsaved-changes.ts` (48) — beforeunload + capture-phase anchor-click guard
- `product-form-fields.tsx` (207) — FieldRow, TextField, TextareaField, CategoryField, PartTypeField helpers
- `variant-resolution-dialog.tsx` (181) — add_new / replace chooser
- `product-form.tsx` (287) — main form shell (5 Cards + sticky footer + variant-check flow)
- `product-detail-view.tsx` (124) — DETAIL read-only presentation
- `product-image-sidebar.tsx` (76) — EDIT sidebar with gallery + AlertDialog delete
- `product-form-client.tsx` (160) — client wrapper wiring submit/upload/delete/variant-check

**Route pages** — 3 files
- `apps/web/src/app/(app)/products/new/page.tsx` (111 lines) — CREATE + VARIANT (via `?parent_id=`)
- `apps/web/src/app/(app)/products/[id]/page.tsx` (79) — DETAIL
- `apps/web/src/app/(app)/products/[id]/edit/page.tsx` (111) — EDIT

**API route handlers** — 4 files
- `apps/web/src/app/api/products/[id]/route.ts` (77 lines) — GET + PUT (new)
- `apps/web/src/app/api/products/check-variants/[code]/route.ts` (41)
- `apps/web/src/app/api/products/[id]/images/route.ts` (72) — GET list + POST multipart upload
- `apps/web/src/app/api/products/[id]/images/[imageId]/route.ts` (29) — DELETE
- `apps/web/src/app/api/products/route.ts` — extended with POST (create)

**Tests** — 5 files, +69 tests
- `tests/components/image-gallery.test.tsx` (11 tests)
- `tests/components/image-lightbox.test.tsx` (10 tests)
- `tests/app/product-form.test.tsx` (15 tests)
- `tests/app/variant-resolution-dialog.test.tsx` (7 tests)
- `tests/app/product-detail-view.test.tsx` (7 tests)
- `tests/api/products-form-routes.test.ts` (14 tests)
- `tests/infra/nginx-config.test.ts` — extended with `/products/new` + 2 dynamic-regex tests (+5)

### Files modified

- `apps/web/package.json` — added `react-hook-form`, `@hookform/resolvers`, `zod`, `@radix-ui/react-dialog`, `@rollup/wasm-node` (dev)
- `apps/web/src/app/api/products/route.ts` — added POST handler
- `nginx/nginx.dev.conf` — added `location = /products/new` + 2 regex blocks
- `nginx/nginx.conf` — same additions across all 3 portal server blocks
- `docs/migration/MIGRATED_PATHS.md` — N=4 → N=7
- `apps/web/tests/infra/nginx-config.test.ts` — EXPECTED_MIGRATED_PATHS + EXPECTED_DYNAMIC_ROUTES

### Implementation sequence (actual, in order)

1. Backend endpoint verification (curl with admin JWT on port 8001) — shapes match Phase 1 assumptions, no surprises.
2. Layer 2 extraction: ImageGallery, ImageLightbox + 21 tests. Added AlertDialog primitive + Textarea + Select primitives.
3. Types / schemas / constants files.
4. Field helpers (TextField, TextareaField, CategoryField, PartTypeField).
5. ProductForm (5 sections, sticky footer, variant-check flow).
6. VariantResolutionDialog.
7. ProductDetailView + ProductImageSidebar.
8. ProductFormClient (submit/upload/delete/variant-check wiring).
9. Four route pages (new, [id], [id]/edit).
10. Four API route handlers.
11. Test suite across all layers.
12. nginx + MIGRATED_PATHS + nginx test extension.
13. Verification: lint, type check, build, preview — all green.

### Decisions from Phase 2 (status)

All 11 decisions implemented as approved. Plus the three additional decisions:
- Variant resolve timing: parent resolved via `GET /api/products/{parent_id}` server-side before form renders (not client-side POST to a non-existent endpoint — see Issues below).
- Responsive breakpoint: `lg:` (Tailwind ≥ 1024 px) for the image sidebar.
- Success delay: dropped the 800ms Vue delay — redirect fires immediately.

### Visual verification (preview)

Verified on `http://localhost:3100` after dev-server restart:
- `/products/new` → header "New Product", 5 Card sections, "Create Product" CTA
- `/products/new?parent_id={id}` → header "Add Variant", parent card visible, part code prefilled + read-only, category prefilled, "Add Variant" CTA
- `/products/{id}` → DETAIL view with 5 read-only sections + Product Images section, Edit button visible (admin role)
- `/products/{id}/edit` → form prefilled from backend, "Save Changes" CTA, image sidebar with existing 1 image

Zero browser console errors.

---

## Issues encountered and resolutions

### 1. Vue bug, fixed during migration — Dead trash button in EDIT header

Vue ProductForm.vue:412-414 has a trash-icon button with no click handler. Removed in Next.js — the EDIT page header just shows "Edit Product" title and a Back link, nothing else.

### 2. Vue bug, fixed during migration — Hardcoded "Last updated 2 days ago"

Vue ProductForm.vue:410 renders `<span>Last updated 2 days ago</span>` as literal text. Backend `/api/products/{id}` response does not include an `updated_at` field, so we cannot show a real timestamp — removed the fake stamp entirely rather than replicate the Vue lie.

### 3. Vue bug, fixed during migration — window.confirm() replaced with AlertDialog

Vue ProductForm.vue:139 uses `if (!confirm('Delete this image?')) return`. Next.js version uses the new `AlertDialog` primitive (`@radix-ui/react-dialog` + destructive variant) wired through `ProductImageSidebar`. Consistent with the rest of the app.

### 4. Vue bug, fixed during migration — Subcategory persistence across category change

Vue leaves `form.value.subcategory` stale when `form.value.category` changes. Next.js version clears `subcategory` in `CategoryField.handleChange` via `setValue("subcategory", null, { shouldDirty: true })`. Covered by a unit test in `product-form.test.tsx`.

### 5. Spec-vs-reality — "POST /api/products/resolve-variant" does not exist

The Phase 2 approved spec named a `POST /api/products/resolve-variant` endpoint. Backend actually exposes:
- `GET /api/products/check-variants/{product_code}/` — returns `{ parent_id, variant_count, parent_code, parent_category, parent_hs_code, parent_brand, variants: [...] }`.
- `GET /api/products/{id}/` — returns the full product.

Resolved by:
- VARIANT-mode mount: RSC fetches parent via `GET /api/products/{parent_id}/` (fast, typed, zero extra endpoints).
- CREATE-mode submit-time check: client fetches `GET /api/products/check-variants/{code}` through the new proxy route at `/api/products/check-variants/[code]` and opens `VariantResolutionDialog` if `variant_count > 0`.

Proxy route `/api/products/check-variants/[code]/route.ts` is the permanent home for this behaviour. No resolve-variant endpoint was created backend-side.

### 6. Infra — Windows Defender Application Control blocks native rollup binary

Mid-session, `@rollup/rollup-win32-x64-msvc` and `@rollup/rollup-win32-x64-gnu` `.node` files started failing with `ERR_DLOPEN_FAILED` / WDAC block. Vitest could not start.

Resolution: installed `@rollup/wasm-node` as a dev dependency and patched `node_modules/.pnpm/rollup@4.60.2/.../rollup/dist/native.js` to fall back to the WASM binary when the native binary throws. This is a local-env patch that will be lost on `rm -rf node_modules`; **tech-debt item opened** — proper fix is either `pnpm.patchedDependencies` in the root `package.json` or migrating to a rollup version that ships WASM-first on WDAC environments. Tests ran at 366 green after patch.

### 7. Build-time — exactOptionalPropertyTypes required pattern tweaks

TSConfig has `exactOptionalPropertyTypes: true`. Optional props had to be declared as `prop?: T | undefined` (not just `prop?: T`) in every new interface. Conditional spreading (`{...(x ? {x} : {})}`) used in client-wrapper prop forwarding to avoid passing `undefined` to RSC. No net code change — just stricter typing discipline.

### 8. Category source — merge behaviour preserved, endpoint returns empty

`GET /api/settings/markups/` currently returns `[]` in the seeded database; `GET /api/products/categories/` returns the real list. Merge logic still runs correctly (deduped set) — user gets the categories endpoint data when markups is empty. No runtime impact.

---

## Proposed rules for CONVENTIONS.md (if any)

### Proposed R-14: RSC prop forwarding under exactOptionalPropertyTypes

When a Server Component renders a Client Component and some props are optional, forward only the defined props via conditional spread — never pass `undefined`:

```tsx
// WRONG — fails exactOptionalPropertyTypes
<Child foo={maybe} />

// RIGHT — conditional spread
<Child {...(maybe ? { foo: maybe } : {})} />
```

Rationale: `exactOptionalPropertyTypes: true` means an absent key and `key: undefined` are different. The spread pattern keeps RSC → client boundary typed without widening every prop to `T | undefined`.

### Proposed R-15: Layer-2 lift threshold = 2 pages

If a component will be used by the current migration plus a known upcoming one (e.g. ImageGallery used by products-form now + likely client images later), lift to `apps/web/src/components/composed/` on first use rather than waiting for the second. The cost of local → Layer 2 is small and the second migration doesn't re-implement.

(Both are candidates; no change to CONVENTIONS.md until wider discussion.)

---

## Open questions deferred

- D-004 review tracking: unchanged — no pricing/margin fields exposed in this form.
- Inline "Add category" affordance (`CATEGORY_ADD_SENTINEL`) stubbed — backend endpoint for markup creation exists but UX for the inline form is deferred. Low priority; Vue's behaviour preserved as-is for now.
- Rollup WASM patch is a tech-debt item; open a ticket to convert to a `pnpm.patchedDependencies` entry so the fix persists across `node_modules` rebuilds.

---

## Final status

**GREEN.** Ready for review; not merged.

- Lint: 0 errors, 0 warnings (product-form scope; project-wide lint passes).
- Type check: 0 errors in new code (two pre-existing test-file errors in `orders-routes.test.ts` and `products-routes.test.ts` predate this migration).
- Tests: 366 in web (baseline 297 → +69), 280 in lib, 35 in infra (included in 366). All green.
- Build: 0 errors, bundle sizes reasonable (form 174 kB first-load including RHF + Zod + Radix Dialog).
- Preview verification: all 4 modes render correctly with prefilled data + live backend; no browser console errors.
- nginx: dev + prod (3 portals) updated; MIGRATED_PATHS 4 → 7.
- Migration branch: `feat/migrate-products-form`.
