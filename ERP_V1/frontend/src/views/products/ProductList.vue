<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { productsApi, settingsApi } from '../../api'

const router = useRouter()

// State — grouped data
const groups = ref([])           // [{ parent: {...}, variants: [...] }, ...]
const categories = ref([])
const loading = ref(false)
const search = ref('')
const selectedCategory = ref('')
const page = ref(1)
const perPage = ref(50)
const totalItems = ref(0)
const showDeleteConfirm = ref(false)
const deleteTarget = ref(null)
const brokenImages = ref({})     // Track images that failed to load

// Expand/collapse state
const expandedParents = ref(new Set())
const allExpanded = ref(false)

// Sort state
const sortBy = ref('')          // '', 'product_code', 'product_name', 'variants', 'category', 'hs_code', 'created_at'
const sortDir = ref('asc')      // 'asc' or 'desc'

function toggleSort(field) {
  if (sortBy.value === field) {
    // Same field — toggle direction, or clear on third click
    if (sortDir.value === 'asc') {
      sortDir.value = 'desc'
    } else {
      sortBy.value = ''
      sortDir.value = 'asc'
    }
  } else {
    sortBy.value = field
    sortDir.value = 'asc'
  }
  page.value = 1
  loadProducts()
}

function sortIcon(field) {
  if (sortBy.value !== field) return 'pi pi-sort-alt'
  return sortDir.value === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'
}

function sortActive(field) {
  return sortBy.value === field
}

// Bulk select state — operates on parent level (selecting parent selects all child IDs)
const selectedParentIds = ref(new Set())
const showBulkDeleteConfirm = ref(false)
const bulkDeleting = ref(false)

// Bulk edit state
const bulkCategory = ref('')
const bulkMaterial = ref('')
const bulkHsCode = ref('')
const bulkType = ref('')
const bulkBrand = ref('')
const bulkUpdating = ref('')  // which field is currently updating
const bulkMessage = ref('')   // success/error feedback
let bulkMsgTimer = null
const materialOptions = ref([])
const hsCodeOptions = ref([])
const categoryOptions = ref([])  // distinct categories from products table
const partTypeOptions = ref([])

// View mode: 'products' or 'bin'
const viewMode = ref('products')

// Bin state
const binProducts = ref([])
const binLoading = ref(false)
const binTotal = ref(0)
const binPage = ref(1)
const binSearch = ref('')
const binSelectedIds = ref(new Set())
const showBinPermanentDeleteConfirm = ref(false)
const binDeleting = ref(false)
const binRestoring = ref(false)

// Duplicate cleanup state
const showDuplicateCleanup = ref(false)
const dupScanning = ref(false)
const dupImageResult = ref(null)
const dupProducts = ref(null)
const dupCleaningImages = ref(false)

// Delete all images state
const dupDeletingAllImages = ref(false)
const dupDeleteAllResult = ref(null)
const dupDeleteAllProgress = ref('')
const dupDeleteAllConfirm = ref(false)

// Computed
const totalPages = computed(() => Math.ceil(totalItems.value / perPage.value))

// All selected product IDs (variants if present, otherwise the parent itself)
const selectedChildIds = computed(() => {
  const ids = new Set()
  for (const g of groups.value) {
    if (selectedParentIds.value.has(g.parent.product_code)) {
      if (g.variants.length > 0) {
        for (const v of g.variants) {
          ids.add(v.id)
        }
      } else {
        ids.add(g.parent.id)
      }
    }
  }
  return ids
})

// selectedCount: use parent count when selection spans beyond current page
const selectedCount = computed(() => {
  const parentCount = selectedParentIds.value.size
  const childCount = selectedChildIds.value.size
  // If selected parents exceed what's on current page, use parent count
  return parentCount > childCount ? parentCount : childCount
})

// allSelected: true when selection count matches total items (across all pages)
const allSelected = computed(() =>
  selectedParentIds.value.size > 0 && selectedParentIds.value.size >= totalItems.value
)

// Partial: some selected but not all
const someSelected = computed(() =>
  selectedParentIds.value.size > 0 && !allSelected.value
)

// Toggle select all — selects ALL products across ALL pages
const selectingAll = ref(false)
async function toggleSelectAll() {
  if (allSelected.value) {
    // Already all selected → deselect all
    selectedParentIds.value = new Set()
    return
  }
  // Select ALL across all pages — paginate through grouped API
  selectingAll.value = true
  try {
    const allCodes = new Set()
    let pg = 1
    let hasMore = true
    while (hasMore) {
      const params = { per_page: 200, page: pg, group: true }
      if (search.value) params.search = search.value
      if (selectedCategory.value) params.category = selectedCategory.value
      const { data } = await productsApi.list(params)
      const pageGroups = data.items || []
      pageGroups.forEach(g => {
        const code = g.parent ? g.parent.product_code : g.product_code
        if (code) allCodes.add(code)
      })
      const total = data.total || 0
      hasMore = pg * 200 < total
      pg++
    }
    selectedParentIds.value = allCodes
  } catch (_e) {
    // Fallback: select current page only
    const codes = new Set()
    groups.value.forEach(g => codes.add(g.parent.product_code))
    selectedParentIds.value = codes
  }
  selectingAll.value = false
}

// Toggle single parent group
function toggleSelect(productCode) {
  if (selectedParentIds.value.has(productCode)) {
    selectedParentIds.value.delete(productCode)
  } else {
    selectedParentIds.value.add(productCode)
  }
  selectedParentIds.value = new Set(selectedParentIds.value)
}

// Expand/collapse
function toggleExpand(productCode) {
  if (expandedParents.value.has(productCode)) {
    expandedParents.value.delete(productCode)
  } else {
    expandedParents.value.add(productCode)
  }
  expandedParents.value = new Set(expandedParents.value)
}

function toggleExpandAll() {
  if (allExpanded.value) {
    expandedParents.value = new Set()
    allExpanded.value = false
  } else {
    const all = new Set()
    groups.value.forEach(g => all.add(g.parent.product_code))
    expandedParents.value = all
    allExpanded.value = true
  }
}

// Set default variant
async function setDefault(variantId) {
  try {
    await productsApi.setDefault(variantId)
    loadProducts()
  } catch (err) {
    console.error('Failed to set default variant:', err)
  }
}

// Short variant ID
function shortId(id) {
  if (!id) return ''
  return 'V-' + String(id).substring(0, 4)
}

// Variant attributes string
function variantAttrs(v) {
  const parts = [v.part_type, v.dimension, v.material].filter(Boolean)
  return parts.length > 0 ? parts.join(' \u00b7 ') : '\u2014'
}

// Get thumbnail URL for a group (parent's or first child's)
function groupThumbnail(group) {
  if (group.parent.thumbnail_url) return group.parent.thumbnail_url
  for (const v of group.variants) {
    if (v.thumbnail_url) return v.thumbnail_url
  }
  return null
}

// Get category from first variant
function groupCategory(group) {
  for (const v of group.variants) {
    if (v.category) return v.category
  }
  return null
}

// Get HS code from first variant
function groupHsCode(group) {
  for (const v of group.variants) {
    if (v.hs_code) return v.hs_code
  }
  return null
}

// Collect unique variant parameters for parent summary columns
function groupMaterials(group) {
  const s = new Set()
  for (const v of group.variants) { if (v.material) s.add(v.material) }
  return [...s]
}

function groupDimensions(group) {
  const s = new Set()
  for (const v of group.variants) { if (v.dimension) s.add(v.dimension) }
  return [...s]
}

// Get display name for parent
function groupDisplayName(group) {
  if (group.parent.product_name && !group.parent.product_name.startsWith('[')) {
    return group.parent.product_name
  }
  // Fallback to first variant's name
  for (const v of group.variants) {
    if (v.product_name) return v.product_name
  }
  return group.parent.product_code
}

// Load products (grouped)
async function loadProducts() {
  loading.value = true
  try {
    const params = {
      page: page.value,
      per_page: perPage.value,
      group: true,
    }
    if (search.value) params.search = search.value
    if (selectedCategory.value) params.category = selectedCategory.value
    if (sortBy.value) {
      params.sort_by = sortBy.value
      params.sort_dir = sortDir.value
    }

    const { data } = await productsApi.list(params)
    groups.value = data.items
    totalItems.value = data.total
  } catch (err) {
    console.error('Failed to load products:', err)
  } finally {
    loading.value = false
  }
}

// Load categories for filter dropdown
async function loadCategories() {
  try {
    const { data } = await settingsApi.getMarkups()
    categories.value = data
  } catch (err) {
    console.error('Failed to load categories:', err)
  }
}

// Search with debounce
let searchTimer = null
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadProducts()
  }, 400)
}

// Category filter change
function onCategoryChange() {
  page.value = 1
  loadProducts()
}

// Pagination
function goToPage(p) {
  if (p >= 1 && p <= totalPages.value) {
    page.value = p
    loadProducts()
  }
}

// Single delete product (variant)
function confirmDelete(product) {
  deleteTarget.value = product
  showDeleteConfirm.value = true
}

async function executeDelete() {
  if (!deleteTarget.value) return
  try {
    await productsApi.delete(deleteTarget.value.id)
    showDeleteConfirm.value = false
    deleteTarget.value = null
    loadProducts()
  } catch (err) {
    console.error('Failed to delete product:', err)
  }
}

function cancelDelete() {
  showDeleteConfirm.value = false
  deleteTarget.value = null
}

// Bulk delete
function confirmBulkDelete() {
  if (selectedCount.value === 0) return
  showBulkDeleteConfirm.value = true
}

async function executeBulkDelete() {
  if (selectedCount.value === 0) return
  bulkDeleting.value = true
  try {
    // If cross-page selection, we need to fetch all child IDs
    let ids = Array.from(selectedChildIds.value)
    if (ids.length === 0 && selectedParentIds.value.size > 0) {
      // Cross-page: fetch all product IDs by codes
      const codes = Array.from(selectedParentIds.value)
      // Use bulk-update-style approach — but delete needs IDs
      // Fetch all matching products to get their IDs
      const allIds = []
      let pg = 1
      let hasMore = true
      while (hasMore) {
        const { data } = await productsApi.list({ per_page: 200, page: pg, group: true })
        const groups = data.items || []
        for (const g of groups) {
          if (selectedParentIds.value.has(g.parent?.product_code)) {
            for (const v of (g.variants || [])) allIds.push(v.id)
            if (g.variants?.length === 0 && g.parent?.id) allIds.push(g.parent.id)
          }
        }
        hasMore = pg * 200 < (data.total || 0)
        pg++
      }
      ids = allIds
    }

    if (ids.length === 0) {
      alert('No products to delete')
      bulkDeleting.value = false
      return
    }

    const { data } = await productsApi.bulkDelete(ids)
    bulkMessage.value = data.message || `${data.archived} products moved to bin`
    setTimeout(() => { bulkMessage.value = '' }, 5000)
    selectedParentIds.value = new Set()
    showBulkDeleteConfirm.value = false
    loadProducts()
  } catch (err) {
    alert('Delete failed: ' + (err.response?.data?.detail || err.message))
  } finally {
    bulkDeleting.value = false
  }
}

function cancelBulkDelete() {
  showBulkDeleteConfirm.value = false
}

// Bulk update a single field
async function applyBulkUpdate(field) {
  if (selectedCount.value === 0) return
  const value = field === 'category' ? bulkCategory.value
    : field === 'material' ? bulkMaterial.value
    : field === 'hs_code' ? bulkHsCode.value
    : field === 'brand' ? bulkBrand.value
    : bulkType.value
  if (!value) return

  bulkUpdating.value = field
  bulkMessage.value = ''
  clearTimeout(bulkMsgTimer)
  try {
    // If selection spans beyond current page, send product_codes instead of IDs
    const isCrossPage = selectedParentIds.value.size > groups.value.length
    if (isCrossPage) {
      const codes = Array.from(selectedParentIds.value)
      await productsApi.bulkUpdate([], { [field]: value, product_codes: codes })
    } else {
      const ids = Array.from(selectedChildIds.value)
      await productsApi.bulkUpdate(ids, { [field]: value })
    }
    const fieldLabel = field === 'hs_code' ? 'HSN Code' : field === 'part_type' ? 'Type' : field.charAt(0).toUpperCase() + field.slice(1)
    bulkMessage.value = `${fieldLabel} updated to "${value}" for ${selectedCount.value} products`
    bulkMsgTimer = setTimeout(() => { bulkMessage.value = '' }, 5000)
    // Reset field and reload
    if (field === 'category') bulkCategory.value = ''
    else if (field === 'material') bulkMaterial.value = ''
    else if (field === 'brand') bulkBrand.value = ''
    else if (field === 'hs_code') bulkHsCode.value = ''
    else bulkType.value = ''
    loadProducts()
    loadDropdownOptions()
  } catch (err) {
    bulkMessage.value = `Failed to update ${field}: ${err.response?.data?.detail || err.message}`
    bulkMsgTimer = setTimeout(() => { bulkMessage.value = '' }, 5000)
  } finally {
    bulkUpdating.value = ''
  }
}

// Load dropdown options for bulk edit
async function loadDropdownOptions() {
  try {
    const [catRes, matRes, hsRes, ptRes] = await Promise.all([
      productsApi.categories(),
      productsApi.materials(),
      productsApi.hsCodes(),
      productsApi.partTypes(),
    ])
    categoryOptions.value = catRes.data
    materialOptions.value = matRes.data
    hsCodeOptions.value = hsRes.data
    partTypeOptions.value = ptRes.data
  } catch (err) {
    console.error('Failed to load dropdown options:', err)
  }
}

// Clear selection
function clearSelection() {
  selectedParentIds.value = new Set()
  bulkCategory.value = ''
  bulkMaterial.value = ''
  bulkHsCode.value = ''
}

// --- Bin functions ---
const binTotalPages = computed(() => Math.ceil(binTotal.value / perPage.value))
const binSelectedCount = computed(() => binSelectedIds.value.size)
const binAllSelected = computed(() =>
  binProducts.value.length > 0 && binProducts.value.every(p => binSelectedIds.value.has(p.id))
)

async function loadBinProducts() {
  binLoading.value = true
  try {
    const params = { page: binPage.value, per_page: perPage.value }
    if (binSearch.value) params.search = binSearch.value
    const { data } = await productsApi.listBin(params)
    binProducts.value = data.items
    binTotal.value = data.total
  } catch (err) {
    console.error('Failed to load bin products:', err)
  } finally {
    binLoading.value = false
  }
}

function toggleBinSelectAll() {
  if (binAllSelected.value) {
    binProducts.value.forEach(p => binSelectedIds.value.delete(p.id))
  } else {
    binProducts.value.forEach(p => binSelectedIds.value.add(p.id))
  }
  binSelectedIds.value = new Set(binSelectedIds.value)
}

function toggleBinSelect(id) {
  if (binSelectedIds.value.has(id)) binSelectedIds.value.delete(id)
  else binSelectedIds.value.add(id)
  binSelectedIds.value = new Set(binSelectedIds.value)
}

function confirmBinPermanentDelete() {
  if (binSelectedCount.value === 0) return
  showBinPermanentDeleteConfirm.value = true
}

async function executeBinPermanentDelete() {
  if (binSelectedCount.value === 0) return
  binDeleting.value = true
  try {
    const ids = Array.from(binSelectedIds.value)
    await productsApi.permanentDelete(ids)
    binSelectedIds.value = new Set()
    showBinPermanentDeleteConfirm.value = false
    loadBinProducts()
  } catch (err) {
    console.error('Permanent delete failed:', err)
  } finally {
    binDeleting.value = false
  }
}

async function executeBinRestore() {
  if (binSelectedCount.value === 0) return
  binRestoring.value = true
  try {
    const ids = Array.from(binSelectedIds.value)
    await productsApi.restoreFromBin(ids)
    binSelectedIds.value = new Set()
    loadBinProducts()
  } catch (err) {
    console.error('Restore failed:', err)
  } finally {
    binRestoring.value = false
  }
}

let binSearchTimer = null
function onBinSearchInput() {
  clearTimeout(binSearchTimer)
  binSearchTimer = setTimeout(() => {
    binPage.value = 1
    loadBinProducts()
  }, 400)
}

function switchView(mode) {
  viewMode.value = mode
  if (mode === 'bin') loadBinProducts()
}

// Duplicate cleanup — fully client-side using existing endpoints
async function scanDuplicates() {
  dupScanning.value = true
  dupImageResult.value = null
  dupProducts.value = null
  try {
    // Load ALL products (paginated) to find code duplicates
    const allProducts = []
    let pg = 1
    while (true) {
      const { data } = await productsApi.list({ page: pg, per_page: 200 })
      allProducts.push(...data.items)
      if (allProducts.length >= data.total) break
      pg++
    }

    // Group by product_code to find duplicates
    const codeMap = {}
    for (const p of allProducts) {
      if (!p.product_code) continue
      if (!codeMap[p.product_code]) codeMap[p.product_code] = []
      codeMap[p.product_code].push(p)
    }

    const dupGroups = []
    let totalExtra = 0
    for (const [code, prods] of Object.entries(codeMap)) {
      if (prods.length > 1) {
        dupGroups.push({
          product_code: code,
          count: prods.length,
          products: prods.map(p => ({
            id: p.id,
            product_code: p.product_code,
            product_name: p.product_name,
            image_count: 0,  // filled below if needed
            used_in_orders: false,
          })),
        })
        totalExtra += prods.length - 1
      }
    }
    dupProducts.value = { duplicate_groups: dupGroups, total_groups: dupGroups.length, total_extra_products: totalExtra }
  } catch (err) {
    console.error('Failed to scan duplicates:', err)
  } finally {
    dupScanning.value = false
  }
}

async function cleanDuplicateImages() {
  dupCleaningImages.value = true
  dupImageResult.value = null
  try {
    // Load all products (paginated)
    const allProducts = []
    let pg = 1
    while (true) {
      const { data } = await productsApi.list({ page: pg, per_page: 200 })
      allProducts.push(...data.items)
      if (allProducts.length >= data.total) break
      pg++
    }
    let imagesRemoved = 0
    let productsCleaned = 0

    for (const product of allProducts) {
      try {
        const { data: images } = await productsApi.getImages(product.id)
        if (images.length <= 1) continue

        // Group by file_size (quick duplicate check — same size = likely same file)
        const seen = new Set()
        const dupsToDelete = []
        for (const img of images) {
          // Use file_size + width + height as a fingerprint
          const key = `${img.file_size || 0}_${img.width || 0}_${img.height || 0}`
          if (seen.has(key)) {
            dupsToDelete.push(img)
          } else {
            seen.add(key)
          }
        }

        if (dupsToDelete.length > 0) {
          productsCleaned++
          for (const dup of dupsToDelete) {
            await productsApi.deleteImage(product.id, dup.id)
            imagesRemoved++
          }
        }
      } catch (_) { /* skip product on error */ }
    }

    dupImageResult.value = { images_removed: imagesRemoved, products_cleaned: productsCleaned }
    loadProducts()
  } catch (err) {
    console.error('Failed to clean duplicate images:', err)
  } finally {
    dupCleaningImages.value = false
  }
}

async function deleteAllProductImages() {
  dupDeletingAllImages.value = true
  dupDeleteAllResult.value = null
  dupDeleteAllProgress.value = 'Loading products...'
  try {
    // Load ALL products (paginated)
    const allProducts = []
    let pg = 1
    while (true) {
      const { data } = await productsApi.list({ page: pg, per_page: 200 })
      allProducts.push(...data.items)
      if (allProducts.length >= data.total) break
      pg++
    }

    let totalDeleted = 0
    let productsAffected = 0

    for (let i = 0; i < allProducts.length; i++) {
      const product = allProducts[i]
      dupDeleteAllProgress.value = `Processing ${i + 1} / ${allProducts.length} products... (${totalDeleted} images deleted)`
      try {
        const { data: images } = await productsApi.getImages(product.id)
        if (images.length === 0) continue

        productsAffected++
        for (const img of images) {
          await productsApi.deleteImage(product.id, img.id)
          totalDeleted++
        }
      } catch (_) { /* skip product on error */ }
    }

    dupDeleteAllResult.value = { total_deleted: totalDeleted, products_affected: productsAffected }
    dupDeleteAllProgress.value = ''
    dupDeleteAllConfirm.value = false
    loadProducts()
  } catch (err) {
    console.error('Failed to delete all images:', err)
    dupDeleteAllProgress.value = 'Error: ' + (err.message || 'Unknown error')
  } finally {
    dupDeletingAllImages.value = false
  }
}

onMounted(async () => {
  loadProducts()
  loadCategories()
  loadDropdownOptions()
  // Fetch bin count for tab badge
  try {
    const { data } = await productsApi.listBin({ page: 1, per_page: 1 })
    binTotal.value = data.total
  } catch (_) {}
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex justify-between items-center mb-4">
      <div>
        <h2 class="text-lg font-semibold text-slate-800">Product Catalog</h2>
        <p class="text-sm text-slate-500 mt-0.5">{{ viewMode === 'bin' ? binTotal + ' archived' : totalItems + ' part groups' }}</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="viewMode === 'products'"
          @click="showDuplicateCleanup = true; scanDuplicates()"
          class="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <i class="pi pi-sparkles text-xs" /> Clean Duplicates
        </button>
        <router-link
          v-if="viewMode === 'products'"
          to="/products/upload-excel"
          class="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <i class="pi pi-file-excel text-xs" /> Import Excel
        </router-link>
        <router-link
          v-if="viewMode === 'products'"
          to="/products/new"
          class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
        >
          <i class="pi pi-plus text-xs" /> Add Product
        </router-link>
      </div>
    </div>

    <!-- Tab Switcher -->
    <div class="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1 w-fit">
      <button
        @click="switchView('products')"
        :class="[
          'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
          viewMode === 'products' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
        ]"
      >
        <i class="pi pi-box text-xs mr-1.5" />Products
      </button>
      <button
        @click="switchView('bin')"
        :class="[
          'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
          viewMode === 'bin' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
        ]"
      >
        <i class="pi pi-trash text-xs mr-1.5" />Bin
        <span v-if="binTotal > 0" class="ml-1 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{{ binTotal }}</span>
      </button>
    </div>

    <!-- ==================== PRODUCTS VIEW ==================== -->
    <template v-if="viewMode === 'products'">

    <!-- Bulk Action Bar (shown when items selected) -->
    <div
      v-if="selectedCount > 0"
      class="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 space-y-3"
    >
      <!-- Header row -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 text-sm font-bold">
            {{ selectedCount }}
          </span>
          <span class="text-sm font-medium text-slate-700">
            product{{ selectedCount > 1 ? 's' : '' }} selected{{ selectedParentIds.size > groups.length ? ' (across all pages)' : '' }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="clearSelection"
            class="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white text-slate-600 transition-colors"
          >
            Clear
          </button>
          <button
            @click="confirmBulkDelete"
            class="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5"
          >
            <i class="pi pi-trash text-xs" />
            Delete
          </button>
        </div>
      </div>

      <!-- Bulk update success/error message -->
      <div v-if="bulkMessage" class="pt-2 border-t border-slate-200">
        <div class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" :class="bulkMessage.startsWith('Failed') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'">
          <i :class="bulkMessage.startsWith('Failed') ? 'pi pi-exclamation-circle' : 'pi pi-check-circle'" />
          {{ bulkMessage }}
        </div>
      </div>

      <!-- Bulk edit fields row -->
      <div class="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-200">
        <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bulk Edit:</span>

        <!-- Category -->
        <div class="flex items-center gap-1.5">
          <input
            v-model="bulkCategory"
            list="bulk-category-list"
            placeholder="Category"
            class="w-36 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white"
          />
          <datalist id="bulk-category-list">
            <option v-for="c in categoryOptions" :key="c" :value="c" />
          </datalist>
          <button
            @click="applyBulkUpdate('category')"
            :disabled="!bulkCategory || bulkUpdating === 'category'"
            class="px-2.5 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <i v-if="bulkUpdating === 'category'" class="pi pi-spin pi-spinner text-xs" />
            <template v-else>Apply</template>
          </button>
        </div>

        <!-- Material -->
        <div class="flex items-center gap-1.5">
          <input
            v-model="bulkMaterial"
            list="bulk-material-list"
            placeholder="Material"
            class="w-36 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white"
          />
          <datalist id="bulk-material-list">
            <option v-for="m in materialOptions" :key="m" :value="m" />
          </datalist>
          <button
            @click="applyBulkUpdate('material')"
            :disabled="!bulkMaterial || bulkUpdating === 'material'"
            class="px-2.5 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <i v-if="bulkUpdating === 'material'" class="pi pi-spin pi-spinner text-xs" />
            <template v-else>Apply</template>
          </button>
        </div>

        <!-- HSN Code -->
        <div class="flex items-center gap-1.5">
          <input
            v-model="bulkHsCode"
            list="bulk-hscode-list"
            placeholder="HSN Code"
            class="w-36 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white"
          />
          <datalist id="bulk-hscode-list">
            <option v-for="h in hsCodeOptions" :key="h" :value="h" />
          </datalist>
          <button
            @click="applyBulkUpdate('hs_code')"
            :disabled="!bulkHsCode || bulkUpdating === 'hs_code'"
            class="px-2.5 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <i v-if="bulkUpdating === 'hs_code'" class="pi pi-spin pi-spinner text-xs" />
            <template v-else>Apply</template>
          </button>
        </div>

        <!-- Type -->
        <div class="flex items-center gap-1.5">
          <select
            v-model="bulkType"
            class="w-36 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white"
          >
            <option value="" disabled>Type</option>
            <option value="Original">Original</option>
            <option value="Copy">Copy</option>
            <option value="OEM">OEM</option>
            <option value="Aftermarket">Aftermarket</option>
          </select>
          <button
            @click="applyBulkUpdate('part_type')"
            :disabled="!bulkType || bulkUpdating === 'part_type'"
            class="px-2.5 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <i v-if="bulkUpdating === 'part_type'" class="pi pi-spin pi-spinner text-xs" />
            <template v-else>Apply</template>
          </button>
        </div>

        <!-- Brand -->
        <div class="flex items-center gap-1.5">
          <input
            v-model="bulkBrand"
            placeholder="Brand"
            class="w-36 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 bg-white"
          />
          <button
            @click="applyBulkUpdate('brand')"
            :disabled="!bulkBrand || bulkUpdating === 'brand'"
            class="px-2.5 py-1.5 text-xs font-medium bg-violet-500 text-white rounded-lg hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <i v-if="bulkUpdating === 'brand'" class="pi pi-spin pi-spinner text-xs" />
            <template v-else>Apply</template>
          </button>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-xl shadow-sm p-4 mb-4">
      <div class="flex flex-wrap gap-3 items-center">
        <!-- Search -->
        <div class="relative flex-1 min-w-[250px]">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <input
            v-model="search"
            @input="onSearchInput"
            type="text"
            placeholder="Search by code, name, or material..."
            class="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        <!-- Category Filter -->
        <select
          v-model="selectedCategory"
          @change="onCategoryChange"
          class="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[180px]"
        >
          <option value="">All Categories</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.name">
            {{ cat.name }}
          </option>
        </select>

        <!-- Per Page -->
        <select
          v-model.number="perPage"
          @change="page = 1; loadProducts()"
          class="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option :value="25">25 / page</option>
          <option :value="50">50 / page</option>
          <option :value="100">100 / page</option>
        </select>

        <!-- Expand All / Collapse All -->
        <button
          @click="toggleExpandAll"
          class="px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition-colors flex items-center gap-1.5 text-slate-600"
        >
          <i :class="allExpanded ? 'pi pi-angle-double-up' : 'pi pi-angle-double-down'" class="text-xs" />
          {{ allExpanded ? 'Collapse All' : 'Expand All' }}
        </button>
      </div>
    </div>

    <!-- Accordion Table -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <!-- Loading -->
      <div v-if="loading" class="p-12 text-center">
        <i class="pi pi-spin pi-spinner text-2xl text-emerald-500" />
        <p class="text-sm text-slate-400 mt-2">Loading products...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="groups.length === 0" class="p-12 text-center">
        <i class="pi pi-box text-4xl text-slate-300" />
        <p class="text-slate-400 mt-3">No products found</p>
        <router-link
          to="/products/new"
          class="inline-block mt-3 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
        >
          + Add your first product
        </router-link>
      </div>

      <!-- Grouped Data -->
      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <!-- Select All Checkbox (all pages) -->
              <th class="text-center px-2 py-3 w-10">
                <i v-if="selectingAll" class="pi pi-spinner pi-spin text-emerald-500 text-sm" />
                <input
                  v-else
                  type="checkbox"
                  :checked="allSelected"
                  :indeterminate="someSelected"
                  @change="toggleSelectAll"
                  class="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  :title="allSelected ? 'Deselect all' : `Select all ${totalItems} products`"
                />
              </th>
              <!-- Expand toggle column -->
              <th class="w-8 px-1 py-3"></th>
              <th class="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-14">Img</th>
              <th
                @click="toggleSort('product_code')"
                class="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none group hover:bg-slate-100 transition-colors whitespace-nowrap"
                :class="sortActive('product_code') ? 'text-emerald-700' : 'text-slate-500'"
              >
                <span class="inline-flex items-center gap-1">
                  Part Code
                  <i :class="sortIcon('product_code')" class="text-[10px]" :style="sortActive('product_code') ? '' : 'opacity: 0.3'" />
                </span>
              </th>
              <th
                @click="toggleSort('product_name')"
                class="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                :class="sortActive('product_name') ? 'text-emerald-700' : 'text-slate-500'"
              >
                <span class="inline-flex items-center gap-1">
                  Product Name
                  <i :class="sortIcon('product_name')" class="text-[10px]" :style="sortActive('product_name') ? '' : 'opacity: 0.3'" />
                </span>
              </th>
              <th class="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Material</th>
              <th class="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Size</th>
              <th
                @click="toggleSort('variants')"
                class="text-center px-3 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                :class="sortActive('variants') ? 'text-emerald-700' : 'text-slate-500'"
              >
                <span class="inline-flex items-center gap-1">
                  Variants
                  <i :class="sortIcon('variants')" class="text-[10px]" :style="sortActive('variants') ? '' : 'opacity: 0.3'" />
                </span>
              </th>
              <th
                @click="toggleSort('category')"
                class="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                :class="sortActive('category') ? 'text-emerald-700' : 'text-slate-500'"
              >
                <span class="inline-flex items-center gap-1">
                  Category
                  <i :class="sortIcon('category')" class="text-[10px]" :style="sortActive('category') ? '' : 'opacity: 0.3'" />
                </span>
              </th>
              <th class="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Brand</th>
              <th
                @click="toggleSort('hs_code')"
                class="text-left px-3 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none group hover:bg-slate-100 transition-colors"
                :class="sortActive('hs_code') ? 'text-emerald-700' : 'text-slate-500'"
              >
                <span class="inline-flex items-center gap-1">
                  HS Code
                  <i :class="sortIcon('hs_code')" class="text-[10px]" :style="sortActive('hs_code') ? '' : 'opacity: 0.3'" />
                </span>
              </th>
              <th class="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="group in groups" :key="group.parent.product_code">
              <!-- ===== SINGLE-VARIANT: flat row (no expand) ===== -->
              <tr
                v-if="group.variants.length <= 1"
                :class="[
                  'border-b border-slate-200 transition-colors cursor-pointer',
                  selectedParentIds.has(group.parent.product_code)
                    ? 'bg-emerald-50/50'
                    : 'hover:bg-slate-50'
                ]"
                @click="router.push(`/products/${group.variants[0]?.id || group.parent.id}/edit`)"
              >
                <td class="px-2 py-3 text-center" @click.stop>
                  <input
                    type="checkbox"
                    :checked="selectedParentIds.has(group.parent.product_code)"
                    @change="toggleSelect(group.parent.product_code)"
                    class="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </td>

                <!-- No expand chevron -->
                <td class="px-1 py-3"></td>

                <td class="px-2 py-3 text-center">
                  <img
                    v-if="groupThumbnail(group) && !brokenImages[group.parent.product_code]"
                    :src="groupThumbnail(group)"
                    :alt="group.parent.product_code"
                    class="w-10 h-10 rounded object-cover border border-slate-200 inline-block"
                    loading="lazy"
                    @error="brokenImages[group.parent.product_code] = true"
                  />
                  <div v-else class="w-10 h-10 rounded bg-slate-100 flex items-center justify-center inline-flex">
                    <i class="pi pi-box text-slate-300 text-xs" />
                  </div>
                </td>

                <td class="px-3 py-3 whitespace-nowrap">
                  <span class="text-xs font-mono font-bold text-teal-700">
                    {{ group.parent.product_code }}
                  </span>
                </td>

                <td class="px-3 py-3">
                  <span class="text-xs font-medium text-slate-800">{{ groupDisplayName(group) }}</span>
                </td>

                <td class="px-3 py-3">
                  <span
                    v-if="group.variants[0]?.material"
                    class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-600"
                  >{{ group.variants[0].material }}</span>
                  <span v-else class="text-xs text-slate-300">&mdash;</span>
                </td>

                <td class="px-3 py-3">
                  <span
                    v-if="group.variants[0]?.dimension"
                    class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600"
                  >{{ group.variants[0].dimension }}</span>
                  <span v-else class="text-xs text-slate-300">&mdash;</span>
                </td>

                <td class="px-3 py-3 text-center">
                  <span class="text-xs text-slate-300">&mdash;</span>
                </td>

                <td class="px-3 py-3">
                  <span
                    v-if="group.variants[0]?.category"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                  >
                    {{ group.variants[0].category }}
                  </span>
                  <span v-else class="text-xs text-slate-400">&mdash;</span>
                </td>

                <td class="px-3 py-3">
                  <span
                    v-if="group.variants[0]?.brand"
                    class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-600"
                  >{{ group.variants[0].brand }}</span>
                  <span v-else class="text-xs text-slate-300">&mdash;</span>
                </td>

                <td class="px-3 py-3 text-xs font-mono text-slate-600">
                  {{ group.variants[0]?.hs_code || '—' }}
                </td>

                <td class="px-3 py-3 text-right" @click.stop>
                  <div class="flex items-center justify-end gap-1">
                    <router-link
                      :to="`/products/new?parent_id=${group.parent.id || ''}&product_code=${group.parent.product_code}`"
                      class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
                      title="Add Variant"
                    >
                      <i class="pi pi-plus text-[10px]" /> Variant
                    </router-link>
                    <button
                      @click="router.push(`/products/${group.variants[0]?.id || group.parent.id}/edit`)"
                      class="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <i class="pi pi-pencil text-sm" />
                    </button>
                  </div>
                </td>
              </tr>

              <!-- ===== MULTI-VARIANT: parent row + expandable children ===== -->
              <template v-else>
  <!-- ===== PARENT ROW ===== -->
                <tr
                  :class="[
                    'border-b border-slate-200 transition-colors cursor-pointer',
                    selectedParentIds.has(group.parent.product_code)
                      ? 'bg-emerald-50/50'
                      : 'hover:bg-slate-50'
                  ]"
                  @click="toggleExpand(group.parent.product_code)"
                >
                  <!-- Checkbox -->
                  <td class="px-2 py-3 text-center" @click.stop>
                    <input
                      type="checkbox"
                      :checked="selectedParentIds.has(group.parent.product_code)"
                      @change="toggleSelect(group.parent.product_code)"
                      class="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </td>

                  <!-- Expand chevron -->
                  <td class="px-1 py-3 text-center">
                    <i
                      :class="[
                        'text-sm text-slate-400 transition-transform duration-200',
                        expandedParents.has(group.parent.product_code)
                          ? 'pi pi-chevron-down'
                          : 'pi pi-chevron-right'
                      ]"
                    />
                  </td>

                  <!-- Thumbnail -->
                  <td class="px-2 py-3 text-center">
                    <img
                      v-if="groupThumbnail(group) && !brokenImages[group.parent.product_code]"
                      :src="groupThumbnail(group)"
                      :alt="group.parent.product_code"
                      class="w-10 h-10 rounded object-cover border border-slate-200 inline-block"
                      loading="lazy"
                      @error="brokenImages[group.parent.product_code] = true"
                    />
                    <div v-else class="w-10 h-10 rounded bg-slate-100 flex items-center justify-center inline-flex">
                      <i class="pi pi-box text-slate-300 text-xs" />
                    </div>
                  </td>

                  <!-- Part Code -->
                  <td class="px-3 py-3 whitespace-nowrap">
                    <span class="text-xs font-mono font-bold text-teal-700">
                      {{ group.parent.product_code }}
                    </span>
                  </td>

                  <!-- Product Name -->
                  <td class="px-3 py-3">
                    <span class="text-xs font-medium text-slate-800">{{ groupDisplayName(group) }}</span>
                  </td>

                  <!-- Material (aggregated tags) -->
                  <td class="px-3 py-3">
                    <div v-if="groupMaterials(group).length" class="flex flex-wrap gap-1">
                      <span
                        v-for="m in groupMaterials(group)"
                        :key="m"
                        class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-600"
                      >{{ m }}</span>
                    </div>
                    <span v-else class="text-xs text-slate-300">&mdash;</span>
                  </td>

                  <!-- Size (aggregated tags) -->
                  <td class="px-3 py-3">
                    <div v-if="groupDimensions(group).length" class="flex flex-wrap gap-1">
                      <span
                        v-for="d in groupDimensions(group)"
                        :key="d"
                        class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600"
                      >{{ d }}</span>
                    </div>
                    <span v-else class="text-xs text-slate-300">&mdash;</span>
                  </td>

                  <!-- Variants Count -->
                  <td class="px-3 py-3 text-center">
                    <span
                      :class="[
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
                        group.variants.length > 1
                          ? 'bg-teal-100 text-teal-700'
                          : 'bg-slate-100 text-slate-500'
                      ]"
                    >
                      {{ group.variants.length }}
                    </span>
                  </td>

                  <!-- Category -->
                  <td class="px-3 py-3">
                    <span
                      v-if="groupCategory(group)"
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700"
                    >
                      {{ groupCategory(group) }}
                    </span>
                    <span v-else class="text-sm text-slate-400">&mdash;</span>
                  </td>

                  <!-- Brand -->
                  <td class="px-3 py-3">
                    <span
                      v-if="group.variants[0]?.brand"
                      class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-600"
                    >{{ group.variants[0].brand }}</span>
                    <span v-else class="text-xs text-slate-300">&mdash;</span>
                  </td>

                  <!-- HS Code -->
                  <td class="px-3 py-3 text-xs font-mono text-slate-600">
                    {{ groupHsCode(group) || '\u2014' }}
                  </td>

                  <!-- Actions -->
                  <td class="px-3 py-3 text-right" @click.stop>
                    <div class="flex items-center justify-end gap-1">
                      <router-link
                        :to="`/products/new?parent_id=${group.parent.id || ''}&product_code=${group.parent.product_code}`"
                        class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors"
                        title="Add Variant"
                      >
                        <i class="pi pi-plus text-[10px]" /> Variant
                      </router-link>
                      <button
                        @click="router.push(`/products/${group.variants[0]?.id}/edit`)"
                        class="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <i class="pi pi-pencil text-sm" />
                      </button>
                    </div>
                  </td>
                </tr>

  <!-- ===== CHILD VARIANT ROWS (expanded) ===== -->
                <template v-if="expandedParents.has(group.parent.product_code)">
                  <tr
                    v-for="(variant, vIdx) in group.variants"
                    :key="variant.id"
                    class="bg-slate-50/70 border-b border-slate-100 transition-colors hover:bg-slate-100/70"
                  >
                    <!-- Empty cell under checkbox -->
                    <td class="px-2 py-2"></td>

                    <!-- Tree connector -->
                    <td class="px-1 py-2 text-center">
                      <span class="font-mono text-slate-300 text-xs select-none">
                        {{ vIdx === group.variants.length - 1 ? '\u2514\u2500' : '\u251C\u2500' }}
                      </span>
                    </td>

                    <!-- Variant image + default star (Img column) -->
                    <td class="px-2 py-2 text-center">
                      <div class="relative inline-block">
                        <img
                          v-if="variant.thumbnail_url && !brokenImages[variant.id]"
                          :src="variant.thumbnail_url"
                          :alt="variant.product_code"
                          class="w-8 h-8 rounded object-cover border border-slate-200 inline-block"
                          loading="lazy"
                          @error="brokenImages[variant.id] = true"
                        />
                        <div v-else class="w-8 h-8 rounded bg-slate-100 flex items-center justify-center">
                          <i class="pi pi-image text-slate-300 text-[10px]" />
                        </div>
                        <i
                          v-if="variant.is_default"
                          class="pi pi-star-fill text-amber-400 text-[8px] absolute -top-1 -right-1 drop-shadow-sm"
                        />
                      </div>
                    </td>

                    <!-- Variant ID (Part Code column) -->
                    <td class="px-4 py-2">
                      <span class="font-mono text-[10px] text-slate-400">{{ shortId(variant.id) }}</span>
                    </td>

                    <!-- Product name (Product Name column) -->
                    <td class="px-4 py-2">
                      <router-link
                        :to="`/products/${variant.id}/edit`"
                        class="text-xs font-medium text-slate-700 hover:text-blue-600 hover:underline"
                      >
                        {{ variant.product_name || '\u2014' }}
                      </router-link>
                    </td>

                    <!-- Material -->
                    <td class="px-4 py-2">
                      <span v-if="variant.material" class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-600">
                        {{ variant.material }}
                      </span>
                      <span v-else class="text-[10px] text-slate-300">&mdash;</span>
                    </td>

                    <!-- Size / Dimension -->
                    <td class="px-4 py-2">
                      <span v-if="variant.dimension" class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600">
                        {{ variant.dimension }}
                      </span>
                      <span v-else class="text-[10px] text-slate-300">&mdash;</span>
                    </td>

                    <!-- Part type (Variants column) -->
                    <td class="px-4 py-2 text-center">
                      <span v-if="variant.part_type" class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-600">
                        {{ variant.part_type }}
                      </span>
                    </td>

                    <!-- Category -->
                    <td class="px-4 py-2">
                      <span v-if="variant.category" class="text-[10px] text-slate-400">{{ variant.category }}</span>
                    </td>

                    <!-- Brand -->
                    <td class="px-4 py-2">
                      <span v-if="variant.brand" class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-600">{{ variant.brand }}</span>
                    </td>

                    <!-- HS Code -->
                    <td class="px-4 py-2">
                      <span v-if="variant.hs_code" class="text-[10px] font-mono text-slate-400">{{ variant.hs_code }}</span>
                    </td>

                    <!-- Actions -->
                    <td class="px-4 py-2 text-right">
                      <div class="flex items-center justify-end gap-0.5">
                        <button
                          v-if="!variant.is_default"
                          @click="setDefault(variant.id)"
                          class="p-1.5 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Set as default"
                        >
                          <i class="pi pi-star text-xs" />
                        </button>
                        <button
                          @click="router.push(`/products/${variant.id}/edit`)"
                          class="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <i class="pi pi-pencil text-xs" />
                        </button>
                        <button
                          @click="confirmDelete(variant)"
                          class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <i class="pi pi-trash text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                </template>
              </template>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50"
      >
        <p class="text-sm text-slate-500">
          Showing {{ (page - 1) * perPage + 1 }}&ndash;{{ Math.min(page * perPage, totalItems) }} of {{ totalItems }}
        </p>
        <div class="flex items-center gap-1">
          <button
            @click="goToPage(page - 1)"
            :disabled="page === 1"
            class="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i class="pi pi-chevron-left text-xs" />
          </button>
          <template v-for="p in totalPages" :key="p">
            <button
              v-if="p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)"
              @click="goToPage(p)"
              :class="[
                'px-3 py-1.5 text-sm rounded-lg border',
                p === page
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'border-slate-200 hover:bg-white text-slate-600'
              ]"
            >
              {{ p }}
            </button>
            <span
              v-else-if="p === page - 2 || p === page + 2"
              class="px-1 text-slate-400"
            >...</span>
          </template>
          <button
            @click="goToPage(page + 1)"
            :disabled="page === totalPages"
            class="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i class="pi pi-chevron-right text-xs" />
          </button>
        </div>
      </div>
    </div>

    <!-- Single Delete Confirmation Modal -->
    <div
      v-if="showDeleteConfirm"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="cancelDelete"
    >
      <div class="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <i class="pi pi-exclamation-triangle text-red-600" />
          </div>
          <h3 class="text-lg font-semibold text-slate-800">Delete Product</h3>
        </div>
        <p class="text-sm text-slate-600 mb-1">Are you sure you want to delete:</p>
        <p class="text-sm font-medium text-slate-800 mb-4">
          {{ deleteTarget?.product_code }} &mdash; {{ deleteTarget?.product_name }}
        </p>
        <div class="flex gap-3 justify-end">
          <button
            @click="cancelDelete"
            class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="executeDelete"
            class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Bulk Delete Confirmation Modal -->
    <div
      v-if="showBulkDeleteConfirm"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="cancelBulkDelete"
    >
      <div class="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <i class="pi pi-exclamation-triangle text-red-600" />
          </div>
          <h3 class="text-lg font-semibold text-slate-800">Delete {{ selectedCount }} Products</h3>
        </div>
        <p class="text-sm text-slate-600 mb-2">
          This will <strong>permanently delete</strong> the selected products and all their associated images.
          This action cannot be undone.
        </p>
        <div class="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p class="text-xs text-red-700 font-medium">
            <i class="pi pi-info-circle mr-1" />
            {{ selectedCount }} product{{ selectedCount > 1 ? 's' : '' }} and all images will be removed from the database and disk.
          </p>
        </div>
        <div class="flex gap-3 justify-end">
          <button
            @click="cancelBulkDelete"
            :disabled="bulkDeleting"
            class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="executeBulkDelete"
            :disabled="bulkDeleting"
            class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <i v-if="bulkDeleting" class="pi pi-spin pi-spinner text-xs" />
            <i v-else class="pi pi-trash text-xs" />
            {{ bulkDeleting ? 'Deleting...' : `Delete ${selectedCount} Products` }}
          </button>
        </div>
      </div>
    </div>

    </template>

    <!-- ==================== BIN VIEW ==================== -->
    <template v-if="viewMode === 'bin'">

    <!-- Bin Action Bar -->
    <div v-if="binSelectedCount > 0" class="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 text-sm font-bold">
            {{ binSelectedCount }}
          </span>
          <span class="text-sm font-medium text-slate-700">
            archived product{{ binSelectedCount > 1 ? 's' : '' }} selected
          </span>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="binSelectedIds = new Set()"
            class="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-white text-slate-600 transition-colors"
          >
            Clear
          </button>
          <button
            @click="executeBinRestore"
            :disabled="binRestoring"
            class="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
          >
            <i v-if="binRestoring" class="pi pi-spin pi-spinner text-xs" />
            <i v-else class="pi pi-replay text-xs" />
            Restore
          </button>
          <button
            @click="confirmBinPermanentDelete"
            class="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5"
          >
            <i class="pi pi-trash text-xs" />
            Permanently Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Bin Search -->
    <div class="bg-white rounded-xl shadow-sm p-4 mb-4">
      <div class="relative max-w-sm">
        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
        <input
          v-model="binSearch"
          @input="onBinSearchInput"
          type="text"
          placeholder="Search archived products..."
          class="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
        />
      </div>
    </div>

    <!-- Bin Table -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <div v-if="binLoading" class="p-12 text-center">
        <i class="pi pi-spin pi-spinner text-2xl text-red-500" />
        <p class="text-sm text-slate-400 mt-2">Loading archived products...</p>
      </div>

      <div v-else-if="binProducts.length === 0" class="p-12 text-center">
        <i class="pi pi-trash text-4xl text-slate-300" />
        <p class="text-slate-400 mt-3">Bin is empty</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="bg-red-50 border-b border-red-100">
              <th class="text-center px-2 py-3 w-10">
                <input
                  type="checkbox"
                  :checked="binAllSelected"
                  @change="toggleBinSelectAll"
                  class="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                />
              </th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Part Code</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Product Name</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Material</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Brand</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="product in binProducts"
              :key="product.id"
              :class="[
                'transition-colors',
                binSelectedIds.has(product.id) ? 'bg-red-50/50' : 'hover:bg-slate-50'
              ]"
            >
              <td class="px-2 py-3 text-center">
                <input
                  type="checkbox"
                  :checked="binSelectedIds.has(product.id)"
                  @change="toggleBinSelect(product.id)"
                  class="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                />
              </td>
              <td class="px-4 py-3 text-sm font-mono font-medium text-slate-800">{{ product.product_code }}</td>
              <td class="px-4 py-3 text-sm text-slate-700">{{ product.product_name }}</td>
              <td class="px-4 py-3 text-sm text-slate-600">{{ product.material || '\u2014' }}</td>
              <td class="px-4 py-3">
                <span v-if="product.category" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                  {{ product.category }}
                </span>
                <span v-else class="text-sm text-slate-400">&mdash;</span>
              </td>
              <td class="px-4 py-3">
                <span v-if="product.brand" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700">
                  {{ product.brand }}
                </span>
                <span v-else class="text-sm text-slate-400">&mdash;</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Bin Pagination -->
      <div
        v-if="binTotalPages > 1"
        class="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50"
      >
        <p class="text-sm text-slate-500">
          Showing {{ (binPage - 1) * perPage + 1 }}&ndash;{{ Math.min(binPage * perPage, binTotal) }} of {{ binTotal }}
        </p>
        <div class="flex items-center gap-1">
          <button
            @click="binPage > 1 && (binPage--, loadBinProducts())"
            :disabled="binPage === 1"
            class="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i class="pi pi-chevron-left text-xs" />
          </button>
          <span class="px-3 py-1.5 text-sm text-slate-600">Page {{ binPage }} of {{ binTotalPages }}</span>
          <button
            @click="binPage < binTotalPages && (binPage++, loadBinProducts())"
            :disabled="binPage === binTotalPages"
            class="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <i class="pi pi-chevron-right text-xs" />
          </button>
        </div>
      </div>
    </div>

    <!-- Bin Permanent Delete Confirmation Modal -->
    <div
      v-if="showBinPermanentDeleteConfirm"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showBinPermanentDeleteConfirm = false"
    >
      <div class="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <i class="pi pi-exclamation-triangle text-red-600" />
          </div>
          <h3 class="text-lg font-semibold text-slate-800">Permanently Delete</h3>
        </div>
        <p class="text-sm text-slate-600 mb-2">
          This will <strong>permanently delete</strong> {{ binSelectedCount }} archived product{{ binSelectedCount > 1 ? 's' : '' }} and all their images.
          This cannot be undone.
        </p>
        <div class="flex gap-3 justify-end mt-4">
          <button
            @click="showBinPermanentDeleteConfirm = false"
            :disabled="binDeleting"
            class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="executeBinPermanentDelete"
            :disabled="binDeleting"
            class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <i v-if="binDeleting" class="pi pi-spin pi-spinner text-xs" />
            <i v-else class="pi pi-trash text-xs" />
            {{ binDeleting ? 'Deleting...' : 'Permanently Delete' }}
          </button>
        </div>
      </div>
    </div>

    </template>

    <!-- ==================== DUPLICATE CLEANUP MODAL ==================== -->
    <div v-if="showDuplicateCleanup" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showDuplicateCleanup = false">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 class="text-lg font-bold text-amber-600 flex items-center gap-2">
              <i class="pi pi-sparkles" /> Clean Duplicates
            </h3>
            <p class="text-sm text-slate-500">Find and remove duplicate images & products</p>
          </div>
          <button @click="showDuplicateCleanup = false" class="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
        </div>

        <div class="overflow-y-auto p-6 space-y-6">
          <!-- Loading -->
          <div v-if="dupScanning" class="text-center py-8 text-slate-500">
            <i class="pi pi-spin pi-spinner text-2xl" />
            <p class="mt-2">Scanning for duplicates...</p>
          </div>

          <template v-else>
            <!-- SECTION 1: Duplicate Images -->
            <div class="border border-slate-200 rounded-xl p-4">
              <h4 class="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                <i class="pi pi-images text-amber-500" /> Duplicate Images
              </h4>
              <p class="text-sm text-slate-500 mb-3">
                Removes identical images within the same product (same file content). Keeps one copy of each unique image.
              </p>
              <div v-if="dupImageResult" class="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-3 text-sm">
                <span class="font-semibold text-emerald-700">Done!</span>
                Removed {{ dupImageResult.images_removed }} duplicate images from {{ dupImageResult.products_cleaned }} products.
              </div>
              <button
                @click="cleanDuplicateImages"
                :disabled="dupCleaningImages"
                class="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <template v-if="dupCleaningImages"><i class="pi pi-spin pi-spinner mr-1" /> Cleaning...</template>
                <template v-else><i class="pi pi-trash mr-1" /> Remove Duplicate Images</template>
              </button>
            </div>

            <!-- SECTION 2: Duplicate Products -->
            <div class="border border-slate-200 rounded-xl p-4">
              <h4 class="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                <i class="pi pi-copy text-blue-500" /> Duplicate Products
              </h4>
              <p class="text-sm text-slate-500 mb-3">
                Products with the same Part Code. Review and manually merge or delete extras.
              </p>

              <div v-if="dupProducts && dupProducts.total_groups === 0" class="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                <i class="pi pi-check-circle text-emerald-600 mr-1" />
                <span class="text-emerald-700 font-medium">No duplicate products found!</span>
              </div>

              <div v-else-if="dupProducts && dupProducts.total_groups > 0" class="space-y-3">
                <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                  <span class="font-semibold text-amber-700">{{ dupProducts.total_groups }} duplicate groups</span>
                  ({{ dupProducts.total_extra_products }} extra products)
                </div>

                <div
                  v-for="group in dupProducts.duplicate_groups"
                  :key="group.product_code"
                  class="border border-slate-200 rounded-lg overflow-hidden"
                >
                  <div class="bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                    {{ group.product_code }} <span class="text-slate-400">({{ group.count }} copies)</span>
                  </div>
                  <div class="divide-y divide-slate-100">
                    <div
                      v-for="(prod, i) in group.products"
                      :key="prod.id"
                      class="px-3 py-2 text-sm flex items-center justify-between"
                    >
                      <div>
                        <span class="text-slate-800">{{ prod.product_name || '\u2014' }}</span>
                        <span class="text-xs text-slate-400 ml-2">{{ prod.image_count }} img</span>
                        <span v-if="prod.used_in_orders" class="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded ml-2">In Orders</span>
                        <span v-if="i === 0" class="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded ml-2">Keep</span>
                      </div>
                      <router-link
                        :to="`/products/${prod.id}/edit`"
                        class="text-blue-500 hover:text-blue-700 text-xs"
                        @click="showDuplicateCleanup = false"
                      >View &rarr;</router-link>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- SECTION 3: Delete All Product Images -->
            <div class="border border-red-200 rounded-xl p-4">
              <h4 class="font-semibold text-slate-800 mb-2 flex items-center gap-2">
                <i class="pi pi-image text-red-500" /> Delete All Product Images
              </h4>
              <p class="text-sm text-slate-500 mb-3">
                Removes <strong>all</strong> images from every product. Use this before re-uploading a factory Excel to get fresh images.
                Products themselves are kept &mdash; only their images are deleted.
              </p>

              <div v-if="dupDeleteAllResult" class="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-3 text-sm">
                <span class="font-semibold text-emerald-700">Done!</span>
                Deleted {{ dupDeleteAllResult.total_deleted }} images from {{ dupDeleteAllResult.products_affected }} products.
              </div>

              <div v-if="dupDeleteAllProgress" class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm text-blue-700">
                <i class="pi pi-spin pi-spinner mr-1" /> {{ dupDeleteAllProgress }}
              </div>

              <!-- Two-step confirmation -->
              <div v-if="!dupDeleteAllConfirm">
                <button
                  @click="dupDeleteAllConfirm = true"
                  :disabled="dupDeletingAllImages"
                  class="bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  <i class="pi pi-trash mr-1" /> Delete All Images...
                </button>
              </div>
              <div v-else class="bg-red-50 border border-red-200 rounded-lg p-3">
                <p class="text-sm text-red-700 font-medium mb-2">
                  <i class="pi pi-exclamation-triangle mr-1" />
                  This will permanently delete ALL images from ALL products. Are you sure?
                </p>
                <div class="flex gap-2">
                  <button
                    @click="deleteAllProductImages"
                    :disabled="dupDeletingAllImages"
                    class="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <template v-if="dupDeletingAllImages"><i class="pi pi-spin pi-spinner mr-1" /> Deleting...</template>
                    <template v-else>Yes, Delete All Images</template>
                  </button>
                  <button
                    @click="dupDeleteAllConfirm = false"
                    :disabled="dupDeletingAllImages"
                    class="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- Footer -->
        <div class="px-6 py-3 border-t border-slate-200 flex justify-end">
          <button @click="showDuplicateCleanup = false" class="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
