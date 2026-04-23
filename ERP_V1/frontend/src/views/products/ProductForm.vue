<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { productsApi, settingsApi } from '../../api'

// Product images
const productImages = ref([])
const loadingImages = ref(false)
const viewingImage = ref(null)  // For lightbox viewer
const brokenImages = ref({})  // Track images that failed to load

const router = useRouter()
const route = useRoute()

// Determine if editing or creating
const isEdit = computed(() => !!route.params.id)
const productId = computed(() => route.params.id)

// State
const loading = ref(false)
const saving = ref(false)
const categories = ref([])
const errors = ref({})
const successMsg = ref('')
const subcategoriesList = ref([])
const showAddCategory = ref(false)
const newCategoryName = ref('')
const newCategoryMarkup = ref(0)
const addingCategory = ref(false)
const showAddSubcategory = ref(false)
const newSubcategoryName = ref('')

// Variant resolution dialog state
const showVariantDialog = ref(false)
const existingVariants = ref([])
const variantAction = ref('add_new')   // 'add_new' | 'replace'
const replaceVariantId = ref(null)
const pendingPayload = ref(null)       // Holds cleaned payload while dialog is open
const variantListExpanded = ref(false) // Toggle for viewing existing variants list

// Form data
const form = ref({
  product_code: '',
  product_name: '',
  product_name_chinese: '',
  part_type: '',
  dimension: '',
  material: '',
  variant_note: '',
  category: '',
  subcategory: '',
  unit_weight_kg: null,
  unit_cbm: null,
  standard_packing: '',
  moq: 1,
  hs_code: '',
  hs_code_description: '',
  factory_part_number: '',
  brand: '',
  oem_reference: '',
  compatibility: '',
  notes: '',
})

// Load categories for dropdown — merge markups table + distinct product categories
async function loadCategories() {
  try {
    const [markupRes, productCatRes] = await Promise.all([
      settingsApi.getMarkups(),
      productsApi.categories(),
    ])
    // Markup categories (objects with id, name, markup_percent)
    const markupCats = markupRes.data || []
    // Product categories (plain strings from products table)
    const productCats = productCatRes.data || []
    // Merge: start with markup entries, then add any product-table categories not already present
    const nameSet = new Set(markupCats.map(c => c.name))
    const merged = [...markupCats]
    for (const catName of productCats) {
      if (catName && !nameSet.has(catName)) {
        merged.push({ id: catName, name: catName, markup_percent: 0 })
        nameSet.add(catName)
      }
    }
    // Sort alphabetically
    merged.sort((a, b) => a.name.localeCompare(b.name))
    categories.value = merged
  } catch (err) {
    console.error('Failed to load categories:', err)
  }
}

// Load existing product for edit mode
async function loadProduct() {
  if (!isEdit.value) return
  loading.value = true
  try {
    const { data } = await productsApi.get(productId.value)
    // Map response to form
    Object.keys(form.value).forEach(key => {
      if (data[key] !== undefined && data[key] !== null) {
        form.value[key] = data[key]
      }
    })
  } catch (err) {
    console.error('Failed to load product:', err)
    errors.value.general = 'Failed to load product data'
  } finally {
    loading.value = false
  }
}

// Load product images (edit mode only)
async function loadImages() {
  if (!isEdit.value) return
  loadingImages.value = true
  try {
    const { data } = await productsApi.getImages(productId.value)
    productImages.value = data
  } catch (err) {
    console.error('Failed to load images:', err)
  } finally {
    loadingImages.value = false
  }
}

// Navigate between images in lightbox
function navigateImage(direction) {
  if (!viewingImage.value || productImages.value.length <= 1) return
  const currentIdx = productImages.value.findIndex(img => img.id === viewingImage.value.id)
  let nextIdx = currentIdx + direction
  if (nextIdx < 0) nextIdx = productImages.value.length - 1
  if (nextIdx >= productImages.value.length) nextIdx = 0
  viewingImage.value = productImages.value[nextIdx]
}

// Delete a product image
async function deleteImage(imageId) {
  if (!confirm('Delete this image?')) return
  try {
    await productsApi.deleteImage(productId.value, imageId)
    productImages.value = productImages.value.filter(img => img.id !== imageId)
  } catch (err) {
    console.error('Failed to delete image:', err)
  }
}

// Upload a product image
async function onImageUpload(event) {
  const file = event.target.files?.[0]
  if (!file || !isEdit.value) return
  try {
    const formData = new FormData()
    formData.append('file', file)
    await productsApi.uploadImage(productId.value, formData)
    await loadImages()
  } catch (err) {
    console.error('Failed to upload image:', err)
  }
  // Reset file input
  event.target.value = ''
}

// Load subcategories for dropdown
async function loadSubcategories() {
  try {
    const { data } = await productsApi.subcategories()
    subcategoriesList.value = data
  } catch (err) {
    console.error('Failed to load subcategories:', err)
  }
}

// Handle category select change
function onCategoryChange(e) {
  const val = e.target.value
  if (val === '__add__') {
    showAddCategory.value = true
    form.value.category = ''
  } else {
    form.value.category = val
    showAddCategory.value = false
  }
}

// Handle adding a new category
async function handleAddCategory() {
  if (!newCategoryName.value.trim()) return
  addingCategory.value = true
  try {
    await settingsApi.createMarkup({
      name: newCategoryName.value.trim(),
      markup_percent: parseFloat(newCategoryMarkup.value) || 0,
    })
    await loadCategories()
    form.value.category = newCategoryName.value.trim()
    newCategoryName.value = ''
    newCategoryMarkup.value = 0
    showAddCategory.value = false
  } catch (err) {
    console.error('Failed to add category:', err)
  } finally {
    addingCategory.value = false
  }
}

// Handle subcategory select change
function onSubcategoryChange(e) {
  const val = e.target.value
  if (val === '__add__') {
    showAddSubcategory.value = true
    form.value.subcategory = ''
  } else {
    form.value.subcategory = val
    showAddSubcategory.value = false
  }
}

// Confirm new subcategory
function confirmNewSubcategory() {
  if (!newSubcategoryName.value.trim()) return
  form.value.subcategory = newSubcategoryName.value.trim()
  newSubcategoryName.value = ''
  showAddSubcategory.value = false
}

// Validate form
function validate() {
  errors.value = {}

  if (!form.value.product_code.trim()) {
    errors.value.product_code = 'Part code is required'
  }
  if (!form.value.product_name.trim()) {
    errors.value.product_name = 'Product name is required'
  }
  if (form.value.moq < 1) {
    errors.value.moq = 'MOQ must be at least 1'
  }
  if (form.value.unit_weight_kg !== null && form.value.unit_weight_kg < 0) {
    errors.value.unit_weight_kg = 'Weight cannot be negative'
  }
  if (form.value.unit_cbm !== null && form.value.unit_cbm < 0) {
    errors.value.unit_cbm = 'CBM cannot be negative'
  }

  return Object.keys(errors.value).length === 0
}

// Build cleaned payload from form
function buildPayload() {
  const payload = { ...form.value }
  const optionalFields = [
    'product_name_chinese', 'part_type', 'dimension', 'material', 'variant_note',
    'category', 'subcategory', 'standard_packing', 'hs_code', 'hs_code_description',
    'factory_part_number', 'brand', 'oem_reference', 'compatibility', 'notes'
  ]
  optionalFields.forEach(field => {
    if (payload[field] === '') payload[field] = null
  })
  if (payload.unit_weight_kg === '' || payload.unit_weight_kg === null) payload.unit_weight_kg = null
  else payload.unit_weight_kg = parseFloat(payload.unit_weight_kg)
  if (payload.unit_cbm === '' || payload.unit_cbm === null) payload.unit_cbm = null
  else payload.unit_cbm = parseFloat(payload.unit_cbm)
  payload.moq = parseInt(payload.moq) || 1
  return payload
}

// Submit form
async function handleSubmit() {
  if (!validate()) return

  saving.value = true
  errors.value = {}

  const payload = buildPayload()

  try {
    if (isEdit.value) {
      await productsApi.update(productId.value, payload)
      successMsg.value = 'Product updated successfully!'
      setTimeout(() => router.push('/products'), 800)
    } else {
      // Check if this part code already has variants (skip for "Add Variant" mode)
      if (!isVariantMode.value) {
        try {
          const { data: check } = await productsApi.checkVariants(payload.product_code)
          if (check.variant_count > 0) {
            // Existing variants found — show resolution dialog
            existingVariants.value = check.variants
            pendingPayload.value = payload
            showVariantDialog.value = true
            saving.value = false
            return  // Wait for user choice in dialog
          }
        } catch (e) {
          // If check fails (e.g. network), proceed with normal creation
          console.error('Variant check failed, proceeding:', e)
        }
      }

      // No existing variants or variant mode — create directly
      await productsApi.create(payload)
      successMsg.value = 'Product created successfully!'
      setTimeout(() => router.push('/products'), 800)
    }
  } catch (err) {
    handleCreateError(err)
  } finally {
    saving.value = false
  }
}

// Handle error from create/update
function handleCreateError(err) {
  const detail = err.response?.data?.detail
  if (detail === 'Product name already exists') {
    errors.value.product_name = 'A product with this name already exists'
  } else {
    errors.value.general = detail || 'Failed to save product'
  }
}

// Variant dialog: user confirmed their choice
async function confirmVariantDialog() {
  if (!pendingPayload.value) return
  saving.value = true
  errors.value = {}

  try {
    const payload = { ...pendingPayload.value }
    if (variantAction.value === 'replace' && replaceVariantId.value) {
      payload.replace_variant_id = replaceVariantId.value
    }
    await productsApi.create(payload)
    successMsg.value = variantAction.value === 'replace'
      ? 'Variant replaced successfully!'
      : 'New variant added successfully!'
    showVariantDialog.value = false
    setTimeout(() => router.push('/products'), 800)
  } catch (err) {
    handleCreateError(err)
  } finally {
    saving.value = false
  }
}

// Variant dialog: cancel
function cancelVariantDialog() {
  showVariantDialog.value = false
  variantAction.value = 'add_new'
  replaceVariantId.value = null
  existingVariants.value = []
  pendingPayload.value = null
  variantListExpanded.value = false
}

// Cancel — go back
function handleCancel() {
  router.push('/products')
}

// "Add Variant" mode — pre-fill from parent
const isVariantMode = computed(() => !!route.query.parent_id && !isEdit.value)
const variantParentCode = computed(() => route.query.product_code || '')

async function prefillFromParent() {
  if (!isVariantMode.value) return
  form.value.product_code = route.query.product_code || ''
  // Load parent's children to inherit common fields
  try {
    const { data } = await productsApi.list({ group: true, search: form.value.product_code, per_page: 1 })
    if (data.items?.length > 0) {
      const group = data.items[0]
      const firstVariant = group.variants?.[0]
      if (firstVariant) {
        form.value.category = firstVariant.category || ''
        form.value.hs_code = firstVariant.hs_code || ''
        form.value.hs_code_description = firstVariant.hs_code_description || ''
      }
    }
  } catch (err) {
    console.error('Failed to load parent data:', err)
  }
}

onMounted(() => {
  loadCategories()
  loadSubcategories()
  loadProduct()
  loadImages()
  // Pre-fill code from URL query (from bulk paste Create Product link)
  if (route.query.code && !isEdit.value) {
    form.value.product_code = route.query.code
  }
  // Pre-fill from parent when adding a variant
  prefillFromParent()
})
</script>

<template>
  <div class="max-w-4xl">
    <!-- Back link + metadata -->
    <div class="flex items-center justify-between mb-4">
      <router-link to="/products" class="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
        <i class="pi pi-arrow-left text-xs" />
        Back to Products
      </router-link>
      <div v-if="isEdit" class="flex items-center gap-3 text-sm text-slate-400">
        <span>Last updated 2 days ago</span>
        <span class="text-slate-300">|</span>
        <button class="text-slate-400 hover:text-red-500 transition-colors">
          <i class="pi pi-trash" />
        </button>
      </div>
    </div>

    <!-- Header -->
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-slate-800">
        {{ isVariantMode ? 'Add Variant' : isEdit ? 'Edit Product' : 'New Product' }}
      </h2>
      <p class="text-sm text-slate-500">
        {{ isVariantMode ? `Adding a new variant under ${variantParentCode}` : isEdit ? 'Update product master data' : 'Add a new product to the catalog' }}
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="bg-white rounded-xl shadow-sm p-12 text-center">
      <i class="pi pi-spin pi-spinner text-2xl text-emerald-500" />
      <p class="text-sm text-slate-400 mt-2">Loading product...</p>
    </div>

    <!-- Form -->
    <form v-else @submit.prevent="handleSubmit" class="space-y-6">
      <!-- Success Message -->
      <div
        v-if="successMsg"
        class="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2"
      >
        <i class="pi pi-check-circle" />
        {{ successMsg }}
      </div>

      <!-- General Error -->
      <div
        v-if="errors.general"
        class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2"
      >
        <i class="pi pi-exclamation-circle" />
        {{ errors.general }}
      </div>

      <!-- Section 1: Core Identification -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-semibold text-slate-800">Product Identification</h3>
          <i class="pi pi-id-card text-slate-300" />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Part Code -->
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
              Part Code <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.product_code"
              type="text"
              placeholder="e.g. AH-ENG-001"
              :readonly="isVariantMode"
              :class="[
                'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500',
                errors.product_code ? 'border-red-300 bg-red-50' : 'border-slate-200',
                isVariantMode ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
              ]"
            />
            <p v-if="errors.product_code" class="mt-1 text-xs text-red-500">{{ errors.product_code }}</p>
            <p class="mt-1 text-xs text-slate-400">Same code can exist for different materials</p>
          </div>

          <!-- Product Name -->
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
              Product Name <span class="text-red-500">*</span>
            </label>
            <input
              v-model="form.product_name"
              type="text"
              placeholder="e.g. Engine Cylinder Head Gasket"
              :class="[
                'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500',
                errors.product_name ? 'border-red-300 bg-red-50' : 'border-slate-200'
              ]"
            />
            <p v-if="errors.product_name" class="mt-1 text-xs text-red-500">{{ errors.product_name }}</p>
          </div>

          <!-- Chinese Name -->
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Chinese Name</label>
            <input
              v-model="form.product_name_chinese"
              type="text"
              placeholder="Optional Chinese product name"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      <!-- Section 1B: Variant Attributes -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-semibold text-slate-800">Variant Attributes</h3>
          <i class="pi pi-clone text-slate-300" />
        </div>
        <p class="text-xs text-slate-400 mb-4">
          Same part code can have multiple variants with different type, size, or material. Leave empty if this is the only variant.
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Part Type -->
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Type</label>
            <select
              v-model="form.part_type"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select type</option>
              <option value="Original">Original</option>
              <option value="Copy">Copy</option>
              <option value="OEM">OEM</option>
              <option value="Aftermarket">Aftermarket</option>
            </select>
          </div>

          <!-- Dimension -->
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Size / Dimension</label>
            <input
              v-model="form.dimension"
              type="text"
              placeholder="e.g. 12mm, 32x15mm, M8"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- Material -->
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Material</label>
            <input
              v-model="form.material"
              type="text"
              placeholder="e.g. Cast Iron, Steel, Rubber"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- Variant Note -->
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Variant Note</label>
            <input
              v-model="form.variant_note"
              type="text"
              placeholder="Any other variant info"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      <!-- Section 2: Classification -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-semibold text-slate-800">Classification & Logistics</h3>
          <i class="pi pi-sitemap text-slate-300" />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <!-- Category -->
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Category</label>
            <select
              :value="form.category"
              @change="onCategoryChange"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select category</option>
              <option v-for="cat in categories" :key="cat.id" :value="cat.name">
                {{ cat.name }}
              </option>
              <option value="__add__">+ Add Category</option>
            </select>
            <!-- Inline Add Category form -->
            <div v-if="showAddCategory" class="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <input
                v-model="newCategoryName"
                type="text"
                placeholder="Category name"
                class="w-full px-3 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                v-model.number="newCategoryMarkup"
                type="number"
                step="0.1"
                min="0"
                placeholder="Markup %"
                class="w-full px-3 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div class="flex gap-2">
                <button
                  type="button"
                  @click="handleAddCategory"
                  :disabled="addingCategory || !newCategoryName.trim()"
                  class="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                >
                  {{ addingCategory ? 'Adding...' : 'Add' }}
                </button>
                <button
                  type="button"
                  @click="showAddCategory = false"
                  class="px-3 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-100 text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

          <!-- Subcategory -->
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Subcategory</label>
            <select
              :value="form.subcategory"
              @change="onSubcategoryChange"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select subcategory</option>
              <option v-for="sub in subcategoriesList" :key="sub" :value="sub">
                {{ sub }}
              </option>
              <option value="__add__">+ Add Subcategory</option>
            </select>
            <!-- Inline Add Subcategory form -->
            <div v-if="showAddSubcategory" class="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
              <input
                v-model="newSubcategoryName"
                type="text"
                placeholder="New subcategory name"
                class="w-full px-3 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div class="flex gap-2">
                <button
                  type="button"
                  @click="confirmNewSubcategory"
                  :disabled="!newSubcategoryName.trim()"
                  class="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                >
                  Add
                </button>
                <button
                  type="button"
                  @click="showAddSubcategory = false"
                  class="px-3 py-1.5 text-xs border border-slate-200 rounded hover:bg-slate-100 text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>

          <!-- MOQ -->
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
              MOQ <span class="text-red-500">*</span>
            </label>
            <input
              v-model.number="form.moq"
              type="number"
              min="1"
              :class="[
                'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500',
                errors.moq ? 'border-red-300 bg-red-50' : 'border-slate-200'
              ]"
            />
            <p v-if="errors.moq" class="mt-1 text-xs text-red-500">{{ errors.moq }}</p>
          </div>

          <!-- Unit Weight -->
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Weight (kg)</label>
            <div class="relative">
              <input
                v-model="form.unit_weight_kg"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                :class="[
                  'w-full px-3 py-2.5 border rounded-lg text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500',
                  errors.unit_weight_kg ? 'border-red-300 bg-red-50' : 'border-slate-200'
                ]"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">kg</span>
            </div>
            <p v-if="errors.unit_weight_kg" class="mt-1 text-xs text-red-500">{{ errors.unit_weight_kg }}</p>
          </div>

          <!-- Unit CBM -->
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Volume (CBM)</label>
            <div class="relative">
              <input
                v-model="form.unit_cbm"
                type="number"
                step="0.0001"
                min="0"
                placeholder="0.0000"
                :class="[
                  'w-full px-3 py-2.5 border rounded-lg text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500',
                  errors.unit_cbm ? 'border-red-300 bg-red-50' : 'border-slate-200'
                ]"
              />
              <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">m&sup3;</span>
            </div>
            <p v-if="errors.unit_cbm" class="mt-1 text-xs text-red-500">{{ errors.unit_cbm }}</p>
          </div>

          <!-- Standard Packing -->
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Standard Packing</label>
            <input
              v-model="form.standard_packing"
              type="text"
              placeholder="e.g. Carton box, Wooden crate"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      <!-- Section 3: Trade & Customs -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-semibold text-slate-800">Trade & Customs</h3>
          <i class="pi pi-globe text-slate-300" />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- HS Code -->
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">HS Code</label>
            <input
              v-model="form.hs_code"
              type="text"
              placeholder="e.g. 8433.90.00"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- HS Code Description -->
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">HS Code Description</label>
            <input
              v-model="form.hs_code_description"
              type="text"
              placeholder="HS code description for customs"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- Factory Part Number -->
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Factory Part Number</label>
            <input
              v-model="form.factory_part_number"
              type="text"
              placeholder="Factory's own part number"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- Brand -->
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Brand</label>
            <input
              v-model="form.brand"
              type="text"
              placeholder="Brand name"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- OEM Reference -->
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">OEM Reference</label>
            <input
              v-model="form.oem_reference"
              type="text"
              placeholder="Original equipment manufacturer reference"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <!-- Compatibility -->
          <div>
            <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Compatibility</label>
            <input
              v-model="form.compatibility"
              type="text"
              placeholder="Compatible models/machines"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      <!-- Section 4: Notes -->
      <div class="bg-white rounded-xl shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-semibold text-slate-800">Notes</h3>
          <i class="pi pi-align-left text-slate-300" />
        </div>
        <textarea
          v-model="form.notes"
          rows="3"
          placeholder="Additional notes about this product..."
          class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />
      </div>

      <!-- Section 5: Product Images (Edit mode only) -->
      <div v-if="isEdit" class="bg-white rounded-xl shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-semibold text-slate-800">
            Product Images
            <span class="text-slate-400 font-normal text-sm ml-2" v-if="productImages.length">
              ({{ productImages.length }} images)
            </span>
          </h3>
          <label class="text-sm text-emerald-600 hover:text-emerald-700 cursor-pointer flex items-center gap-1">
            <i class="pi pi-upload text-xs" />
            Upload New
            <input type="file" accept="image/*" class="hidden" @change="onImageUpload" />
          </label>
        </div>

        <!-- Loading -->
        <div v-if="loadingImages" class="text-center py-4">
          <i class="pi pi-spin pi-spinner text-purple-500" />
          <span class="text-sm text-slate-400 ml-2">Loading images...</span>
        </div>

        <!-- No images -->
        <div v-else-if="productImages.length === 0" class="text-center py-6">
          <i class="pi pi-image text-3xl text-slate-300" />
          <p class="text-sm text-slate-400 mt-2">No images for this product</p>
          <p class="text-xs text-slate-400">Images are extracted from Factory Excel uploads</p>
        </div>

        <!-- Image Grid -->
        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <div
            v-for="img in productImages"
            :key="img.id"
            class="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50 cursor-pointer"
            @click="viewingImage = img"
          >
            <img
              v-if="!brokenImages[img.id]"
              :src="img.thumbnail_url || img.image_url"
              :alt="'Product image'"
              class="w-full h-28 object-cover"
              loading="lazy"
              @error="brokenImages[img.id] = true"
            />
            <div v-else class="w-full h-28 bg-slate-100 flex items-center justify-center">
              <i class="pi pi-image text-slate-300 text-2xl" />
            </div>
            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              <span class="p-1.5 bg-white/90 text-slate-700 rounded-full" title="View full size">
                <i class="pi pi-search-plus text-xs" />
              </span>
              <button
                type="button"
                @click.stop="deleteImage(img.id)"
                class="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                title="Delete image"
              >
                <i class="pi pi-trash text-xs" />
              </button>
            </div>
            <div class="px-2 py-1 text-[10px] text-slate-400">
              {{ img.width }}x{{ img.height }} · {{ Math.round((img.file_size || 0) / 1024) }}KB
            </div>
          </div>
        </div>
      </div>

      <!-- Image Lightbox -->
      <div
        v-if="viewingImage"
        class="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
        @click.self="viewingImage = null"
      >
        <div class="relative max-w-4xl max-h-[90vh] mx-4">
          <!-- Close button -->
          <button
            type="button"
            @click="viewingImage = null"
            class="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-slate-100 z-10"
          >
            <i class="pi pi-times text-slate-600 text-sm" />
          </button>
          <!-- Full image -->
          <img
            :src="viewingImage.image_url"
            :alt="'Product image full view'"
            class="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain bg-white"
          />
          <!-- Image info bar -->
          <div class="mt-2 text-center text-sm text-white/80">
            {{ viewingImage.width }}x{{ viewingImage.height }} ·
            {{ Math.round((viewingImage.file_size || 0) / 1024) }}KB ·
            {{ viewingImage.source_type }}
          </div>
          <!-- Navigation arrows (if multiple images) -->
          <div v-if="productImages.length > 1" class="absolute top-1/2 -translate-y-1/2 -left-12">
            <button
              type="button"
              @click.stop="navigateImage(-1)"
              class="w-9 h-9 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <i class="pi pi-chevron-left" />
            </button>
          </div>
          <div v-if="productImages.length > 1" class="absolute top-1/2 -translate-y-1/2 -right-12">
            <button
              type="button"
              @click.stop="navigateImage(1)"
              class="w-9 h-9 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <i class="pi pi-chevron-right" />
            </button>
          </div>
        </div>
      </div>

      <!-- Sticky Action Bar -->
      <div class="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 -mx-6 mt-8 flex justify-end gap-3 z-10 rounded-b-xl">
        <router-link to="/products"
          class="px-6 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
          Cancel
        </router-link>
        <button @click="handleSubmit" :disabled="saving"
          class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50">
          <i v-if="saving" class="pi pi-spin pi-spinner text-xs" />
          <i v-else class="pi pi-save text-xs" />
          {{ isEdit ? 'Save Changes' : 'Create Product' }}
        </button>
      </div>
    </form>
  </div>

  <!-- Variant Resolution Dialog -->
  <div
    v-if="showVariantDialog"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    @click.self="cancelVariantDialog"
  >
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
      <!-- Header -->
      <div class="px-6 py-4 bg-amber-50 border-b border-amber-200 flex items-center gap-3">
        <div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <i class="pi pi-exclamation-triangle text-amber-600 text-lg" />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-slate-800">Existing Variants Found</h3>
          <p class="text-sm text-slate-500">
            Part code <span class="font-mono font-medium text-amber-700">{{ pendingPayload?.product_code }}</span>
            already has {{ existingVariants.length }} variant{{ existingVariants.length > 1 ? 's' : '' }}
          </p>
        </div>
      </div>

      <!-- Existing variants list (collapsible) -->
      <div class="px-6 py-4">
        <button
          type="button"
          @click="variantListExpanded = !variantListExpanded"
          class="flex items-center gap-2 w-full text-left group"
        >
          <i
            class="pi text-slate-400 text-xs transition-transform"
            :class="variantListExpanded ? 'pi-chevron-down' : 'pi-chevron-right'"
          />
          <span class="text-xs font-medium text-slate-400 uppercase tracking-wide">Current Variants</span>
          <span class="text-xs text-slate-300">({{ existingVariants.length }})</span>
          <span class="ml-auto text-[10px] text-slate-300 group-hover:text-slate-500 transition-colors">
            {{ variantListExpanded ? 'Hide' : 'View all details' }}
          </span>
        </button>
        <transition name="slide">
          <div v-if="variantListExpanded" class="mt-3 max-h-64 overflow-y-auto">
            <div class="space-y-2">
              <div
                v-for="(v, vi) in existingVariants"
                :key="v.id"
                class="bg-slate-50 rounded-lg border border-slate-100 p-3"
              >
                <!-- Variant header -->
                <div class="flex items-center gap-2 mb-2">
                  <div class="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span class="text-[10px] font-bold text-blue-600">{{ vi + 1 }}</span>
                  </div>
                  <p class="text-sm font-medium text-slate-700 truncate flex-1">{{ v.product_name }}</p>
                  <span v-if="v.is_default" class="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-medium">Default</span>
                </div>
                <!-- Detail grid -->
                <div class="grid grid-cols-2 gap-x-4 gap-y-1 ml-8 text-xs">
                  <div class="flex items-center gap-1.5">
                    <span class="text-slate-400 w-16 flex-shrink-0">Material</span>
                    <span :class="v.material ? 'text-slate-700 font-medium' : 'text-slate-300 italic'">
                      {{ v.material || 'Not set' }}
                    </span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-slate-400 w-16 flex-shrink-0">Size</span>
                    <span :class="v.dimension ? 'text-slate-700 font-medium' : 'text-slate-300 italic'">
                      {{ v.dimension || 'Not set' }}
                    </span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-slate-400 w-16 flex-shrink-0">Type</span>
                    <span :class="v.part_type ? 'text-slate-700 font-medium' : 'text-slate-300 italic'">
                      {{ v.part_type || 'Not set' }}
                    </span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span class="text-slate-400 w-16 flex-shrink-0">Category</span>
                    <span :class="v.category ? 'text-slate-700 font-medium' : 'text-slate-300 italic'">
                      {{ v.category || 'Not set' }}
                    </span>
                  </div>
                  <div v-if="v.brand" class="flex items-center gap-1.5">
                    <span class="text-slate-400 w-16 flex-shrink-0">Brand</span>
                    <span class="text-slate-700 font-medium">{{ v.brand }}</span>
                  </div>
                  <div v-if="v.hs_code" class="flex items-center gap-1.5">
                    <span class="text-slate-400 w-16 flex-shrink-0">HS Code</span>
                    <span class="text-slate-700 font-medium font-mono">{{ v.hs_code }}</span>
                  </div>
                  <div v-if="v.variant_note" class="col-span-2 flex items-center gap-1.5">
                    <span class="text-slate-400 w-16 flex-shrink-0">Note</span>
                    <span class="text-slate-600">{{ v.variant_note }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </div>

      <!-- Action selection -->
      <div class="px-6 pb-4">
        <p class="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">Choose Action</p>
        <div class="space-y-2">
          <!-- Add as New Variant -->
          <label
            class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
            :class="variantAction === 'add_new' ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'"
          >
            <input
              type="radio"
              v-model="variantAction"
              value="add_new"
              class="mt-0.5 text-emerald-600 focus:ring-emerald-500"
            />
            <div>
              <p class="text-sm font-medium text-slate-700">Add as New Variant</p>
              <p class="text-xs text-slate-400 mt-0.5">Create an additional variant under this part code</p>
            </div>
          </label>

          <!-- Replace Existing -->
          <label
            class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors"
            :class="variantAction === 'replace' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 hover:border-slate-300'"
          >
            <input
              type="radio"
              v-model="variantAction"
              value="replace"
              class="mt-0.5 text-amber-600 focus:ring-amber-500"
            />
            <div class="flex-1">
              <p class="text-sm font-medium text-slate-700">Replace Existing Variant</p>
              <p class="text-xs text-slate-400 mt-0.5">Overwrite an existing variant's data with the new values</p>
              <!-- Dropdown to pick which variant -->
              <select
                v-if="variantAction === 'replace'"
                v-model="replaceVariantId"
                class="mt-2 w-full text-sm border border-amber-200 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-amber-300 focus:border-amber-300"
              >
                <option :value="null" disabled>Select variant to replace…</option>
                <option v-for="v in existingVariants" :key="v.id" :value="v.id">
                  {{ v.product_name }}
                  <template v-if="v.material"> — {{ v.material }}</template>
                  <template v-if="v.dimension"> ({{ v.dimension }})</template>
                </option>
              </select>
            </div>
          </label>
        </div>
      </div>

      <!-- Footer buttons -->
      <div class="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
        <button
          type="button"
          @click="cancelVariantDialog"
          class="px-4 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          @click="confirmVariantDialog"
          :disabled="variantAction === 'replace' && !replaceVariantId"
          class="px-5 py-2 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50"
          :class="variantAction === 'replace' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'"
        >
          <i class="pi pi-check text-xs mr-1" />
          {{ variantAction === 'replace' ? 'Replace Variant' : 'Add Variant' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
}
.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  max-height: 16rem;
  margin-top: 0.75rem;
}
</style>
