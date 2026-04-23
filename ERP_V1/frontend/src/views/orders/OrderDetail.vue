<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ordersApi, documentsApi, factoriesApi, queriesApi } from '../../api'
import OrderItemsTab from '../../components/order/OrderItemsTab.vue'
import PaymentsTab from '../../components/order/PaymentsTab.vue'
import ProductionTab from '../../components/order/ProductionTab.vue'
import PackingListTab from '../../components/order/PackingListTab.vue'
import FilesTab from '../../components/order/FilesTab.vue'
import QueriesTabInline from '../../components/order/QueriesTab.vue'
import BookingTab from '../../components/order/BookingTab.vue'
import SailingTab from '../../components/order/SailingTab.vue'
import ShippingDocsTab from '../../components/order/ShippingDocsTab.vue'
import CustomsTab from '../../components/order/CustomsTab.vue'
import AfterSalesTab from '../../components/order/AfterSalesTab.vue'
import FinalDraftTab from '../../components/order/FinalDraftTab.vue'
import OrderDashboardTab from '../../components/order/OrderDashboardTab.vue'
import LandedCostTab from '../../components/order/LandedCostTab.vue'
import { useAuth } from '../../composables/useAuth'

const { isSuperAdmin, isAdmin, isFinance, user } = useAuth()
const route = useRoute()
const router = useRouter()
const orderId = route.params.id

// ========================================
// Tab system
// ========================================
const activeTab = ref(route.query.tab || null) // set after order loads

// State
const order = ref(null)
const timeline = ref(null)
const nextStages = ref([])
const documents = ref([])
const loading = ref(true)
const transitioning = ref(false)
const showDeleteConfirm = ref(false)
const showReopenModal = ref(false)
const reopenReason = ref('')
const transitionError = ref('')
const highlightSection = ref(null) // passed to tabs for flash animation
const prevStage = ref(null)
const showOverrides = ref(false)
const showTransitionConfirm = ref(false)
const pendingTransition = ref(null)
const showGoBackConfirm = ref(false)
const showWarningModal = ref(false)
const transitionWarnings = ref([])
const transitionReason = ref('')
const showJumpConfirm = ref(false)
const jumpTarget = ref(null)
const reachablePrevious = ref([])
const reachableForward = ref([])
const carriedAlert = ref(null)

// Stage color mapping
const stageStyles = {
  1: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  2: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  3: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  4: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
  5: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  6: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  7: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  8: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  9: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  10: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  11: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  12: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300' },
  13: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-300' },
  14: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-300' },
  15: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  16: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300' },
  17: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300' },
}

function getStyle(stage) {
  return stageStyles[stage] || stageStyles[1]
}

// Map stage numbers to their override records
const overridesByStage = computed(() => {
  const map = {}
  if (timeline.value?.overrides) {
    for (const ov of timeline.value.overrides) {
      if (!map[ov.to_stage_number]) map[ov.to_stage_number] = []
      map[ov.to_stage_number].push(ov)
    }
  }
  return map
})

// Navigate to the relevant tab and highlight the section that needs fixing
function navigateToFix(errorText) {
  const errorMap = [
    { match: 'Client is required', tab: 'items', section: 'client' },
    { match: 'Factory must be selected', tab: 'items', section: 'factory' },
    { match: 'at least one item', tab: 'items', section: 'items-list' },
    { match: 'missing selling prices', tab: 'items', section: 'pricing' },
    { match: 'Proforma Invoice must be generated', tab: 'items', section: 'pi-actions' },
    { match: 'payment must be recorded', tab: 'payments', section: 'add-payment' },
    { match: 'factory payment must be recorded', tab: 'payments', section: 'factory-payment' },
    { match: 'Packing list must be uploaded', tab: 'packing', section: 'upload' },
    { match: 'Items have changed since last PI', tab: 'items', section: 'pi-actions' },
  ]
  const lower = (errorText || '').toLowerCase()
  const found = errorMap.find(e => lower.includes(e.match.toLowerCase()))
  if (found) {
    activeTab.value = found.tab
    highlightSection.value = found.section
    // Auto-clear after animation completes
    setTimeout(() => { highlightSection.value = null }, 3000)
  }
}

// Load order
async function loadOrder() {
  loading.value = true
  transitionError.value = ''
  try {
    const [orderRes, timelineRes, nextRes, docsRes] = await Promise.all([
      ordersApi.get(orderId),
      ordersApi.timeline(orderId),
      ordersApi.nextStage(orderId).catch(() => ({ data: { next_stages: [] } })),
      documentsApi.list(orderId).catch(() => ({ data: [] })),
    ])
    order.value = orderRes.data
    timeline.value = timelineRes.data
    nextStages.value = nextRes.data?.next_stages || []
    prevStage.value = nextRes.data?.prev_stage || null
    reachablePrevious.value = nextRes.data?.reachable_previous || []
    reachableForward.value = nextRes.data?.reachable_forward || []
    documents.value = docsRes.data
  } catch (err) {
    console.error('Failed to load order:', err)
  } finally {
    loading.value = false
  }
}

// Stage transition with confirmation + warning support
function confirmTransition(ns) {
  pendingTransition.value = ns
  showTransitionConfirm.value = true
}

async function executeTransition() {
  showTransitionConfirm.value = false
  if (!pendingTransition.value) return
  transitioning.value = true
  transitionError.value = ''
  try {
    const res = await ordersApi.transition(orderId, pendingTransition.value.status, {
      acknowledge_warnings: false,
    })
    if (res.data?.status === 'warnings') {
      transitionWarnings.value = res.data.warnings
      transitionReason.value = ''
      showWarningModal.value = true
      return
    }
    pendingTransition.value = null
    await loadOrder()
  } catch (err) {
    const detail = err.response?.data?.detail
    if (typeof detail === 'object' && detail.validation_errors) {
      transitionError.value = detail.validation_errors.join(', ')
    } else {
      transitionError.value = typeof detail === 'string' ? detail : 'Transition failed'
    }
  } finally {
    transitioning.value = false
  }
}

async function executeTransitionWithWarnings() {
  if (!transitionReason.value.trim()) return
  showWarningModal.value = false
  transitioning.value = true
  transitionError.value = ''
  try {
    await ordersApi.transition(orderId, pendingTransition.value.status, {
      acknowledge_warnings: true,
      transition_reason: transitionReason.value.trim(),
    })
    pendingTransition.value = null
    transitionWarnings.value = []
    transitionReason.value = ''
    await loadOrder()
  } catch (err) {
    transitionError.value = err.response?.data?.detail || 'Transition failed'
  } finally {
    transitioning.value = false
  }
}

function confirmGoBack() {
  showGoBackConfirm.value = true
}

async function executeGoBack() {
  showGoBackConfirm.value = false
  transitioning.value = true
  transitionError.value = ''
  try {
    await ordersApi.goBack(orderId, { reason: 'Stage reversal' })
    await loadOrder()
  } catch (err) {
    transitionError.value = err.response?.data?.detail || 'Go back failed'
  } finally {
    transitioning.value = false
  }
}

function confirmJumpToStage(target) {
  jumpTarget.value = target
  showJumpConfirm.value = true
}

async function executeJumpToStage() {
  showJumpConfirm.value = false
  if (!jumpTarget.value) return
  transitioning.value = true
  transitionError.value = ''
  try {
    await ordersApi.jumpToStage(orderId, {
      target_status: jumpTarget.value.status,
      reason: 'Direct stage navigation',
    })
    jumpTarget.value = null
    await loadOrder()
  } catch (err) {
    transitionError.value = err.response?.data?.detail || 'Jump failed'
  } finally {
    transitioning.value = false
  }
}

// Reopen
async function handleReopen() {
  if (!reopenReason.value.trim()) return
  try {
    await ordersApi.reopen(orderId, { reason: reopenReason.value.trim() })
    showReopenModal.value = false
    reopenReason.value = ''
    await loadOrder()
  } catch (err) {
    console.error('Reopen failed:', err)
  }
}

// Delete draft
async function deleteDraft() {
  try {
    await ordersApi.delete(orderId)
    router.push('/orders')
  } catch (err) {
    console.error('Delete failed:', err)
  }
}

// Computed
const isDraft = computed(() => order.value?.status === 'DRAFT')
const isCompleted = computed(() => order.value?.status === 'COMPLETED')
const isPendingPI = computed(() => order.value?.status === 'PENDING_PI')
const isCompletedEditing = computed(() => order.value?.status === 'COMPLETED_EDITING')
const canEditPrices = computed(() => isPendingPI.value || isCompletedEditing.value)
const isPostPI = computed(() => {
  const postPIStatuses = ['PI_SENT', 'ADVANCE_PENDING', 'ADVANCE_RECEIVED', 'FACTORY_ORDERED',
    'PRODUCTION_60', 'PRODUCTION_80', 'PRODUCTION_90', 'PLAN_PACKING', 'FINAL_PI', 'PRODUCTION_100',
    'BOOKED', 'LOADED', 'SAILED', 'ARRIVED', 'CUSTOMS_FILED', 'CLEARED',
    'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING']
  return postPIStatuses.includes(order.value?.status)
})

const isProductionStage = computed(() => {
  const prodStatuses = ['FACTORY_ORDERED', 'PRODUCTION_60', 'PRODUCTION_80', 'PRODUCTION_90',
    'PLAN_PACKING', 'FINAL_PI', 'PRODUCTION_100']
  return prodStatuses.includes(order.value?.status)
})

const showPackingSection = computed(() => {
  const packingStatuses = ['PLAN_PACKING', 'FINAL_PI', 'PRODUCTION_100', 'BOOKED', 'LOADED', 'SAILED', 'ARRIVED',
    'CUSTOMS_FILED', 'CLEARED', 'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING']
  return packingStatuses.includes(order.value?.status)
})

const isBookingStage = computed(() => {
  const s = ['BOOKED', 'LOADED', 'SAILED', 'ARRIVED', 'CUSTOMS_FILED', 'CLEARED', 'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING']
  return s.includes(order.value?.status)
})

const isSailingStage = computed(() => {
  const s = ['LOADED', 'SAILED', 'ARRIVED', 'CUSTOMS_FILED', 'CLEARED', 'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING']
  return s.includes(order.value?.status)
})

const isCustomsStage = computed(() => {
  const s = ['ARRIVED', 'CUSTOMS_FILED', 'CLEARED', 'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING']
  return s.includes(order.value?.status)
})

const isAfterSalesStage = computed(() => {
  const s = ['AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING']
  return s.includes(order.value?.status)
})

// ========================================
// Tab definitions (progressive)
// ========================================
const availableTabs = computed(() => {
  const t = [
    { id: 'dashboard', label: 'Dashboard', icon: 'pi-th-large' },
    { id: 'items', label: 'Order Items', icon: 'pi-list' },
  ]
  if (isPostPI.value) t.push({ id: 'payments', label: 'Payments', icon: 'pi-wallet' })
  if (isProductionStage.value) t.push({ id: 'production', label: 'Production', icon: 'pi-chart-bar' })
  if (showPackingSection.value) t.push({ id: 'packing', label: 'Packing List', icon: 'pi-box' })
  if (isBookingStage.value) t.push({ id: 'booking', label: 'Booking', icon: 'pi-briefcase' })
  if (isSailingStage.value) t.push({ id: 'sailing', label: 'Sailing', icon: 'pi-compass' })
  if (isSailingStage.value) t.push({ id: 'shipping-docs', label: 'Shipping Docs', icon: 'pi-file' })
  if (isCustomsStage.value) t.push({ id: 'customs', label: 'Customs/BOE', icon: 'pi-file-check' })
  if (isAfterSalesStage.value) t.push({ id: 'after-sales', label: 'After-Sales', icon: 'pi-exclamation-triangle' })
  if (['COMPLETED', 'COMPLETED_EDITING'].includes(order.value?.status)) t.push({ id: 'final-draft', label: 'Final Draft', icon: 'pi-check-square' })
  t.push({ id: 'queries', label: 'Queries', icon: 'pi-comments', badge: order.value?.query_counts?.total || 0 })
  t.push({ id: 'files', label: 'Files', icon: 'pi-paperclip' })
  // Landed Cost — transparency clients at CLEARED+, visible to SUPER_ADMIN/ADMIN/FINANCE
  const _lcStages = new Set(['CLEARED', 'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING'])
  const _lcRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'FINANCE'])
  if (order.value?.client_type === 'TRANSPARENCY' && _lcStages.has(order.value?.status) && _lcRoles.has(user.value?.role))
    t.push({ id: 'landed-cost', label: 'Landed Cost', icon: 'pi-chart-bar' })
  return t
})

function getDefaultTab(status) {
  const s = status || ''
  if (['PLAN_PACKING'].includes(s)) return 'packing'
  if (['FINAL_PI'].includes(s)) return 'payments'
  if (['BOOKED'].includes(s)) return 'booking'
  if (['LOADED', 'SAILED', 'ARRIVED'].includes(s)) return 'sailing'
  if (['PRODUCTION_100'].includes(s)) return 'packing'
  if (['CUSTOMS_FILED', 'CLEARED'].includes(s)) return 'customs'
  if (['AFTER_SALES'].includes(s)) return 'after-sales'
  if (['DELIVERED', 'COMPLETED'].includes(s)) return 'packing'
  if (['FACTORY_ORDERED', 'PRODUCTION_60', 'PRODUCTION_80', 'PRODUCTION_90'].includes(s)) return 'production'
  if (['PI_SENT', 'ADVANCE_PENDING', 'ADVANCE_RECEIVED'].includes(s)) return 'payments'
  return 'dashboard'
}

watch(() => order.value?.status, (newStatus, oldStatus) => {
  if (!oldStatus || !newStatus) return
  const defaultTab = getDefaultTab(newStatus)
  activeTab.value = defaultTab
  router.replace({ query: { ...route.query, tab: defaultTab } })
})

watch(activeTab, (tab) => {
  if (tab && route.query.tab !== tab) {
    router.replace({ query: { ...route.query, tab } })
  }
})

// Factory selection for CLIENT_DRAFT approval
const factories = ref([])
const selectedFactoryId = ref('')
const selectedCurrency = ref('USD')
const loadingFactories = ref(false)

async function loadFactories() {
  if (factories.value.length > 0) return
  loadingFactories.value = true
  try {
    const { data } = await factoriesApi.list()
    factories.value = (data.items || data.factories || (Array.isArray(data) ? data : [])).filter(f => f.is_active !== false)
  } catch (_) { factories.value = [] }
  loadingFactories.value = false
}

// Assign factory to existing DRAFT order
async function assignFactory() {
  if (!order.value || !selectedFactoryId.value) return
  try {
    await ordersApi.update(order.value.id, { factory_id: selectedFactoryId.value })
    await loadOrder()
  } catch (e) {
    alert(e.response?.data?.detail || 'Failed to assign factory')
  }
}

// Approve client inquiry
async function approveInquiry() {
  if (!order.value) return
  const factoryId = selectedFactoryId.value || order.value.factory_id || null
  try {
    await ordersApi.approveInquiry(order.value.id, { factory_id: factoryId, currency: selectedCurrency.value })
    await loadOrder()
  } catch (e) {
    alert(e.response?.data?.detail || 'Failed to approve inquiry')
  }
}

onMounted(async () => {
  await loadOrder()
  if (route.query.tab && availableTabs.value.some(t => t.id === route.query.tab)) {
    activeTab.value = route.query.tab
  } else {
    activeTab.value = getDefaultTab(order.value?.status)
  }
  // Show carried items alert if redirected from order creation
  if (route.query.carried) {
    carriedAlert.value = parseInt(route.query.carried)
    router.replace({ query: { ...route.query, carried: undefined } })
  }
})

// Respond to URL tab changes (e.g. from notification clicks while already on the page)
watch(() => route.query.tab, (newTab) => {
  if (newTab && availableTabs.value.some(t => t.id === newTab)) {
    activeTab.value = newTab
  }
})

function handleOpenQuery(queryId) {
  activeTab.value = 'queries'
  router.replace({ query: { ...route.query, tab: 'queries', query: queryId } })
}
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <i class="pi pi-spin pi-spinner text-3xl text-emerald-500" />
    </div>

    <template v-else-if="order">
      <!-- Header -->
      <div class="flex items-start justify-between mb-6">
        <div class="flex items-center gap-3">
          <button @click="router.push('/orders')" class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <i class="pi pi-arrow-left" />
          </button>
          <div>
            <div class="flex items-center gap-3">
              <h2 class="text-lg font-semibold text-slate-800">
                {{ order.order_number || 'DRAFT ORDER' }}
              </h2>
              <span :class="['inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium', getStyle(order.stage_number).bg, getStyle(order.stage_number).text]">
                S{{ order.stage_number }} &middot; {{ order.stage_name }}
              </span>
              <span v-if="isSuperAdmin && order.client_type === 'TRANSPARENCY'" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                <i class="pi pi-eye text-[10px]" /> Transparency Client
              </span>
            </div>
            <p class="text-sm text-slate-500 mt-0.5">
              {{ order.client_name }}
              <span v-if="order.factory_name"> &middot; {{ order.factory_name }}</span>
              <span v-if="order.po_reference"> &middot; PO: {{ order.po_reference }}</span>
            </p>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2">
          <button v-if="isDraft" @click="showDeleteConfirm = true" class="px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
            <i class="pi pi-trash text-xs mr-1" /> Delete
          </button>
          <button v-if="isCompleted" @click="showReopenModal = true" class="px-3 py-2 text-sm text-amber-600 border border-amber-200 rounded-lg hover:bg-amber-50 transition-colors">
            <i class="pi pi-replay text-xs mr-1" /> Re-open
          </button>
        </div>
      </div>

      <!-- Client Inquiry Banner -->
      <div v-if="order?.status === 'CLIENT_DRAFT'" class="mb-4 bg-teal-50 border-2 border-teal-200 rounded-xl p-5">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
            <i class="pi pi-inbox text-teal-600" />
          </div>
          <div>
            <h3 class="font-bold text-teal-800">Client Inquiry</h3>
            <p class="text-xs text-teal-600">Review items, assign factory, then approve to create the order.</p>
          </div>
        </div>

        <!-- Factory Selection -->
        <div class="bg-white rounded-lg border border-teal-200 p-4 mb-4">
          <label class="block text-xs font-semibold text-slate-700 mb-2">
            <i class="pi pi-building text-teal-500 mr-1" /> Assign Factory <span class="text-red-400">*</span>
          </label>
          <select
            v-model="selectedFactoryId"
            @focus="loadFactories"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="">{{ loadingFactories ? 'Loading factories...' : 'Select a factory' }}</option>
            <option v-for="f in factories" :key="f.id" :value="f.id">
              {{ f.factory_name || f.company_name }} {{ f.city ? `(${f.city})` : '' }}
            </option>
          </select>
          <p v-if="!selectedFactoryId" class="text-[10px] text-amber-600 mt-1">
            <i class="pi pi-exclamation-triangle text-[8px]" /> Factory must be selected before approving
          </p>
        </div>

        <!-- Dealing Currency -->
        <div class="bg-white rounded-lg border border-teal-200 p-4 mb-4">
          <label class="block text-xs font-semibold text-slate-700 mb-2">
            <i class="pi pi-money-bill text-teal-500 mr-1" /> Dealing Currency
          </label>
          <select
            v-model="selectedCurrency"
            class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            <option value="USD">USD — US Dollar</option>
            <option value="CNY">CNY — Chinese Yuan</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — British Pound</option>
            <option value="JPY">JPY — Japanese Yen</option>
          </select>
          <p class="text-[10px] text-slate-400 mt-1">
            Factory prices will be entered in this currency. Exchange rate to INR will be auto-fetched.
          </p>
        </div>

        <div class="flex justify-end">
          <button
            @click="approveInquiry"
            :disabled="!selectedFactoryId"
            class="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i class="pi pi-check" /> Approve &amp; Create Order
          </button>
        </div>
      </div>

      <!-- Stage Timeline -->
      <div class="bg-white rounded-xl shadow-sm p-4 mb-6 overflow-x-auto">
        <div class="flex items-center gap-0 min-w-max">
          <template v-for="(stage, idx) in timeline?.timeline" :key="stage.stage">
            <div class="flex items-center">
              <div class="flex flex-col items-center">
                <div class="relative">
                  <div
                    :class="[
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                      stage.status === 'completed' && reachablePrevious.some(r => r.stage === stage.stage)
                        ? 'bg-emerald-500 text-white cursor-pointer hover:ring-2 hover:ring-amber-400 hover:ring-offset-1'
                        : stage.status === 'completed'
                        ? 'bg-emerald-500 text-white'
                        : stage.status === 'current'
                        ? 'bg-white border-2 border-emerald-500 text-emerald-600'
                        : stage.status === 'unlocked' && reachableForward.some(r => r.stage === stage.stage)
                        ? 'bg-amber-300 text-amber-800 cursor-pointer hover:ring-2 hover:ring-amber-500 hover:ring-offset-1'
                        : stage.status === 'unlocked'
                        ? 'bg-amber-200 text-amber-700'
                        : 'bg-slate-200 text-slate-400'
                    ]"
                    @click="
                      stage.status === 'completed' && reachablePrevious.find(r => r.stage === stage.stage)
                        ? confirmJumpToStage(reachablePrevious.find(r => r.stage === stage.stage))
                        : stage.status === 'unlocked' && reachableForward.find(r => r.stage === stage.stage)
                        ? confirmJumpToStage(reachableForward.find(r => r.stage === stage.stage))
                        : null
                    "
                    :title="
                      stage.status === 'completed' && reachablePrevious.some(r => r.stage === stage.stage)
                        ? 'Click to jump back to this stage'
                        : stage.status === 'unlocked' && reachableForward.some(r => r.stage === stage.stage)
                        ? 'Click to jump forward to this stage'
                        : stage.status === 'unlocked'
                        ? 'Previously reached'
                        : ''
                    "
                  >
                    <i v-if="stage.status === 'completed'" class="pi pi-check text-[10px]" />
                    <i v-else-if="stage.status === 'unlocked'" class="pi pi-lock-open text-[10px]" />
                    <span v-else>{{ stage.stage }}</span>
                  </div>
                  <!-- Override indicator -->
                  <div v-if="overridesByStage[stage.stage]"
                       class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full flex items-center justify-center"
                       :title="`Override: ${overridesByStage[stage.stage][0].reason}`">
                    <i class="pi pi-exclamation-triangle text-[7px] text-white" />
                  </div>
                </div>
                <span :class="['text-[10px] mt-1 whitespace-nowrap', stage.status === 'current' ? 'font-semibold text-emerald-700' : stage.status === 'unlocked' ? 'text-amber-600 font-medium' : 'text-slate-400']">
                  {{ stage.name }}
                </span>
              </div>
              <div v-if="idx < timeline.timeline.length - 1" :class="['w-8 h-0.5 mt-[-12px]', stage.status === 'completed' ? 'bg-emerald-500' : stage.status === 'unlocked' ? 'bg-amber-300' : 'bg-slate-200']" />
            </div>
          </template>
        </div>
      </div>

      <!-- Stage Override History (collapsed by default) -->
      <div v-if="timeline?.overrides?.length"
           class="bg-white rounded-xl shadow-sm mb-6 cursor-pointer"
           @click="showOverrides = !showOverrides">
        <div class="flex items-center justify-between px-4 py-2.5">
          <div class="flex items-center gap-2">
            <i class="pi pi-exclamation-triangle text-amber-500 text-xs" />
            <span class="text-xs font-semibold text-slate-600">Stage Overrides ({{ timeline.overrides.length }})</span>
            <span v-if="!showOverrides" class="text-[10px] text-slate-400">— click to view</span>
          </div>
          <i :class="['pi text-[10px] text-slate-400 transition-transform', showOverrides ? 'pi-chevron-up' : 'pi-chevron-down']" />
        </div>
        <div v-if="showOverrides" class="px-4 pb-4 space-y-3" @click.stop>
          <div v-for="ov in timeline.overrides" :key="ov.id"
               class="border border-amber-200 bg-amber-50/50 rounded-lg p-3">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-xs font-medium text-slate-600">
                S{{ ov.to_stage_number }} &middot; {{ ov.to_stage_name }}
              </span>
              <span class="text-[10px] text-slate-400">
                {{ new Date(ov.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }}
              </span>
            </div>
            <p class="text-sm text-slate-700 mb-2">"{{ ov.reason }}"</p>
            <ul class="space-y-1">
              <li v-for="(w, i) in ov.warnings" :key="i"
                  class="text-xs text-amber-700 flex items-start gap-1.5">
                <i class="pi pi-info-circle mt-0.5 text-[10px]" />
                {{ w.message || w }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Transition Error — clickable to navigate to fix -->
      <div
        v-if="transitionError"
        class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4 flex items-center gap-2 cursor-pointer hover:bg-red-100 hover:border-red-300 transition-colors group"
        @click="navigateToFix(transitionError)"
      >
        <i class="pi pi-exclamation-circle mt-0.5 shrink-0" />
        <div class="flex-1">
          <p>{{ transitionError }}</p>
          <p v-if="canEditPrices && transitionError.includes('selling prices')" class="mt-1 text-xs text-red-500">
            Use the pricing table below to enter factory prices and selling prices for each item.
          </p>
        </div>
        <i class="pi pi-arrow-right text-red-400 group-hover:text-red-600 transition-colors shrink-0" />
      </div>

      <!-- Factory Assignment (DRAFT without factory) -->
      <div v-if="order?.status === 'DRAFT' && !order?.factory_id" class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4" id="factory">
        <div class="flex items-center gap-3 mb-3">
          <i class="pi pi-building text-amber-600" />
          <div>
            <h3 class="font-bold text-amber-800 text-sm">Factory Not Assigned</h3>
            <p class="text-[10px] text-amber-600">A factory must be assigned before advancing to the next stage.</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <select
            v-model="selectedFactoryId"
            @focus="loadFactories"
            class="flex-1 px-3 py-2 border border-amber-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
          >
            <option value="">{{ loadingFactories ? 'Loading...' : 'Select a factory' }}</option>
            <option v-for="f in factories" :key="f.id" :value="f.id">
              {{ f.factory_name || f.company_name }} {{ f.city ? `(${f.city})` : '' }}
            </option>
          </select>
          <button
            @click="assignFactory"
            :disabled="!selectedFactoryId"
            class="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
          >
            <i class="pi pi-check text-xs" /> Assign
          </button>
        </div>
      </div>

      <!-- Next Stage / Go Back Buttons -->
      <div v-if="nextStages.length > 0 || prevStage || reachableForward.length > 0" class="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <button
              v-if="prevStage"
              @click="confirmGoBack"
              :disabled="transitioning"
              class="px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
            >
              <i class="pi pi-arrow-left text-xs" />
              S{{ prevStage.stage }} &middot; {{ prevStage.name }}
            </button>
            <button
              v-if="reachableForward.length > 0"
              @click="confirmJumpToStage(reachableForward[reachableForward.length - 1])"
              :disabled="transitioning"
              class="px-4 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
            >
              <i class="pi pi-forward text-xs" />
              Return to S{{ reachableForward[reachableForward.length - 1].stage }} &middot; {{ reachableForward[reachableForward.length - 1].name }}
            </button>
          </div>
          <div class="flex items-center gap-3">
            <span v-if="nextStages.length > 0" class="text-sm font-medium text-slate-600">Next:</span>
            <button
              v-for="ns in nextStages"
              :key="ns.status"
              @click="confirmTransition(ns)"
              :disabled="transitioning"
              class="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
            >
              <i v-if="transitioning" class="pi pi-spin pi-spinner text-xs" />
              <i v-else class="pi pi-arrow-right text-xs" />
              S{{ ns.stage }} &middot; {{ ns.name }}
            </button>
          </div>
        </div>
      </div>

      <!-- Carried Items Alert (after order creation with migration) -->
      <div v-if="carriedAlert" class="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
        <i class="pi pi-info-circle text-amber-600 mt-0.5" />
        <div class="flex-1">
          <p class="text-sm font-medium text-amber-800">
            {{ carriedAlert }} unloaded item{{ carriedAlert > 1 ? 's' : '' }} automatically added
          </p>
          <p class="text-xs text-amber-600 mt-0.5">
            Items from previous orders with the same client and factory were carried forward. Look for the
            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 mx-0.5">Carried</span>
            badge in the Order Items tab.
          </p>
        </div>
        <button @click="carriedAlert = null" class="p-1 text-amber-400 hover:text-amber-600">
          <i class="pi pi-times text-xs" />
        </button>
      </div>

      <!-- ==========================================
           TAB BAR (Progressive tabs)
           ========================================== -->
      <div class="bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
        <div class="flex border-b border-slate-200 overflow-x-auto">
          <button
            v-for="tab in availableTabs"
            :key="tab.id"
            @click="activeTab = tab.id"
            :class="[
              'flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-emerald-500 text-emerald-700 bg-emerald-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            ]"
          >
            <i :class="['pi', tab.icon, 'text-xs']" />
            {{ tab.label }}
            <span v-if="tab.id === 'queries' && (order?.query_counts?.open || 0) > 0"
              class="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold bg-red-500 text-white animate-pulse">
              {{ order.query_counts.open }}
            </span>
            <span v-else-if="tab.id === 'queries' && (order?.query_counts?.replied || 0) > 0"
              class="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10px] font-bold bg-blue-500 text-white">
              {{ order.query_counts.replied }}
            </span>
          </button>
        </div>
      </div>

      <!-- ==========================================
           TAB CONTENT
           ========================================== -->

      <template v-if="activeTab === 'dashboard'">
        <OrderDashboardTab :order-id="orderId" :order="order" :timeline="timeline" />
      </template>

      <template v-if="activeTab === 'payments'">
        <PaymentsTab :order-id="orderId" :order="order" :highlight-section="highlightSection" @reload="loadOrder" />
      </template>

      <template v-if="activeTab === 'production'">
        <ProductionTab :order-id="orderId" :order="order" />
      </template>

      <template v-if="activeTab === 'packing'">
        <PackingListTab :order-id="orderId" :order="order" :highlight-section="highlightSection" @reload="loadOrder" />
      </template>

      <template v-if="activeTab === 'booking'">
        <BookingTab :order-id="orderId" :order="order" @reload="loadOrder" />
      </template>

      <template v-if="activeTab === 'sailing'">
        <SailingTab :order-id="orderId" :order="order" @reload="loadOrder" />
      </template>

      <template v-if="activeTab === 'shipping-docs'">
        <ShippingDocsTab :order-id="orderId" :order="order" />
      </template>

      <template v-if="activeTab === 'customs'">
        <CustomsTab :order-id="orderId" :order="order" @reload="loadOrder" />
      </template>

      <template v-if="activeTab === 'after-sales'">
        <AfterSalesTab :order-id="orderId" :order="order" @reload="loadOrder" />
      </template>

      <template v-if="activeTab === 'items'">
        <OrderItemsTab :order-id="orderId" :order="order" :highlight-section="highlightSection" :is-super-admin="isSuperAdmin" @reload="loadOrder"
          @open-query="handleOpenQuery" />
      </template>

      <template v-if="activeTab === 'final-draft'">
        <FinalDraftTab :order-id="orderId" :order="order" />
      </template>

      <template v-if="activeTab === 'queries'">
        <QueriesTabInline :order-id="orderId" :order="order" />
      </template>

      <template v-if="activeTab === 'files'">
        <FilesTab :order-id="orderId" :order="order" :documents="documents" />
      </template>

      <template v-if="activeTab === 'landed-cost'">
        <LandedCostTab :orderId="orderId" />
      </template>

    </template>

    <!-- ==========================================
         MODALS
         ========================================== -->

    <!-- Delete Confirmation -->
    <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showDeleteConfirm = false">
      <div class="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <h3 class="text-lg font-semibold text-slate-800 mb-2">Delete Draft Order?</h3>
        <p class="text-sm text-slate-600 mb-4">This will permanently delete this draft order and all its items.</p>
        <div class="flex gap-3 justify-end">
          <button @click="showDeleteConfirm = false" class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          <button @click="deleteDraft" class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
        </div>
      </div>
    </div>

    <!-- Reopen Modal -->
    <div v-if="showReopenModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showReopenModal = false">
      <div class="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
        <h3 class="text-lg font-semibold text-slate-800 mb-2">Re-open Completed Order</h3>
        <p class="text-sm text-slate-600 mb-3">This will change status to COMPLETED_EDITING. Please provide a reason.</p>
        <textarea v-model="reopenReason" rows="3" placeholder="Reason for re-opening..." class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none mb-4" />
        <div class="flex gap-3 justify-end">
          <button @click="showReopenModal = false" class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          <button @click="handleReopen" :disabled="!reopenReason.trim()" class="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50">Re-open</button>
        </div>
      </div>
    </div>

    <!-- Stage Transition Confirmation Modal -->
    <div v-if="showTransitionConfirm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showTransitionConfirm = false">
      <div class="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 text-center">
        <div class="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="pi pi-arrow-right text-emerald-600 text-lg" />
        </div>
        <h3 class="text-lg font-semibold text-slate-800 mb-1">Advance Stage?</h3>
        <p class="text-sm text-slate-600 mb-5">Move to S{{ pendingTransition?.stage }} &middot; {{ pendingTransition?.name }}</p>
        <div class="flex gap-3 justify-center">
          <button @click="showTransitionConfirm = false" class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          <button @click="executeTransition" class="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">Confirm</button>
        </div>
      </div>
    </div>

    <!-- Go Back Confirmation Modal -->
    <div v-if="showGoBackConfirm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showGoBackConfirm = false">
      <div class="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 text-center">
        <div class="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="pi pi-arrow-left text-amber-600 text-lg" />
        </div>
        <h3 class="text-lg font-semibold text-slate-800 mb-1">Go Back?</h3>
        <p class="text-sm text-slate-600 mb-5">Revert to S{{ prevStage?.stage }} &middot; {{ prevStage?.name }}</p>
        <div class="flex gap-3 justify-center">
          <button @click="showGoBackConfirm = false" class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          <button @click="executeGoBack" class="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium">Go Back</button>
        </div>
      </div>
    </div>

    <!-- Underpayment Warning Modal -->
    <div v-if="showWarningModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showWarningModal = false">
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        <div class="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-center gap-3">
          <div class="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
            <i class="pi pi-exclamation-triangle text-amber-600 text-lg" />
          </div>
          <h3 class="text-lg font-semibold text-amber-800">Outstanding Balance</h3>
        </div>
        <div class="px-6 py-4">
          <ul v-if="transitionWarnings.length" class="mb-4 space-y-1">
            <li v-for="(w, i) in transitionWarnings" :key="i" class="text-sm text-amber-700 flex items-start gap-2">
              <i class="pi pi-info-circle mt-0.5 text-xs" />
              {{ w.message || w }}
            </li>
          </ul>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Reason for proceeding <span class="text-red-500">*</span></label>
            <textarea
              v-model="transitionReason"
              rows="3"
              placeholder="Explain why you are advancing despite the outstanding balance..."
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
            />
          </div>
        </div>
        <div class="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end">
          <button @click="showWarningModal = false; pendingTransition = null; transitionWarnings = []; transitionReason = ''" class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          <button
            @click="executeTransitionWithWarnings"
            :disabled="!transitionReason.trim()"
            class="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium disabled:opacity-50"
          >
            Proceed Anyway
          </button>
        </div>
      </div>
    </div>

    <!-- Jump to Stage Confirmation Modal -->
    <div v-if="showJumpConfirm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showJumpConfirm = false">
      <div class="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4 text-center">
        <div class="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
          :class="reachableForward.some(r => r.status === jumpTarget?.status) ? 'bg-emerald-100' : 'bg-amber-100'">
          <i :class="reachableForward.some(r => r.status === jumpTarget?.status) ? 'pi pi-forward text-emerald-600 text-lg' : 'pi pi-history text-amber-600 text-lg'" />
        </div>
        <h3 class="text-lg font-semibold text-slate-800 mb-1">Jump to Stage?</h3>
        <p class="text-sm text-slate-600 mb-5">
          {{ reachableForward.some(r => r.status === jumpTarget?.status) ? 'Return forward to' : 'Jump back to' }}
          <span class="font-semibold">S{{ jumpTarget?.stage }} &middot; {{ jumpTarget?.name }}</span>
          from current stage?
        </p>
        <p class="text-xs mb-4 p-2 rounded-lg"
          :class="reachableForward.some(r => r.status === jumpTarget?.status) ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'">
          <i class="pi pi-exclamation-triangle text-xs" />
          {{ reachableForward.some(r => r.status === jumpTarget?.status) ? 'This will restore the order to a previously reached stage.' : 'This will revert the order to the selected stage.' }}
        </p>
        <div class="flex gap-3 justify-center">
          <button @click="showJumpConfirm = false" class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          <button @click="executeJumpToStage" class="px-4 py-2 text-sm text-white rounded-lg font-medium"
            :class="reachableForward.some(r => r.status === jumpTarget?.status) ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'">
            {{ reachableForward.some(r => r.status === jumpTarget?.status) ? 'Return' : 'Jump Back' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
