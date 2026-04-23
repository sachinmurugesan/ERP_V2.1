<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { transportApi } from '../../api'
import { INDIAN_STATES } from '../../utils/constants'

const router = useRouter()
const route = useRoute()

const isEdit = computed(() => !!route.params.id)
const providerId = computed(() => route.params.id)

// State
const loading = ref(false)
const saving = ref(false)
const errors = ref({})
const successMsg = ref('')

// Available roles
const availableRoles = [
  { value: 'FREIGHT_FORWARDER', label: 'Freight Forwarder', icon: 'pi-send', active: 'border-blue-300 bg-blue-50/30', iconColor: 'text-blue-600' },
  { value: 'CHA', label: 'CHA (Customs House Agent)', icon: 'pi-file-edit', active: 'border-green-300 bg-green-50/30', iconColor: 'text-green-600' },
  { value: 'CFS', label: 'CFS (Container Freight Station)', icon: 'pi-warehouse', active: 'border-orange-300 bg-orange-50/30', iconColor: 'text-orange-600' },
  { value: 'TRANSPORT', label: 'Transport', icon: 'pi-truck', active: 'border-purple-300 bg-purple-50/30', iconColor: 'text-purple-600' },
]

// INDIAN_STATES imported from utils/constants

// Form data
const form = ref({
  name: '',
  roles: [],
  contact_person: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  country: 'India',
  bank_name: '',
  bank_account: '',
  ifsc_code: '',
  gst_number: '',
  pan_number: '',
  operating_ports: [],
  notes: '',
})

const portInput = ref('')

// Operating ports management
function addPort() {
  const ports = portInput.value.split(',').map(p => p.trim().toUpperCase()).filter(Boolean)
  for (const port of ports) {
    if (!form.value.operating_ports.includes(port)) {
      form.value.operating_ports.push(port)
    }
  }
  portInput.value = ''
}

function removePort(port) {
  form.value.operating_ports = form.value.operating_ports.filter(p => p !== port)
}

// Toggle role
function toggleRole(roleValue) {
  const idx = form.value.roles.indexOf(roleValue)
  if (idx >= 0) {
    form.value.roles.splice(idx, 1)
  } else {
    form.value.roles.push(roleValue)
  }
}

// Load existing provider
async function loadProvider() {
  if (!isEdit.value) return
  loading.value = true
  try {
    const { data } = await transportApi.get(providerId.value)
    form.value.name = data.name || ''
    form.value.roles = data.roles || []
    form.value.contact_person = data.contact_person || ''
    form.value.phone = data.phone || ''
    form.value.email = data.email || ''
    form.value.address = data.address || ''
    form.value.city = data.city || ''
    form.value.state = data.state || ''
    form.value.country = data.country || 'India'
    form.value.bank_name = data.bank_name || ''
    form.value.bank_account = data.bank_account || ''
    form.value.ifsc_code = data.ifsc_code || ''
    form.value.gst_number = data.gst_number || ''
    form.value.pan_number = data.pan_number || ''
    form.value.operating_ports = data.operating_ports || []
    form.value.notes = data.notes || ''
  } catch (err) {
    console.error('Failed to load provider:', err)
    errors.value.general = 'Failed to load provider data'
  } finally {
    loading.value = false
  }
}

// Validate
function validate() {
  errors.value = {}

  if (!form.value.name.trim()) {
    errors.value.name = 'Provider name is required'
  }

  if (form.value.roles.length === 0) {
    errors.value.roles = 'Select at least one role'
  }

  if (form.value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
    errors.value.email = 'Invalid email format'
  }

  if (form.value.gst_number && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}[Z]{1}[A-Z0-9]{1}$/.test(form.value.gst_number.toUpperCase())) {
    errors.value.gst_number = 'Invalid GST format'
  }

  if (form.value.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.value.pan_number.toUpperCase())) {
    errors.value.pan_number = 'Invalid PAN format'
  }

  return Object.keys(errors.value).length === 0
}

// Submit
async function handleSubmit() {
  if (!validate()) return

  saving.value = true
  errors.value = {}

  const payload = { ...form.value }
  // Uppercase compliance fields
  if (payload.gst_number) payload.gst_number = payload.gst_number.toUpperCase()
  if (payload.pan_number) payload.pan_number = payload.pan_number.toUpperCase()
  if (payload.ifsc_code) payload.ifsc_code = payload.ifsc_code.toUpperCase()

  // Convert empty strings to null
  const optionalFields = [
    'contact_person', 'phone', 'email', 'address', 'city', 'state',
    'bank_name', 'bank_account', 'ifsc_code', 'gst_number', 'pan_number', 'notes'
  ]
  optionalFields.forEach(field => {
    if (payload[field] === '') payload[field] = null
  })

  try {
    if (isEdit.value) {
      await transportApi.update(providerId.value, payload)
      successMsg.value = 'Provider updated successfully!'
    } else {
      await transportApi.create(payload)
      successMsg.value = 'Provider created successfully!'
    }

    setTimeout(() => {
      router.push('/transport')
    }, 800)
  } catch (err) {
    const detail = err.response?.data?.detail
    errors.value.general = detail || 'Failed to save provider'
  } finally {
    saving.value = false
  }
}

function handleCancel() {
  router.push('/transport')
}

onMounted(() => {
  loadProvider()
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
          {{ isEdit ? 'Edit Service Provider' : 'New Service Provider' }}
        </h2>
        <p class="text-sm text-slate-500">
          {{ isEdit ? 'Update provider details' : 'Register a new service provider' }}
        </p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-xl shadow-sm p-12 text-center">
      <i class="pi pi-spin pi-spinner text-2xl text-emerald-500" />
      <p class="text-sm text-slate-400 mt-2">Loading provider...</p>
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

      <!-- Section 1: Company Info + Roles -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          <i class="pi pi-truck mr-2 text-emerald-500" />Company Information
        </h3>
        <div class="space-y-4">
          <!-- Name -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">
              Company Name <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.name"
              type="text"
              placeholder="Service provider company name"
              :class="[
                'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500',
                errors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'
              ]"
            />
            <p v-if="errors.name" class="mt-1 text-xs text-red-500">{{ errors.name }}</p>
          </div>

          <!-- Roles -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">
              Roles <span class="text-red-500">*</span>
            </label>
            <div class="grid grid-cols-2 gap-3">
              <div v-for="role in availableRoles" :key="role.value"
                @click="toggleRole(role.value)"
                :class="[
                  'flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                  form.roles.includes(role.value)
                    ? role.active
                    : 'border-slate-200 hover:border-slate-300'
                ]">
                <input type="checkbox" :checked="form.roles.includes(role.value)"
                  class="w-4 h-4 text-emerald-600 rounded border-slate-300 pointer-events-none" />
                <i :class="['pi', role.icon, 'text-sm', form.roles.includes(role.value) ? role.iconColor : 'text-slate-400']" />
                <span class="text-sm font-medium text-slate-700">{{ role.label }}</span>
              </div>
            </div>
            <p v-if="errors.roles" class="mt-1 text-xs text-red-500">{{ errors.roles }}</p>
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
              placeholder="e.g. Mumbai, Chennai"
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

      <!-- Section 3: Contact Person -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          <i class="pi pi-user mr-2 text-purple-500" />Contact Person
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              v-model="form.contact_person"
              type="text"
              placeholder="Full name"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input
              v-model="form.phone"
              type="text"
              placeholder="+91 xxx xxx xxxx"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              v-model="form.email"
              type="email"
              placeholder="email@company.com"
              :class="[
                'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500',
                errors.email ? 'border-red-300 bg-red-50' : 'border-slate-200'
              ]"
            />
            <p v-if="errors.email" class="mt-1 text-xs text-red-500">{{ errors.email }}</p>
          </div>
        </div>
      </div>

      <!-- Section 4: Banking & Compliance -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          <i class="pi pi-wallet mr-2 text-amber-500" />Banking & Compliance
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Bank Name</label>
            <input
              v-model="form.bank_name"
              type="text"
              placeholder="e.g. HDFC Bank"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Account Number</label>
            <input
              v-model="form.bank_account"
              type="text"
              placeholder="Account number"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">IFSC Code</label>
            <input
              v-model="form.ifsc_code"
              type="text"
              maxlength="11"
              placeholder="e.g. HDFC0001234"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">GST Number</label>
            <input
              v-model="form.gst_number"
              type="text"
              maxlength="15"
              placeholder="e.g. 27AAPFU0939F1ZV"
              :class="[
                'w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500',
                errors.gst_number ? 'border-red-300 bg-red-50' : 'border-slate-200'
              ]"
            />
            <p v-if="errors.gst_number" class="mt-1 text-xs text-red-500">{{ errors.gst_number }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">PAN Number</label>
            <input
              v-model="form.pan_number"
              type="text"
              maxlength="10"
              placeholder="e.g. AAPFU0939F"
              :class="[
                'w-full px-3 py-2 border rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500',
                errors.pan_number ? 'border-red-300 bg-red-50' : 'border-slate-200'
              ]"
            />
            <p v-if="errors.pan_number" class="mt-1 text-xs text-red-500">{{ errors.pan_number }}</p>
          </div>
        </div>
      </div>

      <!-- Section 5: Operating Ports & Notes -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">
          <i class="pi pi-compass mr-2 text-cyan-500" />Operating Ports & Notes
        </h3>
        <div class="space-y-4">
          <!-- Operating Ports -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Operating Ports</label>
            <!-- Existing tags -->
            <div v-if="form.operating_ports.length" class="flex flex-wrap gap-1.5 mb-2">
              <span v-for="port in form.operating_ports" :key="port"
                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-50 text-cyan-700">
                {{ port }}
                <button @click="removePort(port)" type="button" class="text-cyan-400 hover:text-cyan-700">
                  <i class="pi pi-times text-[9px]" />
                </button>
              </span>
            </div>
            <!-- Input -->
            <div class="flex gap-2">
              <input v-model="portInput" @keydown.enter.prevent="addPort" type="text"
                placeholder="e.g. JNPT, Chennai, Mundra"
                class="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button @click="addPort" type="button"
                class="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-slate-600">
                Add
              </button>
            </div>
            <p class="mt-1 text-xs text-slate-400">Press Enter or click Add. Separate multiple with commas.</p>
          </div>

          <!-- Notes -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              v-model="form.notes"
              rows="3"
              placeholder="Additional notes about this provider..."
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>
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
          {{ isEdit ? 'Update Provider' : 'Create Provider' }}
        </button>
      </div>
    </form>
  </div>
</template>
