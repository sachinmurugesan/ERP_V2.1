<script setup>
import { ref, computed, onMounted } from 'vue'
import { paymentsApi, shipmentsApi, customsApi } from '../../api'

const props = defineProps({
  orderId: { type: String, required: true },
  order: { type: Object, required: true },
  timeline: { type: Object, default: null },
})

// ========================================
// State
// ========================================
const loading = ref(true)
const clientPay = ref(null)
const factoryPay = ref(null)
const shipments = ref([])
const boeMap = ref({})

// ========================================
// Data Loading
// ========================================
onMounted(async () => {
  try {
    const [payRes, factRes, shipRes] = await Promise.all([
      paymentsApi.list(props.orderId).catch(() => ({ data: null })),
      paymentsApi.factoryList(props.orderId).catch(() => ({ data: null })),
      shipmentsApi.list(props.orderId).catch(() => ({ data: [] })),
    ])
    clientPay.value = payRes.data
    factoryPay.value = factRes.data
    shipments.value = Array.isArray(shipRes.data) ? shipRes.data : []

    const boePromises = shipments.value.map(s =>
      customsApi.getBoe(s.id).then(r => [s.id, r.data]).catch(() => [s.id, null])
    )
    const boeResults = await Promise.all(boePromises)
    const map = {}
    for (const [id, data] of boeResults) map[id] = data
    boeMap.value = map
  } catch (e) {
    console.error('Dashboard load error:', e)
  } finally {
    loading.value = false
  }
})

// ========================================
// Helpers
// ========================================
const fmt = (v) => {
  if (v == null || isNaN(v)) return '—'
  return Number(v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
const fmtLakh = (v) => {
  if (v == null || isNaN(v) || v === 0) return '—'
  const n = Number(v)
  if (n >= 100000) return (n / 100000).toFixed(2) + 'L'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return fmt(n)
}
const fmtDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}
const fmtDateFull = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ========================================
// Carried forward items (from order.items notes)
// ========================================
const carriedItems = computed(() => {
  const items = props.order?.items || []
  return items.filter(i =>
    (i.notes && (i.notes.startsWith('After-Sales') || i.notes.startsWith('Carried from')))
  ).map(i => ({
    ...i,
    _carryType: i.notes.startsWith('After-Sales') ? 'aftersales' : 'unloaded',
    _carryLabel: i.notes.startsWith('After-Sales')
      ? (i.notes.includes('Replacement') ? 'Replacement' : 'Compensation')
      : 'Unloaded',
    _sourceOrder: (i.notes.match(/from (ORD-[\w-]+)/) || [])[1] || 'Previous order',
  }))
})

// ========================================
// Financial computed
// ========================================
const cs = computed(() => clientPay.value?.summary || {})
const fs = computed(() => factoryPay.value?.summary || {})
const totalDuty = computed(() => {
  let sum = 0
  for (const boe of Object.values(boeMap.value)) {
    if (boe?.total_duty) sum += boe.total_duty
  }
  return sum
})
const totalIgst = computed(() => {
  let sum = 0
  for (const boe of Object.values(boeMap.value)) {
    if (boe?.total_igst) sum += boe.total_igst
  }
  return sum
})

// Profit estimate = PI total - factory cost - duty
const estProfit = computed(() => {
  const pi = cs.value.pi_total_inr || 0
  const factory = fs.value.factory_total_inr || 0
  const duty = totalDuty.value || 0
  if (!pi) return null
  return pi - factory - duty
})

// ========================================
// Stage milestone mapping
// ========================================
const STAGE_ORDER = [
  'DRAFT', 'PENDING_PI', 'PI_SENT', 'ADVANCE_PENDING', 'ADVANCE_RECEIVED',
  'FACTORY_ORDERED', 'PRODUCTION_60', 'PRODUCTION_80', 'PRODUCTION_90',
  'PLAN_PACKING', 'FINAL_PI', 'PRODUCTION_100',
  'BOOKED', 'LOADED', 'SAILED', 'ARRIVED',
  'CUSTOMS_FILED', 'CLEARED', 'DELIVERED', 'AFTER_SALES', 'COMPLETED'
]
const stageIdx = computed(() => {
  const idx = STAGE_ORDER.indexOf(props.order?.status)
  return idx >= 0 ? idx + 1 : 0
})
const progressPercent = computed(() => Math.round((stageIdx.value / STAGE_ORDER.length) * 100))

// Key milestones (6 simplified stages)
const milestones = computed(() => {
  const tl = props.timeline?.timeline || []
  const find = (nums) => {
    for (const n of nums) {
      const s = tl.find(t => t.stage === n)
      if (s) return s.status
    }
    return 'pending'
  }
  return [
    { label: 'Ordered', icon: 'pi-shopping-cart', status: find([5]), date: props.order?.created_at },
    { label: 'Production', icon: 'pi-cog', status: find([8, 7, 6]), date: null },
    { label: 'Shipped', icon: 'pi-send', status: find([13, 12]), date: shipments.value[0]?.atd },
    { label: 'Arrived', icon: 'pi-map-marker', status: find([13]), date: shipments.value[0]?.ata },
    { label: 'Customs', icon: 'pi-file-check', status: find([14]), date: null },
    { label: 'Delivered', icon: 'pi-check-circle', status: find([15]), date: null },
    { label: 'After-Sales', icon: 'pi-exclamation-triangle', status: find([16]), date: null },
  ]
})

// Shipment phase progress
const phaseProgress = (phase) => {
  const map = { PENDING: 10, BOOKED: 25, LOADED: 40, SAILING: 60, ARRIVED: 80, CUSTOMS: 90, DELIVERED: 100 }
  return map[phase] || 0
}
</script>

<template>
  <!-- Loading state -->
  <div v-if="loading" class="flex items-center justify-center py-20">
    <div class="relative">
      <div class="w-12 h-12 rounded-full border-2 border-slate-200 border-t-emerald-500 animate-spin"></div>
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="w-6 h-6 rounded-full bg-emerald-500/20"></div>
      </div>
    </div>
  </div>

  <div v-else class="space-y-5">

    <!-- ===== TOP ROW: Hero Stats (2-column layout) ===== -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">

      <!-- Left: Client Payment Ring -->
      <div class="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white relative overflow-hidden">
        <!-- Decorative glow -->
        <div class="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl"></div>
        <div class="absolute -bottom-8 -left-8 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl"></div>

        <div class="relative flex items-start justify-between mb-4">
          <div>
            <div class="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Client Payments</div>
            <div class="text-2xl font-black tracking-tight">
              {{ cs.paid_percent != null ? cs.paid_percent.toFixed(0) : '0' }}<span class="text-base text-emerald-400">%</span>
            </div>
          </div>
          <!-- Circular progress -->
          <div class="relative w-16 h-16">
            <svg class="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="4" />
              <circle cx="32" cy="32" r="28" fill="none" stroke="url(#ring-grad)" stroke-width="4" stroke-linecap="round"
                :stroke-dasharray="175.9" :stroke-dashoffset="175.9 - (175.9 * Math.min((cs.paid_percent || 0), 100) / 100)"
                class="transition-all duration-1000" />
              <defs>
                <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#34d399" />
                  <stop offset="100%" stop-color="#3b82f6" />
                </linearGradient>
              </defs>
            </svg>
            <div class="absolute inset-0 flex items-center justify-center">
              <i class="pi pi-wallet text-emerald-400 text-sm"></i>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <div class="text-[9px] text-slate-500 uppercase">PI Total</div>
            <div class="text-sm font-bold text-white/90">{{ cs.pi_total_inr ? '₹' + fmtLakh(cs.pi_total_inr) : '—' }}</div>
          </div>
          <div>
            <div class="text-[9px] text-slate-500 uppercase">Received</div>
            <div class="text-sm font-bold text-emerald-400">{{ cs.total_paid_inr ? '₹' + fmtLakh(cs.total_paid_inr) : '—' }}</div>
          </div>
          <div>
            <div class="text-[9px] text-slate-500 uppercase">Balance</div>
            <div :class="['text-sm font-bold', cs.balance_inr > 0 ? 'text-amber-400' : 'text-emerald-400']">
              {{ cs.balance_inr != null ? '₹' + fmtLakh(cs.balance_inr) : '—' }}
            </div>
          </div>
          <div>
            <div class="text-[9px] text-slate-500 uppercase">Payments</div>
            <div class="text-sm font-bold text-white/70">{{ cs.payment_count || 0 }}</div>
          </div>
        </div>
      </div>

      <!-- Center: Factory + Duty -->
      <div class="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white relative overflow-hidden">
        <div class="absolute -top-10 -right-10 w-32 h-32 bg-violet-500/10 rounded-full blur-2xl"></div>

        <div class="text-[10px] uppercase tracking-wider text-slate-400 mb-3">Factory & Costs</div>

        <div class="space-y-3">
          <!-- Factory cost bar -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-[9px] text-slate-400 uppercase">Factory Cost</span>
              <span class="text-xs font-bold text-white/90">{{ fs.factory_total_inr ? '₹' + fmtLakh(fs.factory_total_inr) : '—' }}</span>
            </div>
            <div class="w-full bg-white/5 rounded-full h-1.5">
              <div class="bg-gradient-to-r from-violet-500 to-purple-400 h-1.5 rounded-full transition-all"
                :style="{ width: (fs.paid_percent || 0) + '%' }"></div>
            </div>
            <div class="flex items-center justify-between mt-0.5">
              <span class="text-[8px] text-emerald-400">Paid: ₹{{ fmtLakh(fs.total_inr) }}</span>
              <span class="text-[8px]" :class="fs.balance_inr > 0 ? 'text-amber-400' : 'text-emerald-400'">
                Bal: ₹{{ fmtLakh(fs.balance_inr) }}
              </span>
            </div>
          </div>

          <!-- Duty -->
          <div class="pt-2 border-t border-white/5">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[9px] text-slate-400 uppercase">Customs Duty</span>
              <span class="text-xs font-bold text-red-400">{{ totalDuty ? '₹' + fmtLakh(totalDuty) : '—' }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-[9px] text-slate-400 uppercase">IGST Credit</span>
              <span class="text-xs font-bold text-emerald-400">{{ totalIgst ? '₹' + fmtLakh(totalIgst) : '—' }}</span>
            </div>
          </div>

          <!-- Profit estimate -->
          <div v-if="estProfit !== null" class="pt-2 border-t border-white/5">
            <div class="flex items-center justify-between">
              <span class="text-[9px] text-slate-400 uppercase">Est. Margin</span>
              <span :class="['text-sm font-black', estProfit > 0 ? 'text-emerald-400' : 'text-red-400']">
                {{ estProfit > 0 ? '+' : '' }}₹{{ fmtLakh(estProfit) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Order Progress -->
      <div class="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white relative overflow-hidden">
        <div class="absolute -bottom-8 -right-8 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl"></div>

        <div class="flex items-center justify-between mb-4">
          <div class="text-[10px] uppercase tracking-wider text-slate-400">Order Progress</div>
          <div class="flex items-center gap-1.5">
            <span class="text-lg font-black text-white">{{ progressPercent }}</span>
            <span class="text-xs text-blue-400">%</span>
          </div>
        </div>

        <!-- Milestone icons in a horizontal line -->
        <div class="flex items-center justify-between mb-4">
          <template v-for="(m, i) in milestones" :key="i">
            <div class="flex flex-col items-center">
              <div :class="[
                'w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-all',
                m.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30' :
                m.status === 'current' ? 'bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/50 animate-pulse' :
                'bg-white/5 text-slate-500'
              ]">
                <i :class="['pi', m.icon, 'text-[11px]']" />
              </div>
              <span class="text-[8px] mt-1 text-slate-500 text-center leading-tight">{{ m.label }}</span>
              <span v-if="m.date" class="text-[7px] text-slate-600">{{ fmtDate(m.date) }}</span>
            </div>
            <!-- Connector line -->
            <div v-if="i < milestones.length - 1" :class="[
              'flex-1 h-px mx-1',
              m.status === 'completed' ? 'bg-emerald-500/40' : 'bg-white/5'
            ]"></div>
          </template>
        </div>

        <!-- Segmented progress bar -->
        <div class="flex items-center gap-0.5">
          <div v-for="i in 20" :key="i"
            :class="[
              'flex-1 h-1.5 rounded-sm transition-all duration-300',
              i <= (progressPercent / 5) ? 'bg-gradient-to-r from-emerald-500 to-blue-500' : 'bg-white/5'
            ]"></div>
        </div>
        <div class="flex items-center justify-between mt-1.5">
          <span class="text-[8px] text-slate-500">{{ timeline?.current_name || order?.status }}</span>
          <span class="text-[8px] text-slate-500">{{ stageIdx }}/{{ STAGE_ORDER.length }} stages</span>
        </div>
      </div>
    </div>

    <!-- ===== SHIPMENT TRACKER ===== -->
    <div class="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white relative overflow-hidden">
      <div class="absolute -top-16 -right-16 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl"></div>

      <div class="flex items-center justify-between mb-4 relative">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <i class="pi pi-send text-blue-400 text-[11px]" />
          </div>
          <span class="text-[10px] uppercase tracking-wider text-slate-400">Shipment Tracker</span>
        </div>
        <span v-if="shipments.length" class="text-[10px] text-slate-500">{{ shipments.length }} container{{ shipments.length > 1 ? 's' : '' }}</span>
      </div>

      <div v-if="!shipments.length" class="text-center py-8">
        <div class="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/5 flex items-center justify-center">
          <i class="pi pi-inbox text-slate-500 text-xl" />
        </div>
        <span class="text-xs text-slate-500">No shipments booked yet</span>
      </div>

      <div v-for="ship in shipments" :key="ship.id" class="relative">
        <!-- Route visualization -->
        <div class="flex items-center gap-4 mb-4">
          <div class="flex-1">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] font-bold rounded-md border border-blue-500/20">
                  {{ ship.container_type }}
                </span>
                <span class="text-xs font-mono text-slate-500">#{{ ship.container_number }}</span>
              </div>
              <span :class="[
                'px-2.5 py-1 text-[10px] font-bold rounded-md border',
                ship.phase === 'ARRIVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                ship.phase === 'SAILING' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                ship.phase === 'DELIVERED' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                'bg-white/5 text-slate-400 border-white/10'
              ]">{{ ship.phase }}</span>
            </div>

            <!-- Route line with dots -->
            <div class="relative py-3">
              <div class="flex items-center">
                <!-- Origin -->
                <div class="flex flex-col items-center z-10">
                  <div class="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-500/30"></div>
                  <span class="text-[9px] text-blue-300 mt-1 font-bold">{{ ship.port_of_loading }}</span>
                  <span class="text-[8px] text-slate-500">{{ fmtDate(ship.atd || ship.actual_departure_date) }}</span>
                </div>

                <!-- Line -->
                <div class="flex-1 mx-3 relative">
                  <div class="h-px bg-white/10 w-full"></div>
                  <div class="h-px bg-gradient-to-r from-blue-500 to-emerald-500 absolute top-0 left-0 transition-all duration-1000"
                    :style="{ width: phaseProgress(ship.phase) + '%' }"></div>
                  <!-- Ship icon on the line -->
                  <div class="absolute top-1/2 -translate-y-1/2 transition-all duration-1000"
                    :style="{ left: Math.min(phaseProgress(ship.phase), 92) + '%' }">
                    <span class="text-base">&#x1F6A2;</span>
                  </div>
                </div>

                <!-- Destination -->
                <div class="flex flex-col items-center z-10">
                  <div :class="['w-3 h-3 rounded-full ring-2', ship.ata ? 'bg-emerald-500 ring-emerald-500/30' : 'bg-white/20 ring-white/10']"></div>
                  <span :class="['text-[9px] mt-1 font-bold', ship.ata ? 'text-emerald-300' : 'text-slate-500']">{{ ship.port_of_discharge }}</span>
                  <span class="text-[8px] text-slate-500">{{ ship.ata ? fmtDate(ship.ata) : 'ETA ' + fmtDate(ship.eta) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Ship details row -->
        <div class="grid grid-cols-4 gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/5">
          <div>
            <div class="text-[8px] text-slate-500 uppercase">Vessel</div>
            <div class="text-[11px] font-medium text-white/80 truncate">{{ ship.vessel_name || '—' }}</div>
          </div>
          <div>
            <div class="text-[8px] text-slate-500 uppercase">Bill of Lading</div>
            <div class="text-[11px] font-medium text-white/80 font-mono">{{ ship.bl_number || '—' }}</div>
          </div>
          <div>
            <div class="text-[8px] text-slate-500 uppercase">Transit</div>
            <div class="text-[11px] font-medium text-white/80">
              <template v-if="ship.atd && ship.ata">
                {{ Math.ceil((new Date(ship.ata) - new Date(ship.atd)) / 86400000) }} days
              </template>
              <template v-else>—</template>
            </div>
          </div>
          <div>
            <div class="text-[8px] text-slate-500 uppercase">Schedule</div>
            <div v-if="ship.ata && ship.eta" :class="['text-[11px] font-bold', new Date(ship.ata) > new Date(ship.eta) ? 'text-red-400' : 'text-emerald-400']">
              {{ new Date(ship.ata) > new Date(ship.eta)
                ? '+' + Math.ceil((new Date(ship.ata) - new Date(ship.eta)) / 86400000) + 'd late'
                : 'On time' }}
            </div>
            <div v-else class="text-[11px] text-slate-500">In transit</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== CUSTOMS & DUTY ===== -->
    <div class="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white relative overflow-hidden">
      <div class="absolute -bottom-12 -left-12 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl"></div>

      <div class="flex items-center justify-between mb-4 relative">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <i class="pi pi-file-check text-amber-400 text-[11px]" />
          </div>
          <span class="text-[10px] uppercase tracking-wider text-slate-400">Customs & Duty</span>
        </div>
      </div>

      <div v-if="!Object.values(boeMap).some(b => b)" class="text-center py-8">
        <div class="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/5 flex items-center justify-center">
          <i class="pi pi-file text-slate-500 text-xl" />
        </div>
        <span class="text-xs text-slate-500">No BOE filed yet</span>
      </div>

      <div v-for="(boe, shipId) in boeMap" :key="shipId">
        <div v-if="boe">
          <!-- BOE header -->
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <span class="text-xs text-slate-400">BE:</span>
              <span class="text-xs font-bold text-white/80 font-mono">{{ boe.be_number || 'Pending' }}</span>
              <span v-if="boe.be_date" class="text-[10px] text-slate-500">{{ fmtDateFull(boe.be_date) }}</span>
            </div>
            <span :class="[
              'px-2.5 py-1 text-[10px] font-bold rounded-md border',
              boe.status === 'FILED' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
              boe.status === 'ASSESSED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
              'bg-amber-500/10 text-amber-400 border-amber-500/20'
            ]">{{ boe.status }}</span>
          </div>

          <!-- Value flow: FOB → CIF → AV → Duty -->
          <div class="flex items-center gap-1 mb-4">
            <div class="flex-1 p-2.5 bg-white/[0.03] rounded-lg border border-white/5 text-center">
              <div class="text-[8px] text-slate-500 uppercase">FOB</div>
              <div class="text-xs font-bold text-white/80">₹{{ fmtLakh(boe.fob_inr) }}</div>
            </div>
            <i class="pi pi-chevron-right text-[8px] text-slate-600" />
            <div class="flex-1 p-2.5 bg-white/[0.03] rounded-lg border border-white/5 text-center">
              <div class="text-[8px] text-slate-500 uppercase">CIF</div>
              <div class="text-xs font-bold text-white/80">₹{{ fmtLakh(boe.cif_inr) }}</div>
            </div>
            <i class="pi pi-chevron-right text-[8px] text-slate-600" />
            <div class="flex-1 p-2.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-center">
              <div class="text-[8px] text-indigo-300 uppercase">AV</div>
              <div class="text-xs font-bold text-indigo-300">₹{{ fmtLakh(boe.assessment_value_inr) }}</div>
            </div>
            <i class="pi pi-chevron-right text-[8px] text-slate-600" />
            <div class="flex-1 p-2.5 bg-red-500/10 rounded-lg border border-red-500/20 text-center">
              <div class="text-[8px] text-red-300 uppercase">Total Duty</div>
              <div class="text-sm font-black text-red-400">₹{{ fmtLakh(boe.total_duty) }}</div>
            </div>
            <i class="pi pi-chevron-right text-[8px] text-slate-600" />
            <div class="flex-1 p-2.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-center">
              <div class="text-[8px] text-emerald-300 uppercase">IGST Credit</div>
              <div class="text-sm font-black text-emerald-400">₹{{ fmtLakh(boe.total_igst) }}</div>
            </div>
          </div>

          <!-- Duty breakdown pills -->
          <div class="flex items-center gap-2 p-3 bg-white/[0.03] rounded-xl border border-white/5">
            <span class="px-2.5 py-1 bg-amber-500/10 text-amber-300 text-[10px] font-medium rounded-md border border-amber-500/10">
              BCD ₹{{ fmt(boe.total_bcd) }}
            </span>
            <span class="px-2.5 py-1 bg-orange-500/10 text-orange-300 text-[10px] font-medium rounded-md border border-orange-500/10">
              SWC ₹{{ fmt(boe.total_swc) }}
            </span>
            <span class="px-2.5 py-1 bg-blue-500/10 text-blue-300 text-[10px] font-medium rounded-md border border-blue-500/10">
              IGST ₹{{ fmt(boe.total_igst) }}
            </span>
            <span class="ml-auto text-[9px] text-slate-500">
              Rate: {{ boe.exchange_rate }} {{ order?.currency || 'CNY' }}/INR
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ CARRIED FORWARD ITEMS ═══ -->
    <div v-if="carriedItems.length > 0" class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div class="flex items-center gap-2 mb-4">
        <i class="pi pi-replay text-emerald-600 text-sm" />
        <h3 class="font-bold text-slate-800 text-sm">Carried Forward Items</h3>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">{{ carriedItems.length }}</span>
      </div>
      <div class="space-y-2">
        <div
          v-for="ci in carriedItems" :key="ci.id"
          class="flex items-center justify-between p-3 rounded-lg bg-slate-50"
        >
          <div class="flex items-center gap-3">
            <span
              class="px-2 py-0.5 rounded-full text-[9px] font-bold"
              :class="ci._carryType === 'aftersales' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'"
            >{{ ci._carryLabel }}</span>
            <div>
              <span class="font-mono text-xs text-slate-600">{{ ci.product_code_snapshot || '—' }}</span>
              <span class="text-xs text-slate-500 ml-2">{{ ci.product_name_snapshot || '' }}</span>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <span class="text-xs font-medium text-slate-700">Qty: {{ ci.quantity }}</span>
            <span class="text-[10px] text-slate-400">from {{ ci._sourceOrder }}</span>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>
