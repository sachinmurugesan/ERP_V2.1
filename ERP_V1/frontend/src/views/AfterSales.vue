<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { afterSalesApi } from '../api'

const router = useRouter()
const items = ref([])
const summary = ref({ open: 0, in_progress: 0, resolved: 0, pending_carry_forward: 0, total_claim_value: 0 })
const loading = ref(false)

// Filters
const statusFilter = ref('')
const objectionFilter = ref('')
const resolutionFilter = ref('')

const statusOptions = [
  { label: 'All Statuses', value: '' },
  { label: 'Open', value: 'OPEN' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Resolved', value: 'RESOLVED' },
]

const objectionOptions = [
  { label: 'All Types', value: '' },
  { label: 'Product Missing', value: 'PRODUCT_MISSING' },
  { label: 'Product Mismatch', value: 'PRODUCT_MISMATCH' },
  { label: 'Quality Issue', value: 'QUALITY_ISSUE' },
  { label: 'Price Mismatch', value: 'PRICE_MISMATCH' },
]

const resolutionOptions = [
  { label: 'All Resolutions', value: '' },
  { label: 'Replace Next Order', value: 'REPLACE_NEXT_ORDER' },
  { label: 'Compensate Balance', value: 'COMPENSATE_BALANCE' },
  { label: 'Partial Compensate', value: 'PARTIAL_COMPENSATE' },
  { label: 'Partial Replacement', value: 'PARTIAL_REPLACEMENT' },
]

const filteredItems = computed(() => {
  return items.value.filter(item => {
    if (statusFilter.value && item.status !== statusFilter.value) return false
    if (objectionFilter.value && item.objection_type !== objectionFilter.value) return false
    if (resolutionFilter.value && item.resolution_type !== resolutionFilter.value) return false
    return true
  })
})

async function fetchItems() {
  loading.value = true
  try {
    const params = {}
    if (statusFilter.value) params.status = statusFilter.value
    if (objectionFilter.value) params.objection_type = objectionFilter.value
    if (resolutionFilter.value) params.resolution_type = resolutionFilter.value
    const { data } = await afterSalesApi.list(params)
    items.value = data.items || []
    if (data.summary) summary.value = data.summary
  } catch (err) {
    console.error('Failed to fetch after-sales items:', err)
    items.value = []
  } finally {
    loading.value = false
  }
}

function goToOrder(item) {
  router.push(`/orders/${item.order_id}?tab=after-sales`)
}

function statusColor(status) {
  switch (status) {
    case 'OPEN': return 'bg-amber-100 text-amber-700'
    case 'IN_PROGRESS': return 'bg-blue-100 text-blue-700'
    case 'RESOLVED': return 'bg-emerald-100 text-emerald-700'
    default: return 'bg-slate-100 text-slate-600'
  }
}

function issueColor(type) {
  switch (type) {
    case 'PRODUCT_MISSING': return 'bg-red-100 text-red-700'
    case 'PRODUCT_MISMATCH': return 'bg-orange-100 text-orange-700'
    case 'QUALITY_ISSUE': return 'bg-amber-100 text-amber-700'
    case 'PRICE_MISMATCH': return 'bg-violet-100 text-violet-700'
    default: return 'bg-slate-100 text-slate-600'
  }
}

function formatType(type) {
  return (type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatINR(val) {
  return val != null ? '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

// 3-step carry-forward stepper
const STEPPER_STEPS = [
  { label: 'Pending', icon: 'pi-clock' },
  { label: 'In Order', icon: 'pi-shopping-cart' },
  { label: 'Fulfilled', icon: 'pi-check' },
]

function stepperState(item) {
  const cf = item.carry_forward_status || ''
  if (cf === 'FULFILLED') return 2
  if (cf === 'ADDED_TO_ORDER') return 1
  if (cf === 'PENDING') return 0
  return -1
}

function orderStageLabel(status) {
  const map = {
    'DRAFT': 'Draft', 'CLIENT_DRAFT': 'Inquiry',
    'PENDING_PI': 'Pricing', 'PI_SENT': 'PI Sent',
    'ADVANCE_PENDING': 'Adv Pending', 'ADVANCE_RECEIVED': 'Adv Received',
    'FACTORY_ORDERED': 'Factory Ordered',
    'PRODUCTION_60': 'Prod 60%', 'PRODUCTION_80': 'Prod 80%',
    'PRODUCTION_90': 'Prod 90%', 'PLAN_PACKING': 'Packing',
    'FINAL_PI': 'Final PI', 'PRODUCTION_100': 'Ready',
    'BOOKED': 'Booked', 'LOADED': 'Loaded', 'SAILED': 'Transit',
    'ARRIVED': 'Arrived', 'CUSTOMS_FILED': 'Customs', 'CLEARED': 'Cleared',
    'DELIVERED': 'Delivered', 'AFTER_SALES': 'After-Sales',
    'COMPLETED': 'Completed', 'COMPLETED_EDITING': 'Editing',
  }
  return map[status] || status || '—'
}

function stageCategory(status) {
  if (!status) return { label: '', cls: 'text-slate-400' }
  if (['PRODUCTION_60','PRODUCTION_80','PRODUCTION_90','PLAN_PACKING','FINAL_PI','PRODUCTION_100'].includes(status))
    return { label: 'Production', cls: 'text-blue-400' }
  if (['BOOKED','LOADED','SAILED','ARRIVED'].includes(status))
    return { label: 'Transit', cls: 'text-violet-400' }
  if (['CUSTOMS_FILED','CLEARED'].includes(status))
    return { label: 'Customs', cls: 'text-amber-400' }
  if (['DELIVERED','AFTER_SALES','COMPLETED','COMPLETED_EDITING'].includes(status))
    return { label: 'Delivery', cls: 'text-emerald-400' }
  return { label: 'Processing', cls: 'text-slate-400' }
}

onMounted(fetchItems)
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">After-Sales Claims</h1>
        <p class="text-sm text-slate-500 mt-1">Track quality issues, resolutions, and carry-forward across all orders</p>
      </div>
      <button @click="fetchItems" :disabled="loading" class="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-2">
        <i class="pi pi-refresh text-xs" :class="{ 'pi-spin': loading }" />
        Refresh
      </button>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
      <div class="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Total Claims</p>
            <p class="text-2xl font-bold text-slate-800 mt-1">{{ summary.open + summary.in_progress + summary.resolved }}</p>
          </div>
          <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
            <i class="pi pi-list text-slate-500" />
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-4 border-l-4 border-l-amber-400 border border-slate-100">
        <p class="text-[10px] font-medium text-amber-500 uppercase tracking-wider">Open</p>
        <p class="text-2xl font-bold text-amber-700 mt-1">{{ summary.open }}</p>
        <p class="text-[10px] text-slate-400 mt-0.5">Awaiting review</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-4 border-l-4 border-l-blue-400 border border-slate-100">
        <p class="text-[10px] font-medium text-blue-500 uppercase tracking-wider">In Progress</p>
        <p class="text-2xl font-bold text-blue-700 mt-1">{{ summary.in_progress }}</p>
        <p class="text-[10px] text-slate-400 mt-0.5">Being processed</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-4 border-l-4 border-l-emerald-400 border border-slate-100">
        <p class="text-[10px] font-medium text-emerald-500 uppercase tracking-wider">Resolved</p>
        <p class="text-2xl font-bold text-emerald-700 mt-1">{{ summary.resolved }}</p>
        <p class="text-[10px] text-slate-400 mt-0.5">Completed</p>
      </div>
      <div class="bg-white rounded-xl shadow-sm p-4 border-l-4 border-l-rose-400 border border-slate-100">
        <p class="text-[10px] font-medium text-rose-500 uppercase tracking-wider">Claim Value</p>
        <p class="text-xl font-bold text-rose-700 mt-1">{{ formatINR(summary.total_claim_value) }}</p>
        <p class="text-[10px] text-slate-400 mt-0.5">{{ summary.pending_carry_forward }} pending carry-forward</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
      <div class="flex items-center gap-4 flex-wrap">
        <div class="flex items-center gap-2">
          <label class="text-xs font-medium text-slate-500">Status</label>
          <select v-model="statusFilter" class="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none">
            <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs font-medium text-slate-500">Issue Type</label>
          <select v-model="objectionFilter" class="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none">
            <option v-for="opt in objectionOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs font-medium text-slate-500">Resolution</label>
          <select v-model="resolutionFilter" class="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 outline-none">
            <option v-for="opt in resolutionOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>
        <div class="text-xs text-slate-400 ml-auto">
          {{ filteredItems.length }} claim{{ filteredItems.length !== 1 ? 's' : '' }}
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <i class="pi pi-spin pi-spinner text-2xl text-emerald-500" />
      <span class="ml-3 text-sm text-slate-500">Loading claims...</span>
    </div>

    <!-- Table -->
    <div v-else-if="filteredItems.length > 0" class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-100 bg-slate-50/50">
              <th class="text-left py-3 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Order</th>
              <th class="text-left py-3 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Client</th>
              <th class="text-left py-3 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Factory</th>
              <th class="text-left py-3 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Product</th>
              <th class="text-center py-3 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Issue</th>
              <th class="text-center py-3 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Qty</th>
              <th class="text-right py-3 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Claim Value</th>
              <th class="text-center py-3 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Resolution</th>
              <th class="text-center py-3 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th class="text-center py-3 px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Carry Fwd</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr v-for="item in filteredItems" :key="item.id"
              @click="goToOrder(item)"
              class="hover:bg-emerald-50/30 cursor-pointer transition-colors"
              :class="item.status === 'OPEN' ? 'bg-amber-50/20' : item.carry_forward_status === 'PENDING' ? 'bg-rose-50/20' : ''">
              <td class="py-3 px-4">
                <span class="font-mono text-xs font-medium text-emerald-700 hover:underline">{{ item.order_number }}</span>
              </td>
              <td class="py-3 px-4 text-xs text-slate-600">{{ item.client_name }}</td>
              <td class="py-3 px-4 text-xs text-slate-500">{{ item.factory_name || '—' }}</td>
              <td class="py-3 px-4">
                <div class="font-mono text-[10px] text-slate-400">{{ item.product_code }}</div>
                <div class="text-xs text-slate-700 mt-0.5 max-w-[180px] truncate">{{ item.product_name }}</div>
              </td>
              <td class="py-3 px-4 text-center">
                <span v-if="item.objection_type" class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="issueColor(item.objection_type)">
                  {{ formatType(item.objection_type) }}
                </span>
                <span v-else class="text-slate-300">—</span>
              </td>
              <td class="py-3 px-4 text-center font-medium text-slate-700">{{ item.affected_quantity || 0 }}</td>
              <td class="py-3 px-4 text-right font-medium" :class="item.claim_value > 0 ? 'text-rose-600' : 'text-slate-400'">
                {{ item.claim_value > 0 ? formatINR(item.claim_value) : '—' }}
              </td>
              <td class="py-3 px-4 text-center">
                <span v-if="item.resolution_type" class="text-[10px] font-medium text-slate-600">
                  {{ formatType(item.resolution_type) }}
                </span>
                <span v-else class="text-[10px] text-slate-300">Pending</span>
              </td>
              <td class="py-3 px-4 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="statusColor(item.status)">
                  {{ formatType(item.status) }}
                </span>
              </td>
              <td class="py-3 px-4">
                <div v-if="stepperState(item) >= 0" class="group relative">
                  <div class="flex items-center gap-0.5 justify-center cursor-default">
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
                  <!-- Hover tooltip -->
                  <div v-if="item.added_to_order_number"
                    class="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white rounded-lg shadow-lg text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div class="font-bold">{{ item.added_to_order_number }}</div>
                    <div class="flex items-center gap-1.5 mt-0.5">
                      <span :class="stageCategory(item.added_to_order_status).cls" class="font-semibold">
                        {{ stageCategory(item.added_to_order_status).label }}
                      </span>
                      <span class="text-slate-500">·</span>
                      <span>{{ orderStageLabel(item.added_to_order_status) }}</span>
                    </div>
                    <div class="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></div>
                  </div>
                </div>
                <span v-else class="text-[10px] text-slate-300">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="bg-white rounded-xl shadow-sm p-12 border border-slate-100 text-center">
      <i class="pi pi-check-circle text-4xl text-emerald-300 mb-3" />
      <h3 class="text-sm font-medium text-slate-600">No active claims</h3>
      <p class="text-xs text-slate-400 mt-1">All after-sales issues have been resolved or no claims have been filed yet.</p>
    </div>
  </div>
</template>
