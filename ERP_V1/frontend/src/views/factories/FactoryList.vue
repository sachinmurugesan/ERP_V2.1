<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { factoriesApi } from '../../api'

const router = useRouter()

// State
const factories = ref([])
const loading = ref(false)
const search = ref('')
const page = ref(1)
const perPage = ref(50)
const totalItems = ref(0)
const showDeleteConfirm = ref(false)
const deleteTarget = ref(null)

const totalPages = computed(() => Math.ceil(totalItems.value / perPage.value))

// Load factories
async function loadFactories() {
  loading.value = true
  try {
    const params = { page: page.value, per_page: perPage.value }
    if (search.value) params.search = search.value

    const { data } = await factoriesApi.list(params)
    factories.value = data.items
    totalItems.value = data.total
  } catch (err) {
    console.error('Failed to load factories:', err)
  } finally {
    loading.value = false
  }
}

// Search debounce
let searchTimer = null
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadFactories()
  }, 400)
}

// Pagination
function goToPage(p) {
  if (p >= 1 && p <= totalPages.value) {
    page.value = p
    loadFactories()
  }
}

// Quality rating stars
function ratingStars(rating) {
  if (!rating) return []
  return Array.from({ length: 5 }, (_, i) => i < rating)
}

// Delete
function confirmDelete(factory) {
  deleteTarget.value = factory
  showDeleteConfirm.value = true
}

async function executeDelete() {
  if (!deleteTarget.value) return
  try {
    await factoriesApi.delete(deleteTarget.value.id)
    showDeleteConfirm.value = false
    deleteTarget.value = null
    loadFactories()
  } catch (err) {
    console.error('Failed to delete factory:', err)
  }
}

function cancelDelete() {
  showDeleteConfirm.value = false
  deleteTarget.value = null
}

onMounted(() => {
  loadFactories()
})
</script>

<template>
  <div>
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-lg font-semibold text-slate-800">Factories / Suppliers</h2>
        <p class="text-sm text-slate-500 mt-0.5">{{ totalItems }} factories</p>
      </div>
      <router-link
        to="/factories/new"
        class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
      >
        <i class="pi pi-plus text-xs" /> Add Factory
      </router-link>
    </div>

    <!-- Search Bar -->
    <div class="bg-white rounded-xl shadow-sm p-4 mb-4">
      <div class="relative max-w-md">
        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
        <input
          v-model="search"
          @input="onSearchInput"
          type="text"
          placeholder="Search by code, name, city, port..."
          class="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl shadow-sm overflow-hidden">
      <!-- Loading -->
      <div v-if="loading" class="p-12 text-center">
        <i class="pi pi-spin pi-spinner text-2xl text-emerald-500" />
        <p class="text-sm text-slate-400 mt-2">Loading factories...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="factories.length === 0" class="p-12 text-center">
        <i class="pi pi-building text-4xl text-slate-300" />
        <p class="text-slate-400 mt-3">No factories found</p>
        <router-link
          to="/factories/new"
          class="inline-block mt-3 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
        >
          + Add your first factory
        </router-link>
      </div>

      <!-- Data Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200">
              <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Code</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Company Name</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Location</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Port of Loading</th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Quality</th>
              <th class="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="factory in factories"
              :key="factory.id"
              class="hover:bg-slate-50 transition-colors"
            >
              <!-- Code -->
              <td class="px-4 py-3">
                <span class="text-sm font-mono font-medium text-slate-800">{{ factory.factory_code }}</span>
              </td>

              <!-- Company Name -->
              <td class="px-4 py-3">
                <span class="text-sm text-slate-700 font-medium">{{ factory.company_name }}</span>
                <span v-if="factory.company_name_chinese" class="block text-xs text-slate-400">{{ factory.company_name_chinese }}</span>
              </td>

              <!-- Location -->
              <td class="px-4 py-3 text-sm text-slate-600">
                <span v-if="factory.city || factory.province">
                  {{ [factory.city, factory.province].filter(Boolean).join(', ') }}
                </span>
                <span v-else class="text-slate-400">—</span>
                <span class="block text-xs text-slate-400">{{ factory.country }}</span>
              </td>

              <!-- Port of Loading -->
              <td class="px-4 py-3">
                <span
                  v-if="factory.port_of_loading"
                  class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-50 text-cyan-700"
                >
                  <i class="pi pi-compass mr-1 text-[10px]" />
                  {{ factory.port_of_loading }}
                </span>
                <span v-else class="text-sm text-slate-400">—</span>
              </td>

              <!-- Contact -->
              <td class="px-4 py-3 text-sm text-slate-600">
                <span v-if="factory.primary_contact_name">{{ factory.primary_contact_name }}</span>
                <span v-else class="text-slate-400">—</span>
                <span v-if="factory.primary_contact_phone" class="block text-xs text-slate-400">
                  {{ factory.primary_contact_phone }}
                </span>
              </td>

              <!-- Quality Rating -->
              <td class="px-4 py-3 text-center">
                <div v-if="factory.quality_rating" class="flex items-center justify-center gap-0.5">
                  <i
                    v-for="(filled, i) in ratingStars(factory.quality_rating)"
                    :key="i"
                    :class="[
                      'text-xs',
                      filled ? 'pi pi-star-fill text-amber-400' : 'pi pi-star text-slate-300'
                    ]"
                  />
                </div>
                <span v-else class="text-sm text-slate-400">—</span>
              </td>

              <!-- Actions -->
              <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button
                    @click="router.push(`/factories/${factory.id}/edit`)"
                    class="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <i class="pi pi-pencil text-sm" />
                  </button>
                  <button
                    @click="confirmDelete(factory)"
                    class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <i class="pi pi-trash text-sm" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50"
      >
        <p class="text-sm text-slate-500">
          Showing {{ (page - 1) * perPage + 1 }}–{{ Math.min(page * perPage, totalItems) }} of {{ totalItems }}
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

    <!-- Delete Confirmation Modal -->
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
          <h3 class="text-lg font-semibold text-slate-800">Delete Factory</h3>
        </div>
        <p class="text-sm text-slate-600 mb-1">Are you sure you want to delete:</p>
        <p class="text-sm font-medium text-slate-800 mb-4">
          {{ deleteTarget?.factory_code }} — {{ deleteTarget?.company_name }}
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
  </div>
</template>
