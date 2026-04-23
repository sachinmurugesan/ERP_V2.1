<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { clientsApi } from '../../api'
import { INDIAN_STATES } from '../../utils/constants'

const router = useRouter()
const route = useRoute()

const isEdit = computed(() => !!route.params.id)
const clientId = computed(() => route.params.id)

// State
const loading = ref(false)
const saving = ref(false)
const errors = ref({})
const successMsg = ref('')

// INDIAN_STATES imported from utils/constants

// Form data
const form = ref({
  company_name: '',
  gstin: '',
  iec: '',
  pan: '',
  address: '',
  city: '',
  state: '',
  pincode: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
  notes: '',
  client_type: 'REGULAR',
  factory_markup_percent: null,
  sourcing_commission_percent: null,
})

// Load existing client
async function loadClient() {
  if (!isEdit.value) return
  loading.value = true
  try {
    const { data } = await clientsApi.get(clientId.value)
    Object.keys(form.value).forEach(key => {
      if (data[key] !== undefined && data[key] !== null) {
        form.value[key] = data[key]
      }
    })
  } catch (err) {
    console.error('Failed to load client:', err)
    errors.value.general = 'Failed to load client data'
  } finally {
    loading.value = false
  }
}

// Validate GSTIN format (optional but must be valid if provided)
function isValidGSTIN(gstin) {
  if (!gstin) return true  // Optional field
  // Basic 15-character alphanumeric check
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}[Z]{1}[A-Z0-9]{1}$/.test(gstin)
}

// Validate PAN format
function isValidPAN(pan) {
  if (!pan) return true
  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)
}

// Validate
function validate() {
  errors.value = {}

  if (!form.value.company_name.trim()) {
    errors.value.company_name = 'Company name is required'
  }

  if (form.value.gstin && !isValidGSTIN(form.value.gstin.toUpperCase())) {
    errors.value.gstin = 'Invalid GSTIN format (15 chars, e.g. 27AAPFU0939F1ZV)'
  }

  if (form.value.pan && !isValidPAN(form.value.pan.toUpperCase())) {
    errors.value.pan = 'Invalid PAN format (10 chars, e.g. AAPFU0939F)'
  }

  if (form.value.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.contact_email)) {
    errors.value.contact_email = 'Invalid email format'
  }

  if (form.value.pincode && !/^[0-9]{6}$/.test(form.value.pincode)) {
    errors.value.pincode = 'Pincode must be 6 digits'
  }

  return Object.keys(errors.value).length === 0
}

// Submit
async function handleSubmit() {
  if (!validate()) return

  saving.value = true
  errors.value = {}

  const payload = { ...form.value }
  // Uppercase GSTIN, PAN
  if (payload.gstin) payload.gstin = payload.gstin.toUpperCase()
  if (payload.pan) payload.pan = payload.pan.toUpperCase()
  if (payload.iec) payload.iec = payload.iec.toUpperCase()

  // Convert empty strings to null
  const optionalFields = [
    'gstin', 'iec', 'pan', 'address', 'city', 'state', 'pincode',
    'contact_name', 'contact_phone', 'contact_email', 'notes'
  ]
  optionalFields.forEach(field => {
    if (payload[field] === '') payload[field] = null
  })

  try {
    if (isEdit.value) {
      await clientsApi.update(clientId.value, payload)
      successMsg.value = 'Client updated successfully!'
    } else {
      await clientsApi.create(payload)
      successMsg.value = 'Client created successfully!'
    }

    setTimeout(() => {
      router.push('/clients')
    }, 800)
  } catch (err) {
    const detail = err.response?.data?.detail
    if (detail === 'Client company name already exists') {
      errors.value.company_name = 'A client with this company name already exists'
    } else {
      errors.value.general = detail || 'Failed to save client'
    }
  } finally {
    saving.value = false
  }
}

function handleCancel() {
  router.push('/clients')
}

onMounted(() => {
  loadClient()
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
          {{ isEdit ? 'Edit Client' : 'New Client' }}
        </h2>
        <p class="text-sm text-slate-500">
          {{ isEdit ? 'Update client details' : 'Register a new client/buyer' }}
        </p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-xl shadow-sm p-12 text-center">
      <i class="pi pi-spin pi-spinner text-2xl text-emerald-500" />
      <p class="text-sm text-slate-400 mt-2">Loading client...</p>
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
          <i class="pi pi-users mr-2 text-emerald-500" />Company Information
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Company Name -->
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-slate-700 mb-1">
              Company Name <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.company_name"
              type="text"
              placeholder="Client company name"
              :class="[
                'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500',
                errors.company_name ? 'border-red-300 bg-red-50' : 'border-slate-200'
              ]"
            />
            <p v-if="errors.company_name" class="mt-1 text-xs text-red-500">{{ errors.company_name }}</p>
          </div>

          <!-- GSTIN -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">GSTIN</label>
            <input
              v-model="form.gstin"
              type="text"
              maxlength="15"
              placeholder="e.g. 27AAPFU0939F1ZV"
              :class="[
                'w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500',
                errors.gstin ? 'border-red-300 bg-red-50' : 'border-slate-200'
              ]"
            />
            <p v-if="errors.gstin" class="mt-1 text-xs text-red-500">{{ errors.gstin }}</p>
            <p v-else class="mt-1 text-xs text-slate-400">Optional — not all clients have GSTIN</p>
          </div>

          <!-- IEC -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">IEC (Import Export Code)</label>
            <input
              v-model="form.iec"
              type="text"
              maxlength="10"
              placeholder="e.g. 0305XXXXXX"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- PAN -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">PAN</label>
            <input
              v-model="form.pan"
              type="text"
              maxlength="10"
              placeholder="e.g. AAPFU0939F"
              :class="[
                'w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500',
                errors.pan ? 'border-red-300 bg-red-50' : 'border-slate-200'
              ]"
            />
            <p v-if="errors.pan" class="mt-1 text-xs text-red-500">{{ errors.pan }}</p>
          </div>
        </div>
      </div>

      <!-- Section 2: Address -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          <i class="pi pi-map-marker mr-2 text-blue-500" />Address
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Address -->
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-slate-700 mb-1">Street Address</label>
            <input
              v-model="form.address"
              type="text"
              placeholder="Full street address"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- City -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">City</label>
            <input
              v-model="form.city"
              type="text"
              placeholder="e.g. Mumbai, Delhi"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- State -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">State</label>
            <select
              v-model="form.state"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select state</option>
              <option v-for="s in INDIAN_STATES" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>

          <!-- Pincode -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Pincode</label>
            <input
              v-model="form.pincode"
              type="text"
              maxlength="6"
              placeholder="6-digit pincode"
              :class="[
                'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500',
                errors.pincode ? 'border-red-300 bg-red-50' : 'border-slate-200'
              ]"
            />
            <p v-if="errors.pincode" class="mt-1 text-xs text-red-500">{{ errors.pincode }}</p>
          </div>
        </div>
      </div>

      <!-- Section 3: Contact Person -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          <i class="pi pi-user mr-2 text-purple-500" />Contact Person
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Contact Name -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              v-model="form.contact_name"
              type="text"
              placeholder="Full name"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- Phone -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input
              v-model="form.contact_phone"
              type="text"
              placeholder="+91 xxx xxx xxxx"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- Email -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              v-model="form.contact_email"
              type="email"
              placeholder="email@company.com"
              :class="[
                'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500',
                errors.contact_email ? 'border-red-300 bg-red-50' : 'border-slate-200'
              ]"
            />
            <p v-if="errors.contact_email" class="mt-1 text-xs text-red-500">{{ errors.contact_email }}</p>
          </div>
        </div>
      </div>

      <!-- Section 4: Notes -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          <i class="pi pi-file-edit mr-2 text-amber-500" />Notes
        </h3>
        <textarea
          v-model="form.notes"
          rows="3"
          placeholder="Additional notes about this client..."
          class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />
      </div>

      <!-- Section 5: Transparency Pricing Settings -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          <i class="pi pi-eye mr-2 text-indigo-500" />Transparency Pricing Settings
        </h3>
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Client Type</label>
            <select v-model="form.client_type" class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400">
              <option value="REGULAR">Regular — Standard selling price model</option>
              <option value="TRANSPARENCY">Transparency — Marked-up factory price + expense breakdown</option>
            </select>
            <p class="text-[10px] text-slate-400 mt-1">
              {{ form.client_type === 'TRANSPARENCY'
                ? 'Client sees marked-up factory price + full landed cost breakdown after delivery'
                : 'Client sees final selling price in INR (default)' }}
            </p>
          </div>

          <template v-if="form.client_type === 'TRANSPARENCY'">
            <div class="grid grid-cols-2 gap-4 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
              <div>
                <label class="block text-xs font-medium text-indigo-700 mb-1">Factory Markup %</label>
                <input
                  v-model.number="form.factory_markup_percent"
                  type="number" step="0.01" min="0" max="100"
                  placeholder="e.g. 13.00"
                  class="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 bg-white"
                />
                <p class="text-[10px] text-indigo-500 mt-1">Hidden markup on real factory price. Client sees the marked-up price as "factory rate".</p>
              </div>
              <div>
                <label class="block text-xs font-medium text-indigo-700 mb-1">Sourcing Commission %</label>
                <input
                  v-model.number="form.sourcing_commission_percent"
                  type="number" step="0.01" min="0" max="100"
                  placeholder="e.g. 4.00"
                  class="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 bg-white"
                />
                <p class="text-[10px] text-indigo-500 mt-1">Visible commission on the marked-up invoice value. Shown to client in landed cost.</p>
              </div>
            </div>
          </template>
        </div>
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
          {{ isEdit ? 'Update Client' : 'Create Client' }}
        </button>
      </div>
    </form>
  </div>
</template>
