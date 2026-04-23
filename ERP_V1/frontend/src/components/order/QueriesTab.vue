<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { queriesApi } from '../../api'
import { useNotifications } from '../../composables/useNotifications'

const props = defineProps({
  orderId: { type: String, required: true },
  order: { type: Object, required: true },
})

const route = useRoute()
const { markReadByResource } = useNotifications()

const queries = ref([])
const loading = ref(false)
const searchText = ref('')
const filterStatus = ref('all')
const filterType = ref('')
const sortBy = ref('newest')

// Bulk selection
const selectedIds = ref(new Set())
function toggleSelect(id) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}
function toggleSelectAll() {
  if (selectedIds.value.size === filteredQueries.value.length) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(filteredQueries.value.map(q => q.id))
  }
}
const allSelected = computed(() =>
  filteredQueries.value.length > 0 && selectedIds.value.size === filteredQueries.value.length
)
const bulkResolving = ref(false)

async function bulkResolveSelected() {
  if (selectedIds.value.size === 0) return
  if (!confirm(`Resolve ${selectedIds.value.size} selected queries?`)) return
  bulkResolving.value = true
  try {
    for (const id of selectedIds.value) {
      await queriesApi.resolve(props.orderId, id)
    }
    selectedIds.value = new Set()
    await loadQueries()
  } catch (e) { console.error(e) }
  bulkResolving.value = false
}

// Export to CSV
function exportToCsv() {
  const rows = [['Status', 'Type', 'Subject', 'Item Code', 'Product', 'Created By', 'Created At', 'Last Activity', 'Messages']]
  for (const q of filteredQueries.value) {
    rows.push([
      q.status,
      QUERY_TYPE_LABELS[q.query_type]?.label || q.query_type,
      q.subject,
      q.product_code || '',
      q.product_name || '',
      q.created_by_role,
      new Date(q.created_at).toLocaleString(),
      q.last_message_at ? new Date(q.last_message_at).toLocaleString() : '',
      q.message_count,
    ])
  }
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `queries-${props.order?.order_number || props.orderId}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Analytics
const showAnalytics = ref(false)

const typeBreakdown = computed(() => {
  const counts = {}
  for (const q of queries.value) {
    counts[q.query_type] = (counts[q.query_type] || 0) + 1
  }
  const total = queries.value.length || 1
  return Object.entries(counts).map(([type, count]) => ({
    type,
    count,
    percent: Math.round((count / total) * 100),
    label: QUERY_TYPE_LABELS[type]?.label || type,
    color: QUERY_TYPE_LABELS[type]?.color || 'text-slate-600',
    bg: QUERY_TYPE_LABELS[type]?.bg || 'bg-slate-100',
  })).sort((a, b) => b.count - a.count)
})

const resolutionRate = computed(() => {
  if (queries.value.length === 0) return 0
  return Math.round((resolvedCount.value / queries.value.length) * 100)
})

const topQueriedItems = computed(() => {
  const counts = {}
  for (const q of queries.value) {
    const key = q.product_code || 'Unknown'
    if (!counts[key]) counts[key] = { code: key, name: q.product_name, count: 0, open: 0 }
    counts[key].count += 1
    if (q.status === 'OPEN' || q.status === 'REPLIED') counts[key].open += 1
  }
  return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5)
})

// Thread drawer
const drawerOpen = ref(false)
const selectedQuery = ref(null)
const uploadingFile = ref(false)
const fileInputRef = ref(null)

// Image lightbox
const lightboxUrl = ref(null)
const lightboxZoom = ref(1)
function openLightbox(url) { lightboxUrl.value = url; lightboxZoom.value = 1 }
function closeLightbox() { lightboxUrl.value = null }

// Video player modal
const videoPlayerUrl = ref(null)
const videoPlayerName = ref('')
function openVideoPlayer(url, name) { videoPlayerUrl.value = url; videoPlayerName.value = name }
function closeVideoPlayer() { videoPlayerUrl.value = null }

let threadPollInterval = null
let listPollInterval = null

function startThreadPolling() {
  stopThreadPolling()
  threadPollInterval = setInterval(async () => {
    if (!selectedQuery.value || !drawerOpen.value) return
    try {
      const { data } = await queriesApi.get(props.orderId, selectedQuery.value.id)
      // Only update if message count changed to avoid flicker
      if (data.message_count !== selectedQuery.value.message_count || data.status !== selectedQuery.value.status) {
        selectedQuery.value = data
        const idx = queries.value.findIndex(q => q.id === data.id)
        if (idx >= 0) queries.value[idx] = data
      }
    } catch (e) { /* ignore */ }
  }, 5000)
}
function stopThreadPolling() {
  if (threadPollInterval) { clearInterval(threadPollInterval); threadPollInterval = null }
}

function startListPolling() {
  stopListPolling()
  listPollInterval = setInterval(async () => {
    if (drawerOpen.value) return  // thread polling handles this
    try {
      const { data } = await queriesApi.list(props.orderId)
      queries.value = data
    } catch (e) { /* ignore */ }
  }, 10000)
}
function stopListPolling() {
  if (listPollInterval) { clearInterval(listPollInterval); listPollInterval = null }
}

const messagesContainerRef = ref(null)

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainerRef.value) {
      messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight
    }
  })
}

async function openThread(query) {
  selectedQuery.value = query
  drawerOpen.value = true
  startThreadPolling()
  // Mark notifications read for this order (any new reply was for this user)
  markReadByResource('order', props.orderId, 'ITEM_QUERY_REPLY')
  // Fetch latest messages then scroll to bottom
  try {
    const { data } = await queriesApi.get(props.orderId, query.id)
    selectedQuery.value = data
    scrollToBottom()
  } catch (e) { console.error(e) }
}

// Auto-scroll when new messages arrive
watch(() => selectedQuery.value?.messages?.length, (newLen, oldLen) => {
  if (newLen !== oldLen) scrollToBottom()
})
function closeThread() {
  drawerOpen.value = false
  stopThreadPolling()
  setTimeout(() => { selectedQuery.value = null }, 200)
}

onBeforeUnmount(() => {
  stopThreadPolling()
  stopListPolling()
})

async function refreshSelectedQuery() {
  if (!selectedQuery.value) return
  const { data } = await queriesApi.get(props.orderId, selectedQuery.value.id)
  selectedQuery.value = data
  // Update in list
  const idx = queries.value.findIndex(q => q.id === data.id)
  if (idx >= 0) queries.value[idx] = data
}

async function onFileSelect(e) {
  const file = e.target.files?.[0]
  if (!file || !selectedQuery.value) return
  uploadingFile.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    await queriesApi.replyWithAttachment(props.orderId, selectedQuery.value.id, formData, replyMessage.value || '')
    replyMessage.value = ''
    await refreshSelectedQuery()
    await loadQueries()
  } catch (err) { console.error(err) }
  uploadingFile.value = false
  if (fileInputRef.value) fileInputRef.value.value = ''
}

function isImageAttachment(path) {
  return /\.(jpe?g|png|gif|webp|bmp|svg)$/i.test(path || '')
}
function isVideoAttachment(path) {
  return /\.(mp4|webm|mov|avi|mkv)$/i.test(path || '')
}

const QUERY_TYPE_LABELS = {
  PHOTO_REQUEST: { label: 'Photo Request', icon: 'pi-camera', color: 'text-blue-600', bg: 'bg-blue-50', ring: 'ring-blue-200' },
  VIDEO_REQUEST: { label: 'Video Request', icon: 'pi-video', color: 'text-purple-600', bg: 'bg-purple-50', ring: 'ring-purple-200' },
  DIMENSION_CHECK: { label: 'Dimensions', icon: 'pi-arrows-alt', color: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-200' },
  QUALITY_QUERY: { label: 'Quality', icon: 'pi-star', color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-200' },
  ALTERNATIVE: { label: 'Alternative', icon: 'pi-sync', color: 'text-indigo-600', bg: 'bg-indigo-50', ring: 'ring-indigo-200' },
  GENERAL: { label: 'General', icon: 'pi-comment', color: 'text-slate-600', bg: 'bg-slate-50', ring: 'ring-slate-200' },
}

async function loadQueries() {
  loading.value = true
  try {
    const { data } = await queriesApi.list(props.orderId)
    queries.value = data
    // Mark all query notifications for this order as read
    await markReadByResource('order', props.orderId, 'ITEM_QUERY_REPLY')
    await markReadByResource('order', props.orderId, 'ITEM_QUERY_CREATED')
    // Auto-open specific query if ?query=<id> in URL
    const qid = route.query.query
    if (qid && !drawerOpen.value) {
      const q = queries.value.find(x => x.id === qid)
      if (q) openThread(q)
    }
  } catch (e) { console.error(e) }
  loading.value = false
}
onMounted(() => {
  loadQueries()
  startListPolling()
})

// React to URL ?query=<id> param — auto-open thread
watch(() => route.query.query, (qid) => {
  if (!qid) return
  const q = queries.value.find(x => x.id === qid)
  if (q) {
    openThread(q)
  } else {
    // Query list hasn't loaded yet — reload then open
    loadQueries()
  }
}, { immediate: false })

// KPI computeds
const openCount = computed(() => queries.value.filter(q => q.status === 'OPEN').length)
const repliedCount = computed(() => queries.value.filter(q => q.status === 'REPLIED').length)
const resolvedCount = computed(() => queries.value.filter(q => q.status === 'RESOLVED').length)

const avgResponseTime = computed(() => {
  const replied = queries.value.filter(q => q.status === 'REPLIED' || q.status === 'RESOLVED')
  if (replied.length === 0) return '—'
  const totalMs = replied.reduce((sum, q) => {
    if (q.messages?.length < 2) return sum
    const first = new Date(q.messages[0].created_at)
    const second = new Date(q.messages[1].created_at)
    return sum + (second - first)
  }, 0)
  const avgMs = totalMs / replied.length
  const hours = Math.floor(avgMs / 3600000)
  const mins = Math.floor((avgMs % 3600000) / 60000)
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
})

// Filtering + sorting
const filteredQueries = computed(() => {
  let result = [...queries.value]
  if (filterStatus.value !== 'all') {
    result = result.filter(q => q.status === filterStatus.value.toUpperCase())
  }
  if (filterType.value) {
    result = result.filter(q => q.query_type === filterType.value)
  }
  if (searchText.value.trim()) {
    const s = searchText.value.toLowerCase()
    result = result.filter(q =>
      (q.subject || '').toLowerCase().includes(s) ||
      (q.product_code || '').toLowerCase().includes(s) ||
      (q.product_name || '').toLowerCase().includes(s) ||
      q.messages?.some(m => (m.message || '').toLowerCase().includes(s))
    )
  }
  // Sort
  if (sortBy.value === 'newest') {
    result.sort((a, b) => new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at))
  } else if (sortBy.value === 'oldest') {
    result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  } else if (sortBy.value === 'activity') {
    result.sort((a, b) => (b.message_count || 0) - (a.message_count || 0))
  }
  return result
})


// Age helper
function getAge(dateStr) {
  if (!dateStr) return ''
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function getAgeClass(dateStr) {
  if (!dateStr) return 'text-slate-400'
  const ms = Date.now() - new Date(dateStr).getTime()
  const hours = ms / 3600000
  if (hours > 24) return 'text-red-600 font-semibold'
  if (hours > 4) return 'text-amber-600 font-medium'
  return 'text-slate-500'
}

// Reply
const replyingTo = ref(null)
const replyMessage = ref('')
const sendingReply = ref(false)

async function sendReply(queryId) {
  if (!replyMessage.value.trim()) return
  sendingReply.value = true
  try {
    await queriesApi.reply(props.orderId, queryId, { message: replyMessage.value })
    replyMessage.value = ''
    replyingTo.value = null
    if (selectedQuery.value?.id === queryId) await refreshSelectedQuery()
    await loadQueries()
  } catch (e) { console.error(e) }
  sendingReply.value = false
}

// Resolution dialog
const showResolveDialog = ref(false)
const resolveTargetId = ref(null)
const resolveRemark = ref('')
const resolving = ref(false)

const REMARK_PRESETS = {
  PHOTO_REQUEST: 'Correct photo provided',
  VIDEO_REQUEST: 'Video provided',
  DIMENSION_CHECK: 'Dimension: ',
  QUALITY_QUERY: 'Quality confirmed — ',
  ALTERNATIVE: 'Alternative: ',
  GENERAL: '',
}

function openResolveDialog(queryId) {
  resolveTargetId.value = queryId
  // Pre-fill remark based on query type
  const q = queries.value.find(x => x.id === queryId) || selectedQuery.value
  resolveRemark.value = REMARK_PRESETS[q?.query_type] || ''
  showResolveDialog.value = true
}

async function submitResolve() {
  if (!resolveTargetId.value) return
  resolving.value = true
  try {
    await queriesApi.resolve(props.orderId, resolveTargetId.value, resolveRemark.value)
    showResolveDialog.value = false
    if (selectedQuery.value?.id === resolveTargetId.value) await refreshSelectedQuery()
    await loadQueries()
  } catch (e) { console.error(e) }
  resolving.value = false
}

// Build an authenticated URL for a query attachment.
// att format stored in DB: orders/{order_id}/queries/{query_id}/{filename}
function attUrl(att) {
  const p = att.split('/')
  return `/api/orders/${p[1]}/queries/${p[3]}/attachments/${p[4]}`
}

// Helper: get first image from query messages
function getQueryThumbnail(query) {
  if (!query.messages) return null
  for (const m of query.messages) {
    if (m.attachments?.length) {
      const img = m.attachments.find(a => /\.(jpe?g|png|gif|webp)$/i.test(a))
      if (img) return attUrl(img)
    }
  }
  return null
}

async function reopenQuery(queryId) {
  try {
    await queriesApi.reopen(props.orderId, queryId)
    if (selectedQuery.value?.id === queryId) await refreshSelectedQuery()
    await loadQueries()
  } catch (e) { console.error(e) }
}

async function deleteQuery(queryId) {
  if (!confirm('Delete this query and all its messages? This cannot be undone.')) return
  try {
    await queriesApi.delete(props.orderId, queryId)
    if (selectedQuery.value?.id === queryId) closeThread()
    await loadQueries()
  } catch (e) {
    alert(e.response?.data?.detail || 'Failed to delete query')
  }
}

// Initials helper for avatars
function getInitials(name) {
  if (!name) return '?'
  const parts = name.split(/[@\s.]/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

function getAvatarColor(role) {
  return role === 'CLIENT' ? 'bg-teal-100 text-teal-700' : 'bg-indigo-100 text-indigo-700'
}
</script>

<template>
  <div class="space-y-4">
    <!-- ═══ Header: Title + Search + Actions ═══ -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div class="flex items-start justify-between mb-4">
        <div>
          <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
            <i class="pi pi-comments text-indigo-600" />
            Item Queries
          </h2>
          <p class="text-xs text-slate-500 mt-0.5">Customer questions about specific items in this order</p>
        </div>
        <div class="flex items-center gap-2">
          <button @click="showAnalytics = !showAnalytics"
            class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
            :class="showAnalytics ? 'text-white bg-indigo-600 border border-indigo-700 hover:bg-indigo-700' : 'text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100'">
            <i class="pi pi-chart-bar text-[10px]" />
            Analytics
          </button>
          <button @click="exportToCsv" :disabled="filteredQueries.length === 0"
            class="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors flex items-center gap-1.5">
            <i class="pi pi-download text-[10px]" />
            Export CSV
          </button>
          <button @click="loadQueries"
            class="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1.5">
            <i :class="loading ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'" class="text-[10px]" />
            Refresh
          </button>
        </div>
      </div>

      <!-- Search bar -->
      <div class="relative">
        <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
        <input v-model="searchText" placeholder="Search by product code, subject, or message content..."
          class="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none" />
      </div>
    </div>

    <!-- ═══ KPI Cards ═══ -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="bg-white rounded-xl shadow-sm border-l-4 border-red-400 border-y border-r border-slate-200 p-4">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Open</span>
          <i class="pi pi-exclamation-circle text-red-400 text-sm" />
        </div>
        <div class="text-3xl font-bold text-slate-800">{{ openCount }}</div>
        <div class="text-[10px] text-slate-400 mt-1">Awaiting response</div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border-l-4 border-blue-400 border-y border-r border-slate-200 p-4">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Replied</span>
          <i class="pi pi-reply text-blue-400 text-sm" />
        </div>
        <div class="text-3xl font-bold text-slate-800">{{ repliedCount }}</div>
        <div class="text-[10px] text-slate-400 mt-1">Awaiting client confirmation</div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border-l-4 border-emerald-400 border-y border-r border-slate-200 p-4">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Resolved</span>
          <i class="pi pi-check-circle text-emerald-400 text-sm" />
        </div>
        <div class="text-3xl font-bold text-slate-800">{{ resolvedCount }}</div>
        <div class="text-[10px] text-slate-400 mt-1">Closed queries</div>
      </div>

      <div class="bg-white rounded-xl shadow-sm border-l-4 border-slate-400 border-y border-r border-slate-200 p-4">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-medium text-slate-500 uppercase tracking-wider">Avg Response</span>
          <i class="pi pi-clock text-slate-400 text-sm" />
        </div>
        <div class="text-3xl font-bold text-slate-800">{{ avgResponseTime }}</div>
        <div class="text-[10px] text-slate-400 mt-1">First response time</div>
      </div>
    </div>

    <!-- ═══ Analytics Panel (collapsible) ═══ -->
    <div v-if="showAnalytics && queries.length > 0" class="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h3 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
        <i class="pi pi-chart-bar text-indigo-600" />
        Query Analytics
      </h3>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <!-- Query Type Breakdown -->
        <div>
          <h4 class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">By Query Type</h4>
          <div class="space-y-2">
            <div v-for="t in typeBreakdown" :key="t.type" class="flex items-center gap-2">
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between text-[11px] mb-1">
                  <span class="font-medium text-slate-700">{{ t.label }}</span>
                  <span class="text-slate-500">{{ t.count }} ({{ t.percent }}%)</span>
                </div>
                <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div class="h-full rounded-full transition-all" :class="t.bg" :style="{ width: t.percent + '%', backgroundColor: 'currentColor' }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Resolution Rate -->
        <div class="flex flex-col items-center justify-center">
          <h4 class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Resolution Rate</h4>
          <div class="relative w-32 h-32">
            <svg class="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" stroke-width="10" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="#10b981" stroke-width="10"
                :stroke-dasharray="`${resolutionRate * 2.51} 251.2`" stroke-linecap="round" />
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-2xl font-bold text-slate-800">{{ resolutionRate }}%</span>
              <span class="text-[10px] text-slate-500">resolved</span>
            </div>
          </div>
          <div class="mt-3 text-[11px] text-slate-500">{{ resolvedCount }} of {{ queries.length }} closed</div>
        </div>

        <!-- Top Queried Items -->
        <div>
          <h4 class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Top Queried Items</h4>
          <div v-if="topQueriedItems.length === 0" class="text-[11px] text-slate-400">No data yet</div>
          <div v-else class="space-y-2">
            <div v-for="item in topQueriedItems" :key="item.code"
              class="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
              <div class="flex-1 min-w-0">
                <div class="text-[11px] font-mono font-semibold text-slate-700 truncate">{{ item.code }}</div>
                <div class="text-[10px] text-slate-500 truncate">{{ item.name }}</div>
              </div>
              <div class="flex items-center gap-1.5 flex-shrink-0">
                <span v-if="item.open > 0" class="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700">
                  {{ item.open }} open
                </span>
                <span class="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600">
                  {{ item.count }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ Bulk Action Bar (sticky when items selected) ═══ -->
    <div v-if="selectedIds.size > 0" class="bg-indigo-600 text-white rounded-xl shadow-lg px-5 py-3 flex items-center justify-between sticky top-4 z-20">
      <div class="flex items-center gap-3">
        <span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/20 text-xs font-bold">
          {{ selectedIds.size }}
        </span>
        <span class="text-sm font-medium">{{ selectedIds.size }} {{ selectedIds.size === 1 ? 'query' : 'queries' }} selected</span>
      </div>
      <div class="flex items-center gap-2">
        <button @click="bulkResolveSelected" :disabled="bulkResolving"
          class="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
          <i :class="bulkResolving ? 'pi pi-spin pi-spinner' : 'pi pi-check-circle'" class="text-[10px]" />
          Resolve All
        </button>
        <button @click="selectedIds = new Set()"
          class="px-3 py-1.5 text-xs font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
          Clear
        </button>
      </div>
    </div>

    <!-- ═══ Filter Pills + Sort ═══ -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-1.5">
        <button @click="filterStatus = 'all'"
          :class="filterStatus === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
          class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors">
          All <span class="opacity-70">({{ queries.length }})</span>
        </button>
        <button @click="filterStatus = 'open'"
          :class="filterStatus === 'open' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'"
          class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors">
          Open <span class="opacity-70">({{ openCount }})</span>
        </button>
        <button @click="filterStatus = 'replied'"
          :class="filterStatus === 'replied' ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'"
          class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors">
          Replied <span class="opacity-70">({{ repliedCount }})</span>
        </button>
        <button @click="filterStatus = 'resolved'"
          :class="filterStatus === 'resolved' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'"
          class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors">
          Resolved <span class="opacity-70">({{ resolvedCount }})</span>
        </button>
      </div>
      <div class="flex items-center gap-2">
        <select v-model="filterType" class="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:border-indigo-300 focus:outline-none">
          <option value="">All Types</option>
          <option v-for="(v, k) in QUERY_TYPE_LABELS" :key="k" :value="k">{{ v.label }}</option>
        </select>
        <select v-model="sortBy" class="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:border-indigo-300 focus:outline-none">
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="activity">Most Activity</option>
        </select>
      </div>
    </div>

    <!-- ═══ Loading ═══ -->
    <div v-if="loading" class="bg-white rounded-xl shadow-sm border border-slate-200 py-16 text-center">
      <i class="pi pi-spinner pi-spin text-2xl text-indigo-400" />
      <p class="text-sm text-slate-500 mt-2">Loading queries...</p>
    </div>

    <!-- ═══ Empty State ═══ -->
    <div v-else-if="filteredQueries.length === 0" class="bg-white rounded-xl shadow-sm border border-slate-200 py-16 text-center">
      <div class="inline-flex w-16 h-16 rounded-full bg-slate-100 items-center justify-center mb-4">
        <i class="pi pi-comments text-3xl text-slate-300" />
      </div>
      <h3 class="text-sm font-semibold text-slate-700">No queries found</h3>
      <p class="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
        {{ searchText || filterStatus !== 'all' || filterType
          ? 'Try adjusting your filters or search terms'
          : 'Click the chat icon on any item to start a query thread' }}
      </p>
    </div>

    <!-- ═══ Query List (Table) ═══ -->
    <div v-else class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-200">
            <th class="px-3 py-3 w-8">
              <input type="checkbox" :checked="allSelected" @change="toggleSelectAll"
                class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            </th>
            <th class="text-left px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider w-1"></th>
            <th class="text-left px-2 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Query</th>
            <th class="text-left px-3 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Item</th>
            <th class="text-left px-3 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider w-20">Type</th>
            <th class="text-left px-3 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider w-24">Created By</th>
            <th class="text-center px-3 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider w-16">Messages</th>
            <th class="text-left px-3 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider w-24">Last Activity</th>
            <th class="text-right px-3 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider w-32">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <template v-for="q in filteredQueries" :key="q.id">
            <tr class="hover:bg-slate-50/80 cursor-pointer transition-colors group"
              :class="selectedIds.has(q.id) ? 'bg-indigo-50/50' : ''"
              @click="openThread(q)">
              <!-- Checkbox -->
              <td class="px-3 py-3" @click.stop>
                <input type="checkbox" :checked="selectedIds.has(q.id)" @change="toggleSelect(q.id)"
                  class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
              </td>
              <!-- Status indicator (left edge color bar) -->
              <td class="p-0">
                <div class="w-1 h-12" :class="{
                  'bg-red-400': q.status === 'OPEN',
                  'bg-blue-400': q.status === 'REPLIED',
                  'bg-emerald-400': q.status === 'RESOLVED',
                }" />
              </td>
              <!-- Subject + status pill -->
              <td class="px-2 py-3">
                <div class="flex items-center gap-2">
                  <span :class="{
                    'bg-red-100 text-red-700': q.status === 'OPEN',
                    'bg-blue-100 text-blue-700': q.status === 'REPLIED',
                    'bg-emerald-100 text-emerald-700': q.status === 'RESOLVED',
                  }" class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide">
                    {{ q.status }}
                  </span>
                  <span class="text-sm font-semibold text-slate-800">{{ q.subject }}</span>
                  <img v-if="getQueryThumbnail(q)" :src="getQueryThumbnail(q)"
                    class="w-6 h-6 rounded object-cover border border-slate-200 cursor-pointer hover:ring-2 hover:ring-indigo-300"
                    @click.stop="openLightbox(getQueryThumbnail(q))" />
                </div>
                <div v-if="q.resolution_remark" class="mt-1">
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <i class="pi pi-check text-[8px] mr-1" />{{ q.resolution_remark }}
                  </span>
                </div>
              </td>
              <!-- Item -->
              <td class="px-3 py-3">
                <div class="text-xs font-mono text-slate-700">{{ q.product_code }}</div>
                <div class="text-[10px] text-slate-500 truncate max-w-xs">{{ q.product_name }}</div>
              </td>
              <!-- Type -->
              <td class="px-3 py-3">
                <span :class="['inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium', QUERY_TYPE_LABELS[q.query_type]?.bg, QUERY_TYPE_LABELS[q.query_type]?.color]">
                  <i :class="['pi', QUERY_TYPE_LABELS[q.query_type]?.icon]" class="text-[9px]" />
                  {{ QUERY_TYPE_LABELS[q.query_type]?.label?.split(' ')[0] }}
                </span>
              </td>
              <!-- Created by avatar -->
              <td class="px-3 py-3">
                <div class="flex items-center gap-2">
                  <div :class="['w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold', getAvatarColor(q.created_by_role)]">
                    {{ getInitials(q.messages?.[0]?.sender_name) }}
                  </div>
                  <span class="text-[10px] text-slate-600">{{ q.created_by_role === 'CLIENT' ? 'Client' : 'Admin' }}</span>
                </div>
              </td>
              <!-- Message count -->
              <td class="px-3 py-3 text-center">
                <span class="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                  {{ q.message_count }}
                </span>
              </td>
              <!-- Last activity -->
              <td class="px-3 py-3">
                <div :class="['text-[11px]', getAgeClass(q.last_message_at || q.created_at)]">
                  {{ getAge(q.last_message_at || q.created_at) }}
                </div>
              </td>
              <!-- Actions -->
              <td class="px-3 py-3 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button v-if="q.status !== 'RESOLVED'" @click.stop="openResolveDialog(q.id)"
                    class="px-2 py-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded hover:bg-emerald-100 transition-colors">
                    <i class="pi pi-check text-[9px] mr-0.5" /> Resolve
                  </button>
                  <button class="px-2 py-1 text-[10px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors">
                    <i class="pi pi-external-link text-[9px] mr-0.5" /> Open
                  </button>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- ═══ THREAD DRAWER (slide-out) ═══ -->
    <transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0" enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="drawerOpen" class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" @click="closeThread" />
    </transition>
    <transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="translate-x-full" enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-from-class="translate-x-0" leave-to-class="translate-x-full">
      <div v-if="drawerOpen && selectedQuery" class="fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col">
        <!-- Drawer Header -->
        <div class="border-b border-slate-200 flex-shrink-0">
          <div class="px-6 py-4 flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span :class="{
                  'bg-red-100 text-red-700': selectedQuery.status === 'OPEN',
                  'bg-blue-100 text-blue-700': selectedQuery.status === 'REPLIED',
                  'bg-emerald-100 text-emerald-700': selectedQuery.status === 'RESOLVED',
                }" class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide">
                  {{ selectedQuery.status }}
                </span>
                <span :class="['inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium', QUERY_TYPE_LABELS[selectedQuery.query_type]?.bg, QUERY_TYPE_LABELS[selectedQuery.query_type]?.color]">
                  <i :class="['pi', QUERY_TYPE_LABELS[selectedQuery.query_type]?.icon]" class="text-[9px]" />
                  {{ QUERY_TYPE_LABELS[selectedQuery.query_type]?.label }}
                </span>
              </div>
              <h3 class="text-base font-bold text-slate-800">{{ selectedQuery.subject }}</h3>
              <p class="text-xs text-slate-500 font-mono mt-1">{{ selectedQuery.product_code }} — {{ selectedQuery.product_name }}</p>
            </div>
            <div class="flex items-center gap-2 ml-4">
              <button v-if="selectedQuery.status !== 'RESOLVED'" @click="openResolveDialog(selectedQuery.id)"
                class="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5">
                <i class="pi pi-check-circle text-[10px]" /> Resolve
              </button>
              <button @click="deleteQuery(selectedQuery.id)" title="Delete query"
                class="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                <i class="pi pi-trash text-sm" />
              </button>
              <button @click="closeThread" class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <i class="pi pi-times" />
              </button>
            </div>
          </div>
          <div class="px-6 pb-3 flex items-center gap-4 text-[10px] text-slate-500">
            <span><i class="pi pi-user text-[9px] mr-1" />Created by {{ selectedQuery.created_by_role === 'CLIENT' ? 'Client' : 'Admin' }}</span>
            <span><i class="pi pi-calendar text-[9px] mr-1" />{{ new Date(selectedQuery.created_at).toLocaleString() }}</span>
            <span><i class="pi pi-comment text-[9px] mr-1" />{{ selectedQuery.message_count }} messages</span>
          </div>
        </div>

        <!-- Messages Area (chat bubbles) -->
        <div ref="messagesContainerRef" class="flex-1 overflow-y-auto bg-slate-50 px-6 py-5 space-y-4">
          <div v-for="m in selectedQuery.messages" :key="m.id"
            class="flex gap-3" :class="m.sender_role === 'ADMIN' ? 'flex-row-reverse' : ''">
            <div :class="['w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0', getAvatarColor(m.sender_role)]">
              {{ getInitials(m.sender_name) }}
            </div>
            <div class="flex-1 max-w-md" :class="m.sender_role === 'ADMIN' ? 'items-end' : ''">
              <div class="flex items-center gap-2 mb-1" :class="m.sender_role === 'ADMIN' ? 'justify-end' : ''">
                <span class="text-xs font-semibold" :class="m.sender_role === 'CLIENT' ? 'text-teal-700' : 'text-indigo-700'">
                  {{ m.sender_role === 'CLIENT' ? 'Client' : 'Admin' }}
                </span>
                <span class="text-[10px] text-slate-400">{{ getAge(m.created_at) }}</span>
              </div>
              <div :class="[
                'rounded-2xl px-4 py-2.5 shadow-sm border',
                m.sender_role === 'CLIENT'
                  ? 'bg-white border-slate-200 rounded-tl-sm'
                  : 'bg-indigo-600 text-white border-indigo-700 rounded-tr-sm'
              ]">
                <p class="text-sm whitespace-pre-wrap" :class="m.sender_role === 'CLIENT' ? 'text-slate-700' : 'text-white'">
                  {{ m.message }}
                </p>
                <!-- Attachments -->
                <div v-if="m.attachments?.length" class="mt-2 space-y-1.5">
                  <template v-for="att in m.attachments" :key="att">
                    <!-- Image preview -->
                    <div v-if="isImageAttachment(att)" class="rounded-lg overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer hover:opacity-90 transition-opacity"
                      @click="openLightbox(attUrl(att))">
                      <img :src="attUrl(att)" :alt="att.split('/').pop()" class="max-w-xs max-h-48 object-contain" />
                    </div>
                    <!-- Video preview (professional thumbnail card) -->
                    <div v-else-if="isVideoAttachment(att)"
                      @click="openVideoPlayer(attUrl(att), att.split('/').pop())"
                      class="relative group cursor-pointer rounded-lg overflow-hidden border border-slate-200 bg-gradient-to-br from-slate-800 to-slate-900 hover:border-indigo-400 transition-all"
                      style="width: 280px;">
                      <video :src="attUrl(att)" preload="metadata"
                        class="w-full h-40 object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        muted playsinline />
                      <!-- Play button overlay -->
                      <div class="absolute inset-0 flex items-center justify-center">
                        <div class="w-14 h-14 rounded-full bg-white/95 group-hover:bg-white shadow-xl flex items-center justify-center group-hover:scale-110 transition-all">
                          <i class="pi pi-play text-indigo-600 text-xl ml-1" />
                        </div>
                      </div>
                      <!-- Gradient + filename footer -->
                      <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                        <div class="flex items-center gap-1.5 text-white">
                          <i class="pi pi-video text-[10px]" />
                          <span class="text-[10px] font-medium truncate flex-1">{{ att.split('/').pop() }}</span>
                        </div>
                      </div>
                    </div>
                    <!-- File link -->
                    <a v-else :href="attUrl(att)" target="_blank"
                      :class="m.sender_role === 'CLIENT' ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200' : 'bg-indigo-500 text-white hover:bg-indigo-400 border-indigo-400'"
                      class="inline-flex items-center px-2.5 py-1.5 rounded-lg text-[11px] border transition-colors">
                      <i class="pi pi-paperclip text-[10px] mr-1.5" />{{ att.split('/').pop() }}
                    </a>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Reply Input -->
        <div v-if="selectedQuery.status !== 'RESOLVED'" class="border-t border-slate-200 bg-white px-6 py-4 flex-shrink-0">
          <div class="flex items-end gap-2">
            <input ref="fileInputRef" type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xlsx" class="hidden" @change="onFileSelect" />
            <button @click="fileInputRef?.click()" :disabled="uploadingFile"
              class="w-10 h-10 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-colors flex-shrink-0"
              title="Attach file">
              <i :class="uploadingFile ? 'pi pi-spin pi-spinner' : 'pi pi-paperclip'" class="text-sm" />
            </button>
            <textarea v-model="replyMessage" @keydown.enter.exact.prevent="sendReply(selectedQuery.id)"
              placeholder="Type your reply..." rows="1"
              class="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none resize-none" />
            <button @click="sendReply(selectedQuery.id)" :disabled="sendingReply || !replyMessage.trim()"
              class="px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0">
              <i :class="sendingReply ? 'pi pi-spin pi-spinner' : 'pi pi-send'" class="text-xs" />
              Send
            </button>
          </div>
          <p class="text-[10px] text-slate-400 mt-1.5">Press Enter to send · Click 📎 to attach image, video, or document</p>
        </div>
        <div v-else class="border-t border-slate-200 bg-emerald-50 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div class="flex items-center gap-2">
            <i class="pi pi-check-circle text-emerald-600" />
            <span class="text-xs text-emerald-700 font-medium">This query has been resolved</span>
          </div>
          <div class="flex items-center gap-2">
            <button @click="reopenQuery(selectedQuery.id)"
              class="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1.5">
              <i class="pi pi-refresh text-[10px]" /> Reopen
            </button>
            <button @click="deleteQuery(selectedQuery.id)"
              class="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1.5">
              <i class="pi pi-trash text-[10px]" /> Delete
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- ═══ RESOLVE DIALOG ═══ -->
    <div v-if="showResolveDialog" class="fixed inset-0 z-[55] flex items-center justify-center bg-black/40" @click.self="showResolveDialog = false">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div class="px-6 pt-6 pb-4">
          <div class="mx-auto w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
            <i class="pi pi-check-circle text-emerald-600 text-xl" />
          </div>
          <h3 class="text-base font-bold text-slate-800 text-center mb-1">Resolve Query</h3>
          <p class="text-xs text-slate-500 text-center mb-4">Add a conclusion remark — this will be visible as a tag on the item row for future reference.</p>
          <label class="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1.5">Resolution Remark</label>
          <textarea v-model="resolveRemark" rows="3" placeholder="E.g., Correct photo provided, Dimension: 45x30mm, Quality confirmed..."
            class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 focus:outline-none resize-none" />
        </div>
        <div class="flex gap-3 px-6 pb-6">
          <button @click="showResolveDialog = false"
            class="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button @click="submitResolve" :disabled="resolving"
            class="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5">
            <i :class="resolving ? 'pi pi-spin pi-spinner' : 'pi pi-check'" class="text-xs" />
            Resolve & Close
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ IMAGE LIGHTBOX ═══ -->
    <div v-if="lightboxUrl" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/90" @click="closeLightbox">
      <button @click.stop="closeLightbox" class="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
        <i class="pi pi-times" />
      </button>
      <img :src="lightboxUrl" alt="Preview" class="max-w-[95vw] max-h-[95vh] object-contain" @click.stop />
    </div>

    <!-- ═══ VIDEO PLAYER MODAL ═══ -->
    <div v-if="videoPlayerUrl" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-sm" @click="closeVideoPlayer">
      <!-- Header bar -->
      <div class="absolute top-0 left-0 right-0 px-6 py-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent z-10">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-lg bg-indigo-600/30 flex items-center justify-center flex-shrink-0">
            <i class="pi pi-video text-indigo-300" />
          </div>
          <div class="min-w-0">
            <p class="text-sm font-semibold text-white truncate">{{ videoPlayerName }}</p>
            <p class="text-[10px] text-white/60">Video Attachment</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <a :href="videoPlayerUrl" :download="videoPlayerName" @click.stop
            class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors" title="Download">
            <i class="pi pi-download" />
          </a>
          <button @click.stop="closeVideoPlayer" class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors" title="Close">
            <i class="pi pi-times" />
          </button>
        </div>
      </div>
      <!-- Video element -->
      <div class="relative max-w-[90vw] max-h-[85vh]" @click.stop>
        <video :src="videoPlayerUrl" controls autoplay
          class="max-w-[90vw] max-h-[85vh] rounded-lg shadow-2xl" />
      </div>
    </div>
  </div>
</template>
