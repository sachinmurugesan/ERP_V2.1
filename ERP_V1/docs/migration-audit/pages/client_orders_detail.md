# Client Order Detail

**Type:** page
**Portal:** client (`/client-portal/*` — `user_type === 'CLIENT'`)
**Route:** `/client-portal/orders/:id` → `ClientOrderDetail`
**Vue file:** [frontend/src/views/client/ClientOrderDetail.vue](../../../frontend/src/views/client/ClientOrderDetail.vue) + [frontend/src/components/order/ClientOrderItemsTab.vue](../../../frontend/src/components/order/ClientOrderItemsTab.vue)
**Line count:** ~1,500 (shell) + ~1,450 (items tab component)
**Migration wave:** Wave 2 (client portal)
**Risk level:** high (item mutations, payment file upload, after-sales claims, evidence photo upload; two D-001 bypasses; `window.confirm()` on item removal needs D-003)

## Purpose (one sentence)

The most complex page in the client portal: a multi-tabbed order lifecycle view spanning item management, pricing review, payments, production tracking, packing, shipping, after-sales claims, file downloads, and per-item queries — two source files: `ClientOrderDetail.vue` (shell + all non-items tabs) and `ClientOrderItemsTab.vue` (embedded `<ClientOrderItemsTab>` component with its own modals and query panel).

## Layout (top→bottom, left→right, exhaustive)

### Outer container
`p-6 max-w-7xl mx-auto xl:pr-[280px]` — rendered inside `ClientLayout`'s `<router-view />` slot. The `xl:pr-[280px]` reserves space for the fixed activity log sidebar.

**Zone 0 — Back link**
`← Back to Orders` router-link (emerald-600, `pi-arrow-left` icon).

**Zone 1 — Loading / Error intercepts**
- Loading (while `loading === true`): full-page `pi-spinner pi-spin` + "Loading..."
- Error: full-page `text-red-500` error message.

**Zone 2 — Order header** (`flex items-center justify-between mb-6`)
- Left: `h1` "Order {order_number or po_reference}" + status badge (from `CLIENT_STATUS_COLORS`) + optional `client_reference` (`text-xs text-slate-400`).
- Right: "Created: {date}" + "PO: {po_reference}" (if present).

**Zone 3 — Horizontal Stage Stepper** (`bg-white rounded-xl border`, `overflow-x-auto`, `min-w-[900px]` inner row)
15 steps from `STEPPER_STAGES` imported from `clientPortal.js`. Each step: numbered circle (filled emerald = completed, emerald ring = current, grey = future) + label below. Connector line between steps turns emerald when preceding step is completed.

**Zone 4 — PI Download Bar** (`bg-indigo-50 border-indigo-200`; shown when `canDownloadPI` = `POST_PI_STATUSES.has(order.status)`)
"Proforma Invoice Ready" copy + "Download PI" button (`bg-indigo-600`). Calls `downloadPI(true)`, fetches via **raw `api.get()`** (D-001 bypass), responseType blob, filename `PI-{order_number}.xlsx`.

**Zone 5 — Pending Product Requests card** (`bg-amber-50 border-amber-200`; shown when `pendingRequests.length > 0` for CLIENT_DRAFT / DRAFT orders)
Lists Quick Add items awaiting admin review. Per row: product_code + product_name + quantity + status badge (PENDING amber / APPROVED green / MAPPED blue / REJECTED red).

**Zone 6 — Tab Bar** (shown when `tabs.length > 1`; horizontal scroll on overflow)
Dynamic tab buttons. "Queries" tab shows a red pulse badge for open-count and blue badge for replied-count (from `order.query_counts`).

**Zone 7 — Tab Panels** (conditional `v-show` / `v-if` per `activeTab`):

| Tab key | Label | Visibility gate |
|---|---|---|
| `items` | Order Items | always |
| `payments` | Payments | `portalPerms.show_payments` + `POST_PI_STATUSES` |
| `production` | Production | `portalPerms.show_production` + `PRODUCTION_STATUSES` |
| `packing` | Packing | `portalPerms.show_packing` + `PACKING_STATUSES` (local const) |
| `shipping` | Shipping | `portalPerms.show_shipping` + `SHIPPING_STATUSES` |
| `after_sales` | After-Sales | `portalPerms.show_after_sales` + `AFTER_SALES_STATUSES` |
| `final_draft` | Final Draft | `status === 'COMPLETED'` |
| `queries` | Queries | always |
| `files` | Files | `portalPerms.show_files` |
| `landed_cost` | Landed Cost | `clientType === 'TRANSPARENCY'` + CLEARED/DELIVERED/AFTER_SALES/COMPLETED/COMPLETED_EDITING |

**Tab panel content summaries:**
- **items:** `<ClientOrderItemsTab>` component — see Items Tab section below.
- **payments:** Payment summary cards (PI Total / Paid / Balance Due / Progress %) + progress bar + overpayment notice + payment history table + "Submit Payment" button → payment modal.
- **production:** Progress bar (%) + is_overdue badge + info cards (Status, Started, Target Completion, Days Remaining).
- **packing:** 3 summary cards (Ordered / Produced / Not Ready or Carried) + progress bar + packing items table (Part Code, Name, Ordered, Ready, Status) + carried-forward section + Excel / With-Images download buttons.
- **shipping:** Per shipment: animated voyage route visual (port-of-loading → arrow → port-of-discharge, ETD/ETA) + details grid (Vessel, Voyage, Container, B/L, Status).
- **after_sales:** After-sales review table (10 columns — see below) + photo lightbox (gallery grid + zoom/pan single-photo view) + resolution notes card + in-page toast.
- **final_draft:** Delegates to `<FinalDraftTab :order-id="orderId" :order="order" />` — not audited.
- **queries:** Delegates to `<ClientQueriesTab :order-id="orderId" :order="order" />` — not audited.
- **files:** Document list (filename, type, upload date) + per-doc "Download" button (blob download).
- **landed_cost:** Delegates to `<LandedCostTab :orderId="orderId" />` — not audited.

**After-sales table columns (10):** Product | Pallet | Sent | Received (editable input, locked when RESOLVED) | Issue Type (select, locked when RESOLVED) | Description (input, shown when issue type set) | Claim Qty (input, shown when issue type set) | Evidence (camera upload + photo count view) | Resolution (read-only badge) | Status (read-only badge).

**Zone 8 — Activity Log Sidebar** (`hidden xl:block fixed right-6 top-20 w-[300px]`)
Scrollable event feed (max-h-60vh). Per event: colored icon circle + message + date/time. Visible only on xl+ screens; inaccessible on mobile.

**Zone 9 — Submit Payment Modal** (`v-if="showPaymentModal"`, `fixed inset-0 z-50`)
Fields: payment_type (CLIENT_ADVANCE default), amount (required), currency (INR), method (BANK_TRANSFER), reference (optional), payment_date, notes, proof_file upload (JPG/PNG/PDF, ≤5MB, required). Submits as `FormData` via `paymentsApi.submitPayment(orderId, fd)`.

---

### Items Tab — ClientOrderItemsTab.vue layout (embedded in `v-show="activeTab === 'items'"`)

**Carried Items Banner:** shown when any item has `carry_forward_label`; counts Unloaded (amber) and After-Sales (rose) items.

**Toolbar (flex row, wrapping):** Refresh | Add Item (→ Add Modal) | Bulk Add (→ Bulk Add Modal) | Fetch Pending Items | Upload Excel | Edit Items toggle | Queries toggle (with open count badge). Each button visibility gated on the corresponding permission + stage.

**Pending Result Banner:** shown after `fetchPending()` — confirms carry count.

**Empty state:** `pi-inbox` + "No items in this order" + Add Item CTA if `canAdd`.

**Pending Additions section** (amber border `border-2 border-amber-300`; shown when `pendingAdditions.length > 0`): header with "Awaiting Pricing" or "Priced — Review & Confirm" sub-badge; "Accept Prices" + "Reject All" bulk buttons; per-item table with optional pricing columns (`showPendingPricing`); rejected items shown below as greyed-out rows.

**Client Confirmed Items section** (indigo border; shown when `clientConfirmedItems.length > 0`): "Prices Accepted — Awaiting Final Approval"; read-only table.

**Main Items table** (confirmed items; sortable by code / name / quantity): Columns: # | Img | Code | Product (carry-forward badge, lot badge, query bubble) | Qty | Query status column | Pricing columns (TRANSPARENCY + post-PI) | Inline Query column (toggle) | Remove (edit mode only). Row coloring: carried items → amber/rose tint with left-border; lot items → LOT_COLORS palette.

**Modals within items tab:**
- **Add Item Modal:** full-screen (`max-w-5xl h-[90vh]`), paginated catalog (20/50/100/200 per page), search + category, sortable, duplicate guard.
- **Bulk Add Modal:** textarea → `bulkTextAddPreview()` → preview table with dupe resolution (Club / Keep / Replace) → `bulkTextAddApply()`.
- **Bulk Confirm Dialog:** hand-rolled modal (not PrimeVue) — confirms Accept Prices or Reject All for pending additions.
- **Item Query Panel:** right-side drawer (`max-w-lg`), two-level (thread list → chat-style thread detail), new query form with type selector (GENERAL, PHOTO_REQUEST, VIDEO_REQUEST, DIMENSION_CHECK, QUALITY_QUERY, ALTERNATIVE), file attachment support.
- **Item Image Lightbox:** full-screen viewer with scroll-zoom (0.25×–8×) + drag-pan; ESC key closes.

---

## Data displayed

| Field | Source | Format | Notes |
|---|---|---|---|
| `order.order_number` | `ordersApi.get()` | monospace string | falls back to `po_reference` |
| `order.status` | `ordersApi.get()` → `CLIENT_STATUS_LABELS` | status badge | colors from `CLIENT_STATUS_COLORS` |
| `order.client_reference` | `ordersApi.get()` | plain string | optional |
| `order.created_at` | `ordersApi.get()` | `toLocaleDateString()` | |
| Stepper | `ordersApi.timeline()` | 15-step via `getStepState()` + `STEPPER_STAGES` | |
| `pendingRequests[]` | `ordersApi.productRequests()` | Quick Add cards | CLIENT_DRAFT/DRAFT only |
| `activityFeed[]` | `ordersApi.activityFeed()` | sidebar event list | silently empty on failure |
| `portalPerms` + `clientType` | `authApi.getMe()` | tab visibility + pricing toggle | |
| Payment summary | `ordersApi.myLedger()` | PI Total / Paid / Balance / Progress % | filtered to this `orderId` |
| `payments[]` | `ordersApi.myLedger()` | history table | date / type / method / ref / amount / status |
| `production` | `productionApi.getProgress()` | % + overdue state | |
| `shipments[]` | `shipmentsApi.list(orderId)` | voyage visual + detail cards | |
| `packingSummary` | `packingApi.clientSummary()` | summary cards + items table + carried-forward | |
| `afterSalesItems[]` | `afterSalesApi.clientGetForOrder()` | 10-col review table | `is_balance_only` items excluded |
| `documents[]` | `documentsApi.list(orderId)` | file list | |
| Items (items tab) | `ordersApi.get()` re-fetched by ClientOrderItemsTab | split: confirmed / pending / clientConfirmed / rejected / carried | |
| `item.client_factory_price` | embedded in order items | pricing column | TRANSPARENCY clients only, post-PI |
| `item.selling_price_inr` | embedded in order items | pending pricing column | any client, post-PI, when set |

**Pricing exposure:**
- Regular clients: see `selling_price_inr` on pending addition rows when priced and post-PI.
- TRANSPARENCY clients: see `client_factory_price × exchange_rate` on both pending and confirmed rows post-PI; Landed Cost tab unlocked at CLEARED+.
- Neither client type sees `factory_price` or `factory_markup_percent`.

## Interactions (every clickable/typeable element)

| Trigger | Action | API call | Result |
|---|---|---|---|
| Click tab button | `selectTab(key)` — lazy-load on first visit | varies per tab | switches active tab |
| Click "Download PI" | `downloadPI(true)` | `GET /orders/{id}/download-pi-with-images/` (**D-001 bypass**) | xlsx blob download |
| Click "Submit Payment" | `showPaymentModal = true` | — | opens payment modal |
| Submit payment form | `submitPayment()` | `POST /api/payments/{orderId}/` | FormData; reloads payments on success |
| Click "Add Item" (items tab) | `openAddModal()` | `GET /api/products/`, `GET /api/products/categories/` | opens Add Item modal |
| Click "Add" (modal row) | `addItem(p)` | `POST /api/orders/{id}/items/` | inserts item; reloads |
| Click "Bulk Add" | `showBulkModal = true` | — | opens Bulk Add modal |
| Click "Preview" (bulk) | `bulkPreview()` | `POST /api/orders/{id}/bulk-text-add/preview/` | shows preview table |
| Click "Add N Items" (bulk apply) | `bulkApply()` | `POST /api/orders/{id}/bulk-text-add/apply/` + optional `PUT` for dupes | inserts items; reloads |
| Click "Accept Prices" | `bulkConfirmPending('approve')` | — | opens Bulk Confirm dialog |
| Confirm accept/reject | `executeBulkConfirm()` | `POST /api/orders/{id}/bulk-confirm/` | reloads order + items |
| Update qty (edit mode) | `updateQty(item, val)` | `PUT /api/orders/{id}/items/{itemId}/` | updates qty |
| Click trash (edit mode) | `removeItem(item)` — `window.confirm()` gate | `DELETE /api/orders/{id}/items/{itemId}/` | removes item; reloads |
| Click "Fetch Pending Items" | `fetchPending()` | `GET /api/orders/{id}/fetch-pending/` | carries pending items |
| Click "Upload Excel" | file picker | `POST /api/orders/{id}/parse-price-excel/` | parses prices |
| Toggle Queries column | `showQueryColumn` + `loadInlineStatus()` | `GET /api/queries/inline-status/{orderId}/` | reveals inline Q&A column |
| Click query bubble | `openQueryPanel(item)` | `GET /api/queries/` + `GET /api/queries/{id}/{qId}/` | opens query drawer |
| Submit new query | `createQuery()` | `POST /api/queries/{orderId}/` | creates thread |
| Send thread reply | `sendThreadReply()` | `POST /api/queries/{orderId}/{queryId}/reply/` | appends message |
| Send inline query | `sendInlineQuery(item)` | `POST /api/queries/inline/{orderId}/{itemId}/` | create/reply inline |
| Click evidence camera | `uploadEvidence(item)` | `POST /api/aftersales/client/orders/{orderId}/{itemId}/photos/` (**D-001 bypass**) | multi-file upload; 60s timeout |
| Click "Submit Review" (after-sales) | `submitClaims()` | `POST /api/aftersales/client/orders/{orderId}/submit/` | submits claims |
| Click "Download Excel" (packing) | `downloadPackingExcel(false)` | `GET /api/packing/{orderId}/download-excel/` | xlsx blob |
| Click "With Images" (packing) | `downloadPackingExcel(true)` | `GET /api/packing/{orderId}/download-pdf/` | pdf blob |
| Click document "Download" | `downloadDocument(doc)` | `GET /api/documents/{docId}/download/` | blob download |
| `?tab=` URL change | `watch(route.query.tab)` | — | updates `activeTab` |

## Modals/dialogs triggered

### Payment Submit Modal
Full-screen overlay; payment fields + required proof file upload (JPG/PNG/PDF, ≤5MB).

### Add Item Modal (items tab)
Full-screen paginated catalog with search, category filter, sortable columns, and "In Order" duplicate guard.

### Bulk Add Modal (items tab)
Textarea paste → server preview → dupe resolution (Club/Keep/Replace) → apply.

### Bulk Confirm Dialog (items tab)
Hand-rolled modal (NOT PrimeVue) for Accept Prices / Reject All on pending additions. **D-003: must migrate to `<ConfirmDialog>`.**

### Item Query Panel (items tab)
Right-side drawer. Level 1: thread list (clickable cards). Level 2: chat-style thread detail with reply + file attachment input. New query form with type selector.

### Item Image Lightbox (items tab)
Full-screen viewer; scroll-zoom (0.25×–8×) + drag-pan; ESC to close.

### After-Sales Photo Lightbox (shell)
Full-screen gallery grid (3-col); click to enter zoom/pan single-photo view with nav arrows + zoom controls.

**D-003 note:** `window.confirm()` in `removeItem` (ClientOrderItemsTab.vue:710) and the hand-rolled Bulk Confirm Dialog must both be migrated to the Layer-2 `<ConfirmDialog>` component.

## API endpoints consumed

| Method | Endpoint | Via | Notes |
|---|---|---|---|
| GET | `/api/orders/{id}/` | `ordersApi.get()` | Shell + items tab both call this on mount (double fetch) |
| GET | `/api/orders/{id}/timeline/` | `ordersApi.timeline()` | Journey stepper |
| GET | `/api/orders/{id}/product-requests/` | `ordersApi.productRequests()` | Quick Add pending review; CLIENT_DRAFT/DRAFT only |
| GET | `/api/auth/me/` | `authApi.getMe()` | Portal permissions + `client_type` |
| GET | `/api/orders/{id}/activity/` | `ordersApi.activityFeed()` | Activity sidebar; silently swallowed on failure |
| GET | `/api/orders/my-ledger/` | `ordersApi.myLedger()` | Payments tab — full ledger filtered to this order |
| POST | `/api/payments/{orderId}/` | `paymentsApi.submitPayment()` | FormData with proof file |
| GET | `/api/production/{orderId}/progress/` | `productionApi.getProgress()` | Production tab |
| GET | `/api/shipments/?order_id={orderId}` | `shipmentsApi.list(orderId)` | Shipping tab |
| GET | `/api/documents/?order_id={orderId}` | `documentsApi.list(orderId)` | Files tab |
| GET | `/api/documents/{docId}/download/` | `documentsApi.download(doc.id)` | Blob download |
| GET | `/api/packing/client/{orderId}/summary/` | `packingApi.clientSummary()` | Packing tab |
| GET | `/api/packing/{orderId}/download-excel/` | `packingApi.downloadExcel()` | Packing xlsx blob |
| GET | `/api/packing/{orderId}/download-pdf/` | `packingApi.downloadPDF()` | Packing pdf blob |
| GET | `/api/aftersales/client/orders/{orderId}/` | `afterSalesApi.clientGetForOrder()` | After-sales tab |
| POST | `/api/aftersales/client/orders/{orderId}/submit/` | `afterSalesApi.clientSubmitClaims()` | Submit claims |
| POST | `/api/aftersales/client/orders/{orderId}/{itemId}/photos/` | `api.post()` (**D-001 bypass**) | Evidence upload; multipart; 60s timeout |
| GET | `/api/orders/{orderId}/download-pi/` | `api.get()` (**D-001 bypass**) | PI without images |
| GET | `/api/orders/{orderId}/download-pi-with-images/` | `api.get()` (**D-001 bypass**) | PI with images; both return xlsx named `PI-{number}.xlsx` |
| POST | `/api/orders/{id}/items/` | `ordersApi.addItems()` | Add single item |
| PUT | `/api/orders/{id}/items/{itemId}/` | `ordersApi.updateItem()` | Edit quantity |
| DELETE | `/api/orders/{id}/items/{itemId}/` | `ordersApi.removeItem()` | Remove item |
| POST | `/api/orders/{id}/bulk-text-add/preview/` | `ordersApi.bulkTextAddPreview()` | Bulk preview |
| POST | `/api/orders/{id}/bulk-text-add/apply/` | `ordersApi.bulkTextAddApply()` | Bulk apply |
| POST | `/api/orders/{id}/bulk-confirm/` | `ordersApi.bulkConfirmItems()` | Accept/reject all pending |
| GET | `/api/orders/{id}/fetch-pending/` | `ordersApi.fetchPendingItems()` | Carry pending items |
| POST | `/api/orders/{id}/parse-price-excel/` | `ordersApi.parsePriceExcel()` | Excel price upload |
| GET | `/api/products/` | `productsApi.list()` | Add Item modal catalog |
| GET | `/api/products/categories/` | `productsApi.categories()` | Add Item modal filter |
| GET | `/api/queries/` | `queriesApi.list(orderId)` | All queries for this order |
| GET | `/api/queries/inline-status/{orderId}/` | `queriesApi.inlineStatus()` | Per-item inline query status |
| POST | `/api/queries/inline/{orderId}/{itemId}/` | `queriesApi.inlineQuery()` | Create/reply inline query |
| GET | `/api/queries/{orderId}/` | `queriesApi.list()` with `order_item_id` param | Query panel thread list |
| GET | `/api/queries/{orderId}/{queryId}/` | `queriesApi.get()` | Thread detail |
| POST | `/api/queries/{orderId}/` | `queriesApi.create()` | Create query thread |
| POST | `/api/queries/{orderId}/{queryId}/reply/` | `queriesApi.reply()` | Reply to thread |
| POST | `/api/queries/{orderId}/{queryId}/reply-with-attachment/` | `queriesApi.replyWithAttachment()` | Reply with file |
| POST | `/api/queries/{orderId}/{queryId}/resolve/` | `queriesApi.resolve()` | Resolve thread |
| POST | `/api/queries/{orderId}/{queryId}/reopen/` | `queriesApi.reopen()` | Reopen thread |

> Per D-001 (Option B): in Next.js all calls go through the generated SDK except the two marked D-001 bypasses (evidence upload + PI download), which require new SDK methods to be added.

## Composables consumed

- **`useRoute`** — `route.params.id` (orderId), `route.query.tab` (initial active tab for notification deep-links).
- **`useRouter`** — `router.replace()` updates `?tab=queries&query={queryId}` for query notification click-throughs.

No `useAuth` — `clientType` and `portalPerms` are loaded from `authApi.getMe()` directly.

## PrimeVue components consumed

None. All UI is hand-rolled Tailwind + PrimeIcons. The Bulk Confirm dialog is a hand-rolled modal overlay, not a PrimeVue dialog.

## Local state

**ClientOrderDetail.vue (key refs):**

| Ref | Purpose |
|---|---|
| `order`, `loading`, `error` | Shell order state |
| `activeTab` | Current tab key; synced with `?tab=` URL param |
| `portalPerms` | 6 boolean flags from `authApi.getMe()` |
| `clientType` | `'TRANSPARENCY'` or `'REGULAR'` |
| `timeline` | Journey events for stepper |
| `pendingRequests` | Quick Add review items |
| `payments`, `paymentSummary`, `loadingPayments` | Payments tab state |
| `production`, `loadingProduction` | Production tab state |
| `packingSummary`, `loadingPacking` | Packing tab state |
| `shipments`, `loadingShipments` | Shipping tab state |
| `documents`, `loadingDocs` | Files tab state |
| `activityFeed` | Activity sidebar data |
| `afterSalesItems`, `loadingAfterSales`, `savingClaims`, `afterSalesMessage` | After-sales tab state |
| `toast` | In-page toast `{ visible, type, message }` — auto-dismisses after 4s |
| `showPaymentModal`, `paymentForm`, `proofFile`, `paymentSubmitting` | Payment modal |
| `downloading` | PI download in-flight |
| `photoLightbox`, `zoomedPhoto`, `zoomedIndex`, `zoomLevel`, `panOffset`, `isPanning`, `panStart`, `lightboxPhotos` | After-sales photo viewer |

Computed: `tabs`, `journeyEvents`, `hasPrices`, `activeItems`, `orderTotal`, `canDownloadPI`, `currentStageNum`, `claimCount`.

**ClientOrderItemsTab.vue (key refs):**

`items`, `loading`, `sortKey`, `sortOrder`, `isEditing`, `showQueryPanel`, `queryPanelItem`, `queryPanelQueries`, `allItemQueries`, `inlineQueryStatus`, `inlineQueryInput`, `inlineSending`, `showQueryColumn`, `showAddModal`, `addSearch`, `addCategory`, `addResults`, `addPage`, `addTotal`, `addPerPage`, `addSortKey`, `addSortOrder`, `showBulkModal`, `bulkText`, `bulkPreviewResults`, `bulkPreviewStep`, `bulkDupeResolutions`, `fetchingPending`, `pendingResult`, `showConfirmDialog`, `confirmDialogAction`, `bulkConfirming`.

Computed: `canEdit`, `canAddMidOrder`, `canAdd`, `canBulkAdd`, `canFetchPending`, `canUploadExcel`, `canEditQty`, `canRemove`, `canEditItems`, `isTransparencyClient`, `showPricing`, `showPendingPricing`, `activeItems`, `confirmedItems`, `pendingAdditions`, `clientConfirmedItems`, `rejectedAdditions`, `carriedItems`, `sortedItems`, `existingProductIds`.

## Permissions / role gating

- Route restricted to `user_type === 'CLIENT'` by global `router.beforeEach` guard.
- Tab visibility doubly gated: `portalPerms.show_*` (per-client admin toggle) AND order status in the relevant status set.
- `clientType === 'TRANSPARENCY'`: unlocks pricing columns in items tab (post-PI via `showPricing`), unlocks Landed Cost tab (at CLEARED+).
- Items tab action buttons each gated on `props.permissions.items_*` flag AND order stage: `CLIENT_EDITABLE_STAGES` (CLIENT_DRAFT, DRAFT, PENDING_PI, PI_SENT) for edit/remove; `CLIENT_MID_ORDER_STAGES` (FACTORY_ORDERED → PRODUCTION_90) additionally allows `canAdd` mid-order.
- After-sales editable fields locked when `item.status === 'RESOLVED'`.
- `showPendingPricing` (pending additions pricing): shown when any pending item has any price set — NOT limited to TRANSPARENCY. Regular clients see `selling_price_inr`; TRANSPARENCY clients see `client_factory_price × exchange_rate`.
- `showPricing` (confirmed items): TRANSPARENCY clients only, post-PI (`POST_PI_SET`).
- `PACKING_STATUSES` (tab visibility) is defined locally in `ClientOrderDetail.vue:119-123`, not imported from `clientPortal.js`.
- Activity log sidebar is layout-gated (`hidden xl:block`), not permission-gated — invisible on screens below 1280px.

## Bilingual labels (Tamil + English pairs)

| Key | en | ta | Type |
|---|---|---|---|
| `client.order_detail.back` | "Back to Orders" | `""` | `PortalString` |
| `client.order_detail.loading` | "Loading..." | `""` | `PortalString` |
| `client.order_detail.pi_ready_title` | "Proforma Invoice Ready" | `""` | `PortalString` |
| `client.order_detail.pi_ready_subtitle` | "Review your pricing and download the PI document" | `""` | `PortalString` |
| `client.order_detail.download_pi` | "Download PI" | `""` | `PortalString` |
| `client.order_detail.pending_requests_title` | "Pending Product Requests" | `""` | `PortalString` |
| `client.order_detail.pending_requests_body` | "These products you requested via Quick Add are being reviewed by our team." | `""` | `PortalString` |
| `client.order_detail.tab_items` | "Order Items" | `""` | `PortalString` |
| `client.order_detail.tab_payments` | "Payments" | `""` | `PortalString` |
| `client.order_detail.tab_production` | "Production" | `""` | `PortalString` |
| `client.order_detail.tab_packing` | "Packing" | `""` | `PortalString` |
| `client.order_detail.tab_shipping` | "Shipping" | `""` | `PortalString` |
| `client.order_detail.tab_after_sales` | "After-Sales" | `""` | `PortalString` |
| `client.order_detail.tab_final_draft` | "Final Draft" | `""` | `PortalString` |
| `client.order_detail.tab_queries` | "Queries" | `""` | `PortalString` |
| `client.order_detail.tab_files` | "Files" | `""` | `PortalString` |
| `client.order_detail.tab_landed_cost` | "Landed Cost" | `""` | `PortalString` |
| `client.order_detail.payment_submit_title` | "Submit Payment" | `""` | `PortalString` |
| `client.order_detail.payment_ok` | "Payment submitted for verification" | `""` | `DialogString` |
| `client.order_detail.production_delayed` | "Delayed by {N} days" | `""` | `PortalString` |
| `client.order_detail.after_sales_title` | "After-Sales Review" | `""` | `PortalString` |
| `client.order_detail.submit_review` | "Submit Review" | `""` | `PortalString` |
| `client.order_detail.claim_submitted_ok` | "Claims submitted successfully! Our team will review your issues." | `""` | `DialogString` |
| `client.order_detail.claim_submitted_err` | "Failed to submit claims. Please try again." | `""` | `DialogString` |
| `client.order_detail.issue_no_issue` | "— No Issue" | `""` | `PortalString` |
| `client.order_detail.issue_wrong_product` | "Wrong Product" | `""` | `PortalString` |
| `client.order_detail.issue_missing` | "Missing Items" | `""` | `PortalString` |
| `client.order_detail.issue_quality` | "Quality Issue" | `""` | `PortalString` |
| `client.order_detail.issue_price` | "Price Mismatch" | `""` | `PortalString` |
| `client.order_detail.packing_carried_forward` | "{N} item(s) will be in your next order" | `""` | `PortalString` |
| `client.order_detail.activity_title` | "Activity Log" | `""` | `PortalString` |
| `client.order_detail.remove_item_confirm` | "Remove this item from this order?" | `""` | `DialogString` |
| `client.order_detail.bulk_accept_confirm` | "You are confirming that the prices for {N} items are acceptable." | `""` | `DialogString` |
| `client.order_detail.bulk_reject_confirm` | "This will reject all {N} pending items. They will be removed from your order." | `""` | `DialogString` |

[UNCLEAR — needs Sachin review: `journeyMap` (ClientOrderDetail.vue:303-326) defines ~22 client-friendly stage titles + descriptions entirely in-component. These are `PortalString` entries not covered by `CLIENT_STATUS_LABELS` — they need Tamil translations as a separate string set.]

[UNCLEAR — needs Sachin review: Tamil required for all `PortalString` and `DialogString` entries before Wave 2 ships (D-005).]

## Empty / error / loading states

| Context | State | UI |
|---|---|---|
| Shell initial load | Loading | full-page spinner + "Loading..." |
| Shell initial load | Error | full-page red error message |
| Payments tab | Loading | spinner |
| Payments tab | No payments | `pi-wallet` icon + "No payments recorded yet" |
| Production tab | Loading | spinner |
| Production tab | No dates set | `pi-clock` + "Production dates will be updated once the factory begins work." |
| Packing tab | Loading | spinner |
| Packing tab | No data | `pi-box` + "Packing details will appear once your order is being prepared for shipment." |
| Shipping tab | Loading | spinner |
| Shipping tab | No shipments | `pi-send` + "Shipment details will appear once your order is booked for shipping." |
| After-sales tab | Loading | spinner |
| After-sales tab | Backend message set | `pi-clock` + message text (e.g. "Not available yet") |
| After-sales tab | No items | `pi-check-circle` emerald + "No after-sales items to review." |
| Files tab | Loading | spinner |
| Files tab | No docs | `pi-folder-open` + "Documents will be shared here as your order progresses." |
| Items tab | Loading | `pi-spinner pi-spin` |
| Items tab | No items | `pi-inbox` + "No items in this order" + Add Item CTA if `canAdd` |
| Activity sidebar | No events | `pi-clock` + "No activity yet" |

## Business rules (non-obvious)

1. **Tab data is lazy-loaded on first select.** Each tab fetches its data only on the first `selectTab(key)` call. Guard: `if (loadingX.value) return` prevents duplicate in-flight requests.
2. **Items are embedded in the order response.** `ClientOrderItemsTab.loadItems()` calls `ordersApi.get(orderId)` and reads `data.items`. There is no separate `/items/` endpoint. The parent `ClientOrderDetail.loadOrder()` also calls `ordersApi.get()` — resulting in two GET requests to the same endpoint on mount.
3. **Payment summary derives from `ordersApi.myLedger()`**, not a per-order payments endpoint. The full ledger is fetched and filtered to this `orderId`. Any discrepancy between this and `ClientLedger.vue` (same endpoint, different filtering) would be a bug.
4. **`PACKING_STATUSES` is defined locally** (ClientOrderDetail.vue:119-123) as a 10-status Set, not imported from `clientPortal.js`. All other status sets (PRODUCTION_STATUSES, SHIPPING_STATUSES, etc.) are imported.
5. **`POST_PI_SET` in ClientOrderItemsTab is a local Set** (line 50) that includes `'CUSTOMS_CLEARED'` — a likely typo; the canonical status is `'CLEARED'` per `CLIENT_STATUS_LABELS` in clientPortal.js. This may cause pricing columns to not appear at the CLEARED stage for TRANSPARENCY clients.
6. **After-sales fields staged locally.** `received_qty`, `objection_type`, `description`, `affected_quantity` are updated in `afterSalesItems.value` via immutable map (new object per change) until "Submit Review" is clicked. No per-field auto-save.
7. **Proof file required for payment submission** — `if (!proofFile.value || !paymentForm.value.amount) return` silently no-ops if file is missing (no error message shown to the user).
8. **`journeyMap` (lines 303-326) is in-component only.** Maps backend status names to client-friendly copy (title + description + icon). Independent of `CLIENT_STATUS_LABELS` — no Tamil equivalents exist yet.
9. **Tab deep-link via `?tab=<key>`** is read on mount and updated by `handleOpenQuery()` for notification click-throughs to specific query threads.
10. **`showPendingPricing` is not TRANSPARENCY-only.** Any client sees pricing on pending additions once a price is set (post-PI); TRANSPARENCY clients additionally see factory pricing. Regular clients see `selling_price_inr`.

## Known quirks

- **Double GET on mount:** `ClientOrderDetail.loadOrder()` and `ClientOrderItemsTab.loadItems()` both call `ordersApi.get(orderId)` independently.
- **`'CUSTOMS_CLEARED'` typo** in `POST_PI_SET` (ClientOrderItemsTab.vue:50) — canonical status is `'CLEARED'`; may block TRANSPARENCY pricing columns at CLEARED stage.
- **`PACKING_STATUSES` not in clientPortal.js** — risk of drift if packing stages are added or renamed.
- **Activity log not shown on mobile** (`hidden xl:block`) — no fallback for screens below 1280px.
- **`window.confirm()` on item removal** (ClientOrderItemsTab.vue:710) — must migrate to `<ConfirmDialog>` (D-003).
- **Evidence upload uses raw `api.post()`** — D-001 bypass.
- **PI download uses raw `api.get()`** — D-001 bypass.
- **Proof file silently required** — payment submission no-ops with no feedback if proof file not attached.

## Dead code / unused state

None observed. (`afterSalesMessage` ref is used to render a backend-supplied "not available" message, not dead.)

## Migration notes

- **D-001 (2 bypasses to fix):**
  1. Photo upload: add `afterSalesApi.uploadEvidence(orderId, itemId, formData)` to the SDK.
  2. PI download: add `client.orders.downloadPI(orderId, { withImages: boolean })` to the SDK.
- **D-003 (2 targets):**
  1. `removeItem` uses `window.confirm()` (ClientOrderItemsTab.vue:710) → replace with `<ConfirmDialog>` using `DialogString` copy.
  2. Bulk Confirm Dialog is hand-rolled → replace with `<ConfirmDialog>`.
- **D-005:** All strings are `PortalString` or `DialogString`; `journeyMap` titles/descriptions (~22 entries) are a separate string set not yet in `clientPortal.js` — must be extracted and translated.
- **Fix before migration:**
  - Move `PACKING_STATUSES` into `clientPortal.js`.
  - Fix `'CUSTOMS_CLEARED'` → `'CLEARED'` in `POST_PI_SET` (ClientOrderItemsTab.vue:50).
  - Eliminate double `ordersApi.get()` on mount — items tab should read `items` from the `order` prop or parent should pass them as a separate prop.
- **Child components not audited:** `LandedCostTab`, `FinalDraftTab`, `ClientQueriesTab` — each needs its own migration profile.
- **Layer 2 components needed:** `TabBar`, `OrderHeader`, `StatusStepper`, `PIDownloadBar`, `PaymentSummaryCards`, `PaymentSubmitModal`, `ProductionProgressCard`, `PackingSummaryCard`, `ShipmentTrackingCard`, `AfterSalesReviewTable`, `AfterSalesPhotoLightbox`, `ActivityFeedSidebar`, `ItemQueryPanel`, `AddItemModal`, `BulkAddModal`, `BulkConfirmDialog`.
- **Open questions for Sachin:**
  1. Should the activity log be accessible on mobile (e.g., bottom sheet or collapsible drawer)?
  2. Should proof file upload be optional (allow payment record without proof at submission time)?
  3. Tamil copy for all portal strings + journey map descriptions — translator review needed before Wave 2.
