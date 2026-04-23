<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  /** AI mapping result from /excel/analyze-columns/ */
  mappingResult: {
    type: Object,
    required: true,
    // { confirmed: {excelHeader: schemaField}, needs_review: [...], unmapped_fields: [...] }
  },
  /** Schema type for field labels */
  schemaType: {
    type: String,
    default: 'product',
  },
})

const emit = defineEmits(['confirm', 'skip', 'close'])

// Human-readable field labels
const FIELD_LABELS = {
  product_code: 'Product Code',
  barcode: 'Barcode',
  product_name: 'Product Name',
  product_name_chinese: 'Chinese Name',
  dimension: 'Dimension / Size',
  category: 'Category',
  unit_weight_kg: 'Weight (kg)',
  material: 'Material',
  hs_code: 'HS Code',
  quantity: 'Quantity',
  unit_price: 'Unit Price',
  part_type: 'Part Type',
  image: 'Image',
  package: 'Package / Carton',
  description: 'Description',
}

// Editable review items — user can change the suggested field
const reviewChoices = ref(
  (props.mappingResult.needs_review || []).map(item => ({
    ...item,
    selected_field: item.suggested_field,
  }))
)

// Available schema fields for dropdowns
const availableFields = computed(() => {
  const confirmed = Object.values(props.mappingResult.confirmed || {})
  const selected = reviewChoices.value.map(r => r.selected_field).filter(Boolean)
  const used = new Set([...confirmed, ...selected])

  // All fields from the schema
  const allFields = Object.keys(FIELD_LABELS)
  return allFields.filter(f => !used.has(f) || reviewChoices.value.some(r => r.selected_field === f))
})

const confirmedEntries = computed(() =>
  Object.entries(props.mappingResult.confirmed || {}).map(([excel, field]) => ({
    excel_column: excel,
    schema_field: field,
  }))
)

const hasUnmappedRequired = computed(() =>
  (props.mappingResult.unmapped_fields || []).length > 0
)

function fieldLabel(field) {
  return FIELD_LABELS[field] || field
}

function confidenceBadge(confidence) {
  if (confidence === 'medium') return { text: 'Medium', cls: 'bg-yellow-100 text-yellow-700' }
  return { text: 'Low', cls: 'bg-red-100 text-red-700' }
}

function handleConfirm() {
  // Build final mapping: {excel_header: schema_field}
  const mapping = { ...(props.mappingResult.confirmed || {}) }
  for (const item of reviewChoices.value) {
    if (item.selected_field) {
      mapping[item.excel_column] = item.selected_field
    }
  }
  emit('confirm', mapping)
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="$emit('close')">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-slate-800">Column Mapping</h3>
          <p class="text-sm text-slate-500 mt-0.5">AI has analyzed your Excel columns. Review the mappings below.</p>
        </div>
        <button @click="$emit('close')" class="p-1 text-slate-400 hover:text-slate-600 rounded">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Body (scrollable) -->
      <div class="flex-1 overflow-y-auto px-6 py-4 space-y-5">

        <!-- Confirmed mappings (high confidence) -->
        <div v-if="confirmedEntries.length">
          <h4 class="text-sm font-medium text-slate-600 mb-2 flex items-center gap-1.5">
            <svg class="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
            Auto-Mapped (High Confidence)
          </h4>
          <div class="space-y-1">
            <div v-for="entry in confirmedEntries" :key="entry.excel_column"
                 class="flex items-center gap-3 px-3 py-2 bg-green-50 rounded-lg text-sm">
              <span class="font-medium text-slate-700 w-1/2 truncate" :title="entry.excel_column">
                {{ entry.excel_column }}
              </span>
              <svg class="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
              <span class="text-green-700 font-medium w-1/2">{{ fieldLabel(entry.schema_field) }}</span>
            </div>
          </div>
        </div>

        <!-- Needs review (medium/low confidence) -->
        <div v-if="reviewChoices.length">
          <h4 class="text-sm font-medium text-slate-600 mb-2 flex items-center gap-1.5">
            <svg class="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            Needs Your Review
          </h4>
          <div class="space-y-2">
            <div v-for="(item, idx) in reviewChoices" :key="item.excel_column"
                 class="px-3 py-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <div class="flex items-center gap-3">
                <span class="font-medium text-slate-700 w-2/5 truncate text-sm" :title="item.excel_column">
                  {{ item.excel_column }}
                </span>
                <svg class="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                </svg>
                <select v-model="reviewChoices[idx].selected_field"
                        class="flex-1 text-sm border border-slate-300 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="">-- Skip this column --</option>
                  <option v-for="f in Object.keys(FIELD_LABELS)" :key="f" :value="f">
                    {{ fieldLabel(f) }}
                  </option>
                </select>
                <span :class="confidenceBadge(item.confidence).cls"
                      class="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                  {{ confidenceBadge(item.confidence).text }}
                </span>
              </div>
              <p v-if="item.reason" class="text-xs text-slate-500 mt-1 ml-0.5">{{ item.reason }}</p>
            </div>
          </div>
        </div>

        <!-- Unmapped required fields warning -->
        <div v-if="hasUnmappedRequired" class="px-3 py-3 bg-red-50 rounded-lg border border-red-200">
          <h4 class="text-sm font-medium text-red-700 mb-1">Missing Required Fields</h4>
          <p class="text-xs text-red-600">
            The following required fields were not mapped:
            <strong>{{ mappingResult.unmapped_fields.map(f => fieldLabel(f)).join(', ') }}</strong>.
            The import may have limited data.
          </p>
        </div>

        <!-- No review needed -->
        <div v-if="!reviewChoices.length && confirmedEntries.length" class="px-3 py-3 bg-blue-50 rounded-lg text-sm text-blue-700">
          All columns were mapped with high confidence. You can proceed directly.
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
        <button @click="$emit('skip')"
                class="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition">
          Skip AI Mapping
        </button>
        <div class="flex gap-3">
          <button @click="$emit('close')"
                  class="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition">
            Cancel
          </button>
          <button @click="handleConfirm"
                  class="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition font-medium">
            Confirm & Parse
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
