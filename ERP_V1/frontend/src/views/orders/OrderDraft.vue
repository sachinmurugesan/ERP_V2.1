<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ordersApi, clientsApi, factoriesApi, productsApi, unloadedApi, afterSalesApi } from '../../api'

const router = useRouter()

// State
const saving = ref(false)
const errors = ref({})
const successMsg = ref('')

// Selectors data
const clients = ref([])
const factories = ref([])

// Quick-add modals
const showClientModal = ref(false)
const showFactoryModal = ref(false)
const newClient = ref({ company_name: '' })
const newFactory = ref({ company_name: '', factory_code: '' })
const quickSaving = ref(false)

// Product search
const productSearch = ref('')
const productResults = ref([])
const searchingProducts = ref(false)
let productSearchTimer = null

// Form data
const form = ref({
  client_id: '',
  factory_id: '',
  currency: 'CNY',
  po_reference: '',
  notes: '',
})

// Order items
const orderItems = ref([])

// Bulk paste
const showBulkPaste = ref(false)
const bulkText = ref('')
const bulkResults = ref([])
const bulkProcessed = ref(false)
const quickAddForms = ref({})  // keyed by result index: { product_name, category, material, saving, error }
const showBulkDoneWarning = ref(false)

// Product browser modal
const showProductBrowser = ref(false)
const browserSearch = ref('')
const browserCategory = ref('')
const browserProducts = ref([])
const browserLoading = ref(false)
const browserSelected = ref(new Set())
const browserPage = ref(1)
const browserTotal = ref(0)
const browserPerPage = 20
const categories = ref([])

const currencies = ['CNY', 'USD', 'EUR', 'GBP']

// Pending unloaded items (auto-carry check)
const pendingUnloaded = ref([])
const pendingAfterSales = ref([])
const loadingPending = ref(false)
const showCarryConfirm = ref(false)

watch([() => form.value.client_id, () => form.value.factory_id], async ([clientId, factoryId]) => {
  if (clientId && factoryId) {
    loadingPending.value = true
    try {
      const [unloadedRes, afterSalesRes] = await Promise.all([
        unloadedApi.getPending(clientId, factoryId),
        afterSalesApi.getPending(clientId, factoryId),
      ])
      pendingUnloaded.value = unloadedRes.data.items || []
      pendingAfterSales.value = afterSalesRes.data.items || []
    } catch (err) {
      console.error('Failed to check pending items:', err)
      pendingUnloaded.value = []
      pendingAfterSales.value = []
    } finally {
      loadingPending.value = false
    }
  } else {
    pendingUnloaded.value = []
    pendingAfterSales.value = []
  }
}, { immediate: false })

async function loadClients() {
  try {
    const { data } = await clientsApi.list({ per_page: 200 })
    clients.value = data.items
  } catch (err) {
    console.error('Failed to load clients:', err)
  }
}

async function loadFactories() {
  try {
    const { data } = await factoriesApi.list({ per_page: 200 })
    factories.value = data.items
  } catch (err) {
    console.error('Failed to load factories:', err)
  }
}

async function quickCreateClient() {
  if (!newClient.value.company_name.trim()) return
  quickSaving.value = true
  try {
    const { data } = await clientsApi.create({ company_name: newClient.value.company_name.trim() })
    await loadClients()
    form.value.client_id = data.id
    showClientModal.value = false
    newClient.value = { company_name: '' }
  } catch (err) {
    console.error('Failed to create client:', err)
    alert(err.response?.data?.detail || 'Failed to create client')
  } finally {
    quickSaving.value = false
  }
}

async function quickCreateFactory() {
  if (!newFactory.value.company_name.trim() || !newFactory.value.factory_code.trim()) return
  quickSaving.value = true
  try {
    const { data } = await factoriesApi.create({
      company_name: newFactory.value.company_name.trim(),
      factory_code: newFactory.value.factory_code.trim(),
    })
    await loadFactories()
    form.value.factory_id = data.id
    showFactoryModal.value = false
    newFactory.value = { company_name: '', factory_code: '' }
  } catch (err) {
    console.error('Failed to create factory:', err)
    alert(err.response?.data?.detail || 'Failed to create factory')
  } finally {
    quickSaving.value = false
  }
}

async function loadCategories() {
  try {
    const { data } = await productsApi.categories()
    categories.value = data
  } catch (err) {
    console.error('Failed to load categories:', err)
  }
}

// ========================================
// Carry-Forward Duplicate Detection
// ========================================
function findPendingCarryForward(productId, productCode) {
  // Only check unloaded items — after-sales products are already paid for
  // and should NOT trigger duplicate warnings (they get auto-added by backend)
  const unloaded = pendingUnloaded.value.find(
    i => i.product_id === productId || (productCode && i.product_code === productCode)
  )
  if (unloaded) return {
    type: 'unloaded',
    qty: unloaded.quantity,
    from: unloaded.original_order_number,
  }
  return null
}

// ========================================
// Product Search (single add)
// ========================================
function onProductSearch() {
  clearTimeout(productSearchTimer)
  if (!productSearch.value || productSearch.value.length < 2) {
    productResults.value = []
    return
  }
  productSearchTimer = setTimeout(async () => {
    searchingProducts.value = true
    try {
      const { data } = await productsApi.search(productSearch.value)
      const addedIds = new Set(orderItems.value.map(i => i.product_id))
      productResults.value = data
        .filter(p => !addedIds.has(p.id))
        .map(p => ({
          ...p,
          pendingCF: findPendingCarryForward(p.id, p.product_code),
        }))
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      searchingProducts.value = false
    }
  }, 300)
}

function addProduct(product) {
  if (orderItems.value.find(i => i.product_id === product.id)) return
  orderItems.value.push({
    product_id: product.id,
    product_code: product.product_code,
    product_name: product.product_name,
    part_type: product.part_type,
    dimension: product.dimension,
    material: product.material,
    variant_note: product.variant_note,
    category: product.category,
    quantity: product.moq || 1,
    notes: '',
  })
  productSearch.value = ''
  productResults.value = []
}

function removeItem(index) {
  orderItems.value.splice(index, 1)
}

// ========================================
// Bulk Paste (Query 1 fix)
// ========================================
async function processBulkPaste() {
  const lines = bulkText.value.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return

  // Parse lines: "PartCode Quantity" or just "PartCode" (defaults to qty 1)
  const parsed = lines.map(line => {
    const parts = line.split(/\s+/)
    const code = parts[0]
    const qty = parts.length > 1 ? (parseInt(parts[parts.length - 1]) || 1) : 1
    return { code, qty }
  })

  const codes = parsed.map(p => p.code)
  try {
    const { data } = await productsApi.validateCodes(codes)
    bulkResults.value = data.map((r, i) => ({
      ...r,
      quantity: parsed[i].qty,
      selectedMatch: null,
      conflict: null,
      pendingConflict: null,
      created: false,
    }))
    bulkProcessed.value = true
    quickAddForms.value = {}

    // Process results: auto-add FOUND, detect carried conflicts
    for (const result of bulkResults.value) {
      // Multi-variant products: mark for user review instead of auto-adding
      if (result.status === 'FOUND' && result.matches.length > 1) {
        result.selectedMatch = result.matches[0].is_default ? result.matches[0].id : null
        result.status = 'VARIANT_CHOICE'
        continue
      }

      if (result.status === 'FOUND' && result.matches.length >= 1) {
        const match = result.matches[0]

        // Check against pending carry-forward items (unloaded + after-sales)
        const pendingCF = findPendingCarryForward(match.id, match.product_code)
        if (pendingCF) {
          result.pendingConflict = {
            type: pendingCF.type,
            carriedQty: pendingCF.qty,
            newQty: result.quantity,
            from: pendingCF.from,
            resolution: pendingCF.resolution || null,
            action: null,   // 'add_extra' | 'skip'
          }
          continue  // Don't auto-add — wait for user choice
        }

        // Check if this product already exists as a carried-forward item in orderItems
        const existingCarried = orderItems.value.find(
          i => i.product_code === match.product_code && i.notes?.startsWith('Carried from')
        )
        if (existingCarried) {
          // Conflict: carried item exists with potentially different qty
          const carriedSource = existingCarried.notes.match(/^Carried from (ORD-\S+|previous order)/)?.[1] || 'previous order'
          result.conflict = {
            carriedQty: existingCarried.quantity,
            newQty: result.quantity,
            resolved: false,
            chosenQty: null,
            carriedSource,
            orderItemRef: existingCarried,
          }
          continue  // Don't auto-add — wait for user resolution
        }

        // Check if already in order (non-carried duplicate)
        const existingItem = orderItems.value.find(i => i.product_id === match.id)
        if (existingItem) {
          // Update quantity if pasted qty is higher
          if (result.quantity > existingItem.quantity) {
            existingItem.quantity = result.quantity
          }
          continue
        }

        // Normal auto-add with parsed quantity
        orderItems.value.push({
          product_id: match.id,
          product_code: match.product_code,
          product_name: match.product_name,
          part_type: match.part_type,
          dimension: match.dimension,
          material: match.material,
          variant_note: match.variant_note,
          category: match.category,
          quantity: result.quantity,
          notes: '',
        })
      }
    }
  } catch (err) {
    console.error('Bulk validation failed:', err)
  }
}

function selectAmbiguousMatch(resultIndex, matchId) {
  const result = bulkResults.value[resultIndex]
  const match = result.matches.find(m => m.id === matchId)
  if (!match) return
  result.selectedMatch = matchId
  if (!orderItems.value.find(i => i.product_id === match.id)) {
    orderItems.value.push({
      product_id: match.id,
      product_code: match.product_code,
      product_name: match.product_name,
      part_type: match.part_type,
      dimension: match.dimension,
      material: match.material,
      variant_note: match.variant_note,
      category: match.category,
      quantity: result.quantity || 1,
      notes: '',
    })
  }
}

function selectVariantChoice(resultIndex, matchId) {
  const result = bulkResults.value[resultIndex]
  const match = result.matches.find(m => m.id === matchId)
  if (!match) return
  // Remove previously selected variant from order if switching
  if (result.selectedMatch && result.selectedMatch !== matchId) {
    const prevIdx = orderItems.value.findIndex(i => i.product_id === result.selectedMatch)
    if (prevIdx >= 0) orderItems.value.splice(prevIdx, 1)
  }
  result.selectedMatch = matchId
  if (!orderItems.value.find(i => i.product_id === match.id)) {
    orderItems.value.push({
      product_id: match.id,
      product_code: match.product_code,
      product_name: match.product_name,
      part_type: match.part_type,
      dimension: match.dimension,
      material: match.material,
      variant_note: match.variant_note,
      category: match.category,
      quantity: result.quantity || 1,
      notes: '',
    })
  }
}

// Conflict resolution: user picks which quantity to keep
function resolveConflict(resultIndex, chosenQty) {
  const result = bulkResults.value[resultIndex]
  if (!result.conflict) return
  result.conflict.resolved = true
  result.conflict.chosenQty = chosenQty
  result.conflict.orderItemRef.quantity = chosenQty
}

// Pending carry-forward conflict resolution
function resolvePendingConflict(resultIndex, action) {
  const result = bulkResults.value[resultIndex]
  if (!result.pendingConflict) return
  result.pendingConflict.action = action
  if (action === 'add_extra') {
    const match = result.matches[0]
    orderItems.value.push({
      product_id: match.id,
      product_code: match.product_code,
      product_name: match.product_name,
      material: match.material,
      part_type: match.part_type,
      dimension: match.dimension,
      variant_note: match.variant_note,
      category: match.category,
      quantity: result.quantity,
      notes: '',
    })
  }
  // 'skip' → item will only exist as auto-carried by backend
}

// Quick-add product inline
function openQuickAdd(resultIndex) {
  const result = bulkResults.value[resultIndex]
  quickAddForms.value[resultIndex] = {
    product_code: result.code,
    product_name: '',
    category: '',
    material: '',
    dimension: '',
    part_type: '',
    unit_weight_kg: '',
    saving: false,
    error: null,
  }
}

function cancelQuickAdd(resultIndex) {
  delete quickAddForms.value[resultIndex]
  quickAddForms.value = { ...quickAddForms.value }
}

async function submitQuickAdd(resultIndex) {
  const form = quickAddForms.value[resultIndex]
  if (!form || !form.product_name.trim()) {
    form.error = 'Product name is required'
    return
  }
  form.saving = true
  form.error = null
  try {
    const { data } = await productsApi.create({
      product_code: form.product_code,
      product_name: form.product_name.trim(),
      category: form.category || null,
      material: form.material || null,
      dimension: form.dimension || null,
      part_type: form.part_type || null,
      unit_weight_kg: form.unit_weight_kg ? parseFloat(form.unit_weight_kg) : null,
    })
    // Auto-add created product to order
    const result = bulkResults.value[resultIndex]
    orderItems.value.push({
      product_id: data.id,
      product_code: data.product_code,
      product_name: data.product_name,
      material: data.material,
      dimension: data.dimension,
      part_type: data.part_type,
      category: data.category,
      quantity: result.quantity || 1,
      notes: '',
    })
    // Mark result as created
    result.created = true
    result.status = 'CREATED'
    result.matches = [{ id: data.id, product_code: data.product_code, product_name: data.product_name, material: data.material, category: data.category }]
    delete quickAddForms.value[resultIndex]
    quickAddForms.value = { ...quickAddForms.value }
  } catch (err) {
    form.error = err.response?.data?.detail || 'Failed to create product'
  } finally {
    form.saving = false
  }
}

function closeBulkPaste() {
  showBulkPaste.value = false
  bulkText.value = ''
  bulkResults.value = []
  bulkProcessed.value = false
  quickAddForms.value = {}
  showBulkDoneWarning.value = false
}

function handleBulkDone() {
  if (bulkNotFoundCount.value > 0) {
    showBulkDoneWarning.value = true
  } else {
    closeBulkPaste()
  }
}

const bulkFoundCount = computed(() => bulkResults.value.filter(r => r.status === 'FOUND' && !r.conflict && !r.pendingConflict).length)
const bulkConflictCount = computed(() => bulkResults.value.filter(r => r.conflict).length)
const bulkPendingConflictCount = computed(() => bulkResults.value.filter(r => r.pendingConflict).length)
const bulkAmbiguousCount = computed(() => bulkResults.value.filter(r => r.status === 'AMBIGUOUS').length)
const bulkNotFoundCount = computed(() => bulkResults.value.filter(r => r.status === 'NOT_FOUND').length)
const bulkVariantChoiceCount = computed(() => bulkResults.value.filter(r => r.status === 'VARIANT_CHOICE').length)
const bulkVariantChoiceResolved = computed(() => bulkResults.value.filter(r => r.status === 'VARIANT_CHOICE' && r.selectedMatch).length)
const bulkCreatedCount = computed(() => bulkResults.value.filter(r => r.status === 'CREATED').length)
const bulkUnresolvedAmbiguous = computed(() =>
  bulkResults.value.filter(r => r.status === 'AMBIGUOUS' && !r.selectedMatch).length
)
const bulkUnresolvedConflicts = computed(() =>
  bulkResults.value.filter(r => r.conflict && !r.conflict.resolved).length
)
const bulkUnresolvedPendingConflicts = computed(() =>
  bulkResults.value.filter(r => r.pendingConflict && !r.pendingConflict.action).length
)

// ========================================
// Product Browser Modal (Query 3 fix)
// ========================================
async function openProductBrowser() {
  showProductBrowser.value = true
  browserSearch.value = ''
  browserCategory.value = ''
  browserSelected.value = new Set()
  browserPage.value = 1
  await loadBrowserProducts()
}

async function loadBrowserProducts() {
  browserLoading.value = true
  try {
    const params = { page: browserPage.value, per_page: browserPerPage }
    if (browserSearch.value) params.search = browserSearch.value
    if (browserCategory.value) params.category = browserCategory.value
    const { data } = await productsApi.list(params)
    browserProducts.value = data.items
    browserTotal.value = data.total
  } catch (err) {
    console.error('Failed to load products:', err)
  } finally {
    browserLoading.value = false
  }
}

let browserSearchTimer = null
function onBrowserSearch() {
  clearTimeout(browserSearchTimer)
  browserSearchTimer = setTimeout(() => {
    browserPage.value = 1
    loadBrowserProducts()
  }, 400)
}

function onBrowserCategoryChange() {
  browserPage.value = 1
  loadBrowserProducts()
}

function toggleBrowserSelect(product) {
  const set = new Set(browserSelected.value)
  if (set.has(product.id)) {
    set.delete(product.id)
  } else {
    set.add(product.id)
  }
  browserSelected.value = set
}

function isAlreadyAdded(productId) {
  return orderItems.value.some(i => i.product_id === productId)
}

function toggleSelectAllOnPage() {
  const selectableOnPage = browserProducts.value.filter(p => !isAlreadyAdded(p.id))
  const allSelected = selectableOnPage.every(p => browserSelected.value.has(p.id))
  const set = new Set(browserSelected.value)
  if (allSelected) {
    // Deselect all on this page
    selectableOnPage.forEach(p => set.delete(p.id))
  } else {
    // Select all on this page
    selectableOnPage.forEach(p => set.add(p.id))
  }
  browserSelected.value = set
}

const isAllOnPageSelected = computed(() => {
  const selectableOnPage = browserProducts.value.filter(p => !isAlreadyAdded(p.id))
  return selectableOnPage.length > 0 && selectableOnPage.every(p => browserSelected.value.has(p.id))
})

const isSomeOnPageSelected = computed(() => {
  const selectableOnPage = browserProducts.value.filter(p => !isAlreadyAdded(p.id))
  return selectableOnPage.some(p => browserSelected.value.has(p.id)) && !isAllOnPageSelected.value
})

function addBrowserSelected() {
  for (const product of browserProducts.value) {
    if (browserSelected.value.has(product.id) && !isAlreadyAdded(product.id)) {
      orderItems.value.push({
        product_id: product.id,
        product_code: product.product_code,
        product_name: product.product_name,
        material: product.material,
        category: product.category,
        quantity: product.moq || 1,
        notes: '',
      })
    }
  }
  showProductBrowser.value = false
}

const browserTotalPages = computed(() => Math.ceil(browserTotal.value / browserPerPage))
const browserSelectableCount = computed(() =>
  browserProducts.value.filter(p => !isAlreadyAdded(p.id)).length
)

function browserGoToPage(p) {
  if (p >= 1 && p <= browserTotalPages.value) {
    browserPage.value = p
    loadBrowserProducts()
  }
}

// ========================================
// Validation & Submit
// ========================================
function validate() {
  errors.value = {}
  if (!form.value.client_id) errors.value.client_id = 'Please select a client'
  if (orderItems.value.length === 0) errors.value.items = 'Add at least one product'
  orderItems.value.forEach((item, i) => {
    if (!item.quantity || item.quantity < 1) errors.value[`qty_${i}`] = 'Min 1'
  })
  return Object.keys(errors.value).length === 0
}

async function handleSubmit() {
  if (!validate()) return
  // Show carry confirmation if pending items exist and user hasn't confirmed yet
  if (pendingUnloaded.value.length > 0 && !showCarryConfirm.value) {
    showCarryConfirm.value = true
    return
  }
  showCarryConfirm.value = false
  saving.value = true
  errors.value = {}
  try {
    const payload = {
      client_id: form.value.client_id,
      factory_id: form.value.factory_id || null,
      currency: form.value.currency,
      po_reference: form.value.po_reference || null,
      notes: form.value.notes || null,
      items: orderItems.value.map(item => ({
        product_id: item.product_id,
        quantity: parseInt(item.quantity),
        notes: item.notes || null,
      })),
    }
    const { data } = await ordersApi.create(payload)
    const carriedCount = data.carried_count || 0
    if (carriedCount > 0) {
      router.push(`/orders/${data.id}?carried=${carriedCount}`)
    } else {
      successMsg.value = 'Order created successfully!'
      setTimeout(() => router.push(`/orders/${data.id}`), 600)
    }
  } catch (err) {
    const detail = err.response?.data?.detail
    errors.value.general = typeof detail === 'string' ? detail : 'Failed to create order'
  } finally {
    saving.value = false
  }
}

const totalItems = computed(() => orderItems.value.length)

onMounted(() => {
  loadClients()
  loadFactories()
  loadCategories()
})
</script>

<template>
  <div class="max-w-5xl">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <button @click="router.push('/orders')" class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
        <i class="pi pi-arrow-left" />
      </button>
      <div>
        <h2 class="text-lg font-semibold text-slate-800">New Order (Draft)</h2>
        <p class="text-sm text-slate-500">Stage 1 — Select client, factory, and add products</p>
      </div>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div v-if="successMsg" class="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
        <i class="pi pi-check-circle" /> {{ successMsg }}
      </div>
      <div v-if="errors.general" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
        <i class="pi pi-exclamation-circle" /> {{ errors.general }}
      </div>

      <!-- Order Header -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          <i class="pi pi-file-edit mr-2 text-emerald-500" />Order Details
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-sm font-medium text-slate-700">Client <span class="text-red-500">*</span></label>
              <button type="button" @click="showClientModal = true" class="text-xs text-emerald-600 hover:text-emerald-700 font-medium">+ New Client</button>
            </div>
            <select v-model="form.client_id" :class="['w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500', errors.client_id ? 'border-red-300 bg-red-50' : 'border-slate-200']">
              <option value="">Select client</option>
              <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.company_name }}</option>
            </select>
            <p v-if="errors.client_id" class="mt-1 text-xs text-red-500">{{ errors.client_id }}</p>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-sm font-medium text-slate-700">Factory</label>
              <button type="button" @click="showFactoryModal = true" class="text-xs text-emerald-600 hover:text-emerald-700 font-medium">+ New Factory</button>
            </div>
            <select v-model="form.factory_id" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">Select factory (optional)</option>
              <option v-for="f in factories" :key="f.id" :value="f.id">{{ f.company_name }}</option>
            </select>
            <p class="mt-1 text-xs text-slate-400">Required before submitting to next stage</p>
          </div>

          <!-- Currency Section: Factory + Client -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Factory Currency</label>
            <select v-model="form.currency" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option v-for="c in currencies" :key="c" :value="c">{{ c }}</option>
            </select>
            <p class="mt-1 text-xs text-slate-400">Currency for factory price quotation (buying price)</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Client Currency</label>
            <div class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700 font-medium flex items-center gap-2">
              <span class="text-base">&#8377;</span> INR (Indian Rupee)
            </div>
            <p class="mt-1 text-xs text-slate-400">Selling prices to client are always in INR. Converted using exchange rate.</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">PO Reference</label>
            <input v-model="form.po_reference" type="text" placeholder="Client PO number (optional)" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea v-model="form.notes" rows="2" placeholder="Order notes..." class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </div>
        </div>
      </div>

      <!-- Products Section -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider">
            <i class="pi pi-box mr-2 text-blue-500" />Products ({{ totalItems }} items)
          </h3>
          <div class="flex items-center gap-2">
            <!-- Query 3: Product Browser button -->
            <button type="button" @click="openProductBrowser" class="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1 px-3 py-1.5 border border-emerald-200 rounded-lg hover:bg-emerald-50 transition-colors">
              <i class="pi pi-th-large text-xs" /> Browse Products
            </button>
            <button type="button" @click="showBulkPaste = true" class="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 px-3 py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
              <i class="pi pi-clipboard text-xs" /> Bulk Paste
            </button>
          </div>
        </div>

        <p v-if="errors.items" class="text-xs text-red-500 mb-3">{{ errors.items }}</p>

        <!-- Pending After-Sales Claims Banner (HIGHER PRIORITY) -->
        <div v-if="pendingAfterSales.length > 0" class="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg">
          <div class="flex items-center gap-2 mb-2">
            <i class="pi pi-exclamation-circle text-rose-600" />
            <span class="text-sm font-semibold text-rose-800">
              {{ pendingAfterSales.length }} after-sales claim{{ pendingAfterSales.length > 1 ? 's' : '' }} — MANDATORY carry-forward
            </span>
          </div>
          <p class="text-xs text-rose-700 mb-2">
            These after-sales items from previous orders (same client + factory) will be automatically added. Replacements at ₹0, compensations as negative balance.
          </p>
          <div class="space-y-1">
            <div v-for="item in pendingAfterSales" :key="item.id" class="flex items-center gap-2 text-xs text-rose-700">
              <span class="font-mono font-medium">{{ item.product_code }}</span>
              <span class="text-rose-600">{{ item.product_name }}</span>
              <span class="text-rose-500">x{{ item.affected_quantity }}</span>
              <span class="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-medium">
                {{ item.resolution_type?.replace(/_/g, ' ') }}
              </span>
              <span class="text-rose-400 text-[10px]">from {{ item.order_number }}</span>
            </div>
          </div>
        </div>

        <!-- Pending Unloaded Items Banner -->
        <div v-if="pendingUnloaded.length > 0" class="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div class="flex items-center gap-2 mb-2">
            <i class="pi pi-exclamation-triangle text-amber-600" />
            <span class="text-sm font-semibold text-amber-800">
              {{ pendingUnloaded.length }} unloaded item{{ pendingUnloaded.length > 1 ? 's' : '' }} will be auto-carried
            </span>
          </div>
          <p class="text-xs text-amber-700 mb-2">
            These items from previous orders (same client + factory) will be automatically added when you create this order.
          </p>
          <div class="space-y-1">
            <div v-for="item in pendingUnloaded" :key="item.id" class="flex items-center gap-2 text-xs text-amber-700">
              <span class="font-mono font-medium">{{ item.product_code }}</span>
              <span class="text-amber-600">{{ item.product_name }}</span>
              <span class="text-amber-500">x{{ item.quantity }}</span>
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                from {{ item.original_order_number }}
              </span>
            </div>
          </div>
        </div>
        <div v-else-if="loadingPending" class="mb-4 p-2 text-xs text-slate-400 flex items-center gap-2">
          <i class="pi pi-spin pi-spinner text-xs" /> Checking for carry-forward items...
        </div>

        <!-- Product Search -->
        <div class="relative mb-4">
          <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
          <input v-model="productSearch" @input="onProductSearch" type="text" placeholder="Search products by code or name..." class="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <div v-if="productResults.length > 0" class="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-slate-200 max-h-64 overflow-y-auto z-20">
            <button v-for="p in productResults" :key="p.id" type="button" @click="addProduct(p)"
              :class="['w-full text-left px-4 py-2.5 border-b border-slate-100 last:border-0 transition-colors',
                p.pendingCF ? 'hover:bg-violet-50 bg-violet-50/30' : 'hover:bg-emerald-50'
              ]"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-sm font-mono font-medium text-slate-800">{{ p.product_code }}</span>
                  <span class="text-sm text-slate-600">{{ p.product_name }}</span>
                  <span v-if="p.pendingCF"
                    :class="['inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold',
                      p.pendingCF.type === 'unloaded' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                    ]"
                  >
                    <i class="pi pi-replay text-[8px]" />
                    {{ p.pendingCF.type === 'unloaded' ? 'Unloaded' : 'After-Sales' }} (qty: {{ p.pendingCF.qty }}) from {{ p.pendingCF.from }}
                  </span>
                </div>
                <i class="pi pi-plus text-emerald-500 text-xs flex-shrink-0" />
              </div>
              <div class="text-xs text-slate-400 mt-0.5">{{ [p.part_type, p.dimension, p.material, p.category].filter(Boolean).join(' · ') }}</div>
            </button>
          </div>
          <div v-if="searchingProducts" class="absolute right-3 top-1/2 -translate-y-1/2">
            <i class="pi pi-spin pi-spinner text-sm text-slate-400" />
          </div>
        </div>

        <!-- Items Table -->
        <div v-if="orderItems.length > 0" class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200">
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">#</th>
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Code</th>
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Product</th>
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Type</th>
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Size</th>
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Material</th>
                <th class="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Qty</th>
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Notes</th>
                <th class="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(item, index) in orderItems" :key="item.product_id" class="hover:bg-slate-50">
                <td class="px-3 py-2 text-xs text-slate-400">{{ index + 1 }}</td>
                <td class="px-3 py-2 text-sm font-mono text-slate-800">{{ item.product_code }}</td>
                <td class="px-3 py-2 text-sm text-slate-700">{{ item.product_name }}</td>
                <td class="px-3 py-2">
                  <span v-if="item.part_type" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-700">{{ item.part_type }}</span>
                  <span v-else class="text-sm text-slate-300">—</span>
                </td>
                <td class="px-3 py-2 text-sm text-slate-500">{{ item.dimension || '—' }}</td>
                <td class="px-3 py-2 text-sm text-slate-500">{{ item.material || '—' }}</td>
                <td class="px-3 py-2 text-center">
                  <input v-model.number="item.quantity" type="number" min="1" :class="['w-20 px-2 py-1 border rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500', errors[`qty_${index}`] ? 'border-red-300' : 'border-slate-200']" />
                </td>
                <td class="px-3 py-2">
                  <input v-model="item.notes" type="text" placeholder="Item note" class="w-full px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </td>
                <td class="px-3 py-2 text-right">
                  <button type="button" @click="removeItem(index)" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                    <i class="pi pi-times text-xs" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="text-center py-8 text-slate-400">
          <i class="pi pi-box text-3xl mb-2 block" />
          <p class="text-sm">Search and add products above, browse the catalog, or use bulk paste</p>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-3 justify-end">
        <button type="button" @click="router.push('/orders')" class="px-6 py-2.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600">Cancel</button>
        <button type="submit" :disabled="saving" class="px-6 py-2.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
          <i v-if="saving" class="pi pi-spin pi-spinner text-sm" />
          <i v-else class="pi pi-check text-sm" />
          Create Draft Order
        </button>
      </div>
    </form>

    <!-- ==========================================
         Bulk Paste Modal (Query 1 fix: enhanced)
         ========================================== -->
    <div v-if="showBulkPaste" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="closeBulkPaste">
      <div class="bg-white rounded-xl shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-slate-800">Bulk Paste Product Codes</h3>
          <button @click="closeBulkPaste" class="p-1 text-slate-400 hover:text-slate-600"><i class="pi pi-times" /></button>
        </div>

        <!-- Input area (before processing) -->
        <div v-if="!bulkProcessed">
          <p class="text-sm text-slate-500 mb-3">Paste product codes with quantities (one per line). Format: <span class="font-mono font-medium text-slate-700">PartCode Quantity</span></p>
          <textarea v-model="bulkText" rows="8" placeholder="AH-ENG-001 5&#10;AH-HYD-005 2&#10;AH-ELC-003 10" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none mb-3" />
          <p class="text-xs text-slate-400 mb-3"><i class="pi pi-info-circle text-[10px] mr-1" />If quantity is omitted, defaults to 1</p>
          <div class="flex gap-3 justify-end">
            <button @click="closeBulkPaste" class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button @click="processBulkPaste" class="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">Validate & Add</button>
          </div>
        </div>

        <!-- Results area (after processing) -->
        <div v-else class="flex flex-col min-h-0">
          <!-- Summary badges -->
          <div class="flex flex-wrap gap-2 mb-4">
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
              <i class="pi pi-check-circle text-[10px]" /> {{ bulkFoundCount }} Found
            </span>
            <span v-if="bulkVariantChoiceCount > 0" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
              <i class="pi pi-sitemap text-[10px]" /> {{ bulkVariantChoiceResolved }}/{{ bulkVariantChoiceCount }} Variants
            </span>
            <span v-if="bulkPendingConflictCount > 0" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700">
              <i class="pi pi-exclamation-circle text-[10px]" /> {{ bulkPendingConflictCount }} Carry-Forward Duplicate{{ bulkPendingConflictCount > 1 ? 's' : '' }}
            </span>
            <span v-if="bulkConflictCount > 0" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700">
              <i class="pi pi-replay text-[10px]" /> {{ bulkConflictCount }} Carried Conflict{{ bulkConflictCount > 1 ? 's' : '' }}
            </span>
            <span v-if="bulkAmbiguousCount > 0" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
              <i class="pi pi-exclamation-triangle text-[10px]" /> {{ bulkAmbiguousCount }} Ambiguous
            </span>
            <span v-if="bulkNotFoundCount > 0" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700">
              <i class="pi pi-times-circle text-[10px]" /> {{ bulkNotFoundCount }} Not Found
            </span>
            <span v-if="bulkCreatedCount > 0" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
              <i class="pi pi-plus-circle text-[10px]" /> {{ bulkCreatedCount }} Created
            </span>
          </div>

          <!-- Results list -->
          <div class="overflow-y-auto flex-1 mb-4 max-h-[50vh] space-y-3">

            <!-- ===== SECTION 1: Missing Products (NOT_FOUND) — shown first ===== -->
            <div v-if="bulkNotFoundCount > 0" class="border-2 border-red-200 bg-red-50/40 rounded-xl p-3">
              <h4 class="flex items-center gap-2 text-sm font-semibold text-red-700 mb-3">
                <i class="pi pi-exclamation-triangle" />
                Missing Products ({{ bulkNotFoundCount }})
                <span class="text-xs font-normal text-red-500">— These will NOT be added unless created</span>
              </h4>
              <div class="space-y-1">
                <template v-for="(result, rIdx) in bulkResults" :key="'nf-' + result.code">
                  <div v-if="result.status === 'NOT_FOUND'" class="border border-red-100 bg-white rounded-lg p-3">
                    <div class="flex items-center gap-2">
                      <i class="pi pi-times-circle text-sm text-red-400" />
                      <span class="font-mono text-sm font-medium text-slate-800">{{ result.code }}</span>
                      <span class="font-mono text-xs text-slate-500">x{{ result.quantity }}</span>
                      <span class="text-xs px-1.5 py-0.5 rounded font-medium bg-red-50 text-red-600">NOT_FOUND</span>
                    </div>
                    <div class="mt-2 ml-7">
                      <div class="flex items-center gap-3">
                        <p class="text-xs text-slate-400">This code is not in the product catalog.</p>
                        <button
                          v-if="!quickAddForms[rIdx]"
                          @click="openQuickAdd(rIdx)"
                          class="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          <i class="pi pi-plus-circle text-[10px]" /> Quick Add Product
                        </button>
                      </div>
                      <!-- Inline quick-add form -->
                      <div v-if="quickAddForms[rIdx]" class="mt-2 p-3 bg-blue-50/50 border border-blue-200 rounded-lg space-y-2">
                        <div>
                          <label class="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Code</label>
                          <input :value="result.code" disabled class="w-full px-2 py-1 border border-slate-200 rounded text-sm font-mono bg-slate-100 text-slate-500" />
                        </div>
                        <div>
                          <label class="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Product Name <span class="text-red-400">*</span></label>
                          <input v-model="quickAddForms[rIdx].product_name" placeholder="Enter product name..." class="w-full px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        </div>
                        <div class="grid grid-cols-3 gap-2">
                          <div>
                            <label class="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Category</label>
                            <input
                              v-model="quickAddForms[rIdx].category"
                              list="quick-add-category-list"
                              placeholder="Select or type new"
                              class="w-full px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                            <datalist id="quick-add-category-list">
                              <option v-for="cat in categories" :key="cat" :value="cat" />
                            </datalist>
                          </div>
                          <div>
                            <label class="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Size / Dimension</label>
                            <input v-model="quickAddForms[rIdx].dimension" placeholder="e.g. 270*122*70" class="w-full px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          </div>
                          <div>
                            <label class="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Weight (kg)</label>
                            <input v-model="quickAddForms[rIdx].unit_weight_kg" type="number" step="0.01" placeholder="e.g. 1.5" class="w-full px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          </div>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                          <div>
                            <label class="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Type</label>
                            <select v-model="quickAddForms[rIdx].part_type" class="w-full px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                              <option value="">None</option>
                              <option value="Original">Original</option>
                              <option value="Copy">Copy</option>
                              <option value="OEM">OEM</option>
                              <option value="Aftermarket">Aftermarket</option>
                            </select>
                          </div>
                          <div>
                            <label class="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Material</label>
                            <input v-model="quickAddForms[rIdx].material" placeholder="e.g. Steel" class="w-full px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                          </div>
                        </div>
                        <p v-if="quickAddForms[rIdx]?.error" class="text-xs text-red-500">{{ quickAddForms[rIdx].error }}</p>
                        <div class="flex gap-2 justify-end">
                          <button @click="cancelQuickAdd(rIdx)" class="px-3 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50">Cancel</button>
                          <button @click="submitQuickAdd(rIdx)" :disabled="quickAddForms[rIdx]?.saving" class="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-medium disabled:opacity-50">
                            <i v-if="quickAddForms[rIdx]?.saving" class="pi pi-spin pi-spinner text-[10px] mr-1" />
                            Create & Add
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </div>

            <!-- ===== SECTION 1.5: Carry-Forward Duplicates ===== -->
            <div v-if="bulkPendingConflictCount > 0" class="border-2 border-violet-200 bg-violet-50/40 rounded-xl p-3">
              <h4 class="flex items-center gap-2 text-sm font-semibold text-violet-700 mb-3">
                <i class="pi pi-exclamation-circle" />
                Carry-Forward Duplicates ({{ bulkPendingConflictCount }})
                <span class="text-xs font-normal text-violet-500">— These are already pending as carry-forward</span>
              </h4>
              <div class="space-y-2">
                <template v-for="(result, rIdx) in bulkResults" :key="'pc-' + result.code">
                  <div v-if="result.pendingConflict" class="border border-violet-100 bg-white rounded-lg p-3">
                    <div class="flex items-center gap-2">
                      <i class="pi pi-exclamation-circle text-sm text-violet-500" />
                      <span class="font-mono text-sm font-medium text-slate-800">{{ result.code }}</span>
                      <span class="font-mono text-xs text-slate-500">x{{ result.quantity }}</span>
                      <span class="text-xs px-1.5 py-0.5 rounded font-medium bg-violet-100 text-violet-700">DUPLICATE</span>
                    </div>
                    <div class="mt-1 ml-7">
                      <p class="text-xs text-slate-600">
                        {{ result.matches[0].product_name }}
                        <span v-if="result.matches[0].part_type || result.matches[0].dimension || result.matches[0].material" class="text-slate-400"> · {{ [result.matches[0].part_type, result.matches[0].dimension, result.matches[0].material].filter(Boolean).join(' · ') }}</span>
                      </p>
                      <div class="mt-2 p-2.5 border rounded-lg" :class="result.pendingConflict.type === 'unloaded' ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'">
                        <p class="text-xs mb-2" :class="result.pendingConflict.type === 'unloaded' ? 'text-amber-800' : 'text-rose-800'">
                          <i class="pi text-[10px] mr-1" :class="result.pendingConflict.type === 'unloaded' ? 'pi-replay' : 'pi-exclamation-circle'" />
                          Already pending as
                          <span class="font-semibold">{{ result.pendingConflict.type === 'unloaded' ? 'Unloaded Item' : 'After-Sales Return' }}</span>
                          from <span class="font-semibold">{{ result.pendingConflict.from }}</span>
                          (qty: <span class="font-semibold">{{ result.pendingConflict.carriedQty }}</span>).
                          <span v-if="result.pendingConflict.resolution" class="opacity-75">
                            Resolution: {{ result.pendingConflict.resolution.replace(/_/g, ' ') }}
                          </span>
                        </p>
                        <div v-if="!result.pendingConflict.action" class="flex gap-2">
                          <button
                            @click="resolvePendingConflict(rIdx, 'add_extra')"
                            class="px-3 py-1.5 text-xs rounded-lg font-medium border transition-colors bg-white border-slate-200 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700"
                          >
                            <i class="pi pi-plus text-[10px] mr-1" /> Add as Extra Line (qty: {{ result.pendingConflict.newQty }})
                          </button>
                          <button
                            @click="resolvePendingConflict(rIdx, 'skip')"
                            class="px-3 py-1.5 text-xs rounded-lg font-medium border transition-colors bg-violet-100 border-violet-300 text-violet-800 hover:bg-violet-200"
                          >
                            <i class="pi pi-check text-[10px] mr-1" /> Skip (auto-carried)
                          </button>
                        </div>
                        <p v-else class="text-xs font-medium" :class="result.pendingConflict.action === 'add_extra' ? 'text-emerald-600' : 'text-violet-600'">
                          <i class="pi pi-check text-[10px] mr-1" />
                          {{ result.pendingConflict.action === 'add_extra'
                            ? `Added as extra line (qty: ${result.pendingConflict.newQty})`
                            : 'Skipped — will only appear as carry-forward'
                          }}
                        </p>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </div>

            <!-- ===== SECTION 1.75: Choose Variant (multi-variant products) ===== -->
            <div v-if="bulkVariantChoiceCount > 0" class="border-2 border-indigo-200 bg-indigo-50/40 rounded-xl p-3 mb-3">
              <h4 class="flex items-center gap-2 text-sm font-semibold text-indigo-700 mb-2">
                <i class="pi pi-sitemap text-xs" />
                Choose Variant ({{ bulkVariantChoiceResolved }}/{{ bulkVariantChoiceCount }})
                <span class="text-xs font-normal text-indigo-500">— these products have multiple variants, pick the right one</span>
              </h4>
              <div class="space-y-2">
                <template v-for="(result, rIdx) in bulkResults" :key="'vc-'+rIdx">
                  <div v-if="result.status === 'VARIANT_CHOICE'" class="bg-white rounded-lg p-3 border border-indigo-100">
                    <div class="flex items-center gap-2">
                      <i class="pi pi-box text-indigo-400 text-xs" />
                      <span class="font-mono text-sm font-medium text-slate-800">{{ result.code }}</span>
                      <span class="text-xs text-slate-400">x{{ result.quantity }}</span>
                      <span class="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">{{ result.matches.length }} variants</span>
                    </div>
                    <div class="mt-2 ml-5 space-y-1">
                      <label v-for="m in result.matches" :key="m.id"
                        class="flex items-center gap-2 p-1.5 rounded-lg cursor-pointer transition-colors"
                        :class="result.selectedMatch === m.id ? 'bg-emerald-50 border border-emerald-200' : 'hover:bg-slate-50 border border-transparent'"
                      >
                        <input type="radio" :name="'variant-'+rIdx" :value="m.id"
                          :checked="result.selectedMatch === m.id"
                          @change="selectVariantChoice(rIdx, m.id)"
                          class="text-emerald-600 focus:ring-emerald-500" />
                        <span class="text-xs text-slate-700">{{ m.product_name }}</span>
                        <span v-if="m.dimension || m.material || m.part_type" class="text-xs text-slate-400">
                          · {{ [m.part_type, m.dimension, m.material].filter(Boolean).join(' · ') }}
                        </span>
                        <span v-if="m.category" class="text-xs text-indigo-400">· {{ m.category }}</span>
                        <span v-if="m.is_default" class="text-xs text-amber-500">⭐ default</span>
                      </label>
                    </div>
                    <p v-if="result.selectedMatch" class="mt-1 ml-5 text-xs text-emerald-600">
                      <i class="pi pi-check text-[10px]" /> Added (qty: {{ result.quantity }})
                    </p>
                    <p v-else class="mt-1 ml-5 text-xs text-amber-600">
                      <i class="pi pi-info-circle text-[10px]" /> Select a variant to add to order
                    </p>
                  </div>
                </template>
              </div>
            </div>

            <!-- ===== SECTION 2: Matched Products (FOUND + CONFLICT + AMBIGUOUS + CREATED) ===== -->
            <div>
              <h4 v-if="bulkNotFoundCount > 0 || bulkPendingConflictCount > 0" class="flex items-center gap-2 text-sm font-semibold text-slate-600 mb-2 mt-1">
                <i class="pi pi-check-circle text-emerald-500" />
                Matched Products ({{ bulkFoundCount + bulkConflictCount + bulkAmbiguousCount + bulkCreatedCount }})
              </h4>
              <div class="space-y-1">
                <template v-for="(result, rIdx) in bulkResults" :key="'m-' + result.code">
                  <div v-if="result.status !== 'NOT_FOUND' && !result.pendingConflict"
                    :class="[
                      'border rounded-lg p-3',
                      result.conflict ? 'border-orange-200 bg-orange-50/30' :
                      result.status === 'CREATED' ? 'border-blue-200 bg-blue-50/30' :
                      'border-slate-100'
                    ]"
                  >
                    <div class="flex items-center gap-2">
                      <i :class="['pi text-sm',
                        result.status === 'FOUND' && !result.conflict ? 'pi-check-circle text-emerald-500' :
                        result.status === 'CREATED' ? 'pi-plus-circle text-blue-500' :
                        result.conflict ? 'pi-replay text-orange-500' :
                        result.status === 'AMBIGUOUS' ? 'pi-exclamation-triangle text-amber-500' :
                        'pi-times-circle text-red-400'
                      ]" />
                      <span class="font-mono text-sm font-medium text-slate-800">{{ result.code }}</span>
                      <span class="font-mono text-xs text-slate-500">x{{ result.quantity }}</span>
                      <span :class="['text-xs px-1.5 py-0.5 rounded font-medium',
                        result.conflict ? 'bg-orange-100 text-orange-700' :
                        result.status === 'FOUND' ? 'bg-emerald-50 text-emerald-600' :
                        result.status === 'CREATED' ? 'bg-blue-50 text-blue-600' :
                        result.status === 'AMBIGUOUS' ? 'bg-amber-50 text-amber-600' :
                        'bg-red-50 text-red-600'
                      ]">
                        {{ result.conflict ? 'CONFLICT' : result.status }}
                      </span>
                    </div>

                    <!-- FOUND (no conflict): show matched product name -->
                    <div v-if="result.status === 'FOUND' && !result.conflict" class="mt-1 ml-7 text-xs text-slate-500">
                      {{ result.matches[0].product_name }}
                      <span v-if="result.matches[0].part_type || result.matches[0].dimension || result.matches[0].material" class="text-slate-400"> · {{ [result.matches[0].part_type, result.matches[0].dimension, result.matches[0].material].filter(Boolean).join(' · ') }}</span>
                      <span v-if="result.matches.length > 1" class="text-amber-500 ml-1" title="Auto-selected default variant">⭐ default</span>
                      <span class="text-emerald-600 ml-2">Added (qty: {{ result.quantity }})</span>
                    </div>

                    <!-- CREATED: show created product -->
                    <div v-if="result.status === 'CREATED'" class="mt-1 ml-7 text-xs text-blue-600">
                      <i class="pi pi-check text-[10px]" /> Created & added: {{ result.matches[0].product_name }} (qty: {{ result.quantity }})
                    </div>

                    <!-- CONFLICT: carried item conflict resolution -->
                    <div v-if="result.conflict" class="mt-2 ml-7">
                      <p class="text-xs text-slate-600">
                        {{ result.matches[0].product_name }}
                        <span v-if="result.matches[0].part_type || result.matches[0].dimension || result.matches[0].material" class="text-slate-400"> · {{ [result.matches[0].part_type, result.matches[0].dimension, result.matches[0].material].filter(Boolean).join(' · ') }}</span>
                      </p>
                      <div class="mt-2 p-2.5 bg-orange-50 border border-orange-200 rounded-lg">
                        <p class="text-xs text-orange-800 mb-2">
                          <i class="pi pi-replay text-[10px] mr-1" />
                          Carried from <span class="font-semibold">{{ result.conflict.carriedSource }}</span>
                          with qty <span class="font-semibold">{{ result.conflict.carriedQty }}</span>.
                          New paste qty: <span class="font-semibold">{{ result.conflict.newQty }}</span>.
                        </p>
                        <div v-if="!result.conflict.resolved" class="flex gap-2">
                          <button
                            @click="resolveConflict(rIdx, result.conflict.carriedQty)"
                            :class="['px-3 py-1.5 text-xs rounded-lg font-medium border transition-colors',
                              result.conflict.carriedQty >= result.conflict.newQty
                                ? 'bg-orange-100 border-orange-300 text-orange-800 hover:bg-orange-200'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            ]"
                          >
                            Keep qty {{ result.conflict.carriedQty }} (carried)
                          </button>
                          <button
                            @click="resolveConflict(rIdx, result.conflict.newQty)"
                            :class="['px-3 py-1.5 text-xs rounded-lg font-medium border transition-colors',
                              result.conflict.newQty > result.conflict.carriedQty
                                ? 'bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            ]"
                          >
                            Use qty {{ result.conflict.newQty }} (new)
                          </button>
                        </div>
                        <p v-else class="text-xs text-emerald-600 font-medium">
                          <i class="pi pi-check text-[10px] mr-1" /> Updated to qty {{ result.conflict.chosenQty }}
                        </p>
                      </div>
                    </div>

                    <!-- AMBIGUOUS: variant picker dropdown -->
                    <div v-if="result.status === 'AMBIGUOUS'" class="mt-2 ml-7">
                      <p class="text-xs text-amber-600 mb-1">{{ result.matches.length }} products share this code. Select the correct variant:</p>
                      <select
                        :value="result.selectedMatch || ''"
                        @change="selectAmbiguousMatch(rIdx, $event.target.value)"
                        class="w-full px-2 py-1.5 border border-amber-200 rounded-lg text-sm bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      >
                        <option value="" disabled>Pick a variant...</option>
                        <option v-for="m in result.matches" :key="m.id" :value="m.id">
                          {{ m.product_name }} {{ [m.part_type, m.dimension, m.material].filter(Boolean).length ? `(${[m.part_type, m.dimension, m.material].filter(Boolean).join(' · ')})` : '' }}
                        </option>
                      </select>
                      <p v-if="result.selectedMatch" class="text-xs text-emerald-600 mt-1"><i class="pi pi-check text-[10px]" /> Added to order (qty: {{ result.quantity }})</p>
                    </div>
                  </div>
                </template>
              </div>
            </div>

          </div>

          <!-- Done warning for unresolved NOT_FOUND items -->
          <div v-if="showBulkDoneWarning" class="mb-3 p-3 bg-amber-50 border border-amber-300 rounded-lg">
            <p class="text-sm text-amber-800 font-medium mb-2">
              <i class="pi pi-exclamation-triangle mr-1" />
              {{ bulkNotFoundCount }} product{{ bulkNotFoundCount > 1 ? 's were' : ' was' }} not found and will <strong>NOT</strong> be added to the order.
            </p>
            <p class="text-xs text-amber-600 mb-3">You can go back and use "Quick Add Product" to create them, or skip and continue without them.</p>
            <div class="flex gap-2 justify-end">
              <button @click="showBulkDoneWarning = false" class="px-3 py-1.5 text-xs border border-slate-200 rounded-lg hover:bg-white font-medium">
                Go Back
              </button>
              <button @click="closeBulkPaste" class="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium">
                Skip & Done
              </button>
            </div>
          </div>

          <!-- Footer actions -->
          <div class="flex items-center justify-between pt-3 border-t border-slate-200">
            <div class="text-xs text-slate-400">
              <span v-if="bulkUnresolvedPendingConflicts > 0">{{ bulkUnresolvedPendingConflicts }} carry-forward duplicate{{ bulkUnresolvedPendingConflicts > 1 ? 's' : '' }} need resolution</span>
              <span v-else-if="bulkUnresolvedConflicts > 0">{{ bulkUnresolvedConflicts }} conflict{{ bulkUnresolvedConflicts > 1 ? 's' : '' }} need resolution</span>
              <span v-else-if="bulkUnresolvedAmbiguous > 0">{{ bulkUnresolvedAmbiguous }} ambiguous item{{ bulkUnresolvedAmbiguous > 1 ? 's' : '' }} still need selection</span>
              <span v-else-if="bulkNotFoundCount > 0">{{ bulkNotFoundCount }} code{{ bulkNotFoundCount > 1 ? 's' : '' }} not found — quick-add or skip</span>
              <span v-else>All items resolved</span>
            </div>
            <div class="flex gap-3">
              <button @click="bulkProcessed = false; showBulkDoneWarning = false" class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
                <i class="pi pi-arrow-left text-xs mr-1" /> Back
              </button>
              <button @click="handleBulkDone" class="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==========================================
         Carry Forward Confirmation Modal
         ========================================== -->
    <div v-if="showCarryConfirm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showCarryConfirm = false">
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        <div class="bg-amber-50 border-b border-amber-200 px-6 py-4 flex items-center gap-3">
          <div class="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
            <i class="pi pi-exclamation-triangle text-amber-600 text-lg" />
          </div>
          <h3 class="text-lg font-semibold text-amber-800">Items Will Be Carried Forward</h3>
        </div>
        <div class="px-6 py-4">
          <p class="text-sm text-slate-600 mb-3">
            {{ pendingUnloaded.length }} unloaded item{{ pendingUnloaded.length > 1 ? 's' : '' }} from previous orders will be automatically added to this new order:
          </p>
          <div class="space-y-2 max-h-48 overflow-y-auto">
            <div v-for="item in pendingUnloaded" :key="item.id" class="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-3 py-2">
              <div>
                <span class="font-mono font-medium text-slate-800">{{ item.product_code }}</span>
                <span class="text-slate-600 ml-1">{{ item.product_name }}</span>
              </div>
              <div class="text-right">
                <span class="font-medium text-slate-700">x{{ item.quantity }}</span>
                <div class="text-[10px] text-amber-600">from {{ item.original_order_number }}</div>
              </div>
            </div>
          </div>
        </div>
        <div class="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end">
          <button @click="showCarryConfirm = false" class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
          <button @click="handleSubmit" :disabled="saving" class="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50 flex items-center gap-2">
            <i v-if="saving" class="pi pi-spin pi-spinner text-xs" />
            Create Order with Carried Items
          </button>
        </div>
      </div>
    </div>

    <!-- ==========================================
         Product Browser Modal (Query 3 fix)
         ========================================== -->
    <div v-if="showProductBrowser" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showProductBrowser = false">
      <div class="bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h3 class="text-lg font-semibold text-slate-800">Browse Products</h3>
            <p class="text-sm text-slate-500 mt-0.5">Select products to add to the order</p>
          </div>
          <button @click="showProductBrowser = false" class="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><i class="pi pi-times" /></button>
        </div>

        <!-- Filters -->
        <div class="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div class="relative flex-1">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
            <input
              v-model="browserSearch"
              @input="onBrowserSearch"
              type="text"
              placeholder="Search by code, name, or material..."
              class="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <select
            v-model="browserCategory"
            @change="onBrowserCategoryChange"
            class="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-w-[160px]"
          >
            <option value="">All Categories</option>
            <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>

        <!-- Product list -->
        <div class="flex-1 overflow-y-auto min-h-0">
          <div v-if="browserLoading" class="p-12 text-center">
            <i class="pi pi-spin pi-spinner text-2xl text-emerald-500" />
            <p class="text-sm text-slate-400 mt-2">Loading products...</p>
          </div>

          <div v-else-if="browserProducts.length === 0" class="p-12 text-center">
            <i class="pi pi-box text-3xl text-slate-300" />
            <p class="text-slate-400 mt-3 text-sm">No products found</p>
          </div>

          <table v-else class="w-full">
            <thead class="sticky top-0 bg-slate-50">
              <tr class="border-b border-slate-200">
                <th class="w-10 px-3 py-2.5">
                  <div
                    @click="toggleSelectAllOnPage"
                    :class="[
                      'w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors mx-auto',
                      isAllOnPageSelected ? 'bg-emerald-600 border-emerald-600' :
                      isSomeOnPageSelected ? 'bg-emerald-200 border-emerald-400' : 'border-slate-300 hover:border-emerald-400'
                    ]"
                    title="Select all on this page"
                  >
                    <i v-if="isAllOnPageSelected" class="pi pi-check text-[10px] text-white" />
                    <i v-else-if="isSomeOnPageSelected" class="pi pi-minus text-[10px] text-emerald-700" />
                  </div>
                </th>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase">Code</th>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase">Product Name</th>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase">Variant</th>
                <th class="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase">Category</th>
                <th class="text-center px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase">MOQ</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="product in browserProducts"
                :key="product.id"
                @click="!isAlreadyAdded(product.id) && toggleBrowserSelect(product)"
                :class="[
                  'transition-colors',
                  isAlreadyAdded(product.id)
                    ? 'bg-slate-50 opacity-50 cursor-not-allowed'
                    : browserSelected.has(product.id)
                      ? 'bg-emerald-50 cursor-pointer'
                      : findPendingCarryForward(product.id, product.product_code)
                        ? 'bg-violet-50/50 hover:bg-violet-50 cursor-pointer'
                        : 'hover:bg-slate-50 cursor-pointer'
                ]"
              >
                <td class="px-3 py-2.5 text-center">
                  <div v-if="isAlreadyAdded(product.id)" class="w-5 h-5 rounded border border-slate-300 bg-slate-200 flex items-center justify-center" title="Already in order">
                    <i class="pi pi-check text-[10px] text-slate-500" />
                  </div>
                  <div v-else
                    :class="[
                      'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                      browserSelected.has(product.id) ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'
                    ]"
                  >
                    <i v-if="browserSelected.has(product.id)" class="pi pi-check text-[10px] text-white" />
                  </div>
                </td>
                <td class="px-3 py-2.5">
                  <span class="text-sm font-mono font-medium text-slate-800">{{ product.product_code }}</span>
                  <span v-if="findPendingCarryForward(product.id, product.product_code)"
                    :class="['ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold',
                      findPendingCarryForward(product.id, product.product_code).type === 'unloaded'
                        ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                    ]"
                  >
                    <i class="pi pi-replay text-[8px]" />
                    {{ findPendingCarryForward(product.id, product.product_code).type === 'unloaded' ? 'Unloaded' : 'After-Sales' }}
                  </span>
                </td>
                <td class="px-3 py-2.5 text-sm text-slate-700">{{ product.product_name }}</td>
                <td class="px-3 py-2.5 text-sm text-slate-500">{{ [product.part_type, product.dimension, product.material].filter(Boolean).join(' · ') || '—' }}</td>
                <td class="px-3 py-2.5 text-sm text-slate-500">{{ product.category || '—' }}</td>
                <td class="px-3 py-2.5 text-sm text-center text-slate-500">{{ product.moq }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="browserTotalPages > 1" class="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50">
          <p class="text-xs text-slate-500">
            Page {{ browserPage }} of {{ browserTotalPages }} ({{ browserTotal }} products)
          </p>
          <div class="flex items-center gap-1">
            <button @click="browserGoToPage(browserPage - 1)" :disabled="browserPage === 1" class="px-2.5 py-1 text-xs rounded border border-slate-200 hover:bg-white disabled:opacity-40">
              <i class="pi pi-chevron-left text-[10px]" />
            </button>
            <button @click="browserGoToPage(browserPage + 1)" :disabled="browserPage === browserTotalPages" class="px-2.5 py-1 text-xs rounded border border-slate-200 hover:bg-white disabled:opacity-40">
              <i class="pi pi-chevron-right text-[10px]" />
            </button>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between p-4 border-t border-slate-200">
          <p class="text-sm text-slate-500">
            <span v-if="browserSelected.size > 0" class="font-medium text-emerald-600">{{ browserSelected.size }} product{{ browserSelected.size > 1 ? 's' : '' }} selected</span>
            <span v-else>No products selected</span>
          </p>
          <div class="flex gap-3">
            <button @click="showProductBrowser = false" class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
            <button
              @click="addBrowserSelected"
              :disabled="browserSelected.size === 0"
              class="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <i class="pi pi-plus text-xs" /> Add Selected ({{ browserSelected.size }})
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Quick Add Client Modal -->
  <Teleport to="body">
    <div v-if="showClientModal" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/40" @click="showClientModal = false"></div>
      <div class="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-semibold text-slate-800 mb-4">New Client</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Company Name <span class="text-red-500">*</span></label>
            <input v-model="newClient.company_name" type="text" placeholder="e.g. ABC Trading Pvt Ltd"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              @keyup.enter="quickCreateClient" autofocus />
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-5">
          <button type="button" @click="showClientModal = false" class="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
          <button type="button" @click="quickCreateClient" :disabled="quickSaving || !newClient.company_name.trim()"
            class="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {{ quickSaving ? 'Creating...' : 'Create Client' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Quick Add Factory Modal -->
  <Teleport to="body">
    <div v-if="showFactoryModal" class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/40" @click="showFactoryModal = false"></div>
      <div class="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 class="text-lg font-semibold text-slate-800 mb-4">New Factory</h3>
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Factory Code <span class="text-red-500">*</span></label>
            <input v-model="newFactory.factory_code" type="text" placeholder="e.g. FY-001"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autofocus />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Company Name <span class="text-red-500">*</span></label>
            <input v-model="newFactory.company_name" type="text" placeholder="e.g. Wuzheng Agricultural Machinery"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              @keyup.enter="quickCreateFactory" />
          </div>
        </div>
        <div class="flex justify-end gap-2 mt-5">
          <button type="button" @click="showFactoryModal = false" class="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancel</button>
          <button type="button" @click="quickCreateFactory" :disabled="quickSaving || !newFactory.company_name.trim() || !newFactory.factory_code.trim()"
            class="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50">
            {{ quickSaving ? 'Creating...' : 'Create Factory' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
