<script setup>
import { ref, onMounted } from 'vue'
import { ordersApi } from '../../api'
import { formatINR, formatDate } from '../../utils/formatters'
import {
  CLIENT_STATUS_LABELS as statusLabels,
  CLIENT_STATUS_COLORS as stageColors,
  ORDER_FILTER_OPTIONS as statusOptions,
  getStatusLabel,
} from '../../utils/clientPortal'

const orders = ref([])
const total = ref(0)
const loading = ref(true)
const search = ref('')
const statusFilter = ref('')
const showDeleteReason = ref(false)
const deleteReasonOrder = ref(null)

async function loadOrders() {
  loading.value = true
  try {
    const params = { limit: 50, include_deleted: true }
    if (search.value) params.search = search.value
    if (statusFilter.value) params.status = statusFilter.value
    const { data } = await ordersApi.list(params)
    orders.value = data.items || data.orders || (Array.isArray(data) ? data : [])
    total.value = data.total || orders.value.length
  } catch (_e) { /* ignore */ }
  loading.value = false
}

onMounted(loadOrders)

function showReason(order) {
  deleteReasonOrder.value = order
  showDeleteReason.value = true
}
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-slate-800">My Orders</h1>
      <router-link to="/client-portal/orders/new" class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium inline-flex items-center gap-2">
        <i class="pi pi-plus text-xs" /> New Inquiry
      </router-link>
    </div>

    <div class="flex gap-3 mb-4">
      <input v-model="search" @input="loadOrders" placeholder="Search orders..." class="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
      <select v-model="statusFilter" @change="loadOrders" class="px-3 py-2 border border-slate-300 rounded-lg text-sm">
        <option value="">All Status</option>
        <option v-for="s in statusOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="py-16 text-center text-slate-400">
      <i class="pi pi-spinner pi-spin text-2xl mb-3" />
      <p class="text-sm">Loading orders...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="orders.length === 0" class="py-20 text-center">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
        <i class="pi pi-shopping-cart text-2xl text-slate-400" />
      </div>
      <h2 class="text-lg font-bold text-slate-700">No orders yet</h2>
      <p class="text-sm text-slate-400 mt-1 max-w-sm mx-auto">Once your orders are created, they will appear here with real-time status tracking.</p>
    </div>

    <!-- Orders Table -->
    <div v-else class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 border-b">
          <tr>
            <th class="px-4 py-3 text-left font-semibold text-slate-600">Order #</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-600">Items</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-600">Total (INR)</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-600">Created</th>
            <th class="px-4 py-3 text-right font-semibold text-slate-600">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in orders" :key="o.id"
            class="border-t border-slate-50"
            :class="o.deleted_at ? 'opacity-50 line-through cursor-pointer' : 'hover:bg-slate-50'"
            @click="o.deleted_at ? showReason(o) : null"
          >
            <td class="px-4 py-3 font-mono font-medium">{{ o.order_number || '-' }}</td>
            <td class="px-4 py-3">
              <span v-if="o.deleted_at" class="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">CANCELLED</span>
              <span v-else class="px-2 py-0.5 rounded-full text-xs font-medium" :class="stageColors[o.status] || 'bg-gray-100'">{{ statusLabels[o.status] || (o.status || '').replace(/_/g, ' ') }}</span>
            </td>
            <td class="px-4 py-3 text-slate-500">{{ o.item_count || 0 }}</td>
            <td class="px-4 py-3 font-medium">{{ o.selling_total_inr ? '₹' + Number(o.selling_total_inr).toLocaleString() : '-' }}</td>
            <td class="px-4 py-3 text-xs text-slate-400">{{ o.created_at ? new Date(o.created_at).toLocaleDateString() : '-' }}</td>
            <td class="px-4 py-3 text-right">
              <button v-if="o.deleted_at" @click.stop="showReason(o)" class="text-red-500 hover:text-red-700 text-xs font-medium">See Reason</button>
              <router-link v-else :to="`/client-portal/orders/${o.id}`" class="text-emerald-600 hover:text-emerald-800 text-xs font-medium">View</router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Deletion Reason Dialog -->
    <div v-if="showDeleteReason" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showDeleteReason = false">
      <div class="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <i class="pi pi-ban text-red-600" />
          </div>
          <div>
            <h2 class="text-lg font-bold text-slate-800">Order Cancelled</h2>
            <p class="text-xs text-slate-400">{{ deleteReasonOrder?.order_number || 'Draft Order' }}</p>
          </div>
        </div>
        <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p class="text-sm font-medium text-red-800 mb-1">Reason for cancellation:</p>
          <p class="text-sm text-red-700">{{ deleteReasonOrder?.deletion_reason || 'No reason provided' }}</p>
        </div>
        <p class="text-xs text-slate-400 mb-4">
          Cancelled on: {{ deleteReasonOrder?.deleted_at ? new Date(deleteReasonOrder.deleted_at).toLocaleString() : '-' }}
        </p>
        <div class="flex justify-end">
          <button @click="showDeleteReason = false" class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>
