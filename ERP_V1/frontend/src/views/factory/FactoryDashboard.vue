<script setup>
import { ref, onMounted } from 'vue'
import { ordersApi } from '../../api'
import { useAuth } from '../../composables/useAuth'
import { FACTORY_STATUS_COLORS as stageColors } from '../../utils/factoryPortal'

const { user } = useAuth()
const stats = ref({ active_orders: 0, total_orders: 0, pending_milestones: 0 })
const recentOrders = ref([])
const loading = ref(true)

async function loadData() {
  try {
    const { data } = await ordersApi.list({ limit: 5 })
    const orders = data.items || data.orders || (Array.isArray(data) ? data : [])
    recentOrders.value = orders.slice(0, 5)
    stats.value.total_orders = data.total || orders.length
    stats.value.active_orders = orders.filter(o => !['COMPLETED', 'CANCELLED', 'DRAFT'].includes(o.status)).length
  } catch (_e) { /* ignore */ }
  loading.value = false
}

onMounted(loadData)
</script>

<template>
  <div class="p-4 md:p-6 max-w-5xl mx-auto">
    <div class="mb-6">
      <h1 class="text-xl md:text-2xl font-bold text-slate-800">Welcome, {{ user?.full_name || 'Factory' }}</h1>
      <p class="text-sm text-slate-500">Production overview</p>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-8">
      <div class="bg-white rounded-xl border border-slate-200 p-4 md:p-5 shadow-sm">
        <div class="text-2xl md:text-3xl font-bold text-indigo-600">{{ stats.active_orders }}</div>
        <div class="text-[10px] md:text-xs text-slate-500 mt-1">Active Orders</div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 p-4 md:p-5 shadow-sm">
        <div class="text-2xl md:text-3xl font-bold text-blue-600">{{ stats.total_orders }}</div>
        <div class="text-[10px] md:text-xs text-slate-500 mt-1">Total Orders</div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 p-4 md:p-5 shadow-sm col-span-2 md:col-span-1">
        <div class="text-2xl md:text-3xl font-bold text-amber-600">{{ stats.pending_milestones }}</div>
        <div class="text-[10px] md:text-xs text-slate-500 mt-1">Pending Updates</div>
      </div>
    </div>

    <div class="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div class="px-4 md:px-5 py-4 border-b border-slate-100">
        <h2 class="font-bold text-slate-800">Recent Orders</h2>
      </div>
      <div v-if="loading" class="p-8 text-center text-slate-400"><i class="pi pi-spinner pi-spin mr-2" /> Loading...</div>
      <!-- Mobile cards -->
      <div class="md:hidden divide-y divide-slate-50">
        <router-link v-for="o in recentOrders" :key="o.id" :to="`/factory-portal/orders/${o.id}`" class="block px-4 py-3 hover:bg-slate-50">
          <div class="flex justify-between items-start">
            <span class="font-mono text-sm font-medium">{{ o.order_number }}</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="stageColors[o.status] || 'bg-gray-100 text-gray-700'">{{ (o.status || '').replace(/_/g, ' ') }}</span>
          </div>
          <div class="text-xs text-slate-400 mt-1">{{ o.item_count || 0 }} items</div>
        </router-link>
      </div>
      <!-- Desktop table -->
      <table class="hidden md:table w-full text-sm">
        <thead class="bg-slate-50"><tr>
          <th class="px-5 py-3 text-left font-semibold text-slate-600">Order #</th>
          <th class="px-5 py-3 text-left font-semibold text-slate-600">Status</th>
          <th class="px-5 py-3 text-left font-semibold text-slate-600">Items</th>
          <th class="px-5 py-3 text-right font-semibold text-slate-600">Action</th>
        </tr></thead>
        <tbody>
          <tr v-for="o in recentOrders" :key="o.id" class="border-t border-slate-50 hover:bg-slate-50">
            <td class="px-5 py-3 font-mono font-medium">{{ o.order_number }}</td>
            <td class="px-5 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="stageColors[o.status] || 'bg-gray-100'">{{ (o.status || '').replace(/_/g, ' ') }}</span></td>
            <td class="px-5 py-3 text-slate-500">{{ o.item_count || 0 }}</td>
            <td class="px-5 py-3 text-right"><router-link :to="`/factory-portal/orders/${o.id}`" class="text-indigo-600 hover:text-indigo-800 text-xs font-medium">View</router-link></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
