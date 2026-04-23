<script setup>
import { ref, onMounted } from 'vue'
import { usersApi, clientsApi, factoriesApi, productsApi } from '../api'
import api from '../api'

const users = ref([])
const total = ref(0)
const loading = ref(true)
const showForm = ref(false)
const editingUser = ref(null)
const search = ref('')
const roleFilter = ref('')

const form = ref({
  email: '',
  full_name: '',
  password: '',
  role: 'OPERATIONS',
  user_type: 'INTERNAL',
  client_id: null,
  factory_id: null,
  is_active: true,
})

const showPassword = ref(false)
const formError = ref('')

const roles = ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'OPERATIONS', 'CLIENT', 'FACTORY']
const roleColors = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-red-100 text-red-700',
  FINANCE: 'bg-amber-100 text-amber-700',
  OPERATIONS: 'bg-blue-100 text-blue-700',
  CLIENT: 'bg-green-100 text-green-700',
  FACTORY: 'bg-violet-100 text-violet-700',
}

// Clients and factories for dropdown
const clients = ref([])
const factories = ref([])
const allCategories = ref([])
const selectedCategories = ref([])
const allBrands = ref([])
const selectedBrands = ref([])
const includeNoBrand = ref(false)
const portalPermissions = ref({
  show_payments: false,
  show_production: false,
  show_shipping: false,
  show_after_sales: false,
  show_files: false,
  show_packing: false,
  items_add: false,
  items_bulk_add: false,
  items_fetch_pending: false,
  items_upload_excel: false,
  items_edit_qty: false,
  items_remove: false,
})

async function loadUsers() {
  loading.value = true
  try {
    const params = { per_page: 100 }
    if (search.value) params.search = search.value
    if (roleFilter.value) params.role = roleFilter.value
    const { data } = await usersApi.list(params)
    users.value = data.users
    total.value = data.total
  } catch (e) {
    console.error('Failed to load users:', e)
  } finally {
    loading.value = false
  }
}

async function loadDropdowns() {
  try {
    const [c, f] = await Promise.all([
      clientsApi.search({ q: '' }),
      factoriesApi.search({ q: '' }),
    ])
    clients.value = c.data || []
    factories.value = f.data || []
  } catch (_e) { /* ignore */ }
  try {
    const { data } = await productsApi.categories()
    allCategories.value = Array.isArray(data) ? data : (data.categories || data || [])
  } catch (_e) { /* ignore */ }
  try {
    const { data } = await productsApi.brands()
    allBrands.value = Array.isArray(data) ? data : (data.brands || data || [])
  } catch (_e) { /* ignore */ }
}

onMounted(() => {
  loadUsers()
  loadDropdowns()
})

function openNew() {
  editingUser.value = null
  formError.value = ''
  showPassword.value = false
  form.value = {
    email: '', full_name: '', password: '',
    role: 'OPERATIONS', user_type: 'INTERNAL',
    client_id: null, factory_id: null, is_active: true,
  }
  selectedCategories.value = []
  selectedBrands.value = []
  includeNoBrand.value = false
  portalPermissions.value = { show_payments: false, show_production: false, show_shipping: false, show_after_sales: false, show_files: false, show_packing: false, items_add: false, items_bulk_add: false, items_fetch_pending: false, items_upload_excel: false, items_edit_qty: false, items_remove: false }
  showForm.value = true
}

async function openEdit(user) {
  editingUser.value = user
  formError.value = ''
  showPassword.value = false
  form.value = {
    email: user.email,
    full_name: user.full_name,
    password: '',
    role: user.role,
    user_type: user.user_type,
    client_id: user.client_id,
    factory_id: user.factory_id,
    is_active: user.is_active,
  }
  if (user.client_id) {
    try {
      const { data } = await clientsApi.getClientCategories(user.client_id)
      selectedCategories.value = data.categories || []
    } catch (_e) { selectedCategories.value = [] }
    try {
      const { data } = await clientsApi.getBrands(user.client_id)
      selectedBrands.value = data.brands || []
      includeNoBrand.value = data.include_no_brand || false
    } catch (_e) { selectedBrands.value = []; includeNoBrand.value = false }
    try {
      const { data } = await clientsApi.getPortalPermissions(user.client_id)
      portalPermissions.value = data
    } catch (_e) { portalPermissions.value = { show_payments: false, show_production: false, show_shipping: false, show_after_sales: false, show_files: false, show_packing: false, items_add: false, items_bulk_add: false, items_fetch_pending: false, items_upload_excel: false, items_edit_qty: false, items_remove: false } }
  } else {
    selectedCategories.value = []
    selectedBrands.value = []
    includeNoBrand.value = false
    portalPermissions.value = { show_payments: false, show_production: false, show_shipping: false, show_after_sales: false, show_files: false, show_packing: false, items_add: false, items_bulk_add: false, items_fetch_pending: false, items_upload_excel: false, items_edit_qty: false, items_remove: false }
  }
  showForm.value = true
}

async function saveUser() {
  formError.value = ''
  try {
    if (editingUser.value) {
      const body = { ...form.value }
      if (!body.password) delete body.password
      delete body.email  // can't change email
      await usersApi.update(editingUser.value.id, body)
    } else {
      await usersApi.create(form.value)
    }
    // After the main save succeeds, save categories and brands
    const clientId = editingUser.value?.client_id || form.value.client_id
    if (form.value.role === 'CLIENT' && clientId) {
      try {
        await clientsApi.setClientCategories(clientId, selectedCategories.value)
      } catch (_e) { /* ignore */ }
      try {
        await api.put(`/clients/${clientId}/brands/`, {
          brands: selectedBrands.value,
          include_no_brand: includeNoBrand.value,
        })
      } catch (_e) { /* ignore */ }
      try {
        await clientsApi.updatePortalPermissions(clientId, portalPermissions.value)
      } catch (_e) { /* ignore */ }
    }
    showForm.value = false
    loadUsers()
  } catch (e) {
    const detail = e.response?.data?.detail || 'Failed to save user'
    if (e.response?.status === 409 || detail.toLowerCase().includes('email')) {
      formError.value = 'This email is already in use by another account.'
    } else {
      formError.value = detail
    }
  }
}

async function toggleActive(user) {
  try {
    await usersApi.toggleActive(user.id, !user.is_active)
    loadUsers()
  } catch (e) {
    alert(e.response?.data?.detail || 'Failed to update user')
  }
}

function onRoleChange() {
  if (form.value.role === 'CLIENT') {
    form.value.user_type = 'CLIENT'
  } else if (form.value.role === 'FACTORY') {
    form.value.user_type = 'FACTORY'
  } else {
    form.value.user_type = 'INTERNAL'
    form.value.client_id = null
    form.value.factory_id = null
  }
}
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">User Management</h1>
        <p class="text-sm text-slate-500">{{ total }} users registered</p>
      </div>
      <button @click="openNew" class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2">
        <i class="pi pi-plus text-sm" />
        Add User
      </button>
    </div>

    <!-- Filters -->
    <div class="flex gap-3 mb-4">
      <input v-model="search" @input="loadUsers" placeholder="Search by name or email..." class="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500" />
      <select v-model="roleFilter" @change="loadUsers" class="px-3 py-2 border border-slate-300 rounded-lg text-sm">
        <option value="">All Roles</option>
        <option v-for="r in roles" :key="r" :value="r">{{ r.replace('_', ' ') }}</option>
      </select>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <table class="w-full text-sm">
        <thead class="bg-slate-50 border-b border-slate-200">
          <tr>
            <th class="px-4 py-3 text-left font-semibold text-slate-600">User</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-600">Role</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-600">Type</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
            <th class="px-4 py-3 text-left font-semibold text-slate-600">Last Login</th>
            <th class="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="6" class="px-4 py-8 text-center text-slate-400">
              <i class="pi pi-spinner pi-spin mr-2" /> Loading...
            </td>
          </tr>
          <tr v-for="u in users" :key="u.id" class="border-b border-slate-100 hover:bg-slate-50">
            <td class="px-4 py-3">
              <div class="font-medium text-slate-800">{{ u.full_name }}</div>
              <div class="text-xs text-slate-400">{{ u.email }}</div>
            </td>
            <td class="px-4 py-3">
              <span class="px-2 py-0.5 rounded-full text-xs font-semibold" :class="roleColors[u.role] || 'bg-gray-100 text-gray-700'">
                {{ u.role }}
              </span>
            </td>
            <td class="px-4 py-3 text-slate-500">{{ u.user_type }}</td>
            <td class="px-4 py-3">
              <span :class="u.is_active ? 'text-emerald-600' : 'text-red-500'" class="text-xs font-medium">
                {{ u.is_active ? 'Active' : 'Disabled' }}
              </span>
            </td>
            <td class="px-4 py-3 text-xs text-slate-400">
              {{ u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never' }}
            </td>
            <td class="px-4 py-3 text-right space-x-2">
              <button @click="openEdit(u)" class="text-blue-600 hover:text-blue-800 text-xs">Edit</button>
              <button @click="toggleActive(u)" :class="u.is_active ? 'text-red-600 hover:text-red-800' : 'text-emerald-600 hover:text-emerald-800'" class="text-xs">
                {{ u.is_active ? 'Disable' : 'Enable' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div class="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 class="text-lg font-bold text-slate-800 mb-4">{{ editingUser ? 'Edit User' : 'New User' }}</h2>

        <!-- Inline Error -->
        <div v-if="formError" class="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <i class="pi pi-exclamation-circle flex-shrink-0" />
          <span>{{ formError }}</span>
        </div>

        <div class="space-y-3">
          <!-- Email -->
          <div v-if="!editingUser">
            <label class="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <div class="relative">
              <i class="pi pi-envelope absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input v-model="form.email" type="email" class="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" :class="formError && formError.includes('email') ? 'border-red-400 focus:ring-red-500' : 'border-slate-300'" placeholder="user@company.com" @input="formError = ''" />
            </div>
          </div>

          <!-- Full Name -->
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Full Name</label>
            <div class="relative">
              <i class="pi pi-user absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input v-model="form.full_name" class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="John Doe" />
            </div>
          </div>

          <!-- Password with Toggle -->
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">{{ editingUser ? 'New Password (leave blank to keep)' : 'Password' }}</label>
            <div class="relative">
              <i class="pi pi-lock absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
              <input v-model="form.password" :type="showPassword ? 'text' : 'password'" class="w-full pl-9 pr-10 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Min 6 characters" />
              <button type="button" @click="showPassword = !showPassword" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                <i :class="showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" class="text-sm" />
              </button>
            </div>
          </div>

          <!-- Role -->
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">Role</label>
            <select v-model="form.role" @change="onRoleChange" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option v-for="r in roles" :key="r" :value="r">{{ r.replace('_', ' ') }}</option>
            </select>
            <p class="text-[10px] text-slate-400 mt-1">
              <span v-if="form.role === 'SUPER_ADMIN'">Full system access + real factory pricing visibility</span>
              <span v-else-if="form.role === 'ADMIN'">Full system access</span>
              <span v-else-if="form.role === 'FINANCE'">Payments, ledgers, invoices</span>
              <span v-else-if="form.role === 'OPERATIONS'">Orders, products, shipping</span>
              <span v-else-if="form.role === 'CLIENT'">External buyer — own orders only</span>
              <span v-else-if="form.role === 'FACTORY'">External supplier — assigned orders only</span>
            </p>
          </div>

          <!-- Client Link -->
          <div v-if="form.role === 'CLIENT'">
            <label class="block text-xs font-medium text-slate-600 mb-1">Link to Client</label>
            <select v-model="form.client_id" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option :value="null">Select client...</option>
              <option v-for="c in clients" :key="c.id" :value="c.id">{{ c.company_name }}</option>
            </select>
            <router-link to="/clients/new" target="_blank" class="text-[10px] text-emerald-600 hover:text-emerald-800 mt-1 inline-flex items-center gap-1">
              <i class="pi pi-plus text-[8px]" /> Add New Client
            </router-link>

            <!-- Client Type Badge -->
            <div v-if="form.client_id" class="mt-2">
              <span v-if="clients.find(c => c.id === form.client_id)?.client_type === 'TRANSPARENCY'"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700">
                <i class="pi pi-eye text-[8px]" /> Transparency Client
              </span>
              <span v-else
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                Regular Client
              </span>
            </div>

            <!-- Brand Access -->
            <div v-if="form.client_id" class="mt-3">
              <label class="block text-xs font-medium text-slate-600 mb-2">Product Brand Access</label>
              <div class="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                <label v-for="brand in allBrands" :key="brand" class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-violet-50 cursor-pointer">
                  <input type="checkbox" :value="brand" v-model="selectedBrands" class="rounded text-violet-600 border-slate-300" />
                  <span class="text-xs text-slate-700 font-medium">{{ brand }}</span>
                </label>
                <!-- No Brand option -->
                <div class="border-t border-slate-100 mt-1 pt-1">
                  <label class="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" v-model="includeNoBrand" class="rounded text-slate-500 border-slate-300" />
                    <span class="text-xs text-slate-500 italic">Products without brand</span>
                  </label>
                </div>
                <div v-if="allBrands.length === 0 && !includeNoBrand" class="text-xs text-slate-400 py-2 text-center">No brands available</div>
              </div>
              <p class="text-[10px] text-slate-400 mt-1">{{ selectedBrands.length }} brand{{ selectedBrands.length !== 1 ? 's' : '' }} selected{{ includeNoBrand ? ' + unbranded products' : '' }} — client can only order products from these brands</p>
            </div>

            <!-- Portal Permissions -->
            <div v-if="form.client_id" class="mt-4">
              <label class="block text-xs font-medium text-slate-600 mb-2">
                <i class="pi pi-eye text-xs mr-1" />
                Portal Tab Permissions
              </label>
              <p class="text-[10px] text-slate-400 mb-2">Control which tabs this client can see in their order detail portal</p>
              <div class="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50">
                <label class="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-white cursor-pointer">
                  <input type="checkbox" v-model="portalPermissions.show_payments" class="rounded text-emerald-600 border-slate-300" />
                  <div>
                    <span class="text-xs font-medium text-slate-700">Payments</span>
                    <span class="text-[10px] text-slate-400 ml-1">— payment history, balance due</span>
                  </div>
                </label>
                <label class="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-white cursor-pointer">
                  <input type="checkbox" v-model="portalPermissions.show_production" class="rounded text-emerald-600 border-slate-300" />
                  <div>
                    <span class="text-xs font-medium text-slate-700">Production Progress</span>
                    <span class="text-[10px] text-slate-400 ml-1">— factory production status</span>
                  </div>
                </label>
                <label class="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-white cursor-pointer">
                  <input type="checkbox" v-model="portalPermissions.show_shipping" class="rounded text-emerald-600 border-slate-300" />
                  <div>
                    <span class="text-xs font-medium text-slate-700">Shipping & Tracking</span>
                    <span class="text-[10px] text-slate-400 ml-1">— vessel, ETA, transit status</span>
                  </div>
                </label>
                <label class="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-white cursor-pointer">
                  <input type="checkbox" v-model="portalPermissions.show_after_sales" class="rounded text-emerald-600 border-slate-300" />
                  <div>
                    <span class="text-xs font-medium text-slate-700">After-Sales</span>
                    <span class="text-[10px] text-slate-400 ml-1">— quality claims, resolution</span>
                  </div>
                </label>
                <label class="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-white cursor-pointer">
                  <input type="checkbox" v-model="portalPermissions.show_files" class="rounded text-emerald-600 border-slate-300" />
                  <div>
                    <span class="text-xs font-medium text-slate-700">Files</span>
                    <span class="text-[10px] text-slate-400 ml-1">— shared documents, PI downloads</span>
                  </div>
                </label>
                <label class="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-white cursor-pointer">
                  <input type="checkbox" v-model="portalPermissions.show_packing" class="rounded text-emerald-600 border-slate-300" />
                  <div>
                    <span class="text-xs font-medium text-slate-700">Packing</span>
                    <span class="text-[10px] text-slate-400 ml-1">— packing status, items produced, carry-forward</span>
                  </div>
                </label>
              </div>
            </div>

            <!-- Order Item Permissions -->
            <div class="bg-slate-50 rounded-lg p-3 mt-3">
              <div class="flex items-center gap-2 mb-3">
                <i class="pi pi-list text-blue-500 text-xs" />
                <span class="text-xs font-semibold text-slate-600">Order Item Permissions</span>
              </div>
              <p class="text-[10px] text-slate-400 mb-2">Control which item actions this client can perform in their order detail</p>
              <div class="space-y-1.5">
                <label class="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-white cursor-pointer">
                  <input type="checkbox" v-model="portalPermissions.items_add" class="rounded text-blue-600 border-slate-300" />
                  <div>
                    <span class="text-xs font-medium text-slate-700">Add Items</span>
                    <span class="text-[10px] text-slate-400 ml-1">— search and add products to order</span>
                  </div>
                </label>
                <label class="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-white cursor-pointer">
                  <input type="checkbox" v-model="portalPermissions.items_bulk_add" class="rounded text-blue-600 border-slate-300" />
                  <div>
                    <span class="text-xs font-medium text-slate-700">Bulk Add</span>
                    <span class="text-[10px] text-slate-400 ml-1">— paste multiple product codes at once</span>
                  </div>
                </label>
                <label class="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-white cursor-pointer">
                  <input type="checkbox" v-model="portalPermissions.items_fetch_pending" class="rounded text-blue-600 border-slate-300" />
                  <div>
                    <span class="text-xs font-medium text-slate-700">Fetch Pending Items</span>
                    <span class="text-[10px] text-slate-400 ml-1">— carry-forward from previous orders</span>
                  </div>
                </label>
                <label class="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-white cursor-pointer">
                  <input type="checkbox" v-model="portalPermissions.items_upload_excel" class="rounded text-blue-600 border-slate-300" />
                  <div>
                    <span class="text-xs font-medium text-slate-700">Upload Excel</span>
                    <span class="text-[10px] text-slate-400 ml-1">— import items from spreadsheet</span>
                  </div>
                </label>
                <label class="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-white cursor-pointer">
                  <input type="checkbox" v-model="portalPermissions.items_edit_qty" class="rounded text-blue-600 border-slate-300" />
                  <div>
                    <span class="text-xs font-medium text-slate-700">Edit Quantity</span>
                    <span class="text-[10px] text-slate-400 ml-1">— change item quantities</span>
                  </div>
                </label>
                <label class="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-white cursor-pointer">
                  <input type="checkbox" v-model="portalPermissions.items_remove" class="rounded text-blue-600 border-slate-300" />
                  <div>
                    <span class="text-xs font-medium text-slate-700">Remove Items</span>
                    <span class="text-[10px] text-slate-400 ml-1">— delete items from order</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <!-- Factory Link -->
          <div v-if="form.role === 'FACTORY'">
            <label class="block text-xs font-medium text-slate-600 mb-1">Link to Factory</label>
            <select v-model="form.factory_id" class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option :value="null">Select factory...</option>
              <option v-for="f in factories" :key="f.id" :value="f.id">{{ f.company_name || f.factory_code }}</option>
            </select>
            <router-link to="/factories/new" target="_blank" class="text-[10px] text-emerald-600 hover:text-emerald-800 mt-1 inline-flex items-center gap-1">
              <i class="pi pi-plus text-[8px]" /> Add New Factory
            </router-link>
          </div>

          <!-- Active -->
          <div class="flex items-center gap-2">
            <input v-model="form.is_active" type="checkbox" id="is_active" class="rounded text-emerald-600" />
            <label for="is_active" class="text-sm text-slate-700">Active</label>
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-6">
          <button @click="showForm = false" class="px-4 py-2 text-slate-600 hover:text-slate-800 text-sm">Cancel</button>
          <button @click="saveUser" class="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">
            {{ editingUser ? 'Update' : 'Create' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
