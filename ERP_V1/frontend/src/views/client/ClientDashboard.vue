<script setup>
import { ref, onMounted } from 'vue'
import { ordersApi } from '../../api'
import { useAuth } from '../../composables/useAuth'
import { formatINR, formatDate } from '../../utils/formatters'
import {
  CLIENT_STATUS_LABELS as statusLabels,
  CLIENT_STATUS_COLORS as stageColors,
  getStatusLabel,
  SHIPPING_STATUSES,
} from '../../utils/clientPortal'

const { user } = useAuth()
const stats = ref({ active_orders: 0, total_orders: 0, pending_shipments: 0, total_value: 0 })
const recentOrders = ref([])
const loading = ref(true)

async function loadData() {
  try {
    const { data } = await ordersApi.list({ limit: 10 })
    const orders = data.items || data.orders || (Array.isArray(data) ? data : [])
    recentOrders.value = orders.slice(0, 5)
    stats.value.total_orders = data.total || orders.length
    stats.value.active_orders = orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED' && !o.deleted_at).length
    stats.value.pending_shipments = orders.filter(o => SHIPPING_STATUSES.has(o.status)).length
  } catch (_e) { /* ignore */ }
  loading.value = false
}

onMounted(loadData)
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-800">Welcome, {{ user?.full_name || 'Client' }}</h1>
          <p class="text-sm text-slate-400 mt-0.5">Your order overview and recent activity</p>
        </div>
        <router-link to="/client-portal/orders/new"
          class="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium inline-flex items-center gap-2 shadow-sm transition-colors">
          <i class="pi pi-plus text-xs" /> New Inquiry
        </router-link>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
      <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Active Orders</p>
            <p class="text-3xl font-bold text-emerald-600 mt-1">{{ stats.active_orders }}</p>
          </div>
          <div class="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
            <i class="pi pi-shopping-cart text-emerald-500 text-xl" />
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Total Orders</p>
            <p class="text-3xl font-bold text-blue-600 mt-1">{{ stats.total_orders }}</p>
          </div>
          <div class="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
            <i class="pi pi-list text-blue-500 text-xl" />
          </div>
        </div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-[10px] text-slate-400 uppercase tracking-wider font-medium">In Transit</p>
            <p class="text-3xl font-bold text-violet-600 mt-1">{{ stats.pending_shipments }}</p>
          </div>
          <div class="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center">
            <i class="pi pi-send text-violet-500 text-xl" />
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Orders -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <i class="pi pi-clock text-slate-400" />
          <h2 class="font-bold text-slate-800">Recent Orders</h2>
        </div>
        <router-link to="/client-portal/orders" class="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
          View all →
        </router-link>
      </div>

      <div v-if="loading" class="p-12 text-center text-slate-400">
        <i class="pi pi-spinner pi-spin text-2xl mb-2 block" />
        <p class="text-sm">Loading your orders...</p>
      </div>

      <div v-else-if="recentOrders.length === 0" class="p-12 text-center">
        <i class="pi pi-inbox text-3xl text-slate-200 mb-3 block" />
        <p class="text-sm text-slate-400 mb-4">No orders yet. Start by creating your first inquiry!</p>
        <router-link to="/client-portal/orders/new"
          class="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 inline-flex items-center gap-2">
          <i class="pi pi-plus text-xs" /> Create Inquiry
        </router-link>
      </div>

      <table v-else class="w-full text-sm">
        <thead class="bg-slate-50 border-b border-slate-100">
          <tr>
            <th class="px-5 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Order #</th>
            <th class="px-5 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
            <th class="px-5 py-3 text-center font-semibold text-slate-500 text-xs uppercase tracking-wider hidden sm:table-cell">Items</th>
            <th class="px-5 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider hidden md:table-cell">Created</th>
            <th class="px-5 py-3 text-right font-semibold text-slate-500 text-xs uppercase tracking-wider">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in recentOrders" :key="order.id"
            class="border-t border-slate-50 hover:bg-emerald-50/30 transition-colors cursor-pointer"
            @click="$router.push(`/client-portal/orders/${order.id}`)">
            <td class="px-5 py-3.5">
              <span class="font-mono font-semibold text-slate-800">{{ order.order_number || '—' }}</span>
              <span v-if="order.client_reference" class="text-[10px] text-slate-400 ml-2">{{ order.client_reference }}</span>
            </td>
            <td class="px-5 py-3.5">
              <span class="px-2.5 py-1 rounded-full text-[10px] font-medium" :class="stageColors[order.status] || 'bg-gray-100 text-gray-600'">
                {{ statusLabels[order.status] || getStatusLabel(order.status) }}
              </span>
            </td>
            <td class="px-5 py-3.5 text-center text-slate-500 hidden sm:table-cell">{{ order.item_count || 0 }}</td>
            <td class="px-5 py-3.5 text-slate-400 text-xs hidden md:table-cell">{{ formatDate(order.created_at) }}</td>
            <td class="px-5 py-3.5 text-right">
              <router-link :to="`/client-portal/orders/${order.id}`"
                class="text-emerald-600 hover:text-emerald-800 text-xs font-medium inline-flex items-center gap-1"
                @click.stop>
                View <i class="pi pi-arrow-right text-[8px]" />
              </router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
