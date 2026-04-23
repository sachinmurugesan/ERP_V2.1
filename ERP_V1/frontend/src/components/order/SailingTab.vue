<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { shipmentsApi } from '../../api'
import { formatDate } from '../../utils/formatters'

const props = defineProps({
  orderId: { type: String, required: true },
  order: { type: Object, required: true },
})
const emit = defineEmits(['reload'])

// ========================================
// State
// ========================================
const loading = ref(false)
const saving = ref(false)
const shipments = ref([])
const progressMap = ref({})
const shippingDocsMap = ref({}) // shipmentId → [docs]
const error = ref('')
const refreshInterval = ref(null)

// Phase forms
const sailedForm = ref({
  container_number: '',
  seal_number: '',
  vessel_name: '',
  voyage_number: '',
  bl_number: '',
  actual_departure_date: '',
  revised_eta: '',
})

const arrivedForm = ref({
  actual_arrival_date: '',
  cfs_receipt_number: '',
  arrival_notes: '',
})

const loadedForm = ref({
  loading_date: '',
  loading_notes: '',
})

const activePhaseShipmentId = ref(null)
const activePhaseType = ref(null) // 'loaded', 'sailed', 'arrived'

// ========================================
// Computed
// ========================================
const isSailingStage = computed(() => {
  const s = ['LOADED', 'SAILED', 'ARRIVED', 'CUSTOMS_FILED', 'CLEARED', 'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING']
  return s.includes(props.order?.status)
})

// ========================================
// Functions
// ========================================
async function loadShipments() {
  loading.value = true
  error.value = ''
  try {
    const res = await shipmentsApi.list(props.orderId)
    shipments.value = res.data || []
    // Load progress and shipping docs in parallel
    await Promise.all([loadAllProgress(), loadShippingDocs()])
  } catch (err) {
    console.error('Failed to load shipments:', err)
    error.value = err.response?.data?.detail || 'Failed to load shipments'
  } finally {
    loading.value = false
  }
}

async function loadShippingDocs() {
  try {
    const res = await shipmentsApi.listDocs(props.orderId)
    const docs = res.data || []
    // Group docs by shipment_id
    const map = {}
    for (const doc of docs) {
      if (!doc.shipment_id) continue
      if (!map[doc.shipment_id]) map[doc.shipment_id] = []
      map[doc.shipment_id].push(doc)
    }
    shippingDocsMap.value = map
  } catch {
    shippingDocsMap.value = {}
  }
}

function getShipmentDocs(shipmentId) {
  return shippingDocsMap.value[shipmentId] || []
}

function docsReceivedCount(shipmentId) {
  return getShipmentDocs(shipmentId).filter(d => d.status === 'RECEIVED').length
}

function docsTotalCount(shipmentId) {
  return getShipmentDocs(shipmentId).length
}

function allDocsReceived(shipmentId) {
  const docs = getShipmentDocs(shipmentId)
  return docs.length > 0 && docs.every(d => d.status === 'RECEIVED')
}

async function loadAllProgress() {
  const map = {}
  for (const s of shipments.value) {
    try {
      const res = await shipmentsApi.getProgress(s.id)
      map[s.id] = res.data
    } catch {
      map[s.id] = { percent: 0, days_remaining: null }
    }
  }
  progressMap.value = map
}

function getProgress(shipmentId) {
  return progressMap.value[shipmentId] || { percent: 0, days_remaining: null }
}

function getPhaseStatus(shipment, phase) {
  // Determine if a phase is completed, current, or future
  const phases = ['loaded', 'sailed', 'arrived']
  const phaseIndex = phases.indexOf(phase)

  // Check what data exists to determine phase completion
  if (phase === 'loaded') {
    if (shipment.loading_date || shipment.phase === 'SAILED' || shipment.phase === 'ARRIVED') return 'completed'
    if (shipment.phase === 'LOADED' || (!shipment.phase && phaseIndex === 0)) return 'current'
    return 'future'
  }
  if (phase === 'sailed') {
    if (shipment.actual_departure_date || shipment.phase === 'ARRIVED') return 'completed'
    if (shipment.phase === 'SAILED' || shipment.loading_date) return 'current'
    return 'future'
  }
  if (phase === 'arrived') {
    if (shipment.actual_arrival_date) return 'completed'
    if (shipment.phase === 'ARRIVED' || shipment.actual_departure_date) return 'current'
    return 'future'
  }
  return 'future'
}

function showPhaseForm(shipmentId, phaseType) {
  activePhaseShipmentId.value = shipmentId
  activePhaseType.value = phaseType
  // Reset forms
  if (phaseType === 'loaded') {
    loadedForm.value = { loading_date: '', loading_notes: '' }
  } else if (phaseType === 'sailed') {
    sailedForm.value = {
      container_number: '', seal_number: '', vessel_name: '',
      voyage_number: '', bl_number: '', actual_departure_date: '', revised_eta: '',
    }
  } else if (phaseType === 'arrived') {
    arrivedForm.value = { actual_arrival_date: '', cfs_receipt_number: '', arrival_notes: '' }
  }
}

function cancelPhaseForm() {
  activePhaseShipmentId.value = null
  activePhaseType.value = null
}

async function markLoaded(shipmentId) {
  saving.value = true
  error.value = ''
  try {
    await shipmentsApi.markLoaded(shipmentId, loadedForm.value)
    cancelPhaseForm()
    await loadShipments()
    emit('reload')
  } catch (err) {
    console.error('Failed to mark loaded:', err)
    error.value = err.response?.data?.detail || 'Failed to mark as loaded'
  } finally {
    saving.value = false
  }
}

async function markSailed(shipmentId) {
  saving.value = true
  error.value = ''
  try {
    await shipmentsApi.markSailed(shipmentId, sailedForm.value)
    cancelPhaseForm()
    await loadShipments()
    emit('reload')
  } catch (err) {
    console.error('Failed to mark sailed:', err)
    error.value = err.response?.data?.detail || 'Failed to mark as sailed'
  } finally {
    saving.value = false
  }
}

async function markArrived(shipmentId) {
  saving.value = true
  error.value = ''
  try {
    await shipmentsApi.markArrived(shipmentId, arrivedForm.value)
    cancelPhaseForm()
    await loadShipments()
    emit('reload')
  } catch (err) {
    console.error('Failed to mark arrived:', err)
    error.value = err.response?.data?.detail || 'Failed to mark as arrived'
  } finally {
    saving.value = false
  }
}


// ========================================
// Lifecycle
// ========================================
onMounted(async () => {
  await loadShipments()
  // Auto-refresh progress every 60 seconds
  refreshInterval.value = setInterval(() => {
    if (shipments.value.length > 0) {
      loadAllProgress()
    }
  }, 60000)
})

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})
</script>

<template>
  <div v-if="isSailingStage">
    <div class="bg-white rounded-xl shadow-sm overflow-hidden border-2 border-blue-200 mb-6">
      <div class="px-6 py-4 border-b border-blue-200 bg-blue-50">
        <div>
          <h3 class="text-sm font-semibold text-blue-800 uppercase tracking-wider flex items-center gap-2">
            <i class="pi pi-compass text-blue-600" /> Sailing Progress
          </h3>
          <p class="text-xs text-blue-600 mt-0.5">Track container sailing phases from loading to arrival</p>
        </div>
      </div>

      <div class="p-6">
        <!-- Loading -->
        <div v-if="loading" class="flex items-center justify-center py-12">
          <i class="pi pi-spin pi-spinner text-2xl text-blue-500" />
        </div>

        <!-- Error -->
        <div v-if="error" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <i class="pi pi-exclamation-circle" />
          <span>{{ error }}</span>
          <button @click="error = ''" class="ml-auto text-red-400 hover:text-red-600"><i class="pi pi-times text-xs" /></button>
        </div>

        <!-- Per-container sailing sections -->
        <div v-if="!loading && shipments.length" class="space-y-8">
          <div v-for="shipment in shipments" :key="shipment.id" class="border border-slate-200 rounded-xl p-5">
            <!-- Container header -->
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3">
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                  {{ shipment.container_type || '40HC' }}
                </span>
                <span class="text-sm font-medium text-slate-800">
                  {{ shipment.port_of_loading || 'TBD' }} <i class="pi pi-arrow-right text-[10px] text-slate-400 mx-1" /> {{ shipment.port_of_discharge || 'TBD' }}
                </span>
                <span v-if="shipment.container_number" class="text-xs font-mono text-slate-500">
                  #{{ shipment.container_number }}
                </span>
              </div>
              <span v-if="shipment.vessel_name" class="text-xs text-slate-500">
                <i class="pi pi-globe text-[10px] mr-1" /> {{ shipment.vessel_name }}
                <span v-if="shipment.voyage_number"> / {{ shipment.voyage_number }}</span>
              </span>
            </div>

            <!-- Progress bar -->
            <div class="relative mb-6">
              <div class="h-3 bg-slate-200 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500"
                  :class="getProgress(shipment.id).percent >= 100 ? 'bg-emerald-500' : 'bg-blue-500'"
                  :style="{ width: Math.min(getProgress(shipment.id).percent || 0, 100) + '%' }">
                </div>
              </div>
              <div class="flex justify-between mt-1 text-xs text-slate-500">
                <span>ETD: {{ formatDate(shipment.etd) }}</span>
                <span class="font-medium" :class="getProgress(shipment.id).percent >= 100 ? 'text-emerald-600' : 'text-blue-600'">
                  {{ getProgress(shipment.id).percent || 0 }}%
                  <template v-if="getProgress(shipment.id).days_remaining !== null && getProgress(shipment.id).days_remaining !== undefined">
                    &middot; {{ getProgress(shipment.id).days_remaining }} days remaining
                  </template>
                </span>
                <span>ETA: {{ formatDate(shipment.revised_eta || shipment.eta) }}</span>
              </div>
            </div>

            <!-- Phase timeline (3 cards horizontal) -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <!-- LOADED Phase -->
              <div :class="[
                'rounded-lg border p-4 transition-all',
                getPhaseStatus(shipment, 'loaded') === 'completed' ? 'border-emerald-200 bg-emerald-50/50' :
                getPhaseStatus(shipment, 'loaded') === 'current' ? 'border-blue-300 bg-blue-50/50' :
                'border-slate-200 bg-slate-50/30'
              ]">
                <div class="flex items-center gap-2 mb-3">
                  <div :class="[
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                    getPhaseStatus(shipment, 'loaded') === 'completed' ? 'bg-emerald-500 text-white' :
                    getPhaseStatus(shipment, 'loaded') === 'current' ? 'bg-blue-500 text-white animate-pulse' :
                    'bg-slate-200 text-slate-400'
                  ]">
                    <i v-if="getPhaseStatus(shipment, 'loaded') === 'completed'" class="pi pi-check text-[10px]" />
                    <span v-else>1</span>
                  </div>
                  <h5 class="text-sm font-semibold text-slate-700">Loaded</h5>
                </div>

                <!-- Completed data -->
                <div v-if="getPhaseStatus(shipment, 'loaded') === 'completed'" class="text-xs text-slate-600 space-y-1">
                  <div v-if="shipment.loading_date"><span class="text-slate-500">Date:</span> {{ shipment.loading_date }}</div>
                  <div v-if="shipment.loading_notes"><span class="text-slate-500">Notes:</span> {{ shipment.loading_notes }}</div>
                </div>

                <!-- Current phase form trigger -->
                <div v-else-if="getPhaseStatus(shipment, 'loaded') === 'current'">
                  <div v-if="activePhaseShipmentId === shipment.id && activePhaseType === 'loaded'" class="space-y-3">
                    <div>
                      <label class="block text-xs font-medium text-slate-600 mb-1">Loading Date</label>
                      <input v-model="loadedForm.loading_date" type="date"
                        class="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-slate-600 mb-1">Notes</label>
                      <textarea v-model="loadedForm.loading_notes" rows="2"
                        class="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none" />
                    </div>
                    <div class="flex gap-2">
                      <button @click="markLoaded(shipment.id)" :disabled="saving"
                        class="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        {{ saving ? 'Saving...' : 'Confirm' }}
                      </button>
                      <button @click="cancelPhaseForm" class="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                    </div>
                  </div>
                  <button v-else @click="showPhaseForm(shipment.id, 'loaded')"
                    class="mt-2 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors w-full">
                    <i class="pi pi-check-circle text-[10px] mr-1" /> Mark as Loaded
                  </button>
                </div>

                <div v-else class="text-xs text-slate-400 italic">Pending</div>
              </div>

              <!-- SAILED Phase -->
              <div :class="[
                'rounded-lg border p-4 transition-all',
                getPhaseStatus(shipment, 'sailed') === 'completed' ? 'border-emerald-200 bg-emerald-50/50' :
                getPhaseStatus(shipment, 'sailed') === 'current' ? 'border-blue-300 bg-blue-50/50' :
                'border-slate-200 bg-slate-50/30'
              ]">
                <div class="flex items-center gap-2 mb-3">
                  <div :class="[
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                    getPhaseStatus(shipment, 'sailed') === 'completed' ? 'bg-emerald-500 text-white' :
                    getPhaseStatus(shipment, 'sailed') === 'current' ? 'bg-blue-500 text-white animate-pulse' :
                    'bg-slate-200 text-slate-400'
                  ]">
                    <i v-if="getPhaseStatus(shipment, 'sailed') === 'completed'" class="pi pi-check text-[10px]" />
                    <span v-else>2</span>
                  </div>
                  <h5 class="text-sm font-semibold text-slate-700">Sailed</h5>
                </div>

                <!-- Completed data -->
                <div v-if="getPhaseStatus(shipment, 'sailed') === 'completed'" class="text-xs text-slate-600 space-y-1">
                  <div v-if="shipment.container_number"><span class="text-slate-500">Container:</span> {{ shipment.container_number }}</div>
                  <div v-if="shipment.seal_number"><span class="text-slate-500">Seal:</span> {{ shipment.seal_number }}</div>
                  <div v-if="shipment.vessel_name"><span class="text-slate-500">Vessel:</span> {{ shipment.vessel_name }}</div>
                  <div v-if="shipment.voyage_number"><span class="text-slate-500">Voyage:</span> {{ shipment.voyage_number }}</div>
                  <div v-if="shipment.bl_number"><span class="text-slate-500">B/L:</span> {{ shipment.bl_number }}</div>
                  <div v-if="shipment.actual_departure_date"><span class="text-slate-500">Departed:</span> {{ shipment.actual_departure_date }}</div>
                </div>

                <!-- Current phase form -->
                <div v-else-if="getPhaseStatus(shipment, 'sailed') === 'current'">
                  <div v-if="activePhaseShipmentId === shipment.id && activePhaseType === 'sailed'" class="space-y-3">
                    <div class="grid grid-cols-2 gap-2">
                      <div>
                        <label class="block text-xs font-medium text-slate-600 mb-1">Container #</label>
                        <input v-model="sailedForm.container_number" type="text"
                          class="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label class="block text-xs font-medium text-slate-600 mb-1">Seal #</label>
                        <input v-model="sailedForm.seal_number" type="text"
                          class="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <div>
                        <label class="block text-xs font-medium text-slate-600 mb-1">Vessel Name</label>
                        <input v-model="sailedForm.vessel_name" type="text"
                          class="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label class="block text-xs font-medium text-slate-600 mb-1">Voyage #</label>
                        <input v-model="sailedForm.voyage_number" type="text"
                          class="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-slate-600 mb-1">B/L Number</label>
                      <input v-model="sailedForm.bl_number" type="text"
                        class="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                      <div>
                        <label class="block text-xs font-medium text-slate-600 mb-1">Departure Date</label>
                        <input v-model="sailedForm.actual_departure_date" type="date"
                          class="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label class="block text-xs font-medium text-slate-600 mb-1">Revised ETA</label>
                        <input v-model="sailedForm.revised_eta" type="date"
                          class="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div class="flex gap-2">
                      <button @click="markSailed(shipment.id)" :disabled="saving"
                        class="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        {{ saving ? 'Saving...' : 'Confirm Sailed' }}
                      </button>
                      <button @click="cancelPhaseForm" class="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                    </div>
                  </div>
                  <button v-else @click="showPhaseForm(shipment.id, 'sailed')"
                    class="mt-2 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors w-full">
                    <i class="pi pi-send text-[10px] mr-1" /> Mark as Sailed
                  </button>
                </div>

                <div v-else class="text-xs text-slate-400 italic">Pending</div>
              </div>

              <!-- ARRIVED Phase -->
              <div :class="[
                'rounded-lg border p-4 transition-all',
                getPhaseStatus(shipment, 'arrived') === 'completed' ? 'border-emerald-200 bg-emerald-50/50' :
                getPhaseStatus(shipment, 'arrived') === 'current' ? 'border-blue-300 bg-blue-50/50' :
                'border-slate-200 bg-slate-50/30'
              ]">
                <div class="flex items-center gap-2 mb-3">
                  <div :class="[
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                    getPhaseStatus(shipment, 'arrived') === 'completed' ? 'bg-emerald-500 text-white' :
                    getPhaseStatus(shipment, 'arrived') === 'current' ? 'bg-blue-500 text-white animate-pulse' :
                    'bg-slate-200 text-slate-400'
                  ]">
                    <i v-if="getPhaseStatus(shipment, 'arrived') === 'completed'" class="pi pi-check text-[10px]" />
                    <span v-else>3</span>
                  </div>
                  <h5 class="text-sm font-semibold text-slate-700">Arrived</h5>
                </div>

                <!-- Completed data -->
                <div v-if="getPhaseStatus(shipment, 'arrived') === 'completed'" class="text-xs text-slate-600 space-y-1">
                  <div v-if="shipment.actual_arrival_date"><span class="text-slate-500">Arrived:</span> {{ shipment.actual_arrival_date }}</div>
                  <div v-if="shipment.cfs_receipt_number"><span class="text-slate-500">CFS Receipt:</span> {{ shipment.cfs_receipt_number }}</div>
                  <div v-if="shipment.arrival_notes"><span class="text-slate-500">Notes:</span> {{ shipment.arrival_notes }}</div>
                </div>

                <!-- Current phase form -->
                <div v-else-if="getPhaseStatus(shipment, 'arrived') === 'current'">
                  <div v-if="activePhaseShipmentId === shipment.id && activePhaseType === 'arrived'" class="space-y-3">
                    <div>
                      <label class="block text-xs font-medium text-slate-600 mb-1">Arrival Date</label>
                      <input v-model="arrivedForm.actual_arrival_date" type="date"
                        class="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-slate-600 mb-1">CFS Receipt #</label>
                      <input v-model="arrivedForm.cfs_receipt_number" type="text"
                        class="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-slate-600 mb-1">Arrival Notes</label>
                      <textarea v-model="arrivedForm.arrival_notes" rows="2"
                        class="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none" />
                    </div>
                    <div class="flex gap-2">
                      <button @click="markArrived(shipment.id)" :disabled="saving"
                        class="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        {{ saving ? 'Saving...' : 'Confirm Arrived' }}
                      </button>
                      <button @click="cancelPhaseForm" class="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700">Cancel</button>
                    </div>
                  </div>
                  <!-- Show button only when all shipping docs are received -->
                  <button v-else-if="allDocsReceived(shipment.id)" @click="showPhaseForm(shipment.id, 'arrived')"
                    class="mt-2 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors w-full">
                    <i class="pi pi-map-marker text-[10px] mr-1" /> Mark as Arrived
                  </button>
                  <!-- Docs pending message -->
                  <div v-else class="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-center">
                    <div class="text-xs text-amber-700 font-medium">
                      <i class="pi pi-file-edit text-[10px] mr-1" />
                      {{ docsReceivedCount(shipment.id) }} / {{ docsTotalCount(shipment.id) }} docs received
                    </div>
                    <p class="text-[10px] text-amber-600 mt-1">Upload all shipping documents first</p>
                  </div>
                </div>

                <div v-else class="text-xs text-slate-400 italic">Pending</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="!loading && !shipments.length" class="text-center py-12 text-slate-500">
          <i class="pi pi-compass text-4xl mb-3 text-slate-300" />
          <p class="text-sm">No shipments found</p>
          <p class="text-xs text-slate-400 mt-1">Book containers first in the Booking tab</p>
        </div>
      </div>
    </div>
  </div>
</template>
