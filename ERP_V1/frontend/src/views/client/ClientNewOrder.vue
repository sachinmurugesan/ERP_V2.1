<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { productsApi, ordersApi, afterSalesApi, unloadedApi } from '../../api'

const router = useRouter()

// Pending carry-forward items — auto-added to order items
const pendingAfterSales = ref([])
const pendingUnloaded = ref([])
const pendingLoading = ref(false)
const removedPendingIds = ref(new Set())  // tracks items user chose to exclude

onMounted(async () => {
  pendingLoading.value = true
  try {
    const [asRes, ulRes] = await Promise.all([
      afterSalesApi.list({ carry_forward_only: true, per_page: 200 }),
      unloadedApi.list({ status: 'PENDING', per_page: 200 }),
    ])
    pendingAfterSales.value = asRes.data?.items || asRes.data || []
    pendingUnloaded.value = ulRes.data?.items || ulRes.data || []

    // Auto-add after-sales items to order
    for (const item of pendingAfterSales.value) {
      orderItems.value = [...orderItems.value, {
        product_id: item.product_id || null,
        product_code: item.product_code || '—',
        product_name: item.product_name || '—',
        quantity: item.affected_quantity || item.quantity || 1,
        _pendingType: 'aftersales',
        _pendingLabel: item.carry_forward_type === 'REPLACEMENT' ? 'Replacement' : 'Compensation',
        _pendingSource: item.order_number || item.original_order_number || 'Previous order',
        _pendingId: `as_${item.id}`,
      }]
    }

    // Auto-add unloaded items to order
    for (const item of pendingUnloaded.value) {
      orderItems.value = [...orderItems.value, {
        product_id: item.product_id || null,
        product_code: item.product_code || '—',
        product_name: item.product_name || '—',
        quantity: item.quantity || 1,
        _pendingType: 'unloaded',
        _pendingLabel: 'Unloaded',
        _pendingSource: item.original_order_number || 'Previous order',
        _pendingId: `ul_${item.id}`,
      }]
    }
  } catch (_) { /* non-critical */ }
  pendingLoading.value = false
})

const totalPending = computed(() =>
  orderItems.value.filter(i => i._pendingType).length
)
const totalPendingRemoved = computed(() => removedPendingIds.value.size)

const poReference = ref('')
const clientReference = ref('')
const orderItems = ref([])
const searchQuery = ref('')
const searchResults = ref([])
const searching = ref(false)
const saving = ref(false)
const error = ref('')

// Browse Products modal
const showBrowse = ref(false)
const browseSearch = ref('')
const browseCategory = ref('')
const browseProducts = ref([])
const browseLoading = ref(false)
const browsePage = ref(1)
const browseTotal = ref(0)
const browsePerPage = 24
const categories = ref([])

// Bulk Paste modal
const showBulkPaste = ref(false)
const bulkText = ref('')
const bulkResults = ref(null)
const bulkProcessing = ref(false)

let searchTimer = null

// Inline search
function onSearch() {
  clearTimeout(searchTimer)
  if (!searchQuery.value || searchQuery.value.length < 2) {
    searchResults.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      const { data } = await productsApi.list({
        search: searchQuery.value, per_page: 10
      })
      const rawItems = data.items || data.products || (Array.isArray(data) ? data : [])
      // Flatten grouped format
      const products = []
      for (const item of rawItems) {
        if (item.variants && item.parent) {
          const v = item.variants.find(v => v.is_default) || item.variants[0]
          if (v) products.push(v)
        } else {
          products.push(item)
        }
      }
      const addedIds = new Set(orderItems.value.map(i => i.product_id))
      searchResults.value = products.filter(p => !addedIds.has(p.id))
    } catch (_e) {
      searchResults.value = []
    }
    searching.value = false
  }, 300)
}

function addProduct(product) {
  const existing = orderItems.value.find(i => i.product_id === product.id)
  if (existing) {
    // Increment quantity
    orderItems.value = orderItems.value.map(i =>
      i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
    )
  } else {
    orderItems.value = [...orderItems.value, {
      product_id: product.id,
      product_code: product.product_code,
      product_name: product.product_name,
      category: product.category,
      material: product.material,
      dimension: product.dimension,
      thumbnail_url: product.thumbnail_url || null,
      quantity: 1,
    }]
  }
  searchQuery.value = ''
  searchResults.value = []
}

function removeItem(index) {
  const item = orderItems.value[index]
  if (item?._pendingId) {
    const newSet = new Set(removedPendingIds.value)
    newSet.add(item._pendingId)
    removedPendingIds.value = newSet
  }
  orderItems.value = orderItems.value.filter((_, i) => i !== index)
}

function updateQty(index, qty) {
  const parsed = parseInt(qty) || 1
  const updated = [...orderItems.value]
  updated[index] = { ...updated[index], quantity: Math.max(1, parsed) }
  orderItems.value = updated
}

const totalItems = computed(() => orderItems.value.reduce((sum, i) => sum + i.quantity, 0))
const addedProductIds = computed(() => new Set(orderItems.value.map(i => i.product_id)))

// ===== Browse Products Modal =====
async function openBrowse() {
  showBrowse.value = true
  browsePage.value = 1
  browseSelected.value = new Set()
  if (categories.value.length === 0) {
    try {
      const { data } = await productsApi.categories()
      categories.value = Array.isArray(data) ? data : (data.categories || [])
    } catch (_e) { /* ignore */ }
  }
  await loadBrowseProducts()
}

async function loadBrowseProducts() {
  browseLoading.value = true
  try {
    const params = { page: browsePage.value, per_page: browsePerPage }
    if (browseSearch.value) params.search = browseSearch.value
    if (browseCategory.value) params.category = browseCategory.value
    const { data } = await productsApi.list(params)
    const rawItems = data.items || data.products || (Array.isArray(data) ? data : [])
    // Flatten grouped items: extract default variant (or first) from each group
    const flat = []
    for (const item of rawItems) {
      if (item.variants && item.parent) {
        // Grouped format: pick default variant or first
        const v = item.variants.find(v => v.is_default) || item.variants[0]
        if (v) flat.push(v)
      } else {
        flat.push(item)
      }
    }
    browseProducts.value = flat
    browseTotal.value = data.total || flat.length
  } catch (_e) {
    browseProducts.value = []
  }
  browseLoading.value = false
}

function onBrowseSearch() {
  browsePage.value = 1
  loadBrowseProducts()
}

function browseAddProduct(p) {
  addProduct(p)
}

function isInOrder(productId) {
  return addedProductIds.value.has(productId)
}

const browseTotalPages = computed(() => Math.ceil(browseTotal.value / browsePerPage))

// Browse selection helpers
const browseSelected = ref(new Set())

function toggleBrowseSelect(product) {
  if (isInOrder(product.id)) return
  const newSet = new Set(browseSelected.value)
  if (newSet.has(product.id)) {
    newSet.delete(product.id)
  } else {
    newSet.add(product.id)
  }
  browseSelected.value = newSet
}

const browseAllSelected = computed(() => {
  const selectable = browseProducts.value.filter(p => !isInOrder(p.id))
  return selectable.length > 0 && selectable.every(p => browseSelected.value.has(p.id))
})

function toggleBrowseSelectAll() {
  const selectable = browseProducts.value.filter(p => !isInOrder(p.id))
  if (browseAllSelected.value) {
    browseSelected.value = new Set()
  } else {
    browseSelected.value = new Set(selectable.map(p => p.id))
  }
}

function addBrowseSelected() {
  for (const p of browseProducts.value) {
    if (browseSelected.value.has(p.id) && !isInOrder(p.id)) {
      addProduct(p)
    }
  }
  browseSelected.value = new Set()
}

// ===== Bulk Paste Modal =====
function openBulkPaste() {
  showBulkPaste.value = true
  bulkText.value = ''
  bulkResults.value = null
}

async function processBulkPaste() {
  if (!bulkText.value.trim()) return
  bulkProcessing.value = true
  bulkResults.value = null

  // Parse lines: "CODE QTY" or "CODE\tQTY" or just "CODE"
  const lines = bulkText.value.trim().split('\n').filter(l => l.trim())
  const parsedCodes = []

  for (const line of lines) {
    const parts = line.trim().split(/[\t,\s]+/)
    const code = parts[0]?.trim()
    // Use LAST token as qty — handles "CODE (name) QTY" format
    const lastToken = parts.length > 1 ? parts[parts.length - 1] : null
    const qty = (lastToken && /^\d+$/.test(lastToken)) ? parseInt(lastToken) : 1
    if (code) parsedCodes.push({ code, qty })
  }

  if (parsedCodes.length === 0) {
    bulkResults.value = { matched: [], unmatched: [], message: 'No valid codes found' }
    bulkProcessing.value = false
    return
  }

  // Validate codes against backend
  try {
    const { data } = await productsApi.validateCodes(parsedCodes.map(p => p.code))

    const matched = []
    const unmatched = []
    const validationMap = {}

    // Build lookup from validation response
    if (Array.isArray(data)) {
      data.forEach(v => { validationMap[v.code] = v })
    } else if (data.results) {
      data.results.forEach(v => { validationMap[v.code] = v })
    }

    for (const parsed of parsedCodes) {
      const validation = validationMap[parsed.code]
      if (validation && (validation.status === 'FOUND' || validation.status === 'AMBIGUOUS')) {
        // Use first match (or default variant) from matches array
        const product = validation.product || (validation.matches && validation.matches[0])
        if (product) {
          matched.push({ ...product, quantity: parsed.qty })
        } else {
          unmatched.push({ code: parsed.code, qty: parsed.qty })
        }
      } else {
        unmatched.push({ code: parsed.code, qty: parsed.qty })
      }
    }

    bulkResults.value = { matched, unmatched }
  } catch (_e) {
    // Fallback: search each code individually
    const matched = []
    const unmatched = []
    for (const parsed of parsedCodes) {
      try {
        const { data } = await productsApi.list({ search: parsed.code, per_page: 1 })
        const products = data.items || data.products || (Array.isArray(data) ? data : [])
        if (products.length > 0) {
          matched.push({ ...products[0], quantity: parsed.qty })
        } else {
          unmatched.push({ code: parsed.code, qty: parsed.qty })
        }
      } catch (__e) {
        unmatched.push({ code: parsed.code, qty: parsed.qty })
      }
    }
    bulkResults.value = { matched, unmatched }
  }

  bulkProcessing.value = false
}

function applyBulkResults() {
  if (!bulkResults.value?.matched) return
  for (const product of bulkResults.value.matched) {
    if (product.isQuickAdd) {
      // Quick-add item: use _qaKey for dedup since no product_id
      const qaKey = `qa_${product.product_code}`
      const existing = orderItems.value.find(i => i._qaKey === qaKey)
      if (existing) {
        orderItems.value = orderItems.value.map(i =>
          i._qaKey === qaKey ? { ...i, quantity: i.quantity + (product.quantity || 1) } : i
        )
      } else {
        orderItems.value = [...orderItems.value, {
          _qaKey: qaKey,
          product_id: null,
          product_code: product.product_code,
          product_name: product.product_name,
          quantity: product.quantity || 1,
          isQuickAdd: true,
        }]
      }
    } else {
      // Normal product
      const existing = orderItems.value.find(i => i.product_id === product.id)
      if (existing) {
        orderItems.value = orderItems.value.map(i =>
          i.product_id === product.id ? { ...i, quantity: i.quantity + (product.quantity || 1) } : i
        )
      } else {
        orderItems.value = [...orderItems.value, {
          product_id: product.id,
          product_code: product.product_code,
          product_name: product.product_name,
          category: product.category,
          material: product.material,
          dimension: product.dimension,
          thumbnail_url: product.thumbnail_url || null,
          quantity: product.quantity || 1,
        }]
      }
    }
  }
  showBulkPaste.value = false
}

// Quick Add state — frontend-only, NO API call
const quickAddCode = ref('')
const quickAddQty = ref(1)
const quickAddName = ref('')
const quickAddMode = ref(false)

function startQuickAdd(item) {
  // item is { code, qty } from unmatched array
  quickAddCode.value = item.code
  quickAddQty.value = item.qty || 1
  quickAddName.value = ''
  quickAddMode.value = true
}

function submitQuickAdd() {
  if (!quickAddCode.value || !quickAddName.value.trim()) return
  // LOCAL only — no API call. Product created on Submit Inquiry.
  const updated = { ...bulkResults.value }
  updated.unmatched = updated.unmatched.filter(u => u.code !== quickAddCode.value)
  updated.matched = [...(updated.matched || []), {
    id: null,
    product_code: quickAddCode.value,
    product_name: quickAddName.value.trim(),
    quantity: quickAddQty.value,
    isQuickAdd: true,
  }]
  bulkResults.value = updated
  quickAddMode.value = false
  quickAddCode.value = ''
  quickAddName.value = ''
  quickAddQty.value = 1
}

function cancelQuickAdd() {
  quickAddMode.value = false
  quickAddCode.value = ''
  quickAddName.value = ''
  quickAddQty.value = 1
}

async function submitInquiry() {
  error.value = ''
  // Exclude pending carry-forward items — backend adds them on approve when factory is assigned
  const normalItems = orderItems.value.filter(i => !i.isQuickAdd && !i._pendingType)
  const quickAddItems = orderItems.value.filter(i => i.isQuickAdd)

  const hasPendingItems = orderItems.value.some(i => i._pendingType)
  if (normalItems.length === 0 && quickAddItems.length === 0 && !hasPendingItems) {
    error.value = 'Please add at least one product to your inquiry.'
    return
  }
  saving.value = true
  try {
    await ordersApi.createClientInquiry({
      po_reference: poReference.value || null,
      client_reference: clientReference.value || null,
      items: normalItems.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
      })),
      quick_add_items: quickAddItems.map(i => ({
        product_code: i.product_code,
        product_name: i.product_name,
        quantity: i.quantity,
      })),
    })
    router.push('/client-portal/orders')
  } catch (e) {
    error.value = e.response?.data?.detail || 'Failed to submit inquiry. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="p-4 md:p-6 max-w-4xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <router-link to="/client-portal/orders" class="text-emerald-600 hover:text-emerald-800 text-sm inline-flex items-center gap-1 mb-2">
          <i class="pi pi-arrow-left text-xs" /> Back to Orders
        </router-link>
        <h1 class="text-xl md:text-2xl font-bold text-slate-800">New Order Inquiry</h1>
        <p class="text-sm text-slate-500 mt-1">Select products and quantities. Pricing will be provided by our team.</p>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
      <i class="pi pi-exclamation-circle flex-shrink-0" />
      <span>{{ error }}</span>
    </div>

    <!-- Pending Carry-Forward Notice -->
    <div v-if="totalPending > 0 || totalPendingRemoved > 0" class="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
      <div class="flex items-center gap-2 text-sm">
        <i class="pi pi-check-circle text-emerald-600 flex-shrink-0" />
        <span class="text-emerald-800 font-medium">
          {{ totalPending }} pending item{{ totalPending !== 1 ? 's' : '' }} auto-added from previous orders
        </span>
        <span v-if="totalPendingRemoved > 0" class="text-emerald-600 text-xs">
          ({{ totalPendingRemoved }} removed by you)
        </span>
      </div>
      <p class="text-xs text-emerald-700 mt-1 ml-6">
        These are replacements and unloaded parts from earlier orders. Remove any you don't need — they'll stay pending for your next order.
      </p>
    </div>

    <!-- Order Reference -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-5 mb-4">
      <div class="flex items-center gap-2 mb-3">
        <i class="pi pi-hashtag text-emerald-500 text-sm" />
        <span class="text-xs font-medium text-slate-600">PO Reference will be auto-generated upon submission</span>
        <span class="text-[10px] text-slate-400">(e.g. SSP/25-26/03/0001)</span>
      </div>
      <label class="block text-xs font-medium text-slate-600 mb-1">Your Order Name (Optional, must be unique)</label>
      <input v-model="clientReference" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. Gearbox Parts March 2026" />
      <p class="text-[10px] text-slate-400 mt-1">Give your order a memorable name for easy reference</p>
    </div>

    <!-- Product Search + Action Buttons -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-5 mb-4">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-bold text-slate-800 text-sm">Add Products</h2>
        <div class="flex gap-2">
          <button @click="openBrowse" class="px-3 py-1.5 border border-emerald-300 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-50 transition-colors flex items-center gap-1.5">
            <i class="pi pi-th-large text-[10px]" /> Browse
          </button>
          <button @click="openBulkPaste" class="px-3 py-1.5 border border-blue-300 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-50 transition-colors flex items-center gap-1.5">
            <i class="pi pi-clipboard text-[10px]" /> Bulk Paste
          </button>
        </div>
      </div>

      <div class="relative">
        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
        <input
          v-model="searchQuery"
          @input="onSearch"
          class="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm"
          placeholder="Search by product code or name..."
        />
        <i v-if="searching" class="pi pi-spinner pi-spin absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
      </div>

      <!-- Search Results Dropdown -->
      <div v-if="searchResults.length > 0" class="mt-1 border border-slate-200 rounded-lg bg-white shadow-lg max-h-64 overflow-y-auto z-10 relative">
        <button
          v-for="p in searchResults"
          :key="p.id"
          @click="addProduct(p)"
          class="w-full text-left px-4 py-3 hover:bg-emerald-50 border-b border-slate-50 last:border-0 transition-colors"
        >
          <div class="flex items-center justify-between">
            <div>
              <span class="font-mono text-xs text-slate-500">{{ p.product_code }}</span>
              <span class="text-sm font-medium text-slate-800 ml-2">{{ p.product_name }}</span>
            </div>
            <i class="pi pi-plus text-emerald-500 text-xs" />
          </div>
          <div class="flex gap-3 mt-0.5 text-[10px] text-slate-400">
            <span v-if="p.category">{{ p.category }}</span>
            <span v-if="p.material">{{ p.material }}</span>
            <span v-if="p.dimension">{{ p.dimension }}</span>
          </div>
        </button>
      </div>

      <div v-if="searchQuery.length >= 2 && !searching && searchResults.length === 0" class="mt-2 text-xs text-slate-400 text-center py-2">
        No products found for "{{ searchQuery }}"
      </div>
    </div>

    <!-- Selected Items -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
      <div class="px-4 md:px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 class="font-bold text-slate-800 text-sm">Order Items</h2>
        <span class="text-xs text-slate-400">{{ orderItems.length }} products, {{ totalItems }} units</span>
      </div>

      <!-- Empty -->
      <div v-if="orderItems.length === 0" class="py-12 text-center">
        <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-3">
          <i class="pi pi-box text-xl text-slate-400" />
        </div>
        <p class="text-sm text-slate-400">Search, browse, or paste product codes above</p>
      </div>

      <!-- Items Table -->
      <table v-else class="w-full text-sm">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-4 py-2.5 text-left font-semibold text-slate-600 text-xs">Product</th>
            <th class="px-4 py-2.5 text-left font-semibold text-slate-600 text-xs hidden md:table-cell">Category</th>
            <th class="px-4 py-2.5 text-center font-semibold text-slate-600 text-xs w-24">Qty</th>
            <th class="px-4 py-2.5 text-right font-semibold text-slate-600 text-xs w-16"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, i) in orderItems" :key="item.product_id" class="border-t border-slate-50">
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                <img v-if="item.thumbnail_url" :src="item.thumbnail_url" class="w-8 h-8 rounded object-cover flex-shrink-0" />
                <div>
                  <div class="font-mono text-[10px] text-slate-400">{{ item.product_code }}</div>
                  <div class="text-sm font-medium text-slate-800">{{ item.product_name }}</div>
                  <div v-if="item.dimension" class="text-[10px] text-slate-400">{{ item.dimension }}</div>
                  <span v-if="item.isQuickAdd" class="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700">
                    <i class="pi pi-clock text-[8px]" /> Quick Add — Pending Review
                  </span>
                  <span v-if="item._pendingType" class="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold"
                    :class="item._pendingType === 'aftersales' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'">
                    <i class="pi pi-replay text-[8px]" /> {{ item._pendingLabel }} — from {{ item._pendingSource }}
                  </span>
                </div>
              </div>
            </td>
            <td class="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{{ item.category || '-' }}</td>
            <td class="px-4 py-3 text-center">
              <input
                v-if="!item._pendingType"
                type="number"
                :value="item.quantity"
                @input="updateQty(i, $event.target.value)"
                min="1"
                class="w-16 px-2 py-1 border border-slate-300 rounded text-center text-sm"
              />
              <span v-else class="text-sm font-medium text-slate-600">{{ item.quantity }}</span>
            </td>
            <td class="px-4 py-3 text-right">
              <button @click="removeItem(i)" class="text-red-400 hover:text-red-600 transition-colors">
                <i class="pi pi-trash text-sm" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pending Approval Warning -->
    <div v-if="orderItems.some(i => i.approval_status === 'PENDING_APPROVAL')" class="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4 flex items-start gap-3">
      <i class="pi pi-clock text-orange-500 mt-0.5 flex-shrink-0" />
      <div>
        <p class="text-sm font-medium text-orange-800">{{ orderItems.filter(i => i.approval_status === 'PENDING_APPROVAL').length }} product(s) pending admin approval</p>
        <p class="text-xs text-orange-600 mt-0.5">These Quick Add products are under review. Your inquiry will be submitted, but these items won't be finalized until the admin approves them. You'll be notified when they're confirmed.</p>
      </div>
    </div>

    <!-- Pricing Notice -->
    <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
      <i class="pi pi-info-circle text-amber-500 mt-0.5 flex-shrink-0" />
      <div>
        <p class="text-sm font-medium text-amber-800">Pricing is pending review</p>
        <p class="text-xs text-amber-600 mt-0.5">Our team will review your inquiry, set the pricing, and send you a Proforma Invoice (PI) for approval.</p>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-3">
      <button
        @click="submitInquiry"
        :disabled="saving || orderItems.length === 0"
        class="px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        <i v-if="saving" class="pi pi-spinner pi-spin" />
        <i v-else class="pi pi-send" />
        {{ saving ? 'Submitting...' : 'Submit Inquiry' }}
      </button>
      <router-link to="/client-portal/orders" class="px-4 py-2.5 text-slate-500 hover:text-slate-700 text-sm">
        Cancel
      </router-link>
    </div>

    <!-- ===== Browse Products Modal ===== -->
    <div v-if="showBrowse" class="fixed inset-0 z-50 flex items-start justify-center pt-8 md:pt-16 bg-black/50" @click.self="showBrowse = false">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col mx-4">
        <!-- Header -->
        <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <h2 class="text-lg font-bold text-slate-800">Browse Products</h2>
          <button @click="showBrowse = false" class="text-slate-400 hover:text-slate-600 p-1">
            <i class="pi pi-times" />
          </button>
        </div>

        <!-- Filters -->
        <div class="px-5 py-3 border-b border-slate-100 flex gap-3 flex-shrink-0">
          <div class="relative flex-1">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input v-model="browseSearch" @input="onBrowseSearch" class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Search products..." />
          </div>
          <select v-model="browseCategory" @change="onBrowseSearch" class="px-3 py-2 border border-slate-300 rounded-lg text-sm min-w-[140px]">
            <option value="">All Categories</option>
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <!-- Product Table -->
        <div class="flex-1 overflow-y-auto">
          <div v-if="browseLoading" class="py-12 text-center text-slate-400">
            <i class="pi pi-spinner pi-spin text-xl mb-2" />
            <p class="text-sm">Loading products...</p>
          </div>

          <div v-else-if="browseProducts.length === 0" class="py-12 text-center text-slate-400">
            <i class="pi pi-search text-xl mb-2" />
            <p class="text-sm">No products found</p>
          </div>

          <table v-else class="w-full text-sm">
            <thead class="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th class="px-3 py-2.5 text-left w-10">
                  <input type="checkbox" :checked="browseAllSelected" @change="toggleBrowseSelectAll" class="rounded border-slate-300 text-emerald-600" />
                </th>
                <th class="px-3 py-2.5 text-left font-semibold text-slate-600 text-xs">Code</th>
                <th class="px-3 py-2.5 text-left font-semibold text-slate-600 text-xs">Product Name</th>
                <th class="px-3 py-2.5 text-left font-semibold text-slate-600 text-xs hidden md:table-cell">Variant</th>
                <th class="px-3 py-2.5 text-left font-semibold text-slate-600 text-xs hidden md:table-cell">Category</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in browseProducts"
                :key="p.id"
                @click="toggleBrowseSelect(p)"
                class="border-t border-slate-50 transition-colors cursor-pointer"
                :class="isInOrder(p.id) ? 'bg-slate-50 opacity-50 cursor-not-allowed' : browseSelected.has(p.id) ? 'bg-emerald-50' : 'hover:bg-slate-50'"
              >
                <td class="px-3 py-2.5">
                  <input
                    type="checkbox"
                    :checked="browseSelected.has(p.id) || isInOrder(p.id)"
                    :disabled="isInOrder(p.id)"
                    class="rounded border-slate-300 text-emerald-600 disabled:opacity-30"
                    @click.stop
                    @change="toggleBrowseSelect(p)"
                  />
                </td>
                <td class="px-3 py-2.5 font-mono text-xs text-slate-500">{{ p.product_code }}</td>
                <td class="px-3 py-2.5 font-medium text-slate-800">{{ p.product_name }}</td>
                <td class="px-3 py-2.5 text-xs text-slate-400 hidden md:table-cell">{{ [p.dimension, p.material].filter(Boolean).join(' · ') || '-' }}</td>
                <td class="px-3 py-2.5 text-xs text-slate-400 hidden md:table-cell">{{ p.category || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="browseTotalPages > 1" class="px-5 py-3 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <span class="text-xs text-slate-400">{{ browseTotal }} products</span>
          <div class="flex gap-1">
            <button
              @click="browsePage = Math.max(1, browsePage - 1); loadBrowseProducts()"
              :disabled="browsePage <= 1"
              class="px-2.5 py-1 rounded text-xs border border-slate-300 disabled:opacity-30"
            >Prev</button>
            <span class="px-2.5 py-1 text-xs text-slate-500">{{ browsePage }} / {{ browseTotalPages }}</span>
            <button
              @click="browsePage = Math.min(browseTotalPages, browsePage + 1); loadBrowseProducts()"
              :disabled="browsePage >= browseTotalPages"
              class="px-2.5 py-1 rounded text-xs border border-slate-300 disabled:opacity-30"
            >Next</button>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-5 py-3 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <span class="text-xs text-slate-400">{{ browseSelected.size }} selected</span>
          <div class="flex gap-2">
            <button @click="showBrowse = false" class="px-3 py-1.5 text-slate-500 text-sm">Cancel</button>
            <button @click="addBrowseSelected" :disabled="browseSelected.size === 0" class="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-1">
              <i class="pi pi-plus text-xs" /> Add Selected ({{ browseSelected.size }})
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== Bulk Paste Modal ===== -->
    <div v-if="showBulkPaste" class="fixed inset-0 z-50 flex items-start justify-center pt-4 md:pt-10 bg-black/50" @click.self="showBulkPaste = false">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <!-- Header -->
        <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 class="text-lg font-bold text-slate-800">Bulk Paste Products</h2>
            <p class="text-xs text-slate-400 mt-0.5">Paste product codes from Excel. Format: CODE QTY (one per line)</p>
          </div>
          <button @click="showBulkPaste = false" class="text-slate-400 hover:text-slate-600 p-1">
            <i class="pi pi-times" />
          </button>
        </div>

        <!-- Scrollable Content -->
        <div class="flex-1 overflow-y-auto p-5">
          <!-- Text Area -->
          <textarea
            v-model="bulkText"
            class="w-full h-32 px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="GB/T283-94    10&#10;ZKB90-15540    5&#10;GB/T276-94    20&#10;&#10;Paste from Excel: CODE and QTY columns"
          ></textarea>

          <div class="mt-2 flex gap-4 text-[10px] text-slate-400">
            <span>Supported: <b>TAB</b>, <b>COMMA</b>, or <b>SPACE</b> separated</span>
            <span>QTY is optional (defaults to 1)</span>
          </div>

          <button
            @click="processBulkPaste"
            :disabled="bulkProcessing || !bulkText.trim()"
            class="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            <i v-if="bulkProcessing" class="pi pi-spinner pi-spin" />
            <i v-else class="pi pi-check" />
            {{ bulkProcessing ? 'Validating...' : 'Validate Codes' }}
          </button>

          <!-- Results -->
          <div v-if="bulkResults" class="mt-4 space-y-3">
            <!-- Matched -->
            <div v-if="bulkResults.matched?.length > 0" class="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div class="text-sm font-medium text-emerald-800 mb-2">
                <i class="pi pi-check-circle mr-1" /> {{ bulkResults.matched.length }} products matched
              </div>
              <div class="space-y-1 max-h-40 overflow-y-auto">
                <div v-for="m in bulkResults.matched" :key="m.id" class="text-xs text-emerald-700 flex items-center justify-between">
                  <span><span class="font-mono">{{ m.product_code }}</span> — {{ m.product_name }}</span>
                  <span class="text-emerald-500 flex-shrink-0 ml-2">qty: {{ m.quantity }}</span>
                </div>
              </div>
            </div>

            <!-- Unmatched with Quick Add -->
            <div v-if="bulkResults.unmatched?.length > 0" class="bg-red-50 border border-red-200 rounded-lg p-3">
              <div class="text-sm font-medium text-red-800 mb-2">
                <i class="pi pi-exclamation-triangle mr-1" /> {{ bulkResults.unmatched.length }} codes not found
              </div>
              <div class="space-y-2 max-h-48 overflow-y-auto">
                <div v-for="item in bulkResults.unmatched" :key="item.code" class="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-red-100">
                  <span class="font-mono text-xs text-red-700">{{ item.code }} <span class="text-red-400 ml-1">qty: {{ item.qty }}</span></span>
                  <div v-if="quickAddMode && quickAddCode === item.code" class="flex items-center gap-1">
                    <input v-model="quickAddName" class="w-32 px-2 py-1 border border-blue-300 rounded text-[10px]" placeholder="Product name..." @keyup.enter="submitQuickAdd" autofocus />
                    <button @click="submitQuickAdd" :disabled="!quickAddName.trim()" class="text-[10px] text-emerald-600 hover:text-emerald-800 font-bold"><i class="pi pi-check text-[8px]" /></button>
                    <button @click="cancelQuickAdd" class="text-[10px] text-slate-400 hover:text-slate-600"><i class="pi pi-times text-[8px]" /></button>
                  </div>
                  <button v-else @click="startQuickAdd(item)" class="text-[10px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                    <i class="pi pi-plus text-[8px]" /> Quick Add
                  </button>
                </div>
              </div>
              <p class="text-[10px] text-red-400 mt-2">Quick Add creates a basic product entry. Admin will review and complete the details.</p>
            </div>
          </div>
        </div>

        <!-- Fixed Footer -->
        <div v-if="bulkResults?.matched?.length > 0" class="px-5 py-3 border-t border-slate-200 flex justify-end gap-3 flex-shrink-0">
          <button @click="showBulkPaste = false" class="px-3 py-1.5 text-slate-500 text-sm">Cancel</button>
          <button @click="applyBulkResults" class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium flex items-center gap-2">
            <i class="pi pi-plus" /> Add {{ bulkResults.matched.length }} Products
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
