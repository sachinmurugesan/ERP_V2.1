<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ordersApi } from '../../api'
import { formatDate } from '../../utils/formatters'

const router = useRouter()

// State
const orders = ref([])
const loading = ref(false)
const search = ref('')
const statusFilter = ref('')
const statusCounts = ref({})
const page = ref(1)
const perPage = ref(25)
const totalItems = ref(0)

const totalPages = computed(() => Math.ceil(totalItems.value / perPage.value))

// Status groups for filter tabs
const statusGroups = [
  { label: 'All', value: '', icon: 'pi-list' },
  { label: 'Draft', value: 'DRAFT', icon: 'pi-file-edit' },
  { label: 'Pricing', value: 'PENDING_PI,PI_SENT', icon: 'pi-calculator' },
  { label: 'Payment', value: 'ADVANCE_PENDING,ADVANCE_RECEIVED', icon: 'pi-indian-rupee' },
  { label: 'Production', value: 'FACTORY_ORDERED,PRODUCTION_60,PRODUCTION_80,PRODUCTION_90,PRODUCTION_100', icon: 'pi-cog' },
  { label: 'Shipping', value: 'BOOKED,LOADED,SAILED,ARRIVED', icon: 'pi-truck' },
  { label: 'Customs', value: 'CUSTOMS_FILED,CLEARED', icon: 'pi-shield' },
  { label: 'Delivered', value: 'DELIVERED', icon: 'pi-check-circle' },
  { label: 'Completed', value: 'COMPLETED,COMPLETED_EDITING', icon: 'pi-verified' },
]

// Compute the count for a status group by summing all matching statuses
function getGroupCount(groupValue) {
  if (!groupValue) return totalItems.value  // "All" tab
  const statuses = groupValue.split(',')
  let total = 0
  for (const s of statuses) {
    if (statusCounts.value[s]) {
      total += statusCounts.value[s].count
    }
  }
  return total
}

// Stage color/badge mapping
const stageStyles = {
  1: { bg: 'bg-slate-100', text: 'text-slate-700' },
  2: { bg: 'bg-amber-100', text: 'text-amber-700' },
  3: { bg: 'bg-orange-100', text: 'text-orange-700' },
  4: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  5: { bg: 'bg-blue-100', text: 'text-blue-700' },
  6: { bg: 'bg-blue-100', text: 'text-blue-700' },
  7: { bg: 'bg-blue-100', text: 'text-blue-700' },
  8: { bg: 'bg-blue-100', text: 'text-blue-700' },
  9: { bg: 'bg-blue-100', text: 'text-blue-700' },
  10: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
  11: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  12: { bg: 'bg-purple-100', text: 'text-purple-700' },
  13: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  14: { bg: 'bg-green-100', text: 'text-green-700' },
}

function getStageStyle(stage) {
  return stageStyles[stage] || stageStyles[1]
}

// Client avatar helpers
const getInitials = (name) => {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
}

const avatarColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#ef4444']
const getAvatarColor = (name) => {
  if (!name) return avatarColors[0]
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return avatarColors[hash % avatarColors.length]
}

// Load orders
async function loadOrders() {
  loading.value = true
  try {
    const params = { page: page.value, per_page: perPage.value }
    if (search.value) params.search = search.value
    if (statusFilter.value) params.status = statusFilter.value

    const { data } = await ordersApi.list(params)
    orders.value = data.items
    totalItems.value = data.total
  } catch (err) {
    console.error('Failed to load orders:', err)
  } finally {
    loading.value = false
  }
}

// Load status counts for tab badges
async function loadStatusCounts() {
  try {
    const { data } = await ordersApi.statusCounts()
    statusCounts.value = data
  } catch (err) {
    console.error('Failed to load status counts:', err)
  }
}

// Search debounce
let searchTimer = null
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadOrders()
  }, 400)
}

function setStatusFilter(value) {
  statusFilter.value = value
  page.value = 1
  loadOrders()
}

function goToPage(p) {
  if (p >= 1 && p <= totalPages.value) {
    page.value = p
    loadOrders()
  }
}

// Delete order with reason
const showDeleteModal = ref(false)
const deleteTarget = ref(null)
const deleteReason = ref('')
const deleting = ref(false)

function confirmDelete(order) {
  deleteTarget.value = order
  deleteReason.value = ''
  showDeleteModal.value = true
}

async function executeDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await ordersApi.delete(deleteTarget.value.id)
    if (deleteReason.value.trim()) {
      await ordersApi.setDeletionReason(deleteTarget.value.id, deleteReason.value.trim())
    }
    showDeleteModal.value = false
    deleteTarget.value = null
    deleteReason.value = ''
    loadOrders()
    loadStatusCounts()
  } catch (err) {
    console.error('Failed to delete order:', err)
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  loadOrders()
  loadStatusCounts()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-lg font-semibold text-slate-800">Orders</h2>
        <p class="text-sm text-slate-500 mt-0.5">{{ totalItems }} orders</p>
      </div>
      <router-link
        to="/orders/new"
        class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
      >
        <i class="pi pi-plus text-xs" /> New Order
      </router-link>
    </div>

    <!-- Status Filter Tabs (pill-shaped with count badges) -->
    <div class="flex gap-2 mb-4 overflow-x-auto pb-1">
      <button
        v-for="group in statusGroups"
        :key="group.value"
        @click="setStatusFilter(group.value)"
        :class="[
          'flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap',
          statusFilter === group.value
            ? 'bg-emerald-600 text-white'
            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
        ]"
      >
        <i :class="['pi text-xs', group.icon]" />
        {{ group.label }}
        <span
          v-if="getGroupCount(group.value) > 0"
          :class="[
            'px-1.5 py-0.5 rounded-full text-xs font-medium ml-0.5',
            statusFilter === group.value
              ? 'bg-white/30 text-white'
              : 'bg-slate-100 text-slate-600'
          ]"
        >
          {{ getGroupCount(group.value) }}
        </span>
      </button>
    </div>

    <!-- Search Bar + Filters/Export Buttons -->
    <div class="flex items-center gap-3 mb-4">
      <div class="flex-1 max-w-2xl relative">
        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
        <input
          v-model="search"
          @input="onSearchInput"
          type="text"
          placeholder="Search by order number or PO reference..."
          class="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
        />
      </div>
      <div class="flex items-center gap-2 ml-auto">
        <button class="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
          <i class="pi pi-sliders-h text-xs" />
          Filters
        </button>
        <button class="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
          <i class="pi pi-download text-xs" />
          Export
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <!-- Loading -->
      <div v-if="loading" class="p-12 text-center">
        <i class="pi pi-spin pi-spinner text-2xl text-emerald-500" />
        <p class="text-sm text-slate-400 mt-2">Loading orders...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="orders.length === 0" class="p-12 text-center">
        <i class="pi pi-shopping-cart text-4xl text-slate-300" />
        <p class="text-slate-400 mt-3">No orders found</p>
        <router-link
          to="/orders/new"
          class="inline-block mt-3 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
        >
          + Create your first order
        </router-link>
      </div>

      <!-- Data Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-slate-200">
              <th class="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Order #</th>
              <th class="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Client</th>
              <th class="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Factory</th>
              <th class="text-center px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Stage</th>
              <th class="text-center px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Items</th>
              <th class="text-right px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Value (CNY)</th>
              <th class="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Created</th>
              <th class="text-right px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="order in orders"
              :key="order.id"
              @click="router.push(`/orders/${order.id}`)"
              class="hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <!-- Order Number -->
              <td class="px-6 py-4">
                <span class="text-sm font-mono font-medium text-slate-800">
                  {{ order.order_number || 'DRAFT' }}
                </span>
                <span v-if="order.po_reference" class="block text-xs text-slate-400">
                  {{ order.po_reference }}
                </span>
              </td>

              <!-- Client with Avatar -->
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div
                    class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    :style="{ backgroundColor: getAvatarColor(order.client_name) }"
                  >
                    {{ getInitials(order.client_name) }}
                  </div>
                  <div>
                    <div class="text-sm font-medium text-slate-800">{{ order.client_name || '—' }}</div>
                    <div v-if="order.client_location" class="text-xs text-slate-400">{{ order.client_location }}</div>
                  </div>
                </div>
              </td>

              <!-- Factory -->
              <td class="px-6 py-4 text-sm text-slate-600">
                {{ order.factory_name || '—' }}
              </td>

              <!-- Stage Badge -->
              <td class="px-6 py-4 text-center">
                <span
                  :class="[
                    'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
                    getStageStyle(order.stage_number).bg,
                    getStageStyle(order.stage_number).text,
                  ]"
                >
                  S{{ order.stage_number }} {{ order.stage_name }}
                </span>
              </td>

              <!-- Items Count -->
              <td class="px-6 py-4 text-center text-sm text-slate-600">
                {{ order.item_count }}
              </td>

              <!-- Total Value -->
              <td class="px-6 py-4 text-right text-sm font-medium text-slate-700">
                <template v-if="order.total_value_cny > 0">
                  <i class="pi pi-box text-xs text-slate-400 mr-1" />{{ order.total_value_cny.toLocaleString() }}
                </template>
                <span v-else>—</span>
              </td>

              <!-- Created Date -->
              <td class="px-6 py-4 text-sm text-slate-500">
                {{ formatDate(order.created_at) }}
              </td>

              <!-- Actions -->
              <td class="px-6 py-4 text-right" @click.stop>
                <button
                  @click="router.push(`/orders/${order.id}`)"
                  class="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  title="View"
                >
                  <i class="pi pi-eye text-sm" />
                </button>
                <button
                  @click="confirmDelete(order)"
                  class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <i class="pi pi-trash text-sm" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="flex items-center justify-between px-6 py-3 border-t border-slate-200"
      >
        <p class="text-sm text-slate-500">
          Showing {{ (page - 1) * perPage + 1 }} to {{ Math.min(page * perPage, totalItems) }} of {{ totalItems }} results
        </p>
        <div class="flex items-center gap-1">
          <button
            @click="goToPage(page - 1)"
            :disabled="page === 1"
            class="w-9 h-9 flex items-center justify-center text-sm rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i class="pi pi-chevron-left text-xs" />
          </button>
          <template v-for="p in totalPages" :key="p">
            <button
              v-if="p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)"
              @click="goToPage(p)"
              :class="[
                'w-9 h-9 flex items-center justify-center text-sm rounded-lg border',
                p === page
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'border-slate-200 hover:bg-slate-50 text-slate-600'
              ]"
            >
              {{ p }}
            </button>
            <span v-else-if="p === page - 2 || p === page + 2" class="px-1 text-slate-400">...</span>
          </template>
          <button
            @click="goToPage(page + 1)"
            :disabled="page === totalPages"
            class="w-9 h-9 flex items-center justify-center text-sm rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i class="pi pi-chevron-right text-xs" />
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Order Modal -->
    <div v-if="showDeleteModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showDeleteModal = false">
      <div class="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <i class="pi pi-trash text-red-600" />
          </div>
          <div>
            <h2 class="text-lg font-bold text-slate-800">Delete Order</h2>
            <p class="text-xs text-slate-400">{{ deleteTarget?.order_number || 'Draft Order' }}</p>
          </div>
        </div>
        <p class="text-sm text-slate-600 mb-3">This will cancel the order. The client will be notified.</p>
        <label class="block text-xs font-medium text-slate-600 mb-1">Reason for cancellation</label>
        <textarea
          v-model="deleteReason"
          rows="3"
          class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
          placeholder="e.g. Client requested cancellation, duplicate order..."
        />
        <div class="flex justify-end gap-2 mt-4">
          <button @click="showDeleteModal = false" class="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">Cancel</button>
          <button @click="executeDelete" :disabled="deleting" class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
            <i v-if="deleting" class="pi pi-spinner pi-spin text-xs" />
            Delete Order
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
