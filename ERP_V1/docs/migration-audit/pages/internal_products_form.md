# Internal Products Form (New / Edit / Add Variant)

**Type:** page (shared form — three modes)
**Portal:** internal (`user_type === 'INTERNAL'`)
**Routes (all three mount this component):**
- `/products/new` → `ProductNew` (meta.title: `'New Product'`, meta.parent: `'ProductList'`)
- `/products/new?parent_id=&product_code=` → same route, variant mode when `route.query.parent_id` present
- `/products/:id/edit` → `ProductEdit` (meta.title: `'Edit Product'`, meta.parent: `'ProductList'`, props: true)
**Vue file:** [frontend/src/views/products/ProductForm.vue](../../../frontend/src/views/products/ProductForm.vue)
**Line count:** 1156
**Migration wave:** Wave 4 (internal master data)
**Risk level:** low — G-011 CLOSED 2026-04-22 (Patch 10): inline `require_role(["ADMIN", "SUPER_ADMIN", "OPERATIONS"])` enforcement added to all product mutation endpoints

---

## Purpose

Shared product form used for creating a new product, editing an existing variant, and adding a new variant to an existing product code; detects its mode from route params and query string, shows an image management section in edit mode, and triggers a variant resolution dialog when creating under a code that already has variants.

---

## Layout

### Outer container
`max-w-3xl mx-auto p-4 md:p-6`

**Page header** (`flex items-center justify-between mb-6`)
- Left: back arrow link → `/products`; `h1` with mode-dependent title: "New Product" / "Edit Product" / "Add Variant for [CODE]"
- Right (edit mode only): product_code badge (font-mono teal-700); trash icon button (present in DOM but **no `@click` handler** — dead element)

**Form body** (`<form @submit.prevent="handleSubmit" class="space-y-6">`)

**Section 1 — Product Identity** (`bg-white rounded-xl shadow-sm p-6`)
Header: "Product Identity" + pi-tag icon

| Field | Label | Input | Notes |
|---|---|---|---|
| `product_code` | Part Code * | `<input type="text">` | Required. **Readonly in variant mode** (auto-filled from `route.query.product_code`). Triggers variant-check flow on new-mode submit. |
| `product_name` | Product Name * | `<input type="text">` | Required. Must be unique across all products (backend-enforced, 400 on conflict). |
| `product_name_chinese` | Chinese Name | `<input type="text">` | Optional. |
| `part_type` | Part Type | `<select>` | Optional. Options loaded from `productsApi.partTypes()` → `/api/products/part-types/`. |
| `dimension` | Dimension / Size | `<input type="text">` | Optional. |
| `material` | Material | `<input type="text">` | Optional. Typing may trigger autocomplete from `productsApi.materials()`. |
| `variant_note` | Variant Note | `<input type="text">` | Optional. Describes what distinguishes this variant. |

**Section 2 — Physical & Logistics** (`bg-white rounded-xl shadow-sm p-6`)
Header: "Physical & Logistics" + pi-box icon

| Field | Label | Input | Notes |
|---|---|---|---|
| `category` | Category | `<select>` | Optional. Options from `settingsApi.getMarkups()`; inline "+ Add Category" opens a sub-form that calls `settingsApi.createMarkup({ name, markup_percent })` — creates a real markup entry in settings. |
| `subcategory` | Subcategory | `<select>` | Optional. Options from `subcategoriesList` (loaded via `productsApi.subcategories()`). Inline "+ Add Subcategory" only sets local state — **not persisted to any API**. |
| `moq` | MOQ * | `<input type="number" min="1">` | Required. Default: `1`. Validated: must be ≥ 1. |
| `unit_weight_kg` | Weight (kg) | `<input type="number" step="0.01" min="0">` | Optional. Validated: ≥ 0. "kg" suffix. |
| `unit_cbm` | Volume (CBM) | `<input type="number" step="0.0001" min="0">` | Optional. Validated: ≥ 0. "m³" suffix. |
| `standard_packing` | Standard Packing | `<input type="text">` | Optional. Placeholder: "e.g. Carton box, Wooden crate". |

**Section 3 — Trade & Customs** (`bg-white rounded-xl shadow-sm p-6`)
Header: "Trade & Customs" + pi-globe icon

| Field | Label | Input | Notes |
|---|---|---|---|
| `hs_code` | HS Code | `<input type="text">` | Optional. font-mono. Placeholder: "e.g. 8433.90.00". |
| `hs_code_description` | HS Code Description | `<input type="text">` | Optional. |
| `factory_part_number` | Factory Part Number | `<input type="text">` | Optional. The factory's own catalog part number. |
| `brand` | Brand | `<input type="text">` | Optional. |
| `oem_reference` | OEM Reference | `<input type="text">` | Optional. |
| `compatibility` | Compatibility | `<input type="text">` | Optional. |

**Section 4 — Notes** (`bg-white rounded-xl shadow-sm p-6`)
Header: "Notes" + pi-align-left icon
- `notes`: `<textarea rows="3">` — Optional. "Additional notes about this product..."

**Section 5 — Product Images** (`v-if="isEdit"` — edit mode only)
- Header: "Product Images" + image count if images present + "Upload New" file input (accept="image/*") → `onImageUpload()`
- Loading: spinner + "Loading images..."
- Empty: pi-image icon + "No images for this product" + "Images are extracted from Factory Excel uploads"
- Image grid (responsive 2–5 columns): per image — thumbnail 112px height, hover overlay shows pi-search-plus (view) + pi-trash (delete)
- Image metadata below each thumbnail: `{width}x{height} · {sizeKB}KB`
- Click image → opens lightbox (`viewingImage = img`)
- Delete button → `deleteImage(img.id)` → `DELETE /api/products/{id}/images/{imageId}/`

**Image Lightbox** (`v-if="viewingImage"` — full-screen overlay):
- Full-size `img` with max-w-4xl
- Close button (top-right)
- Left/right arrows if `productImages.length > 1` → `navigateImage(±1)`
- Info bar: `{width}x{height} · {sizeKB}KB · {source_type}`

**Sticky Action Bar** (sticks to bottom, `z-10`)
- "Cancel" link → `/products`
- "Create Product" / "Save Changes" button → `handleSubmit()` (loading state with pi-spin)

---

### Variant Resolution Dialog (`v-if="showVariantDialog"` — full-screen overlay)

Shown in new mode only, when `productsApi.checkVariants(product_code)` returns existing variants.

- **Header** (amber background): "Existing Variants Found" — shows product_code and existing variant count
- **Collapsible variant list** (toggle button): per existing variant shows material, dimension, part_type, category, brand, hs_code, variant_note, is_default badge
- **Action selection:**
  - Radio: "Add as New Variant" (default, emerald highlight) — creates additional child
  - Radio: "Replace Existing Variant" (amber highlight) — shows select dropdown of existing variants
- **Footer:** Cancel (`cancelVariantDialog()`) / Add Variant or Replace Variant button → `confirmVariantDialog()`

---

## Data displayed

In edit mode, the form is pre-filled from the existing product record loaded via `productsApi.get(route.params.id)`. In variant mode, `product_code` is pre-filled from `route.query.product_code`.

No pricing fields (`factory_price`, `selling_price`, `*_cny`, `markup_*`) appear in the form or in `ProductOut` — P-007 checklist clean.

---

## Interactions

| Trigger | Action | API call | Result |
|---|---|---|---|
| Page mount (edit) | `loadProduct(id)` | `GET /api/products/{id}/` | Pre-fills form |
| Page mount (edit) | `loadImages(id)` | `GET /api/products/{id}/images/` | Populates image grid |
| Page mount (any) | `loadDropdowns()` | `GET /api/products/part-types/`, `GET /api/products/materials/`, `GET /api/settings/markups/`, `GET /api/products/subcategories/` | Populates selects |
| "Submit" / "Save Changes" (new, non-variant) | `handleSubmit()` → check variants | `GET /api/products/check-variants/{code}/` | If variants exist → show dialog; if none → create |
| "Submit" (new, no conflict) | `productsApi.create(payload)` | `POST /api/products/` | Creates parent + child; redirects to `/products` after 800ms |
| "Submit" (variant mode) | `productsApi.create(payload)` | `POST /api/products/` | Skips variant check; creates child under parent |
| "Submit" (edit) | `productsApi.update(id, payload)` | `PUT /api/products/{id}/` | Updates variant; redirects to `/products` after 800ms |
| Variant dialog — Add Variant | `confirmVariantDialog()` | `POST /api/products/` | `replace_variant_id` absent → creates new child |
| Variant dialog — Replace | `confirmVariantDialog()` | `POST /api/products/` | Includes `replace_variant_id` → backend updates existing |
| "+ Add Category" select | `showAddCategory = true` | none | Expands inline sub-form |
| "+ Add Category" confirm | `handleAddCategory()` | `POST /api/settings/markups/` (`{name, markup_percent}`) | Creates markup entry; refreshes categories |
| "+ Add Subcategory" select | `showAddSubcategory = true` | none | Expands inline sub-form |
| "+ Add Subcategory" confirm | `confirmNewSubcategory()` | **none** — local only | Appends to `subcategoriesList` only; **not persisted to backend** |
| Image upload | `onImageUpload(event)` | `POST /api/products/{id}/images/upload/` (multipart) | Adds image to grid |
| Image delete | `deleteImage(imgId)` | `DELETE /api/products/{id}/images/{imgId}/` | Removes from grid |
| Image click | `viewingImage = img` | none | Opens lightbox |
| Lightbox arrows | `navigateImage(±1)` | none | Cycles through productImages |
| Cancel link | navigate | none | `/products` |
| Trash icon (header, edit) | **none — dead element** | none | No `@click` handler |

---

## Modals/dialogs triggered

| Modal | Trigger | Purpose |
|---|---|---|
| Variant Resolution Dialog | `checkVariants()` returns existing variants during new-mode submit | User chooses to add new variant or replace existing |
| Image Lightbox | Click image thumbnail | Full-size image view with navigation |

---

## API endpoints consumed

| Method | Path | Via | Mode | Notes |
|---|---|---|---|---|
| GET | `/api/products/{id}/` | `productsApi.get(id)` | Edit | Pre-fills form |
| GET | `/api/products/{id}/images/` | `productsApi.getImages(id)` | Edit | Image grid |
| GET | `/api/products/check-variants/{code}/` | `productsApi.checkVariants(code)` | New | Checks for existing variants before create |
| GET | `/api/products/part-types/` | `productsApi.partTypes()` | All | Part Type dropdown |
| GET | `/api/products/materials/` | `productsApi.materials()` | All | Material autocomplete |
| GET | `/api/products/subcategories/` | `productsApi.subcategories()` | All | Subcategory dropdown |
| GET | `/api/settings/markups/` | `settingsApi.getMarkups()` | All | Category dropdown |
| POST | `/api/products/` | `productsApi.create(payload)` | New / Variant | G-011 CLOSED (Patch 10). `replace_variant_id` in payload triggers replace mode. |
| PUT | `/api/products/{id}/` | `productsApi.update(id, payload)` | Edit | G-011 CLOSED (Patch 10) |
| POST | `/api/settings/markups/` | `settingsApi.createMarkup(data)` | New category | Creates markup entry; **no role check on settings mutations** |
| POST | `/api/products/{id}/images/upload/` | `productsApi.uploadImage(id, file)` | Edit | Multipart; validates extension + size (10 MB max); deduplicates by hash |
| DELETE | `/api/products/{id}/images/{imageId}/` | `productsApi.deleteImage(id, imgId)` | Edit | G-011 CLOSED (Patch 10) |

> Per D-001 (Option B): in Next.js these become `client.products.*` and `client.settings.*` via the generated SDK.

---

## Composables consumed

None. Uses `useRoute()` and `useRouter()` inline.

---

## PrimeVue components consumed

None — hand-rolled Tailwind + PrimeIcons (`pi-arrow-left`, `pi-tag`, `pi-box`, `pi-globe`, `pi-align-left`, `pi-upload`, `pi-image`, `pi-spin pi-spinner`, `pi-trash`, `pi-search-plus`, `pi-times`, `pi-chevron-left`, `pi-chevron-right`, `pi-save`, `pi-check`, `pi-exclamation-triangle`).

---

## Local state

| Name | Type | Initial | Purpose |
|---|---|---|---|
| `form` | `ref({...})` | All-empty (see field table) | Bound to all 19 form fields |
| `isEdit` | `computed` | — | `Boolean(route.params.id)` |
| `isVariant` | `computed` | — | `Boolean(route.query.parent_id && !route.params.id)` |
| `errors` | `ref({})` | `{}` | Field-level validation errors (keys: `product_code`, `product_name`, `moq`, `unit_weight_kg`, `unit_cbm`, `general`) |
| `saving` | `ref(false)` | `false` | Submit button loading state |
| `loading` | `ref(false)` | `false` | Page-level loading while fetching product |
| `productImages` | `ref([])` | `[]` | Image list (edit mode) |
| `loadingImages` | `ref(false)` | `false` | Image section loading |
| `viewingImage` | `ref(null)` | `null` | Currently open lightbox image |
| `brokenImages` | `ref({})` | `{}` | Maps img.id → true on load failure |
| `showAddCategory` | `ref(false)` | `false` | Inline Add Category sub-form |
| `newCategoryName` | `ref('')` | `''` | Category name input |
| `newCategoryMarkup` | `ref(0)` | `0` | Markup percent for new category |
| `addingCategory` | `ref(false)` | `false` | Add Category loading state |
| `showAddSubcategory` | `ref(false)` | `false` | Inline Add Subcategory sub-form |
| `newSubcategoryName` | `ref('')` | `''` | Subcategory name input |
| `subcategoriesList` | `ref([])` | `[]` | Loaded from `productsApi.subcategories()` |
| `showVariantDialog` | `ref(false)` | `false` | Variant resolution dialog |
| `existingVariants` | `ref([])` | `[]` | Variants returned by `checkVariants()` |
| `variantAction` | `ref('add_new')` | `'add_new'` | `'add_new'` \| `'replace'` |
| `replaceVariantId` | `ref(null)` | `null` | Target variant id for replace mode |
| `pendingPayload` | `ref(null)` | `null` | Holds form payload while variant dialog is open |
| `variantListExpanded` | `ref(false)` | `false` | Collapsible existing variants list in dialog |

**`form` ref — all 19 fields with initial values:**
```
product_code: '', product_name: '', product_name_chinese: '',
part_type: '', dimension: '', material: '', variant_note: '',
category: '', subcategory: '',
unit_weight_kg: null, unit_cbm: null, standard_packing: '',
moq: 1,
hs_code: '', hs_code_description: '', factory_part_number: '',
brand: '', oem_reference: '', compatibility: '',
notes: ''
```

---

## Permissions / role gating

- Routes `/products/new` and `/products/:id/edit` have **no `meta.roles`** — all INTERNAL users reach these pages.
- `router.beforeEach` blocks CLIENT/FACTORY users from the internal portal.
- **Backend: G-011 CLOSED (Patch 10, 2026-04-22).** `POST /api/products/` and `PUT /api/products/{id}/` now enforce `require_role(["ADMIN", "SUPER_ADMIN", "OPERATIONS"])`. CLIENT and FACTORY tokens are rejected with HTTP 403.
- **Frontend validation only.** `product_code` required, `product_name` required, `moq ≥ 1`, `unit_weight_kg ≥ 0`, `unit_cbm ≥ 0` are checked client-side before submission. The backend has separate uniqueness enforcement (HTTP 400 on duplicate `product_name`; HTTP 409 on duplicate `product_code` during approve flow) but no equivalent field-level input validation on the generic create/update endpoints — a malformed payload is accepted as-is.

---

## Bilingual labels (`InternalString`)

All strings are English-only. No i18n infrastructure.

| Key | en | ta | Type |
|---|---|---|---|
| `internal.product_form.title_new` | "New Product" | "" | `InternalString` |
| `internal.product_form.title_edit` | "Edit Product" | "" | `InternalString` |
| `internal.product_form.title_variant` | "Add Variant for [CODE]" | "" | `InternalString` |
| `internal.product_form.section_identity` | "Product Identity" | "" | `InternalString` |
| `internal.product_form.section_logistics` | "Physical & Logistics" | "" | `InternalString` |
| `internal.product_form.section_trade` | "Trade & Customs" | "" | `InternalString` |
| `internal.product_form.section_notes` | "Notes" | "" | `InternalString` |
| `internal.product_form.section_images` | "Product Images" | "" | `InternalString` |
| `internal.product_form.btn_cancel` | "Cancel" | "" | `InternalString` |
| `internal.product_form.btn_create` | "Create Product" | "" | `InternalString` |
| `internal.product_form.btn_save` | "Save Changes" | "" | `InternalString` |
| `internal.product_form.variant_dialog_title` | "Existing Variants Found" | "" | `InternalString` |

[D-005: Tamil translations required before Wave 4 is migration-ready — `ta` may remain `""` for internal pages per D-005.]

---

## Empty / error / loading states

| State | Trigger | Rendered to user? | Notes |
|---|---|---|---|
| Form loading (edit) | `loading === true` | Yes — full-page spinner or skeleton [UNCLEAR exact loading UI] | While fetching product |
| Image loading | `loadingImages === true` | Yes — "Loading images..." spinner in image section | |
| Image empty | `productImages.length === 0 && !loadingImages` | Yes — "No images for this product" | |
| Field validation error | `errors.product_code` / `errors.product_name` / etc. | Yes — `text-xs text-red-500` below field; field border turns `border-red-300 bg-red-50` | Client-side only |
| General submit error | `errors.general = e.response?.data?.detail \|\| 'Failed to save product'` | **P-002 (raw backend error):** rendered as red text near submit button | Raw `e.response.data.detail` shown directly |
| Save in progress | `saving === true` | Yes — spinner + disabled button | |
| Image upload error | [UNCLEAR — not directly observed] | [UNCLEAR] | |

---

## Business rules

1. **Mode detection.** `isEdit = Boolean(route.params.id)`. `isVariant = Boolean(route.query.parent_id && !route.params.id)`. New mode: neither. All three mount the same component.
2. **Variant check gating.** In new mode only, submission first calls `GET /api/products/check-variants/{code}/`. If `variant_count > 0`, the variant dialog is shown and the submit payload is held in `pendingPayload`. Submission resumes only after dialog confirmation.
3. **Replace vs add-new via single endpoint.** Both "add new variant" and "replace existing variant" call `POST /api/products/`. The `replace_variant_id` field in the payload tells the backend to update the existing record instead of inserting. No separate PUT endpoint for this flow.
4. **Auto-parent creation.** `POST /api/products/` auto-creates a parent product (`product_name: "[CODE]"`) if no parent for that `product_code` exists yet. The caller doesn't need to pre-create the parent.
5. **Category vs subcategory persistence gap.** Adding a new category calls `POST /api/settings/markups/` and persists it as a settings entry. Adding a new subcategory only updates the local `subcategoriesList` ref — on page reload the subcategory option is gone unless it was already on an existing product.
6. **Image upload is edit-mode only.** The image section (`v-if="isEdit"`) is hidden in new and variant modes. Images can only be attached after a product has been created and saved.
7. **`onImageUpload()` triggered via hidden file input.** The "Upload New" label wraps a `<input type="file" class="hidden">` — the visible element is a styled label that triggers the hidden input.
8. **800ms success delay before redirect.** After a successful create/update, the success state is shown for 800ms before `router.push('/products')`. This provides brief user feedback.
9. **`product_name` uniqueness is global.** The backend enforces `product_name` uniqueness across all products (not just within a code group). Two variants of the same code cannot share a product_name.

---

## Known quirks

- **Dead trash button in edit header.** The trash icon button in the edit mode page header has no `@click` handler. It renders but does nothing. Intent was likely to delete the product from the form, but was never implemented.
- **Subcategory not persisted.** "+ Add Subcategory" creates a local option that disappears on page reload. A user who adds a subcategory, saves the product, then re-opens the form will see the subcategory value but may not find it in the dropdown.
- **`errors.general` leaks raw backend detail (P-002).** On create/update failure, `e.response?.data?.detail` is rendered directly to the user. For uniqueness errors this shows raw messages like "Product name already exists" which is acceptable, but for unexpected backend errors it may expose implementation details.
- **Frontend-only input validation.** The backend generic `POST /api/products/` does not validate field contents beyond uniqueness. There's no backend enforcement of `moq ≥ 1`, `unit_weight_kg ≥ 0`, etc. — these guards exist only in the frontend `errors` object.
- **`factory_part_number` is not hidden from CLIENT callers.** This field is a product identifier (factory catalog number), not a pricing field, so it is intentionally not in `CLIENT_HIDDEN_FIELDS`. Verify this is the intended policy before migration.

---

## Dead code / unused state

- Trash button in edit-mode header: rendered with `v-if="isEdit"` but has no `@click` handler. Remove or implement.

---

## Duplicate or inline utilities

None observed. Dropdown options loaded from dedicated API endpoints rather than hardcoded lists.

---

## Migration notes

1. **Three routes, one component → three distinct pages.** In Next.js: `app/products/new/page.tsx`, `app/products/[id]/edit/page.tsx`, `app/products/new/variant/page.tsx` (or handle variant mode via query param). Share a `<ProductFormFields>` component for the field sections.
2. **Form library.** Use React Hook Form + Zod schema to handle validation. Port the 5 client-side validation rules to a Zod schema; derive types from it.
3. **Resolve subcategory persistence.** Either: (a) add a backend `POST /api/products/subcategories/` endpoint to persist new subcategories, or (b) drop the inline-add and require subcategories to be pre-created in settings.
4. **Image upload: Next.js route handler.** `POST /api/products/{id}/images/upload/` accepts multipart. Wire to a Next.js server action or route handler that forwards to the backend.
5. **Variant dialog: replace with server-validated form.** The variant resolution dialog is a multi-step UX concern. In Next.js, consider a two-step URL flow: `/products/new` → check → `/products/new?code=ABC&action=variant` to make it deeplink-able.
6. **Remove dead trash button.** Decide: implement delete-from-form or remove the element.
7. **Fix subcategory gap before migration.** The current state is data-loss-prone: users believe they set a subcategory, but it is silently dropped on reload.
8. **Backend role enforcement: G-011 CLOSED (Patch 10, 2026-04-22).** `POST /api/products/` and `PUT /api/products/{id}/` now enforce `require_role(["ADMIN", "SUPER_ADMIN", "OPERATIONS"])` — no action required before migration.
9. **D-001:** `productsApi.*` → `client.products.*` via generated SDK.
10. **D-005:** All `InternalString` entries; Tamil can remain `""`.
