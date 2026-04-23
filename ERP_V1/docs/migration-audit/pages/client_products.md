# Client Products

**Type:** page
**Portal:** client (`/client-portal/*` — `user_type === 'CLIENT'`)
**Route:** `/client-portal/products` → `ClientProducts`
**Vue file:** [frontend/src/views/client/ClientProducts.vue](../../../frontend/src/views/client/ClientProducts.vue)
**Line count:** 217
**Migration wave:** Wave 2 (client portal)
**Risk level:** low (read-only catalog; no pricing data; Suggest Edit is a stub with no API call)

## Purpose (one sentence)
Read-only product catalog scoped to the authenticated client's permitted brands and products, with grouped parent/variant display, search/category filtering, pagination, and a non-functional "Suggest Edit" stub.

## Layout (top→bottom, left→right, exhaustive)

### Outer container
`p-4 md:p-6 max-w-7xl mx-auto` — rendered inside `ClientLayout`'s `<router-view />` slot.

**Zone 1 — Page header**
- `h1` "Product Catalog" (`text-xl md:text-2xl font-bold text-slate-800`).

**Zone 2 — Filters bar** (`bg-white rounded-xl shadow-sm p-4 mb-4 flex flex-col md:flex-row gap-3`)
- Search input: `relative flex-1`; `pi-search` icon inset left; `@input="onSearch"` (no debounce — fires on every keystroke); placeholder "Search by code, name, or material...".
- Category select: `v-model="selectedCategory"` `@change="onSearch"`; first option is `value=""` "All Categories"; subsequent options from `categories[]` ref (loaded from `productsApi.categories()`).

**Zone 3 — Product table container** (`bg-white rounded-xl shadow-sm overflow-hidden`)

_Loading state_ (while `loading === true`): `p-12 text-center`; `pi-spin pi-spinner text-2xl text-emerald-500`; "Loading products...".

_Empty state_ (`groups.length === 0`): `p-12 text-center`; `w-16 h-16` rounded-full `bg-slate-100` circle containing `pi-box text-2xl text-slate-400`; `h2` "No products available"; `p` "Contact your administrator to assign product access."

_Populated table_ (`w-full text-sm`):

Table header (`bg-slate-50 border-b border-slate-200 sticky top-0 z-10`) columns:

| Col | Header | Width / visibility | Notes |
|---|---|---|---|
| expand chevron | _(empty)_ | `w-8 px-1` | `pi-chevron-right` / `pi-chevron-down` if `variants.length > 1`; else empty |
| img | "Img" | `w-14 text-center` | always visible |
| part code | "Part Code" | `text-left` | always visible |
| name | "Product Name" | `text-left` | always visible |
| material | "Material" | `hidden md:table-cell` | |
| size | "Size" | `hidden md:table-cell` | maps to `dimension` field |
| category | "Category" | `hidden lg:table-cell` | |
| brand | "Brand" | `hidden lg:table-cell` | |
| action | "Action" | `w-20 text-right` | always visible |

Table body — `v-for="group in groups"` keyed by `group.parent.product_code`:

**Parent / single-variant row** (`border-b border-slate-200 hover:bg-slate-50 cursor-pointer`):
- `@click="group.variants.length > 1 && toggleExpand(group.parent.product_code)"` — no-op for single-variant groups.
- Expand col: `pi-chevron-right` (collapsed) / `pi-chevron-down` (expanded) if `variants.length > 1`; empty otherwise.
- Img col: `groupThumbnail(group)` → first variant with a `thumbnail_url`; falls back to `pi-box` placeholder if no thumbnail or `brokenImages[group.parent.product_code]` is true; `@error` sets `brokenImages[code] = true`.
- Part Code: `group.parent.product_code` (font-mono, teal-700).
- Product Name: `groupDisplayName(group)` — prefers `is_default` variant's `product_name`, else `variants[0].product_name`, else `group.parent.product_name`.
- Material: first variant's `material` (orange badge `bg-orange-50 text-orange-600`); `—` if absent.
- Size (dimension): first variant's `dimension` (blue badge `bg-blue-50 text-blue-600`); `—` if absent.
- Category: first variant's `category` (plain text).
- Brand: first variant's `brand` (violet badge `bg-violet-50 text-violet-600`).
- Action: "Suggest Edit" button (`@click.stop` prevents row expand); calls `openSuggest(group.variants[0] || group.parent)`.

**Expanded variant rows** (shown when `expandedParents.has(group.parent.product_code) && group.variants.length > 1`):
- Background `bg-slate-50/70 border-b border-slate-100`; slightly smaller text (`text-xs` → `text-[10px]`).
- Expand col: tree connector `├─` (Unicode U+251C U+2500) for all but last; `└─` (U+2514 U+2500) for last variant.
- Img: variant's `thumbnail_url`; 32×32px (`w-8 h-8`); `@error` sets `brokenImages[v.id] = true`; fallback `pi-image`.
- Part Code: `v.product_code` (font-mono text-[10px] text-slate-400).
- Product Name: `v.product_name`.
- Material / dimension / category / brand: variant-specific, same badge styles, smaller text.
- Action: "Suggest Edit" button calling `openSuggest(v)`.

**Zone 4 — Pagination** (visible only when `totalPages > 1`):
`px-4 py-3 border-t border-slate-200 flex items-center justify-between`
- Left: "{totalItems} products".
- Right: Prev button (disabled when `page <= 1`) + "{page} / {totalPages}" + Next button (disabled when `page >= totalPages`).

**Zone 5 — Suggest Edit modal** (`fixed inset-0 z-50 flex items-center justify-center bg-black/40`):
- Backdrop `@click.self` closes modal.
- Inner card `bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4`.
- `h2` "Suggest an Edit".
- Product reference: `font-mono font-medium` product_code + plain product_name.
- Two states:
  - **Pre-submit:** `textarea` (h-24, resize-none) + Cancel + Submit buttons; Submit disabled when `suggestText.trim()` is empty.
  - **Post-submit (`suggestSent === true`):** `pi-check-circle text-3xl text-emerald-500` + "Suggestion submitted! Our team will review it." — modal auto-closes after 2000 ms.

## Data displayed

| Field | Source | Format | Notes |
|---|---|---|---|
| `group.parent.product_code` | `productsApi.list({ group: true })` | monospace font-mono teal-700 | parent row identifier |
| `groupDisplayName(group)` | variant `product_name` | plain string | prefers `is_default` variant |
| `v.thumbnail_url` | variant | 40×40 / 32×32 `<img>` | replaced by `pi-box`/`pi-image` on load failure |
| `v.material` | variant | orange badge | first variant shown in parent row |
| `v.dimension` | variant | blue badge | labelled "Size" in header |
| `v.category` | variant | plain text | hidden below lg |
| `v.brand` | variant | violet badge | hidden below lg |
| `v.product_code` | variant | font-mono text-[10px] text-slate-400 | variant rows only |
| `v.product_name` | variant | text-xs text-slate-700 | variant rows only |
| `totalItems` | `data.total` | integer | "{n} products" in pagination |
| `page` / `totalPages` | computed | "{page} / {totalPages}" | pagination label |

**Pricing fields:** none. No `factory_price`, `selling_price_inr`, or markup data is rendered. The product model itself contains no such fields.

## Interactions (every clickable/typeable element)

| Trigger | Action | API call | Result |
|---|---|---|---|
| Type in search input | `onSearch()` — resets `page=1`, calls `loadProducts()` | GET `/api/products/` | re-renders filtered catalog; fires on every keystroke (no debounce) |
| Change category select | `onSearch()` | GET `/api/products/` | re-renders filtered catalog |
| Click parent row (variants > 1) | `toggleExpand(code)` — immutable Set swap | none | variant rows appear/collapse |
| Click parent row (single variant) | no-op (short-circuit `&&`) | none | no visual change |
| Click Prev / Next (pagination) | `onPageChange(p)` | GET `/api/products/` | loads adjacent page |
| Click "Suggest Edit" (parent row) | `openSuggest(group.variants[0] \|\| group.parent)` | none | opens Suggest Edit modal |
| Click "Suggest Edit" (variant row) | `openSuggest(v)` | none | opens Suggest Edit modal |
| Click modal backdrop | `showSuggest = false` | none | close modal |
| Click "Cancel" | `showSuggest = false` | none | close modal |
| Click "Submit Suggestion" | `submitSuggestion()` — **stub** | **none** | sets `suggestSent = true`; success state shown; `setTimeout` closes modal after 2 s |

## Modals/dialogs triggered

| Modal | Trigger | Type | API call | Notes |
|---|---|---|---|---|
| Suggest Edit | "Suggest Edit" button | hand-rolled `fixed inset-0` | **none** | Complete stub — `submitSuggestion()` fires no HTTP request; comment: `"// In a real system this would POST to an API"` |

## API endpoints consumed

| Method | Endpoint | Via | Params | Notes |
|---|---|---|---|---|
| GET | `/api/products/` | `productsApi.list(params)` | `{ page, per_page: 50, group: true, search?, category? }` | Returns `{ items: [{parent, variants[]}], total }`. Client-scoped server-side — see Permissions section. |
| GET | `/api/products/categories/` | `productsApi.categories()` | none | Returns array of category strings. Loaded once in `onMounted`. Errors silently ignored. |

> Per D-001 (Option B): in Next.js these become `client.products.list(params)` and `client.products.categories()` via the generated SDK.

## Composables consumed

None. This page does not call `useAuth`.

## PrimeVue components consumed

None. All UI is hand-rolled Tailwind + PrimeIcons icon classes (`pi-search`, `pi-spin`, `pi-spinner`, `pi-box`, `pi-image`, `pi-chevron-right`, `pi-chevron-down`, `pi-check-circle`).

## Local state

- `groups: ref([])` — array of `{parent, variants[]}` groups returned by `productsApi.list({ group: true })`.
- `loading: ref(false)` — initialized `false` (unlike most pages that start `true`); set `true` at the top of `loadProducts()` and back to `false` at the end.
- `search: ref('')` — bound to the search input.
- `selectedCategory: ref('')` — bound to the category select.
- `categories: ref([])` — category strings for the dropdown.
- `page: ref(1)` — current page number.
- `perPage: ref(50)` — fixed page size; no UI control.
- `totalItems: ref(0)` — total product count from API response.
- `expandedParents: ref(new Set())` — set of `product_code` strings for expanded parent rows; updated via immutable Set swap in `toggleExpand`.
- `brokenImages: ref({})` — map of `product_code` or `variant.id` → `true` for `<img>` load failures.
- `showSuggest: ref(false)` — Suggest Edit modal visibility.
- `suggestProduct: ref(null)` — the variant (or parent) passed to `openSuggest`.
- `suggestText: ref('')` — textarea content.
- `suggestSent: ref(false)` — true after stub submit; triggers success state.

Computed:
- `totalPages: computed(() => Math.ceil(totalItems.value / perPage.value))`

No `watch`. No `onUnmounted`.

## Permissions / role gating

- Route is under `ClientLayout`; `router.beforeEach` restricts access to `user_type === 'CLIENT'` ([router/index.js:373-388](../../../frontend/src/router/index.js#L373)).
- **Catalog scoping:** RESOLVED (2026-04-21): `GET /api/products/` enforces client-scoping server-side via `ClientBrandAccess` + `ClientProductAccess` (`products.py:81-118`). If no brand access is configured for this client, an empty catalog is returned. Product model contains no `factory_price` or `factory_markup_percent` fields — no pricing-strip is required. Classified OK in `AUTHZ_SURFACE.md`.
- No per-field permission checks in this component.
- No `portalPerms` or `clientType` reads — the catalog page is permission-neutral once the client can reach it.

## Bilingual labels (Tamil + English pairs)

| Key | en | ta | Type |
|---|---|---|---|
| `client.products.title` | "Product Catalog" | `""` | PortalString |
| `client.products.search_placeholder` | "Search by code, name, or material..." | `""` | PortalString |
| `client.products.all_categories` | "All Categories" | `""` | PortalString |
| `client.products.col_img` | "Img" | `""` | PortalString |
| `client.products.col_part_code` | "Part Code" | `""` | PortalString |
| `client.products.col_name` | "Product Name" | `""` | PortalString |
| `client.products.col_material` | "Material" | `""` | PortalString |
| `client.products.col_size` | "Size" | `""` | PortalString |
| `client.products.col_category` | "Category" | `""` | PortalString |
| `client.products.col_brand` | "Brand" | `""` | PortalString |
| `client.products.col_action` | "Action" | `""` | PortalString |
| `client.products.suggest_edit` | "Suggest Edit" | `""` | PortalString |
| `client.products.loading` | "Loading products..." | `""` | PortalString |
| `client.products.empty_title` | "No products available" | `""` | PortalString |
| `client.products.empty_body` | "Contact your administrator to assign product access." | `""` | PortalString |
| `client.products.pagination_count` | "{n} products" | `""` | PortalString |
| `client.products.modal_title` | "Suggest an Edit" | `""` | DialogString |
| `client.products.modal_product_ref` | "Product: {code} — {name}" | `""` | DialogString |
| `client.products.modal_placeholder` | "Describe the change you'd like (e.g. 'Material should be Steel', 'Wrong dimension')" | `""` | DialogString |
| `client.products.modal_cancel` | "Cancel" | `""` | DialogString |
| `client.products.modal_submit` | "Submit Suggestion" | `""` | DialogString |
| `client.products.modal_sent` | "Suggestion submitted! Our team will review it." | `""` | DialogString |

[UNCLEAR — needs Sachin review: Tamil translations required for all `PortalString` and `DialogString` entries before Wave 2 is migration-ready (D-005).]

## Empty / error / loading states

- **Loading:** spinner + "Loading products..." inside the table container; filters bar remains visible.
- **Empty:** `pi-box` icon + "No products available" + "Contact your administrator to assign product access."; shown when `groups.length === 0`, whether caused by no ClientBrandAccess configuration or a search/filter that matched nothing. The two cases are visually indistinguishable.
- **Error:** silently swallowed in `loadProducts()` (`catch (_e) { groups.value = [] }`); component displays the same empty state as a genuine empty catalog. `loadCategories()` also silently ignores errors (category dropdown simply stays empty).
- **Broken images:** `brokenImages` ref causes failed `<img>` tags to be replaced with `pi-box` / `pi-image` placeholder; no error surfaced to user.

## Business rules (non-obvious)

1. **Catalog is always client-scoped.** The server enforces `ClientBrandAccess` + `ClientProductAccess`; the client-side code applies no additional filter — it trusts the response.
2. **`perPage` is fixed at 50 and has no UI control.** Pagination appears only when `totalPages > 1`; the user cannot change page size.
3. **`groupDisplayName` prefers the `is_default` variant.** If no default is flagged, falls back to `variants[0].product_name`, then to `group.parent.product_name`.
4. **`groupThumbnail` returns the first variant's thumbnail, not the parent's.** The parent model may have its own `thumbnail_url`, but the helper iterates only `variants[]`.
5. **Suggest Edit is a complete stub.** `submitSuggestion()` fires no HTTP request; the code comment is explicit. Clients receive a false confirmation that their suggestion was submitted.
6. **Single-variant group rows are not expandable.** `@click="group.variants.length > 1 && toggleExpand(...)"` short-circuits for single-variant groups; no chevron is shown and clicking the row has no effect.

## Known quirks

- **No debounce on search:** `loadProducts()` fires on every `@input` keystroke. With a fast typist and a slow backend, many in-flight requests can be issued for a single search.
- **Suggest Edit is a stub:** no backend endpoint exists for product edit suggestions. Clients see a success message that is entirely fictional; there is no record of the submission anywhere.
- **Error is invisible:** `loadProducts()` silently sets `groups = []` on any network failure — the empty state ("No products available") and a genuine API error are visually identical.
- **`loading` initializes to `false`:** The very first frame before `onMounted` fires shows no spinner. In practice this is imperceptible because `loadProducts()` in `onMounted` immediately sets `loading = true`, but it differs from the pattern used elsewhere in the portal.
- **Parent row click is a no-op for single-variant groups** — no visual affordance difference; cursor is still `cursor-pointer`.

## Dead code / unused state

None observed.

## Migration notes

- **D-001:** `productsApi.list(params)` → `client.products.list(params)` via generated SDK; `productsApi.categories()` → `client.products.categories()`.
- **D-005:** All visible strings are `PortalString`; modal strings are `DialogString`. Tamil translations required before Wave 2 ships.
- **Layer 2 components needed:** `ProductGroupTable` (grouped table with expand), `ProductParentRow`, `ProductVariantRow`, `SuggestEditModal`.
- **Fix in Next.js — implement Suggest Edit or remove it.** The stub must either be replaced with a real endpoint (e.g. `POST /api/products/{id}/suggestions/`) and SDK call, or the "Suggest Edit" button must be removed entirely. Shipping a false-success CTA is a UX bug.
- **Fix in Next.js — add search debounce.** Wrap `loadProducts` in a 300 ms debounce to reduce unnecessary API calls.
- **Fix in Next.js — surface load errors.** Replace the silent `catch (_e) {}` with a user-visible error state (toast or inline banner) so clients can distinguish "no products assigned" from "API failure".
- **Open questions for Sachin:**
  1. Is Suggest Edit intended for Wave 2 or a later sprint? If not Wave 2, remove the button rather than ship a stub.
  2. Should catalog load errors be user-visible rather than silently falling back to empty state?
  3. Tamil copy for all labels — translator review needed before Wave 2 ships.
