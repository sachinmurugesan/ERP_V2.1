<script setup>
import { ref, computed, onMounted } from 'vue'
import { ordersApi } from '../../api'

const loading = ref(true)
const error = ref('')
const ledger = ref(null)

async function loadLedger() {
  try {
    const { data } = await ordersApi.myLedger()
    ledger.value = data
  } catch (e) {
    error.value = e.response?.data?.detail || 'Failed to load statement'
  }
  loading.value = false
}

onMounted(loadLedger)

const summary = computed(() => ledger.value?.summary || {})

// Merge orders + payments into a single timeline, sorted by date desc
const transactions = computed(() => {
  if (!ledger.value) return []
  const rows = []

  for (const o of (ledger.value.orders || [])) {
    rows.push({
      type: 'order',
      date: o.created_at,
      label: `Order ${o.order_number || '-'}`,
      detail: `${o.item_count} items`,
      amount: o.total_inr,
      is_final: o.is_final,
      status: o.status,
      debit: true,
    })
  }

  for (const p of (ledger.value.payments || [])) {
    // Find order number for this payment
    const matchOrder = (ledger.value.orders || []).find(o => o.id === p.order_id)
    rows.push({
      type: 'payment',
      date: p.payment_date,
      label: (p.payment_type || '').replace(/_/g, ' '),
      detail: `${(p.method || '').replace(/_/g, ' ')}${p.reference ? ' — ' + p.reference : ''}${matchOrder ? ' (' + matchOrder.order_number + ')' : ''}`,
      amount: p.amount_inr,
      is_final: true,
      debit: false,
    })
  }

  rows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
  return rows
})

function formatINR(val) {
  return '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-800">Statement of Account</h1>
      <p class="text-sm text-slate-500">Your payment history and order summaries</p>
    </div>

    <div v-if="loading" class="py-16 text-center text-slate-400"><i class="pi pi-spinner pi-spin mr-2" /> Loading...</div>
    <div v-else-if="error" class="py-16 text-center text-red-500">{{ error }}</div>

    <template v-else-if="ledger">
      <!-- Disclaimer -->
      <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 flex items-start gap-2">
        <i class="pi pi-info-circle text-amber-500 mt-0.5 flex-shrink-0" />
        <p class="text-xs text-amber-700">
          Order values are <strong>approximate</strong> until order completion. Final totals are calculated after delivery and reconciliation.
        </p>
      </div>

      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <!-- Total Paid -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <i class="pi pi-wallet text-emerald-600 text-sm" />
            </div>
            <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Paid</span>
          </div>
          <p class="text-2xl font-bold text-emerald-700">{{ formatINR(summary.total_paid) }}</p>
        </div>

        <!-- Order Total -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <i class="pi pi-shopping-cart text-blue-600 text-sm" />
            </div>
            <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">Order Total</span>
          </div>
          <p class="text-2xl font-bold text-blue-700">{{ formatINR(summary.total_orders) }}</p>
          <div class="flex gap-3 mt-1 text-[10px]">
            <span v-if="summary.total_estimated > 0" class="text-amber-600">Est: {{ formatINR(summary.total_estimated) }}</span>
            <span v-if="summary.total_final > 0" class="text-emerald-600">Final: {{ formatINR(summary.total_final) }}</span>
          </div>
        </div>

        <!-- Net Position -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center"
              :class="summary.net_position >= 0 ? 'bg-emerald-100' : 'bg-red-100'">
              <i class="pi pi-chart-line text-sm" :class="summary.net_position >= 0 ? 'text-emerald-600' : 'text-red-600'" />
            </div>
            <span class="text-xs font-medium text-slate-500 uppercase tracking-wide">Net Position</span>
          </div>
          <p class="text-2xl font-bold" :class="summary.net_position >= 0 ? 'text-emerald-700' : 'text-red-700'">
            {{ formatINR(Math.abs(summary.net_position)) }}
          </p>
          <p class="text-[10px] mt-1" :class="summary.net_position >= 0 ? 'text-emerald-500' : 'text-red-500'">
            {{ summary.net_position >= 0 ? 'Credit (Overpaid)' : 'Balance Due' }}
          </p>
        </div>
      </div>

      <!-- Transactions Table -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-5 py-4 border-b border-slate-100">
          <h2 class="font-bold text-slate-800">Transactions</h2>
          <p class="text-xs text-slate-400">{{ transactions.length }} entries</p>
        </div>

        <div v-if="!transactions.length" class="py-12 text-center text-slate-400 text-sm">No transactions yet</div>

        <table v-else class="w-full text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-4 py-3 text-left font-semibold text-slate-600">Date</th>
              <th class="px-4 py-3 text-left font-semibold text-slate-600">Transaction</th>
              <th class="px-4 py-3 text-left font-semibold text-slate-600">Details</th>
              <th class="px-4 py-3 text-center font-semibold text-slate-600">Status</th>
              <th class="px-4 py-3 text-right font-semibold text-slate-600">Debit (INR)</th>
              <th class="px-4 py-3 text-right font-semibold text-slate-600">Credit (INR)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(tx, i) in transactions" :key="i" class="border-t border-slate-50 hover:bg-slate-50/50">
              <td class="px-4 py-3 text-xs text-slate-500">
                {{ tx.date ? new Date(tx.date).toLocaleDateString() : '-' }}
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <i :class="tx.type === 'payment' ? 'pi pi-arrow-down text-emerald-500' : 'pi pi-file text-blue-500'" class="text-xs" />
                  <span class="font-medium text-slate-700">{{ tx.label }}</span>
                </div>
              </td>
              <td class="px-4 py-3 text-xs text-slate-500">{{ tx.detail }}</td>
              <td class="px-4 py-3 text-center">
                <span v-if="tx.type === 'order'"
                  class="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  :class="tx.is_final ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
                >
                  {{ tx.is_final ? 'FINAL' : 'APPROX' }}
                </span>
                <span v-else class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">
                  CONFIRMED
                </span>
              </td>
              <td class="px-4 py-3 text-right font-medium" :class="tx.debit ? 'text-blue-700' : 'text-slate-300'">
                {{ tx.debit ? formatINR(tx.amount) : '-' }}
              </td>
              <td class="px-4 py-3 text-right font-medium" :class="!tx.debit ? 'text-emerald-700' : 'text-slate-300'">
                {{ !tx.debit ? formatINR(tx.amount) : '-' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
