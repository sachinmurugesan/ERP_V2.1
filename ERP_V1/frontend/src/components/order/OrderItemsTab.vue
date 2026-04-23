<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { ordersApi, productsApi, quotationsApi, settingsApi, queriesApi } from '../../api'
import ExcelJS from 'exceljs'
import { formatDate } from '../../utils/formatters'
import { POST_PI_STATUSES, STAGE_4_PLUS } from '../../utils/constants'

const props = defineProps({
  orderId: { type: String, required: true },
  order: { type: Object, required: true },
  highlightSection: { type: String, default: null },
  isSuperAdmin: { type: Boolean, default: false },
})

// Transparency client detection
const isTransparencyClient = computed(() => props.order?.client_type === 'TRANSPARENCY')
const showDualPriceColumns = computed(() => props.isSuperAdmin && isTransparencyClient.value)
// ADMIN (non-SUPER_ADMIN) cannot upload/edit factory prices for transparency clients
const canEditFactoryPrices = computed(() => !isTransparencyClient.value || props.isSuperAdmin)

// Get the effective client-facing price for a transparency item.
// SUPER_ADMIN: client_factory_price is present; ADMIN: backend masks it into factory_price.
function cfp(item) {
  return item.client_factory_price ?? item.factory_price
}
const emit = defineEmits(['reload', 'open-query'])

// Section refs for highlight-on-navigate
const piActionsRef = ref(null)
const pricingTableRef = ref(null)

// Watch for highlight requests from parent
watch(() => props.highlightSection, (section) => {
  if (!section) return
  nextTick(() => {
    let el = null
    if (section === 'pi-actions') el = piActionsRef.value
    else if (section === 'pricing') el = pricingTableRef.value
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('highlight-flash')
      setTimeout(() => el.classList.remove('highlight-flash'), 2500)
    }
  })
})

// ========================================
// Locally derived computeds from order prop
// ========================================
const isDraft = computed(() => props.order?.status === 'DRAFT')
const isPendingPI = computed(() => props.order?.status === 'PENDING_PI')
const isCompletedEditing = computed(() => props.order?.status === 'COMPLETED_EDITING')
const canEditPrices = computed(() => isPendingPI.value || isCompletedEditing.value)
const canModifyItems = computed(() => {
  const editableStatuses = ['DRAFT','PENDING_PI','PI_SENT','ADVANCE_PENDING','ADVANCE_RECEIVED','FACTORY_ORDERED','COMPLETED_EDITING','PRODUCTION_60','PRODUCTION_80','PRODUCTION_90']
  return editableStatuses.includes(props.order?.status)
})
const piIsStale = computed(() => props.order?.pi_stale === true)
const isPostPI = computed(() => POST_PI_STATUSES.has(props.order?.status))
const isStage4Plus = computed(() => STAGE_4_PLUS.has(props.order?.status))
const isPISent = computed(() => props.order?.status === 'PI_SENT')
const isFinalPI = computed(() => props.order?.status === 'FINAL_PI')
const canGeneratePI = computed(() => isPendingPI.value || isPostPI.value)
// Format helpers
// ========================================
// Price editing state (Stage 2)
// ========================================
const priceSaving = ref({})  // { itemId: true/false }
const copyingPrices = ref(false)
const copyResult = ref(null)
const customPriceFlags = ref({}) // { itemId: true } when user directly entered selling_price_inr
const applyingMarkup = ref(false)

// ========================================
// Inline pricing for unpriced items (mid-production add)
// ========================================
const isMiddleEditableStage = computed(() =>
  canModifyItems.value && !canEditPrices.value && !isDraft.value
)
const unpricedNewItems = computed(() => {
  if (!isMiddleEditableStage.value) return new Set()
  return new Set(confirmedItems.value.filter(i => {
    // Transparency: priced if client_factory_price or factory_price is set
    if (isTransparencyClient.value) return !i.client_factory_price && !i.factory_price
    // Regular: priced if selling_price_inr is set
    return i.selling_price_inr == null
  }).map(i => i.id))
})
const inlinePriceEdit = ref({})    // { itemId: { factory_price, selling_price_inr } }
const inlinePriceSaving = ref({})  // { itemId: true/false }

function initInlinePrice(itemId) {
  if (!inlinePriceEdit.value[itemId]) {
    inlinePriceEdit.value[itemId] = { factory_price: null, selling_price_inr: null }
  }
}

async function saveInlinePrice(item) {
  const prices = inlinePriceEdit.value[item.id]
  if (!prices) return
  inlinePriceSaving.value[item.id] = true
  try {
    const { data } = await ordersApi.updateItemPrices(props.orderId, item.id, {
      factory_price: prices.factory_price ? parseFloat(prices.factory_price) : null,
      selling_price_inr: prices.selling_price_inr ? parseFloat(prices.selling_price_inr) : null,
    })
    // Update item in-place without full page reload
    Object.assign(item, data)
    delete inlinePriceEdit.value[item.id]
    // Allow resending prices after price change
    pricesSent.value = false
  } catch (err) {
    console.error('Failed to save inline price:', err)
  } finally {
    inlinePriceSaving.value[item.id] = false
  }
}

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
  if (item.factory_image_path) return `/api/products/file/?path=${encodeURIComponent(item.factory_image_path)}`
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
const allItemQueries = ref([])
const inlineQueryStatus = ref({})  // { itemId: { status, last_query, last_reply, ... } }
const inlineQueryInput = ref({})  // { itemId: text }
const inlineSending = ref({})
const showQueryColumn = ref(false)
const queryFilterActive = ref(false)

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
    // Auto-show column if any queries exist
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

const showQueryPanel = ref(false)
const queryPanelItem = ref(null)
const queryPanelQueries = ref([])
const queryPanelLoading = ref(false)
const newQueryType = ref('GENERAL')
const newQuerySubject = ref('')
const newQueryMessage = ref('')

function onQueryTypeChange() {
  const auto = {
    PHOTO_REQUEST: 'Product photos',
    VIDEO_REQUEST: 'Product video',
    DIMENSION_CHECK: 'Dimension details',
    QUALITY_QUERY: 'Quality question',
    ALTERNATIVE: 'Alternative options',
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

async function refreshPanelQueries() {
  const { data } = await queriesApi.list(props.orderId, { order_item_id: queryPanelItem.value?.id })
  queryPanelQueries.value = data
  await loadAllQueries()
}

const showNewQueryForm = ref(true)
const selectedThread = ref(null)
const threadReplyMessage = ref('')
const threadSendingReply = ref(false)
const threadUploadingFile = ref(false)
const threadFileInput = ref(null)
const adminChatContainerRef = ref(null)

function scrollAdminChatToBottom() {
  nextTick(() => {
    if (adminChatContainerRef.value) {
      adminChatContainerRef.value.scrollTop = adminChatContainerRef.value.scrollHeight
    }
  })
}

async function openThreadDetail(query) {
  selectedThread.value = query
  showNewQueryForm.value = false
  scrollAdminChatToBottom()
  try {
    const { data } = await queriesApi.get(props.orderId, query.id)
    selectedThread.value = data
    scrollAdminChatToBottom()
  } catch (e) { /* keep initial */ }
}

// Auto-scroll when new messages arrive
watch(() => selectedThread.value?.messages?.length, () => scrollAdminChatToBottom())

async function sendThreadReply() {
  if (!threadReplyMessage.value.trim() || !selectedThread.value) return
  threadSendingReply.value = true
  try {
    await queriesApi.reply(props.orderId, selectedThread.value.id, { message: threadReplyMessage.value })
    threadReplyMessage.value = ''
    const { data } = await queriesApi.get(props.orderId, selectedThread.value.id)
    selectedThread.value = data
    scrollAdminChatToBottom()
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
    await loadAllQueries()
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
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

async function openQueryPanel(item) {
  queryPanelItem.value = item
  selectedThread.value = null
  showQueryPanel.value = true
  queryPanelLoading.value = true
  try {
    await refreshPanelQueries()
    showNewQueryForm.value = queryPanelQueries.value.length === 0
    // If only 1 query, auto-open it
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
  queryPanelLoading.value = true
  refreshPanelQueries().finally(() => { queryPanelLoading.value = false })
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
    showNewQueryForm.value = false  // Switch to threads view after creating
    await loadInlineStatus()
  } catch (e) { console.error(e) }
  creatingQuery.value = false
}

async function sendReply(queryId) {
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

// Item management state (Stage 2)
// ========================================
const selectedItems = ref(new Set())
const showAddItemModal = ref(false)
const addItemSearch = ref('')
const addItemResults = ref([])
const addItemSearching = ref(false)
const addingItem = ref(false)
// Product browser state
const addItemPage = ref(1)
const addItemTotal = ref(0)
const addItemPerPage = 20
const addItemLoading = ref(false)
const addItemCategories = ref([])
const addItemCategory = ref('')
const showRemovedItems = ref(false)
const showRemoveModal = ref(false)
const removeTargetIds = ref([])
const removeCancelNote = ref('')
const removingItems = ref(false)
const editingQty = ref({}) // { itemId: newQtyValue }
const isEditing = ref(false)
watch(canEditPrices, (val) => { if (val) isEditing.value = true }, { immediate: true })
watch(() => props.orderId, (id) => { if (id) { loadAllQueries(); loadInlineStatus() } }, { immediate: true })

// ========================================
// Bulk Text Add state
// ========================================
const showBulkAddModal = ref(false)
const bulkAddText = ref('')
const bulkAddPreviewing = ref(false)
const bulkAddResults = ref([])
const bulkAddCounts = ref(null)
const bulkAddApplying = ref(false)
const bulkAddApplied = ref(false)

async function bulkAddPreview() {
  const lines = bulkAddText.value.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return
  bulkAddPreviewing.value = true
  bulkDuplicateResolutions.value = {}
  try {
    const { data } = await ordersApi.bulkTextAddPreview(props.orderId, lines)
    bulkAddResults.value = data.results
    bulkAddCounts.value = data.counts
  } catch (err) {
    console.error('Bulk add preview failed:', err)
  } finally {
    bulkAddPreviewing.value = false
  }
}

function bulkAddResolveAmbiguous(result, matchId) {
  const match = result.matches.find(m => m.id === matchId)
  if (match) {
    result.status = 'FOUND'
    result.product_id = match.id
    result.product_name = match.product_name
    // Update counts
    if (bulkAddCounts.value) {
      bulkAddCounts.value.ambiguous--
      bulkAddCounts.value.found++
    }
  }
}

// Duplicate resolution: { index: 'club' | 'keep_existing' | 'keep_new' }
const bulkDuplicateResolutions = ref({})

function resolveBulkDuplicate(idx, action) {
  bulkDuplicateResolutions.value = { ...bulkDuplicateResolutions.value, [idx]: action }
}

const bulkAddApplyItems = computed(() => {
  const found = bulkAddResults.value.filter(r => r.status === 'FOUND')
  // Include resolved duplicates
  const resolved = bulkAddResults.value
    .map((r, idx) => ({ ...r, _idx: idx }))
    .filter(r => r.status === 'ALREADY_IN_ORDER' && bulkDuplicateResolutions.value[r._idx])
    .filter(r => bulkDuplicateResolutions.value[r._idx] !== 'keep_existing')
    .map(r => ({ ...r, _resolution: bulkDuplicateResolutions.value[r._idx] }))
  return [...found, ...resolved]
})

async function bulkAddApply() {
  const newItems = bulkAddApplyItems.value.filter(r => !r._resolution).map(r => ({
    product_id: r.product_id,
    quantity: r.quantity,
  }))
  const dupeItems = bulkAddApplyItems.value.filter(r => r._resolution)

  if (newItems.length === 0 && dupeItems.length === 0) return
  bulkAddApplying.value = true
  try {
    // Add new items
    if (newItems.length > 0) {
      await ordersApi.bulkTextAddApply(props.orderId, newItems)
    }
    // Handle duplicate resolutions (club qty or replace)
    for (const r of dupeItems) {
      // Find the existing item in order
      const existing = (props.order?.items || []).find(i => i.product_id === r.product_id && i.status === 'ACTIVE')
      if (!existing) continue
      if (r._resolution === 'club') {
        await ordersApi.updateItem(props.orderId, existing.id, { quantity: (existing.quantity || 0) + r.quantity })
      } else if (r._resolution === 'keep_new') {
        await ordersApi.updateItem(props.orderId, existing.id, { quantity: r.quantity })
      }
    }
    bulkAddApplied.value = true
    emit('reload')
  } catch (err) {
    console.error('Bulk add apply failed:', err)
  } finally {
    bulkAddApplying.value = false
  }
}

function closeBulkAddModal() {
  showBulkAddModal.value = false
  bulkAddText.value = ''
  bulkAddResults.value = []
  bulkAddCounts.value = null
  bulkAddApplied.value = false
}

// ========================================
// PI (Proforma Invoice) state
// ========================================
const generatingPI = ref(false)
const piResult = ref(null)
const piError = ref('')
const downloadingPIImages = ref(false)

// ========================================
// Bulk price upload state
// ========================================
const showBulkPriceModal = ref(false)
const bulkPriceTab = ref('text')  // 'text' or 'excel'
const bulkPriceText = ref('')
const bulkPriceParsed = ref([])  // [{ code, price, matched: bool, item: ref }]
const bulkPriceApplying = ref(false)
const priceExcelParsing = ref(false)

// ========================================
// Sorting state for order items table
// ========================================
const sortKey = ref(null)   // null | 'product_code' | 'product_name' | 'quantity' | 'factory_price' | 'selling_price_inr'
const sortOrder = ref('asc') // 'asc' | 'desc'

// ========================================
// Computed
// ========================================
const activeItems = computed(() => props.order?.items?.filter(i => i.status === 'ACTIVE') || [])
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

// Lot color palette for approved additions (cycles through 5 colors)
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

// Send prices to client notification
const sendingPrices = ref(false)
const pricesSent = ref(false)

async function sendPricesToClient() {
  sendingPrices.value = true
  try {
    await ordersApi.sendPendingPrices(props.orderId)
    pricesSent.value = true
  } catch (e) {
    console.error('Failed to send prices:', e)
  }
  sendingPrices.value = false
}

// Bulk approve/reject all pending items
const bulkConfirmingPending = ref(false)
const showPendingConfirmDialog = ref(false)
const pendingConfirmAction = ref('')

function bulkConfirmPending(action) {
  if (!pendingAdditions.value.length && !clientConfirmedItems.value.length) return
  pendingConfirmAction.value = action
  showPendingConfirmDialog.value = true
}

async function executeBulkConfirmPending() {
  const action = pendingConfirmAction.value
  showPendingConfirmDialog.value = false
  bulkConfirmingPending.value = true
  try {
    await ordersApi.bulkConfirmItems(props.orderId, action)
    emit('reload')
  } catch (e) {
    console.error('Failed to bulk confirm items:', e)
  }
  bulkConfirmingPending.value = false
}

// Carried items detection — distinguishes unloaded vs after-sales
function getCarryForwardInfo(item) {
  if (!item.notes) return null
  // Unloaded items: "Carried from ORD-xxx"
  const unloadedMatch = item.notes.match(/^Carried from (ORD-\S+|previous order)/)
  if (unloadedMatch) return { type: 'unloaded', from: unloadedMatch[1] }
  // After-sales: "After-Sales (xxx) from ORD-xxx"
  const asMatch = item.notes.match(/^After-Sales \((.+?)\) from (ORD-\S+)/)
  if (asMatch) return { type: 'aftersales', resolution: asMatch[1], from: asMatch[2] }
  return null
}
const carriedItems = computed(() => activeItems.value.filter(i => getCarryForwardInfo(i)))
const unloadedCarried = computed(() => carriedItems.value.filter(i => getCarryForwardInfo(i)?.type === 'unloaded'))
const aftersalesCarried = computed(() => carriedItems.value.filter(i => getCarryForwardInfo(i)?.type === 'aftersales'))
const carriedCount = computed(() => carriedItems.value.length)
function isLastCarriedItem(index) {
  return carriedCount.value > 0 && index === carriedCount.value - 1
}

function getCarriedRowClass(item) {
  const info = getCarryForwardInfo(item)
  if (!info) return ''
  if (info.type === 'aftersales') return 'bg-rose-50/80 hover:bg-rose-100/70 border-l-4 border-l-rose-400'
  return 'bg-amber-50/80 hover:bg-amber-100/70 border-l-4 border-l-amber-400'
}

// After-sales resolution type label
function getAfterSalesLabel(item) {
  const info = getCarryForwardInfo(item)
  if (!info || info.type !== 'aftersales') return 'After-Sales'
  const resolution = (info.resolution || '').toLowerCase()
  if (resolution.includes('replace')) return 'After-Sales \u2022 Replace'
  if (resolution.includes('compensat')) return 'After-Sales \u2022 Reduct Balance'
  return 'After-Sales'
}

// Set of product_ids that exist as after-sales carry-forward items
const aftersalesProductIds = computed(() =>
  new Set(aftersalesCarried.value.map(i => i.product_id))
)

// Check if a regular (non-carried) item has the same product as an after-sales carried item
function hasAfterSalesTwin(item) {
  if (getCarryForwardInfo(item)) return false
  return aftersalesProductIds.value.has(item.product_id)
}

const sortedItems = computed(() => {
  const items = [...confirmedItems.value]
  const unloaded = items.filter(i => getCarryForwardInfo(i)?.type === 'unloaded')
  const aftersales = items.filter(i => getCarryForwardInfo(i)?.type === 'aftersales')
  const midOrder = items.filter(i => !getCarryForwardInfo(i) && i.pi_item_status === 'APPROVED')
  const regular = items.filter(i => !getCarryForwardInfo(i) && i.pi_item_status !== 'APPROVED')

  const sortFn = (a, b) => {
    if (!sortKey.value) return 0
    const key = sortKey.value
    const dir = sortOrder.value === 'asc' ? 1 : -1
    const av = a[key], bv = b[key]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'string') return dir * av.localeCompare(bv)
    return dir * (av - bv)
  }

  unloaded.sort(sortFn)
  aftersales.sort(sortFn)
  regular.sort(sortFn)
  midOrder.sort(sortFn)
  return [...unloaded, ...aftersales, ...regular, ...midOrder]
})
const removedItems = computed(() => props.order?.items?.filter(i => i.status === 'REMOVED') || [])

// Order items not covered by the current bulk price upload
const orderItemsMissingFromUpload = computed(() => {
  if (!bulkPriceParsed.value.length) return []
  const matchedCodes = new Set(bulkPriceParsed.value.filter(r => r.matched).map(r => r.code))
  return activeItems.value.filter(i => !matchedCodes.has(i.product_code) && !i.factory_price && getCarryForwardInfo(i)?.type !== 'aftersales')
})

// Exclude after-sales and pending/rejected items from totals and "missing price" warnings
const nonAftersalesItems = computed(() =>
  confirmedItems.value.filter(i => getCarryForwardInfo(i)?.type !== 'aftersales')
)

const itemsMissingPrices = computed(() =>
  nonAftersalesItems.value.filter(i => !i.selling_price_inr).length
)
const itemsMissingFactoryPrice = computed(() =>
  nonAftersalesItems.value.filter(i => !i.factory_price).length
)

// Specific list of items missing selling prices (product codes)
const itemsMissingPricesList = computed(() =>
  nonAftersalesItems.value
    .filter(i => !i.selling_price_inr)
    .map(i => i.product_code)
)

// Specific list of items missing factory prices
const itemsMissingFactoryPriceList = computed(() =>
  nonAftersalesItems.value
    .filter(i => !i.factory_price)
    .map(i => i.product_code)
)

// ========================================
// Pricing Totals (tentative invoice summary)
// ========================================
const totalQty = computed(() =>
  nonAftersalesItems.value.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0)
)
const totalFactoryUsd = computed(() =>
  nonAftersalesItems.value.reduce((sum, i) => {
    const fp = Number(i.factory_price) || 0
    const qty = Number(i.quantity) || 0
    return sum + fp * qty
  }, 0)
)
const totalClientFactoryUsd = computed(() => {
  if (!isTransparencyClient.value) return 0
  return nonAftersalesItems.value.reduce((sum, i) => {
    const cfpVal = Number(i.client_factory_price ?? i.factory_price) || 0
    const qty = Number(i.quantity) || 0
    return sum + cfpVal * qty
  }, 0)
})
const totalClientFactoryInr = computed(() => {
  const rate = Number(props.order?.exchange_rate) || 0
  if (isTransparencyClient.value) {
    return totalClientFactoryUsd.value * rate
  }
  return nonAftersalesItems.value.reduce((sum, i) => {
    const sp = Number(i.selling_price_inr) || 0
    const qty = Number(i.quantity) || 0
    return sum + sp * qty
  }, 0)
})
const totalSellingInr = computed(() =>
  nonAftersalesItems.value.reduce((sum, i) => {
    const sp = Number(i.selling_price_inr) || 0
    const qty = Number(i.quantity) || 0
    return sum + sp * qty
  }, 0)
)

// Bulk selection helpers
const allItemsSelected = computed(() =>
  activeItems.value.length > 0 && selectedItems.value.size === activeItems.value.length
)
const someItemsSelected = computed(() =>
  selectedItems.value.size > 0 && selectedItems.value.size < activeItems.value.length
)

// Names of items being removed (for confirmation modal)
const removeTargetNames = computed(() => {
  if (!props.order?.items) return []
  return removeTargetIds.value.map(id => {
    const item = props.order.items.find(i => i.id === id)
    return item ? `${item.product_code} - ${item.product_name}` : id
  })
})

// ========================================
// Price editing functions (Stage 2)
// ========================================
async function saveItemPrice(item) {
  priceSaving.value[item.id] = true
  try {
    const payload = {
      factory_price: item.factory_price != null ? parseFloat(item.factory_price) : null,
      markup_percent: item.markup_percent != null ? parseFloat(item.markup_percent) : null,
      selling_price_inr: item.selling_price_inr != null ? parseFloat(item.selling_price_inr) : null,
    }
    const { data } = await ordersApi.updateItemPrices(props.orderId, item.id, payload)
    // Update the local item with server response
    const idx = props.order.items.findIndex(i => i.id === item.id)
    if (idx !== -1) {
      props.order.items[idx] = data
    }
  } catch (err) {
    console.error('Failed to save price:', err)
  } finally {
    priceSaving.value[item.id] = false
  }
}

// When user edits factory price or markup — auto-calculate selling price
function handleFactoryOrMarkupBlur(item) {
  const rate = props.order?.exchange_rate
  if (item.factory_price && item.markup_percent != null && rate) {
    item.selling_price = +(item.factory_price * (1 + item.markup_percent / 100)).toFixed(2)
    item.selling_price_inr = +(item.selling_price * rate).toFixed(2)
    // Auto-calculated, so not custom
    delete customPriceFlags.value[item.id]
  }
  saveItemPrice(item)
}

// When user directly enters selling price — back-calculate markup and flag as custom
function handleSellingPriceBlur(item) {
  const rate = props.order?.exchange_rate
  if (item.selling_price_inr && rate && item.factory_price) {
    // Back-calculate to keep everything in sync
    item.selling_price = +(item.selling_price_inr / rate).toFixed(2)
    item.markup_percent = +((item.selling_price / item.factory_price - 1) * 100).toFixed(1)
  }
  // Flag as custom price
  if (item.selling_price_inr) {
    customPriceFlags.value[item.id] = true
  }
  saveItemPrice(item)
}

async function refreshTable() {
  // Reset after-sales prices to correct values, then reload
  try {
    await ordersApi.resetAftersalesPrices(props.orderId)
  } catch (e) { /* ignore if endpoint not available */ }
  // Fetch latest exchange rate from DB + recalculate all derived prices
  try { await ordersApi.recalculatePrices(props.orderId, { refreshRate: true }) } catch (_) {}
  emit('reload')
}

async function copyFromPreviousOrder() {
  copyingPrices.value = true
  copyResult.value = null
  try {
    const { data } = await ordersApi.copyPreviousPrices(props.orderId)
    copyResult.value = data
    // Reload order to get updated prices
    emit('reload')
  } catch (err) {
    const detail = err.response?.data?.detail
    copyResult.value = { message: typeof detail === 'string' ? detail : 'Failed to copy prices' }
  } finally {
    copyingPrices.value = false
  }
}

async function applyMarkupToAll() {
  // Apply category-specific markup to all items that have factory price but no selling price
  // Fetches FRESH category markups from settings before applying
  const items = activeItems.value
  const rate = props.order?.exchange_rate
  if (!rate) return

  applyingMarkup.value = true
  try {
    // Fetch latest category markups from backend
    let categoryMarkupMap = {}
    try {
      const { data } = await settingsApi.getCategories()
      const cats = Array.isArray(data) ? data : (data.categories || [])
      for (const cat of cats) {
        if (cat.name && cat.markup_percent != null) {
          categoryMarkupMap[cat.name] = cat.markup_percent
        }
      }
    } catch (_) {
      // If categories endpoint fails, proceed with defaults
    }

    const defaultMarkup = props.order?.default_markup_percent || 20
    const toSave = []

    for (const item of items) {
      // Skip after-sales carry-forward items — they have fixed pricing (0 or negative)
      if (getCarryForwardInfo(item)?.type === 'aftersales') continue

      // Apply to items with factory price that have no meaningful selling price
      // selling_price_inr could be null, undefined, 0, or "0.00" — all mean "not set"
      const hasFactoryPrice = item.factory_price != null && Number(item.factory_price) > 0
      const hasSellingPrice = item.selling_price_inr != null && Number(item.selling_price_inr) > 0
      if (hasFactoryPrice && !hasSellingPrice) {
        // Priority: category markup from settings → item's existing markup → default
        const category = item.category_snapshot || item.category || ''
        const markup = categoryMarkupMap[category] ?? item.markup_percent ?? defaultMarkup
        item.markup_percent = markup
        item.selling_price = +(Number(item.factory_price) * (1 + markup / 100)).toFixed(2)
        item.selling_price_inr = +(item.selling_price * rate).toFixed(2)
        delete customPriceFlags.value[item.id]
        toSave.push(item)
      }
    }

    // Save all updated items to backend
    for (const item of toSave) {
      await saveItemPrice(item)
    }
  } finally {
    applyingMarkup.value = false
  }
}

// ========================================
// Bulk price upload (Stage 2)
// ========================================
function parseBulkPrices() {
  const lines = bulkPriceText.value.trim().split('\n').filter(l => l.trim())
  const items = activeItems.value
  const results = []

  for (const line of lines) {
    // Split by whitespace (spaces or tabs)
    const parts = line.trim().split(/\s+/)
    if (parts.length < 2) continue

    const price = parseFloat(parts[parts.length - 1])
    // Everything before the last part is the product code (handles codes with spaces, though unlikely)
    const code = parts.slice(0, parts.length - 1).join(' ').trim()

    if (!code || isNaN(price)) continue

    // Find matching item by product_code
    const matchedItem = items.find(i => i.product_code === code)
    results.push({
      code,
      price,
      matched: !!matchedItem,
      item: matchedItem || null,
    })
  }

  bulkPriceParsed.value = results
}

async function applyBulkPrices() {
  const matched = bulkPriceParsed.value.filter(r => r.matched)
  if (matched.length === 0) return

  bulkPriceApplying.value = true
  try {
    for (const row of matched) {
      row.item.factory_price = row.price
      // Auto-calculate selling price if markup exists
      const rate = props.order?.exchange_rate
      if (row.item.markup_percent != null && rate) {
        row.item.selling_price = +(row.item.factory_price * (1 + row.item.markup_percent / 100)).toFixed(2)
        row.item.selling_price_inr = +(row.item.selling_price * rate).toFixed(2)
        delete customPriceFlags.value[row.item.id]
      }
      await saveItemPrice(row.item)
    }
    // Close modal and reset
    showBulkPriceModal.value = false
    bulkPriceText.value = ''
    bulkPriceParsed.value = []
  } catch (err) {
    console.error('Bulk price apply failed:', err)
  } finally {
    bulkPriceApplying.value = false
  }
}

async function handlePriceExcelUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  priceExcelParsing.value = true
  try {
    // Client-side Excel parsing via ExcelJS (no backend needed)
    const buffer = await file.arrayBuffer()
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer)
    const ws = wb.worksheets[0]
    if (!ws) { alert('Empty Excel file'); return }
    const rows = []
    ws.eachRow({ includeEmpty: true }, (row) => {
      // row.values is 1-indexed — drop index 0 and flatten cell objects
      const cells = row.values.slice(1).map((v) => {
        if (v == null) return ''
        if (typeof v === 'object' && !(v instanceof Date)) {
          return v.result ?? v.text ?? (v.richText?.map((r) => r.text).join('') ?? '')
        }
        return v
      })
      rows.push(cells)
    })
    if (!rows.length) { alert('Empty Excel file'); return }

    // Auto-detect columns from header row
    let codeCol = null, priceCol = null, headerIdx = 0
    const partNoCols = []
    const priceCols = []
    for (let ri = 0; ri < Math.min(5, rows.length); ri++) {
      const row = rows[ri]
      for (let ci = 0; ci < (row?.length || 0); ci++) {
        const val = String(row[ci] || '').trim().toLowerCase()
        if (['part no', 'part code', 'manufacturer', 'code', 'mfr'].some(kw => val.includes(kw))) {
          partNoCols.push({ ci, val, ri })
        }
        if (['price', 'unit price', '单价'].some(kw => val.includes(kw))) {
          priceCols.push(ci); headerIdx = ri
        }
      }
    }
    // Prefer MFR Part No. column; otherwise use second Part No column (factory Excel: first=barcode, second=MFR)
    if (partNoCols.length) {
      const mfrCol = partNoCols.find(c => c.val.includes('mfr') || c.val.includes('manufacturer'))
      if (mfrCol) {
        codeCol = mfrCol.ci; headerIdx = mfrCol.ri
      } else if (partNoCols.length >= 2) {
        codeCol = partNoCols[1].ci; headerIdx = partNoCols[1].ri
      } else {
        codeCol = partNoCols[0].ci; headerIdx = partNoCols[0].ri
      }
    }
    // Use LAST price column (factory format has summary price early, actual price later)
    if (priceCols.length) priceCol = priceCols[priceCols.length - 1]
    // Fallback: col 3 = MFR Part No, col 8 = UNIT PRICE (factory format)
    if (codeCol === null && (rows[0]?.length || 0) >= 8) { codeCol = 3; priceCol = 8; headerIdx = 0 }
    if (codeCol === null || priceCol === null) {
      alert('Could not find part code and price columns. Expected headers like "Part No." and "UNIT PRICE".')
      return
    }

    // Parse data rows
    const entries = []
    for (let ri = headerIdx + 1; ri < rows.length; ri++) {
      const row = rows[ri]
      if (!row) continue
      const code = String(row[codeCol] || '').trim()
      const priceRaw = row[priceCol]
      if (!code) continue
      const price = parseFloat(priceRaw)
      if (!isNaN(price) && price > 0) entries.push({ code, price })
    }

    // Match parsed entries against active order items
    const items = activeItems.value
    const results = []
    for (const entry of entries) {
      const matchedItem = items.find(i => i.product_code === entry.code)
      results.push({
        code: entry.code,
        price: entry.price,
        matched: !!matchedItem,
        item: matchedItem || null,
      })
    }
    bulkPriceParsed.value = results
  } catch (err) {
    console.error('Excel parse error:', err)
    alert('Failed to parse Excel file: ' + (err.message || 'Unknown error'))
  } finally {
    priceExcelParsing.value = false
    event.target.value = ''  // Reset file input
  }
}

function closeBulkPriceModal() {
  showBulkPriceModal.value = false
  bulkPriceText.value = ''
  bulkPriceParsed.value = []
}

// ========================================
// PI (Proforma Invoice) functions
// ========================================
async function generatePI() {
  generatingPI.value = true
  piError.value = ''
  piResult.value = null
  try {
    const { data } = await quotationsApi.generatePI(props.orderId)
    piResult.value = data
    emit('reload')
  } catch (err) {
    piError.value = err.response?.data?.detail || 'Failed to generate PI'
  } finally {
    generatingPI.value = false
  }
}

async function downloadPI() {
  try {
    const { data } = await quotationsApi.downloadPI(props.orderId)
    const blob = new Blob([data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `PI_${props.order?.order_number || props.orderId}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Download PI failed:', err)
    piError.value = err.response?.data?.detail || 'Failed to download PI'
  }
}

async function downloadPIWithImages() {
  downloadingPIImages.value = true
  piError.value = ''
  try {
    const { data } = await quotationsApi.downloadPIWithImages(props.orderId)
    const blob = new Blob([data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `PI_${props.order?.order_number || props.orderId}_with_images.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Download PI with images failed:', err)
    piError.value = err.response?.data?.detail || 'Failed to download PI with images'
  } finally {
    downloadingPIImages.value = false
  }
}

// ========================================
// Sorting
// ========================================
function toggleSort(key) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortOrder.value = 'asc'
  }
}

// ========================================
// Item management functions (Stage 2)
// ========================================

// Load products for the add item browser
async function loadProductsForAdd() {
  addItemLoading.value = true
  try {
    const params = { page: addItemPage.value, per_page: addItemPerPage }
    if (addItemSearch.value.trim()) params.search = addItemSearch.value.trim()
    if (addItemCategory.value) params.category = addItemCategory.value
    const { data } = await productsApi.list(params)
    const existingActiveIds = new Set(activeItems.value.map(i => i.product_id))
    const existingRemovedIds = new Set(removedItems.value.map(i => i.product_id))
    addItemResults.value = (data.items || []).map(p => ({
      ...p,
      alreadyAdded: existingActiveIds.has(p.id),
      wasRemoved: existingRemovedIds.has(p.id),
    }))
    addItemTotal.value = data.total || 0
  } catch (err) {
    console.error('Load products failed:', err)
  } finally {
    addItemLoading.value = false
  }
}

let addItemSearchTimer = null
function onAddItemSearch() {
  clearTimeout(addItemSearchTimer)
  addItemSearchTimer = setTimeout(() => {
    addItemPage.value = 1
    loadProductsForAdd()
  }, 400)
}

function onAddItemCategoryChange() {
  addItemPage.value = 1
  loadProductsForAdd()
}

async function openAddItemModal() {
  showAddItemModal.value = true
  addItemSearch.value = ''
  addItemCategory.value = ''
  addItemPage.value = 1
  if (addItemCategories.value.length === 0) {
    try {
      const { data } = await productsApi.categories()
      addItemCategories.value = data
    } catch (err) { /* ignore */ }
  }
  await loadProductsForAdd()
}

const addItemTotalPages = computed(() => Math.ceil(addItemTotal.value / addItemPerPage))

function addItemGoToPage(p) {
  if (p >= 1 && p <= addItemTotalPages.value) {
    addItemPage.value = p
    loadProductsForAdd()
  }
}

async function addProductToOrder(product) {
  addingItem.value = true
  try {
    await ordersApi.addItems(props.orderId, { items: [{ product_id: product.id, quantity: 1 }] })
    emit('reload')
    // Mark as added in the browser list
    const idx = addItemResults.value.findIndex(p => p.id === product.id)
    if (idx >= 0) addItemResults.value[idx].alreadyAdded = true
  } catch (err) {
    console.error('Failed to add item:', err)
  } finally {
    addingItem.value = false
  }
}

// Bulk selection
function toggleSelectAll() {
  if (allItemsSelected.value) {
    selectedItems.value = new Set()
  } else {
    selectedItems.value = new Set(activeItems.value.map(i => i.id))
  }
}

function toggleSelectItem(itemId) {
  const s = new Set(selectedItems.value)
  if (s.has(itemId)) s.delete(itemId)
  else s.add(itemId)
  selectedItems.value = s
}

// Remove items
function openRemoveSingle(itemId) {
  removeTargetIds.value = [itemId]
  removeCancelNote.value = ''
  showRemoveModal.value = true
}

function openRemoveBulk() {
  if (selectedItems.value.size === 0) return
  removeTargetIds.value = [...selectedItems.value]
  removeCancelNote.value = ''
  showRemoveModal.value = true
}

async function confirmRemoveItems() {
  removingItems.value = true
  try {
    const note = removeCancelNote.value.trim() || null
    for (const itemId of removeTargetIds.value) {
      await ordersApi.removeItemWithNote(props.orderId, itemId, note)
    }
    selectedItems.value = new Set()
    showRemoveModal.value = false
    emit('reload')
  } catch (err) {
    console.error('Failed to remove items:', err)
  } finally {
    removingItems.value = false
  }
}

async function quickRemoveItem(item) {
  try {
    await ordersApi.removeItemWithNote(props.orderId, item.id, null)
    emit('reload')
  } catch (err) {
    console.error('Failed to remove item:', err)
  }
}

// Fetch pending carry-forward + unloaded items
const fetchingPendingItems = ref(false)
const fetchPendingResult = ref(null)
async function fetchPendingItems() {
  fetchingPendingItems.value = true
  fetchPendingResult.value = null
  try {
    const { data } = await ordersApi.fetchPendingItems(props.orderId)
    fetchPendingResult.value = data
    if (data.total_added > 0) {
      emit('reload')
    }
  } catch (err) {
    console.error('Failed to fetch pending items:', err)
    fetchPendingResult.value = { message: err.response?.data?.detail || 'Failed to fetch pending items', total_added: 0 }
  } finally {
    fetchingPendingItems.value = false
    setTimeout(() => { fetchPendingResult.value = null }, 5000)
  }
}

// Edit quantity inline
function startEditQty(item) {
  editingQty.value[item.id] = item.quantity
}

async function saveEditQty(item) {
  const newQty = parseInt(editingQty.value[item.id])
  delete editingQty.value[item.id]
  if (!newQty || newQty < 1 || newQty === item.quantity) return
  try {
    await ordersApi.updateItem(props.orderId, item.id, { quantity: newQty })
    emit('reload')
  } catch (err) {
    console.error('Failed to update quantity:', err)
  }
}

function cancelEditQty(item) {
  delete editingQty.value[item.id]
}
</script>

<template>
  <div>
    <!-- Main Content: 2 columns -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left: Order Info + Items -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Order Info Card -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Order Info</h3>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span class="text-slate-400 block">Client</span>
              <span class="font-medium text-slate-800">{{ order.client_name }}</span>
            </div>
            <div>
              <span class="text-slate-400 block">Factory</span>
              <span class="font-medium text-slate-800">{{ order.factory_name || '\u2014' }}</span>
            </div>
            <div>
              <span class="text-slate-400 block">Factory Currency</span>
              <span class="font-medium text-slate-800">{{ order.currency }}</span>
            </div>
            <div>
              <span class="text-slate-400 block">Client Currency</span>
              <span class="font-medium text-slate-800">INR</span>
            </div>
            <div v-if="!isDraft">
              <span class="text-slate-400 block">Exchange Rate</span>
              <span class="font-medium text-slate-800">{{ order.exchange_rate ? `1 ${order.currency} = \u20B9${order.exchange_rate}` : '\u2014' }}</span>
            </div>
            <div>
              <span class="text-slate-400 block">Created</span>
              <span class="font-medium text-slate-800">{{ formatDate(order.created_at) }}</span>
            </div>
            <div>
              <span class="text-slate-400 block">Items</span>
              <span class="font-medium text-slate-800">{{ order.item_count }}</span>
            </div>
            <div v-if="!isDraft">
              <span class="text-slate-400 block">Total ({{ order.currency }})</span>
              <span class="font-medium text-slate-800">{{ order.total_value_cny > 0 ? order.total_value_cny.toLocaleString() : '\u2014' }}</span>
            </div>
            <div v-if="order.reopen_count > 0">
              <span class="text-slate-400 block">Re-opens</span>
              <span class="font-medium text-amber-600">{{ order.reopen_count }}x</span>
            </div>
          </div>
          <div v-if="order.notes" class="mt-3 pt-3 border-t border-slate-100">
            <span class="text-xs text-slate-400">Notes:</span>
            <p class="text-sm text-slate-600 mt-1">{{ order.notes }}</p>
          </div>
        </div>

        <!-- Carried Items Summary Banner -->
        <div v-if="carriedItems.length > 0" class="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3 flex-wrap">
          <i class="pi pi-replay text-slate-500" />
          <span class="text-sm text-slate-700 font-medium">{{ carriedItems.length }} item{{ carriedItems.length > 1 ? 's' : '' }} carried from previous orders:</span>
          <span v-if="unloadedCarried.length > 0" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
            <i class="pi pi-inbox text-[9px] mr-1" /> {{ unloadedCarried.length }} Unloaded
          </span>
          <span v-if="aftersalesCarried.length > 0" class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
            <i class="pi pi-exclamation-triangle text-[9px] mr-1" /> {{ aftersalesCarried.length }} After-Sales
          </span>
        </div>

        <!-- PI Staleness Warning Banner -->
        <div v-if="piIsStale" class="p-4 bg-red-50 border-2 border-red-300 rounded-xl flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <i class="pi pi-exclamation-triangle text-red-600 text-lg" />
            <div>
              <p class="text-sm font-semibold text-red-800">Items changed since last PI</p>
              <p class="text-xs text-red-600 mt-0.5">Regenerate the Proforma Invoice before advancing to the next stage.</p>
            </div>
          </div>
          <button
            @click="generatePI"
            :disabled="generatingPI"
            class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
          >
            <i :class="generatingPI ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'" class="text-xs" />
            {{ generatingPI ? 'Generating...' : 'Regenerate PI' }}
          </button>
        </div>

        <!-- ==========================================
             PI (Proforma Invoice) Actions
             ========================================== -->
        <div v-if="isPostPI" ref="piActionsRef" class="bg-white rounded-xl shadow-sm overflow-hidden border-2 border-orange-200">
          <div class="px-6 py-4 border-b border-orange-200 bg-orange-50">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-orange-800 uppercase tracking-wider flex items-center gap-2">
                  <i class="pi pi-file text-orange-600" /> Proforma Invoice
                </h3>
                <p class="text-xs text-orange-600 mt-0.5">Generate and download PI for the client</p>
              </div>
              <div class="flex items-center gap-2">
                <button
                  v-if="canGeneratePI"
                  @click="generatePI"
                  :disabled="generatingPI"
                  class="px-4 py-2 text-sm font-medium text-orange-700 bg-orange-100 border border-orange-300 rounded-lg hover:bg-orange-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <i :class="generatingPI ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'" class="text-xs" />
                  {{ generatingPI ? 'Generating...' : (piResult ? 'Regenerate PI' : 'Generate PI') }}
                </button>
                <button
                  @click="downloadPIWithImages"
                  :disabled="downloadingPIImages"
                  class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <i :class="downloadingPIImages ? 'pi pi-spin pi-spinner' : 'pi pi-download'" class="text-xs" />
                  {{ downloadingPIImages ? 'Generating...' : 'Download PI' }}
                </button>
              </div>
            </div>

            <!-- PI Generation Result -->
            <div v-if="piResult" class="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
              <div class="flex items-center gap-2 mb-2">
                <i class="pi pi-check-circle text-emerald-600 text-sm" />
                <span class="text-sm font-semibold text-emerald-700">PI Generated Successfully</span>
              </div>
              <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span class="text-slate-500 block">PI Number</span>
                  <span class="font-mono font-medium text-slate-800">{{ piResult.pi_number }}</span>
                </div>
                <div>
                  <span class="text-slate-500 block">Total (INR)</span>
                  <span class="font-medium text-slate-800">&#8377;{{ piResult.grand_total_inr?.toLocaleString() }}</span>
                </div>
                <div>
                  <span class="text-slate-500 block">Advance ({{ piResult.advance_percent }}%)</span>
                  <span class="font-medium text-emerald-700">&#8377;{{ piResult.advance_amount_inr?.toLocaleString() }}</span>
                </div>
                <div>
                  <span class="text-slate-500 block">Balance</span>
                  <span class="font-medium text-slate-800">&#8377;{{ piResult.balance_amount_inr?.toLocaleString() }}</span>
                </div>
              </div>
            </div>

            <!-- PI Error -->
            <div v-if="piError" class="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700 flex items-start gap-2">
              <i class="pi pi-exclamation-triangle text-xs mt-0.5" />
              <span>{{ piError }}</span>
            </div>
          </div>
        </div>

        <!-- ==========================================
             PRICING SECTION (Stage 2 — PENDING_PI)
             ========================================== -->
        <div v-if="canEditPrices && isEditing" class="bg-white rounded-xl shadow-sm overflow-hidden border-2 border-amber-200">
          <div class="px-6 py-4 border-b border-amber-200 bg-amber-50">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-sm font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-2">
                  <i class="pi pi-calculator text-amber-600" /> Pricing &amp; Items — Stage 2
                </h3>
                <p class="text-xs text-amber-600 mt-1">
                  Manage items, enter factory prices, and set selling prices. All items need selling prices before generating PI.
                </p>
              </div>
              <div class="flex items-center gap-2">
                <button @click="isEditing = false"
                  class="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1">
                  <i class="pi pi-check text-[10px]" /> Done
                </button>
                <button @click="refreshTable"
                  class="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1">
                  <i class="pi pi-refresh text-[10px]" /> Refresh
                </button>
                <button
                  @click="openAddItemModal()"
                  class="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1"
                >
                  <i class="pi pi-plus text-[10px]" />
                  Add Item
                </button>
                <button
                  @click="showBulkAddModal = true"
                  class="px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors flex items-center gap-1"
                >
                  <i class="pi pi-list text-[10px]" />
                  Bulk Add
                </button>
                <button
                  v-if="order.factory_id"
                  @click="fetchPendingItems"
                  :disabled="fetchingPendingItems"
                  class="px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <i :class="fetchingPendingItems ? 'pi pi-spin pi-spinner' : 'pi pi-download'" class="text-[10px]" />
                  Fetch Pending Items
                </button>
                <button
                  v-if="selectedItems.size > 0"
                  @click="openRemoveBulk"
                  class="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1"
                >
                  <i class="pi pi-trash text-[10px]" />
                  Remove ({{ selectedItems.size }})
                </button>
                <button
                  v-if="canEditFactoryPrices"
                  @click="copyFromPreviousOrder"
                  :disabled="copyingPrices"
                  class="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <i :class="copyingPrices ? 'pi pi-spin pi-spinner' : 'pi pi-copy'" class="text-[10px]" />
                  Copy from Last Order
                </button>
                <button
                  v-if="canEditFactoryPrices"
                  @click="applyMarkupToAll"
                  :disabled="applyingMarkup"
                  class="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <i :class="applyingMarkup ? 'pi pi-spin pi-spinner' : 'pi pi-percentage'" class="text-[10px]" />
                  {{ applyingMarkup ? 'Saving...' : 'Apply Markup' }}
                </button>
                <button
                  v-if="canEditFactoryPrices"
                  @click="showBulkPriceModal = true"
                  class="px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors flex items-center gap-1"
                >
                  <i class="pi pi-list text-[10px]" />
                  Bulk Price Upload
                </button>
                <router-link
                  v-if="canModifyItems && canEditFactoryPrices"
                  :to="`/orders/${orderId}/upload-excel`"
                  class="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-1"
                >
                  <i class="pi pi-file-excel text-[10px]" />
                  Upload Excel
                </router-link>
              </div>
            </div>

            <!-- Copy result message -->
            <div v-if="copyResult" class="mt-2 space-y-2">
              <div :class="['px-3 py-2 rounded-lg text-xs', copyResult.copied > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600']">
                {{ copyResult.message }}
              </div>
              <!-- Price sources: which order each price came from -->
              <div v-if="copyResult.price_sources && Object.keys(copyResult.price_sources).length" class="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                <p class="font-semibold mb-1">Price sources:</p>
                <p class="font-mono">{{ Object.entries(copyResult.price_sources).map(([code, ord]) => `${code} \u2190 ${ord}`).join(', ') }}</p>
              </div>
              <!-- Caution: items with no past order history -->
              <div v-if="copyResult.not_found && copyResult.not_found.length" class="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                <div class="flex items-start gap-2">
                  <i class="pi pi-exclamation-triangle text-amber-500 mt-0.5" />
                  <div>
                    <p class="font-semibold text-amber-700">{{ copyResult.not_found.length }} part{{ copyResult.not_found.length > 1 ? 's' : '' }} have no past order history:</p>
                    <p class="text-amber-600 mt-0.5 font-mono">{{ copyResult.not_found.join(', ') }}</p>
                    <p class="text-amber-500 mt-1">Enter prices manually or use bulk price upload.</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Missing prices — show SPECIFIC items -->
            <div v-if="itemsMissingPrices > 0" class="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <div class="flex items-start gap-2">
                <i class="pi pi-exclamation-triangle text-red-500 text-xs mt-0.5" />
                <div class="text-xs">
                  <p class="font-semibold text-red-700">
                    {{ itemsMissingPrices }} item{{ itemsMissingPrices > 1 ? 's' : '' }} missing selling price:
                  </p>
                  <p class="text-red-600 mt-0.5 font-mono">
                    {{ itemsMissingPricesList.join(', ') }}
                  </p>
                </div>
              </div>
            </div>
            <div v-if="itemsMissingFactoryPrice > 0 && itemsMissingFactoryPrice !== itemsMissingPrices" class="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <div class="flex items-start gap-2">
                <i class="pi pi-info-circle text-amber-500 text-xs mt-0.5" />
                <div class="text-xs">
                  <p class="font-semibold text-amber-700">
                    {{ itemsMissingFactoryPrice }} item{{ itemsMissingFactoryPrice > 1 ? 's' : '' }} missing factory price:
                  </p>
                  <p class="text-amber-600 mt-0.5 font-mono">
                    {{ itemsMissingFactoryPriceList.join(', ') }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- Active Items Pricing Table -->
          <div ref="pricingTableRef" class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="bg-amber-50/50 border-b border-slate-200">
                  <th class="px-3 py-2 w-10">
                    <input
                      type="checkbox"
                      :checked="allItemsSelected"
                      :indeterminate="someItemsSelected"
                      @change="toggleSelectAll"
                      class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </th>
                  <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">#</th>
                  <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700" @click="toggleSort('product_code')">
                    Product
                    <i v-if="sortKey === 'product_code'" :class="sortOrder === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'" class="text-[10px] ml-1 text-blue-500" />
                    <i v-else class="pi pi-sort-alt text-[10px] ml-1 opacity-30" />
                  </th>
                  <th class="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700" @click="toggleSort('quantity')">
                    Qty
                    <i v-if="sortKey === 'quantity'" :class="sortOrder === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'" class="text-[10px] ml-1 text-blue-500" />
                    <i v-else class="pi pi-sort-alt text-[10px] ml-1 opacity-30" />
                  </th>
                  <th v-if="!isTransparencyClient || showDualPriceColumns" class="text-right px-3 py-2 text-xs font-semibold text-amber-700 uppercase cursor-pointer select-none hover:text-amber-900" @click="toggleSort('factory_price')">
                    {{ showDualPriceColumns ? 'Real Factory' : 'Factory' }} ({{ order.currency }})
                    <i v-if="sortKey === 'factory_price'" :class="sortOrder === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'" class="text-[10px] ml-1 text-blue-500" />
                    <i v-else class="pi pi-sort-alt text-[10px] ml-1 opacity-30" />
                  </th>
                  <!-- Transparency ADMIN: single "Factory (USD)" column showing client_factory_price -->
                  <th v-if="isTransparencyClient && !showDualPriceColumns" class="text-right px-3 py-2 text-xs font-semibold text-amber-700 uppercase">Factory ({{ order.currency }})</th>
                  <th v-if="showDualPriceColumns" class="text-right px-3 py-2 text-xs font-semibold text-indigo-600 uppercase">Client Factory ({{ order.currency }})</th>
                  <th v-if="!isTransparencyClient" class="text-right px-3 py-2 text-xs font-semibold text-amber-700 uppercase">Markup %</th>
                  <template v-if="isTransparencyClient">
                    <th class="text-right px-3 py-2 text-xs font-semibold text-emerald-700 uppercase">Client Factory (INR)</th>
                  </template>
                  <template v-else>
                    <th class="text-right px-3 py-2 text-xs font-semibold text-emerald-700 uppercase cursor-pointer select-none hover:text-emerald-900" @click="toggleSort('selling_price_inr')">
                      Selling (INR)
                      <i v-if="sortKey === 'selling_price_inr'" :class="sortOrder === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'" class="text-[10px] ml-1 text-blue-500" />
                      <i v-else class="pi pi-sort-alt text-[10px] ml-1 opacity-30" />
                    </th>
                  </template>
                  <th class="text-right px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Total</th>
                  <th class="px-3 py-2 w-24 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <template v-for="(item, i) in sortedItems" :key="item.id">
                <tr
                  :class="[
                    'transition-colors',
                    getCarryForwardInfo(item) ? getCarriedRowClass(item) : 'hover:bg-amber-50/30',
                    selectedItems.has(item.id) ? 'bg-blue-50/40' : '',
                    !item.selling_price_inr && !getCarryForwardInfo(item) ? 'bg-red-50/20' : ''
                  ]"
                >
                  <!-- Checkbox -->
                  <td class="px-3 py-2.5">
                    <input
                      type="checkbox"
                      :checked="selectedItems.has(item.id)"
                      @change="toggleSelectItem(item.id)"
                      class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </td>
                  <!-- Row number -->
                  <td class="px-3 py-2.5 text-xs text-slate-400">{{ i + 1 }}</td>
                  <!-- Product info -->
                  <td class="px-3 py-2.5">
                    <span class="text-sm font-mono text-slate-800">{{ item.product_code }}</span>
                    <span class="text-xs text-slate-500 ml-1.5">{{ item.product_name }}</span>
                    <span v-if="getCarryForwardInfo(item)?.type === 'unloaded'" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 ml-2">
                      <i class="pi pi-inbox text-[8px] mr-0.5" /> Unloaded
                    </span>
                    <span v-else-if="getCarryForwardInfo(item)?.type === 'aftersales'" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-700 ml-2">
                      <i class="pi pi-exclamation-triangle text-[8px] mr-0.5" /> {{ getAfterSalesLabel(item) }}
                    </span>
                    <span v-else-if="hasAfterSalesTwin(item)" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 ml-2" title="Also exists as After-Sales carry-forward in this order">
                      <i class="pi pi-exclamation-triangle text-[8px] mr-0.5" /> Also in After-Sales
                    </span>
                  </td>
                  <!-- Quantity (editable on double-click) -->
                  <td class="px-3 py-2.5 text-center">
                    <template v-if="editingQty[item.id] != null">
                      <input
                        v-model.number="editingQty[item.id]"
                        type="number"
                        min="1"
                        class="w-16 px-1.5 py-0.5 border border-blue-300 rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                        @blur="saveEditQty(item)"
                        @keyup.enter="saveEditQty(item)"
                        @keyup.escape="cancelEditQty(item)"
                      />
                    </template>
                    <template v-else>
                      <span
                        class="text-sm font-medium text-slate-700 cursor-pointer hover:text-blue-600 hover:underline"
                        @dblclick="startEditQty(item)"
                        title="Double-click to edit quantity"
                      >{{ item.quantity }}</span>
                    </template>
                  </td>
                  <!-- Factory Price (SUPER_ADMIN sees real price; ADMIN for transparency sees client_factory_price) -->
                  <td v-if="!isTransparencyClient || showDualPriceColumns" class="px-3 py-2.5 text-right">
                    <input
                      v-model.number="item.factory_price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      :disabled="getCarryForwardInfo(item)?.type === 'aftersales'"
                      :class="[
                        'w-24 px-2 py-1 border rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-400',
                        getCarryForwardInfo(item)?.type === 'aftersales' ? 'border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed' : 'border-amber-200 bg-amber-50/50'
                      ]"
                      @blur="handleFactoryOrMarkupBlur(item)"
                    />
                  </td>
                  <!-- Transparency ADMIN: factory_price is already masked to client_factory_price by backend -->
                  <td v-if="isTransparencyClient && !showDualPriceColumns" class="px-3 py-2.5 text-right">
                    <span v-if="item.factory_price != null" class="inline-block px-2 py-1 rounded bg-amber-50 text-amber-800 font-mono text-xs font-medium border border-amber-200">
                      {{ Number(item.factory_price).toFixed(2) }}
                    </span>
                    <span v-else class="text-slate-300 text-xs">—</span>
                  </td>
                  <!-- Client Factory Price (SUPER_ADMIN + TRANSPARENCY only — dual column) -->
                  <td v-if="showDualPriceColumns" class="px-3 py-2.5 text-right">
                    <span v-if="cfp(item) != null" class="inline-block px-2 py-1 rounded bg-amber-50 text-amber-800 font-mono text-xs font-medium border border-amber-200">
                      {{ Number(cfp(item)).toFixed(2) }}
                    </span>
                    <span v-else class="text-slate-300 text-xs">auto-calc</span>
                  </td>
                  <!-- Markup % (hidden for transparency clients — fixed per client) -->
                  <td v-if="!isTransparencyClient" class="px-3 py-2.5 text-right">
                    <input
                      v-model.number="item.markup_percent"
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="%"
                      :disabled="getCarryForwardInfo(item)?.type === 'aftersales'"
                      :class="[
                        'w-20 px-2 py-1 border rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-400',
                        getCarryForwardInfo(item)?.type === 'aftersales' ? 'border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed' : 'border-slate-200'
                      ]"
                      @blur="handleFactoryOrMarkupBlur(item)"
                    />
                  </td>
                  <!-- Transparency: Client Factory (INR) — read-only auto-calc -->
                  <!-- SUPER_ADMIN: use client_factory_price; ADMIN: use factory_price (already masked to cfp) -->
                  <td v-if="isTransparencyClient" class="px-3 py-2.5 text-right">
                    <span v-if="(cfp(item)) != null && order.exchange_rate" class="inline-block px-2 py-1 rounded bg-emerald-50 text-emerald-800 font-mono text-xs font-medium border border-emerald-200">
                      {{ (Number(cfp(item)) * Number(order.exchange_rate)).toFixed(2) }}
                    </span>
                    <span v-else class="text-slate-300 text-xs">—</span>
                  </td>
                  <!-- Selling Price INR (hidden for transparency — they use landed cost) -->
                  <template v-if="!isTransparencyClient">
                  <td class="px-3 py-2.5 text-right">
                    <div class="flex items-center justify-end gap-1">
                      <i
                        v-if="customPriceFlags[item.id]"
                        class="pi pi-exclamation-triangle text-[10px] text-orange-500"
                        title="Custom price: manually entered, not calculated from markup"
                      />
                      <input
                        v-model.number="item.selling_price_inr"
                        type="number"
                        step="0.01"
                        :min="getCarryForwardInfo(item)?.type === 'aftersales' ? undefined : 0"
                        placeholder="0.00"
                        :disabled="getCarryForwardInfo(item)?.type === 'aftersales'"
                        :class="[
                          'w-28 px-2 py-1 border rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-400',
                          getCarryForwardInfo(item)?.type === 'aftersales' ? 'border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed' :
                          !item.selling_price_inr ? 'border-red-300 bg-red-50' :
                          customPriceFlags[item.id] ? 'border-orange-300 bg-orange-50/50' :
                          'border-emerald-200 bg-emerald-50/50'
                        ]"
                        @blur="handleSellingPriceBlur(item)"
                      />
                    </div>
                  </td>
                  </template>
                  <!-- Per-item Total -->
                  <td class="px-3 py-2.5 text-right">
                    <span v-if="isTransparencyClient && cfp(item) != null && order.exchange_rate" class="text-sm font-semibold text-slate-700">
                      {{ '\u20B9' + (Number(cfp(item)) * Number(order.exchange_rate) * (Number(item.quantity) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                    </span>
                    <span v-else-if="!isTransparencyClient && item.selling_price_inr" class="text-sm font-semibold text-slate-700">
                      {{ '\u20B9' + (Number(item.selling_price_inr) * (Number(item.quantity) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                    </span>
                    <span v-else class="text-slate-300 text-xs">&mdash;</span>
                  </td>
                  <!-- Actions column -->
                  <td class="px-3 py-2.5 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                      <!-- Save indicator -->
                      <i v-if="priceSaving[item.id]" class="pi pi-spin pi-spinner text-xs text-amber-500" />
                      <i v-else-if="getCarryForwardInfo(item)?.type === 'aftersales'" class="pi pi-lock text-xs text-slate-400" title="After-sales (fixed pricing)" />
                      <i v-else-if="item.selling_price_inr && !customPriceFlags[item.id]" class="pi pi-check-circle text-xs text-emerald-500" />
                      <i v-else-if="item.selling_price_inr && customPriceFlags[item.id]" class="pi pi-check-circle text-xs text-orange-500" title="Saved (custom price)" />
                      <i v-else class="pi pi-circle text-xs text-slate-300" />
                      <!-- Remove button -->
                      <button
                        @click="openRemoveSingle(item.id)"
                        class="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Remove item"
                      >
                        <i class="pi pi-times text-[10px]" />
                      </button>
                    </div>
                  </td>
                </tr>
                <!-- Separator after last carried item -->
                <tr v-if="isLastCarriedItem(i)" class="h-0">
                  <td colspan="9" class="p-0">
                    <div class="h-0.5 bg-slate-300"></div>
                  </td>
                </tr>
                </template>
              </tbody>
              <tfoot v-if="nonAftersalesItems.length > 0" class="bg-gradient-to-r from-slate-100 to-indigo-50 border-t-2 border-slate-300">
                <tr>
                  <td class="px-3 py-3"></td>
                  <td class="px-3 py-3"></td>
                  <td class="px-3 py-3 text-sm font-bold text-slate-700 uppercase">Totals</td>
                  <td class="px-3 py-3 text-center text-sm font-bold text-slate-800">{{ totalQty.toLocaleString() }}</td>
                  <td class="px-3 py-3 text-right text-sm font-bold text-amber-700">${{ totalFactoryUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                  <td v-if="showDualPriceColumns" class="px-3 py-3 text-right text-sm font-bold text-indigo-700">${{ totalClientFactoryUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                  <td v-if="!isTransparencyClient" class="px-3 py-3"></td>
                  <td class="px-3 py-3 text-right text-sm font-bold text-emerald-700">
                    &#8377;{{ (isTransparencyClient ? totalClientFactoryInr : totalSellingInr).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                  </td>
                  <td class="px-3 py-3 text-right text-sm font-bold text-slate-800">
                    &#8377;{{ (isTransparencyClient ? totalClientFactoryInr : totalSellingInr).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                  </td>
                  <td class="px-3 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Pricing footer -->
          <div class="px-6 py-3 border-t border-amber-200 bg-amber-50/50 flex items-center justify-between text-xs">
            <span class="text-amber-700">
              Prices auto-save on blur. Markup auto-calculates selling price (1 {{ order.currency }} = &#8377;{{ order.exchange_rate || '?' }}).
              <span class="text-orange-600 ml-1">
                <i class="pi pi-exclamation-triangle text-[8px]" /> = Custom price entered directly.
              </span>
            </span>
            <span v-if="itemsMissingPrices === 0" class="text-emerald-600 font-semibold flex items-center gap-1">
              <i class="pi pi-check-circle text-[10px]" /> All items priced — ready for PI
            </span>
          </div>
        </div>

        <!-- ==========================================
             REMOVED ITEMS TABLE (visible when items removed)
             ========================================== -->
        <div v-if="canEditPrices && isEditing && removedItems.length > 0" class="bg-white rounded-xl shadow-sm overflow-hidden border border-red-200">
          <div class="px-6 py-3 border-b border-red-200 bg-red-50/50 cursor-pointer select-none" @click="showRemovedItems = !showRemovedItems">
            <h3 class="text-sm font-semibold text-red-700 uppercase tracking-wider flex items-center gap-2">
              <i :class="showRemovedItems ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" class="text-red-500 text-xs" />
              <i class="pi pi-ban text-red-500 text-xs" /> Removed Items ({{ removedItems.length }})
            </h3>
          </div>
          <div v-show="showRemovedItems" class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="bg-red-50/30 border-b border-slate-200">
                  <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">#</th>
                  <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Code</th>
                  <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Product</th>
                  <th class="text-center px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Qty</th>
                  <th class="text-left px-4 py-2 text-xs font-semibold text-red-600 uppercase">Cancel Note</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="(item, i) in removedItems" :key="item.id" class="bg-red-50/20">
                  <td class="px-4 py-2 text-xs text-slate-400">{{ i + 1 }}</td>
                  <td class="px-4 py-2 text-sm font-mono text-slate-500 line-through">{{ item.product_code }}</td>
                  <td class="px-4 py-2 text-sm text-slate-500 line-through">
                    {{ item.product_name }}
                    <span v-if="item.part_type || item.dimension || item.material" class="text-xs text-slate-400 ml-1">({{ [item.part_type, item.dimension, item.material].filter(Boolean).join(' · ') }})</span>
                  </td>
                  <td class="px-4 py-2 text-center text-sm text-slate-500">{{ item.quantity }}</td>
                  <td class="px-4 py-2 text-sm text-red-600">
                    {{ item.cancel_note || '\u2014' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Fetch Pending Items Result Banner -->
        <div v-if="fetchPendingResult" class="p-3 rounded-lg text-sm flex items-center gap-2" :class="fetchPendingResult.total_added > 0 ? 'bg-teal-50 border border-teal-200 text-teal-800' : 'bg-slate-50 border border-slate-200 text-slate-600'">
          <i :class="fetchPendingResult.total_added > 0 ? 'pi pi-check-circle text-teal-600' : 'pi pi-info-circle text-slate-400'" />
          {{ fetchPendingResult.message }}
        </div>

        <!-- Unpriced Items Warning Banner -->
        <div v-if="unpricedNewItems.size > 0" class="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl flex items-start gap-3">
          <i class="pi pi-exclamation-triangle text-amber-500 text-lg mt-0.5" />
          <div>
            <p class="text-sm font-semibold text-amber-800">{{ unpricedNewItems.size }} newly added item(s) need pricing</p>
            <p class="text-xs text-amber-600 mt-0.5">Set prices below using the inline inputs, then regenerate PI.</p>
          </div>
        </div>

        <!-- Pending Additions grouped by lot -->
        <template v-if="(pendingAdditions.length > 0 || rejectedAdditions.length > 0) && (!canEditPrices || !isEditing)">
        <div v-for="group in pendingByLot" :key="group.lot"
          class="bg-white rounded-xl shadow-sm overflow-hidden border-2 mb-3"
          :class="'border-l-4 ' + getLotColor(group.lot).border">
          <div class="px-6 py-3 border-b flex items-center justify-between" :class="getLotColor(group.lot).bg">
            <h3 class="text-sm font-semibold uppercase tracking-wider flex items-center gap-2"
              :class="getLotColor(group.lot).badge.split(' ')[1]">
              <i class="pi pi-clock" />
              Lot {{ group.lot }} — {{ group.items.length }} item(s)
              <span v-if="group.items.every(i => i.selling_price_inr || (isTransparencyClient && cfp(i)))"
                class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium bg-indigo-100 text-indigo-700 ml-1">
                Sent to Client
              </span>
              <span v-else class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium bg-slate-100 text-slate-500 ml-1">
                Set Prices
              </span>
            </h3>
            <div class="flex items-center gap-2">
              <router-link v-if="canEditFactoryPrices"
                :to="`/orders/${orderId}/upload-excel?pending_only=true`"
                class="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-1">
                <i class="pi pi-file-excel text-[10px]" /> Upload Excel
              </router-link>
              <button v-if="canModifyItems" @click="openAddItemModal()"
                class="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 border border-amber-300 rounded-lg hover:bg-amber-200 transition-colors flex items-center gap-1">
                <i class="pi pi-plus text-[10px]" /> Add Item
              </button>
              <button v-if="group.items.every(i => i.selling_price_inr || (isTransparencyClient && cfp(i))) && !pricesSent"
                @click="sendPricesToClient" :disabled="sendingPrices"
                class="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 border border-indigo-700 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1">
                <i :class="sendingPrices ? 'pi pi-spin pi-spinner' : 'pi pi-send'" class="text-[10px]" /> Send Prices to Client
              </button>
              <span v-if="pricesSent" class="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                <i class="pi pi-check-circle text-[10px] mr-1" /> Prices Sent
              </span>
            </div>
          </div>
          <table class="w-full">
            <thead>
              <tr :class="getLotColor(group.lot).bg + ' border-b'">
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase w-8">#</th>
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Code</th>
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Product</th>
                <th class="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase w-16">Qty</th>
                <th v-if="!isTransparencyClient || showDualPriceColumns" class="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">
                  {{ showDualPriceColumns ? 'Real Fact.' : 'Factory' }} ({{ order.currency }})
                </th>
                <th v-if="isTransparencyClient && !showDualPriceColumns" class="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Factory ({{ order.currency }})</th>
                <th v-if="showDualPriceColumns" class="text-right px-3 py-2 text-xs font-semibold text-indigo-600 uppercase">Client ({{ order.currency }})</th>
                <th v-if="isTransparencyClient" class="text-right px-3 py-2 text-xs font-semibold text-emerald-600 uppercase">Client (INR)</th>
                <th v-else class="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Selling (INR)</th>
                <th class="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase w-24">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(item, i) in group.items" :key="item.id" :class="getLotColor(group.lot).hover">
                <td class="px-3 py-2 text-xs text-slate-400">{{ i + 1 }}</td>
                <td class="px-3 py-2 text-xs font-mono text-slate-800">{{ item.product_code }}</td>
                <td class="px-3 py-2 text-sm text-slate-700">{{ item.product_name }}</td>
                <td class="px-3 py-2 text-center text-sm font-medium text-slate-700">{{ item.quantity }}</td>
                <!-- Real Factory price (editable) -->
                <td v-if="!isTransparencyClient || showDualPriceColumns" class="px-3 py-2 text-right text-sm">
                  <div class="flex items-center justify-end gap-1">
                    <input v-model="(inlinePriceEdit[item.id] = inlinePriceEdit[item.id] || { factory_price: item.factory_price, selling_price_inr: item.selling_price_inr }).factory_price"
                      type="number" step="0.01" min="0" placeholder="Factory"
                      class="w-20 px-2 py-1 text-xs border border-amber-300 rounded bg-amber-50 text-right focus:outline-none focus:ring-1 focus:ring-amber-400" />
                    <button v-if="isTransparencyClient" @click="saveInlinePrice(item)" :disabled="inlinePriceSaving[item.id]"
                      class="px-2 py-1 text-[10px] font-medium text-white bg-amber-500 hover:bg-amber-600 rounded disabled:opacity-50 flex-shrink-0">
                      <i :class="inlinePriceSaving[item.id] ? 'pi pi-spin pi-spinner' : 'pi pi-check'" class="text-[10px]" />
                    </button>
                  </div>
                </td>
                <td v-if="isTransparencyClient && !showDualPriceColumns" class="px-3 py-2 text-right text-sm text-slate-600">
                  <span v-if="cfp(item) != null">{{ Number(cfp(item)).toFixed(2) }}</span><span v-else class="text-slate-300">&mdash;</span>
                </td>
                <td v-if="showDualPriceColumns" class="px-3 py-2 text-right text-sm">
                  <span v-if="cfp(item) != null" class="px-1 py-0.5 rounded bg-amber-50 text-amber-800 font-mono text-xs">{{ Number(cfp(item)).toFixed(2) }}</span><span v-else class="text-slate-300">&mdash;</span>
                </td>
                <td v-if="isTransparencyClient" class="px-3 py-2 text-right text-sm">
                  <span v-if="cfp(item) != null && order.exchange_rate" class="text-emerald-700 font-mono font-medium">₹{{ (Number(cfp(item)) * Number(order.exchange_rate)).toFixed(2) }}</span><span v-else class="text-slate-300">&mdash;</span>
                </td>
                <td v-else class="px-3 py-2 text-right text-sm">
                  <div class="flex items-center justify-end gap-1">
                    <input v-model="(inlinePriceEdit[item.id] = inlinePriceEdit[item.id] || { factory_price: item.factory_price, selling_price_inr: item.selling_price_inr }).selling_price_inr"
                      type="number" step="0.01" min="0" placeholder="Selling ₹"
                      class="w-20 px-2 py-1 text-xs border border-amber-300 rounded bg-amber-50 text-right focus:outline-none focus:ring-1 focus:ring-amber-400" />
                    <button @click="saveInlinePrice(item)" :disabled="inlinePriceSaving[item.id]"
                      class="px-2 py-1 text-[10px] font-medium text-white bg-amber-500 hover:bg-amber-600 rounded disabled:opacity-50 flex-shrink-0">
                      <i :class="inlinePriceSaving[item.id] ? 'pi pi-spin pi-spinner' : 'pi pi-check'" class="text-[10px]" />
                    </button>
                  </div>
                </td>
                <td class="px-3 py-2 text-center">
                  <span v-if="item.selling_price_inr || (isTransparencyClient && cfp(item))" class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-100 text-indigo-700">Sent to Client</span>
                  <span v-else class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">Set Price</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Rejected items -->
        <div v-if="rejectedAdditions.length > 0" class="bg-white rounded-xl shadow-sm overflow-hidden border border-red-200 mb-3">
          <div class="px-6 py-2 bg-red-50">
            <span class="text-xs font-medium text-red-600 uppercase">Rejected ({{ rejectedAdditions.length }})</span>
          </div>
          <table class="w-full">
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(item, i) in rejectedAdditions" :key="item.id" class="opacity-30">
                <td class="px-4 py-2 text-xs text-slate-400">{{ i + 1 }}</td>
                <td class="px-4 py-2 text-sm font-mono text-slate-800">{{ item.product_code }}</td>
                <td class="px-4 py-2 text-sm text-slate-700">{{ item.product_name }}</td>
                <td class="px-4 py-2 text-center text-sm text-slate-700">{{ item.quantity }}</td>
                <td class="px-4 py-2 text-right text-sm text-slate-600">{{ item.factory_price ?? '—' }}</td>
                <td class="px-4 py-2 text-center">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">Rejected</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        </template>

        <!-- Client Confirmed Items — awaiting admin final approval -->
        <div v-if="clientConfirmedItems.length > 0 && (!canEditPrices || !isEditing)" class="bg-white rounded-xl shadow-sm overflow-hidden border-2 border-emerald-300 mb-3">
          <div class="px-6 py-3 border-b border-emerald-200 bg-emerald-50 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-2">
              <i class="pi pi-check-circle text-emerald-600" />
              Client Confirmed ({{ clientConfirmedItems.length }})
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium bg-emerald-100 text-emerald-700">
                Prices Accepted — Approve to Add
              </span>
            </h3>
            <button @click="bulkConfirmPending('approve')" :disabled="bulkConfirmingPending"
              class="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 border border-emerald-700 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1">
              <i :class="bulkConfirmingPending ? 'pi pi-spin pi-spinner' : 'pi pi-check-circle'" class="text-[10px]" /> Approve &amp; Add to Order
            </button>
          </div>
          <table class="w-full">
            <thead>
              <tr class="bg-emerald-50/50 border-b border-emerald-100">
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase w-8">#</th>
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Code</th>
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Product</th>
                <th class="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase w-16">Qty</th>
                <th v-if="!isTransparencyClient || showDualPriceColumns" class="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Factory ({{ order.currency }})</th>
                <th v-if="isTransparencyClient" class="text-right px-3 py-2 text-xs font-semibold text-emerald-600 uppercase">Client (INR)</th>
                <th v-else class="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Selling (INR)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-emerald-100">
              <tr v-for="(item, i) in clientConfirmedItems" :key="item.id" class="hover:bg-emerald-50/50">
                <td class="px-3 py-2 text-xs text-slate-400">{{ i + 1 }}</td>
                <td class="px-3 py-2 text-xs font-mono text-slate-800">{{ item.product_code }}</td>
                <td class="px-3 py-2 text-sm text-slate-700">{{ item.product_name }}</td>
                <td class="px-3 py-2 text-center text-sm font-medium text-slate-700">{{ item.quantity }}</td>
                <td v-if="!isTransparencyClient || showDualPriceColumns" class="px-3 py-2 text-right text-sm text-slate-600">
                  {{ item.factory_price != null ? item.factory_price.toFixed(2) : '—' }}
                </td>
                <td v-if="isTransparencyClient" class="px-3 py-2 text-right text-sm text-emerald-700 font-mono font-medium">
                  <span v-if="cfp(item) != null && order.exchange_rate">₹{{ (Number(cfp(item)) * Number(order.exchange_rate)).toFixed(2) }}</span>
                  <span v-else class="text-slate-300">—</span>
                </td>
                <td v-else class="px-3 py-2 text-right text-sm text-slate-600">
                  {{ item.selling_price_inr != null ? '₹' + item.selling_price_inr.toFixed(2) : '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Items Table (read-only for non-pricing stages, or pricing view mode) -->
        <div v-if="!canEditPrices || (canEditPrices && !isEditing)" class="bg-white rounded-xl shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider">Order Items ({{ confirmedItems.length }})</h3>
            <div class="flex items-center gap-2">
              <button @click="emit('reload')"
                class="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1">
                <i class="pi pi-refresh text-[10px]" /> Refresh
              </button>
              <button
                v-if="canModifyItems && !canEditPrices"
                @click="openAddItemModal()"
                class="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1"
              >
                <i class="pi pi-plus text-[10px]" />
                Add Item
              </button>
              <button
                v-if="canModifyItems && !canEditPrices"
                @click="showBulkAddModal = true"
                class="px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors flex items-center gap-1"
              >
                <i class="pi pi-list text-[10px]" />
                Bulk Add
              </button>
              <button
                v-if="canModifyItems && !canEditPrices && order.factory_id"
                @click="fetchPendingItems"
                :disabled="fetchingPendingItems"
                class="px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <i :class="fetchingPendingItems ? 'pi pi-spin pi-spinner' : 'pi pi-download'" class="text-[10px]" />
                Fetch Pending Items
              </button>
              <router-link
                v-if="canModifyItems && canEditFactoryPrices"
                :to="`/orders/${orderId}/upload-excel`"
                class="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-1"
              >
                <i class="pi pi-file-excel text-[10px]" />
                Upload Excel
              </router-link>
              <button @click="showQueryColumn = !showQueryColumn; if (showQueryColumn) loadInlineStatus()"
                class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1"
                :class="showQueryColumn ? 'text-white bg-indigo-600 border border-indigo-700 hover:bg-indigo-700' : 'text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100'">
                <i class="pi pi-comments text-[10px]" />
                Queries
                <span v-if="Object.keys(inlineQueryStatus).length" class="ml-0.5 text-[9px]">({{ Object.values(inlineQueryStatus).filter(s => s.status === 'OPEN').length }})</span>
              </button>
            </div>
          </div>
          <div v-if="confirmedItems.length > 0">
            <table class="w-full table-fixed">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200">
                  <th class="text-left px-2 py-2 text-xs font-semibold text-slate-500 uppercase w-[3%]">#</th>
                  <th class="text-center px-1 py-2 text-xs font-semibold text-slate-500 uppercase w-[4%]">Img</th>
                  <th class="text-left px-2 py-2 text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700 w-[13%]" @click="toggleSort('product_code')">
                    Code
                    <i v-if="sortKey === 'product_code'" :class="sortOrder === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'" class="text-[10px] ml-1 text-blue-500" />
                    <i v-else class="pi pi-sort-alt text-[10px] ml-1 opacity-30" />
                  </th>
                  <th class="text-left px-2 py-2 text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700" @click="toggleSort('product_name')">
                    Product
                    <i v-if="sortKey === 'product_name'" :class="sortOrder === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'" class="text-[10px] ml-1 text-blue-500" />
                    <i v-else class="pi pi-sort-alt text-[10px] ml-1 opacity-30" />
                  </th>
                  <th class="text-center px-2 py-2 text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700 w-[6%]" @click="toggleSort('quantity')">
                    Qty
                    <i v-if="sortKey === 'quantity'" :class="sortOrder === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'" class="text-[10px] ml-1 text-blue-500" />
                    <i v-else class="pi pi-sort-alt text-[10px] ml-1 opacity-30" />
                  </th>
                  <th class="text-center px-2 py-2 text-xs font-semibold text-slate-500 uppercase w-[12%]">Query</th>
                  <!-- Price columns only for non-DRAFT stages (pricing happens at Pending PI) -->
                  <template v-if="!isDraft">
                    <th v-if="!isTransparencyClient || showDualPriceColumns" class="text-right px-2 py-2 text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700 w-[10%]" @click="toggleSort('factory_price')">
                      {{ showDualPriceColumns ? 'Real Fact.' : 'Factory' }} ({{ order.currency }})
                      <i v-if="sortKey === 'factory_price'" :class="sortOrder === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'" class="text-[10px] ml-1 text-blue-500" />
                      <i v-else class="pi pi-sort-alt text-[10px] ml-1 opacity-30" />
                    </th>
                    <th v-if="isTransparencyClient && !showDualPriceColumns" class="text-right px-2 py-2 text-xs font-semibold text-slate-500 uppercase w-[10%]">Factory ({{ order.currency }})</th>
                    <th v-if="showDualPriceColumns" class="text-right px-2 py-2 text-xs font-semibold text-indigo-600 uppercase w-[10%]">
                      Client Fact. ({{ order.currency }})
                    </th>
                    <template v-if="isTransparencyClient">
                      <th class="text-right px-2 py-2 text-xs font-semibold text-emerald-600 uppercase w-[10%]">Client (INR)</th>
                    </template>
                    <template v-else>
                      <th class="text-right px-2 py-2 text-xs font-semibold text-slate-500 uppercase cursor-pointer select-none hover:text-slate-700 w-[10%]" @click="toggleSort('selling_price_inr')">
                        Selling (INR)
                        <i v-if="sortKey === 'selling_price_inr'" :class="sortOrder === 'asc' ? 'pi pi-sort-amount-up-alt' : 'pi pi-sort-amount-down'" class="text-[10px] ml-1 text-blue-500" />
                        <i v-else class="pi pi-sort-alt text-[10px] ml-1 opacity-30" />
                      </th>
                    </template>
                    <th class="text-right px-2 py-2 text-xs font-semibold text-slate-600 uppercase w-[12%]">Total</th>
                  </template>
                  <th v-if="showQueryColumn" class="text-left px-2 py-2 text-xs font-semibold text-indigo-600 uppercase">Query / Reply</th>
                  <th v-if="canModifyItems && !canEditPrices" class="text-center px-2 py-2 text-xs font-semibold text-slate-500 uppercase w-[4%]"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <template v-for="(item, i) in sortedItems" :key="item.id">
                  <tr :class="getCarryForwardInfo(item) ? getCarriedRowClass(item) : item.pi_item_status === 'APPROVED' ? getLotRowClass(item) : 'hover:bg-slate-50'">
                    <td class="px-2 py-2 text-xs text-slate-400">{{ i + 1 }}</td>
                    <td class="px-1 py-1 text-center">
                      <img v-if="getItemImageUrl(item)" :src="getItemImageUrl(item)"
                        class="w-8 h-8 object-contain rounded border border-slate-200 cursor-pointer hover:ring-2 hover:ring-indigo-300 mx-auto"
                        :alt="item.product_code" @click="openImageViewer(getItemImageUrl(item), item.product_code + ' — ' + item.product_name)" />
                      <span v-else class="text-slate-300 text-[10px]"><i class="pi pi-image" /></span>
                    </td>
                    <td class="px-2 py-2 text-xs font-mono text-slate-800 truncate">{{ item.product_code }}</td>
                    <td class="px-2 py-2 text-sm text-slate-700 truncate">
                      {{ item.product_name }}
                      <span v-if="item.part_type || item.dimension || item.material" class="text-xs text-slate-400 ml-1">({{ [item.part_type, item.dimension, item.material].filter(Boolean).join(' · ') }})</span>
                      <span v-if="item.pi_item_status === 'APPROVED'" :class="['inline-flex items-center px-1 py-0.5 rounded text-[9px] font-medium ml-1 whitespace-nowrap', getLotColor(item.pi_addition_lot).badge]" :title="'Added Mid-Order — Lot ' + (item.pi_addition_lot || 1)">
                        <i class="pi pi-plus-circle text-[8px] mr-0.5" />Lot {{ item.pi_addition_lot || 1 }}
                      </span>
                      <span v-else-if="getCarryForwardInfo(item)?.type === 'unloaded'" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 ml-2">
                        <i class="pi pi-inbox text-[8px] mr-0.5" /> Carried from {{ getCarryForwardInfo(item).from }}
                      </span>
                      <span v-else-if="getCarryForwardInfo(item)?.type === 'aftersales'" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-700 ml-2">
                        <i class="pi pi-exclamation-triangle text-[8px] mr-0.5" /> {{ getAfterSalesLabel(item) }} from {{ getCarryForwardInfo(item).from }}
                      </span>
                      <span v-else-if="hasAfterSalesTwin(item)" class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-50 text-yellow-700 border border-yellow-200 ml-2" title="Also exists as After-Sales carry-forward in this order">
                        <i class="pi pi-exclamation-triangle text-[8px] mr-0.5" /> Also in After-Sales
                      </span>
                      <button @click.stop="openQueryPanel(item)"
                        class="inline-flex items-center gap-1 ml-2 px-1.5 py-0.5 rounded transition-colors"
                        :class="{
                          'bg-red-100 text-red-700 hover:bg-red-200 ring-1 ring-red-300': getItemQueryStatus(item.id) === 'OPEN',
                          'bg-emerald-50 text-emerald-700 hover:bg-emerald-100': getItemQueryStatus(item.id) === 'RESOLVED',
                          'text-slate-400 hover:text-indigo-600': !getItemQueryStatus(item.id),
                        }"
                        :title="getItemQueryStatus(item.id) === 'OPEN' ? `${getItemQueryCounts(item.id).open} open queries` : getItemQueryStatus(item.id) === 'RESOLVED' ? `${getItemQueryCounts(item.id).resolved} resolved` : 'Item Queries'">
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
                    <td class="px-2 py-1.5 text-center text-sm font-medium text-slate-700">{{ item.quantity }}</td>
                    <!-- Query Status Column (clickable) -->
                    <td class="px-2 py-1.5 text-center cursor-pointer"
                      @click.stop="(getItemQueryCounts(item.id).open > 0 || getItemQueryCounts(item.id).resolved > 0 || inlineQueryStatus[item.id]) ? openQueryPanel(item) : openNewQueryForItem(item)">
                      <template v-if="inlineQueryStatus[item.id]?.status === 'OPEN' || inlineQueryStatus[item.id]?.status === 'REPLIED'">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700 ring-1 ring-red-200 hover:bg-red-200 transition-colors">
                          <span class="w-1.5 h-1.5 rounded-full bg-red-500 mr-1 animate-pulse" />
                          {{ QUERY_TYPE_LABELS[inlineQueryStatus[item.id]?.query_type]?.label || 'OPEN' }}
                        </span>
                      </template>
                      <template v-else-if="inlineQueryStatus[item.id]?.status === 'RESOLVED'">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 max-w-full truncate hover:bg-emerald-100 transition-colors"
                          :title="inlineQueryStatus[item.id]?.resolution_remark || 'Resolved'">
                          <i class="pi pi-check text-[7px] mr-1 flex-shrink-0" />
                          {{ inlineQueryStatus[item.id]?.resolution_remark || 'Resolved' }}
                        </span>
                      </template>
                      <template v-else-if="getItemQueryCounts(item.id).open > 0">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700 ring-1 ring-red-200 hover:bg-red-200 transition-colors">
                          <span class="w-1.5 h-1.5 rounded-full bg-red-500 mr-1 animate-pulse" />
                          {{ QUERY_TYPE_LABELS[allItemQueries.find(q => q.order_item_id === item.id && q.status !== 'RESOLVED')?.query_type]?.label || 'OPEN' }}
                        </span>
                      </template>
                      <template v-else-if="getItemQueryCounts(item.id).resolved > 0">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 max-w-full truncate hover:bg-emerald-100 transition-colors"
                          :title="allItemQueries.find(q => q.order_item_id === item.id && q.status === 'RESOLVED')?.resolution_remark || 'Resolved'">
                          <i class="pi pi-check text-[7px] mr-1 flex-shrink-0" />
                          {{ allItemQueries.find(q => q.order_item_id === item.id && q.status === 'RESOLVED')?.resolution_remark || 'Resolved' }}
                        </span>
                      </template>
                      <template v-else>
                        <span class="text-[9px] text-indigo-400 hover:text-indigo-600 transition-colors">
                          <i class="pi pi-plus text-[8px] mr-0.5" /> Ask
                        </span>
                      </template>
                    </td>
                    <template v-if="!isDraft">
                      <!-- Real factory price: visible only for regular clients OR SUPER_ADMIN dual view -->
                      <td v-if="!isTransparencyClient || showDualPriceColumns" class="px-2 py-1.5 text-right text-sm text-slate-600">
                        <template v-if="unpricedNewItems.has(item.id)">
                          <input
                            v-model="(inlinePriceEdit[item.id] = inlinePriceEdit[item.id] || { factory_price: null, selling_price_inr: null }).factory_price"
                            type="number" step="0.01" min="0"
                            placeholder="Factory"
                            class="w-16 px-1 py-1 text-xs border border-amber-300 rounded bg-amber-50 text-right focus:outline-none focus:ring-1 focus:ring-amber-400"
                          />
                        </template>
                        <template v-else>
                          {{ item.factory_price != null ? item.factory_price.toFixed(2) : '\u2014' }}
                        </template>
                      </td>
                      <!-- Transparency ADMIN: show client_factory_price as "Factory (USD)" -->
                      <td v-if="isTransparencyClient && !showDualPriceColumns" class="px-2 py-1.5 text-right text-sm text-slate-600">
                        <span v-if="cfp(item) != null">{{ Number(cfp(item)).toFixed(2) }}</span>
                        <span v-else class="text-slate-300">&mdash;</span>
                      </td>
                      <!-- Client Factory Price (SUPER_ADMIN + TRANSPARENCY only — dual column) -->
                      <td v-if="showDualPriceColumns" class="px-2 py-1.5 text-right text-sm">
                        <span v-if="cfp(item) != null" class="inline-block px-1 py-0.5 rounded bg-amber-50 text-amber-800 font-mono text-xs font-medium">
                          {{ Number(cfp(item)).toFixed(2) }}
                        </span>
                        <span v-else class="text-slate-300">&mdash;</span>
                      </td>
                      <!-- Transparency: Client Factory (INR) read-only -->
                      <td v-if="isTransparencyClient" class="px-2 py-1.5 text-right text-sm">
                        <span v-if="cfp(item) != null && order.exchange_rate" class="text-emerald-700 font-mono font-medium">
                          {{ '\u20B9' + (Number(cfp(item)) * Number(order.exchange_rate)).toFixed(2) }}
                        </span>
                        <span v-else class="text-slate-300">&mdash;</span>
                      </td>
                      <!-- Regular: Selling Price (INR) -->
                      <td v-else class="px-2 py-1.5 text-right text-sm text-slate-600">
                        <template v-if="unpricedNewItems.has(item.id)">
                          <div class="flex items-center justify-end gap-1">
                            <input
                              v-model="(inlinePriceEdit[item.id] = inlinePriceEdit[item.id] || { factory_price: null, selling_price_inr: null }).selling_price_inr"
                              type="number" step="0.01" min="0"
                              placeholder="Selling ₹"
                              class="w-20 px-2 py-1 text-xs border border-amber-300 rounded bg-amber-50 text-right focus:outline-none focus:ring-1 focus:ring-amber-400"
                            />
                            <button
                              @click="saveInlinePrice(item)"
                              :disabled="inlinePriceSaving[item.id]"
                              class="px-2 py-1 text-[10px] font-medium text-white bg-amber-500 hover:bg-amber-600 rounded disabled:opacity-50 flex-shrink-0"
                              title="Set price"
                            >
                              <i :class="inlinePriceSaving[item.id] ? 'pi pi-spin pi-spinner' : 'pi pi-check'" class="text-[10px]" />
                            </button>
                          </div>
                        </template>
                        <template v-else>
                          {{ item.selling_price_inr != null ? '\u20B9' + item.selling_price_inr.toFixed(2) : '\u2014' }}
                        </template>
                      </td>
                    </template>
                    <!-- Per-item Total (read-only) -->
                    <template v-if="!isDraft">
                      <td class="px-2 py-1.5 text-right text-sm">
                        <span v-if="isTransparencyClient && cfp(item) != null && order.exchange_rate" class="font-semibold text-slate-700">
                          {{ '\u20B9' + (Number(cfp(item)) * Number(order.exchange_rate) * (Number(item.quantity) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                        </span>
                        <span v-else-if="!isTransparencyClient && item.selling_price_inr" class="font-semibold text-slate-700">
                          {{ '\u20B9' + (Number(item.selling_price_inr) * (Number(item.quantity) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                        </span>
                        <span v-else class="text-slate-300">&mdash;</span>
                      </td>
                    </template>
                    <!-- Inline Query Column -->
                    <td v-if="showQueryColumn" class="px-2 py-1 align-top">
                      <div class="space-y-1">
                        <!-- Last query message -->
                        <div v-if="inlineQueryStatus[item.id]?.last_query" class="text-[10px] text-slate-600 bg-slate-50 rounded px-2 py-1 truncate">
                          <span class="font-medium text-teal-700">Q:</span> {{ inlineQueryStatus[item.id].last_query }}
                        </div>
                        <!-- Last reply message -->
                        <div v-if="inlineQueryStatus[item.id]?.last_reply" class="text-[10px] text-slate-600 bg-indigo-50 rounded px-2 py-1 truncate">
                          <span class="font-medium text-indigo-700">A:</span> {{ inlineQueryStatus[item.id].last_reply }}
                        </div>
                        <!-- Inline input -->
                        <div class="flex items-center gap-1">
                          <div class="w-2 h-2 rounded-full flex-shrink-0" :class="{
                            'bg-red-500': getItemQueryStatus(item.id) === 'OPEN',
                            'bg-emerald-500': getItemQueryStatus(item.id) === 'RESOLVED',
                            'bg-slate-200': !getItemQueryStatus(item.id),
                          }" />
                          <input v-model="inlineQueryInput[item.id]"
                            @keyup.enter="sendInlineQuery(item)"
                            :placeholder="inlineQueryStatus[item.id] ? 'Reply...' : 'Ask query...'"
                            class="flex-1 text-[10px] px-2 py-0.5 border border-slate-200 rounded focus:border-indigo-300 focus:outline-none min-w-0" />
                          <button @click="sendInlineQuery(item)" :disabled="inlineSending[item.id] || !(inlineQueryInput[item.id] || '').trim()"
                            class="text-indigo-600 hover:text-indigo-800 disabled:opacity-30 flex-shrink-0">
                            <i :class="inlineSending[item.id] ? 'pi pi-spin pi-spinner' : 'pi pi-send'" class="text-[9px]" />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td v-if="canModifyItems && !canEditPrices" class="px-2 py-1.5 text-center">
                      <button
                        @click="quickRemoveItem(item)"
                        class="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove item"
                      >
                        <i class="pi pi-times text-xs" />
                      </button>
                    </td>
                  </tr>
                  <!-- Separator after last carried item -->
                  <tr v-if="isLastCarriedItem(i)" class="h-0">
                    <td :colspan="isDraft ? 5 : (canModifyItems && !canEditPrices ? 8 : 7)" class="p-0">
                      <div class="h-0.5 bg-slate-300"></div>
                    </td>
                  </tr>
                </template>
              </tbody>
              <tfoot v-if="!isDraft && nonAftersalesItems.length > 0" class="bg-gradient-to-r from-slate-100 to-indigo-50 border-t-2 border-slate-300">
                <tr>
                  <td class="px-4 py-3"></td>
                  <td class="px-4 py-3"></td>
                  <td class="px-4 py-3 text-sm font-bold text-slate-700 uppercase">Totals ({{ nonAftersalesItems.length }} items)</td>
                  <td class="px-4 py-3 text-center text-sm font-bold text-slate-800">{{ totalQty.toLocaleString() }}</td>
                  <td class="px-4 py-3 text-right text-sm font-bold text-amber-700">${{ totalFactoryUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                  <td v-if="showDualPriceColumns" class="px-4 py-3 text-right text-sm font-bold text-indigo-700">${{ totalClientFactoryUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</td>
                  <td class="px-4 py-3 text-right text-sm font-bold text-emerald-700">
                    &#8377;{{ (isTransparencyClient ? totalClientFactoryInr : totalSellingInr).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                  </td>
                  <td class="px-4 py-3 text-right text-sm font-bold text-slate-800">
                    &#8377;{{ (isTransparencyClient ? totalClientFactoryInr : totalSellingInr).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                  </td>
                  <td v-if="canModifyItems && !canEditPrices" class="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div v-else class="p-8 text-center text-slate-400 text-sm">No items</div>
        </div>

        <!-- Removed Items for non-pricing stages (or pricing view mode) -->
        <div v-if="(!canEditPrices || (canEditPrices && !isEditing)) && removedItems.length > 0" class="bg-white rounded-xl shadow-sm overflow-hidden border border-red-200">
          <div class="px-6 py-3 border-b border-red-200 bg-red-50/50 cursor-pointer select-none" @click="showRemovedItems = !showRemovedItems">
            <h3 class="text-sm font-semibold text-red-700 uppercase tracking-wider flex items-center gap-2">
              <i :class="showRemovedItems ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" class="text-red-500 text-xs" />
              <i class="pi pi-ban text-red-500 text-xs" /> Removed Items ({{ removedItems.length }})
            </h3>
          </div>
          <div v-show="showRemovedItems" class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="bg-red-50/30 border-b border-slate-200">
                  <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Code</th>
                  <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Product</th>
                  <th class="text-center px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Qty</th>
                  <th class="text-left px-4 py-2 text-xs font-semibold text-red-600 uppercase">Cancel Note</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="item in removedItems" :key="item.id" class="bg-red-50/20">
                  <td class="px-4 py-2 text-sm font-mono text-slate-500 line-through">{{ item.product_code }}</td>
                  <td class="px-4 py-2 text-sm text-slate-500 line-through">{{ item.product_name }}</td>
                  <td class="px-4 py-2 text-center text-sm text-slate-500">{{ item.quantity }}</td>
                  <td class="px-4 py-2 text-sm text-red-600">{{ item.cancel_note || '\u2014' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Right Sidebar: Quick Info + Pricing Guide -->
      <div class="space-y-6">
        <!-- Quick Info -->
        <div class="bg-white rounded-xl shadow-sm p-6">
          <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Quick Info</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-slate-400">Status</span>
              <span class="font-medium text-slate-700">{{ order.status }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Stage</span>
              <span class="font-medium text-slate-700">{{ order.stage_number }} / 16</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Factory Curr.</span>
              <span class="font-medium text-slate-700">{{ order.currency }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Client Curr.</span>
              <span class="font-medium text-slate-700">INR</span>
            </div>
            <div v-if="order.exchange_rate" class="flex justify-between">
              <span class="text-slate-400">Rate</span>
              <span class="font-medium text-slate-700">1 {{ order.currency }} = &#8377;{{ order.exchange_rate }}</span>
            </div>
            <div v-if="order.exchange_rate_date" class="flex justify-between">
              <span class="text-slate-400">Rate Date</span>
              <span class="font-medium text-slate-700">{{ formatDate(order.exchange_rate_date) }}</span>
            </div>
            <div v-if="order.completed_at" class="flex justify-between">
              <span class="text-slate-400">Completed</span>
              <span class="font-medium text-slate-700">{{ formatDate(order.completed_at) }}</span>
            </div>
          </div>
        </div>

        <!-- Tentative Invoice Summary -->
        <div v-if="!isDraft && totalFactoryUsd > 0" class="bg-white rounded-xl shadow-sm overflow-hidden border border-indigo-100">
          <div class="px-5 py-3 bg-gradient-to-r from-indigo-50 to-slate-50 border-b border-indigo-100">
            <h3 class="text-sm font-semibold text-indigo-800 flex items-center gap-1.5">
              <i class="pi pi-calculator text-indigo-500 text-xs" />
              Tentative Invoice
            </h3>
            <p class="text-[10px] text-indigo-500 mt-0.5">For advance payment planning</p>
          </div>
          <div class="p-5 space-y-2.5 text-sm">
            <div class="flex justify-between">
              <span class="text-slate-400">Items</span>
              <span class="font-medium text-slate-700">{{ nonAftersalesItems.length }} <span class="text-slate-400 text-xs">({{ totalQty.toLocaleString() }} pcs)</span></span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">Factory ({{ order.currency }})</span>
              <span class="font-medium text-amber-700">${{ totalFactoryUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>
            <div v-if="isTransparencyClient" class="flex justify-between">
              <span class="text-slate-400">Client Invoice ({{ order.currency }})</span>
              <span class="font-medium text-indigo-700">${{ totalClientFactoryUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>
            <div class="border-t border-slate-100 pt-2.5 flex justify-between">
              <span class="text-slate-600 font-semibold">{{ isTransparencyClient ? 'Client Invoice' : 'Selling Total' }}</span>
              <span class="font-bold text-lg text-emerald-700">&#8377;{{ (isTransparencyClient ? totalClientFactoryInr : totalSellingInr).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</span>
            </div>
            <div v-if="order.exchange_rate" class="text-[10px] text-slate-400 flex items-center gap-1 pt-1">
              <i class="pi pi-info-circle text-[8px]" />
              1 {{ order.currency }} = &#8377;{{ order.exchange_rate }}
            </div>
          </div>
        </div>

        <!-- Pricing Guide (visible at Stage 2 when editing) -->
        <div v-if="canEditPrices && isEditing" class="bg-amber-50 rounded-xl border border-amber-200 p-5">
          <h3 class="text-sm font-semibold text-amber-800 mb-2">
            <i class="pi pi-info-circle mr-1" /> Pricing Guide
          </h3>
          <ul class="text-xs text-amber-700 space-y-1.5">
            <li><strong>Factory Price:</strong> Enter the price from factory quotation in {{ order.currency }}</li>
            <li><strong>Markup %:</strong> Your profit margin. Auto-calculates selling price</li>
            <li><strong>Selling Price (INR):</strong> Final client price. Can be entered directly or auto-calculated</li>
            <li><strong><i class="pi pi-exclamation-triangle text-orange-500 text-[9px]" /> Custom Price:</strong> Shown when selling price is entered directly (not from markup)</li>
            <li><strong>Copy from Last Order:</strong> Fetches prices from the most recent order with same factory</li>
            <li><strong>Apply Markup:</strong> Applies 20% default markup to all items with factory price but no selling price</li>
            <li><strong>Bulk Price Upload:</strong> Paste "product_code price" lines to set factory prices in bulk</li>
            <li><strong>Qty Edit:</strong> Double-click quantity to edit inline</li>
            <li><strong>Bulk Remove:</strong> Use checkboxes to select items, then click "Remove" to cancel with a note</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- ==========================================
         MODALS (scoped to Items tab)
         ========================================== -->

    <!-- Add Item Modal (Product Browser) -->
    <div v-if="showAddItemModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showAddItemModal = false">
      <div class="bg-white rounded-xl shadow-xl max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-slate-800">Add Item to Order</h3>
            <p class="text-xs text-slate-500 mt-0.5">Browse or search products from your catalog</p>
          </div>
          <button @click="showAddItemModal = false" class="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <i class="pi pi-times" />
          </button>
        </div>

        <!-- Filters -->
        <div class="px-6 py-3 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
          <div class="relative flex-1">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
            <input
              v-model="addItemSearch"
              @input="onAddItemSearch"
              type="text"
              placeholder="Search by code, name, or material..."
              class="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            v-model="addItemCategory"
            @change="onAddItemCategoryChange"
            class="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[160px]"
          >
            <option value="">All Categories</option>
            <option v-for="cat in addItemCategories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>

        <!-- Product Table -->
        <div class="flex-1 overflow-y-auto min-h-0">
          <div v-if="addItemLoading" class="py-12 text-center text-slate-400">
            <i class="pi pi-spin pi-spinner text-lg" />
            <p class="text-sm mt-2">Loading products...</p>
          </div>
          <div v-else-if="addItemResults.length === 0" class="py-12 text-center text-slate-400 text-sm">
            No products found{{ addItemSearch ? ' for this search' : '' }}
          </div>
          <table v-else class="w-full">
            <thead class="sticky top-0 bg-slate-50 z-10">
              <tr class="border-b border-slate-200">
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Code</th>
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase">Product Name</th>
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase hidden sm:table-cell">Variant</th>
                <th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase hidden sm:table-cell">Category</th>
                <th class="text-center px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase w-24">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="product in addItemResults"
                :key="product.id"
                :class="[
                  'transition-colors',
                  product.alreadyAdded
                    ? 'bg-slate-50 opacity-50'
                    : product.wasRemoved
                    ? 'bg-amber-50/50 hover:bg-amber-50'
                    : 'hover:bg-slate-50'
                ]"
              >
                <td class="px-4 py-2.5">
                  <span class="text-sm font-mono font-medium text-slate-800">{{ product.product_code }}</span>
                  <span v-if="product.alreadyAdded" class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-500">In order</span>
                  <span v-else-if="product.wasRemoved" class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">Removed</span>
                </td>
                <td class="px-4 py-2.5 text-sm text-slate-700 max-w-[200px] truncate">{{ product.product_name }}</td>
                <td class="px-4 py-2.5 text-sm text-slate-500 hidden sm:table-cell">{{ [product.part_type, product.dimension, product.material].filter(Boolean).join(' · ') || '\u2014' }}</td>
                <td class="px-4 py-2.5 text-sm text-slate-500 hidden sm:table-cell">{{ product.category || '\u2014' }}</td>
                <td class="px-4 py-2.5 text-center">
                  <button v-if="product.alreadyAdded" disabled class="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-400 cursor-not-allowed flex items-center gap-1 mx-auto">
                    <i class="pi pi-check text-[10px]" /> Added
                  </button>
                  <button v-else
                    @click="addProductToOrder(product)"
                    :disabled="addingItem"
                    :class="['px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-50 flex items-center gap-1 mx-auto', product.wasRemoved ? 'text-amber-700 bg-amber-100 border border-amber-300 hover:bg-amber-200' : 'text-white bg-indigo-600 hover:bg-indigo-700']"
                  >
                    <i :class="addingItem ? 'pi pi-spin pi-spinner' : (product.wasRemoved ? 'pi pi-replay' : 'pi pi-plus')" class="text-[10px]" />
                    {{ product.wasRemoved ? 'Restore' : 'Add' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div v-if="addItemTotalPages > 1" class="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 bg-slate-50">
          <p class="text-xs text-slate-500">Page {{ addItemPage }} of {{ addItemTotalPages }} ({{ addItemTotal }} products)</p>
          <div class="flex items-center gap-1">
            <button @click="addItemGoToPage(addItemPage - 1)" :disabled="addItemPage === 1" class="px-2.5 py-1 text-xs rounded border border-slate-200 hover:bg-white disabled:opacity-40">
              <i class="pi pi-chevron-left text-[10px]" />
            </button>
            <button @click="addItemGoToPage(addItemPage + 1)" :disabled="addItemPage === addItemTotalPages" class="px-2.5 py-1 text-xs rounded border border-slate-200 hover:bg-white disabled:opacity-40">
              <i class="pi pi-chevron-right text-[10px]" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Bulk Text Add Modal -->
    <div v-if="showBulkAddModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="closeBulkAddModal">
      <div class="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col">
        <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <h3 class="text-base font-semibold text-slate-800">Bulk Add Items</h3>
          <button @click="closeBulkAddModal" class="text-slate-400 hover:text-slate-600">
            <i class="pi pi-times" />
          </button>
        </div>

        <div class="px-6 py-4 flex-1 overflow-y-auto space-y-4">
          <!-- Success state -->
          <div v-if="bulkAddApplied" class="text-center py-8">
            <i class="pi pi-check-circle text-4xl text-emerald-500 mb-3" />
            <p class="text-lg font-semibold text-slate-800">Items Added Successfully</p>
            <p class="text-sm text-slate-500 mt-1">{{ bulkAddApplyItems.length }} item(s) were added to the order.</p>
            <button @click="closeBulkAddModal" class="mt-4 px-4 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">
              Close
            </button>
          </div>

          <template v-else>
            <!-- Input step -->
            <div v-if="bulkAddResults.length === 0">
              <p class="text-sm text-slate-500 mb-2">Paste product codes, one per line. Optionally add quantity after a space.</p>
              <textarea
                v-model="bulkAddText"
                rows="10"
                placeholder="W2.5E-01B-01-11-00 5&#10;W2.5E-01B-01-08-00&#10;W2.5E-01B-01-03-00 2"
                class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              />
            </div>

            <!-- Preview results -->
            <div v-else>
              <!-- Summary counts -->
              <div v-if="bulkAddCounts" class="flex items-center gap-3 flex-wrap">
                <span v-if="bulkAddCounts.found > 0" class="px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                  {{ bulkAddCounts.found }} Found
                </span>
                <span v-if="bulkAddCounts.already_in_order > 0" class="px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                  {{ bulkAddCounts.already_in_order }} Already in Order
                </span>
                <span v-if="bulkAddCounts.not_found > 0" class="px-2.5 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                  {{ bulkAddCounts.not_found }} Not Found
                </span>
                <span v-if="bulkAddCounts.ambiguous > 0" class="px-2.5 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                  {{ bulkAddCounts.ambiguous }} Ambiguous
                </span>
              </div>

              <!-- Results table -->
              <div class="overflow-x-auto border border-slate-200 rounded-lg mt-3">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="bg-slate-50 border-b border-slate-200">
                      <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
                      <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Code</th>
                      <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Product</th>
                      <th class="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Qty</th>
                      <th v-if="bulkAddResults.some(r => r.status === 'ALREADY_IN_ORDER')" class="text-center px-3 py-2 text-xs font-semibold text-amber-600 uppercase">Resolve</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr v-for="(r, idx) in bulkAddResults" :key="idx" :class="{
                      'bg-emerald-50/50': r.status === 'FOUND',
                      'bg-amber-50/50': r.status === 'ALREADY_IN_ORDER' && !bulkDuplicateResolutions[idx],
                      'bg-emerald-50/50': r.status === 'ALREADY_IN_ORDER' && bulkDuplicateResolutions[idx] && bulkDuplicateResolutions[idx] !== 'keep_existing',
                      'bg-slate-50/50': r.status === 'ALREADY_IN_ORDER' && bulkDuplicateResolutions[idx] === 'keep_existing',
                      'bg-red-50/50': r.status === 'NOT_FOUND',
                      'bg-orange-50/50': r.status === 'AMBIGUOUS',
                    }">
                      <td class="px-3 py-2">
                        <span v-if="r.status === 'ALREADY_IN_ORDER' && bulkDuplicateResolutions[idx]"
                          :class="{
                            'bg-emerald-100 text-emerald-700': bulkDuplicateResolutions[idx] === 'club',
                            'bg-blue-100 text-blue-700': bulkDuplicateResolutions[idx] === 'keep_new',
                            'bg-slate-100 text-slate-500': bulkDuplicateResolutions[idx] === 'keep_existing',
                          }" class="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase">
                          {{ bulkDuplicateResolutions[idx] === 'club' ? 'CLUB' : bulkDuplicateResolutions[idx] === 'keep_new' ? 'REPLACE' : 'SKIP' }}
                        </span>
                        <span v-else :class="{
                          'bg-emerald-100 text-emerald-700': r.status === 'FOUND',
                          'bg-amber-100 text-amber-700': r.status === 'ALREADY_IN_ORDER',
                          'bg-red-100 text-red-700': r.status === 'NOT_FOUND',
                          'bg-orange-100 text-orange-700': r.status === 'AMBIGUOUS',
                        }" class="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase">
                          {{ r.status === 'ALREADY_IN_ORDER' ? 'EXISTS' : r.status.replace('_', ' ') }}
                        </span>
                      </td>
                      <td class="px-3 py-2 font-mono text-xs">{{ r.code }}</td>
                      <td class="px-3 py-2 text-xs text-slate-700">
                        <template v-if="r.status === 'AMBIGUOUS' && r.matches.length > 0">
                          <select
                            @change="bulkAddResolveAmbiguous(r, $event.target.value)"
                            class="w-full px-2 py-1 text-xs border border-orange-300 rounded bg-orange-50 focus:ring-1 focus:ring-orange-400 focus:outline-none"
                          >
                            <option value="">Select variant...</option>
                            <option v-for="m in r.matches" :key="m.id" :value="m.id">
                              {{ m.product_name }} {{ m.material ? '(' + m.material + ')' : '' }}
                            </option>
                          </select>
                        </template>
                        <template v-else>
                          {{ r.product_name || '—' }}
                        </template>
                      </td>
                      <td class="px-3 py-2 text-center text-xs font-medium">{{ r.quantity }}</td>
                      <td v-if="r.status === 'ALREADY_IN_ORDER'" class="px-2 py-2">
                        <div class="flex items-center gap-1">
                          <button @click="resolveBulkDuplicate(idx, 'club')"
                            class="px-1.5 py-0.5 text-[9px] font-medium rounded border transition-colors"
                            :class="bulkDuplicateResolutions[idx] === 'club' ? 'bg-emerald-600 text-white border-emerald-600' : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'"
                            title="Add new qty to existing">Club</button>
                          <button @click="resolveBulkDuplicate(idx, 'keep_existing')"
                            class="px-1.5 py-0.5 text-[9px] font-medium rounded border transition-colors"
                            :class="bulkDuplicateResolutions[idx] === 'keep_existing' ? 'bg-slate-600 text-white border-slate-600' : 'text-slate-600 border-slate-200 hover:bg-slate-50'"
                            title="Keep existing, skip new">Keep</button>
                          <button @click="resolveBulkDuplicate(idx, 'keep_new')"
                            class="px-1.5 py-0.5 text-[9px] font-medium rounded border transition-colors"
                            :class="bulkDuplicateResolutions[idx] === 'keep_new' ? 'bg-blue-600 text-white border-blue-600' : 'text-blue-700 border-blue-200 hover:bg-blue-50'"
                            title="Replace existing with new qty">Replace</button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
        </div>

        <div v-if="!bulkAddApplied" class="px-6 py-4 border-t border-slate-200 flex gap-3 justify-between flex-shrink-0">
          <button
            v-if="bulkAddResults.length > 0"
            @click="bulkAddResults = []; bulkAddCounts = null"
            class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1"
          >
            <i class="pi pi-arrow-left text-xs" /> Back
          </button>
          <div v-else></div>
          <div class="flex gap-3">
            <button
              @click="closeBulkAddModal"
              class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              v-if="bulkAddResults.length === 0"
              @click="bulkAddPreview"
              :disabled="bulkAddPreviewing || !bulkAddText.trim()"
              class="px-4 py-2 text-sm text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              <i :class="bulkAddPreviewing ? 'pi pi-spin pi-spinner' : 'pi pi-search'" class="text-xs" />
              {{ bulkAddPreviewing ? 'Checking...' : 'Preview' }}
            </button>
            <button
              v-else
              @click="bulkAddApply"
              :disabled="bulkAddApplying || bulkAddApplyItems.length === 0"
              class="px-4 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
            >
              <i :class="bulkAddApplying ? 'pi pi-spin pi-spinner' : 'pi pi-check'" class="text-xs" />
              {{ bulkAddApplying ? 'Adding...' : `Add ${bulkAddApplyItems.length} Item(s)` }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Remove Item(s) Confirmation Modal -->
    <div v-if="showRemoveModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showRemoveModal = false">
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        <div class="px-6 py-4 border-b border-slate-200">
          <h3 class="text-lg font-semibold text-red-700 flex items-center gap-2">
            <i class="pi pi-exclamation-triangle text-red-500" />
            Remove {{ removeTargetIds.length }} Item{{ removeTargetIds.length > 1 ? 's' : '' }}?
          </h3>
        </div>

        <div class="px-6 py-4">
          <p class="text-sm text-slate-600 mb-3">
            The following item{{ removeTargetIds.length > 1 ? 's' : '' }} will be marked as removed:
          </p>
          <ul class="space-y-1 mb-4 max-h-32 overflow-y-auto">
            <li v-for="name in removeTargetNames" :key="name" class="text-sm text-slate-700 flex items-center gap-2">
              <i class="pi pi-minus-circle text-red-400 text-xs" />
              <span class="font-mono text-xs">{{ name }}</span>
            </li>
          </ul>

          <label class="block text-sm font-medium text-slate-700 mb-1">Cancel Note (optional)</label>
          <textarea
            v-model="removeCancelNote"
            rows="2"
            placeholder="Reason for removing (e.g., Client changed mind, Out of stock)..."
            class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
          />
        </div>

        <div class="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end">
          <button
            @click="showRemoveModal = false"
            :disabled="removingItems"
            class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            @click="confirmRemoveItems"
            :disabled="removingItems"
            class="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            <i v-if="removingItems" class="pi pi-spin pi-spinner text-xs" />
            <i v-else class="pi pi-trash text-xs" />
            Remove
          </button>
        </div>
      </div>
    </div>

    <!-- Bulk Price Upload Modal -->
    <div v-if="showBulkPriceModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="closeBulkPriceModal">
      <div class="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-orange-200 bg-orange-50 rounded-t-xl flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold text-orange-800 flex items-center gap-2">
              <i class="pi pi-list text-orange-600" />
              Bulk Price Upload
            </h3>
            <p class="text-xs text-orange-600 mt-0.5">Upload prices from text paste or Excel file</p>
          </div>
          <button @click="closeBulkPriceModal" class="p-1 text-orange-400 hover:text-orange-600 rounded">
            <i class="pi pi-times" />
          </button>
        </div>

        <!-- Tab Switcher -->
        <div class="px-6 pt-4 flex gap-1 border-b border-slate-200">
          <button
            @click="bulkPriceTab = 'text'; bulkPriceParsed = []"
            :class="['px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors', bulkPriceTab === 'text' ? 'bg-white border-slate-200 text-orange-700 -mb-px' : 'bg-slate-50 border-transparent text-slate-500 hover:text-slate-700']"
          >
            <i class="pi pi-pencil text-xs mr-1" /> Paste Text
          </button>
          <button
            @click="bulkPriceTab = 'excel'; bulkPriceParsed = []"
            :class="['px-4 py-2 text-sm font-medium rounded-t-lg border border-b-0 transition-colors', bulkPriceTab === 'excel' ? 'bg-white border-slate-200 text-orange-700 -mb-px' : 'bg-slate-50 border-transparent text-slate-500 hover:text-slate-700']"
          >
            <i class="pi pi-file-excel text-xs mr-1" /> Upload Excel
          </button>
        </div>

        <!-- Text Paste Input -->
        <div v-if="bulkPriceTab === 'text'" class="px-6 py-4 border-b border-slate-100">
          <label class="block text-sm font-medium text-slate-700 mb-2">
            Paste prices — one per line: <span class="font-mono text-orange-600">product_code price</span>
          </label>
          <textarea
            v-model="bulkPriceText"
            rows="8"
            placeholder="W2.5E-01B-02-38X 4.14
W2.5E-01B-02-07B 4.86
W2.5DA-03H-27-06-00B 0.57
CX0708 100 0.86"
            class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
          />
          <div class="flex items-center justify-between mt-2">
            <p class="text-xs text-slate-400">
              Format: product_code&lt;space or tab&gt;factory_price ({{ order?.currency || 'CNY' }})
            </p>
            <button
              @click="parseBulkPrices"
              :disabled="!bulkPriceText.trim()"
              class="px-4 py-1.5 text-sm font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              Parse &amp; Preview
            </button>
          </div>
        </div>

        <!-- Excel File Upload -->
        <div v-if="bulkPriceTab === 'excel'" class="px-6 py-4 border-b border-slate-100">
          <label class="block text-sm font-medium text-slate-700 mb-2">
            Upload factory price list Excel — system will match prices to this order's items
          </label>
          <div class="border-2 border-dashed border-orange-200 rounded-lg p-6 text-center hover:border-orange-400 transition-colors">
            <i class="pi pi-file-excel text-3xl text-orange-400 mb-2" />
            <p class="text-sm text-slate-600 mb-2">Drop Excel file or click to browse</p>
            <input
              type="file"
              accept=".xlsx,.xls"
              @change="handlePriceExcelUpload"
              class="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
            />
          </div>
          <div v-if="priceExcelParsing" class="mt-3 flex items-center gap-2 text-sm text-orange-600">
            <i class="pi pi-spin pi-spinner text-xs" /> Parsing Excel...
          </div>
          <p class="text-xs text-slate-400 mt-2">
            Supports factory Excel format (Part No. + UNIT PRICE columns). Only prices for items in this order will be matched.
          </p>
        </div>

        <!-- Preview Table -->
        <div v-if="bulkPriceParsed.length > 0" class="flex-1 overflow-y-auto px-6 py-3">
          <!-- Summary -->
          <div class="flex items-center gap-4 mb-3 flex-wrap">
            <span class="text-xs font-medium text-slate-600">
              {{ bulkPriceParsed.length }} lines parsed
            </span>
            <span class="text-xs font-medium text-emerald-600">
              <i class="pi pi-check-circle text-[10px]" />
              {{ bulkPriceParsed.filter(r => r.matched).length }} matched
            </span>
            <span v-if="bulkPriceParsed.some(r => !r.matched)" class="text-xs font-medium text-slate-400">
              <i class="pi pi-minus-circle text-[10px]" />
              {{ bulkPriceParsed.filter(r => !r.matched).length }} not in order
            </span>
          </div>

          <!-- Caution: order items with no price in the upload -->
          <div v-if="orderItemsMissingFromUpload.length > 0" class="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <div class="flex items-start gap-2">
              <i class="pi pi-exclamation-triangle text-amber-500 text-xs mt-0.5" />
              <div class="text-xs">
                <p class="font-semibold text-amber-700">{{ orderItemsMissingFromUpload.length }} order item{{ orderItemsMissingFromUpload.length > 1 ? 's' : '' }} have no price in this upload:</p>
                <p class="text-amber-600 mt-0.5 font-mono">{{ orderItemsMissingFromUpload.map(i => i.product_code).join(', ') }}</p>
                <p class="text-amber-500 mt-1">Enter prices manually or delete these items if not needed.</p>
              </div>
            </div>
          </div>

          <table class="w-full text-sm">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200">
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Product Code</th>
                <th class="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Price ({{ order?.currency || 'CNY' }})</th>
                <th class="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Current Price</th>
                <th class="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="(row, i) in bulkPriceParsed"
                :key="i"
                :class="row.matched ? 'bg-emerald-50/30' : 'bg-red-50/30'"
              >
                <td class="px-3 py-2 font-mono text-slate-800">{{ row.code }}</td>
                <td class="px-3 py-2 text-right font-medium text-slate-700">{{ row.price.toFixed(2) }}</td>
                <td class="px-3 py-2 text-slate-500">
                  <span v-if="row.item">{{ row.item.factory_price ? row.item.factory_price.toFixed(2) : '\u2014' }}</span>
                  <span v-else>\u2014</span>
                </td>
                <td class="px-3 py-2 text-center">
                  <span
                    v-if="row.matched"
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700"
                  >
                    <i class="pi pi-check text-[8px] mr-1" /> Matched
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700"
                  >
                    <i class="pi pi-times text-[8px] mr-1" /> Not Found
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <p v-if="bulkPriceParsed.length > 0" class="text-xs text-slate-500">
            Only matched items will be updated. Not-found items are skipped.
          </p>
          <div v-else></div>
          <div class="flex gap-2">
            <button
              @click="closeBulkPriceModal"
              class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              v-if="bulkPriceParsed.filter(r => r.matched).length > 0"
              @click="applyBulkPrices"
              :disabled="bulkPriceApplying"
              class="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <i v-if="bulkPriceApplying" class="pi pi-spin pi-spinner text-xs" />
              <i v-else class="pi pi-check text-xs" />
              {{ bulkPriceApplying ? 'Applying...' : `Apply ${bulkPriceParsed.filter(r => r.matched).length} Prices` }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ BULK PENDING CONFIRM DIALOG ═══ -->
    <div v-if="showPendingConfirmDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30" @click.self="showPendingConfirmDialog = false">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div class="px-6 pt-6 pb-4 text-center">
          <div class="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4"
            :class="pendingConfirmAction === 'approve' ? 'bg-emerald-100' : 'bg-red-100'">
            <i :class="pendingConfirmAction === 'approve' ? 'pi pi-check-circle text-emerald-600' : 'pi pi-times-circle text-red-600'" class="text-xl" />
          </div>
          <h3 class="text-base font-semibold text-slate-800 mb-1">
            {{ pendingConfirmAction === 'approve' ? 'Approve' : 'Reject' }} Items?
          </h3>
          <p class="text-sm text-slate-500">
            <template v-if="pendingConfirmAction === 'approve' && clientConfirmedItems.length > 0">
              Approve {{ clientConfirmedItems.length }} client-confirmed items and add them to the order with a new lot number.
            </template>
            <template v-else-if="pendingConfirmAction === 'approve'">
              Approve {{ pendingAdditions.length }} pending items and add them to the order.
            </template>
            <template v-else>
              Reject {{ pendingAdditions.length + clientConfirmedItems.length }} items. They will be excluded from the order.
            </template>
          </p>
        </div>
        <div class="flex gap-3 px-6 pb-6 pt-2">
          <button @click="showPendingConfirmDialog = false"
            class="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button @click="executeBulkConfirmPending"
            class="flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors"
            :class="pendingConfirmAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'">
            {{ pendingConfirmAction === 'approve' ? 'Approve All' : 'Reject All' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ═══ ITEM QUERY PANEL (slide-out) ═══ -->
    <div v-if="showQueryPanel" class="fixed inset-0 z-40 flex justify-end" @click.self="showQueryPanel = false">
      <div class="bg-black/20 absolute inset-0" @click="showQueryPanel = false"></div>
      <div class="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full z-10">
        <!-- Header -->
        <div class="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 class="text-sm font-semibold text-slate-800">{{ showNewQueryForm ? 'Ask a Question' : 'Query Threads' }}</h3>
            <p class="text-xs text-slate-500 font-mono mt-0.5">{{ queryPanelItem?.product_code }} — {{ queryPanelItem?.product_name }}</p>
          </div>
          <div class="flex items-center gap-2">
            <button v-if="!showNewQueryForm && queryPanelQueries.length > 0"
              @click="showNewQueryForm = true"
              class="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1">
              <i class="pi pi-plus text-[9px]" /> New Query
            </button>
            <button v-if="showNewQueryForm && queryPanelQueries.length > 0"
              @click="showNewQueryForm = false"
              class="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1">
              <i class="pi pi-comments text-[9px]" /> View Threads ({{ queryPanelQueries.length }})
            </button>
            <button @click="showQueryPanel = false" class="text-slate-400 hover:text-slate-600"><i class="pi pi-times" /></button>
          </div>
        </div>

        <!-- New Query Form -->
        <div v-if="showNewQueryForm" class="px-5 py-3 border-b border-slate-100 bg-indigo-50/50 flex-shrink-0">
          <div class="flex items-center gap-2 mb-2">
            <select v-model="newQueryType" @change="onQueryTypeChange" class="text-xs px-2 py-1 border border-slate-200 rounded bg-white">
              <option value="GENERAL">General</option>
              <option value="PHOTO_REQUEST">Photo Request</option>
              <option value="VIDEO_REQUEST">Video Request</option>
              <option value="DIMENSION_CHECK">Dimension Check</option>
              <option value="QUALITY_QUERY">Quality Query</option>
              <option value="ALTERNATIVE">Alternative</option>
            </select>
            <input v-if="newQueryType === 'GENERAL'" v-model="newQuerySubject" placeholder="Subject..." class="flex-1 text-xs px-2 py-1 border border-slate-200 rounded" />
            <span v-else class="flex-1 text-xs px-2 py-1 text-slate-600">{{ newQuerySubject }}</span>
          </div>
          <div v-if="newQueryType === 'GENERAL'" class="flex gap-2">
            <textarea v-model="newQueryMessage" placeholder="Your question..." rows="2"
              class="flex-1 text-xs px-2 py-1 border border-slate-200 rounded resize-none" />
            <button @click="createQuery" :disabled="creatingQuery || !newQuerySubject.trim() || !newQueryMessage.trim()"
              class="px-3 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 self-end">
              <i :class="creatingQuery ? 'pi pi-spin pi-spinner' : 'pi pi-send'" class="text-[10px]" />
            </button>
          </div>
          <div v-else class="flex gap-2">
            <input v-model="newQueryMessage" placeholder="Add a note (optional)..." class="flex-1 text-xs px-2 py-1 border border-slate-200 rounded" />
            <button @click="createQuery" :disabled="creatingQuery || !newQuerySubject.trim()"
              class="px-3 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50">
              <i :class="creatingQuery ? 'pi pi-spin pi-spinner' : 'pi pi-send'" class="text-[10px] mr-0.5" /> Send
            </button>
          </div>
        </div>

        <!-- Thread List OR Thread Detail -->
        <template v-if="!selectedThread">
          <!-- Thread List (clickable cards) -->
          <div class="flex-1 overflow-y-auto px-5 py-3 space-y-2">
            <div v-if="queryPanelLoading" class="py-8 text-center text-slate-400"><i class="pi pi-spinner pi-spin text-lg" /></div>
            <div v-else-if="queryPanelQueries.length === 0" class="py-8 text-center text-slate-400">
              <i class="pi pi-comments text-3xl mb-2" /><p class="text-xs">No queries yet</p>
            </div>
            <div v-for="q in queryPanelQueries" :key="q.id"
              @click="openThreadDetail(q)"
              class="border rounded-lg p-3 cursor-pointer hover:shadow-md transition-all"
              :class="q.status === 'RESOLVED' ? 'border-slate-200 opacity-60 hover:opacity-80' : 'border-indigo-200 hover:border-indigo-400'">
              <div class="flex items-center justify-between mb-1.5">
                <div class="flex items-center gap-2">
                  <i :class="[QUERY_TYPE_LABELS[q.query_type]?.icon || 'pi-comment', QUERY_TYPE_LABELS[q.query_type]?.color || 'text-slate-600']" class="pi text-xs" />
                  <span class="text-sm font-semibold text-slate-800">{{ q.subject }}</span>
                </div>
                <span :class="{
                  'bg-red-100 text-red-700': q.status === 'OPEN',
                  'bg-blue-100 text-blue-700': q.status === 'REPLIED',
                  'bg-emerald-100 text-emerald-700': q.status === 'RESOLVED',
                }" class="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase">{{ q.status }}</span>
              </div>
              <p class="text-xs text-slate-500 truncate">{{ q.messages?.[q.messages.length - 1]?.message || '' }}</p>
              <div class="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                <span>{{ q.message_count }} messages</span>
                <span>{{ getAgeText(q.last_message_at || q.created_at) }}</span>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <!-- Thread Detail (full chat view) -->
          <div class="border-b border-slate-200 px-5 py-3 flex items-center gap-2 flex-shrink-0 bg-slate-50">
            <button @click="selectedThread = null" class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors">
              <i class="pi pi-arrow-left text-xs" />
            </button>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span :class="{
                  'bg-red-100 text-red-700': selectedThread.status === 'OPEN',
                  'bg-blue-100 text-blue-700': selectedThread.status === 'REPLIED',
                  'bg-emerald-100 text-emerald-700': selectedThread.status === 'RESOLVED',
                }" class="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase">{{ selectedThread.status }}</span>
                <span class="text-sm font-semibold text-slate-800 truncate">{{ selectedThread.subject }}</span>
              </div>
              <p class="text-[10px] text-slate-500 mt-0.5">{{ selectedThread.message_count }} messages</p>
            </div>
            <button v-if="selectedThread.status !== 'RESOLVED'" @click="resolveQuery(selectedThread.id); selectedThread = null"
              class="px-2.5 py-1 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 flex items-center gap-1">
              <i class="pi pi-check-circle text-[10px]" /> Resolve
            </button>
          </div>

          <!-- Chat Bubbles -->
          <div ref="adminChatContainerRef" class="flex-1 overflow-y-auto bg-slate-50 px-5 py-4 space-y-3">
            <div v-for="m in selectedThread.messages" :key="m.id"
              class="flex gap-3" :class="m.sender_role === 'ADMIN' ? 'flex-row-reverse' : ''">
              <div :class="['w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                m.sender_role === 'CLIENT' ? 'bg-teal-100 text-teal-700' : 'bg-indigo-100 text-indigo-700']">
                {{ getInitials(m.sender_name) }}
              </div>
              <div class="flex-1 max-w-[75%]">
                <div class="flex items-center gap-2 mb-0.5" :class="m.sender_role === 'ADMIN' ? 'justify-end' : ''">
                  <span class="text-xs font-semibold" :class="m.sender_role === 'CLIENT' ? 'text-teal-700' : 'text-indigo-700'">
                    {{ m.sender_role === 'CLIENT' ? 'Client' : 'Admin' }}
                  </span>
                  <span class="text-[10px] text-slate-400">{{ getAgeText(m.created_at) }}</span>
                </div>
                <div :class="[
                  'rounded-2xl px-4 py-2.5 shadow-sm border',
                  m.sender_role === 'CLIENT' ? 'bg-white border-slate-200 rounded-tl-sm' : 'bg-indigo-600 text-white border-indigo-700 rounded-tr-sm'
                ]">
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
                  <div class="flex items-center gap-1 mt-1" :class="m.sender_role === 'ADMIN' ? 'justify-end' : 'justify-start'">
                    <span class="text-[9px]" :class="m.sender_role === 'ADMIN' ? 'text-white/60' : 'text-slate-400'">
                      {{ new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
                    </span>
                    <template v-if="m.sender_role === 'ADMIN'">
                      <span v-if="selectedThread.messages.indexOf(m) < selectedThread.messages.length - 1 || selectedThread.status === 'REPLIED' || selectedThread.status === 'OPEN'"
                        class="text-[10px] text-blue-300" title="Read">✓✓</span>
                      <span v-else class="text-[10px] text-white/50" title="Sent">✓</span>
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
                class="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-colors flex-shrink-0">
                <i :class="threadUploadingFile ? 'pi pi-spin pi-spinner' : 'pi pi-paperclip'" class="text-sm" />
              </button>
              <input v-model="threadReplyMessage" @keyup.enter="sendThreadReply()" placeholder="Type your reply..."
                class="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 focus:outline-none" />
              <button @click="sendThreadReply()" :disabled="threadSendingReply || !threadReplyMessage.trim()"
                class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0">
                <i :class="threadSendingReply ? 'pi pi-spin pi-spinner' : 'pi pi-send'" class="text-xs" /> Send
              </button>
            </div>
          </div>
          <div v-else class="border-t border-slate-200 bg-emerald-50 px-5 py-3 flex items-center justify-center gap-2 flex-shrink-0">
            <i class="pi pi-check-circle text-emerald-600" />
            <span class="text-xs text-emerald-700 font-medium">Resolved</span>
            <span v-if="selectedThread.resolution_remark" class="text-xs text-emerald-600">— {{ selectedThread.resolution_remark }}</span>
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

<style scoped>
.highlight-flash {
  animation: flash-highlight 2.5s ease-out;
}
@keyframes flash-highlight {
  0%, 15% { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.5); }
  100% { box-shadow: 0 0 0 0 transparent; }
}
</style>
