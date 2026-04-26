# Orders Module — Complete Audit (2026-04-26)

Read-only research. Single deliverable. No branches, no code, no migration logs.

Methodology: 5 parallel research agents covered router/route enumeration, stage workflow, per-component deep analysis, API coverage matrix, and design-system reuse. Findings cross-validated against the live backend (auth-probed, 401 on bad creds = healthy) and the canonical files in the repo.

---

## 1. Executive summary

**Total remaining work in the orders module:** approximately **96–172 hours** across **11 unmigrated Vue files** (12 if counting the shared `ExcelUpload.vue` twice — it's mounted under both `/orders/:id/upload-excel` and `/products/upload-excel`). Plus **14 known sibling-tab components** referenced by `OrderDetail.vue` that were out of scope for this audit (PaymentsTab, ProductionTab, PackingListTab, BookingTab, SailingTab, ShippingDocsTab, CustomsTab, AfterSalesTab, FilesTab, QueriesTab, FinalDraftTab, LandedCostTab — 12 of them — plus the two already analyzed: OrderItemsTab, OrderDashboardTab). True total is therefore higher.

**Highest priority items** (first cuts, lowest risk, fastest unlock):
1. **Lift the four ready ui-gallery prototypes** (Tabs primitive via Radix, PageShell, CarryForwardStepper, HighlightScrollTarget) — unblocks every order-detail-shaped page.
2. **Factory-portal orders list + detail** (170 lines combined) — easy win, ports the smallest piece of the module first.
3. **Client-portal orders list** (134 lines) — same shape as already-migrated `/orders` list with a portal scope.

**Biggest risks:**
1. **OrderItemsTab.vue is 3,338 lines** (BEAST). Three intertwined sub-flows (pricing/PI · bulk Excel upload with client-side ExcelJS · query thread system with attachments) plus ~30 distinct endpoints. Must be split into 4–5 components on migration. 40–60h alone.
2. **Stage definition drifts in three places** between backend, `frontend/src/utils/constants.js` (claims 18 stages with a phantom `FACTORY_PAYMENT`), and `OrderItemsTab.vue:2494` (hardcodes `/16`). Backend is the source of truth: **17 numbered stages** (0..17 inclusive of CLIENT_DRAFT). Migration must sync.
3. **Stage transitions are NOT role-gated on the backend.** `transition_order`, `go_back_order`, and `jump_to_stage` (`backend/routers/orders.py:2448, 2521, 2553`) accept any authenticated user with order access. Only `/reopen/` is ADMIN/SUPER_ADMIN. This needs a security decision before the new detail page exposes those buttons.
4. **~50 new Next.js proxy routes needed** + roughly the same number of local TypeScript interfaces, because almost every order endpoint returns bare `dict` from FastAPI (no `response_model`).
5. **No design reference exists** for the order-detail tab page, the order-draft wizard, the Excel-upload flow, the after-sales query thread, or a shipment timeline.

**Recommended starting point** (after this audit lands): a small foundation PR that **lifts Tabs + PageShell + CarryForwardStepper from `apps/ui-gallery` into `apps/web/src/components/`**, plus adds `/api/orders/{id}` GET proxy + `/api/orders/{id}/timeline/` proxy + `/api/orders/{id}/next-stages/` proxy. With those in place, the next migration (factory-portal orders list+detail or client-portal orders list) needs almost no new infrastructure.

---

## 2. Route inventory

All routes are defined in `ERP_V1/frontend/src/router/index.js`. No per-route `beforeEnter` guards; the single global `beforeEach` enforces auth + portal isolation by `user.user_type`. **No route uses path `transport-orders`.** **No `/clients/:id/orders` route exists.**

### INTERNAL portal

| Path | Component | Route name | Meta | Parent |
|---|---|---|---|---|
| `/orders` | `views/orders/OrderList.vue` | `OrderList` | `{ title: 'Orders', icon: 'pi-shopping-cart' }` | — |
| `/orders/new` | `views/orders/OrderDraft.vue` | `OrderDraft` | `{ title: 'New Order', parent: 'OrderList' }` | OrderList |
| `/orders/:id` | `views/orders/OrderDetail.vue` | `OrderDetail` | `{ title: 'Order Detail', parent: 'OrderList' }`, `props: true` | OrderList |
| `/orders/:id/upload-excel` | `views/orders/ExcelUpload.vue` | `ExcelUpload` | `{ title: 'Upload Excel', parent: 'OrderDetail' }`, `props: true` | OrderDetail |
| `/products/upload-excel` | `views/orders/ExcelUpload.vue` | `ProductUploadExcel` | `{ title: 'Import Products', parent: 'ProductList' }` | ProductList |

### CLIENT portal (parent `/client-portal`, layout: `components/layout/ClientLayout.vue`, meta: `{ requiresAuth: true, userType: 'CLIENT' }`)

| Path | Component | Route name | Meta title |
|---|---|---|---|
| `/client-portal/orders` | `views/client/ClientOrders.vue` | `ClientOrders` | `'My Orders'` |
| `/client-portal/orders/new` | `views/client/ClientNewOrder.vue` | `ClientNewOrder` | `'New Order Inquiry'` |
| `/client-portal/orders/:id` | `views/client/ClientOrderDetail.vue` | `ClientOrderDetail` | `'Order Detail'` |
| `/client-portal/shipments` | `views/client/ClientShipments.vue` | `ClientShipments` | `'Shipments'` |

### FACTORY portal (parent `/factory-portal`, layout: `components/layout/FactoryLayout.vue`, meta: `{ requiresAuth: true, userType: 'FACTORY' }`)

| Path | Component | Route name |
|---|---|---|
| `/factory-portal/orders` | `views/factory/FactoryOrders.vue` | `FactoryOrders` |
| `/factory-portal/orders/:id` | `views/factory/FactoryOrderDetail.vue` | `FactoryOrderDetail` |
| `/factory-portal/production` | `views/factory/FactoryOrders.vue` | `FactoryProduction` |
| `/factory-portal/packing` | `views/factory/FactoryOrders.vue` | `FactoryPacking` |

**Anomaly:** Three factory-portal routes (`orders`, `production`, `packing`) all render the same `FactoryOrders.vue`. They're sidebar shortcuts, not separate views. The component branches on route name internally.

### Programmatic-navigation deep-link surfaces (must preserve in Next.js port)

- `OrderDetail.vue:355,360,413,426` — `router.replace({ query: { ...route.query, tab, query, carried } })` → **`?tab=...&query=...&carried=...` query params drive tab state and deep-link to a specific Q&A thread.** Every Next.js port of `OrderDetail` must preserve these as searchParams.
- `OrderDraft.vue:654,657` — `router.push(\`/orders/${data.id}?carried=${carriedCount}\`)` → `OrderDetail` with optional `?carried=N` query for "we just carried forward N items, here they are" UX.
- No router.push targets a route that doesn't already exist in the table above.

---

## 3. Component tree (visual)

```
INTERNAL portal
└── /orders                           views/orders/OrderList.vue           [438 lines · MIGRATED to Next.js]
    ├── /orders/new                   views/orders/OrderDraft.vue          [1,563 lines · COMPLEX]
    ├── /orders/:id                   views/orders/OrderDetail.vue         [956 lines · COMPLEX, depends on 14 tabs]
    │   ├── tab=dashboard             components/order/OrderDashboardTab.vue [552 lines · MODERATE]
    │   ├── tab=items                 components/order/OrderItemsTab.vue   [3,338 lines · BEAST 🔥]
    │   ├── tab=payments              (PaymentsTab — out of scope)
    │   ├── tab=production            (ProductionTab — out of scope)
    │   ├── tab=packing               (PackingListTab — out of scope)
    │   ├── tab=booking               (BookingTab — out of scope)
    │   ├── tab=sailing               (SailingTab — out of scope)
    │   ├── tab=shipping-docs         (ShippingDocsTab — out of scope)
    │   ├── tab=customs               (CustomsTab — out of scope)
    │   ├── tab=after-sales           (AfterSalesTab — out of scope)
    │   ├── tab=files                 (FilesTab — out of scope)
    │   ├── tab=queries               (QueriesTab — out of scope)
    │   ├── tab=final-draft           (FinalDraftTab — out of scope)
    │   ├── tab=landed-cost           (LandedCostTab — out of scope)
    │   └── /orders/:id/upload-excel  views/orders/ExcelUpload.vue         [1,010 lines · COMPLEX]
    └── /products/upload-excel        views/orders/ExcelUpload.vue         [shared file — products mode]

CLIENT portal
└── /client-portal/orders             views/client/ClientOrders.vue        [134 lines · SIMPLE]
    ├── /client-portal/orders/new     views/client/ClientNewOrder.vue      [853 lines · COMPLEX]
    └── /client-portal/orders/:id     views/client/ClientOrderDetail.vue   [1,596 lines · COMPLEX, ~9 tabs]
        ├── tab=items                 components/order/ClientOrderItemsTab.vue [1,616 lines · COMPLEX]
        ├── tab=payments              (sibling — out of scope)
        ├── tab=production            (sibling — out of scope)
        ├── tab=packing               (sibling — out of scope)
        ├── tab=shipping              (sibling — out of scope)
        ├── tab=after_sales           (sibling — out of scope)
        ├── tab=files                 (sibling — out of scope)
        ├── tab=queries               (sibling — out of scope)
        ├── tab=final_draft           (sibling — out of scope)
        └── tab=landed_cost           (sibling — out of scope)

FACTORY portal
├── /factory-portal/orders            views/factory/FactoryOrders.vue      [70 lines · SIMPLE]
├── /factory-portal/production        (same FactoryOrders.vue file)
├── /factory-portal/packing           (same FactoryOrders.vue file)
└── /factory-portal/orders/:id        views/factory/FactoryOrderDetail.vue [99 lines · SIMPLE — minimal stub]
```

---

## 4. Per-component analysis

Format per file: lines, purpose, key interactions, API endpoints, stage gating, file uploads/downloads, third-party integrations, role checks, complexity rating with justification, dependencies + standalone status.

### 4.1 INTERNAL portal

#### `views/orders/OrderList.vue` — **MIGRATED**

- **Lines:** 438
- **Status:** Already on Next.js (commit `dc8192a`). Read for completeness only.
- **Complexity:** SIMPLE (done).

#### `views/orders/OrderDetail.vue`

- **Lines:** 956
- **Purpose:** Internal portal order-detail shell — header, stage timeline, factory assignment, transitions, hosts 14 tab panels.
- **Key interactions:** stage transitions (forward / back / jump-to-stage) · reopen · delete · assign factory · approve client inquiry · tab routing via `?tab=`.
- **API endpoints called:** `ordersApi.{get, timeline, nextStage, transition, goBack, jumpToStage, reopen, delete, update, approveInquiry}`, `documentsApi.list`, `factoriesApi.list`.
- **Stage-gated logic:** **YES — heavy.** `stage_number` and `status` switches drive the timeline, reachable previous/forward stages, status banners, factory-assignment panel, and CLIENT_DRAFT inquiry panel.
- **File uploads/downloads:** No directly (delegated to child tabs).
- **Third-party integrations:** None at this layer.
- **Role checks:** `useAuth() → isSuperAdmin/isAdmin/isFinance`; transparency badge gated on `isSuperAdmin`.
- **Complexity:** **COMPLEX** (8–16h). Stage-stepper UX, jump-to-stage modal, transition warnings, override visualization, dynamic tab availability.
- **Standalone?** **NO** — depends on 14 unmigrated tab components. Strategy options: (a) migrate the shell with stub tabs; (b) migrate after enough tabs are ready.

#### `views/orders/OrderDraft.vue`

- **Lines:** 1,563
- **Purpose:** Internal "create new order" wizard — pick client/factory, search products, bulk-paste codes, browse catalog, attach unloaded/after-sales carry-forwards, submit draft.
- **Key interactions:** client/factory quick-create modals · product search + paginated browser · bulk paste with conflict resolution · quick-add unknown product modal · carry-forward selector · draft creation.
- **API endpoints:** `unloadedApi.getPending`, `afterSalesApi.getPending`, `clientsApi.{list, create}`, `factoriesApi.{list, create}`, `productsApi.{categories, search, validateCodes, create, list}`, `ordersApi.create`.
- **Stage-gated:** No (pre-creation).
- **File uploads/downloads:** No.
- **Third-party:** No.
- **Role checks:** Not visible in template.
- **Complexity:** **COMPLEX** (8–16h). Multiple parallel modal flows, bulk-paste fuzzy-match resolution UI, paginated browser with set-based selection, optimistic carry-forward inclusion.
- **Standalone?** **YES** — emits to API directly, no other unmigrated component dependencies. Good early-mid candidate. ~50% logic overlap with `ClientNewOrder.vue` — extract a shared `OrderBuilder` composable to avoid duplication.

#### `views/orders/ExcelUpload.vue`

- **Lines:** 1,010
- **Purpose:** Excel-driven bulk price/item upload wizard — upload → AI column mapping → preview parsed → conflict resolve → apply to order.
- **Key interactions:** file upload · column-mapping confirm · re-parse with mapping override · preview rows · send unknown SKUs to product bin / restore from bin · apply parsed data · cancel job.
- **API endpoints:** `ordersApi.get`, `excelApi.{upload, analyzeColumns, reparseJob, getJob, applyParsedData, cancelJob}`, `productsApi.restoreFromBin`.
- **Stage-gated:** Implicit (only meaningful in pricing stages).
- **File uploads/downloads:** **YES** — multipart Excel upload + processing-job lifecycle.
- **Third-party integrations:** **YES** — server-side Claude AI for column mapping (called via `excelApi.analyzeColumns`).
- **Role checks:** None visible.
- **Complexity:** **COMPLEX** (8–16h). Multi-step state machine, async job polling, AI confirmation flow, conflict UI.
- **Standalone?** **YES** — self-contained route, returns to order detail on success. Strong early candidate.

#### `components/order/OrderItemsTab.vue` — **THE BEAST 🔥**

- **Lines:** **3,338** (under 4,000 cutoff — analyzed in full).
- **Purpose:** Internal items management for an order — pricing table, PI generation, bulk add, queries panel, pending additions, image viewer.
- **Section map (line ranges):**
  - **Script setup (1–1,351)**:
    - 1–47 props/emits/transparency-aware computeds
    - 50–87 status/stage computeds (`isDraft`, `isPendingPI`, `canEditPrices`, etc.)
    - 89–172 inline price edit + image viewer state
    - 173–222 query inline status / counts
    - 223–410 query panel state + create/reply/resolve
    - 411–540 selection set, add-item modal, bulk-text-add (paste codes)
    - 541–740 PI state, totals, pricing computeds, carry-forward grouping
    - 741–940 markup / copy-prior-prices / recalc / reset-aftersales / categories
    - 941–1,100 bulk price Excel upload (parses with `ExcelJS` client-side)
    - 1,101–1,351 PI generate / download / download-with-images, pending-items fetch, item update/remove
  - **Template (1,353–3,328)**:
    - 1,355–2,481 main content: order info card, carry-forward banner, PI staleness banner, PI actions, pricing table, footer, fetch-pending banner, unpriced warning, pending additions grouped by lot, rejected items
    - 2,482–2,570 right sidebar: quick info + pricing guide
    - 2,576–2,683 Add Item modal (product browser)
    - 2,685–2,854 Bulk Text Add modal (paste codes)
    - 2,856–2,905 Remove Items confirm modal
    - 2,907–3,086 Bulk Price Upload modal
    - 3,088–3,123 Bulk Pending confirm dialog
    - 3,125–3,305 Item Query Panel (slide-out, threaded chat)
    - 3,307–3,328 Image Viewer Lightbox
- **API endpoints (~30 distinct):** `ordersApi.{updateItemPrices, bulkTextAddPreview, bulkTextAddApply, updateItem, sendPendingPrices, bulkConfirmItems, resetAftersalesPrices, recalculatePrices, copyPreviousPrices, addItems, removeItemWithNote, fetchPendingItems}`, `queriesApi.{list, inlineStatus, inlineQuery, get, reply, replyWithAttachment, create, resolve}`, `quotationsApi.{generatePI, downloadPI, downloadPIWithImages}`, `productsApi.{list, categories}`, `settingsApi.getCategories`.
- **Stage-gated:** **YES — pervasive.** Status guards: DRAFT, PENDING_PI, COMPLETED_EDITING, PI_SENT, FINAL_PI, post-PI set, STAGE_4_PLUS set; `pi_item_status` (PENDING/CONFIRMED/APPROVED/REJECTED) drives row classes, pricing editability, and lot grouping. **Hardcodes `/16` at line 2,494** — a stage-count drift bug to fix during migration.
- **File uploads/downloads:** **YES** — ExcelJS client-side parse of price upload, PI download (.xlsx, normal + with images), query attachment upload (FormData multipart).
- **Third-party integrations:** ExcelJS for client-side Excel parsing; transparency-client dual-pricing.
- **Role checks:** `props.isSuperAdmin` (passed from parent); transparency-client gating on factory price columns and INR override; chat sender role display.
- **Complexity:** **BEAST (40–60h).** Largest single component in the module. Three independent sub-flows (pricing/PI · bulk Excel upload · query system with attachments), each non-trivial.
- **Recommendation:** Split into 4–5 components on migration: `<PricingTable>`, `<PIActions>`, `<BulkUploadModal>`, `<QueryPanel>`, `<ImageViewer>` (last two could merge). Schedule LAST for the internal portal.
- **Standalone?** **NO** — relies on order parent for prop. The QueryPanel + Bulk Upload + PI flow are deeply intertwined; migrating one piece without the others would leave the screen broken.

#### `components/order/OrderDashboardTab.vue`

- **Lines:** 552
- **Purpose:** Read-only dashboard summary — payments, factory payments, shipments, customs BOE per shipment.
- **API endpoints:** `paymentsApi.list`, `paymentsApi.factoryList`, `shipmentsApi.list`, `customsApi.getBoe(shipmentId)` (parallel per shipment).
- **Stage-gated:** No (read-only aggregation).
- **File uploads/downloads:** No.
- **Third-party:** No.
- **Role checks:** None.
- **Complexity:** **MODERATE** (4–8h). Mostly presentation; parallel fan-out fetch is the only complexity.
- **Standalone?** **YES** — pure read.

### 4.2 CLIENT portal

#### `views/client/ClientOrders.vue`

- **Lines:** 134
- **Purpose:** Client portal order list (their own orders only).
- **API endpoints:** `ordersApi.list(params)`.
- **Complexity:** **SIMPLE** (2–4h). Standalone.

#### `views/client/ClientNewOrder.vue`

- **Lines:** 853
- **Purpose:** Client-initiated order inquiry — search products, bulk paste codes, attach pending unloaded + after-sales carry-forwards, submit as `CLIENT_DRAFT`.
- **API endpoints:** `afterSalesApi.list({carry_forward_only})`, `unloadedApi.list`, `productsApi.{list, categories, validateCodes}`, `ordersApi.createClientInquiry`.
- **Stage-gated:** No (pre-creation).
- **Complexity:** **COMPLEX** (8–16h). Slimmed-down clone of OrderDraft but still has bulk paste, conflict UI, paginated browser. **~50% overlap with OrderDraft.vue.**
- **Standalone?** **YES.** Migrate paired with OrderDraft to share an `OrderBuilder` composable.

#### `views/client/ClientOrderDetail.vue`

- **Lines:** 1,596
- **Purpose:** Client portal order detail shell — friendly status card, payments tab with submit + currency, production tab, packing summary + downloads, shipping, after-sales claims with photo upload, queries, files, landed cost.
- **Tabs (~9):** items, payments, production, packing, shipping, after_sales, final_draft, queries, files, landed_cost (visibility gated by `portalPerms`).
- **API endpoints:** `ordersApi.get`, `queriesApi.list`, `authApi.getMe`, `ordersApi.{activityFeed, productRequests, myLedger}`, `paymentsApi.submitPayment` (FormData with currency + exchange_rate), `productionApi.getProgress`, `shipmentsApi.list`, `documentsApi.{list, download}`, `packingApi.{clientSummary, downloadPDF, downloadExcel}`, `afterSalesApi.{clientGetForOrder, clientSubmitClaims}`, raw `api.post` for after-sales photo upload, raw `api.get` for PI download.
- **Stage-gated:** **YES** — `SHIPPING_STATUSES`, `isBookingStage`, `isSailingStage`, `isCustomsStage`, `POST_PI_STATUSES`, packingStatuses array. Tab visibility derived from status + `portalPerms`.
- **File uploads/downloads:** **YES** — payment proof (FormData), after-sales claim photos (FormData multipart), PI download (.xlsx blob), packing list download (.pdf or .xlsx), generic document download.
- **Third-party:** Currency / exchange-rate handling on payments; PI/packing PDF generation server-side.
- **Role checks:** Portal-permission flags (`portalPerms.show_shipping/show_after_sales/show_files/show_packing`) drive tab list — these are server-issued client permissions, not frontend role gates.
- **Complexity:** **COMPLEX** (8–16h). Many narrow flows, each non-trivial.
- **Standalone?** **NO** — embeds `ClientOrderItemsTab` + `ClientQueriesTab` + `LandedCostTab` + `FinalDraftTab`. Migrate the bundle together.

#### `components/order/ClientOrderItemsTab.vue`

- **Lines:** 1,616
- **Purpose:** **CLIENT portal items tab** (used inside `ClientOrderDetail.vue`, NOT the internal portal). Mirrors `OrderItemsTab` but client-restricted: confirm/reject pending PI items, ask queries, no factory pricing visibility.
- **API endpoints:** `ordersApi.{get, bulkConfirmItems, addItems, bulkTextAddPreview, bulkTextAddApply, updateItem, fetchPendingItems, removeItem, parsePriceExcel}`, `queriesApi.{list, inlineStatus, inlineQuery, get, reply, replyWithAttachment, create, resolve, reopen}`, `productsApi.{categories, list}`.
- **Stage-gated:** **YES** — `pi_item_status` (PENDING/CONFIRMED/APPROVED/REJECTED) drives confirm UI; carry-forward grouping.
- **File uploads/downloads:** **YES** — query attachments (FormData), price Excel passthrough.
- **Third-party:** No.
- **Role checks:** No useAuth import — assumes client role.
- **Complexity:** **COMPLEX** (8–16h). Half the size of internal `OrderItemsTab` but still 1,616 lines with full query thread system.
- **Standalone?** **NO** — only used inside `ClientOrderDetail`. Migrate together.

### 4.3 FACTORY portal

#### `views/factory/FactoryOrders.vue`

- **Lines:** 70
- **Purpose:** Factory portal order list (their own factory's orders).
- **API endpoints:** `ordersApi.list(params)`.
- **Complexity:** **SIMPLE** (1–2h). Standalone.

#### `views/factory/FactoryOrderDetail.vue`

- **Lines:** 99
- **Purpose:** Factory portal order detail — minimal stub. Just `ordersApi.get(orderId)` and renders basic info.
- **Complexity:** **SIMPLE** (1–2h). Standalone. Likely needs feature build-out post-migration (the factory portal looks immature — only ~170 lines total across two files vs ~2,500 client and ~6,500 internal).

---

## 5. Stage workflow — definitive reference

### 5.1 Stage count: **17 numbered stages (0..17 inclusive)**

**Source of truth:** `ERP_V1/backend/enums.py:258-282` — the `STAGE_MAP` dict.

The class docstring at `enums.py:9` reads: *"17-stage workflow statuses (20 internal sub-statuses)"*. The 23-status `OrderStatus` enum collapses to 17 numbered stages because four stages (4, 13, 14, 17) have multiple sub-statuses sharing one number. Backend timeline list at `routers/orders.py:2841-2850` enumerates exactly **17 numbered rows (1..17)**, plus stage 0 for the CLIENT_DRAFT inquiry.

### 5.2 ⚠️ Three places where the stage count drifts

| Location | What it claims | Status |
|---|---|---|
| `backend/enums.py:258-282` | **17** | ✅ Source of truth |
| `frontend/src/utils/constants.js:24-48` | **18** with phantom `FACTORY_PAYMENT` between PRODUCTION_100 and BOOKED | 🐛 Bug (no backend counterpart for `FACTORY_PAYMENT`) |
| `OrderItemsTab.vue:2494` | **16** (hardcoded `/16` in template) | 🐛 Bug |
| `harvesterp-web/apps/web/src/components/composed/stage-chip.tsx:24-39` | **14** (only 1..14 in tone map; 0, 15-17 fall through to neutral) | ⚠️ Intentional gap, documented in file header — but list rendering should arguably extend coverage |

**Migration fix:** Remove the phantom `FACTORY_PAYMENT` from `constants.js`, replace `/16` in `OrderItemsTab.vue` with `/{TOTAL_STAGES}`, and consider extending `stage-chip.tsx` to cover stages 0 + 15-17 (adds neutral / soft-success tones for COMPLETED, AFTER_SALES, etc.).

### 5.3 Stage table

| # | Status enum | Label | What happens | Terminal? | Trigger |
|---|---|---|---|---|---|
| 0 | CLIENT_DRAFT | Client Inquiry | CLIENT submits items only; ADMIN approves & assigns factory (`OrderDetail.vue:529 approveInquiry`) | No | Manual |
| 1 | DRAFT | Draft | Items add/edit/remove (`ITEM_EDITABLE_STAGES`); factory assignment via inline picker (OrderDetail.vue:649-677); requires `client_id`, `factory_id`, `≥1 ACTIVE item` to advance | No | Manual |
| 2 | PENDING_PI | Pending PI | Set selling prices (per-item gates); requires every priceable item to have `selling_price_inr` | No | Manual |
| 3 | PI_SENT | PI Sent | PI generated; await advance request | No | Manual |
| 4 | ADVANCE_PENDING / ADVANCE_RECEIVED | Advance Pending / Received | Record verified Payment row; underpayment → warning | No | Manual |
| 5 | FACTORY_ORDERED | Factory Ordered | Last stage where items can still be edited | No | Manual |
| 6 | PRODUCTION_60 | Production 60% | Mid-production add (`MID_ORDER_ADD_STAGES`) | No | Manual |
| 7 | PRODUCTION_80 | Production 80% | Mid-production add | No | Manual |
| 8 | PRODUCTION_90 | Production 90% | Mid-production add | No | Manual |
| 9 | PLAN_PACKING | Plan Packing | Upload packing list Excel (orders.py:2898-2910 hard-restricts to this stage) | No | Manual |
| 10 | FINAL_PI | Final PI | Auto-recalculates qty from packed items; requires PackingList exists | No | Manual |
| 11 | PRODUCTION_100 | Production 100% | Requires PI + records balance warning | No | Manual |
| 12 | BOOKED | Container Booked | Requires ≥1 FactoryPayment; factory underpayment warning | No | Manual |
| 13 | LOADED / SAILED / ARRIVED | Loaded / Sailing / Arrived | Stepwise transitions; ARRIVED warns if `eta > today` | No | Manual |
| 14 | CUSTOMS_FILED / CLEARED | Customs Filed / Cleared | BoE filing; DELIVERED requires BOE row + warns if not OOC | No | Manual |
| 15 | DELIVERED | Delivered | Carry-forward warnings; transitions into AFTER_SALES | Soft | Manual |
| 16 | AFTER_SALES | After-Sales | Open claims warning before advancing to COMPLETED | No | Manual |
| 17 | COMPLETED / COMPLETED_EDITING | Completed / Completed (Editing) | `completed_at` stamped; carry-forward items auto-fulfilled; only ADMIN/SUPER_ADMIN can `/reopen/` → COMPLETED_EDITING (orders.py:2498) | Yes (terminal forward; reopen toggles) | Manual |

**Stage families (multi-status under one number):** Stage 4 (ADVANCE_PENDING/ADVANCE_RECEIVED), Stage 13 (LOADED/SAILED/ARRIVED), Stage 14 (CUSTOMS_FILED/CLEARED), Stage 17 (COMPLETED/COMPLETED_EDITING). Plus the PRODUCTION_xx family at stages 6-11.

### 5.4 Transition diagram

Linear chain — `backend/services/stage_engine.py:48-72 VALID_TRANSITIONS`:

```
CLIENT_DRAFT → DRAFT → PENDING_PI → PI_SENT → ADVANCE_PENDING → ADVANCE_RECEIVED
  → FACTORY_ORDERED → PRODUCTION_60 → PRODUCTION_80 → PRODUCTION_90 → PLAN_PACKING
  → FINAL_PI → PRODUCTION_100 → BOOKED → LOADED → SAILED → ARRIVED
  → CUSTOMS_FILED → CLEARED → DELIVERED → AFTER_SALES → COMPLETED
  ↔ COMPLETED_EDITING (loop)
```

`REVERSE_TRANSITIONS` (`stage_engine.py:74-95`) is symmetric except: COMPLETED_EDITING has no reverse, and AFTER_SALES → DELIVERED is missing from the reverse map (present in VALID_TRANSITIONS).

### 5.5 ⚠️ Who can trigger each transition: NO ROLE GATING

`transition_order` (orders.py:2448), `go_back_order` (orders.py:2521), and `jump_to_stage` (orders.py:2553) **DO NOT check `current_user.role`**. Any authenticated user with order access can advance, regress, or jump stages. The only role-gated stage operation is `reopen_order` (orders.py:2498 — ADMIN / SUPER_ADMIN only).

Validation gates (`validate_transition` in `stage_engine.py`) enforce **data preconditions** (e.g. "must have ≥1 ACTIVE item to leave DRAFT", "must have a verified Payment row to leave ADVANCE_PENDING") but not roles.

**Decision needed before exposing stage controls in the new detail page:** is this intentional ("data preconditions are enough"), or should backend add role gates? Frontend can't safely assume the latter — if an OPERATIONS user clicks a transition button today, the backend accepts it.

### 5.6 UI assessment — stepper vs chip

**Vue OrderDetail.vue (lines 538-596) uses a custom horizontal stepper:** 17 numbered circles connected by lines.
- `completed` → emerald, check icon, clickable if in `reachablePrevious`
- `current` → white circle, emerald border
- `unlocked` → amber (high-water mark via `highest_unlocked_stage`), clickable if in `reachableForward`
- `pending` → grey
- Override badge on stages with overridden warnings

Stage transitions are exposed three ways (lines 680-717):
1. **"Next:" emerald button(s)** for each `nextStages` (forward chain)
2. **Grey back button** showing previous stage label
3. **Amber "Return to S{n}"** when `reachableForward` exists (replays a past advance)

**`StageChip` (already migrated, `apps/web/src/components/composed/stage-chip.tsx:24-39`) only encodes stages 1-14.** Stages 0 + 15-17 fall through to the neutral chip. Header comment says this is intentional. The migrated list page (`apps/web/src/app/(app)/orders/_components/order-row.tsx:122-127`) uses only the chip.

**Recommendation for the future detail page:** Build a new `<StageStepper>` component that consumes `/orders/{id}/timeline/` (orders.py:2828) + `/next-stages/` (orders.py:2437). Match the Vue version's three-button affordance (back / forward-jump / next) at minimum. The existing `StageChip` is fine for compact summary contexts. **Lift `<CarryForwardStepper>` from `apps/ui-gallery/src/components/composed/` (~200 LoC, already designed)** as the foundation — its statuses (complete/current/upcoming/blocked) map cleanly to the order-stage states.

---

## 6. API coverage matrix

**Backend prefix mounting (from `backend/main.py`):**
- `orders.router` → `/api/orders`
- `queries.router` → `/api/orders` (shares prefix; queries paths in queries.py are relative)
- `landed_cost.router` → `/api` (so its routes already start with `/orders/...`)
- `excel.pi_router` → `/api/excel`
- `shipping.router` → `/api/shipping`
- `aftersales.router` → `/api/aftersales`
- `finance.router` → `/api/finance`

### 6.1 Coverage matrix (53 endpoints — all order-namespaced + key cross-router consumers)

Vue source key: OL=OrderList, OD=OrderDetail, ODR=OrderDraft, EU=ExcelUpload, OIT=OrderItemsTab, ODT=OrderDashboardTab, COIT=ClientOrderItemsTab, CO=ClientOrders, CNO=ClientNewOrder, COD=ClientOrderDetail, FO=FactoryOrders, FOD=FactoryOrderDetail.

| Method | URL | Backend? | OpenAPI typed? | Vue consumer | Next.js proxied? | Stage-of-use |
|---|---|---|---|---|---|---|
| GET | /api/orders/ | yes (orders.py:312) | yes (path only; response unknown) | OL, CO, FO | ✅ orders/route.ts | List |
| GET | /api/orders/status-counts/ | yes (366) | yes | OL | ✅ orders/status-counts/route.ts | List badges |
| GET | /api/orders/my-ledger/ | yes (383) | yes | COD | ❌ | Client portal |
| GET | /api/orders/reconciliation/{order_id}/ | yes (492) | yes | (none in scanned set) | ❌ | Reconciliation |
| GET | /api/orders/{order_id}/ | yes (643) | yes | OD, ODR, OIT impl, COD, FOD | ❌ | Detail |
| POST | /api/orders/client-inquiry/ | yes (677) | yes | CNO | ❌ | Client draft |
| GET | /api/orders/{order_id}/product-requests/ | yes (792) | yes | COD | ❌ | Client product reqs |
| POST | /api/orders/{order_id}/approve-inquiry/ | yes (826) | yes | OD | ❌ | Inquiry approval |
| POST | /api/orders/ | yes (902) | yes | ODR | ❌ | Create order |
| PUT | /api/orders/{order_id}/ | yes (1000) | yes | OD | ❌ | Update header |
| DELETE | /api/orders/{order_id}/ | yes (1053) | yes | OL, OD | ✅ [id]/route.ts | Delete |
| PUT | /api/orders/{order_id}/delete-reason/ | yes (1145) | yes | OL | ✅ chained inside [id]/route.ts | Delete audit |
| POST | /api/orders/{order_id}/fetch-pending-items/ | yes (1365) | yes | OIT, COIT | ❌ | Carry-fwd items |
| POST | /api/orders/{order_id}/bulk-text-add/ | yes (1416) | yes | OIT, COIT | ❌ | Bulk preview |
| POST | /api/orders/{order_id}/bulk-text-add/apply/ | yes (1524) | yes | OIT, COIT | ❌ | Bulk apply |
| POST | /api/orders/{order_id}/items/ | yes (1541) | yes | OIT, COIT | ❌ | Add items |
| POST | /api/orders/{order_id}/items/{item_id}/confirm/ | yes (1670) | yes | (ordersApi.confirmItem; no caller) | ❌ | Confirm one |
| POST | /api/orders/{order_id}/items/bulk-confirm/ | yes (1734) | yes | OIT, COIT | ❌ | Bulk confirm |
| POST | /api/orders/{order_id}/items/send-prices/ | yes (1833) | yes | OIT | ❌ | Send to client |
| PUT | /api/orders/{order_id}/items/{item_id}/ | yes (1873) | yes | OIT, COIT | ❌ | Edit item |
| PUT | /api/orders/{order_id}/items/{item_id}/remove/ | yes (1917) | yes | OIT | ❌ | Remove w/ note |
| DELETE | /api/orders/{order_id}/items/{item_id}/ | yes (1979) | yes | COIT | ❌ | Delete item |
| PUT | /api/orders/{order_id}/items/{item_id}/prices/ | yes (2041) | yes | OIT | ❌ | Item pricing |
| POST | /api/orders/{order_id}/recalculate-prices/ | yes (2102) | yes | OIT | ❌ | Recalc landed |
| POST | /api/orders/{order_id}/copy-previous-prices/ | yes (2185) | yes | OIT | ❌ | Copy prev prices |
| POST | /api/orders/{order_id}/reset-aftersales-prices/ | yes (2289) | yes | OIT | ❌ | Reset AS prices |
| POST | /api/orders/{order_id}/parse-price-excel/ | yes (2333) | yes | COIT | ❌ | Excel pricing |
| GET | /api/orders/{order_id}/next-stages/ | yes (2437) | yes | OD | ❌ | Stage menu |
| PUT | /api/orders/{order_id}/transition/ | yes (2448) | yes | OD | ❌ | Stage move |
| PUT | /api/orders/{order_id}/reopen/ | yes (2490) | yes | OD | ❌ | Reopen (ADMIN-only) |
| PUT | /api/orders/{order_id}/go-back/ | yes (2521) | yes | OD | ❌ | Stage back |
| PUT | /api/orders/{order_id}/jump-to-stage/ | yes (2553) | yes | OD | ❌ | Jump stage |
| GET | /api/orders/{order_id}/activity-feed/ | yes (2586) | yes | COD | ❌ | Client portal |
| GET | /api/orders/{order_id}/timeline/ | yes (2828) | yes | OD, COD | ❌ | Timeline |
| POST | /api/orders/{order_id}/packing-list/upload/ | yes (2898) | yes | (PackingListTab) | ❌ | PL upload |
| POST | /api/orders/{order_id}/packing-list/manual/ | yes (3092) | yes | (PackingListTab) | ❌ | PL manual |
| GET | /api/orders/{order_id}/packing-list/client-summary/ | yes (3193) | yes | COD | ❌ | Client PL view |
| GET | /api/orders/{order_id}/packing-list/ | yes (3313) | yes | (PackingListTab) | ❌ | PL get |
| DELETE | /api/orders/{order_id}/packing-list/ | yes (3391) | yes | (PackingListTab) | ❌ | PL delete |
| PATCH | /api/orders/{order_id}/packing-list/items/{item_id}/ | yes (3419) | yes | (PackingListTab) | ❌ | PL item edit |
| POST | /api/orders/{order_id}/packing-list/items/{item_id}/split/ | yes (3478) | yes | (PackingListTab) | ❌ | PL split |
| POST | /api/orders/{order_id}/packing-list/items/{item_id}/unsplit/ | yes (3533) | yes | (PackingListTab) | ❌ | PL unsplit |
| POST | /api/orders/{order_id}/packing-list/items/{item_id}/decision/ | yes (3560) | yes | (PackingListTab) | ❌ | PL decision |
| GET | /api/orders/{order_id}/packing-list/download-excel/ | yes (3707) | yes | COD | ❌ | PL excel |
| GET | /api/orders/{order_id}/packing-list/download-pdf/ | yes (3921) | yes | COD | ❌ | PL pdf |
| POST | /api/orders/{order_id}/migrate-items/ | yes (4090) | yes | (PackingListTab) | ❌ | Migrate |
| POST | /api/orders/{order_id}/undo-migrate/ | yes (4196) | yes | (PackingListTab) | ❌ | Undo migrate |
| GET | /api/orders/{order_id}/production-progress/ | yes (4266) | yes | COD, ProductionTab | ❌ | Production |
| PUT | /api/orders/{order_id}/production-dates/ | yes (4305) | yes | (ProductionTab) | ❌ | Set dates |
| GET | /api/orders/{order_id}/download-pi/ | yes (4359) | yes | OIT | ❌ | Download PI |
| GET | /api/orders/{order_id}/download-pi-with-images/ | yes (4379) | yes | OIT | ❌ | Download PI+img |
| GET | /api/orders/{order_id}/landed-cost/ | yes (landed_cost.py:44) | yes | (LandedCostTab) | ❌ | Transparency |
| GET | /api/orders/{order_id}/landed-cost/download/ | yes | yes | (LandedCostTab) | ❌ | LC excel |
| **Queries (queries.py mounted at /api/orders):** |  |  |  |  |  |  |
| GET | /api/orders/{order_id}/queries/ | yes | yes | OIT, COIT | ❌ | Item chat |
| POST | /api/orders/{order_id}/queries/ | yes | yes | OIT, COIT | ❌ | New query |
| GET | /api/orders/{order_id}/queries/summary/ | yes | yes | (queriesApi) | ❌ | Badge counts |
| GET | /api/orders/{order_id}/queries/inline-status/ | yes | yes | OIT, COIT | ❌ | Inline pills |
| POST | /api/orders/{order_id}/queries/inline/ | yes | yes | OIT, COIT | ❌ | Inline create |
| GET | /api/orders/{order_id}/queries/{query_id}/ | yes | yes | OIT, COIT | ❌ | Thread |
| DELETE | /api/orders/{order_id}/queries/{query_id}/ | yes | yes | (queriesApi) | ❌ | Delete |
| POST | /api/orders/{order_id}/queries/{query_id}/reply/ | yes | yes | OIT, COIT | ❌ | Reply |
| POST | /api/orders/{order_id}/queries/{query_id}/reply/upload/ | yes | yes | OIT, COIT | ❌ | Reply attach |
| PUT | /api/orders/{order_id}/queries/{query_id}/resolve/ | yes | yes | OIT, COIT | ❌ | Resolve |
| PUT | /api/orders/{order_id}/queries/{query_id}/reopen/ | yes | yes | COIT | ❌ | Reopen |
| GET | /api/orders/{order_id}/queries/{query_id}/attachments/{filename} | yes | yes | (link href) | ❌ | Download attach |
| **Cross-router consumers used by order Vue files:** |  |  |  |  |  |  |
| POST | /api/excel/upload/ (with order_id param) | yes (excel.py:118) | likely | EU | ❌ | Excel parse |
| POST | /api/excel/analyze-columns/ | yes (186) | likely | EU | ❌ | AI mapping |
| POST | /api/excel/analyze-conflicts/ | yes (235) | likely | EU | ❌ | AI conflicts |
| GET | /api/excel/jobs/{job_id}/ | yes (247) | likely | EU | ❌ | Poll job |
| DELETE | /api/excel/jobs/{job_id}/ | yes (296) | likely | EU | ❌ | Cancel |
| POST | /api/excel/jobs/{job_id}/reparse/ | yes (326) | likely | EU | ❌ | Reparse |
| POST | /api/excel/apply/{job_id}/ | yes (409) | likely | EU | ❌ | Apply parsed |
| POST | /api/excel/generate-pi/{order_id}/ | yes (excel.pi_router) | likely | OIT | ❌ | Generate PI |
| GET | /api/finance/orders/{order_id}/payments/ | yes | yes | ODT, PaymentsTab | ❌ | Payment list |
| POST | /api/finance/orders/{order_id}/payments/ | yes | yes | (PaymentsTab) | ❌ | Add payment |
| GET | /api/finance/orders/{order_id}/factory-payments/ | yes | yes | ODT | ❌ | Factory pay |
| POST | /api/finance/orders/{order_id}/submit-payment/ | yes | yes | COD | ❌ | Client submit |
| GET | /api/shipping/orders/{order_id}/shipments/ | yes (shipping.py:396) | likely | ODT, COD | ❌ | Shipments |
| POST | /api/shipping/orders/{order_id}/shipments/ | yes (417) | likely | (BookingTab) | ❌ | New shipment |
| GET | /api/shipping/orders/{order_id}/shipping-documents/ | yes (814) | likely | (ShippingDocsTab) | ❌ | Docs |
| GET | /api/customs/shipments/{shipment_id}/boe/ | yes | likely | ODT | ❌ | BOE |
| GET | /api/aftersales/orders/{order_id}/ | yes | likely | (AfterSalesTab) | ❌ | After-sales |
| GET | /api/aftersales/client/orders/{order_id}/ | yes | likely | COD | ❌ | Client AS view |
| POST | /api/aftersales/client/orders/{order_id}/claims/ | yes | likely | COD | ❌ | Submit claims |

### 6.2 OpenAPI gaps

Within `orders.py` + `queries.py` + `landed_cost.py`, every endpoint has a matching path entry in `openapi.json`. **The catch is typing depth:** virtually all handlers return bare `dict` from FastAPI without a `response_model`, so the spec entries exist but the schema for `200 OK` is `application/json: {}` (effectively `unknown`). The SDK emits typed *paths* but response payloads surface as `unknown` and require `getJson<LocalShape>(...)` escape hatches in the Next.js layer for nearly every order endpoint.

The only true *missing-path* gaps are incidental — the cross-router consumers (`/api/excel/...`, `/api/shipping/orders/.../...`, `/api/customs/...`, `/api/aftersales/...`) were not exhaustively grepped; spot-check before assuming they are typed.

### 6.3 Dead endpoints (in OpenAPI but no Vue consumer in scanned set)

- `GET /api/orders/reconciliation/{order_id}/` — `ordersApi.reconciliation` exported, never called.
- `POST /api/orders/{order_id}/items/{item_id}/confirm/` — wrapper exists; only the bulk variant is invoked.
- `DELETE /api/orders/{order_id}/queries/{query_id}/` — wrapper exists; no UI call.

Several "(likely consumed)" rows depend on tab files that were out of scope (PackingListTab, ProductionTab, etc.). Verify before flagging anything as truly dead.

### 6.4 Proxy surface remaining

Currently **3** order-related Next.js proxies exist: `GET /api/orders`, `GET /api/orders/status-counts`, `DELETE /api/orders/[id]`. To reach feature parity for the orders module, **~50 additional proxy routes** are needed. Pragmatic grouping yields **20-25 new `route.ts` files** (each handling 1-4 verbs).

### 6.5 Untyped surface (Section 10 local-interface required)

Practically every order proxy will need a local `interface` declaration to type the `getJson<T>` payload. The pattern is established in the existing routes (`OrderListResponse`, `StatusCountsRaw`). Highest-impact local shapes still to author:
- Order detail object returned by `GET /{order_id}/` (huge — embeds items, client, factory, production dates, PI files)
- `next-stages` enum array
- `timeline` array
- `activity-feed` page shape
- `productionProgress`
- `packingListClientSummary`
- `landedCost` breakdown
- `queries` list/thread/summary objects
- `bulk-text-add` preview shape
- `parsePriceExcel` job result

---

## 7. Design system gaps

### 7.1 Reference screen coverage

`ERP_V1/Design/screens/` has 10 `.jsx` reference screens. **Surprising finding: `sales.jsx` is a kanban deal pipeline, not the order/SO detail page implied by the file name.** No tabs, no stepper, no line items, no payment timeline.

The closest detail-screen references are:
- **`procurement.jsx`** — PO detail two-column layout: line-item table + totals panel on left, vertical stepper "Approval workflow" + compliance checklist + notes textarea on right. **Best precedent for an order-detail page with stepper.**
- **`finance.jsx`** — invoice list table with status chips + invoice detail panel (line items + totals + actions). **Closest match for an invoice/payment-style detail card.**

**No reference shows:** tabs/tab nav · file-upload dropzone · payment timeline · shipment/customs timeline · multi-step wizard · query/issues thread · Excel-import flow.

### 7.2 Layer 2 components in apps/web (11 already built)

`admin-forbidden-state` · `client-avatar` · `delete-confirm-dialog` · `image-gallery` · `image-lightbox` · `kpi-card` · `ledger-page` · `pagination` · `role-gate` · `stage-chip` · `user-dropdown`.

### 7.3 Layer 1 primitives in apps/web (10 already built)

`alert-dialog` · `button` · `card` · `dropdown-menu` · `input` · `label` · `select` · `skeleton` · `table` · `textarea`.

**Notable missing primitives:** Tabs (Radix wrapper) · Tooltip · Popover · Form · Combobox · Switch · Checkbox · Radio · Calendar/DatePicker · Sheet · Dialog (only AlertDialog exists) · Progress.

### 7.4 ui-gallery prototypes ready to lift

Located in `harvesterp-web/apps/ui-gallery/src/components/composed/`. Four are already lifted; **four are awaiting:**

| Component | LoC | Why we need it |
|---|---|---|
| `carry-forward-stepper.tsx` | 200 | Horizontal/vertical stepper with statuses (complete/current/upcoming/blocked). **Foundation for the order-detail StageStepper.** |
| `confirm-dialog.tsx` | 240 | D-003 canonical: typed-confirmation + preserveContext card + bilingual (DialogString). Richer than the current `delete-confirm-dialog.tsx`. |
| `highlight-scroll-target.tsx` | 95 | P-022 anchor + flash-on-hash-match wrapper. Designed for OrderItemsTab/PaymentsTab/PackingListTab deep-links. |
| `page-shell.tsx` | 125 | Title + breadcrumbs + actions slot, with `onNavigate` abstraction ready for Next.js Link. |

### 7.5 Per-sub-page coverage matrix

| Sub-page | Reference | Layer 2 reuse | Layer 2 GAP | Primitive needs | New patterns |
|---|---|---|---|---|---|
| Order Detail (header + tab nav) | procurement.jsx | StageChip, KpiCard, RoleGate, Card, Pagination | OrderHeaderCard (build-new), TabNav (wrap Radix Tabs primitive), PageShell (lift) | **Tabs (missing — blocks page)**, Tooltip, Dialog | Stage transition action bar (`StageTransitionBar`) |
| Items tab | procurement.jsx + finance.jsx | LedgerPage columns/totals pattern, Card, DeleteConfirmDialog | LineItemsTable (build-new), HighlightScrollTarget (lift) | NumberInput (missing), inline-edit cell (missing) | "Add line item" inline form row |
| Payments tab | finance.jsx (closest) | Card, KpiCard, DeleteConfirmDialog, StageChip | PaymentsList (build-new), CarryForwardStepper (lift) | DatePicker, CurrencyInput, Tooltip | AddPaymentForm modal |
| Shipping tab | procurement.jsx (analog) | StageChip, Card, ImageGallery, ImageLightbox, CarryForwardStepper | ShipmentTimeline, TrackingCard, CustomsDocsTable (all build-new) | Tooltip, sub-tabs | Map/route preview (deferred) |
| After-sales tab | none in Design/screens | Card, RoleGate, ClientAvatar, ImageGallery, DeleteConfirmDialog | QueryThread, IssueComposer (build-new) | Tooltip, file-input | Status pills (could extend StageChip with `tone` prop) |
| Order Draft (wizard) | none (procurement stepper is workflow, not wizard) | RoleGate, KpiCard, DeleteConfirmDialog | WizardShell (stepper + body + footer), FormSectionCard (build-new) | Form, Checkbox, Radio, Combobox, DatePicker | Auto-save indicator |
| Excel Upload | none | Card, DeleteConfirmDialog | FileDropzone, ImportPreviewTable, ImportSummaryCard (all build-new) | Progress (missing), Tooltip | Error-row list with inline fix |
| Client portal: Orders / Detail / New | sales.jsx visually closest | All from internal Detail apply | All gaps from internal Detail apply, plus PortalShell variant of PageShell | Same | Read-only stage transitions |
| Factory portal: Orders / Detail | procurement.jsx (vendor-side analog) | Same as internal | Same as internal Detail + AcknowledgeBar (factory accept/reject) | Same | Factory-scoped action gating |

### 7.6 Top 3 missing Layer 2 components (by reuse priority)

1. **`Tabs` (Layer 1 primitive) + `TabNav` (Layer 2 wrapper)** — used by Order Detail, Client portal Detail, Factory portal Detail, Settings, and any future multi-tab card. **Highest reuse, blocks Order Detail entirely.** Adopt `@radix-ui/react-tabs` with the design-system's chip-style trigger.
2. **`PageShell`** (lift-from-prototype, 125 LoC, zero new code) — needed by every sub-page. Trivial port; rewires `onNavigate` to Next.js `useRouter().push`.
3. **`CarryForwardStepper`** (lift-from-prototype, 200 LoC, zero new code) — used by Payments tab, Shipping tab, Order Draft wizard, and the future order-detail StageStepper. **Highest cross-module reuse.**

### 7.7 Design references to request from designers

- `order-detail.jsx` — multi-tab order card (header + Tabs + each tab body example).
- `order-draft-wizard.jsx` — multi-step new-order wizard (stepper header + form-section bodies + footer).
- `excel-upload.jsx` — dropzone + import preview + error rows.
- `after-sales-thread.jsx` — issue/query thread view.
- `shipment-timeline.jsx` — vertical event timeline with attachments and customs sub-state.
- Optional: `client-portal-shell.jsx` — to clarify how the chrome diverges from the internal portal.

---

## 8. Migration sequence recommendation

### 8.1 Critical path

**Foundation must land first** — without these, every detail-shaped page is blocked:

1. **Lift Tabs Radix primitive + PageShell + CarryForwardStepper + HighlightScrollTarget.** One PR, ~5 files added/modified, no new behavior. ~3-4 hours.
2. **Add `/api/orders/{id}/` GET proxy + `/timeline/` proxy + `/next-stages/` proxy + `/transition/` PUT proxy.** Local interfaces for each. ~2-3 hours.
3. **Decide stage-transition role-gating policy** (5.5 above). Backend currently accepts any auth'd user with order access; the new detail page either mirrors that (and we accept the security gap) or asks backend to add gates first.

### 8.2 Phased migration

| Phase | Migrations | Hours | Notes |
|---|---|---|---|
| **A — Foundation** | Tabs lift, PageShell lift, CarryForwardStepper lift, HighlightScrollTarget lift, /api/orders/{id} GET proxy, /timeline + /next-stages + /transition proxies | 6-8 | One PR; unblocks everything else. |
| **B — Warm-up wins** | FactoryOrders.vue (70 lines · SIMPLE), FactoryOrderDetail.vue (99 lines · SIMPLE), ClientOrders.vue (134 lines · SIMPLE) | 6-10 | Pure mirrors of clients-list pattern. Zero new components. |
| **C — Standalone medium** | OrderDashboardTab.vue (552 · MODERATE), ExcelUpload.vue (1,010 · COMPLEX) | 12-24 | Both standalone. ExcelUpload introduces FileDropzone + ImportPreviewTable. |
| **D — Paired wizard** | OrderDraft.vue (1,563) + ClientNewOrder.vue (853) — together with shared `OrderBuilder` composable | 16-32 | Must be paired or you'll duplicate ~50% of logic. Introduces WizardShell + FormSectionCard + Combobox + DatePicker. |
| **E — Client detail bundle** | ClientOrderDetail.vue (1,596) + ClientOrderItemsTab.vue (1,616) + 4 client-only sibling tabs (LandedCostTab, FinalDraftTab, FilesTab, QueriesTab subset) | 24-40 | Migrate as a bundle — embedded children. |
| **F — Internal sibling tabs** | The 12 unmigrated sibling tabs of `OrderDetail.vue` (PaymentsTab, ProductionTab, PackingListTab, BookingTab, SailingTab, ShippingDocsTab, CustomsTab, AfterSalesTab, FilesTab, QueriesTab, FinalDraftTab, LandedCostTab) | 40-80 | **Separate audits required** — these were out of scope. Each likely 200-800 lines. |
| **G — The BEAST** | OrderItemsTab.vue (3,338) — split into `<PricingTable>`, `<PIActions>`, `<BulkUploadModal>`, `<QueryPanel>`, `<ImageViewer>` | 40-60 | The single largest component. **Do this last for the internal portal.** |
| **H — Detail shell** | OrderDetail.vue (956) — assembles all the above tabs + StageStepper | 8-16 | Cleanup phase. Mostly wiring. |

### 8.3 Total effort

- **In-scope files (12 unmigrated + already-done OrderList):** ~96-172h.
- **Out-of-scope sibling tabs (12 components):** estimated ~40-80h additional based on typical tab complexity.
- **Foundation work (Phase A):** ~6-8h.
- **Realistic full-module total: ~140-260 hours** (~17-32 working days for one engineer, excluding QA/PR cycles + design polish).

### 8.4 What can be parallelized vs serialized

- **Parallelizable:** Phases B (warm-ups) can run alongside A (foundation). Phases C and D can run alongside Phase F siblings. Different developers can own different phases.
- **Serialized:** Phase A blocks D, E, F, G, H (the wizard, detail bundles, BEAST, and shell all need Tabs + PageShell + CarryForwardStepper). Phase G (OrderItemsTab BEAST) blocks Phase H (shell completion) because the shell can only render fully-functional once items work.

### 8.5 What can be deferred

- **`/products/upload-excel`** route — same `ExcelUpload.vue` file as `/orders/:id/upload-excel`. If we migrate the order-context first, the products-context falls out for free or with a small branch.
- **Factory portal feature build-out** — the existing 170 lines is anaemic. A faithful migration ships an equally-thin Next.js page; designers/PMs may want to expand it later.
- **`/products/:id/orders` reverse linking** — does not exist as a route today; not part of this migration.

### 8.6 Risk assessment

**Technical risks:**
1. **OrderItemsTab.vue 3,338-line BEAST** — 30+ endpoints, 3 intertwined sub-flows, must be split. Mitigation: dedicated 3-5 day session; not bundled with sibling tabs; explicit component-decomposition design doc before implementation.
2. **No design references** for tabs · wizard · dropzone · query thread · shipment timeline · multi-tab card. Mitigation: request 6 reference screens from designers (list in 7.7); don't start D/E/F/G blind.
3. **Backend transitions are not role-gated.** Mitigation: explicit policy decision before Phase A lands; either accept gap + document, or request backend patch first.
4. **Stage-count drift** in 3 places. Mitigation: fix during Phase G (OrderItemsTab) and during the lift of `<StageStepper>`. Add a unit test asserting backend STAGE_MAP is the only source.

**Scope risks:**
5. **12 sibling tabs out of scope** of this audit — could be larger or smaller than estimates assume. Mitigation: dedicated 1-day Phase F discovery audit before committing the F estimate to a sprint.
6. **`OrderBuilder` shared composable** between OrderDraft + ClientNewOrder — done wrong, this becomes a YAGNI engine. Mitigation: extract only after both Vue files have been read in full and the overlap is concretely measured at the function level.

**Backend gaps blocking frontend work:**
7. None identified — backend is already feature-complete for everything Vue uses today. The gaps are in OpenAPI typing depth (response_model), not endpoint availability.

---

## 9. Appendix — raw file list with line counts

```
INTERNAL portal
  views/orders/OrderList.vue                       438  [MIGRATED]
  views/orders/OrderDetail.vue                     956  COMPLEX
  views/orders/OrderDraft.vue                    1,563  COMPLEX
  views/orders/ExcelUpload.vue                   1,010  COMPLEX
  components/order/OrderItemsTab.vue             3,338  BEAST
  components/order/OrderDashboardTab.vue           552  MODERATE
  components/order/ClientOrderItemsTab.vue       1,616  COMPLEX (used in CLIENT portal)

CLIENT portal
  views/client/ClientOrders.vue                    134  SIMPLE
  views/client/ClientNewOrder.vue                  853  COMPLEX
  views/client/ClientOrderDetail.vue             1,596  COMPLEX

FACTORY portal
  views/factory/FactoryOrders.vue                   70  SIMPLE
  views/factory/FactoryOrderDetail.vue              99  SIMPLE

Total in-scope unmigrated lines:                ~11,387

Out of scope (referenced by OrderDetail.vue, not analyzed):
  components/order/PaymentsTab.vue               (?)
  components/order/ProductionTab.vue             (?)
  components/order/PackingListTab.vue            (?)
  components/order/BookingTab.vue                (?)
  components/order/SailingTab.vue                (?)
  components/order/ShippingDocsTab.vue           (?)
  components/order/CustomsTab.vue                (?)
  components/order/AfterSalesTab.vue             (?)
  components/order/FilesTab.vue                  (?)
  components/order/QueriesTab.vue                (?)
  components/order/FinalDraftTab.vue             (?)
  components/order/LandedCostTab.vue             (?)
```

### Source-of-truth files cited

- `C:/Dev/Template_1/ERP_V1/backend/enums.py` (canonical STAGE_MAP, lines 258-282)
- `C:/Dev/Template_1/ERP_V1/backend/services/stage_engine.py` (transitions + validation, lines 48-95)
- `C:/Dev/Template_1/ERP_V1/backend/routers/orders.py` (HTTP layer; lines 2437-2583 stage endpoints; 2828 timeline)
- `C:/Dev/Template_1/ERP_V1/backend/routers/queries.py` (mounted at /api/orders)
- `C:/Dev/Template_1/ERP_V1/backend/routers/landed_cost.py` (mounted at /api)
- `C:/Dev/Template_1/ERP_V1/frontend/src/router/index.js` (lines 17-42 internal, 229-247 client, 299-323 factory; guard 340-399)
- `C:/Dev/Template_1/ERP_V1/frontend/src/utils/constants.js` (FRONTEND DRIFT — 18 stages with phantom FACTORY_PAYMENT)
- `C:/Dev/Template_1/ERP_V1/frontend/src/views/orders/OrderDetail.vue` (stepper UI, lines 538-596)
- `C:/Dev/Template_1/ERP_V1/frontend/src/components/order/OrderItemsTab.vue:2494` (hardcoded `/16` — third drift)
- `C:/Dev/Template_1/harvesterp-web/apps/web/src/components/composed/stage-chip.tsx` (covers stages 1-14 only)
- `C:/Dev/Template_1/harvesterp-web/apps/web/src/app/(app)/orders/_components/stage-groups.ts` (8 filter groups, NOT stage list)
- `C:/Dev/Template_1/harvesterp-web/apps/ui-gallery/src/components/composed/carry-forward-stepper.tsx` (lift candidate)
- `C:/Dev/Template_1/harvesterp-web/apps/ui-gallery/src/components/composed/page-shell.tsx` (lift candidate)
- `C:/Dev/Template_1/harvesterp-web/apps/ui-gallery/src/components/composed/highlight-scroll-target.tsx` (lift candidate)
- `C:/Dev/Template_1/harvesterp-web/apps/ui-gallery/src/components/composed/confirm-dialog.tsx` (richer confirm-dialog)
- `C:/Dev/Template_1/harvesterp-web/packages/sdk/openapi.json` (typed paths; mostly unknown response schemas)

### Live verification

Backend was probed on 2026-04-26: `/api/auth/login` returned 401 with bad creds (healthy, not 502). All endpoints enumerated above are presumed live based on backend source presence; spot-checks of `GET /api/orders/`, `POST /api/shipping/transport/`, and `DELETE /api/shipping/transport/{id}/` succeeded during recent migrations on this same backend.
