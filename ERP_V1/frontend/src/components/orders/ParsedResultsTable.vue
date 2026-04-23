<script setup>
import { computed } from 'vue'

const props = defineProps({
  filteredData: { type: Array, required: true },
  selectedRows: { type: Object, required: true }, // Set
  selectAll: { type: Boolean, default: false },
  isFactoryExcel: { type: Boolean, default: false },
  processed: { type: Boolean, default: false },
  processedSummary: { type: Object, default: null },
  resultsFilter: { type: String, default: 'all' },
  totalRows: { type: Number, default: 0 },
})

const emit = defineEmits([
  'toggleSelectAll',
  'toggleRow',
  'deleteSelected',
  'update:resultsFilter',
])

function statusColor(status) {
  const colors = {
    MATCHED: 'bg-green-100 text-green-700',
    NEW_PRODUCT: 'bg-blue-100 text-blue-700',
    NEW_VARIANT: 'bg-purple-100 text-purple-700',
    DUPLICATE: 'bg-yellow-100 text-yellow-800',
    AMBIGUOUS: 'bg-red-100 text-red-700',
    NO_PRICE: 'bg-orange-100 text-orange-700',
    SKIP_DUPLICATE: 'bg-gray-200 text-gray-500 line-through',
  }
  return colors[status] || 'bg-gray-100 text-gray-600'
}
</script>

<template>
  <!-- Processed Summary Bar -->
  <div v-if="processedSummary" class="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 animate-fadeIn mb-3">
    <div class="flex items-center gap-3 mb-3">
      <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
        <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
      </div>
      <div>
        <h3 class="text-sm font-semibold text-green-800">Resolution Preview Ready</h3>
        <p class="text-xs text-green-600">{{ processedSummary.total }} rows processed — review below, then click "Create Products" to commit</p>
      </div>
    </div>
    <div class="flex flex-wrap gap-2">
      <button @click="$emit('update:resultsFilter', 'all')"
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
        :class="resultsFilter === 'all' ? 'bg-white shadow-sm border border-green-300 text-green-800' : 'bg-green-100/50 text-green-700 hover:bg-green-100'">
        All {{ processedSummary.total }}
      </button>
      <button v-if="processedSummary.newProducts > 0" @click="$emit('update:resultsFilter', 'new')"
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
        :class="resultsFilter === 'new' ? 'bg-white shadow-sm border border-purple-300 text-purple-800' : 'bg-purple-50 text-purple-600 hover:bg-purple-100'">
        <span class="w-2 h-2 rounded-full bg-purple-400"></span> New {{ processedSummary.newProducts }}
      </button>
      <button v-if="processedSummary.variants > 0" @click="$emit('update:resultsFilter', 'variant')"
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
        :class="resultsFilter === 'variant' ? 'bg-white shadow-sm border border-blue-300 text-blue-800' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'">
        <span class="w-2 h-2 rounded-full bg-blue-400"></span> Add Variant {{ processedSummary.variants }}
      </button>
      <button v-if="processedSummary.replaced > 0" @click="$emit('update:resultsFilter', 'replace')"
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
        :class="resultsFilter === 'replace' ? 'bg-white shadow-sm border border-amber-300 text-amber-800' : 'bg-amber-50 text-amber-600 hover:bg-amber-100'">
        <span class="w-2 h-2 rounded-full bg-amber-400"></span> Replace {{ processedSummary.replaced }}
      </button>
      <button v-if="processedSummary.skipped > 0" @click="$emit('update:resultsFilter', 'skipped')"
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5"
        :class="resultsFilter === 'skipped' ? 'bg-white shadow-sm border border-gray-400 text-gray-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'">
        <span class="w-2 h-2 rounded-full bg-gray-400"></span> Skipped {{ processedSummary.skipped }}
      </button>
    </div>
  </div>

  <!-- Results Table -->
  <div class="bg-white rounded-xl border overflow-hidden">
    <div class="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
      <h3 class="text-sm font-semibold text-gray-700">
        <template v-if="processed && resultsFilter !== 'all'">
          Showing {{ filteredData.length }} of {{ processedSummary?.total || 0 }} rows
          <span class="text-xs text-gray-400 ml-1">(filtered)</span>
        </template>
        <template v-else>
          Parsed Results ({{ totalRows }} rows)
        </template>
      </h3>
      <div class="flex items-center gap-2">
        <span v-if="selectedRows.size > 0" class="text-xs text-gray-500">{{ selectedRows.size }} selected</span>
        <button v-if="selectedRows.size > 0" @click="$emit('deleteSelected')"
          class="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors text-xs font-medium flex items-center gap-1">
          <i class="pi pi-trash text-[10px]" /> Remove Selected
        </button>
      </div>
    </div>
    <div class="overflow-x-auto max-h-96 overflow-y-auto">
      <table class="w-full text-xs">
        <thead class="bg-gray-50 sticky top-0 z-10 shadow-[0_1px_0_0_rgb(229,231,235)]">
          <tr>
            <th class="px-2 py-2 text-center">
              <input type="checkbox" :checked="selectAll" @change="$emit('toggleSelectAll')" class="rounded text-indigo-600" />
            </th>
            <th class="px-3 py-2 text-left text-gray-500 font-medium">Row</th>
            <th class="px-3 py-2 text-left text-gray-500 font-medium">Code</th>
            <th class="px-3 py-2 text-left text-gray-500 font-medium" v-if="isFactoryExcel">Description</th>
            <th class="px-3 py-2 text-left text-gray-500 font-medium" v-if="isFactoryExcel">Category</th>
            <th class="px-3 py-2 text-right text-gray-500 font-medium" v-if="isFactoryExcel">Weight</th>
            <th class="px-3 py-2 text-right text-gray-500 font-medium">Qty</th>
            <th class="px-3 py-2 text-right text-gray-500 font-medium" v-if="isFactoryExcel">Price (USD)</th>
            <th class="px-3 py-2 text-center text-gray-500 font-medium" v-if="isFactoryExcel">Img</th>
            <th class="px-3 py-2 text-left text-gray-500 font-medium">Status</th>
            <th class="px-3 py-2 text-left text-gray-500 font-medium">Product</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          <tr v-for="(row, idx) in filteredData" :key="row._originalIdx ?? row.row"
            class="hover:bg-gray-50 transition-colors"
            :class="{
              'bg-indigo-50/50': selectedRows.has(row._originalIdx ?? idx),
              'bg-red-50/40 line-through opacity-50': row._resolved === 'SKIP_DUPLICATE',
              'bg-amber-50/40': row._resolved === 'REPLACE',
              'bg-blue-50/30': row._resolved === 'ADD_VARIANT'
            }"
          >
            <td class="px-2 py-2 text-center">
              <input type="checkbox"
                :checked="selectedRows.has(row._originalIdx ?? idx)"
                :disabled="row._resolved === 'SKIP_DUPLICATE' || row._resolved === 'REPLACE'"
                @change="$emit('toggleRow', row._originalIdx ?? idx)"
                class="rounded text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed" />
            </td>
            <td class="px-3 py-2 text-gray-500">{{ row.row }}</td>
            <td class="px-3 py-2 font-mono text-gray-900">{{ row.manufacturer_code || row.barcode }}</td>
            <td class="px-3 py-2 text-gray-600" v-if="isFactoryExcel">{{ row.description }}</td>
            <td class="px-3 py-2 text-gray-600 text-xs" v-if="isFactoryExcel">{{ row.category || '—' }}</td>
            <td class="px-3 py-2 text-right text-gray-600" v-if="isFactoryExcel">{{ row.weight != null ? row.weight + ' kg' : '—' }}</td>
            <td class="px-3 py-2 text-right text-gray-900">{{ row.quantity }}</td>
            <td class="px-3 py-2 text-right text-gray-900" v-if="isFactoryExcel">
              {{ row.factory_price_usd != null ? '$' + row.factory_price_usd.toFixed(2) : '—' }}
            </td>
            <td class="px-3 py-2 text-center" v-if="isFactoryExcel">
              <img v-if="row.thumbnail_url" :src="row.thumbnail_url" class="w-10 h-10 object-contain rounded border mx-auto cursor-pointer hover:ring-2 hover:ring-purple-300" :alt="row.manufacturer_code" />
              <i v-else-if="row.has_image" class="pi pi-image text-purple-500" title="Image extracted" />
              <span v-else class="text-gray-300">—</span>
            </td>
            <td class="px-3 py-2">
              <span v-if="row._resolved === 'SKIP_DUPLICATE'" class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-600 flex items-center gap-1 w-fit">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
                SKIPPED
              </span>
              <span v-else-if="row._resolved === 'REPLACE'" class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 flex items-center gap-1 w-fit">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                REPLACE
              </span>
              <span v-else-if="row._resolved === 'ADD_VARIANT'" class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 flex items-center gap-1 w-fit">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                VARIANT
              </span>
              <span v-else class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="statusColor(row.match_status)">
                {{ row.match_status }}
              </span>
            </td>
            <td class="px-3 py-2 text-gray-600">{{ row.product_name || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.animate-fadeIn {
  animation: fadeIn 0.4s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
