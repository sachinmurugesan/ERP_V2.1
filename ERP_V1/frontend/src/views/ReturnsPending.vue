<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { unloadedApi, afterSalesApi, factoriesApi, clientsApi } from '../api'

const router = useRouter()

// ========================================
// State
// ========================================
const loading = ref(true)
const activeTab = ref('all')
const searchQuery = ref('')

// Data
const unloadedItems = ref([])
const aftersalesItems = ref([])
const factories = ref([])
const clients = ref([])

// Filters
const filterFactory = ref('')
const filterClient = ref('')
const filterStatus = ref('')

// ========================================
// Data Loading
// ========================================
async function loadAll() {
  loading.value = true
  try {
    const params = {}
    if (filterFactory.value) params.factory_id = filterFactory.value
    if (filterClient.value) params.client_id = filterClient.value
    if (filterStatus.value) params.status = filterStatus.value

    const asParams = { carry_forward_only: true }
    if (filterClient.value) asParams.client_id = filterClient.value
    if (filterFactory.value) asParams.factory_id = filterFactory.value

    const [unloadedRes, asRes] = await Promise.all([
      unloadedApi.list(params),
      afterSalesApi.list(asParams),
    ])
    unloadedItems.value = (unloadedRes.data?.items || []).map(i => ({ ...i, _type: 'unloaded' }))
    aftersalesItems.value = (asRes.data?.items || []).map(i => ({ ...i, _type: 'aftersales' }))
  } catch (err) {
    console.error('Failed to load returns & pending:', err)
  } finally {
    loading.value = false
  }
}

async function loadFilters() {
  try {
    const [factRes, clientRes] = await Promise.all([
      factoriesApi.list(),
      clientsApi.list(),
    ])
    factories.value = factRes.data?.items || factRes.data || []
    clients.value = clientRes.data?.items || clientRes.data || []
  } catch (err) {
    console.error('Failed to load filter data:', err)
  }
}

function applyFilters() { loadAll() }
function clearFilters() {
  filterFactory.value = ''
  filterClient.value = ''
  filterStatus.value = ''
  loadAll()
}

// ========================================
// Computed
// ========================================

// Normalize items for "All" tab
const allItems = computed(() => [...unloadedItems.value, ...aftersalesItems.value])

// Active items based on tab
const tabItems = computed(() => {
  if (activeTab.value === 'unloaded') return unloadedItems.value
  if (activeTab.value === 'aftersales') return aftersalesItems.value
  return allItems.value
})

// Search filter
const filteredItems = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return tabItems.value
  return tabItems.value.filter(item => {
    const code = (item.product_code || '').toLowerCase()
    const name = (item.product_name || '').toLowerCase()
    const order = (item.original_order_number || item.order_number || '').toLowerCase()
    return code.includes(q) || name.includes(q) || order.includes(q)
  })
})

// Consolidated view — groups same product across orders
const consolidatedItems = computed(() => consolidateByProduct(filteredItems.value))

// Dashboard summary
const dashboard = computed(() => {
  const uPending = unloadedItems.value.filter(i => i.status === 'PENDING').length
  const uAdded = unloadedItems.value.filter(i => i.status === 'ADDED_TO_ORDER').length
  const uShipped = unloadedItems.value.filter(i => i.status === 'SHIPPED').length

  const asPending = aftersalesItems.value.filter(i => i.carry_forward_status === 'PENDING').length
  const asAdded = aftersalesItems.value.filter(i => i.carry_forward_status === 'ADDED_TO_ORDER').length
  const asFulfilled = aftersalesItems.value.filter(i => i.carry_forward_status === 'FULFILLED').length

  return {
    totalPending: uPending + asPending,
    totalFulfilled: uShipped + asFulfilled,
    totalAdded: uAdded + asAdded,
    unloaded: unloadedItems.value.length,
    aftersales: aftersalesItems.value.length,
    total: unloadedItems.value.length + aftersalesItems.value.length,
  }
})

// ========================================
// Helpers
// ========================================
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

function getTypeBadge(type) {
  if (type === 'unloaded') return { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Unloaded' }
  return { bg: 'bg-rose-100', text: 'text-rose-700', label: 'After-Sales' }
}

function getStatusBadge(item) {
  if (item._type === 'unloaded') {
    switch (item.status) {
      case 'PENDING': return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' }
      case 'ADDED_TO_ORDER': return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Added to Order' }
      case 'SHIPPED': return { bg: 'bg-green-100', text: 'text-green-700', label: 'Shipped' }
      default: return { bg: 'bg-slate-100', text: 'text-slate-700', label: item.status }
    }
  } else {
    switch (item.carry_forward_status) {
      case 'PENDING': return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' }
      case 'ADDED_TO_ORDER': return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Added to Order' }
      case 'FULFILLED': return { bg: 'bg-green-100', text: 'text-green-700', label: 'Fulfilled' }
      default: return { bg: 'bg-slate-100', text: 'text-slate-700', label: item.carry_forward_status }
    }
  }
}

// 3-step carry-forward stepper
const STEPPER_STEPS = [
  { label: 'Pending', icon: 'pi-clock' },
  { label: 'In Order', icon: 'pi-shopping-cart' },
  { label: 'Fulfilled', icon: 'pi-check' },
]

function stepperState(item) {
  const s = item._type === 'unloaded'
    ? (item.status || '')
    : (item.carry_forward_status || '')
  if (s === 'FULFILLED' || s === 'SHIPPED') return 2
  if (s === 'ADDED_TO_ORDER') return 1
  return 0
}

function getReasonLabel(reason) {
  switch (reason) {
    case 'NOT_PRODUCED': return 'Not Produced'
    case 'NO_SPACE': return 'No Space'
    default: return reason || '—'
  }
}

function getOrderNumber(item) {
  return item.original_order_number || item.order_number || '—'
}

function getOrderId(item) {
  return item.original_order_id || item.order_id || ''
}

function getQty(item) {
  if (item._type === 'unloaded') return item.quantity
  return item.affected_quantity || 0
}

function getAddedToId(item) {
  return item.added_to_order_id || ''
}

function getAddedToNumber(item) {
  return item.added_to_order_number || ''
}

// Consolidate items with the same product across orders
function consolidateByProduct(items) {
  // Use item.id as key — each claim/unloaded item is a separate row.
  // Same product can have multiple independent claims (e.g. from different orders).
  const groups = {}
  for (const item of items) {
    const key = item.id || (item.product_id || item.product_code) + '_' + item._type
    if (!groups[key]) {
      groups[key] = {
        ...item,
        _totalQty: 0,
        _orderCount: 0,
        _orderRefs: [],
        _addedToRefs: [],
      }
    }
    const g = groups[key]
    g._totalQty += getQty(item)

    const orderId = getOrderId(item)
    const orderNum = getOrderNumber(item)
    if (!g._orderRefs.some(r => r.id === orderId)) {
      g._orderRefs.push({ id: orderId, number: orderNum })
      g._orderCount++
    }

    const addedId = getAddedToId(item)
    if (addedId && !g._addedToRefs.some(r => r.id === addedId)) {
      g._addedToRefs.push({ id: addedId, number: getAddedToNumber(item) })
    }
  }
  return Object.values(groups)
}

// ========================================
// Lifecycle
// ========================================
onMounted(() => {
  loadFilters()
  loadAll()
})
</script>

<template>
  <div>
    <!-- Header + Search -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-bold text-slate-800">Returns & Pending</h1>
        <p class="text-sm text-slate-500 mt-1">Track pending, unloaded & returning items across orders</p>
      </div>
      <div class="flex items-center gap-3">
        <div class="relative">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search product, order..."
            class="pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none w-64"
          />
        </div>
        <button @click="loadAll" class="p-2 text-slate-500 hover:text-emerald-600 transition-colors" title="Refresh">
          <i class="pi pi-refresh text-sm" />
        </button>
      </div>
    </div>

    <!-- Dashboard Cards -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div class="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
        <div class="flex items-center gap-2 mb-1">
          <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <i class="pi pi-list text-slate-600 text-sm" />
          </div>
        </div>
        <div class="text-2xl font-bold text-slate-800">{{ dashboard.total }}</div>
        <div class="text-xs text-slate-500 mt-0.5">Total Items</div>
      </div>
      <div class="bg-amber-50 rounded-xl shadow-sm p-4 border border-amber-200">
        <div class="flex items-center gap-2 mb-1">
          <div class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
            <i class="pi pi-clock text-amber-600 text-sm" />
          </div>
        </div>
        <div class="text-2xl font-bold text-amber-700">{{ dashboard.totalPending }}</div>
        <div class="text-xs text-amber-600 mt-0.5">Pending</div>
      </div>
      <div class="bg-orange-50 rounded-xl shadow-sm p-4 border border-orange-200">
        <div class="flex items-center gap-2 mb-1">
          <div class="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
            <i class="pi pi-inbox text-orange-600 text-sm" />
          </div>
        </div>
        <div class="text-2xl font-bold text-orange-700">{{ dashboard.unloaded }}</div>
        <div class="text-xs text-orange-600 mt-0.5">Unloaded</div>
      </div>
      <div class="bg-rose-50 rounded-xl shadow-sm p-4 border border-rose-200">
        <div class="flex items-center gap-2 mb-1">
          <div class="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
            <i class="pi pi-replay text-rose-600 text-sm" />
          </div>
        </div>
        <div class="text-2xl font-bold text-rose-700">{{ dashboard.aftersales }}</div>
        <div class="text-xs text-rose-600 mt-0.5">After-Sales Returns</div>
      </div>
      <div class="bg-green-50 rounded-xl shadow-sm p-4 border border-green-200">
        <div class="flex items-center gap-2 mb-1">
          <div class="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
            <i class="pi pi-check-circle text-green-600 text-sm" />
          </div>
        </div>
        <div class="text-2xl font-bold text-green-700">{{ dashboard.totalFulfilled }}</div>
        <div class="text-xs text-green-600 mt-0.5">Fulfilled / Shipped</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex items-center gap-1 mb-4 bg-slate-100 rounded-lg p-1 w-fit">
      <button
        v-for="tab in [
          { key: 'all', label: 'All', count: allItems.length },
          { key: 'unloaded', label: 'Unloaded Items', count: unloadedItems.length },
          { key: 'aftersales', label: 'After-Sales Returns', count: aftersalesItems.length },
        ]"
        :key="tab.key"
        @click="activeTab = tab.key"
        :class="[
          'px-4 py-2 text-sm font-medium rounded-md transition-all',
          activeTab === tab.key
            ? 'bg-white text-emerald-700 shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        ]"
      >
        {{ tab.label }}
        <span :class="[
          'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
          activeTab === tab.key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
        ]">{{ tab.count }}</span>
      </button>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-xl shadow-sm p-4 mb-6 border border-slate-200">
      <div class="flex items-end gap-4">
        <div class="flex-1">
          <label class="block text-xs font-medium text-slate-600 mb-1">Factory</label>
          <select v-model="filterFactory" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
            <option value="">All Factories</option>
            <option v-for="f in factories" :key="f.id" :value="f.id">{{ f.company_name }}</option>
          </select>
        </div>
        <div class="flex-1">
          <label class="block text-xs font-medium text-slate-600 mb-1">Client</label>
          <select v-model="filterClient" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
            <option value="">All Clients</option>
            <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.company_name }}</option>
          </select>
        </div>
        <div class="flex-1">
          <label class="block text-xs font-medium text-slate-600 mb-1">Status</label>
          <select v-model="filterStatus" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ADDED_TO_ORDER">Added to Order</option>
            <option value="SHIPPED">Shipped / Fulfilled</option>
          </select>
        </div>
        <div class="flex gap-2">
          <button @click="applyFilters" class="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">
            <i class="pi pi-search text-xs mr-1" /> Filter
          </button>
          <button @click="clearFilters" class="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            Clear
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ TABLE: ALL TAB ═══ -->
    <div v-if="activeTab === 'all'" class="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <i class="pi pi-spin pi-spinner text-2xl text-emerald-500" />
      </div>
      <div v-else-if="consolidatedItems.length === 0" class="text-center py-12 text-slate-400">
        <i class="pi pi-inbox text-4xl mb-3" />
        <p>No items found</p>
      </div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-200">
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Order</th>
            <th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Type</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Part Code</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Product Name</th>
            <th class="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Qty</th>
            <th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Detail</th>
            <th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Progress</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Added To</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="item in consolidatedItems" :key="item._type + '-' + (item.product_id || item.product_code || item.id)" class="hover:bg-slate-50/50 transition-colors">
            <td class="px-4 py-3">
              <div v-if="item._orderCount > 1" class="flex flex-col gap-0.5">
                <button v-for="ref in item._orderRefs" :key="ref.id" @click="router.push(`/orders/${ref.id}`)" class="text-emerald-600 hover:text-emerald-800 font-medium hover:underline text-sm text-left">
                  {{ ref.number }}
                </button>
              </div>
              <button v-else @click="router.push(`/orders/${getOrderId(item)}`)" class="text-emerald-600 hover:text-emerald-800 font-medium hover:underline text-sm">
                {{ getOrderNumber(item) }}
              </button>
            </td>
            <td class="px-4 py-3 text-center">
              <span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold', getTypeBadge(item._type).bg, getTypeBadge(item._type).text]">
                {{ getTypeBadge(item._type).label }}
              </span>
            </td>
            <td class="px-4 py-3 font-mono text-xs text-slate-700">{{ item.product_code || '—' }}</td>
            <td class="px-4 py-3 text-slate-600 max-w-[200px]">
              <span class="truncate block">{{ item.product_name || '—' }}</span>
              <span v-if="item._orderCount > 1" class="inline-flex items-center mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {{ item._orderCount }} orders
              </span>
            </td>
            <td class="px-4 py-3 text-right font-semibold">{{ item._totalQty }}</td>
            <td class="px-4 py-3 text-center text-xs text-slate-500">
              <template v-if="item._type === 'unloaded'">{{ getReasonLabel(item.reason) }}</template>
              <template v-else>{{ issueLabels[item.objection_type] || item.objection_type || '—' }}</template>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-0.5 justify-center">
                <template v-for="(step, si) in STEPPER_STEPS" :key="si">
                  <div class="flex items-center gap-1">
                    <div class="w-5 h-5 rounded-full flex items-center justify-center text-[9px]"
                      :class="si <= stepperState(item)
                        ? si === stepperState(item) ? 'bg-emerald-500 text-white' : 'bg-emerald-200 text-emerald-700'
                        : 'bg-slate-100 text-slate-400'">
                      <i :class="'pi ' + step.icon" style="font-size: 9px;" />
                    </div>
                    <span class="text-[9px] font-medium hidden xl:inline"
                      :class="si <= stepperState(item) ? 'text-emerald-700' : 'text-slate-400'">{{ step.label }}</span>
                  </div>
                  <div v-if="si < STEPPER_STEPS.length - 1" class="w-4 h-px mx-0.5"
                    :class="si < stepperState(item) ? 'bg-emerald-300' : 'bg-slate-200'" />
                </template>
              </div>
            </td>
            <td class="px-4 py-3">
              <div v-if="item._addedToRefs.length > 1" class="flex flex-col gap-0.5">
                <button v-for="ref in item._addedToRefs" :key="ref.id" @click="router.push(`/orders/${ref.id}`)" class="text-blue-600 hover:text-blue-800 font-medium hover:underline text-xs">
                  {{ ref.number }}
                </button>
              </div>
              <button v-else-if="item._addedToRefs.length === 1" @click="router.push(`/orders/${item._addedToRefs[0].id}`)" class="text-blue-600 hover:text-blue-800 font-medium hover:underline text-xs">
                {{ item._addedToRefs[0].number }}
              </button>
              <span v-else class="text-slate-400">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ═══ TABLE: UNLOADED TAB ═══ -->
    <div v-if="activeTab === 'unloaded'" class="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <i class="pi pi-spin pi-spinner text-2xl text-emerald-500" />
      </div>
      <div v-else-if="consolidatedItems.length === 0" class="text-center py-12 text-slate-400">
        <i class="pi pi-inbox text-4xl mb-3" />
        <p>No unloaded items found</p>
      </div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-200">
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Original Order</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Part Code</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Product Name</th>
            <th class="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Qty</th>
            <th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Reason</th>
            <th class="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Factory Price (CNY)</th>
            <th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Progress</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Added To</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="item in consolidatedItems" :key="'u-' + (item.product_id || item.product_code || item.id)" class="hover:bg-slate-50/50 transition-colors">
            <td class="px-4 py-3">
              <div v-if="item._orderCount > 1" class="flex flex-col gap-0.5">
                <button v-for="ref in item._orderRefs" :key="ref.id" @click="router.push(`/orders/${ref.id}`)" class="text-emerald-600 hover:text-emerald-800 font-medium hover:underline text-left">
                  {{ ref.number }}
                </button>
              </div>
              <button v-else @click="router.push(`/orders/${item.original_order_id}`)" class="text-emerald-600 hover:text-emerald-800 font-medium hover:underline">
                {{ item.original_order_number || '—' }}
              </button>
            </td>
            <td class="px-4 py-3 font-mono text-xs text-slate-700">{{ item.product_code || '—' }}</td>
            <td class="px-4 py-3 text-slate-600">
              {{ item.product_name || '—' }}
              <span v-if="item._orderCount > 1" class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {{ item._orderCount }} orders
              </span>
            </td>
            <td class="px-4 py-3 text-right font-medium">{{ item._totalQty }}</td>
            <td class="px-4 py-3 text-center">
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                    :class="item.reason === 'NOT_PRODUCED' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'">
                {{ getReasonLabel(item.reason) }}
              </span>
            </td>
            <td class="px-4 py-3 text-right font-mono text-xs">
              {{ item.factory_price ? `¥${item.factory_price.toFixed(2)}` : '—' }}
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-0.5 justify-center">
                <template v-for="(step, si) in STEPPER_STEPS" :key="si">
                  <div class="flex items-center gap-1">
                    <div class="w-5 h-5 rounded-full flex items-center justify-center text-[9px]"
                      :class="si <= stepperState(item) ? si === stepperState(item) ? 'bg-emerald-500 text-white' : 'bg-emerald-200 text-emerald-700' : 'bg-slate-100 text-slate-400'">
                      <i :class="'pi ' + step.icon" style="font-size: 9px;" />
                    </div>
                    <span class="text-[9px] font-medium hidden xl:inline" :class="si <= stepperState(item) ? 'text-emerald-700' : 'text-slate-400'">{{ step.label }}</span>
                  </div>
                  <div v-if="si < STEPPER_STEPS.length - 1" class="w-4 h-px mx-0.5" :class="si < stepperState(item) ? 'bg-emerald-300' : 'bg-slate-200'" />
                </template>
              </div>
            </td>
            <td class="px-4 py-3">
              <div v-if="item._addedToRefs.length > 1" class="flex flex-col gap-0.5">
                <button v-for="ref in item._addedToRefs" :key="ref.id" @click="router.push(`/orders/${ref.id}`)" class="text-blue-600 hover:text-blue-800 font-medium hover:underline text-xs">
                  {{ ref.number }}
                </button>
              </div>
              <button v-else-if="item._addedToRefs.length === 1" @click="router.push(`/orders/${item._addedToRefs[0].id}`)" class="text-blue-600 hover:text-blue-800 font-medium hover:underline text-xs">
                {{ item._addedToRefs[0].number }}
              </button>
              <span v-else class="text-slate-400">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ═══ TABLE: AFTER-SALES RETURNS TAB ═══ -->
    <div v-if="activeTab === 'aftersales'" class="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <i class="pi pi-spin pi-spinner text-2xl text-emerald-500" />
      </div>
      <div v-else-if="consolidatedItems.length === 0" class="text-center py-12 text-slate-400">
        <i class="pi pi-replay text-4xl mb-3" />
        <p>No after-sales return items found</p>
      </div>
      <table v-else class="w-full text-sm">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-200">
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Order</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Client</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Part Code</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Product Name</th>
            <th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Issue Type</th>
            <th class="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">Claim Qty</th>
            <th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Resolution</th>
            <th class="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Progress</th>
            <th class="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Added To</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="item in consolidatedItems" :key="'as-' + (item.product_id || item.product_code || item.id)" class="hover:bg-slate-50/50 transition-colors">
            <td class="px-4 py-3">
              <div v-if="item._orderCount > 1" class="flex flex-col gap-0.5">
                <button v-for="ref in item._orderRefs" :key="ref.id" @click="router.push(`/orders/${ref.id}`)" class="text-emerald-600 hover:text-emerald-800 font-medium hover:underline text-left">
                  {{ ref.number }}
                </button>
              </div>
              <button v-else @click="router.push(`/orders/${item.order_id}`)" class="text-emerald-600 hover:text-emerald-800 font-medium hover:underline">
                {{ item.order_number || '—' }}
              </button>
            </td>
            <td class="px-4 py-3 text-xs text-slate-600">{{ item.client_name || '—' }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-700">{{ item.product_code || '—' }}</td>
            <td class="px-4 py-3 text-slate-600 max-w-[160px]">
              <span class="truncate block">{{ item.product_name || '—' }}</span>
              <span v-if="item._orderCount > 1" class="inline-flex items-center mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {{ item._orderCount }} orders
              </span>
            </td>
            <td class="px-4 py-3 text-center">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-100 text-rose-700">
                {{ issueLabels[item.objection_type] || item.objection_type || '—' }}
              </span>
            </td>
            <td class="px-4 py-3 text-right font-semibold text-red-700">{{ item._totalQty }}</td>
            <td class="px-4 py-3 text-center text-xs text-slate-600">{{ resolutionLabels[item.resolution_type] || item.resolution_type || '—' }}</td>
            <td class="px-4 py-3">
              <div class="flex items-center gap-0.5 justify-center">
                <template v-for="(step, si) in STEPPER_STEPS" :key="si">
                  <div class="flex items-center gap-1">
                    <div class="w-5 h-5 rounded-full flex items-center justify-center text-[9px]"
                      :class="si <= stepperState(item) ? si === stepperState(item) ? 'bg-emerald-500 text-white' : 'bg-emerald-200 text-emerald-700' : 'bg-slate-100 text-slate-400'">
                      <i :class="'pi ' + step.icon" style="font-size: 9px;" />
                    </div>
                    <span class="text-[9px] font-medium hidden xl:inline" :class="si <= stepperState(item) ? 'text-emerald-700' : 'text-slate-400'">{{ step.label }}</span>
                  </div>
                  <div v-if="si < STEPPER_STEPS.length - 1" class="w-4 h-px mx-0.5" :class="si < stepperState(item) ? 'bg-emerald-300' : 'bg-slate-200'" />
                </template>
              </div>
            </td>
            <td class="px-4 py-3">
              <div v-if="item._addedToRefs.length > 1" class="flex flex-col gap-0.5">
                <button v-for="ref in item._addedToRefs" :key="ref.id" @click="router.push(`/orders/${ref.id}`)" class="text-blue-600 hover:text-blue-800 font-medium hover:underline text-xs">
                  {{ ref.number }}
                </button>
              </div>
              <button v-else-if="item._addedToRefs.length === 1" @click="router.push(`/orders/${item._addedToRefs[0].id}`)" class="text-blue-600 hover:text-blue-800 font-medium hover:underline text-xs">
                {{ item._addedToRefs[0].number }}
              </button>
              <span v-else class="text-slate-400">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
