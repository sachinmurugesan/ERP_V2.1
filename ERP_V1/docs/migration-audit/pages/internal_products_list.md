# Internal Products List

**Type:** page (two-view: Products + Bin)
**Portal:** internal (`user_type === 'INTERNAL'`)
**Route:** `/products` → `ProductList` (meta.title: `'Products'`, meta.icon: `'pi-box'`)
**Vue file:** [frontend/src/views/products/ProductList.vue](../../../frontend/src/views/products/ProductList.vue)
**Line count:** 1948
**Migration wave:** Wave 4 (internal master data)
**Risk level:** low — G-011 CLOSED 2026-04-22 (Patch 10): inline `require_role(["ADMIN", "SUPER_ADMIN", "OPERATIONS"])` enforcement added to all product mutation endpoints

---

## Purpose

Full product catalog management page with a grouped accordion table (Products view) and a soft-delete archive (Bin view), supporting server-side search/sort/pagination, cross-page bulk edit/delete, variant expansion, default variant assignment, and a duplicate cleanup utility.

---

## Layout

### Outer container
Rendered inside the internal `InternalLayout`'s `<router-view />` slot.

**Zone 1 — Page header**
- `h1` "Products"
- Right-side button row:
  - "Import Excel" → navigates to `/products/upload-excel`
  - "Clean Duplicates" → opens Duplicate Cleanup Modal (`showDuplicateCleanup = true`)
  - "+ Add Product" → navigates to `/products/new`

**Zone 2 — Tab switcher**
- Two tabs: "Products" (with total count badge) | "Bin" (with binTotal count badge)
- `viewMode` ref controls which template block renders

---

### Products view (`viewMode === 'products'`)

**Zone 3 — Bulk action bar** (visible when `selectedCount > 0`)
- Count badge showing selected count
- 5 inline bulk-edit fields: Category (select), Material (text), HSN Code (text), Type (select), Brand (text) — each field applies immediately on change via `bulkUpdate()`
- "Delete Selected" button → `showBulkDeleteConfirm = true`

**Zone 4 — Filters panel** (`bg-white rounded-xl shadow-sm p-4 mb-4`)
- Search input with icon — 400ms debounce → `loadProducts()`
- Category dropdown — populated from `settingsApi.getMarkups()` → `loadProducts()`
- Per-page selector (options: 25/50/100) — `loadProducts()`

**Zone 5 — Accordion table** (`bg-white rounded-xl shadow-sm overflow-hidden`)

**Loading state:** centred spinner + "Loading..."

**Empty state:** pi-box icon + "No products found" + "+ Add your first product" link to `/products/new`

**Table header row** (`bg-slate-50 border-b`):
| Col | Label | Sortable | Sort key |
|---|---|---|---|
| 1 | *(checkbox — select all pages)* | — | — |
| 2 | *(expand toggle)* | — | — |
| 3 | Img | — | — |
| 4 | Part Code | ✓ | `product_code` |
| 5 | Product Name | ✓ | `product_name` |
| 6 | Material | — | — |
| 7 | Size | — | — |
| 8 | Variants | ✓ | `variants` |
| 9 | Category | ✓ | `category` |
| 10 | Brand | — | — |
| 11 | HS Code | ✓ | `hs_code` |
| 12 | Actions | — | — |

Sort: 3-click cycle per column (asc → desc → none). Active column header turns `text-emerald-700`; icon opacity 1.0 vs 0.3 for inactive columns.

**Table body — single-variant group** (flat row, no expand control):
- Row click → navigate to `/products/{group.variants[0].id}/edit`
- Columns: checkbox, (empty expand cell), thumbnail (40×40 rounded), `product_code` (font-mono teal-700), `groupDisplayName(group)` (first variant's name), `variants[0].material` (orange-50 badge or `—`), `variants[0].dimension` (blue-50 badge or `—`), `—` (variants count not shown for single-variant), `variants[0].category` (blue-50 rounded-full badge), `variants[0].brand` (violet-50 badge), `variants[0].hs_code` (font-mono)
- Actions: "+ Variant" link to `/products/new?parent_id=...&product_code=...`, edit icon button to `/products/{id}/edit`

**Table body — multi-variant parent row:**
- Row click → `toggleExpand(product_code)` — chevron right/down
- Columns: checkbox, chevron, thumbnail (groupThumbnail — first variant's image), `product_code` (font-mono teal-700), `groupDisplayName(group)`, `groupMaterials(group)` (aggregated unique material tags), `groupDimensions(group)` (aggregated unique dimension tags), `group.variants.length` (teal-100 badge), `groupCategory(group)` (first variant's category), `group.variants[0].brand`, `groupHsCode(group)`
- Actions: same as single-variant ("+Variant" link, edit pencil)

**Table body — child variant rows** (shown when parent is expanded):
- Row background: `bg-slate-50/70`
- Columns: (empty checkbox cell), tree connector (└─ for last, ├─ for others in font-mono slate-300), variant thumbnail (32×32) with amber star overlay if `is_default`, `shortId(variant.id)` (font-mono 10px slate-400), `variant.product_name` (link to edit), `variant.material` badge, `variant.dimension` badge, `variant.part_type` (violet-50 badge), `variant.category` (text-[10px]), `variant.brand` badge, `variant.hs_code` (font-mono)
- Actions: Set Default star button (hidden if already default), edit pencil → `/products/{id}/edit`, delete trash → `confirmDelete(variant)`

**Zone 6 — Pagination** (shown when `totalPages > 1`)
- "Showing X–Y of Z" count
- Smart page buttons: first page, last page, current±1, ellipsis at ±2 gaps
- Previous / Next chevron buttons (disabled at boundaries)
- Changing page calls `loadProducts()`

**Modals:**

**Single Delete Confirmation Modal** (`showDeleteConfirm`):
- Shows `deleteTarget.product_code — deleteTarget.product_name`
- Cancel / Delete buttons → `executeDelete()` → `productsApi.bulkDelete([variantId])`

**Bulk Delete Confirmation Modal** (`showBulkDeleteConfirm`):
- "This will permanently delete … and all their associated images."
- Red warning box: "N products and all images will be removed from the database and disk."
- Cancel / "Delete N Products" buttons (loading spinner) → `executeBulkDelete()`

---

### Bin view (`viewMode === 'bin'`)

**Zone 7 — Bin action bar** (visible when `binSelectedCount > 0`)
- Count badge, selected count label
- "Clear" → `binSelectedIds = new Set()`
- "Restore" → `executeBinRestore()` (loading state)
- "Permanently Delete" → `confirmBinPermanentDelete()`

**Zone 8 — Bin search**
- Search input with icon — 400ms debounce → `loadBinProducts()`

**Zone 9 — Bin table** (`bg-white rounded-xl shadow-sm`)
- Loading state: red spinner + "Loading archived products..."
- Empty state: pi-trash icon + "Bin is empty"
- Header: `bg-red-50` — columns: Select, Part Code, Product Name, Material, Category, Brand (no Actions column)
- Rows: checkbox selection, `product.product_code`, `product.product_name`, `product.material`, `product.category` (blue-50 badge), `product.brand` (violet-50 badge)

**Bin pagination** (simple — prev/next + "Page X of Y" only; no smart page buttons)

**Bin Permanent Delete Confirmation Modal** (`showBinPermanentDeleteConfirm`):
- "Permanently delete N archived products and all their images. This cannot be undone."
- Cancel / "Permanently Delete" → `executeBinPermanentDelete()`

---

### Duplicate Cleanup Modal (`showDuplicateCleanup` — full-screen overlay)

Three sections in a scrollable panel:

**Section 1 — Duplicate Images**
- Description: "Removes identical images within the same product (same file content). Keeps one copy of each unique image."
- Result block (shown after run): "Removed N duplicate images from N products."
- "Remove Duplicate Images" button → `cleanDuplicateImages()` → POST `/api/products/remove-duplicate-images/`

**Section 2 — Duplicate Products**
- Description: "Products with the same Part Code. Review and manually merge or delete extras."
- Scan triggered on modal open → GET `/api/products/find-duplicates/`
- If no duplicates: green "No duplicate products found!" banner
- If duplicates: amber "N duplicate groups (N extra products)" banner, then per-group list showing product_code, count, individual entries (product_name, image count, "In Orders" tag, "Keep" tag for index 0), "View →" link to `/products/{id}/edit`

**Section 3 — Delete All Product Images**
- Warning: "Removes all images from every product."
- Two-step confirmation: first click shows red confirm block; second click executes `deleteAllProductImages()`
- Progress text shown during delete
- Result block: "Deleted N images from N products."
- [UNCLEAR — endpoint called by `deleteAllProductImages()` not confirmed; not found in products.py read]

---

## Data displayed

| Field | Source | Format | Notes |
|---|---|---|---|
| `product_code` | `ordersApi.list(group:true)` → `group.parent.product_code` | font-mono teal-700 | Shared across all variants in group |
| Display name | `groupDisplayName(group)` | text | Returns first variant's `product_name`; parent.product_name is auto-generated `[CODE]` |
| Materials | `groupMaterials(group)` | orange-50 tags | Aggregated unique values across all variants |
| Dimensions | `groupDimensions(group)` | blue-50 tags | Aggregated unique values across all variants |
| Variant count | `group.variants.length` | teal-100 badge | Only shown for multi-variant groups |
| Category | `groupCategory(group)` | blue-50 rounded-full | First variant's category |
| Brand | `group.variants[0].brand` | violet-50 badge | Only first variant's brand shown on parent row |
| HS Code | `groupHsCode(group)` | font-mono | Resolved from first variant |
| Thumbnail | `groupThumbnail(group)` | 40×40 `object-cover` | Bubbles up from first child with an image |
| Child: variant ID | `shortId(variant.id)` | font-mono 10px | Short UUID prefix |
| Child: default star | `variant.is_default` | amber `pi-star-fill` overlay | Shown on child thumbnail; star button on others |
| Child: part_type | `variant.part_type` | violet-50 badge | Only visible in expanded child row |
| Bin: product_code | `product.product_code` | font-mono | Flat list; no grouping in bin |
| Bin: category | `product.category` | blue-50 badge | |
| Pricing fields | — | — | No pricing data (`factory_price`, `*_cny`, `markup_*`) in ProductOut — confirmed P-007 checklist clean |

---

## Interactions

| Trigger | Action | API call | Result |
|---|---|---|---|
| Page mount | `loadProducts()` | `GET /api/products/?group=true&...` | Populates `groups` |
| Page mount | `loadCategories()` | `GET /api/settings/markups/` | Populates category dropdown |
| Search input (400ms debounce) | `loadProducts()` | `GET /api/products/?search=...` | Filters results |
| Category dropdown change | `loadProducts()` | `GET /api/products/?category=...` | Filters results |
| Per-page change | `loadProducts()` | new `per_page` param | Re-fetches |
| Sort column click | `toggleSort(field)` | includes `sort_by`, `sort_dir` | 3-click cycle |
| Select All checkbox | `toggleSelectAll()` | `GET /api/products/?...` (all codes) | `selectingAll` spinner; sets `selectedParentIds` to all codes on all pages |
| Parent row click (single-variant) | `router.push('/products/{id}/edit')` | none | Navigate |
| Parent row click (multi-variant) | `toggleExpand(code)` | none | Expand/collapse child rows |
| "+Variant" link | navigate | none | `/products/new?parent_id=...&product_code=...` |
| Edit pencil | navigate | none | `/products/{id}/edit` |
| Set Default star (child) | `setDefault(id)` | `POST /api/products/{id}/set-default/` | Reloads; star moves to new default |
| Delete trash (child) | `confirmDelete(variant)` | none | Opens single delete modal |
| Single delete confirm | `executeDelete()` | `POST /api/products/bulk-delete/` | Soft-deletes; reload |
| Bulk Delete button | `showBulkDeleteConfirm = true` | none | Opens bulk delete modal |
| Bulk Delete confirm | `executeBulkDelete()` | `POST /api/products/bulk-delete/` | Soft-deletes all selected; clears selection; reload |
| Bulk field change | `bulkUpdate()` | `POST /api/products/bulk-update/` | Updates field across selected; uses `product_codes` if cross-page |
| Tab → Bin | `viewMode = 'bin'`; `loadBinProducts()` | `GET /api/products/bin/` | Populates `binProducts` |
| Bin search (400ms debounce) | `loadBinProducts()` | `GET /api/products/bin/?search=...` | Filters bin |
| Bin checkbox select all | `toggleBinSelectAll()` | none | Selects all on current bin page |
| Bin Restore button | `executeBinRestore()` | `POST /api/products/bin/restore/` | Restores; reloads |
| Bin Perm. Delete button | `confirmBinPermanentDelete()` | none | Opens bin perm. delete modal |
| Bin Perm. Delete confirm | `executeBinPermanentDelete()` | `POST /api/products/bin/permanent-delete/` | Hard deletes + images |
| "Clean Duplicates" | `showDuplicateCleanup = true`; `loadDuplicateData()` | `GET /api/products/find-duplicates/` | Populates dup modal |
| Remove Dup Images | `cleanDuplicateImages()` | `POST /api/products/remove-duplicate-images/` | Returns count |
| Delete All Images | `deleteAllProductImages()` | [UNCLEAR endpoint] | Two-step confirm; deletes all images |
| "Import Excel" button | navigate | none | `/products/upload-excel` |
| "+ Add Product" button | navigate | none | `/products/new` |

---

## Modals/dialogs triggered

| Modal | Trigger | Purpose |
|---|---|---|
| Single Delete Confirm | Delete trash icon on child variant row | Confirm soft-delete of one variant |
| Bulk Delete Confirm | Bulk action bar "Delete Selected" | Confirm soft-delete of all selected |
| Bin Permanent Delete Confirm | Bin action bar "Permanently Delete" | Confirm hard-delete from bin |
| Duplicate Cleanup | "Clean Duplicates" header button | Image dedup, product dedup, delete-all-images utility |

---

## API endpoints consumed

| Method | Path | Via | Params | Notes |
|---|---|---|---|---|
| GET | `/api/products/` | `productsApi.list()` | `group=true`, `page`, `per_page`, `search`, `category`, `sort_by`, `sort_dir` | Returns grouped `{items:[{parent,variants}], total}` |
| GET | `/api/settings/markups/` | `settingsApi.getMarkups()` | — | Category dropdown; categories are stored in markups/settings table |
| POST | `/api/products/bulk-delete/` | `productsApi.bulkDelete(ids)` | `{product_ids: [...]}` | Soft-delete (moves to bin); G-011 CLOSED (Patch 10) |
| POST | `/api/products/bulk-update/` | `productsApi.bulkUpdate(ids/codes, fields)` | `{product_ids:[...]}` or `{product_codes:[...]}` + field values | Cross-page uses `product_codes`; G-011 CLOSED (Patch 10) |
| GET | `/api/products/bin/` | `productsApi.listBin()` | `page`, `per_page`, `search` | Returns flat archived products |
| POST | `/api/products/bin/permanent-delete/` | `productsApi.permanentDelete(ids)` | `{product_ids: [...]}` | Hard-delete + disk images; G-011 CLOSED (Patch 10) |
| POST | `/api/products/bin/restore/` | `productsApi.restoreFromBin(ids)` | `{product_ids: [...]}` | Restores to active catalog; G-011 CLOSED (Patch 10) |
| POST | `/api/products/{id}/set-default/` | `productsApi.setDefault(id)` | — | Sets is_default on variant; G-011 CLOSED (Patch 10) |
| GET | `/api/products/find-duplicates/` | `productsApi.findDuplicates()` | — | Scan for duplicate product_codes |
| POST | `/api/products/remove-duplicate-images/` | `productsApi.removeDuplicateImages()` | — | Hash-based dedup; G-011 CLOSED (Patch 10) |
| [UNCLEAR] | `/api/products/???` | `productsApi.deleteAllImages()` | — | Called by "Delete All Product Images"; endpoint not confirmed |
| DELETE | `/api/products/{id}/images/{imageId}/` | `productsApi.deleteImage(id, imageId)` | — | Deletes single image from product; G-011 CLOSED (Patch 10) |

> Per D-001 (Option B): in Next.js these become `client.products.*` via the generated SDK.

---

## Composables consumed

None. Uses `useRouter()` inline for navigation.

---

## PrimeVue components consumed

None — hand-rolled Tailwind + PrimeIcons icon classes (`pi-box`, `pi-spinner pi-spin`, `pi-chevron-down`, `pi-chevron-right`, `pi-pencil`, `pi-trash`, `pi-star`, `pi-star-fill`, `pi-plus`, `pi-sparkles`, `pi-images`, `pi-copy`, `pi-image`, `pi-replay`, `pi-check-circle`, `pi-exclamation-triangle`, `pi-search`).

---

## Local state

**Products view:**
| Name | Type | Initial | Purpose |
|---|---|---|---|
| `groups` | `ref([])` | `[]` | Grouped product data from API |
| `loading` | `ref(false)` | `false` | Gates accordion loading spinner |
| `page` | `ref(1)` | `1` | Current page |
| `perPage` | `ref(50)` | `50` | Items per page |
| `totalItems` | `ref(0)` | `0` | Total product count |
| `totalPages` | `ref(0)` | `0` | Computed from API `pages` field |
| `search` | `ref('')` | `''` | Search input (400ms debounced) |
| `categoryFilter` | `ref('')` | `''` | Category dropdown filter |
| `sortBy` | `ref(null)` | `null` | Active sort field |
| `sortDir` | `ref('asc')` | `'asc'` | Sort direction |
| `expandedParents` | `ref(new Set())` | empty Set | Tracks expanded product_code values |
| `selectedParentIds` | `ref(new Set())` | empty Set | Tracks selected product_code values |
| `selectingAll` | `ref(false)` | `false` | Spinner during select-all fetch |
| `brokenImages` | `ref({})` | `{}` | Maps product_code/variant.id → true on image 404 |
| `showDeleteConfirm` | `ref(false)` | `false` | Single delete modal |
| `deleteTarget` | `ref(null)` | `null` | Variant object being deleted |
| `showBulkDeleteConfirm` | `ref(false)` | `false` | Bulk delete modal |
| `bulkDeleting` | `ref(false)` | `false` | Loading state for bulk delete |
| bulk edit fields | `ref('')×5` | `''` | `bulkCategory`, `bulkMaterial`, `bulkHsCode`, `bulkPartType`, `bulkBrand` [UNCLEAR exact names] |
| `viewMode` | `ref('products')` | `'products'` | `'products'` \| `'bin'` |

**Computed:**
| Name | Derived from | Purpose |
|---|---|---|
| `selectedChildIds` | `selectedParentIds` × `groups` | Resolves to variant ids for bulk-delete/update |
| `selectedCount` | `selectedParentIds.size` | Shown in bulk action bar |
| `allSelected` | `selectedParentIds.size === totalItems` | Select-all checkbox checked state |
| `someSelected` | `0 < selectedCount < totalItems` | Select-all checkbox indeterminate state |

**Bin view:**
| Name | Type | Initial | Purpose |
|---|---|---|---|
| `binProducts` | `ref([])` | `[]` | Flat archived product list |
| `binPage` | `ref(1)` | `1` | Bin current page |
| `binTotal` | `ref(0)` | `0` | Total archived count |
| `binTotalPages` | `ref(0)` | `0` | Bin page count |
| `binLoading` | `ref(false)` | `false` | Bin loading spinner |
| `binSearch` | `ref('')` | `''` | Bin search (400ms debounced) |
| `binSelectedIds` | `ref(new Set())` | empty Set | Selected archived product ids |
| `binRestoring` | `ref(false)` | `false` | Restore loading state |
| `binDeleting` | `ref(false)` | `false` | Perm. delete loading state |
| `showBinPermanentDeleteConfirm` | `ref(false)` | `false` | Bin perm. delete modal |

**Duplicate cleanup:**
| Name | Type | Purpose |
|---|---|---|
| `showDuplicateCleanup` | `ref(false)` | Modal visibility |
| `dupScanning` | `ref(false)` | Spinner during find-duplicates API call |
| `dupProducts` | `ref(null)` | Result from `/find-duplicates/` |
| `dupImageResult` | `ref(null)` | Result from `/remove-duplicate-images/` |
| `dupCleaningImages` | `ref(false)` | Loading state |
| `dupDeleteAllResult` | `ref(null)` | Result from delete-all-images operation |
| `dupDeleteAllProgress` | `ref(null)` | Progress string during delete-all |
| `dupDeleteAllConfirm` | `ref(false)` | Two-step confirm gate |
| `dupDeletingAllImages` | `ref(false)` | Loading state |

---

## Permissions / role gating

- Route `/products` has **no `meta.roles`** — all INTERNAL users (`user_type === 'INTERNAL'`) reach this page.
- `router.beforeEach` (index.js:385-388) redirects CLIENT/FACTORY users to their respective portals.
- **Backend mutations: G-011 CLOSED (Patch 10, 2026-04-22).** The products router now has inline `require_role(["ADMIN", "SUPER_ADMIN", "OPERATIONS"])` checks on all mutation endpoints. CLIENT and FACTORY tokens are rejected with HTTP 403. Auth-only (no role check) remains on read endpoints — all INTERNAL users may list and view products.

---

## Bilingual labels (`InternalString`)

All strings are English-only, hardcoded in the template. No i18n infrastructure.

| Key | en | ta | Type |
|---|---|---|---|
| `internal.products.title` | "Products" | "" | `InternalString` |
| `internal.products.import_excel` | "Import Excel" | "" | `InternalString` |
| `internal.products.clean_duplicates` | "Clean Duplicates" | "" | `InternalString` |
| `internal.products.add_product` | "+ Add Product" | "" | `InternalString` |
| `internal.products.tab_products` | "Products" | "" | `InternalString` |
| `internal.products.tab_bin` | "Bin" | "" | `InternalString` |
| `internal.products.loading` | "Loading..." | "" | `InternalString` |
| `internal.products.empty` | "No products found" | "" | `InternalString` |
| `internal.products.col_img` | "Img" | "" | `InternalString` |
| `internal.products.col_part_code` | "Part Code" | "" | `InternalString` |
| `internal.products.col_product_name` | "Product Name" | "" | `InternalString` |
| `internal.products.col_material` | "Material" | "" | `InternalString` |
| `internal.products.col_size` | "Size" | "" | `InternalString` |
| `internal.products.col_variants` | "Variants" | "" | `InternalString` |
| `internal.products.col_category` | "Category" | "" | `InternalString` |
| `internal.products.col_brand` | "Brand" | "" | `InternalString` |
| `internal.products.col_hs_code` | "HS Code" | "" | `InternalString` |
| `internal.products.col_actions` | "Actions" | "" | `InternalString` |
| `internal.products.bin_empty` | "Bin is empty" | "" | `InternalString` |
| `internal.products.bin_loading` | "Loading archived products..." | "" | `InternalString` |
| `internal.products.dup_title` | "Clean Duplicates" | "" | `InternalString` |

[D-005: Tamil translations required for all `InternalString` entries before Wave 4 is migration-ready — but `ta` may remain `""` for internal pages per D-005 policy decision.]

---

## Empty / error / loading states

| State | Trigger | Rendered to user? | Notes |
|---|---|---|---|
| Products loading | `loading === true` | Yes — centred spinner + "Loading..." | Covers full table zone |
| Products empty | `groups.length === 0 && !loading` | Yes — pi-box icon + "No products found" + add link | |
| Products error | `catch` in `loadProducts()` | **No — P-002 (swallow variant):** `groups = []`; empty state shown | No toast, no retry |
| Bin loading | `binLoading === true` | Yes — red spinner | |
| Bin empty | `binProducts.length === 0 && !binLoading` | Yes — pi-trash icon + "Bin is empty" | |
| Bin error | `catch` in `loadBinProducts()` | **No — P-002** | Same silent-swallow pattern |
| Duplicate scan | `dupScanning === true` | Yes — spinner + "Scanning for duplicates..." | Inside modal |
| Bulk delete in progress | `bulkDeleting === true` | Yes — spinner on button | |
| Select-all in progress | `selectingAll === true` | Yes — spinner replacing checkbox | |

---

## Business rules

1. **Grouped display model.** The API returns `{parent, variants[]}` groups. The parent product's `product_name` is auto-generated as `[PRODUCT_CODE]` and is never displayed directly — `groupDisplayName()` returns the first variant's name.
2. **Cross-page bulk selection.** When the user selects all (via select-all checkbox), the component fetches all matching product codes and populates `selectedParentIds`. On bulk update, if selected codes span multiple pages, the payload uses `product_codes` instead of `product_ids` to ensure all pages are affected server-side.
3. **Cascade delete.** Soft-deleting the last active child of a group auto-soft-deletes the orphan parent (backend logic in `bulk_delete_products`). Restoring a child does NOT auto-restore the parent — caller must restore parent separately if needed.
4. **Permanent delete preserves order history.** `POST /bin/permanent-delete/` copies product snapshot data to `OrderItem.product_code_snapshot` etc. and sets `order_item.product_id = null` before deleting — order history is preserved even after product removal.
5. **`settingsApi.getMarkups()` as category source.** Product categories are backed by the settings/markups table (each category has an associated markup percent). The product catalog's category filter draws from this table, not from the products table directly. Adding a category in ProductForm creates a markup entry.
6. **Select-all is cross-page but expand is page-local.** `expandedParents` is a Set of product_codes on the current page. Navigating to another page collapses all expanded rows (Set is not persisted across page changes).
7. **Sort is server-side.** `sort_by` and `sort_dir` are sent as query params. For `product_name`, `category`, `hs_code`, the backend joins to the first child variant to get a sortable value (grouped mode). For `variants`, it sorts by child count.
8. **Bin search is product-level (flat).** The bin query is `Product.deleted_at.isnot(None)` — it returns both parent and child products in a flat list, not grouped.

---

## Known quirks

- **`settingsApi.getMarkups()` used for categories instead of `productsApi.categories()`.** Backend has `/api/products/categories/` that returns distinct category values from the products table. ProductList instead fetches from the markups settings API, which may lag behind if a product has a category not in the markups table. Migration note: normalize category source.
- **Bulk edit field naming ambiguity.** Multi-column bulk edit applies changes immediately on input change (no "Apply" button confirmation). On a slow connection this can result in unintended partial updates if the user is mid-typing.
- **Delete All Product Images endpoint unresolved.** The `deleteAllProductImages()` function in the duplicate cleanup modal calls an endpoint not found in the products.py read. This may be `/api/products/delete-all-images/` or a batch of individual deletes — needs backend verification.
- **Bin table lacks image/edit actions.** Bin rows have no thumbnail and no edit link — users must first restore a product to edit it.
- **No error display on any API failure.** All `catch` blocks silently swallow errors. The empty state is indistinguishable from a load failure.

---

## Dead code / unused state

None clearly identified — all refs observed in state are bound to template elements or computed values.

---

## Duplicate or inline utilities

- `groupDisplayName`, `groupThumbnail`, `groupMaterials`, `groupDimensions`, `groupCategory`, `groupHsCode`, `groupHsCode`, `shortId` — all defined as local functions. These are candidates for extraction to a `utils/productGroups.js` module in the Next.js rebuild.
- `toggleSort`, `sortIcon`, `sortActive` — local sort cycle helpers. Extract to a `useSort()` composable.

---

## Migration notes

1. **Split into distinct concerns.** The 1948-line component packs two major views (Products + Bin), a complex accordion, and a 3-section utility modal. In Next.js, migrate as:
   - `/products` — `ProductListPage` (accordion table + pagination)
   - `/products/bin` — `ProductBinPage` (separate route)
   - Duplicate Cleanup: `<DuplicateCleanupModal>` shared component
2. **Extract `useProductSort()` and `useProductSelection()` composables.** The sort cycle (3-click), cross-page select-all, and selection-to-ids resolution are reusable patterns.
3. **Adopt TanStack Query for grouped list.** `useQuery(['products', params], fetchGrouped)` replaces manual `loading`/`groups` state. Invalidate on mutation.
4. **Pagination strategy.** Replace `page`/`perPage` manual state with URL search params so browser back/forward works. Decide pagination strategy per P-009 (cursor vs offset+limit). Backend already supports `page` + `per_page`.
5. **Fix category source.** Use `/api/products/categories/` for the product-level category filter. Keep `settingsApi.getMarkups()` only for the markup/pricing context (e.g., when creating a category).
6. **Resolve `deleteAllProductImages()` endpoint.** Confirm backend route before migration.
7. **Backend role enforcement: G-011 CLOSED (Patch 10, 2026-04-22).** All product mutation endpoints now enforce `require_role(["ADMIN", "SUPER_ADMIN", "OPERATIONS"])` — no action required before migration.
8. **Error handling.** Replace all silent swallows with toast notifications per P-002 pattern. Distinguish "no products" from "load failed" in the empty state.
9. **D-001:** All `productsApi.*` calls → `client.products.*` via generated SDK.
10. **D-005:** All visible strings are `InternalString`; Tamil translations optional per D-005.
