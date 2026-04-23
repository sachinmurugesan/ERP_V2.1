/**
 * Shared client portal utilities — single source of truth for
 * status labels, colors, stage definitions, and helper functions.
 * Used across ClientOrders, ClientDashboard, ClientOrderDetail, etc.
 */

// ── Client-friendly status labels (no internal jargon) ────────────────────
export const CLIENT_STATUS_LABELS = {
  CLIENT_DRAFT: 'Inquiry Submitted',
  DRAFT: 'Under Review',
  PENDING_PI: 'Pricing in Progress',
  PI_SENT: 'Proforma Invoice Ready',
  ADVANCE_PENDING: 'Payment Required',
  ADVANCE_RECEIVED: 'Payment Received',
  FACTORY_ORDERED: 'Ordered from Supplier',
  PRODUCTION_60: 'Production 60%',
  PRODUCTION_80: 'Production 80%',
  PRODUCTION_90: 'Production 90%',
  PLAN_PACKING: 'Packing Preparation',
  FINAL_PI: 'Final Invoice',
  PRODUCTION_100: 'Production Complete',
  BOOKED: 'Shipment Booked',
  LOADED: 'Loaded on Vessel',
  SAILED: 'In Transit',
  ARRIVED: 'Arrived at Port',
  CUSTOMS_FILED: 'Customs Processing',
  CLEARED: 'Customs Cleared',
  DELIVERED: 'Delivered',
  AFTER_SALES: 'After-Sales Review',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

// ── Status → Tailwind color classes ───────────────────────────────────────
export const CLIENT_STATUS_COLORS = {
  CLIENT_DRAFT: 'bg-teal-100 text-teal-700',
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING_PI: 'bg-blue-100 text-blue-700',
  PI_SENT: 'bg-indigo-100 text-indigo-700',
  ADVANCE_PENDING: 'bg-amber-100 text-amber-700',
  ADVANCE_RECEIVED: 'bg-emerald-100 text-emerald-700',
  FACTORY_ORDERED: 'bg-violet-100 text-violet-700',
  PRODUCTION_60: 'bg-orange-100 text-orange-700',
  PRODUCTION_80: 'bg-orange-100 text-orange-700',
  PRODUCTION_90: 'bg-orange-100 text-orange-700',
  PRODUCTION_100: 'bg-green-100 text-green-700',
  PLAN_PACKING: 'bg-cyan-100 text-cyan-700',
  FINAL_PI: 'bg-indigo-100 text-indigo-700',
  BOOKED: 'bg-cyan-100 text-cyan-700',
  LOADED: 'bg-blue-100 text-blue-700',
  SAILED: 'bg-blue-100 text-blue-700',
  ARRIVED: 'bg-violet-100 text-violet-700',
  CUSTOMS_FILED: 'bg-amber-100 text-amber-700',
  CLEARED: 'bg-emerald-100 text-emerald-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  AFTER_SALES: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

// ── Horizontal stepper stage definitions ──────────────────────────────────
export const STEPPER_STAGES = [
  { num: 1, label: 'Draft', statuses: ['DRAFT', 'CLIENT_DRAFT'] },
  { num: 2, label: 'Pending PI', statuses: ['PENDING_PI'] },
  { num: 3, label: 'PI Sent', statuses: ['PI_SENT'] },
  { num: 4, label: 'Payment', statuses: ['ADVANCE_PENDING', 'ADVANCE_RECEIVED'] },
  { num: 5, label: 'Factory Ordered', statuses: ['FACTORY_ORDERED'] },
  { num: 6, label: 'Production 60%', statuses: ['PRODUCTION_60'] },
  { num: 7, label: 'Production 80%', statuses: ['PRODUCTION_80'] },
  { num: 8, label: 'Production 90%', statuses: ['PRODUCTION_90'] },
  { num: 9, label: 'Plan Packing', statuses: ['PLAN_PACKING'] },
  { num: 10, label: 'Final PI', statuses: ['FINAL_PI'] },
  { num: 11, label: 'Production 100%', statuses: ['PRODUCTION_100'] },
  { num: 12, label: 'Booked', statuses: ['BOOKED'] },
  { num: 13, label: 'Sailing', statuses: ['LOADED', 'SAILED', 'ARRIVED'] },
  { num: 14, label: 'Customs', statuses: ['CUSTOMS_FILED', 'CLEARED'] },
  { num: 15, label: 'Delivered', statuses: ['DELIVERED', 'AFTER_SALES', 'COMPLETED'] },
]

// ── Status sets for tab/feature gating ────────────────────────────────────
export const POST_PI_STATUSES = new Set([
  'PI_SENT', 'ADVANCE_PENDING', 'ADVANCE_RECEIVED', 'FACTORY_ORDERED',
  'PRODUCTION_60', 'PRODUCTION_80', 'PRODUCTION_90', 'PLAN_PACKING',
  'FINAL_PI', 'PRODUCTION_100', 'BOOKED', 'LOADED', 'SAILED', 'ARRIVED',
  'CUSTOMS_FILED', 'CLEARED', 'DELIVERED', 'AFTER_SALES', 'COMPLETED',
])

export const PRODUCTION_STATUSES = new Set([
  'FACTORY_ORDERED', 'PRODUCTION_60', 'PRODUCTION_80', 'PRODUCTION_90',
  'PLAN_PACKING', 'FINAL_PI', 'PRODUCTION_100', 'BOOKED', 'LOADED',
  'SAILED', 'ARRIVED', 'CUSTOMS_FILED', 'CLEARED', 'DELIVERED',
  'AFTER_SALES', 'COMPLETED',
])

export const SHIPPING_STATUSES = new Set([
  'LOADED', 'SAILED', 'ARRIVED', 'CUSTOMS_FILED', 'CLEARED',
  'DELIVERED', 'AFTER_SALES', 'COMPLETED',
])

export const AFTER_SALES_STATUSES = new Set(['AFTER_SALES', 'COMPLETED'])

// ── Filter options for order list dropdown ────────────────────────────────
export const ORDER_FILTER_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'CLIENT_DRAFT', label: 'Inquiry Submitted' },
  { value: 'DRAFT', label: 'Under Review' },
  { value: 'PENDING_PI', label: 'Pricing' },
  { value: 'PI_SENT', label: 'PI Ready' },
  { value: 'ADVANCE_PENDING', label: 'Payment Required' },
  { value: 'ADVANCE_RECEIVED', label: 'Payment Received' },
  { value: 'FACTORY_ORDERED', label: 'In Production' },
  { value: 'SHIPPED', label: 'Shipping' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

// ── Helper functions ──────────────────────────────────────────────────────

/** Get client-friendly label for a status */
export function getStatusLabel(status) {
  return CLIENT_STATUS_LABELS[status] || (status || '').replace(/_/g, ' ')
}

/** Get Tailwind color classes for a status badge */
export function getStatusColor(status) {
  return CLIENT_STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'
}

/** Get current stage number from order status */
export function getStageNumber(status) {
  const found = STEPPER_STAGES.find(s => s.statuses.includes(status))
  return found ? found.num : 0
}

/** Get stepper step state: 'completed' | 'current' | 'pending' */
export function getStepState(step, currentStageNum) {
  if (step.num < currentStageNum) return 'completed'
  if (step.num === currentStageNum) return 'current'
  return 'pending'
}
