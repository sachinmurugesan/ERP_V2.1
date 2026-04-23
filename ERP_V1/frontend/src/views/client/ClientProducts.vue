<script setup>
import { ref, computed, onMounted } from 'vue'
import { productsApi } from '../../api'

const groups = ref([])
const loading = ref(false)
const search = ref('')
const selectedCategory = ref('')
const categories = ref([])
const page = ref(1)
const perPage = ref(50)
const totalItems = ref(0)
const expandedParents = ref(new Set())
const brokenImages = ref({})

// Suggest edit modal
const showSuggest = ref(false)
const suggestProduct = ref(null)
const suggestText = ref('')
const suggestSent = ref(false)

const totalPages = computed(() => Math.ceil(totalItems.value / perPage.value))

async function loadProducts() {
  loading.value = true
  try {
    const params = { page: page.value, per_page: perPage.value, group: true }
    if (search.value) params.search = search.value
    if (selectedCategory.value) params.category = selectedCategory.value
    const { data } = await productsApi.list(params)
    groups.value = data.items || []
    totalItems.value = data.total || 0
  } catch (_e) {
    groups.value = []
  }
  loading.value = false
}

async function loadCategories() {
  try {
    const { data } = await productsApi.categories()
    categories.value = Array.isArray(data) ? data : []
  } catch (_e) { /* ignore */ }
}

onMounted(() => { loadProducts(); loadCategories() })

function onSearch() { page.value = 1; loadProducts() }
function onPageChange(p) { page.value = p; loadProducts() }

function toggleExpand(code) {
  const s = new Set(expandedParents.value)
  if (s.has(code)) s.delete(code); else s.add(code)
  expandedParents.value = s
}

function groupDisplayName(g) {
  if (g.variants.length > 0) {
    const v = g.variants.find(v => v.is_default) || g.variants[0]
    return v?.product_name || g.parent.product_name
  }
  return g.parent.product_name
}

function groupThumbnail(g) {
  for (const v of g.variants) { if (v.thumbnail_url) return v.thumbnail_url }
  return null
}

function openSuggest(product) {
  suggestProduct.value = product
  suggestText.value = ''
  suggestSent.value = false
  showSuggest.value = true
}

function submitSuggestion() {
  // In a real system this would POST to an API
  suggestSent.value = true
  setTimeout(() => { showSuggest.value = false }, 2000)
}
</script>

<template>
  <div class="p-4 md:p-6 max-w-7xl mx-auto">
    <h1 class="text-xl md:text-2xl font-bold text-slate-800 mb-6">Product Catalog</h1>

    <!-- Filters -->
    <div class="bg-white rounded-xl shadow-sm p-4 mb-4 flex flex-col md:flex-row gap-3">
      <div class="relative flex-1">
        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
        <input v-model="search" @input="onSearch" class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Search by code, name, or material..." />
      </div>
      <select v-model="selectedCategory" @change="onSearch" class="px-3 py-2 border border-slate-300 rounded-lg text-sm min-w-[160px]">
        <option value="">All Categories</option>
        <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
      </select>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <div v-if="loading" class="p-12 text-center">
        <i class="pi pi-spin pi-spinner text-2xl text-emerald-500" />
        <p class="text-sm text-slate-400 mt-2">Loading products...</p>
      </div>

      <div v-else-if="groups.length === 0" class="p-12 text-center">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
          <i class="pi pi-box text-2xl text-slate-400" />
        </div>
        <h2 class="text-lg font-bold text-slate-700">No products available</h2>
        <p class="text-sm text-slate-400 mt-1">Contact your administrator to assign product access.</p>
      </div>

      <table v-else class="w-full text-sm">
        <thead class="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
          <tr>
            <th class="w-8 px-1 py-3"></th>
            <th class="text-center px-2 py-3 text-xs font-semibold text-slate-500 uppercase w-14">Img</th>
            <th class="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Part Code</th>
            <th class="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase">Product Name</th>
            <th class="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Material</th>
            <th class="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase hidden md:table-cell">Size</th>
            <th class="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase hidden lg:table-cell">Category</th>
            <th class="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase hidden lg:table-cell">Brand</th>
            <th class="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase w-20">Action</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="group in groups" :key="group.parent.product_code">
            <!-- Parent/Single row -->
            <tr class="border-b border-slate-200 hover:bg-slate-50 cursor-pointer" @click="group.variants.length > 1 && toggleExpand(group.parent.product_code)">
              <td class="px-1 py-3 text-center">
                <i v-if="group.variants.length > 1" :class="expandedParents.has(group.parent.product_code) ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" class="text-xs text-slate-400" />
              </td>
              <td class="px-2 py-3 text-center">
                <img v-if="groupThumbnail(group) && !brokenImages[group.parent.product_code]" :src="groupThumbnail(group)" class="w-10 h-10 rounded object-cover border border-slate-200" @error="brokenImages[group.parent.product_code] = true" />
                <div v-else class="w-10 h-10 rounded bg-slate-100 flex items-center justify-center"><i class="pi pi-box text-slate-300 text-xs" /></div>
              </td>
              <td class="px-3 py-3"><span class="text-xs font-mono font-bold text-teal-700">{{ group.parent.product_code }}</span></td>
              <td class="px-3 py-3"><span class="text-xs font-medium text-slate-800">{{ groupDisplayName(group) }}</span></td>
              <td class="px-3 py-3 hidden md:table-cell">
                <span v-if="group.variants[0]?.material" class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-600">{{ group.variants[0].material }}</span>
                <span v-else class="text-xs text-slate-300">&mdash;</span>
              </td>
              <td class="px-3 py-3 hidden md:table-cell">
                <span v-if="group.variants[0]?.dimension" class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600">{{ group.variants[0].dimension }}</span>
                <span v-else class="text-xs text-slate-300">&mdash;</span>
              </td>
              <td class="px-3 py-3 hidden lg:table-cell">
                <span v-if="group.variants[0]?.category" class="text-xs text-slate-500">{{ group.variants[0].category }}</span>
              </td>
              <td class="px-3 py-3 hidden lg:table-cell">
                <span v-if="group.variants[0]?.brand" class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-600">{{ group.variants[0].brand }}</span>
              </td>
              <td class="px-3 py-3 text-right" @click.stop>
                <button @click="openSuggest(group.variants[0] || group.parent)" class="text-xs text-blue-600 hover:text-blue-800">Suggest Edit</button>
              </td>
            </tr>

            <!-- Expanded variants -->
            <template v-if="expandedParents.has(group.parent.product_code) && group.variants.length > 1">
              <tr v-for="(v, vi) in group.variants" :key="v.id" class="bg-slate-50/70 border-b border-slate-100">
                <td class="px-1 py-2 text-center"><span class="font-mono text-slate-300 text-xs">{{ vi === group.variants.length - 1 ? '\u2514\u2500' : '\u251C\u2500' }}</span></td>
                <td class="px-2 py-2 text-center">
                  <img v-if="v.thumbnail_url && !brokenImages[v.id]" :src="v.thumbnail_url" class="w-8 h-8 rounded object-cover border border-slate-200" @error="brokenImages[v.id] = true" />
                  <div v-else class="w-8 h-8 rounded bg-slate-100 flex items-center justify-center"><i class="pi pi-image text-slate-300 text-[10px]" /></div>
                </td>
                <td class="px-3 py-2"><span class="font-mono text-[10px] text-slate-400">{{ v.product_code }}</span></td>
                <td class="px-3 py-2"><span class="text-xs font-medium text-slate-700">{{ v.product_name }}</span></td>
                <td class="px-3 py-2 hidden md:table-cell"><span v-if="v.material" class="text-[10px] text-slate-500">{{ v.material }}</span></td>
                <td class="px-3 py-2 hidden md:table-cell"><span v-if="v.dimension" class="text-[10px] text-slate-500">{{ v.dimension }}</span></td>
                <td class="px-3 py-2 hidden lg:table-cell"><span v-if="v.category" class="text-[10px] text-slate-400">{{ v.category }}</span></td>
                <td class="px-3 py-2 hidden lg:table-cell"><span v-if="v.brand" class="text-[10px] text-violet-500">{{ v.brand }}</span></td>
                <td class="px-3 py-2 text-right"><button @click="openSuggest(v)" class="text-[10px] text-blue-500 hover:text-blue-700">Suggest Edit</button></td>
              </tr>
            </template>
          </template>
        </tbody>
      </table>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
        <span class="text-xs text-slate-400">{{ totalItems }} products</span>
        <div class="flex gap-1">
          <button @click="onPageChange(Math.max(1, page - 1))" :disabled="page <= 1" class="px-2.5 py-1 rounded text-xs border disabled:opacity-30">Prev</button>
          <span class="px-2.5 py-1 text-xs text-slate-500">{{ page }} / {{ totalPages }}</span>
          <button @click="onPageChange(Math.min(totalPages, page + 1))" :disabled="page >= totalPages" class="px-2.5 py-1 rounded text-xs border disabled:opacity-30">Next</button>
        </div>
      </div>
    </div>

    <!-- Suggest Edit Modal -->
    <div v-if="showSuggest" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showSuggest = false">
      <div class="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
        <h2 class="text-lg font-bold text-slate-800 mb-2">Suggest an Edit</h2>
        <p class="text-xs text-slate-500 mb-4">
          Product: <span class="font-mono font-medium text-slate-700">{{ suggestProduct?.product_code }}</span> — {{ suggestProduct?.product_name }}
        </p>

        <div v-if="suggestSent" class="py-8 text-center">
          <i class="pi pi-check-circle text-3xl text-emerald-500 mb-2" />
          <p class="text-sm font-medium text-emerald-700">Suggestion submitted! Our team will review it.</p>
        </div>

        <template v-else>
          <textarea v-model="suggestText" class="w-full h-24 px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none" placeholder="Describe the change you'd like (e.g. 'Material should be Steel', 'Wrong dimension')"></textarea>
          <div class="flex justify-end gap-3 mt-4">
            <button @click="showSuggest = false" class="px-3 py-1.5 text-slate-500 text-sm">Cancel</button>
            <button @click="submitSuggestion" :disabled="!suggestText.trim()" class="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">Submit Suggestion</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
