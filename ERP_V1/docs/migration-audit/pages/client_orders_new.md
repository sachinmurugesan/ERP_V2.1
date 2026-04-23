# Client New Order (Inquiry)

## Metadata

**Type:** page
**Portal:** client (`/client-portal/*` — `user_type === 'CLIENT'`)
**Route:** `/client-portal/orders/new` → `ClientNewOrder`
**Vue file:** [frontend/src/views/client/ClientNewOrder.vue](../../../frontend/src/views/client/ClientNewOrder.vue)
**Line count:** 854
**Migration wave:** Wave 2 (client portal)
**Risk level:** high (mutates data; complex multi-path product entry; carry-forward logic has backend side-effects; Quick Add creates products pending admin review)

## Purpose (one sentence)
Order inquiry creation form that lets a client select products via three entry methods (inline search, Browse Products modal, Bulk Paste modal), optionally name the order, and submit the inquiry to the internal team for pricing.

## Layout (top→bottom, left→right, exhaustive)

### Outer container
`p-4 md:p-6 max-w-4xl mx-auto`.

**Zone 1 — Page header**
- "← Back to Orders" `<router-link>` (emerald-600, `pi-arrow-left` icon).
- `h1` "New Order Inquiry".
- Subtitle: "Select products and quantities. Pricing will be provided by our team."

**Zone 2 — Error banner** (shown when `error !== ''`)
`bg-red-50 border border-red-200 rounded-lg` — `pi-exclamation-circle` + error message text.

**Zone 3 — Carry-forward notice** (shown when `totalPending > 0 || totalPendingRemoved > 0`)
`bg-emerald-50 border border-emerald-200 rounded-xl` — `pi-check-circle text-emerald-600` + "{N} pending item(s) auto-added from previous orders"; optional "({M} removed by you)" suffix. Subtext explains these are replacements/unloaded parts.

**Zone 4 — Order reference card** (`bg-white rounded-xl border border-slate-200 shadow-sm`)
- Info chip: `pi-hashtag text-emerald-500` + "PO Reference will be auto-generated upon submission (e.g. SSP/25-26/03/0001)".
- "Your Order Name (Optional, must be unique)" label + `<input v-model="clientReference">` placeholder "e.g. Gearbox Parts March 2026".
- Helper text below: "Give your order a memorable name for easy reference".

**Zone 5 — Add Products card** (`bg-white rounded-xl border border-slate-200 shadow-sm`)
- Header row: "Add Products" label; right side: "Browse" button (`pi-th-large`, emerald-300 border) + "Bulk Paste" button (`pi-clipboard`, blue-300 border).
- Inline search: `<input>` with `pi-search` left icon, placeholder "Search by product code or name..."; spinner `pi-spinner pi-spin` when `searching`.
- **Search results dropdown** (shown when `searchResults.length > 0`): scrollable list (max-h-64), each row shows code (mono), name, category/material/dimension, `pi-plus` icon; clicking calls `addProduct(p)`.
- "No products found for '...'" text when `searchQuery.length >= 2 && !searching && searchResults.length === 0`.

**Zone 6 — Order Items card** (`bg-white rounded-xl border border-slate-200 shadow-sm`)
- Header: "Order Items" + "{N} products, {M} units" count.
- **Empty state:** `pi-box` icon + "Search, browse, or paste product codes above".
- **Items table** (columns: Product | Category _(hidden on xs)_ | Qty | Remove):
  - Product cell: thumbnail (if `thumbnail_url`) + mono code + product name + dimension + optional badges:
    - `bg-amber-100 text-amber-700` badge: "Quick Add — Pending Review" (for `isQuickAdd` items).
    - `bg-orange-100 text-orange-700` badge: "{label} — from {source}" (for `_pendingType === 'aftersales'`).
    - `bg-purple-100 text-purple-700` badge: "{label} — from {source}" (for `_pendingType === 'unloaded'`).
  - Qty cell: `<input type="number">` for non-pending items; plain `<span>` for carry-forward pending items (quantity locked).
  - Remove cell: `pi-trash` button; for pending items, tracking via `removedPendingIds`.

**Zone 7 — Pending approval warning** (shown when any item has `approval_status === 'PENDING_APPROVAL'`)
`bg-orange-50 border border-orange-200` — `pi-clock` + "{N} product(s) pending admin approval" + explanation.

**Zone 8 — Pricing notice** (always shown)
`bg-amber-50 border border-amber-200` — `pi-info-circle` + "Pricing is pending review" + "Our team will review your inquiry, set the pricing, and send you a Proforma Invoice (PI) for approval."

**Zone 9 — Action row**
- "Submit Inquiry" button (`bg-emerald-600`): disabled when `saving || orderItems.length === 0`; shows `pi-spinner pi-spin` + "Submitting..." when `saving`, else `pi-send` + "Submit Inquiry".
- "Cancel" `<router-link>` back to `/client-portal/orders`.

---

### Modal A — Browse Products (`v-if="showBrowse"`)

`fixed inset-0 z-50`, click-outside closes. Inner panel: `max-w-4xl max-h-[80vh] flex flex-col`.

- **Header:** "Browse Products" + `pi-times` close button.
- **Filters row:** search input (`pi-search`) + category `<select>`.
- **Product table** (sticky header, scrollable body): Checkbox | Code | Product Name | Variant (dim + material) | Category. Row states: selected (`bg-emerald-50`), already-in-order (`opacity-50 cursor-not-allowed`).
- **Pagination** (shown when `browseTotalPages > 1`): Prev / {page} / {totalPages} / Next — 24 items per page.
- **Footer:** "{N} selected" counter + Cancel + "Add Selected (N)" button.

### Modal B — Bulk Paste (`v-if="showBulkPaste"`)

`fixed inset-0 z-50`, click-outside closes. Inner panel: `max-w-2xl max-h-[90vh] flex flex-col`.

- **Header:** "Bulk Paste Products" + subtitle: "Paste product codes from Excel. Format: CODE QTY (one per line)" + `pi-times`.
- **Textarea:** `font-mono h-32`, placeholder showing example codes + quantities.
- Format note: TAB / COMMA / SPACE separated; QTY optional (defaults to 1).
- **"Validate Codes" button:** `bg-blue-600`; disabled when empty or processing; shows spinner while validating.
- **Results section** (shown after validation):
  - **Matched** (`bg-emerald-50 border-emerald-200`): "{N} products matched" + scrollable list of `code — name qty:{qty}`.
  - **Unmatched** (`bg-red-50 border-red-200`): "{N} codes not found" + per-code row with "Quick Add" button.
    - **Quick Add inline form** (per unmatched code): product name `<input>` + confirm (`pi-check`) + cancel (`pi-times`) buttons; `@keyup.enter` submits.
  - Footer note: "Quick Add creates a basic product entry. Admin will review and complete the details."
- **Sticky footer** (shown when `bulkResults.matched.length > 0`): Cancel + "Add {N} Products" button.

## Data displayed

| Field | Source | Format | Notes |
|---|---|---|---|
| `user.full_name` | not displayed on this page | — | — |
| Carry-forward items | `afterSalesApi.list({ carry_forward_only: true })` + `unloadedApi.list({ status: 'PENDING' })` | pre-populated rows | fetched on mount |
| Search results | `productsApi.list({ search, per_page: 10 })` | dropdown list | debounced 300ms |
| Browse products | `productsApi.list({ page, per_page: 24 })` | table | paginated |
| Categories | `productsApi.categories()` | dropdown options | fetched once |
| Bulk validation | `productsApi.validateCodes([codes])` | matched/unmatched | fallback: individual search per code |

No pricing data shown to client at any point during inquiry creation.

## Interactions (every clickable/typeable element)

| Trigger | Action | API call | Result |
|---|---|---|---|
| Type in inline search | debounced `onSearch()` after 300ms (2+ chars) | `GET /api/products/` | shows dropdown |
| Click search result | `addProduct(p)` | none | adds row to order items |
| Click "Browse" | `openBrowse()` | `GET /api/products/categories/`, `GET /api/products/` | opens Browse modal |
| Type in browse search | `onBrowseSearch()` (resets to page 1) | `GET /api/products/` | re-filters table |
| Change browse category | `onBrowseSearch()` | `GET /api/products/` | re-filters table |
| Click browse row | `toggleBrowseSelect(p)` | none | toggles selection |
| Click browse select-all checkbox | `toggleBrowseSelectAll()` | none | selects all selectable |
| Click Prev/Next pagination | `loadBrowseProducts()` | `GET /api/products/` | new page |
| Click "Add Selected" | `addBrowseSelected()`, closes modal | none | adds selected to items |
| Click "Bulk Paste" | `openBulkPaste()` | none | opens Bulk Paste modal |
| Click "Validate Codes" | `processBulkPaste()` | `POST /api/products/validate-codes/` (fallback: multiple `GET /api/products/`) | shows results |
| Click "Quick Add" (unmatched) | `startQuickAdd(item)` | none | shows inline name input |
| Submit Quick Add (Enter or `pi-check`) | `submitQuickAdd()` | none | moves code to matched list, marks `isQuickAdd: true` |
| Click "Add {N} Products" | `applyBulkResults()`, closes modal | none | adds all matched to items |
| Update qty `<input>` | `updateQty(index, value)` | none | mutates item quantity (min 1) |
| Click `pi-trash` (remove item) | `removeItem(index)` | none | removes from array; for pending items, adds `_pendingId` to `removedPendingIds` |
| Click "Submit Inquiry" | `submitInquiry()` | `POST /api/orders/client-inquiry/` | on success: navigate to `/client-portal/orders` |
| Click "Cancel" | navigate | none | `/client-portal/orders` |
| Click overlay (any modal) | close modal | none | |
| Click `pi-times` (any modal header) | close modal | none | |

## Modals/dialogs triggered

### Browse Products Modal
Full-screen modal; paginated product table with multi-select checkboxes.

### Bulk Paste Modal
Full-screen modal; textarea + code validation + Quick Add inline form per unmatched code.

**D-003 note:** Neither modal is a destructive-action gate — `<ConfirmDialog>` is not needed. "Submit Inquiry" is not destructive.

## API endpoints consumed

| Method | Endpoint | Via | Params | Notes |
|---|---|---|---|---|
| GET | `/api/aftersales/` | `afterSalesApi.list()` | `carry_forward_only: true, per_page: 200` | Mount: fetches carry-forward items |
| GET | `/api/unloaded/` | `unloadedApi.list()` | `status: 'PENDING', per_page: 200` | Mount: fetches unloaded items |
| GET | `/api/products/` | `productsApi.list()` | `search, per_page: 10` | Inline search |
| GET | `/api/products/` | `productsApi.list()` | `page, per_page: 24, search?, category?` | Browse modal |
| GET | `/api/products/categories/` | `productsApi.categories()` | — | Browse modal category filter |
| POST | `/api/products/validate-codes/` | `productsApi.validateCodes()` | array of code strings | Bulk paste validation; fallback: `productsApi.list()` per code |
| POST | `/api/orders/client-inquiry/` | `ordersApi.createClientInquiry()` | `{ po_reference, client_reference, items[], quick_add_items[] }` | Final submission |

> Per D-001 (Option B): in Next.js, all calls go through the generated SDK.

## Composables consumed

- **`useRouter`** — for redirect after successful submit.

No `useAuth` (user identity not needed on this form).

## PrimeVue components consumed

None. All UI is hand-rolled Tailwind + PrimeIcons (`pi-plus`, `pi-clipboard`, `pi-th-large`, `pi-search`, `pi-spinner pi-spin`, `pi-send`, `pi-box`, `pi-trash`, `pi-replay`, `pi-clock`, `pi-check`, `pi-check-circle`, `pi-times`, `pi-hashtag`, `pi-info-circle`, `pi-exclamation-circle`, `pi-arrow-left`).

## Local state

| Ref | Type | Purpose |
|---|---|---|
| `poReference` | `ref('')` | Unused on form — auto-generated by server |
| `clientReference` | `ref('')` | Optional order name input |
| `orderItems` | `ref([])` | Working list of items being added |
| `searchQuery` | `ref('')` | Inline search input value |
| `searchResults` | `ref([])` | Dropdown results |
| `searching` | `ref(false)` | Spinner on inline search |
| `saving` | `ref(false)` | Submit in-flight |
| `error` | `ref('')` | Submit error banner |
| `showBrowse` | `ref(false)` | Browse modal open state |
| `browseSearch`, `browseCategory`, `browseProducts`, `browseLoading`, `browsePage`, `browseTotal` | refs | Browse modal state |
| `browseSelected` | `ref(new Set())` | Browse multi-select |
| `showBulkPaste` | `ref(false)` | Bulk Paste modal open state |
| `bulkText` | `ref('')` | Textarea content |
| `bulkResults` | `ref(null)` | `{ matched[], unmatched[] }` |
| `bulkProcessing` | `ref(false)` | Validate in-flight |
| `quickAddCode`, `quickAddQty`, `quickAddName`, `quickAddMode` | refs | Quick Add inline form |
| `pendingAfterSales`, `pendingUnloaded` | refs | Carry-forward items from previous orders |
| `pendingLoading` | `ref(false)` | Carry-forward fetch spinner |
| `removedPendingIds` | `ref(new Set())` | Pending items the client chose to exclude |

Computed: `totalPending`, `totalPendingRemoved`, `totalItems`, `addedProductIds`, `browseAllSelected`, `browseTotalPages`.

`searchTimer` is a module-level `let` for debounce — not a Vue ref.

## Permissions / role gating

- Route restricted to `user_type === 'CLIENT'` by global router guard.
- No per-field permission checks on this page — product catalog is already filtered server-side to the client's permitted product set (via `clientsApi.getProductAccess()`-style scoping on the backend).
- Quick Add items are created locally and submitted as `quick_add_items[]`; they appear in admin's product review queue.

RESOLVED (2026-04-21): GET /api/products/ enforces client-scoping server-side via ClientBrandAccess + ClientProductAccess (products.py:81-118). If no brand access is configured for this client, an empty catalog is returned. Product model contains no factory_price or factory_markup_percent fields — no pricing-strip is required. Classified OK in AUTHZ_SURFACE.md.

## Bilingual labels (Tamil + English pairs)

| Key | en | ta | Type |
|---|---|---|---|
| `client.new_order.title` | "New Order Inquiry" | `""` | `PortalString` |
| `client.new_order.subtitle` | "Select products and quantities. Pricing will be provided by our team." | `""` | `PortalString` |
| `client.new_order.back` | "Back to Orders" | `""` | `PortalString` |
| `client.new_order.ref_info` | "PO Reference will be auto-generated upon submission" | `""` | `PortalString` |
| `client.new_order.client_ref_label` | "Your Order Name (Optional, must be unique)" | `""` | `PortalString` |
| `client.new_order.client_ref_placeholder` | "e.g. Gearbox Parts March 2026" | `""` | `PortalString` |
| `client.new_order.add_products` | "Add Products" | `""` | `PortalString` |
| `client.new_order.browse` | "Browse" | `""` | `PortalString` |
| `client.new_order.bulk_paste` | "Bulk Paste" | `""` | `PortalString` |
| `client.new_order.search_placeholder` | "Search by product code or name..." | `""` | `PortalString` |
| `client.new_order.order_items` | "Order Items" | `""` | `PortalString` |
| `client.new_order.quick_add_badge` | "Quick Add — Pending Review" | `""` | `PortalString` |
| `client.new_order.pricing_notice_title` | "Pricing is pending review" | `""` | `PortalString` |
| `client.new_order.pricing_notice_body` | "Our team will review your inquiry, set the pricing, and send you a Proforma Invoice (PI) for approval." | `""` | `PortalString` |
| `client.new_order.submit` | "Submit Inquiry" | `""` | `PortalString` |
| `client.new_order.submitting` | "Submitting..." | `""` | `PortalString` |
| `client.new_order.cancel` | "Cancel" | `""` | `PortalString` |
| `client.new_order.carry_forward_notice` | "{N} pending item(s) auto-added from previous orders" | `""` | `PortalString` |
| `client.new_order.no_items_error` | "Please add at least one product to your inquiry." | `""` | `DialogString` |
| `client.new_order.browse_title` | "Browse Products" | `""` | `PortalString` |
| `client.new_order.bulk_paste_title` | "Bulk Paste Products" | `""` | `PortalString` |
| `client.new_order.validate_codes` | "Validate Codes" | `""` | `PortalString` |
| `client.new_order.add_selected` | "Add {N} Products" | `""` | `PortalString` |
| `client.new_order.quick_add_label` | "Quick Add" | `""` | `PortalString` |

[UNCLEAR — needs Sachin review: Tamil required for all `PortalString` entries before Wave 2 ships. `DialogString` entries need non-empty `ta` at type level.]

## Empty / error / loading states

- **Order items empty state:** `pi-box` icon + "Search, browse, or paste product codes above" (inside items card).
- **Search results empty:** "No products found for '...'" text below the search input.
- **Browse loading:** spinner + "Loading products...".
- **Browse empty:** `pi-search` + "No products found".
- **Submit error:** populates `error` ref → shown in Zone 2 red banner.
- **Carry-forward loading:** silently async on mount; no loading indicator in the UI.
- **Submit disabled:** when `saving === true` or `orderItems.length === 0`.

## Business rules (non-obvious)

1. **Carry-forward items are auto-added on mount but NOT submitted.** `pendingAfterSales` and `pendingUnloaded` are pre-populated into `orderItems` visually, but `submitInquiry()` explicitly filters them out (`filter(i => !i.isQuickAdd && !i._pendingType)`). The backend is responsible for adding carry-forward items when a factory is assigned to the order.
2. **Quick Add is local-only until submit.** `submitQuickAdd()` does not call any API. The item lives in `orderItems` with `isQuickAdd: true` and `product_id: null`, then submitted via `quick_add_items[]`. Backend creates a product pending admin review.
3. **Duplicate product guard in inline search.** `searchResults` filters out any product whose `id` is already in `addedProductIds`. Browse modal shows already-added products as greyed-out/disabled rows.
4. **Bulk paste parser:** extracts CODE and QTY from tab/comma/space-delimited lines. QTY is the LAST numeric token on the line — handles `"CODE (name) QTY"` format. Defaults to `qty: 1` if no numeric last token.
5. **Product grouped format:** `productsApi.list()` may return a grouped format `{ variants, parent }`. Both inline search and browse modal flatten this by extracting the default variant (`is_default: true`) or first variant.
6. **`poReference` is unused.** The ref is declared and wired to a hidden `v-model`, but the server auto-generates the PO reference and the client has no input for it. The hidden field note ("e.g. SSP/25-26/03/0001") is informational only.
7. **Carry-forward pending items have locked quantities.** The qty `<input>` is replaced by a plain `<span>` for `_pendingType` items — the quantity comes from the source record and is not adjustable.

## Known quirks

- `poReference` ref is declared but bound to nothing in the template (the UI shows the auto-generate note but no input for it). It is sent as `po_reference: poReference.value || null` in the submit payload — always `null`.
- Quick Add items submitted as `quick_add_items` create products without images, brand, category, material, or dimension — admin must complete them.
- No per-item note/comment field — clients cannot annotate specific product requirements in the inquiry.
- `browseAllSelected` computed — "select all" only targets products not already in the order.

## Migration notes

- **D-001:** all API calls → generated SDK. `ordersApi.createClientInquiry()` → `client.orders.createClientInquiry({...})`.
- **D-005:** All strings are `PortalString`; submit error is `DialogString`. Tamil required before merge.
- **D-003:** No destructive actions on this page — no `<ConfirmDialog>` migration needed.
- **Layer 2 components needed:** `ProductSearchInput` (with debounce built in), `BrowseProductsModal`, `BulkPasteModal`, `QuickAddInlineForm`, `CarryForwardBanner`, `OrderItemsTable`, `PricingNoticeAlert`.
- **Open questions for Sachin:**
  1. ~~Does `productsApi.list()` scope to the client's permitted catalog?~~ RESOLVED — server enforces scoping via ClientBrandAccess + ClientProductAccess. Next.js SDK call needs no additional `clientId` filter.
  2. Should carry-forward pending items show a locked quantity or allow the client to request a different quantity?
  3. Should clients be able to add a per-line note/comment on an inquiry item (e.g., "prefer stainless steel variant")?
  4. Tamil copy — translator review needed for all portal strings.

---

## Dead code / unused state

- `poReference: ref('')` — bound to a hidden element and always submitted as `null`; the server auto-generates the PO reference. Remove or make read-only display.
- `searchTimer` (module-level `let`) — manual debounce timer. Replace with a proper `useDebounce` hook in the Next.js port.

---

## Duplicate or inline utilities

- **Bulk paste parser** (inside `processBulkPaste()`) — code/qty extraction from tab/comma/space-delimited lines. Extract to `src/lib/bulk-paste-parser.ts` for reuse in factory portal equivalent.
- **Product-flatten logic** (default variant extraction from grouped format) — duplicated across inline search, browse modal, and bulk paste result handlers. Extract to `src/lib/product-helpers.ts`.
