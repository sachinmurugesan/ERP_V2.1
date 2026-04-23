<script setup>
/**
 * Landed Cost Tab — displays full expense breakdown for transparency clients.
 * Only shown on orders at CLEARED stage or beyond.
 */
import { ref, onMounted } from 'vue'
import { ordersApi } from '../../api'

const props = defineProps({
  orderId: { type: String, required: true },
})

const loading = ref(true)
const error = ref(null)
const data = ref(null)
const downloading = ref(false)

async function loadData() {
  loading.value = true
  error.value = null
  try {
    const resp = await ordersApi.getLandedCost(props.orderId)
    data.value = resp.data
  } catch (err) {
    const status = err.response?.status
    const detail = err.response?.data?.detail || 'Failed to load landed cost data'
    if (status === 400) {
      error.value = detail
    } else if (status === 404) {
      error.value = 'Landed cost not available for this order.'
    } else {
      error.value = detail
    }
  } finally {
    loading.value = false
  }
}

onMounted(loadData)

function formatINR(val) {
  if (val == null || isNaN(val)) return '—'
  return '\u20B9' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatLakh(val) {
  if (val == null || isNaN(val) || val === 0) return '—'
  const n = Number(val)
  if (n >= 100000) return '\u20B9' + (n / 100000).toFixed(2) + 'L'
  if (n >= 1000) return '\u20B9' + (n / 1000).toFixed(1) + 'K'
  return formatINR(n)
}

async function downloadExcel() {
  downloading.value = true
  try {
    const resp = await ordersApi.downloadLandedCostExcel(props.orderId)
    const url = window.URL.createObjectURL(new Blob([resp.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `LandedCost_${data.value?.order_number || 'order'}.xlsx`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Download failed:', err)
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="loading" class="py-12 text-center text-slate-400">
      <i class="pi pi-spinner pi-spin text-2xl" />
      <p class="mt-2 text-sm">Loading landed cost data...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="py-12 text-center">
      <i class="pi pi-info-circle text-2xl text-amber-400 mb-2" />
      <p class="text-sm text-slate-600">{{ error }}</p>
    </div>

    <!-- Data -->
    <template v-else-if="data">
      <!-- Header + Download -->
      <div class="flex items-center justify-between mb-5">
        <div>
          <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider">Landed Cost Breakdown</h3>
          <p class="text-xs text-slate-400 mt-0.5">{{ data.order_number }} &middot; {{ data.client_name }}</p>
        </div>
        <button @click="downloadExcel" :disabled="downloading"
          class="px-4 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1.5 disabled:opacity-50">
          <i :class="downloading ? 'pi pi-spinner pi-spin' : 'pi pi-file-excel'" class="text-xs" />
          {{ downloading ? 'Generating...' : 'Download Excel' }}
        </button>
      </div>

      <!-- Summary Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div class="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p class="text-[10px] font-medium text-blue-500 uppercase tracking-wider">Invoice</p>
          <p class="text-xl font-bold text-blue-800 mt-1">{{ formatLakh(data.summary?.total_bill_inr) }}</p>
        </div>
        <div class="bg-amber-50 rounded-xl p-4 border border-amber-100">
          <p class="text-[10px] font-medium text-amber-500 uppercase tracking-wider">Total Expenses</p>
          <p class="text-xl font-bold text-amber-800 mt-1">{{ formatLakh(data.summary?.total_expenses_inr) }}</p>
        </div>
        <div class="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
          <p class="text-[10px] font-medium text-indigo-500 uppercase tracking-wider">Expense %</p>
          <p class="text-xl font-bold text-indigo-800 mt-1">{{ (data.summary?.expense_percent || 0).toFixed(2) }}%</p>
        </div>
        <div class="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
          <p class="text-[10px] font-medium text-emerald-500 uppercase tracking-wider">Grand Total</p>
          <p class="text-xl font-bold text-emerald-800 mt-1">{{ formatLakh(data.summary?.grand_total_inr) }}</p>
        </div>
      </div>

      <!-- Expense Breakdown Table -->
      <div class="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6">
        <div class="px-5 py-3 border-b border-slate-100">
          <h4 class="text-xs font-semibold text-slate-600 uppercase tracking-wider">Expense Breakdown</h4>
        </div>
        <table class="w-full text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-5 py-2.5 text-left font-semibold text-slate-600 text-xs">Category</th>
              <th class="px-5 py-2.5 text-right font-semibold text-slate-600 text-xs">Amount (INR)</th>
            </tr>
          </thead>
          <tbody>
            <!-- Invoice row -->
            <tr class="border-b border-slate-100 bg-blue-50/30">
              <td class="px-5 py-3 font-medium text-slate-800">{{ data.invoice?.label }}</td>
              <td class="px-5 py-3 text-right font-bold text-blue-700">{{ formatINR(data.invoice?.amount_inr) }}</td>
            </tr>
            <!-- Expense rows -->
            <tr v-for="(exp, i) in data.expenses" :key="i" class="border-b border-slate-50 hover:bg-slate-50/50">
              <td class="px-5 py-2.5 text-slate-700">{{ exp.label }}</td>
              <td class="px-5 py-2.5 text-right font-mono text-slate-700">{{ formatINR(exp.amount_inr) }}</td>
            </tr>
          </tbody>
          <tfoot class="bg-slate-50 border-t-2 border-slate-200">
            <tr>
              <td class="px-5 py-3 font-bold text-slate-700">Total Bill</td>
              <td class="px-5 py-3 text-right font-bold text-slate-800">{{ formatINR(data.summary?.total_bill_inr) }}</td>
            </tr>
            <tr class="border-t border-slate-200">
              <td class="px-5 py-3 font-bold text-amber-700">Total Expenses</td>
              <td class="px-5 py-3 text-right font-bold text-amber-800">{{ formatINR(data.summary?.total_expenses_inr) }}</td>
            </tr>
            <tr class="border-t-2 border-emerald-300 bg-emerald-50">
              <td class="px-5 py-3 font-bold text-emerald-700 text-base">Grand Total</td>
              <td class="px-5 py-3 text-right font-bold text-emerald-800 text-base">{{ formatINR(data.summary?.grand_total_inr) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Per-Item Breakdown -->
      <div v-if="data.items?.length" class="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div class="px-5 py-3 border-b border-slate-100">
          <h4 class="text-xs font-semibold text-slate-600 uppercase tracking-wider">Per-Item Breakdown</h4>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-3 py-2.5 text-left font-semibold text-slate-600 text-[10px] uppercase w-8">#</th>
                <th class="px-3 py-2.5 text-left font-semibold text-slate-600 text-[10px] uppercase">Product</th>
                <th class="px-3 py-2.5 text-center font-semibold text-slate-600 text-[10px] uppercase w-12">Qty</th>
                <th class="px-3 py-2.5 text-right font-semibold text-slate-600 text-[10px] uppercase">Value</th>
                <th class="px-3 py-2.5 text-right font-semibold text-slate-600 text-[10px] uppercase">Freight</th>
                <th class="px-3 py-2.5 text-right font-semibold text-slate-600 text-[10px] uppercase">Duty</th>
                <th class="px-3 py-2.5 text-right font-semibold text-slate-600 text-[10px] uppercase">Clearance</th>
                <th class="px-3 py-2.5 text-right font-semibold text-slate-600 text-[10px] uppercase">Commission</th>
                <th class="px-3 py-2.5 text-right font-semibold text-emerald-700 text-[10px] uppercase">Landed Cost</th>
                <th class="px-3 py-2.5 text-right font-semibold text-slate-600 text-[10px] uppercase">Per Unit</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="(item, idx) in data.items" :key="idx" class="hover:bg-slate-50/50">
                <td class="px-3 py-2 text-xs text-slate-400">{{ idx + 1 }}</td>
                <td class="px-3 py-2">
                  <div class="font-mono text-[10px] text-slate-400">{{ item.product_code }}</div>
                  <div class="text-xs text-slate-700 truncate max-w-[200px]">{{ item.product_name }}</div>
                </td>
                <td class="px-3 py-2 text-center text-xs font-medium">{{ item.quantity }}</td>
                <td class="px-3 py-2 text-right text-xs font-mono">{{ formatINR(item.item_value_inr) }}</td>
                <td class="px-3 py-2 text-right text-xs font-mono">{{ formatINR(item.freight_share) }}</td>
                <td class="px-3 py-2 text-right text-xs font-mono">{{ formatINR(item.duty_share) }}</td>
                <td class="px-3 py-2 text-right text-xs font-mono">{{ formatINR(item.clearance_share) }}</td>
                <td class="px-3 py-2 text-right text-xs font-mono">{{ formatINR(item.commission_share) }}</td>
                <td class="px-3 py-2 text-right text-xs font-bold text-emerald-700">{{ formatINR(item.total_landed_cost) }}</td>
                <td class="px-3 py-2 text-right text-xs font-mono text-slate-500">{{ formatINR(item.landed_cost_per_unit) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
