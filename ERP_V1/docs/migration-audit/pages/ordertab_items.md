# Profile: ordertab_items

## Metadata
- **Source file:** `frontend/src/components/order/OrderItemsTab.vue`
- **Lines:** 3,331 — largest single component in the codebase
- **Type:** component (sub-tab)
- **Portal:** internal
- **Tab slug:** `items`
- **Parent shell:** `OrderDetail.vue`
- **Wave:** Wave 8
- **Profile generated:** 2026-04-22

---

## Purpose

Manages the complete item lifecycle for an order. Covers: item display (read-only or editable pricing table), factory/selling price entry, PI generation and download, mid-order item additions (single product browser, bulk text add, Excel item upload), item removal with cancel notes, carry-forward detection and labelling, item-level query threads (slide-out panel), and a full-screen image lightbox for product thumbnails. The component has two primary operational modes gated by order stage:

- **Stage 2 (PENDING_PI)**: Full editing — price inputs, item add/remove, bulk operations, PI generation.
- **All other stages**: Read-only table + limited add/remove for mid-order additions.

---

## Layout / visual structure

```
┌─────────────────────────────────────────────────┬──────────────────┐
│ LEFT (lg:col-span-2)                            │ RIGHT sidebar    │
│                                                 │                  │
│ Order Info Card (client, factory, currency,     │ Quick Info       │
│   exchange rate, created, item count)           │   status, stage  │
│                                                 │   currency, rate │
│ [Carried Items Summary Banner] — if any         │                  │
│                                                 │ Tentative Invoice│
│ [PI Staleness Warning] — if items changed       │   factory total  │
│                                                 │   selling total  │
│ ─── PI Actions section (post-PI) ───           │                  │
│   Generate PI / Download PI / Regenerate PI     │ Pricing Guide    │
│   PI result: number, total INR, advance, bal    │  (Stage 2 only)  │
│                                                 │                  │
│ ─── Pricing Section (Stage 2 edit mode) ───    │                  │
│   Toolbar: Done | Refresh | Add Item | Bulk Add │                  │
│            Fetch Pending | Remove (N) | Copy    │                  │
│            Apply Markup | Bulk Price Upload     │                  │
│   Copy result message + price sources           │                  │
│   Missing prices warning (specific items list)  │                  │
│   Active Items Pricing Table                    │                  │
│     Checkbox | # | Product | Qty | Factory |   │                  │
│     [ClientFactory] | Markup% | Selling | Total │                  │
│     → Column set changes for TRANSPARENCY       │                  │
│   Totals footer row                             │                  │
│   Pricing Guide footer (auto-save notice)       │                  │
│   Removed Items (collapsible) — if any          │                  │
│                                                 │                  │
│ ─── Pending Additions by Lot ───               │                  │
│   (visible when items in PENDING_APPROVAL)      │                  │
│   Per-lot card: [Upload Excel] [Add Item]       │                  │
│   [Send Prices to Client] (when priced)         │                  │
│   Rejected Items (30% opacity)                  │                  │
│                                                 │                  │
│ ─── Client Confirmed Items ───                 │                  │
│   Awaiting ADMIN final approval                 │                  │
│   [Approve & Add to Order]                      │                  │
│                                                 │                  │
│ ─── Items Table (read-only / view mode) ───    │                  │
│   Code | Product | Qty | Query | Factory |      │                  │
│   [ClientFactory] | Selling | Total | [Remove]  │                  │
│   → Image thumbnail column                      │                  │
│   → Inline query column (toggleable)            │                  │
│   Removed Items (collapsible)                   │                  │
└─────────────────────────────────────────────────┴──────────────────┘

Overlays (fixed-position, z-50):
  • Add Item Modal (product browser + pagination)
  • Bulk Text Add Modal (preview/apply flow)
  • Remove Item(s) Confirmation Modal
  • Bulk Price Upload Modal (text paste + Excel file tabs)
  • Bulk Pending Confirm Dialog
  • Item Query Panel (slide-out, right edge)
  • Image Viewer Lightbox (scroll-zoom + drag-pan)
```

---

## Data displayed

| Section | Key fields |
|---|---|
| Order info card | `order.client_name`, `factory_name`, `currency`, `exchange_rate`, `created_at`, `item_count`, `total_value_cny`, `reopen_count`, `notes` |
| Pricing table | `item.product_code`, `product_name`, `quantity`, `factory_price`, `markup_percent`, `selling_price_inr`, computed total (qty × selling) |
| Transparency columns | `item.client_factory_price` (via `cfp()` accessor), client factory INR (cfp × exchange_rate) |
| Dual-column (SUPER_ADMIN + TRANSPARENCY) | Both real `factory_price` AND `client_factory_price` side-by-side |
| Carry-forward badges | Detected via `item.notes` parsing → "Unloaded" (amber) or "After-Sales N items from ORD-xxx" (rose) |
| PI result | `piResult.pi_number`, `grand_total_inr`, `advance_percent`, `advance_amount_inr`, `balance_amount_inr` |
| Query column | `inlineQueryStatus[item.id].status`, `last_query`, `last_reply`, `resolution_remark` |
| Totals footer | `totalQty`, `totalFactoryUsd`, `totalClientFactoryUsd`, `totalSellingInr`, `totalClientFactoryInr` |

---

## Interactions

### Stage 2 Pricing Mode
| Action | Handler | API |
|---|---|---|
| Enter factory price (blur) | `handleFactoryOrMarkupBlur` → auto-calculates selling, saves | `ordersApi.updateItemPrices` |
| Enter markup % (blur) | `handleFactoryOrMarkupBlur` → recalculates selling price | `ordersApi.updateItemPrices` |
| Enter selling price directly (blur) | `handleSellingPriceBlur` → back-calculates markup, sets customPriceFlag | `ordersApi.updateItemPrices` |
| Copy from last order | `copyFromPreviousOrder()` | `ordersApi.copyPreviousPrices` |
| Apply markup to all | `applyMarkupToAll()` — skips aftersales items | `ordersApi.updateItemPrices` per item |
| Edit quantity (dbl-click) | `startEditQty` → inline input → `saveEditQty` | `ordersApi.updateItem({ quantity })` |
| Select all / deselect | `toggleSelectAll()` | none |
| Remove single item | `openRemoveSingle` → modal → `confirmRemoveItems` | `ordersApi.removeItemWithNote` |
| Remove bulk (selected) | `openRemoveBulk` → modal | `ordersApi.removeItemWithNote` per item |
| Quick remove (read-only stage) | `quickRemoveItem(item)` | `ordersApi.removeItemWithNote` |
| Generate PI | `generatePI()` | `quotationsApi.generatePI` |
| Download PI | `downloadPI()` | `quotationsApi.downloadPI` |
| Download PI with images | `downloadPIWithImages()` | `quotationsApi.downloadPIWithImages` |
| Fetch pending items | `fetchPendingItems()` | `ordersApi.fetchPendingItems` |
| Recalculate prices | [button in toolbar] | `ordersApi.recalculatePrices` |
| Reset after-sales prices | [button in toolbar] | `ordersApi.resetAftersalesPrices` |
| Send pending prices to client | `sendPricesToClient()` | `ordersApi.sendPendingPrices` |
| Approve client-confirmed items | `bulkConfirmPending('approve')` | `ordersApi.bulkConfirmItems` |

### Item Browser (Add Item Modal)
| Action | Handler | API |
|---|---|---|
| Search products | `onAddItemSearch()` — 400ms debounced setTimeout | `productsApi.list({ search, category, page })` |
| Filter by category | `onAddItemCategoryChange()` | `productsApi.list` |
| Paginate | `addItemGoToPage(p)` | `productsApi.list` |
| Add product to order | `addProductToOrder(product)` | `ordersApi.addItems` |
| Load categories (once) | `openAddItemModal()` → if empty | `productsApi.categories()` |

### Bulk Text Add
| Action | Handler | API |
|---|---|---|
| Preview | `bulkAddPreview()` | `ordersApi.bulkTextAddPreview` |
| Resolve duplicate (club / keep / replace) | `resolveBulkDuplicate(idx, resolution)` | none (local state) |
| Resolve ambiguous | `bulkAddResolveAmbiguous(r, productId)` | none (local state) |
| Apply | `bulkAddApply()` | `ordersApi.bulkTextAddApply` |

### Bulk Price Upload
| Action | Handler | API |
|---|---|---|
| Paste text → parse | `parseBulkPrices()` | none (client-side) |
| Upload Excel → parse | `handlePriceExcelUpload()` | none (ExcelJS client-side) |
| Apply matched prices | `applyBulkPrices()` | `ordersApi.updateItemPrices` per matched item |

### Query Panel
| Action | Handler | API |
|---|---|---|
| Open panel for item | `openQueryPanel(item)` | `queriesApi.list(orderId, itemId)` |
| Create new query | `createQuery()` | `queriesApi.create` |
| Send thread reply | `sendThreadReply()` | `queriesApi.reply` |
| Resolve thread | `resolveQuery(threadId)` | `queriesApi.resolve` |
| Send inline query (from row) | `sendInlineQuery(item)` | `queriesApi.create` or `queriesApi.reply` |
| Upload attachment to thread | `onThreadFileSelect()` | file upload endpoint (implied) |

### Image Lightbox
- Open: `openImageViewer(url, label)` — triggered by clicking product image thumbnail
- Scroll wheel: zoom in/out (`viewerZoom` ref)
- Mouse drag: pan the image (`viewerPan` ref)
- Close: click backdrop or close button

---

## Modals / dialogs triggered

1. **Add Item Modal** — Product browser with search + category filter + paginated table. Marks already-added products as disabled. Shows "Removed" badge for previously removed products (restore allowed).
2. **Bulk Text Add Modal** — Two-step: paste codes → preview results (FOUND/ALREADY_IN_ORDER/NOT_FOUND/AMBIGUOUS) → resolve duplicates → apply. Success state shown after apply.
3. **Remove Item(s) Modal** — Lists items to be removed, optional cancel note textarea. Single or bulk.
4. **Bulk Price Upload Modal** — Tab-switcher (Paste Text | Upload Excel). Preview table with matched/not-found rows. Apply button only enabled when matched rows exist.
5. **Bulk Pending Confirm Dialog** — Approve or Reject client-confirmed items. Simple confirm dialog.
6. **Item Query Panel** — Slide-out from right edge. Thread list view → thread detail (chat bubble view). New query form with type selector (GENERAL, PHOTO_REQUEST, VIDEO_REQUEST, DIMENSION_CHECK, QUALITY_QUERY, ALTERNATIVE). Reply input + file attachment. Resolve button.
7. **Image Viewer Lightbox** — Full-screen with zoom/pan controls. Product code + name as label.

---

## API endpoints consumed

| Endpoint | Purpose |
|---|---|
| `ordersApi.updateItemPrices(orderId, itemId, prices)` | Save factory/markup/selling price per item (auto-save on blur) |
| `ordersApi.updateItem(orderId, itemId, { quantity })` | Update quantity |
| `ordersApi.addItems(orderId, { items })` | Add single product via browser |
| `ordersApi.removeItemWithNote(orderId, itemId, note)` | Remove item with optional cancel note |
| `ordersApi.bulkTextAddPreview(orderId, text)` | Preview bulk text add |
| `ordersApi.bulkTextAddApply(orderId, payload)` | Apply bulk text add with duplicate resolutions |
| `ordersApi.bulkConfirmItems(orderId, action)` | Approve/reject client-confirmed pending items |
| `ordersApi.sendPendingPrices(orderId)` | Send pending addition prices to client |
| `ordersApi.copyPreviousPrices(orderId)` | Copy factory prices from last order with same factory |
| `ordersApi.recalculatePrices(orderId)` | Recalculate all selling prices from current markup |
| `ordersApi.resetAftersalesPrices(orderId)` | Reset after-sales item pricing |
| `ordersApi.fetchPendingItems(orderId)` | Pull pending carry-forward items into order |
| `productsApi.list(params)` | Product browser search (add-item modal) |
| `productsApi.categories()` | Category filter dropdown for browser |
| `quotationsApi.generatePI(orderId)` | Generate Proforma Invoice |
| `quotationsApi.downloadPI(orderId)` | Download PI as XLSX |
| `quotationsApi.downloadPIWithImages(orderId)` | Download PI with embedded product images as XLSX |
| `queriesApi.list(orderId, itemId)` | Load query threads for an item |
| `queriesApi.create(payload)` | Create new query thread |
| `queriesApi.reply(threadId, message, attachments)` | Reply to thread |
| `queriesApi.resolve(threadId, remark)` | Resolve thread |

**ExcelJS** (npm package): used client-side in `handlePriceExcelUpload` to parse `.xlsx` factory price list files with auto-detection of Part No. and UNIT PRICE columns.

---

## Composables consumed

None directly imported. `isSuperAdmin` is received as a prop from the parent shell (not consumed via `useAuth` inside this component).

---

## PrimeVue components consumed

PrimeVue Icons (`pi-*`) throughout. No PrimeVue form components or overlay components — all inputs are native HTML, all modals are custom Tailwind overlays.

---

## Local state

Key computed properties (partial list):
```javascript
const isDraft = computed(() => props.order?.status === 'DRAFT')
const isPostPI = computed(() => ...)        // status after PI generation
const canEditPrices = computed(() => ...)   // Stage 2 only
const canModifyItems = computed(() => ...)  // Stage 2 or specific later stages
const isTransparencyClient = computed(() => props.order?.client_type === 'TRANSPARENCY')
const showDualPriceColumns = computed(() => props.isSuperAdmin && isTransparencyClient.value)
const canEditFactoryPrices = computed(() => !isTransparencyClient.value || props.isSuperAdmin)
const sortedItems = computed(() => ...)     // Groups: [unloaded → aftersales → regular → mid-order]
const confirmedItems = computed(() => ...)  // Items in APPROVED status (not pending)
const activeItems = computed(() => ...)     // Non-removed confirmed items
const pendingAdditions = computed(() => ...)
const clientConfirmedItems = computed(() => ...)
const rejectedAdditions = computed(() => ...)
const carriedItems = computed(() => ...)    // Items with carry-forward notes
const itemsMissingPrices = computed(() => ...)
const piIsStale = computed(() => ...)       // items changed since last PI generation
const totalSellingInr = computed(() => ...)
const totalFactoryUsd = computed(() => ...)
// … and ~20 more computed refs
```

Key state refs: `isEditing`, `priceSaving[itemId]`, `customPriceFlags[itemId]`, `editingQty[itemId]`, `inlinePriceEdit[itemId]`, `selectedItems` (Set), `sortKey`, `sortOrder`, `viewerImage`, `viewerZoom`, `viewerPan`, `showQueryPanel`, `queryPanelItem`, `selectedThread`, `inlineQueryStatus[itemId]`, `piResult`, `copyResult`, `fetchPendingResult`.

---

## Permissions / role gating

| Feature | Gate |
|---|---|
| Price editing (factory/markup) | `canEditFactoryPrices`: hidden for TRANSPARENCY client when not SUPER_ADMIN |
| Dual-price column | `showDualPriceColumns`: only when `isSuperAdmin && isTransparencyClient` |
| PI generation | `canGeneratePI`: only at Stage 2 (PENDING_PI) |
| Item add/remove | `canModifyItems`: Stage 2 or mid-order stage |
| Apply Markup / Copy Prices / Bulk Upload | `canEditFactoryPrices` (same as factory price editing) |

`isSuperAdmin` prop is passed from the shell via `useAuth`. No `useAuth` call inside this component — role data flows through props.

---

## Bilingual labels (InternalString)

None. All labels English-only.

---

## Empty / error / loading states

- **No items**: Read-only table shows "No items" placeholder. Pricing table shows empty state when no active items.
- **PI error**: `piError` ref displays inline error below PI actions section.
- **Bulk add failure**: `bulkAddResults` shows status per line; `NOT_FOUND` rows styled in red.
- **Excel parse error**: `alert('Failed to parse Excel file: ' + err.message)` — D-003 violation.
- **Empty Excel file**: `alert('Empty Excel file')` × 2 — D-003 violations.
- **Column detection failure**: `alert('Could not find part code and price columns...')` — D-003 violation.
- **Fetch pending items**: `fetchPendingResult` shown as banner (teal success / slate info) for 5 seconds via `setTimeout`.
- **Price save error**: `priceSaving[item.id]` spinner shown per-item; errors logged to console only (P-002 pattern — not surfaced to user).
- **Remove error**: Logged to console only.

---

## Business rules

1. **Price auto-save on blur**: `factory_price`, `markup_percent`, and `selling_price_inr` all auto-save on `@blur`. No explicit "Save" button for individual prices.
2. **Auto-calculation chain**: `factory_price × (1 + markup/100) × exchange_rate = selling_price_inr`. Back-calculation on direct selling price entry: `markup = (selling/factory - 1) × 100`. If selling price is entered directly (not from markup), `customPriceFlags[item.id]` is set and an orange warning icon appears.
3. **After-sales items are price-locked**: Items with carry-forward type `aftersales` have all price inputs disabled. Their prices are fixed by the after-sales process.
4. **PI staleness**: If items are added/removed/repriced after the last PI generation, `piIsStale` is true and a red warning banner blocks the items view, prompting regeneration.
5. **Mid-order additions (lots)**: Items added after Stage 2 are grouped by `pi_addition_lot` number. Each lot has its own price-entry workflow (Send Prices to Client → client confirms → ADMIN approves).
6. **Bulk text add duplicate resolution**: Three strategies — `club` (add qty to existing), `keep_existing` (skip new), `keep_new` (replace with new qty). All must be resolved before Apply is enabled.
7. **Excel price matching**: Column auto-detection checks the first 5 rows for keywords (`'Part No'`, `'UNIT PRICE'`, `'单价'`). Prefers MFR Part No. column; falls back to second Part No. column (factory Excel format: first = barcode, second = MFR code). Falls back to hardcoded column indices if headers not found.
8. **Item sort ordering**: `sortedItems` groups items into sections: unloaded carry-forwards → after-sales carry-forwards → regular confirmed items → mid-order approved additions. Within each group, sorted by `sortKey`/`sortOrder`. Visual separator line rendered after last carry-forward item.
9. **Query type auto-subject**: Non-GENERAL query types (PHOTO_REQUEST, VIDEO_REQUEST, etc.) auto-populate `newQuerySubject` based on type; only GENERAL type allows free subject text.
10. **Apply Markup logic**: Skips after-sales items; uses category markup from settings → item's existing markup → `order.default_markup_percent` (default 20%) in that priority. Only applied to items that have a factory price but no selling price.

---

## Known quirks / bugs

### Q-001 — D-003: Four alert() calls in handlePriceExcelUpload
```javascript
if (!ws) { alert('Empty Excel file'); return }          // line 1003
if (!rows.length) { alert('Empty Excel file'); return } // line 1016
alert('Could not find part code and price columns...')  // line 1050
alert('Failed to parse Excel file: ' + err.message)    // line 1081
```
Four D-003 violations in a single function. All should be replaced with inline error state displayed in the bulk price upload modal UI.

### Q-002 — P-020 instance #3: getInitials in query panel chat bubbles
```javascript
function getInitials(name) {
  if (!name) return '?'
  const parts = name.split(/[@\s.]/).filter(Boolean)
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0]?.slice(0, 2).toUpperCase() || '?'
}
```
P-020 (avatar initials duplication). Instance #1 in `OrderList.vue`, instance #2 in `OrderDraft.vue`. Extract to `utils/avatars.js` `getInitials(name)` utility.

### Q-003 — P-001: getAgeText defined inline
`getAgeText(date)` — relative time formatting function defined inline. Used in the query panel thread list and chat bubbles. Should be in `utils/formatters.js`.

### Q-004 — P-010 variant: inline setTimeout debounce for add-item search
```javascript
let addItemSearchTimer = null
function onAddItemSearch() {
  clearTimeout(addItemSearchTimer)
  addItemSearchTimer = setTimeout(() => { loadProductsForAdd() }, 400)
}
```
Debounce present (400ms) but implemented inline, not via shared `useSearch(fn, delay)` composable. Matches the P-010 inline-debounce pattern documented in Wave 7 OrderDraft.

### Q-005 — ExcelJS heavy bundle
ExcelJS is a large npm dependency (~100KB gzipped). It is used client-side purely for Excel price list parsing. Moving this to a server action (API route) would remove the dependency from the client bundle entirely.

### Q-006 — Transparency column logic complexity
The pricing table renders 4 conditional column variants depending on `isTransparencyClient` and `showDualPriceColumns`. The combinatorial `v-if` / `v-else` on `<th>` and `<td>` creates ~40 conditional column cells across 2 table definitions (pricing table + read-only table). This is fragile — adding a new column requires touching 8 conditional blocks. Template-level type-narrowing via slot composition would be cleaner.

---

## Dead code / unused state

None identified. The large number of computed properties and refs all appear to be consumed in the template. The `inlinePriceEdit[item.id]` ref accumulates entries for all items but entries for items that were never inline-edited are never cleaned up — minor memory concern for orders with large item counts.

---

## Duplicate or inline utilities

- `getInitials(name)` — P-020 duplicate; exists in OrderList and OrderDraft. Extract to shared utility.
- `getAgeText(date)` — inline relative-time formatter; should be in `utils/formatters.js`.
- ExcelJS: only used here. If moved to a server action, the client bundle loses the import entirely.

---

## Migration notes

1. **File size**: At 3,331 lines, this file must be split in the Next.js rebuild. Recommended splits:
   - `ItemsPricingTable.tsx` — Stage 2 pricing table and toolbar
   - `ItemsReadOnlyTable.tsx` — Multi-stage read-only view
   - `ItemAddModal.tsx` — Product browser with search/pagination
   - `BulkAddModal.tsx` — Preview/apply flow
   - `BulkPriceUploadModal.tsx` — Text paste + Excel parse
   - `ItemQueryPanel.tsx` — Slide-out query thread panel
   - `ImageLightbox.tsx` — Zoom/pan viewer
   - `useItemPricing.ts` — Price calculation and auto-save logic
   - `useItemQueries.ts` — Query panel state management

2. **ExcelJS → Server Action**: Move Excel parsing to a Next.js Server Action. Client POSTs the file; server returns parsed `{ code, price }[]`. Removes ExcelJS from client bundle.

3. **PI generation → Server Action**: `quotationsApi.generatePI` should be a Server Action. On success, revalidate the order page cache. The PI result (pi_number, totals) can be returned from the action and displayed client-side.

4. **Transparency pricing**: The `cfp()` accessor, `isTransparencyClient`, `showDualPriceColumns`, and `canEditFactoryPrices` should be encapsulated in a `useTransparencyPricing(order, isSuperAdmin)` composable/hook.

5. **Carry-forward detection**: Move from note-string parsing to a structured `item.carry_forward_type` field on the backend serializer. The note string format is not a stable contract.

6. **D-003 fixes**: Replace all four `alert()` calls in `handlePriceExcelUpload` with inline error state in the modal (`errorMessage` ref displayed below the file input).

7. **P-010 inline debounce**: Replace `addItemSearchTimer` setTimeout pattern with a shared `useSearch(fn, 400)` hook in the Next.js rebuild.

8. **Query panel → URL-driven**: Instead of a slide-out panel controlled by local state, the query panel in Next.js should open as a route sheet or drawer driven by a `?queryItem=itemId` URL param. Enables browser back button to close panel.
