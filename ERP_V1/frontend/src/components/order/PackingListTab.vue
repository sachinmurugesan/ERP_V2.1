<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { packingApi } from '../../api'

const props = defineProps({
  orderId: { type: String, required: true },
  order: { type: Object, required: true },
  highlightSection: { type: String, default: null },
})
const emit = defineEmits(['reload'])

// Section ref for highlight-on-navigate
const uploadSectionRef = ref(null)

// Watch for highlight requests from parent
watch(() => props.highlightSection, (section) => {
  if (section !== 'upload') return
  nextTick(() => {
    const el = uploadSectionRef.value
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('highlight-flash')
      setTimeout(() => el.classList.remove('highlight-flash'), 2500)
    }
  })
})

// ========================================
// State
// ========================================
const isEditing = ref(false)
const packingList = ref(null)
const packingItems = ref([])
const carryForwardItems = ref([])
const uploadingPacking = ref(false)
const selectedForMigration = ref(new Set())
const migrationReasons = ref({})
const migrating = ref(false)
const undoing = ref(false)
const packingFilterStatus = ref('')
const palletToast = ref('')
const palletToastTimeout = ref(null)
const packingFilterPallet = ref('')
const migrationToast = ref('')
const selectedForUndo = ref(new Set())
const showMigrateDialog = ref(false)
const showUndoDialog = ref(false)

// Split item flow
const showSplitDialog = ref(false)
const splitTarget = ref(null)  // the packing item being split
const splitRows = ref([])      // [{qty: 0, package_number: ''}]

// Partial readiness decision
const showCancelReasonDialog = ref(false)
const cancelReasonTarget = ref(null)
const cancelReasonText = ref('')

// Manual creation mode
const showManualCreate = ref(false)
const manualItems = ref([])
const creatingManual = ref(false)
const savedReadyIds = ref(new Set())

// ========================================
// Computed
// ========================================
const isPlanPacking = computed(() => props.order?.status === 'PLAN_PACKING')

const showPackingSection = computed(() => {
  const packingStatuses = ['PLAN_PACKING', 'FINAL_PI', 'PRODUCTION_100', 'BOOKED', 'LOADED', 'SAILED', 'ARRIVED',
    'CUSTOMS_FILED', 'CLEARED', 'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING']
  return packingStatuses.includes(props.order?.status)
})

const activePackingItems = computed(() => packingItems.value.filter(i =>
  i.order_item_status !== 'UNLOADED' &&
  !i.is_balance_only &&
  i.packing_status !== 'SPLIT'  // hide parent rows that have been split
))
const balanceOnlyItems = computed(() => packingItems.value.filter(i => i.order_item_status !== 'UNLOADED' && i.is_balance_only))
const migratedPackingItems = computed(() => packingItems.value.filter(i => i.order_item_status === 'UNLOADED'))

const filteredPackingItems = computed(() => {
  let items = activePackingItems.value
  if (packingFilterStatus.value) {
    items = items.filter(i => i.packing_status === packingFilterStatus.value)
  }
  if (packingFilterPallet.value) {
    items = items.filter(i => i.package_number === packingFilterPallet.value)
  }
  return items
})

const uniquePallets = computed(() => {
  const set = new Set()
  for (const item of packingItems.value) {
    if (item.package_number) set.add(item.package_number)
  }
  return [...set].sort((a, b) => {
    const na = parseInt(a), nb = parseInt(b)
    if (!isNaN(na) && !isNaN(nb)) return na - nb
    return a.localeCompare(b)
  })
})

const summaryStats = computed(() => {
  const active = activePackingItems.value
  const loaded = active.filter(i => i.packing_status === 'PALLETED' || i.packing_status === 'LOOSE')
  const notReady = active.filter(i => i.packing_status === 'NOT_READY')
  const migrated = migratedPackingItems.value
  const totalQty = active.reduce((sum, i) => sum + (i.ordered_qty || 0), 0)
  const loadedQty = active.reduce((sum, i) => sum + (i.loaded_qty || 0), 0)
  return {
    totalItems: active.length,
    loadedCount: loaded.length,
    notReadyCount: notReady.length,
    migratedCount: migrated.length,
    totalQty,
    loadedQty,
    loadedPercent: totalQty > 0 ? Math.round((loadedQty / totalQty) * 100) : 0,
  }
})

const isPartiallyReady = (item) =>
  item.factory_ready_qty > 0 && item.factory_ready_qty < item.ordered_qty && !item.is_split

const hasPartialItems = computed(() =>
  activePackingItems.value.some(i => isPartiallyReady(i))
)

// ========================================
// Functions
// ========================================
async function loadPackingList() {
  try {
    const res = await packingApi.get(props.orderId)
    packingList.value = res.data.packing_list
    packingItems.value = res.data.items || []
    carryForwardItems.value = res.data.carry_forward_items || []
  } catch (err) {
    console.error('Failed to load packing list:', err)
  }
}

async function uploadPackingList(event) {
  const file = event.target.files?.[0]
  if (!file) return
  uploadingPacking.value = true
  try {
    await packingApi.upload(props.orderId, file)
    await loadPackingList()
  } catch (err) {
    console.error('Failed to upload packing list:', err)
    alert(err.response?.data?.detail || 'Upload failed')
  } finally {
    uploadingPacking.value = false
    event.target.value = ''
  }
}

async function deletePackingList() {
  if (!confirm('Delete packing list? You can re-upload after.')) return
  try {
    await packingApi.delete(props.orderId)
    packingList.value = null
    packingItems.value = []
    selectedForMigration.value = new Set()
    migrationReasons.value = {}
  } catch (err) {
    console.error('Failed to delete packing list:', err)
    alert(err.response?.data?.detail || 'Delete failed')
  }
}

function initManualCreate() {
  const items = (props.order?.items || []).filter(i => i.status === 'ACTIVE')
  manualItems.value = items.map(i => ({
    order_item_id: i.id,
    product_code: i.product_code_snapshot || i.product_code || '',
    product_name: i.product_name_snapshot || i.product_name || '',
    ordered_qty: i.quantity || 0,
    factory_ready_qty: i.quantity || 0,
    package_number: '',
  }))
  showManualCreate.value = true
}

async function submitManualPacking() {
  creatingManual.value = true
  try {
    const items = manualItems.value.map(i => ({
      order_item_id: i.order_item_id,
      factory_ready_qty: i.factory_ready_qty,
      package_number: i.package_number || null,
    }))
    await packingApi.createManual(props.orderId, items)
    showManualCreate.value = false
    await loadPackingList()
  } catch (err) {
    alert(err.response?.data?.detail || 'Failed to create packing list')
  } finally {
    creatingManual.value = false
  }
}

async function updateFactoryReady(item, newValue) {
  const qty = parseInt(newValue)
  if (isNaN(qty) || qty < 0) return
  try {
    const res = await packingApi.updateItem(props.orderId, item.id, { factory_ready_qty: qty })
    item.factory_ready_qty = res.data.factory_ready_qty
    item.loaded_qty = res.data.loaded_qty
    const s = new Set(savedReadyIds.value)
    s.add(item.id)
    savedReadyIds.value = s
    setTimeout(() => {
      const s2 = new Set(savedReadyIds.value)
      s2.delete(item.id)
      savedReadyIds.value = s2
    }, 1500)
  } catch (err) {
    console.error('Failed to update factory ready qty:', err)
  }
}

async function updatePackType(item, packType) {
  // Map dropdown to package_number value for the backend
  let packageValue = ''
  if (packType === 'LOOSE') packageValue = 'BULK'
  else if (packType === 'PALLET') packageValue = item.package_number || '1'
  else packageValue = '' // NOT_PACKED

  try {
    const res = await packingApi.updateItem(props.orderId, item.id, { package_number: packageValue })
    item.package_number = res.data.package_number
    item.packing_status = res.data.packing_status
    // Show save indicator
    const s = new Set(savedPalletIds.value)
    s.add(item.id)
    savedPalletIds.value = s
    setTimeout(() => { const s2 = new Set(savedPalletIds.value); s2.delete(item.id); savedPalletIds.value = s2 }, 1500)
  } catch (err) {
    console.error('Failed to update pack type:', err)
  }
}

function toggleMigration(itemId) {
  // Don't allow selecting balance-only items for migration
  const item = packingItems.value.find(i => i.order_item_id === itemId)
  if (item?.is_balance_only) return
  const s = new Set(selectedForMigration.value)
  if (s.has(itemId)) {
    // Uncheck: deselect only, keep reason so re-checking preserves it
    s.delete(itemId)
  } else {
    // Check: select, set default reason only if none exists yet
    s.add(itemId)
    if (!migrationReasons.value[itemId]) {
      migrationReasons.value = { ...migrationReasons.value, [itemId]: 'NOT_PRODUCED' }
    }
  }
  selectedForMigration.value = s
}

function toggleMigrationSelectAll() {
  const visible = filteredPackingItems.value
  const allSelected = visible.length > 0 && visible.every(i => selectedForMigration.value.has(i.order_item_id))
  const s = new Set(selectedForMigration.value)
  const r = { ...migrationReasons.value }
  if (allSelected) {
    // Deselect all: remove from selection, keep reasons
    for (const item of visible) {
      s.delete(item.order_item_id)
    }
  } else {
    // Select all: add to selection, set default reason only where missing
    for (const item of visible) {
      s.add(item.order_item_id)
      if (!r[item.order_item_id]) r[item.order_item_id] = 'NOT_PRODUCED'
    }
  }
  selectedForMigration.value = s
  migrationReasons.value = r
}

function setItemReason(itemId, reason) {
  const s = new Set(selectedForMigration.value)
  const r = { ...migrationReasons.value }
  if (reason) {
    // Selecting a reason auto-checks the item for migration
    s.add(itemId)
    r[itemId] = reason

    // PALLET-LEVEL AUTO-SELECT: If "NO_SPACE", auto-select all items on the same pallet
    if (reason === 'NO_SPACE') {
      const item = activePackingItems.value.find(i => i.order_item_id === itemId)
      if (item?.package_number && item.package_number !== 'BULK') {
        const palletBuddies = activePackingItems.value.filter(
          i => i.package_number === item.package_number && i.order_item_id !== itemId
        )
        let autoCount = 0
        for (const buddy of palletBuddies) {
          if (!buddy.is_balance_only) {
            s.add(buddy.order_item_id)
            r[buddy.order_item_id] = 'NO_SPACE'
            autoCount++
          }
        }
        // Show inline toast explaining what happened
        if (autoCount > 0) {
          if (palletToastTimeout.value) clearTimeout(palletToastTimeout.value)
          palletToast.value = `Pallet ${item.package_number}: ${autoCount + 1} items auto-selected as "No Space" — entire pallet cannot be loaded`
          palletToastTimeout.value = setTimeout(() => { palletToast.value = '' }, 6000)
        }
      }
    }
  } else {
    // Clearing reason unchecks the item
    s.delete(itemId)
    delete r[itemId]
  }
  selectedForMigration.value = s
  migrationReasons.value = r
}

function setBulkReason(reason) {
  if (!reason) return
  const visibleIds = new Set(filteredPackingItems.value.map(i => i.order_item_id))
  const r = { ...migrationReasons.value }
  for (const id of selectedForMigration.value) {
    if (visibleIds.has(id)) {
      r[id] = reason
    }
  }
  migrationReasons.value = r
}

function confirmMigrate() {
  if (selectedForMigration.value.size === 0) return
  showMigrateDialog.value = true
}

async function migrateItems() {
  showMigrateDialog.value = false
  migrating.value = true
  try {
    const items = Array.from(selectedForMigration.value).map(id => ({
      order_item_id: id,
      reason: migrationReasons.value[id] || 'NOT_PRODUCED',
    }))
    const res = await packingApi.migrateItems(props.orderId, items)
    selectedForMigration.value = new Set()
    migrationReasons.value = {}
    await loadPackingList()
    emit('reload')
    if (res.data.migrated === 0) {
      migrationToast.value = 'No eligible items found for migration'
    } else {
      migrationToast.value = `${res.data.migrated} item(s) migrated successfully`
    }
    setTimeout(() => { migrationToast.value = '' }, 4000)
  } catch (err) {
    console.error('Failed to migrate items:', err)
    alert(err.response?.data?.detail || 'Migration failed')
  } finally {
    migrating.value = false
  }
}

function toggleUndoSelect(itemId) {
  const s = new Set(selectedForUndo.value)
  if (s.has(itemId)) s.delete(itemId)
  else s.add(itemId)
  selectedForUndo.value = s
}

function toggleUndoSelectAll() {
  if (selectedForUndo.value.size === migratedPackingItems.value.length) {
    selectedForUndo.value = new Set()
  } else {
    selectedForUndo.value = new Set(migratedPackingItems.value.map(i => i.order_item_id))
  }
}

function confirmUndo() {
  if (selectedForUndo.value.size === 0) return
  showUndoDialog.value = true
}

async function undoMigration() {
  showUndoDialog.value = false
  undoing.value = true
  try {
    const res = await packingApi.undoMigrate(props.orderId, Array.from(selectedForUndo.value))
    selectedForUndo.value = new Set()
    await loadPackingList()
    emit('reload')
    migrationToast.value = `${res.data.restored} item(s) restored to active`
    setTimeout(() => { migrationToast.value = '' }, 4000)
  } catch (err) {
    console.error('Failed to undo migration:', err)
    alert(err.response?.data?.detail || 'Undo failed')
  } finally {
    undoing.value = false
  }
}

// ========================================
// Split Item Functions
// ========================================
// Manual create: client-side split (before packing list exists)
function splitManualItem(idx) {
  const item = manualItems.value[idx]
  const half = Math.floor(item.factory_ready_qty / 2)
  const rest = item.factory_ready_qty - half
  const row1 = { ...item, factory_ready_qty: half, package_number: '', _isSplit: true, _splitParent: item.order_item_id }
  const row2 = { ...item, factory_ready_qty: rest, package_number: '', _isSplit: true, _splitParent: item.order_item_id }
  // Replace original with two sub-rows
  const newItems = [...manualItems.value]
  newItems.splice(idx, 1, row1, row2)
  manualItems.value = newItems
}

function unsplitManualItem(orderItemId) {
  const splits = manualItems.value.filter(i => i._splitParent === orderItemId)
  if (!splits.length) return
  const totalQty = splits.reduce((s, i) => s + (i.factory_ready_qty || 0), 0)
  // Restore original item
  const restored = { ...splits[0], factory_ready_qty: totalQty, package_number: '', _isSplit: false, _splitParent: undefined }
  manualItems.value = manualItems.value.filter(i => i._splitParent !== orderItemId)
  // Insert at original position
  const insertIdx = manualItems.value.findIndex(i => i.order_item_id === orderItemId)
  if (insertIdx >= 0) {
    manualItems.value = [...manualItems.value.slice(0, insertIdx), restored, ...manualItems.value.slice(insertIdx)]
  } else {
    manualItems.value = [...manualItems.value, restored]
  }
}

// Post-create: server-side split (packing list exists)
function openSplit(item) {
  splitTarget.value = item
  splitRows.value = [
    { qty: Math.floor(item.factory_ready_qty / 2), package_number: '' },
    { qty: item.factory_ready_qty - Math.floor(item.factory_ready_qty / 2), package_number: '' },
  ]
  showSplitDialog.value = true
}

function addSplitRow() {
  splitRows.value = [...splitRows.value, { qty: 0, package_number: '' }]
}

function removeSplitRow(index) {
  splitRows.value = splitRows.value.filter((_, i) => i !== index)
}

async function confirmSplit() {
  const total = splitRows.value.reduce((s, r) => s + (r.qty || 0), 0)
  if (total !== splitTarget.value.factory_ready_qty) {
    alert(`Total (${total}) must equal factory ready qty (${splitTarget.value.factory_ready_qty})`)
    return
  }
  try {
    await packingApi.splitItem(props.orderId, splitTarget.value.id, splitRows.value)
    showSplitDialog.value = false
    await loadPackingList()
  } catch (err) {
    alert(err.response?.data?.detail || 'Split failed')
  }
}

async function unsplitItem(parentId) {
  if (!confirm('Undo split? Sub-rows will be merged back.')) return
  try {
    await packingApi.unsplitItem(props.orderId, parentId)
    await loadPackingList()
  } catch (err) {
    alert(err.response?.data?.detail || 'Unsplit failed')
  }
}

// ========================================
// Shipping Decision Functions
// ========================================
async function setShippingDecision(item, decision) {
  if (decision === 'SHIP_CANCEL_BALANCE') {
    cancelReasonTarget.value = item
    cancelReasonText.value = ''
    showCancelReasonDialog.value = true
    return
  }
  try {
    await packingApi.setDecision(props.orderId, item.id, decision)
    item.shipping_decision = decision
    if (decision === 'WAIT') item.loaded_qty = 0
    else item.loaded_qty = item.factory_ready_qty
    await loadPackingList()
  } catch (err) {
    alert(err.response?.data?.detail || 'Failed to set decision')
  }
}

async function confirmCancelBalance() {
  if (!cancelReasonText.value.trim()) {
    alert('Please provide a reason for cancelling the balance')
    return
  }
  try {
    await packingApi.setDecision(
      props.orderId,
      cancelReasonTarget.value.id,
      'SHIP_CANCEL_BALANCE',
      cancelReasonText.value.trim()
    )
    showCancelReasonDialog.value = false
    await loadPackingList()
  } catch (err) {
    alert(err.response?.data?.detail || 'Failed')
  }
}

function getPackingStatusBadge(status) {
  switch (status) {
    case 'PALLETED': return { bg: 'bg-green-100', text: 'text-green-700', label: 'Palleted' }
    case 'LOOSE': return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Loose' }
    case 'NOT_READY': return { bg: 'bg-red-100', text: 'text-red-700', label: 'Not Ready' }
    default: return { bg: 'bg-slate-100', text: 'text-slate-700', label: status }
  }
}

function getItemTypeBadge(itemType) {
  switch (itemType) {
    case 'carried_forward':
      return { bg: 'bg-amber-100', text: 'text-amber-700', icon: 'pi pi-replay', label: 'Carried Fwd', rowBg: 'bg-amber-50/40' }
    case 'aftersales_replacement':
      return { bg: 'bg-teal-100', text: 'text-teal-700', icon: 'pi pi-sync', label: 'Replacement', rowBg: 'bg-teal-50/40' }
    default:
      return null
  }
}

async function downloadPackingExcel() {
  try {
    const { data } = await packingApi.downloadExcel(props.orderId)
    const blob = new Blob([data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `PackingList_${props.order?.order_number || props.orderId}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Download packing Excel failed:', err)
  }
}

async function downloadPackingPDF() {
  try {
    const { data } = await packingApi.downloadPDF(props.orderId)
    const blob = new Blob([data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `PackingList_${props.order?.order_number || props.orderId}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Download packing PDF failed:', err)
  }
}

const savedPalletIds = ref(new Set())

async function updatePallet(item, newValue) {
  const trimmed = (newValue || '').trim()
  const current = item.package_number || ''
  if (trimmed === current) return
  try {
    // Send empty string (not null) so backend processes removal correctly
    const res = await packingApi.updateItem(props.orderId, item.id, { package_number: trimmed })
    item.package_number = res.data.package_number
    item.packing_status = res.data.packing_status
    if (packingList.value) packingList.value.total_packages = res.data.total_packages
    // Brief saved indicator
    const s = new Set(savedPalletIds.value)
    s.add(item.id)
    savedPalletIds.value = s
    setTimeout(() => {
      const s2 = new Set(savedPalletIds.value)
      s2.delete(item.id)
      savedPalletIds.value = s2
    }, 1500)
  } catch (err) {
    console.error('Failed to update pallet:', err)
  }
}

// ========================================
// Lifecycle
// ========================================
onMounted(() => {
  loadPackingList()
})

watch(() => props.order?.status, () => {
  isEditing.value = false
  selectedForMigration.value = new Set()
  migrationReasons.value = {}
})
</script>

<template>
  <!-- ==========================================
       PACKING LIST & MIGRATION (Level 5B/5C)
       ========================================== -->
  <div v-if="showPackingSection" ref="uploadSectionRef" class="bg-white rounded-xl shadow-sm overflow-hidden border-2 border-purple-200 mb-6">
    <div class="px-6 py-4 border-b border-purple-200 bg-purple-50">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-sm font-semibold text-purple-800 uppercase tracking-wider flex items-center gap-2">
            <i class="pi pi-list text-purple-600" /> Packing List — Plan Packing
          </h3>
          <p class="text-xs text-purple-600 mt-0.5">Upload factory packing list, review items, migrate unloaded items to next order</p>
        </div>
        <div class="flex items-center gap-2">
          <!-- Export buttons (always visible when packing list exists) -->
          <button v-if="packingList" @click="downloadPackingExcel"
            class="px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1">
            <i class="pi pi-file-excel text-xs" /> Excel
          </button>
          <button v-if="packingList" @click="downloadPackingPDF"
            class="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1">
            <i class="pi pi-file-pdf text-xs" /> PDF
          </button>
          <!-- Edit / Done toggle (only at PLAN_PACKING) -->
          <template v-if="isPlanPacking && !isEditing">
            <button @click="isEditing = true"
              class="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1">
              <i class="pi pi-pencil text-[10px]" /> Edit
            </button>
          </template>
          <template v-if="isPlanPacking && isEditing">
            <label class="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 cursor-pointer transition-colors flex items-center gap-2">
              <i class="pi pi-upload text-xs" />
              {{ uploadingPacking ? 'Uploading...' : 'Upload Packing List' }}
              <input type="file" accept=".xlsx,.xls" @change="uploadPackingList" class="hidden" :disabled="uploadingPacking" />
            </label>
            <button v-if="packingList" @click="deletePackingList"
              class="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1">
              <i class="pi pi-trash text-xs" /> Delete
            </button>
            <button @click="isEditing = false; selectedForMigration = new Set(); migrationReasons = {}"
              class="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1">
              <i class="pi pi-check text-[10px]" /> Done
            </button>
          </template>
        </div>
      </div>
    </div>

    <div class="p-6">
      <!-- Packing list summary -->
      <div v-if="packingList" class="mb-4 flex items-center gap-4 text-sm text-slate-600">
        <span>Uploaded: <strong>{{ packingList.uploaded_date }}</strong></span>
        <span>Packages: <strong>{{ packingList.total_packages || 0 }}</strong></span>
      </div>

      <!-- Summary Dashboard -->
      <div v-if="packingList && packingItems.length > 0" class="mb-5">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div class="rounded-lg p-3 bg-slate-50 border border-slate-200">
            <p class="text-[10px] text-slate-400 uppercase tracking-wide">Total Items</p>
            <p class="text-xl font-bold text-slate-700">{{ summaryStats.totalItems }}</p>
          </div>
          <div class="rounded-lg p-3 bg-emerald-50 border border-emerald-200">
            <p class="text-[10px] text-emerald-500 uppercase tracking-wide">Loaded</p>
            <p class="text-xl font-bold text-emerald-700">{{ summaryStats.loadedCount }}</p>
          </div>
          <div class="rounded-lg p-3 bg-amber-50 border border-amber-200">
            <p class="text-[10px] text-amber-500 uppercase tracking-wide">Not Ready</p>
            <p class="text-xl font-bold text-amber-700">{{ summaryStats.notReadyCount }}</p>
          </div>
          <div class="rounded-lg p-3 bg-red-50 border border-red-200">
            <p class="text-[10px] text-red-500 uppercase tracking-wide">Migrated</p>
            <p class="text-xl font-bold text-red-700">{{ summaryStats.migratedCount }}</p>
          </div>
        </div>
        <!-- Progress bar -->
        <div class="flex items-center gap-3">
          <div class="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div class="h-full bg-emerald-500 rounded-full transition-all duration-500" :style="{ width: summaryStats.loadedPercent + '%' }" />
          </div>
          <span class="text-xs font-medium text-slate-600 whitespace-nowrap">{{ summaryStats.loadedPercent }}% loaded ({{ summaryStats.loadedQty }} / {{ summaryStats.totalQty }} qty)</span>
        </div>
      </div>

      <!-- Packing filters + table -->
      <div v-if="packingItems.length > 0">
        <div class="flex items-center gap-3 mb-3">
          <select v-model="packingFilterStatus"
            class="text-xs px-2 py-1.5 border border-slate-300 rounded-lg focus:ring-purple-500 focus:border-purple-500">
            <option value="">All Statuses</option>
            <option value="PALLETED">Palleted</option>
            <option value="LOOSE">Loose</option>
            <option value="NOT_READY">Not Ready</option>
          </select>
          <select v-model="packingFilterPallet"
            class="text-xs px-2 py-1.5 border border-slate-300 rounded-lg focus:ring-purple-500 focus:border-purple-500">
            <option value="">All Pallets</option>
            <option v-for="p in uniquePallets" :key="p" :value="p">Pallet {{ p }}</option>
          </select>
          <span class="text-xs text-slate-400">{{ filteredPackingItems.length }} of {{ activePackingItems.length }} active items<template v-if="balanceOnlyItems.length > 0"> · {{ balanceOnlyItems.length }} balance adj.</template></span>
          <button v-if="packingFilterStatus || packingFilterPallet" @click="packingFilterStatus = ''; packingFilterPallet = ''"
            class="text-xs text-purple-600 hover:text-purple-800 underline">Clear filters</button>
        </div>

        <!-- Bulk actions bar (only at PLAN_PACKING stage, editing mode) -->
        <!-- Pallet auto-select toast -->
        <transition name="fade">
          <div v-if="palletToast" class="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i class="pi pi-info-circle text-blue-600" />
              <span class="text-sm text-blue-800 font-medium">{{ palletToast }}</span>
            </div>
            <button @click="palletToast = ''" class="text-blue-400 hover:text-blue-600"><i class="pi pi-times text-xs" /></button>
          </div>
        </transition>

        <div v-if="isPlanPacking && selectedForMigration.size > 0" class="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
          <span class="text-sm text-amber-800 font-medium">
            {{ selectedForMigration.size }} item(s) selected
          </span>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <label class="text-xs text-amber-700 font-medium">Bulk reason:</label>
              <select @change="setBulkReason($event.target.value); $event.target.value = ''"
                class="text-xs px-2 py-1.5 border border-amber-300 rounded-lg bg-white focus:ring-amber-500">
                <option value="" disabled selected>Apply to all...</option>
                <option value="NOT_PRODUCED">Not Produced</option>
                <option value="NO_SPACE">No Space</option>
              </select>
            </div>
            <button @click="confirmMigrate" :disabled="migrating"
              class="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors">
              {{ migrating ? 'Migrating...' : 'Migrate to Next Order' }}
            </button>
          </div>
        </div>

        <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th v-if="isPlanPacking" class="px-3 py-2 text-center w-10">
                <input type="checkbox"
                  :checked="filteredPackingItems.length > 0 && filteredPackingItems.every(i => selectedForMigration.has(i.order_item_id))"
                  @change="toggleMigrationSelectAll"
                  class="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  title="Select all / Deselect all" />
              </th>
              <th class="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Part Code</th>
              <th class="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Name</th>
              <th class="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase">Ordered</th>
              <th class="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase">Ready</th>
              <th class="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase">Pallet #</th>
              <th class="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase">Status</th>
              <th class="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase">Type</th>
              <th class="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase">Reason</th>
              <th v-if="hasPartialItems" class="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase">Decision</th>
              <th v-if="isPlanPacking && isEditing" class="px-3 py-2 text-center text-xs font-semibold text-slate-600 uppercase w-10">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="item in filteredPackingItems" :key="item.id" class="hover:bg-slate-50"
                :class="item.is_split ? 'bg-purple-50/50' : (selectedForMigration.has(item.order_item_id) ? 'bg-amber-50' : (getItemTypeBadge(item.item_type)?.rowBg || ''))">
              <td v-if="isPlanPacking" class="px-3 py-2 text-center">
                <input type="checkbox"
                  :checked="selectedForMigration.has(item.order_item_id)"
                  @change="toggleMigration(item.order_item_id)"
                  class="rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
              </td>
              <td class="px-3 py-2 font-mono text-xs text-slate-700">{{ item.product_code }}</td>
              <td class="px-3 py-2 text-slate-600 text-xs">{{ item.product_name }}<span v-if="item.is_split" class="ml-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-100 text-purple-600">Split</span></td>
              <td class="px-3 py-2 text-right font-medium">{{ item.ordered_qty }}</td>
              <td class="px-3 py-2 text-right text-xs">
                <template v-if="isPlanPacking && isEditing">
                  <div class="flex items-center justify-end gap-1">
                    <input :value="item.factory_ready_qty" @blur="updateFactoryReady(item, $event.target.value)" @keyup.enter="$event.target.blur()"
                      type="number" min="0" class="w-16 text-right text-xs border border-slate-200 rounded px-1.5 py-0.5 focus:border-purple-400" />
                    <i v-if="savedReadyIds.has(item.id)" class="pi pi-check text-emerald-500 text-[10px]" />
                  </div>
                </template>
                <template v-else>{{ item.factory_ready_qty }}</template>
              </td>
              <td class="px-3 py-2 text-center text-xs">
                <div v-if="isPlanPacking && isEditing" class="flex items-center justify-center gap-1">
                  <select
                    :value="item.packing_status === 'PALLETED' ? 'PALLET' : item.packing_status === 'LOOSE' ? 'LOOSE' : 'NOT_PACKED'"
                    @change="updatePackType(item, $event.target.value)"
                    class="text-xs px-1 py-1 border border-slate-300 rounded focus:ring-purple-500 w-20">
                    <option value="NOT_PACKED">Not Packed</option>
                    <option value="LOOSE">Loose</option>
                    <option value="PALLET">Pallet</option>
                  </select>
                  <input v-if="item.packing_status === 'PALLETED'" type="text"
                    :value="item.package_number || ''"
                    @blur="updatePallet(item, $event.target.value)"
                    @keydown.enter="$event.target.blur()"
                    class="w-12 text-xs text-center px-1 py-1 border rounded focus:ring-1 focus:ring-purple-500 bg-white"
                    :class="savedPalletIds.has(item.id) ? 'border-green-400 bg-green-50' : 'border-slate-300'"
                    placeholder="#" />
                  <i v-if="savedPalletIds.has(item.id)" class="pi pi-check text-green-500 text-[10px]" />
                </div>
                <span v-else>
                  <template v-if="item.packing_status === 'LOOSE'">
                    <span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">Loose</span>
                  </template>
                  <template v-else>{{ item.package_number || '\u2014' }}</template>
                </span>
              </td>
              <td class="px-3 py-2 text-center">
                <span :class="['inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', getPackingStatusBadge(item.packing_status).bg, getPackingStatusBadge(item.packing_status).text]">
                  {{ getPackingStatusBadge(item.packing_status).label }}
                </span>
              </td>
              <td class="px-3 py-2 text-center">
                <span v-if="getItemTypeBadge(item.item_type)"
                  :class="['inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium', getItemTypeBadge(item.item_type).bg, getItemTypeBadge(item.item_type).text]"
                  :title="item.notes || ''">
                  <i :class="[getItemTypeBadge(item.item_type).icon, 'text-[9px]']" />
                  {{ getItemTypeBadge(item.item_type).label }}
                </span>
                <span v-else class="text-slate-300">&mdash;</span>
              </td>
              <td class="px-3 py-2 text-center">
                <template v-if="isPlanPacking">
                  <select
                    :value="migrationReasons[item.order_item_id] || ''"
                    @change="setItemReason(item.order_item_id, $event.target.value)"
                    class="text-xs px-2 py-1 border rounded focus:ring-purple-500"
                    :class="selectedForMigration.has(item.order_item_id) ? 'border-amber-400 bg-amber-50' : 'border-slate-300'">
                    <option value="">—</option>
                    <option value="NOT_PRODUCED">Not Produced</option>
                    <option value="NO_SPACE">No Space</option>
                  </select>
                </template>
                <template v-else>
                  <span class="text-slate-400">&mdash;</span>
                </template>
              </td>
              <!-- Decision column (partial items only) -->
              <td v-if="hasPartialItems" class="px-3 py-2 text-center">
                <template v-if="isPlanPacking && isEditing && isPartiallyReady(item)">
                  <select
                    :value="item.shipping_decision || ''"
                    @change="setShippingDecision(item, $event.target.value)"
                    class="text-xs px-2 py-1 border rounded"
                    :class="{
                      'border-amber-400 bg-amber-50': item.shipping_decision === 'SHIP_CARRY_FORWARD',
                      'border-red-400 bg-red-50': item.shipping_decision === 'SHIP_CANCEL_BALANCE',
                      'border-blue-400 bg-blue-50': item.shipping_decision === 'WAIT',
                    }">
                    <option value="">— Decide —</option>
                    <option value="SHIP_CARRY_FORWARD">Ship + Carry Forward</option>
                    <option value="SHIP_CANCEL_BALANCE">Ship + Cancel Balance</option>
                    <option value="WAIT">Wait for Full</option>
                  </select>
                  <div class="text-[9px] text-slate-400 mt-0.5">
                    Ready: {{ item.factory_ready_qty }} / {{ item.ordered_qty }}
                  </div>
                </template>
                <template v-else-if="item.shipping_decision">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
                    :class="{
                      'bg-amber-100 text-amber-700': item.shipping_decision === 'SHIP_CARRY_FORWARD',
                      'bg-red-100 text-red-700': item.shipping_decision === 'SHIP_CANCEL_BALANCE',
                      'bg-blue-100 text-blue-700': item.shipping_decision === 'WAIT',
                    }">
                    {{ item.shipping_decision === 'SHIP_CARRY_FORWARD' ? 'Ship + Carry Forward' : item.shipping_decision === 'SHIP_CANCEL_BALANCE' ? 'Ship + Cancel' : 'Waiting' }}
                  </span>
                  <div class="text-[9px] text-slate-400 mt-0.5">
                    Ready: {{ item.factory_ready_qty }} / {{ item.ordered_qty }}
                  </div>
                </template>
                <template v-else>
                  <span class="text-slate-300">&mdash;</span>
                </template>
              </td>
              <!-- Actions column -->
              <td v-if="isPlanPacking && isEditing" class="px-3 py-2 text-center">
                <button v-if="!item.is_split && item.packing_status !== 'SPLIT'"
                  @click="openSplit(item)"
                  class="text-purple-500 hover:text-purple-700" title="Split across pallets">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M16 3h5v5"/><path d="M21 3l-7 7"/><path d="M16 21h5v-5"/><path d="M21 21l-7-7"/><path d="M3 12h12"/></svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        </div>

        <!-- Balance-only items (COMPENSATION - read-only) -->
        <div v-if="balanceOnlyItems.length > 0" class="mt-4">
          <h4 class="text-xs font-semibold text-indigo-700 uppercase tracking-wider flex items-center gap-2 mb-2">
            <i class="pi pi-wallet text-indigo-500" /> Balance Adjustments ({{ balanceOnlyItems.length }})
            <span class="text-[10px] font-normal text-indigo-400 normal-case">Read-only — ledger reference only, not physical items</span>
          </h4>
          <div class="overflow-x-auto border border-indigo-200 rounded-lg bg-indigo-50/30">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-indigo-50 border-b border-indigo-200">
                  <th class="px-3 py-2 text-left text-xs font-semibold text-indigo-600 uppercase">Part Code</th>
                  <th class="px-3 py-2 text-left text-xs font-semibold text-indigo-600 uppercase">Name</th>
                  <th class="px-3 py-2 text-right text-xs font-semibold text-indigo-600 uppercase">Qty</th>
                  <th class="px-3 py-2 text-right text-xs font-semibold text-indigo-600 uppercase">Balance</th>
                  <th class="px-3 py-2 text-center text-xs font-semibold text-indigo-600 uppercase">Type</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-indigo-100">
                <tr v-for="item in balanceOnlyItems" :key="item.id" class="bg-indigo-50/50">
                  <td class="px-3 py-2 font-mono text-xs text-indigo-600">{{ item.product_code }}</td>
                  <td class="px-3 py-2 text-indigo-600 text-xs">{{ item.product_name }}</td>
                  <td class="px-3 py-2 text-right font-medium text-indigo-700">{{ item.ordered_qty }}</td>
                  <td class="px-3 py-2 text-right font-medium text-red-600">
                    {{ item.selling_price_inr != null ? (item.selling_price_inr * item.ordered_qty).toLocaleString('en-IN', { style: 'currency', currency: 'INR' }) : '—' }}
                  </td>
                  <td class="px-3 py-2 text-center">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                      <i class="pi pi-lock text-[10px] mr-1" /> Compensation
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Success toast -->
      <div v-if="migrationToast" class="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-sm text-green-800">
        <i class="pi pi-check-circle text-green-600" />
        <span class="font-medium">{{ migrationToast }}</span>
      </div>

      <!-- Migrated items table -->
      <div v-if="migratedPackingItems.length > 0 || carryForwardItems.length > 0" class="mt-6">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-xs font-semibold text-red-700 uppercase tracking-wider flex items-center gap-2">
            <i class="pi pi-ban text-red-500" /> Migrated / Unloaded Items ({{ migratedPackingItems.length + carryForwardItems.length }})
          </h4>
          <div v-if="isPlanPacking && selectedForUndo.size > 0" class="flex items-center gap-2">
            <span class="text-xs text-slate-500">{{ selectedForUndo.size }} selected</span>
            <button @click="confirmUndo"
              class="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1">
              <i class="pi pi-replay text-[10px]" /> Restore to Active
            </button>
          </div>
        </div>
        <div class="overflow-x-auto border border-red-200 rounded-lg bg-red-50/30">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-red-50 border-b border-red-200">
                <th v-if="isPlanPacking" class="px-3 py-2 text-center w-10">
                  <input type="checkbox"
                    :checked="migratedPackingItems.length > 0 && selectedForUndo.size === migratedPackingItems.length"
                    @change="toggleUndoSelectAll"
                    class="rounded border-red-300 text-red-600 focus:ring-red-500" />
                </th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-red-600 uppercase">Part Code</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-red-600 uppercase">Name</th>
                <th class="px-3 py-2 text-right text-xs font-semibold text-red-600 uppercase">Qty</th>
                <th class="px-3 py-2 text-center text-xs font-semibold text-red-600 uppercase">Type</th>
                <th class="px-3 py-2 text-center text-xs font-semibold text-red-600 uppercase">Reason</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-red-100">
              <tr v-for="item in migratedPackingItems" :key="item.id"
                  class="hover:bg-red-50" :class="selectedForUndo.has(item.order_item_id) ? 'bg-emerald-50' : ''">
                <td v-if="isPlanPacking" class="px-3 py-2 text-center">
                  <input type="checkbox"
                    :checked="selectedForUndo.has(item.order_item_id)"
                    @change="toggleUndoSelect(item.order_item_id)"
                    class="rounded border-red-300 text-red-600 focus:ring-red-500" />
                </td>
                <td class="px-3 py-2 font-mono text-xs text-red-400 line-through">{{ item.product_code }}</td>
                <td class="px-3 py-2 text-red-400 text-xs line-through">{{ item.product_name }}</td>
                <td class="px-3 py-2 text-right font-medium text-red-400">{{ item.ordered_qty }}</td>
                <td class="px-3 py-2 text-center">
                  <span v-if="getItemTypeBadge(item.item_type)"
                    :class="['inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium', getItemTypeBadge(item.item_type).bg, getItemTypeBadge(item.item_type).text]"
                    :title="item.notes || ''">
                    <i :class="[getItemTypeBadge(item.item_type).icon, 'text-[9px]']" />
                    {{ getItemTypeBadge(item.item_type).label }}
                  </span>
                  <span v-else class="text-red-300">&mdash;</span>
                </td>
                <td class="px-3 py-2 text-center">
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                    {{ item.cancel_note?.replace('Migrated: ', '') || 'Unloaded' }}
                  </span>
                </td>
              </tr>
              <!-- Carry-forward items from partial shipping decisions -->
              <tr v-for="cf in carryForwardItems" :key="'cf-' + cf.id"
                  class="hover:bg-amber-50 bg-amber-50/30">
                <td v-if="isPlanPacking" class="px-3 py-2 text-center"></td>
                <td class="px-3 py-2 font-mono text-xs text-amber-600">{{ cf.product_code }}</td>
                <td class="px-3 py-2 text-amber-600 text-xs">{{ cf.product_name }}</td>
                <td class="px-3 py-2 text-right font-medium text-amber-600">{{ cf.quantity }}</td>
                <td class="px-3 py-2 text-center">
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                    <i class="pi pi-arrow-right text-[8px] mr-0.5" /> Carry Forward
                  </span>
                </td>
                <td class="px-3 py-2 text-center">
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                    {{ cf.reason }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty state: Two options -->
      <div v-if="!packingList && packingItems.length === 0 && isPlanPacking && !showManualCreate" class="py-8">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <!-- Option 1: Upload Excel -->
          <label class="border-2 border-dashed border-purple-200 rounded-xl p-6 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 transition-all group">
            <i class="pi pi-upload text-3xl text-purple-300 group-hover:text-purple-500 mb-3 block" />
            <p class="font-semibold text-purple-700 text-sm">Upload Excel</p>
            <p class="text-xs text-purple-400 mt-1">Import factory packing list from Excel file</p>
            <input type="file" accept=".xlsx,.xls" @change="uploadPackingList" class="hidden" :disabled="uploadingPacking" />
          </label>
          <!-- Option 2: Create Manually -->
          <button @click="initManualCreate"
            class="border-2 border-dashed border-emerald-200 rounded-xl p-6 text-center hover:border-emerald-400 hover:bg-emerald-50/50 transition-all group">
            <i class="pi pi-pencil text-3xl text-emerald-300 group-hover:text-emerald-500 mb-3 block" />
            <p class="font-semibold text-emerald-700 text-sm">Create Manually</p>
            <p class="text-xs text-emerald-400 mt-1">Set factory ready qty and pallet for each item</p>
          </button>
        </div>
      </div>

      <!-- Manual Creation Form -->
      <div v-if="showManualCreate" class="py-4">
        <div class="flex items-center justify-between mb-4">
          <h4 class="font-semibold text-slate-700">Manual Packing List</h4>
          <div class="flex items-center gap-2">
            <button @click="showManualCreate = false" class="px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button @click="submitManualPacking" :disabled="creatingManual"
              class="px-4 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1">
              <i :class="creatingManual ? 'pi pi-spinner pi-spin' : 'pi pi-check'" class="text-[10px]" />
              {{ creatingManual ? 'Creating...' : 'Create Packing List' }}
            </button>
          </div>
        </div>
        <div class="overflow-x-auto border border-slate-200 rounded-lg">
          <table class="w-full text-sm">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Part Code</th>
                <th class="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Name</th>
                <th class="px-3 py-2 text-right text-xs font-semibold text-slate-500 uppercase w-20">Ordered</th>
                <th class="px-3 py-2 text-center text-xs font-semibold text-slate-500 uppercase w-28">Factory Ready</th>
                <th class="px-3 py-2 text-center text-xs font-semibold text-slate-500 uppercase w-28">Pallet #</th>
                <th class="px-3 py-2 text-center text-xs font-semibold text-slate-500 uppercase w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, idx) in manualItems" :key="item.order_item_id + '-' + idx"
                class="border-t border-slate-100 hover:bg-slate-50/50"
                :class="item._isSplit ? 'bg-purple-50/50' : ''">
                <td class="px-3 py-2 font-mono text-xs text-slate-600">
                  {{ item.product_code }}
                  <span v-if="item._isSplit" class="ml-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-100 text-purple-600">Split</span>
                </td>
                <td class="px-3 py-2 text-xs text-slate-700">{{ item.product_name }}</td>
                <td class="px-3 py-2 text-right text-xs font-medium">{{ item.ordered_qty }}</td>
                <td class="px-3 py-2 text-center">
                  <input v-model.number="item.factory_ready_qty" type="number" min="0" :max="item.ordered_qty * 2"
                    class="w-20 text-center text-xs border border-slate-200 rounded px-2 py-1 focus:border-purple-400 focus:ring-1 focus:ring-purple-200" />
                </td>
                <td class="px-3 py-2 text-center">
                  <input v-model="item.package_number" type="text" placeholder="e.g. 1"
                    class="w-20 text-center text-xs border border-slate-200 rounded px-2 py-1 focus:border-purple-400 focus:ring-1 focus:ring-purple-200" />
                </td>
                <td class="px-3 py-2 text-center">
                  <button v-if="!item._isSplit" @click="splitManualItem(idx)"
                    class="text-purple-500 hover:text-purple-700" title="Split across pallets">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="w-3.5 h-3.5"><path d="M16 3h5v5"/><path d="M21 3l-7 7"/><path d="M16 21h5v-5"/><path d="M21 21l-7-7"/><path d="M3 12h12"/></svg>
                  </button>
                  <button v-else @click="unsplitManualItem(item.order_item_id)"
                    class="text-red-400 hover:text-red-600" title="Merge back">
                    <i class="pi pi-replay text-xs" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- Migrate Confirmation Dialog -->
  <div v-if="showMigrateDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div class="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
          <i class="pi pi-exclamation-triangle text-amber-600" />
        </div>
        <h3 class="text-lg font-semibold text-slate-800">Confirm Migration</h3>
      </div>
      <p class="text-sm text-slate-600 mb-6">
        Migrate <strong class="text-amber-700">{{ selectedForMigration.size }} item(s)</strong> to unloaded?
        They will be carried forward to the next order with the same client &amp; factory.
      </p>
      <div class="flex justify-end gap-3">
        <button @click="showMigrateDialog = false"
          class="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
          Cancel
        </button>
        <button @click="migrateItems" :disabled="migrating"
          class="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors">
          {{ migrating ? 'Migrating...' : 'Yes, Migrate' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Undo Migration Dialog -->
  <div v-if="showUndoDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div class="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
          <i class="pi pi-replay text-emerald-600" />
        </div>
        <h3 class="text-lg font-semibold text-slate-800">Restore Items</h3>
      </div>
      <p class="text-sm text-slate-600 mb-6">
        Restore <strong class="text-emerald-700">{{ selectedForUndo.size }} item(s)</strong> back to active?
        They will be removed from the unloaded list.
      </p>
      <div class="flex justify-end gap-3">
        <button @click="showUndoDialog = false"
          class="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">
          Cancel
        </button>
        <button @click="undoMigration" :disabled="undoing"
          class="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
          {{ undoing ? 'Restoring...' : 'Yes, Restore' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Split Dialog -->
  <div v-if="showSplitDialog" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
    <div class="bg-white rounded-xl shadow-xl p-6 w-[500px] max-w-[90vw]">
      <h3 class="font-bold text-lg text-slate-800 mb-1">Split Item Across Pallets</h3>
      <p class="text-sm text-slate-500 mb-4">
        {{ splitTarget?.product_code }} — Total: {{ splitTarget?.factory_ready_qty }} qty
      </p>

      <div v-for="(row, i) in splitRows" :key="i" class="flex items-center gap-3 mb-3">
        <span class="text-xs text-slate-400 w-8">{{ i + 1 }}.</span>
        <input v-model.number="row.qty" type="number" min="1"
          class="w-24 text-sm border rounded px-2 py-1.5 focus:ring-purple-500" placeholder="Qty" />
        <input v-model="row.package_number" type="text"
          class="w-24 text-sm border rounded px-2 py-1.5 focus:ring-purple-500" placeholder="Pallet #" />
        <button v-if="splitRows.length > 2" @click="removeSplitRow(i)" class="text-red-400 hover:text-red-600">
          <i class="pi pi-trash text-xs" />
        </button>
      </div>

      <button @click="addSplitRow" class="text-xs text-purple-600 hover:underline mb-4">+ Add row</button>

      <div class="flex justify-between items-center pt-4 border-t">
        <span class="text-xs" :class="splitRows.reduce((s,r) => s + (r.qty||0), 0) === splitTarget?.factory_ready_qty ? 'text-green-600' : 'text-red-500'">
          Total: {{ splitRows.reduce((s,r) => s + (r.qty||0), 0) }} / {{ splitTarget?.factory_ready_qty }}
        </span>
        <div class="flex gap-2">
          <button @click="showSplitDialog = false" class="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
          <button @click="confirmSplit" class="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700">Split</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Cancel Balance Confirmation -->
  <div v-if="showCancelReasonDialog" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
    <div class="bg-white rounded-xl shadow-xl p-6 w-[450px]">
      <div class="flex items-center gap-2 mb-3">
        <i class="pi pi-exclamation-triangle text-red-500 text-lg" />
        <h3 class="font-bold text-red-700">Cancel Balance — Irreversible</h3>
      </div>
      <p class="text-sm text-slate-600 mb-2">
        This will permanently reduce <strong>{{ cancelReasonTarget?.product_code }}</strong>
        from {{ cancelReasonTarget?.ordered_qty }} to {{ cancelReasonTarget?.factory_ready_qty }} qty.
      </p>
      <p class="text-xs text-red-600 mb-3">The Final PI will be recalculated on the reduced quantity.</p>
      <textarea v-model="cancelReasonText" rows="3" placeholder="Reason for cancelling balance (required)..."
        class="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-red-500 focus:border-red-500" />
      <div class="flex justify-end gap-2 mt-4">
        <button @click="showCancelReasonDialog = false" class="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
        <button @click="confirmCancelBalance"
          :disabled="!cancelReasonText.trim()"
          class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40">
          Confirm Cancel Balance
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.saved-check {
  animation: fade-in-out 1.5s ease-out forwards;
}
@keyframes fade-in-out {
  0% { opacity: 0; transform: scale(0.5); }
  15% { opacity: 1; transform: scale(1.2); }
  30% { transform: scale(1); }
  80% { opacity: 1; }
  100% { opacity: 0; }
}
.highlight-flash {
  animation: flash-highlight 2.5s ease-out;
}
@keyframes flash-highlight {
  0%, 15% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.5); }
  100% { box-shadow: 0 0 0 0 transparent; }
}
</style>
