<script setup>
import { ref, onMounted, watch } from 'vue'
import { financeApi, clientsApi } from '../../api'
import { formatCurrency } from '../../utils/formatters'

const loading = ref(false)
const clients = ref([])
const selectedClient = ref('')
const startDate = ref('')
const endDate = ref('')
const entries = ref([])
const summary = ref({ total_debit: 0, total_credit: 0, net_balance: 0 })
const clientName = ref('')

async function loadClients() {
  try {
    const res = await clientsApi.list()
    clients.value = res.data.items || res.data || []
  } catch (e) { console.error(e) }
}

async function loadLedger() {
  if (!selectedClient.value) { entries.value = []; return }
  loading.value = true
  try {
    const params = {}
    if (startDate.value) params.start_date = startDate.value
    if (endDate.value) params.end_date = endDate.value
    const res = await financeApi.clientLedger(selectedClient.value, params)
    entries.value = res.data.entries || []
    summary.value = res.data.summary || { total_debit: 0, total_credit: 0, net_balance: 0 }
    clientName.value = res.data.client_name || ''
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

watch([selectedClient, startDate, endDate], loadLedger)
onMounted(loadClients)

// formatCurrency imported from utils/formatters

async function downloadStatement(format) {
  if (!selectedClient.value) return
  try {
    const params = {}
    if (startDate.value) params.start_date = startDate.value
    if (endDate.value) params.end_date = endDate.value
    const res = await financeApi.downloadClientLedger(selectedClient.value, format, params)
    const blob = new Blob([res.data])
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `client_ledger_${clientName.value || 'statement'}.${format === 'xlsx' ? 'xlsx' : 'pdf'}`
    a.click()
    window.URL.revokeObjectURL(url)
  } catch (e) { console.error('Download failed:', e) }
}
</script>

<template>
  <div class="p-6 space-y-5">
    <!-- Filters -->
    <div class="flex items-end gap-4 flex-wrap">
      <div class="flex-1 min-w-[200px]">
        <label class="block text-xs font-medium text-slate-500 mb-1">Client</label>
        <select
          v-model="selectedClient"
          class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        >
          <option value="">Select a client...</option>
          <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.company_name }}</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-500 mb-1">From</label>
        <input type="date" v-model="startDate" class="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-500 mb-1">To</label>
        <input type="date" v-model="endDate" class="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400" />
      </div>
      <div class="flex gap-2" v-if="selectedClient && entries.length > 0">
        <button @click="downloadStatement('xlsx')" class="px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-1.5">
          <i class="pi pi-file-excel text-xs" /> Excel
        </button>
        <button @click="downloadStatement('pdf')" class="px-3 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1.5">
          <i class="pi pi-file-pdf text-xs" /> PDF
        </button>
      </div>
    </div>

    <!-- No Client Selected -->
    <div v-if="!selectedClient" class="text-center py-16 text-slate-400">
      <i class="pi pi-users text-4xl text-slate-300 mb-3" /><br>
      <span class="text-sm">Select a client to view their ledger</span>
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="text-center py-12 text-slate-400">
      <i class="pi pi-spin pi-spinner text-2xl" />
    </div>

    <!-- Ledger Content -->
    <template v-else-if="entries.length > 0">
      <!-- Summary Cards -->
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-red-50 border border-red-100 rounded-xl p-4">
          <p class="text-xs font-medium text-red-400 uppercase tracking-wider">Total Debit</p>
          <p class="text-2xl font-bold text-red-700 mt-1">{{ formatCurrency(summary.total_debit) }}</p>
        </div>
        <div class="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
          <p class="text-xs font-medium text-emerald-400 uppercase tracking-wider">Total Credit</p>
          <p class="text-2xl font-bold text-emerald-700 mt-1">{{ formatCurrency(summary.total_credit) }}</p>
        </div>
        <div class="border border-slate-200 rounded-xl p-4" :class="summary.net_balance > 0 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'">
          <p class="text-xs font-medium text-slate-400 uppercase tracking-wider">Net Balance</p>
          <p class="text-2xl font-bold mt-1" :class="summary.net_balance > 0 ? 'text-amber-700' : 'text-emerald-700'">{{ formatCurrency(summary.net_balance) }}</p>
        </div>
      </div>

      <!-- Ledger Table -->
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b-2 border-slate-200">
              <th class="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
              <th class="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Order</th>
              <th class="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Remark</th>
              <th class="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Debit (&#8377;)</th>
              <th class="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Credit (&#8377;)</th>
              <th class="text-right py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Balance (&#8377;)</th>
              <th class="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Method</th>
              <th class="text-left py-3 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reference</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(e, i) in entries"
              :key="i"
              class="border-b border-slate-100 hover:bg-slate-50"
            >
              <td class="py-2.5 px-3 text-slate-600">{{ e.date }}</td>
              <td class="py-2.5 px-3 font-mono text-indigo-600 text-xs">{{ e.order_number }}</td>
              <td class="py-2.5 px-3 text-slate-700">{{ e.remark }}</td>
              <td class="py-2.5 px-3 text-right font-medium" :class="e.debit > 0 ? 'text-red-600' : 'text-slate-300'">{{ e.debit > 0 ? formatCurrency(e.debit) : '-' }}</td>
              <td class="py-2.5 px-3 text-right font-medium" :class="e.credit > 0 ? 'text-emerald-600' : 'text-slate-300'">{{ e.credit > 0 ? formatCurrency(e.credit) : '-' }}</td>
              <td class="py-2.5 px-3 text-right font-bold" :class="e.running_balance > 0 ? 'text-amber-700' : 'text-emerald-700'">{{ formatCurrency(e.running_balance) }}</td>
              <td class="py-2.5 px-3 text-slate-500 text-xs">{{ e.method !== '-' ? e.method.replace('_', ' ') : '-' }}</td>
              <td class="py-2.5 px-3 text-slate-400 text-xs">{{ e.reference }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t-2 border-slate-300 bg-slate-50">
              <td colspan="3" class="py-3 px-3 font-bold text-slate-700">TOTALS</td>
              <td class="py-3 px-3 text-right font-bold text-red-700">{{ formatCurrency(summary.total_debit) }}</td>
              <td class="py-3 px-3 text-right font-bold text-emerald-700">{{ formatCurrency(summary.total_credit) }}</td>
              <td class="py-3 px-3 text-right font-bold" :class="summary.net_balance > 0 ? 'text-amber-700' : 'text-emerald-700'">{{ formatCurrency(summary.net_balance) }}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </template>

    <!-- No entries -->
    <div v-else class="text-center py-12 text-slate-400">
      <i class="pi pi-database text-4xl text-slate-300 mb-3" /><br>
      <span class="text-sm">No ledger entries found</span>
    </div>
  </div>
</template>
