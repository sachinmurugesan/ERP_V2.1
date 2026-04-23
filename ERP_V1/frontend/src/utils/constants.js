/**
 * Shared constants for HarvestERP
 * Single source of truth - eliminates duplication across views.
 */

/**
 * Indian states and union territories for address dropdowns.
 */
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Chandigarh', 'Puducherry', 'Jammu & Kashmir', 'Ladakh',
]

/**
 * Order status stage mapping — SINGLE SOURCE OF TRUTH.
 * Every component that needs stage info imports from here.
 * See lessons.md #13: status arrays must not be duplicated.
 */
export const STAGE_MAP = {
  DRAFT: { stage: 1, label: 'Draft', color: 'bg-slate-100 text-slate-600', border: 'border-slate-300' },
  PENDING_PI: { stage: 2, label: 'Pending PI', color: 'bg-blue-100 text-blue-700', border: 'border-blue-300' },
  PI_SENT: { stage: 3, label: 'PI Sent', color: 'bg-indigo-100 text-indigo-700', border: 'border-indigo-300' },
  ADVANCE_PENDING: { stage: 4, label: 'Advance Pending', color: 'bg-yellow-100 text-yellow-700', border: 'border-yellow-300' },
  ADVANCE_RECEIVED: { stage: 5, label: 'Advance Received', color: 'bg-lime-100 text-lime-700', border: 'border-lime-300' },
  FACTORY_ORDERED: { stage: 6, label: 'Factory Ordered', color: 'bg-orange-100 text-orange-700', border: 'border-orange-300' },
  PRODUCTION_60: { stage: 7, label: 'Production 60%', color: 'bg-amber-100 text-amber-700', border: 'border-amber-300' },
  PRODUCTION_80: { stage: 7, label: 'Production 80%', color: 'bg-amber-100 text-amber-700', border: 'border-amber-300' },
  PRODUCTION_90: { stage: 7, label: 'Production 90%', color: 'bg-amber-100 text-amber-700', border: 'border-amber-300' },
  PRODUCTION_100: { stage: 8, label: 'Production 100%', color: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-300' },
  PLAN_PACKING: { stage: 9, label: 'Plan Packing', color: 'bg-purple-100 text-purple-700', border: 'border-purple-300' },
  FINAL_PI: { stage: 10, label: 'Final PI', color: 'bg-violet-100 text-violet-700', border: 'border-violet-300' },
  FACTORY_PAYMENT: { stage: 11, label: 'Factory Payment', color: 'bg-pink-100 text-pink-700', border: 'border-pink-300' },
  BOOKED: { stage: 12, label: 'Container Booked', color: 'bg-cyan-100 text-cyan-700', border: 'border-cyan-300' },
  LOADED: { stage: 13, label: 'Container Loaded', color: 'bg-teal-100 text-teal-700', border: 'border-teal-300' },
  SAILED: { stage: 14, label: 'Sailed', color: 'bg-sky-100 text-sky-700', border: 'border-sky-300' },
  ARRIVED: { stage: 14, label: 'Arrived', color: 'bg-sky-100 text-sky-700', border: 'border-sky-300' },
  CUSTOMS_FILED: { stage: 15, label: 'Customs Filed', color: 'bg-rose-100 text-rose-700', border: 'border-rose-300' },
  CUSTOMS_CLEARED: { stage: 15, label: 'Customs Cleared', color: 'bg-green-100 text-green-700', border: 'border-green-300' },
  DELIVERED: { stage: 16, label: 'Delivered', color: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-300' },
  AFTER_SALES: { stage: 17, label: 'After Sales', color: 'bg-red-100 text-red-700', border: 'border-red-300' },
  COMPLETED: { stage: 18, label: 'Completed', color: 'bg-green-100 text-green-800', border: 'border-green-400' },
  COMPLETED_EDITING: { stage: 18, label: 'Completed (Editing)', color: 'bg-yellow-100 text-yellow-800', border: 'border-yellow-400' },
}

/**
 * Status group sets — used for tab visibility and stage guards.
 * Import these instead of duplicating arrays. (Lesson #13)
 */
export const POST_PI_STATUSES = new Set([
  'PI_SENT', 'ADVANCE_PENDING', 'ADVANCE_RECEIVED',
  'FACTORY_ORDERED', 'PRODUCTION_60', 'PRODUCTION_80', 'PRODUCTION_90', 'PRODUCTION_100',
  'PLAN_PACKING', 'FINAL_PI', 'FACTORY_PAYMENT',
  'BOOKED', 'LOADED', 'SAILED', 'ARRIVED',
  'CUSTOMS_FILED', 'CUSTOMS_CLEARED',
  'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING',
])

export const STAGE_4_PLUS = new Set([
  'ADVANCE_PENDING', 'ADVANCE_RECEIVED',
  'FACTORY_ORDERED', 'PRODUCTION_60', 'PRODUCTION_80', 'PRODUCTION_90', 'PRODUCTION_100',
  'PLAN_PACKING', 'FINAL_PI', 'FACTORY_PAYMENT',
  'BOOKED', 'LOADED', 'SAILED', 'ARRIVED',
  'CUSTOMS_FILED', 'CUSTOMS_CLEARED',
  'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING',
])

export const STAGE_6_PLUS = new Set([
  'FACTORY_ORDERED', 'PRODUCTION_60', 'PRODUCTION_80', 'PRODUCTION_90', 'PRODUCTION_100',
  'PLAN_PACKING', 'FINAL_PI', 'FACTORY_PAYMENT',
  'BOOKED', 'LOADED', 'SAILED', 'ARRIVED',
  'CUSTOMS_FILED', 'CUSTOMS_CLEARED',
  'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING',
])

export const BOOKING_STATUSES = new Set([
  'BOOKED', 'LOADED', 'SAILED', 'ARRIVED',
  'CUSTOMS_FILED', 'CUSTOMS_CLEARED',
  'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING',
])

export const SAILING_STATUSES = new Set([
  'LOADED', 'SAILED', 'ARRIVED',
  'CUSTOMS_FILED', 'CUSTOMS_CLEARED',
  'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING',
])

export const CUSTOMS_STATUSES = new Set([
  'CUSTOMS_FILED', 'CUSTOMS_CLEARED',
  'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING',
])

export const SHIPPING_DOC_STATUSES = new Set([
  'BOOKED', 'LOADED', 'SAILED', 'ARRIVED',
  'CUSTOMS_FILED', 'CUSTOMS_CLEARED',
  'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING',
])

export const PACKING_STATUSES = new Set([
  'PLAN_PACKING', 'FINAL_PI', 'FACTORY_PAYMENT',
  'BOOKED', 'LOADED', 'SAILED', 'ARRIVED',
  'CUSTOMS_FILED', 'CUSTOMS_CLEARED',
  'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING',
])

export const TERMINAL_STATUSES = new Set([
  'DELIVERED', 'AFTER_SALES', 'COMPLETED', 'COMPLETED_EDITING',
])

/**
 * Get stage info for a given status.
 * @param {string} status
 * @returns {{ stage: number, label: string, color: string, border: string }}
 */
export function getStageInfo(status) {
  return STAGE_MAP[status] || { stage: 0, label: status, color: 'bg-gray-100 text-gray-600', border: 'border-gray-300' }
}
