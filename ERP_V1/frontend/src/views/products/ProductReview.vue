<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { productsApi } from '../../api'

const router = useRouter()
const products = ref([])
const loading = ref(true)
const total = ref(0)

// Edit form
const showForm = ref(false)
const editingProduct = ref(null)
const saving = ref(false)
const form = ref({
  product_name: '',
  product_name_chinese: '',
  category: '',
  material: '',
  dimension: '',
  part_type: '',
  brand: '',
  hs_code: '',
  unit_weight_kg: null,
})

const categories = ref([])
const materials = ref([])
const brands = ref([])
const cleaningOrphans = ref(false)

// No orphan cleanup needed — product_requests always have an order_id

async function loadPending() {
  loading.value = true
  try {
    const { data } = await productsApi.pendingReviewList()
    products.value = data.products || []
    total.value = data.total || 0
  } catch (_e) { products.value = [] }
  loading.value = false
}

async function loadDropdowns() {
  try {
    const [c, m, b] = await Promise.all([
      productsApi.categories(),
      productsApi.materials(),
      productsApi.brands(),
    ])
    categories.value = Array.isArray(c.data) ? c.data : []
    materials.value = Array.isArray(m.data) ? m.data : []
    brands.value = Array.isArray(b.data) ? b.data : []
  } catch (_e) { /* ignore */ }
}

onMounted(() => { loadPending(); loadDropdowns() })

function openReview(product) {
  editingProduct.value = product
  form.value = {
    product_name: product.product_name || '',
    product_name_chinese: '',
    category: product.category || '',
    material: product.material || '',
    dimension: product.dimension || '',
    part_type: product.part_type || '',
    brand: product.brand || '',
    hs_code: '',
    unit_weight_kg: null,
  }
  showForm.value = true
}

async function approveProduct() {
  if (!editingProduct.value) return
  saving.value = true
  try {
    await productsApi.approveRequest(editingProduct.value.id, form.value)
    showForm.value = false
    loadPending()
  } catch (e) {
    alert(e.response?.data?.detail || 'Failed to approve')
  }
  saving.value = false
}

// === Map to Existing Product ===
const showMapModal = ref(false)
const mapTarget = ref(null)  // the pending product being mapped
const mapSearch = ref('')
const mapProducts = ref([])
const mapLoading = ref(false)
const mapSelected = ref(null)
const mapping = ref(false)
const clientBrands = ref([])  // brands the client has access to

async function openMapModal(product) {
  mapTarget.value = product
  mapSearch.value = ''
  mapProducts.value = []
  mapSelected.value = null
  showMapModal.value = true

  // Load client's allowed brands to highlight access
  // product_requests have client_id directly from the order
  // We don't have requested_by.id anymore, but we can skip brand loading for now
  clientBrands.value = []

  // Load initial products
  await searchMapProducts()
}

async function searchMapProducts() {
  mapLoading.value = true
  try {
    const params = { per_page: 50, page: 1 }
    if (mapSearch.value) params.search = mapSearch.value
    const { data } = await productsApi.list(params)
    // Flatten grouped items
    const flat = []
    for (const item of (data.items || [])) {
      if (item.variants && item.parent) {
        for (const v of item.variants) flat.push(v)
      } else {
        flat.push(item)
      }
    }
    mapProducts.value = flat
  } catch (_e) { mapProducts.value = [] }
  mapLoading.value = false
}

function isClientAccessible(product) {
  if (!product.brand) return false
  return clientBrands.value.includes(product.brand)
}

async function applyMapping() {
  if (!mapTarget.value || !mapSelected.value) return
  mapping.value = true
  try {
    await productsApi.mapRequest(mapTarget.value.id, {
      target_product_id: mapSelected.value.id,
    })
    showMapModal.value = false
    loadPending()
  } catch (e) {
    alert(e.response?.data?.detail || 'Failed to map product')
  }
  mapping.value = false
}

// === Reject Quick Add ===
const showRejectModal = ref(false)
const rejectTarget = ref(null)
const rejectRemark = ref('')
const rejecting = ref(false)

function openRejectModal(product) {
  rejectTarget.value = product
  rejectRemark.value = ''
  showRejectModal.value = true
}

async function submitReject() {
  if (!rejectTarget.value) return
  rejecting.value = true
  try {
    await productsApi.rejectRequest(rejectTarget.value.id, {
      remark: rejectRemark.value || 'Product request rejected',
    })
    showRejectModal.value = false
    loadPending()
  } catch (e) {
    alert(e.response?.data?.detail || 'Failed to reject')
  }
  rejecting.value = false
}

let mapSearchTimer = null
function onMapSearch() {
  clearTimeout(mapSearchTimer)
  mapSearchTimer = setTimeout(searchMapProducts, 300)
}
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Product Review</h1>
        <p class="text-sm text-slate-500">{{ total }} products pending approval from client requests</p>
      </div>
      <div class="flex items-center gap-3">
        <router-link to="/products" class="text-sm text-emerald-600 hover:text-emerald-800 flex items-center gap-1">
          <i class="pi pi-arrow-left text-xs" /> Back to Products
        </router-link>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="py-16 text-center text-slate-400">
      <i class="pi pi-spinner pi-spin text-2xl mb-3" />
      <p class="text-sm">Loading pending products...</p>
    </div>

    <!-- Empty -->
    <div v-else-if="products.length === 0" class="py-20 text-center">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mb-4">
        <i class="pi pi-check-circle text-2xl text-emerald-400" />
      </div>
      <h2 class="text-lg font-bold text-slate-700">All clear!</h2>
      <p class="text-sm text-slate-400 mt-1">No products pending review.</p>
    </div>

    <!-- Pending List -->
    <div v-else class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <table class="w-full text-sm">
        <thead class="bg-amber-50 border-b border-amber-200">
          <tr>
            <th class="px-4 py-3 text-left font-semibold text-amber-800 text-xs">Part Code</th>
            <th class="px-4 py-3 text-left font-semibold text-amber-800 text-xs">Name (from client)</th>
            <th class="px-4 py-3 text-right font-semibold text-amber-800 text-xs">Qty</th>
            <th class="px-4 py-3 text-left font-semibold text-amber-800 text-xs hidden md:table-cell">Client</th>
            <th class="px-4 py-3 text-left font-semibold text-amber-800 text-xs hidden md:table-cell">Order</th>
            <th class="px-4 py-3 text-left font-semibold text-amber-800 text-xs hidden md:table-cell">Date</th>
            <th class="px-4 py-3 text-right font-semibold text-amber-800 text-xs">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in products" :key="p.id" class="border-b border-slate-100 hover:bg-amber-50/30">
            <td class="px-4 py-3 font-mono font-medium text-slate-800">{{ p.product_code }}</td>
            <td class="px-4 py-3 text-slate-700">
              <div>{{ p.product_name }}</div>
              <div class="text-[10px] text-slate-400">by {{ p.requested_by_name || '-' }}</div>
            </td>
            <td class="px-4 py-3 text-right font-medium text-slate-700">{{ p.quantity }}</td>
            <td class="px-4 py-3 text-xs text-slate-500 hidden md:table-cell">{{ p.client_name || '-' }}</td>
            <td class="px-4 py-3 text-xs text-slate-500 hidden md:table-cell font-mono">{{ p.order_reference || '-' }}</td>
            <td class="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">{{ p.created_at ? new Date(p.created_at).toLocaleDateString() : '-' }}</td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-1.5">
                <button @click="openReview(p)" class="px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] hover:bg-emerald-700 flex items-center gap-1" title="Fill details and approve as new product">
                  <i class="pi pi-check text-[8px]" /> Approve
                </button>
                <button @click="openMapModal(p)" class="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] hover:bg-blue-700 flex items-center gap-1" title="Map to an existing correct product">
                  <i class="pi pi-link text-[8px]" /> Map
                </button>
                <button @click="openRejectModal(p)" class="px-2.5 py-1.5 bg-red-500 text-white rounded-lg text-[10px] hover:bg-red-600 flex items-center gap-1" title="Reject with remark">
                  <i class="pi pi-times text-[8px]" /> Reject
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Review Modal -->
    <div v-if="showForm" class="fixed inset-0 z-50 flex items-start justify-center pt-8 md:pt-16 bg-black/50" @click.self="showForm = false">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
        <div class="px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 class="text-lg font-bold text-slate-800">Review & Approve Product</h2>
          <p class="text-xs text-slate-400 mt-0.5">Code: <span class="font-mono font-medium text-slate-600">{{ editingProduct?.product_code }}</span></p>
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-3">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Product Name *</label>
            <input v-model="form.product_name" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Chinese Name</label>
            <input v-model="form.product_name_chinese" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Category</label>
              <input v-model="form.category" list="review-cats" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <datalist id="review-cats"><option v-for="c in categories" :key="c" :value="c" /></datalist>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Material</label>
              <input v-model="form.material" list="review-mats" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <datalist id="review-mats"><option v-for="m in materials" :key="m" :value="m" /></datalist>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Dimension</label>
              <input v-model="form.dimension" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Part Type</label>
              <select v-model="form.part_type" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                <option value="">Select...</option>
                <option value="Original">Original</option>
                <option value="Copy">Copy</option>
                <option value="OEM">OEM</option>
                <option value="Aftermarket">Aftermarket</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">Brand</label>
              <input v-model="form.brand" list="review-brands" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Select or type new brand" />
              <datalist id="review-brands">
                <option v-for="b in brands" :key="b" :value="b" />
              </datalist>
              <p class="text-[10px] text-slate-400 mt-0.5">Select existing or type a new brand name</p>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-600 mb-1">HS Code</label>
              <input v-model="form.hs_code" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Weight (kg)</label>
            <input v-model.number="form.unit_weight_kg" type="number" step="0.01" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
          </div>
        </div>

        <div class="px-5 py-3 border-t border-slate-200 flex justify-end gap-3 flex-shrink-0">
          <button @click="showForm = false" class="px-3 py-1.5 text-slate-500 text-sm">Cancel</button>
          <button @click="approveProduct" :disabled="saving || !form.product_name" class="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
            <i v-if="saving" class="pi pi-spinner pi-spin" />
            <i v-else class="pi pi-check" />
            {{ saving ? 'Approving...' : 'Create & Approve' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ===== Map to Existing Product Modal ===== -->
    <div v-if="showMapModal" class="fixed inset-0 z-50 flex items-start justify-center pt-8 md:pt-12 bg-black/50" @click.self="showMapModal = false">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col">
        <div class="px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <h2 class="text-lg font-bold text-slate-800">Map to Existing Product</h2>
          <p class="text-xs text-slate-400 mt-0.5">
            Mapping <span class="font-mono font-medium text-red-600">{{ mapTarget?.product_code }}</span> ({{ mapTarget?.product_name }}) to a correct product
          </p>
        </div>

        <!-- Search -->
        <div class="px-5 py-3 border-b border-slate-100 flex-shrink-0">
          <div class="relative">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input v-model="mapSearch" @input="onMapSearch" class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Search by code or name..." />
          </div>
        </div>

        <!-- Product List -->
        <div class="flex-1 overflow-y-auto">
          <div v-if="mapLoading" class="py-12 text-center text-slate-400">
            <i class="pi pi-spinner pi-spin text-xl" />
          </div>
          <div v-else-if="mapProducts.length === 0" class="py-12 text-center text-slate-400">
            <p class="text-sm">No products found</p>
          </div>
          <table v-else class="w-full text-sm">
            <thead class="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th class="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 w-10"></th>
                <th class="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Code</th>
                <th class="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Product Name</th>
                <th class="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 hidden md:table-cell">Brand</th>
                <th class="px-4 py-2.5 text-left text-xs font-semibold text-slate-600 hidden md:table-cell">Category</th>
                <th class="px-4 py-2.5 text-center text-xs font-semibold text-slate-600 w-20">Access</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in mapProducts"
                :key="p.id"
                @click="mapSelected = p"
                class="border-t border-slate-50 cursor-pointer transition-colors"
                :class="[
                  mapSelected?.id === p.id ? 'bg-blue-50 ring-1 ring-blue-300' : '',
                  !isClientAccessible(p) ? 'bg-orange-50/50' : 'hover:bg-slate-50'
                ]"
              >
                <td class="px-4 py-2.5">
                  <input type="radio" :checked="mapSelected?.id === p.id" class="text-blue-600" />
                </td>
                <td class="px-4 py-2.5 font-mono text-xs">{{ p.product_code }}</td>
                <td class="px-4 py-2.5 font-medium text-slate-800">{{ p.product_name }}</td>
                <td class="px-4 py-2.5 text-xs hidden md:table-cell">
                  <span v-if="p.brand" class="px-1.5 py-0.5 rounded text-[10px] bg-violet-50 text-violet-600">{{ p.brand }}</span>
                </td>
                <td class="px-4 py-2.5 text-xs text-slate-400 hidden md:table-cell">{{ p.category || '-' }}</td>
                <td class="px-4 py-2.5 text-center">
                  <span v-if="isClientAccessible(p)" class="text-[10px] text-emerald-600 font-medium">Allowed</span>
                  <span v-else class="text-[10px] text-orange-600 font-medium">Not in access</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Selected info + actions -->
        <div class="px-5 py-3 border-t border-slate-200 flex items-center justify-between flex-shrink-0">
          <div v-if="mapSelected" class="text-xs">
            <span class="text-slate-500">Mapping to:</span>
            <span class="font-mono font-medium text-blue-700 ml-1">{{ mapSelected.product_code }}</span>
            <span class="text-slate-600 ml-1">{{ mapSelected.product_name }}</span>
            <span v-if="!isClientAccessible(mapSelected)" class="ml-2 text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
              Will be added to client's product access
            </span>
          </div>
          <div v-else class="text-xs text-slate-400">Select a product to map to</div>
          <div class="flex gap-2">
            <button @click="showMapModal = false" class="px-3 py-1.5 text-slate-500 text-sm">Cancel</button>
            <button @click="applyMapping" :disabled="!mapSelected || mapping" class="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-1">
              <i v-if="mapping" class="pi pi-spinner pi-spin text-xs" />
              <i v-else class="pi pi-link text-xs" />
              {{ mapping ? 'Mapping...' : 'Apply Mapping' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== Reject with Remark Modal ===== -->
    <div v-if="showRejectModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="showRejectModal = false">
      <div class="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <i class="pi pi-times text-red-600" />
          </div>
          <div>
            <h2 class="text-lg font-bold text-slate-800">Reject Product Request</h2>
            <p class="text-xs text-slate-400">
              <span class="font-mono">{{ rejectTarget?.product_code }}</span> — {{ rejectTarget?.product_name }}
            </p>
          </div>
        </div>

        <div class="mb-4">
          <label class="block text-xs font-medium text-slate-600 mb-1">Reason / Remark *</label>
          <textarea
            v-model="rejectRemark"
            class="w-full h-24 px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none"
            placeholder="e.g. Incorrect code. Please use ZKB80-304-00B instead."
          ></textarea>
        </div>

        <p class="text-[10px] text-red-400 mb-4">
          This will remove the product from the catalog and notify the client with your remark.
        </p>

        <div class="flex justify-end gap-3">
          <button @click="showRejectModal = false" class="px-3 py-1.5 text-slate-500 text-sm">Cancel</button>
          <button @click="submitReject" :disabled="!rejectRemark.trim() || rejecting" class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
            <i v-if="rejecting" class="pi pi-spinner pi-spin" />
            <i v-else class="pi pi-times" />
            {{ rejecting ? 'Rejecting...' : 'Reject & Notify' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
