## Metadata

| Field | Value |
|-------|-------|
| Type | page |
| Portal | internal |
| Route | `/orders/new` |
| Source file | `frontend/src/views/orders/OrderDraft.vue` |
| Line count | 1,563 |
| Migration wave | Wave 7 |
| Risk | high |

---

## Purpose

Single-page order creation form that produces a DRAFT-status order. This is Stage 1 of the order lifecycle — the user selects a client and factory, then populates a product line-item list using any of three methods: (1) debounced single-product search with inline add, (2) multi-code bulk paste with multi-status result processing, or (3) a paginated product browser modal with multi-select. The page also surfaces carry-forward intelligence: after-sales return items (mandatory, auto-added server-side) are displayed as a read-only banner; unloaded items from prior orders (optional, user-acknowledged) are displayed as an amber warning and trigger a confirmation modal before the order is submitted. If either client or factory does not yet exist, they can be created inline without leaving the page. Bulk paste supports inline creation of products that are not yet in the catalog (NOT_FOUND path). On submit the page calls `ordersApi.create()` and redirects to the new order's detail page.

---

## Layout

The page renders as a `max-w-5xl` centered form with five structural zones, plus five overlaid modals.

### Zone 1 — Page header
Back button (`← /orders`), page title "New Order (Draft)", and subtitle "Stage 1 — Select client, factory, and add products".

### Zone 2 — Global message banners
- **Success banner** — shown when `successMsg` is set (post-submit, before redirect). Green. Appears below header.
- **Error banner** — shown when `errors.general` is set. Red.

### Zone 3 — Order Details card
A white card containing a 2-column responsive grid with:
- Client dropdown (required, with error highlight) + "+ New Client" action button
- Factory dropdown (optional) + "+ New Factory" action button
- Factory Currency select (`CNY / USD / EUR / GBP`)
- Client Currency — INR, readonly display only (not an input)
- PO Reference — text input, optional
- Notes — textarea spanning `md:col-span-2`, optional

### Zone 4 — Products card
Header row: "Products (N items)" count label, "Browse Products" button, "Bulk Paste" button.

Below the header, in vertical order:

**Zone 4a — After-Sales mandatory banner** (rose-50, shown when `pendingAfterSales.length > 0`)
Lists each after-sales item: `product_code`, `product_name`, `quantity`, `resolution_type` badge, `order_number` source. Labelled "MANDATORY carry-forward — these items will be automatically added by the backend when this order is created."

**Zone 4b — Unloaded items amber banner** (shown when `pendingUnloaded.length > 0`)
Lists each unloaded item: `product_code`, `product_name`, `quantity`, `original_order_number` source. Described as "will be auto-carried." Separate loading state (`loadingPending = true`) shows a spinner and "Checking for carry-forward items..." text row in this position. Both banners are absent if neither client nor factory is selected, or if both are selected but no carry-forward data exists.

**Zone 4c — Product search**
Full-width input with search icon; 300ms-debounced `@input`. Below it, an absolutely-positioned dropdown (`z-20`, `max-h-64 overflow-y-auto`) shows `productResults[]` when non-empty. Each row shows `product_code`, `product_name`, part detail string, and a carry-forward badge (amber for unloaded, rose for after-sales) when `pendingCF` is annotated. Clicking a row calls `addProduct(p)`.

**Zone 4d — Order items table**
Shown only when `orderItems.length > 0`. Columns: #, Code, Product, Type, Size, Material, Qty (inline number input), Notes (inline text input), remove button. Empty state replaces the table when `orderItems` is empty: icon + "Search and add products above, browse the catalog, or use bulk paste."

### Zone 5 — Form actions
Right-aligned row: Cancel button (→ `/orders`) and "Create Draft Order" submit button (disabled + spinner when `saving`).

---

### Overlaid modals (5)

| # | Modal | Trigger | z-index |
|---|-------|---------|---------|
| M-1 | Bulk Paste Modal | "Bulk Paste" button | z-50, fixed inset |
| M-2 | Carry Forward Confirmation | handleSubmit() when unloaded items exist | z-50, fixed inset |
| M-3 | Product Browser Modal | "Browse Products" button | z-50, fixed inset |
| M-4 | Quick Add Client Modal | "+ New Client" button | z-50, Teleport to body |
| M-5 | Quick Add Factory Modal | "+ New Factory" button | z-50, Teleport to body |

All modals use custom CSS fixed overlays with a `bg-black/50` backdrop. None use PrimeVue Dialog. M-4 and M-5 use `<Teleport to="body">` to avoid stacking-context issues; M-1, M-2, M-3 are rendered inline in the component root.

---

## Data displayed

### Order Details inputs

| Field | Input type | Source / binding | Required | Notes |
|-------|-----------|-----------------|---------|-------|
| Client | `<select>` | `clients[]` — option text: `company_name` | Yes | Error border on submit if empty |
| Factory | `<select>` | `factories[]` — option text: `company_name` (factory_code not shown in option text, only loaded) | No | |
| Factory Currency | `<select>` | `currencies` const `['CNY','USD','EUR','GBP']` | No | Default CNY |
| Client Currency | Read-only display | Hardcoded "INR" | — | Not an input; always INR |
| PO Reference | `<input type="text">` | `form.po_reference` | No | |
| Notes | `<textarea>` | `form.notes` | No | Full-width, md:col-span-2 |

### After-sales mandatory carry-forward banner (rose-50)

| Field | Source |
|-------|--------|
| Product code | `item.product_code` |
| Product name | `item.product_name` |
| Quantity | `item.quantity` |
| Resolution type badge | `item.resolution_type` |
| Source order | `item.order_number` |

### Unloaded pending carry-forward banner (amber-50)

| Field | Source |
|-------|--------|
| Product code | `item.product_code` |
| Product name | `item.product_name` |
| Quantity | `item.quantity` |
| Source order | `item.original_order_number` |

### Product search results dropdown

| Field | Source | Notes |
|-------|--------|-------|
| Product code | `p.product_code` | Monospace font |
| Product name | `p.product_name` | |
| Detail string | `[p.part_type, p.dimension, p.material, p.category].filter(Boolean).join(' · ')` | |
| Carry-forward badge | `p.pendingCF.type`, `p.pendingCF.qty`, `p.pendingCF.from` | Amber (unloaded) or rose (after-sales); only shown when annotation present |

### Order items table

| Column | Source | Editable |
|--------|--------|---------|
| # | `index + 1` | No |
| Code | `item.product_code` | No |
| Product | `item.product_name` | No |
| Type | `item.part_type` — violet badge; `—` if absent | No |
| Size | `item.dimension` or `—` | No |
| Material | `item.material` or `—` | No |
| Qty | `item.quantity` — number input, min=1, w-20, error border on `errors[qty_N]` | Yes — v-model.number |
| Notes | `item.notes` — text input | Yes — v-model |
| (remove) | — | Button, @click removeItem(index) |

### Product browser table columns

| Column | Source | Notes |
|--------|--------|-------|
| Checkbox | `browserSelected.has(product.id)` | Custom CSS checkbox; disabled if already in order |
| Code | `product.product_code` (mono) + CF badge | Badge: amber (unloaded) or rose (after-sales) via `findPendingCarryForward()` |
| Product Name | `product.product_name` | |
| Variant | `[part_type, dimension, material].filter(Boolean).join(' · ')` or `—` | |
| Category | `product.category` or `—` | |
| MOQ | `product.moq` | Centered |

Row states: already-added → `opacity-50 cursor-not-allowed` with filled check icon; selected → `bg-emerald-50`; carry-forward pending → `bg-violet-50/50`; default → `hover:bg-slate-50`.

### Bulk paste results summary badges

| Badge label | Condition |
|------------|-----------|
| N Found (emerald) | `bulkFoundCount` > 0 |
| N/M Variants (indigo) | `bulkVariantChoiceCount` > 0 |
| N Carry-Forward Duplicates (violet) | `bulkPendingConflictCount` > 0 |
| N Carried Conflicts (orange) | `bulkConflictCount` > 0 |
| N Ambiguous (amber) | `bulkAmbiguousCount` > 0 |
| N Not Found (red) | `bulkNotFoundCount` > 0 |
| N Created (blue) | `bulkCreatedCount` > 0 |

### Bulk paste result row data

Each result row in the scrollable results list displays: `result.code` (mono), `result.quantity`, status badge, and per-status detail UI:

- **FOUND (clean):** matched `product_name` + detail string + "Added (qty: N)" + optional `⭐ default` badge if multi-variant auto-pick
- **CREATED:** "Created & added: product_name (qty: N)"
- **CONFLICT:** carried source order, carried qty, new paste qty; two resolution buttons; post-resolution: "Updated to qty N"
- **AMBIGUOUS:** "N products share this code" + dropdown listing all matches with name+variant detail
- **VARIANT_CHOICE:** radio button per match with name+variant+default star; unselected: "Select a variant to add to order"
- **NOT_FOUND (pendingConflict = false):** "This code is not in the product catalog" + "Quick Add Product" link; inline quick-add form when opened
- **pendingConflict (carry-forward duplicate):** amber/rose conflict box showing type (Unloaded/After-Sales), source order, carried qty; two resolution buttons; post-resolution: confirmation text

### Inline quick-add form fields (inside Bulk Paste, for NOT_FOUND rows)

| Field | Input type | Required | Notes |
|-------|-----------|---------|-------|
| Code | Disabled text | — | Pre-filled from `result.code` |
| Product Name | `<input>` | Yes | |
| Category | `<input>` + `<datalist>` | No | Options from `categories[]` |
| Size / Dimension | `<input>` | No | Placeholder "e.g. 270*122*70" |
| Weight (kg) | `<input type="number" step="0.01">` | No | |
| Type | `<select>` | No | Options: None, Original, Copy, OEM, Aftermarket |
| Material | `<input>` | No | |

---

## Interactions

### Order Details card

| User action | Handler | Outcome |
|------------|---------|---------|
| Select client | Updates `form.client_id` | Triggers `watch([client_id, factory_id])` watcher → loads carry-forward if factory also set |
| Click "+ New Client" | `showClientModal = true` | Opens Quick Add Client Modal (M-4) |
| Select factory | Updates `form.factory_id` | Triggers watcher |
| Click "+ New Factory" | `showFactoryModal = true` | Opens Quick Add Factory Modal (M-5) |
| Change currency | Updates `form.currency` | No API call |
| Type PO Reference | Updates `form.po_reference` | No API call |
| Type Notes | Updates `form.notes` | No API call |

### Products card — header buttons

| User action | Handler | Outcome |
|------------|---------|---------|
| Click "Browse Products" | `openProductBrowser()` | Reset browser state (page=1, selection cleared) + `loadBrowserProducts()` → sets `showProductBrowser = true` |
| Click "Bulk Paste" | `showBulkPaste = true` | Opens Bulk Paste Modal (M-1) |

### Product search

| User action | Handler | Outcome |
|------------|---------|---------|
| Type in search input | `onProductSearch()` — clears `productSearchTimer`, sets 300ms timeout → `productsApi.search(text)` | `productResults[]` populated; already-added products filtered out; `pendingCF` annotation added for matching carry-forward items |
| Click a result row | `addProduct(p)` | Dedup check (skip if `product_id` already in `orderItems`); push item with `qty = product.moq || 1`; clear `productSearch` and `productResults` |

### Order items table

| User action | Handler | Outcome |
|------------|---------|---------|
| Edit Qty field | `v-model.number item.quantity` | Direct mutation on reactive object (Q-2) |
| Edit Notes field | `v-model item.notes` | Direct mutation on reactive object (Q-2) |
| Click remove button | `removeItem(index)` → `orderItems.value.splice(index, 1)` | Direct array splice (Q-1 — immutability violation) |

### Form actions

| User action | Handler | Outcome |
|------------|---------|---------|
| Click "Cancel" | `router.push('/orders')` | Navigate away without saving |
| Click "Create Draft Order" (form @submit) | `handleSubmit()` | Validate → carry-forward check → ordersApi.create() → redirect |

### Bulk Paste Modal (M-1)

| User action | Handler | Outcome |
|------------|---------|---------|
| Click backdrop / X | `closeBulkPaste()` | Resets all bulk state (`bulkText`, `bulkResults`, `bulkProcessed`, `quickAddForms`, `showBulkDoneWarning`) + `showBulkPaste = false` |
| Click "Cancel" (input area) | `closeBulkPaste()` | Same as above |
| Type in textarea | `v-model bulkText` | |
| Click "Validate & Add" | `processBulkPaste()` | Parse lines → `productsApi.validateCodes(codes)` → multi-status result processing → auto-add FOUND items → set `bulkProcessed = true` |
| Click "Back" (results footer) | `bulkProcessed = false; showBulkDoneWarning = false` | Returns to textarea input area |
| Click "Done" (results footer) | `handleBulkDone()` | If `bulkNotFoundCount > 0` → `showBulkDoneWarning = true`; else `closeBulkPaste()` |
| Click "Quick Add Product" link (NOT_FOUND) | `openQuickAdd(rIdx)` | Inserts entry in `quickAddForms[rIdx]` with blank fields |
| Click "Cancel" in quick-add form | `cancelQuickAdd(rIdx)` | Deletes `quickAddForms[rIdx]` + spreads new object |
| Click "Create & Add" in quick-add form | `submitQuickAdd(rIdx)` | `productsApi.create(data)` → auto-push to `orderItems`; marks result status CREATED; closes form for that row |
| Click "Add as Extra Line" (pendingConflict row) | `resolvePendingConflict(rIdx, 'add_extra')` | Pushes separate line item with pasted qty; sets `pendingConflict.action = 'add_extra'` |
| Click "Skip (auto-carried)" (pendingConflict row) | `resolvePendingConflict(rIdx, 'skip')` | Sets `pendingConflict.action = 'skip'`; no push to `orderItems`; backend handles via carry-forward |
| Select variant radio (VARIANT_CHOICE) | `selectVariantChoice(rIdx, m.id)` | Removes previous variant selection from `orderItems` if switching; pushes new variant; sets `result.selectedMatch = m.id` |
| Select from AMBIGUOUS dropdown | `selectAmbiguousMatch(rIdx, $event.target.value)` | Pushes selected match to `orderItems`; sets `result.selectedMatch` |
| Click "Keep qty N" (CONFLICT) | `resolveConflict(rIdx, result.conflict.carriedQty)` | Finds matching `orderItem` reference; sets `qty = chosenQty`; marks `conflict.resolved = true`, `conflict.chosenQty` |
| Click "Use qty N" (CONFLICT) | `resolveConflict(rIdx, result.conflict.newQty)` | Same — updates qty to new paste qty |
| Click "Go Back" (done warning) | `showBulkDoneWarning = false` | Dismisses warning panel |
| Click "Skip & Done" (done warning) | `closeBulkPaste()` | Closes modal, discards NOT_FOUND items |

### Carry Forward Confirmation Modal (M-2)

| User action | Handler | Outcome |
|------------|---------|---------|
| Click backdrop | `showCarryConfirm = false` | Dismisses modal; order not submitted |
| Click "Cancel" | `showCarryConfirm = false` | Same |
| Click "Create Order with Carried Items" | `handleSubmit()` (re-called, now bypasses carry confirm check) | `ordersApi.create(payload)` → redirect to `/orders/${id}?carried=${count}` |

### Product Browser Modal (M-3)

| User action | Handler | Outcome |
|------------|---------|---------|
| Click backdrop / X | `showProductBrowser = false` | Closes modal |
| Type in search input | `onBrowserSearch()` — 400ms debounce → `browserPage = 1` + `loadBrowserProducts()` | Re-fetches with new search term |
| Change category dropdown | `onBrowserCategoryChange()` → `browserPage = 1` + `loadBrowserProducts()` | Re-fetches with category filter |
| Click product row (not already-added) | `toggleBrowserSelect(product)` | `browserSelected` = `new Set(...)` toggle (immutable) |
| Click select-all header div | `toggleSelectAllOnPage()` | Toggles all selectable (non-added) products on current page in/out of `browserSelected` |
| Click Prev/Next buttons | `browserGoToPage(p)` | Updates `browserPage` + `loadBrowserProducts()` |
| Click "Cancel" | `showProductBrowser = false` | |
| Click "Add Selected (N)" | `addBrowserSelected()` | Pushes all selected (non-already-added) products to `orderItems` with `moq || 1` qty; clears `browserSelected`; `showProductBrowser = false` |

### Quick Add Client Modal (M-4)

| User action | Handler | Outcome |
|------------|---------|---------|
| Click backdrop | `showClientModal = false` | |
| Type company name | `v-model newClient.company_name` | |
| Press Enter | `quickCreateClient()` | `clientsApi.create({ company_name })` → `loadClients()` → auto-select new client in `form.client_id` → `showClientModal = false`; on error: `alert()` (D-003 violation) |
| Click "Create Client" | `quickCreateClient()` | Same as Enter |
| Click "Cancel" | `showClientModal = false` | |

### Quick Add Factory Modal (M-5)

| User action | Handler | Outcome |
|------------|---------|---------|
| Click backdrop | `showFactoryModal = false` | |
| Type factory code | `v-model newFactory.factory_code` | |
| Type company name (Enter) | `quickCreateFactory()` | `factoriesApi.create({ company_name, factory_code })` → `loadFactories()` → auto-select → `showFactoryModal = false`; on error: `alert()` (D-003 violation) |
| Click "Create Factory" | `quickCreateFactory()` | Same |
| Click "Cancel" | `showFactoryModal = false` | |

---

## Modals / dialogs triggered

| Modal | Trigger | Purpose | API call on submit |
|-------|---------|---------|-------------------|
| Bulk Paste (M-1) | "Bulk Paste" button | Multi-code entry, validation, conflict/variant/not-found resolution, inline product creation | `productsApi.validateCodes()` on "Validate & Add"; `productsApi.create()` per quick-add |
| Carry Forward Confirmation (M-2) | `handleSubmit()` when `pendingUnloaded.length > 0` and `!showCarryConfirm` | Display unloaded items that will be auto-carried; require explicit user confirmation before order is created | `ordersApi.create()` on confirm button |
| Product Browser (M-3) | "Browse Products" button | Paginated, searchable, category-filtered catalog browse with multi-select | `productsApi.list()` on open and on filter/page changes |
| Quick Add Client (M-4) | "+ New Client" button | Create a new client record without leaving the page | `clientsApi.create()` on confirm |
| Quick Add Factory (M-5) | "+ New Factory" button | Create a new factory record without leaving the page | `factoriesApi.create()` on confirm |

No PrimeVue Dialog component used anywhere — all modals are handwritten fixed-position div overlays.

---

## API endpoints consumed

| Method | Endpoint | When called | Function |
|--------|----------|------------|---------|
| GET | `/api/clients/?per_page=200` | `onMounted`; after quickCreateClient() | `loadClients()` |
| GET | `/api/factories/?per_page=200` | `onMounted`; after quickCreateFactory() | `loadFactories()` |
| GET | `/api/products/categories/` | `onMounted` | `loadCategories()` |
| GET | `/api/products/search/?q=...` | 300ms debounce on productSearch input | `onProductSearch()` via `productsApi.search(text)` |
| GET | `/api/unloaded/?client_id=X&factory_id=Y` (+ pending flag) | `watch([client_id, factory_id])` when both set | via `unloadedApi.getPending(clientId, factoryId)` |
| GET | `/api/after-sales/?client_id=X&factory_id=Y` (+ pending flag) | `watch([client_id, factory_id])` when both set | via `afterSalesApi.getPending(clientId, factoryId)` |
| GET | `/api/products/?page=N&per_page=20&search=?&category=?` | Browser open; search/category filter; page navigation | `loadBrowserProducts()` |
| POST | `/api/products/validate-codes/` | "Validate & Add" in Bulk Paste Modal | `processBulkPaste()` via `productsApi.validateCodes(codes)` |
| POST | `/api/products/` | Inline quick-add submit inside Bulk Paste | `submitQuickAdd(rIdx)` via `productsApi.create(data)` |
| POST | `/api/clients/` | Quick Add Client Modal confirm | `quickCreateClient()` via `clientsApi.create(data)` |
| POST | `/api/factories/` | Quick Add Factory Modal confirm | `quickCreateFactory()` via `factoriesApi.create(data)` |
| POST | `/api/orders/` | Form submit | `handleSubmit()` via `ordersApi.create(payload)` |

The `ordersApi.create()` payload includes: `client_id`, `factory_id`, `currency`, `po_reference`, `notes`, and `items[]` (each with `product_id`, `quantity`, `notes`). Carry-forward items (`pendingAfterSales`) are not included in the payload — they are added server-side. Unloaded carry-forward items are added server-side automatically when the backend detects `pendingUnloaded` for the client+factory pair.

---

## Composables consumed

None. All state is local reactive refs. No `useXxx` composables are imported or instantiated.

---

## PrimeVue components consumed

None. The entire UI — inputs, dropdowns, tables, modals, badges, buttons — is built with raw HTML elements and Tailwind CSS utility classes. PrimeIcons are used throughout for icons via `<i class="pi pi-...">`, but no PrimeVue Vue component is imported. The category field in the quick-add form uses a native HTML `<datalist>` element (not a PrimeVue AutoComplete).

---

## Local state

### Refs

| Variable | Type | Initial value | Purpose |
|----------|------|--------------|---------|
| `saving` | Boolean | `false` | Submit button disabled state + spinner |
| `errors` | Object | `{}` | Validation + API errors: `{ general, items, qty_N }` |
| `successMsg` | String | `''` | Post-submit success message shown before redirect |
| `clients` | Array | `[]` | Full client list from loadClients() |
| `factories` | Array | `[]` | Full factory list from loadFactories() |
| `showClientModal` | Boolean | `false` | Quick Add Client Modal visibility |
| `showFactoryModal` | Boolean | `false` | Quick Add Factory Modal visibility |
| `newClient` | Object | `{ company_name: '' }` | Binding for quick-create client form |
| `newFactory` | Object | `{ company_name: '', factory_code: '' }` | Binding for quick-create factory form |
| `quickSaving` | Boolean | `false` | Quick-create modal submit button disabled state |
| `productSearch` | String | `''` | Search input v-model |
| `productResults` | Array | `[]` | Search results from productsApi.search(); filtered for dedup + carry-forward annotation |
| `searchingProducts` | Boolean | `false` | Loading spinner on search input |
| `productSearchTimer` | `let` (non-reactive) | `undefined` | `setTimeout` handle for search debounce; **not a ref** — cannot be tracked by Vue |
| `form` | Object | `{ client_id: '', factory_id: '', currency: 'CNY', po_reference: '', notes: '' }` | Main order header form binding |
| `orderItems` | Array | `[]` | Line items added to the order |
| `showBulkPaste` | Boolean | `false` | Bulk Paste Modal visibility |
| `bulkText` | String | `''` | Raw paste textarea content |
| `bulkResults` | Array | `[]` | Processed results after processBulkPaste() |
| `bulkProcessed` | Boolean | `false` | Toggle between input view and results view in Bulk Paste Modal |
| `quickAddForms` | Object | `{}` | Per-row inline quick-add form state: `{ [rIdx]: { product_name, category, dimension, unit_weight_kg, part_type, material, saving, error } }` |
| `showBulkDoneWarning` | Boolean | `false` | Done-with-unresolved-NOT_FOUND warning panel visibility |
| `showProductBrowser` | Boolean | `false` | Product Browser Modal visibility |
| `browserSearch` | String | `''` | Browser modal search input |
| `browserCategory` | String | `''` | Browser modal category filter |
| `browserProducts` | Array | `[]` | Current page products in browser |
| `browserLoading` | Boolean | `false` | Browser loading spinner |
| `browserSelected` | Set | `new Set()` | Selected product IDs in browser; replaced with `new Set(...)` on each toggle (immutable) |
| `browserPage` | Number | `1` | Current browser page |
| `browserTotal` | Number | `0` | Total product count from API |
| `categories` | Array | `[]` | Product categories from loadCategories() |
| `pendingUnloaded` | Array | `[]` | Pending unloaded items for selected client+factory |
| `pendingAfterSales` | Array | `[]` | Pending after-sales items for selected client+factory |
| `loadingPending` | Boolean | `false` | Loading state for carry-forward API calls |
| `showCarryConfirm` | Boolean | `false` | Carry Forward Confirmation Modal visibility |

### Constants (non-reactive)

| Variable | Value | Notes |
|----------|-------|-------|
| `currencies` | `['CNY','USD','EUR','GBP']` | Defined as `const` in script setup; not a ref |
| `browserPerPage` | `20` | Defined as `const`; used in `loadBrowserProducts` and `browserTotalPages` computed |

### Computed properties

| Computed | Returns | Formula |
|----------|---------|---------|
| `totalItems` | Number | `orderItems.length` |
| `bulkFoundCount` | Number | `bulkResults` where `status === 'FOUND'` && `!result.conflict` && `!result.pendingConflict` |
| `bulkConflictCount` | Number | `bulkResults` where `!!result.conflict` (already-in-order qty conflict) |
| `bulkPendingConflictCount` | Number | `bulkResults` where `!!result.pendingConflict` (carry-forward duplicate) |
| `bulkAmbiguousCount` | Number | `bulkResults` where `status === 'AMBIGUOUS'` |
| `bulkNotFoundCount` | Number | `bulkResults` where `status === 'NOT_FOUND'` |
| `bulkVariantChoiceCount` | Number | `bulkResults` where `status === 'VARIANT_CHOICE'` |
| `bulkVariantChoiceResolved` | Number | `bulkResults` where `status === 'VARIANT_CHOICE'` && `!!result.selectedMatch` |
| `bulkCreatedCount` | Number | `bulkResults` where `status === 'CREATED'` |
| `bulkUnresolvedAmbiguous` | Number | `bulkResults` where `status === 'AMBIGUOUS'` && `!result.selectedMatch` |
| `bulkUnresolvedConflicts` | Number | `bulkResults` where `!!result.conflict` && `!result.conflict.resolved` |
| `bulkUnresolvedPendingConflicts` | Number | `bulkResults` where `!!result.pendingConflict` && `!result.pendingConflict.action` |
| `isAllOnPageSelected` | Boolean | All non-already-added products on current browser page are in `browserSelected` |
| `isSomeOnPageSelected` | Boolean | Some (but not all) non-already-added products on current page are selected |
| `browserTotalPages` | Number | `Math.ceil(browserTotal / browserPerPage)` |
| `browserSelectableCount` | Number | Count of non-already-added products on current browser page |

### Watcher

```
watch([() => form.value.client_id, () => form.value.factory_id], async ([clientId, factoryId]) => {
  if (clientId && factoryId) {
    loadingPending = true
    [unloadedRes, afterSalesRes] = await Promise.all([
      unloadedApi.getPending(clientId, factoryId),
      afterSalesApi.getPending(clientId, factoryId),
    ])
    pendingUnloaded = unloadedRes.data.items || []
    pendingAfterSales = afterSalesRes.data.items || []
    loadingPending = false
  } else {
    pendingUnloaded = []
    pendingAfterSales = []
  }
}, { immediate: false })
```

Fires only when both `client_id` AND `factory_id` are set. Clears both arrays if either is cleared.

### Lifecycle

`onMounted`: Calls `loadClients()`, `loadFactories()`, and `loadCategories()` in parallel (three awaited Promise.all or sequential calls — parallel is preferable and should be enforced in Next.js via TanStack Query).

---

## Permissions / role gating

No role checks exist in this component. Access is controlled entirely by router-level route guards and backend auth.

**P-014 cross-check — mutation endpoints used by this page:**

| Endpoint | Handler function | Status |
|----------|----------------|-------|
| `POST /api/orders/` | `ordersApi.create()` | Check backend `orders.py` for inline `current_user` role check — not audited in this wave |
| `POST /api/clients/` | `clientsApi.create()` | G-013 patched (CLOSED 2026-04-22) — inline ADMIN check added |
| `POST /api/factories/` | `factoriesApi.create()` | G-012 patched (CLOSED 2026-04-22) — inline ADMIN check added |
| `POST /api/products/` | `productsApi.create()` | G-011 patched (CLOSED 2026-04-22) — inline ADMIN check added |

**Action:** Verify `POST /api/orders/` has inline `current_user` with ADMIN|OPERATIONS role check in `orders.py`. This endpoint is the primary mutation on this page; if it only relies on router-level `Depends(get_current_user)`, any valid JWT can create orders. This should be confirmed as part of the `orders.py` profile (Wave 7).

**P-007 cross-check — factory cost field exposure:**

`productsApi.search()` returns product objects that are annotated with `pendingCF` in the frontend and pushed directly into `orderItems`. Verify that the backend search serializer does not include `factory_price`, `factory_price_usd`, `cost_cny`, `markup`, or `*_cny` fields in the search response. These fields are visible in the browser if serialized. Add to Wave 0 security checklist.

---

## Bilingual labels (InternalString)

The component imports no InternalString composable and uses hardcoded English strings throughout. Full extraction required for the Next.js migration.

Expected InternalString keys (non-exhaustive):

| Location | String |
|----------|--------|
| Page title | "New Order (Draft)" |
| Page subtitle | "Stage 1 — Select client, factory, and add products" |
| Client label | "Client" |
| Factory label | "Factory" |
| Currency labels | "Factory Currency", "Client Currency" |
| PO Reference label | "PO Reference" |
| Notes label | "Notes" |
| Products card title | "Products (N items)" |
| Empty state | "Search and add products above, browse the catalog, or use bulk paste" |
| Submit button | "Create Draft Order" |
| Cancel button | "Cancel" |
| After-sales banner heading | "MANDATORY carry-forward" |
| Unloaded banner heading | "N unloaded item(s) will be auto-carried" |
| Bulk paste modal title | "Bulk Paste Product Codes" |
| Status badge labels | "Found", "Variants", "Carry-Forward Duplicates", "Carried Conflicts", "Ambiguous", "Not Found", "Created" |
| Quick-add field labels | "Product Name", "Category", "Size / Dimension", "Weight (kg)", "Type", "Material" |
| Part type options | "None", "Original", "Copy", "OEM", "Aftermarket" |
| Quick-add submit | "Create & Add" |
| Browser modal title | "Browse Products" |
| Browser column headers | "Code", "Product Name", "Variant", "Category", "MOQ" |
| Carry confirm modal title | "Items Will Be Carried Forward" |
| Quick Add Client modal title | "New Client" |
| Quick Add Factory modal title | "New Factory" |
| Error messages (validation) | (all inline English strings) |

---

## Empty / error / loading states

| State | Trigger | Handling |
|-------|---------|---------|
| No order items | `orderItems.length === 0` | Full-width empty state: `pi-box` icon + instructional text |
| Product search loading | `searchingProducts = true` | Spinner at right edge of search input |
| Carry-forward loading | `loadingPending = true` | Spinner row: "Checking for carry-forward items..." |
| No pending carry-forward | `pendingUnloaded.length === 0` && `pendingAfterSales.length === 0` | Neither banner shown |
| No browser products | `browserProducts.length === 0` && `!browserLoading` | "No products found" empty state with `pi-box` icon |
| Browser loading | `browserLoading = true` | Full-panel spinner + "Loading products..." text |
| Client required error | `errors.general` set by validate() | Red banner below success banner |
| Items required error | `errors.items` set by validate() | Red banner above items table |
| Item quantity error | `errors[qty_N]` set | Red border on that qty input |
| Quick-add form error | `quickAddForms[rIdx].error` set | Red text below quick-add form |
| Quick-add submitting | `quickAddForms[rIdx].saving = true` | Spinner on "Create & Add" button |
| Modal quick-create saving | `quickSaving = true` | "Creating..." text on modal submit button; button disabled |
| Form submitting | `saving = true` | Spinner on submit button; button disabled |
| Post-submit success | `successMsg` set | Green banner shown; 600ms timeout then router.push() |
| Bulk results unresolved (footer) | `bulkUnresolved*` computed > 0 | Status text in bulk footer: describes what needs resolution |
| Done warning (NOT_FOUND remaining) | `handleBulkDone()` when `bulkNotFoundCount > 0` | Warning panel with "Go Back" and "Skip & Done" options |

---

## Business rules

1. **Client required; factory optional.** `validate()` fails if `form.client_id` is empty. Factory may be omitted at draft creation and added during the pricing stage.

2. **Order requires at least one item.** `validate()` fails if `orderItems.length === 0`. Error shown in `errors.items` banner.

3. **All quantities must be ≥ 1.** `validate()` iterates `orderItems` and sets `errors[qty_N]` for each item with `quantity < 1`.

4. **Client currency is always INR.** Factory currency defaults to CNY but can be changed to USD/EUR/GBP. The readonly INR display is not part of the form payload.

5. **Carry-forward watcher fires only when BOTH client and factory are selected.** If either field is blank, `pendingUnloaded` and `pendingAfterSales` are cleared and no API call is made.

6. **After-sales items are mandatory, server-side only.** Items in `pendingAfterSales` are displayed as a rose banner but are never pushed into `orderItems`. They are added to the order by the backend automatically on `POST /api/orders/`. The frontend communicates their existence only via display; they do not appear in the submit payload.

7. **Unloaded items are optional, requiring user confirmation.** If `pendingUnloaded.length > 0` when `handleSubmit()` is called for the first time (`!showCarryConfirm`), the submit is interrupted and the Carry Forward Confirmation Modal (M-2) is shown. Only when the user confirms does `handleSubmit()` re-execute with `showCarryConfirm = true`, bypassing the gate.

8. **After carry-forward order creation, redirect includes a `?carried=N` param.** The order detail page reads this param to display a notification: "N items were automatically carried forward."

9. **Default quantity for added products is `moq || 1`.** If a product has a minimum order quantity, it is pre-filled.

10. **Product deduplication on add.** `addProduct(p)` and `addBrowserSelected()` both check if `product_id` is already in `orderItems` and skip duplicates silently.

11. **Bulk paste line format:** `"ProductCode Quantity"` (space-separated). Quantity is optional; omitting it defaults to 1. Empty lines are ignored.

12. **Bulk paste status semantics:**
    - `FOUND` (single match, no conflict): auto-added immediately to `orderItems` during `processBulkPaste()`.
    - `FOUND` with multiple matches (no `VARIANT_CHOICE` flag): backend returns a default variant; auto-added with `⭐ default` badge shown in results.
    - `VARIANT_CHOICE` (multiple variants, explicit choice needed): NOT auto-added; user must select via radio button; `selectVariantChoice()` replaces prior selection if changed.
    - `FOUND` + `pendingConflict` (product is already a pending carry-forward item): user chooses "Add as Extra Line" or "Skip"; skip means the carry-forward mechanism handles it.
    - `FOUND` + `conflict` (product already in `orderItems` as a carried item): qty conflict requiring user selection between carried qty and new paste qty.
    - `NOT_FOUND`: not in catalog; quick-add form available inline; user can create product and auto-add.
    - `AMBIGUOUS`: multiple unrelated products share the same code; user selects via dropdown.
    - `CREATED`: product was quick-added during this bulk session; already pushed to `orderItems`.

13. **`findPendingCarryForward()` checks `pendingUnloaded` only, not `pendingAfterSales`.** Comment in source: "after-sales should NOT trigger duplicate warnings — they get auto-added by backend." This is an intentional asymmetry (see Q-7).

14. **Product browser uses proper server-side pagination** at `per_page = 20` with prev/next controls. This contrasts positively with P-009 (limit:N with no pagination) — the browser is one of the few places in the codebase that handles pagination correctly.

15. **Client and factory lists load with `per_page: 200` — a hard ceiling.** If the ERP manages more than 200 clients or factories, the dropdown silently truncates the list (Q-4).

16. **`handleSubmit()` is the submit handler for both the primary form `@submit` event and the carry-forward modal confirm button.** On first call: detects unloaded items → shows modal. On second call (from modal): `showCarryConfirm` is `true` → submits directly. This double-call pattern is fragile (Q-6).

17. **After-sales conflict type in `pendingConflict`:** The `pendingConflict.type` can be `'unloaded'` or `'after_sales'`; the UI colors and labels differ accordingly (amber vs rose). This is the bulk-paste equivalent of the separate banner logic in the main form.

---

## Known quirks

| # | Quirk | Impact |
|---|-------|--------|
| Q-1 | `removeItem(index)` uses `orderItems.value.splice(index, 1)` — direct array mutation | Immutability violation per coding-style.md. Should use `orderItems.value = orderItems.value.filter((_, i) => i !== index)`. |
| Q-2 | Order items table uses `v-model.number item.quantity` and `v-model item.notes` — direct v-model on reactive array element objects | Mutation of objects inside a reactive array. While Vue 3 proxies allow this to work, it violates the immutability principle. In React, these must be replaced with `setState(prev => prev.map(...))`. |
| Q-3 | `productSearchTimer` is a non-reactive `let` variable | Vue cannot track it; reassigning inside the async callback works functionally but leaks if component is unmounted while a timer is pending. No `onUnmounted` cleanup. |
| Q-4 | `loadClients()` and `loadFactories()` use `per_page: 200` hard ceiling | Clients or factories beyond position 200 are silently absent from the dropdown. In production environments with large rosters this would truncate the list with no indication. |
| Q-5 | `quickCreateClient()` and `quickCreateFactory()` use `alert()` on error | D-003 violation × 2. Replace with `<ConfirmDialog>` or toast notification in Next.js. |
| Q-6 | `handleSubmit()` is called twice during the carry-forward confirm flow | First call detects `pendingUnloaded` and sets `showCarryConfirm = true`. Second call (from modal button) bypasses the check. This is a one-way flag within a single submit cycle; any other trigger that re-calls `handleSubmit()` after the modal is visible would also skip the confirmation. Fragile design. |
| Q-7 | `findPendingCarryForward()` checks only `pendingUnloaded`, not `pendingAfterSales` | Intentional (comment in source), but asymmetric. After-sales items appear in the rose banner but do not annotate search results or browser rows. A user searching for an after-sales item in the search field will not see the rose badge that would appear on the unloaded equivalent. |
| Q-8 | `browserSelectableCount` computed is declared but may not be directly referenced in any template expression | If `isAllOnPageSelected` and `isSomeOnPageSelected` compute their own filter inline, `browserSelectableCount` is dead. Verify in Wave 0. |

---

## Dead code / unused state

- `browserSelectableCount` computed — likely unused in template; `isAllOnPageSelected` and `isSomeOnPageSelected` each reference their own inline filter. Confirm by grep in Wave 0.
- No other unused refs or dead functions identified from source read.

---

## Duplicate or inline utilities

- **P-010 instance × 2:** Both `onProductSearch()` (300ms) and `onBrowserSearch()` (400ms) implement raw `setTimeout` / `clearTimeout` debounce inline. Neither uses a shared utility. In the Next.js rebuild, replace both with a shared `useDebounce(fn, delay)` hook consistent with the recommendation in P-010.

- **`findPendingCarryForward(productId, productCode)` inline function** — called in both the search results dropdown and the browser product rows. If additional order-editing pages (e.g., a future OrderEdit.vue) need carry-forward detection, extract to a `useCarryForward(pendingUnloaded, pendingAfterSales)` composable that exposes this lookup as a pure function.

- **`processBulkPaste()` — monolithic inline function** (~80 lines of status-classification logic). This function parses the raw text, calls the API, and then classifies each result across six possible status branches. It is untestable as-is because it both calls the API and mutates component state. In the Next.js rebuild, extract the classification logic to a pure function `classifyBulkResults(validationResponse, existingItems, pendingCarryForward)` that can be unit-tested independently of the component.

- **Bulk status badge rendering** — color-class selection for result row icons and badges is inline conditional class expressions (`:class="[...]"`) distributed across the template. If a bulk-result table is needed in other contexts (e.g., an order edit page with re-paste), extract to a `BulkResultRow` component.

---

## Migration notes

1. **Route:** `/orders/new` — Next.js App Router page at `app/(internal)/orders/new/page.tsx`. Protect with ADMIN|OPERATIONS role check at the layout or middleware level.

2. **Client/factory dropdowns — replace per_page:200 with async combobox.** Use TanStack Query with debounced search input calling `clientsApi.list({ search, per_page: 20 })` — lazy-load as the user types. This removes the Q-4 hard ceiling and scales to large rosters.

3. **Carry-forward watcher → TanStack Query.** Replace with a query configured as `enabled: !!clientId && !!factoryId`. Use `useQuery(['carry-forward', clientId, factoryId], ...)` to fetch both unloaded and after-sales data simultaneously. Invalidate on client/factory change via query key.

4. **Quick-create modals — remove `alert()` (D-003 × 2).** Replace error paths in `quickCreateClient()` and `quickCreateFactory()` with toast notifications or inline error state on the modal.

5. **Bulk paste modal — extract pure classification logic.** Port `processBulkPaste()` classification as `classifyBulkResults(apiResponse, existingItems, pendingCarryForward): BulkResult[]`. Test this function in isolation. The React component calls `productsApi.validateCodes()` and passes the response to the pure classifier.

6. **Bulk paste multi-step state** — `bulkProcessed` toggles between "input view" and "results view". In React, model this as a discriminated state: `{ phase: 'input' | 'results', data?: BulkResult[] }`.

7. **Order items table — port to immutable patterns.** Replace `removeItem` splice with `setOrderItems(prev => prev.filter((_, i) => i !== index))`. Replace inline `v-model` mutations with `setOrderItems(prev => prev.map((item, i) => i === index ? { ...item, quantity: newQty } : item))`.

8. **handleSubmit double-call pattern (Q-6) — redesign.** Separate into two explicit functions: `validateAndProceed()` (validates form, checks carry-forward, shows modal if needed) and `submitOrder()` (calls API). The "Create Order with Carried Items" modal button calls `submitOrder()` directly.

9. **Product browser pagination** — current `prev/next` only. Extend to show page number buttons or implement infinite scroll for large catalogs. The per_page=20 and server-side pagination structure are correct — only the UI controls need enhancement.

10. **P-014 verified — `POST /api/orders/` is correctly guarded.** Verified 2026-04-22: handler signature is `def create_order(data: OrderCreate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user))` with an inline check `if current_user.role not in ("ADMIN", "SUPER_ADMIN", "OPERATIONS"): raise HTTPException(403)`. Only INTERNAL ADMIN, SUPER_ADMIN, and OPERATIONS roles can create orders. CLIENT and FACTORY tokens are rejected. AUTHZ_SURFACE.md classifies this endpoint as OK (orders.py:902). No G-016 raised.

11. **P-007 verified — `productsApi.search()` does not expose factory pricing fields.** Verified 2026-04-22: `GET /api/products/search/` returns `ProductOut` (inherits `ProductCreate`) which contains no `factory_price`, `factory_price_usd`, `markup_percent`, or `*_cny` cost fields. Factory pricing is an `OrderItem`-level concept; the `Product` model does not store per-unit factory cost at all. **Secondary observations (LOW):** (a) `ProductOut.notes` is in `CLIENT_HIDDEN_FIELDS` but is returned without `filter_for_role` because the handler has no `current_user` parameter — product-level notes are visible to CLIENT tokens; (b) `ProductOut.factory_part_number` is not in `CLIENT_HIDDEN_FIELDS` and is returned to all callers — may reveal supply chain identity; classification as hidden is unresolved. Neither rises to HIGH. In the Next.js rebuild, the product search API type should be generated from a `ProductSearchResult` schema that explicitly omits `notes` and clarifies whether `factory_part_number` should be stripped for CLIENT callers.

12. **P-010 × 2 — debounce.** Both search inputs (300ms product search, 400ms browser search) use raw `setTimeout`. In Next.js, replace with a `useDebounce` hook or TanStack Query's `placeholderData` + debounced state approach. Standardize on 300ms per P-010 recommendation (browser can align to 300ms from 400ms).

13. **`findPendingCarryForward()` asymmetry (Q-7)** — In Next.js, decide whether to surface after-sales badges in search results. If after-sales items are truly backend-only, the banner is sufficient and the asymmetry is acceptable. Document the decision in DECISIONS.md during Wave 0.

14. **After-sales mandatory items** — the rose banner is read-only and informational only. In the Next.js page, render this as a clearly labeled `<CarryForwardMandatoryBanner items={afterSalesItems} />` component. Do not include these items in the order payload.

15. **InternalString extraction** — all ~30+ hardcoded English strings listed in the Bilingual labels section must be extracted to InternalString keys before the migration goes live.

16. **`browserSelectableCount` (Q-8)** — if confirmed dead in Wave 0, remove from the Next.js port. Do not carry unused computeds forward.

17. **`consolidateByProduct()` dead code (D-007)** — not present in this file. No action needed here.

18. **P-020 check** — `getInitials()` and `getAvatarColor()` utilities (identified in `OrderList.vue`) are NOT present in `OrderDraft.vue`. No P-020 instance here.
