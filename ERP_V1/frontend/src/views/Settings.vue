<script setup>
import { ref, onMounted, watch } from 'vue'
import { settingsApi } from '../api'


// ========================================
// State
// ========================================
const loading = ref(true)
const saving = ref(false)
const activeTab = ref('rates')
const message = ref('')

// Tab definitions
const tabs = [
  { key: 'rates', label: 'Exchange Rates', icon: 'pi pi-money-bill' },
  { key: 'categories', label: 'Categories', icon: 'pi pi-th-large' },
  { key: 'transit', label: 'Transit Times', icon: 'pi pi-truck' },
  { key: 'defaults', label: 'Defaults', icon: 'pi pi-sliders-h' },
]

// Currency helpers
const currencyNames = {
  CNY: 'Chinese Yuan',
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  INR: 'Indian Rupee',
}
const getCurrencyName = (code) => currencyNames[code] || code

// Exchange Rates
const rates = ref([])
const editingRate = ref(null)
const showNewRateForm = ref(false)
const rateForm = ref({ from_currency: 'CNY', to_currency: 'INR', rate: 0 })

// Categories
const categories = ref([])
const showCategoryForm = ref(false)
const editingCategory = ref(null)
const categoryForm = ref({ name: '', markup_percent: 15.0 })

// Transit Times
const transitTimes = ref([])
const showTransitForm = ref(false)
const editingTransit = ref(null)
const transitForm = ref({ port_of_loading: '', port_of_discharge: '', transit_days: 18 })

// System Defaults
const defaults = ref([])
const editingDefault = ref(null)

// ========================================
// Load Data
// ========================================
async function loadAll() {
  loading.value = true
  try {
    const [ratesRes, catsRes, transRes, defsRes] = await Promise.all([
      settingsApi.getExchangeRates(),
      settingsApi.getCategories(),
      settingsApi.getTransitTimes(),
      settingsApi.getDefaultsList(),
    ])
    rates.value = ratesRes.data
    categories.value = catsRes.data
    transitTimes.value = transRes.data
    defaults.value = defsRes.data
  } catch (e) {
    console.error('Failed to load settings:', e)
  } finally {
    loading.value = false
  }
}

async function seedData() {
  saving.value = true
  try {
    const { data } = await settingsApi.seedData()
    showMessage(`${data.message}`)
    await loadAll()
  } catch (e) {
    showMessage('Seed failed: ' + (e.response?.data?.detail || e.message))
  } finally {
    saving.value = false
  }
}

function showMessage(msg) {
  message.value = msg
  setTimeout(() => message.value = '', 3000)
}

// ========================================
// Exchange Rates
// ========================================
function editRate(rate) {
  editingRate.value = rate.id
  rateForm.value = { from_currency: rate.from_currency, to_currency: rate.to_currency, rate: rate.rate }
}

async function saveRate() {
  saving.value = true
  try {
    await settingsApi.updateExchangeRate(rateForm.value)
    editingRate.value = null
    showMessage('Rate updated')
    await loadAll()
  } catch (e) {
    showMessage('Error: ' + (e.response?.data?.detail || e.message))
  } finally {
    saving.value = false
  }
}

function cancelRateEdit() {
  editingRate.value = null
}

function openNewRate() {
  showNewRateForm.value = true
  rateForm.value = { from_currency: 'CNY', to_currency: 'INR', rate: 0 }
}

async function saveNewRate() {
  saving.value = true
  try {
    await settingsApi.updateExchangeRate(rateForm.value)
    showNewRateForm.value = false
    showMessage('Currency pair added')
    await loadAll()
  } catch (e) {
    showMessage('Error: ' + (e.response?.data?.detail || e.message))
  } finally {
    saving.value = false
  }
}

// ========================================
// Categories
// ========================================
function openCategoryForm(cat = null) {
  if (cat) {
    editingCategory.value = cat.id
    categoryForm.value = { name: cat.name, markup_percent: cat.markup_percent }
  } else {
    editingCategory.value = null
    categoryForm.value = { name: '', markup_percent: 15.0 }
  }
  showCategoryForm.value = true
}

async function saveCategory() {
  saving.value = true
  try {
    if (editingCategory.value) {
      await settingsApi.updateCategory(editingCategory.value, categoryForm.value)
      showMessage('Category updated')
    } else {
      await settingsApi.createCategory(categoryForm.value)
      showMessage('Category created')
    }
    showCategoryForm.value = false
    await loadAll()
  } catch (e) {
    showMessage('Error: ' + (e.response?.data?.detail || e.message))
  } finally {
    saving.value = false
  }
}

async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return
  try {
    await settingsApi.deleteCategory(id)
    showMessage('Category deleted')
    await loadAll()
  } catch (e) {
    showMessage('Error: ' + (e.response?.data?.detail || e.message))
  }
}

// ========================================
// Transit Times
// ========================================
function openTransitForm(tt = null) {
  if (tt) {
    editingTransit.value = tt.id
    transitForm.value = { port_of_loading: tt.port_of_loading, port_of_discharge: tt.port_of_discharge, transit_days: tt.transit_days }
  } else {
    editingTransit.value = null
    transitForm.value = { port_of_loading: '', port_of_discharge: '', transit_days: 18 }
  }
  showTransitForm.value = true
}

async function saveTransit() {
  saving.value = true
  try {
    if (editingTransit.value) {
      await settingsApi.updateTransitTime(editingTransit.value, transitForm.value)
      showMessage('Transit time updated')
    } else {
      await settingsApi.createTransitTime(transitForm.value)
      showMessage('Transit time added')
    }
    showTransitForm.value = false
    await loadAll()
  } catch (e) {
    showMessage('Error: ' + (e.response?.data?.detail || e.message))
  } finally {
    saving.value = false
  }
}

async function deleteTransit(id) {
  if (!confirm('Delete this transit route?')) return
  try {
    await settingsApi.deleteTransitTime(id)
    showMessage('Transit time deleted')
    await loadAll()
  } catch (e) {
    showMessage('Error: ' + (e.response?.data?.detail || e.message))
  }
}

// ========================================
// System Defaults
// ========================================
function editDefault(setting) {
  editingDefault.value = setting.key
}

async function saveDefault(setting) {
  saving.value = true
  try {
    await settingsApi.updateDefault(setting.key, setting.value)
    editingDefault.value = null
    showMessage(`"${setting.key}" updated`)
  } catch (e) {
    showMessage('Error: ' + (e.response?.data?.detail || e.message))
  } finally {
    saving.value = false
  }
}

onMounted(loadAll)
</script>

<template>
  <div>
    <!-- Toast Message -->
    <Teleport to="body">
      <Transition enter-active-class="transition-all duration-300 ease-out"
                  enter-from-class="translate-x-full opacity-0"
                  enter-to-class="translate-x-0 opacity-100"
                  leave-active-class="transition-all duration-200 ease-in"
                  leave-from-class="translate-x-0 opacity-100"
                  leave-to-class="translate-x-full opacity-0">
        <div v-if="message" class="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
          <i class="pi pi-check-circle" />
          {{ message }}
          <button @click="message = ''" class="ml-2 hover:text-emerald-200">
            <i class="pi pi-times text-xs" />
          </button>
        </div>
      </Transition>
    </Teleport>

    <!-- Header -->
    <div class="flex justify-between items-start mb-6">
      <div>
        <h1 class="text-xl font-bold text-slate-900">Configuration</h1>
        <p class="text-sm text-slate-500 mt-1">Manage global system parameters, exchange rates, and defaults.</p>
      </div>
      <button
        @click="seedData"
        :disabled="saving"
        class="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
      >
        <i class="pi pi-database text-sm" />
        Seed Data
      </button>
    </div>

    <!-- Tabs -->
    <div class="border-b border-slate-200 mb-6">
      <div class="flex gap-6">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          @click="activeTab = tab.key"
          class="flex items-center gap-2 px-1 pb-3 text-sm font-medium border-b-2 -mb-px transition-colors"
          :class="activeTab === tab.key
            ? 'border-emerald-600 text-emerald-600'
            : 'border-transparent text-slate-500 hover:text-slate-700'"
        >
          <i :class="tab.icon" class="text-sm" />
          {{ tab.label }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-xl shadow-sm p-12 text-center text-slate-400">
      <i class="pi pi-spinner pi-spin text-2xl" />
      <p class="mt-2">Loading settings...</p>
    </div>

    <!-- ==================== EXCHANGE RATES ==================== -->
    <div v-else-if="activeTab === 'rates'">
      <div class="bg-white rounded-xl shadow-sm">
        <!-- Toolbar: filter + info + add button -->
        <div class="p-6 flex items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <span class="text-xs text-slate-400 flex items-center gap-1">
              <i class="pi pi-info-circle text-xs" /> Changes effect new calculations immediately
            </span>
            <button @click="openNewRate"
              class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
              <i class="pi pi-plus text-xs" />
              Add Currency Pair
            </button>
          </div>
        </div>

        <!-- New Rate Form -->
        <div v-if="showNewRateForm" class="px-6 pb-4 border-b border-slate-100 bg-slate-50">
          <h4 class="text-sm font-medium text-slate-700 mb-3 pt-4">New Currency Pair</h4>
          <div class="flex gap-4 items-end">
            <div class="w-40">
              <label class="block text-xs text-slate-500 mb-1">From Currency</label>
              <input v-model="rateForm.from_currency" type="text" placeholder="CNY"
                class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div class="w-40">
              <label class="block text-xs text-slate-500 mb-1">To Currency</label>
              <input v-model="rateForm.to_currency" type="text" placeholder="INR"
                class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div class="w-40">
              <label class="block text-xs text-slate-500 mb-1">Rate</label>
              <input v-model.number="rateForm.rate" type="number" step="0.01"
                class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <button @click="saveNewRate" :disabled="saving || !rateForm.from_currency || !rateForm.to_currency"
              class="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-4 py-2 rounded-lg text-sm">
              Add
            </button>
            <button @click="showNewRateForm = false" class="text-slate-400 hover:text-slate-600 px-3 py-2 text-sm">
              Cancel
            </button>
          </div>
        </div>

        <div v-if="rates.length === 0" class="p-6 text-center text-slate-400">
          <p>No exchange rates configured. Click "Seed Data" to add defaults.</p>
        </div>

        <table v-else class="w-full">
          <thead class="bg-slate-50 text-left">
            <tr>
              <th class="text-xs font-semibold uppercase tracking-wide text-slate-400 px-6 py-3">From Currency</th>
              <th class="text-xs font-semibold uppercase tracking-wide text-slate-400 px-6 py-3">To Currency</th>
              <th class="text-xs font-semibold uppercase tracking-wide text-slate-400 px-6 py-3">Exchange Rate</th>
              <th class="text-xs font-semibold uppercase tracking-wide text-slate-400 px-6 py-3">Last Updated</th>
              <th class="text-xs font-semibold uppercase tracking-wide text-slate-400 px-6 py-3 w-32">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="rate in rates" :key="rate.id" class="hover:bg-slate-50">
              <!-- FROM CURRENCY -->
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
                    <i class="pi pi-money-bill text-amber-500 text-xs" />
                  </div>
                  <div>
                    <div class="text-sm font-semibold text-slate-800">{{ rate.from_currency }}</div>
                    <div class="text-xs text-slate-400">{{ getCurrencyName(rate.from_currency) }}</div>
                  </div>
                </div>
              </td>
              <!-- TO CURRENCY -->
              <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
                    <i class="pi pi-money-bill text-amber-500 text-xs" />
                  </div>
                  <div>
                    <div class="text-sm font-semibold text-slate-800">{{ rate.to_currency }}</div>
                    <div class="text-xs text-slate-400">{{ getCurrencyName(rate.to_currency) }}</div>
                  </div>
                </div>
              </td>
              <!-- EXCHANGE RATE -->
              <td class="px-6 py-4">
                <div v-if="editingRate === rate.id" class="flex items-center gap-2">
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">&#8377;</span>
                    <input v-model.number="rateForm.rate" type="number" step="0.01"
                      class="border border-emerald-300 rounded-lg pl-7 pr-14 py-2 text-sm w-32 focus:ring-2 focus:ring-emerald-500" />
                    <span class="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-xs">INR</span>
                  </div>
                </div>
                <div v-else class="text-sm font-mono text-slate-700">&#8377; {{ rate.rate }}</div>
              </td>
              <!-- LAST UPDATED -->
              <td class="px-6 py-4 text-sm text-slate-400">
                {{ rate.updated_at ? new Date(rate.updated_at).toLocaleDateString() : '—' }}
              </td>
              <!-- ACTIONS -->
              <td class="px-6 py-4">
                <template v-if="editingRate !== rate.id">
                  <button @click="editRate(rate)" class="text-blue-600 hover:text-blue-800 text-sm">
                    <i class="pi pi-pencil" /> Edit
                  </button>
                </template>
                <template v-else>
                  <button @click="saveRate" :disabled="saving" class="text-emerald-600 hover:text-emerald-800 text-sm mr-3">
                    <i class="pi pi-check" />
                  </button>
                  <button @click="cancelRateEdit" class="text-slate-400 hover:text-slate-600 text-sm">
                    <i class="pi pi-times" />
                  </button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Footer count -->
        <div v-if="rates.length" class="px-6 py-3 border-t border-slate-100 text-xs text-slate-400">
          Showing 1 to {{ rates.length }} of {{ rates.length }} currencies
        </div>
      </div>

      <!-- Info Banner -->
      <div class="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <i class="pi pi-info-circle text-blue-500 mt-0.5 flex-shrink-0" />
        <div>
          <div class="text-sm font-medium text-blue-800">About Exchange Rates</div>
          <p class="text-sm text-blue-600 mt-1">
            Rates are used to convert factory prices (CNY/USD) to selling prices (INR) and to track payment remittances. Historical rates are preserved on completed orders. Changing a rate here only affects new drafts and open calculations.
          </p>
        </div>
      </div>
    </div>

    <!-- ==================== CATEGORIES & MARKUPS ==================== -->
    <div v-else-if="activeTab === 'categories'" class="bg-white rounded-xl shadow-sm">
      <div class="p-6 border-b border-slate-100 flex justify-between items-center">
        <div>
          <h3 class="font-semibold text-slate-800">Product Categories & Default Markups</h3>
          <p class="text-sm text-slate-400 mt-1">Markup % applied when "Convert to Selling Price" is clicked at Stage 2. Can be overridden per product.</p>
        </div>
        <button @click="openCategoryForm()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm">
          <i class="pi pi-plus mr-1" /> Add Category
        </button>
      </div>

      <!-- Category Form Modal -->
      <div v-if="showCategoryForm" class="p-6 border-b border-slate-100 bg-slate-50">
        <h4 class="text-sm font-medium text-slate-700 mb-3">{{ editingCategory ? 'Edit Category' : 'New Category' }}</h4>
        <div class="flex gap-4 items-end">
          <div class="flex-1">
            <label class="block text-xs text-slate-500 mb-1">Category Name</label>
            <input v-model="categoryForm.name" type="text" placeholder="e.g. Engine Parts"
              class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div class="w-40">
            <label class="block text-xs text-slate-500 mb-1">Default Markup %</label>
            <input v-model.number="categoryForm.markup_percent" type="number" step="0.5" min="0" max="100"
              class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <button @click="saveCategory" :disabled="saving || !categoryForm.name"
            class="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-4 py-2 rounded-lg text-sm">
            {{ editingCategory ? 'Update' : 'Add' }}
          </button>
          <button @click="showCategoryForm = false" class="text-slate-400 hover:text-slate-600 px-3 py-2 text-sm">
            Cancel
          </button>
        </div>
      </div>

      <div v-if="categories.length === 0" class="p-6 text-center text-slate-400">
        <p>No categories configured. Click "Seed Default Data" or add categories manually.</p>
      </div>

      <table v-else class="w-full">
        <thead class="bg-slate-50 text-left">
          <tr>
            <th class="text-xs font-semibold uppercase tracking-wide text-slate-400 px-6 py-3">Category Name</th>
            <th class="text-xs font-semibold uppercase tracking-wide text-slate-400 px-6 py-3">Default Markup %</th>
            <th class="text-xs font-semibold uppercase tracking-wide text-slate-400 px-6 py-3 w-40">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="cat in categories" :key="cat.id" class="hover:bg-slate-50">
            <td class="px-6 py-3 font-medium">{{ cat.name }}</td>
            <td class="px-6 py-3">
              <span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-sm font-mono">{{ cat.markup_percent }}%</span>
            </td>
            <td class="px-6 py-3 flex gap-3">
              <button @click="openCategoryForm(cat)" class="text-blue-600 hover:text-blue-800 text-sm">
                <i class="pi pi-pencil" /> Edit
              </button>
              <button @click="deleteCategory(cat.id)" class="text-red-500 hover:text-red-700 text-sm">
                <i class="pi pi-trash" /> Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ==================== TRANSIT TIMES ==================== -->
    <div v-else-if="activeTab === 'transit'" class="bg-white rounded-xl shadow-sm">
      <div class="p-6 border-b border-slate-100 flex justify-between items-center">
        <div>
          <h3 class="font-semibold text-slate-800">Port-to-Port Transit Times</h3>
          <p class="text-sm text-slate-400 mt-1">Default transit days used for ETA calculation when booking a container.</p>
        </div>
        <button @click="openTransitForm()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm">
          <i class="pi pi-plus mr-1" /> Add Route
        </button>
      </div>

      <!-- Transit Form -->
      <div v-if="showTransitForm" class="p-6 border-b border-slate-100 bg-slate-50">
        <h4 class="text-sm font-medium text-slate-700 mb-3">{{ editingTransit ? 'Edit Route' : 'New Route' }}</h4>
        <div class="flex gap-4 items-end">
          <div class="flex-1">
            <label class="block text-xs text-slate-500 mb-1">Port of Loading (China)</label>
            <input v-model="transitForm.port_of_loading" type="text" placeholder="e.g. Shanghai"
              class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div class="flex-1">
            <label class="block text-xs text-slate-500 mb-1">Port of Discharge (India)</label>
            <input v-model="transitForm.port_of_discharge" type="text" placeholder="e.g. Nhava Sheva (Mumbai)"
              class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div class="w-32">
            <label class="block text-xs text-slate-500 mb-1">Transit Days</label>
            <input v-model.number="transitForm.transit_days" type="number" min="1" max="90"
              class="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <button @click="saveTransit" :disabled="saving || !transitForm.port_of_loading || !transitForm.port_of_discharge"
            class="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-4 py-2 rounded-lg text-sm">
            {{ editingTransit ? 'Update' : 'Add' }}
          </button>
          <button @click="showTransitForm = false" class="text-slate-400 hover:text-slate-600 px-3 py-2 text-sm">
            Cancel
          </button>
        </div>
      </div>

      <div v-if="transitTimes.length === 0" class="p-6 text-center text-slate-400">
        <p>No transit routes configured. Click "Seed Default Data" or add routes manually.</p>
      </div>

      <table v-else class="w-full">
        <thead class="bg-slate-50 text-left">
          <tr>
            <th class="text-xs font-semibold uppercase tracking-wide text-slate-400 px-6 py-3">Port of Loading</th>
            <th class="text-xs font-semibold uppercase tracking-wide text-slate-400 px-6 py-3">→</th>
            <th class="text-xs font-semibold uppercase tracking-wide text-slate-400 px-6 py-3">Port of Discharge</th>
            <th class="text-xs font-semibold uppercase tracking-wide text-slate-400 px-6 py-3">Transit Days</th>
            <th class="text-xs font-semibold uppercase tracking-wide text-slate-400 px-6 py-3 w-40">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="tt in transitTimes" :key="tt.id" class="hover:bg-slate-50">
            <td class="px-6 py-3">{{ tt.port_of_loading }}</td>
            <td class="px-6 py-3 text-slate-300">→</td>
            <td class="px-6 py-3">{{ tt.port_of_discharge }}</td>
            <td class="px-6 py-3">
              <span class="bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded text-sm font-mono">{{ tt.transit_days }} days</span>
            </td>
            <td class="px-6 py-3 flex gap-3">
              <button @click="openTransitForm(tt)" class="text-blue-600 hover:text-blue-800 text-sm">
                <i class="pi pi-pencil" /> Edit
              </button>
              <button @click="deleteTransit(tt.id)" class="text-red-500 hover:text-red-700 text-sm">
                <i class="pi pi-trash" /> Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ==================== SYSTEM DEFAULTS ==================== -->
    <div v-else-if="activeTab === 'defaults'" class="bg-white rounded-xl shadow-sm">
      <div class="p-6 border-b border-slate-100">
        <h3 class="font-semibold text-slate-800">System Defaults</h3>
        <p class="text-sm text-slate-400 mt-1">Company information, default values for forms, and system-wide settings.</p>
      </div>

      <div v-if="defaults.length === 0" class="p-6 text-center text-slate-400">
        <p>No system defaults configured. Click "Seed Default Data" to add defaults.</p>
      </div>

      <table v-else class="w-full">
        <thead class="bg-slate-50 text-left">
          <tr>
            <th class="text-xs font-semibold uppercase tracking-wide text-slate-400 px-6 py-3">Setting Key</th>
            <th class="text-xs font-semibold uppercase tracking-wide text-slate-400 px-6 py-3">Value</th>
            <th class="text-xs font-semibold uppercase tracking-wide text-slate-400 px-6 py-3">Type</th>
            <th class="text-xs font-semibold uppercase tracking-wide text-slate-400 px-6 py-3 w-32">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="setting in defaults" :key="setting.id" class="hover:bg-slate-50">
            <td class="px-6 py-3 font-medium text-sm">
              {{ setting.key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }}
              <span class="block text-xs text-slate-400 font-mono">{{ setting.key }}</span>
            </td>
            <td class="px-6 py-3">
              <span v-if="editingDefault !== setting.key">{{ setting.value || '—' }}</span>
              <input v-else v-model="setting.value" type="text"
                class="w-64 border border-slate-300 rounded px-2 py-1 text-sm" />
            </td>
            <td class="px-6 py-3 text-xs text-slate-400">{{ setting.data_type }}</td>
            <td class="px-6 py-3">
              <template v-if="editingDefault !== setting.key">
                <button @click="editDefault(setting)" class="text-blue-600 hover:text-blue-800 text-sm">
                  <i class="pi pi-pencil" /> Edit
                </button>
              </template>
              <template v-else>
                <button @click="saveDefault(setting)" :disabled="saving" class="text-emerald-600 hover:text-emerald-800 text-sm mr-2">
                  <i class="pi pi-check" /> Save
                </button>
                <button @click="editingDefault = null" class="text-slate-400 hover:text-slate-600 text-sm">
                  Cancel
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
