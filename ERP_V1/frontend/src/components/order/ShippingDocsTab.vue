<script setup>
import { ref, computed, onMounted } from 'vue'
import { shipmentsApi } from '../../api'
import { formatDate } from '../../utils/formatters'

const props = defineProps({
  orderId: { type: String, required: true },
  order: { type: Object, required: true },
})

// ========================================
// State
// ========================================
const loading = ref(false)
const isEditing = ref(false)
const shippingDocs = ref([])
const error = ref('')
const uploadingDocId = ref(null)
const fileInputs = ref({})

// ========================================
// Document type metadata
// ========================================
const docLabels = {
  BOL: { label: 'Bill of Lading', desc: 'Shipping contract from carrier' },
  COO: { label: 'Certificate of Origin', desc: 'Country of manufacture proof' },
  CI: { label: 'Commercial Invoice', desc: 'Factory invoice for customs' },
  PL: { label: 'Packing List', desc: 'Detailed packing breakdown' },
}

function getDocLabel(type) {
  return docLabels[type]?.label || type
}

function getDocDescription(type) {
  return docLabels[type]?.desc || ''
}

function getDocIcon(type) {
  switch (type) {
    case 'BOL': return 'pi-file-edit'
    case 'COO': return 'pi-globe'
    case 'CI': return 'pi-receipt'
    case 'PL': return 'pi-list'
    default: return 'pi-file'
  }
}

// ========================================
// Computed
// ========================================
const isSailingStage = computed(() => {
  const s = ['LOADED', 'SAILED', 'ARRIVED', 'CUSTOMS_FILED', 'CLEARED', 'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING']
  return s.includes(props.order?.status)
})

const receivedCount = computed(() => shippingDocs.value.filter(d => d.status === 'RECEIVED').length)
const totalCount = computed(() => shippingDocs.value.length)

// ========================================
// Functions
// ========================================
async function loadDocs() {
  loading.value = true
  error.value = ''
  try {
    const res = await shipmentsApi.listDocs(props.orderId)
    shippingDocs.value = res.data || []
  } catch (err) {
    console.error('Failed to load shipping docs:', err)
    error.value = err.response?.data?.detail || 'Failed to load shipping documents'
  } finally {
    loading.value = false
  }
}

async function uploadDoc(doc, event) {
  const file = event.target.files?.[0]
  if (!file) return

  uploadingDocId.value = doc.id
  error.value = ''
  try {
    await shipmentsApi.uploadDoc(doc.id, file)
    await loadDocs()
  } catch (err) {
    console.error('Failed to upload document:', err)
    error.value = err.response?.data?.detail || 'Failed to upload document'
  } finally {
    uploadingDocId.value = null
    event.target.value = ''
  }
}

async function markDocStatus(doc, status) {
  error.value = ''
  try {
    await shipmentsApi.updateDocStatus(doc.id, status)
    await loadDocs()
  } catch (err) {
    console.error('Failed to update doc status:', err)
    error.value = err.response?.data?.detail || 'Failed to update document status'
  }
}

// formatDate imported from utils/formatters

// ========================================
// Lifecycle
// ========================================
onMounted(() => {
  loadDocs()
})
</script>

<template>
  <div v-if="isSailingStage">
    <div class="bg-white rounded-xl shadow-sm overflow-hidden border-2 border-cyan-200 mb-6">
      <div class="px-6 py-4 border-b border-cyan-200 bg-cyan-50">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-semibold text-cyan-800 uppercase tracking-wider flex items-center gap-2">
              <i class="pi pi-file text-cyan-600" /> Shipping Documents
            </h3>
            <p class="text-xs text-cyan-600 mt-0.5">
              Factory shipping documents &mdash; {{ receivedCount }} / {{ totalCount }} received
            </p>
          </div>
          <div class="flex items-center gap-2">
            <template v-if="!isEditing">
              <button @click="isEditing = true"
                class="px-3 py-1.5 text-xs font-medium text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg hover:bg-cyan-100 transition-colors flex items-center gap-1">
                <i class="pi pi-pencil text-[10px]" /> Edit
              </button>
            </template>
            <template v-else>
              <button @click="isEditing = false"
                class="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1">
                <i class="pi pi-check text-[10px]" /> Done
              </button>
            </template>
          </div>
        </div>
      </div>

      <div class="p-6">
        <!-- Loading -->
        <div v-if="loading" class="flex items-center justify-center py-12">
          <i class="pi pi-spin pi-spinner text-2xl text-cyan-500" />
        </div>

        <!-- Error -->
        <div v-if="error" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <i class="pi pi-exclamation-circle" />
          <span>{{ error }}</span>
          <button @click="error = ''" class="ml-auto text-red-400 hover:text-red-600"><i class="pi pi-times text-xs" /></button>
        </div>

        <!-- Document cards grid -->
        <div v-if="!loading && shippingDocs.length" class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div v-for="doc in shippingDocs" :key="doc.id" class="bg-white rounded-xl shadow-sm border p-5"
            :class="doc.status === 'RECEIVED' ? 'border-emerald-200' : 'border-slate-200'">
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-3">
                <div :class="[
                  'w-9 h-9 rounded-lg flex items-center justify-center',
                  doc.status === 'RECEIVED' ? 'bg-emerald-100' : 'bg-slate-100'
                ]">
                  <i :class="[
                    'pi', getDocIcon(doc.document_type), 'text-sm',
                    doc.status === 'RECEIVED' ? 'text-emerald-600' : 'text-slate-400'
                  ]" />
                </div>
                <div>
                  <h4 class="font-medium text-slate-800 text-sm">{{ getDocLabel(doc.document_type) }}</h4>
                  <p class="text-xs text-slate-500">{{ getDocDescription(doc.document_type) }}</p>
                </div>
              </div>
              <span :class="[
                'px-2.5 py-1 rounded-full text-xs font-medium',
                doc.status === 'RECEIVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
              ]">
                {{ doc.status }}
              </span>
            </div>

            <!-- Upload area (when editing and pending) -->
            <div v-if="isEditing && doc.status === 'PENDING'" class="mt-3">
              <input type="file" :ref="el => { if (el) fileInputs[doc.id] = el }"
                @change="e => uploadDoc(doc, e)" class="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
              <button @click="fileInputs[doc.id]?.click()" :disabled="uploadingDocId === doc.id"
                class="w-full px-4 py-2.5 text-sm font-medium text-cyan-700 bg-cyan-50 border border-dashed border-cyan-300 rounded-lg hover:bg-cyan-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                <i v-if="uploadingDocId === doc.id" class="pi pi-spin pi-spinner text-xs" />
                <i v-else class="pi pi-upload text-xs" />
                {{ uploadingDocId === doc.id ? 'Uploading...' : 'Upload Document' }}
              </button>
            </div>

            <!-- Manual mark as received (editing, no file upload needed) -->
            <div v-if="isEditing && doc.status === 'PENDING'" class="mt-2">
              <button @click="markDocStatus(doc, 'RECEIVED')"
                class="w-full px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1">
                <i class="pi pi-check text-[10px]" /> Mark as Received
              </button>
            </div>

            <!-- Received info -->
            <div v-if="doc.status === 'RECEIVED'" class="mt-3">
              <div class="flex items-center gap-2 text-sm text-emerald-700">
                <i class="pi pi-check-circle text-emerald-500" />
                <span>Received {{ formatDate(doc.received_date) }}</span>
              </div>

              <!-- View/Download button (when file exists) -->
              <div v-if="doc.file_path" class="mt-2 flex items-center gap-2">
                <a :href="`/api/shipping/shipping-documents/${doc.id}/download/`" target="_blank"
                  class="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5">
                  <i class="pi pi-eye text-[10px]" /> View
                </a>
                <a :href="`/api/shipping/shipping-documents/${doc.id}/download/`" download
                  class="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1.5">
                  <i class="pi pi-download text-[10px]" /> Download
                </a>
              </div>
              <div v-else class="mt-2 text-xs text-amber-600 flex items-center gap-1">
                <i class="pi pi-exclamation-triangle text-[10px]" /> No file uploaded — marked as received manually
              </div>

              <!-- Re-upload in edit mode -->
              <div v-if="isEditing" class="mt-2 flex items-center gap-2">
                <input type="file" :ref="el => { if (el) fileInputs[doc.id + '_replace'] = el }"
                  @change="e => uploadDoc(doc, e)" class="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
                <button @click="fileInputs[doc.id + '_replace']?.click()" :disabled="uploadingDocId === doc.id"
                  class="px-3 py-1.5 text-xs text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg hover:bg-cyan-100 flex items-center gap-1">
                  <i class="pi pi-upload text-[10px]" /> {{ doc.file_path ? 'Replace File' : 'Upload File' }}
                </button>
                <button @click="markDocStatus(doc, 'PENDING')"
                  class="px-3 py-1.5 text-xs text-slate-500 hover:text-red-600 border border-slate-200 rounded-lg hover:border-red-200 transition-colors">
                  <i class="pi pi-replay text-[10px] mr-1" /> Revert to Pending
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="!loading && !shippingDocs.length" class="text-center py-12 text-slate-500">
          <i class="pi pi-file text-4xl mb-3 text-slate-300" />
          <p class="text-sm">No shipping documents found</p>
          <p class="text-xs text-slate-400 mt-1">Documents will be created automatically when shipments are booked</p>
        </div>

        <!-- Progress summary -->
        <div v-if="!loading && shippingDocs.length" class="mt-6 pt-4 border-t border-slate-200">
          <div class="flex items-center justify-between">
            <span class="text-xs text-slate-500">Document collection progress</span>
            <span class="text-xs font-medium" :class="receivedCount === totalCount ? 'text-emerald-600' : 'text-amber-600'">
              {{ receivedCount }} / {{ totalCount }} received
            </span>
          </div>
          <div class="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-500"
              :class="receivedCount === totalCount ? 'bg-emerald-500' : 'bg-amber-500'"
              :style="{ width: totalCount > 0 ? (receivedCount / totalCount * 100) + '%' : '0%' }">
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
