# HarvestERP Frontend — Page Inventory

_Recon pass A — route/component/API surface only. Per-page profiles deferred to Pass B._

Source: [frontend/src/router/index.js](../../frontend/src/router/index.js) · Framework: Vue 3.5 + Vue Router 4.6 + Pinia 3 + PrimeVue 4.5 + Tailwind 4 · Build: Vite 7.

## Summary
- **Total pages:** 41 (Vue components under `src/views/`)
- **Total routes:** 48 named routes + 3 layout-parent routes + 2 internal redirects (`/` → `/dashboard`, `/finance` → `/finance/receivables`)
- **Portals detected:** Internal (`INTERNAL` users — no `/admin` prefix, routes mount at root), Client (`/client-portal/*`), Factory (`/factory-portal/*`). Portal isolation enforced in `router.beforeEach` (see [router/index.js:373-388](../../frontend/src/router/index.js#L373)).
- **Total components:** 22 (under `src/components/`; excludes view-level pages)
- **Total composables:** 4 (`src/composables/`)
- **Total Pinia stores:** 0 — `src/stores/` exists but is empty. Pinia is initialized in [main.js:13](../../frontend/src/main.js#L13), but all cross-page state currently lives in composables (`useAuth`, `useNotifications`).
- **Total API methods:** 222 across 22 modules, all declared in a single file [src/api/index.js](../../frontend/src/api/index.js)

## Route Tree

### Internal / Admin Portal (mounts at `/` — `user_type === 'INTERNAL'`)

Layout: `App.vue` → `Sidebar.vue` + `Topbar.vue` (no dedicated layout route; components rendered globally when not inside portal layouts).

- `/` → redirect → `/dashboard`
- `/dashboard` → [views/Dashboard.vue](../../frontend/src/views/Dashboard.vue)  _(221 lines)_
  - sub-tabs: none (flat summary page using `dashboardApi`)
- `/orders` → [views/orders/OrderList.vue](../../frontend/src/views/orders/OrderList.vue)
- `/orders/new` → [views/orders/OrderDraft.vue](../../frontend/src/views/orders/OrderDraft.vue)  _(1563 lines — largest page in app)_
- `/orders/:id` → [views/orders/OrderDetail.vue](../../frontend/src/views/orders/OrderDetail.vue)  _(956 lines)_
  - sub-tabs (14, driven by `activeTab` ref, deep-linkable via `?tab=` query): **dashboard, items, payments, production, packing, booking, sailing, shipping-docs, customs, after-sales, final-draft, queries, files, landed-cost**
  - tab components (1:1 with sub-tabs): `OrderDashboardTab`, `OrderItemsTab`, `PaymentsTab`, `ProductionTab`, `PackingListTab`, `BookingTab`, `SailingTab`, `ShippingDocsTab`, `CustomsTab`, `AfterSalesTab`, `FinalDraftTab`, `QueriesTab`, `FilesTab`, `LandedCostTab`
  - notification deep-links target these tabs (see [Sidebar.vue:38-61](../../frontend/src/components/layout/Sidebar.vue#L38))
- `/orders/:id/upload-excel` → [views/orders/ExcelUpload.vue](../../frontend/src/views/orders/ExcelUpload.vue)
  - embedded sub-views: `ParsedResultsTable`, `ConflictResolutionPanel`, `ColumnMappingDialog`

**Master Data**
- `/products` → [views/products/ProductList.vue](../../frontend/src/views/products/ProductList.vue)
- `/products/new` → [views/products/ProductForm.vue](../../frontend/src/views/products/ProductForm.vue) (ProductNew)
- `/products/:id/edit` → [views/products/ProductForm.vue](../../frontend/src/views/products/ProductForm.vue) (ProductEdit, same component)
- `/products/upload-excel` → [views/orders/ExcelUpload.vue](../../frontend/src/views/orders/ExcelUpload.vue) _(reuses the orders ExcelUpload page with `schema_type='product'`)_
- `/products/review` → [views/products/ProductReview.vue](../../frontend/src/views/products/ProductReview.vue) _(role-gated: ADMIN)_
- `/factories` → [views/factories/FactoryList.vue](../../frontend/src/views/factories/FactoryList.vue)
- `/factories/new` → [views/factories/FactoryForm.vue](../../frontend/src/views/factories/FactoryForm.vue)
- `/factories/:id/edit` → [views/factories/FactoryForm.vue](../../frontend/src/views/factories/FactoryForm.vue)
- `/clients` → [views/clients/ClientList.vue](../../frontend/src/views/clients/ClientList.vue)
- `/clients/new` → [views/clients/ClientForm.vue](../../frontend/src/views/clients/ClientForm.vue)
- `/clients/:id/edit` → [views/clients/ClientForm.vue](../../frontend/src/views/clients/ClientForm.vue)
- `/transport` → [views/transport/TransportList.vue](../../frontend/src/views/transport/TransportList.vue)
- `/transport/new` → [views/transport/TransportForm.vue](../../frontend/src/views/transport/TransportForm.vue)
- `/transport/:id/edit` → [views/transport/TransportForm.vue](../../frontend/src/views/transport/TransportForm.vue)

**Tracking**
- `/after-sales` → [views/AfterSales.vue](../../frontend/src/views/AfterSales.vue)
- `/finance` → [views/finance/FinanceLayout.vue](../../frontend/src/views/finance/FinanceLayout.vue) _(nested layout; `<router-view />` container)_
  - `/finance` → redirect → `/finance/receivables`
  - `/finance/receivables` → [views/finance/Receivables.vue](../../frontend/src/views/finance/Receivables.vue)
  - `/finance/client-ledger` → [views/finance/ClientLedger.vue](../../frontend/src/views/finance/ClientLedger.vue)
  - `/finance/factory-ledger` → [views/finance/FactoryLedger.vue](../../frontend/src/views/finance/FactoryLedger.vue)
- `/returns-pending` → [views/ReturnsPending.vue](../../frontend/src/views/ReturnsPending.vue)
- `/warehouse` → [views/WarehouseStock.vue](../../frontend/src/views/WarehouseStock.vue)

**Admin (role-gated: `meta.roles: ['ADMIN']`)**
- `/settings` → [views/Settings.vue](../../frontend/src/views/Settings.vue)
- `/users` → [views/Users.vue](../../frontend/src/views/Users.vue)
- `/audit-logs` → [views/AuditLogs.vue](../../frontend/src/views/AuditLogs.vue)
- `/tech-stack` → [views/TechStack.vue](../../frontend/src/views/TechStack.vue)

**Auth / System**
- `/login` → [views/Login.vue](../../frontend/src/views/Login.vue) _(`meta.public: true`)_
- `/access-denied` → [views/AccessDenied.vue](../../frontend/src/views/AccessDenied.vue)

### Client Portal (`/client-portal/*` — `user_type === 'CLIENT'`)

Layout: [components/layout/ClientLayout.vue](../../frontend/src/components/layout/ClientLayout.vue) _(parent route, unnamed; renders `<router-view />` for children)_.

- `/client-portal/` → `ClientDashboard` → [views/client/ClientDashboard.vue](../../frontend/src/views/client/ClientDashboard.vue)
- `/client-portal/orders` → `ClientOrders` → [views/client/ClientOrders.vue](../../frontend/src/views/client/ClientOrders.vue)
- `/client-portal/orders/new` → `ClientNewOrder` → [views/client/ClientNewOrder.vue](../../frontend/src/views/client/ClientNewOrder.vue)
- `/client-portal/orders/:id` → `ClientOrderDetail` → [views/client/ClientOrderDetail.vue](../../frontend/src/views/client/ClientOrderDetail.vue)
  - embedded tab: `ClientOrderItemsTab` (shared component in [components/order/](../../frontend/src/components/order/))
- `/client-portal/products` → `ClientProducts` → [views/client/ClientProducts.vue](../../frontend/src/views/client/ClientProducts.vue)
- `/client-portal/ledger` → `ClientPortalLedger` → [views/client/ClientLedger.vue](../../frontend/src/views/client/ClientLedger.vue) _(distinct file from the internal finance one — same component name, different folder)_
- `/client-portal/shipments` → `ClientShipments` → [views/client/ClientShipments.vue](../../frontend/src/views/client/ClientShipments.vue)
- `/client-portal/after-sales` → `ClientAfterSales` → [views/client/ClientAfterSales.vue](../../frontend/src/views/client/ClientAfterSales.vue)
- `/client-portal/returns-pending` → `ClientReturnsPending` → [views/client/ClientReturnsPending.vue](../../frontend/src/views/client/ClientReturnsPending.vue)
- `/client-portal/profile` → `ClientProfile` → [views/client/ClientProfile.vue](../../frontend/src/views/client/ClientProfile.vue)

### Factory Portal (`/factory-portal/*` — `user_type === 'FACTORY'`)

Layout: [components/layout/FactoryLayout.vue](../../frontend/src/components/layout/FactoryLayout.vue) _(parent route, unnamed)_.

- `/factory-portal/` → `FactoryDashboard` → [views/factory/FactoryDashboard.vue](../../frontend/src/views/factory/FactoryDashboard.vue)
- `/factory-portal/orders` → `FactoryOrders` → [views/factory/FactoryOrders.vue](../../frontend/src/views/factory/FactoryOrders.vue)
- `/factory-portal/orders/:id` → `FactoryOrderDetail` → [views/factory/FactoryOrderDetail.vue](../../frontend/src/views/factory/FactoryOrderDetail.vue)
- `/factory-portal/production` → `FactoryProduction` → **reuses `FactoryOrders.vue`** _(same component, different meta.title)_
- `/factory-portal/packing` → `FactoryPacking` → **reuses `FactoryOrders.vue`** _(same component, different meta.title)_
- `/factory-portal/profile` → `FactoryProfile` → [views/factory/FactoryProfile.vue](../../frontend/src/views/factory/FactoryProfile.vue)

## Shared Components (used across portals / multiple pages)

### Layout
- `ClientLayout`                 → [components/layout/ClientLayout.vue](../../frontend/src/components/layout/ClientLayout.vue)  — client portal shell
- `FactoryLayout`                → [components/layout/FactoryLayout.vue](../../frontend/src/components/layout/FactoryLayout.vue) — factory portal shell
- `Sidebar`                      → [components/layout/Sidebar.vue](../../frontend/src/components/layout/Sidebar.vue) _(288 lines — role-filtered menu groups, notification center, user menu)_
- `Topbar`                       → [components/layout/Topbar.vue](../../frontend/src/components/layout/Topbar.vue)

### Order sub-tabs (used by both internal `OrderDetail` and client `ClientOrderDetail` where applicable)
- `OrderDashboardTab`            → [components/order/OrderDashboardTab.vue](../../frontend/src/components/order/OrderDashboardTab.vue)
- `OrderItemsTab`                → [components/order/OrderItemsTab.vue](../../frontend/src/components/order/OrderItemsTab.vue)
- `ClientOrderItemsTab`          → [components/order/ClientOrderItemsTab.vue](../../frontend/src/components/order/ClientOrderItemsTab.vue)
- `PaymentsTab`                  → [components/order/PaymentsTab.vue](../../frontend/src/components/order/PaymentsTab.vue)
- `ProductionTab`                → [components/order/ProductionTab.vue](../../frontend/src/components/order/ProductionTab.vue)
- `PackingListTab`               → [components/order/PackingListTab.vue](../../frontend/src/components/order/PackingListTab.vue)
- `BookingTab`                   → [components/order/BookingTab.vue](../../frontend/src/components/order/BookingTab.vue)
- `SailingTab`                   → [components/order/SailingTab.vue](../../frontend/src/components/order/SailingTab.vue)
- `ShippingDocsTab`              → [components/order/ShippingDocsTab.vue](../../frontend/src/components/order/ShippingDocsTab.vue)
- `CustomsTab`                   → [components/order/CustomsTab.vue](../../frontend/src/components/order/CustomsTab.vue)
- `AfterSalesTab`                → [components/order/AfterSalesTab.vue](../../frontend/src/components/order/AfterSalesTab.vue)
- `FinalDraftTab`                → [components/order/FinalDraftTab.vue](../../frontend/src/components/order/FinalDraftTab.vue)
- `QueriesTab`                   → [components/order/QueriesTab.vue](../../frontend/src/components/order/QueriesTab.vue)
- `FilesTab`                     → [components/order/FilesTab.vue](../../frontend/src/components/order/FilesTab.vue)
- `LandedCostTab`                → [components/order/LandedCostTab.vue](../../frontend/src/components/order/LandedCostTab.vue)

### Excel ingestion (shared by orders + products upload flows)
- `ConflictResolutionPanel`      → [components/orders/ConflictResolutionPanel.vue](../../frontend/src/components/orders/ConflictResolutionPanel.vue)
- `ParsedResultsTable`           → [components/orders/ParsedResultsTable.vue](../../frontend/src/components/orders/ParsedResultsTable.vue)
- `ColumnMappingDialog`          → [components/common/ColumnMappingDialog.vue](../../frontend/src/components/common/ColumnMappingDialog.vue)  _(the sole `common/` component — AI-assisted column mapping during Excel import)_

> No dedicated shared primitives (DataTable wrapper, StatusBadge, Money, FormField, etc.) — presentation primitives come directly from **PrimeVue** (`DataTable`, `Dialog`, `Button`, etc.). All modals/dialogs in the app are defined inline within their parent pages, not extracted.

## Pinia Stores

**`src/stores/` is empty.** Pinia is registered ([main.js:13](../../frontend/src/main.js#L13)) but no `defineStore()` call exists anywhere in the codebase. All cross-page state is held in the composables below (ref/reactive at module scope → behaves like a singleton store).

## Composables (de-facto stores)

- `useAuth`                      → [composables/useAuth.js](../../frontend/src/composables/useAuth.js) _(164 lines)_ — token, user, roles, `restoreSession()`, `getPortalPath()`; imported by `router/index.js` guard and `Sidebar.vue`; **every authenticated page depends on this transitively**.
- `useNotifications`             → [composables/useNotifications.js](../../frontend/src/composables/useNotifications.js) _(105 lines)_ — unreadCount, fetch/poll, `markAsRead`, `markAllRead`; used by `Sidebar.vue` (and polled via `startNotificationPolling()` referenced in graphify community #20).
- `useApiError`                  → [composables/useApiError.js](../../frontend/src/composables/useApiError.js) — error extraction helper (graphify: thin community "Settings").
- `useConflictAnalysis`          → [composables/useConflictAnalysis.js](../../frontend/src/composables/useConflictAnalysis.js) — Excel-import conflict resolution helpers (graphify: thin community "Rate Limiting").

## Utilities (non-composable shared logic)

- [utils/clientPortal.js](../../frontend/src/utils/clientPortal.js)
- [utils/factoryPortal.js](../../frontend/src/utils/factoryPortal.js)
- [utils/formatters.js](../../frontend/src/utils/formatters.js) — includes `formatCurrency`, `formatINR` (graphify community #22)
- [utils/constants.js](../../frontend/src/utils/constants.js) — includes `getStageInfo()` (graphify thin community "File Upload")

## API Modules

All methods live in a **single file**: [src/api/index.js](../../frontend/src/api/index.js) _(540 lines)_. Axios instance at base `/api` with token injection + 401/409/429/403 interceptors.

| # | Module (export)  | Methods | Notes |
|---|------------------|:-------:|-------|
|  1 | `ordersApi`      | 36 | Largest module — CRUD, items, stage transitions, client-inquiry, landed-cost, bulk ops |
|  2 | `productsApi`    | 29 | CRUD + bulk + master-data lookups + images + bin + pending-review |
|  3 | `settingsApi`    | 17 | Exchange rates, markups, defaults, transit times, categories, seed |
|  4 | `shipmentsApi`   | 14 | Shipments + phase transitions + shipping documents |
|  5 | `packingApi`     | 13 | Packing list upload/parse/split/migrate/decision |
|  6 | `clientsApi`     | 12 | CRUD + categories + brands + portal permissions |
|  7 | `paymentsApi`    | 12 | Client + factory payments, submit/verify proof |
|  8 | `customsApi`     | 12 | HSN tariffs, BOE, milestones, charges |
|  9 | `financeApi`     | 11 | Ledgers, credits, downloads, audit log, PI history |
| 10 | `afterSalesApi`  | 11 | Order-scoped + global + client portal |
| 11 | `queriesApi`     | 11 | Order queries with inline support |
| 12 | `excelApi`       |  8 | Upload, jobs, apply, reparse, column/conflict AI |
| 13 | `factoriesApi`   |  6 | Standard CRUD + search |
| 14 | `transportApi`   |  5 | Standard CRUD |
| 15 | `usersApi`       |  5 | CRUD + toggleActive |
| 16 | `dashboardApi`   |  5 | Summary widgets |
| 17 | `documentsApi`   |  4 | Upload/download/list/delete |
| 18 | `quotationsApi`  |  3 | PI generate/download |
| 19 | `auditApi`       |  3 | List + filter options |
| 20 | `productionApi`  |  2 | Progress, dates |
| 21 | `unloadedApi`    |  2 | List + pending |
| 22 | `authApi`        |  1 | `getMe()` (login/refresh handled directly via axios inside `useAuth` + response interceptor) |
|    | **Total**        | **222** | — |

## Key Observations for Migration Planning

1. **Component reuse is asymmetric between portals.** `OrderDetail` (internal) wires 14 tab components; `ClientOrderDetail` only uses `ClientOrderItemsTab`. Factory's production/packing routes reuse `FactoryOrders.vue` with only `meta.title` differentiating them — no real sub-view.
2. **No extracted shared presentation layer.** All dialogs are inline per-page. PrimeVue is the de-facto design system.
3. **State lives in module-scope composables, not Pinia.** Any migration that assumes `defineStore()` will need to hydrate state from the four composables instead.
4. **Single-file API layer.** All 222 methods in one `index.js`. Splitting per-domain before migration is a mechanical refactor but will touch ~every page.
5. **Portal isolation is enforced in the global `beforeEach` guard only** ([router/index.js:373-388](../../frontend/src/router/index.js#L373)) — there is no per-layout sub-router. Any per-portal routing split must preserve these redirects.
6. **Largest files to budget for:** `OrderDraft.vue` (1563), `OrderDetail.vue` (956), `api/index.js` (540), `Sidebar.vue` (288).
