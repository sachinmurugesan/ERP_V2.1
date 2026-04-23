<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { dashboardApi } from '../api'

const router = useRouter()
const summary = ref({ total_orders: 0, in_production: 0, in_transit: 0, aftersales_open: 0, client_inquiries: 0 })
const activeShipments = ref([])
const recentActivity = ref([])
const clientInquiries = ref([])
const loading = ref(true)

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

const getStageStyle = (stage) => stageStyles[stage] || stageStyles[1]

const statCards = [
  { key: 'total_orders', label: 'TOTAL ORDERS', icon: 'pi pi-shopping-cart', iconBg: 'bg-blue-500', subtext: 'All active orders', subtextClass: 'text-slate-500' },
  { key: 'in_production', label: 'IN PRODUCTION', icon: 'pi pi-cog', iconBg: 'bg-amber-500', subtext: 'Factory stages', subtextClass: 'text-slate-500' },
  { key: 'in_transit', label: 'IN TRANSIT', icon: 'pi pi-truck', iconBg: 'bg-cyan-500', subtext: 'Loaded / Sailing / Arrived', subtextClass: 'text-cyan-600' },
  { key: 'aftersales_open', label: 'OPEN ISSUES', icon: 'pi pi-exclamation-triangle', iconBg: 'bg-red-500', subtext: 'Needs attention', subtextClass: 'text-red-500' },
  { key: 'client_inquiries', label: 'CLIENT INQUIRIES', icon: 'pi pi-inbox', iconBg: 'bg-teal-500', subtext: 'Pending approval', subtextClass: 'text-teal-600' },
]

const timeAgo = (isoStr) => {
  if (!isoStr) return ''
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} mins ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hours ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

const formatValue = (val) => {
  if (!val) return '\u2014'
  return '\u00a5 ' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

onMounted(async () => {
  try {
    const [summaryRes, shipmentsRes, activityRes, inquiriesRes] = await Promise.all([
      dashboardApi.getSummary(),
      dashboardApi.getActiveShipments(),
      dashboardApi.getRecentActivity(),
      dashboardApi.getClientInquiries().catch(() => ({ data: { inquiries: [] } })),
    ])
    summary.value = summaryRes.data
    activeShipments.value = shipmentsRes.data
    recentActivity.value = activityRes.data
    clientInquiries.value = inquiriesRes.data?.inquiries || []
  } catch (err) {
    console.error('Dashboard load error:', err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Stat Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      <div v-for="card in statCards" :key="card.key"
           class="bg-white rounded-xl shadow-sm border border-slate-100 p-5 flex items-start justify-between">
        <div>
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{ card.label }}</div>
          <div class="text-3xl font-bold text-slate-800 mt-1">{{ summary[card.key] ?? '\u2014' }}</div>
          <div class="text-xs mt-2 font-medium" :class="card.subtextClass">{{ card.subtext }}</div>
        </div>
        <div class="w-11 h-11 rounded-xl flex items-center justify-center text-white" :class="card.iconBg">
          <i :class="card.icon" class="text-lg" />
        </div>
      </div>
    </div>

    <!-- Client Inquiries -->
    <div v-if="clientInquiries.length" class="bg-white rounded-xl shadow-sm border border-teal-100">
      <div class="px-6 py-4 border-b border-teal-100 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <h2 class="text-base font-semibold text-slate-800">Client Inquiries</h2>
          <span class="bg-teal-100 text-teal-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
            {{ clientInquiries.length }} Pending
          </span>
        </div>
      </div>

      <table class="w-full">
        <thead>
          <tr class="border-b border-slate-100">
            <th class="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Client</th>
            <th class="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">PO Reference</th>
            <th class="text-right px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Items</th>
            <th class="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Submitted</th>
            <th class="text-center px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-for="inq in clientInquiries" :key="inq.id"
              class="hover:bg-teal-50 cursor-pointer transition-colors"
              @click="router.push(`/orders/${inq.id}`)">
            <td class="px-6 py-4 text-sm font-medium text-slate-800">{{ inq.client_name }}</td>
            <td class="px-6 py-4 text-sm text-slate-600">{{ inq.po_reference || '\u2014' }}</td>
            <td class="px-6 py-4 text-sm text-right text-slate-700">{{ inq.item_count }}</td>
            <td class="px-6 py-4 text-xs text-slate-400">{{ timeAgo(inq.created_at) }}</td>
            <td class="px-6 py-4 text-center">
              <button class="text-teal-600 hover:text-teal-800 text-sm font-medium"
                      @click.stop="router.push(`/orders/${inq.id}`)">
                Review
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 2-Column Layout: Shipments + Activity -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left: Active Shipments -->
      <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <h2 class="text-base font-semibold text-slate-800">Active Shipments</h2>
            <span class="bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
              {{ activeShipments.length }} Live
            </span>
          </div>
          <router-link to="/orders" class="text-sm text-emerald-600 hover:text-emerald-700 font-medium">View All</router-link>
        </div>

        <div v-if="loading" class="p-8 text-center text-slate-400">
          <i class="pi pi-spin pi-spinner text-2xl" />
        </div>

        <table v-else-if="activeShipments.length" class="w-full">
          <thead>
            <tr class="border-b border-slate-100">
              <th class="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Order / PO</th>
              <th class="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Factory</th>
              <th class="text-right px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Value</th>
              <th class="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Status</th>
              <th class="text-center px-6 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-50">
            <tr v-for="s in activeShipments" :key="s.id"
                class="hover:bg-slate-50 cursor-pointer transition-colors"
                @click="router.push(`/orders/${s.id}`)">
              <td class="px-6 py-4">
                <div class="text-sm font-semibold font-mono text-slate-800">{{ s.order_number }}</div>
                <div class="text-xs text-slate-400">{{ s.po_reference || '\u2014' }}</div>
              </td>
              <td class="px-6 py-4 text-sm text-slate-600">{{ s.factory_name || '\u2014' }}</td>
              <td class="px-6 py-4 text-sm font-mono text-right text-slate-700">{{ formatValue(s.total_value_cny) }}</td>
              <td class="px-6 py-4">
                <span class="px-2.5 py-1 rounded-full text-xs font-medium"
                      :class="[getStageStyle(s.stage_number).bg, getStageStyle(s.stage_number).text]">
                  S{{ s.stage_number }} {{ s.stage_name }}
                </span>
              </td>
              <td class="px-6 py-4 text-center">
                <button class="text-slate-400 hover:text-emerald-600 transition-colors"
                        @click.stop="router.push(`/orders/${s.id}`)">
                  <i class="pi pi-eye" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-else class="p-8 text-center text-slate-400 text-sm">
          No active shipments
        </div>
      </div>

      <!-- Right: Recent Activity -->
      <div class="bg-white rounded-xl shadow-sm border border-slate-100">
        <div class="px-6 py-4 border-b border-slate-100">
          <h2 class="text-base font-semibold text-slate-800">Recent Activity</h2>
          <p class="text-xs text-slate-400 mt-0.5">Latest updates from the team</p>
        </div>

        <div class="px-6 py-4 space-y-5 max-h-[480px] overflow-y-auto">
          <div v-for="event in recentActivity" :key="event.id" class="flex gap-3">
            <div class="w-2 h-2 rounded-full bg-emerald-500 mt-2 flex-shrink-0"></div>
            <div class="min-w-0">
              <div class="text-[11px] text-slate-400">{{ timeAgo(event.updated_at) }}</div>
              <div class="text-sm font-semibold text-slate-800 truncate">{{ event.action }}</div>
              <div class="text-xs text-slate-500 mt-0.5">{{ event.details }}</div>
            </div>
          </div>
          <div v-if="!recentActivity.length && !loading" class="text-center text-slate-400 text-sm py-4">
            No recent activity
          </div>
        </div>

        <div class="px-6 py-3 border-t border-slate-100 text-center">
          <router-link to="/orders" class="text-sm text-emerald-600 hover:text-emerald-700 font-medium">View All Orders</router-link>
        </div>
      </div>
    </div>
  </div>
</template>
