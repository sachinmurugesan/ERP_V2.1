<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ordersApi } from '../../api'
import { FACTORY_STATUS_COLORS as stageColors } from '../../utils/factoryPortal'

const route = useRoute()
const orderId = route.params.id
const order = ref(null)
const loading = ref(true)
const error = ref('')

async function loadOrder() {
  try {
    const { data } = await ordersApi.get(orderId)
    order.value = data
  } catch (e) {
    error.value = e.response?.data?.detail || 'Failed to load order'
  }
  loading.value = false
}

onMounted(loadOrder)
</script>

<template>
  <div class="p-4 md:p-6 max-w-6xl mx-auto">
    <router-link to="/factory-portal/orders" class="text-indigo-600 hover:text-indigo-800 text-sm mb-4 inline-flex items-center gap-1">
      <i class="pi pi-arrow-left text-xs" /> Back to Orders
    </router-link>

    <div v-if="loading" class="py-16 text-center text-slate-400"><i class="pi pi-spinner pi-spin mr-2" /> Loading...</div>
    <div v-else-if="error" class="py-16 text-center text-red-500">{{ error }}</div>

    <template v-else-if="order">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-2">
        <div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-800">Order {{ order.order_number }}</h1>
          <span class="px-2.5 py-1 rounded-full text-xs font-medium mt-1 inline-block" :class="stageColors[order.status] || 'bg-gray-100'">
            {{ (order.status || '').replace(/_/g, ' ') }}
          </span>
        </div>
      </div>

      <!-- Items Table -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div class="px-4 md:px-5 py-4 border-b border-slate-100">
          <h2 class="font-bold text-slate-800">Order Items</h2>
        </div>
        <!-- Mobile cards -->
        <div class="md:hidden divide-y divide-slate-50">
          <div v-for="(item, i) in (order.items || [])" :key="item.id" class="px-4 py-3">
            <div class="flex justify-between">
              <span class="font-mono text-xs text-slate-500">{{ item.product_code_snapshot || item.product_code || '-' }}</span>
              <span class="text-xs font-medium">{{ item.factory_price != null ? '¥' + Number(item.factory_price).toLocaleString() : '-' }}</span>
            </div>
            <div class="text-sm font-medium mt-0.5">{{ item.product_name_snapshot || item.product_name || '-' }}</div>
            <div class="flex justify-between mt-1 text-xs text-slate-400">
              <span>Qty: {{ item.quantity || 0 }}</span>
              <span class="font-medium text-slate-700">{{ item.factory_price != null ? '¥' + (Number(item.factory_price) * (item.quantity || 0)).toLocaleString() : '-' }}</span>
            </div>
          </div>
        </div>
        <!-- Desktop table -->
        <table class="hidden md:table w-full text-sm">
          <thead class="bg-slate-50"><tr>
            <th class="px-4 py-3 text-left font-semibold text-slate-600">#</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-600">Code</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-600">Description</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-600">Category</th>
            <th class="px-4 py-3 text-right font-semibold text-slate-600">Qty</th>
            <th class="px-4 py-3 text-right font-semibold text-slate-600">Unit Price (CNY)</th>
            <th class="px-4 py-3 text-right font-semibold text-slate-600">Total (CNY)</th>
          </tr></thead>
          <tbody>
            <tr v-if="!order.items?.length"><td colspan="7" class="px-4 py-8 text-center text-slate-400">No items</td></tr>
            <tr v-for="(item, i) in (order.items || [])" :key="item.id" class="border-t border-slate-50 hover:bg-slate-50">
              <td class="px-4 py-3 text-slate-400">{{ i + 1 }}</td>
              <td class="px-4 py-3 font-mono text-xs">{{ item.product_code_snapshot || item.product_code || '-' }}</td>
              <td class="px-4 py-3">{{ item.product_name_snapshot || item.product_name || '-' }}</td>
              <td class="px-4 py-3 text-xs text-slate-500">{{ item.category_snapshot || item.category || '-' }}</td>
              <td class="px-4 py-3 text-right">{{ item.quantity || 0 }}</td>
              <td class="px-4 py-3 text-right font-medium">{{ item.factory_price != null ? '¥' + Number(item.factory_price).toLocaleString() : '-' }}</td>
              <td class="px-4 py-3 text-right font-medium">{{ item.factory_price != null ? '¥' + (Number(item.factory_price) * (item.quantity || 0)).toLocaleString() : '-' }}</td>
            </tr>
          </tbody>
          <tfoot v-if="order.items?.length" class="bg-slate-50 border-t-2 border-slate-200">
            <tr>
              <td colspan="6" class="px-4 py-3 text-right font-bold text-slate-700">Total</td>
              <td class="px-4 py-3 text-right font-bold text-slate-800">
                ¥{{ order.items.reduce((sum, i) => sum + (Number(i.factory_price || 0) * (i.quantity || 0)), 0).toLocaleString() }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </template>
  </div>
</template>
