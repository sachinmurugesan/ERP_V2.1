<script setup>
import { ref, onMounted } from 'vue'
import { ordersApi } from '../../api'
import { FACTORY_STATUS_COLORS as stageColors } from '../../utils/factoryPortal'

const orders = ref([])
const total = ref(0)
const loading = ref(true)
const search = ref('')

async function loadOrders() {
  loading.value = true
  try {
    const params = { limit: 50 }
    if (search.value) params.search = search.value
    const { data } = await ordersApi.list(params)
    orders.value = data.items || data.orders || (Array.isArray(data) ? data : [])
    total.value = data.total || orders.value.length
  } catch (_e) { /* ignore */ }
  loading.value = false
}

onMounted(loadOrders)
</script>

<template>
  <div class="p-4 md:p-6 max-w-6xl mx-auto">
    <h1 class="text-xl md:text-2xl font-bold text-slate-800 mb-4 md:mb-6">Assigned Orders</h1>

    <div class="mb-4">
      <input v-model="search" @input="loadOrders" placeholder="Search orders..." class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
    </div>

    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div v-if="loading" class="p-8 text-center text-slate-400"><i class="pi pi-spinner pi-spin mr-2" /> Loading...</div>
      <!-- Mobile cards -->
      <div class="md:hidden divide-y divide-slate-50">
        <div v-if="orders.length === 0 && !loading" class="p-8 text-center text-slate-400">No orders assigned</div>
        <router-link v-for="o in orders" :key="o.id" :to="`/factory-portal/orders/${o.id}`" class="block px-4 py-3 hover:bg-slate-50">
          <div class="flex justify-between items-start">
            <span class="font-mono text-sm font-medium">{{ o.order_number }}</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="stageColors[o.status] || 'bg-gray-100 text-gray-700'">{{ (o.status || '').replace(/_/g, ' ') }}</span>
          </div>
          <div class="text-xs text-slate-400 mt-1">{{ o.item_count || 0 }} items</div>
        </router-link>
      </div>
      <!-- Desktop table -->
      <table class="hidden md:table w-full text-sm">
        <thead class="bg-slate-50 border-b"><tr>
          <th class="px-4 py-3 text-left font-semibold text-slate-600">Order #</th>
          <th class="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
          <th class="px-4 py-3 text-left font-semibold text-slate-600">Items</th>
          <th class="px-4 py-3 text-left font-semibold text-slate-600">Total (CNY)</th>
          <th class="px-4 py-3 text-right font-semibold text-slate-600">Action</th>
        </tr></thead>
        <tbody>
          <tr v-if="orders.length === 0"><td colspan="5" class="px-4 py-8 text-center text-slate-400">No orders assigned</td></tr>
          <tr v-for="o in orders" :key="o.id" class="border-t border-slate-50 hover:bg-slate-50">
            <td class="px-4 py-3 font-mono font-medium">{{ o.order_number }}</td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full text-xs font-medium" :class="stageColors[o.status] || 'bg-gray-100'">{{ (o.status || '').replace(/_/g, ' ') }}</span></td>
            <td class="px-4 py-3 text-slate-500">{{ o.item_count || 0 }}</td>
            <!-- total_value_cny is the canonical field from serialize_order (orders.py:231); G-010 patch -->
            <td class="px-4 py-3 font-medium">{{ o.total_value_cny ? '¥' + Number(o.total_value_cny).toLocaleString() : '-' }}</td>
            <td class="px-4 py-3 text-right"><router-link :to="`/factory-portal/orders/${o.id}`" class="text-indigo-600 hover:text-indigo-800 text-xs font-medium">View</router-link></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
