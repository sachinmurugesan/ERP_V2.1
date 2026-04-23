<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  conflictGroups: { type: Array, required: true },
  variantResolutions: { type: Object, required: true },
  rowOverrides: { type: Object, required: true },
  aiResolutions: { type: Object, default: () => ({}) },
  analyzingConflicts: { type: Boolean, default: false },
  aiResolutionSource: { type: String, default: null },
  aiStats: { type: Object, default: null },
  processed: { type: Boolean, default: false },
  conflictSortBy: { type: String, default: 'code' },
})

const emit = defineEmits([
  'update:variantResolutions',
  'update:rowOverrides',
  'update:conflictSortBy',
  'process',
])

// Bulk selection
const selectedConflictRows = ref(new Set())

const allConflictRowIndices = computed(() => {
  const indices = []
  props.conflictGroups.forEach(group => {
    group.rows.forEach(row => indices.push(row._idx))
  })
  return indices
})

const bulkAllSelected = computed(() => {
  if (allConflictRowIndices.value.length === 0) return false
  return allConflictRowIndices.value.every(idx => selectedConflictRows.value.has(idx))
})

function toggleBulkSelectAll() {
  if (bulkAllSelected.value) {
    selectedConflictRows.value = new Set()
  } else {
    selectedConflictRows.value = new Set(allConflictRowIndices.value)
  }
}

function toggleConflictGroup(group) {
  const newSet = new Set(selectedConflictRows.value)
  const allSelected = group.rows.every(r => newSet.has(r._idx))
  group.rows.forEach(r => {
    if (allSelected) {
      newSet.delete(r._idx)
    } else {
      newSet.add(r._idx)
    }
  })
  selectedConflictRows.value = newSet
}

function toggleConflictRow(idx) {
  const newSet = new Set(selectedConflictRows.value)
  if (newSet.has(idx)) {
    newSet.delete(idx)
  } else {
    newSet.add(idx)
  }
  selectedConflictRows.value = newSet
}

function applyBulkAction(action) {
  const updated = { ...props.variantResolutions }
  selectedConflictRows.value.forEach(idx => {
    const key = String(idx)
    if (action === 'replace') {
      const group = props.conflictGroups.find(g => g.rows.some(r => r._idx === idx))
      const replaceId = group?.existingVariants?.[0]?.id || null
      updated[key] = { action: 'replace', replace_id: replaceId }
    } else {
      updated[key] = { action, replace_id: null }
    }
  })
  emit('update:variantResolutions', updated)
}

function setResolution(rowIdx, resolution) {
  const updated = { ...props.variantResolutions }
  updated[String(rowIdx)] = resolution
  emit('update:variantResolutions', updated)
}

function setOverride(rowIdx, field, value) {
  const key = String(rowIdx)
  const current = props.rowOverrides[key] || {}
  emit('update:rowOverrides', {
    ...props.rowOverrides,
    [key]: { ...current, [field]: value },
  })
}

function toggleSort(field) {
  const current = props.conflictSortBy
  if (field === 'code') {
    emit('update:conflictSortBy', current === 'code' ? 'code_desc' : 'code')
  } else if (field === 'rows') {
    emit('update:conflictSortBy', current === 'rows' ? 'rows_desc' : 'rows')
  }
}
</script>

<template>
  <div class="mb-3 bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4">
    <div class="flex items-center gap-2 mb-1">
      <svg class="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
      </svg>
      <span class="text-sm font-semibold text-violet-800">
        {{ conflictGroups.length }} part code{{ conflictGroups.length > 1 ? 's' : '' }} need resolution
      </span>
    </div>

    <!-- AI Analysis Banner -->
    <div v-if="analyzingConflicts" class="mb-3 ml-7 p-3 bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 border border-indigo-200 rounded-lg animate-pulse">
      <div class="flex items-center gap-2">
        <svg class="w-5 h-5 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <div>
          <span class="text-sm font-semibold text-indigo-700">AI is analyzing {{ allConflictRowIndices.length }} rows...</span>
          <p class="text-[11px] text-indigo-500 mt-0.5">Comparing names, dimensions, and specifications to identify duplicates vs new variants</p>
        </div>
      </div>
    </div>

    <div v-else-if="aiStats && aiResolutionSource" class="mb-3 ml-7 p-3 bg-gradient-to-r from-indigo-50 via-purple-50 to-violet-50 border border-indigo-200 rounded-lg">
      <div class="flex items-center gap-2 mb-2">
        <svg class="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
        <span class="text-sm font-semibold text-indigo-700">
          {{ aiResolutionSource === 'ai' ? 'AI' : 'Smart' }} Analysis Complete
        </span>
        <span v-if="aiResolutionSource === 'ai'" class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 font-medium">Claude AI</span>
        <span v-else class="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 font-medium">Smart Match</span>
      </div>
      <div class="flex items-center gap-3 ml-7">
        <div class="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-md">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span class="text-xs font-semibold text-emerald-700">{{ aiStats.add }}</span>
          <span class="text-[10px] text-emerald-600">add as variant</span>
        </div>
        <div class="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 border border-red-200 rounded-md">
          <span class="w-2 h-2 rounded-full bg-red-400"></span>
          <span class="text-xs font-semibold text-red-600">{{ aiStats.skip }}</span>
          <span class="text-[10px] text-red-500">skip duplicate</span>
        </div>
        <div v-if="aiStats.replace > 0" class="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-md">
          <span class="w-2 h-2 rounded-full bg-blue-500"></span>
          <span class="text-xs font-semibold text-blue-600">{{ aiStats.replace }}</span>
          <span class="text-[10px] text-blue-500">replace</span>
        </div>
        <span class="text-[10px] text-gray-400 ml-auto">{{ aiStats.highConf }} of {{ aiStats.total }} high confidence</span>
      </div>
      <p class="text-[11px] text-indigo-500 mt-2 ml-7">Review the suggestions below. Each row is highlighted with the AI recommendation — you can override any choice.</p>
    </div>

    <p v-if="!analyzingConflicts && !aiStats" class="text-xs text-violet-600 mb-3 ml-7">
      For each row, choose: add as a new variant, replace an existing product, or skip as duplicate.
    </p>

    <!-- Bulk Action Bar -->
    <div class="flex items-center gap-3 mb-3 bg-white/70 rounded-lg border border-violet-100 p-2.5">
      <label class="flex items-center gap-1.5 text-xs cursor-pointer text-violet-700 font-medium">
        <input type="checkbox" :checked="bulkAllSelected" @change="toggleBulkSelectAll" class="rounded text-violet-600 focus:ring-violet-400" />
        Select All
      </label>
      <span class="text-gray-300">|</span>
      <span class="text-[10px] text-gray-500">{{ selectedConflictRows.size }} of {{ allConflictRowIndices.length }} selected</span>
      <div v-if="selectedConflictRows.size > 0" class="flex items-center gap-2 ml-auto">
        <span class="text-[10px] text-gray-400 mr-1">Set selected to:</span>
        <button @click="applyBulkAction('add_new')" class="px-2.5 py-1 text-[11px] font-medium bg-violet-100 text-violet-700 rounded-md hover:bg-violet-200 transition-colors">Add as variant</button>
        <button @click="applyBulkAction('replace')" class="px-2.5 py-1 text-[11px] font-medium bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors">Replace existing</button>
        <button @click="applyBulkAction('duplicate')" class="px-2.5 py-1 text-[11px] font-medium bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors">Duplicate (skip)</button>
      </div>
    </div>

    <!-- Sort Controls -->
    <div class="flex items-center gap-2 mb-2 ml-1">
      <span class="text-[10px] text-gray-400">Sort by:</span>
      <button @click="toggleSort('code')" class="px-2 py-0.5 text-[10px] font-medium rounded transition-colors" :class="conflictSortBy.startsWith('code') ? 'bg-violet-100 text-violet-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'">
        Part Code
        <span v-if="conflictSortBy === 'code'">&#9650;</span>
        <span v-else-if="conflictSortBy === 'code_desc'">&#9660;</span>
      </button>
      <button @click="toggleSort('rows')" class="px-2 py-0.5 text-[10px] font-medium rounded transition-colors" :class="conflictSortBy.startsWith('rows') ? 'bg-violet-100 text-violet-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'">
        Row Count
        <span v-if="conflictSortBy === 'rows'">&#9650;</span>
        <span v-else-if="conflictSortBy === 'rows_desc'">&#9660;</span>
      </button>
    </div>

    <!-- Conflict Groups -->
    <div class="space-y-3 max-h-[500px] overflow-y-auto">
      <div v-for="group in conflictGroups" :key="group.code" class="bg-white rounded-lg border border-violet-100 p-3">
        <!-- Group header -->
        <div class="flex items-center gap-2 mb-2">
          <input type="checkbox" :checked="group.rows.every(r => selectedConflictRows.has(r._idx))" @change="toggleConflictGroup(group)" class="rounded text-violet-600 focus:ring-violet-400" />
          <span class="text-xs font-mono font-bold text-gray-800">{{ group.code }}</span>
          <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600">{{ group.rows.length }} row{{ group.rows.length > 1 ? 's' : '' }}</span>
          <span v-if="group.existingVariants.length > 0" class="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600">{{ group.existingVariants.length }} existing in DB</span>
        </div>

        <!-- Existing DB variants -->
        <div v-if="group.existingVariants.length > 0" class="mb-2 flex flex-wrap gap-1.5">
          <span v-for="ev in group.existingVariants" :key="ev.id" class="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded text-[10px] text-emerald-700">
            <i class="pi pi-box text-[8px]" />
            {{ ev.product_name }}
            <span v-if="ev.dimension" class="text-emerald-500">&middot; {{ ev.dimension }}</span>
            <span v-if="ev.is_default" class="text-amber-500 font-bold">&#9733;</span>
          </span>
        </div>

        <!-- Rows in this group -->
        <div class="space-y-2">
          <div v-for="row in group.rows" :key="row._idx"
            class="border rounded-lg p-2.5 border-l-[3px] transition-all duration-200"
            :class="{
              'border-gray-200 border-l-red-400 bg-gray-50/80 opacity-60': variantResolutions[String(row._idx)]?.action === 'duplicate',
              'border-blue-200 border-l-blue-500 bg-blue-50/30': variantResolutions[String(row._idx)]?.action === 'replace',
              'border-violet-100 border-l-emerald-500 bg-violet-50/30': variantResolutions[String(row._idx)]?.action !== 'duplicate' && variantResolutions[String(row._idx)]?.action !== 'replace',
            }"
          >
            <!-- Row info -->
            <div class="flex items-center gap-2 mb-1.5">
              <input type="checkbox" :checked="selectedConflictRows.has(row._idx)" @change="toggleConflictRow(row._idx)" class="rounded text-violet-600 focus:ring-violet-400" />
              <span class="text-[10px] text-gray-400 font-mono">Row {{ row.row }}</span>
              <span class="text-xs font-medium text-gray-800">{{ row.description || row.manufacturer_code }}</span>
              <span v-if="row.chinese_name" class="text-xs text-gray-500">{{ row.chinese_name }}</span>
              <span v-if="row.dimension" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{{ row.dimension }}</span>
              <span v-if="row.material" class="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{{ row.material }}</span>
            </div>

            <!-- Resolution options -->
            <div class="flex items-center gap-4">
              <label class="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" :name="'resolve_' + row._idx" value="add_new"
                  :checked="(variantResolutions[String(row._idx)]?.action || 'add_new') === 'add_new'"
                  @change="setResolution(row._idx, { action: 'add_new', replace_id: null })"
                  class="text-violet-600" />
                <span class="text-violet-700">Add as variant</span>
              </label>
              <label class="flex items-center gap-1.5 text-xs cursor-pointer" v-if="group.existingVariants.length > 0">
                <input type="radio" :name="'resolve_' + row._idx" value="replace"
                  :checked="variantResolutions[String(row._idx)]?.action === 'replace'"
                  @change="setResolution(row._idx, { action: 'replace', replace_id: group.existingVariants[0]?.id || null })"
                  class="text-blue-600" />
                <span class="text-blue-700">Replace existing</span>
              </label>
              <label class="flex items-center gap-1.5 text-xs cursor-pointer">
                <input type="radio" :name="'resolve_' + row._idx" value="duplicate"
                  :checked="variantResolutions[String(row._idx)]?.action === 'duplicate'"
                  @change="setResolution(row._idx, { action: 'duplicate', replace_id: null })"
                  class="text-gray-400" />
                <span class="text-gray-500">Duplicate (skip)</span>
              </label>
              <select
                v-if="variantResolutions[String(row._idx)]?.action === 'replace' && group.existingVariants.length > 0"
                :value="variantResolutions[String(row._idx)]?.replace_id"
                @change="setResolution(row._idx, { action: 'replace', replace_id: $event.target.value })"
                class="text-xs border border-blue-200 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-blue-300"
              >
                <option v-for="ev in group.existingVariants" :key="ev.id" :value="ev.id">
                  {{ ev.product_name }}{{ ev.dimension ? ' (' + ev.dimension + ')' : '' }}
                </option>
              </select>
            </div>

            <!-- AI reason -->
            <div v-if="aiResolutions[String(row._idx)]?.reason"
              class="flex items-start gap-1.5 mt-1.5 ml-6 px-2.5 py-1.5 rounded-md text-[11px]"
              :class="{
                'bg-indigo-50/80 border border-indigo-100': aiResolutions[String(row._idx)]?.confidence === 'high',
                'bg-amber-50/80 border border-amber-100': aiResolutions[String(row._idx)]?.confidence === 'medium',
                'bg-gray-50/80 border border-gray-100': aiResolutions[String(row._idx)]?.confidence === 'low',
              }"
            >
              <svg class="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
              <span class="text-indigo-700">
                <strong class="font-semibold">{{ aiResolutionSource === 'ai' ? 'AI' : 'Analysis' }}:</strong> {{ aiResolutions[String(row._idx)]?.reason }}
              </span>
              <span class="ml-auto flex-shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                :class="{
                  'bg-emerald-100 text-emerald-700': aiResolutions[String(row._idx)]?.confidence === 'high',
                  'bg-amber-100 text-amber-700': aiResolutions[String(row._idx)]?.confidence === 'medium',
                  'bg-gray-200 text-gray-600': aiResolutions[String(row._idx)]?.confidence === 'low',
                }"
              >{{ aiResolutions[String(row._idx)]?.confidence }} confidence</span>
            </div>

            <!-- Edit fields (for add_new) -->
            <div v-if="(variantResolutions[String(row._idx)]?.action || 'add_new') === 'add_new'" class="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <label class="text-[10px] text-gray-400 block">Name</label>
                <input :value="rowOverrides[String(row._idx)]?.description ?? row.description"
                  @input="setOverride(row._idx, 'description', $event.target.value)"
                  class="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-violet-300 focus:border-violet-300" placeholder="Product name" />
              </div>
              <div>
                <label class="text-[10px] text-gray-400 block">Chinese Name</label>
                <input :value="rowOverrides[String(row._idx)]?.chinese_name ?? row.chinese_name"
                  @input="setOverride(row._idx, 'chinese_name', $event.target.value)"
                  class="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-violet-300 focus:border-violet-300" placeholder="Chinese name" />
              </div>
              <div>
                <label class="text-[10px] text-gray-400 block">Dimension</label>
                <input :value="rowOverrides[String(row._idx)]?.dimension ?? row.dimension"
                  @input="setOverride(row._idx, 'dimension', $event.target.value)"
                  class="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-violet-300 focus:border-violet-300" placeholder="Size / Dimension" />
              </div>
              <div>
                <label class="text-[10px] text-gray-400 block">Material</label>
                <input :value="rowOverrides[String(row._idx)]?.material ?? row.material"
                  @input="setOverride(row._idx, 'material', $event.target.value)"
                  class="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-violet-300 focus:border-violet-300" placeholder="Material" />
              </div>
              <div>
                <label class="text-[10px] text-gray-400 block">Part Type</label>
                <input :value="rowOverrides[String(row._idx)]?.part_type ?? row.part_type"
                  @input="setOverride(row._idx, 'part_type', $event.target.value)"
                  class="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:ring-1 focus:ring-violet-300 focus:border-violet-300" placeholder="Original / Copy / OEM" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Process Button -->
    <div class="mt-4 flex items-center gap-3">
      <button @click="$emit('process')" class="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium flex items-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
        </svg>
        Process
      </button>
      <span v-if="processed" class="text-xs text-green-600 flex items-center gap-1">
        <i class="pi pi-check text-[10px]" /> Preview updated
      </span>
    </div>
  </div>
</template>
