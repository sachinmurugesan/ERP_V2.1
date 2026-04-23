<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { factoriesApi } from '../../api'

const router = useRouter()
const route = useRoute()

const isEdit = computed(() => !!route.params.id)
const factoryId = computed(() => route.params.id)

// State
const loading = ref(false)
const saving = ref(false)
const errors = ref({})
const successMsg = ref('')

// Form data
const form = ref({
  factory_code: '',
  company_name: '',
  company_name_chinese: '',
  address: '',
  city: '',
  province: '',
  country: 'China',
  port_of_loading: '',
  primary_contact_name: '',
  primary_contact_phone: '',
  primary_contact_wechat: '',
  primary_contact_email: '',
  bank_name: '',
  bank_account: '',
  bank_swift: '',
  quality_rating: null,
  notes: '',
})

// Common ports for dropdown
const commonPorts = [
  'Shanghai', 'Ningbo', 'Guangzhou', 'Shenzhen', 'Qingdao',
  'Tianjin', 'Xiamen', 'Dalian', 'Fuzhou', 'Lianyungang'
]

// Load existing factory
async function loadFactory() {
  if (!isEdit.value) return
  loading.value = true
  try {
    const { data } = await factoriesApi.get(factoryId.value)
    Object.keys(form.value).forEach(key => {
      if (data[key] !== undefined && data[key] !== null) {
        form.value[key] = data[key]
      }
    })
  } catch (err) {
    console.error('Failed to load factory:', err)
    errors.value.general = 'Failed to load factory data'
  } finally {
    loading.value = false
  }
}

// Validate
function validate() {
  errors.value = {}

  if (!form.value.factory_code.trim()) {
    errors.value.factory_code = 'Factory code is required'
  }
  if (!form.value.company_name.trim()) {
    errors.value.company_name = 'Company name is required'
  }
  if (form.value.quality_rating !== null && (form.value.quality_rating < 1 || form.value.quality_rating > 5)) {
    errors.value.quality_rating = 'Rating must be between 1 and 5'
  }

  return Object.keys(errors.value).length === 0
}

// Submit
async function handleSubmit() {
  if (!validate()) return

  saving.value = true
  errors.value = {}

  const payload = { ...form.value }
  // Convert empty strings to null
  const optionalFields = [
    'company_name_chinese', 'address', 'city', 'province', 'port_of_loading',
    'primary_contact_name', 'primary_contact_phone', 'primary_contact_wechat',
    'primary_contact_email', 'bank_name', 'bank_account', 'bank_swift', 'notes'
  ]
  optionalFields.forEach(field => {
    if (payload[field] === '') payload[field] = null
  })
  if (payload.quality_rating === '' || payload.quality_rating === 0) payload.quality_rating = null
  else if (payload.quality_rating) payload.quality_rating = parseInt(payload.quality_rating)

  try {
    if (isEdit.value) {
      await factoriesApi.update(factoryId.value, payload)
      successMsg.value = 'Factory updated successfully!'
    } else {
      await factoriesApi.create(payload)
      successMsg.value = 'Factory created successfully!'
    }

    setTimeout(() => {
      router.push('/factories')
    }, 800)
  } catch (err) {
    const detail = err.response?.data?.detail
    if (detail === 'Factory code already exists') {
      errors.value.factory_code = 'This factory code is already in use'
    } else {
      errors.value.general = detail || 'Failed to save factory'
    }
  } finally {
    saving.value = false
  }
}

function handleCancel() {
  router.push('/factories')
}

onMounted(() => {
  loadFactory()
})
</script>

<template>
  <div class="max-w-4xl">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-6">
      <button
        @click="handleCancel"
        class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <i class="pi pi-arrow-left" />
      </button>
      <div>
        <h2 class="text-lg font-semibold text-slate-800">
          {{ isEdit ? 'Edit Factory' : 'New Factory' }}
        </h2>
        <p class="text-sm text-slate-500">
          {{ isEdit ? 'Update factory/supplier details' : 'Register a new factory/supplier' }}
        </p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-xl shadow-sm p-12 text-center">
      <i class="pi pi-spin pi-spinner text-2xl text-emerald-500" />
      <p class="text-sm text-slate-400 mt-2">Loading factory...</p>
    </div>

    <!-- Form -->
    <form v-else @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Success / Error -->
      <div v-if="successMsg" class="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
        <i class="pi pi-check-circle" /> {{ successMsg }}
      </div>
      <div v-if="errors.general" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
        <i class="pi pi-exclamation-circle" /> {{ errors.general }}
      </div>

      <!-- Section 1: Company Info -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          <i class="pi pi-building mr-2 text-emerald-500" />Company Information
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Factory Code -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">
              Factory Code <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.factory_code"
              type="text"
              placeholder="e.g. FAC-001"
              :class="[
                'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500',
                errors.factory_code ? 'border-red-300 bg-red-50' : 'border-slate-200'
              ]"
            />
            <p v-if="errors.factory_code" class="mt-1 text-xs text-red-500">{{ errors.factory_code }}</p>
          </div>

          <!-- Company Name -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">
              Company Name <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.company_name"
              type="text"
              placeholder="Factory company name"
              :class="[
                'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500',
                errors.company_name ? 'border-red-300 bg-red-50' : 'border-slate-200'
              ]"
            />
            <p v-if="errors.company_name" class="mt-1 text-xs text-red-500">{{ errors.company_name }}</p>
          </div>

          <!-- Chinese Name -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Chinese Name</label>
            <input
              v-model="form.company_name_chinese"
              type="text"
              placeholder="Chinese company name"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- Country -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Country</label>
            <input
              v-model="form.country"
              type="text"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      <!-- Section 2: Address & Port -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          <i class="pi pi-map-marker mr-2 text-blue-500" />Address & Shipping
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Address -->
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-slate-700 mb-1">Address</label>
            <input
              v-model="form.address"
              type="text"
              placeholder="Street address"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- City -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">City</label>
            <input
              v-model="form.city"
              type="text"
              placeholder="e.g. Shanghai, Guangzhou"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- Province -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Province</label>
            <input
              v-model="form.province"
              type="text"
              placeholder="e.g. Zhejiang, Guangdong"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- Port of Loading -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Port of Loading</label>
            <select
              v-model="form.port_of_loading"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select port</option>
              <option v-for="port in commonPorts" :key="port" :value="port">
                {{ port }}
              </option>
            </select>
            <p class="mt-1 text-xs text-slate-400">Used to estimate transit times</p>
          </div>

          <!-- Quality Rating -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Quality Rating</label>
            <select
              v-model.number="form.quality_rating"
              :class="[
                'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500',
                errors.quality_rating ? 'border-red-300 bg-red-50' : 'border-slate-200'
              ]"
            >
              <option :value="null">Not rated</option>
              <option :value="1">1 - Poor</option>
              <option :value="2">2 - Below Average</option>
              <option :value="3">3 - Average</option>
              <option :value="4">4 - Good</option>
              <option :value="5">5 - Excellent</option>
            </select>
            <p v-if="errors.quality_rating" class="mt-1 text-xs text-red-500">{{ errors.quality_rating }}</p>
          </div>
        </div>
      </div>

      <!-- Section 3: Primary Contact -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          <i class="pi pi-user mr-2 text-purple-500" />Primary Contact
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Contact Name -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Contact Name</label>
            <input
              v-model="form.primary_contact_name"
              type="text"
              placeholder="Full name"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- Phone -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input
              v-model="form.primary_contact_phone"
              type="text"
              placeholder="+86 xxx xxxx xxxx"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- WeChat -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">WeChat</label>
            <input
              v-model="form.primary_contact_wechat"
              type="text"
              placeholder="WeChat ID"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- Email -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              v-model="form.primary_contact_email"
              type="email"
              placeholder="email@factory.com"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      <!-- Section 4: Bank Details -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          <i class="pi pi-wallet mr-2 text-amber-500" />Bank Details (for payments)
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Bank Name -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Bank Name</label>
            <input
              v-model="form.bank_name"
              type="text"
              placeholder="Bank name"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- Account Number -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Account Number</label>
            <input
              v-model="form.bank_account"
              type="text"
              placeholder="Account number"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- SWIFT Code -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">SWIFT Code</label>
            <input
              v-model="form.bank_swift"
              type="text"
              placeholder="SWIFT/BIC code"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      <!-- Section 5: Notes -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          <i class="pi pi-file-edit mr-2 text-slate-400" />Notes
        </h3>
        <textarea
          v-model="form.notes"
          rows="3"
          placeholder="Additional notes about this factory..."
          class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-3 justify-end">
        <button
          type="button"
          @click="handleCancel"
          class="px-6 py-2.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          :disabled="saving"
          class="px-6 py-2.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <i v-if="saving" class="pi pi-spin pi-spinner text-sm" />
          <i v-else class="pi pi-check text-sm" />
          {{ isEdit ? 'Update Factory' : 'Create Factory' }}
        </button>
      </div>
    </form>
  </div>
</template>
