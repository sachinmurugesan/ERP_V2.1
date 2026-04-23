<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { afterSalesApi } from '../../api'

const router = useRouter()
const claims = ref([])
const loading = ref(true)

async function loadClaims() {
  try {
    const { data } = await afterSalesApi.list({ limit: 200 })
    claims.value = Array.isArray(data) ? data : (data.items || [])
  } catch (_e) {
    claims.value = []
  }
  loading.value = false
}

onMounted(loadClaims)

// Group claims by order
const orderGroups = computed(() => {
  const groups = {}
  for (const c of claims.value) {
    const key = c.order_id || c.order_number || 'unknown'
    if (!groups[key]) {
      groups[key] = {
        order_id: c.order_id,
        order_number: c.order_number || '-',
        items: [],
        total_claim_qty: 0,
        total_claim_value: 0,
        open: 0,
        in_progress: 0,
        resolved: 0,
      }
    }
    groups[key].items.push(c)
    groups[key].total_claim_qty += c.affected_quantity || 0
    groups[key].total_claim_value += (c.claim_value || 0)
    if (c.status === 'OPEN') groups[key].open++
    else if (c.status === 'IN_PROGRESS') groups[key].in_progress++
    else if (c.status === 'RESOLVED') groups[key].resolved++
  }
  return Object.values(groups)
})

// Summary totals
const summary = computed(() => {
  const all = claims.value
  return {
    total: all.length,
    open: all.filter(c => c.status === 'OPEN').length,
    in_progress: all.filter(c => c.status === 'IN_PROGRESS').length,
    resolved: all.filter(c => c.status === 'RESOLVED').length,
    total_value: all.reduce((s, c) => s + (c.claim_value || 0), 0),
  }
})

// Expand/collapse per order
const expandedOrders = ref(new Set())
function toggleOrder(orderId) {
  const s = new Set(expandedOrders.value)
  if (s.has(orderId)) s.delete(orderId)
  else s.add(orderId)
  expandedOrders.value = s
}

function goToOrder(orderId) {
  router.push(`/client-portal/orders/${orderId}`)
}

const statusColors = {
  OPEN: 'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-slate-100 text-slate-600',
}

function formatType(type) {
  return (type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatINR(val) {
  return val != null && val > 0 ? '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
}

function issueIcon(type) {
  switch (type) {
    case 'PRODUCT_MISSING': return 'pi-box'
    case 'PRODUCT_MISMATCH': return 'pi-exclamation-triangle'
    case 'QUALITY_ISSUE': return 'pi-flag'
    case 'PRICE_MISMATCH': return 'pi-calculator'
    default: return 'pi-info-circle'
  }
}

function issueColor(type) {
  switch (type) {
    case 'PRODUCT_MISSING': return 'text-red-600'
    case 'PRODUCT_MISMATCH': return 'text-orange-600'
    case 'QUALITY_ISSUE': return 'text-amber-600'
    case 'PRICE_MISMATCH': return 'text-violet-600'
    default: return 'text-slate-500'
  }
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
  if (item.status === 'RESOLVED') return 0
  return -1
}

function orderStageLabel(status) {
  const map = {
    'DRAFT': 'Draft', 'CLIENT_DRAFT': 'Inquiry',
    'PENDING_PI': 'Pricing', 'PI_SENT': 'PI Sent',
    'ADVANCE_PENDING': 'Advance Pending', 'ADVANCE_RECEIVED': 'Advance Received',
    'FACTORY_ORDERED': 'Factory Ordered',
    'PRODUCTION_60': 'Production 60%', 'PRODUCTION_80': 'Production 80%',
    'PRODUCTION_90': 'Production 90%', 'PLAN_PACKING': 'Packing',
    'FINAL_PI': 'Final PI', 'PRODUCTION_100': 'Ready to Ship',
    'BOOKED': 'Booked', 'LOADED': 'Loaded', 'SAILED': 'In Transit',
    'ARRIVED': 'Arrived', 'CUSTOMS_FILED': 'Customs', 'CLEARED': 'Cleared',
    'DELIVERED': 'Delivered', 'AFTER_SALES': 'After-Sales',
    'COMPLETED': 'Completed', 'COMPLETED_EDITING': 'Completed (Editing)',
  }
  return map[status] || status || '—'
}

function stageCategory(status) {
  if (!status) return { label: '', cls: '' }
  if (['PRODUCTION_60','PRODUCTION_80','PRODUCTION_90','PLAN_PACKING','FINAL_PI','PRODUCTION_100'].includes(status))
    return { label: 'Production', cls: 'text-blue-600' }
  if (['BOOKED','LOADED','SAILED','ARRIVED'].includes(status))
    return { label: 'Transit', cls: 'text-violet-600' }
  if (['CUSTOMS_FILED','CLEARED'].includes(status))
    return { label: 'Customs', cls: 'text-amber-600' }
  if (['DELIVERED','AFTER_SALES','COMPLETED','COMPLETED_EDITING'].includes(status))
    return { label: 'Delivery', cls: 'text-emerald-600' }
  return { label: 'Processing', cls: 'text-slate-500' }
}
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">After-Sales Claims</h1>
        <p class="text-sm text-slate-500 mt-1">Track your product issues and resolutions across all orders</p>
      </div>
      <button @click="loadClaims" :disabled="loading"
        class="px-3 py-1.5 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5">
        <i class="pi pi-refresh text-xs" :class="{ 'pi-spin': loading }" /> Refresh
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="py-16 text-center text-slate-400">
      <i class="pi pi-spinner pi-spin text-2xl mb-3" />
      <p class="text-sm">Loading claims...</p>
    </div>

    <template v-else-if="claims.length > 0">
      <!-- Summary Cards -->
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <div class="bg-white rounded-xl border border-slate-200 p-4">
          <p class="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Total Claims</p>
          <p class="text-2xl font-bold text-slate-800 mt-1">{{ summary.total }}</p>
        </div>
        <div class="bg-white rounded-xl border-l-4 border-l-amber-400 border border-slate-200 p-4">
          <p class="text-[10px] font-medium text-amber-500 uppercase tracking-wider">Open</p>
          <p class="text-2xl font-bold text-amber-700 mt-1">{{ summary.open }}</p>
          <p class="text-[10px] text-slate-400">Awaiting review</p>
        </div>
        <div class="bg-white rounded-xl border-l-4 border-l-blue-400 border border-slate-200 p-4">
          <p class="text-[10px] font-medium text-blue-500 uppercase tracking-wider">In Progress</p>
          <p class="text-2xl font-bold text-blue-700 mt-1">{{ summary.in_progress }}</p>
          <p class="text-[10px] text-slate-400">Being reviewed</p>
        </div>
        <div class="bg-white rounded-xl border-l-4 border-l-emerald-400 border border-slate-200 p-4">
          <p class="text-[10px] font-medium text-emerald-500 uppercase tracking-wider">Resolved</p>
          <p class="text-2xl font-bold text-emerald-700 mt-1">{{ summary.resolved }}</p>
          <p class="text-[10px] text-slate-400">Completed</p>
        </div>
        <div class="bg-white rounded-xl border-l-4 border-l-rose-400 border border-slate-200 p-4">
          <p class="text-[10px] font-medium text-rose-500 uppercase tracking-wider">Claim Value</p>
          <p class="text-xl font-bold text-rose-700 mt-1">{{ formatINR(summary.total_value) }}</p>
          <p class="text-[10px] text-slate-400">Total affected</p>
        </div>
      </div>

      <!-- Order-wise Accordion -->
      <div class="space-y-3">
        <div v-for="group in orderGroups" :key="group.order_id" class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <!-- Order Header (clickable) -->
          <div
            @click="toggleOrder(group.order_id)"
            class="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors">
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <i class="pi pi-file text-emerald-600 text-sm" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-slate-800">{{ group.order_number }}</span>
                  <span class="text-xs text-slate-400">{{ group.items.length }} claim{{ group.items.length !== 1 ? 's' : '' }}</span>
                </div>
                <div class="flex items-center gap-3 mt-1">
                  <span v-if="group.open > 0" class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                    {{ group.open }} Open
                  </span>
                  <span v-if="group.in_progress > 0" class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                    {{ group.in_progress }} In Progress
                  </span>
                  <span v-if="group.resolved > 0" class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">
                    {{ group.resolved }} Resolved
                  </span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-4">
              <!-- Claim total for this order -->
              <div class="text-right">
                <p class="text-xs text-slate-400">Claim Value</p>
                <p class="font-bold text-sm" :class="group.total_claim_value > 0 ? 'text-rose-600' : 'text-slate-400'">
                  {{ formatINR(group.total_claim_value) }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <button @click.stop="goToOrder(group.order_id)"
                  class="px-2.5 py-1 text-[10px] font-medium text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-50">
                  View Order
                </button>
                <i class="pi text-slate-400 text-xs transition-transform"
                  :class="expandedOrders.has(group.order_id) ? 'pi-chevron-up' : 'pi-chevron-down'" />
              </div>
            </div>
          </div>

          <!-- Expanded: Items Table -->
          <div v-if="expandedOrders.has(group.order_id)" class="border-t border-slate-100">
            <table class="w-full text-sm">
              <thead class="bg-slate-50/80">
                <tr>
                  <th class="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Product</th>
                  <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Issue</th>
                  <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Sent</th>
                  <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Received</th>
                  <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Claim Qty</th>
                  <th class="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Value</th>
                  <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Resolution</th>
                  <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Progress</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-50">
                <tr v-for="item in group.items" :key="item.id" class="hover:bg-slate-50/30">
                  <td class="px-4 py-3">
                    <div class="font-mono text-[10px] text-slate-400">{{ item.product_code }}</div>
                    <div class="text-xs text-slate-700 mt-0.5">{{ item.product_name }}</div>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <div v-if="item.objection_type" class="flex items-center justify-center gap-1">
                      <i class="pi text-xs" :class="[issueIcon(item.objection_type), issueColor(item.objection_type)]" />
                      <span class="text-[10px] font-medium" :class="issueColor(item.objection_type)">
                        {{ formatType(item.objection_type) }}
                      </span>
                    </div>
                    <span v-else class="text-slate-300 text-xs">—</span>
                  </td>
                  <td class="px-4 py-3 text-center text-xs text-slate-600">{{ item.sent_qty || '—' }}</td>
                  <td class="px-4 py-3 text-center text-xs" :class="item.received_qty < item.sent_qty ? 'text-red-600 font-medium' : 'text-slate-600'">
                    {{ item.received_qty ?? '—' }}
                  </td>
                  <td class="px-4 py-3 text-center text-xs font-medium" :class="(item.affected_quantity || 0) > 0 ? 'text-rose-600' : 'text-slate-400'">
                    {{ item.affected_quantity || 0 }}
                  </td>
                  <td class="px-4 py-3 text-right text-xs font-medium" :class="(item.claim_value || 0) > 0 ? 'text-rose-600' : 'text-slate-400'">
                    {{ (item.claim_value || 0) > 0 ? formatINR(item.claim_value) : '—' }}
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span v-if="item.resolution_type" class="text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                      {{ formatType(item.resolution_type) }}
                    </span>
                    <span v-else class="text-[10px] text-slate-300">Pending</span>
                  </td>
                  <td class="px-4 py-3 text-center">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="statusColors[item.status] || 'bg-slate-100'">
                      {{ formatType(item.status) }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <div v-if="stepperState(item) >= 0" class="group relative">
                      <!-- Stepper -->
                      <div class="flex items-center gap-0.5 justify-center cursor-default">
                        <template v-for="(step, si) in STEPPER_STEPS" :key="si">
                          <div class="flex items-center gap-1">
                            <div class="w-5 h-5 rounded-full flex items-center justify-center text-[9px]"
                              :class="si <= stepperState(item)
                                ? si === stepperState(item) ? 'bg-emerald-500 text-white' : 'bg-emerald-200 text-emerald-700'
                                : 'bg-slate-100 text-slate-400'">
                              <i :class="'pi ' + step.icon" style="font-size: 9px;" />
                            </div>
                            <span class="text-[9px] font-medium hidden lg:inline"
                              :class="si <= stepperState(item) ? 'text-emerald-700' : 'text-slate-400'">{{ step.label }}</span>
                          </div>
                          <div v-if="si < STEPPER_STEPS.length - 1" class="w-4 h-px mx-0.5"
                            :class="si < stepperState(item) ? 'bg-emerald-300' : 'bg-slate-200'" />
                        </template>
                      </div>
                      <!-- Hover tooltip: destination order + stage -->
                      <div v-if="item.added_to_order_number"
                        class="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-slate-800 text-white rounded-lg shadow-lg text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div class="font-bold">{{ item.added_to_order_number }}</div>
                        <div class="flex items-center gap-1.5 mt-0.5">
                          <span :class="stageCategory(item.added_to_order_status).cls" class="font-semibold">
                            {{ stageCategory(item.added_to_order_status).label }}
                          </span>
                          <span class="text-slate-400">·</span>
                          <span>{{ orderStageLabel(item.added_to_order_status) }}</span>
                        </div>
                        <div class="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-800"></div>
                      </div>
                    </div>
                    <span v-else class="text-[10px] text-slate-300">—</span>
                  </td>
                </tr>
              </tbody>
              <!-- Order Total Row -->
              <tfoot class="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td class="px-4 py-3 font-bold text-xs text-slate-700" colspan="4">Order Total</td>
                  <td class="px-4 py-3 text-center font-bold text-xs text-rose-600">{{ group.total_claim_qty }}</td>
                  <td class="px-4 py-3 text-right font-bold text-xs text-rose-600">{{ formatINR(group.total_claim_value) }}</td>
                  <td colspan="3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </template>

    <!-- Empty State -->
    <div v-else class="py-20 text-center">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
        <i class="pi pi-check-circle text-2xl text-emerald-500" />
      </div>
      <h2 class="text-lg font-bold text-slate-700">No active claims</h2>
      <p class="text-sm text-slate-400 mt-1 max-w-sm mx-auto">If you experience any issues with delivered products, you can submit a claim from the order detail page.</p>
    </div>
  </div>
</template>
