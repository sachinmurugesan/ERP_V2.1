/**
 * Status badge display map
 *
 * Maps each OrderStatus to a display label and Tailwind CSS classes.
 * Colour palette sourced from frontend/src/utils/constants.js STAGE_MAP
 * (bg-X/border-X / text-X classes used in the existing frontend).
 *
 * ⚠️  The exact per-status colours are INVENTED where not explicitly listed
 *     in constants.js (which only had per-stage colours, not per-status).
 *     Stage-level colours have been applied to all statuses within a stage.
 *     Flag: NEEDS_DESIGN_REVIEW for per-status badge colour variants.
 */

import { OrderStatus } from "./order.js";

export interface BadgeStyle {
  /** Human-readable display label */
  label: string;
  /** Tailwind bg + text class string for the badge chip */
  className: string;
}

export const STATUS_BADGE_MAP: Readonly<Record<OrderStatus, BadgeStyle>> = {
  // Stage 1 — blue
  [OrderStatus.PI_REQUESTED]:           { label: "PI Requested",           className: "bg-blue-100 text-blue-700" },
  [OrderStatus.PI_SENT]:                { label: "PI Sent",                className: "bg-blue-100 text-blue-700" },
  [OrderStatus.PI_CONFIRMED]:           { label: "PI Confirmed",           className: "bg-blue-200 text-blue-800" },

  // Stage 2 — violet
  [OrderStatus.ADVANCE_PAYMENT_PENDING]:{ label: "Advance Pending",        className: "bg-violet-100 text-violet-700" },
  [OrderStatus.ADVANCE_PAYMENT_DONE]:   { label: "Advance Done",           className: "bg-violet-200 text-violet-800" },

  // Stage 3 — amber
  [OrderStatus.IN_PRODUCTION]:          { label: "In Production",          className: "bg-amber-100 text-amber-700" },
  [OrderStatus.PRODUCTION_COMPLETE]:    { label: "Production Complete",    className: "bg-amber-200 text-amber-800" },

  // Stage 4 — emerald / red for failed
  [OrderStatus.QC_PENDING]:             { label: "QC Pending",             className: "bg-emerald-100 text-emerald-700" },
  [OrderStatus.QC_PASSED]:              { label: "QC Passed",              className: "bg-emerald-200 text-emerald-800" },
  [OrderStatus.QC_FAILED]:              { label: "QC Failed",              className: "bg-red-100 text-red-700" },
  [OrderStatus.DISPATCHED]:             { label: "Dispatched",             className: "bg-emerald-300 text-emerald-900" },

  // Stage 5 — cyan
  [OrderStatus.BOOKING_CONFIRMED]:      { label: "Booking Confirmed",      className: "bg-cyan-100 text-cyan-700" },
  [OrderStatus.SAILING]:                { label: "Sailing",                className: "bg-cyan-200 text-cyan-800" },

  // Stage 6 — indigo
  [OrderStatus.ARRIVED]:                { label: "Arrived",                className: "bg-indigo-100 text-indigo-700" },
  [OrderStatus.CUSTOMS_CLEARED]:        { label: "Customs Cleared",        className: "bg-indigo-200 text-indigo-800" },
  [OrderStatus.DELIVERED]:              { label: "Delivered",              className: "bg-indigo-300 text-indigo-900" },

  // Stage 7 — pink / green for closure
  [OrderStatus.INVOICE_SENT]:           { label: "Invoice Sent",           className: "bg-pink-100 text-pink-700" },
  [OrderStatus.PAYMENT_RECEIVED]:       { label: "Payment Received",       className: "bg-pink-200 text-pink-800" },
  [OrderStatus.CLOSED]:                 { label: "Closed",                 className: "bg-gray-200 text-gray-700" },

  // Special
  [OrderStatus.ON_HOLD]:                { label: "On Hold",                className: "bg-yellow-100 text-yellow-700" },
  [OrderStatus.CANCELLED]:              { label: "Cancelled",              className: "bg-red-100 text-red-700" },
  [OrderStatus.DISPUTE]:                { label: "Dispute",                className: "bg-orange-100 text-orange-700" },
  [OrderStatus.REFUND_ISSUED]:          { label: "Refund Issued",          className: "bg-purple-100 text-purple-700" },
} as const;

/**
 * Get the display label for an order status.
 *
 * @example
 * getStatusLabel(OrderStatus.SAILING) // "Sailing"
 */
export function getStatusLabel(status: OrderStatus): string {
  return STATUS_BADGE_MAP[status].label;
}

/**
 * Get the Tailwind className for an order status badge.
 *
 * @example
 * getStatusClassName(OrderStatus.QC_FAILED) // "bg-red-100 text-red-700"
 */
export function getStatusClassName(status: OrderStatus): string {
  return STATUS_BADGE_MAP[status].className;
}
