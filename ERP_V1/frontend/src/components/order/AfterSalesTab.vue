<script setup>
import { ref, computed, onMounted } from 'vue'
import { afterSalesApi } from '../../api'
import { formatCurrency } from '../../utils/formatters'

const props = defineProps({
  orderId: { type: String, required: true },
  order: { type: Object, required: true },
})
const emit = defineEmits(['reload'])

// ========================================
// Constants
// ========================================
const resolutionsByIssue = {
  PRODUCT_MISMATCH: ['REPLACE_NEXT_ORDER', 'COMPENSATE_BALANCE'],
  PRODUCT_MISSING: ['REPLACE_NEXT_ORDER', 'COMPENSATE_BALANCE'],
  QUALITY_ISSUE: ['REPLACE_NEXT_ORDER', 'COMPENSATE_BALANCE', 'PARTIAL_COMPENSATE', 'PARTIAL_REPLACEMENT'],
  PRICE_MISMATCH: ['COMPENSATE_BALANCE'],
}

const issueLabels = {
  PRODUCT_MISMATCH: 'Product Mismatch',
  PRODUCT_MISSING: 'Product Missing',
  QUALITY_ISSUE: 'Quality Issue',
  PRICE_MISMATCH: 'Price Mismatch',
}

const resolutionLabels = {
  REPLACE_NEXT_ORDER: 'Replace (Next Order)',
  COMPENSATE_BALANCE: 'Compensate Balance',
  PARTIAL_COMPENSATE: 'Partial Compensate',
  PARTIAL_REPLACEMENT: 'Partial Replacement',
}

// ========================================
// State
// ========================================
const loading = ref(false)
const saving = ref(false)
const items = ref([])
const toast = ref('')

// Lightbox state
const lightbox = ref({ show: false, photos: [], index: 0, productName: '', item: null })

// ========================================
// Computed
// ========================================
// Physical vs balance split
const physicalItems = computed(() => items.value.filter(i => !i.is_balance_only))
const balanceItems = computed(() => items.value.filter(i => i.is_balance_only))

const totalItems = computed(() => physicalItems.value.length)
const issuesFlagged = computed(() => physicalItems.value.filter(i => i.objection_type).length)
const resolvedCount = computed(() => physicalItems.value.filter(i => i.objection_type && i.resolution_type && i.status === 'RESOLVED').length)
const pendingCarryForward = computed(() => physicalItems.value.filter(i => i.carry_forward_status === 'PENDING').length)

// Consolidated issue value computations
const hasComplaints = computed(() => physicalItems.value.some(i => i.objection_type))
const missingItems = computed(() => physicalItems.value.filter(i => i.objection_type === 'PRODUCT_MISSING'))
const mismatchItems = computed(() => physicalItems.value.filter(i => i.objection_type === 'PRODUCT_MISMATCH'))
const priceMismatchItems = computed(() => physicalItems.value.filter(i => i.objection_type === 'PRICE_MISMATCH'))
const qualityItems = computed(() => physicalItems.value.filter(i => i.objection_type === 'QUALITY_ISSUE'))

const missingValue = computed(() => missingItems.value.reduce((sum, i) => sum + (i.affected_quantity || 0) * (i.selling_price_inr || 0), 0))
const mismatchValue = computed(() => mismatchItems.value.reduce((sum, i) => sum + (i.affected_quantity || 0) * (i.selling_price_inr || 0), 0))
const priceValue = computed(() => priceMismatchItems.value.reduce((sum, i) => sum + (i.affected_quantity || 0) * (i.selling_price_inr || 0), 0))
const qualityValue = computed(() => qualityItems.value.reduce((sum, i) => sum + (i.affected_quantity || 0) * (i.selling_price_inr || 0), 0))
const totalClaimValue = computed(() => missingValue.value + mismatchValue.value + priceValue.value + qualityValue.value)

// Flagged items grouped by issue type (for the issues summary table)
const issueTypeOrder = ['PRODUCT_MISSING', 'PRODUCT_MISMATCH', 'PRICE_MISMATCH', 'QUALITY_ISSUE']
const flaggedItems = computed(() => {
  const flagged = physicalItems.value.filter(i => i.objection_type)
  // Sort by issue type priority
  return flagged.sort((a, b) => issueTypeOrder.indexOf(a.objection_type) - issueTypeOrder.indexOf(b.objection_type))
})

function getItemTypeBadge(itemType) {
  switch (itemType) {
    case 'carried_forward':
      return { bg: 'bg-amber-100', text: 'text-amber-700', icon: 'pi pi-replay', label: 'Carried Fwd' }
    case 'aftersales_replacement':
      return { bg: 'bg-teal-100', text: 'text-teal-700', icon: 'pi pi-sync', label: 'Replacement' }
    default:
      return null
  }
}

// formatCurrency imported from utils/formatters

function getIssueRowStyle(type) {
  const styles = {
    PRODUCT_MISSING: 'bg-red-50 border-red-100',
    PRODUCT_MISMATCH: 'bg-orange-50 border-orange-100',
    PRICE_MISMATCH: 'bg-amber-50 border-amber-100',
    QUALITY_ISSUE: 'bg-blue-50 border-blue-100',
  }
  return styles[type] || ''
}

function getIssueBadgeStyle(type) {
  const styles = {
    PRODUCT_MISSING: 'bg-red-100 text-red-700',
    PRODUCT_MISMATCH: 'bg-orange-100 text-orange-700',
    PRICE_MISMATCH: 'bg-amber-100 text-amber-700',
    QUALITY_ISSUE: 'bg-blue-100 text-blue-700',
  }
  return styles[type] || 'bg-slate-100 text-slate-700'
}

// ========================================
// Functions
// ========================================
function getPhotoUrl(filename) {
  return `/api/aftersales/orders/${props.orderId}/photos/${filename}`
}

function isVideo(filename) {
  return /\.(mp4|webm|mov|avi)$/i.test(filename)
}

function openLightbox(item, index = 0) {
  const photos = item.photos || []
  if (photos.length === 0) return
  lightbox.value = { show: true, photos, index, productName: item.product_name || item.product_code, item }
}

function closeLightbox() {
  lightbox.value.show = false
}

function prevPhoto() {
  if (lightbox.value.index > 0) lightbox.value.index--
}

function nextPhoto() {
  if (lightbox.value.index < lightbox.value.photos.length - 1) lightbox.value.index++
}

async function deletePhoto(item, filename) {
  if (!confirm('Delete this photo?')) return
  try {
    const res = await afterSalesApi.deletePhoto(props.orderId, item.id, filename)
    item.photos = res.data?.photos || item.photos.filter(p => p !== filename)
    showToast('Photo deleted')

    if (lightbox.value.show && lightbox.value.item?.id === item.id) {
      lightbox.value.photos = item.photos
      if (item.photos.length === 0) {
        closeLightbox()
      } else if (lightbox.value.index >= item.photos.length) {
        lightbox.value.index = item.photos.length - 1
      }
    }
  } catch (err) {
    console.error('Failed to delete photo:', err)
    alert(err.response?.data?.detail || 'Delete failed')
  }
}

async function loadItems() {
  loading.value = true
  try {
    const res = await afterSalesApi.getForOrder(props.orderId)
    items.value = (res.data?.items || res.data || []).map(item => ({
      ...item,
      received_qty: item.received_qty ?? item.sent_qty,
      objection_type: item.objection_type || '',
      description: item.description || '',
      resolution_type: item.resolution_type || '',
      affected_quantity: item.affected_quantity ?? null,
      compensation_amount: item.compensation_amount ?? null,
      photos: item.photos || [],
      status: item.status || 'OPEN',
      resolution_notes: item.resolution_notes || '',
    }))
  } catch (err) {
    console.error('Failed to load after-sales items:', err)
  } finally {
    loading.value = false
  }
}

function onIssueTypeChange(item) {
  if (!item.objection_type) {
    item.description = ''
    item.resolution_type = ''
    item.affected_quantity = null
  } else {
    item.resolution_type = ''
    // Auto-set claim qty for missing items
    if (item.objection_type === 'PRODUCT_MISSING') {
      item.affected_quantity = Math.max(0, item.sent_qty - item.received_qty)
    }
  }
}

function onReceivedQtyChange(item) {
  // For missing items, auto-calculate claim qty
  if (item.objection_type === 'PRODUCT_MISSING') {
    item.affected_quantity = Math.max(0, item.sent_qty - item.received_qty)
  }
}

function getAvailableResolutions(issueType) {
  return resolutionsByIssue[issueType] || []
}

const savingItemId = ref(null)
const savedItemIds = ref(new Set())

async function saveResolution(item) {
  if (!item.resolution_type) return
  savingItemId.value = item.id
  try {
    const payload = {
      resolution_type: item.resolution_type,
      resolution_notes: item.resolution_notes || '',
      affected_quantity: item.affected_quantity || 0,
      compensation_amount: item.compensation_amount || null,
    }
    await afterSalesApi.resolveItem(props.orderId, item.id, payload)
    item.status = 'RESOLVED'
    // Show saved tick for 2 seconds
    const s = new Set(savedItemIds.value)
    s.add(item.id)
    savedItemIds.value = s
    setTimeout(() => {
      const s2 = new Set(savedItemIds.value)
      s2.delete(item.id)
      savedItemIds.value = s2
    }, 2000)
    emit('reload')
  } catch (err) {
    console.error('Failed to save resolution:', err)
    alert(err.response?.data?.detail || 'Failed to save resolution')
  } finally {
    savingItemId.value = null
  }
}

function isPartialResolution(type) {
  return type === 'PARTIAL_COMPENSATE' || type === 'PARTIAL_REPLACEMENT'
}

function onResolutionChange(item) {
  // Auto-set compensation amount for full compensate
  if (item.resolution_type === 'COMPENSATE_BALANCE') {
    item.compensation_amount = (item.selling_price_inr || 0) * (item.affected_quantity || 0)
  } else if (item.resolution_type === 'REPLACE_NEXT_ORDER') {
    item.compensation_amount = null
  } else if (isPartialResolution(item.resolution_type)) {
    // For partial, let user enter the amount/qty
    if (!item.affected_quantity) item.affected_quantity = 0
    item.compensation_amount = null
  }
}

function getRowClass(item) {
  if (!item.objection_type) return ''
  if (item.objection_type && item.resolution_type) return 'bg-green-50'
  if (item.objection_type) return 'bg-red-50'
  return ''
}

// Derive display status from the data
function getDisplayStatus(item) {
  // No issue = OK
  if (!item.objection_type) return { label: 'OK', class: 'bg-slate-100 text-slate-500' }

  // Server-confirmed carry-forward states (highest priority)
  if (item.carry_forward_status === 'FULFILLED') return { label: 'Fulfilled', class: 'bg-green-100 text-green-700' }
  if (item.carry_forward_status === 'ADDED_TO_ORDER') return { label: 'Added to Order', class: 'bg-blue-100 text-blue-700' }
  if (item.carry_forward_status === 'PENDING') return { label: 'Carry Forward', class: 'bg-amber-100 text-amber-700' }

  // Server confirmed resolved (only if issue+resolution were already saved)
  if (item.status === 'RESOLVED' && item.objection_type && item.resolution_type) {
    return { label: 'Resolved', class: 'bg-green-100 text-green-700' }
  }

  // User has filled issue + resolution but NOT yet saved
  if (item.objection_type && item.resolution_type) {
    return { label: 'Save to confirm', class: 'bg-yellow-100 text-yellow-700' }
  }

  // Issue flagged but no resolution yet
  return { label: 'Flagged', class: 'bg-red-100 text-red-700' }
}

// Claim qty helper text
function getClaimHint(item) {
  if (item.objection_type === 'PRODUCT_MISSING') return 'Auto: sent - received'
  if (item.objection_type === 'QUALITY_ISSUE') return 'How many damaged?'
  if (item.objection_type === 'PRODUCT_MISMATCH') return 'How many wrong?'
  if (item.objection_type === 'PRICE_MISMATCH') return 'Qty at wrong price'
  return ''
}

function triggerFileInput(itemId) {
  const input = document.getElementById(`photo-input-${itemId}`)
  if (input) input.click()
}

async function handlePhotoUpload(event, item) {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const res = await afterSalesApi.uploadPhoto(props.orderId, item.id, file)
    if (res.data?.photos) {
      item.photos = res.data.photos
    } else {
      item.photos = [...(item.photos || []), file.name]
    }
    showToast('Photo uploaded successfully')
  } catch (err) {
    console.error('Failed to upload photo:', err)
    alert(err.response?.data?.detail || 'Photo upload failed')
  } finally {
    event.target.value = ''
  }
}

async function downloadExcel() {
  try {
    const { data } = await afterSalesApi.downloadExcel(props.orderId)
    const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `AfterSales_${props.order?.order_number || props.orderId}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Download after-sales Excel failed:', err)
  }
}

async function saveAll() {
  saving.value = true
  try {
    const payload = physicalItems.value.map(item => ({
      id: item.id,
      received_qty: item.received_qty,
      objection_type: item.objection_type || null,
      description: item.description || null,
      resolution_type: item.resolution_type || null,
      affected_quantity: item.affected_quantity || null,
      compensation_amount: item.compensation_amount || null,
      resolution_notes: item.resolution_notes || null,
    }))
    await afterSalesApi.saveForOrder(props.orderId, payload)
    showToast('After-sales data saved successfully')
    await loadItems() // Reload to get updated statuses from server
    emit('reload')
  } catch (err) {
    console.error('Failed to save after-sales data:', err)
    alert(err.response?.data?.detail || 'Save failed')
  } finally {
    saving.value = false
  }
}

function showToast(message) {
  toast.value = message
  setTimeout(() => { toast.value = '' }, 4000)
}

// ========================================
// Lifecycle
// ========================================
onMounted(() => {
  loadItems()
})
</script>

<template>
  <div class="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200 mb-6">
    <!-- Header -->
    <div class="px-6 py-4 border-b border-slate-200 bg-slate-50">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <i class="pi pi-check-square text-emerald-600" /> After-Sales Review
          </h3>
          <p class="text-xs text-slate-500 mt-0.5">Verify received quantities, flag issues, and track resolutions</p>
        </div>
        <button
          v-if="hasComplaints"
          @click="downloadExcel"
          class="px-4 py-2 text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors flex items-center gap-2"
        >
          <i class="pi pi-file-excel text-xs" />
          Export Report
        </button>
      </div>
    </div>

    <div class="p-6">
      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <i class="pi pi-spin pi-spinner text-2xl text-slate-400" />
      </div>

      <template v-else>
        <!-- Consolidated Issue Value Cards (only when complaints exist) -->
        <div v-if="hasComplaints" class="mb-5 grid grid-cols-2 md:grid-cols-5 gap-3">
          <!-- Missing Value -->
          <div v-if="missingItems.length > 0" class="rounded-xl border border-red-200 bg-red-50 p-3">
            <div class="flex items-center gap-2 mb-1">
              <div class="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center">
                <i class="pi pi-box text-red-600 text-xs" />
              </div>
              <span class="text-xs font-medium text-red-700">Missing</span>
            </div>
            <p class="text-lg font-bold text-red-800">{{ formatCurrency(missingValue) }}</p>
            <p class="text-[10px] text-red-500 mt-0.5">{{ missingItems.length }} item{{ missingItems.length > 1 ? 's' : '' }}</p>
          </div>
          <!-- Mismatch Value -->
          <div v-if="mismatchItems.length > 0" class="rounded-xl border border-orange-200 bg-orange-50 p-3">
            <div class="flex items-center gap-2 mb-1">
              <div class="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
                <i class="pi pi-exclamation-triangle text-orange-600 text-xs" />
              </div>
              <span class="text-xs font-medium text-orange-700">Mismatch</span>
            </div>
            <p class="text-lg font-bold text-orange-800">{{ formatCurrency(mismatchValue) }}</p>
            <p class="text-[10px] text-orange-500 mt-0.5">{{ mismatchItems.length }} item{{ mismatchItems.length > 1 ? 's' : '' }}</p>
          </div>
          <!-- Price Issue Value -->
          <div v-if="priceMismatchItems.length > 0" class="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div class="flex items-center gap-2 mb-1">
              <div class="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                <i class="pi pi-money-bill text-amber-600 text-xs" />
              </div>
              <span class="text-xs font-medium text-amber-700">Price Issue</span>
            </div>
            <p class="text-lg font-bold text-amber-800">{{ formatCurrency(priceValue) }}</p>
            <p class="text-[10px] text-amber-500 mt-0.5">{{ priceMismatchItems.length }} item{{ priceMismatchItems.length > 1 ? 's' : '' }}</p>
          </div>
          <!-- Quality Issue Value -->
          <div v-if="qualityItems.length > 0" class="rounded-xl border border-blue-200 bg-blue-50 p-3">
            <div class="flex items-center gap-2 mb-1">
              <div class="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <i class="pi pi-search text-blue-600 text-xs" />
              </div>
              <span class="text-xs font-medium text-blue-700">Quality</span>
            </div>
            <p class="text-lg font-bold text-blue-800">{{ formatCurrency(qualityValue) }}</p>
            <p class="text-[10px] text-blue-500 mt-0.5">{{ qualityItems.length }} item{{ qualityItems.length > 1 ? 's' : '' }}</p>
          </div>
          <!-- Total Claim Value -->
          <div class="rounded-xl border border-rose-300 bg-rose-50 p-3">
            <div class="flex items-center gap-2 mb-1">
              <div class="w-7 h-7 rounded-lg bg-rose-200 flex items-center justify-center">
                <i class="pi pi-calculator text-rose-700 text-xs" />
              </div>
              <span class="text-xs font-medium text-rose-700">Total Claim</span>
            </div>
            <p class="text-xl font-bold text-rose-800">{{ formatCurrency(totalClaimValue) }}</p>
            <p class="text-[10px] text-rose-500 mt-0.5">{{ issuesFlagged }} total issue{{ issuesFlagged > 1 ? 's' : '' }}</p>
          </div>
        </div>

        <!-- Summary Bar -->
        <div v-if="physicalItems.length > 0" class="mb-5 flex items-center gap-6 text-sm">
          <div class="flex items-center gap-1.5">
            <span class="text-slate-500">Total items:</span>
            <span class="font-semibold text-slate-800">{{ totalItems }}</span>
            <span v-if="balanceItems.length > 0" class="text-xs text-indigo-500 font-medium">+ {{ balanceItems.length }} balance</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-slate-500">Issues flagged:</span>
            <span class="font-semibold" :class="issuesFlagged > 0 ? 'text-red-600' : 'text-slate-800'">{{ issuesFlagged }}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-slate-500">Resolved:</span>
            <span class="font-semibold text-green-600">{{ resolvedCount }}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-slate-500">Pending carry-forward:</span>
            <span class="font-semibold" :class="pendingCarryForward > 0 ? 'text-amber-600' : 'text-slate-800'">{{ pendingCarryForward }}</span>
          </div>
        </div>

        <!-- Success toast -->
        <div v-if="toast" class="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-800">
          <i class="pi pi-check-circle text-green-600" />
          <span class="font-medium">{{ toast }}</span>
        </div>

        <!-- Table -->
        <div v-if="physicalItems.length > 0" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 z-10">
              <tr class="bg-slate-50 border-b border-slate-200">
                <th class="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Product Code</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Product Name</th>
                <th class="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase">Type</th>
                <th class="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase">Sent Qty</th>
                <th class="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase">Received Qty</th>
                <th class="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase">Issue Type</th>
                <th class="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase">Explain</th>
                <th class="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase">Resolution</th>
                <th class="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase">
                  <span title="How many units to claim in next order">Claim Qty</span>
                </th>
                <th class="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase">Evidence</th>
                <th class="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="item in physicalItems" :key="item.id"
                  :class="[getRowClass(item), 'hover:bg-slate-50/50 transition-colors']">
                <!-- Product Code -->
                <td class="px-3 py-2 font-mono text-xs text-slate-700 whitespace-nowrap">{{ item.product_code }}</td>

                <!-- Product Name -->
                <td class="px-3 py-2 text-xs text-slate-600 max-w-[180px] truncate">{{ item.product_name }}</td>

                <!-- Type -->
                <td class="px-3 py-2 text-center">
                  <span v-if="getItemTypeBadge(item.item_type)"
                    :class="['inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium', getItemTypeBadge(item.item_type).bg, getItemTypeBadge(item.item_type).text]">
                    <i :class="[getItemTypeBadge(item.item_type).icon, 'text-[9px]']" />
                    {{ getItemTypeBadge(item.item_type).label }}
                  </span>
                  <span v-else class="text-slate-300">&mdash;</span>
                </td>

                <!-- Sent Qty -->
                <td class="px-3 py-2 text-right font-medium text-slate-700">{{ item.sent_qty }}</td>

                <!-- Received Qty (editable) -->
                <td class="px-3 py-2 text-center">
                  <input
                    v-model.number="item.received_qty"
                    type="number"
                    min="0"
                    :max="item.sent_qty"
                    @change="onReceivedQtyChange(item)"
                    class="w-20 text-center text-sm px-2 py-1.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    :class="item.received_qty < item.sent_qty ? 'border-red-300 bg-red-50 text-red-700 font-semibold' : 'border-slate-200'"
                  />
                </td>

                <!-- Issue Type -->
                <td class="px-3 py-2 text-center">
                  <select
                    v-model="item.objection_type"
                    @change="onIssueTypeChange(item)"
                    class="text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  >
                    <option value="">--</option>
                    <option v-for="(label, key) in issueLabels" :key="key" :value="key">{{ label }}</option>
                  </select>
                </td>

                <!-- Explain (shown when issue selected) -->
                <td class="px-3 py-2 text-center">
                  <input
                    v-if="item.objection_type"
                    v-model="item.description"
                    type="text"
                    placeholder="Describe issue..."
                    class="w-36 text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                  <span v-else class="text-slate-300">&mdash;</span>
                </td>

                <!-- Resolution + Save -->
                <td class="px-3 py-2 text-center">
                  <template v-if="item.objection_type">
                    <div class="flex flex-col items-center gap-1">
                      <div class="flex items-center gap-1">
                        <select
                          v-model="item.resolution_type"
                          @change="onResolutionChange(item)"
                          class="text-xs px-2 py-1.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          :class="item.resolution_type ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'"
                        >
                          <option value="">--</option>
                          <option
                            v-for="res in getAvailableResolutions(item.objection_type)"
                            :key="res"
                            :value="res"
                          >{{ resolutionLabels[res] }}</option>
                        </select>
                        <!-- Save button -->
                        <button v-if="item.resolution_type"
                          @click="saveResolution(item)"
                          :disabled="savingItemId === item.id"
                          class="w-7 h-7 rounded-full flex items-center justify-center transition-all"
                          :class="savedItemIds.has(item.id)
                            ? 'bg-emerald-500 text-white'
                            : savingItemId === item.id
                              ? 'bg-slate-100 text-slate-400'
                              : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'"
                          :title="savedItemIds.has(item.id) ? 'Saved!' : 'Save resolution'">
                          <i :class="savedItemIds.has(item.id)
                            ? 'pi pi-check text-[10px]'
                            : savingItemId === item.id
                              ? 'pi pi-spinner pi-spin text-[10px]'
                              : 'pi pi-check text-[10px]'" />
                        </button>
                      </div>
                      <!-- Partial qty/amount inputs -->
                      <div v-if="isPartialResolution(item.resolution_type)" class="flex flex-col gap-1 mt-1">
                        <div class="flex items-center gap-1">
                          <label class="text-[9px] text-slate-400 w-8">Qty:</label>
                          <input v-model.number="item.affected_quantity" type="number" min="0" :max="item.sent_qty"
                            class="w-14 text-[10px] text-center border border-amber-300 rounded px-1 py-0.5 bg-amber-50" />
                        </div>
                        <div v-if="item.resolution_type === 'PARTIAL_COMPENSATE'" class="flex items-center gap-1">
                          <label class="text-[9px] text-slate-400 w-8">₹:</label>
                          <input v-model.number="item.compensation_amount" type="number" min="0" step="0.01"
                            class="w-14 text-[10px] text-center border border-amber-300 rounded px-1 py-0.5 bg-amber-50"
                            :placeholder="((item.selling_price_inr || 0) * (item.affected_quantity || 0)).toFixed(0)" />
                        </div>
                      </div>
                    </div>
                  </template>
                  <span v-else class="text-slate-300">&mdash;</span>
                </td>

                <!-- Claim Qty -->
                <td class="px-3 py-2 text-center">
                  <template v-if="item.objection_type">
                    <div>
                      <input
                        v-model.number="item.affected_quantity"
                        type="number"
                        min="0"
                        :max="item.sent_qty"
                        :placeholder="getClaimHint(item)"
                        class="w-20 text-center text-sm px-2 py-1.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        :class="item.affected_quantity > 0 ? 'border-red-300 bg-red-50 text-red-700 font-semibold' : 'border-slate-200'"
                      />
                      <p class="text-[10px] text-slate-400 mt-0.5">{{ getClaimHint(item) }}</p>
                    </div>
                  </template>
                  <span v-else class="text-slate-300">&mdash;</span>
                </td>

                <!-- Evidence (Photos) -->
                <td class="px-3 py-2 text-center">
                  <div class="flex items-center justify-center gap-1.5">
                    <!-- Thumbnail previews -->
                    <div v-if="item.photos && item.photos.length > 0" class="flex items-center gap-1">
                      <div
                        v-for="(photo, pIdx) in item.photos.slice(0, 3)"
                        :key="photo"
                        class="relative group"
                      >
                        <button
                          @click="openLightbox(item, pIdx)"
                          class="w-8 h-8 rounded border border-slate-200 overflow-hidden hover:ring-2 hover:ring-emerald-400 transition-all cursor-pointer"
                          title="Click to view"
                        >
                          <img
                            v-if="!isVideo(photo)"
                            :src="getPhotoUrl(photo)"
                            class="w-full h-full object-cover"
                            @error="$event.target.src = ''"
                          />
                          <div v-else class="w-full h-full bg-slate-200 flex items-center justify-center">
                            <i class="pi pi-video text-[10px] text-slate-500" />
                          </div>
                        </button>
                        <!-- Delete x on hover -->
                        <button
                          @click.stop="deletePhoto(item, photo)"
                          class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"
                          title="Delete photo"
                        >&#10005;</button>
                      </div>
                      <!-- +N more badge -->
                      <button
                        v-if="item.photos.length > 3"
                        @click="openLightbox(item, 3)"
                        class="w-8 h-8 rounded border border-slate-200 bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
                      >+{{ item.photos.length - 3 }}</button>
                    </div>

                    <!-- Upload button -->
                    <button
                      @click="triggerFileInput(item.id)"
                      class="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors"
                      title="Upload photo or video as evidence"
                    >
                      <i class="pi pi-camera text-[10px]" />
                      <span v-if="!item.photos || item.photos.length === 0">Upload</span>
                      <i v-else class="pi pi-plus text-[10px]" />
                    </button>
                    <input
                      :id="'photo-input-' + item.id"
                      type="file"
                      accept="image/*,video/*"
                      class="hidden"
                      @change="handlePhotoUpload($event, item)"
                    />
                  </div>
                </td>

                <!-- Status (auto-derived) -->
                <td class="px-3 py-2 text-center">
                  <span
                    :class="['inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap', getDisplayStatus(item).class]"
                  >{{ getDisplayStatus(item).label }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- ═══ BALANCE ADJUSTMENTS (compensation items) ═══ -->
        <div v-if="balanceItems.length > 0" class="mt-4">
          <h4 class="text-xs font-semibold text-indigo-700 uppercase tracking-wider flex items-center gap-2 mb-2">
            <i class="pi pi-wallet text-indigo-500" />
            Balance Adjustments ({{ balanceItems.length }})
            <span class="text-[10px] font-normal text-indigo-400 normal-case">Read-only — ledger reference only, not physical items</span>
          </h4>
          <div class="overflow-x-auto border border-indigo-200 rounded-lg bg-indigo-50/30">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-indigo-50 border-b border-indigo-200">
                  <th class="px-3 py-2 text-left text-xs font-semibold text-indigo-700 uppercase">Part Code</th>
                  <th class="px-3 py-2 text-left text-xs font-semibold text-indigo-700 uppercase">Name</th>
                  <th class="px-3 py-2 text-center text-xs font-semibold text-indigo-700 uppercase">Qty</th>
                  <th class="px-3 py-2 text-right text-xs font-semibold text-indigo-700 uppercase">Balance</th>
                  <th class="px-3 py-2 text-center text-xs font-semibold text-indigo-700 uppercase">Type</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-indigo-100">
                <tr v-for="item in balanceItems" :key="'bal-' + item.id" class="bg-indigo-50/50">
                  <td class="px-3 py-2 font-mono text-xs text-indigo-600">{{ item.product_code }}</td>
                  <td class="px-3 py-2 text-xs text-slate-600">{{ item.product_name }}</td>
                  <td class="px-3 py-2 text-center text-xs text-slate-700 font-medium">{{ item.sent_qty }}</td>
                  <td class="px-3 py-2 text-right text-xs font-semibold text-red-600">
                    {{ item.selling_price_inr != null
                      ? (item.selling_price_inr * item.sent_qty).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
                      : '—' }}
                  </td>
                  <td class="px-3 py-2 text-center">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700">
                      <i class="pi pi-lock text-[8px]" /> Compensation
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ═══ ISSUED PARTS SUMMARY TABLE (like migrated items) ═══ -->
        <div v-if="flaggedItems.length > 0" class="mt-8">
          <div class="rounded-xl border border-rose-200 overflow-hidden">
            <!-- Section header -->
            <div class="px-4 py-3 bg-rose-600 text-white flex items-center justify-between">
              <div class="flex items-center gap-2">
                <i class="pi pi-exclamation-triangle text-sm" />
                <span class="text-sm font-semibold uppercase tracking-wider">Issued Parts &amp; Resolutions ({{ flaggedItems.length }})</span>
              </div>
              <span class="text-xs text-rose-200">Total Claim: {{ formatCurrency(totalClaimValue) }}</span>
            </div>
            <!-- Table -->
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="bg-rose-50 border-b border-rose-200">
                    <th class="px-3 py-2 text-left text-xs font-semibold text-rose-700 uppercase">#</th>
                    <th class="px-3 py-2 text-left text-xs font-semibold text-rose-700 uppercase">Part Code</th>
                    <th class="px-3 py-2 text-left text-xs font-semibold text-rose-700 uppercase">Product Name</th>
                    <th class="px-3 py-2 text-center text-xs font-semibold text-rose-700 uppercase">Issue</th>
                    <th class="px-3 py-2 text-left text-xs font-semibold text-rose-700 uppercase">Explain</th>
                    <th class="px-3 py-2 text-center text-xs font-semibold text-rose-700 uppercase">Sent</th>
                    <th class="px-3 py-2 text-center text-xs font-semibold text-rose-700 uppercase">Received</th>
                    <th class="px-3 py-2 text-center text-xs font-semibold text-rose-700 uppercase">Claim Qty</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-rose-700 uppercase">Claim Value</th>
                    <th class="px-3 py-2 text-center text-xs font-semibold text-rose-700 uppercase">Resolution</th>
                    <th class="px-3 py-2 text-left text-xs font-semibold text-rose-700 uppercase">Notes</th>
                    <th class="px-3 py-2 text-center text-xs font-semibold text-rose-700 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-rose-100">
                  <tr v-for="(item, idx) in flaggedItems" :key="'issue-' + item.id"
                      :class="getIssueRowStyle(item.objection_type)">
                    <td class="px-3 py-2 text-xs text-slate-500">{{ idx + 1 }}</td>
                    <td class="px-3 py-2 font-mono text-xs text-slate-700 whitespace-nowrap">{{ item.product_code }}</td>
                    <td class="px-3 py-2 text-xs text-slate-600 max-w-[160px] truncate">{{ item.product_name }}</td>
                    <td class="px-3 py-2 text-center">
                      <span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap', getIssueBadgeStyle(item.objection_type)]">
                        {{ issueLabels[item.objection_type] }}
                      </span>
                    </td>
                    <td class="px-3 py-2 text-xs text-slate-600 max-w-[180px] truncate">{{ item.description || '—' }}</td>
                    <td class="px-3 py-2 text-center text-xs text-slate-700">{{ item.sent_qty }}</td>
                    <td class="px-3 py-2 text-center text-xs font-semibold" :class="item.received_qty < item.sent_qty ? 'text-red-600' : 'text-slate-700'">{{ item.received_qty }}</td>
                    <td class="px-3 py-2 text-center text-xs font-bold text-red-700">{{ item.affected_quantity || 0 }}</td>
                    <td class="px-3 py-2 text-right text-xs font-semibold text-slate-800">{{ formatCurrency((item.affected_quantity || 0) * (item.selling_price_inr || 0)) }}</td>
                    <td class="px-3 py-2 text-center text-xs text-slate-600">{{ item.resolution_type ? resolutionLabels[item.resolution_type] : '—' }}</td>
                    <td class="px-3 py-2">
                      <input
                        v-model="item.resolution_notes"
                        type="text"
                        placeholder="Add note..."
                        class="w-36 text-xs px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-400 focus:border-rose-400 outline-none bg-white"
                      />
                    </td>
                    <td class="px-3 py-2 text-center">
                      <span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap', getDisplayStatus(item).class]">
                        {{ getDisplayStatus(item).label }}
                      </span>
                    </td>
                  </tr>
                </tbody>
                <!-- Totals row -->
                <tfoot>
                  <tr class="bg-rose-100 border-t-2 border-rose-300">
                    <td colspan="7" class="px-3 py-2 text-right text-xs font-bold text-rose-800 uppercase">Total Claim</td>
                    <td class="px-3 py-2 text-center text-xs font-bold text-rose-800">{{ flaggedItems.reduce((s, i) => s + (i.affected_quantity || 0), 0) }}</td>
                    <td class="px-3 py-2 text-right text-sm font-bold text-rose-800">{{ formatCurrency(totalClaimValue) }}</td>
                    <td colspan="3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="!loading && physicalItems.length === 0 && balanceItems.length === 0" class="text-center py-12 text-slate-400">
          <i class="pi pi-box text-3xl mb-2" />
          <p class="text-sm">No shipped items found for after-sales review</p>
        </div>

        <!-- Save button -->
        <div v-if="physicalItems.length > 0" class="mt-6 flex justify-end">
          <button
            @click="saveAll"
            :disabled="saving"
            class="px-6 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <i v-if="saving" class="pi pi-spin pi-spinner text-xs" />
            <i v-else class="pi pi-save text-xs" />
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </template>
    </div>
  </div>

  <!-- ===== LIGHTBOX MODAL ===== -->
  <Teleport to="body">
    <div
      v-if="lightbox.show"
      class="fixed inset-0 z-[9999] flex items-center justify-center"
      @keydown.escape="closeLightbox"
      @keydown.left="prevPhoto"
      @keydown.right="nextPhoto"
      tabindex="0"
      ref="lightboxEl"
    >
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="closeLightbox" />

      <!-- Content -->
      <div class="relative z-10 max-w-4xl w-full mx-4">
        <!-- Header -->
        <div class="flex items-center justify-between mb-3">
          <div class="text-white">
            <h4 class="text-sm font-semibold">{{ lightbox.productName }}</h4>
            <p class="text-xs text-white/60">Photo {{ lightbox.index + 1 }} of {{ lightbox.photos.length }}</p>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="deletePhoto(lightbox.item, lightbox.photos[lightbox.index])"
              class="h-9 px-3 rounded-full bg-red-500/80 hover:bg-red-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
              title="Delete this photo"
            >
              <i class="pi pi-trash text-xs" /> Delete
            </button>
            <button
              @click="closeLightbox"
              class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
            >
              <i class="pi pi-times text-lg" />
            </button>
          </div>
        </div>

        <!-- Image/Video -->
        <div class="relative bg-black/50 rounded-xl overflow-hidden flex items-center justify-center min-h-[400px]">
          <!-- Navigation arrows -->
          <button
            v-if="lightbox.index > 0"
            @click.stop="prevPhoto"
            class="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors z-20"
          >
            <i class="pi pi-chevron-left" />
          </button>
          <button
            v-if="lightbox.index < lightbox.photos.length - 1"
            @click.stop="nextPhoto"
            class="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-colors z-20"
          >
            <i class="pi pi-chevron-right" />
          </button>

          <!-- Image -->
          <img
            v-if="!isVideo(lightbox.photos[lightbox.index])"
            :src="getPhotoUrl(lightbox.photos[lightbox.index])"
            class="max-h-[70vh] max-w-full object-contain"
            @error="$event.target.alt = 'Failed to load image'"
          />
          <!-- Video -->
          <video
            v-else
            :src="getPhotoUrl(lightbox.photos[lightbox.index])"
            controls
            class="max-h-[70vh] max-w-full"
          />
        </div>

        <!-- Thumbnail strip -->
        <div v-if="lightbox.photos.length > 1" class="mt-3 flex items-center justify-center gap-2">
          <button
            v-for="(photo, pIdx) in lightbox.photos"
            :key="photo"
            @click="lightbox.index = pIdx"
            :class="[
              'w-12 h-12 rounded-lg border-2 overflow-hidden transition-all',
              pIdx === lightbox.index ? 'border-emerald-400 ring-2 ring-emerald-400/50' : 'border-white/20 hover:border-white/50'
            ]"
          >
            <img
              v-if="!isVideo(photo)"
              :src="getPhotoUrl(photo)"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full bg-slate-700 flex items-center justify-center">
              <i class="pi pi-video text-white text-xs" />
            </div>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
