import axios from 'axios'

// Create Axios instance with base URL
const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
})

// Request interceptor: inject auth token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('harvesterp_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status
    const message = error.response?.data?.detail || error.message || 'An error occurred'

    // Handle 401 Unauthorized — try silent refresh, then logout
    if (status === 401) {
      const url = error.config?.url || ''
      if (!url.includes('/auth/login') && !url.includes('/auth/refresh')) {
        // Try silent token refresh using httpOnly cookie
        try {
          const { data } = await api.post('/auth/refresh/', {}, { withCredentials: true })
          if (data.access_token) {
            localStorage.setItem('harvesterp_token', data.access_token)
            api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`
            // Retry the original request
            error.config.headers['Authorization'] = `Bearer ${data.access_token}`
            return api.request(error.config)
          }
        } catch (_) {
          // Refresh failed — session truly expired
        }
        localStorage.removeItem('harvesterp_token')
        delete api.defaults.headers.common['Authorization']
        if (window.location.pathname !== '/login') {
          window.location.href = '/login?session_expired=true'
        }
      }
    }

    // Handle 409 Conflict (optimistic locking violation)
    if (status === 409) {
      console.warn('Conflict detected — order was modified by another user')
      // Dispatch custom event for components to handle
      window.dispatchEvent(new CustomEvent('erp:conflict', { detail: { message } }))
    }

    // Handle 429 Rate Limited
    if (status === 429) {
      console.warn('Rate limited — too many requests')
    }

    // Handle 403 Forbidden (RBAC)
    if (status === 403) {
      console.warn('Access denied — insufficient permissions')
    }

    console.error('API Error:', message)
    return Promise.reject(error)
  }
)

// ========================================
// Orders API
// ========================================
export const ordersApi = {
  list: (params) => api.get('/orders/', { params }),
  get: (id) => api.get(`/orders/${id}/`),
  create: (data) => api.post('/orders/', data),
  update: (id, data) => api.put(`/orders/${id}/`, data),
  delete: (id) => api.delete(`/orders/${id}/`),
  setDeletionReason: (id, reason) => api.put(`/orders/${id}/delete-reason/`, { reason }),
  statusCounts: () => api.get('/orders/status-counts/'),

  // Items
  addItems: (id, data) => api.post(`/orders/${id}/items/`, data),
  updateItem: (id, itemId, data) => api.put(`/orders/${id}/items/${itemId}/`, data),
  removeItem: (id, itemId) => api.delete(`/orders/${id}/items/${itemId}/`),
  removeItemWithNote: (id, itemId, cancelNote) =>
    api.put(`/orders/${id}/items/${itemId}/remove/`, { cancel_note: cancelNote }),
  confirmItem: (orderId, itemId, action) =>
    api.post(`/orders/${orderId}/items/${itemId}/confirm/?action=${action}`),
  bulkConfirmItems: (orderId, action) =>
    api.post(`/orders/${orderId}/items/bulk-confirm/?action=${action}`),
  sendPendingPrices: (orderId) =>
    api.post(`/orders/${orderId}/items/send-prices/`),

  // Fetch pending carry-forward items
  fetchPendingItems: (id) => api.post(`/orders/${id}/fetch-pending-items/`),

  // Bulk text add
  bulkTextAddPreview: (id, lines) => api.post(`/orders/${id}/bulk-text-add/`, { lines }),
  bulkTextAddApply: (id, items) => api.post(`/orders/${id}/bulk-text-add/apply/`, { items }),

  // Item Pricing (Stage 2)
  updateItemPrices: (id, itemId, data) => api.put(`/orders/${id}/items/${itemId}/prices/`, data),
  copyPreviousPrices: (id) => api.post(`/orders/${id}/copy-previous-prices/`),
  resetAftersalesPrices: (id) => api.post(`/orders/${id}/reset-aftersales-prices/`),
  parsePriceExcel: (id, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/orders/${id}/parse-price-excel/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    })
  },

  // Stage transitions
  nextStage: (id) => api.get(`/orders/${id}/next-stages/`),
  transition: (id, targetStatus, data) =>
    api.put(`/orders/${id}/transition/?target_status=${targetStatus}`, data),
  reopen: (id, data) => api.put(`/orders/${id}/reopen/`, data),
  goBack: (id, data) => api.put(`/orders/${id}/go-back/`, data),
  jumpToStage: (id, data) => api.put(`/orders/${id}/jump-to-stage/`, data),

  // Timeline
  timeline: (id) => api.get(`/orders/${id}/timeline/`),
  createClientInquiry: (data) => api.post('/orders/client-inquiry/', data),
  approveInquiry: (orderId, data) => api.post(`/orders/${orderId}/approve-inquiry/`, data),

  // Client portal
  myLedger: (params) => api.get('/orders/my-ledger/', { params }),
  activityFeed: (id) => api.get(`/orders/${id}/activity-feed/`),
  productRequests: (id) => api.get(`/orders/${id}/product-requests/`),
  reconciliation: (id) => api.get(`/orders/reconciliation/${id}/`),

  // Landed Cost (transparency clients)
  recalculatePrices: (id, { refreshRate = false } = {}) =>
    api.post(`/orders/${id}/recalculate-prices/?refresh_rate=${refreshRate}`),
  getLandedCost: (id) => api.get(`/orders/${id}/landed-cost/`),
  downloadLandedCostExcel: (id) => api.get(`/orders/${id}/landed-cost/download/`, { responseType: 'blob', timeout: 60000 }),
}

// ========================================
// Excel Processing API
// ========================================
export const excelApi = {
  upload: (file, orderId, jobType, onProgress, skipProcessing = false) => {
    const formData = new FormData()
    formData.append('file', file)
    const params = new URLSearchParams()
    if (orderId) params.append('order_id', orderId)
    if (jobType) params.append('job_type', jobType)
    if (skipProcessing) params.append('skip_processing', 'true')
    return api.post(`/excel/upload/?${params.toString()}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000,
      onUploadProgress: onProgress,
    })
  },
  getJob: (jobId) => api.get(`/excel/jobs/${jobId}/`),
  listJobs: (params) => api.get('/excel/jobs/', { params }),
  cancelJob: (jobId) => api.delete(`/excel/jobs/${jobId}/`),
  applyParsedData: (jobId, data) => api.post(`/excel/apply/${jobId}/`, data),
  reparseJob: (jobId, columnMapping) => api.post(`/excel/jobs/${jobId}/reparse/`, columnMapping ? { column_mapping: columnMapping } : {}),
  analyzeColumns: (filePath, schemaType = 'product') =>
    api.post('/excel/analyze-columns/', { file_path: filePath, schema_type: schemaType }),
  analyzeConflicts: (groups) =>
    api.post('/excel/analyze-conflicts/', { groups }),
}

// ========================================
// Products API
// ========================================
export const productsApi = {
  list: (params) => api.get('/products/', { params }),
  get: (id) => api.get(`/products/${id}/`),
  create: (data) => api.post('/products/', data),
  update: (id, data) => api.put(`/products/${id}/`, data),
  delete: (id) => api.delete(`/products/${id}/`),
  bulkDelete: (productIds) => api.post('/products/bulk-delete/', { product_ids: productIds }),
  bulkUpdate: (productIds, fields) => api.post('/products/bulk-update/', { product_ids: productIds, ...fields }),
  search: (query) => api.get('/products/search/', { params: { q: query } }),
  validateCodes: (codes) => api.post('/products/validate-codes/', { codes }),
  categories: () => api.get('/products/categories/'),
  subcategories: () => api.get('/products/subcategories/'),
  materials: () => api.get('/products/materials/'),
  hsCodes: () => api.get('/products/hs-codes/'),
  partTypes: () => api.get('/products/part-types/'),
  brands: () => api.get('/products/brands/'),
  // Product images
  getImages: (id) => api.get(`/products/${id}/images/`),
  deleteImage: (id, imageId) => api.delete(`/products/${id}/images/${imageId}/`),
  uploadImage: (id, formData) => api.post(`/products/${id}/images/upload/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  // Variant management
  setDefault: (id) => api.post(`/products/${id}/set-default/`),
  checkVariants: (productCode) => api.get(`/products/check-variants/${encodeURIComponent(productCode)}/`),
  // Duplicate cleanup
  removeDuplicateImages: () => api.post('/products/remove-duplicate-images/'),
  findDuplicates: () => api.get('/products/find-duplicates/'),
  // Bin (soft-deleted products)
  listBin: (params) => api.get('/products/bin/', { params }),
  permanentDelete: (productIds) => api.post('/products/bin/permanent-delete/', { product_ids: productIds }),
  restoreFromBin: (productIds) => api.post('/products/bin/restore/', { product_ids: productIds }),
  // Pending review
  pendingReviewList: (params) => api.get('/products/pending-review-list/', { params }),
  approveRequest: (id, data) => api.post(`/products/product-requests/${id}/approve/`, data),
  mapRequest: (id, data) => api.post(`/products/product-requests/${id}/map/`, data),
  rejectRequest: (id, data) => api.post(`/products/product-requests/${id}/reject/`, data),
}

// ========================================
// Factories API
// ========================================
export const factoriesApi = {
  list: (params) => api.get('/factories/', { params }),
  get: (id) => api.get(`/factories/${id}/`),
  create: (data) => api.post('/factories/', data),
  update: (id, data) => api.put(`/factories/${id}/`, data),
  delete: (id) => api.delete(`/factories/${id}/`),
  search: (params) => api.get('/factories/search/', { params }),
}

// ========================================
// Clients API
// ========================================
export const clientsApi = {
  list: (params) => api.get('/clients/', { params }),
  get: (id) => api.get(`/clients/${id}/`),
  create: (data) => api.post('/clients/', data),
  update: (id, data) => api.put(`/clients/${id}/`, data),
  delete: (id) => api.delete(`/clients/${id}/`),
  search: (params) => api.get('/clients/search/', { params }),
  getClientCategories: (clientId) => api.get(`/clients/${clientId}/categories/`),
  setClientCategories: (clientId, categories) => api.put(`/clients/${clientId}/categories/`, { categories }),
  getBrands: (clientId) => api.get(`/clients/${clientId}/brands/`),
  setBrands: (clientId, brands) => api.put(`/clients/${clientId}/brands/`, { brands }),
  getPortalPermissions: (clientId) => api.get(`/clients/${clientId}/portal-permissions/`),
  updatePortalPermissions: (clientId, data) => api.put(`/clients/${clientId}/portal-permissions/`, data),
}

// ========================================
// Quotations / PI API
// ========================================
export const quotationsApi = {
  generatePI: (orderId) => api.post(`/excel/generate-pi/${orderId}/`),
  downloadPI: (orderId) =>
    api.get(`/excel/download-pi/${orderId}/`, { responseType: 'blob' }),
  downloadPIWithImages: (orderId) =>
    api.get(`/excel/download-pi-with-images/${orderId}/`, { responseType: 'blob', timeout: 120000 }),
}

// ========================================
// Payments API
// ========================================
export const paymentsApi = {
  // Client payments
  list: (orderId) => api.get(`/finance/orders/${orderId}/payments/`),
  create: (orderId, data) => api.post(`/finance/orders/${orderId}/payments/`, data),
  update: (orderId, paymentId, data) => api.put(`/finance/orders/${orderId}/payments/${paymentId}/`, data),
  delete: (orderId, paymentId) => api.delete(`/finance/orders/${orderId}/payments/${paymentId}/`),
  // Factory payments
  factoryList: (orderId) => api.get(`/finance/orders/${orderId}/factory-payments/`),
  factoryCreate: (orderId, data) => api.post(`/finance/orders/${orderId}/factory-payments/`, data),
  factoryUpdate: (orderId, paymentId, data) => api.put(`/finance/orders/${orderId}/factory-payments/${paymentId}/`, data),
  factoryDelete: (orderId, paymentId) => api.delete(`/finance/orders/${orderId}/factory-payments/${paymentId}/`),
  // Exchange rates
  exchangeRates: () => api.get('/finance/exchange-rates/'),
  // Client payment submission + verification
  submitPayment: (orderId, formData) =>
    api.post(`/finance/orders/${orderId}/submit-payment/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    }),
  verifyPayment: (paymentId, data) =>
    api.post(`/finance/payments/${paymentId}/verify/`, data),
  downloadProof: (paymentId) =>
    api.get(`/finance/payments/${paymentId}/proof/`, { responseType: 'blob' }),
}

// ========================================
// Finance API (Ledgers & Downloads)
// ========================================
export const financeApi = {
  receivables: (params) => api.get('/finance/receivables/', { params }),
  clientLedger: (clientId, params) => api.get(`/finance/client-ledger/${clientId}/`, { params }),
  factoryLedger: (factoryId, params) => api.get(`/finance/factory-ledger/${factoryId}/`, { params }),
  clientCredits: (clientId) => api.get(`/finance/clients/${clientId}/credits/`),
  applyCredit: (orderId, creditId) => api.post(`/finance/orders/${orderId}/apply-credit/`, { credit_id: creditId }),
  factoryCredits: (factoryId) => api.get(`/finance/factories/${factoryId}/credits/`),
  applyFactoryCredit: (orderId, creditId) => api.post(`/finance/orders/${orderId}/apply-factory-credit/`, { credit_id: creditId }),
  downloadClientLedger: (clientId, format, params) =>
    api.get(`/finance/client-ledger/${clientId}/download/`, { params: { format, ...params }, responseType: 'blob' }),
  downloadFactoryLedger: (factoryId, format, params) =>
    api.get(`/finance/factory-ledger/${factoryId}/download/`, { params: { format, ...params }, responseType: 'blob' }),
  auditLog: (orderId) => api.get(`/finance/orders/${orderId}/payment-audit-log/`),
  piHistory: (orderId) => api.get(`/finance/orders/${orderId}/pi-history/`),
}

// ========================================
// Production API
// ========================================
export const productionApi = {
  getProgress: (orderId) => api.get(`/orders/${orderId}/production-progress/`),
  setDates: (orderId, data) => api.put(`/orders/${orderId}/production-dates/`, data),
}

// ========================================
// Shipments API
// ========================================
export const shipmentsApi = {
  list: (orderId) => api.get(`/shipping/orders/${orderId}/shipments/`),
  create: (orderId, data) => api.post(`/shipping/orders/${orderId}/shipments/`, data),
  update: (shipmentId, data) => api.put(`/shipping/shipments/${shipmentId}/`, data),
  delete: (shipmentId) => api.delete(`/shipping/shipments/${shipmentId}/`),
  allocateItems: (shipmentId, items) => api.post(`/shipping/shipments/${shipmentId}/items/`, items),
  updateItem: (shipmentId, itemId, data) => api.put(`/shipping/shipments/${shipmentId}/items/${itemId}`, data),
  removeItem: (shipmentId, itemId) => api.delete(`/shipping/shipments/${shipmentId}/items/${itemId}`),
  markLoaded: (shipmentId, data) => api.put(`/shipping/shipments/${shipmentId}/phase/loaded/`, data),
  markSailed: (shipmentId, data) => api.put(`/shipping/shipments/${shipmentId}/phase/sailed/`, data),
  markArrived: (shipmentId, data) => api.put(`/shipping/shipments/${shipmentId}/phase/arrived/`, data),
  getProgress: (shipmentId) => api.get(`/shipping/shipments/${shipmentId}/progress/`),
  listDocs: (orderId) => api.get(`/shipping/orders/${orderId}/shipping-documents/`),
  uploadDoc: (docId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.put(`/shipping/shipping-documents/${docId}/upload/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    })
  },
  updateDocStatus: (docId, status) => api.put(`/shipping/shipping-documents/${docId}/status/`, null, { params: { status } }),
}

// ========================================
// Customs API
// ========================================
export const customsApi = {
  // HSN Tariff master
  listTariffs: () => api.get('/customs/tariffs/'),
  createTariff: (data) => api.post('/customs/tariffs/', data),
  updateTariff: (id, data) => api.put(`/customs/tariffs/${id}`, data),

  // BOE per-shipment
  getBoe: (shipmentId) => api.get(`/customs/shipments/${shipmentId}/boe/`),
  createBoe: (shipmentId, data) => api.post(`/customs/shipments/${shipmentId}/boe/`, data),
  updateBoe: (boeId, data) => api.put(`/customs/boe/${boeId}/`, data),
  deleteBoe: (boeId) => api.delete(`/customs/boe/${boeId}/`),

  // Shipment HSN grouping
  getHsnItems: (shipmentId) => api.get(`/customs/shipments/${shipmentId}/hsn-items/`),

  // Milestones & charges (existing contract)
  getMilestones: (orderId) => api.get(`/customs/${orderId}/milestones/`),
  addMilestone: (orderId, data) => api.post(`/customs/${orderId}/milestones/`, data),
  getCharges: (orderId) => api.get(`/customs/${orderId}/charges/`),
  saveCharges: (orderId, data) => api.post(`/customs/${orderId}/charges/`, data),
}

// ========================================
// After-Sales API
// ========================================
export const afterSalesApi = {
  // Order-scoped
  getForOrder: (orderId) => api.get(`/aftersales/orders/${orderId}/`),
  saveForOrder: (orderId, items) => api.post(`/aftersales/orders/${orderId}/`, items),
  updateItem: (orderId, itemId, data) => api.put(`/aftersales/orders/${orderId}/${itemId}/`, data),
  uploadPhoto: (orderId, itemId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/aftersales/orders/${orderId}/${itemId}/photos/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    })
  },
  deletePhoto: (orderId, itemId, filename) => api.delete(`/aftersales/orders/${orderId}/${itemId}/photos/${filename}`),
  resolveItem: (orderId, itemId, data) => api.put(`/aftersales/orders/${orderId}/${itemId}/resolve/`, data),
  downloadExcel: (orderId) => api.get(`/aftersales/orders/${orderId}/download-excel/`, { responseType: 'blob', timeout: 120000 }),
  // Global
  list: (params) => api.get('/aftersales/', { params }),
  getPending: (clientId, factoryId) => api.get('/aftersales/pending/', {
    params: { client_id: clientId, factory_id: factoryId }
  }),
  // Client portal
  clientGetForOrder: (orderId) => api.get(`/aftersales/client/orders/${orderId}/`),
  clientSubmitClaims: (orderId, data) => api.post(`/aftersales/client/orders/${orderId}/claims/`, data),
}

// ========================================
// Documents API
// ========================================
export const documentsApi = {
  list: (orderId) => api.get(`/documents/orders/${orderId}/`),
  upload: (orderId, file, docType) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', docType)
    return api.post(`/documents/orders/${orderId}/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  download: (docId) => api.get(`/documents/${docId}/download/`, { responseType: 'blob' }),
  delete: (docId) => api.delete(`/documents/${docId}/`),
}

// ========================================
// Settings API
// ========================================
export const settingsApi = {
  getExchangeRates: () => api.get('/settings/exchange-rates/'),
  updateExchangeRate: (data) => api.put('/settings/exchange-rates/', data),
  getMarkups: () => api.get('/settings/markups/'),
  createMarkup: (data) => api.post('/settings/markups/', data),
  updateMarkup: (data) => api.put('/settings/markups/', data),
  getDefaults: () => api.get('/settings/defaults/'),
  updateDefault: (key, value) => api.put('/settings/defaults/', { key, value }),
  getTransitTimes: () => api.get('/settings/transit-times/'),
  createTransitTime: (data) => api.post('/settings/transit-times/', data),
  updateTransitTime: (id, data) => api.put(`/settings/transit-times/${id}/`, data),
  deleteTransitTime: (id) => api.delete(`/settings/transit-times/${id}/`),
  getCategories: () => api.get('/settings/categories/'),
  createCategory: (data) => api.post('/settings/categories/', data),
  updateCategory: (id, data) => api.put(`/settings/categories/${id}/`, data),
  deleteCategory: (id) => api.delete(`/settings/categories/${id}/`),
  getDefaultsList: () => api.get('/settings/defaults/list/'),
  seedData: () => api.post('/settings/seed/'),
}

// ========================================
// Unloaded Items API
// ========================================
export const unloadedApi = {
  list: (params) => api.get('/unloaded-items/', { params }),
  getPending: (clientId, factoryId) => api.get('/unloaded-items/pending/', {
    params: { client_id: clientId, factory_id: factoryId }
  }),
}

// ========================================
// Packing List API
// ========================================
export const packingApi = {
  upload: (orderId, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post(`/orders/${orderId}/packing-list/upload/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    })
  },
  get: (orderId) => api.get(`/orders/${orderId}/packing-list/`),
  delete: (orderId) => api.delete(`/orders/${orderId}/packing-list/`),
  migrateItems: (orderId, items) => api.post(`/orders/${orderId}/migrate-items/`, { items }),
  undoMigrate: (orderId, orderItemIds) => api.post(`/orders/${orderId}/undo-migrate/`, { order_item_ids: orderItemIds }),
  downloadExcel: (orderId) => api.get(`/orders/${orderId}/packing-list/download-excel/`, { responseType: 'blob', timeout: 120000 }),
  downloadPDF: (orderId) => api.get(`/orders/${orderId}/packing-list/download-pdf/`, { responseType: 'blob' }),
  updateItem: (orderId, itemId, data) => api.patch(`/orders/${orderId}/packing-list/items/${itemId}/`, data),
  createManual: (orderId, items) => api.post(`/orders/${orderId}/packing-list/manual/`, { items }),
  splitItem: (orderId, itemId, splits) =>
    api.post(`/orders/${orderId}/packing-list/items/${itemId}/split/`, { splits }),
  unsplitItem: (orderId, itemId) =>
    api.post(`/orders/${orderId}/packing-list/items/${itemId}/unsplit/`),
  setDecision: (orderId, itemId, decision, cancelReason) =>
    api.post(`/orders/${orderId}/packing-list/items/${itemId}/decision/`, {
      decision, cancel_reason: cancelReason
    }),
  clientSummary: (orderId) => api.get(`/orders/${orderId}/packing-list/client-summary/`),
}

// ========================================
// Transport API
// ========================================
export const transportApi = {
  list: (params) => api.get('/shipping/transport/', { params }),
  get: (id) => api.get(`/shipping/transport/${id}`),
  create: (data) => api.post('/shipping/transport/', data),
  update: (id, data) => api.put(`/shipping/transport/${id}`, data),
  delete: (id) => api.delete(`/shipping/transport/${id}`),
}

// ========================================
// Users API
// ========================================
export const usersApi = {
  list: (params) => api.get('/users/', { params }),
  get: (id) => api.get(`/users/${id}/`),
  create: (data) => api.post('/users/', data),
  update: (id, data) => api.put(`/users/${id}/`, data),
  toggleActive: (id, isActive) => api.put(`/users/${id}`, { is_active: isActive }),
}

// ========================================
// Dashboard API
// ========================================
export const dashboardApi = {
  getSummary: () => api.get('/dashboard/summary/'),
  getRecentOrders: () => api.get('/dashboard/recent-orders/'),
  getActiveShipments: () => api.get('/dashboard/active-shipments/'),
  getRecentActivity: () => api.get('/dashboard/recent-activity/'),
  getClientInquiries: () => api.get('/dashboard/client-inquiries/'),
}

// ========================================
// Audit API
// ========================================
export const auditApi = {
  list: (params) => api.get('/audit/', { params }),
  getActions: () => api.get('/audit/actions/'),
  getResourceTypes: () => api.get('/audit/resource-types/'),
}

// ========================================
// Auth API
// ========================================
export const authApi = {
  getMe: () => api.get('/auth/me'),
}

export const queriesApi = {
  list: (orderId, params) => api.get(`/orders/${orderId}/queries/`, { params }),
  get: (orderId, queryId) => api.get(`/orders/${orderId}/queries/${queryId}/`),
  create: (orderId, data) => api.post(`/orders/${orderId}/queries/`, data),
  reply: (orderId, queryId, data) => api.post(`/orders/${orderId}/queries/${queryId}/reply/`, data),
  replyWithAttachment: (orderId, queryId, formData, message = '') =>
    api.post(`/orders/${orderId}/queries/${queryId}/reply/upload/?message=${encodeURIComponent(message)}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    }),
  resolve: (orderId, queryId, remark = '') => api.put(`/orders/${orderId}/queries/${queryId}/resolve/?remark=${encodeURIComponent(remark)}`),
  reopen: (orderId, queryId) => api.put(`/orders/${orderId}/queries/${queryId}/reopen/`),
  delete: (orderId, queryId) => api.delete(`/orders/${orderId}/queries/${queryId}/`),
  summary: (orderId) => api.get(`/orders/${orderId}/queries/summary/`),
  inlineQuery: (orderId, itemId, message) =>
    api.post(`/orders/${orderId}/queries/inline/?order_item_id=${itemId}&message=${encodeURIComponent(message)}`),
  inlineStatus: (orderId) => api.get(`/orders/${orderId}/queries/inline-status/`),
}

export default api
