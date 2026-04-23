<script setup>
/**
 * Client Portal Order Items Tab — mirrors admin OrderItemsTab
 * design with color-coded rows, carried item badges, and
 * admin-style toolbar. No pricing columns or PI generation.
 * Actions gated by portal permissions + order stage.
 */
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { ordersApi, productsApi, queriesApi } from '../../api'

const props = defineProps({
  orderId: { type: String, required: true },
  order: { type: Object, required: true },
  permissions: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['reload', 'open-query'])

// ========================================
// State
// ========================================
const items = ref([])
const loading = ref(false)
const sortKey = ref(null)
const sortOrder = ref('asc')

// Client can add/edit/remove items only up to PI_SENT
const CLIENT_EDITABLE_STAGES = new Set([
  'CLIENT_DRAFT', 'DRAFT', 'PENDING_PI', 'PI_SENT',
])
// Mid-order stages where client can add new items (pending confirmation flow)
const CLIENT_MID_ORDER_STAGES = new Set([
  'FACTORY_ORDERED', 'PRODUCTION_60', 'PRODUCTION_80', 'PRODUCTION_90',
])
const canEdit = computed(() => CLIENT_EDITABLE_STAGES.has(props.order?.status))
const canAddMidOrder = computed(() => CLIENT_MID_ORDER_STAGES.has(props.order?.status))

// Permission helpers
const canAdd = computed(() => (canEdit.value || canAddMidOrder.value) && props.permissions.items_add)
const canBulkAdd = computed(() => canEdit.value && props.permissions.items_bulk_add)
const canFetchPending = computed(() => canEdit.value && props.permissions.items_fetch_pending)
const canUploadExcel = computed(() => canEdit.value && props.permissions.items_upload_excel)
const canEditQty = computed(() => canEdit.value && props.permissions.items_edit_qty)
const canRemove = computed(() => canEdit.value && props.permissions.items_remove)
const hasAnyAction = computed(() => canAdd.value || canBulkAdd.value || canFetchPending.value || canUploadExcel.value)
const canEditItems = computed(() => canEditQty.value || canRemove.value)
const isEditing = ref(false)

// Transparency client detection — show pricing columns when PI is ready
const isTransparencyClient = computed(() => props.order?.client_type === 'TRANSPARENCY')
const POST_PI_SET = new Set(['PI_SENT','ADVANCE_PENDING','ADVANCE_RECEIVED','FACTORY_ORDERED','PRODUCTION_60','PRODUCTION_80','PRODUCTION_90','PLAN_PACKING','FINAL_PI','PRODUCTION_100','BOOKED','LOADED','SAILED','ARRIVED','CUSTOMS_FILED','CUSTOMS_CLEARED','DELIVERED','AFTER_SALES','COMPLETED'])
const showPricing = computed(() => isTransparencyClient.value && POST_PI_SET.has(props.order?.status))
// Show pricing in pending section when any pending item has a price set
const showPendingPricing = computed(() =>
  pendingAdditions.value.some(i => i.client_factory_price || i.factory_price || i.selling_price_inr)
)

// Active items
const activeItems = computed(() => (items.value || []).filter(i => i.status === 'ACTIVE'))
const confirmedItems = computed(() =>
  activeItems.value.filter(i => !i.pi_item_status || i.pi_item_status === 'APPROVED')
)
const pendingAdditions = computed(() =>
  activeItems.value.filter(i => i.pi_item_status === 'PENDING')
)
const clientConfirmedItems = computed(() =>
  activeItems.value.filter(i => i.pi_item_status === 'CONFIRMED')
)
const rejectedAdditions = computed(() =>
  activeItems.value.filter(i => i.pi_item_status === 'REJECTED')
)
const pendingByLot = computed(() => {
  const groups = {}
  for (const item of pendingAdditions.value) {
    const lot = item.pi_addition_lot || 1
    if (!groups[lot]) groups[lot] = []
    groups[lot].push(item)
  }
  return Object.entries(groups).map(([lot, items]) => ({ lot: Number(lot), items }))
})
const isMidOrderStage = computed(() =>
  ['FACTORY_ORDERED', 'PRODUCTION_60', 'PRODUCTION_80', 'PRODUCTION_90'].includes(props.order?.status)
)

// Lot color palette for approved additions
const LOT_COLORS = [
  { bg: 'bg-emerald-50/80', hover: 'hover:bg-emerald-100/70', border: 'border-l-emerald-400', badge: 'bg-emerald-100 text-emerald-700' },
  { bg: 'bg-sky-50/80', hover: 'hover:bg-sky-100/70', border: 'border-l-sky-400', badge: 'bg-sky-100 text-sky-700' },
  { bg: 'bg-violet-50/80', hover: 'hover:bg-violet-100/70', border: 'border-l-violet-400', badge: 'bg-violet-100 text-violet-700' },
  { bg: 'bg-pink-50/80', hover: 'hover:bg-pink-100/70', border: 'border-l-pink-400', badge: 'bg-pink-100 text-pink-700' },
  { bg: 'bg-amber-50/80', hover: 'hover:bg-amber-100/70', border: 'border-l-amber-400', badge: 'bg-amber-100 text-amber-700' },
]
function getLotColor(lot) {
  if (!lot) return LOT_COLORS[0]
  return LOT_COLORS[(lot - 1) % LOT_COLORS.length]
}
function getLotRowClass(item) {
  const c = getLotColor(item.pi_addition_lot)
  return `${c.bg} ${c.hover} border-l-4 ${c.border}`
}

// ========================================
// Carried items detection
// Uses carry_forward_label (survives role filter)
// Falls back to notes for admin users
// ========================================
function getCarryForwardInfo(item) {
  const label = item.carry_forward_label || item.notes || ''
  if (!label) return null
  const ulMatch = label.match(/^Carried from (ORD-\S+|previous order)/)
  if (ulMatch) return { type: 'unloaded', from: ulMatch[1] }
  const asMatch = label.match(/^After-Sales.*from (ORD-\S+)/)
  if (asMatch) {
    const isBalance = label.includes('Reduct Balance') || label.includes('Compensat')
    return { type: 'aftersales', resolution: isBalance ? 'balance' : 'replace', from: asMatch[1] }
  }
  return null
}

const carriedItems = computed(() => activeItems.value.filter(i => getCarryForwardInfo(i)))
const unloadedCarried = computed(() => carriedItems.value.filter(i => getCarryForwardInfo(i)?.type === 'unloaded'))
const aftersalesCarried = computed(() => carriedItems.value.filter(i => getCarryForwardInfo(i)?.type === 'aftersales'))

function getCarriedRowClass(item) {
  const info = getCarryForwardInfo(item)
  if (!info) return ''
  if (info.type === 'aftersales') return 'bg-rose-50/80 hover:bg-rose-100/70 border-l-4 border-l-rose-400'
  return 'bg-amber-50/80 hover:bg-amber-100/70 border-l-4 border-l-amber-400'
}

function getAfterSalesLabel(item) {
  const info = getCarryForwardInfo(item)
  if (!info || info.type !== 'aftersales') return 'After-Sales'
  if (info.resolution === 'balance') return 'After-Sales \u2022 Reduct Balance'
  return 'After-Sales \u2022 Replace'
}

const aftersalesProductIds = computed(() => new Set(aftersalesCarried.value.map(i => i.product_id)))
function hasAfterSalesTwin(item) {
  if (getCarryForwardInfo(item)) return false
  return aftersalesProductIds.value.has(item.product_id)
}

// Sorted items: carried → regular → mid-order approved (at bottom)
const sortedItems = computed(() => {
  const carried = confirmedItems.value.filter(i => getCarryForwardInfo(i))
  const midOrder = confirmedItems.value.filter(i => !getCarryForwardInfo(i) && i.pi_item_status === 'APPROVED')
  const regular = confirmedItems.value.filter(i => !getCarryForwardInfo(i) && i.pi_item_status !== 'APPROVED')
  const sortFn = (a, b) => {
    let va = a[sortKey.value] || ''
    let vb = b[sortKey.value] || ''
    if (typeof va === 'string') va = va.toLowerCase()
    if (typeof vb === 'string') vb = vb.toLowerCase()
    if (va < vb) return sortOrder.value === 'asc' ? -1 : 1
    if (va > vb) return sortOrder.value === 'asc' ? 1 : -1
    return 0
  }
  carried.sort(sortFn)
  regular.sort(sortFn)
  midOrder.sort(sortFn)
  return [...carried, ...regular, ...midOrder]
})

function toggleSort(col) {
  if (sortKey.value === col) sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  else { sortKey.value = col; sortOrder.value = 'asc' }
}

// ========================================
// Data Loading
// ========================================
async function loadItems() {
  loading.value = true
  try {
    const { data } = await ordersApi.get(props.orderId)
    items.value = data.items || []
  } catch (err) { console.error('Failed to load order items:', err) }
  loading.value = false
}
onMounted(() => { loadItems(); loadAllQueries(); loadInlineStatus() })

// ========================================
// Image Viewer Lightbox (scroll-zoom + drag-pan)
// ========================================
const viewerImage = ref(null)
const viewerLabel = ref('')
const viewerZoom = ref(1)
const viewerPan = ref({ x: 0, y: 0 })
const isDraggingViewer = ref(false)
const viewerDragStart = ref({ x: 0, y: 0 })

function openImageViewer(url, label) {
  viewerImage.value = url
  viewerLabel.value = label || ''
  viewerZoom.value = 1
  viewerPan.value = { x: 0, y: 0 }
  window.addEventListener('keydown', onViewerKeydown)
}
function closeImageViewer() {
  viewerImage.value = null
  isDraggingViewer.value = false
  window.removeEventListener('keydown', onViewerKeydown)
}
function onViewerKeydown(e) { if (e.key === 'Escape') closeImageViewer() }
function onViewerWheel(e) {
  e.preventDefault()
  viewerZoom.value = Math.min(Math.max(viewerZoom.value + (e.deltaY > 0 ? -0.15 : 0.15), 0.25), 8)
}
function onViewerMouseDown(e) {
  if (viewerZoom.value <= 1) return
  isDraggingViewer.value = true
  viewerDragStart.value = { x: e.clientX - viewerPan.value.x, y: e.clientY - viewerPan.value.y }
}
function onViewerMouseMove(e) {
  if (!isDraggingViewer.value) return
  viewerPan.value = { x: e.clientX - viewerDragStart.value.x, y: e.clientY - viewerDragStart.value.y }
}
function onViewerMouseUp() { isDraggingViewer.value = false }

function getItemImageUrl(item) {
  const path = item.factory_image_path
  if (path) return `/api/products/file/?path=${encodeURIComponent(path)}`
  return null
}

// Build an authenticated URL for a query attachment.
// att format stored in DB: orders/{order_id}/queries/{query_id}/{filename}
function attUrl(att) {
  const p = att.split('/')
  return `/api/orders/${p[1]}/queries/${p[3]}/attachments/${p[4]}`
}

// ========================================
// ========================================
// Item Query Panel
// ========================================
const showQueryPanel = ref(false)
const queryPanelItem = ref(null)
const queryPanelQueries = ref([])
const queryPanelLoading = ref(false)
const newQueryType = ref('GENERAL')
const newQuerySubject = ref('')
const newQueryMessage = ref('')

function onQueryTypeChange() {
  const auto = {
    PHOTO_REQUEST: 'Please share product photos',
    VIDEO_REQUEST: 'Please share product video',
    DIMENSION_CHECK: 'Need dimension details',
    QUALITY_QUERY: 'Quality question',
    ALTERNATIVE: 'Looking for alternative',
  }
  newQuerySubject.value = auto[newQueryType.value] || ''
}
const creatingQuery = ref(false)
const replyingTo = ref(null)
const replyMessage = ref('')
const sendingReply = ref(false)

const QUERY_TYPE_LABELS = {
  PHOTO_REQUEST: { label: 'Photo Request', icon: 'pi-camera', color: 'text-blue-600' },
  VIDEO_REQUEST: { label: 'Video Request', icon: 'pi-video', color: 'text-purple-600' },
  DIMENSION_CHECK: { label: 'Dimension Check', icon: 'pi-arrows-alt', color: 'text-amber-600' },
  QUALITY_QUERY: { label: 'Quality Query', icon: 'pi-star', color: 'text-emerald-600' },
  ALTERNATIVE: { label: 'Alternative', icon: 'pi-sync', color: 'text-indigo-600' },
  GENERAL: { label: 'General', icon: 'pi-comment', color: 'text-slate-600' },
}

const allItemQueries = ref([])
const inlineQueryStatus = ref({})
const inlineQueryInput = ref({})
const inlineSending = ref({})
const showQueryColumn = ref(false)

async function loadAllQueries() {
  try {
    const { data } = await queriesApi.list(props.orderId)
    allItemQueries.value = data
  } catch (e) { console.error(e) }
}

async function loadInlineStatus() {
  try {
    const { data } = await queriesApi.inlineStatus(props.orderId)
    inlineQueryStatus.value = data
    if (Object.keys(data).length > 0) showQueryColumn.value = true
  } catch (e) { console.error(e) }
}

async function sendInlineQuery(item) {
  const text = (inlineQueryInput.value[item.id] || '').trim()
  if (!text) return
  inlineSending.value = { ...inlineSending.value, [item.id]: true }
  try {
    await queriesApi.inlineQuery(props.orderId, item.id, text)
    inlineQueryInput.value = { ...inlineQueryInput.value, [item.id]: '' }
    await loadInlineStatus()
    await loadAllQueries()
  } catch (e) { console.error(e) }
  inlineSending.value = { ...inlineSending.value, [item.id]: false }
}

function getItemQueryStatus(itemId) {
  const s = inlineQueryStatus.value[itemId]
  if (!s) return null
  if (s.status === 'OPEN' || s.status === 'REPLIED') return 'OPEN'
  return 'RESOLVED'
}

function getItemQueryCounts(itemId) {
  const qs = allItemQueries.value.filter(q => q.order_item_id === itemId)
  const open = qs.filter(q => q.status === 'OPEN' || q.status === 'REPLIED').length
  const resolved = qs.filter(q => q.status === 'RESOLVED').length
  return { open, resolved, total: qs.length }
}

async function refreshPanelQueries() {
  const { data } = await queriesApi.list(props.orderId, { order_item_id: queryPanelItem.value?.id })
  queryPanelQueries.value = data
  await loadAllQueries()
}

const showNewQueryForm = ref(true)

async function openQueryPanel(item) {
  queryPanelItem.value = item
  selectedThread.value = null
  showQueryPanel.value = true
  queryPanelLoading.value = true
  try {
    await refreshPanelQueries()
    showNewQueryForm.value = queryPanelQueries.value.length === 0
    if (queryPanelQueries.value.length === 1) {
      await openThreadDetail(queryPanelQueries.value[0])
    }
  } catch (e) { console.error(e) }
  queryPanelLoading.value = false
}

function openNewQueryForItem(item) {
  queryPanelItem.value = item
  showQueryPanel.value = true
  showNewQueryForm.value = true
  selectedThread.value = null
  queryPanelLoading.value = true
  refreshPanelQueries().finally(() => { queryPanelLoading.value = false })
}

// Thread detail view
const selectedThread = ref(null)
const threadReplyMessage = ref('')
const threadSendingReply = ref(false)
const threadUploadingFile = ref(false)
const threadFileInput = ref(null)
const chatContainerRef = ref(null)

function scrollChatToBottom() {
  nextTick(() => {
    if (chatContainerRef.value) {
      chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight
    }
  })
}

async function openThreadDetail(query) {
  selectedThread.value = query
  showNewQueryForm.value = false
  scrollChatToBottom()
  try {
    const { data } = await queriesApi.get(props.orderId, query.id)
    selectedThread.value = data
    scrollChatToBottom()
  } catch (e) { /* keep initial */ }
}

// Auto-scroll when new messages arrive
watch(() => selectedThread.value?.messages?.length, () => scrollChatToBottom())

async function sendThreadReply() {
  if (!threadReplyMessage.value.trim() || !selectedThread.value) return
  threadSendingReply.value = true
  try {
    await queriesApi.reply(props.orderId, selectedThread.value.id, { message: threadReplyMessage.value })
    threadReplyMessage.value = ''
    const { data } = await queriesApi.get(props.orderId, selectedThread.value.id)
    selectedThread.value = data
    scrollChatToBottom()
    await loadInlineStatus()
    await loadAllQueries()
  } catch (e) { console.error(e) }
  threadSendingReply.value = false
}

async function onThreadFileSelect(e) {
  const file = e.target.files?.[0]
  if (!file || !selectedThread.value) return
  threadUploadingFile.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    await queriesApi.replyWithAttachment(props.orderId, selectedThread.value.id, formData, threadReplyMessage.value || '')
    threadReplyMessage.value = ''
    const { data } = await queriesApi.get(props.orderId, selectedThread.value.id)
    selectedThread.value = data
    await loadInlineStatus()
  } catch (e) { console.error(e) }
  threadUploadingFile.value = false
  if (threadFileInput.value) threadFileInput.value.value = ''
}

function isImageAtt(path) { return /\.(jpe?g|png|gif|webp)$/i.test(path || '') }
function isVideoAtt(path) { return /\.(mp4|webm|mov)$/i.test(path || '') }
function getInitials(name) {
  if (!name) return '?'
  const parts = name.split(/[@\s.]/).filter(Boolean)
  return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : parts[0]?.slice(0, 2).toUpperCase() || '?'
}
function getAgeText(dateStr) {
  if (!dateStr) return ''
  const ms = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

async function createQuery() {
  if (!newQuerySubject.value.trim()) return
  const msg = newQueryMessage.value.trim() || newQuerySubject.value
  creatingQuery.value = true
  try {
    await queriesApi.create(props.orderId, {
      order_item_id: queryPanelItem.value?.id,
      product_id: queryPanelItem.value?.product_id,
      query_type: newQueryType.value,
      subject: newQuerySubject.value,
      message: msg,
    })
    newQuerySubject.value = ''
    newQueryMessage.value = ''
    newQueryType.value = 'GENERAL'
    await refreshPanelQueries()
    showNewQueryForm.value = false  // Switch to threads view
    await loadInlineStatus()
  } catch (e) { console.error(e) }
  creatingQuery.value = false
}

async function sendQueryReply(queryId) {
  if (!replyMessage.value.trim()) return
  sendingReply.value = true
  try {
    await queriesApi.reply(props.orderId, queryId, { message: replyMessage.value })
    replyMessage.value = ''
    replyingTo.value = null
    await refreshPanelQueries()
  } catch (e) { console.error(e) }
  sendingReply.value = false
}

async function resolveQuery(queryId) {
  try {
    await queriesApi.resolve(props.orderId, queryId)
    await refreshPanelQueries()
  } catch (e) { console.error(e) }
}

async function reopenQuery(queryId) {
  try {
    await queriesApi.reopen(props.orderId, queryId)
    if (selectedThread.value?.id === queryId) {
      const { data } = await queriesApi.get(props.orderId, queryId)
      selectedThread.value = data
    }
    await refreshPanelQueries()
    await loadInlineStatus()
    await loadAllQueries()
  } catch (e) { console.error(e) }
}

// ========================================
// Bulk Confirm / Reject all pending items
// ========================================
const bulkConfirming = ref(false)
const showConfirmDialog = ref(false)
const confirmDialogAction = ref('')

function bulkConfirmPending(action) {
  if (!pendingAdditions.value.length) return
  confirmDialogAction.value = action
  showConfirmDialog.value = true
}

async function executeBulkConfirm() {
  const action = confirmDialogAction.value
  showConfirmDialog.value = false
  bulkConfirming.value = true
  try {
    await ordersApi.bulkConfirmItems(props.orderId, action)
    await loadItems()
    emit('reload')
  } catch (e) {
    console.error('Failed to bulk confirm items:', e)
  }
  bulkConfirming.value = false
}

// ========================================
// Add Item Modal
// ========================================
const showAddModal = ref(false)
const addSearch = ref('')
const addCategory = ref('')
const addResults = ref([])
const addSearching = ref(false)
const addPage = ref(1)
const addTotal = ref(0)
const addPerPage = ref(50)
const addSortKey = ref('product_code')
const addSortOrder = ref('asc')
const addCategories = ref([])
let addTimer = null

// IDs of products already in this order
const existingProductIds = computed(() => new Set(activeItems.value.map(i => i.product_id)))

function openAddModal() {
  showAddModal.value = true
  addSearch.value = ''
  addCategory.value = ''
  addPage.value = 1
  loadAddProducts()
  loadAddCategories()
}

async function loadAddCategories() {
  try {
    const { data } = await productsApi.categories()
    addCategories.value = Array.isArray(data) ? data : []
  } catch (_) { addCategories.value = [] }
}

async function loadAddProducts() {
  addSearching.value = true
  try {
    const params = { page: addPage.value, per_page: addPerPage.value }
    if (addSearch.value.trim()) params.search = addSearch.value.trim()
    if (addCategory.value) params.category = addCategory.value
    const { data } = await productsApi.list(params)
    const raw = data.items || data.products || (Array.isArray(data) ? data : [])
    const flat = []
    for (const item of raw) {
      if (item.variants && item.parent) {
        const v = item.variants.find(v => v.is_default) || item.variants[0]
        if (v) flat.push(v)
      } else flat.push(item)
    }
    addResults.value = flat
    addTotal.value = data.total || 0
  } catch (_) { addResults.value = [] }
  addSearching.value = false
}

function onAddSearch() {
  clearTimeout(addTimer)
  addPage.value = 1
  addTimer = setTimeout(loadAddProducts, 300)
}

function onAddCategoryChange() {
  addPage.value = 1
  loadAddProducts()
}

function toggleAddSort(key) {
  if (addSortKey.value === key) {
    addSortOrder.value = addSortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    addSortKey.value = key
    addSortOrder.value = 'asc'
  }
}

const addTotalPages = computed(() => Math.ceil(addTotal.value / addPerPage.value))

function onPerPageChange() {
  addPage.value = 1
  loadAddProducts()
}

// Client-side sort only (filtering is server-side via search + category)
const sortedAddResults = computed(() => {
  const results = [...addResults.value]
  const key = addSortKey.value
  const dir = addSortOrder.value === 'asc' ? 1 : -1
  results.sort((a, b) => {
    const va = (a[key] || '').toString().toLowerCase()
    const vb = (b[key] || '').toString().toLowerCase()
    return va < vb ? -dir : va > vb ? dir : 0
  })
  return results
})

async function addItem(product) {
  if (existingProductIds.value.has(product.id)) return
  try {
    await ordersApi.addItems(props.orderId, { items: [{ product_id: product.id, quantity: 1 }] })
    loadItems()
    loadAddProducts()
    emit('reload')
  } catch (err) { console.error('Failed to add item:', err) }
}

// ========================================
// Bulk Add Modal
// ========================================
const showBulkModal = ref(false)
const bulkText = ref('')
const bulkAdding = ref(false)

const bulkError = ref('')
const bulkPreviewResults = ref([])
const bulkPreviewStep = ref(false)  // false=input, true=preview
const bulkDupeResolutions = ref({})

async function bulkPreview() {
  if (!bulkText.value.trim()) return
  bulkAdding.value = true
  bulkError.value = ''
  bulkDupeResolutions.value = {}
  try {
    const lines = bulkText.value.trim().split('\n').filter(l => l.trim())
    const { data } = await ordersApi.bulkTextAddPreview(props.orderId, lines)
    bulkPreviewResults.value = data.items || data.results || []
    const hasDupes = bulkPreviewResults.value.some(r => r.status === 'ALREADY_IN_ORDER')
    const hasFound = bulkPreviewResults.value.some(r => r.status === 'FOUND')
    if (hasDupes || hasFound) {
      bulkPreviewStep.value = true
    } else {
      const notFound = bulkPreviewResults.value.filter(i => i.status === 'NOT_FOUND')
      bulkError.value = notFound.length ? `Not found: ${notFound.map(i => i.code).join(', ')}` : 'No matching products found'
    }
  } catch (err) {
    bulkError.value = err.response?.data?.detail || 'Failed to preview'
  }
  bulkAdding.value = false
}

function resolveBulkDupe(idx, action) {
  bulkDupeResolutions.value = { ...bulkDupeResolutions.value, [idx]: action }
}

const bulkApplyItems = computed(() => {
  const found = bulkPreviewResults.value.filter(r => r.status === 'FOUND')
  const resolved = bulkPreviewResults.value
    .map((r, idx) => ({ ...r, _idx: idx }))
    .filter(r => r.status === 'ALREADY_IN_ORDER' && bulkDupeResolutions.value[r._idx])
    .filter(r => bulkDupeResolutions.value[r._idx] !== 'keep_existing')
    .map(r => ({ ...r, _resolution: bulkDupeResolutions.value[r._idx] }))
  return [...found, ...resolved]
})

async function bulkApply() {
  if (bulkApplyItems.value.length === 0) return
  bulkAdding.value = true
  try {
    const newItems = bulkApplyItems.value.filter(r => !r._resolution)
    const dupeItems = bulkApplyItems.value.filter(r => r._resolution)
    if (newItems.length > 0) {
      await ordersApi.bulkTextAddApply(props.orderId, newItems)
    }
    for (const r of dupeItems) {
      const existing = (items.value || []).find(i => i.product_id === r.product_id && i.status === 'ACTIVE')
      if (!existing) continue
      if (r._resolution === 'club') {
        await ordersApi.updateItem(props.orderId, existing.id, { quantity: (existing.quantity || 0) + r.quantity })
      } else if (r._resolution === 'keep_new') {
        await ordersApi.updateItem(props.orderId, existing.id, { quantity: r.quantity })
      }
    }
    showBulkModal.value = false; bulkText.value = ''
    bulkPreviewStep.value = false; bulkPreviewResults.value = []
    loadItems(); emit('reload')
  } catch (err) {
    bulkError.value = err.response?.data?.detail || 'Failed to add items'
  }
  bulkAdding.value = false
}

// ========================================
// Fetch Pending Items
// ========================================
const fetchingPending = ref(false)
const pendingResult = ref(null)

async function fetchPending() {
  fetchingPending.value = true
  try {
    const { data } = await ordersApi.fetchPendingItems(props.orderId)
    pendingResult.value = data
    loadItems(); emit('reload')
  } catch (err) { console.error('Fetch pending failed:', err) }
  fetchingPending.value = false
}

// ========================================
// Edit Quantity + Remove
// ========================================
async function updateQty(item, newQty) {
  const qty = parseInt(newQty) || 1
  if (qty < 1 || qty === item.quantity) return
  try { await ordersApi.updateItem(props.orderId, item.id, { quantity: qty }); loadItems() }
  catch (err) { console.error('Failed to update quantity:', err) }
}

async function removeItem(item) {
  if (!confirm(`Remove "${item.product_name_snapshot || item.product_code_snapshot || 'this item'}" from this order?`)) return
  try { await ordersApi.removeItem(props.orderId, item.id); loadItems(); emit('reload') }
  catch (err) { console.error('Failed to remove item:', err) }
}

// Upload Excel
const fileInput = ref(null)
function triggerUpload() { fileInput.value?.click() }
async function onFileSelected(event) {
  const file = event.target.files?.[0]
  if (!file) return
  try { await ordersApi.parsePriceExcel(props.orderId, file); loadItems(); emit('reload') }
  catch (err) { console.error('Excel upload failed:', err) }
  event.target.value = ''
}
</script>

<template>
  <div>
    <!-- Carried Items Banner (same as admin) -->
    <div v-if="carriedItems.length > 0" class="mb-4 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3 text-sm">
      <i class="pi pi-replay text-slate-500" />
      <span class="text-slate-700 font-medium">{{ carriedItems.length }} items carried from previous orders:</span>
      <span v-if="unloadedCarried.length" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
        <i class="pi pi-inbox text-[8px]" /> {{ unloadedCarried.length }} Unloaded
      </span>
      <span v-if="aftersalesCarried.length" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-700">
        <i class="pi pi-exclamation-triangle text-[8px]" /> {{ aftersalesCarried.length }} After-Sales
      </span>
    </div>

    <!-- Toolbar (admin-style colored buttons) -->
    <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
      <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider">
        Order Items ({{ confirmedItems.length }})
      </h3>
      <div class="flex items-center gap-2 flex-wrap">
        <button @click="loadItems"
          class="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1">
          <i class="pi pi-refresh text-[10px]" :class="{ 'pi-spin': loading }" /> Refresh
        </button>
        <button v-if="canAdd" @click="openAddModal"
          class="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1">
          <i class="pi pi-plus text-[10px]" /> Add Item
        </button>
        <button v-if="canBulkAdd" @click="showBulkModal = true"
          class="px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors flex items-center gap-1">
          <i class="pi pi-list text-[10px]" /> Bulk Add
        </button>
        <button v-if="canFetchPending && order.factory_id" @click="fetchPending" :disabled="fetchingPending"
          class="px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors disabled:opacity-50 flex items-center gap-1">
          <i :class="fetchingPending ? 'pi pi-spin pi-spinner' : 'pi pi-download'" class="text-[10px]" /> Fetch Pending Items
        </button>
        <button v-if="canUploadExcel" @click="triggerUpload"
          class="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-1">
          <i class="pi pi-file-excel text-[10px]" /> Upload Excel
        </button>
        <input ref="fileInput" type="file" accept=".xlsx,.xls" class="hidden" @change="onFileSelected" />
        <button v-if="canEditItems" @click="isEditing = !isEditing"
          class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
          :class="isEditing
            ? 'text-white bg-amber-500 border border-amber-600 hover:bg-amber-600'
            : 'text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100'">
          <i :class="isEditing ? 'pi pi-check' : 'pi pi-pencil'" class="text-[10px]" />
          {{ isEditing ? 'Done' : 'Edit Items' }}
        </button>
        <button @click="showQueryColumn = !showQueryColumn; if (showQueryColumn) loadInlineStatus()"
          class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
          :class="showQueryColumn ? 'text-white bg-teal-600 border border-teal-700 hover:bg-teal-700' : 'text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100'">
          <i class="pi pi-comments text-[10px]" />
          Queries
          <span v-if="Object.values(inlineQueryStatus).filter(s => s.status === 'OPEN').length" class="ml-0.5 text-[9px]">({{ Object.values(inlineQueryStatus).filter(s => s.status === 'OPEN').length }})</span>
        </button>
      </div>
    </div>

    <!-- Pending Result Banner -->
    <div v-if="pendingResult" class="mx-6 mt-3 p-3 rounded-lg text-sm flex items-center gap-2"
      :class="(pendingResult.carried_aftersales?.length || 0) + (pendingResult.carried_items?.length || 0) > 0
        ? 'bg-teal-50 border border-teal-200 text-teal-800'
        : 'bg-slate-50 border border-slate-200 text-slate-600'">
      <i class="pi pi-check-circle text-teal-600" />
      {{ (pendingResult.carried_aftersales?.length || 0) + (pendingResult.carried_items?.length || 0) }} items carried forward
      <button @click="pendingResult = null" class="ml-auto text-teal-600 hover:text-teal-800"><i class="pi pi-times text-xs" /></button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="py-12 text-center text-slate-400">
      <i class="pi pi-spinner pi-spin text-2xl" />
    </div>

    <!-- Empty State -->
    <div v-else-if="activeItems.length === 0" class="py-12 text-center">
      <i class="pi pi-inbox text-4xl text-slate-300 mb-3" />
      <p class="text-sm text-slate-500">No items in this order</p>
      <button v-if="canAdd" @click="openAddModal" class="mt-3 px-4 py-2 text-sm text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-50">
        <i class="pi pi-plus mr-1" /> Add your first item
      </button>
    </div>

    <!-- Pending Additions (single group — lot assigned on approval) -->
    <div v-if="pendingAdditions.length > 0 || rejectedAdditions.length > 0" class="mx-0 mb-4">
      <div class="bg-white rounded-xl shadow-sm overflow-hidden border-2 border-amber-300">
        <div class="px-6 py-3 border-b border-amber-200 bg-amber-50 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-2">
            <i class="pi pi-clock text-amber-600" />
            Pending Additions ({{ pendingAdditions.length }})
            <span v-if="pendingAdditions.every(i => i.selling_price_inr || i.client_factory_price || i.factory_price)"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium bg-indigo-100 text-indigo-700 ml-1">
              Priced — Review &amp; Confirm
            </span>
            <span v-else class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium bg-slate-100 text-slate-500 ml-1">
              Awaiting Pricing
            </span>
          </h3>
          <div class="flex items-center gap-2">
            <button v-if="canAdd" @click="openAddModal"
              class="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-300 rounded-lg hover:bg-amber-200 transition-colors flex items-center gap-1">
              <i class="pi pi-plus text-[10px]" /> Add Item
            </button>
            <button v-if="pendingAdditions.some(i => i.selling_price_inr || i.client_factory_price || i.factory_price)"
              @click="bulkConfirmPending('approve')" :disabled="bulkConfirming"
              class="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors flex items-center gap-1">
              <i :class="bulkConfirming ? 'pi pi-spin pi-spinner' : 'pi pi-check-circle'" class="text-[10px]" /> Accept Prices
            </button>
            <button v-if="pendingAdditions.length > 0"
              @click="bulkConfirmPending('reject')" :disabled="bulkConfirming"
              class="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors flex items-center gap-1">
              <i class="pi pi-times-circle text-[10px]" /> Reject All
            </button>
          </div>
        </div>
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-amber-50/50 border-b border-amber-100">
              <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase w-10">#</th>
              <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Code</th>
              <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Product</th>
              <th class="text-center px-4 py-2 text-xs font-semibold text-slate-500 uppercase w-20">Qty</th>
              <th v-if="showPendingPricing" class="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Factory ({{ order.currency }})</th>
              <th v-if="showPendingPricing" class="text-right px-4 py-2 text-xs font-semibold text-emerald-600 uppercase">Price (INR)</th>
              <th class="text-center px-4 py-2 text-xs font-semibold text-slate-500 uppercase w-12"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-amber-100">
            <tr v-for="(item, i) in pendingAdditions" :key="item.id" class="hover:bg-amber-50/50">
              <td class="px-4 py-2 text-xs text-slate-400">{{ i + 1 }}</td>
              <td class="px-4 py-2 font-mono text-xs text-slate-800">{{ item.product_code }}</td>
              <td class="px-4 py-2 text-sm text-slate-700">
                {{ item.product_name }}
                <span v-if="item.part_type || item.dimension || item.material" class="text-xs text-slate-400 ml-1">({{ [item.part_type, item.dimension, item.material].filter(Boolean).join(' · ') }})</span>
              </td>
              <td class="px-4 py-2 text-center font-medium text-slate-700">
                <input type="number" :value="item.quantity" min="1"
                  @change="updateQty(item, $event.target.value)"
                  class="w-16 text-center text-sm border border-slate-200 rounded px-1 py-0.5 focus:border-indigo-300 focus:ring-1 focus:ring-indigo-200" />
              </td>
              <td v-if="showPendingPricing" class="px-4 py-2 text-right text-sm text-slate-600">{{ item.client_factory_price ?? item.factory_price ?? '—' }}</td>
              <td v-if="showPendingPricing" class="px-4 py-2 text-right text-sm text-emerald-700 font-medium">
                <template v-if="isTransparencyClient && (item.client_factory_price || item.factory_price) && order.exchange_rate">
                  {{ '\u20B9' + (Number(item.client_factory_price ?? item.factory_price) * Number(order.exchange_rate)).toFixed(2) }}
                </template>
                <template v-else-if="item.selling_price_inr">
                  {{ '\u20B9' + Number(item.selling_price_inr).toFixed(2) }}
                </template>
                <template v-else>—</template>
              </td>
              <td class="px-4 py-2 text-center">
                <button @click="removeItem(item)" title="Remove item"
                  class="px-1.5 py-1 text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                  <i class="pi pi-trash text-[11px]" />
                </button>
              </td>
            </tr>
            <tr class="bg-amber-50 border-t-2 border-amber-200 font-semibold">
              <td class="px-4 py-2" colspan="3"></td>
              <td class="px-4 py-2 text-center text-sm text-slate-700">{{ pendingAdditions.reduce((s, i) => s + (i.quantity || 0), 0) }} pcs</td>
              <td v-if="showPendingPricing" class="px-4 py-2 text-right text-sm text-slate-700">
                ${{ pendingAdditions.reduce((s, i) => s + (Number(i.client_factory_price ?? i.factory_price ?? 0) * (i.quantity || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </td>
              <td v-if="showPendingPricing" class="px-4 py-2 text-right text-sm text-emerald-700">
                &#8377;{{ pendingAdditions.reduce((s, i) => {
                  const price = isTransparencyClient ? (Number(i.client_factory_price ?? i.factory_price ?? 0) * Number(order.exchange_rate || 0)) : Number(i.selling_price_inr || 0)
                  return s + price * (i.quantity || 0)
                }, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </td>
              <td class="px-4 py-2"></td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- Rejected items -->
      <div v-if="rejectedAdditions.length > 0" class="border-t border-amber-200">
        <div class="px-6 py-2 bg-slate-50">
          <span class="text-xs font-medium text-slate-500 uppercase">Rejected ({{ rejectedAdditions.length }})</span>
        </div>
        <table class="w-full text-sm">
          <tbody class="divide-y divide-slate-100">
            <tr v-for="(item, i) in rejectedAdditions" :key="item.id" class="opacity-30">
              <td class="px-4 py-2 text-xs text-slate-400">{{ i + 1 }}</td>
              <td class="px-4 py-2 font-mono text-slate-800">{{ item.product_code }}</td>
              <td class="px-4 py-2 text-slate-700">{{ item.product_name }}</td>
              <td class="px-4 py-2 text-center text-slate-700">{{ item.quantity }}</td>
              <td class="px-4 py-2 text-center">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">Rejected</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Client Confirmed — Awaiting Admin Approval -->
    <div v-if="clientConfirmedItems.length > 0" class="mx-0 mb-4">
      <div class="bg-white rounded-xl shadow-sm overflow-hidden border-2 border-indigo-300">
        <div class="px-6 py-3 border-b border-indigo-200 bg-indigo-50 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-indigo-800 uppercase tracking-wider flex items-center gap-2">
            <i class="pi pi-check-circle text-indigo-600" />
            Prices Accepted ({{ clientConfirmedItems.length }})
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium bg-indigo-100 text-indigo-700">
              Awaiting Final Approval
            </span>
          </h3>
        </div>
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-indigo-50/50 border-b border-indigo-100">
              <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase w-10">#</th>
              <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Code</th>
              <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Product</th>
              <th class="text-center px-4 py-2 text-xs font-semibold text-slate-500 uppercase w-16">Qty</th>
              <th class="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Factory ({{ order.currency }})</th>
              <th class="text-right px-4 py-2 text-xs font-semibold text-emerald-600 uppercase">Price (INR)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-indigo-100">
            <tr v-for="(item, i) in clientConfirmedItems" :key="item.id" class="hover:bg-indigo-50/30">
              <td class="px-4 py-2 text-xs text-slate-400">{{ i + 1 }}</td>
              <td class="px-4 py-2 font-mono text-xs text-slate-800">{{ item.product_code }}</td>
              <td class="px-4 py-2 text-sm text-slate-700">{{ item.product_name }}</td>
              <td class="px-4 py-2 text-center font-medium text-slate-700">{{ item.quantity }}</td>
              <td class="px-4 py-2 text-right text-sm text-slate-600">{{ item.client_factory_price ?? item.factory_price ?? '—' }}</td>
              <td class="px-4 py-2 text-right text-sm text-emerald-700 font-medium">
                <template v-if="isTransparencyClient && (item.client_factory_price || item.factory_price) && order.exchange_rate">
                  {{ '\u20B9' + (Number(item.client_factory_price ?? item.factory_price) * Number(order.exchange_rate)).toFixed(2) }}
                </template>
                <template v-else-if="item.selling_price_inr">
                  {{ '\u20B9' + Number(item.selling_price_inr).toFixed(2) }}
                </template>
                <template v-else>—</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Items Table (admin-style) -->
    <table v-if="!loading && confirmedItems.length > 0" class="w-full text-sm">
      <thead>
        <tr class="border-b border-slate-200">
          <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase w-10">#</th>
          <th class="text-center px-1 py-2 text-xs font-semibold text-slate-500 uppercase w-12">Img</th>
          <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700" @click="toggleSort('product_code')">
            Code
            <i v-if="sortKey === 'product_code'" :class="sortOrder === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'" class="text-[10px] ml-1 text-blue-500" />
            <i v-else class="pi pi-sort-alt text-[10px] ml-1 opacity-30" />
          </th>
          <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700" @click="toggleSort('product_name')">
            Product
            <i v-if="sortKey === 'product_name'" :class="sortOrder === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'" class="text-[10px] ml-1 text-blue-500" />
            <i v-else class="pi pi-sort-alt text-[10px] ml-1 opacity-30" />
          </th>
          <th class="text-center px-4 py-2 text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700 w-24" @click="toggleSort('quantity')">
            Qty
            <i v-if="sortKey === 'quantity'" :class="sortOrder === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'" class="text-[10px] ml-1 text-blue-500" />
            <i v-else class="pi pi-sort-alt text-[10px] ml-1 opacity-30" />
          </th>
          <th class="text-center px-2 py-2 text-xs font-semibold text-slate-500 uppercase w-28">Query</th>
          <template v-if="showPricing">
            <th class="text-right px-4 py-2 text-xs font-semibold text-amber-700 uppercase">Factory ({{ order.currency }})</th>
            <th class="text-right px-4 py-2 text-xs font-semibold text-emerald-600 uppercase">Price (INR)</th>
            <th class="text-right px-4 py-2 text-xs font-semibold text-slate-600 uppercase">Total (INR)</th>
          </template>
          <th v-if="showQueryColumn" class="text-left px-2 py-2 text-xs font-semibold text-teal-600 uppercase">Query / Reply</th>
          <th v-if="isEditing && canEditItems" class="text-center px-4 py-2 text-xs font-semibold text-slate-500 uppercase w-20"></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr v-for="(item, i) in sortedItems" :key="item.id"
          :class="getCarryForwardInfo(item) ? getCarriedRowClass(item) : item.pi_item_status === 'APPROVED' ? getLotRowClass(item) : 'hover:bg-slate-50'">
          <td class="px-4 py-2 text-xs text-slate-400">{{ i + 1 }}</td>
          <td class="px-1 py-1 text-center">
            <img v-if="getItemImageUrl(item)" :src="getItemImageUrl(item)"
              class="w-8 h-8 object-contain rounded border border-slate-200 cursor-pointer hover:ring-2 hover:ring-indigo-300 mx-auto"
              :alt="item.product_code" @click="openImageViewer(getItemImageUrl(item), (item.product_code_snapshot || item.product_code) + ' — ' + (item.product_name_snapshot || item.product_name))" />
            <span v-else class="text-slate-300 text-[10px]"><i class="pi pi-image" /></span>
          </td>
          <td class="px-4 py-2 text-sm font-mono text-slate-800">{{ item.product_code_snapshot || item.product_code || '—' }}</td>
          <td class="px-4 py-2 text-sm text-slate-700">
            {{ item.product_name_snapshot || item.product_name || '—' }}
            <span v-if="item.dimension_snapshot || item.material_snapshot" class="text-xs text-slate-400 ml-1">
              ({{ [item.part_type_snapshot, item.dimension_snapshot, item.material_snapshot].filter(Boolean).join(' \u00B7 ') }})
            </span>
            <!-- Mid-order addition badge -->
            <span v-if="item.pi_item_status === 'APPROVED'" :class="['inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium ml-1 whitespace-nowrap', getLotColor(item.pi_addition_lot).badge]" :title="'Added — Lot ' + (item.pi_addition_lot || 1)">
              <i class="pi pi-plus-circle text-[8px] mr-0.5" />Lot {{ item.pi_addition_lot || 1 }}
            </span>
            <!-- Carried badge (unloaded) -->
            <span v-else-if="getCarryForwardInfo(item)?.type === 'unloaded'" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 ml-2">
              <i class="pi pi-inbox text-[8px] mr-0.5" /> Carried from {{ getCarryForwardInfo(item).from }}
            </span>
            <!-- Carried badge (after-sales) -->
            <span v-else-if="getCarryForwardInfo(item)?.type === 'aftersales'" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-700 ml-2">
              <i class="pi pi-exclamation-triangle text-[8px] mr-0.5" /> {{ getAfterSalesLabel(item) }} from {{ getCarryForwardInfo(item).from }}
            </span>
            <!-- Also in after-sales badge -->
            <span v-else-if="hasAfterSalesTwin(item)" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 ml-2">
              <i class="pi pi-exclamation-triangle text-[8px] mr-0.5" /> Also in After-Sales
            </span>
            <button @click.stop="openQueryPanel(item)"
              class="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded transition-colors"
              :class="{
                'bg-red-100 text-red-700 hover:bg-red-200 ring-1 ring-red-300': getItemQueryStatus(item.id) === 'OPEN',
                'bg-emerald-50 text-emerald-700 hover:bg-emerald-100': getItemQueryStatus(item.id) === 'RESOLVED',
                'text-slate-400 hover:text-teal-600': !getItemQueryStatus(item.id),
              }"
              :title="getItemQueryStatus(item.id) === 'OPEN' ? `${getItemQueryCounts(item.id).open} open queries` : getItemQueryStatus(item.id) === 'RESOLVED' ? `${getItemQueryCounts(item.id).resolved} resolved` : 'Ask a question'">
              <i class="pi pi-comments text-[11px]" />
              <span v-if="getItemQueryCounts(item.id).open > 0" class="text-[10px] font-bold">{{ getItemQueryCounts(item.id).open }}</span>
              <span v-else-if="getItemQueryCounts(item.id).resolved > 0" class="text-[10px] font-bold">✓</span>
            </button>
            <span v-if="inlineQueryStatus[item.id]?.resolution_remark"
              class="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 ml-1 max-w-[120px] truncate"
              :title="inlineQueryStatus[item.id].resolution_remark">
              ✓ {{ inlineQueryStatus[item.id].resolution_remark }}
            </span>
          </td>
          <td class="px-4 py-2 text-center">
            <input v-if="isEditing && canEditQty && !getCarryForwardInfo(item)" type="number" :value="item.quantity"
              @change="updateQty(item, $event.target.value)" min="1"
              class="w-16 px-2 py-1 border border-amber-300 rounded text-center text-sm bg-amber-50 focus:ring-1 focus:ring-amber-400 focus:outline-none" />
            <span v-else class="text-sm font-medium text-slate-700">{{ item.quantity }}</span>
          </td>
          <!-- Query Status Column (clickable) -->
          <td class="px-2 py-2 text-center cursor-pointer"
            @click.stop="(getItemQueryCounts(item.id).open > 0 || getItemQueryCounts(item.id).resolved > 0 || inlineQueryStatus[item.id]) ? openQueryPanel(item) : openNewQueryForItem(item)">
            <template v-if="inlineQueryStatus[item.id]?.status === 'OPEN' || inlineQueryStatus[item.id]?.status === 'REPLIED'">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700 ring-1 ring-red-200 hover:bg-red-200 transition-colors">
                <span class="w-1.5 h-1.5 rounded-full bg-red-500 mr-1 animate-pulse" />
                {{ QUERY_TYPE_LABELS[inlineQueryStatus[item.id]?.query_type]?.label || 'OPEN' }}
              </span>
            </template>
            <template v-else-if="inlineQueryStatus[item.id]?.status === 'RESOLVED'">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 max-w-full truncate"
                :title="inlineQueryStatus[item.id]?.resolution_remark || 'Resolved'">
                <i class="pi pi-check text-[7px] mr-1 flex-shrink-0" />
                {{ inlineQueryStatus[item.id]?.resolution_remark || 'Resolved' }}
              </span>
            </template>
            <template v-else-if="getItemQueryCounts(item.id).open > 0">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700 ring-1 ring-red-200">
                <span class="w-1.5 h-1.5 rounded-full bg-red-500 mr-1 animate-pulse" />
                {{ QUERY_TYPE_LABELS[allItemQueries.find(q => q.order_item_id === item.id && q.status !== 'RESOLVED')?.query_type]?.label || 'OPEN' }}
              </span>
            </template>
            <template v-else-if="getItemQueryCounts(item.id).resolved > 0">
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 max-w-full truncate"
                :title="allItemQueries.find(q => q.order_item_id === item.id && q.status === 'RESOLVED')?.resolution_remark || 'Resolved'">
                <i class="pi pi-check text-[7px] mr-1 flex-shrink-0" />
                {{ allItemQueries.find(q => q.order_item_id === item.id && q.status === 'RESOLVED')?.resolution_remark || 'Resolved' }}
              </span>
            </template>
            <template v-else>
              <span class="text-[9px] text-teal-400 hover:text-teal-600 transition-colors">
                <i class="pi pi-plus text-[8px] mr-0.5" /> Ask
              </span>
            </template>
          </td>
          <!-- Pricing columns for transparency clients (post-PI) -->
          <template v-if="showPricing">
            <td class="px-4 py-2 text-right text-sm text-slate-600">
              {{ item.client_factory_price != null ? Number(item.client_factory_price).toFixed(2) : '—' }}
            </td>
            <td class="px-4 py-2 text-right text-sm text-emerald-700 font-medium">
              <template v-if="item.client_factory_price != null && order.exchange_rate">
                ₹{{ (Number(item.client_factory_price) * Number(order.exchange_rate)).toFixed(2) }}
              </template>
              <template v-else>—</template>
            </td>
            <td class="px-4 py-2 text-right text-sm font-semibold text-slate-700">
              <template v-if="item.client_factory_price != null && order.exchange_rate">
                ₹{{ (Number(item.client_factory_price) * Number(order.exchange_rate) * (Number(item.quantity) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </template>
              <template v-else>—</template>
            </td>
          </template>
          <!-- Inline Query Column -->
          <td v-if="showQueryColumn" class="px-2 py-1 align-top">
            <div class="space-y-1">
              <div v-if="inlineQueryStatus[item.id]?.last_query" class="text-[10px] text-slate-600 bg-slate-50 rounded px-2 py-1 truncate">
                <span class="font-medium text-teal-700">Q:</span> {{ inlineQueryStatus[item.id].last_query }}
              </div>
              <div v-if="inlineQueryStatus[item.id]?.last_reply" class="text-[10px] text-slate-600 bg-indigo-50 rounded px-2 py-1 truncate">
                <span class="font-medium text-indigo-700">A:</span> {{ inlineQueryStatus[item.id].last_reply }}
              </div>
              <div class="flex items-center gap-1">
                <div class="w-2 h-2 rounded-full flex-shrink-0" :class="{
                  'bg-red-500': getItemQueryStatus(item.id) === 'OPEN',
                  'bg-emerald-500': getItemQueryStatus(item.id) === 'RESOLVED',
                  'bg-slate-200': !getItemQueryStatus(item.id),
                }" />
                <input v-model="inlineQueryInput[item.id]"
                  @keyup.enter="sendInlineQuery(item)"
                  :placeholder="inlineQueryStatus[item.id] ? 'Reply...' : 'Ask query...'"
                  class="flex-1 text-[10px] px-2 py-0.5 border border-slate-200 rounded focus:border-teal-300 focus:outline-none min-w-0" />
                <button @click="sendInlineQuery(item)" :disabled="inlineSending[item.id] || !(inlineQueryInput[item.id] || '').trim()"
                  class="text-teal-600 hover:text-teal-800 disabled:opacity-30 flex-shrink-0">
                  <i :class="inlineSending[item.id] ? 'pi pi-spin pi-spinner' : 'pi pi-send'" class="text-[9px]" />
                </button>
              </div>
            </div>
          </td>
          <td v-if="isEditing && canEditItems" class="px-4 py-2 text-center">
            <button v-if="canRemove" @click="removeItem(item)" class="text-red-400 hover:text-red-600 transition-colors" title="Remove">
              <i class="pi pi-trash text-xs" />
            </button>
          </td>
        </tr>
      </tbody>
      <tfoot v-if="showPricing && activeItems.length > 0" class="bg-gradient-to-r from-slate-100 to-emerald-50 border-t-2 border-slate-300">
        <tr>
          <td class="px-4 py-3"></td>
          <td class="px-4 py-3"></td>
          <td class="px-4 py-3 text-sm font-bold text-slate-700 uppercase">Totals ({{ activeItems.length }} items)</td>
          <td class="px-4 py-3 text-center text-sm font-bold text-slate-800">{{ activeItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0).toLocaleString() }}</td>
          <td class="px-4 py-3 text-right text-sm font-bold text-amber-700">${{ activeItems.reduce((s, i) => s + (Number(i.client_factory_price) || 0) * (Number(i.quantity) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
          <td class="px-4 py-3"></td>
          <td class="px-4 py-3 text-right text-sm font-bold text-emerald-700">₹{{ activeItems.reduce((s, i) => s + ((Number(i.client_factory_price) || 0) * (Number(order.exchange_rate) || 0) * (Number(i.quantity) || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
          <td v-if="isEditing && canEditItems" class="px-4 py-3"></td>
        </tr>
      </tfoot>
    </table>

    <!-- ═══ ADD ITEM MODAL (Full-screen) ═══ -->
    <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40" @click.self="showAddModal = false">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 h-[90vh] flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div>
            <h3 class="text-lg font-semibold text-slate-800">Add Item to Order</h3>
            <p class="text-xs text-slate-500 mt-0.5">Browse your product catalog — {{ addTotal }} products available</p>
          </div>
          <button @click="showAddModal = false" class="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><i class="pi pi-times" /></button>
        </div>

        <!-- Filters Bar -->
        <div class="px-6 py-3 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-3 flex-shrink-0">
          <!-- Search -->
          <div class="relative flex-1">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
            <input v-model="addSearch" @input="onAddSearch" placeholder="Search by code, name, or material..."
              class="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 bg-white" autofocus />
          </div>
          <!-- Category filter -->
          <select v-model="addCategory" @change="onAddCategoryChange"
            class="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-400 bg-white min-w-[180px]">
            <option value="">All Categories</option>
            <option v-for="cat in addCategories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
          <!-- Item count badge -->
          <div class="flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
            <span class="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-medium">{{ existingProductIds.size }} in order</span>
          </div>
        </div>

        <!-- Product Table -->
        <div class="flex-1 overflow-y-auto">
          <div v-if="addSearching" class="py-16 text-center text-slate-400 text-sm"><i class="pi pi-spinner pi-spin mr-1 text-lg" /> Loading products...</div>
          <table v-else-if="sortedAddResults.length > 0" class="w-full text-sm">
            <thead class="sticky top-0 bg-slate-50 z-10">
              <tr class="border-b border-slate-200">
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700" @click="toggleAddSort('product_code')">
                  Code
                  <i v-if="addSortKey === 'product_code'" :class="addSortOrder === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'" class="text-[10px] ml-0.5 text-blue-500" />
                  <i v-else class="pi pi-sort-alt text-[10px] ml-0.5 opacity-30" />
                </th>
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700" @click="toggleAddSort('product_name')">
                  Product Name
                  <i v-if="addSortKey === 'product_name'" :class="addSortOrder === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'" class="text-[10px] ml-0.5 text-blue-500" />
                  <i v-else class="pi pi-sort-alt text-[10px] ml-0.5 opacity-30" />
                </th>
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700" @click="toggleAddSort('part_type')">
                  Type
                  <i v-if="addSortKey === 'part_type'" :class="addSortOrder === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'" class="text-[10px] ml-0.5 text-blue-500" />
                </th>
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700" @click="toggleAddSort('dimension')">
                  Size / Dimension
                  <i v-if="addSortKey === 'dimension'" :class="addSortOrder === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'" class="text-[10px] ml-0.5 text-blue-500" />
                </th>
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700" @click="toggleAddSort('material')">
                  Material
                  <i v-if="addSortKey === 'material'" :class="addSortOrder === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'" class="text-[10px] ml-0.5 text-blue-500" />
                </th>
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700" @click="toggleAddSort('category')">
                  Category
                  <i v-if="addSortKey === 'category'" :class="addSortOrder === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'" class="text-[10px] ml-0.5 text-blue-500" />
                </th>
                <th class="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase w-28">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              <tr v-for="p in sortedAddResults" :key="p.id"
                :class="[
                  'transition-colors',
                  existingProductIds.has(p.id) ? 'bg-emerald-50/30' : 'hover:bg-slate-50',
                ]">
                <td class="px-4 py-2.5 font-mono text-xs text-slate-700">{{ p.product_code }}</td>
                <td class="px-4 py-2.5 text-sm text-slate-800 font-medium">{{ p.product_name }}</td>
                <td class="px-4 py-2.5 text-xs text-slate-500">{{ p.part_type || '—' }}</td>
                <td class="px-4 py-2.5 text-xs text-slate-500">{{ p.dimension || '—' }}</td>
                <td class="px-4 py-2.5 text-xs text-slate-500">{{ p.material || '—' }}</td>
                <td class="px-4 py-2.5">
                  <span v-if="p.category" class="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">{{ p.category }}</span>
                  <span v-else class="text-slate-300 text-xs">—</span>
                </td>
                <td class="px-4 py-2.5 text-center">
                  <span v-if="existingProductIds.has(p.id)" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">
                    <i class="pi pi-check text-[8px]" /> In Order
                  </span>
                  <button v-else @click="addItem(p)" class="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1 mx-auto">
                    <i class="pi pi-plus text-[10px]" /> Add
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else class="py-16 text-center text-sm text-slate-400">
            <i class="pi pi-box text-3xl mb-3 block text-slate-200" />
            <p>No products found</p>
            <p v-if="addSearch || addCategory" class="text-xs mt-1">Try clearing your search or category filter</p>
          </div>
        </div>

        <!-- Footer: Pagination + Per Page -->
        <div class="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50 flex-shrink-0 rounded-b-2xl">
          <div class="flex items-center gap-3">
            <p class="text-xs text-slate-500">Showing {{ sortedAddResults.length }} of {{ addTotal }}</p>
            <select v-model.number="addPerPage" @change="onPerPageChange"
              class="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:ring-1 focus:ring-emerald-400">
              <option :value="20">20 / page</option>
              <option :value="50">50 / page</option>
              <option :value="100">100 / page</option>
              <option :value="200">200 / page</option>
            </select>
          </div>
          <div v-if="addTotalPages > 1" class="flex items-center gap-2">
            <button @click="addPage--; loadAddProducts()" :disabled="addPage <= 1"
              class="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 transition-colors">
              <i class="pi pi-chevron-left text-[10px]" /> Prev
            </button>
            <span class="text-xs text-slate-500">{{ addPage }} / {{ addTotalPages }}</span>
            <button @click="addPage++; loadAddProducts()" :disabled="addPage >= addTotalPages"
              class="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 transition-colors">
              Next <i class="pi pi-chevron-right text-[10px]" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ BULK ADD MODAL ═══ -->
    <div v-if="showBulkModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30" @click.self="showBulkModal = false">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
        <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 class="text-base font-semibold text-slate-800">Bulk Add Items</h3>
          <button @click="showBulkModal = false; bulkPreviewStep = false; bulkError = ''" class="text-slate-400 hover:text-slate-600"><i class="pi pi-times" /></button>
        </div>
        <div class="p-5">
          <!-- Step 1: Text input -->
          <template v-if="!bulkPreviewStep">
            <p class="text-xs text-slate-500 mb-2">Paste product codes (one per line). Optionally add quantity after a space or tab.</p>
            <textarea v-model="bulkText" rows="8" placeholder="W3.5H-02HA-12-02  50&#10;W2.5-02S-01-38  100&#10;W2.0B-01B-01-05Q-13"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-teal-300" />
            <div v-if="bulkError" class="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              <i class="pi pi-exclamation-triangle mr-1" />{{ bulkError }}
            </div>
            <div class="flex justify-end gap-2 mt-4">
              <button @click="showBulkModal = false" class="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
              <button @click="bulkPreview" :disabled="bulkAdding || !bulkText.trim()"
                class="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1.5">
                <i v-if="bulkAdding" class="pi pi-spinner pi-spin text-xs" /> Preview
              </button>
            </div>
          </template>

          <!-- Step 2: Preview with resolution -->
          <template v-else>
            <div v-if="bulkPreviewResults.some(r => r.status === 'ALREADY_IN_ORDER')" class="mb-3">
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                {{ bulkPreviewResults.filter(r => r.status === 'ALREADY_IN_ORDER').length }} Already in Order
              </span>
            </div>
            <div class="overflow-x-auto border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
              <table class="w-full text-sm">
                <thead class="sticky top-0">
                  <tr class="bg-slate-50 border-b border-slate-200">
                    <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Code</th>
                    <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Product</th>
                    <th class="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Qty</th>
                    <th v-if="bulkPreviewResults.some(r => r.status === 'ALREADY_IN_ORDER')" class="text-center px-3 py-2 text-xs font-semibold text-amber-600 uppercase">Resolve</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-for="(r, idx) in bulkPreviewResults" :key="idx" :class="{
                    'bg-emerald-50/50': r.status === 'FOUND' || (r.status === 'ALREADY_IN_ORDER' && bulkDupeResolutions[idx] && bulkDupeResolutions[idx] !== 'keep_existing'),
                    'bg-amber-50/50': r.status === 'ALREADY_IN_ORDER' && !bulkDupeResolutions[idx],
                    'bg-slate-50/50': r.status === 'ALREADY_IN_ORDER' && bulkDupeResolutions[idx] === 'keep_existing',
                    'bg-red-50/50': r.status === 'NOT_FOUND',
                  }">
                    <td class="px-3 py-2">
                      <span v-if="r.status === 'ALREADY_IN_ORDER' && bulkDupeResolutions[idx]"
                        :class="{
                          'bg-emerald-100 text-emerald-700': bulkDupeResolutions[idx] === 'club',
                          'bg-blue-100 text-blue-700': bulkDupeResolutions[idx] === 'keep_new',
                          'bg-slate-100 text-slate-500': bulkDupeResolutions[idx] === 'keep_existing',
                        }" class="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase">
                        {{ bulkDupeResolutions[idx] === 'club' ? 'CLUB' : bulkDupeResolutions[idx] === 'keep_new' ? 'REPLACE' : 'SKIP' }}
                      </span>
                      <span v-else :class="{
                        'bg-emerald-100 text-emerald-700': r.status === 'FOUND',
                        'bg-amber-100 text-amber-700': r.status === 'ALREADY_IN_ORDER',
                        'bg-red-100 text-red-700': r.status === 'NOT_FOUND',
                      }" class="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase">
                        {{ r.status === 'ALREADY_IN_ORDER' ? 'EXISTS' : r.status === 'FOUND' ? 'NEW' : 'NOT FOUND' }}
                      </span>
                    </td>
                    <td class="px-3 py-2 font-mono text-xs">{{ r.code }}</td>
                    <td class="px-3 py-2 text-xs text-slate-700">{{ r.product_name || '—' }}</td>
                    <td class="px-3 py-2 text-center text-xs font-medium">{{ r.quantity }}</td>
                    <td v-if="r.status === 'ALREADY_IN_ORDER'" class="px-2 py-2">
                      <div class="flex items-center gap-1">
                        <button @click="resolveBulkDupe(idx, 'club')"
                          class="px-1.5 py-0.5 text-[9px] font-medium rounded border transition-colors"
                          :class="bulkDupeResolutions[idx] === 'club' ? 'bg-emerald-600 text-white border-emerald-600' : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'">Club</button>
                        <button @click="resolveBulkDupe(idx, 'keep_existing')"
                          class="px-1.5 py-0.5 text-[9px] font-medium rounded border transition-colors"
                          :class="bulkDupeResolutions[idx] === 'keep_existing' ? 'bg-slate-600 text-white border-slate-600' : 'text-slate-600 border-slate-200 hover:bg-slate-50'">Keep</button>
                        <button @click="resolveBulkDupe(idx, 'keep_new')"
                          class="px-1.5 py-0.5 text-[9px] font-medium rounded border transition-colors"
                          :class="bulkDupeResolutions[idx] === 'keep_new' ? 'bg-blue-600 text-white border-blue-600' : 'text-blue-700 border-blue-200 hover:bg-blue-50'">Replace</button>
                      </div>
                    </td>
                    <td v-else-if="bulkPreviewResults.some(r2 => r2.status === 'ALREADY_IN_ORDER')" class="px-2 py-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="flex items-center justify-between mt-4">
              <button @click="bulkPreviewStep = false; bulkError = ''" class="px-3 py-2 text-sm text-slate-600 flex items-center gap-1 hover:text-slate-800">
                <i class="pi pi-arrow-left text-[10px]" /> Back
              </button>
              <div class="flex gap-2">
                <button @click="showBulkModal = false; bulkPreviewStep = false" class="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancel</button>
                <button @click="bulkApply" :disabled="bulkAdding || bulkApplyItems.length === 0"
                  class="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1.5">
                  <i v-if="bulkAdding" class="pi pi-spinner pi-spin text-xs" />
                  <i v-else class="pi pi-check text-xs" />
                  Add {{ bulkApplyItems.length }} Item(s)
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- ═══ BULK CONFIRM DIALOG ═══ -->
    <div v-if="showConfirmDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30" @click.self="showConfirmDialog = false">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div class="px-6 pt-6 pb-4 text-center">
          <div class="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4"
            :class="confirmDialogAction === 'approve' ? 'bg-emerald-100' : 'bg-red-100'">
            <i :class="confirmDialogAction === 'approve' ? 'pi pi-check-circle text-emerald-600' : 'pi pi-times-circle text-red-600'" class="text-xl" />
          </div>
          <h3 class="text-base font-semibold text-slate-800 mb-1">
            {{ confirmDialogAction === 'approve' ? 'Accept' : 'Reject' }} All Pending Items?
          </h3>
          <p class="text-sm text-slate-500">
            <template v-if="confirmDialogAction === 'approve'">
              You are confirming that the prices for {{ pendingAdditions.length }} items are acceptable. Our team will finalize and add them to your order.
            </template>
            <template v-else>
              This will reject all {{ pendingAdditions.length }} pending items. They will be removed from your order.
            </template>
          </p>
        </div>
        <div class="flex gap-3 px-6 pb-6 pt-2">
          <button @click="showConfirmDialog = false"
            class="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button @click="executeBulkConfirm"
            class="flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors"
            :class="confirmDialogAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'">
            {{ confirmDialogAction === 'approve' ? 'Accept Prices' : 'Reject All' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ ITEM QUERY PANEL (two-level: list → detail) ═══ -->
    <div v-if="showQueryPanel" class="fixed inset-0 z-40 flex justify-end" @click.self="showQueryPanel = false; selectedThread = null">
      <div class="bg-black/20 absolute inset-0" @click="showQueryPanel = false; selectedThread = null"></div>
      <div class="relative w-full max-w-lg bg-white shadow-2xl flex flex-col h-full z-10">
        <!-- Header -->
        <div class="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
          <div class="flex items-center gap-2">
            <button v-if="selectedThread" @click="selectedThread = null" class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200">
              <i class="pi pi-arrow-left text-xs" />
            </button>
            <div>
              <h3 class="text-sm font-semibold text-slate-800">
                {{ selectedThread ? selectedThread.subject : (showNewQueryForm ? 'Ask a Question' : 'Query Threads') }}
              </h3>
              <p class="text-xs text-slate-500 font-mono mt-0.5">{{ queryPanelItem?.product_code }} — {{ queryPanelItem?.product_name }}</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button v-if="!showNewQueryForm && !selectedThread && queryPanelQueries.length > 0"
              @click="showNewQueryForm = true" class="px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 flex items-center gap-1">
              <i class="pi pi-plus text-[9px]" /> New Query
            </button>
            <button v-if="showNewQueryForm && !selectedThread && queryPanelQueries.length > 0"
              @click="showNewQueryForm = false" class="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 flex items-center gap-1">
              <i class="pi pi-comments text-[9px]" /> Threads ({{ queryPanelQueries.length }})
            </button>
            <button v-if="selectedThread && selectedThread.status === 'RESOLVED'" @click="reopenQuery(selectedThread.id)"
              class="px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 flex items-center gap-1">
              <i class="pi pi-refresh text-[9px]" /> Reopen
            </button>
            <button @click="showQueryPanel = false; selectedThread = null" class="text-slate-400 hover:text-slate-600"><i class="pi pi-times" /></button>
          </div>
        </div>

        <!-- New Query Form -->
        <div v-if="showNewQueryForm && !selectedThread" class="px-5 py-3 border-b border-slate-100 bg-teal-50/50 flex-shrink-0">
          <div class="flex items-center gap-2 mb-2">
            <select v-model="newQueryType" @change="onQueryTypeChange" class="text-xs px-2 py-1 border border-slate-200 rounded bg-white">
              <option value="GENERAL">General</option>
              <option value="PHOTO_REQUEST">Request Photo</option>
              <option value="VIDEO_REQUEST">Request Video</option>
              <option value="DIMENSION_CHECK">Check Dimensions</option>
              <option value="QUALITY_QUERY">Quality Question</option>
              <option value="ALTERNATIVE">Ask for Alternative</option>
            </select>
            <input v-if="newQueryType === 'GENERAL'" v-model="newQuerySubject" placeholder="Subject..." class="flex-1 text-xs px-2 py-1 border border-slate-200 rounded" />
            <span v-else class="flex-1 text-xs px-2 py-1 text-slate-600">{{ newQuerySubject }}</span>
          </div>
          <div v-if="newQueryType === 'GENERAL'" class="flex gap-2">
            <textarea v-model="newQueryMessage" placeholder="Your question..." rows="2" class="flex-1 text-xs px-2 py-1 border border-slate-200 rounded resize-none" />
            <button @click="createQuery" :disabled="creatingQuery || !newQuerySubject.trim() || !newQueryMessage.trim()"
              class="px-3 py-1 text-xs font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50 self-end">
              <i :class="creatingQuery ? 'pi pi-spin pi-spinner' : 'pi pi-send'" class="text-[10px]" />
            </button>
          </div>
          <div v-else class="flex gap-2">
            <input v-model="newQueryMessage" placeholder="Add a note (optional)..." class="flex-1 text-xs px-2 py-1 border border-slate-200 rounded" />
            <button @click="createQuery" :disabled="creatingQuery || !newQuerySubject.trim()"
              class="px-3 py-1 text-xs font-medium text-white bg-teal-600 rounded hover:bg-teal-700 disabled:opacity-50">
              <i :class="creatingQuery ? 'pi pi-spin pi-spinner' : 'pi pi-send'" class="text-[10px] mr-0.5" /> Send
            </button>
          </div>
        </div>

        <!-- LEVEL 1: Thread List (clickable cards) -->
        <template v-if="!selectedThread">
          <div class="flex-1 overflow-y-auto px-5 py-3 space-y-2">
            <div v-if="queryPanelLoading" class="py-8 text-center text-slate-400"><i class="pi pi-spinner pi-spin text-lg" /></div>
            <div v-else-if="queryPanelQueries.length === 0" class="py-8 text-center text-slate-400">
              <i class="pi pi-comments text-3xl mb-2" /><p class="text-xs">No queries yet</p>
            </div>
            <div v-for="q in queryPanelQueries" :key="q.id" @click="openThreadDetail(q)"
              class="border rounded-lg p-3 cursor-pointer hover:shadow-md transition-all"
              :class="q.status === 'RESOLVED' ? 'border-slate-200 opacity-60 hover:opacity-80' : 'border-teal-200 hover:border-teal-400'">
              <div class="flex items-center justify-between mb-1">
                <div class="flex items-center gap-2">
                  <i :class="[QUERY_TYPE_LABELS[q.query_type]?.icon || 'pi-comment', QUERY_TYPE_LABELS[q.query_type]?.color]" class="pi text-xs" />
                  <span class="text-sm font-semibold text-slate-800">{{ q.subject }}</span>
                </div>
                <span :class="{ 'bg-red-100 text-red-700': q.status === 'OPEN', 'bg-blue-100 text-blue-700': q.status === 'REPLIED', 'bg-emerald-100 text-emerald-700': q.status === 'RESOLVED' }"
                  class="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase">{{ q.status }}</span>
              </div>
              <p class="text-xs text-slate-500 truncate">{{ q.messages?.[q.messages.length - 1]?.message || '' }}</p>
              <div class="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                <span>{{ q.message_count || q.messages?.length || 0 }} messages</span>
                <span>{{ getAgeText(q.last_message_at || q.created_at) }}</span>
              </div>
            </div>
          </div>
        </template>

        <!-- LEVEL 2: Thread Detail (chat bubbles) -->
        <template v-else>
          <div ref="chatContainerRef" class="flex-1 overflow-y-auto bg-slate-50 px-5 py-4 space-y-3">
            <div v-for="m in selectedThread.messages" :key="m.id"
              class="flex gap-3" :class="m.sender_role === 'ADMIN' ? 'flex-row-reverse' : ''">
              <div :class="['w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                m.sender_role === 'CLIENT' ? 'bg-teal-100 text-teal-700' : 'bg-indigo-100 text-indigo-700']">
                {{ getInitials(m.sender_name) }}
              </div>
              <div class="flex-1 max-w-[75%]">
                <div class="flex items-center gap-2 mb-0.5" :class="m.sender_role === 'ADMIN' ? 'justify-end' : ''">
                  <span class="text-xs font-semibold" :class="m.sender_role === 'CLIENT' ? 'text-teal-700' : 'text-indigo-700'">
                    {{ m.sender_role === 'CLIENT' ? 'You' : 'Our Team' }}
                  </span>
                  <span class="text-[10px] text-slate-400">{{ getAgeText(m.created_at) }}</span>
                </div>
                <div :class="['rounded-2xl px-4 py-2.5 shadow-sm border',
                  m.sender_role === 'CLIENT' ? 'bg-white border-slate-200 rounded-tl-sm' : 'bg-teal-600 text-white border-teal-700 rounded-tr-sm']">
                  <p class="text-sm whitespace-pre-wrap" :class="m.sender_role === 'CLIENT' ? 'text-slate-700' : 'text-white'">{{ m.message }}</p>
                  <div v-if="m.attachments?.length" class="mt-2 space-y-1.5">
                    <template v-for="att in m.attachments" :key="att">
                      <img v-if="isImageAtt(att)" :src="attUrl(att)" class="max-w-full max-h-48 rounded-lg border cursor-pointer hover:opacity-90"
                        @click="openImageViewer(attUrl(att), att.split('/').pop())" />
                      <video v-else-if="isVideoAtt(att)" controls class="max-w-full max-h-48 rounded-lg border"><source :src="attUrl(att)" /></video>
                      <a v-else :href="attUrl(att)" target="_blank" class="inline-flex items-center px-2 py-1 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100">
                        <i class="pi pi-paperclip text-[9px] mr-1" />{{ att.split('/').pop() }}
                      </a>
                    </template>
                  </div>
                  <!-- Timestamp + Read receipt -->
                  <div class="flex items-center gap-1 mt-1" :class="m.sender_role === 'CLIENT' ? 'justify-end' : 'justify-start'">
                    <span class="text-[9px]" :class="m.sender_role === 'CLIENT' ? 'text-slate-400' : 'text-white/60'">
                      {{ new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
                    </span>
                    <template v-if="m.sender_role === 'CLIENT'">
                      <span v-if="selectedThread.messages.indexOf(m) < selectedThread.messages.length - 1 || selectedThread.status === 'REPLIED'"
                        class="text-[10px] text-blue-500" title="Read">✓✓</span>
                      <span v-else class="text-[10px] text-slate-400" title="Sent">✓</span>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- Reply Input -->
          <div v-if="selectedThread.status !== 'RESOLVED'" class="border-t border-slate-200 bg-white px-5 py-3 flex-shrink-0">
            <div class="flex items-end gap-2">
              <input ref="threadFileInput" type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xlsx" class="hidden" @change="onThreadFileSelect" />
              <button @click="threadFileInput?.click()" :disabled="threadUploadingFile"
                class="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-teal-600 flex-shrink-0">
                <i :class="threadUploadingFile ? 'pi pi-spin pi-spinner' : 'pi pi-paperclip'" class="text-sm" />
              </button>
              <input v-model="threadReplyMessage" @keyup.enter="sendThreadReply()" placeholder="Type your reply..."
                class="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-teal-300 focus:ring-2 focus:ring-teal-100 focus:outline-none" />
              <button @click="sendThreadReply()" :disabled="threadSendingReply || !threadReplyMessage.trim()"
                class="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0">
                <i :class="threadSendingReply ? 'pi pi-spin pi-spinner' : 'pi pi-send'" class="text-xs" /> Send
              </button>
            </div>
          </div>
          <div v-else class="border-t border-slate-200 bg-emerald-50 px-5 py-3 flex items-center justify-between flex-shrink-0">
            <div class="flex items-center gap-2">
              <i class="pi pi-check-circle text-emerald-600" />
              <span class="text-xs text-emerald-700 font-medium">Resolved</span>
              <span v-if="selectedThread.resolution_remark" class="text-xs text-emerald-600">— {{ selectedThread.resolution_remark }}</span>
            </div>
            <button @click="reopenQuery(selectedThread.id)"
              class="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 flex items-center gap-1">
              <i class="pi pi-refresh text-[9px]" /> Reopen
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- ═══ IMAGE VIEWER LIGHTBOX ═══ -->
    <div v-if="viewerImage" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      @click.self="closeImageViewer" @wheel.prevent="onViewerWheel"
      @mousemove="onViewerMouseMove" @mouseup="onViewerMouseUp" @mouseleave="onViewerMouseUp">
      <div class="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-4 py-2 bg-white/95 backdrop-blur-sm rounded-full shadow-lg">
        <span class="text-sm font-semibold text-slate-700 max-w-xs truncate">{{ viewerLabel }}</span>
        <div class="w-px h-5 bg-slate-200"></div>
        <button @click="viewerZoom = Math.max(viewerZoom - 0.25, 0.25)" class="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-600"><i class="pi pi-minus text-[10px]" /></button>
        <button @click="viewerZoom = 1; viewerPan = { x: 0, y: 0 }" class="text-xs text-slate-500 font-mono w-10 text-center hover:text-blue-600 cursor-pointer">{{ Math.round(viewerZoom * 100) }}%</button>
        <button @click="viewerZoom = Math.min(viewerZoom + 0.25, 8)" class="w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-600"><i class="pi pi-plus text-[10px]" /></button>
        <div class="w-px h-5 bg-slate-200"></div>
        <button @click="closeImageViewer" class="w-7 h-7 rounded-full border border-red-200 flex items-center justify-center hover:bg-red-50 text-red-500"><i class="pi pi-times text-[10px]" /></button>
      </div>
      <div class="flex items-center justify-center overflow-hidden" style="width: 90vw; height: 88vh;"
        :style="{ cursor: viewerZoom > 1 ? (isDraggingViewer ? 'grabbing' : 'grab') : 'default' }"
        @mousedown="onViewerMouseDown">
        <img :src="viewerImage" alt="Preview" draggable="false" class="select-none"
          :style="{ transform: `translate(${viewerPan.x}px, ${viewerPan.y}px)`, width: (viewerZoom * 100) + '%', maxWidth: (viewerZoom * 90) + 'vw', objectFit: 'contain', transition: isDraggingViewer ? 'none' : 'transform 0.15s ease, width 0.15s ease' }" />
      </div>
    </div>
  </div>
</template>
