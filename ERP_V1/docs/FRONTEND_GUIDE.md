# HarvestERP — Frontend Developer Guide

> Last updated: 2026-03-29 | Auto-generated from source

## Quick Reference

| Item | Value |
|------|-------|
| Framework | Vue 3.5 + Vite 7.3 + PrimeVue 4.5 + Tailwind CSS 4.2 |
| State | Pinia (no active stores — composables used instead) |
| API Client | Axios via `api/index.js` — **197 methods across 21 modules** |
| Auth | JWT (access 15min + refresh 7d) stored in localStorage |
| Portals | 3 — Admin, Client, Factory |
| Total Routes | 50 |
| Total View Files | 40 |
| Total Component Files | 19 |
| Total Composables | 3 |
| Total Utility Files | 4 |

---

## 1. USER ROLES & PORTALS

### Role Definitions

| Role | user_type | Portal | Description |
|------|-----------|--------|-------------|
| ADMIN | INTERNAL | Admin | Full system access — all routes, all data |
| OPERATIONS | INTERNAL | Admin | Order management, Excel processing, shipping |
| FINANCE | INTERNAL | Admin | Payments, ledgers, receivables |
| VIEWER | INTERNAL | Admin | Read-only access to admin views |
| CLIENT | CLIENT | Client Portal | External client — sees own orders only |
| FACTORY | FACTORY | Factory Portal | External supplier — sees assigned orders only |

### Portal Routing Logic

- **INTERNAL users** → `/dashboard` (admin portal)
- **CLIENT users** → `/client-portal/` (client portal)
- **FACTORY users** → `/factory-portal/` (factory portal)
- Login redirects to correct portal via `useAuth().getPortalPath()`
- 401 responses auto-logout via Axios interceptor

### Route Access by Role

| Route Area | ADMIN | OPS | FINANCE | VIEWER | CLIENT | FACTORY |
|-----------|-------|-----|---------|--------|--------|---------|
| Admin Dashboard | Y | Y | Y | Y | - | - |
| Orders | Y | Y | Y | Y | - | - |
| Products | Y | Y | Y | Y | - | - |
| Finance | Y | - | Y | - | - | - |
| Settings | Y | - | - | - | - | - |
| Users | Y | - | - | - | - | - |
| Audit Logs | Y | - | - | - | - | - |
| Tech Stack | Y | - | - | - | - | - |
| Product Review | Y | - | - | - | - | - |
| Client Portal | - | - | - | - | Y | - |
| Factory Portal | - | - | - | - | - | Y |

---

## 2. NAVIGATION STRUCTURE

### Admin Portal Sidebar

| Icon | Label | Route | Roles |
|------|-------|-------|-------|
| pi-home | Dashboard | /dashboard | All internal |
| pi-shopping-cart | Orders | /orders | All internal |
| pi-box | Products | /products | All internal |
| pi-building | Factories | /factories | All internal |
| pi-users | Clients | /clients | All internal |
| pi-truck | Service Providers | /transport | All internal |
| pi-exclamation-triangle | After-Sales | /after-sales | All internal |
| pi-chart-line | Finance | /finance | ADMIN, FINANCE |
| pi-replay | Returns & Pending | /returns-pending | All internal |
| pi-warehouse | Warehouse Stock | /warehouse | All internal |
| pi-cog | Settings | /settings | ADMIN |
| pi-check-square | Product Review | /products/review | ADMIN |
| pi-users | Users | /users | ADMIN |
| pi-list | Audit Trail | /audit-logs | ADMIN |
| pi-code | Tech Stack | /tech-stack | ADMIN |

### Client Portal Navigation

| Label | Route | Notes |
|-------|-------|-------|
| Dashboard | /client-portal/ | Order summary, recent activity |
| My Orders | /client-portal/orders | All orders for this client |
| New Order | /client-portal/orders/new | Create inquiry |
| Products | /client-portal/products | Browse catalog |
| Statement | /client-portal/ledger | Payment history |
| Shipments | /client-portal/shipments | Track shipments |
| After-Sales | /client-portal/after-sales | Submit claims |
| Profile | /client-portal/profile | Company details |

### Factory Portal Navigation

| Label | Route | Notes |
|-------|-------|-------|
| Dashboard | /factory-portal/ | Assigned orders overview |
| Orders | /factory-portal/orders | All assigned orders |
| Production | /factory-portal/production | Production tracking |
| Packing | /factory-portal/packing | Packing status |
| Profile | /factory-portal/profile | Factory details |

---

## 3. ALL ROUTES — COMPLETE LIST

### Admin Portal Routes

| Route Path | Component | Purpose | Roles |
|-----------|-----------|---------|-------|
| / | (redirect) | Redirects to /dashboard | — |
| /dashboard | Dashboard.vue | KPI summary, recent orders | All internal |
| /orders | orders/OrderList.vue | Order list with filters | All internal |
| /orders/new | orders/OrderDraft.vue | Create new order | All internal |
| /orders/:id | orders/OrderDetail.vue | Order detail with tabs | All internal |
| /orders/:id/upload-excel | orders/ExcelUpload.vue | Upload factory Excel | All internal |
| /products | products/ProductList.vue | Product catalog | All internal |
| /products/new | products/ProductForm.vue | Create product | All internal |
| /products/upload-excel | orders/ExcelUpload.vue | Import products from Excel | All internal |
| /products/:id/edit | products/ProductForm.vue | Edit product | All internal |
| /products/review | products/ProductReview.vue | Approve pending products | ADMIN |
| /factories | factories/FactoryList.vue | Factory list | All internal |
| /factories/new | factories/FactoryForm.vue | Create factory | All internal |
| /factories/:id/edit | factories/FactoryForm.vue | Edit factory | All internal |
| /clients | clients/ClientList.vue | Client list | All internal |
| /clients/new | clients/ClientForm.vue | Create client | All internal |
| /clients/:id/edit | clients/ClientForm.vue | Edit client | All internal |
| /transport | transport/TransportList.vue | Service providers | All internal |
| /transport/new | transport/TransportForm.vue | Create provider | All internal |
| /transport/:id/edit | transport/TransportForm.vue | Edit provider | All internal |
| /after-sales | AfterSales.vue | After-sales claims | All internal |
| /finance | finance/FinanceLayout.vue | Finance section layout | ADMIN, FINANCE |
| /finance/receivables | finance/Receivables.vue | Accounts receivable | ADMIN, FINANCE |
| /finance/client-ledger | finance/ClientLedger.vue | Client payment ledger | ADMIN, FINANCE |
| /finance/factory-ledger | finance/FactoryLedger.vue | Factory payment ledger | ADMIN, FINANCE |
| /returns-pending | ReturnsPending.vue | Unloaded/pending items | All internal |
| /warehouse | WarehouseStock.vue | Warehouse inventory | All internal |
| /settings | Settings.vue | System configuration | ADMIN |
| /users | Users.vue | User management | ADMIN |
| /audit-logs | AuditLogs.vue | Activity audit trail | ADMIN |
| /tech-stack | TechStack.vue | Architecture overview | ADMIN |

### Client Portal Routes

| Route Path | Component | Purpose |
|-----------|-----------|---------|
| /client-portal/ | client/ClientDashboard.vue | Client dashboard |
| /client-portal/orders | client/ClientOrders.vue | Client order list |
| /client-portal/orders/new | client/ClientNewOrder.vue | Create inquiry |
| /client-portal/orders/:id | client/ClientOrderDetail.vue | Order detail (filtered) |
| /client-portal/products | client/ClientProducts.vue | Product catalog |
| /client-portal/ledger | client/ClientLedger.vue | Statement of account |
| /client-portal/shipments | client/ClientShipments.vue | Shipment tracking |
| /client-portal/after-sales | client/ClientAfterSales.vue | Submit claims |
| /client-portal/profile | client/ClientProfile.vue | Company profile |

### Factory Portal Routes

| Route Path | Component | Purpose |
|-----------|-----------|---------|
| /factory-portal/ | factory/FactoryDashboard.vue | Factory dashboard |
| /factory-portal/orders | factory/FactoryOrders.vue | Assigned orders |
| /factory-portal/orders/:id | factory/FactoryOrderDetail.vue | Order detail (filtered) |
| /factory-portal/production | factory/FactoryOrders.vue | Production view |
| /factory-portal/packing | factory/FactoryOrders.vue | Packing view |
| /factory-portal/profile | factory/FactoryProfile.vue | Factory profile |

### System Routes

| Route Path | Component | Purpose |
|-----------|-----------|---------|
| /login | Login.vue | Authentication |
| /access-denied | AccessDenied.vue | 403 error page |

---

## 4. PAGE-BY-PAGE BREAKDOWN

### Client Portal Pages

#### ClientDashboard
- **Route:** `/client-portal/`
- **File:** `views/client/ClientDashboard.vue`
- **APIs:** `ordersApi.list({ limit: 10 })`
- **Actions:** View recent orders, navigate to new inquiry, view all orders

#### ClientOrders
- **Route:** `/client-portal/orders`
- **File:** `views/client/ClientOrders.vue`
- **APIs:** `ordersApi.list(params)`
- **Actions:** Search orders, filter by status, view deletion reasons, navigate to order detail

#### ClientNewOrder
- **Route:** `/client-portal/orders/new`
- **File:** `views/client/ClientNewOrder.vue`
- **APIs:** `productsApi.list()`, `productsApi.categories()`, `productsApi.validateCodes()`, `ordersApi.createClientInquiry()`
- **Actions:** Search products, browse catalog, bulk paste codes, quick-add unknown products, set quantities, submit inquiry

#### ClientOrderDetail
- **Route:** `/client-portal/orders/:id`
- **File:** `views/client/ClientOrderDetail.vue`
- **APIs:** `ordersApi.get()`, `ordersApi.timeline()`, `ordersApi.productRequests()`, `ordersApi.activityFeed()`, `ordersApi.myLedger()`, `productionApi.getProgress()`, `shipmentsApi.list()`, `documentsApi.list()`, `documentsApi.download()`, `packingApi.clientSummary()`, `packingApi.downloadPDF()`, `packingApi.downloadExcel()`, `afterSalesApi.clientGetForOrder()`, `afterSalesApi.clientSubmitClaims()`
- **Actions:** 8 tabs (items, payments, production, packing, shipping, after-sales, final-draft, files), download documents, submit after-sales claims with photo upload, photo lightbox with zoom/pan

#### ClientProducts
- **Route:** `/client-portal/products`
- **File:** `views/client/ClientProducts.vue`
- **APIs:** `productsApi.list()`, `productsApi.categories()`
- **Actions:** Search products, filter by category, expand/collapse variants, suggest edits

#### ClientLedger
- **Route:** `/client-portal/ledger`
- **File:** `views/client/ClientLedger.vue`
- **APIs:** `ordersApi.myLedger()`
- **Actions:** View statement of account (read-only)

#### ClientShipments
- **Route:** `/client-portal/shipments`
- **File:** `views/client/ClientShipments.vue`
- **APIs:** `ordersApi.list()`, `shipmentsApi.list()`
- **Actions:** View active/upcoming/completed shipments, expand shipment details

#### ClientAfterSales
- **Route:** `/client-portal/after-sales`
- **File:** `views/client/ClientAfterSales.vue`
- **APIs:** `afterSalesApi.list()`
- **Actions:** View claims grouped by order, refresh, navigate to order detail

#### ClientProfile
- **Route:** `/client-portal/profile`
- **File:** `views/client/ClientProfile.vue`
- **APIs:** None (uses `useAuth`)
- **Actions:** View profile (read-only)

---

### Admin Portal Pages

#### Dashboard
- **Route:** `/dashboard`
- **File:** `views/Dashboard.vue`
- **APIs:** `dashboardApi.getSummary()`, `dashboardApi.getActiveShipments()`, `dashboardApi.getRecentActivity()`, `dashboardApi.getClientInquiries()`
- **Actions:** View KPIs, click inquiry to review, click shipment to view order

#### OrderList
- **Route:** `/orders`
- **File:** `views/orders/OrderList.vue`
- **APIs:** `ordersApi.list()`, `ordersApi.statusCounts()`, `ordersApi.delete()`, `ordersApi.setDeletionReason()`
- **Actions:** Search orders, filter by status group, delete with reason, paginate

#### OrderDraft
- **Route:** `/orders/new`
- **File:** `views/orders/OrderDraft.vue`
- **APIs:** `ordersApi.create()`, `clientsApi.list()`, `clientsApi.create()`, `factoriesApi.list()`, `factoriesApi.create()`, `productsApi.list()`, `productsApi.categories()`, `unloadedApi.getPending()`, `afterSalesApi.getPending()`
- **Actions:** Select client/factory (with quick-add), search products, bulk paste, product browser, carry pending items, submit draft

#### OrderDetail
- **Route:** `/orders/:id`
- **File:** `views/orders/OrderDetail.vue`
- **APIs:** `ordersApi.get()`, `ordersApi.nextStage()`, `ordersApi.transition()`, `ordersApi.reopen()`, `ordersApi.goBack()`, `ordersApi.jumpToStage()`, `ordersApi.timeline()`, `ordersApi.delete()`, `documentsApi.list()`
- **Actions:** 12 tab components, stage transitions with validation, reopen with reason, go back, jump to stage, delete with confirmation, override warnings

#### ExcelUpload
- **Route:** `/orders/:id/upload-excel`
- **File:** `views/orders/ExcelUpload.vue`
- **APIs:** `excelApi.upload()`, `excelApi.getJob()`, `excelApi.applyParsedData()`, `excelApi.reparseJob()`, `excelApi.analyzeColumns()`, `excelApi.analyzeConflicts()`, `ordersApi.get()`, `productsApi.*`
- **Actions:** Drag-drop file upload, select job type, AI column mapping, AI conflict resolution, bulk row selection, apply results

#### ProductList
- **Route:** `/products`
- **File:** `views/products/ProductList.vue`
- **APIs:** `productsApi.list()`, `settingsApi.getMarkups()`, `productsApi.categories()`, `productsApi.bulkDelete()`, `productsApi.bulkUpdate()`, `productsApi.findDuplicates()`, `productsApi.removeDuplicateImages()`
- **Actions:** Search, filter by category, sort columns, expand/collapse variants, bulk select, bulk delete, bulk edit (category/material/HS code), view/restore from bin, duplicate cleanup

#### ProductForm
- **Route:** `/products/new` and `/products/:id/edit`
- **File:** `views/products/ProductForm.vue`
- **APIs:** `productsApi.get()`, `productsApi.create()`, `productsApi.update()`, `settingsApi.getMarkups()`, `productsApi.categories()`
- **Actions:** Create/edit product form, add category inline, image upload/lightbox, variant resolution

#### ProductReview
- **Route:** `/products/review`
- **File:** `views/products/ProductReview.vue`
- **APIs:** `productsApi.pendingReviewList()`, `productsApi.approveRequest()`, `productsApi.mapRequest()`, `productsApi.rejectRequest()`, `productsApi.categories()`, `productsApi.materials()`, `productsApi.brands()`
- **Actions:** Review pending products, approve with form, map to existing product, reject

#### FactoryList
- **Route:** `/factories`
- **File:** `views/factories/FactoryList.vue`
- **APIs:** `factoriesApi.list()`, `factoriesApi.delete()`
- **Actions:** Search, paginate, delete with confirmation

#### FactoryForm
- **Route:** `/factories/new` and `/factories/:id/edit`
- **File:** `views/factories/FactoryForm.vue`
- **APIs:** `factoriesApi.get()`, `factoriesApi.create()`, `factoriesApi.update()`
- **Actions:** Create/edit factory with contacts, bank details, quality rating, port selection

#### ClientList
- **Route:** `/clients`
- **File:** `views/clients/ClientList.vue`
- **APIs:** `clientsApi.list()`, `clientsApi.delete()`
- **Actions:** Search, paginate, delete with confirmation

#### ClientForm
- **Route:** `/clients/new` and `/clients/:id/edit`
- **File:** `views/clients/ClientForm.vue`
- **APIs:** `clientsApi.get()`, `clientsApi.create()`, `clientsApi.update()`
- **Actions:** Create/edit client with GSTIN/IEC/PAN validation, Indian state selector

#### TransportList
- **Route:** `/transport`
- **File:** `views/transport/TransportList.vue`
- **APIs:** `transportApi.list()`, `transportApi.delete()`
- **Actions:** Search, paginate, delete with confirmation

#### TransportForm
- **Route:** `/transport/new` and `/transport/:id/edit`
- **File:** `views/transport/TransportForm.vue`
- **APIs:** `transportApi.get()`, `transportApi.create()`, `transportApi.update()`
- **Actions:** Create/edit provider with multi-role selection, port management, bank details

#### AfterSales
- **Route:** `/after-sales`
- **File:** `views/AfterSales.vue`
- **APIs:** `afterSalesApi.list()`
- **Actions:** Filter by status/issue type/resolution, click row to view order

#### Receivables
- **Route:** `/finance/receivables`
- **File:** `views/finance/Receivables.vue`
- **APIs:** `financeApi.receivables()`, `clientsApi.list()`
- **Actions:** Filter by client, filter by status (Outstanding/Settled/All)

#### ClientLedger (Admin)
- **Route:** `/finance/client-ledger`
- **File:** `views/finance/ClientLedger.vue`
- **APIs:** `clientsApi.list()`, `financeApi.clientLedger()`, `financeApi.downloadClientLedger()`
- **Actions:** Select client, date range filter, download statement (Excel/PDF)

#### FactoryLedger
- **Route:** `/finance/factory-ledger`
- **File:** `views/finance/FactoryLedger.vue`
- **APIs:** `factoriesApi.list()`, `financeApi.factoryLedger()`, `financeApi.downloadFactoryLedger()`
- **Actions:** Select factory, date range filter, download statement (Excel/PDF)

#### Settings
- **Route:** `/settings`
- **File:** `views/Settings.vue`
- **APIs:** `settingsApi.getExchangeRates()`, `settingsApi.getCategories()`, `settingsApi.getTransitTimes()`, `settingsApi.getDefaultsList()`, `settingsApi.seedData()`, `settingsApi.updateExchangeRate()`, `settingsApi.createCategory()`, `settingsApi.updateCategory()`, `settingsApi.deleteCategory()`, `settingsApi.createTransitTime()`, `settingsApi.updateTransitTime()`, `settingsApi.deleteTransitTime()`, `settingsApi.updateDefault()`
- **Actions:** 4 tabs (Rates, Categories, Transit Times, Defaults), CRUD for each, seed data button

#### Users
- **Route:** `/users`
- **File:** `views/Users.vue`
- **APIs:** `usersApi.list()`, `usersApi.create()`, `usersApi.update()`, `usersApi.toggleActive()`, `clientsApi.search()`, `factoriesApi.search()`, `productsApi.categories()`, `productsApi.brands()`, `clientsApi.getClientCategories()`, `clientsApi.getBrands()`, `clientsApi.getPortalPermissions()`, `clientsApi.setClientCategories()`, `clientsApi.updatePortalPermissions()`
- **Actions:** CRUD users, toggle active, set role/user_type, link client/factory, configure portal permissions (tab visibility), manage brand/category access

#### AuditLogs
- **Route:** `/audit-logs`
- **File:** `views/AuditLogs.vue`
- **APIs:** `auditApi.list()`, `auditApi.getActions()`, `auditApi.getResourceTypes()`
- **Actions:** Filter by action/resource type, paginate, expand to see old/new value diff

#### ReturnsPending
- **Route:** `/returns-pending`
- **File:** `views/ReturnsPending.vue`
- **APIs:** `unloadedApi.list()`, `afterSalesApi.list()`, `factoriesApi.list()`, `clientsApi.list()`
- **Actions:** Tab between unloaded/after-sales/all, filter by factory/client/status, search, consolidated view

#### WarehouseStock
- **Route:** `/warehouse`
- **File:** `views/WarehouseStock.vue`
- **APIs:** None
- **Actions:** None
- **Note:** Stub — not yet implemented. Placeholder for future warehouse inventory feature.

---

### Factory Portal Pages

#### FactoryDashboard
- **Route:** `/factory-portal/`
- **File:** `views/factory/FactoryDashboard.vue`
- **APIs:** `ordersApi.list({ limit: 5 })`
- **Actions:** View recent assigned orders, navigate to order detail

#### FactoryOrders
- **Route:** `/factory-portal/orders`
- **File:** `views/factory/FactoryOrders.vue`
- **APIs:** `ordersApi.list()`
- **Actions:** Search assigned orders, navigate to order detail

#### FactoryOrderDetail
- **Route:** `/factory-portal/orders/:id`
- **File:** `views/factory/FactoryOrderDetail.vue`
- **APIs:** `ordersApi.get()`
- **Actions:** View order details and line items (read-only)

#### FactoryProfile
- **Route:** `/factory-portal/profile`
- **File:** `views/factory/FactoryProfile.vue`
- **APIs:** None (uses `useAuth`)
- **Actions:** View profile (read-only)

---

## 5. ORDER WORKFLOW — 23 STATUSES

### Status Map

| Stage | Status Code | Display Name | Shared Stage? |
|-------|------------|--------------|---------------|
| 0 | CLIENT_DRAFT | Client Inquiry | No |
| 1 | DRAFT | Draft | No |
| 2 | PENDING_PI | Pending PI | No |
| 3 | PI_SENT | PI Sent | No |
| 4 | ADVANCE_PENDING | Advance Pending | Yes (stage 4) |
| 4 | ADVANCE_RECEIVED | Advance Received | Yes (stage 4) |
| 5 | FACTORY_ORDERED | Factory Ordered | No |
| 6 | PRODUCTION_60 | Production 60% | No |
| 7 | PRODUCTION_80 | Production 80% | No |
| 8 | PRODUCTION_90 | Production 90% | No |
| 9 | PLAN_PACKING | Plan Packing | No |
| 10 | FINAL_PI | Final PI | No |
| 11 | PRODUCTION_100 | Production 100% | No |
| 12 | BOOKED | Container Booked | No |
| 13 | LOADED | Container Loaded | Yes (stage 13) |
| 13 | SAILED | Sailing | Yes (stage 13) |
| 13 | ARRIVED | Arrived at Port | Yes (stage 13) |
| 14 | CUSTOMS_FILED | Customs Filed | Yes (stage 14) |
| 14 | CLEARED | Customs Cleared | Yes (stage 14) |
| 15 | DELIVERED | Delivered | No |
| 16 | AFTER_SALES | After-Sales | No |
| 17 | COMPLETED | Completed | Yes (stage 17) |
| 17 | COMPLETED_EDITING | Completed (Editing) | Yes (stage 17) |

### Frontend Stage Utilities

Stage colors, labels, and helper sets are centralized in `utils/constants.js`:

- `STAGE_MAP` — full mapping of status → `{ stage, label, color, border }`
- `getStageInfo(status)` — returns stage info for a status key
- `POST_PI_STATUSES` — set of all statuses after PI_SENT
- `STAGE_4_PLUS` — statuses from ADVANCE_PENDING onward
- `BOOKING_STATUSES` — booking and post-booking
- `SAILING_STATUSES` — sailing and post-sailing
- `CUSTOMS_STATUSES` — customs clearance stages
- `TERMINAL_STATUSES` — DELIVERED, AFTER_SALES, COMPLETED

---

## 6. COMPONENT LIBRARY

### Layout Components

| Component | File | Purpose |
|-----------|------|---------|
| Sidebar | layout/Sidebar.vue | Admin portal sidebar navigation |
| Topbar | layout/Topbar.vue | Top bar with user menu, notifications |
| ClientLayout | layout/ClientLayout.vue | Client portal layout wrapper |
| FactoryLayout | layout/FactoryLayout.vue | Factory portal layout wrapper |

### Order Detail Tab Components (`components/order/`)

| Component | File | Purpose |
|-----------|------|---------|
| OrderDashboardTab | order/OrderDashboardTab.vue | Order overview, timeline, key metrics |
| OrderItemsTab | order/OrderItemsTab.vue | Line items CRUD (2,173 lines) |
| PaymentsTab | order/PaymentsTab.vue | Client + factory payments |
| FinalDraftTab | order/FinalDraftTab.vue | Final PI review and reconciliation |
| ProductionTab | order/ProductionTab.vue | Production progress tracking |
| PackingListTab | order/PackingListTab.vue | Packing list upload/manage |
| BookingTab | order/BookingTab.vue | Container booking details |
| SailingTab | order/SailingTab.vue | Shipping/vessel tracking |
| ShippingDocsTab | order/ShippingDocsTab.vue | Document uploads (BL, DO, etc.) |
| CustomsTab | order/CustomsTab.vue | BOE, HSN, customs clearance |
| AfterSalesTab | order/AfterSalesTab.vue | After-sales claims management |
| FilesTab | order/FilesTab.vue | General file attachments |

### Excel Processing Components (`components/orders/`)

| Component | File | Purpose |
|-----------|------|---------|
| ConflictResolutionPanel | orders/ConflictResolutionPanel.vue | AI conflict resolution UI |
| ParsedResultsTable | orders/ParsedResultsTable.vue | Parsed Excel preview table |

### Common Components

| Component | File | Purpose |
|-----------|------|---------|
| ColumnMappingDialog | common/ColumnMappingDialog.vue | AI column mapping dialog |

---

## 7. API CLIENT REFERENCE

### Base Configuration

```javascript
const api = axios.create({ baseURL: '/api' })
```

- **Proxy**: Vite dev server proxies `/api` → `http://localhost:8000/api`
- **Auth**: Bearer token injected via Axios interceptor from `useAuth()`
- **401 handling**: Auto-logout and redirect to `/login` (skips `/auth/login`)

### All API Modules (21 modules, 197 methods)

#### ordersApi (30 methods)

| Method | HTTP | Endpoint | Parameters |
|--------|------|----------|------------|
| list | GET | /orders/ | params (query) |
| get | GET | /orders/{id}/ | id |
| create | POST | /orders/ | data |
| update | PUT | /orders/{id}/ | id, data |
| delete | DELETE | /orders/{id}/ | id |
| setDeletionReason | PUT | /orders/{id}/delete-reason/ | id, reason |
| statusCounts | GET | /orders/status-counts/ | — |
| addItems | POST | /orders/{id}/items/ | id, data |
| updateItem | PUT | /orders/{id}/items/{itemId}/ | id, itemId, data |
| removeItem | DELETE | /orders/{id}/items/{itemId}/ | id, itemId |
| removeItemWithNote | PUT | /orders/{id}/items/{itemId}/remove/ | id, itemId, cancelNote |
| fetchPendingItems | POST | /orders/{id}/fetch-pending-items/ | id |
| bulkTextAddPreview | POST | /orders/{id}/bulk-text-add/ | id, lines |
| bulkTextAddApply | POST | /orders/{id}/bulk-text-add/apply/ | id, items |
| updateItemPrices | PUT | /orders/{id}/items/{itemId}/prices/ | id, itemId, data |
| copyPreviousPrices | POST | /orders/{id}/copy-previous-prices/ | id |
| resetAftersalesPrices | POST | /orders/{id}/reset-aftersales-prices/ | id |
| parsePriceExcel | POST | /orders/{id}/parse-price-excel/ | id, file (multipart) |
| nextStage | GET | /orders/{id}/next-stages/ | id |
| transition | PUT | /orders/{id}/transition/?target_status=X | id, targetStatus, data |
| reopen | PUT | /orders/{id}/reopen/ | id, data |
| goBack | PUT | /orders/{id}/go-back/ | id, data |
| jumpToStage | PUT | /orders/{id}/jump-to-stage/ | id, data |
| timeline | GET | /orders/{id}/timeline/ | id |
| createClientInquiry | POST | /orders/client-inquiry/ | data |
| approveInquiry | POST | /orders/{orderId}/approve-inquiry/ | orderId, data |
| myLedger | GET | /orders/my-ledger/ | params |
| activityFeed | GET | /orders/{id}/activity-feed/ | id |
| productRequests | GET | /orders/{id}/product-requests/ | id |
| reconciliation | GET | /orders/reconciliation/{id}/ | id |

#### productsApi (25 methods)

| Method | HTTP | Endpoint |
|--------|------|----------|
| list | GET | /products/ |
| get | GET | /products/{id}/ |
| create | POST | /products/ |
| update | PUT | /products/{id}/ |
| delete | DELETE | /products/{id}/ |
| bulkDelete | POST | /products/bulk-delete/ |
| bulkUpdate | POST | /products/bulk-update/ |
| search | GET | /products/search/ |
| validateCodes | POST | /products/validate-codes/ |
| categories | GET | /products/categories/ |
| subcategories | GET | /products/subcategories/ |
| materials | GET | /products/materials/ |
| hsCodes | GET | /products/hs-codes/ |
| partTypes | GET | /products/part-types/ |
| brands | GET | /products/brands/ |
| getImages | GET | /products/{id}/images/ |
| deleteImage | DELETE | /products/{id}/images/{imageId}/ |
| uploadImage | POST | /products/{id}/images/upload/ |
| setDefault | POST | /products/{id}/set-default/ |
| checkVariants | GET | /products/check-variants/{code}/ |
| removeDuplicateImages | POST | /products/remove-duplicate-images/ |
| findDuplicates | GET | /products/find-duplicates/ |
| listBin | GET | /products/bin/ |
| permanentDelete | POST | /products/bin/permanent-delete/ |
| restoreFromBin | POST | /products/bin/restore/ |
| pendingReviewList | GET | /products/pending-review-list/ |
| approveRequest | POST | /products/product-requests/{id}/approve/ |
| mapRequest | POST | /products/product-requests/{id}/map/ |
| rejectRequest | POST | /products/product-requests/{id}/reject/ |

#### clientsApi (12 methods)

| Method | HTTP | Endpoint |
|--------|------|----------|
| list | GET | /clients/ |
| get | GET | /clients/{id}/ |
| create | POST | /clients/ |
| update | PUT | /clients/{id}/ |
| delete | DELETE | /clients/{id}/ |
| search | GET | /clients/search/ |
| getClientCategories | GET | /clients/{id}/categories/ |
| setClientCategories | PUT | /clients/{id}/categories/ |
| getBrands | GET | /clients/{id}/brands/ |
| setBrands | PUT | /clients/{id}/brands/ |
| getPortalPermissions | GET | /clients/{id}/portal-permissions/ |
| updatePortalPermissions | PUT | /clients/{id}/portal-permissions/ |

#### factoriesApi (6 methods)

| Method | HTTP | Endpoint |
|--------|------|----------|
| list | GET | /factories/ |
| get | GET | /factories/{id}/ |
| create | POST | /factories/ |
| update | PUT | /factories/{id}/ |
| delete | DELETE | /factories/{id}/ |
| search | GET | /factories/search/ |

#### excelApi (8 methods)

| Method | HTTP | Endpoint |
|--------|------|----------|
| upload | POST | /excel/upload/ |
| getJob | GET | /excel/jobs/{jobId}/ |
| listJobs | GET | /excel/jobs/ |
| cancelJob | DELETE | /excel/jobs/{jobId}/ |
| applyParsedData | POST | /excel/apply/{jobId}/ |
| reparseJob | POST | /excel/jobs/{jobId}/reparse/ |
| analyzeColumns | POST | /excel/analyze-columns/ |
| analyzeConflicts | POST | /excel/analyze-conflicts/ |

#### quotationsApi (3 methods)

| Method | HTTP | Endpoint |
|--------|------|----------|
| generatePI | POST | /excel/generate-pi/{orderId}/ |
| downloadPI | GET | /excel/download-pi/{orderId}/ |
| downloadPIWithImages | GET | /excel/download-pi-with-images/{orderId}/ |

#### paymentsApi (9 methods)

| Method | HTTP | Endpoint |
|--------|------|----------|
| list | GET | /finance/orders/{orderId}/payments/ |
| create | POST | /finance/orders/{orderId}/payments/ |
| update | PUT | /finance/orders/{orderId}/payments/{paymentId}/ |
| delete | DELETE | /finance/orders/{orderId}/payments/{paymentId}/ |
| factoryList | GET | /finance/orders/{orderId}/factory-payments/ |
| factoryCreate | POST | /finance/orders/{orderId}/factory-payments/ |
| factoryUpdate | PUT | /finance/orders/{orderId}/factory-payments/{paymentId}/ |
| factoryDelete | DELETE | /finance/orders/{orderId}/factory-payments/{paymentId}/ |
| exchangeRates | GET | /finance/exchange-rates/ |

#### financeApi (11 methods)

| Method | HTTP | Endpoint |
|--------|------|----------|
| receivables | GET | /finance/receivables/ |
| clientLedger | GET | /finance/client-ledger/{clientId}/ |
| factoryLedger | GET | /finance/factory-ledger/{factoryId}/ |
| clientCredits | GET | /finance/clients/{clientId}/credits/ |
| applyCredit | POST | /finance/orders/{orderId}/apply-credit/ |
| factoryCredits | GET | /finance/factories/{factoryId}/credits/ |
| applyFactoryCredit | POST | /finance/orders/{orderId}/apply-factory-credit/ |
| downloadClientLedger | GET | /finance/client-ledger/{clientId}/download/ |
| downloadFactoryLedger | GET | /finance/factory-ledger/{factoryId}/download/ |
| auditLog | GET | /finance/orders/{orderId}/payment-audit-log/ |
| piHistory | GET | /finance/orders/{orderId}/pi-history/ |

#### shipmentsApi (14 methods)

| Method | HTTP | Endpoint |
|--------|------|----------|
| list | GET | /shipping/orders/{orderId}/shipments/ |
| create | POST | /shipping/orders/{orderId}/shipments/ |
| update | PUT | /shipping/shipments/{shipmentId}/ |
| delete | DELETE | /shipping/shipments/{shipmentId}/ |
| allocateItems | POST | /shipping/shipments/{shipmentId}/items/ |
| updateItem | PUT | /shipping/shipments/{shipmentId}/items/{itemId} |
| removeItem | DELETE | /shipping/shipments/{shipmentId}/items/{itemId} |
| markLoaded | PUT | /shipping/shipments/{shipmentId}/phase/loaded/ |
| markSailed | PUT | /shipping/shipments/{shipmentId}/phase/sailed/ |
| markArrived | PUT | /shipping/shipments/{shipmentId}/phase/arrived/ |
| getProgress | GET | /shipping/shipments/{shipmentId}/progress/ |
| listDocs | GET | /shipping/orders/{orderId}/shipping-documents/ |
| uploadDoc | PUT | /shipping/shipping-documents/{docId}/upload/ |
| updateDocStatus | PUT | /shipping/shipping-documents/{docId}/status/ |

#### customsApi (12 methods)

| Method | HTTP | Endpoint |
|--------|------|----------|
| listTariffs | GET | /customs/tariffs/ |
| createTariff | POST | /customs/tariffs/ |
| updateTariff | PUT | /customs/tariffs/{id} |
| getBoe | GET | /customs/shipments/{shipmentId}/boe/ |
| createBoe | POST | /customs/shipments/{shipmentId}/boe/ |
| updateBoe | PUT | /customs/boe/{boeId}/ |
| deleteBoe | DELETE | /customs/boe/{boeId}/ |
| getHsnItems | GET | /customs/shipments/{shipmentId}/hsn-items/ |
| getMilestones | GET | /customs/{orderId}/milestones/ |
| addMilestone | POST | /customs/{orderId}/milestones/ |
| getCharges | GET | /customs/{orderId}/charges/ |
| saveCharges | POST | /customs/{orderId}/charges/ |

#### afterSalesApi (11 methods)

| Method | HTTP | Endpoint |
|--------|------|----------|
| getForOrder | GET | /aftersales/orders/{orderId}/ |
| saveForOrder | POST | /aftersales/orders/{orderId}/ |
| updateItem | PUT | /aftersales/orders/{orderId}/{itemId}/ |
| uploadPhoto | POST | /aftersales/orders/{orderId}/{itemId}/photos/ |
| deletePhoto | DELETE | /aftersales/orders/{orderId}/{itemId}/photos/{filename} |
| resolveItem | PUT | /aftersales/orders/{orderId}/{itemId}/resolve/ |
| downloadExcel | GET | /aftersales/orders/{orderId}/download-excel/ |
| list | GET | /aftersales/ |
| getPending | GET | /aftersales/pending/ |
| clientGetForOrder | GET | /aftersales/client/orders/{orderId}/ |
| clientSubmitClaims | POST | /aftersales/client/orders/{orderId}/claims/ |

#### packingApi (13 methods)

| Method | HTTP | Endpoint |
|--------|------|----------|
| upload | POST | /orders/{orderId}/packing-list/upload/ |
| get | GET | /orders/{orderId}/packing-list/ |
| delete | DELETE | /orders/{orderId}/packing-list/ |
| migrateItems | POST | /orders/{orderId}/migrate-items/ |
| undoMigrate | POST | /orders/{orderId}/undo-migrate/ |
| downloadExcel | GET | /orders/{orderId}/packing-list/download-excel/ |
| downloadPDF | GET | /orders/{orderId}/packing-list/download-pdf/ |
| updateItem | PATCH | /orders/{orderId}/packing-list/items/{itemId}/ |
| createManual | POST | /orders/{orderId}/packing-list/manual/ |
| splitItem | POST | /orders/{orderId}/packing-list/items/{itemId}/split/ |
| unsplitItem | POST | /orders/{orderId}/packing-list/items/{itemId}/unsplit/ |
| setDecision | POST | /orders/{orderId}/packing-list/items/{itemId}/decision/ |
| clientSummary | GET | /orders/{orderId}/packing-list/client-summary/ |

#### productionApi (2 methods)

| Method | HTTP | Endpoint |
|--------|------|----------|
| getProgress | GET | /orders/{orderId}/production-progress/ |
| setDates | PUT | /orders/{orderId}/production-dates/ |

#### settingsApi (16 methods)

| Method | HTTP | Endpoint |
|--------|------|----------|
| getExchangeRates | GET | /settings/exchange-rates/ |
| updateExchangeRate | PUT | /settings/exchange-rates/ |
| getMarkups | GET | /settings/markups/ |
| createMarkup | POST | /settings/markups/ |
| updateMarkup | PUT | /settings/markups/ |
| getDefaults | GET | /settings/defaults/ |
| updateDefault | PUT | /settings/defaults/ |
| getTransitTimes | GET | /settings/transit-times/ |
| createTransitTime | POST | /settings/transit-times/ |
| updateTransitTime | PUT | /settings/transit-times/{id}/ |
| deleteTransitTime | DELETE | /settings/transit-times/{id}/ |
| getCategories | GET | /settings/categories/ |
| createCategory | POST | /settings/categories/ |
| updateCategory | PUT | /settings/categories/{id}/ |
| deleteCategory | DELETE | /settings/categories/{id}/ |
| getDefaultsList | GET | /settings/defaults/list/ |
| seedData | POST | /settings/seed/ |

#### documentsApi (4 methods)

| Method | HTTP | Endpoint |
|--------|------|----------|
| list | GET | /documents/orders/{orderId}/ |
| upload | POST | /documents/orders/{orderId}/ |
| download | GET | /documents/{docId}/download/ |
| delete | DELETE | /documents/{docId}/ |

#### transportApi (5 methods)

| Method | HTTP | Endpoint |
|--------|------|----------|
| list | GET | /shipping/transport/ |
| get | GET | /shipping/transport/{id} |
| create | POST | /shipping/transport/ |
| update | PUT | /shipping/transport/{id} |
| delete | DELETE | /shipping/transport/{id} |

#### usersApi (5 methods)

| Method | HTTP | Endpoint |
|--------|------|----------|
| list | GET | /users/ |
| get | GET | /users/{id}/ |
| create | POST | /users/ |
| update | PUT | /users/{id}/ |
| toggleActive | PUT | /users/{id} |

#### dashboardApi (5 methods)

| Method | HTTP | Endpoint |
|--------|------|----------|
| getSummary | GET | /dashboard/summary/ |
| getRecentOrders | GET | /dashboard/recent-orders/ |
| getActiveShipments | GET | /dashboard/active-shipments/ |
| getRecentActivity | GET | /dashboard/recent-activity/ |
| getClientInquiries | GET | /dashboard/client-inquiries/ |

#### unloadedApi (2 methods)

| Method | HTTP | Endpoint |
|--------|------|----------|
| list | GET | /unloaded-items/ |
| getPending | GET | /unloaded-items/pending/ |

#### auditApi (3 methods)

| Method | HTTP | Endpoint |
|--------|------|----------|
| list | GET | /audit/ |
| getActions | GET | /audit/actions/ |
| getResourceTypes | GET | /audit/resource-types/ |

#### authApi (1 method)

| Method | HTTP | Endpoint |
|--------|------|----------|
| getMe | GET | /auth/me |

---

## 8. COMPOSABLES REFERENCE

### useAuth

**File:** `composables/useAuth.js`

| Export | Type | Description |
|--------|------|-------------|
| user | ref | Current user object (null when logged out) |
| token | ref | JWT access token from localStorage |
| loading | ref | Loading state during auth operations |
| initialized | ref | Whether session restore completed |
| isAdmin | computed | Boolean — user.role === 'ADMIN' |
| roles | computed | Array — user.roles or [user.role] |
| isFinance | computed | Boolean — ADMIN or FINANCE role |
| isOperations | computed | Boolean — ADMIN or OPERATIONS role |
| login(email, password) | async function | POST /api/auth/login, stores tokens |
| logout() | function | Clears localStorage, redirects to /login |
| restoreSession() | async function | GET /api/auth/me, hydrates user on refresh |
| getPortalPath() | function | Returns portal path by user_type |
| hasAnyRole(roleList) | function | Array role check with ADMIN override |

**Storage keys:**
- `localStorage.harvesterp_token` — access token
- `localStorage.harvesterp_refresh` — refresh token

### useNotifications

**File:** `composables/useNotifications.js`

| Export | Type | Description |
|--------|------|-------------|
| unreadCount | ref | Number of unread notifications |
| notifications | ref | Array of notification objects |
| showNotifDialog | ref | Boolean — dialog visibility |
| loading | ref | Loading state |
| fetchUnreadCount() | async function | GET /api/notifications/count/ |
| fetchNotifications() | async function | GET /api/notifications/ |
| markAsRead(id) | async function | PUT /api/notifications/{id}/read/ |
| markAllRead() | async function | PUT /api/notifications/read-all/ |
| openDialog() | function | Fetches and shows notification dialog |

### useApiError

**File:** `composables/useApiError.js`

| Export | Type | Description |
|--------|------|-------------|
| error | ref | Error message string or null |
| handleError(err, fallback) | function | Extracts detail from response, sets error |
| clearError() | function | Resets error to null |

---

## 9. UTILITIES REFERENCE

### formatters.js

| Function | Parameters | Returns | Example |
|----------|------------|---------|---------|
| formatDate(isoStr) | string or null | Formatted date (en-IN) | `formatDate('2024-01-15') → '15 Jan 2024'` |
| formatCurrency(amount, currency) | number, 'INR'/'CNY'/'USD' | Currency string | `formatCurrency(1000, 'INR') → '₹1,000'` |
| formatINR(val) | number or null | INR string | `formatINR(50000) → '₹50,000'` |
| formatNumber(val, decimals) | number, number | Locale string | `formatNumber(1234.5, 2) → '1,234.50'` |

### constants.js

| Export | Type | Description |
|--------|------|-------------|
| INDIAN_STATES | Array | 28 states/UTs for address dropdowns |
| STAGE_MAP | Object | Status → { stage, label, color, border } |
| POST_PI_STATUSES | Set | Statuses after PI_SENT |
| STAGE_4_PLUS | Set | ADVANCE_PENDING onward |
| STAGE_6_PLUS | Set | FACTORY_ORDERED onward |
| BOOKING_STATUSES | Set | Booking and post-booking |
| SAILING_STATUSES | Set | Sailing and post-sailing |
| CUSTOMS_STATUSES | Set | Customs clearance |
| SHIPPING_DOC_STATUSES | Set | Shipping documentation |
| PACKING_STATUSES | Set | Packing and post-packing |
| TERMINAL_STATUSES | Set | DELIVERED, AFTER_SALES, COMPLETED |
| getStageInfo(status) | Function | Returns stage info object |

### factoryPortal.js

| Export | Type | Description |
|--------|------|-------------|
| FACTORY_STATUS_COLORS | Object | Status → Tailwind CSS classes for factory portal badges |

---

## 10. ENVIRONMENT VARIABLES

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| VITE_API_URL | No | (Vite proxy to localhost:8000) | Backend API base URL |

The Vite dev server proxies `/api` to `http://localhost:8000/api` — no env var needed for local dev.

---

## 11. BACKEND ROUTER REGISTRATION

| Router | Prefix | RBAC | Tags |
|--------|--------|------|------|
| auth | /api/auth | None (public) | Auth |
| dashboard | /api/dashboard | get_current_user | Dashboard |
| orders | /api/orders | get_current_user | Orders |
| products | /api/products | get_current_user | Products |
| factories | /api/factories | get_current_user | Factories |
| clients | /api/clients | get_current_user | Clients |
| documents | /api/documents | get_current_user | Documents |
| excel | /api/excel | require_operations | Excel Processing |
| shipping | /api/shipping | get_current_user | Shipping |
| customs | /api/customs | get_current_user | Customs |
| unloaded | /api/unloaded-items | get_current_user | Unloaded Items |
| aftersales | /api/aftersales | get_current_user | After-Sales |
| finance | /api/finance | require_finance | Finance |
| settings | /api/settings | require_admin | Settings |
| audit | /api/audit | require_admin | Audit Trail |
| users | /api/users | require_admin | Users |
| notifications | /api/notifications | get_current_user | Notifications |

---

## 12. ADDING NEW FEATURES — DEVELOPER CHECKLIST

### Adding a new page

- [ ] Add route to `router/index.js` with correct `meta.roles`
- [ ] Create view file in correct portal folder (`views/admin/`, `views/client/`, `views/factory/`)
- [ ] Add sidebar nav item in `Sidebar.vue` if needed
- [ ] Add API methods to `api/index.js` — never import axios directly
- [ ] Use `useApiError()` for error handling in catch blocks
- [ ] Import formatters from `utils/formatters.js` — never inline
- [ ] Import stage constants from `utils/constants.js`

### Adding a new API endpoint to frontend

- [ ] Add method to correct module in `api/index.js`
- [ ] Follow naming convention: `verbNoun` (getById, createOrder)
- [ ] Verify backend route exists with matching path
- [ ] Update this documentation

### Adding a new order detail tab

- [ ] Create component in `components/order/`
- [ ] Register in `views/orders/OrderDetail.vue` tab list
- [ ] Gate visibility by order stage using `STAGE_MAP` sets from constants
- [ ] Add API calls to `ordersApi` or relevant module

### Security rules

- [ ] Never store secrets in frontend code
- [ ] Role checks in router `meta.roles` for route access
- [ ] ADMIN role has implicit access to everything via `hasAnyRole()`
- [ ] Client/factory portals enforce `userType` in route meta
- [ ] All financial data filtered by backend RLS — don't rely on frontend-only filtering

---

*End of Frontend Developer Guide*
