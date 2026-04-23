<script setup>
import { ref, computed, onMounted } from 'vue'
import { productionApi } from '../../api'

const props = defineProps({
  orderId: { type: String, required: true },
  order: { type: Object, required: true },
})

// Production stage check (recreated locally from order prop)
const isProductionStage = computed(() => {
  const prodStatuses = ['FACTORY_ORDERED', 'PRODUCTION_60', 'PRODUCTION_80', 'PRODUCTION_90',
    'PLAN_PACKING', 'FINAL_PI', 'PRODUCTION_100']
  return prodStatuses.includes(props.order?.status)
})

// Production progress state
const productionProgress = ref(null)
const startDateInput = ref('')
const targetDateInput = ref('')
const settingTarget = ref(false)

// Load production progress from API
async function loadProductionProgress() {
  try {
    const res = await productionApi.getProgress(props.orderId)
    productionProgress.value = res.data
    if (res.data.started_at) startDateInput.value = res.data.started_at
    if (res.data.target_date) targetDateInput.value = res.data.target_date
  } catch (err) {
    console.error('Failed to load production progress:', err)
  }
}

// Set production start/target dates
async function setProductionDates() {
  if (!targetDateInput.value && !startDateInput.value) return
  settingTarget.value = true
  try {
    const data = {}
    if (startDateInput.value) data.started_at = startDateInput.value
    if (targetDateInput.value) data.target_date = targetDateInput.value
    await productionApi.setDates(props.orderId, data)
    await loadProductionProgress()
  } catch (err) {
    console.error('Failed to set production dates:', err)
  } finally {
    settingTarget.value = false
  }
}

onMounted(() => {
  if (isProductionStage.value) {
    loadProductionProgress()
  }
})
</script>

<template>
  <!-- ==========================================
       PRODUCTION PROGRESS (Level 5A)
       ========================================== -->
  <div v-if="isProductionStage" class="bg-white rounded-xl shadow-sm overflow-hidden border-2 border-indigo-200 mb-6">
    <div class="px-6 py-4 border-b border-indigo-200 bg-indigo-50">
      <h3 class="text-sm font-semibold text-indigo-800 uppercase tracking-wider flex items-center gap-2">
        <i class="pi pi-chart-bar text-indigo-600" /> Production Progress
      </h3>
    </div>
    <div class="p-6">
      <!-- Production date inputs -->
      <div class="flex items-end gap-4 mb-6">
        <div class="flex-1">
          <label class="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
          <input type="date" v-model="startDateInput"
            class="w-full max-w-xs px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <div class="flex-1">
          <label class="block text-xs font-medium text-slate-600 mb-1">Target Completion Date</label>
          <input type="date" v-model="targetDateInput"
            class="w-full max-w-xs px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
        </div>
        <button @click="setProductionDates" :disabled="settingTarget || (!targetDateInput && !startDateInput)"
          class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {{ settingTarget ? 'Saving...' : 'Save Dates' }}
        </button>
      </div>

      <!-- Progress bar -->
      <div v-if="productionProgress" class="space-y-3">
        <div class="flex items-center justify-between text-sm">
          <span class="text-slate-600">
            Started: <strong>{{ productionProgress.started_at || '\u2014' }}</strong>
          </span>
          <span class="text-slate-600">
            Target: <strong>{{ productionProgress.target_date || '\u2014' }}</strong>
          </span>
        </div>
        <div class="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
          <div class="h-full rounded-full transition-all duration-500"
            :class="productionProgress.is_overdue ? 'bg-red-500' : 'bg-indigo-500'"
            :style="{ width: Math.min(productionProgress.percent, 100) + '%' }">
          </div>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="font-semibold" :class="productionProgress.is_overdue ? 'text-red-600' : 'text-indigo-600'">
            {{ productionProgress.percent }}%
          </span>
          <span v-if="productionProgress.is_overdue" class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
            <i class="pi pi-exclamation-triangle text-[10px] mr-1" />
            {{ productionProgress.overdue_days }} days overdue
          </span>
          <span v-else-if="productionProgress.days_remaining !== null" class="text-slate-500">
            {{ productionProgress.days_remaining }} days remaining
          </span>
        </div>
      </div>
      <div v-else class="text-sm text-slate-400">
        Set a target date to track production progress.
      </div>
    </div>
  </div>
</template>
