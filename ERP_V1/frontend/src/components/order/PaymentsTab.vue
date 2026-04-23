<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { paymentsApi, financeApi } from '../../api'
import { formatDate, formatCurrency } from '../../utils/formatters'
import { POST_PI_STATUSES, STAGE_4_PLUS, STAGE_6_PLUS } from '../../utils/constants'

const props = defineProps({
  orderId: { type: String, required: true },
  order: { type: Object, required: true },
  highlightSection: { type: String, default: null },
})
const emit = defineEmits(['reload'])

// Section refs for highlight-on-navigate
const addPaymentRef = ref(null)
const factoryPaymentRef = ref(null)

// Watch for highlight requests from parent
watch(() => props.highlightSection, (section) => {
  if (!section) return
  nextTick(() => {
    let el = null
    if (section === 'add-payment') el = addPaymentRef.value
    else if (section === 'factory-payment') el = factoryPaymentRef.value
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('highlight-flash')
      setTimeout(() => el.classList.remove('highlight-flash'), 2500)
    }
  })
})

// ========================================
// Computed stage checks (derived from order prop)
// ========================================
const isPostPI = computed(() => POST_PI_STATUSES.has(props.order?.status))

const isStage4Plus = computed(() => STAGE_4_PLUS.has(props.order?.status))

const isStage6Plus = computed(() => STAGE_6_PLUS.has(props.order?.status))

// ========================================
// Payment state (Stage 4+)
// ========================================
const payments = ref([])
const paymentSummary = ref({ pi_total_inr: 0, total_paid_inr: 0, balance_inr: 0, paid_percent: 0, payment_count: 0 })
const showPaymentModal = ref(false)
const paymentSaving = ref(false)
const exchangeRatesMap = ref({})
const paymentForm = ref({
  payment_type: 'CLIENT_ADVANCE',
  amount: null,
  currency: 'INR',
  exchange_rate: 1.0,
  method: 'BANK_TRANSFER',
  reference: '',
  notes: '',
  payment_date: new Date().toISOString().split('T')[0],
})

// Inline payment editing state
const editingPaymentId = ref(null)
const editingFactoryPaymentId = ref(null)
const editForm = ref({})

// Factory payment state
const factoryPayments = ref([])
const factoryPaymentSummary = ref({ total_inr: 0, currency_totals: {}, remittance_count: 0 })

// Client credit state
const availableCredits = ref([])
const allClientCredits = ref([])
const applyingCredit = ref(false)
const totalCreditBalance = computed(() => allClientCredits.value.reduce((sum, c) => sum + c.amount, 0))
const isOrderFullyPaid = computed(() => {
  const s = paymentSummary.value
  const balance = s.has_revisions ? s.revised_balance_inr : s.balance_inr
  return balance <= 0
})
const revisedPaidPercent = computed(() => {
  const s = paymentSummary.value
  const total = s.has_revisions ? s.revised_client_total_inr : s.pi_total_inr
  return total > 0 ? Math.round((s.total_paid_inr / total) * 1000) / 10 : 0
})

// Factory credit state
const allFactoryCredits = ref([])
const availableFactoryCredits = computed(() => allFactoryCredits.value.filter(c => c.source_order_id !== props.orderId))

// PI revision history
const piHistory = ref(null)
const showPIHistory = ref(false)
const totalFactoryCreditBalance = computed(() => allFactoryCredits.value.reduce((sum, c) => sum + c.amount, 0))
const isFactoryFullyPaid = computed(() => (factoryPaymentSummary.value.balance_inr || 0) <= 0)
const applyingFactoryCredit = ref(false)

// Download report state
const downloadingClientReport = ref(false)
const downloadingFactoryReport = ref(false)

// Audit log state
const auditLog = ref([])
const showAuditLog = ref(false)
const expandedAuditId = ref(null)

// Computed amount_inr for payment form
const computedAmountInr = computed(() => {
  const amt = paymentForm.value.amount
  const rate = paymentForm.value.exchange_rate
  if (amt && rate) return (amt * rate).toFixed(2)
  return '0.00'
})

// formatDate and formatCurrency imported from utils/formatters
function formatPaymentMethod(method) {
  const map = {
    BANK_TRANSFER: 'Bank Transfer',
    CHEQUE: 'Cheque',
    CASH: 'Cash',
    UPI: 'UPI',
    LC: 'Letter of Credit',
  }
  return map[method] || method
}

function formatPaymentType(type) {
  const map = {
    CLIENT_ADVANCE: 'Advance',
    CLIENT_BALANCE: 'Balance',
    FACTORY_PAYMENT: 'Factory',
  }
  return map[type] || type
}

// ========================================
// Payment functions (Stage 4+)
// ========================================
async function loadPayments() {
  try {
    const { data } = await paymentsApi.list(props.orderId)
    payments.value = data.payments
    paymentSummary.value = data.summary
  } catch (err) {
    console.error('Failed to load payments:', err)
  }
}

async function loadFactoryPayments() {
  try {
    const { data } = await paymentsApi.factoryList(props.orderId)
    factoryPayments.value = data.payments
    factoryPaymentSummary.value = data.summary
  } catch (err) {
    console.error('Failed to load factory payments:', err)
  }
}

async function loadPIHistory() {
  try {
    const { data } = await financeApi.piHistory(props.orderId)
    piHistory.value = data
  } catch (err) {
    console.error('Failed to load PI history:', err)
  }
}

async function loadExchangeRates() {
  try {
    const { data } = await paymentsApi.exchangeRates()
    exchangeRatesMap.value = data
  } catch (err) {
    console.error('Failed to load exchange rates:', err)
  }
}

async function loadClientCredits() {
  if (!props.order?.client_id) return
  try {
    const { data } = await financeApi.clientCredits(props.order.client_id)
    const credits = (data || []).filter(c => c.amount > 0)
    // All credits for Credit Balance display
    allClientCredits.value = credits
    // Only credits from OTHER orders for the Apply Credit buttons
    availableCredits.value = credits.filter(c => c.source_order_id !== props.orderId)
  } catch (err) {
    console.error('Failed to load client credits:', err)
  }
}

async function applyClientCredit(credit) {
  if (applyingCredit.value) return
  applyingCredit.value = true
  try {
    await financeApi.applyCredit(props.orderId, credit.id)
    await loadPayments()
    await loadClientCredits()
  } catch (err) {
    console.error('Failed to apply credit:', err)
  } finally {
    applyingCredit.value = false
  }
}

async function loadFactoryCredits() {
  if (!props.order?.factory_id) return
  try {
    const { data } = await financeApi.factoryCredits(props.order.factory_id)
    allFactoryCredits.value = (data || []).filter(c => c.amount > 0)
  } catch (err) {
    console.error('Failed to load factory credits:', err)
  }
}

async function applyFactoryCredit(credit) {
  if (applyingFactoryCredit.value) return
  applyingFactoryCredit.value = true
  try {
    await financeApi.applyFactoryCredit(props.orderId, credit.id)
    await loadFactoryPayments()
    await loadFactoryCredits()
  } catch (err) {
    console.error('Failed to apply factory credit:', err)
  } finally {
    applyingFactoryCredit.value = false
  }
}

function openPaymentModal(type) {
  paymentForm.value = {
    payment_type: type || 'CLIENT_ADVANCE',
    amount: null,
    currency: type === 'FACTORY_PAYMENT' ? (props.order?.currency || 'CNY') : 'INR',
    exchange_rate: 1.0,
    method: 'BANK_TRANSFER',
    reference: '',
    notes: '',
    payment_date: new Date().toISOString().split('T')[0],
  }
  // Auto-fill exchange rate from settings
  const curr = paymentForm.value.currency
  if (curr !== 'INR' && exchangeRatesMap.value[curr]) {
    paymentForm.value.exchange_rate = exchangeRatesMap.value[curr]
  }
  showPaymentModal.value = true
}

// Watch currency changes in payment form to auto-fill exchange rate
watch(() => paymentForm.value.currency, (curr) => {
  if (curr === 'INR') {
    paymentForm.value.exchange_rate = 1.0
  } else if (exchangeRatesMap.value[curr]) {
    paymentForm.value.exchange_rate = exchangeRatesMap.value[curr]
  }
})

const pendingPayments = computed(() =>
  payments.value.filter(p => p.verification_status === 'PENDING_VERIFICATION')
)

const rejectingPaymentId = ref(null)
const rejectReason = ref('')

async function handleVerifyPayment(paymentId, action) {
  if (action === 'reject' && !rejectReason.value.trim()) {
    return
  }
  try {
    await paymentsApi.verifyPayment(paymentId, {
      action,
      reason: action === 'reject' ? rejectReason.value.trim() : undefined,
    })
    rejectingPaymentId.value = null
    rejectReason.value = ''
    await loadPayments()
    await loadClientCredits()
  } catch (e) {
    console.error('Verify failed:', e)
  }
}

async function viewProofFile(paymentId) {
  try {
    const response = await paymentsApi.downloadProof(paymentId)
    const contentType = response.headers?.['content-type'] || 'application/octet-stream'
    const blob = new Blob([response.data], { type: contentType })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  } catch (e) {
    console.error('Failed to download proof:', e)
  }
}

async function savePayment() {
  if (!paymentForm.value.amount && paymentForm.value.amount !== 0) return
  paymentSaving.value = true
  try {
    const payload = {
      ...paymentForm.value,
      amount: parseFloat(paymentForm.value.amount) || 0,
      exchange_rate: parseFloat(paymentForm.value.exchange_rate) || 1,
    }

    if (payload.payment_type === 'FACTORY_PAYMENT') {
      // Factory payment
      await paymentsApi.factoryCreate(props.orderId, {
        amount: payload.amount,
        currency: payload.currency,
        exchange_rate: payload.exchange_rate,
        method: payload.method,
        reference: payload.reference,
        notes: payload.notes,
        payment_date: payload.payment_date,
      })
      await loadFactoryPayments()
      await loadFactoryCredits()  // Overpayment may create/update factory credits
    } else {
      // Client payment
      await paymentsApi.create(props.orderId, payload)
      await loadPayments()
      await loadClientCredits()  // Overpayment may create/update credits
    }

    showPaymentModal.value = false
    refreshAuditIfVisible()
  } catch (err) {
    console.error('Failed to save payment:', err)
  } finally {
    paymentSaving.value = false
  }
}

async function deletePayment(paymentId) {
  try {
    await paymentsApi.delete(props.orderId, paymentId)
    await loadPayments()
    await loadClientCredits()  // Deletion may affect credit balance
    refreshAuditIfVisible()
  } catch (err) {
    console.error('Failed to delete payment:', err)
  }
}

async function deleteFactoryPayment(paymentId) {
  try {
    await paymentsApi.factoryDelete(props.orderId, paymentId)
    await loadFactoryPayments()
    await loadFactoryCredits()
    refreshAuditIfVisible()
  } catch (err) {
    console.error('Failed to delete factory payment:', err)
  }
}

function startEditPayment(p) {
  editingPaymentId.value = p.id
  editingFactoryPaymentId.value = null  // cancel any factory edit
  editForm.value = {
    payment_type: p.payment_type,
    amount: p.amount,
    currency: p.currency,
    exchange_rate: p.exchange_rate,
    method: p.method,
    reference: p.reference || '',
    notes: p.notes || '',
    payment_date: p.payment_date,
  }
}

function cancelEditPayment() {
  editingPaymentId.value = null
  editForm.value = {}
}

async function saveEditPayment() {
  if (!editingPaymentId.value) return
  try {
    await paymentsApi.update(props.orderId, editingPaymentId.value, {
      ...editForm.value,
      amount: parseFloat(editForm.value.amount) || 0,
      exchange_rate: parseFloat(editForm.value.exchange_rate) || 1,
    })
    editingPaymentId.value = null
    editForm.value = {}
    await loadPayments()
    await loadClientCredits()  // Recalculated credit may change after edit
    refreshAuditIfVisible()
  } catch (err) {
    console.error('Failed to update payment:', err)
  }
}

function startEditFactoryPayment(p) {
  editingFactoryPaymentId.value = p.id
  editingPaymentId.value = null  // cancel any client edit
  editForm.value = {
    amount: p.amount,
    currency: p.currency,
    exchange_rate: p.exchange_rate,
    method: p.method,
    reference: p.reference || '',
    notes: p.notes || '',
    payment_date: p.payment_date,
  }
}

function cancelEditFactoryPayment() {
  editingFactoryPaymentId.value = null
  editForm.value = {}
}

async function saveEditFactoryPayment() {
  if (!editingFactoryPaymentId.value) return
  try {
    await paymentsApi.factoryUpdate(props.orderId, editingFactoryPaymentId.value, {
      ...editForm.value,
      amount: parseFloat(editForm.value.amount) || 0,
      exchange_rate: parseFloat(editForm.value.exchange_rate) || 1,
    })
    editingFactoryPaymentId.value = null
    editForm.value = {}
    await loadFactoryPayments()
    await loadFactoryCredits()  // Recalculated credit may change after edit
    refreshAuditIfVisible()
  } catch (err) {
    console.error('Failed to update factory payment:', err)
  }
}

// ========================================
// Audit Log
// ========================================
async function loadAuditLog() {
  try {
    const { data } = await financeApi.auditLog(props.orderId)
    auditLog.value = data
  } catch (err) {
    console.error('Failed to load audit log:', err)
  }
}

function toggleAuditLog() {
  showAuditLog.value = !showAuditLog.value
  if (showAuditLog.value && auditLog.value.length === 0) {
    loadAuditLog()
  }
}

function toggleAuditDetail(id) {
  expandedAuditId.value = expandedAuditId.value === id ? null : id
}

function auditActionColor(action) {
  if (action === 'CREATE') return 'bg-emerald-100 text-emerald-700'
  if (action === 'UPDATE') return 'bg-blue-100 text-blue-700'
  if (action === 'DELETE') return 'bg-red-100 text-red-700'
  return 'bg-slate-100 text-slate-700'
}

function auditActionIcon(action) {
  if (action === 'CREATE') return 'pi-plus-circle'
  if (action === 'UPDATE') return 'pi-pencil'
  if (action === 'DELETE') return 'pi-trash'
  return 'pi-info-circle'
}

function formatFieldLabel(field) {
  return field.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatFieldValue(val) {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'number') return Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return String(val)
}


// ========================================
// Download Reports
// ========================================
async function downloadClientPaymentReport(format) {
  downloadingClientReport.value = true
  try {
    const { data } = await paymentsApi.downloadPaymentReport(props.orderId, format)
    const ext = format === 'xlsx' ? 'xlsx' : 'pdf'
    const mime = format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf'
    const blob = new Blob([data], { type: mime })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Client_Payments_${props.order?.order_number || props.orderId}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Download failed:', err)
  } finally {
    downloadingClientReport.value = false
  }
}

async function downloadFactoryPaymentReport(format) {
  downloadingFactoryReport.value = true
  try {
    const { data } = await paymentsApi.downloadFactoryPaymentReport(props.orderId, format)
    const ext = format === 'xlsx' ? 'xlsx' : 'pdf'
    const mime = format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf'
    const blob = new Blob([data], { type: mime })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Factory_Payments_${props.order?.order_number || props.orderId}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Download failed:', err)
  } finally {
    downloadingFactoryReport.value = false
  }
}

// ========================================
// Lifecycle
// ========================================
// Refresh audit log when it's visible
function refreshAuditIfVisible() {
  if (showAuditLog.value) loadAuditLog()
}

onMounted(() => {
  loadExchangeRates()
  loadPIHistory()
  if (isPostPI.value) {
    loadPayments()
    loadClientCredits()
  }
  if (isStage6Plus.value) {
    loadFactoryPayments()
    loadFactoryCredits()
  }
})

// Reload data when order status changes (e.g. after stage transition while tab is already visible)
watch(() => props.order?.status, (newStatus, oldStatus) => {
  if (!oldStatus || !newStatus || newStatus === oldStatus) return
  if (isPostPI.value) {
    loadPayments()
    loadClientCredits()
  }
  if (isStage6Plus.value) {
    loadFactoryPayments()
    loadFactoryCredits()
  }
})
</script>

<template>
  <div>
      <!-- ==========================================
           PI REVISION HISTORY
           ========================================== -->
      <div v-if="piHistory && piHistory.total_revisions > 0" class="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div class="px-6 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between cursor-pointer" @click="showPIHistory = !showPIHistory">
          <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <i class="pi pi-history text-indigo-500" /> PI Revision History
            <span class="text-xs font-normal text-slate-500">({{ piHistory.total_revisions }} revision{{ piHistory.total_revisions > 1 ? 's' : '' }})</span>
          </h3>
          <i :class="['pi text-slate-400 text-xs transition-transform', showPIHistory ? 'pi-chevron-up' : 'pi-chevron-down']" />
        </div>
        <div v-if="showPIHistory" class="p-4">
          <!-- Current PI -->
          <div v-if="piHistory.current" class="flex items-center gap-3 pb-3 mb-3 border-b border-slate-100">
            <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
              <i class="pi pi-check text-[10px]" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-slate-800">Current PI</span>
                <span class="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-medium">Active</span>
              </div>
              <p class="text-xs text-slate-500 mt-0.5">{{ piHistory.current.updated_at ? formatDate(piHistory.current.updated_at) : formatDate(piHistory.current.generated_at) }}</p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-sm font-semibold text-slate-800">{{ formatCurrency(piHistory.current.total_inr, 'INR') }}</p>
              <p class="text-xs text-slate-400">Adv {{ piHistory.current.advance_percent }}%</p>
            </div>
          </div>
          <!-- Past Revisions -->
          <div class="space-y-2">
            <div v-for="(rev, idx) in piHistory.revisions" :key="rev.id" class="flex items-center gap-3 py-2" :class="idx < piHistory.revisions.length - 1 ? 'border-b border-slate-50' : ''">
              <div class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold shrink-0">
                {{ rev.revision_number }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-slate-600">Revision {{ rev.revision_number }}</span>
                  <span v-if="piHistory.current && rev.total_inr !== piHistory.current.total_inr" class="text-[10px] px-1.5 py-0.5 rounded font-medium"
                    :class="rev.total_inr > (piHistory.revisions[idx - 1]?.total_inr || 0) ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'"
                  >
                    {{ rev.total_inr > (piHistory.revisions[idx - 1]?.total_inr || 0) ? '+' : '' }}{{ formatCurrency(rev.total_inr - (piHistory.revisions[idx - 1]?.total_inr || rev.total_inr), 'INR') }}
                  </span>
                </div>
                <p class="text-xs text-slate-400 mt-0.5">{{ formatDate(rev.generated_at) }} &middot; {{ rev.item_count }} items</p>
              </div>
              <div class="text-right shrink-0">
                <p class="text-sm font-medium text-slate-500">{{ formatCurrency(rev.total_inr, 'INR') }}</p>
                <p class="text-xs text-slate-400">Adv {{ rev.advance_percent }}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==========================================
           REVISED PROFORMA INVOICE (post-migration)
           ========================================== -->
      <div v-if="paymentSummary.has_revisions && isPostPI" class="bg-white rounded-xl shadow-sm overflow-hidden border-2 border-amber-300 mb-6">
        <div class="px-6 py-4 border-b border-amber-300 bg-amber-50">
          <h3 class="text-sm font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-2">
            <i class="pi pi-exclamation-triangle text-amber-600" /> Revised Proforma Invoice
          </h3>
          <p class="text-xs text-amber-600 mt-0.5">
            <template v-if="paymentSummary.unloaded_count > 0">
              {{ paymentSummary.unloaded_count }} item(s) were migrated/unloaded at Plan Packing — totals revised below
            </template>
            <template v-else>
              Item prices were corrected after PI generation — totals revised below
            </template>
          </p>
        </div>
        <div class="p-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Client Side -->
            <div class="border border-emerald-200 rounded-lg p-4 bg-emerald-50/30">
              <h4 class="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-3 flex items-center gap-1">
                <i class="pi pi-wallet text-emerald-500" /> Client Side
              </h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-slate-500">Original PI</span>
                  <span class="text-slate-400 line-through">{{ formatCurrency(paymentSummary.pi_total_inr, 'INR') }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-700 font-medium">Revised PI</span>
                  <span class="font-semibold text-emerald-700">{{ formatCurrency(paymentSummary.revised_client_total_inr, 'INR') }}</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-red-500">Reduction</span>
                  <span class="text-red-500">-{{ formatCurrency(paymentSummary.pi_total_inr - paymentSummary.revised_client_total_inr, 'INR') }}</span>
                </div>
                <div class="border-t border-emerald-200 pt-2 mt-2">
                  <div class="flex justify-between">
                    <span class="text-slate-500">Paid</span>
                    <span class="text-emerald-600">{{ formatCurrency(paymentSummary.total_paid_inr, 'INR') }}</span>
                  </div>
                  <div class="flex justify-between font-semibold mt-1">
                    <span class="text-slate-700">Revised Balance</span>
                    <span :class="paymentSummary.revised_balance_inr > 0 ? 'text-amber-600' : 'text-emerald-600'">
                      {{ formatCurrency(paymentSummary.revised_balance_inr, 'INR') }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Factory Side -->
            <div class="border border-blue-200 rounded-lg p-4 bg-blue-50/30">
              <h4 class="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-3 flex items-center gap-1">
                <i class="pi pi-send text-blue-500" /> Factory Side
              </h4>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-slate-500">Original Bill</span>
                  <span class="text-slate-400 line-through">{{ formatCurrency(paymentSummary.original_factory_total_inr, 'INR') }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-700 font-medium">Revised Bill</span>
                  <span class="font-semibold text-blue-700">{{ formatCurrency(paymentSummary.revised_factory_total_inr, 'INR') }}</span>
                </div>
                <div class="flex justify-between text-xs">
                  <span class="text-red-500">Reduction</span>
                  <span class="text-red-500">-{{ formatCurrency(paymentSummary.original_factory_total_inr - paymentSummary.revised_factory_total_inr, 'INR') }}</span>
                </div>
                <div class="border-t border-blue-200 pt-2 mt-2">
                  <div class="flex justify-between">
                    <span class="text-slate-500">Paid</span>
                    <span class="text-blue-600">{{ formatCurrency(paymentSummary.factory_paid_inr, 'INR') }}</span>
                  </div>
                  <div class="flex justify-between font-semibold mt-1">
                    <span class="text-slate-700">Revised Balance</span>
                    <span :class="paymentSummary.revised_factory_balance_inr > 0 ? 'text-amber-600' : 'text-blue-600'">
                      {{ formatCurrency(paymentSummary.revised_factory_balance_inr, 'INR') }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==========================================
           PENDING PAYMENT VERIFICATIONS
           ========================================== -->
      <div v-if="pendingPayments.length > 0" class="bg-white rounded-xl shadow-sm overflow-hidden border-2 border-amber-300 mb-6">
        <div class="px-6 py-4 border-b border-amber-300 bg-amber-50">
          <h3 class="text-sm font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-2">
            <i class="pi pi-clock text-amber-600" /> Pending Verification
            <span class="px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full text-xs">{{ pendingPayments.length }}</span>
          </h3>
          <p class="text-xs text-amber-600 mt-0.5">Client-submitted payments awaiting your review</p>
        </div>
        <div class="divide-y divide-amber-100">
          <div v-for="p in pendingPayments" :key="p.id" class="px-6 py-4">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3 flex-wrap">
                  <span class="text-sm font-semibold text-slate-800">{{ formatCurrency(p.amount_inr, 'INR') }}</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">{{ p.payment_type === 'CLIENT_ADVANCE' ? 'Advance' : 'Balance' }}</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600">{{ (p.method || '').replace(/_/g, ' ') }}</span>
                </div>
                <div class="mt-1 flex items-center gap-3 text-xs text-slate-500">
                  <span><i class="pi pi-calendar text-[10px] mr-0.5" /> {{ formatDate(p.payment_date) }}</span>
                  <span v-if="p.reference" class="font-mono">Ref: {{ p.reference }}</span>
                </div>
                <p v-if="p.notes" class="text-xs text-slate-400 mt-1 italic">"{{ p.notes }}"</p>
                <button v-if="p.proof_file_path" @click="viewProofFile(p.id)"
                  class="mt-2 text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                  <i class="pi pi-file text-[10px]" /> View Proof
                </button>
              </div>
              <div class="flex flex-col items-end gap-2 shrink-0">
                <template v-if="rejectingPaymentId !== p.id">
                  <div class="flex items-center gap-2">
                    <button @click="handleVerifyPayment(p.id, 'approve')"
                      class="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 flex items-center gap-1">
                      <i class="pi pi-check text-[10px]" /> Approve
                    </button>
                    <button @click="rejectingPaymentId = p.id"
                      class="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 flex items-center gap-1">
                      <i class="pi pi-times text-[10px]" /> Reject
                    </button>
                  </div>
                </template>
                <template v-else>
                  <div class="flex flex-col gap-2 w-56">
                    <input v-model="rejectReason" type="text" placeholder="Reason for rejection..."
                      class="w-full px-2 py-1.5 text-xs border border-red-300 rounded-lg focus:ring-1 focus:ring-red-400" autofocus />
                    <div class="flex items-center gap-2">
                      <button @click="handleVerifyPayment(p.id, 'reject')" :disabled="!rejectReason.trim()"
                        class="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                        Confirm Reject
                      </button>
                      <button @click="rejectingPaymentId = null; rejectReason = ''"
                        class="px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==========================================
           CLIENT PAYMENTS (Post-PI)
           ========================================== -->
      <div v-if="isPostPI" ref="addPaymentRef" class="bg-white rounded-xl shadow-sm overflow-hidden border-2 border-emerald-200 mb-6">
        <div class="px-6 py-4 border-b border-emerald-200 bg-emerald-50">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-emerald-800 uppercase tracking-wider flex items-center gap-2">
                <i class="pi pi-wallet text-emerald-600" /> Client Payments
              </h3>
              <p class="text-xs text-emerald-600 mt-0.5">Track advance and balance payments from client</p>
            </div>
            <div class="flex items-center gap-2">
              <button @click="downloadClientPaymentReport('xlsx')" :disabled="downloadingClientReport"
                class="px-3 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50 flex items-center gap-1">
                <i :class="downloadingClientReport ? 'pi pi-spin pi-spinner' : 'pi pi-file-excel'" class="text-xs" /> Excel
              </button>
              <button @click="downloadClientPaymentReport('pdf')" :disabled="downloadingClientReport"
                class="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center gap-1">
                <i :class="downloadingClientReport ? 'pi pi-spin pi-spinner' : 'pi pi-file-pdf'" class="text-xs" /> PDF
              </button>
              <button
                @click="openPaymentModal('CLIENT_ADVANCE')"
                class="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <i class="pi pi-plus text-xs" />
                Record Payment
              </button>
            </div>
          </div>

          <!-- Financial Summary -->
          <div class="mt-3 bg-white rounded-lg border border-emerald-200 p-4">
            <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <span class="text-slate-400 block text-xs">{{ paymentSummary.has_revisions ? 'Revised PI Total' : 'PI Total' }}</span>
                <span class="font-semibold text-slate-800">{{ formatCurrency(paymentSummary.has_revisions ? paymentSummary.revised_client_total_inr : paymentSummary.pi_total_inr, 'INR') }}</span>
                <span v-if="paymentSummary.has_revisions" class="text-xs text-slate-400 line-through block">{{ formatCurrency(paymentSummary.pi_total_inr, 'INR') }}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-xs">Paid</span>
                <span class="font-semibold text-emerald-700">{{ formatCurrency(paymentSummary.total_paid_inr, 'INR') }}</span>
              </div>
              <div>
                <span class="text-slate-400 block text-xs">Balance</span>
                <span :class="['font-semibold', (paymentSummary.has_revisions ? paymentSummary.revised_balance_inr : paymentSummary.balance_inr) > 0 ? 'text-amber-600' : 'text-emerald-600']">
                  {{ formatCurrency(paymentSummary.has_revisions ? paymentSummary.revised_balance_inr : paymentSummary.balance_inr, 'INR') }}
                </span>
              </div>
              <div>
                <span class="text-slate-400 block text-xs">Progress</span>
                <span :class="['font-semibold', revisedPaidPercent > 100 ? 'text-emerald-600' : 'text-slate-700']">
                  {{ Math.min(revisedPaidPercent, 100).toFixed(1) }}%
                </span>
              </div>
              <div>
                <span class="text-slate-400 block text-xs">Credit Balance</span>
                <span class="font-semibold text-indigo-700">
                  {{ totalCreditBalance > 0 ? formatCurrency(totalCreditBalance, 'INR') : '\u2014' }}
                </span>
              </div>
            </div>
            <!-- Progress bar -->
            <div class="mt-3 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                class="h-full bg-emerald-500 rounded-full transition-all duration-500"
                :style="{ width: Math.min(revisedPaidPercent, 100) + '%' }"
              />
            </div>
            <!-- Overpayment → Credit notice -->
            <div v-if="(paymentSummary.has_revisions ? paymentSummary.revised_balance_inr : paymentSummary.balance_inr) < 0" class="mt-2 flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2">
              <i class="pi pi-info-circle" />
              <span v-if="paymentSummary.has_revisions">
                Surplus of <strong>{{ formatCurrency(Math.abs(paymentSummary.revised_balance_inr), 'INR') }}</strong> — payments were made against the original PI ({{ formatCurrency(paymentSummary.pi_total_inr, 'INR') }}) before it was revised down to {{ formatCurrency(paymentSummary.revised_client_total_inr, 'INR') }}. This surplus is not tied to any single transaction and can be applied as credit to future orders.
              </span>
              <span v-else>Overpayment of <strong>{{ formatCurrency(Math.abs(paymentSummary.balance_inr), 'INR') }}</strong> against the PI total. This can be applied as credit to future orders.</span>
            </div>
          </div>

          <!-- Available Credits Banner -->
          <div v-if="allClientCredits.length > 0" class="mt-3 bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <div class="flex items-center gap-2 mb-2">
              <i class="pi pi-star-fill text-indigo-500 text-xs" />
              <span class="text-sm font-semibold text-indigo-800">Available Credits</span>
            </div>
            <div class="space-y-2">
              <div
                v-for="credit in allClientCredits"
                :key="credit.id"
                class="flex items-center justify-between bg-white rounded-lg border border-indigo-100 px-4 py-2.5"
              >
                <div class="flex items-center gap-4 text-sm">
                  <div>
                    <span class="text-slate-400 text-xs block">Source</span>
                    <span class="font-mono text-indigo-600 text-xs">{{ credit.source_order_number || credit.source_order_id?.slice(0, 8) }}</span>
                  </div>
                  <div>
                    <span class="text-slate-400 text-xs block">Credit Amount</span>
                    <span class="font-bold text-indigo-700">{{ formatCurrency(credit.amount, 'INR') }}</span>
                  </div>
                  <div>
                    <span class="text-slate-400 text-xs block">Note</span>
                    <span class="text-slate-600 text-xs">{{ credit.notes || 'Overpayment credit' }}</span>
                  </div>
                </div>
                <!-- Apply button: only for credits from OTHER orders and when balance > 0 -->
                <button
                  v-if="!isOrderFullyPaid && credit.source_order_id !== orderId"
                  @click="applyClientCredit(credit)"
                  :disabled="applyingCredit"
                  class="px-4 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  <i class="pi pi-check text-xs" />
                  Apply Credit
                </button>
                <span v-else-if="credit.source_order_id === orderId" class="text-xs text-slate-400 italic">{{ paymentSummary.has_revisions ? 'Surplus from PI revision' : 'This order\'s overpayment' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Payment History Table -->
        <div v-if="payments.length > 0" class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="bg-emerald-50/50 border-b border-slate-200">
                <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">#</th>
                <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Date</th>
                <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Type</th>
                <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Method</th>
                <th class="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                <th class="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Rate</th>
                <th class="text-right px-4 py-2 text-xs font-semibold text-emerald-700 uppercase">Amount INR</th>
                <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Reference</th>
                <th class="text-center px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th class="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(p, i) in payments" :key="p.id" :class="['transition-colors', p.verification_status === 'REJECTED' ? 'opacity-30' : 'hover:bg-emerald-50/30']">
                <!-- DISPLAY MODE -->
                <template v-if="editingPaymentId !== p.id">
                  <td class="px-4 py-2.5 text-xs text-slate-400">{{ i + 1 }}</td>
                  <td class="px-4 py-2.5 text-sm text-slate-700">{{ formatDate(p.payment_date) }}</td>
                  <td class="px-4 py-2.5">
                    <span :class="['inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold', p.payment_type === 'CLIENT_ADVANCE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700']">
                      {{ formatPaymentType(p.payment_type) }}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 text-sm text-slate-600">{{ formatPaymentMethod(p.method) }}</td>
                  <td class="px-4 py-2.5 text-sm text-right text-slate-700">{{ formatCurrency(p.amount, p.currency) }}</td>
                  <td class="px-4 py-2.5 text-sm text-right text-slate-500">{{ p.currency === 'INR' ? '\u2014' : p.exchange_rate }}</td>
                  <td class="px-4 py-2.5 text-right">
                    <span class="text-sm font-medium text-emerald-700">{{ formatCurrency(p.amount_inr, 'INR') }}</span>
                    <div v-if="p.surplus_inr > 0" class="text-[10px] mt-0.5 space-y-0.5">
                      <div class="text-emerald-600">Utilized: {{ formatCurrency(p.utilized_inr, 'INR') }}</div>
                      <div class="text-indigo-600">Surplus: {{ formatCurrency(p.surplus_inr, 'INR') }}</div>
                    </div>
                  </td>
                  <td class="px-4 py-2.5 text-sm text-slate-500">{{ p.reference || '\u2014' }}</td>
                  <td class="px-3 py-2 text-center">
                    <div class="flex items-center justify-center gap-1">
                      <span v-if="p.verification_status === 'PENDING_VERIFICATION'" class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">Pending</span>
                      <span v-else-if="p.verification_status === 'REJECTED'" class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700" :title="p.rejection_reason">Rejected</span>
                      <span v-else class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">Verified</span>
                      <button v-if="p.proof_file_path" @click="viewProofFile(p.id)" class="text-indigo-400 hover:text-indigo-600" title="View proof">
                        <i class="pi pi-file text-[10px]" />
                      </button>
                    </div>
                  </td>
                  <td class="px-4 py-2.5 flex gap-1">
                    <button @click="startEditPayment(p)" class="p-1 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors" title="Edit payment">
                      <i class="pi pi-pencil text-[10px]" />
                    </button>
                    <button @click="deletePayment(p.id)" class="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Delete payment">
                      <i class="pi pi-trash text-[10px]" />
                    </button>
                  </td>
                </template>
                <!-- EDIT MODE -->
                <template v-else>
                  <td class="px-4 py-2 text-xs text-slate-400">{{ i + 1 }}</td>
                  <td class="px-4 py-1.5"><input type="date" v-model="editForm.payment_date" class="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-400 focus:outline-none" /></td>
                  <td class="px-4 py-1.5">
                    <select v-model="editForm.payment_type" class="w-full px-2 py-1 text-xs border border-blue-300 rounded focus:ring-2 focus:ring-blue-400 focus:outline-none">
                      <option value="CLIENT_ADVANCE">Advance</option>
                      <option value="CLIENT_BALANCE">Balance</option>
                    </select>
                  </td>
                  <td class="px-4 py-1.5">
                    <select v-model="editForm.method" class="w-full px-2 py-1 text-xs border border-blue-300 rounded focus:ring-2 focus:ring-blue-400 focus:outline-none">
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="LC">LC</option>
                    </select>
                  </td>
                  <td class="px-4 py-1.5">
                    <div class="flex items-center gap-1">
                      <input type="number" v-model="editForm.amount" step="0.01" class="w-20 px-2 py-1 text-sm text-right border border-blue-300 rounded focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                      <select v-model="editForm.currency" class="w-16 px-1 py-1 text-xs border border-blue-300 rounded focus:ring-2 focus:ring-blue-400 focus:outline-none">
                        <option v-for="c in ['INR','USD','CNY','EUR','GBP','JPY']" :key="c" :value="c">{{ c }}</option>
                      </select>
                    </div>
                  </td>
                  <td class="px-4 py-1.5"><input type="number" v-model="editForm.exchange_rate" step="0.01" class="w-20 px-2 py-1 text-sm text-right border border-blue-300 rounded focus:ring-2 focus:ring-blue-400 focus:outline-none" :disabled="editForm.currency === 'INR'" /></td>
                  <td class="px-4 py-1.5 text-sm text-right font-medium text-emerald-700">{{ formatCurrency((parseFloat(editForm.amount) || 0) * (parseFloat(editForm.exchange_rate) || 1), 'INR') }}</td>
                  <td class="px-4 py-1.5"><input type="text" v-model="editForm.reference" class="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-400 focus:outline-none" placeholder="Reference" /></td>
                  <td class="px-4 py-1.5 flex gap-1">
                    <button @click="saveEditPayment" class="p-1 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors" title="Save">
                      <i class="pi pi-check text-[10px]" />
                    </button>
                    <button @click="cancelEditPayment" class="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors" title="Cancel">
                      <i class="pi pi-times text-[10px]" />
                    </button>
                  </td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="px-6 py-6 text-center text-slate-400 text-sm">
          No payments recorded yet. Click "Record Payment" to add one.
        </div>
      </div>

      <!-- ==========================================
           FACTORY PAYMENTS (Stage 6+)
           ========================================== -->
      <div v-if="isStage6Plus" ref="factoryPaymentRef" class="bg-white rounded-xl shadow-sm overflow-hidden border-2 border-blue-200 mb-6">
        <div class="px-6 py-4 border-b border-blue-200 bg-blue-50">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold text-blue-800 uppercase tracking-wider flex items-center gap-2">
                <i class="pi pi-send text-blue-600" /> Factory Payments
              </h3>
              <p class="text-xs text-blue-600 mt-0.5">Track remittances to factory — each with own method &amp; exchange rate</p>
            </div>
            <div class="flex items-center gap-2">
              <button @click="downloadFactoryPaymentReport('xlsx')" :disabled="downloadingFactoryReport"
                class="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 flex items-center gap-1">
                <i :class="downloadingFactoryReport ? 'pi pi-spin pi-spinner' : 'pi pi-file-excel'" class="text-xs" /> Excel
              </button>
              <button @click="downloadFactoryPaymentReport('pdf')" :disabled="downloadingFactoryReport"
                class="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 flex items-center gap-1">
                <i :class="downloadingFactoryReport ? 'pi pi-spin pi-spinner' : 'pi pi-file-pdf'" class="text-xs" /> PDF
              </button>
              <button
                @click="openPaymentModal('FACTORY_PAYMENT')"
                class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <i class="pi pi-plus text-xs" />
                Record Remittance
              </button>
            </div>
          </div>

          <!-- Factory Payment Summary -->
          <div class="mt-3 bg-white rounded-lg border border-blue-200 p-4">
            <div class="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <span class="text-slate-400 block text-xs">Factory Bill</span>
                <span class="font-semibold text-slate-800">{{ formatCurrency(factoryPaymentSummary.factory_total_inr || 0, 'INR') }}</span>
                <span v-if="factoryPaymentSummary.factory_total_cny" class="text-xs text-slate-400 block">
                  {{ formatCurrency(factoryPaymentSummary.factory_total_cny, factoryPaymentSummary.factory_currency || 'CNY') }}
                </span>
              </div>
              <div>
                <span class="text-slate-400 block text-xs">Paid</span>
                <span class="font-semibold text-blue-700">{{ formatCurrency(factoryPaymentSummary.total_inr, 'INR') }}</span>
                <span v-if="Object.keys(factoryPaymentSummary.currency_totals || {}).length > 0" class="text-xs text-slate-400 block">
                  <template v-for="(amt, curr) in factoryPaymentSummary.currency_totals" :key="curr">
                    {{ formatCurrency(amt, curr) }}
                  </template>
                </span>
              </div>
              <div>
                <span class="text-slate-400 block text-xs">Balance</span>
                <span :class="['font-semibold', (factoryPaymentSummary.balance_inr || 0) > 0 ? 'text-amber-600' : 'text-emerald-600']">
                  {{ formatCurrency(factoryPaymentSummary.balance_inr || 0, 'INR') }}
                </span>
              </div>
              <div>
                <span class="text-slate-400 block text-xs">Progress</span>
                <span :class="['font-semibold', (factoryPaymentSummary.paid_percent || 0) >= 100 ? 'text-emerald-600' : 'text-slate-700']">
                  {{ (factoryPaymentSummary.paid_percent || 0).toFixed(1) }}%
                </span>
              </div>
              <div>
                <span class="text-slate-400 block text-xs">Remittances</span>
                <span class="font-semibold text-slate-700">{{ factoryPaymentSummary.remittance_count }}</span>
              </div>
            </div>
            <!-- Progress bar -->
            <div class="mt-3 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                class="h-full bg-blue-500 rounded-full transition-all duration-500"
                :style="{ width: Math.min(factoryPaymentSummary.paid_percent || 0, 100) + '%' }"
              />
            </div>
          </div>

          <!-- Available Factory Credits Banner -->
          <div v-if="allFactoryCredits.length > 0" class="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div class="flex items-center gap-2 mb-2">
              <i class="pi pi-star-fill text-blue-500 text-xs" />
              <span class="text-sm font-semibold text-blue-800">Available Factory Credits</span>
            </div>
            <div class="space-y-2">
              <div
                v-for="credit in allFactoryCredits"
                :key="credit.id"
                class="flex items-center justify-between bg-white rounded-lg border border-blue-100 px-4 py-2.5"
              >
                <div class="flex items-center gap-4 text-sm">
                  <div>
                    <span class="text-slate-400 text-xs block">Source</span>
                    <span class="font-mono text-blue-600 text-xs">{{ credit.source_order_number || credit.source_order_id?.slice(0, 8) }}</span>
                  </div>
                  <div>
                    <span class="text-slate-400 text-xs block">Credit Amount</span>
                    <span class="font-bold text-blue-700">{{ formatCurrency(credit.amount, 'INR') }}</span>
                  </div>
                  <div>
                    <span class="text-slate-400 text-xs block">Note</span>
                    <span class="text-slate-600 text-xs">{{ credit.notes || 'Factory overpayment credit' }}</span>
                  </div>
                </div>
                <!-- Apply button only when factory bill is not fully paid and credit is from a different order -->
                <button
                  v-if="!isFactoryFullyPaid && credit.source_order_id !== orderId"
                  @click="applyFactoryCredit(credit)"
                  :disabled="applyingFactoryCredit"
                  class="px-4 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  <i class="pi pi-check text-xs" />
                  Apply Credit
                </button>
                <span v-else-if="credit.source_order_id === orderId" class="text-xs text-slate-400 italic">Credit from this order</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Factory Payment History Table -->
        <div v-if="factoryPayments.length > 0" class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="bg-blue-50/50 border-b border-slate-200">
                <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">#</th>
                <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Date</th>
                <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Method</th>
                <th class="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Amount</th>
                <th class="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Rate</th>
                <th class="text-right px-4 py-2 text-xs font-semibold text-blue-700 uppercase">Amount INR</th>
                <th class="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase">Reference</th>
                <th class="px-4 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(p, i) in factoryPayments" :key="p.id" class="hover:bg-blue-50/30 transition-colors">
                <!-- DISPLAY MODE -->
                <template v-if="editingFactoryPaymentId !== p.id">
                  <td class="px-4 py-2.5 text-xs text-slate-400">{{ i + 1 }}</td>
                  <td class="px-4 py-2.5 text-sm text-slate-700">{{ formatDate(p.payment_date) }}</td>
                  <td class="px-4 py-2.5 text-sm text-slate-600">{{ formatPaymentMethod(p.method) }}</td>
                  <td class="px-4 py-2.5 text-sm text-right text-slate-700">{{ formatCurrency(p.amount, p.currency) }}</td>
                  <td class="px-4 py-2.5 text-sm text-right text-slate-500">{{ p.exchange_rate }}</td>
                  <td class="px-4 py-2.5 text-sm text-right font-medium text-blue-700">{{ formatCurrency(p.amount_inr, 'INR') }}</td>
                  <td class="px-4 py-2.5 text-sm text-slate-500">{{ p.reference || '\u2014' }}</td>
                  <td class="px-4 py-2.5 flex gap-1">
                    <button @click="startEditFactoryPayment(p)" class="p-1 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors" title="Edit payment">
                      <i class="pi pi-pencil text-[10px]" />
                    </button>
                    <button @click="deleteFactoryPayment(p.id)" class="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Delete payment">
                      <i class="pi pi-trash text-[10px]" />
                    </button>
                  </td>
                </template>
                <!-- EDIT MODE -->
                <template v-else>
                  <td class="px-4 py-2 text-xs text-slate-400">{{ i + 1 }}</td>
                  <td class="px-4 py-1.5"><input type="date" v-model="editForm.payment_date" class="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-400 focus:outline-none" /></td>
                  <td class="px-4 py-1.5">
                    <select v-model="editForm.method" class="w-full px-2 py-1 text-xs border border-blue-300 rounded focus:ring-2 focus:ring-blue-400 focus:outline-none">
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CHEQUE">Cheque</option>
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="LC">LC</option>
                    </select>
                  </td>
                  <td class="px-4 py-1.5">
                    <div class="flex items-center gap-1">
                      <input type="number" v-model="editForm.amount" step="0.01" class="w-20 px-2 py-1 text-sm text-right border border-blue-300 rounded focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                      <select v-model="editForm.currency" class="w-16 px-1 py-1 text-xs border border-blue-300 rounded focus:ring-2 focus:ring-blue-400 focus:outline-none">
                        <option v-for="c in ['INR','USD','CNY','EUR','GBP','JPY']" :key="c" :value="c">{{ c }}</option>
                      </select>
                    </div>
                  </td>
                  <td class="px-4 py-1.5"><input type="number" v-model="editForm.exchange_rate" step="0.01" class="w-20 px-2 py-1 text-sm text-right border border-blue-300 rounded focus:ring-2 focus:ring-blue-400 focus:outline-none" /></td>
                  <td class="px-4 py-1.5 text-sm text-right font-medium text-blue-700">{{ formatCurrency((parseFloat(editForm.amount) || 0) * (parseFloat(editForm.exchange_rate) || 1), 'INR') }}</td>
                  <td class="px-4 py-1.5"><input type="text" v-model="editForm.reference" class="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-400 focus:outline-none" placeholder="Reference" /></td>
                  <td class="px-4 py-1.5 flex gap-1">
                    <button @click="saveEditFactoryPayment" class="p-1 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors" title="Save">
                      <i class="pi pi-check text-[10px]" />
                    </button>
                    <button @click="cancelEditFactoryPayment" class="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors" title="Cancel">
                      <i class="pi pi-times text-[10px]" />
                    </button>
                  </td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="px-6 py-6 text-center text-slate-400 text-sm">
          No factory payments recorded yet. Click "Record Remittance" to add one.
        </div>
      </div>

    <!-- ==========================================
         Payment Audit Log (collapsible)
         ========================================== -->
    <div v-if="isPostPI" class="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        @click="toggleAuditLog"
        class="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
      >
        <div class="flex items-center gap-2">
          <i class="pi pi-history text-slate-400 text-sm" />
          <span class="text-sm font-semibold text-slate-700">Payment History</span>
          <span v-if="auditLog.length" class="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
            {{ auditLog.length }}
          </span>
        </div>
        <i :class="['pi text-xs text-slate-400 transition-transform', showAuditLog ? 'pi-chevron-up' : 'pi-chevron-down']" />
      </button>

      <div v-if="showAuditLog" class="border-t border-slate-100">
        <div v-if="auditLog.length === 0" class="px-5 py-8 text-center text-sm text-slate-400">
          <i class="pi pi-inbox text-2xl mb-2 block" />
          No payment changes recorded yet
        </div>
        <div v-else class="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          <div v-for="entry in auditLog" :key="entry.id" class="px-5 py-3">
            <!-- Summary row -->
            <button
              @click="toggleAuditDetail(entry.id)"
              class="w-full flex items-center gap-3 text-left group"
            >
              <div class="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
                   :class="auditActionColor(entry.action)">
                <i :class="['pi text-xs', auditActionIcon(entry.action)]" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-medium text-slate-800">{{ entry.action }}</span>
                  <span :class="['px-1.5 py-0.5 text-xs rounded font-medium',
                    entry.payment_table === 'client' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600']">
                    {{ entry.payment_table === 'client' ? 'Client' : 'Factory' }}
                  </span>
                  <span v-if="entry.action === 'UPDATE' && entry.changed_fields" class="text-xs text-slate-400">
                    Changed: {{ entry.changed_fields.join(', ') }}
                  </span>
                </div>
                <div class="text-xs text-slate-400 mt-0.5">
                  {{ formatDate(entry.created_at) }}
                  <span class="mx-1">·</span>
                  {{ new Date(entry.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }}
                </div>
              </div>
              <i :class="['pi text-xs text-slate-300 group-hover:text-slate-500 transition-transform',
                expandedAuditId === entry.id ? 'pi-chevron-up' : 'pi-chevron-down']" />
            </button>

            <!-- Expanded detail -->
            <div v-if="expandedAuditId === entry.id" class="mt-3 ml-10">
              <!-- CREATE: show after_data -->
              <div v-if="entry.action === 'CREATE' && entry.after_data" class="bg-emerald-50 rounded-lg p-3">
                <p class="text-xs font-semibold text-emerald-700 mb-2">Created with:</p>
                <div class="grid grid-cols-2 gap-x-4 gap-y-1">
                  <template v-for="(val, key) in entry.after_data" :key="key">
                    <div v-if="key !== 'id' && key !== 'order_id'" class="text-xs">
                      <span class="text-slate-500">{{ formatFieldLabel(key) }}:</span>
                      <span class="ml-1 font-medium text-slate-700">{{ formatFieldValue(val) }}</span>
                    </div>
                  </template>
                </div>
              </div>

              <!-- UPDATE: show before/after comparison -->
              <div v-if="entry.action === 'UPDATE' && entry.changed_fields" class="bg-blue-50 rounded-lg p-3">
                <p class="text-xs font-semibold text-blue-700 mb-2">Changes:</p>
                <div class="space-y-1.5">
                  <div v-for="field in entry.changed_fields" :key="field" class="flex items-center gap-2 text-xs">
                    <span class="text-slate-500 w-28 flex-shrink-0">{{ formatFieldLabel(field) }}</span>
                    <span class="text-red-500 line-through">{{ formatFieldValue(entry.before_data?.[field]) }}</span>
                    <i class="pi pi-arrow-right text-[10px] text-slate-400" />
                    <span class="text-emerald-700 font-medium">{{ formatFieldValue(entry.after_data?.[field]) }}</span>
                  </div>
                </div>
              </div>

              <!-- DELETE: show before_data -->
              <div v-if="entry.action === 'DELETE' && entry.before_data" class="bg-red-50 rounded-lg p-3">
                <p class="text-xs font-semibold text-red-700 mb-2">Deleted payment:</p>
                <div class="grid grid-cols-2 gap-x-4 gap-y-1">
                  <template v-for="(val, key) in entry.before_data" :key="key">
                    <div v-if="key !== 'id' && key !== 'order_id'" class="text-xs">
                      <span class="text-slate-500">{{ formatFieldLabel(key) }}:</span>
                      <span class="ml-1 font-medium text-slate-700">{{ formatFieldValue(val) }}</span>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Record Payment Modal -->
    <div v-if="showPaymentModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showPaymentModal = false">
      <div class="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4">
        <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <i :class="paymentForm.payment_type === 'FACTORY_PAYMENT' ? 'pi pi-send text-blue-600' : 'pi pi-wallet text-emerald-600'" />
            {{ paymentForm.payment_type === 'FACTORY_PAYMENT' ? 'Record Factory Remittance' : 'Record Client Payment' }}
          </h3>
          <button @click="showPaymentModal = false" class="p-1 text-slate-400 hover:text-slate-600 rounded">
            <i class="pi pi-times" />
          </button>
        </div>

        <div class="px-6 py-4 space-y-4">
          <!-- Payment Type -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Payment Type</label>
            <select
              v-model="paymentForm.payment_type"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="CLIENT_ADVANCE">Client Advance</option>
              <option value="CLIENT_BALANCE">Client Balance</option>
              <option value="FACTORY_PAYMENT">Factory Payment</option>
            </select>
          </div>

          <!-- Amount + Currency row -->
          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-2">
              <label class="block text-sm font-medium text-slate-700 mb-1">Amount</label>
              <input
                v-model.number="paymentForm.amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Currency</label>
              <select
                v-model="paymentForm.currency"
                class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="CNY">CNY</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="JPY">JPY</option>
              </select>
            </div>
          </div>

          <!-- Exchange Rate + Amount INR row -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Exchange Rate</label>
              <input
                v-model.number="paymentForm.exchange_rate"
                type="number"
                step="0.01"
                min="0"
                :disabled="paymentForm.currency === 'INR'"
                :class="[
                  'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500',
                  paymentForm.currency === 'INR' ? 'bg-slate-50 border-slate-100 text-slate-400' : 'border-slate-200'
                ]"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Amount (INR)</label>
              <div class="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-700 font-medium">
                &#8377;{{ computedAmountInr }}
              </div>
            </div>
          </div>

          <!-- Payment Method -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
            <select
              v-model="paymentForm.method"
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="LC">Letter of Credit</option>
            </select>
          </div>

          <!-- Reference + Date row -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Reference</label>
              <input
                v-model="paymentForm.reference"
                type="text"
                placeholder="Transaction ID, cheque no..."
                class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700 mb-1">Payment Date</label>
              <input
                v-model="paymentForm.payment_date"
                type="date"
                class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <!-- Notes -->
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
            <textarea
              v-model="paymentForm.notes"
              rows="2"
              placeholder="Additional notes..."
              class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>
        </div>

        <div class="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end">
          <button
            @click="showPaymentModal = false"
            class="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            @click="savePayment"
            :disabled="paymentSaving || (!paymentForm.amount && paymentForm.amount !== 0)"
            :class="[
              'px-4 py-2 text-sm text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2',
              paymentForm.payment_type === 'FACTORY_PAYMENT' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'
            ]"
          >
            <i v-if="paymentSaving" class="pi pi-spin pi-spinner text-xs" />
            <i v-else class="pi pi-check text-xs" />
            {{ paymentSaving ? 'Saving...' : 'Record Payment' }}
          </button>
        </div>
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
