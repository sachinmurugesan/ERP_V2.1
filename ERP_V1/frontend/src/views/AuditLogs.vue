<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { auditApi } from '../api'

const activeView = ref('logs')

const loading = ref(true)
const entries = ref([])
const total = ref(0)
const page = ref(1)
const perPage = ref(50)
const expandedId = ref(null)

// Filters
const filterAction = ref('')
const filterResourceType = ref('')
const availableActions = ref([])
const availableTypes = ref([])

const totalPages = computed(() => Math.ceil(total.value / perPage.value))

async function loadLogs() {
  loading.value = true
  try {
    const params = { page: page.value, per_page: perPage.value }
    if (filterAction.value) params.action = filterAction.value
    if (filterResourceType.value) params.resource_type = filterResourceType.value
    const { data } = await auditApi.list(params)
    entries.value = data.items
    total.value = data.total
  } catch (e) {
    console.error('Failed to load audit logs:', e)
  } finally {
    loading.value = false
  }
}

async function loadFilters() {
  try {
    const [actionsRes, typesRes] = await Promise.all([
      auditApi.getActions(),
      auditApi.getResourceTypes(),
    ])
    availableActions.value = actionsRes.data
    availableTypes.value = typesRes.data
  } catch (_) { /* ignore */ }
}

onMounted(() => { loadLogs(); loadFilters() })
watch([page, filterAction, filterResourceType], () => loadLogs())

function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id
}

function formatDate(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function actionColor(action) {
  if (action?.includes('DELETE')) return 'bg-red-50 text-red-700 border-red-200'
  if (action?.includes('CREATE')) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (action?.includes('CHANGE') || action?.includes('UPDATE')) return 'bg-blue-50 text-blue-700 border-blue-200'
  if (action?.includes('JUMP') || action?.includes('BACK')) return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-50 text-slate-700 border-slate-200'
}

function formatJson(obj) {
  if (!obj) return null
  return JSON.stringify(obj, null, 2)
}
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
          <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          Audit Trail
        </h2>
        <div class="flex items-center gap-1.5 mt-2">
          <button @click="activeView = 'logs'"
            :class="activeView === 'logs' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
            class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors">
            <i class="pi pi-list text-[10px] mr-1" /> Audit Logs
          </button>
          <button @click="activeView = 'graph'"
            :class="activeView === 'graph' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'"
            class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors">
            <i class="pi pi-share-alt text-[10px] mr-1" /> Knowledge Graph
          </button>
        </div>
      </div>
      <div v-if="activeView === 'logs'" class="flex items-center gap-2">
        <select v-model="filterAction" @change="page = 1" class="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
          <option value="">All Actions</option>
          <option v-for="a in availableActions" :key="a" :value="a">{{ a }}</option>
        </select>
        <select v-model="filterResourceType" @change="page = 1" class="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
          <option value="">All Resources</option>
          <option v-for="t in availableTypes" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
    </div>

    <!-- Knowledge Graph View -->
    <div v-if="activeView === 'graph'" class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 class="text-sm font-bold text-slate-800 flex items-center gap-2">
            <i class="pi pi-share-alt text-indigo-600" />
            Codebase Knowledge Graph
          </h3>
          <p class="text-xs text-slate-500 mt-0.5">Interactive visualization of code architecture, relationships, and communities</p>
        </div>
        <a href="/graphify/graph.html" target="_blank"
          class="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 flex items-center gap-1">
          <i class="pi pi-external-link text-[10px]" /> Open Full Screen
        </a>
      </div>
      <iframe src="/graphify/graph.html" class="w-full border-0" style="height: 75vh;" />
    </div>

    <!-- Table -->
    <div v-if="activeView === 'logs'" class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div v-if="loading" class="p-8 text-center text-slate-400">Loading audit logs...</div>
      <div v-else-if="entries.length === 0" class="p-8 text-center text-slate-400">No audit entries found</div>
      <table v-else class="w-full text-sm">
        <thead class="bg-slate-50 border-b border-slate-200">
          <tr>
            <th class="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider w-8"></th>
            <th class="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Timestamp</th>
            <th class="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">User</th>
            <th class="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Action</th>
            <th class="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Resource</th>
            <th class="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">ID</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="entry in entries" :key="entry.id">
            <tr
              @click="toggleExpand(entry.id)"
              class="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <td class="px-4 py-2.5">
                <svg class="w-4 h-4 text-slate-400 transition-transform" :class="{'rotate-90': expandedId === entry.id}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
              </td>
              <td class="px-3 py-2.5 text-xs text-slate-600 font-mono whitespace-nowrap">{{ formatDate(entry.timestamp) }}</td>
              <td class="px-3 py-2.5 text-xs text-slate-600">{{ entry.user_email || entry.user_id }}</td>
              <td class="px-3 py-2.5">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded border" :class="actionColor(entry.action)">{{ entry.action }}</span>
              </td>
              <td class="px-3 py-2.5 text-xs text-slate-600 capitalize">{{ entry.resource_type }}</td>
              <td class="px-3 py-2.5 text-[10px] font-mono text-slate-400">{{ entry.resource_id?.substring(0, 12) }}...</td>
            </tr>
            <!-- Expanded Diff View -->
            <tr v-if="expandedId === entry.id">
              <td colspan="6" class="px-4 py-4 bg-slate-50 border-b border-slate-200">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div v-if="entry.old_values">
                    <h4 class="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-1.5">Previous State</h4>
                    <pre class="text-[11px] bg-red-50 border border-red-100 rounded-lg p-3 overflow-x-auto text-red-800 whitespace-pre-wrap">{{ formatJson(entry.old_values) }}</pre>
                  </div>
                  <div v-if="entry.new_values">
                    <h4 class="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-1.5">New State</h4>
                    <pre class="text-[11px] bg-emerald-50 border border-emerald-100 rounded-lg p-3 overflow-x-auto text-emerald-800 whitespace-pre-wrap">{{ formatJson(entry.new_values) }}</pre>
                  </div>
                  <div v-if="entry.metadata" :class="{'md:col-span-2': !entry.old_values && !entry.new_values}">
                    <h4 class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Context</h4>
                    <pre class="text-[11px] bg-slate-100 border border-slate-200 rounded-lg p-3 overflow-x-auto text-slate-700 whitespace-pre-wrap">{{ formatJson(entry.metadata) }}</pre>
                  </div>
                </div>
                <div class="flex gap-4 mt-3 text-[10px] text-slate-400">
                  <span v-if="entry.ip_address">IP: {{ entry.ip_address }}</span>
                  <span>Full ID: {{ entry.id }}</span>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
        <span class="text-xs text-slate-500">Page {{ page }} of {{ totalPages }} ({{ total }} entries)</span>
        <div class="flex gap-1">
          <button
            :disabled="page <= 1"
            @click="page--"
            class="px-3 py-1 text-xs rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >Prev</button>
          <button
            :disabled="page >= totalPages"
            @click="page++"
            class="px-3 py-1 text-xs rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >Next</button>
        </div>
      </div>
    </div>
  </div>
</template>
