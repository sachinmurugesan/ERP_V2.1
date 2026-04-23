<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api, { ordersApi, shipmentsApi, documentsApi, afterSalesApi, packingApi, authApi, paymentsApi, queriesApi } from '../../api'
import { productionApi } from '../../api'
import { formatINR, formatDate } from '../../utils/formatters'
import FinalDraftTab from '../../components/order/FinalDraftTab.vue'
import ClientQueriesTab from '../../components/order/QueriesTab.vue'
import ClientOrderItemsTab from '../../components/order/ClientOrderItemsTab.vue'
import LandedCostTab from '../../components/order/LandedCostTab.vue'
import {
  CLIENT_STATUS_LABELS as statusLabels,
  CLIENT_STATUS_COLORS as stageColors,
  STEPPER_STAGES as stepperStages,
  POST_PI_STATUSES,
  PRODUCTION_STATUSES,
  SHIPPING_STATUSES,
  AFTER_SALES_STATUSES,
  getStageNumber,
  getStepState as _getStepState,
  getStatusLabel,
} from '../../utils/clientPortal'

const route = useRoute()
const router = useRouter()
const orderId = route.params.id
const order = ref(null)
const timeline = ref([])
const pendingRequests = ref([])
const loading = ref(true)
const error = ref('')
const activeTab = ref(route.query.tab || 'items')
const clientType = ref('REGULAR')
const portalPerms = ref({
  show_payments: false, show_production: false,
  show_shipping: false, show_after_sales: false, show_files: false, show_packing: false,
})
const payments = ref([])
const paymentSummary = ref({ pi_total: 0, paid: 0, balance: 0, progress: 0 })
const loadingPayments = ref(false)
const production = ref(null)
const loadingProduction = ref(false)
const packingSummary = ref(null)
const loadingPacking = ref(false)
const shipments = ref([])
const loadingShipments = ref(false)
const documents = ref([])
const loadingDocs = ref(false)
const activityFeed = ref([])
const afterSalesItems = ref([])
const loadingAfterSales = ref(false)
const savingClaims = ref(false)
const afterSalesMessage = ref('')
const toast = ref({ visible: false, type: 'success', message: '' })

const showPaymentModal = ref(false)
const paymentSubmitting = ref(false)
const paymentForm = ref({
  payment_type: 'CLIENT_ADVANCE',
  amount: '',
  currency: 'INR',
  method: 'BANK_TRANSFER',
  reference: '',
  payment_date: new Date().toISOString().split('T')[0],
  notes: '',
})
const proofFile = ref(null)

function showToast(type, message) {
  toast.value = { visible: true, type, message }
  setTimeout(() => { toast.value = { ...toast.value, visible: false } }, 4000)
}

async function loadOrder() {
  try {
    const [orderRes, timelineRes] = await Promise.allSettled([
      ordersApi.get(orderId),
      ordersApi.timeline(orderId),
    ])

    if (orderRes.status === 'fulfilled') {
      order.value = orderRes.value.data
    } else {
      error.value = orderRes.reason?.response?.data?.detail || 'Failed to load order'
    }

    if (timelineRes.status === 'fulfilled') {
      const tData = timelineRes.value.data
      timeline.value = tData.timeline || tData.events || []
    }

    // Load pending product requests for CLIENT_DRAFT orders
    if (order.value && ['CLIENT_DRAFT', 'DRAFT'].includes(order.value.status)) {
      try {
        const { data } = await ordersApi.productRequests(orderId)
        pendingRequests.value = data.requests || data.products || []
      } catch (_) { /* endpoint may not exist yet */ }
    }
  } catch (e) {
    error.value = e.response?.data?.detail || 'Failed to load order'
  }
  // Load portal permissions
  try {
    const { data } = await authApi.getMe()
    if (data.portal_permissions) portalPerms.value = { ...portalPerms.value, ...data.portal_permissions }
    if (data.client_type) clientType.value = data.client_type
  } catch (_) { /* ignore */ }

  // Load activity feed
  try {
    const { data } = await ordersApi.activityFeed(orderId)
    activityFeed.value = data.events || []
  } catch (_) { /* ignore */ }

  loading.value = false
}

// Tab visibility — stage + permission gated (sets imported from clientPortal.js)
const PACKING_STATUSES = new Set([
  'PLAN_PACKING', 'FINAL_PI', 'PRODUCTION_100', 'BOOKED', 'LOADED',
  'SAILED', 'ARRIVED', 'CUSTOMS_FILED', 'CLEARED', 'DELIVERED',
  'AFTER_SALES', 'COMPLETED',
])

const tabs = computed(() => {
  const status = order.value?.status
  const t = [{ key: 'items', label: 'Order Items', icon: 'pi-list' }]
  if (portalPerms.value.show_payments && POST_PI_STATUSES.has(status))
    t.push({ key: 'payments', label: 'Payments', icon: 'pi-wallet' })
  if (portalPerms.value.show_production && PRODUCTION_STATUSES.has(status))
    t.push({ key: 'production', label: 'Production', icon: 'pi-cog' })
  if (portalPerms.value.show_packing && PACKING_STATUSES.has(status))
    t.push({ key: 'packing', label: 'Packing', icon: 'pi-box' })
  if (portalPerms.value.show_shipping && SHIPPING_STATUSES.has(status))
    t.push({ key: 'shipping', label: 'Shipping', icon: 'pi-send' })
  if (portalPerms.value.show_after_sales && AFTER_SALES_STATUSES.has(status))
    t.push({ key: 'after_sales', label: 'After-Sales', icon: 'pi-exclamation-triangle' })
  if (['COMPLETED'].includes(status))
    t.push({ key: 'final_draft', label: 'Final Draft', icon: 'pi-check-square' })
  t.push({ key: 'queries', label: 'Queries', icon: 'pi-comments' })
  if (portalPerms.value.show_files)
    t.push({ key: 'files', label: 'Files', icon: 'pi-paperclip' })
  // Landed Cost — transparency clients at CLEARED+
  const _lcStages = new Set(['CLEARED', 'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING'])
  if (clientType.value === 'TRANSPARENCY' && _lcStages.has(status))
    t.push({ key: 'landed_cost', label: 'Landed Cost', icon: 'pi-chart-bar' })
  return t
})

async function loadPayments() {
  if (loadingPayments.value) return
  loadingPayments.value = true
  try {
    const { data } = await ordersApi.myLedger()
    const orderPayments = (data.payments || []).filter(p => p.order_id === orderId)
    payments.value = orderPayments

    // Use the ledger's per-order data (single source of truth — same as admin ledger)
    const thisOrder = (data.orders || []).find(o => o.id === orderId)
    const piTotal = thisOrder?.total_inr || 0
    const totalPaid = thisOrder?.paid || orderPayments.filter(p => (p.verification_status || 'VERIFIED') === 'VERIFIED').reduce((sum, p) => sum + (p.amount_inr || 0), 0)
    const balance = piTotal - totalPaid
    const progress = piTotal > 0 ? Math.min(Math.round((totalPaid / piTotal) * 100 * 10) / 10, 100) : 0
    paymentSummary.value = {
      pi_total: piTotal,
      original_pi_total: thisOrder?.original_pi_total || piTotal,
      is_revised: thisOrder?.is_revised || false,
      paid: totalPaid,
      balance,
      progress,
      overpaid: balance < 0,
      overpayment: balance < 0 ? Math.abs(balance) : 0,
    }
  } catch (_) { /* ignore */ }
  loadingPayments.value = false
}

async function submitPayment() {
  if (!proofFile.value || !paymentForm.value.amount) return
  paymentSubmitting.value = true
  try {
    const fd = new FormData()
    fd.append('payment_type', paymentForm.value.payment_type)
    fd.append('amount', paymentForm.value.amount)
    fd.append('currency', paymentForm.value.currency)
    fd.append('exchange_rate', '1.0')
    fd.append('method', paymentForm.value.method)
    if (paymentForm.value.reference) fd.append('reference', paymentForm.value.reference)
    fd.append('payment_date', paymentForm.value.payment_date)
    fd.append('notes', paymentForm.value.notes || '')
    fd.append('proof_file', proofFile.value)
    await paymentsApi.submitPayment(orderId, fd)
    showPaymentModal.value = false
    proofFile.value = null
    paymentForm.value = {
      payment_type: 'CLIENT_ADVANCE', amount: '', currency: 'INR',
      method: 'BANK_TRANSFER', reference: '',
      payment_date: new Date().toISOString().split('T')[0], notes: '',
    }
    await loadPayments()
    showToast('success', 'Payment submitted for verification')
  } catch (e) {
    showToast('error', e.response?.data?.detail || 'Failed to submit payment')
  } finally {
    paymentSubmitting.value = false
  }
}

function handleProofFile(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const allowed = ['image/jpeg', 'image/png', 'application/pdf']
  if (!allowed.includes(file.type)) {
    showToast('error', 'Only JPG, PNG or PDF files allowed')
    event.target.value = ''
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('error', 'File too large. Maximum 5MB.')
    event.target.value = ''
    return
  }
  proofFile.value = file
}

async function loadProduction() {
  if (loadingProduction.value) return
  loadingProduction.value = true
  try {
    const { data } = await productionApi.getProgress(orderId)
    production.value = data
  } catch (_) { /* ignore */ }
  loadingProduction.value = false
}

async function loadShipments() {
  if (loadingShipments.value) return
  loadingShipments.value = true
  try {
    const { data } = await shipmentsApi.list(orderId)
    shipments.value = data || []
  } catch (_) { /* ignore */ }
  loadingShipments.value = false
}

async function loadDocuments() {
  if (loadingDocs.value) return
  loadingDocs.value = true
  try {
    const { data } = await documentsApi.list(orderId)
    documents.value = data || []
  } catch (_) { /* ignore */ }
  loadingDocs.value = false
}

async function downloadDocument(doc) {
  try {
    const res = await documentsApi.download(doc.id)
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = doc.filename || doc.name || 'document'
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  } catch (_) {
    alert('Failed to download file')
  }
}

async function loadPacking() {
  if (loadingPacking.value) return
  loadingPacking.value = true
  try {
    const { data } = await packingApi.clientSummary(orderId)
    packingSummary.value = data
  } catch (_) { /* ignore — permission may be off */ }
  loadingPacking.value = false
}

async function downloadPackingExcel(withImages = false) {
  try {
    const response = withImages
      ? await packingApi.downloadPDF(orderId)
      : await packingApi.downloadExcel(orderId)
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = withImages
      ? `Packing-${order.value?.order_number || orderId}.pdf`
      : `Packing-${order.value?.order_number || orderId}.xlsx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  } catch (_) {
    alert('Failed to download packing list')
  }
}

// ── Order Journey mapping (client-friendly timeline) ──
const journeyMap = {
  DRAFT:           { title: 'Inquiry Received',         description: 'Your order inquiry has been received and is under review by our team.',           icon: 'pi-inbox',        iconBg: 'bg-blue-100',    iconColor: '#2563eb' },
  CLIENT_DRAFT:    { title: 'Inquiry Submitted',        description: 'You submitted an inquiry. Our team will review it shortly.',                      icon: 'pi-send',         iconBg: 'bg-teal-100',    iconColor: '#0d9488' },
  PENDING_PI:      { title: 'Quotation Being Prepared', description: 'Our team is preparing your Proforma Invoice with pricing.',                       icon: 'pi-file-edit',    iconBg: 'bg-blue-100',    iconColor: '#2563eb' },
  PI_SENT:         { title: 'Quotation Ready',          description: 'Your Proforma Invoice is ready. Review pricing and download.',                    icon: 'pi-file-check',   iconBg: 'bg-indigo-100',  iconColor: '#4f46e5' },
  ADVANCE_PENDING: { title: 'Payment Requested',        description: 'Advance payment required to proceed.',                                            icon: 'pi-wallet',       iconBg: 'bg-amber-100',   iconColor: '#d97706' },
  ADVANCE_RECEIVED:{ title: 'Payment Confirmed',        description: 'Payment received. Order placed with manufacturer.',                               icon: 'pi-check-circle', iconBg: 'bg-emerald-100', iconColor: '#059669' },
  FACTORY_ORDERED: { title: 'Ordered from Manufacturer', description: 'Your order has been placed. Production begins shortly.',                         icon: 'pi-building',     iconBg: 'bg-violet-100',  iconColor: '#7c3aed' },
  PRODUCTION_60:   { title: 'Production Started (60%)',  description: 'Manufacturing underway — your parts are being produced.',                         icon: 'pi-cog',          iconBg: 'bg-orange-100',  iconColor: '#ea580c' },
  PRODUCTION_80:   { title: 'Production 80%',            description: 'Manufacturing well advanced — most parts ready.',                                 icon: 'pi-cog',          iconBg: 'bg-orange-100',  iconColor: '#ea580c' },
  PRODUCTION_90:   { title: 'Production 90%',            description: 'Almost complete — final quality checks in progress.',                             icon: 'pi-cog',          iconBg: 'bg-orange-100',  iconColor: '#ea580c' },
  PLAN_PACKING:    { title: 'Packing in Progress',      description: 'Products being packed into containers for shipment.',                              icon: 'pi-box',          iconBg: 'bg-cyan-100',    iconColor: '#0891b2' },
  FINAL_PI:        { title: 'Final Invoice Issued',     description: 'Final invoice generated based on shipped quantities.',                             icon: 'pi-file',         iconBg: 'bg-indigo-100',  iconColor: '#4f46e5' },
  PRODUCTION_100:  { title: 'Production Complete',      description: 'All parts manufactured — ready for shipment.',                                     icon: 'pi-verified',     iconBg: 'bg-green-100',   iconColor: '#16a34a' },
  BOOKED:          { title: 'Container Booked',         description: 'Shipping container booked — goods will be loaded soon.',                           icon: 'pi-briefcase',    iconBg: 'bg-cyan-100',    iconColor: '#0891b2' },
  LOADED:          { title: 'Loaded on Vessel',         description: 'Container loaded onto vessel at port of origin.',                                  icon: 'pi-upload',       iconBg: 'bg-blue-100',    iconColor: '#2563eb' },
  SAILED:          { title: 'In Transit',               description: 'Your goods are on the water — sailing from China to India.',                       icon: 'pi-compass',      iconBg: 'bg-blue-100',    iconColor: '#2563eb' },
  ARRIVED:         { title: 'Arrived at Port',          description: 'Shipment arrived at the Indian port.',                                             icon: 'pi-map-marker',   iconBg: 'bg-violet-100',  iconColor: '#7c3aed' },
  CUSTOMS_FILED:   { title: 'Customs Processing',       description: 'Bill of Entry filed — clearing through Indian customs.',                           icon: 'pi-shield',       iconBg: 'bg-amber-100',   iconColor: '#d97706' },
  CLEARED:         { title: 'Customs Cleared',          description: 'Goods cleared customs — ready for delivery.',                                      icon: 'pi-check-square', iconBg: 'bg-emerald-100', iconColor: '#059669' },
  DELIVERED:       { title: 'Delivered to You',         description: 'Order delivered! Please verify goods and report any issues.',                       icon: 'pi-truck',        iconBg: 'bg-emerald-100', iconColor: '#059669' },
  AFTER_SALES:     { title: 'Quality Review',           description: 'Post-delivery review — any issues being resolved.',                                icon: 'pi-exclamation-triangle', iconBg: 'bg-amber-100', iconColor: '#d97706' },
  COMPLETED:       { title: 'Order Complete ✓',         description: 'Order fully complete. Thank you for your business!',                               icon: 'pi-star',         iconBg: 'bg-emerald-100', iconColor: '#059669' },
}

const journeyEvents = computed(() => {
  const completed = timeline.value.filter(e => e.status === 'completed')
  const currentStatus = order.value?.status
  return completed.map((event, i) => {
    const mapping = journeyMap[event.name] || {
      title: statusLabels[event.name] || (event.name || '').replace(/_/g, ' '),
      description: '', icon: 'pi-circle', iconBg: 'bg-slate-100', iconColor: '#64748b',
    }
    return {
      ...mapping,
      stage: event.name,
      date: event.completed_at,
      isActive: event.name === currentStatus || i === completed.length - 1,
    }
  })
})

async function loadAfterSales() {
  if (loadingAfterSales.value) return
  loadingAfterSales.value = true
  afterSalesMessage.value = ''
  try {
    const { data } = await afterSalesApi.clientGetForOrder(orderId)
    afterSalesItems.value = (data.items || []).filter(i => !i.is_balance_only)
    afterSalesMessage.value = data.message || ''
  } catch (_) { /* ignore */ }
  loadingAfterSales.value = false
}

function updateAfterSalesField(item, field, value) {
  // Immutable update
  afterSalesItems.value = afterSalesItems.value.map(i =>
    i.id === item.id ? { ...i, [field]: value } : i
  )
}

async function submitClaims() {
  savingClaims.value = true
  try {
    const claims = afterSalesItems.value
      .filter(i => i.objection_type || i.received_qty !== i.sent_qty)
      .map(i => ({
        id: i.id,
        received_qty: i.received_qty ?? i.sent_qty,
        objection_type: i.objection_type || null,
        description: i.description || null,
        affected_quantity: i.affected_quantity || null,
        client_remarks: i.client_remarks || null,
      }))
    if (claims.length === 0) {
      // Submit all items with received_qty confirmed
      const allItems = afterSalesItems.value.map(i => ({
        id: i.id,
        received_qty: i.received_qty ?? i.sent_qty,
        objection_type: null,
      }))
      await afterSalesApi.clientSubmitClaims(orderId, allItems)
    } else {
      await afterSalesApi.clientSubmitClaims(orderId, claims)
    }
    await loadAfterSales()
    showToast('success', 'Claims submitted successfully! Our team will review your issues.')
  } catch (e) {
    showToast('error', e.response?.data?.detail || 'Failed to submit claims. Please try again.')
  }
  savingClaims.value = false
}

async function uploadEvidence(item) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*,video/*'
  input.multiple = true
  input.onchange = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    for (const file of files) {
      const formData = new FormData()
      formData.append('file', file)
      try {
        const { data } = await api.post(
          `/aftersales/client/orders/${orderId}/${item.id}/photos/`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 }
        )
        afterSalesItems.value = afterSalesItems.value.map(i =>
          i.id === item.id ? { ...i, photos: data.photos } : i
        )
      } catch (_) {
        showToast('error', `Failed to upload ${file.name}`)
      }
    }
  }
  input.click()
}

const photoLightbox = ref({ visible: false, itemId: null })
const zoomedPhoto = ref(null)
const zoomedIndex = ref(0)
const zoomLevel = ref(1)
const panOffset = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0 })

function handleZoomWheel(e) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.15 : 0.15
  const newZoom = Math.min(Math.max(zoomLevel.value + delta, 0.5), 5)
  // If zooming out past 1, reset pan
  if (newZoom <= 1) {
    panOffset.value = { x: 0, y: 0 }
  }
  zoomLevel.value = newZoom
}

function startPan(e) {
  if (zoomLevel.value <= 1) return
  isPanning.value = true
  panStart.value = { x: e.clientX - panOffset.value.x, y: e.clientY - panOffset.value.y }
  e.preventDefault()
}

function onPan(e) {
  if (!isPanning.value) return
  panOffset.value = {
    x: e.clientX - panStart.value.x,
    y: e.clientY - panStart.value.y,
  }
}

function endPan() {
  isPanning.value = false
}

function resetZoom() {
  zoomLevel.value = 1
  panOffset.value = { x: 0, y: 0 }
}

function zoomIn() {
  zoomLevel.value = Math.min(zoomLevel.value + 0.5, 5)
}

function zoomOut() {
  const newZoom = Math.max(zoomLevel.value - 0.5, 0.5)
  if (newZoom <= 1) panOffset.value = { x: 0, y: 0 }
  zoomLevel.value = newZoom
}
function openPhotoViewer(item) {
  photoLightbox.value = { visible: true, itemId: item.id }
}
function closePhotoViewer() {
  photoLightbox.value = { visible: false, itemId: null }
  zoomedPhoto.value = null
  zoomedIndex.value = 0
  resetZoom()
}

function navPhoto(dir) {
  const newIdx = zoomedIndex.value + dir
  if (newIdx >= 0 && newIdx < lightboxPhotos.value.length) {
    zoomedIndex.value = newIdx
    zoomedPhoto.value = lightboxPhotos.value[newIdx]
    resetZoom()
  }
}
const lightboxPhotos = computed(() => {
  if (!photoLightbox.value.itemId) return []
  const item = afterSalesItems.value.find(i => i.id === photoLightbox.value.itemId)
  return (item?.photos || []).map(f => `/api/aftersales/orders/${orderId}/photos/${f}`)
})

const ISSUE_TYPES = [
  { value: '', label: '— No Issue' },
  { value: 'PRODUCT_MISMATCH', label: 'Wrong Product' },
  { value: 'PRODUCT_MISSING', label: 'Missing Items' },
  { value: 'QUALITY_ISSUE', label: 'Quality Issue' },
  { value: 'PRICE_MISMATCH', label: 'Price Mismatch' },
]

const claimCount = computed(() =>
  afterSalesItems.value.filter(i => i.objection_type).length
)

function selectTab(key) {
  activeTab.value = key
  if (key === 'payments' && payments.value.length === 0) loadPayments()
  if (key === 'production' && !production.value) loadProduction()
  if (key === 'packing' && !packingSummary.value) loadPacking()
  if (key === 'shipping' && shipments.value.length === 0) loadShipments()
  if (key === 'files' && documents.value.length === 0) loadDocuments()
  if (key === 'after_sales' && afterSalesItems.value.length === 0) loadAfterSales()
}

onMounted(loadOrder)

// Respond to URL tab changes from notification clicks
watch(() => route.query.tab, (newTab) => {
  if (newTab) activeTab.value = newTab
})

function handleOpenQuery(queryId) {
  activeTab.value = 'queries'
  router.replace({ query: { ...route.query, tab: 'queries', query: queryId } })
}

const hasPrices = computed(() =>
  order.value?.items?.some(i => i.selling_price_inr != null) || false
)

// Only count ACTIVE items — excludes UNLOADED/REMOVED (consistent with admin revised PI)
const activeItems = computed(() =>
  (order.value?.items || []).filter(i => !i.status || i.status === 'ACTIVE')
)

const orderTotal = computed(() =>
  activeItems.value.reduce(
    (sum, i) => sum + (Number(i.selling_price_inr || 0) * (i.quantity || 0)), 0
  )
)

// PI download availability (POST_PI_STATUSES imported from clientPortal.js)
const canDownloadPI = computed(() =>
  order.value && POST_PI_STATUSES.has(order.value.status)
)

const downloading = ref(false)
async function downloadPI(withImages = false) {
  downloading.value = true
  try {
    const endpoint = withImages
      ? `/orders/${orderId}/download-pi-with-images/`
      : `/orders/${orderId}/download-pi/`
    const response = await api.get(endpoint, { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `PI-${order.value?.order_number || orderId}.xlsx`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  } catch (e) {
    alert(e.response?.data?.detail || 'Failed to download PI. It may not be generated yet.')
  }
  downloading.value = false
}

// Status labels, colors, stepper stages imported from @/utils/clientPortal.js
const currentStageNum = computed(() => order.value ? getStageNumber(order.value.status) : 0)
function getStepState(step) { return _getStepState(step, currentStageNum.value) }
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto xl:pr-[280px]">
    <!-- Back -->
    <router-link to="/client-portal/orders" class="text-emerald-600 hover:text-emerald-800 text-sm mb-4 inline-flex items-center gap-1">
      <i class="pi pi-arrow-left text-xs" /> Back to Orders
    </router-link>

    <div v-if="loading" class="py-16 text-center text-slate-400"><i class="pi pi-spinner pi-spin mr-2" /> Loading...</div>
    <div v-else-if="error" class="py-16 text-center text-red-500">{{ error }}</div>

    <template v-else-if="order">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-slate-800">Order {{ order.order_number || order.po_reference }}</h1>
          <div class="flex items-center gap-2 mt-1">
            <span class="px-2.5 py-1 rounded-full text-xs font-medium" :class="stageColors[order.status] || 'bg-gray-100'">
              {{ statusLabels[order.status] || (order.status || '').replace(/_/g, ' ') }}
            </span>
            <span v-if="order.client_reference" class="text-xs text-slate-400">
              Ref: {{ order.client_reference }}
            </span>
          </div>
        </div>
        <div class="text-right text-sm text-slate-500">
          <div>Created: {{ order.created_at ? new Date(order.created_at).toLocaleDateString() : '-' }}</div>
          <div v-if="order.po_reference" class="text-xs mt-0.5">PO: {{ order.po_reference }}</div>
        </div>
      </div>

      <!-- Horizontal Stage Stepper (matches admin panel) -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 overflow-x-auto">
        <div class="flex items-center min-w-[900px]">
          <template v-for="(step, i) in stepperStages" :key="step.num">
            <!-- Step circle + label -->
            <div class="flex flex-col items-center flex-shrink-0" style="min-width: 60px;">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all"
                :class="getStepState(step) === 'completed' ? 'bg-emerald-500 border-emerald-500 text-white' :
                         getStepState(step) === 'current' ? 'bg-white border-emerald-500 text-emerald-600 ring-4 ring-emerald-100' :
                         'bg-white border-slate-200 text-slate-400'"
              >
                <i v-if="getStepState(step) === 'completed'" class="pi pi-check text-[10px]" />
                <span v-else>{{ step.num }}</span>
              </div>
              <span
                class="text-[10px] mt-1 text-center leading-tight"
                :class="getStepState(step) === 'current' ? 'font-bold text-emerald-700' :
                         getStepState(step) === 'completed' ? 'text-emerald-600' : 'text-slate-400'"
              >{{ step.label }}</span>
            </div>
            <!-- Connector line -->
            <div
              v-if="i < stepperStages.length - 1"
              class="flex-1 h-0.5 mx-1 transition-all"
              :class="getStepState(stepperStages[i + 1]) === 'completed' || getStepState(step) === 'completed' && getStepState(stepperStages[i + 1]) === 'current' ? 'bg-emerald-400' : 'bg-slate-200'"
            />
          </template>
        </div>
      </div>

      <!-- PI Download Bar (Stage 3: PI_SENT and later) -->
      <div v-if="canDownloadPI" class="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div class="flex items-center gap-2">
            <i class="pi pi-file-excel text-indigo-600 text-lg" />
            <div>
              <p class="text-sm font-bold text-indigo-800">Proforma Invoice Ready</p>
              <p class="text-[10px] text-indigo-600">Review your pricing and download the PI document</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="downloadPI(true)"
              :disabled="downloading"
              class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              <i :class="downloading ? 'pi pi-spinner pi-spin' : 'pi pi-download'" class="text-xs" />
              Download PI
            </button>
          </div>
        </div>
      </div>

      <!-- Pending Product Requests (CLIENT_DRAFT / DRAFT only) -->
      <div v-if="pendingRequests.length > 0" class="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
        <div class="flex items-center gap-2 mb-3">
          <i class="pi pi-clock text-amber-600" />
          <h2 class="font-bold text-amber-800 text-sm">Pending Product Requests</h2>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-200 text-amber-800">{{ pendingRequests.length }}</span>
        </div>
        <p class="text-xs text-amber-700 mb-3">These products you requested via Quick Add are being reviewed by our team.</p>
        <div class="space-y-2">
          <div v-for="pr in pendingRequests" :key="pr.id" class="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border border-amber-100">
            <div>
              <span class="font-mono text-xs text-slate-600">{{ pr.product_code }}</span>
              <span class="text-sm text-slate-800 ml-2">{{ pr.product_name }}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs text-slate-500">Qty: {{ pr.quantity }}</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-medium"
                :class="pr.status === 'APPROVED' ? 'bg-green-100 text-green-700' : pr.status === 'MAPPED' ? 'bg-blue-100 text-blue-700' : pr.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'">
                {{ pr.status === 'MAPPED' ? 'Matched' : pr.status }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab Bar -->
      <div v-if="tabs.length > 1" class="bg-white rounded-xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
        <div class="flex border-b border-slate-100">
          <button
            v-for="tab in tabs" :key="tab.key"
            @click="selectTab(tab.key)"
            class="px-5 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors"
            :class="activeTab === tab.key
              ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'"
          >
            <i :class="'pi ' + tab.icon" class="text-xs" />
            {{ tab.label }}
            <span v-if="tab.key === 'queries' && (order?.query_counts?.open || 0) > 0"
              class="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold bg-red-500 text-white animate-pulse">
              {{ order.query_counts.open }}
            </span>
            <span v-else-if="tab.key === 'queries' && (order?.query_counts?.replied || 0) > 0"
              class="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold bg-blue-500 text-white">
              {{ order.query_counts.replied }}
            </span>
          </button>
        </div>
      </div>

      <!-- Tab: Order Items -->
      <div v-show="activeTab === 'items'" class="bg-white rounded-xl lg:rounded-r-none border border-slate-200 shadow-sm overflow-hidden mb-6 p-5">
        <ClientOrderItemsTab
          :orderId="orderId"
          :order="order"
          :permissions="portalPerms"
          @reload="loadOrder"
          @open-query="handleOpenQuery"
        />

      </div>

      <!-- Tab: Payments -->
      <div v-if="activeTab === 'payments'" class="space-y-4 mb-6">
        <div v-if="loadingPayments" class="bg-white rounded-xl border border-slate-200 shadow-sm py-12 text-center text-slate-400">
          <i class="pi pi-spinner pi-spin mr-2" /> Loading payment data...
        </div>

        <template v-else>
          <!-- Payment Summary Cards -->
          <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <i class="pi pi-wallet text-emerald-600" />
                <h2 class="font-bold text-slate-800">Payment Summary</h2>
              </div>
            </div>

            <!-- Summary Grid -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-100">
              <div class="bg-white p-4">
                <p class="text-[10px] text-slate-400 uppercase tracking-wider font-medium">
                  {{ paymentSummary.is_revised ? 'Revised PI Total' : 'PI Total' }}
                </p>
                <p class="text-lg font-bold text-slate-800 mt-1">₹{{ paymentSummary.pi_total.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</p>
                <p v-if="paymentSummary.is_revised" class="text-[10px] text-slate-400 line-through">
                  ₹{{ paymentSummary.original_pi_total.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
                </p>
              </div>
              <div class="bg-white p-4">
                <p class="text-[10px] text-emerald-500 uppercase tracking-wider font-medium">Paid</p>
                <p class="text-lg font-bold text-emerald-600 mt-1">₹{{ paymentSummary.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</p>
              </div>
              <div class="bg-white p-4">
                <p class="text-[10px] uppercase tracking-wider font-medium" :class="paymentSummary.overpaid ? 'text-blue-500' : 'text-red-400'">
                  {{ paymentSummary.overpaid ? 'Overpaid' : 'Balance Due' }}
                </p>
                <p class="text-lg font-bold mt-1" :class="paymentSummary.overpaid ? 'text-blue-600' : 'text-red-600'">
                  ₹{{ Math.abs(paymentSummary.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
                </p>
              </div>
              <div class="bg-white p-4">
                <p class="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Progress</p>
                <p class="text-lg font-bold text-slate-800 mt-1">{{ paymentSummary.progress }}%</p>
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="px-5 py-3 bg-slate-50">
              <div class="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-700"
                  :class="paymentSummary.progress >= 100 ? 'bg-emerald-500' : 'bg-emerald-400'"
                  :style="{ width: Math.min(paymentSummary.progress, 100) + '%' }"
                />
              </div>
            </div>

            <!-- Overpayment Notice -->
            <div v-if="paymentSummary.overpaid" class="px-5 py-3 bg-blue-50 border-t border-blue-100">
              <div class="flex items-center gap-2">
                <i class="pi pi-info-circle text-blue-500 text-sm" />
                <span class="text-xs text-blue-700">
                  Overpayment of ₹{{ paymentSummary.overpayment.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }} — this will be applied as credit to future orders.
                </span>
              </div>
            </div>
          </div>

          <!-- Submit Payment button -->
          <div class="flex justify-end mb-4">
            <button @click="showPaymentModal = true"
              class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
            >
              <i class="pi pi-plus text-xs" /> Submit Payment
            </button>
          </div>

          <!-- Payment History Table -->
          <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="px-5 py-4 border-b border-slate-100">
              <div class="flex items-center gap-2">
                <i class="pi pi-history text-slate-400" />
                <h2 class="font-bold text-slate-800">Payment History</h2>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">{{ payments.length }}</span>
              </div>
            </div>

            <div v-if="!payments.length" class="py-10 text-center">
              <i class="pi pi-wallet text-2xl text-slate-200 mb-2 block" />
              <p class="text-sm text-slate-400">No payments recorded yet</p>
            </div>

            <table v-else class="w-full text-sm">
              <thead class="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th class="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider w-8">#</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Date</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Type</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Method</th>
                  <th class="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Reference</th>
                  <th class="px-4 py-3 text-right font-semibold text-slate-500 text-xs uppercase tracking-wider">Amount (₹)</th>
                  <th class="text-center px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(p, i) in payments" :key="p.id" :class="['border-t border-slate-50 transition-colors', p.verification_status === 'REJECTED' ? 'opacity-30' : 'hover:bg-slate-50/50']">
                  <td class="px-4 py-3.5 text-xs text-slate-400">{{ i + 1 }}</td>
                  <td class="px-4 py-3.5 text-sm text-slate-700">
                    {{ p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-' }}
                  </td>
                  <td class="px-4 py-3.5">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      :class="(p.payment_type || '').toLowerCase() === 'advance'
                        ? 'bg-emerald-100 text-emerald-700'
                        : (p.payment_type || '').toLowerCase() === 'balance'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-600'">
                      {{ p.payment_type || 'Payment' }}
                    </span>
                  </td>
                  <td class="px-4 py-3.5 text-sm text-slate-600">{{ (p.method || '-').replace(/_/g, ' ') }}</td>
                  <td class="px-4 py-3.5 text-xs text-slate-400 font-mono">{{ p.reference || '-' }}</td>
                  <td class="px-4 py-3.5 text-right font-semibold text-emerald-700">
                    ₹{{ Number(p.amount_inr || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
                  </td>
                  <td class="px-4 py-2 text-center">
                    <span v-if="p.verification_status === 'PENDING_VERIFICATION'" class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">Pending</span>
                    <span v-else-if="p.verification_status === 'VERIFIED'" class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">Verified</span>
                    <span v-else-if="p.verification_status === 'REJECTED'" class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700" :title="p.rejection_reason || 'Rejected'">Rejected</span>
                    <span v-else class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">Verified</span>
                  </td>
                </tr>
              </tbody>
              <tfoot class="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colspan="6" class="px-4 py-3 text-right font-bold text-sm text-slate-600">Total Paid</td>
                  <td class="px-4 py-3 text-right font-bold text-emerald-700">
                    ₹{{ paymentSummary.paid.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </template>
      </div>

      <!-- Tab: Production -->
      <div v-if="activeTab === 'production'" class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="font-bold text-slate-800">Production Progress</h2>
          <span v-if="production?.is_overdue" class="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            <i class="pi pi-exclamation-triangle text-[10px] mr-1" />Delayed by {{ production.overdue_days }} days
          </span>
        </div>

        <div v-if="loadingProduction" class="py-8 text-center text-slate-400"><i class="pi pi-spinner pi-spin mr-2" /> Loading...</div>
        <template v-else>
          <!-- Progress bar -->
          <div class="flex items-center gap-4 mb-4">
            <div class="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-700"
                :class="production?.is_overdue ? 'bg-amber-500' : 'bg-emerald-500'"
                :style="{ width: Math.min(production?.percent || 0, 100) + '%' }"
              />
            </div>
            <span class="text-lg font-bold" :class="production?.is_overdue ? 'text-amber-700' : 'text-slate-700'">
              {{ Math.min(production?.percent || 0, 100) }}%
            </span>
          </div>

          <!-- Info cards -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="bg-slate-50 rounded-lg p-3">
              <p class="text-[10px] text-slate-400 uppercase tracking-wide">Status</p>
              <p class="font-medium text-sm text-slate-700 mt-0.5">{{ statusLabels[order.status] || order.status }}</p>
            </div>
            <div v-if="production?.started_at" class="bg-slate-50 rounded-lg p-3">
              <p class="text-[10px] text-slate-400 uppercase tracking-wide">Started</p>
              <p class="font-medium text-sm text-slate-700 mt-0.5">{{ new Date(production.started_at).toLocaleDateString() }}</p>
            </div>
            <div v-if="production?.target_date" class="bg-slate-50 rounded-lg p-3">
              <p class="text-[10px] text-slate-400 uppercase tracking-wide">Target Completion</p>
              <p class="font-medium text-sm text-slate-700 mt-0.5">{{ new Date(production.target_date).toLocaleDateString() }}</p>
            </div>
            <div v-if="production?.days_remaining != null" class="bg-slate-50 rounded-lg p-3">
              <p class="text-[10px] text-slate-400 uppercase tracking-wide">Days Remaining</p>
              <p class="font-medium text-sm mt-0.5" :class="production.is_overdue ? 'text-amber-700' : 'text-emerald-700'">
                {{ production.is_overdue ? 'Overdue' : production.days_remaining + ' days' }}
              </p>
            </div>
          </div>

          <div v-if="!production?.started_at && !production?.target_date" class="py-6 text-center text-slate-400 text-sm">
            <i class="pi pi-clock text-lg mb-2 block" />
            Production dates will be updated once the factory begins work.
          </div>
        </template>
      </div>

      <!-- Tab: Packing -->
      <div v-if="activeTab === 'packing'" class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 class="font-bold text-slate-800">Packing Summary</h2>
            <p class="text-xs text-slate-400 mt-0.5">Items produced and allocated for shipment</p>
          </div>
          <div v-if="packingSummary?.summary" class="flex items-center gap-2">
            <button @click="downloadPackingExcel(false)"
              class="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 flex items-center gap-1.5">
              <i class="pi pi-file-excel text-[10px]" /> Excel
            </button>
            <button @click="downloadPackingExcel(true)"
              class="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 flex items-center gap-1.5">
              <i class="pi pi-images text-[10px]" /> With Images
            </button>
          </div>
        </div>

        <div v-if="loadingPacking" class="py-8 text-center text-slate-400"><i class="pi pi-spinner pi-spin mr-2" /> Loading...</div>
        <div v-else-if="!packingSummary?.summary" class="py-8 text-center text-slate-400 text-sm">
          <i class="pi pi-box text-lg mb-2 block" />
          Packing details will appear once your order is being prepared for shipment.
        </div>

        <div v-else class="p-5">
          <!-- Summary Cards -->
          <div class="grid grid-cols-3 gap-3 mb-4">
            <div class="rounded-lg p-3 bg-slate-50 border border-slate-200">
              <p class="text-[10px] text-slate-400 uppercase tracking-wide">Ordered</p>
              <p class="text-xl font-bold text-slate-700">{{ packingSummary.summary.total_items }}</p>
              <p class="text-[10px] text-slate-400">{{ packingSummary.summary.total_ordered_qty }} qty</p>
            </div>
            <div class="rounded-lg p-3 bg-emerald-50 border border-emerald-200">
              <p class="text-[10px] text-emerald-500 uppercase tracking-wide">Produced</p>
              <p class="text-xl font-bold text-emerald-700">{{ packingSummary.summary.produced_count }}</p>
              <p class="text-[10px] text-emerald-500">{{ packingSummary.summary.total_ready_qty }} qty</p>
            </div>
            <div v-if="packingSummary.summary.migrated_count > 0" class="rounded-lg p-3 bg-amber-50 border border-amber-200">
              <p class="text-[10px] text-amber-500 uppercase tracking-wide">Next Order</p>
              <p class="text-xl font-bold text-amber-700">{{ packingSummary.summary.migrated_count }}</p>
              <p class="text-[10px] text-amber-500">carried forward</p>
            </div>
            <div v-else class="rounded-lg p-3 bg-blue-50 border border-blue-200">
              <p class="text-[10px] text-blue-500 uppercase tracking-wide">Not Ready</p>
              <p class="text-xl font-bold text-blue-700">{{ packingSummary.summary.not_ready_count }}</p>
              <p class="text-[10px] text-blue-400">pending production</p>
            </div>
          </div>

          <!-- Progress bar -->
          <div class="flex items-center gap-3 mb-5">
            <div class="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div class="h-full bg-emerald-500 rounded-full transition-all duration-500" :style="{ width: packingSummary.summary.produced_percent + '%' }" />
            </div>
            <span class="text-xs font-medium text-slate-600 whitespace-nowrap">{{ packingSummary.summary.produced_percent }}% produced</span>
          </div>

          <!-- Items table -->
          <table v-if="packingSummary.items?.length" class="w-full text-sm">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Part Code</th>
                <th class="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Name</th>
                <th class="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase w-20">Ordered</th>
                <th class="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase w-20">Ready</th>
                <th class="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 uppercase w-28">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in packingSummary.items" :key="item.product_code" class="border-t border-slate-50 hover:bg-slate-50/50">
                <td class="px-4 py-2.5 font-mono text-xs text-slate-600">{{ item.product_code }}</td>
                <td class="px-4 py-2.5 text-xs text-slate-700">{{ item.product_name }}</td>
                <td class="px-4 py-2.5 text-right text-xs font-medium">{{ item.ordered_qty }}</td>
                <td class="px-4 py-2.5 text-right text-xs font-medium">{{ item.ready_qty }}</td>
                <td class="px-4 py-2.5 text-center">
                  <span v-if="item.status === 'LOADED'" class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">Loaded</span>
                  <span v-else class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">Not Ready</span>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Carried Forward section -->
          <div v-if="packingSummary.carried_forward?.length > 0" class="mt-5 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div class="flex items-center gap-2 mb-3">
              <i class="pi pi-replay text-amber-600 text-sm" />
              <h3 class="text-sm font-semibold text-amber-800">{{ packingSummary.carried_forward.length }} item(s) will be in your next order</h3>
            </div>
            <div class="space-y-2">
              <div v-for="cf in packingSummary.carried_forward" :key="cf.product_code" class="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-100">
                <div>
                  <span class="font-mono text-xs text-slate-600">{{ cf.product_code }}</span>
                  <span class="text-xs text-slate-700 ml-2">{{ cf.product_name }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-slate-500">Qty: {{ cf.ordered_qty }}</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-medium"
                    :class="cf.reason === 'NO_SPACE' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'">
                    {{ cf.reason === 'NO_SPACE' ? 'No Space' : 'Not Produced' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: Shipping -->
      <div v-if="activeTab === 'shipping'" class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <h2 class="font-bold text-slate-800 mb-4">Shipping & Tracking</h2>

        <div v-if="loadingShipments" class="py-8 text-center text-slate-400"><i class="pi pi-spinner pi-spin mr-2" /> Loading...</div>
        <div v-else-if="!shipments.length" class="py-8 text-center text-slate-400 text-sm">
          <i class="pi pi-send text-lg mb-2 block" />
          Shipment details will appear once your order is booked for shipping.
        </div>

        <div v-else v-for="s in shipments" :key="s.id" class="mb-6 last:mb-0">
          <!-- Voyage route visual -->
          <div v-if="s.port_of_loading || s.port_of_discharge" class="bg-blue-50 rounded-xl p-4 mb-4">
            <div class="flex items-center justify-between">
              <div class="text-center">
                <p class="text-[10px] text-blue-400 uppercase">Port of Loading</p>
                <p class="font-bold text-blue-800 text-sm">{{ s.port_of_loading || '-' }}</p>
                <p v-if="s.etd" class="text-[10px] text-blue-500 mt-0.5">ETD: {{ new Date(s.etd).toLocaleDateString() }}</p>
              </div>
              <div class="flex-1 mx-4 relative">
                <div class="h-0.5 bg-blue-200 w-full" />
                <div class="absolute top-1/2 -translate-y-1/2 transition-all duration-500"
                  :style="{ left: order.status === 'LOADED' ? '10%' : order.status === 'SAILED' ? '50%' : '90%' }">
                  <i class="pi pi-arrow-right text-blue-600 text-lg" />
                </div>
              </div>
              <div class="text-center">
                <p class="text-[10px] text-blue-400 uppercase">Port of Discharge</p>
                <p class="font-bold text-blue-800 text-sm">{{ s.port_of_discharge || '-' }}</p>
                <p v-if="s.eta" class="text-[10px] text-blue-500 mt-0.5">ETA: {{ new Date(s.eta).toLocaleDateString() }}</p>
              </div>
            </div>
          </div>

          <!-- Shipment details grid -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div v-if="s.vessel_name" class="bg-slate-50 rounded-lg p-3">
              <p class="text-[10px] text-slate-400 uppercase tracking-wide">Vessel</p>
              <p class="font-medium text-sm text-slate-700 mt-0.5">{{ s.vessel_name }}</p>
              <p v-if="s.voyage_number" class="text-[10px] text-slate-400">Voyage: {{ s.voyage_number }}</p>
            </div>
            <div v-if="s.container_number" class="bg-slate-50 rounded-lg p-3">
              <p class="text-[10px] text-slate-400 uppercase tracking-wide">Container</p>
              <p class="font-medium text-sm text-slate-700 mt-0.5">{{ s.container_number }}</p>
              <p v-if="s.container_type" class="text-[10px] text-slate-400">{{ s.container_type }}</p>
            </div>
            <div v-if="s.bl_number" class="bg-slate-50 rounded-lg p-3">
              <p class="text-[10px] text-slate-400 uppercase tracking-wide">B/L Number</p>
              <p class="font-medium text-sm text-slate-700 mt-0.5">{{ s.bl_number }}</p>
            </div>
            <div class="bg-slate-50 rounded-lg p-3">
              <p class="text-[10px] text-slate-400 uppercase tracking-wide">Status</p>
              <p class="font-medium text-sm mt-0.5">
                <span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="stageColors[order.status]">
                  {{ statusLabels[order.status] || order.status }}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: After-Sales -->
      <div v-if="activeTab === 'after_sales'" class="space-y-6 mb-6">
        <!-- Toast notification -->
        <transition
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="translate-y-[-8px] opacity-0"
          enter-to-class="translate-y-0 opacity-100"
          leave-active-class="transition duration-200 ease-in"
          leave-from-class="translate-y-0 opacity-100"
          leave-to-class="translate-y-[-8px] opacity-0">
          <div v-if="toast.visible" class="rounded-xl px-5 py-3.5 flex items-center gap-3 shadow-lg"
            :class="toast.type === 'success' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'">
            <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              :class="toast.type === 'success' ? 'bg-emerald-100' : 'bg-red-100'">
              <i :class="toast.type === 'success' ? 'pi pi-check text-emerald-600' : 'pi pi-exclamation-triangle text-red-600'" class="text-sm" />
            </div>
            <p class="text-sm font-medium flex-1"
              :class="toast.type === 'success' ? 'text-emerald-800' : 'text-red-800'">
              {{ toast.message }}
            </p>
            <button @click="toast.visible = false" class="text-slate-400 hover:text-slate-600 flex-shrink-0">
              <i class="pi pi-times text-xs" />
            </button>
          </div>
        </transition>

        <!-- Header -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 class="font-bold text-slate-800 flex items-center gap-2">
                <i class="pi pi-exclamation-triangle text-amber-500" />
                After-Sales Review
              </h2>
              <p class="text-xs text-slate-400 mt-0.5">Verify received quantities and report any issues</p>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="claimCount > 0" class="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                {{ claimCount }} issue{{ claimCount > 1 ? 's' : '' }} flagged
              </span>
              <button
                @click="submitClaims"
                :disabled="savingClaims"
                class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                <i :class="savingClaims ? 'pi pi-spinner pi-spin' : 'pi pi-check'" class="text-xs" />
                {{ savingClaims ? 'Submitting...' : 'Submit Review' }}
              </button>
            </div>
          </div>

          <!-- Loading / Message -->
          <div v-if="loadingAfterSales" class="py-12 text-center text-slate-400">
            <i class="pi pi-spinner pi-spin mr-2" /> Loading items...
          </div>
          <div v-else-if="afterSalesMessage" class="py-12 text-center">
            <i class="pi pi-clock text-2xl text-slate-300 mb-2 block" />
            <p class="text-sm text-slate-500">{{ afterSalesMessage }}</p>
          </div>

          <!-- Items table -->
          <div v-else-if="afterSalesItems.length" class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th class="px-3 py-2.5 text-left font-semibold text-slate-600 text-xs">Product</th>
                  <th class="px-3 py-2.5 text-center font-semibold text-slate-600 text-xs w-16">Pallet</th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 text-xs w-16">Sent</th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 text-xs w-24">Received</th>
                  <th class="px-3 py-2.5 text-left font-semibold text-slate-600 text-xs w-36">Issue Type</th>
                  <th class="px-3 py-2.5 text-left font-semibold text-slate-600 text-xs">Description</th>
                  <th class="px-3 py-2.5 text-right font-semibold text-slate-600 text-xs w-20">Claim Qty</th>
                  <th class="px-3 py-2.5 text-center font-semibold text-slate-600 text-xs w-20">Evidence</th>
                  <th class="px-3 py-2.5 text-center font-semibold text-slate-600 text-xs w-28">Resolution</th>
                  <th class="px-3 py-2.5 text-center font-semibold text-slate-600 text-xs w-20">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in afterSalesItems" :key="item.id"
                  class="border-t border-slate-50 hover:bg-slate-50/50"
                  :class="item.objection_type ? 'bg-amber-50/30' : ''">
                  <!-- Product -->
                  <td class="px-3 py-2.5">
                    <div class="font-mono text-xs text-slate-500">{{ item.product_code }}</div>
                    <div class="text-xs text-slate-700 mt-0.5">{{ item.product_name }}</div>
                  </td>
                  <!-- Pallet -->
                  <td class="px-3 py-2.5 text-center">
                    <span v-if="item.pallet_number === 'BULK'" class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">Loose</span>
                    <span v-else-if="item.pallet_number" class="text-xs font-medium text-slate-600">{{ item.pallet_number }}</span>
                    <span v-else class="text-xs text-slate-300">—</span>
                  </td>
                  <!-- Sent -->
                  <td class="px-3 py-2.5 text-right font-medium text-slate-700">{{ item.sent_qty }}</td>
                  <!-- Received (CLIENT EDITABLE) -->
                  <td class="px-3 py-2.5 text-right">
                    <input v-if="item.status !== 'RESOLVED'"
                      type="number" min="0" :max="item.sent_qty"
                      :value="item.received_qty ?? item.sent_qty"
                      @change="updateAfterSalesField(item, 'received_qty', parseInt($event.target.value) || 0)"
                      class="w-16 text-right text-xs border border-slate-200 rounded px-1.5 py-1 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200" />
                    <span v-else class="text-xs font-medium">{{ item.received_qty }}</span>
                  </td>
                  <!-- Issue Type (CLIENT EDITABLE) -->
                  <td class="px-3 py-2.5">
                    <select v-if="item.status !== 'RESOLVED'"
                      :value="item.objection_type || ''"
                      @change="updateAfterSalesField(item, 'objection_type', $event.target.value || null)"
                      class="text-xs px-2 py-1 border rounded w-full"
                      :class="item.objection_type ? 'border-amber-400 bg-amber-50' : 'border-slate-200'">
                      <option v-for="t in ISSUE_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
                    </select>
                    <span v-else class="text-xs">
                      {{ ISSUE_TYPES.find(t => t.value === item.objection_type)?.label || item.objection_type || '—' }}
                    </span>
                  </td>
                  <!-- Description (CLIENT EDITABLE) -->
                  <td class="px-3 py-2.5">
                    <input v-if="item.objection_type && item.status !== 'RESOLVED'"
                      type="text"
                      :value="item.description || ''"
                      @change="updateAfterSalesField(item, 'description', $event.target.value)"
                      placeholder="Describe the issue..."
                      class="text-xs w-full border border-slate-200 rounded px-2 py-1 focus:border-emerald-400" />
                    <span v-else-if="item.description" class="text-xs text-slate-600">{{ item.description }}</span>
                    <span v-else class="text-xs text-slate-300">—</span>
                  </td>
                  <!-- Claim Qty (CLIENT EDITABLE) -->
                  <td class="px-3 py-2.5 text-right">
                    <input v-if="item.objection_type && item.status !== 'RESOLVED'"
                      type="number" min="0" :max="item.sent_qty"
                      :value="item.affected_quantity || 0"
                      @change="updateAfterSalesField(item, 'affected_quantity', parseInt($event.target.value) || 0)"
                      class="w-14 text-right text-xs border border-slate-200 rounded px-1.5 py-1 focus:border-amber-400" />
                    <span v-else class="text-xs">{{ item.affected_quantity || '—' }}</span>
                  </td>
                  <!-- Evidence (CLIENT UPLOAD + VIEW) -->
                  <td class="px-3 py-2.5 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                      <button v-if="item.photos?.length"
                        @click="openPhotoViewer(item)"
                        class="text-xs text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-0.5">
                        <i class="pi pi-images text-[10px]" />
                        {{ item.photos.length }}
                      </button>
                      <button v-if="item.objection_type && item.status !== 'RESOLVED'"
                        @click="uploadEvidence(item)"
                        class="text-xs text-blue-600 hover:text-blue-800 px-1.5 py-0.5 border border-blue-200 rounded hover:bg-blue-50"
                        title="Upload photo evidence">
                        <i class="pi pi-camera" />
                      </button>
                      <span v-if="!item.photos?.length && !item.objection_type" class="text-xs text-slate-300">—</span>
                    </div>
                  </td>
                  <!-- Resolution (READ-ONLY for client) -->
                  <td class="px-3 py-2.5 text-center">
                    <span v-if="item.resolution_type" class="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      :class="item.resolution_type?.includes('REPLACE') ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'">
                      {{ (item.resolution_type || '').replace(/_/g, ' ') }}
                    </span>
                    <span v-else class="text-xs text-slate-300">Pending</span>
                  </td>
                  <!-- Status (READ-ONLY) -->
                  <td class="px-3 py-2.5 text-center">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      :class="item.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' :
                               item.status === 'OPEN' ? 'bg-amber-100 text-amber-700' :
                               item.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                               'bg-slate-100 text-slate-600'">
                      {{ item.status === 'CLOSED' && !item.objection_type ? 'OK' : item.status || 'OK' }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="py-12 text-center text-slate-400 text-sm">
            <i class="pi pi-check-circle text-lg mb-2 block text-emerald-400" />
            No after-sales items to review.
          </div>
        </div>

        <!-- Photo Gallery (Google-style) -->
        <div v-if="photoLightbox.visible" class="fixed inset-0 z-50">
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/80" @click="zoomedPhoto ? (zoomedPhoto = null) : closePhotoViewer()" />

          <!-- Zoomed single photo view with pan/zoom -->
          <div v-if="zoomedPhoto" class="absolute inset-0 flex flex-col z-10" @wheel="handleZoomWheel">
            <!-- Top toolbar -->
            <div class="flex items-center justify-between px-4 py-3 flex-shrink-0">
              <span class="text-white/70 text-sm font-medium">{{ zoomedIndex + 1 }} / {{ lightboxPhotos.length }}</span>
              <div class="flex items-center gap-1">
                <button @click="zoomOut" class="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white text-sm" title="Zoom out">
                  <i class="pi pi-minus text-xs" />
                </button>
                <button @click="resetZoom" class="px-2.5 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white text-xs font-mono min-w-[52px]" title="Reset zoom">
                  {{ Math.round(zoomLevel * 100) }}%
                </button>
                <button @click="zoomIn" class="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white text-sm" title="Zoom in">
                  <i class="pi pi-plus text-xs" />
                </button>
                <div class="w-px h-5 bg-white/20 mx-1" />
                <button @click="zoomedPhoto = null; resetZoom()" class="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white" title="Back to grid">
                  <i class="pi pi-th-large text-xs" />
                </button>
                <button @click="closePhotoViewer" class="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white" title="Close">
                  <i class="pi pi-times text-sm" />
                </button>
              </div>
            </div>

            <!-- Image area with pan/drag -->
            <div class="flex-1 relative overflow-hidden"
              :class="zoomLevel > 1 ? 'cursor-grab' : 'cursor-default'"
              :style="isPanning ? 'cursor: grabbing' : ''"
              @mousedown="startPan"
              @mousemove="onPan"
              @mouseup="endPan"
              @mouseleave="endPan"
              @dblclick="zoomLevel === 1 ? zoomIn() : resetZoom()">
              <!-- Nav arrows -->
              <button v-if="zoomedIndex > 0" @click.stop="navPhoto(-1)"
                class="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white z-20 backdrop-blur-sm">
                <i class="pi pi-chevron-left text-lg" />
              </button>
              <button v-if="zoomedIndex < lightboxPhotos.length - 1" @click.stop="navPhoto(1)"
                class="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 bg-black/30 hover:bg-black/50 rounded-full flex items-center justify-center text-white z-20 backdrop-blur-sm">
                <i class="pi pi-chevron-right text-lg" />
              </button>

              <!-- The image -->
              <div class="w-full h-full flex items-center justify-center">
                <img :src="zoomedPhoto"
                  class="max-w-full max-h-full object-contain select-none transition-transform"
                  :style="{
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                    transitionDuration: isPanning ? '0ms' : '150ms',
                  }"
                  draggable="false" />
              </div>
            </div>

            <!-- Bottom hint -->
            <div class="flex-shrink-0 py-2 text-center">
              <span class="text-white/40 text-[10px]">Scroll to zoom · Drag to pan · Double-click to fit</span>
            </div>
          </div>

          <!-- Gallery grid panel -->
          <div v-else class="absolute inset-x-0 bottom-0 top-16 flex items-start justify-center p-4 z-10">
            <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-full overflow-hidden flex flex-col">
              <!-- Header -->
              <div class="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 class="font-bold text-slate-800 text-sm">Evidence Photos</h3>
                  <p class="text-[10px] text-slate-400 mt-0.5">{{ lightboxPhotos.length }} photo{{ lightboxPhotos.length !== 1 ? 's' : '' }} uploaded</p>
                </div>
                <div class="flex items-center gap-2">
                  <button @click="uploadEvidence(afterSalesItems.find(i => i.id === photoLightbox.itemId))"
                    class="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-medium hover:bg-blue-100 flex items-center gap-1.5">
                    <i class="pi pi-plus text-[10px]" /> Add Photos
                  </button>
                  <button @click="closePhotoViewer" class="text-slate-400 hover:text-slate-600 p-1"><i class="pi pi-times" /></button>
                </div>
              </div>
              <!-- Photo grid -->
              <div class="p-4 overflow-y-auto flex-1">
                <div v-if="!lightboxPhotos.length" class="py-12 text-center">
                  <i class="pi pi-images text-3xl text-slate-300 mb-3 block" />
                  <p class="text-sm text-slate-400">No photos yet</p>
                  <button @click="uploadEvidence(afterSalesItems.find(i => i.id === photoLightbox.itemId))"
                    class="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700">
                    <i class="pi pi-camera mr-1" /> Upload Photos
                  </button>
                </div>
                <div v-else class="grid grid-cols-3 gap-2">
                  <div v-for="(url, i) in lightboxPhotos" :key="i"
                    class="relative aspect-square rounded-lg overflow-hidden cursor-pointer group border border-slate-100 hover:border-emerald-300 hover:shadow-md transition-all"
                    @click="zoomedPhoto = url; zoomedIndex = i">
                    <img :src="url" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    <span class="absolute bottom-1 right-1 bg-black/50 text-white text-[9px] px-1.5 py-0.5 rounded font-medium">{{ i + 1 }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Resolution notes for resolved items -->
        <div v-if="afterSalesItems.some(i => i.resolution_notes)" class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 class="font-bold text-slate-700 text-sm mb-3">Resolution Notes</h3>
          <div class="space-y-2">
            <div v-for="item in afterSalesItems.filter(i => i.resolution_notes)" :key="'note-' + item.id"
              class="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
              <span class="font-mono text-xs text-slate-500 flex-shrink-0">{{ item.product_code }}</span>
              <p class="text-xs text-slate-600">{{ item.resolution_notes }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: Final Draft -->
      <div v-if="activeTab === 'final_draft'" class="mb-6">
        <FinalDraftTab :order-id="orderId" :order="order" />
      </div>

      <!-- Tab: Queries -->
      <div v-if="activeTab === 'queries'" class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <ClientQueriesTab :order-id="orderId" :order="order" />
      </div>

      <!-- Tab: Files -->
      <div v-if="activeTab === 'files'" class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <h2 class="font-bold text-slate-800 mb-4">Documents</h2>

        <div v-if="loadingDocs" class="py-8 text-center text-slate-400"><i class="pi pi-spinner pi-spin mr-2" /> Loading...</div>
        <div v-else-if="!documents.length" class="py-8 text-center text-slate-400 text-sm">
          <i class="pi pi-folder-open text-lg mb-2 block" />
          Documents will be shared here as your order progresses.
        </div>

        <div v-else class="space-y-2">
          <div v-for="doc in documents" :key="doc.id"
            class="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3 hover:bg-slate-100 transition-colors">
            <div class="flex items-center gap-3">
              <i class="pi pi-file text-slate-400 text-lg" />
              <div>
                <p class="text-sm font-medium text-slate-700">{{ doc.filename || doc.name || 'Document' }}</p>
                <p class="text-[10px] text-slate-400">
                  {{ doc.document_type || doc.type || 'File' }}
                  <span v-if="doc.uploaded_at"> &middot; {{ new Date(doc.uploaded_at).toLocaleDateString() }}</span>
                </p>
              </div>
            </div>
            <button @click="downloadDocument(doc)"
              class="px-3 py-1.5 bg-white text-emerald-600 border border-emerald-200 rounded-lg text-xs font-medium hover:bg-emerald-50 flex items-center gap-1.5">
              <i class="pi pi-download text-[10px]" /> Download
            </button>
          </div>
        </div>
      </div>

    </template>

      <!-- Tab: Landed Cost (Transparency clients only) -->
      <div v-if="activeTab === 'landed_cost'" class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
        <LandedCostTab :orderId="orderId" />
      </div>

  </div>

  <!-- Activity Log — fixed right sidebar card (desktop only) -->
  <div class="hidden xl:block fixed right-6 top-20 w-[300px] z-10">
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="px-5 py-3 border-b border-slate-100 bg-slate-50/80">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <i class="pi pi-clock text-slate-400 text-xs" />
            <h3 class="text-sm font-semibold text-slate-700">Activity Log</h3>
          </div>
          <span v-if="activityFeed.length" class="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">{{ activityFeed.length }}</span>
        </div>
      </div>
      <div v-if="activityFeed.length > 0" class="overflow-y-auto max-h-[60vh] divide-y divide-slate-50">
        <div v-for="(event, i) in activityFeed" :key="i"
          class="flex items-start gap-2.5 px-4 py-2.5 hover:bg-slate-50/50 transition-colors">
          <div class="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
            :class="{
              'bg-emerald-50 text-emerald-600': event.color === 'emerald',
              'bg-blue-50 text-blue-600': event.color === 'blue',
              'bg-amber-50 text-amber-600': event.color === 'amber',
              'bg-indigo-50 text-indigo-600': event.color === 'indigo',
              'bg-violet-50 text-violet-600': event.color === 'violet',
              'bg-orange-50 text-orange-600': event.color === 'orange',
              'bg-red-50 text-red-600': event.color === 'red',
              'bg-rose-50 text-rose-600': event.color === 'rose',
              'bg-slate-50 text-slate-500': !event.color || event.color === 'slate',
            }">
            <i :class="'pi ' + event.icon" class="text-[8px]" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[11px] text-slate-600 leading-snug">{{ event.message }}</p>
            <span v-if="event.timestamp" class="text-[9px] text-slate-300 mt-0.5 block">
              {{ new Date(event.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }}
              {{ new Date(event.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }}
            </span>
          </div>
        </div>
      </div>
      <div v-else class="px-4 py-8 text-center text-slate-300 text-xs">
        <i class="pi pi-clock text-lg mb-1" />
        <p>No activity yet</p>
      </div>
    </div>
  </div>

  <!-- Submit Payment Modal -->
  <div v-if="showPaymentModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showPaymentModal = false">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-emerald-50 rounded-t-xl">
        <div>
          <h3 class="text-lg font-semibold text-emerald-800 flex items-center gap-2">
            <i class="pi pi-wallet text-emerald-600" /> Submit Payment
          </h3>
          <p class="text-xs text-emerald-600 mt-0.5">Upload proof of payment for admin verification</p>
        </div>
        <button @click="showPaymentModal = false" class="text-slate-400 hover:text-slate-600"><i class="pi pi-times" /></button>
      </div>

      <!-- Form -->
      <div class="p-6 space-y-4">
        <!-- Payment Type -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Payment Type</label>
          <select v-model="paymentForm.payment_type" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400">
            <option value="CLIENT_ADVANCE">Advance Payment</option>
            <option value="CLIENT_BALANCE">Balance Payment</option>
          </select>
        </div>

        <!-- Amount -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Amount (INR)</label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">&#8377;</span>
            <input v-model="paymentForm.amount" type="number" step="0.01" min="0" placeholder="0.00"
              class="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400" />
          </div>
        </div>

        <!-- Payment Method -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
          <select v-model="paymentForm.method" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400">
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="UPI">UPI</option>
            <option value="CHEQUE">Cheque</option>
            <option value="CASH">Cash</option>
            <option value="LC">Letter of Credit</option>
          </select>
        </div>

        <!-- Transaction Reference -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Transaction Reference (UTR / Cheque No.)</label>
          <input v-model="paymentForm.reference" type="text" placeholder="Enter UTR, transaction ID, or cheque number"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400" />
        </div>

        <!-- Payment Date -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Payment Date</label>
          <input v-model="paymentForm.payment_date" type="date"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400" />
        </div>

        <!-- Proof File Upload -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Payment Proof <span class="text-red-500">*</span></label>
          <div class="border-2 border-dashed border-emerald-200 rounded-lg p-4 text-center hover:border-emerald-400 transition-colors cursor-pointer relative">
            <input type="file" accept=".jpg,.jpeg,.png,.pdf" @change="handleProofFile"
              class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <div v-if="!proofFile">
              <i class="pi pi-upload text-2xl text-emerald-400 mb-1" />
              <p class="text-sm text-slate-600">Drop file or click to browse</p>
              <p class="text-[10px] text-slate-400 mt-1">JPG, PNG, or PDF -- max 5MB</p>
            </div>
            <div v-else class="flex items-center justify-center gap-2">
              <i class="pi pi-check-circle text-emerald-500" />
              <span class="text-sm text-slate-700">{{ proofFile.name }}</span>
              <span class="text-xs text-slate-400">({{ (proofFile.size / 1024 / 1024).toFixed(1) }} MB)</span>
              <button @click.stop="proofFile = null" class="text-red-400 hover:text-red-600 ml-2"><i class="pi pi-times text-xs" /></button>
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Notes (optional)</label>
          <textarea v-model="paymentForm.notes" rows="2" placeholder="Any additional notes..."
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 resize-none"></textarea>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
        <button @click="showPaymentModal = false" class="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
        <button @click="submitPayment"
          :disabled="paymentSubmitting || !paymentForm.amount || !proofFile"
          class="px-5 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <i :class="paymentSubmitting ? 'pi pi-spin pi-spinner' : 'pi pi-check'" class="text-xs" />
          {{ paymentSubmitting ? 'Submitting...' : 'Submit Payment' }}
        </button>
      </div>
    </div>
  </div>
</template>
