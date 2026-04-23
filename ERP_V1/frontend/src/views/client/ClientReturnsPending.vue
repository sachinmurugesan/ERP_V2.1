<script setup>
import { ref, onMounted, computed } from 'vue'
import { unloadedApi, afterSalesApi } from '../../api'

const loading = ref(true)
const activeTab = ref('all')
const searchQuery = ref('')

const unloadedItems = ref([])
const aftersalesItems = ref([])

async function loadAll() {
  loading.value = true
  try {
    const [ulRes, asRes] = await Promise.all([
      unloadedApi.list({ status: 'PENDING', per_page: 200 }),
      afterSalesApi.list({ carry_forward_only: true, per_page: 200 }),
    ])
    unloadedItems.value = (ulRes.data?.items || []).map(i => ({ ...i, _type: 'unloaded' }))
    aftersalesItems.value = (asRes.data?.items || []).map(i => ({ ...i, _type: 'aftersales' }))
  } catch (err) {
    console.error('Failed to load returns & pending:', err)
  } finally {
    loading.value = false
  }
}

onMounted(loadAll)

const allItems = computed(() => [...unloadedItems.value, ...aftersalesItems.value])

const tabItems = computed(() => {
  if (activeTab.value === 'unloaded') return unloadedItems.value
  if (activeTab.value === 'aftersales') return aftersalesItems.value
  return allItems.value
})

const filteredItems = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return tabItems.value
  return tabItems.value.filter(item => {
    const code = (item.product_code || '').toLowerCase()
    const name = (item.product_name || '').toLowerCase()
    const order = (item.original_order_number || item.order_number || '').toLowerCase()
    return code.includes(q) || name.includes(q) || order.includes(q)
  })
})

function stepperState(item) {
  const s = item.carry_forward_status || item.status || ''
  // Returns step index: 0=PENDING, 1=ADDED_TO_ORDER, 2=FULFILLED
  if (s === 'FULFILLED') return 2
  if (s === 'ADDED_TO_ORDER') return 1
  return 0
}

const STEPPER_STEPS = [
  { label: 'Pending', icon: 'pi-clock' },
  { label: 'In Order', icon: 'pi-shopping-cart' },
  { label: 'Fulfilled', icon: 'pi-check' },
]

function typeBadge(item) {
  if (item._type === 'unloaded') return { label: 'Unloaded', cls: 'bg-purple-100 text-purple-700' }
  if (item.carry_forward_type === 'REPLACEMENT') return { label: 'Replacement', cls: 'bg-emerald-100 text-emerald-700' }
  if (item.carry_forward_type === 'COMPENSATION') return { label: 'Compensation', cls: 'bg-blue-100 text-blue-700' }
  return { label: 'After-Sales', cls: 'bg-orange-100 text-orange-700' }
}
</script>

<template>
  <div class="p-4 md:p-6 max-w-5xl mx-auto">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
        <i class="pi pi-replay text-emerald-600" />
        Returns & Pending
      </h1>
      <p class="text-sm text-slate-500 mt-1">
        Items from previous orders that will be carried forward to your next order with the same factory.
      </p>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-3 gap-3 mb-5">
      <div class="bg-white rounded-xl border border-slate-200 p-4 text-center">
        <div class="text-2xl font-bold text-slate-800">{{ allItems.length }}</div>
        <div class="text-xs text-slate-500 mt-1">Total Pending</div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 p-4 text-center">
        <div class="text-2xl font-bold text-orange-600">{{ aftersalesItems.length }}</div>
        <div class="text-xs text-slate-500 mt-1">After-Sales</div>
      </div>
      <div class="bg-white rounded-xl border border-slate-200 p-4 text-center">
        <div class="text-2xl font-bold text-purple-600">{{ unloadedItems.length }}</div>
        <div class="text-xs text-slate-500 mt-1">Unloaded</div>
      </div>
    </div>

    <!-- Tabs + Search -->
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-100 px-4 pt-3">
        <div class="flex gap-1">
          <button
            v-for="tab in [
              { id: 'all', label: 'All', count: allItems.length },
              { id: 'aftersales', label: 'After-Sales', count: aftersalesItems.length },
              { id: 'unloaded', label: 'Unloaded', count: unloadedItems.length },
            ]"
            :key="tab.id"
            @click="activeTab = tab.id"
            class="px-3 py-2 text-xs font-medium rounded-t-lg transition-colors"
            :class="activeTab === tab.id
              ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-600'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'"
          >
            {{ tab.label }}
            <span class="ml-1 px-1.5 py-0.5 rounded-full text-[10px]"
              :class="activeTab === tab.id ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-500'"
            >{{ tab.count }}</span>
          </button>
        </div>
        <div class="relative mb-2">
          <i class="pi pi-search absolute left-2.5 top-2 text-slate-400 text-xs" />
          <input
            v-model="searchQuery"
            placeholder="Search by code, name, or order..."
            class="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs w-48 focus:ring-1 focus:ring-emerald-300 focus:border-emerald-300"
          />
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="p-8 text-center text-slate-400 text-sm">
        <i class="pi pi-spin pi-spinner mr-2" /> Loading...
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredItems.length === 0" class="p-8 text-center">
        <i class="pi pi-check-circle text-3xl text-emerald-400 mb-2" />
        <p class="text-sm text-slate-500">No pending items found.</p>
        <p class="text-xs text-slate-400 mt-1">All carry-forward items have been fulfilled.</p>
      </div>

      <!-- Items Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-xs text-slate-500 border-b border-slate-100">
              <th class="text-left px-4 py-2.5 font-medium">Product</th>
              <th class="text-left px-4 py-2.5 font-medium">Type</th>
              <th class="text-center px-4 py-2.5 font-medium">Qty</th>
              <th class="text-left px-4 py-2.5 font-medium">From Order</th>
              <th class="text-left px-4 py-2.5 font-medium">Progress</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, idx) in filteredItems"
              :key="idx"
              class="border-b border-slate-50 hover:bg-slate-50 transition-colors"
            >
              <td class="px-4 py-3">
                <div class="font-medium text-slate-800 text-xs">{{ item.product_code || '—' }}</div>
                <div class="text-[11px] text-slate-500 truncate max-w-[200px]">{{ item.product_name || '—' }}</div>
              </td>
              <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-medium" :class="typeBadge(item).cls">
                  {{ typeBadge(item).label }}
                </span>
              </td>
              <td class="px-4 py-3 text-center font-medium text-slate-700 text-xs">
                {{ item.affected_quantity || item.quantity || '—' }}
              </td>
              <td class="px-4 py-3">
                <span class="text-xs text-slate-600">{{ item.original_order_number || item.order_number || '—' }}</span>
              </td>
              <td class="px-4 py-3">
                <!-- 3-step stepper -->
                <div class="flex items-center gap-0.5">
                  <template v-for="(step, si) in STEPPER_STEPS" :key="si">
                    <div class="flex items-center gap-1">
                      <div
                        class="w-5 h-5 rounded-full flex items-center justify-center text-[9px]"
                        :class="si <= stepperState(item)
                          ? si === stepperState(item)
                            ? 'bg-emerald-500 text-white'
                            : 'bg-emerald-200 text-emerald-700'
                          : 'bg-slate-100 text-slate-400'"
                      >
                        <i :class="'pi ' + step.icon" style="font-size: 9px;" />
                      </div>
                      <span
                        class="text-[9px] font-medium hidden lg:inline"
                        :class="si <= stepperState(item) ? 'text-emerald-700' : 'text-slate-400'"
                      >{{ step.label }}</span>
                    </div>
                    <div
                      v-if="si < STEPPER_STEPS.length - 1"
                      class="w-4 h-px mx-0.5"
                      :class="si < stepperState(item) ? 'bg-emerald-300' : 'bg-slate-200'"
                    />
                  </template>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Info Note -->
    <div class="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
      <i class="pi pi-info-circle mr-1" />
      Pending items are automatically added to your next order when it's assigned to the same factory.
      You don't need to manually add them.
    </div>
  </div>
</template>
