<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { excelApi, ordersApi, productsApi } from '../../api'
import ColumnMappingDialog from '../../components/common/ColumnMappingDialog.vue'
import ConflictResolutionPanel from '../../components/orders/ConflictResolutionPanel.vue'
import ParsedResultsTable from '../../components/orders/ParsedResultsTable.vue'
import { useConflictAnalysis } from '../../composables/useConflictAnalysis'

const route = useRoute()
const router = useRouter()
const orderId = route.params.id || null
const pendingOnly = route.query.pending_only === 'true'

// State
const order = ref(null)
const pendingProductCodes = ref(new Set())
const loading = ref(true)
const dragOver = ref(false)
const selectedFile = ref(null)
const jobType = ref('CLIENT_EXCEL')

// Upload state
const uploading = ref(false)
const uploadProgress = ref(0)

// Processing state
const jobId = ref(null)
const jobStatus = ref(null)
const polling = ref(null)

// Results
const results = ref(null)
const applying = ref(false)
const applied = ref(null)
const restoring = ref(false)

// Bulk selection
const selectedRows = ref(new Set())
const selectAll = ref(false)

// Duplicate code resolution choices
const duplicateResolutions = ref({})
const imageConflictResolutions = ref({})
const variantResolutions = ref({})
const rowOverrides = ref({})

// Image viewer lightbox with scroll-zoom + drag-pan
const viewerImage = ref(null)
const viewerLabel = ref('')
const viewerZoom = ref(1)
const viewerPan = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })

function openImageViewer(url, label) {
  viewerImage.value = url
  viewerLabel.value = label || ''
  viewerZoom.value = 1
  viewerPan.value = { x: 0, y: 0 }
  window.addEventListener('keydown', onViewerKeydown)
}

function closeImageViewer() {
  viewerImage.value = null
  isDragging.value = false
  window.removeEventListener('keydown', onViewerKeydown)
}

function onViewerKeydown(e) {
  if (e.key === 'Escape') closeImageViewer()
}

function onViewerWheel(e) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.15 : 0.15
  viewerZoom.value = Math.min(Math.max(viewerZoom.value + delta, 0.25), 8)
}

function onViewerMouseDown(e) {
  if (viewerZoom.value <= 1) return
  isDragging.value = true
  dragStart.value = { x: e.clientX - viewerPan.value.x, y: e.clientY - viewerPan.value.y }
}

function onViewerMouseMove(e) {
  if (!isDragging.value) return
  viewerPan.value = { x: e.clientX - dragStart.value.x, y: e.clientY - dragStart.value.y }
}

function onViewerMouseUp() { isDragging.value = false }

function zoomIn() { viewerZoom.value = Math.min(viewerZoom.value + 0.25, 8) }
function zoomOut() { viewerZoom.value = Math.max(viewerZoom.value - 0.25, 0.25) }
function resetZoom() { viewerZoom.value = 1; viewerPan.value = { x: 0, y: 0 } }

// Processed state
const processed = ref(false)
const processedResults = ref(null)

// AI Column Mapping
const showMappingDialog = ref(false)
const mappingResult = ref(null)
const analyzingColumns = ref(false)

// Conflict panel sorting
const conflictSortBy = ref('code')

// Results table filter after processing
const resultsFilter = ref('all')

// Conflict analysis composable
const {
  aiResolutions,
  analyzingConflicts,
  aiResolutionSource,
  aiStats,
  triggerAiConflictAnalysis,
} = useConflictAnalysis(results, variantResolutions, conflictGroups)

// Whether we're in "Products page" mode (no order context)
const isProductMode = computed(() => !orderId)
const isFactoryExcel = computed(() => jobType.value === 'FACTORY_EXCEL')
const isProcessing = computed(() =>
  jobStatus.value && ['PENDING', 'PROCESSING'].includes(jobStatus.value.status)
)

// Load order info
async function loadOrder() {
  if (!orderId) {
    loading.value = false
    return
  }
  try {
    const { data } = await ordersApi.get(orderId)
    order.value = data
    // Build set of pending item product codes for filtering
    if (pendingOnly && data.items) {
      pendingProductCodes.value = new Set(
        data.items
          .filter(i => i.status === 'ACTIVE' && i.pi_item_status === 'PENDING')
          .map(i => i.product_code)
      )
    }
  } catch (_e) {
    // silently ignore load error
  } finally {
    loading.value = false
  }
}
loadOrder()

// File handling
function onDrop(e) {
  dragOver.value = false
  const files = e.dataTransfer?.files
  if (files?.length) selectFile(files[0])
}

function onFileInput(e) {
  if (e.target.files?.length) selectFile(e.target.files[0])
}

function selectFile(file) {
  if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
    alert('Please select an Excel file (.xlsx or .xls)')
    return
  }
  selectedFile.value = file
  jobId.value = null
  jobStatus.value = null
  results.value = null
  applied.value = null
  selectedRows.value = new Set()
  selectAll.value = false
}

function formatSize(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Upload
async function startUpload() {
  if (!selectedFile.value) return
  uploading.value = true
  uploadProgress.value = 0
  const useAiMapping = jobType.value === 'FACTORY_EXCEL'

  try {
    const { data } = await excelApi.upload(
      selectedFile.value, orderId, jobType.value,
      (e) => { if (e.total) uploadProgress.value = Math.round((e.loaded / e.total) * 100) },
      useAiMapping,
    )
    jobId.value = data.id
    jobStatus.value = data
    uploading.value = false

    if (useAiMapping && data.file_path) {
      await analyzeColumnsFlow(data.file_path)
    } else {
      startPolling()
    }
  } catch (e) {
    uploading.value = false
    alert('Upload failed: ' + (e.response?.data?.detail || e.message))
  }
}

// AI Column Mapping Flow
async function analyzeColumnsFlow(filePath) {
  analyzingColumns.value = true
  try {
    const { data } = await excelApi.analyzeColumns(filePath, 'product')
    mappingResult.value = data
    if (!data.needs_review?.length) {
      await excelApi.reparseJob(jobId.value, data.confirmed)
      startPolling()
    } else {
      showMappingDialog.value = true
    }
  } catch (_e) {
    await excelApi.reparseJob(jobId.value)
    startPolling()
  } finally {
    analyzingColumns.value = false
  }
}

async function onMappingConfirm(finalMapping) {
  showMappingDialog.value = false
  try {
    await excelApi.reparseJob(jobId.value, finalMapping)
    startPolling()
  } catch (e) {
    alert('Failed to start processing: ' + (e.response?.data?.detail || e.message))
  }
}

async function onMappingSkip() {
  showMappingDialog.value = false
  try {
    await excelApi.reparseJob(jobId.value)
    startPolling()
  } catch (e) {
    alert('Failed to start processing: ' + (e.response?.data?.detail || e.message))
  }
}

// Polling
function startPolling() {
  polling.value = setInterval(async () => {
    try {
      const { data } = await excelApi.getJob(jobId.value)
      jobStatus.value = data
      if (data.status === 'COMPLETED' || data.status === 'FAILED') {
        stopPolling()
        if (data.status === 'COMPLETED') {
          onJobCompleted(data)
        }
      }
    } catch (_e) {
      stopPolling()
    }
  }, 2000)
}

function stopPolling() {
  if (polling.value) {
    clearInterval(polling.value)
    polling.value = null
  }
}

onBeforeUnmount(() => stopPolling())

function onJobCompleted(data) {
  // Filter to only pending item matches when uploading from Pending Additions
  if (pendingOnly && pendingProductCodes.value.size > 0 && data.result_data) {
    data = {
      ...data,
      result_data: data.result_data.filter(row =>
        pendingProductCodes.value.has(row.manufacturer_code)
      ),
    }
    // Recalculate summary counts
    const filtered = data.result_data
    data.result_summary = {
      ...data.result_summary,
      total_rows: filtered.length,
      matched: filtered.filter(r => r.match_status === 'MATCHED').length,
      new_products: filtered.filter(r => r.match_status === 'NEW_PRODUCT').length,
      images_extracted: filtered.filter(r => r.thumbnail_url).length,
    }
  }
  results.value = data
  autoSelectProblematicRows(data)

  if (data.result_summary?.duplicate_codes) {
    const resolutions = {}
    data.result_summary.duplicate_codes.forEach(dup => { resolutions[dup.code] = 'keep_first' })
    duplicateResolutions.value = resolutions
  }

  if (data.result_summary?.image_conflicts) {
    const resolutions = {}
    data.result_summary.image_conflicts.forEach(conflict => { resolutions[conflict.product_id] = 'replace' })
    imageConflictResolutions.value = resolutions
  }

  if (data.result_data) {
    const vRes = {}
    data.result_data.forEach((row, idx) => {
      if (row.match_status === 'NEW_VARIANT' && row.existing_variants?.length > 0) {
        vRes[String(idx)] = { action: 'add_new', replace_id: null }
      }
    })
    const dupCodes = data.result_summary?.duplicate_codes || []
    dupCodes.forEach(dup => {
      dup.indices.forEach(idx => {
        if (!vRes[String(idx)]) {
          vRes[String(idx)] = { action: 'add_new', replace_id: null }
        }
      })
    })
    variantResolutions.value = vRes
    triggerAiConflictAnalysis()
  }

  processed.value = false
  processedResults.value = null
  rowOverrides.value = {}
}

function autoSelectProblematicRows(data) {
  if (!data?.result_data) return
  const problemRows = new Set()
  data.result_data.forEach((row, idx) => {
    if (row.match_status === 'DUPLICATE' || row.match_status === 'AMBIGUOUS') {
      problemRows.add(idx)
    }
  })
  if (problemRows.size > 0) {
    selectedRows.value = problemRows
    selectAll.value = problemRows.size === data.result_data.length
  }
}

const duplicateCount = computed(() => {
  if (!results.value?.result_data) return 0
  return results.value.result_data.filter(
    r => r.match_status === 'DUPLICATE' || r.match_status === 'AMBIGUOUS'
  ).length
})

// Apply results
async function applyToOrder() {
  if (!jobId.value) return
  applying.value = true
  try {
    const { data } = await excelApi.applyParsedData(jobId.value, {
      job_id: jobId.value,
      create_new_products: true,
      duplicate_resolutions: duplicateResolutions.value,
      image_conflict_resolutions: imageConflictResolutions.value,
      variant_resolutions: variantResolutions.value,
      row_overrides: rowOverrides.value,
    })
    applied.value = data
  } catch (e) {
    alert('Apply failed: ' + (e.response?.data?.detail || e.message))
  } finally {
    applying.value = false
  }
}

// Process resolutions
function processResolutions() {
  if (!results.value?.result_data) return

  const resolvedData = results.value.result_data.map((row, idx) => {
    const resolution = variantResolutions.value[String(idx)]
    const override = rowOverrides.value[String(idx)]
    const newRow = { ...row, _originalIdx: idx }

    if (override) {
      Object.keys(override).forEach(key => {
        if (override[key] !== null && override[key] !== undefined) {
          newRow[key] = override[key]
        }
      })
    }

    if (resolution) {
      if (resolution.action === 'duplicate') newRow._resolved = 'SKIP_DUPLICATE'
      else if (resolution.action === 'replace') {
        newRow._resolved = 'REPLACE'
        newRow._replaceTarget = resolution.replace_id
      } else {
        newRow._resolved = 'ADD_VARIANT'
      }
    }

    return newRow
  })

  const summary = { matched: 0, new_products: 0, new_variants: 0, skipped_duplicates: 0, no_price: 0, images_extracted: 0 }
  resolvedData.forEach(row => {
    if (row._resolved === 'SKIP_DUPLICATE') { summary.skipped_duplicates++; return }
    if (row.match_status === 'MATCHED') summary.matched++
    else if (row.match_status === 'NEW_PRODUCT') summary.new_products++
    else if (row.match_status === 'NEW_VARIANT') {
      if (row._resolved === 'REPLACE') summary.matched++
      else summary.new_variants++
    }
    if (row.factory_price_usd == null) summary.no_price++
    if (row.has_image) summary.images_extracted++
  })

  processedResults.value = {
    ...results.value,
    result_data: resolvedData,
    result_summary: { ...results.value.result_summary, ...summary },
  }
  processed.value = true
  resultsFilter.value = 'all'

  const stillSelectable = new Set()
  selectedRows.value.forEach(idx => {
    const row = resolvedData[idx]
    if (row && row._resolved !== 'SKIP_DUPLICATE' && row._resolved !== 'REPLACE') {
      stillSelectable.add(idx)
    }
  })
  selectedRows.value = stillSelectable
  selectAll.value = false
}

function isRowResolved(idx) {
  const displayData = processed.value ? processedResults.value?.result_data : results.value?.result_data
  if (!displayData?.[idx]) return false
  const row = displayData[idx]
  return row._resolved === 'SKIP_DUPLICATE' || row._resolved === 'REPLACE'
}

const processedSummary = computed(() => {
  if (!processed.value || !processedResults.value?.result_data) return null
  const data = processedResults.value.result_data
  return {
    skipped: data.filter(r => r._resolved === 'SKIP_DUPLICATE').length,
    replaced: data.filter(r => r._resolved === 'REPLACE').length,
    variants: data.filter(r => r._resolved === 'ADD_VARIANT').length,
    newProducts: data.filter(r => !r._resolved && r.match_status === 'NEW_PRODUCT').length,
    total: data.length,
  }
})

const filteredResultsData = computed(() => {
  const source = processed.value ? processedResults.value?.result_data : results.value?.result_data
  if (!source) return []
  if (!processed.value || resultsFilter.value === 'all') return source
  return source.filter(row => {
    switch (resultsFilter.value) {
      case 'skipped': return row._resolved === 'SKIP_DUPLICATE'
      case 'replace': return row._resolved === 'REPLACE'
      case 'variant': return row._resolved === 'ADD_VARIANT'
      case 'new': return !row._resolved && row.match_status === 'NEW_PRODUCT'
      default: return true
    }
  })
})

const selectableRowIndices = computed(() => {
  const data = processed.value ? processedResults.value?.result_data : results.value?.result_data
  if (!data) return []
  return data.map((_, idx) => idx).filter(idx => !isRowResolved(idx))
})

function toggleSelectAll() {
  if (selectAll.value) {
    selectedRows.value = new Set()
    selectAll.value = false
  } else {
    selectedRows.value = new Set(selectableRowIndices.value)
    selectAll.value = true
  }
}

function toggleRow(idx) {
  if (isRowResolved(idx)) return
  const newSet = new Set(selectedRows.value)
  if (newSet.has(idx)) newSet.delete(idx)
  else newSet.add(idx)
  selectedRows.value = newSet
  selectAll.value = selectableRowIndices.value.length > 0 &&
    selectableRowIndices.value.every(i => newSet.has(i))
}

function deleteSelected() {
  if (selectedRows.value.size === 0) return
  const remaining = results.value.result_data.filter((_, idx) => !selectedRows.value.has(idx))
  results.value = { ...results.value, result_data: remaining }
  const summary = { matched: 0, new_products: 0, new_variants: 0, duplicates: 0, ambiguous: 0, no_price: 0, images_extracted: 0, errors: 0 }
  remaining.forEach(row => {
    if (row.match_status === 'MATCHED') summary.matched++
    else if (row.match_status === 'NEW_PRODUCT') summary.new_products++
    else if (row.match_status === 'NEW_VARIANT') summary.new_variants++
    else if (row.match_status === 'DUPLICATE') summary.duplicates++
    else if (row.match_status === 'AMBIGUOUS') summary.ambiguous++
    if (row.factory_price_usd == null && row.factory_price_usd !== undefined) summary.no_price++
    if (row.has_image) summary.images_extracted++
  })
  results.value.result_summary = summary
  selectedRows.value = new Set()
  selectAll.value = false
}

// Computed helpers
const backRoute = computed(() => orderId ? `/orders/${orderId}` : '/products')

const summaryItems = computed(() => {
  if (!results.value?.result_summary) return []
  const s = results.value.result_summary
  return [
    { label: 'Matched', value: s.matched || 0, color: 'text-green-600' },
    { label: 'New Products', value: s.new_products || 0, color: 'text-blue-600' },
    { label: 'New Variants', value: s.new_variants || 0, color: 'text-purple-600' },
    { label: 'Dup Codes', value: s.duplicate_code_count || 0, color: 'text-orange-600' },
    { label: 'Ambiguous', value: s.ambiguous || 0, color: 'text-red-600' },
    { label: 'No Price', value: s.no_price || 0, color: 'text-orange-600' },
    { label: 'Images', value: s.images_extracted || 0, color: 'text-purple-600' },
    { label: 'Img Dupes Removed', value: s.images_duplicate_skipped || 0, color: 'text-purple-400' },
    { label: 'Img Conflicts', value: s.image_conflict_count || 0, color: 'text-blue-600' },
    { label: 'Errors', value: s.errors || 0, color: 'text-red-500' },
  ].filter(i => i.value > 0)
})

const binMatchCount = computed(() => results.value?.result_summary?.bin_matches || 0)
const binProductIds = computed(() => results.value?.result_summary?.bin_product_ids || [])
const imageConflicts = computed(() => results.value?.result_summary?.image_conflicts || [])

// eslint-disable-next-line no-use-before-define -- computed ref used by composable
var conflictGroups = computed(() => {
  if (!results.value?.result_data) return []
  const groups = {}

  const dupCodes = results.value.result_summary?.duplicate_codes || []
  dupCodes.forEach(dup => {
    if (!groups[dup.code]) groups[dup.code] = { code: dup.code, rows: [], existingVariants: [], source: 'file' }
    dup.indices.forEach(idx => {
      const row = results.value.result_data[idx]
      if (row) groups[dup.code].rows.push({ ...row, _idx: idx })
    })
  })

  results.value.result_data.forEach((row, idx) => {
    if (row.match_status === 'NEW_VARIANT' && row.existing_variants?.length > 0) {
      const code = row.manufacturer_code
      if (!groups[code]) groups[code] = { code, rows: [], existingVariants: row.existing_variants, source: 'db' }
      else {
        groups[code].source = 'both'
        if (!groups[code].existingVariants.length && row.existing_variants.length) {
          groups[code].existingVariants = row.existing_variants
        }
      }
      if (!groups[code].rows.find(r => r._idx === idx)) {
        groups[code].rows.push({ ...row, _idx: idx })
      }
    }
  })

  const list = Object.values(groups)
  const sort = conflictSortBy.value
  if (sort === 'code') list.sort((a, b) => a.code.localeCompare(b.code))
  else if (sort === 'code_desc') list.sort((a, b) => b.code.localeCompare(a.code))
  else if (sort === 'rows') list.sort((a, b) => a.rows.length - b.rows.length || a.code.localeCompare(b.code))
  else if (sort === 'rows_desc') list.sort((a, b) => b.rows.length - a.rows.length || a.code.localeCompare(b.code))
  return list
})

const hasConflicts = computed(() => conflictGroups.value.length > 0)

// Bin product helpers
async function restoreAndReparse() {
  if (!binProductIds.value.length || !jobId.value) return
  restoring.value = true
  try {
    await productsApi.restoreFromBin(binProductIds.value)
    const { data } = await excelApi.reparseJob(jobId.value)
    jobStatus.value = data
    results.value = null
    applied.value = null
    selectedRows.value = new Set()
    selectAll.value = false
    startPolling()
  } catch (e) {
    alert('Restore failed: ' + (e.response?.data?.detail || e.message))
  } finally {
    restoring.value = false
  }
}

function dismissBinBanner() {
  if (results.value?.result_summary) {
    results.value = {
      ...results.value,
      result_summary: { ...results.value.result_summary, bin_matches: 0, bin_product_ids: [] },
    }
  }
}

// Cancel
async function cancelJob() {
  if (!jobId.value) return
  stopPolling()
  try {
    await excelApi.cancelJob(jobId.value)
    jobId.value = null
    jobStatus.value = null
    results.value = null
  } catch (_e) {
    // ignore cancel error
  }
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-6">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <router-link :to="backRoute" class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
        <i class="pi pi-arrow-left text-gray-500" />
      </router-link>
      <div>
        <h1 class="text-xl font-semibold text-gray-900">
          {{ isProductMode ? 'Import Products from Excel' : 'Upload Excel' }}
        </h1>
        <p class="text-sm text-gray-500" v-if="order">
          Order {{ order.order_number || '#Draft' }} — {{ order.client_name }}
          <span v-if="pendingOnly" class="inline-flex items-center px-2 py-0.5 ml-2 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-200">
            <i class="pi pi-clock text-[8px] mr-1" /> Pending Items Only
          </span>
        </p>
        <p class="text-sm text-gray-500" v-else-if="isProductMode">Upload an Excel file to bulk-create products</p>
      </div>
    </div>

    <!-- Job Type Selector -->
    <div class="mb-5 grid grid-cols-2 gap-3" v-if="!jobId">
      <label class="relative flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all"
        :class="jobType === 'CLIENT_EXCEL' ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'">
        <input type="radio" v-model="jobType" value="CLIENT_EXCEL" class="sr-only" />
        <span class="text-sm font-semibold text-gray-800">{{ isProductMode ? 'Client Format' : 'Client Request' }}</span>
        <span class="text-xs text-gray-500 mt-0.5">Barcode + Code + Qty</span>
      </label>
      <label class="relative flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all"
        :class="jobType === 'FACTORY_EXCEL' ? 'border-violet-500 bg-violet-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'">
        <input type="radio" v-model="jobType" value="FACTORY_EXCEL" class="sr-only" />
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-gray-800">{{ isProductMode ? 'Factory Format' : 'Factory Response' }}</span>
          <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-violet-500 to-purple-600 text-white">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            AI
          </span>
        </div>
        <span class="text-xs text-gray-500 mt-0.5">Full details + Images + AI column mapping</span>
      </label>
    </div>

    <!-- AI Info Banner -->
    <div v-if="!jobId && !uploading && jobType === 'FACTORY_EXCEL'"
         class="mb-4 flex items-start gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200">
      <svg class="w-5 h-5 text-violet-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
      </svg>
      <div>
        <p class="text-sm font-medium text-violet-800">AI-Powered Column Detection</p>
        <p class="text-xs text-violet-600 mt-0.5">SAAS will automatically recognize your Excel columns — even with shuffled headers, Chinese names, or custom labels.</p>
      </div>
    </div>

    <!-- Drop Zone -->
    <div v-if="!jobId && !uploading"
      class="border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer"
      :class="dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 hover:border-gray-400 bg-white'"
      @dragover.prevent="dragOver = true" @dragleave="dragOver = false" @drop.prevent="onDrop" @click="$refs.fileInput.click()">
      <input ref="fileInput" type="file" accept=".xlsx,.xls" class="hidden" @change="onFileInput" />
      <i class="pi pi-file-excel text-4xl text-gray-400 mb-3" />
      <p class="text-gray-600 font-medium">{{ selectedFile ? selectedFile.name : 'Drop Excel file here or click to browse' }}</p>
      <p class="text-sm text-gray-400 mt-1" v-if="selectedFile">{{ formatSize(selectedFile.size) }} — Ready to upload</p>
      <p class="text-xs text-gray-400 mt-2" v-else>Accepts .xlsx and .xls files up to 500MB</p>
    </div>

    <!-- Upload Button -->
    <div v-if="selectedFile && !jobId && !uploading" class="mt-4 flex gap-3">
      <button @click="startUpload"
        :class="isFactoryExcel ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'"
        class="px-5 py-2.5 text-white rounded-lg transition-all text-sm font-medium flex items-center gap-2 shadow-sm">
        <svg v-if="isFactoryExcel" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
        <i v-else class="pi pi-upload text-xs" />
        {{ isFactoryExcel ? 'Upload & AI Map' : 'Upload & Process' }}
      </button>
      <button @click="selectedFile = null" class="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm">Cancel</button>
    </div>

    <!-- Upload Progress -->
    <div v-if="uploading" class="bg-white rounded-xl border p-6 mt-4">
      <div class="flex items-center gap-3 mb-3">
        <i class="pi pi-spin pi-spinner text-indigo-600" />
        <span class="text-sm font-medium text-gray-700">Uploading {{ selectedFile?.name }}...</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div class="bg-indigo-600 h-2 rounded-full transition-all" :style="{ width: uploadProgress + '%' }" />
      </div>
      <p class="text-xs text-gray-500 mt-2">{{ uploadProgress }}% uploaded</p>
    </div>

    <!-- Processing Progress -->
    <div v-if="isProcessing" class="bg-white rounded-xl border p-6 mt-4">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-3">
          <i class="pi pi-spin pi-cog text-indigo-600" />
          <span class="text-sm font-medium text-gray-700">Processing...</span>
        </div>
        <button @click="cancelJob" class="text-xs text-red-500 hover:text-red-700">Cancel</button>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div class="bg-indigo-600 h-2 rounded-full transition-all" :style="{ width: (jobStatus?.progress || 0) + '%' }" />
      </div>
      <p class="text-xs text-gray-500 mt-2">{{ jobStatus?.progress || 0 }}% — {{ jobStatus?.processed_rows || 0 }}/{{ jobStatus?.total_rows || '?' }} rows</p>
    </div>

    <!-- Failed -->
    <div v-if="jobStatus?.status === 'FAILED'" class="bg-red-50 border border-red-200 rounded-xl p-6 mt-4">
      <div class="flex items-center gap-2 mb-2">
        <i class="pi pi-times-circle text-red-500" />
        <span class="text-sm font-semibold text-red-700">Processing Failed</span>
      </div>
      <p class="text-sm text-red-600">{{ jobStatus.error_message }}</p>
      <button @click="jobId = null; jobStatus = null; selectedFile = null"
        class="mt-3 px-3 py-1.5 text-xs bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50">Try Again</button>
    </div>

    <!-- Results -->
    <div v-if="results" class="mt-6">
      <!-- Summary Cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div v-for="item in summaryItems" :key="item.label" class="bg-white rounded-lg border p-3 text-center">
          <div class="text-2xl font-bold" :class="item.color">{{ item.value }}</div>
          <div class="text-xs text-gray-500 mt-1">{{ item.label }}</div>
        </div>
      </div>

      <!-- Bin Match Banner -->
      <div v-if="binMatchCount > 0" class="mb-3 bg-amber-50 border border-amber-300 rounded-xl p-4">
        <div class="flex items-start gap-3">
          <i class="pi pi-inbox text-amber-600 mt-0.5" />
          <div class="flex-1">
            <p class="text-sm font-semibold text-amber-800">{{ binMatchCount }} product{{ binMatchCount > 1 ? 's' : '' }} found in Bin</p>
            <p class="text-xs text-amber-700 mt-1">Some product codes match products you previously deleted. Choose how to handle them:</p>
            <div class="flex gap-2 mt-3">
              <button @click="restoreAndReparse" :disabled="restoring"
                class="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-xs font-medium flex items-center gap-1.5 disabled:opacity-50">
                <i class="pi pi-replay text-[10px]" /> {{ restoring ? 'Restoring...' : 'Restore from Bin & Re-match' }}
              </button>
              <button @click="dismissBinBanner" :disabled="restoring"
                class="px-3 py-1.5 bg-white border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors text-xs font-medium">
                Create as New Products
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Duplicate Warning -->
      <div v-if="duplicateCount > 0" class="mb-3 bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <i class="pi pi-exclamation-triangle text-yellow-600" />
          <span class="text-sm text-yellow-800"><strong>{{ duplicateCount }} duplicate/ambiguous rows</strong> found and pre-selected.</span>
        </div>
        <button v-if="selectedRows.size > 0" @click="deleteSelected"
          class="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-xs font-medium whitespace-nowrap">
          Remove {{ selectedRows.size }} rows
        </button>
      </div>

      <!-- Conflict Resolution Panel -->
      <ConflictResolutionPanel
        v-if="hasConflicts && !applied"
        :conflict-groups="conflictGroups"
        :variant-resolutions="variantResolutions"
        :row-overrides="rowOverrides"
        :ai-resolutions="aiResolutions"
        :analyzing-conflicts="analyzingConflicts"
        :ai-resolution-source="aiResolutionSource"
        :ai-stats="aiStats"
        :processed="processed"
        :conflict-sort-by="conflictSortBy"
        @update:variant-resolutions="v => { variantResolutions = v; processed = false }"
        @update:row-overrides="v => { rowOverrides = v; processed = false }"
        @update:conflict-sort-by="v => conflictSortBy = v"
        @process="processResolutions"
      />

      <!-- Image Conflict Resolution -->
      <div v-if="imageConflicts.length > 0 && !applied" class="mb-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div class="flex items-center gap-2 mb-3">
          <i class="pi pi-images text-blue-600" />
          <span class="text-sm font-semibold text-blue-800">{{ imageConflicts.length }} product{{ imageConflicts.length > 1 ? 's have' : ' has' }} different images</span>
        </div>
        <div class="space-y-3">
          <div v-for="conflict in imageConflicts" :key="conflict.product_id" class="bg-white rounded-lg border border-blue-100 p-3">
            <div class="flex items-center gap-4 mb-2">
              <div class="flex items-center gap-3">
                <div class="text-center">
                  <img :src="conflict.existing_thumbnail_url"
                    class="w-16 h-16 object-contain rounded border cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                    alt="Current"
                    @click="openImageViewer(conflict.existing_thumbnail_url, 'Current: ' + conflict.code)" />
                  <div class="text-[10px] text-gray-400 mt-0.5">Current</div>
                </div>
                <i class="pi pi-arrow-right text-gray-400 text-xs" />
                <div class="text-center">
                  <img v-if="conflict.new_thumbnail_url"
                    :src="conflict.new_thumbnail_url"
                    class="w-16 h-16 object-contain rounded border cursor-pointer hover:ring-2 hover:ring-emerald-400 transition-all"
                    alt="New"
                    @click="openImageViewer(conflict.new_thumbnail_url, 'New: ' + conflict.code)" />
                  <div v-else class="w-16 h-16 bg-blue-100 rounded border flex items-center justify-center"><i class="pi pi-image text-blue-400" /></div>
                  <div class="text-[10px] text-gray-400 mt-0.5">New</div>
                </div>
              </div>
              <div class="text-xs font-mono text-gray-700">{{ conflict.code }}</div>
            </div>
            <div class="flex gap-4">
              <label v-for="opt in [{v: 'replace', t: 'Replace with new'}, {v: 'keep_current', t: 'Keep current'}, {v: 'keep_both', t: 'Keep both'}]" :key="opt.v"
                class="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" :name="'img_' + conflict.product_id" :value="opt.v"
                  :checked="imageConflictResolutions[conflict.product_id] === opt.v"
                  @change="imageConflictResolutions[conflict.product_id] = opt.v" class="text-blue-600" />
                {{ opt.t }}
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Results Table -->
      <ParsedResultsTable
        :filtered-data="filteredResultsData"
        :selected-rows="selectedRows"
        :select-all="selectAll"
        :is-factory-excel="isFactoryExcel"
        :processed="processed"
        :processed-summary="processedSummary"
        :results-filter="resultsFilter"
        :total-rows="(processed ? processedResults : results)?.result_data?.length || 0"
        @toggle-select-all="toggleSelectAll"
        @toggle-row="toggleRow"
        @delete-selected="deleteSelected"
        @update:results-filter="v => resultsFilter = v"
      />

      <!-- Apply Button -->
      <div class="mt-4 flex gap-3" v-if="!applied">
        <button @click="applyToOrder" :disabled="applying || (hasConflicts && !processed)"
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          :title="hasConflicts && !processed ? 'Process conflicts first' : ''">
          <i class="pi pi-check text-xs" />
          {{ applying ? 'Applying...' : (isProductMode ? 'Create Products' : 'Apply to Order') }}
        </button>
        <router-link :to="backRoute" class="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm">
          {{ isProductMode ? 'Back to Products' : 'Back to Order' }}
        </router-link>
      </div>

      <!-- Applied Results -->
      <div v-if="applied" class="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
        <div class="flex items-center gap-2 mb-3">
          <i class="pi pi-check-circle text-green-600" />
          <span class="text-sm font-semibold text-green-700">Applied Successfully</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          <div v-if="!isProductMode">
            <div class="text-lg font-bold text-green-700">{{ applied.items_added }}</div>
            <div class="text-xs text-gray-500">Items Added</div>
          </div>
          <div v-if="!isProductMode">
            <div class="text-lg font-bold text-blue-700">{{ applied.items_updated }}</div>
            <div class="text-xs text-gray-500">Items Updated</div>
          </div>
          <div>
            <div class="text-lg font-bold text-purple-700">{{ applied.products_created }}</div>
            <div class="text-xs text-gray-500">New Products</div>
          </div>
          <div v-if="(applied.variants_replaced || 0) > 0">
            <div class="text-lg font-bold text-purple-700">{{ applied.variants_replaced }}</div>
            <div class="text-xs text-gray-500">Variants Replaced</div>
          </div>
          <div v-if="applied.products_reactivated > 0">
            <div class="text-lg font-bold text-amber-600">{{ applied.products_reactivated }}</div>
            <div class="text-xs text-gray-500">Restored from Bin</div>
          </div>
          <div v-if="(applied.images_saved || 0) + (applied.images_unchanged || 0) > 0">
            <div class="text-lg font-bold text-indigo-600">{{ applied.images_saved || 0 }}</div>
            <div class="text-xs text-gray-500">New Images</div>
          </div>
          <div v-if="applied.duplicates_resolved > 0">
            <div class="text-lg font-bold text-orange-600">{{ applied.duplicates_resolved }}</div>
            <div class="text-xs text-gray-500">Duplicates Resolved</div>
          </div>
          <div v-if="!isProductMode">
            <div class="text-lg font-bold text-indigo-700">{{ applied.barcodes_saved }}</div>
            <div class="text-xs text-gray-500">Barcodes Saved</div>
          </div>
          <div>
            <div class="text-lg font-bold text-gray-500">{{ applied.skipped }}</div>
            <div class="text-xs text-gray-500">Skipped</div>
          </div>
        </div>
        <router-link :to="backRoute"
          class="mt-4 inline-block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
          {{ isProductMode ? '&larr; Back to Products' : '&larr; Back to Order' }}
        </router-link>
      </div>
    </div>

    <!-- AI Column Analyzing Overlay -->
    <div v-if="analyzingColumns" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-white rounded-xl shadow-2xl px-8 py-6 flex items-center gap-4">
        <svg class="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <span class="text-slate-700 font-medium">AI is analyzing your columns...</span>
      </div>
    </div>

    <!-- Column Mapping Dialog -->
    <ColumnMappingDialog
      v-if="showMappingDialog && mappingResult"
      :mapping-result="mappingResult"
      schema-type="product"
      @confirm="onMappingConfirm"
      @skip="onMappingSkip"
      @close="onMappingSkip"
    />

    <!-- Image Viewer Lightbox (scroll-zoom + drag-pan + ESC) -->
    <div v-if="viewerImage" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      @click.self="closeImageViewer"
      @wheel.prevent="onViewerWheel"
      @mousemove="onViewerMouseMove"
      @mouseup="onViewerMouseUp"
      @mouseleave="onViewerMouseUp">
      <!-- Controls bar -->
      <div class="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-4 py-2 bg-white/95 backdrop-blur-sm rounded-full shadow-lg">
        <span class="text-sm font-semibold text-slate-700">{{ viewerLabel }}</span>
        <div class="w-px h-5 bg-slate-200"></div>
        <button @click="zoomOut" class="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-600" title="Zoom out (or scroll down)">
          <i class="pi pi-minus text-[10px]" />
        </button>
        <button @click="resetZoom" class="text-xs text-slate-500 font-mono w-10 text-center hover:text-blue-600 cursor-pointer" title="Reset zoom">
          {{ Math.round(viewerZoom * 100) }}%
        </button>
        <button @click="zoomIn" class="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-600" title="Zoom in (or scroll up)">
          <i class="pi pi-plus text-[10px]" />
        </button>
        <div class="w-px h-5 bg-slate-200"></div>
        <button @click="closeImageViewer" class="w-7 h-7 rounded-full border border-red-200 flex items-center justify-center hover:bg-red-50 text-red-500" title="Close (ESC)">
          <i class="pi pi-times text-[10px]" />
        </button>
      </div>
      <!-- Image canvas -->
      <div class="flex items-center justify-center overflow-hidden" style="width: 85vw; height: 85vh;"
        :style="{ cursor: viewerZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }"
        @mousedown="onViewerMouseDown">
        <img :src="viewerImage" alt="Preview" draggable="false" class="select-none"
          :style="{
            transform: `translate(${viewerPan.x}px, ${viewerPan.y}px) scale(${viewerZoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.15s ease',
            maxWidth: '80vw',
            maxHeight: '75vh',
            objectFit: 'contain',
          }" />
      </div>
      <!-- Hint -->
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/50">
        Scroll to zoom &middot; Drag to pan &middot; ESC to close
      </div>
    </div>
  </div>
</template>

<style scoped>
.animate-fadeIn {
  animation: fadeIn 0.4s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
