<script setup>
import { ref, onMounted, computed } from 'vue'
import { ordersApi } from '../../api'

const props = defineProps({ orderId: String, order: Object })

const data = ref(null)
const loading = ref(true)
const error = ref('')

async function loadReconciliation() {
  loading.value = true
  try {
    const { data: res } = await ordersApi.reconciliation(props.orderId)
    data.value = res
  } catch (e) {
    error.value = e.response?.data?.detail || 'Failed to load reconciliation'
  }
  loading.value = false
}

onMounted(loadReconciliation)

function formatINR(val) {
  if (val == null) return '—'
  const abs = Math.abs(val)
  const formatted = abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (val < 0 ? '-' : '') + '₹' + formatted
}

function formatType(type) {
  return (type || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const r = computed(() => data.value?.reconciliation || {})
const hasFactory = computed(() => !!data.value?.factory)
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-6 text-white">
      <div class="flex items-center gap-3 mb-2">
        <i class="pi pi-check-square text-xl" />
        <h2 class="text-lg font-bold">Final Draft — Order Reconciliation</h2>
      </div>
      <p class="text-slate-300 text-sm">Complete financial summary after order completion, claims resolution, and carry-forward processing.</p>
    </div>

    <div v-if="loading" class="py-12 text-center text-slate-400">
      <i class="pi pi-spinner pi-spin text-xl mb-2" />
      <p class="text-sm">Calculating reconciliation...</p>
    </div>

    <div v-else-if="error" class="py-12 text-center text-red-500">{{ error }}</div>

    <template v-else-if="data">
      <!-- ═══ A. ORDER SUMMARY ═══ -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 class="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <i class="pi pi-box text-emerald-600" /> Order Summary
        </h3>
        <div class="grid grid-cols-3 gap-4">
          <div class="bg-slate-50 rounded-lg p-4 text-center">
            <p class="text-[10px] text-slate-400 uppercase tracking-wider">Originally Ordered</p>
            <p class="text-2xl font-bold text-slate-800">{{ data.items.original_count }}</p>
            <p class="text-xs text-slate-500">{{ data.items.original_qty.toLocaleString() }} units</p>
          </div>
          <div class="bg-emerald-50 rounded-lg p-4 text-center">
            <p class="text-[10px] text-emerald-600 uppercase tracking-wider">Shipped</p>
            <p class="text-2xl font-bold text-emerald-700">{{ data.items.shipped_count }}</p>
            <p class="text-xs text-emerald-600">{{ data.items.shipped_qty.toLocaleString() }} units</p>
          </div>
          <div class="bg-amber-50 rounded-lg p-4 text-center">
            <p class="text-[10px] text-amber-600 uppercase tracking-wider">Carried Forward</p>
            <p class="text-2xl font-bold text-amber-700">{{ data.items.migrated_count }}</p>
            <p class="text-xs text-amber-600">{{ data.items.migrated_qty.toLocaleString() }} units</p>
          </div>
        </div>
      </div>

      <!-- ═══ B. FINANCIAL RECONCILIATION ═══ -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 class="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <i class="pi pi-calculator text-indigo-600" /> Financial Reconciliation
        </h3>

        <div class="space-y-3">
          <!-- Original PI -->
          <div class="flex items-center justify-between py-2 border-b border-slate-100">
            <span class="text-sm text-slate-600">Original Proforma Invoice</span>
            <span class="font-medium text-slate-800">{{ formatINR(r.original_pi_total) }}</span>
          </div>
          <!-- Migrated reduction -->
          <div class="flex items-center justify-between py-2 border-b border-slate-100">
            <span class="text-sm text-slate-500 pl-4">Less: Migrated items (carried to next order)</span>
            <span class="font-medium text-amber-600">-{{ formatINR(r.migrated_value) }}</span>
          </div>
          <!-- Revised PI -->
          <div class="flex items-center justify-between py-2 border-b-2 border-slate-200 bg-slate-50 -mx-5 px-5">
            <span class="text-sm font-bold text-slate-800">Revised PI Total (Shipped Value)</span>
            <span class="font-bold text-lg text-slate-800">{{ formatINR(r.revised_pi_total) }}</span>
          </div>

          <!-- Payments -->
          <div class="flex items-center justify-between py-2 border-b border-slate-100 mt-2">
            <span class="text-sm text-slate-600">Total Client Payments ({{ data.payments.payment_count }} payment{{ data.payments.payment_count !== 1 ? 's' : '' }})</span>
            <span class="font-medium text-emerald-700">{{ formatINR(r.total_paid) }}</span>
          </div>

          <!-- Claims -->
          <div v-if="r.total_claim_value > 0" class="flex items-center justify-between py-2 border-b border-slate-100">
            <span class="text-sm text-slate-600">After-Sales Claims Value ({{ data.claims.total_claims }} issue{{ data.claims.total_claims !== 1 ? 's' : '' }})</span>
            <span class="font-medium text-rose-600">{{ formatINR(r.total_claim_value) }}</span>
          </div>

          <!-- Compensation -->
          <div v-if="r.compensate_value > 0" class="flex items-center justify-between py-2 border-b border-slate-100">
            <span class="text-sm text-slate-500 pl-4">Compensation credit to client</span>
            <span class="font-medium text-emerald-600">+{{ formatINR(r.compensate_value) }}</span>
          </div>

          <!-- Replacement -->
          <div v-if="r.replace_value > 0" class="flex items-center justify-between py-2 border-b border-slate-100">
            <span class="text-sm text-slate-500 pl-4">Replacement items (next order, ₹0 cost)</span>
            <span class="font-medium text-blue-600">{{ formatINR(r.replace_value) }}</span>
          </div>

          <!-- NET POSITION -->
          <div class="flex items-center justify-between py-4 bg-gradient-to-r from-slate-50 to-white -mx-5 px-5 rounded-b-xl mt-2">
            <div>
              <span class="text-sm font-bold text-slate-800">Final Net Position</span>
              <p class="text-[10px] text-slate-400 mt-0.5">Paid minus revised PI plus adjustments</p>
            </div>
            <span class="font-bold text-2xl" :class="r.final_net_position >= 0 ? 'text-emerald-700' : 'text-rose-700'">
              {{ formatINR(r.final_net_position) }}
            </span>
          </div>

          <div v-if="r.final_net_position > 0" class="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
            <i class="pi pi-info-circle mr-1" />
            Client has a credit balance of {{ formatINR(r.final_net_position) }} that can be applied to future orders.
          </div>
          <div v-else-if="r.final_net_position < 0" class="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700">
            <i class="pi pi-exclamation-triangle mr-1" />
            Outstanding balance of {{ formatINR(Math.abs(r.final_net_position)) }} due from client.
          </div>
          <div v-if="r.pending_replacements > 0" class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
            <i class="pi pi-arrow-right mr-1" />
            {{ r.pending_replacements }} replacement item{{ r.pending_replacements !== 1 ? 's' : '' }} pending carry-forward to next order.
          </div>
        </div>
      </div>

      <!-- ═══ C. CLAIMS DETAIL ═══ -->
      <div v-if="data.claims.total_claims > 0" class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100">
          <h3 class="font-bold text-slate-800 flex items-center gap-2">
            <i class="pi pi-exclamation-triangle text-amber-600" /> Claims Breakdown
          </h3>
        </div>
        <table class="w-full text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Product</th>
              <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Issue</th>
              <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Sent</th>
              <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Received</th>
              <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Claim Qty</th>
              <th class="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase">Value</th>
              <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Resolution</th>
              <th class="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr v-for="(item, i) in data.claims.items" :key="i" class="hover:bg-slate-50/30">
              <td class="px-4 py-3">
                <div class="font-mono text-[10px] text-slate-400">{{ item.product_code }}</div>
                <div class="text-xs text-slate-700">{{ item.product_name }}</div>
              </td>
              <td class="px-4 py-3 text-center">
                <span class="text-[10px] font-medium text-amber-600">{{ formatType(item.issue_type) }}</span>
              </td>
              <td class="px-4 py-3 text-center text-xs">{{ item.sent_qty }}</td>
              <td class="px-4 py-3 text-center text-xs" :class="item.received_qty < item.sent_qty ? 'text-red-600 font-medium' : ''">
                {{ item.received_qty }}
              </td>
              <td class="px-4 py-3 text-center text-xs font-medium text-rose-600">{{ item.affected_qty }}</td>
              <td class="px-4 py-3 text-right text-xs font-medium text-rose-600">{{ formatINR(item.claim_value) }}</td>
              <td class="px-4 py-3 text-center">
                <span v-if="item.resolution" class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100">
                  {{ formatType(item.resolution) }}
                </span>
                <span v-else class="text-[10px] text-slate-300">Pending</span>
              </td>
              <td class="px-4 py-3 text-center">
                <span class="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  :class="item.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-700' : item.status === 'OPEN' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'">
                  {{ formatType(item.status) }}
                </span>
              </td>
            </tr>
          </tbody>
          <tfoot class="bg-slate-50 border-t-2 border-slate-200">
            <tr>
              <td class="px-4 py-3 font-bold text-xs" colspan="4">Total Claims</td>
              <td class="px-4 py-3 text-center font-bold text-xs text-rose-600">{{ data.claims.total_claim_qty }}</td>
              <td class="px-4 py-3 text-right font-bold text-xs text-rose-600">{{ formatINR(data.claims.total_claim_value) }}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- ═══ D. PAYMENT HISTORY ═══ -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100">
          <h3 class="font-bold text-slate-800 flex items-center gap-2">
            <i class="pi pi-wallet text-emerald-600" /> Payment History
          </h3>
        </div>
        <table class="w-full text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Date</th>
              <th class="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Type</th>
              <th class="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Method</th>
              <th class="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Reference</th>
              <th class="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase">Amount (INR)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr v-for="(p, i) in data.payments.payments" :key="i">
              <td class="px-4 py-3 text-xs text-slate-500">{{ p.date ? new Date(p.date).toLocaleDateString() : '—' }}</td>
              <td class="px-4 py-3 text-xs">{{ formatType(p.type) }}</td>
              <td class="px-4 py-3 text-xs text-slate-600">{{ (p.method || '').replace(/_/g, ' ') }}</td>
              <td class="px-4 py-3 text-xs text-slate-400">{{ p.reference || '—' }}</td>
              <td class="px-4 py-3 text-right font-medium text-emerald-700">{{ formatINR(p.amount_inr) }}</td>
            </tr>
          </tbody>
          <tfoot class="bg-slate-50 border-t-2 border-slate-200">
            <tr>
              <td class="px-4 py-3 font-bold text-xs" colspan="4">Total Paid</td>
              <td class="px-4 py-3 text-right font-bold text-emerald-700">{{ formatINR(data.payments.total_paid) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- ═══ E. ADMIN-ONLY: FACTORY MARGIN ═══ -->
      <div v-if="hasFactory" class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 class="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <i class="pi pi-building text-violet-600" /> Factory Cost & Margin
          <span class="text-[10px] font-medium bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">Admin Only</span>
        </h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-violet-50 rounded-lg p-3">
            <p class="text-[10px] text-violet-500 uppercase">Factory</p>
            <p class="font-medium text-sm text-slate-700">{{ data.factory.name }}</p>
          </div>
          <div class="bg-violet-50 rounded-lg p-3">
            <p class="text-[10px] text-violet-500 uppercase">Factory Cost (CNY)</p>
            <p class="font-bold text-sm text-slate-800">¥{{ data.factory.total_cny?.toLocaleString() }}</p>
            <p class="text-[10px] text-slate-400">Rate: {{ data.factory.exchange_rate }}</p>
          </div>
          <div class="bg-violet-50 rounded-lg p-3">
            <p class="text-[10px] text-violet-500 uppercase">Factory Cost (INR)</p>
            <p class="font-bold text-sm text-slate-800">{{ formatINR(data.factory.total_inr) }}</p>
          </div>
          <div class="rounded-lg p-3" :class="data.factory.margin_inr >= 0 ? 'bg-emerald-50' : 'bg-rose-50'">
            <p class="text-[10px] uppercase" :class="data.factory.margin_inr >= 0 ? 'text-emerald-500' : 'text-rose-500'">Gross Margin</p>
            <p class="font-bold text-sm" :class="data.factory.margin_inr >= 0 ? 'text-emerald-700' : 'text-rose-700'">
              {{ formatINR(data.factory.margin_inr) }}
            </p>
            <p class="text-[10px] text-slate-400">
              {{ r.revised_pi_total > 0 ? Math.round(data.factory.margin_inr / r.revised_pi_total * 100) : 0 }}% margin
            </p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
