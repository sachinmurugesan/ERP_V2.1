<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { financeApi, clientsApi } from '../../api'
import { formatCurrency } from '../../utils/formatters'

const router = useRouter()

const loading = ref(true)
const receivables = ref([])
const summary = ref({ total_outstanding_inr: 0, count: 0 })
const clients = ref([])
const selectedClient = ref('')
const statusFilter = ref('outstanding')

async function loadClients() {
  try {
    const res = await clientsApi.list()
    clients.value = res.data.items || res.data || []
  } catch (e) { console.error(e) }
}

async function loadReceivables() {
  loading.value = true
  try {
    const params = { status: statusFilter.value }
    if (selectedClient.value) params.client_id = selectedClient.value
    const res = await financeApi.receivables(params)
    receivables.value = res.data.receivables || []
    summary.value = res.data.summary || { total_outstanding_inr: 0, count: 0 }
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

watch([selectedClient, statusFilter], loadReceivables)

onMounted(() => {
  loadClients()
  loadReceivables()
})

// formatCurrency imported from utils/formatters

const outstandingClass = (val) => {
  if (val <= 0) return 'text-emerald-600 bg-emerald-50'
  if (val > 100000) return 'text-red-600 bg-red-50'
  return 'text-amber-600 bg-amber-50'
}
</script>

<template>
  <div class="p-6 space-y-5">
    <!-- Summary Card -->
    <div class="bg-gradient-to-r from-red-50 to-amber-50 border border-red-100 rounded-xl p-5">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <p class="text-xs font-medium text-red-400 uppercase tracking-wider">Total Outstanding</p>
          <p class="text-3xl font-bold text-red-700 mt-1">{{ formatCurrency(summary.total_outstanding_inr) }}</p>
        </div>
        <div>
          <p class="text-xs font-medium text-slate-400 uppercase tracking-wider">Orders</p>
          <p class="text-3xl font-bold text-slate-700 mt-1">{{ summary.count }}</p>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-4 flex-wrap">
      <select
        v-model="selectedClient"
        class="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white min-w-[200px]"
      >
        <option value="">All Clients</option>
        <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.company_name }}</option>
      </select>

      <div class="flex bg-slate-100 rounded-lg p-0.5">
        <button
          v-for="s in [{ label: 'Outstanding', value: 'outstanding' }, { label: 'Settled', value: 'settled' }, { label: 'All', value: 'all' }]"
          :key="s.value"
          @click="statusFilter = s.value"
          class="px-4 py-1.5 text-sm font-medium rounded-md transition-colors"
          :class="statusFilter === s.value ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
        >
          {{ s.label }}
        </button>
      </div>
    </div>

    <!-- Table -->
    <div v-if="loading" class="text-center py-12 text-slate-400">
      <i class="pi pi-spin pi-spinner text-2xl" />
    </div>

    <div v-else-if="receivables.length === 0" class="text-center py-12 text-slate-400">
      <i class="pi pi-check-circle text-4xl text-emerald-300 mb-3" /><br>
      <span class="text-sm">No receivables found</span>
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b-2 border-slate-200">
            <th class="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Order</th>
            <th class="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Client</th>
            <th class="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Factory</th>
            <th class="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">PI Total</th>
            <th class="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Paid</th>
            <th class="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Outstanding</th>
            <th class="text-center py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Progress</th>
            <th class="text-center py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Days</th>
            <th class="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Payment</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in receivables"
            :key="r.order_id"
            class="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
            @click="router.push(`/orders/${r.order_id}`)"
          >
            <td class="py-3 px-3 font-mono text-indigo-600 font-medium">{{ r.order_number || r.order_id.slice(0,8) }}</td>
            <td class="py-3 px-3 text-slate-700">{{ r.client_name }}</td>
            <td class="py-3 px-3 text-slate-500">{{ r.factory_name }}</td>
            <td class="py-3 px-3 text-right font-medium text-slate-700">{{ formatCurrency(r.pi_total_inr) }}</td>
            <td class="py-3 px-3 text-right font-medium text-emerald-600">{{ formatCurrency(r.total_paid_inr) }}</td>
            <td class="py-3 px-3 text-right">
              <span class="inline-block px-2 py-0.5 rounded-md text-xs font-bold" :class="outstandingClass(r.outstanding_inr)">
                {{ formatCurrency(r.outstanding_inr) }}
              </span>
            </td>
            <td class="py-3 px-3">
              <div class="flex items-center gap-2 justify-center">
                <div class="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all"
                    :class="r.paid_percent >= 100 ? 'bg-emerald-500' : r.paid_percent >= 50 ? 'bg-amber-500' : 'bg-red-500'"
                    :style="{ width: Math.min(r.paid_percent, 100) + '%' }"
                  />
                </div>
                <span class="text-xs text-slate-500 w-10 text-right">{{ r.paid_percent }}%</span>
              </div>
            </td>
            <td class="py-3 px-3 text-center">
              <span
                v-if="r.days_outstanding > 0"
                class="text-xs font-medium px-2 py-0.5 rounded-full"
                :class="r.days_outstanding > 60 ? 'bg-red-100 text-red-700' : r.days_outstanding > 30 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'"
              >
                {{ r.days_outstanding }}d
              </span>
              <span v-else class="text-xs text-slate-400">-</span>
            </td>
            <td class="py-3 px-3 text-slate-500 text-xs">{{ r.last_payment_date || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
