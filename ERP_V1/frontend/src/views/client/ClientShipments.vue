<script setup>
import { ref, computed, onMounted } from 'vue'
import { ordersApi, shipmentsApi } from '../../api'

const orders = ref([])
const shipmentData = ref({})
const loading = ref(true)
const expandedId = ref(null)

const SHIPPING_STATUSES = ['BOOKED', 'LOADED', 'SAILED', 'ARRIVED', 'CUSTOMS_FILED', 'CLEARED', 'DELIVERED', 'AFTER_SALES', 'COMPLETED']

const activeShipments = computed(() => orders.value.filter(o => ['LOADED', 'SAILED', 'ARRIVED'].includes(o.status)))
const upcomingShipments = computed(() => orders.value.filter(o => o.status === 'BOOKED'))
const completedShipments = computed(() => orders.value.filter(o => ['CUSTOMS_FILED', 'CLEARED', 'DELIVERED', 'AFTER_SALES', 'COMPLETED'].includes(o.status)))

async function loadShipments() {
  try {
    const { data } = await ordersApi.list({ limit: 50 })
    const all = data.items || data.orders || (Array.isArray(data) ? data : [])
    orders.value = all.filter(o => SHIPPING_STATUSES.includes(o.status))
    const promises = orders.value.map(o =>
      shipmentsApi.list(o.id).then(res => ({ id: o.id, data: res.data })).catch(() => ({ id: o.id, data: [] }))
    )
    const results = await Promise.all(promises)
    const map = {}
    for (const r of results) map[r.id] = r.data
    shipmentData.value = map
  } catch (_) { /* ignore */ }
  loading.value = false
}

function toggle(id) { expandedId.value = expandedId.value === id ? null : id }
function ships(id) { return shipmentData.value[id] || [] }

const phases = [
  { key: 'BOOKED', label: 'Booked' },
  { key: 'LOADED', label: 'Loaded' },
  { key: 'SAILED', label: 'In Transit' },
  { key: 'ARRIVED', label: 'Arrived' },
]

function phaseIdx(status) {
  if (['CUSTOMS_FILED', 'CLEARED', 'DELIVERED', 'COMPLETED'].includes(status)) return 4
  const i = phases.findIndex(s => s.key === status)
  return i >= 0 ? i + 1 : 0
}

const labels = {
  BOOKED: 'Container Booked', LOADED: 'Loaded on Vessel', SAILED: 'In Transit',
  ARRIVED: 'Arrived at Port', CUSTOMS_FILED: 'Customs Processing',
  CLEARED: 'Customs Cleared', DELIVERED: 'Delivered',
}

const colors = {
  BOOKED: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  LOADED: 'bg-blue-100 text-blue-700 border-blue-200',
  SAILED: 'bg-blue-100 text-blue-700 border-blue-200',
  ARRIVED: 'bg-violet-100 text-violet-700 border-violet-200',
  CUSTOMS_FILED: 'bg-amber-100 text-amber-700 border-amber-200',
  CLEARED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  DELIVERED: 'bg-green-100 text-green-700 border-green-200',
}

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '' }

onMounted(loadShipments)
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Shipment Tracking</h1>
        <p class="text-sm text-slate-400 mt-0.5">Track your orders from port to doorstep</p>
      </div>
    </div>

    <div v-if="loading" class="py-16 text-center text-slate-400">
      <i class="pi pi-spinner pi-spin text-2xl mb-3 block" /><p class="text-sm">Loading shipments...</p>
    </div>

    <div v-else-if="orders.length === 0" class="py-20 text-center">
      <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-50 to-cyan-50 mb-4">
        <i class="pi pi-send text-3xl text-blue-400" />
      </div>
      <h2 class="text-lg font-bold text-slate-700">No active shipments</h2>
      <p class="text-sm text-slate-400 mt-1 max-w-md mx-auto">Once your orders are booked, live tracking will appear here.</p>
    </div>

    <div v-else class="space-y-8">

      <!-- ===== SECTION: Active (LOADED/SAILED/ARRIVED) ===== -->
      <div v-if="activeShipments.length">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <h2 class="text-sm font-bold text-slate-700 uppercase tracking-wider">Active Shipments</h2>
          <span class="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{{ activeShipments.length }}</span>
        </div>
        <div class="space-y-3">
          <!-- Card -->
          <div v-for="order in activeShipments" :key="order.id" class="bg-white rounded-xl border shadow-sm overflow-hidden transition-all border-blue-100" :class="expandedId === order.id ? 'ring-2 ring-blue-200' : 'hover:shadow-md'">
            <!-- Header -->
            <div class="px-5 py-4 cursor-pointer" @click="toggle(order.id)">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"><i class="pi pi-send text-blue-600" /></div>
                  <div><h3 class="font-bold text-slate-800">{{ order.order_number }}</h3><p class="text-xs text-slate-400">{{ order.po_reference || '' }} · {{ order.item_count || 0 }} items</p></div>
                </div>
                <div class="flex items-center gap-3">
                  <span class="px-2.5 py-1 rounded-full text-xs font-medium border" :class="colors[order.status]">{{ labels[order.status] || order.status }}</span>
                  <i class="pi text-slate-400" :class="expandedId === order.id ? 'pi-chevron-up' : 'pi-chevron-down'" />
                </div>
              </div>
              <!-- Mini phase -->
              <div class="flex items-center gap-1 mt-3">
                <template v-for="(step, i) in phases" :key="step.key">
                  <div class="flex items-center gap-1">
                    <div class="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold" :class="phaseIdx(order.status) > i ? 'bg-emerald-500 text-white' : phaseIdx(order.status) === i ? 'bg-white border-2 border-emerald-500 text-emerald-600' : 'bg-slate-100 text-slate-400'">
                      <i v-if="phaseIdx(order.status) > i" class="pi pi-check text-[7px]" /><span v-else>{{ i + 1 }}</span>
                    </div>
                    <span class="text-[9px] hidden md:inline" :class="phaseIdx(order.status) >= i ? 'text-emerald-600 font-medium' : 'text-slate-400'">{{ step.label }}</span>
                  </div>
                  <div v-if="i < phases.length - 1" class="flex-1 h-0.5 mx-0.5" :class="phaseIdx(order.status) > i + 1 ? 'bg-emerald-400' : 'bg-slate-200'" />
                </template>
              </div>
            </div>
            <!-- Detail -->
            <div v-if="expandedId === order.id" class="border-t border-slate-100">
              <div v-if="!ships(order.id).length" class="px-5 py-8 text-center text-slate-400 text-sm"><i class="pi pi-info-circle mr-1" /> Details loading...</div>
              <div v-for="s in ships(order.id)" :key="s.id" class="px-5 py-5">
                <!-- Route viz -->
                <div class="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-5 mb-4">
                  <div class="flex items-center justify-between">
                    <div class="text-center flex-shrink-0">
                      <div class="w-10 h-10 mx-auto rounded-full bg-blue-500 text-white flex items-center justify-center mb-1"><i class="pi pi-upload text-sm" /></div>
                      <p class="text-sm font-bold text-blue-800">{{ s.port_of_loading || 'Origin' }}</p>
                      <p v-if="s.etd" class="text-[10px] text-blue-500 mt-0.5">ETD: {{ fmtDate(s.etd) }}</p>
                      <p v-if="s.atd" class="text-[10px] text-emerald-600">Departed: {{ fmtDate(s.atd) }}</p>
                    </div>
                    <div class="flex-1 mx-6 relative">
                      <div class="h-1 bg-blue-200 rounded-full w-full" />
                      <div class="h-1 bg-blue-500 rounded-full absolute top-0 left-0 transition-all duration-1000" :style="{ width: order.status === 'LOADED' ? '15%' : order.status === 'SAILED' ? '55%' : '95%' }" />
                      <div class="absolute top-1/2 -translate-y-1/2 transition-all duration-1000 -mt-0.5" :style="{ left: order.status === 'LOADED' ? '15%' : order.status === 'SAILED' ? '55%' : '95%' }">
                        <div class="w-8 h-8 -translate-x-1/2 rounded-full bg-white border-2 border-blue-500 shadow-lg flex items-center justify-center"><i class="pi pi-send text-blue-600 text-xs" /></div>
                      </div>
                    </div>
                    <div class="text-center flex-shrink-0">
                      <div class="w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-1" :class="['ARRIVED'].includes(order.status) ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'"><i class="pi pi-download text-sm" /></div>
                      <p class="text-sm font-bold" :class="order.status === 'ARRIVED' ? 'text-emerald-800' : 'text-slate-600'">{{ s.port_of_discharge || 'Destination' }}</p>
                      <p v-if="s.eta" class="text-[10px] text-blue-500 mt-0.5">ETA: {{ fmtDate(s.eta) }}</p>
                      <p v-if="s.ata" class="text-[10px] text-emerald-600">Arrived: {{ fmtDate(s.ata) }}</p>
                    </div>
                  </div>
                </div>
                <!-- Sailing Progress Panel (read-only version of admin's SailingTab) -->
                <div class="bg-white border border-slate-200 rounded-xl p-5 mb-4">
                  <!-- Route header -->
                  <div class="flex items-center gap-3 mb-3">
                    <span v-if="s.container_type" class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">{{ s.container_type }}</span>
                    <h4 class="font-bold text-slate-800">{{ s.port_of_loading || 'Origin' }} <i class="pi pi-arrow-right text-xs text-slate-400 mx-1" /> {{ s.port_of_discharge || 'Destination' }}</h4>
                  </div>

                  <!-- Progress bar -->
                  <div class="relative mb-1">
                    <div class="h-2 bg-slate-100 rounded-full w-full" />
                    <div class="h-2 rounded-full absolute top-0 left-0 transition-all duration-700"
                      :class="(s.phase || s.sailing_phase) === 'ARRIVED' ? 'bg-emerald-500' : 'bg-blue-500'"
                      :style="{ width: !s.phase && !s.sailing_phase ? '5%' : (s.phase || s.sailing_phase) === 'LOADED' ? '33%' : (s.phase || s.sailing_phase) === 'SAILED' ? '66%' : '100%' }" />
                  </div>
                  <div class="flex justify-between text-[10px] text-slate-400 mb-4">
                    <span v-if="s.etd">ETD: {{ fmtDate(s.etd) }}</span><span v-else>&nbsp;</span>
                    <span class="font-medium" :class="(s.phase || s.sailing_phase) === 'ARRIVED' ? 'text-emerald-600' : 'text-blue-600'">
                      {{ !s.phase && !s.sailing_phase ? '0%' : (s.phase || s.sailing_phase) === 'LOADED' ? '33%' : (s.phase || s.sailing_phase) === 'SAILED' ? '66%' : '100%' }}
                    </span>
                    <span v-if="s.eta">ETA: {{ fmtDate(s.eta) }}</span><span v-else>&nbsp;</span>
                  </div>

                  <!-- 3-step phase cards -->
                  <div class="grid grid-cols-3 gap-3">
                    <!-- Loaded -->
                    <div class="rounded-xl border-2 p-4 transition-all"
                      :class="(s.phase || s.sailing_phase) ? 'border-emerald-300 bg-emerald-50' : 'border-blue-200 bg-blue-50'">
                      <div class="flex items-center gap-2 mb-2">
                        <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                          :class="(s.phase || s.sailing_phase) ? 'bg-emerald-500 text-white' : 'bg-blue-100 text-blue-600'">
                          <i v-if="s.phase || s.sailing_phase" class="pi pi-check text-[10px]" /><span v-else>1</span>
                        </div>
                        <span class="font-bold text-sm" :class="(s.phase || s.sailing_phase) ? 'text-emerald-700' : 'text-blue-700'">Loaded</span>
                      </div>
                      <p v-if="s.atd || s.loading_date" class="text-[10px] text-slate-500">{{ fmtDate(s.atd || s.loading_date) }}</p>
                      <p v-else-if="!(s.phase || s.sailing_phase)" class="text-[10px] text-blue-500">Awaiting loading</p>
                      <p v-else class="text-[10px] text-emerald-600"><i class="pi pi-check text-[8px] mr-0.5" /> Complete</p>
                    </div>

                    <!-- Sailed -->
                    <div class="rounded-xl border-2 p-4 transition-all"
                      :class="['SAILED', 'ARRIVED'].includes(s.phase || s.sailing_phase) ? 'border-emerald-300 bg-emerald-50' : (s.phase || s.sailing_phase) === 'LOADED' ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'">
                      <div class="flex items-center gap-2 mb-2">
                        <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                          :class="['SAILED', 'ARRIVED'].includes(s.phase || s.sailing_phase) ? 'bg-emerald-500 text-white' : (s.phase || s.sailing_phase) === 'LOADED' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'">
                          <i v-if="['SAILED', 'ARRIVED'].includes(s.phase || s.sailing_phase)" class="pi pi-check text-[10px]" /><span v-else>2</span>
                        </div>
                        <span class="font-bold text-sm" :class="['SAILED', 'ARRIVED'].includes(s.phase || s.sailing_phase) ? 'text-emerald-700' : 'text-slate-500'">Sailed</span>
                      </div>
                      <p v-if="s.atd && ['SAILED', 'ARRIVED'].includes(s.phase || s.sailing_phase)" class="text-[10px] text-emerald-600">Departed {{ fmtDate(s.atd) }}</p>
                      <p v-else class="text-[10px] text-slate-400">Pending</p>
                    </div>

                    <!-- Arrived -->
                    <div class="rounded-xl border-2 p-4 transition-all"
                      :class="(s.phase || s.sailing_phase) === 'ARRIVED' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'">
                      <div class="flex items-center gap-2 mb-2">
                        <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                          :class="(s.phase || s.sailing_phase) === 'ARRIVED' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'">
                          <i v-if="(s.phase || s.sailing_phase) === 'ARRIVED'" class="pi pi-check text-[10px]" /><span v-else>3</span>
                        </div>
                        <span class="font-bold text-sm" :class="(s.phase || s.sailing_phase) === 'ARRIVED' ? 'text-emerald-700' : 'text-slate-500'">Arrived</span>
                      </div>
                      <p v-if="s.ata" class="text-[10px] text-emerald-600">Arrived {{ fmtDate(s.ata) }}</p>
                      <p v-else class="text-[10px] text-slate-400">Pending</p>
                    </div>
                  </div>
                </div>

                <!-- Details grid -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div v-if="s.vessel_name" class="bg-slate-50 rounded-lg p-3"><p class="text-[10px] text-slate-400 uppercase">Vessel</p><p class="font-medium text-sm text-slate-700 mt-0.5">{{ s.vessel_name }}</p><p v-if="s.voyage_number" class="text-[10px] text-slate-400">Voyage: {{ s.voyage_number }}</p></div>
                  <div v-if="s.container_number" class="bg-slate-50 rounded-lg p-3"><p class="text-[10px] text-slate-400 uppercase">Container</p><p class="font-medium text-sm text-slate-700 mt-0.5">{{ s.container_number }}</p><p v-if="s.container_type" class="text-[10px] text-slate-400">{{ s.container_type }}</p></div>
                  <div v-if="s.bl_number" class="bg-slate-50 rounded-lg p-3"><p class="text-[10px] text-slate-400 uppercase">B/L Number</p><p class="font-medium text-sm text-slate-700 mt-0.5">{{ s.bl_number }}</p></div>
                  <div class="bg-slate-50 rounded-lg p-3"><p class="text-[10px] text-slate-400 uppercase">Items Loaded</p><p class="font-medium text-sm text-slate-700 mt-0.5">{{ (s.items || []).length }} products</p><p class="text-[10px] text-slate-400">{{ (s.items || []).reduce((sum, i) => sum + (i.allocated_qty || 0), 0) }} units</p></div>
                </div>
                <!-- Items table -->
                <div v-if="s.items?.length" class="border border-slate-200 rounded-lg overflow-hidden">
                  <div class="px-4 py-2.5 bg-slate-50 border-b"><h4 class="text-xs font-bold text-slate-600 uppercase">Items in Container</h4></div>
                  <table class="w-full text-xs">
                    <thead><tr class="border-b border-slate-100"><th class="px-4 py-2 text-left font-medium text-slate-500">Product</th><th class="px-4 py-2 text-right font-medium text-slate-500">Ordered</th><th class="px-4 py-2 text-right font-medium text-slate-500">Loaded</th></tr></thead>
                    <tbody><tr v-for="item in s.items" :key="item.id" class="border-t border-slate-50"><td class="px-4 py-2"><span class="font-mono text-slate-500">{{ item.product_code }}</span> <span class="text-slate-700">{{ item.product_name }}</span></td><td class="px-4 py-2 text-right text-slate-500">{{ item.ordered_qty }}</td><td class="px-4 py-2 text-right font-medium text-slate-800">{{ item.allocated_qty }}</td></tr></tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== SECTION: Upcoming (BOOKED) ===== -->
      <div v-if="upcomingShipments.length">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-2 h-2 rounded-full bg-cyan-400" />
          <h2 class="text-sm font-bold text-slate-700 uppercase tracking-wider">Upcoming</h2>
          <span class="text-[10px] text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-full">{{ upcomingShipments.length }}</span>
        </div>
        <div class="space-y-3">
          <div v-for="order in upcomingShipments" :key="order.id" class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" :class="expandedId === order.id ? 'ring-2 ring-cyan-200' : 'hover:shadow-md'">
            <div class="px-5 py-4 cursor-pointer" @click="toggle(order.id)">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-cyan-50 flex items-center justify-center"><i class="pi pi-calendar text-cyan-600" /></div>
                  <div><h3 class="font-bold text-slate-800">{{ order.order_number }}</h3><p class="text-xs text-slate-400">{{ order.po_reference || '' }} · {{ order.item_count || 0 }} items</p></div>
                </div>
                <div class="flex items-center gap-3">
                  <span class="px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-700 border border-cyan-200">Preparing</span>
                  <i class="pi text-slate-400" :class="expandedId === order.id ? 'pi-chevron-up' : 'pi-chevron-down'" />
                </div>
              </div>
            </div>
            <div v-if="expandedId === order.id" class="border-t border-slate-100 px-5 py-5">
              <div v-if="!ships(order.id).length" class="py-4 text-center text-slate-400 text-sm">Container booking in progress — details coming soon.</div>
              <div v-for="s in ships(order.id)" :key="s.id">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div class="bg-slate-50 rounded-lg p-3"><p class="text-[10px] text-slate-400 uppercase">Container Type</p><p class="font-medium text-sm text-slate-700 mt-0.5">{{ s.container_type || 'TBD' }}</p></div>
                  <div class="bg-slate-50 rounded-lg p-3"><p class="text-[10px] text-slate-400 uppercase">Route</p><p class="font-medium text-sm text-slate-700 mt-0.5">{{ s.port_of_loading || '?' }} → {{ s.port_of_discharge || '?' }}</p></div>
                  <div v-if="s.etd" class="bg-slate-50 rounded-lg p-3"><p class="text-[10px] text-slate-400 uppercase">Est. Departure</p><p class="font-medium text-sm text-slate-700 mt-0.5">{{ fmtDate(s.etd) }}</p></div>
                  <div v-if="s.eta" class="bg-slate-50 rounded-lg p-3"><p class="text-[10px] text-slate-400 uppercase">Est. Arrival</p><p class="font-medium text-sm text-slate-700 mt-0.5">{{ fmtDate(s.eta) }}</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== SECTION: Completed (CUSTOMS/CLEARED/DELIVERED) ===== -->
      <div v-if="completedShipments.length">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-2 h-2 rounded-full bg-emerald-500" />
          <h2 class="text-sm font-bold text-slate-700 uppercase tracking-wider">Completed</h2>
          <span class="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{{ completedShipments.length }}</span>
        </div>
        <div class="space-y-3">
          <div v-for="order in completedShipments" :key="order.id" class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden opacity-80" :class="expandedId === order.id ? 'ring-2 ring-emerald-200 opacity-100' : 'hover:shadow-md hover:opacity-100'">
            <div class="px-5 py-4 cursor-pointer" @click="toggle(order.id)">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center"><i class="pi pi-check-circle text-emerald-600" /></div>
                  <div><h3 class="font-bold text-slate-800">{{ order.order_number }}</h3><p class="text-xs text-slate-400">{{ order.po_reference || '' }} · {{ order.item_count || 0 }} items</p></div>
                </div>
                <div class="flex items-center gap-3">
                  <span class="px-2.5 py-1 rounded-full text-xs font-medium border" :class="colors[order.status] || 'bg-emerald-100 text-emerald-700'">{{ labels[order.status] || order.status }}</span>
                  <i class="pi text-slate-400" :class="expandedId === order.id ? 'pi-chevron-up' : 'pi-chevron-down'" />
                </div>
              </div>
            </div>
            <div v-if="expandedId === order.id" class="border-t border-slate-100 px-5 py-5">
              <div v-if="!ships(order.id).length" class="py-4 text-center text-slate-400 text-sm">No shipment data recorded.</div>
              <div v-for="s in ships(order.id)" :key="s.id">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div v-if="s.vessel_name" class="bg-slate-50 rounded-lg p-3"><p class="text-[10px] text-slate-400 uppercase">Vessel</p><p class="font-medium text-sm text-slate-700 mt-0.5">{{ s.vessel_name }}</p></div>
                  <div v-if="s.container_number" class="bg-slate-50 rounded-lg p-3"><p class="text-[10px] text-slate-400 uppercase">Container</p><p class="font-medium text-sm text-slate-700 mt-0.5">{{ s.container_number }}</p></div>
                  <div class="bg-slate-50 rounded-lg p-3"><p class="text-[10px] text-slate-400 uppercase">Route</p><p class="font-medium text-sm text-slate-700 mt-0.5">{{ s.port_of_loading || '?' }} → {{ s.port_of_discharge || '?' }}</p></div>
                  <div v-if="s.ata" class="bg-slate-50 rounded-lg p-3"><p class="text-[10px] text-slate-400 uppercase">Arrived</p><p class="font-medium text-sm text-emerald-700 mt-0.5">{{ fmtDate(s.ata) }}</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
