<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { shipmentsApi, transportApi, packingApi, factoriesApi, clientsApi, settingsApi } from '../../api'
import { formatDate } from '../../utils/formatters'

const props = defineProps({
  orderId: { type: String, required: true },
  order: { type: Object, required: true },
})
const emit = defineEmits(['reload'])
const bookingRouter = useRouter()

// ========================================
// State
// ========================================
const loading = ref(false)
const saving = ref(false)
const shipments = ref([])
const selectedShipment = ref(null)
const allProviders = ref([])
const packingItems = ref([])
const error = ref('')

// Address data for HBL auto-fill
const factoryDetails = ref(null)
const clientDetails = ref(null)
const companySettings = ref({})

// Wizard state
const wizardActive = ref(false)
const wizardStep = ref(1) // 1=Providers, 2=Container+HBL, 3=Items
const editingShipmentId = ref(null) // null = new, id = editing existing

// Container form
const defaultForm = () => ({
  container_type: '40HC',
  freight_terms: 'Prepaid',
  port_of_loading: '',
  port_of_discharge: '',
  etd: '',
  eta: '',
  freight_forwarder_id: null,
  cha_id: null,
  cfs_id: null,
  transport_id: null,
  shipper: '',
  consignee: '',
  notify_party: '',
  description_of_goods: '',
})
const form = ref(defaultForm())
const itemAllocations = ref([])

// ========================================
// Computed
// ========================================
const isBookingStage = computed(() => {
  const s = ['BOOKED', 'LOADED', 'SAILED', 'ARRIVED', 'CUSTOMS_FILED', 'CLEARED', 'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING']
  return s.includes(props.order?.status)
})

// All active providers — any company can be assigned any role per shipment
const activeProviders = computed(() =>
  allProviders.value.filter(p => p.is_active !== false)
)

const containerTypeLabel = {
  '20FT': "20' Standard",
  '40FT': "40' Standard",
  '40HC': "40' High Cube",
}

// Role definitions for the wizard cards
const roleCards = [
  { key: 'freight_forwarder_id', role: 'FREIGHT_FORWARDER', label: 'Freight Forwarder', icon: 'pi-send',
    activeBorder: 'border-blue-300 bg-blue-50/30', iconBg: 'bg-blue-100 text-blue-600' },
  { key: 'cha_id', role: 'CHA', label: 'CHA', icon: 'pi-file-edit',
    activeBorder: 'border-green-300 bg-green-50/30', iconBg: 'bg-green-100 text-green-600' },
  { key: 'cfs_id', role: 'CFS', label: 'CFS', icon: 'pi-warehouse',
    activeBorder: 'border-orange-300 bg-orange-50/30', iconBg: 'bg-orange-100 text-orange-600' },
  { key: 'transport_id', role: 'TRANSPORT', label: 'Transport', icon: 'pi-truck',
    activeBorder: 'border-purple-300 bg-purple-50/30', iconBg: 'bg-purple-100 text-purple-600' },
]

// All roles show all providers — tags are just hints
const providersByRole = computed(() => ({
  FREIGHT_FORWARDER: activeProviders.value,
  CHA: activeProviders.value,
  CFS: activeProviders.value,
  TRANSPORT: activeProviders.value,
}))

// Wizard step labels (2-step: providers + container details)
const steps = [
  { num: 1, label: 'Service Providers' },
  { num: 2, label: 'Container & HBL' },
]

const canProceedStep1 = computed(() => {
  // At least one provider should be assigned to any role
  return !!(form.value.freight_forwarder_id || form.value.cha_id || form.value.cfs_id || form.value.transport_id)
})

const canProceedStep2 = computed(() => {
  return form.value.container_type && form.value.port_of_loading && form.value.port_of_discharge
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
  } catch (err) {
    console.error('Failed to load shipments:', err)
    error.value = err.response?.data?.detail || 'Failed to load shipments'
  } finally {
    loading.value = false
  }
}

async function loadProviders() {
  try {
    const res = await transportApi.list({ per_page: 200 })
    allProviders.value = res.data?.items || res.data || []
  } catch (err) {
    console.error('Failed to load transport providers:', err)
  }
}

async function loadPackingItems() {
  try {
    const res = await packingApi.get(props.orderId)
    packingItems.value = (res.data.items || []).filter(i => i.order_item_status !== 'UNLOADED')
  } catch (err) {
    console.error('Failed to load packing items:', err)
    packingItems.value = []
  }
}

async function loadAddressData() {
  try {
    const promises = []
    if (props.order?.factory_id) {
      promises.push(factoriesApi.get(props.order.factory_id).then(r => { factoryDetails.value = r.data }))
    }
    if (props.order?.client_id) {
      promises.push(clientsApi.get(props.order.client_id).then(r => { clientDetails.value = r.data }))
    }
    promises.push(settingsApi.getDefaults().then(r => {
      const settings = {}
      for (const s of (r.data || [])) { settings[s.key] = s.value }
      companySettings.value = settings
    }))
    await Promise.all(promises)
  } catch (err) {
    console.error('Failed to load address data:', err)
  }
}

function formatAddress(entity, type) {
  if (!entity) return ''
  const lines = []
  if (type === 'factory') {
    lines.push(entity.company_name || '')
    if (entity.company_name_chinese) lines.push(entity.company_name_chinese)
    if (entity.address) lines.push(entity.address)
    const cityLine = [entity.city, entity.province, entity.country].filter(Boolean).join(', ')
    if (cityLine) lines.push(cityLine)
    if (entity.primary_contact_name) lines.push(`Contact: ${entity.primary_contact_name}`)
    if (entity.primary_contact_phone) lines.push(`Tel: ${entity.primary_contact_phone}`)
  } else if (type === 'client') {
    lines.push(entity.company_name || '')
    if (entity.address) lines.push(entity.address)
    const cityLine = [entity.city, entity.state, entity.pincode].filter(Boolean).join(', ')
    if (cityLine) lines.push(cityLine)
    if (entity.gstin) lines.push(`GSTIN: ${entity.gstin}`)
    if (entity.iec) lines.push(`IEC: ${entity.iec}`)
    if (entity.contact_name) lines.push(`Contact: ${entity.contact_name}`)
    if (entity.contact_phone) lines.push(`Tel: ${entity.contact_phone}`)
  } else if (type === 'self') {
    const s = companySettings.value
    if (s.company_name) lines.push(s.company_name)
    if (s.company_address) lines.push(s.company_address)
    if (s.company_phone) lines.push(`Tel: ${s.company_phone}`)
    if (s.company_email) lines.push(`Email: ${s.company_email}`)
    if (s.company_gstin) lines.push(`GSTIN: ${s.company_gstin}`)
  }
  return lines.filter(Boolean).join('\n')
}

function fillShipperFromFactory() {
  form.value.shipper = formatAddress(factoryDetails.value, 'factory')
}
function fillConsigneeFromClient() {
  form.value.consignee = formatAddress(clientDetails.value, 'client')
}
function fillNotifyFromClient() {
  form.value.notify_party = formatAddress(clientDetails.value, 'client')
}
function fillNotifyFromSelf() {
  form.value.notify_party = formatAddress(null, 'self')
}

function startWizard(existingShipment = null) {
  wizardActive.value = true
  wizardStep.value = 1

  if (existingShipment) {
    editingShipmentId.value = existingShipment.id
    form.value = {
      container_type: existingShipment.container_type || '40HC',
      freight_terms: existingShipment.freight_terms || 'Prepaid',
      port_of_loading: existingShipment.port_of_loading || '',
      port_of_discharge: existingShipment.port_of_discharge || '',
      etd: existingShipment.etd || '',
      eta: existingShipment.eta || '',
      freight_forwarder_id: existingShipment.freight_forwarder_id || null,
      cha_id: existingShipment.cha_id || null,
      cfs_id: existingShipment.cfs_id || null,
      transport_id: existingShipment.transport_id || null,
      shipper: existingShipment.shipper || '',
      consignee: existingShipment.consignee || '',
      notify_party: existingShipment.notify_party || '',
      description_of_goods: existingShipment.description_of_goods || '',
    }
    // Use existing allocations if shipment has items, otherwise auto-allocate from packing list
    if (existingShipment.items?.length > 0) {
      itemAllocations.value = existingShipment.items.map(item => ({
        packing_list_item_id: item.packing_list_item_id,
        allocated_qty: item.allocated_qty || 0,
        pallet_number: item.pallet_number || null,
      }))
    } else {
      // Shipment has no items — auto-allocate from packing list (same as create)
      itemAllocations.value = packingItems.value.map(item => ({
        packing_list_item_id: item.id,
        allocated_qty: item.factory_ready_qty || item.ordered_qty,
        pallet_number: item.package_number || null,
      }))
    }
  } else {
    editingShipmentId.value = null
    form.value = defaultForm()
    // Auto-fill from order with full address blocks
    form.value.port_of_loading = props.order?.port_of_loading || ''
    form.value.port_of_discharge = props.order?.port_of_discharge || ''
    form.value.shipper = formatAddress(factoryDetails.value, 'factory') || props.order?.factory_name || ''
    form.value.consignee = formatAddress(clientDetails.value, 'client') || props.order?.client_name || ''
    form.value.notify_party = formatAddress(clientDetails.value, 'client') || props.order?.client_name || ''
    form.value.description_of_goods = 'Combine Harvester Spare Parts'

    // If existing containers, copy providers from first one
    if (shipments.value.length > 0) {
      const last = shipments.value[shipments.value.length - 1]
      form.value.freight_forwarder_id = last.freight_forwarder_id || null
      form.value.cha_id = last.cha_id || null
      form.value.cfs_id = last.cfs_id || null
      form.value.transport_id = last.transport_id || null
      form.value.port_of_loading = last.port_of_loading || form.value.port_of_loading
      form.value.port_of_discharge = last.port_of_discharge || form.value.port_of_discharge
    }

    // Auto-allocate all packing items (full qty) — no manual step needed
    itemAllocations.value = packingItems.value.map(item => ({
      packing_list_item_id: item.id,
      allocated_qty: item.factory_ready_qty || item.ordered_qty,
      pallet_number: item.package_number || null,
    }))
  }
}

function cancelWizard() {
  wizardActive.value = false
  wizardStep.value = 1
  editingShipmentId.value = null
  form.value = defaultForm()
  itemAllocations.value = []
}

function onProviderSelect(role, providerId) {
  if (!providerId || providerId === 'SELF') return
  const provider = allProviders.value.find(p => String(p.id) === String(providerId))
  if (!provider || !provider.roles) return

  // Auto-fill other dropdowns if the provider has matching roles and they're empty
  const mappings = {
    FREIGHT_FORWARDER: 'freight_forwarder_id',
    CHA: 'cha_id',
    CFS: 'cfs_id',
    TRANSPORT: 'transport_id',
  }

  for (const [provRole, formKey] of Object.entries(mappings)) {
    if (provRole === role) continue
    if (provider.roles.includes(provRole) && !form.value[formKey]) {
      form.value[formKey] = providerId
    }
  }
}

function handleProviderChange(card) {
  const val = form.value[card.key]
  if (val === '__ADD_NEW__') {
    form.value[card.key] = null
    bookingRouter.push('/transport/new')
    return
  }
  onProviderSelect(card.role, val)
}

function getRoleBadges(providerId) {
  if (!providerId || providerId === 'SELF') return []
  const p = allProviders.value.find(p => String(p.id) === String(providerId))
  return p?.roles || []
}

async function saveContainerAndAllocations() {
  saving.value = true
  error.value = ''
  try {
    // Clean payload before sending to backend
    const payload = { ...form.value }
    // Convert "SELF" to null for FK fields
    const fkFields = ['freight_forwarder_id', 'cha_id', 'cfs_id', 'transport_id']
    for (const fk of fkFields) {
      if (payload[fk] === 'SELF') payload[fk] = null
    }
    // Convert empty strings to null for date fields (backend expects date or null, not "")
    for (const df of ['etd', 'eta']) {
      if (!payload[df]) payload[df] = null
    }

    let shipmentId
    if (editingShipmentId.value) {
      await shipmentsApi.update(editingShipmentId.value, payload)
      shipmentId = editingShipmentId.value
    } else {
      const res = await shipmentsApi.create(props.orderId, payload)
      shipmentId = res.data.id
    }

    // Auto-allocate all packing items to this container
    const allocItems = itemAllocations.value
      .filter(a => a.allocated_qty > 0)
      .map(a => ({
        packing_list_item_id: a.packing_list_item_id,
        allocated_qty: a.allocated_qty,
        pallet_number: a.pallet_number || null,
      }))
    if (allocItems.length > 0) {
      await shipmentsApi.allocateItems(shipmentId, allocItems)
    }

    await loadShipments()
    cancelWizard()
    emit('reload')
  } catch (err) {
    console.error('Failed to save:', err, err.response?.data)
    const detail = err.response?.data?.detail
    if (Array.isArray(detail)) {
      error.value = detail.map(d => d.msg || JSON.stringify(d)).join('; ')
    } else {
      error.value = detail || err.message || 'Failed to save container'
    }
  } finally {
    saving.value = false
  }
}

async function deleteContainer(shipmentId) {
  if (!confirm('Delete this container booking?')) return
  try {
    await shipmentsApi.delete(shipmentId)
    if (selectedShipment.value?.id === shipmentId) {
      selectedShipment.value = null
    }
    await loadShipments()
    emit('reload')
  } catch (err) {
    console.error('Failed to delete container:', err)
    error.value = err.response?.data?.detail || 'Failed to delete container'
  }
}

function selectContainer(shipment) {
  if (selectedShipment.value?.id === shipment.id) {
    selectedShipment.value = null
    return
  }
  selectedShipment.value = shipment
}

function getProviderName(id) {
  if (!id) return '\u2014'
  if (id === 'SELF') return 'Self'
  const p = allProviders.value.find(p => String(p.id) === String(id))
  return p?.name || '\u2014'
}


// Pallet options: 1-50 + Loose
const palletOptions = computed(() => {
  const opts = [{ value: '', label: '\u2014' }, { value: 'Loose', label: 'Loose' }]
  for (let i = 1; i <= 50; i++) {
    opts.push({ value: String(i), label: `Pallet ${i}` })
  }
  return opts
})

const roleColorMap = {
  FREIGHT_FORWARDER: 'bg-blue-100 text-blue-700',
  CHA: 'bg-green-100 text-green-700',
  CFS: 'bg-orange-100 text-orange-700',
  TRANSPORT: 'bg-purple-100 text-purple-700',
}

const roleLabelMap = {
  FREIGHT_FORWARDER: 'FF',
  CHA: 'CHA',
  CFS: 'CFS',
  TRANSPORT: 'Transport',
}

// ========================================
// Lifecycle
// ========================================
onMounted(async () => {
  await Promise.all([loadShipments(), loadProviders(), loadPackingItems(), loadAddressData()])
  // Auto-start wizard when no containers exist
  if (!shipments.value.length) {
    startWizard()
  }
})

watch(() => props.order?.status, () => {
  wizardActive.value = false
  selectedShipment.value = null
})
</script>

<template>
  <div v-if="isBookingStage">
    <!-- Header -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden border-2 border-amber-200 mb-6">
      <div class="px-6 py-4 border-b border-amber-200 bg-amber-50">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-2">
              <i class="pi pi-briefcase text-amber-600" /> Container Booking
            </h3>
            <p class="text-xs text-amber-600 mt-0.5">Assign service providers, book containers, and allocate items</p>
          </div>
          <div class="flex items-center gap-2">
            <template v-if="!wizardActive">
              <button @click="startWizard()"
                class="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2">
                <i class="pi pi-plus text-xs" /> {{ shipments.length ? 'Add Container' : 'Book Container' }}
              </button>
            </template>
            <template v-else>
              <button @click="cancelWizard"
                class="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1">
                <i class="pi pi-times text-[10px]" /> Cancel
              </button>
            </template>
          </div>
        </div>
      </div>

      <div class="p-6">
        <!-- Loading -->
        <div v-if="loading" class="flex items-center justify-center py-12">
          <i class="pi pi-spin pi-spinner text-2xl text-amber-500" />
        </div>

        <!-- Error -->
        <div v-if="error" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <i class="pi pi-exclamation-circle" />
          <span>{{ error }}</span>
          <button @click="error = ''" class="ml-auto text-red-400 hover:text-red-600"><i class="pi pi-times text-xs" /></button>
        </div>

        <!-- ============================== -->
        <!-- WIZARD MODE -->
        <!-- ============================== -->
        <div v-if="wizardActive && !loading">
          <!-- Step Indicator -->
          <div class="flex items-center justify-center mb-8">
            <div v-for="(step, idx) in steps" :key="step.num" class="flex items-center">
              <div class="flex items-center gap-2 cursor-pointer" @click="wizardStep = step.num">
                <div :class="[
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                  wizardStep === step.num
                    ? 'bg-amber-600 text-white shadow-lg shadow-amber-200'
                    : wizardStep > step.num
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-500'
                ]">
                  <i v-if="wizardStep > step.num" class="pi pi-check text-xs" />
                  <span v-else>{{ step.num }}</span>
                </div>
                <span :class="[
                  'text-sm font-medium',
                  wizardStep === step.num ? 'text-amber-800' : wizardStep > step.num ? 'text-emerald-700' : 'text-slate-400'
                ]">{{ step.label }}</span>
              </div>
              <div v-if="idx < steps.length - 1" :class="[
                'w-12 h-0.5 mx-3',
                wizardStep > step.num ? 'bg-emerald-400' : 'bg-slate-200'
              ]" />
            </div>
          </div>

          <!-- ====== STEP 1: Service Providers ====== -->
          <div v-if="wizardStep === 1">
            <div class="mb-4">
              <h4 class="text-base font-semibold text-slate-800">Assign Service Providers</h4>
              <p class="text-sm text-slate-500 mt-1">Select which company handles each role for this shipment. Multi-role companies will auto-fill other roles.</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div v-for="card in roleCards" :key="card.key"
                :class="[
                  'rounded-xl border-2 p-4 transition-all',
                  form[card.key] ? card.activeBorder : 'border-slate-200 bg-white'
                ]">
                <div class="flex items-center gap-2 mb-3">
                  <div :class="['w-8 h-8 rounded-lg flex items-center justify-center', card.iconBg]">
                    <i :class="'pi ' + card.icon + ' text-sm'" />
                  </div>
                  <div>
                    <h5 class="text-sm font-semibold text-slate-800">{{ card.label }}</h5>
                  </div>
                  <i v-if="form[card.key]" class="pi pi-check-circle text-emerald-500 ml-auto" />
                </div>

                <select v-model="form[card.key]"
                  @change="handleProviderChange(card)"
                  class="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white">
                  <option :value="null">-- Select Company --</option>
                  <option value="SELF">Self (Handled by us)</option>
                  <option v-for="p in providersByRole[card.role]" :key="p.id" :value="p.id">
                    {{ p.name }}{{ p.roles?.length ? ' (' + p.roles.map(r => roleLabelMap[r] || r).join(', ') + ')' : '' }}
                  </option>
                  <option disabled>────────────</option>
                  <option value="__ADD_NEW__">+ Add New Provider</option>
                </select>

                <!-- Show role badges if selected provider has multi-roles -->
                <div v-if="form[card.key]" class="mt-2 flex flex-wrap gap-1">
                  <span v-for="r in getRoleBadges(form[card.key])" :key="r"
                    :class="['inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold', roleColorMap[r] || 'bg-slate-100 text-slate-600']">
                    {{ roleLabelMap[r] || r }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Navigation -->
            <div class="flex items-center justify-between mt-8 pt-4 border-t border-slate-200">
              <div class="text-xs text-slate-400">
                <span v-if="!canProceedStep1">Assign at least one service provider to continue</span>
              </div>
              <button @click="wizardStep = 2" :disabled="!canProceedStep1"
                class="px-5 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
                Next: Container Details <i class="pi pi-arrow-right text-xs" />
              </button>
            </div>
          </div>

          <!-- ====== STEP 2: Container & HBL ====== -->
          <div v-if="wizardStep === 2">
            <div class="mb-4">
              <h4 class="text-base font-semibold text-slate-800">Container & HBL Details</h4>
              <p class="text-sm text-slate-500 mt-1">Specify container type, ports, dates, and HBL content.</p>
            </div>

            <div class="space-y-6">
              <!-- Container Details -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Container Type *</label>
                  <select v-model="form.container_type"
                    class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500">
                    <option value="20FT">20' Standard</option>
                    <option value="40FT">40' Standard</option>
                    <option value="40HC">40' High Cube</option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Port of Loading *</label>
                  <input v-model="form.port_of_loading" type="text" placeholder="e.g. Shanghai"
                    class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Port of Discharge *</label>
                  <input v-model="form.port_of_discharge" type="text" placeholder="e.g. Chennai"
                    class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500" />
                </div>
              </div>

              <!-- Dates & Freight -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">ETD (Est. Departure)</label>
                  <input v-model="form.etd" type="date"
                    class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">ETA (Est. Arrival)</label>
                  <input v-model="form.eta" type="date"
                    class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500" />
                </div>
                <div>
                  <label class="block text-xs font-medium text-slate-600 mb-1">Freight Terms</label>
                  <select v-model="form.freight_terms"
                    class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500">
                    <option value="Prepaid">Prepaid</option>
                    <option value="Collect">Collect</option>
                  </select>
                </div>
              </div>

              <!-- HBL Content -->
              <div>
                <h5 class="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <i class="pi pi-file text-slate-400" /> HBL Content
                </h5>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <!-- Shipper -->
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-xs font-medium text-slate-600">Shipper</label>
                      <button v-if="factoryDetails" @click="fillShipperFromFactory" type="button"
                        class="text-[10px] font-medium text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
                        <i class="pi pi-building text-[9px]" /> Fill from Factory
                      </button>
                    </div>
                    <textarea v-model="form.shipper" rows="4" placeholder="Company name, address, contact..."
                      class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500" />
                  </div>
                  <!-- Consignee -->
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-xs font-medium text-slate-600">Consignee</label>
                      <button v-if="clientDetails" @click="fillConsigneeFromClient" type="button"
                        class="text-[10px] font-medium text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
                        <i class="pi pi-users text-[9px]" /> Fill from Client
                      </button>
                    </div>
                    <textarea v-model="form.consignee" rows="4" placeholder="Company name, address, GSTIN..."
                      class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500" />
                  </div>
                  <!-- Notify Party -->
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-xs font-medium text-slate-600">Notify Party</label>
                      <div class="flex items-center gap-2">
                        <button v-if="clientDetails" @click="fillNotifyFromClient" type="button"
                          class="text-[10px] font-medium text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
                          <i class="pi pi-users text-[9px]" /> Client
                        </button>
                        <button @click="fillNotifyFromSelf" type="button"
                          class="text-[10px] font-medium text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5">
                          <i class="pi pi-user text-[9px]" /> Self
                        </button>
                      </div>
                    </div>
                    <textarea v-model="form.notify_party" rows="4" placeholder="Company name, address, contact..."
                      class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500" />
                  </div>
                  <!-- Description of Goods -->
                  <div>
                    <label class="block text-xs font-medium text-slate-600 mb-1">Description of Goods</label>
                    <textarea v-model="form.description_of_goods" rows="4" placeholder="e.g. Combine Harvester Spare Parts"
                      class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500" />
                  </div>
                </div>
              </div>
            </div>

            <!-- Navigation + Save -->
            <div class="flex items-center justify-between mt-8 pt-4 border-t border-slate-200">
              <button @click="wizardStep = 1"
                class="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2">
                <i class="pi pi-arrow-left text-xs" /> Back
              </button>
              <button @click="saveContainerAndAllocations" :disabled="!canProceedStep2 || saving"
                class="px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-lg shadow-emerald-200">
                <i v-if="saving" class="pi pi-spin pi-spinner text-xs" />
                <i v-else class="pi pi-check text-xs" />
                {{ saving ? 'Saving...' : (editingShipmentId ? 'Save Changes' : 'Create Booking') }}
              </button>
            </div>
          </div>
        </div>

        <!-- ============================== -->
        <!-- LIST MODE (existing containers) -->
        <!-- ============================== -->
        <div v-if="!wizardActive && !loading">
          <!-- Container cards -->
          <div v-if="shipments.length" class="space-y-3">
            <div v-for="s in shipments" :key="s.id"
              :class="[
                'rounded-xl border-2 p-4 cursor-pointer transition-all',
                selectedShipment?.id === s.id
                  ? 'border-amber-400 bg-amber-50/50 shadow-md'
                  : 'border-slate-200 bg-white hover:border-amber-300 hover:shadow-sm'
              ]"
              @click="selectContainer(s)">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                    {{ containerTypeLabel[s.container_type] || s.container_type || '40HC' }}
                  </span>
                  <div>
                    <div class="text-sm font-medium text-slate-800">
                      {{ s.port_of_loading || 'TBD' }} <i class="pi pi-arrow-right text-[10px] text-slate-400 mx-1" /> {{ s.port_of_discharge || 'TBD' }}
                    </div>
                    <div class="flex flex-wrap gap-1 mt-1">
                      <span v-if="s.freight_forwarder_name" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600">
                        FF: {{ s.freight_forwarder_name }}
                      </span>
                      <span v-if="s.cha_name" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-600">
                        CHA: {{ s.cha_name }}
                      </span>
                      <span v-if="s.cfs_name" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-600">
                        CFS: {{ s.cfs_name }}
                      </span>
                      <span v-if="s.transport_name" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-600">
                        Transport: {{ s.transport_name }}
                      </span>
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-4 text-xs text-slate-500">
                  <div class="text-right">
                    <div>ETD: <span class="font-medium text-slate-700">{{ s.etd ? formatDate(s.etd) : '\u2014' }}</span></div>
                    <div>ETA: <span class="font-medium text-slate-700">{{ s.eta ? formatDate(s.eta) : '\u2014' }}</span></div>
                  </div>
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                    {{ (s.items || []).length }} items
                  </span>
                  <div class="flex items-center gap-1">
                    <button @click.stop="startWizard(s)"
                      class="p-1.5 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-colors"
                      title="Edit">
                      <i class="pi pi-pencil text-xs" />
                    </button>
                    <button @click.stop="deleteContainer(s.id)"
                      class="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete">
                      <i class="pi pi-trash text-xs" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Selected container detail (read-only) -->
          <div v-if="selectedShipment && !wizardActive" class="border border-slate-200 rounded-xl bg-white mt-4">
            <div class="px-5 py-3 border-b border-slate-200 bg-slate-50">
              <h4 class="text-sm font-semibold text-slate-700">Container Details</h4>
            </div>
            <div class="p-5">
              <!-- Service Providers -->
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                <div v-for="card in roleCards" :key="card.key">
                  <span class="text-xs text-slate-500">{{ card.label }}</span>
                  <p class="font-medium text-slate-800">{{ getProviderName(selectedShipment[card.key]) }}</p>
                </div>
              </div>

              <!-- Container Info -->
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-4 border-t border-slate-200">
                <div>
                  <span class="text-xs text-slate-500">Type</span>
                  <p class="font-medium text-slate-800">{{ containerTypeLabel[selectedShipment.container_type] || selectedShipment.container_type }}</p>
                </div>
                <div>
                  <span class="text-xs text-slate-500">Freight Terms</span>
                  <p class="font-medium text-slate-800">{{ selectedShipment.freight_terms || '\u2014' }}</p>
                </div>
                <div>
                  <span class="text-xs text-slate-500">ETD</span>
                  <p class="font-medium text-slate-800">{{ selectedShipment.etd ? formatDate(selectedShipment.etd) : '\u2014' }}</p>
                </div>
                <div>
                  <span class="text-xs text-slate-500">ETA</span>
                  <p class="font-medium text-slate-800">{{ selectedShipment.eta ? formatDate(selectedShipment.eta) : '\u2014' }}</p>
                </div>
              </div>

              <!-- HBL Info -->
              <div v-if="selectedShipment.shipper || selectedShipment.consignee" class="mt-4 pt-4 border-t border-slate-200">
                <h5 class="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">HBL Content</h5>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span class="text-xs text-slate-500">Shipper</span>
                    <p class="font-medium text-slate-800 whitespace-pre-line">{{ selectedShipment.shipper || '\u2014' }}</p>
                  </div>
                  <div>
                    <span class="text-xs text-slate-500">Consignee</span>
                    <p class="font-medium text-slate-800 whitespace-pre-line">{{ selectedShipment.consignee || '\u2014' }}</p>
                  </div>
                  <div>
                    <span class="text-xs text-slate-500">Notify Party</span>
                    <p class="font-medium text-slate-800 whitespace-pre-line">{{ selectedShipment.notify_party || '\u2014' }}</p>
                  </div>
                  <div>
                    <span class="text-xs text-slate-500">Description</span>
                    <p class="font-medium text-slate-800 whitespace-pre-line">{{ selectedShipment.description_of_goods || '\u2014' }}</p>
                  </div>
                </div>
              </div>

              <!-- Allocated Items -->
              <div v-if="(selectedShipment.items || []).length" class="mt-4 pt-4 border-t border-slate-200">
                <h5 class="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Allocated Items ({{ selectedShipment.items.length }})</h5>
                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="bg-slate-50 border-b border-slate-200">
                        <th class="px-3 py-2 text-left text-xs font-semibold text-slate-600">Part Code</th>
                        <th class="px-3 py-2 text-left text-xs font-semibold text-slate-600">Name</th>
                        <th class="px-3 py-2 text-right text-xs font-semibold text-slate-600">Loaded Qty</th>
                        <th class="px-3 py-2 text-center text-xs font-semibold text-slate-600">Pallet</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                      <tr v-for="item in selectedShipment.items" :key="item.id" class="hover:bg-slate-50">
                        <td class="px-3 py-2 font-mono text-xs text-slate-700">{{ item.product_code }}</td>
                        <td class="px-3 py-2 text-slate-600 text-xs">{{ item.product_name }}</td>
                        <td class="px-3 py-2 text-right font-medium">{{ item.loaded_qty }}</td>
                        <td class="px-3 py-2 text-center text-xs">{{ item.pallet_number || '\u2014' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div v-if="!loading && !shipments.length" class="text-center py-12 text-slate-500">
            <i class="pi pi-briefcase text-4xl mb-3 text-slate-300" />
            <p class="text-sm font-medium text-slate-600">No containers booked yet</p>
            <p class="text-xs text-slate-400 mt-1">Click "Book Container" to start the booking wizard</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
