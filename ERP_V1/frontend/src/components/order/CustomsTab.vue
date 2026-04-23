<script setup>
import { ref, computed, onMounted } from 'vue'
import { shipmentsApi, customsApi } from '../../api'

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
const boeMap = ref({})       // shipmentId → BOE data or null
const hsnItemsMap = ref({})  // shipmentId → { freight_cost_inr, groups }
const tariffs = ref([])
const error = ref('')

// Active form
const activeShipmentId = ref(null)
const boeForm = ref(null)
const lineItems = ref([])
const showHsnPicker = ref(false)

// Manual HSN entry dialog
const showManualHsn = ref(false)
const manualHsnCode = ref('')
const manualHsnGroup = ref(null)  // the "UNKNOWN" group being assigned

// Bulk select + bulk rate change
const selectedItems = ref(new Set())
const bulkBcd = ref('')
const bulkIgst = ref('')
const allSelected = computed({
  get: () => {
    const physIdx = lineItems.value.reduce((a, li, i) => { if (!li.is_compensation) a.push(i); return a }, [])
    return physIdx.length > 0 && physIdx.every(i => selectedItems.value.has(i))
  },
  set: (v) => {
    const physIdx = lineItems.value.reduce((a, li, i) => { if (!li.is_compensation) a.push(i); return a }, [])
    selectedItems.value = v ? new Set(physIdx) : new Set()
  }
})

// ========================================
// Computed
// ========================================
const isCustomsStage = computed(() => {
  const s = ['ARRIVED', 'CUSTOMS_FILED', 'CLEARED', 'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING']
  return s.includes(props.order?.status)
})

// Currency from order (e.g. "CNY", "USD")
const orderCurrency = computed(() => props.order?.currency || 'CNY')

// Live full BOE calculation: FOB → CIF → AV → proportional per-part duty
const calc = computed(() => {
  if (!boeForm.value) return null
  const exRate = Number(boeForm.value.exchange_rate) || 0

  // 1. FOB = Σ (unit_price × exchange_rate × qty)
  let totalFob = 0
  const partFobs = lineItems.value.map(item => {
    const up = Number(item.unit_price) || 0
    const qty = Number(item.quantity) || 0
    const pf = r2(up * exRate * qty)
    totalFob += pf
    return pf
  })
  totalFob = r2(totalFob)

  // 2. Freight & Insurance
  const freight = r2(Number(boeForm.value.freight_inr) || 0)
  const insurance = boeForm.value.insurance_inr !== null && boeForm.value.insurance_inr !== ''
    ? r2(Number(boeForm.value.insurance_inr))
    : r2(totalFob * 0.01125)  // default 1.125% of FOB

  // 3. CIF, Landing, AV
  const cif = r2(totalFob + freight + insurance)
  const landing = r2(cif * 0.01)
  const av = r2(cif + landing)

  // 4. Per-part: proportional AV share → BCD → SWC → IGST
  let totalBcd = 0, totalSwc = 0, totalIgst = 0, totalDuty = 0
  const calcItems = lineItems.value.map((item, idx) => {
    const bcdRate = Number(item.bcd_rate) || 0
    const swcRate = Number(item.swc_rate) || 10
    const igstRate = Number(item.igst_rate) || 18

    const partFob = partFobs[idx]
    const partAv = totalFob > 0 ? r2((partFob / totalFob) * av) : 0

    const bcd = r2(partAv * (bcdRate / 100))
    const swc = r2(bcd * (swcRate / 100))
    const igst = r2((partAv + bcd + swc) * (igstRate / 100))
    const duty = r2(bcd + swc + igst)

    totalBcd += bcd; totalSwc += swc; totalIgst += igst; totalDuty += duty
    return { ...item, assessable_value_inr: partAv, bcd_amount: bcd, swc_amount: swc, igst_amount: igst, total_duty: duty }
  })

  return {
    fob_inr: totalFob, freight_inr: freight, insurance_inr: insurance,
    cif_inr: cif, landing_charges_inr: landing, assessment_value_inr: av,
    total_bcd: r2(totalBcd), total_swc: r2(totalSwc), total_igst: r2(totalIgst),
    total_duty: Math.round(totalDuty), line_items: calcItems,
  }
})

// Insurance display: shows default hint when user hasn't overridden
const insuranceIsDefault = computed(() => {
  return boeForm.value && (boeForm.value.insurance_inr === null || boeForm.value.insurance_inr === '')
})

// How many shipment items exist vs included (exclude compensation items from validation)
const totalShipmentItems = computed(() => {
  if (!activeShipmentId.value) return 0
  const data = hsnItemsMap.value[activeShipmentId.value]
  const groups = data?.groups || data || []
  return groups.reduce((s, g) => s + g.items.filter(i => !i.is_compensation).length, 0)
})
const includedCount = computed(() => {
  return new Set(lineItems.value.filter(li => li.shipment_item_id && !li.is_compensation).map(li => li.shipment_item_id)).size
})
const allItemsIncluded = computed(() => includedCount.value >= totalShipmentItems.value && totalShipmentItems.value > 0)

// Physical vs compensation split for display — compensation items (balance adjustments) shown separately
const physicalLineItems = computed(() =>
  lineItems.value.map((li, idx) => ({ ...li, _idx: idx })).filter(li => !li.is_compensation)
)
const compensationLineItems = computed(() =>
  lineItems.value.map((li, idx) => ({ ...li, _idx: idx })).filter(li => li.is_compensation)
)

function r2(v) { return Math.round(v * 100) / 100 }
function fmt(v) { return v != null ? Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—' }

// ========================================
// Data Loading
// ========================================
async function loadAll() {
  loading.value = true
  error.value = ''
  try {
    const [shipRes, tariffRes] = await Promise.all([
      shipmentsApi.list(props.orderId),
      customsApi.listTariffs(),
    ])
    shipments.value = shipRes.data || []
    tariffs.value = tariffRes.data || []

    await Promise.all(shipments.value.map(async (s) => {
      const [boeRes, hsnRes] = await Promise.all([
        customsApi.getBoe(s.id).catch(() => ({ data: null })),
        customsApi.getHsnItems(s.id).catch(() => ({ data: { freight_cost_inr: 0, groups: [] } })),
      ])
      boeMap.value[s.id] = boeRes.data
      hsnItemsMap.value[s.id] = hsnRes.data || { freight_cost_inr: 0, groups: [] }
    }))
  } catch (err) {
    console.error('Failed to load customs data:', err)
    error.value = err.response?.data?.detail || 'Failed to load customs data'
  } finally {
    loading.value = false
  }
}

// Get HSN groups for a shipment
function getHsnGroups(shipmentId) {
  const data = hsnItemsMap.value[shipmentId]
  return data?.groups || data || []
}

// Get freight from shipment's HSN items response
function getShipmentFreight(shipmentId) {
  const data = hsnItemsMap.value[shipmentId]
  return data?.freight_cost_inr || 0
}

// ========================================
// BOE Form Management
// ========================================
function startBoe(shipment) {
  activeShipmentId.value = shipment.id
  const existing = boeMap.value[shipment.id]
  if (existing) {
    boeForm.value = {
      be_number: existing.be_number || '',
      be_date: existing.be_date || '',
      port_of_import: existing.port_of_import || '',
      cha_id: existing.cha_id || '',
      exchange_rate: existing.exchange_rate || '',
      freight_inr: existing.freight_inr || 0,
      insurance_inr: existing.insurance_inr || null,
      status: existing.status || 'DRAFT',
      notes: existing.notes || '',
    }
    lineItems.value = (existing.line_items || []).map(li => ({ ...li }))
  } else {
    boeForm.value = {
      be_number: '',
      be_date: '',
      port_of_import: shipment.port_of_discharge || '',
      cha_id: shipment.cha_id || '',
      exchange_rate: props.order?.exchange_rate || '',
      freight_inr: getShipmentFreight(shipment.id),
      insurance_inr: null,  // null = use default 1.125%
      status: 'DRAFT',
      notes: '',
    }
    lineItems.value = []
  }
}

function cancelBoe() {
  activeShipmentId.value = null
  boeForm.value = null
  lineItems.value = []
  showHsnPicker.value = false
  showManualHsn.value = false
  selectedItems.value = new Set()
  bulkBcd.value = ''
  bulkIgst.value = ''
}

// ========================================
// HSN Item Selection — adds individual parts
// ========================================
function addHsnGroup(hsnGroup) {
  // If it's UNKNOWN, prompt for manual HSN code
  if (hsnGroup.hsn_code === 'UNKNOWN') {
    manualHsnGroup.value = hsnGroup
    manualHsnCode.value = ''
    showManualHsn.value = true
    return
  }

  const tariff = hsnGroup.tariff || {}
  for (const part of hsnGroup.items) {
    if (lineItems.value.some(li => li.shipment_item_id === part.shipment_item_id)) continue
    lineItems.value.push({
      shipment_item_id: part.shipment_item_id,
      product_name: part.product_name || '',
      product_code: part.product_code || '',
      hsn_code: hsnGroup.hsn_code,
      description: '',
      quantity: part.quantity,
      unit_price: part.unit_price_cny || 0,
      bcd_rate: tariff.bcd_rate || 0,
      igst_rate: tariff.igst_rate || 18,
      swc_rate: tariff.swc_rate || 10,
      is_compensation: part.is_compensation || false,
    })
  }
  showHsnPicker.value = false
}

function confirmManualHsn() {
  if (!manualHsnCode.value.trim() || !manualHsnGroup.value) return
  const hsnCode = manualHsnCode.value.trim()

  // Look up tariff for the manually entered HSN
  const tariff = tariffs.value.find(t => t.hsn_code === hsnCode) || {}

  for (const part of manualHsnGroup.value.items) {
    if (lineItems.value.some(li => li.shipment_item_id === part.shipment_item_id)) continue
    lineItems.value.push({
      shipment_item_id: part.shipment_item_id,
      product_name: part.product_name || '',
      product_code: part.product_code || '',
      hsn_code: hsnCode,
      description: '',
      quantity: part.quantity,
      unit_price: part.unit_price_cny || 0,
      bcd_rate: tariff.bcd_rate || 0,
      igst_rate: tariff.igst_rate || 18,
      swc_rate: tariff.swc_rate || 10,
      is_compensation: part.is_compensation || false,
    })
  }
  showManualHsn.value = false
  showHsnPicker.value = false
  manualHsnGroup.value = null
  manualHsnCode.value = ''
}

function addAllHsn(shipmentId) {
  const groups = getHsnGroups(shipmentId)
  // Check if any UNKNOWN groups exist — those need manual entry
  const unknownGroups = groups.filter(g => g.hsn_code === 'UNKNOWN')
  if (unknownGroups.length > 0) {
    // Add known groups first, then prompt for unknown
    for (const g of groups) {
      if (g.hsn_code !== 'UNKNOWN') addHsnGroup(g)
    }
    // Prompt for the first unknown group
    manualHsnGroup.value = unknownGroups[0]
    manualHsnCode.value = ''
    showManualHsn.value = true
    return
  }
  for (const g of groups) addHsnGroup(g)
  showHsnPicker.value = false
}

function removeLineItem(idx) {
  lineItems.value.splice(idx, 1)
  // Rebuild selection (indices shift after splice)
  const updated = new Set()
  for (const i of selectedItems.value) {
    if (i < idx) updated.add(i)
    else if (i > idx) updated.add(i - 1)
  }
  selectedItems.value = updated
}

function toggleItem(idx) {
  const s = new Set(selectedItems.value)
  s.has(idx) ? s.delete(idx) : s.add(idx)
  selectedItems.value = s
}

function applyBulkRates() {
  for (const idx of selectedItems.value) {
    if (bulkBcd.value !== '') lineItems.value[idx].bcd_rate = Number(bulkBcd.value)
    if (bulkIgst.value !== '') lineItems.value[idx].igst_rate = Number(bulkIgst.value)
  }
  selectedItems.value = new Set()
  bulkBcd.value = ''
  bulkIgst.value = ''
}

// Check if an HSN group is fully added
function isGroupAdded(group) {
  return group.items.every(p => lineItems.value.some(li => li.shipment_item_id === p.shipment_item_id))
}

// ========================================
// Save with validation
// ========================================
async function saveBoe() {
  if (!boeForm.value || !activeShipmentId.value) return

  // Validate exchange rate
  if (!Number(boeForm.value.exchange_rate)) {
    error.value = 'Please enter the Exchange Rate before saving.'
    return
  }

  // Validate all items included
  if (!allItemsIncluded.value) {
    error.value = `All packing list items must be calculated. ${includedCount.value} of ${totalShipmentItems.value} items added. Add remaining items.`
    return
  }

  saving.value = true
  error.value = ''
  try {
    const payload = {
      be_number: boeForm.value.be_number || null,
      be_date: boeForm.value.be_date || null,
      port_of_import: boeForm.value.port_of_import || null,
      cha_id: boeForm.value.cha_id || null,
      exchange_rate: Number(boeForm.value.exchange_rate) || 0,
      freight_inr: Number(boeForm.value.freight_inr) || 0,
      insurance_inr: boeForm.value.insurance_inr !== null && boeForm.value.insurance_inr !== ''
        ? Number(boeForm.value.insurance_inr)
        : null,  // null = let backend use default 1.125%
      status: boeForm.value.status || 'DRAFT',
      notes: boeForm.value.notes || null,
      line_items: lineItems.value.filter(li => !li.is_compensation).map(li => ({
        shipment_item_id: li.shipment_item_id || null,
        product_name: li.product_name || '',
        product_code: li.product_code || '',
        hsn_code: li.hsn_code,
        description: li.description || '',
        quantity: Number(li.quantity) || 0,
        unit_price: Number(li.unit_price) || 0,
        assessable_value_inr: Number(li.assessable_value_inr) || 0,
        bcd_rate: Number(li.bcd_rate) || 0,
        igst_rate: Number(li.igst_rate) || 18,
        swc_rate: Number(li.swc_rate) || 10,
      })),
    }

    const existing = boeMap.value[activeShipmentId.value]
    if (existing) {
      await customsApi.updateBoe(existing.id, payload)
    } else {
      await customsApi.createBoe(activeShipmentId.value, payload)
    }
    cancelBoe()
    await loadAll()
    emit('reload')
  } catch (err) {
    console.error('Failed to save BOE:', err)
    error.value = err.response?.data?.detail || 'Failed to save BOE'
  } finally {
    saving.value = false
  }
}

// Get compensation items for a shipment (for read-only display)
function getCompensationItems(shipmentId) {
  const data = hsnItemsMap.value[shipmentId]
  const groups = data?.groups || data || []
  return groups.flatMap(g => g.items.filter(i => i.is_compensation))
}

function statusColor(status) {
  const map = {
    DRAFT: 'bg-slate-100 text-slate-600',
    FILED: 'bg-blue-100 text-blue-700',
    ASSESSED: 'bg-amber-100 text-amber-700',
    DUTY_PAID: 'bg-emerald-100 text-emerald-700',
    OOC: 'bg-green-100 text-green-800',
  }
  return map[status] || 'bg-slate-100 text-slate-600'
}

onMounted(() => loadAll())
</script>

<template>
  <div v-if="isCustomsStage">
    <div class="bg-white rounded-xl shadow-sm overflow-hidden border-2 border-indigo-200 mb-6">
      <div class="px-6 py-4 border-b border-indigo-200 bg-indigo-50">
        <h3 class="text-sm font-semibold text-indigo-800 uppercase tracking-wider flex items-center gap-2">
          <i class="pi pi-file-check text-indigo-600" /> Customs / Bill of Entry
        </h3>
        <p class="text-xs text-indigo-600 mt-0.5">Per-shipment customs duty — FOB → CIF → AV → per-part BCD + SWC + IGST</p>
      </div>

      <div class="p-6">
        <!-- Loading -->
        <div v-if="loading" class="flex items-center justify-center py-12">
          <i class="pi pi-spin pi-spinner text-2xl text-indigo-500" />
        </div>

        <!-- Error -->
        <div v-if="error" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <i class="pi pi-exclamation-circle" />
          <span>{{ error }}</span>
          <button @click="error = ''" class="ml-auto text-red-400 hover:text-red-600"><i class="pi pi-times text-xs" /></button>
        </div>

        <!-- Per-shipment cards -->
        <div v-if="!loading && shipments.length" class="space-y-6">
          <div v-for="shipment in shipments" :key="shipment.id" class="border border-slate-200 rounded-xl overflow-hidden">
            <!-- Shipment header -->
            <div class="px-5 py-3 bg-slate-50 flex items-center justify-between border-b border-slate-200">
              <div class="flex items-center gap-3">
                <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                  {{ shipment.container_type || '40HC' }}
                </span>
                <span class="text-sm font-medium text-slate-800">
                  {{ shipment.port_of_loading || 'TBD' }}
                  <i class="pi pi-arrow-right text-[10px] text-slate-400 mx-1" />
                  {{ shipment.port_of_discharge || 'TBD' }}
                </span>
                <span v-if="shipment.container_number" class="text-xs font-mono text-slate-500">
                  #{{ shipment.container_number }}
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span v-if="boeMap[shipment.id]" :class="['px-2 py-0.5 rounded-full text-[10px] font-semibold', statusColor(boeMap[shipment.id].status)]">
                  {{ boeMap[shipment.id].status }}
                </span>
                <button v-if="activeShipmentId !== shipment.id"
                  @click="startBoe(shipment)"
                  class="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-100 rounded-lg hover:bg-indigo-200 transition-colors">
                  <i class="pi pi-pencil text-[10px] mr-1" />
                  {{ boeMap[shipment.id] ? 'Edit BOE' : 'Create BOE' }}
                </button>
              </div>
            </div>

            <!-- BOE summary (read-only when not editing) -->
            <div v-if="boeMap[shipment.id] && activeShipmentId !== shipment.id" class="p-5">
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <div class="text-[10px] text-slate-500 uppercase tracking-wider">BE Number</div>
                  <div class="text-sm font-medium">{{ boeMap[shipment.id].be_number || '—' }}</div>
                </div>
                <div>
                  <div class="text-[10px] text-slate-500 uppercase tracking-wider">BE Date</div>
                  <div class="text-sm font-medium">{{ boeMap[shipment.id].be_date || '—' }}</div>
                </div>
                <div>
                  <div class="text-[10px] text-slate-500 uppercase tracking-wider">Exchange Rate ({{ orderCurrency }}→INR)</div>
                  <div class="text-sm font-medium">{{ boeMap[shipment.id].exchange_rate || '—' }}</div>
                </div>
                <div>
                  <div class="text-[10px] text-slate-500 uppercase tracking-wider">Parts</div>
                  <div class="text-sm font-medium">{{ boeMap[shipment.id].line_items?.length || 0 }} items
                    <span v-if="getCompensationItems(shipment.id).length" class="text-purple-500 text-[10px] font-normal">+ {{ getCompensationItems(shipment.id).length }} balance</span>
                  </div>
                </div>
              </div>

              <!-- Value breakdown -->
              <div class="grid grid-cols-3 md:grid-cols-6 gap-3 p-3 bg-slate-50 rounded-lg mb-3">
                <div class="text-center">
                  <div class="text-[10px] text-slate-500">FOB</div>
                  <div class="text-xs font-semibold">₹{{ fmt(boeMap[shipment.id].fob_inr) }}</div>
                </div>
                <div class="text-center">
                  <div class="text-[10px] text-slate-500">Freight</div>
                  <div class="text-xs font-semibold">₹{{ fmt(boeMap[shipment.id].freight_inr) }}</div>
                </div>
                <div class="text-center">
                  <div class="text-[10px] text-slate-500">Insurance</div>
                  <div class="text-xs font-semibold">₹{{ fmt(boeMap[shipment.id].insurance_inr) }}</div>
                </div>
                <div class="text-center">
                  <div class="text-[10px] text-slate-500">CIF</div>
                  <div class="text-xs font-semibold">₹{{ fmt(boeMap[shipment.id].cif_inr) }}</div>
                </div>
                <div class="text-center">
                  <div class="text-[10px] text-slate-500">Landing (1%)</div>
                  <div class="text-xs font-semibold">₹{{ fmt(boeMap[shipment.id].landing_charges_inr) }}</div>
                </div>
                <div class="text-center">
                  <div class="text-[10px] text-slate-500 font-bold">AV</div>
                  <div class="text-xs font-bold text-indigo-700">₹{{ fmt(boeMap[shipment.id].assessment_value_inr) }}</div>
                </div>
              </div>

              <!-- Duty summary -->
              <div class="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 bg-indigo-50 rounded-lg">
                <div class="text-center">
                  <div class="text-[10px] text-slate-500">Total AV</div>
                  <div class="text-xs font-semibold">₹{{ fmt(boeMap[shipment.id].assessment_value_inr) }}</div>
                </div>
                <div class="text-center">
                  <div class="text-[10px] text-slate-500">BCD</div>
                  <div class="text-xs font-semibold text-amber-700">₹{{ fmt(boeMap[shipment.id].total_bcd) }}</div>
                </div>
                <div class="text-center">
                  <div class="text-[10px] text-slate-500">SWC</div>
                  <div class="text-xs font-semibold text-amber-700">₹{{ fmt(boeMap[shipment.id].total_swc) }}</div>
                </div>
                <div class="text-center">
                  <div class="text-[10px] text-slate-500">IGST</div>
                  <div class="text-xs font-semibold text-blue-700">₹{{ fmt(boeMap[shipment.id].total_igst) }}</div>
                </div>
                <div class="text-center">
                  <div class="text-[10px] text-slate-500 font-bold">TOTAL DUTY</div>
                  <div class="text-sm font-bold text-red-700">₹{{ fmt(boeMap[shipment.id].total_duty) }}</div>
                </div>
              </div>

              <!-- Saved line items table (per-part, physical only) -->
              <div v-if="boeMap[shipment.id].line_items?.length" class="mt-4 overflow-x-auto">
                <table class="w-full text-xs">
                  <thead>
                    <tr class="border-b border-slate-200 text-slate-500">
                      <th class="text-left py-2 font-medium">Part Name</th>
                      <th class="text-left py-2 font-medium">HSN</th>
                      <th class="text-right py-2 font-medium">Qty</th>
                      <th class="text-right py-2 font-medium">Price</th>
                      <th class="text-right py-2 font-medium">AV Share (₹)</th>
                      <th class="text-right py-2 font-medium">BCD</th>
                      <th class="text-right py-2 font-medium">SWC</th>
                      <th class="text-right py-2 font-medium">IGST</th>
                      <th class="text-right py-2 font-medium">Duty</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="li in boeMap[shipment.id].line_items" :key="li.id" class="border-b border-slate-100">
                      <td class="py-2 text-slate-700 truncate max-w-[180px]" :title="li.product_name">{{ li.product_name || '—' }}</td>
                      <td class="py-2 font-mono text-indigo-600">{{ li.hsn_code }}</td>
                      <td class="py-2 text-right">{{ li.quantity }}</td>
                      <td class="py-2 text-right text-slate-500">{{ li.unit_price }}</td>
                      <td class="py-2 text-right">{{ fmt(li.assessable_value_inr) }}</td>
                      <td class="py-2 text-right text-amber-700">{{ fmt(li.bcd_amount) }}</td>
                      <td class="py-2 text-right text-amber-600">{{ fmt(li.swc_amount) }}</td>
                      <td class="py-2 text-right text-blue-700">{{ fmt(li.igst_amount) }}</td>
                      <td class="py-2 text-right font-semibold">₹{{ fmt(li.total_duty) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Compensation / Balance items (read-only reference) -->
              <div v-if="getCompensationItems(shipment.id).length" class="mt-4">
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="text-[10px] font-semibold text-purple-700 uppercase tracking-wider">Balance Compensation</span>
                  <span class="text-[10px] text-purple-500">({{ getCompensationItems(shipment.id).length }} items — ₹0 duty, not included in BOE)</span>
                </div>
                <div class="overflow-x-auto border border-purple-200 rounded-lg bg-purple-50/30">
                  <table class="w-full text-xs">
                    <thead class="bg-purple-50">
                      <tr class="border-b border-purple-200 text-purple-500">
                        <th class="text-left py-1.5 px-2 font-medium">Part Name</th>
                        <th class="text-right py-1.5 px-2 font-medium">Qty</th>
                        <th class="text-left py-1.5 px-2 font-medium">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="item in getCompensationItems(shipment.id)" :key="item.shipment_item_id"
                        class="border-b border-purple-100">
                        <td class="py-1.5 px-2 text-purple-700">{{ item.product_name || '—' }}</td>
                        <td class="py-1.5 px-2 text-right text-purple-600">{{ item.quantity }}</td>
                        <td class="py-1.5 px-2 text-purple-400 italic">Balance adjustment — no duty applicable</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- ============================================
                 BOE EDIT FORM
                 ============================================ -->
            <div v-if="activeShipmentId === shipment.id && boeForm" class="p-5 space-y-5">
              <!-- Section 1: Header + Exchange Rate -->
              <div>
                <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  <i class="pi pi-file text-[10px] mr-1" /> BOE Header
                </h4>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <label class="block text-[10px] font-medium text-slate-600 mb-1">BE Number</label>
                    <input v-model="boeForm.be_number" type="text" placeholder="Auto on filing"
                      class="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label class="block text-[10px] font-medium text-slate-600 mb-1">BE Date</label>
                    <input v-model="boeForm.be_date" type="date"
                      class="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label class="block text-[10px] font-medium text-slate-600 mb-1">Port of Import</label>
                    <input v-model="boeForm.port_of_import" type="text"
                      class="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label class="block text-[10px] font-medium text-slate-600 mb-1">
                      Exchange Rate <span class="text-indigo-500">({{ orderCurrency }}→INR)</span>
                    </label>
                    <input v-model.number="boeForm.exchange_rate" type="number" step="0.01" placeholder="e.g. 11.85"
                      class="w-full px-2 py-1.5 text-xs border border-indigo-400 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-indigo-50 font-semibold" />
                  </div>
                  <div>
                    <label class="block text-[10px] font-medium text-slate-600 mb-1">Status</label>
                    <select v-model="boeForm.status"
                      class="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                      <option value="DRAFT">Draft</option>
                      <option value="FILED">Filed</option>
                      <option value="ASSESSED">Assessed</option>
                      <option value="DUTY_PAID">Duty Paid</option>
                      <option value="OOC">Out of Charge</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Section 2: Costs — FOB / Freight / Insurance → CIF / Landing / AV -->
              <div v-if="lineItems.length">
                <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  <i class="pi pi-calculator text-[10px] mr-1" /> Valuation
                </h4>
                <div class="grid grid-cols-3 md:grid-cols-6 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <!-- FOB (auto) -->
                  <div>
                    <div class="text-[10px] text-slate-500 mb-1">FOB (₹) <span class="text-slate-400">auto</span></div>
                    <div class="px-2 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-800">
                      {{ calc ? fmt(calc.fob_inr) : '—' }}
                    </div>
                  </div>
                  <!-- Freight (editable) -->
                  <div>
                    <div class="text-[10px] text-slate-500 mb-1">Freight (₹)</div>
                    <input v-model.number="boeForm.freight_inr" type="number" step="0.01"
                      class="w-full px-2 py-1.5 text-xs border border-amber-400 rounded-lg focus:ring-2 focus:ring-amber-500 bg-amber-50 font-semibold" />
                  </div>
                  <!-- Insurance (editable, default hint) -->
                  <div>
                    <div class="text-[10px] text-slate-500 mb-1">
                      Insurance (₹) <span v-if="insuranceIsDefault" class="text-slate-400">1.125%</span>
                    </div>
                    <input v-model.number="boeForm.insurance_inr" type="number" step="0.01"
                      :placeholder="calc ? fmt(calc.insurance_inr) : ''"
                      class="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <!-- CIF (auto) -->
                  <div>
                    <div class="text-[10px] text-slate-500 mb-1">CIF (₹) <span class="text-slate-400">auto</span></div>
                    <div class="px-2 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-800">
                      {{ calc ? fmt(calc.cif_inr) : '—' }}
                    </div>
                  </div>
                  <!-- Landing (auto) -->
                  <div>
                    <div class="text-[10px] text-slate-500 mb-1">Landing 1% (₹)</div>
                    <div class="px-2 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-800">
                      {{ calc ? fmt(calc.landing_charges_inr) : '—' }}
                    </div>
                  </div>
                  <!-- AV (auto, prominent) -->
                  <div>
                    <div class="text-[10px] text-indigo-600 font-bold mb-1">Assessment Value (₹)</div>
                    <div class="px-2 py-1.5 text-xs font-bold bg-indigo-100 border border-indigo-300 rounded-lg text-indigo-800">
                      {{ calc ? fmt(calc.assessment_value_inr) : '—' }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Section 3: HSN Item Picker -->
              <div>
                <div class="flex items-center justify-between mb-3">
                  <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <i class="pi pi-list text-[10px] mr-1" /> Parts — Duty Calculation
                  </h4>
                  <div class="flex items-center gap-3">
                    <span class="text-[10px]" :class="allItemsIncluded ? 'text-emerald-600 font-semibold' : 'text-amber-600'">
                      {{ includedCount }} / {{ totalShipmentItems }} items added
                    </span>
                    <button @click="showHsnPicker = !showHsnPicker"
                      class="px-2 py-1 text-[10px] font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700">
                      <i class="pi pi-plus text-[8px] mr-1" /> Add Items
                    </button>
                  </div>
                </div>

                <!-- HSN Picker -->
                <div v-if="showHsnPicker" class="mb-4 p-3 border border-indigo-200 bg-indigo-50/50 rounded-lg">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-semibold text-indigo-700">Select by HSN Code</span>
                    <button @click="addAllHsn(shipment.id)" class="text-[10px] text-indigo-600 hover:underline font-medium">Add All HSN Groups</button>
                  </div>
                  <div class="space-y-2">
                    <div v-for="group in getHsnGroups(shipment.id)" :key="group.hsn_code"
                      :class="[
                        'flex items-center justify-between p-2.5 bg-white rounded-lg border transition-colors cursor-pointer',
                        isGroupAdded(group) ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 hover:border-indigo-300'
                      ]"
                      @click="!isGroupAdded(group) && addHsnGroup(group)">
                      <div>
                        <span :class="['text-xs font-mono font-bold', group.hsn_code === 'UNKNOWN' ? 'text-amber-700' : 'text-indigo-700']">
                          {{ group.hsn_code === 'UNKNOWN' ? 'Others (No HSN)' : group.hsn_code }}
                        </span>
                        <span class="text-[10px] text-slate-500 ml-2">— {{ group.item_count }} parts · {{ group.total_quantity }} pcs</span>
                      </div>
                      <div class="flex items-center gap-3">
                        <span v-if="group.tariff" class="text-[10px] text-emerald-600">BCD {{ group.tariff.bcd_rate }}% · IGST {{ group.tariff.igst_rate }}%</span>
                        <span v-else-if="group.hsn_code === 'UNKNOWN'" class="text-[10px] text-amber-500">Manual HSN entry required</span>
                        <i v-if="isGroupAdded(group)" class="pi pi-check-circle text-emerald-500 text-xs" />
                        <i v-else class="pi pi-plus-circle text-indigo-400 text-xs" />
                      </div>
                    </div>
                    <div v-if="!getHsnGroups(shipment.id).length" class="text-xs text-slate-400 text-center py-2">
                      No items found for this shipment
                    </div>
                  </div>
                </div>

                <!-- Bulk Rate Change Bar -->
                <div v-if="selectedItems.size > 0" class="flex items-center gap-3 px-3 py-2 bg-amber-50 border border-amber-300 rounded-lg">
                  <div class="flex items-center gap-1.5">
                    <input type="checkbox" :checked="allSelected" @change="allSelected = $event.target.checked"
                      class="w-3.5 h-3.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500" />
                    <span class="text-xs font-semibold text-amber-800">{{ selectedItems.size }} selected</span>
                  </div>
                  <div class="h-4 w-px bg-amber-300"></div>
                  <label class="text-[10px] text-amber-700 font-medium">BCD%</label>
                  <input v-model="bulkBcd" type="number" step="0.1" placeholder="—"
                    class="w-16 px-1.5 py-1 text-xs border border-amber-300 rounded text-right bg-white focus:ring-1 focus:ring-amber-400" />
                  <label class="text-[10px] text-amber-700 font-medium">IGST%</label>
                  <input v-model="bulkIgst" type="number" step="0.1" placeholder="—"
                    class="w-16 px-1.5 py-1 text-xs border border-amber-300 rounded text-right bg-white focus:ring-1 focus:ring-amber-400" />
                  <button @click="applyBulkRates" :disabled="bulkBcd === '' && bulkIgst === ''"
                    class="px-3 py-1 text-[10px] font-semibold text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed">
                    Apply
                  </button>
                  <button @click="selectedItems = new Set()" class="ml-auto text-[10px] text-amber-600 hover:text-amber-800 font-medium">
                    Clear
                  </button>
                </div>

                <!-- Per-Part Duty Table (physical items only) -->
                <div v-if="lineItems.length" class="overflow-x-auto border border-slate-200 rounded-lg">
                  <table class="w-full text-xs">
                    <thead class="bg-slate-50">
                      <tr class="border-b-2 border-slate-200 text-slate-500">
                        <th class="py-2 px-1 w-8 text-center">
                          <input type="checkbox" :checked="allSelected" @change="allSelected = $event.target.checked"
                            class="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        </th>
                        <th class="text-left py-2 px-2 font-medium">Part Name</th>
                        <th class="text-left py-2 px-1 font-medium w-20">HSN</th>
                        <th class="text-right py-2 px-1 font-medium w-14">Qty</th>
                        <th class="text-right py-2 px-1 font-medium w-20">Price</th>
                        <th class="text-right py-2 px-1 font-medium w-24">AV Share (₹)</th>
                        <th class="text-right py-2 px-1 font-medium w-14">BCD%</th>
                        <th class="text-right py-2 px-1 font-medium w-20">BCD ₹</th>
                        <th class="text-right py-2 px-1 font-medium w-20">SWC ₹</th>
                        <th class="text-right py-2 px-1 font-medium w-14">IGST%</th>
                        <th class="text-right py-2 px-1 font-medium w-20">IGST ₹</th>
                        <th class="text-right py-2 px-1 font-medium w-24">Duty ₹</th>
                        <th class="w-6"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="entry in physicalLineItems" :key="entry._idx"
                        :class="['border-b border-slate-100 hover:bg-slate-50/50', selectedItems.has(entry._idx) ? 'bg-amber-50/60' : '']">
                        <td class="py-1.5 px-1 text-center">
                          <input type="checkbox" :checked="selectedItems.has(entry._idx)" @change="toggleItem(entry._idx)"
                            class="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        </td>
                        <td class="py-1.5 px-2 text-slate-700 truncate max-w-[160px]" :title="entry.product_name">
                          {{ entry.product_name || '—' }}
                        </td>
                        <td class="py-1.5 px-1">
                          <input v-model="lineItems[entry._idx].hsn_code" type="text"
                            class="w-full px-1 py-0.5 text-xs border border-slate-200 rounded font-mono text-indigo-700" />
                        </td>
                        <td class="py-1.5 px-1 text-right text-slate-600">{{ entry.quantity }}</td>
                        <td class="py-1.5 px-1">
                          <input v-model.number="lineItems[entry._idx].unit_price" type="number" step="0.01"
                            class="w-full px-1 py-0.5 text-xs border border-slate-200 rounded text-right" />
                        </td>
                        <td class="py-1.5 px-1 text-right font-medium text-slate-800">
                          {{ calc?.line_items?.[entry._idx] ? fmt(calc.line_items[entry._idx].assessable_value_inr) : '—' }}
                        </td>
                        <td class="py-1.5 px-1">
                          <input v-model.number="lineItems[entry._idx].bcd_rate" type="number" step="0.1"
                            class="w-full px-1 py-0.5 text-xs border border-slate-200 rounded text-right" />
                        </td>
                        <td class="py-1.5 px-1 text-right text-amber-700">
                          {{ calc?.line_items?.[entry._idx] ? fmt(calc.line_items[entry._idx].bcd_amount) : '—' }}
                        </td>
                        <td class="py-1.5 px-1 text-right text-amber-600">
                          {{ calc?.line_items?.[entry._idx] ? fmt(calc.line_items[entry._idx].swc_amount) : '—' }}
                        </td>
                        <td class="py-1.5 px-1">
                          <input v-model.number="lineItems[entry._idx].igst_rate" type="number" step="0.1"
                            class="w-full px-1 py-0.5 text-xs border border-slate-200 rounded text-right" />
                        </td>
                        <td class="py-1.5 px-1 text-right text-blue-700">
                          {{ calc?.line_items?.[entry._idx] ? fmt(calc.line_items[entry._idx].igst_amount) : '—' }}
                        </td>
                        <td class="py-1.5 px-1 text-right font-bold">
                          {{ calc?.line_items?.[entry._idx] ? fmt(calc.line_items[entry._idx].total_duty) : '—' }}
                        </td>
                        <td class="py-1.5 text-center">
                          <button @click="removeLineItem(entry._idx)" class="text-red-400 hover:text-red-600">
                            <i class="pi pi-trash text-[10px]" />
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Compensation / Balance Adjustment Items (reference only) -->
                <div v-if="compensationLineItems.length" class="mt-3">
                  <div class="flex items-center gap-2 mb-1.5">
                    <span class="text-[10px] font-semibold text-purple-700 uppercase tracking-wider">Balance Compensation</span>
                    <span class="text-[10px] text-purple-500">({{ compensationLineItems.length }} items — ₹0 duty, shown for reference)</span>
                  </div>
                  <div class="overflow-x-auto border border-purple-200 rounded-lg bg-purple-50/30">
                    <table class="w-full text-xs">
                      <thead class="bg-purple-50">
                        <tr class="border-b border-purple-200 text-purple-500">
                          <th class="text-left py-1.5 px-2 font-medium">Part Name</th>
                          <th class="text-left py-1.5 px-1 font-medium w-20">HSN</th>
                          <th class="text-right py-1.5 px-1 font-medium w-14">Qty</th>
                          <th class="text-right py-1.5 px-1 font-medium w-20">Price</th>
                          <th class="text-left py-1.5 px-2 font-medium">Note</th>
                          <th class="w-6"></th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="entry in compensationLineItems" :key="entry._idx"
                          class="border-b border-purple-100">
                          <td class="py-1.5 px-2 text-purple-700 truncate max-w-[180px]" :title="entry.product_name">
                            {{ entry.product_name || '—' }}
                          </td>
                          <td class="py-1.5 px-1 font-mono text-purple-600">{{ entry.hsn_code }}</td>
                          <td class="py-1.5 px-1 text-right text-purple-600">{{ entry.quantity }}</td>
                          <td class="py-1.5 px-1 text-right text-purple-400">{{ fmt(entry.unit_price) }}</td>
                          <td class="py-1.5 px-2 text-purple-400 italic">Balance adjustment — no duty applicable</td>
                          <td class="py-1.5 text-center">
                            <button @click="removeLineItem(entry._idx)" class="text-red-400 hover:text-red-600">
                              <i class="pi pi-trash text-[10px]" />
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div v-if="!lineItems.length" class="text-center py-4 text-xs text-slate-400 border border-dashed border-slate-300 rounded-lg">
                  Click "Add Items" to select HSN groups and add parts for duty calculation
                </div>
              </div>

              <!-- Section 4: Summary & Save -->
              <div v-if="calc && lineItems.length" class="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl border border-indigo-200">
                <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                  <div class="text-center">
                    <div class="text-[10px] text-slate-500">Total AV</div>
                    <div class="text-xs font-semibold">₹{{ fmt(calc.assessment_value_inr) }}</div>
                  </div>
                  <div class="text-center">
                    <div class="text-[10px] text-slate-500">Total BCD</div>
                    <div class="text-xs font-semibold text-amber-700">₹{{ fmt(calc.total_bcd) }}</div>
                  </div>
                  <div class="text-center">
                    <div class="text-[10px] text-slate-500">Total SWC</div>
                    <div class="text-xs font-semibold text-amber-600">₹{{ fmt(calc.total_swc) }}</div>
                  </div>
                  <div class="text-center">
                    <div class="text-[10px] text-slate-500">Total IGST</div>
                    <div class="text-xs font-semibold text-blue-700">₹{{ fmt(calc.total_igst) }}</div>
                  </div>
                  <div class="text-center bg-red-50 rounded-lg py-2 border border-red-200">
                    <div class="text-[10px] text-red-600 font-bold uppercase">Total Duty (ICEGATE)</div>
                    <div class="text-lg font-bold text-red-700">₹{{ fmt(calc.total_duty) }}</div>
                  </div>
                </div>

                <!-- Validation warning -->
                <div v-if="!allItemsIncluded" class="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-700">
                  <i class="pi pi-exclamation-triangle" />
                  <span>{{ includedCount }} / {{ totalShipmentItems }} packing items added. All items must be included before saving.</span>
                </div>

                <div class="flex justify-end gap-2">
                  <button @click="cancelBoe" class="px-4 py-2 text-xs text-slate-500 hover:text-slate-700">
                    Cancel
                  </button>
                  <button @click="saveBoe" :disabled="saving"
                    class="px-4 py-2 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                    <i class="pi pi-save text-[10px] mr-1" />
                    {{ saving ? 'Saving...' : 'Save BOE' }}
                  </button>
                </div>
              </div>

              <!-- Cancel only (no items yet) -->
              <div v-else class="flex justify-end">
                <button @click="cancelBoe" class="px-4 py-2 text-xs text-slate-500 hover:text-slate-700">Cancel</button>
              </div>
            </div>

            <!-- No BOE yet, not editing -->
            <div v-if="!boeMap[shipment.id] && activeShipmentId !== shipment.id" class="p-5 text-center text-slate-400">
              <i class="pi pi-file-check text-3xl mb-2 text-slate-300" />
              <p class="text-xs">No Bill of Entry created yet</p>
              <p class="text-[10px] text-slate-400 mt-1">Click "Create BOE" to start customs filing</p>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="!loading && !shipments.length" class="text-center py-12 text-slate-500">
          <i class="pi pi-file-check text-4xl mb-3 text-slate-300" />
          <p class="text-sm">No shipments found</p>
          <p class="text-xs text-slate-400 mt-1">Shipments must arrive before customs filing</p>
        </div>
      </div>
    </div>

    <!-- ==========================================
         MANUAL HSN ENTRY DIALOG
         ========================================== -->
    <div v-if="showManualHsn" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showManualHsn = false">
      <div class="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
        <div class="flex items-center gap-2 mb-4">
          <div class="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
            <i class="pi pi-exclamation-triangle text-amber-600" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-slate-800">HSN Code Required</h3>
            <p class="text-xs text-slate-500">{{ manualHsnGroup?.item_count }} parts without HSN code</p>
          </div>
        </div>

        <p class="text-xs text-slate-600 mb-3">
          These products don't have an HSN code assigned. Enter the HSN code to use for customs filing:
        </p>

        <!-- Show parts preview -->
        <div class="mb-3 max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2">
          <div v-for="item in (manualHsnGroup?.items || []).slice(0, 5)" :key="item.shipment_item_id"
            class="text-[10px] text-slate-600 py-0.5 truncate">
            {{ item.product_name }} <span class="text-slate-400">({{ item.quantity }} pcs)</span>
          </div>
          <div v-if="(manualHsnGroup?.items || []).length > 5" class="text-[10px] text-slate-400 mt-1">
            ... and {{ manualHsnGroup.items.length - 5 }} more
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-xs font-medium text-slate-700 mb-1">HSN Code</label>
          <input v-model="manualHsnCode" type="text" placeholder="e.g. 84339000"
            class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
            @keyup.enter="confirmManualHsn" />
          <!-- Tariff lookup hint -->
          <div v-if="manualHsnCode && tariffs.find(t => t.hsn_code === manualHsnCode)" class="mt-1 text-[10px] text-emerald-600">
            <i class="pi pi-check-circle text-[8px]" /> Found: BCD {{ tariffs.find(t => t.hsn_code === manualHsnCode).bcd_rate }}% · IGST {{ tariffs.find(t => t.hsn_code === manualHsnCode).igst_rate }}%
          </div>
        </div>

        <div class="flex gap-3 justify-end">
          <button @click="showManualHsn = false" class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          <button @click="confirmManualHsn" :disabled="!manualHsnCode.trim()"
            class="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium">
            Add Parts
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
