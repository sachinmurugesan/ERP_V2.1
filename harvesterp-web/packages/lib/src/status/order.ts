/**
 * Order status definitions — sourced from backend/enums.py OrderStatus (23 values)
 * and frontend/src/utils/constants.js STAGE_MAP / status group Sets.
 *
 * This file is the single source of truth for the frontend.
 */

// ---------------------------------------------------------------------------
// Enum
// ---------------------------------------------------------------------------

export const OrderStatus = {
  // Stage 1 — PI / Booking
  PI_REQUESTED:          "PI_REQUESTED",
  PI_SENT:               "PI_SENT",
  PI_CONFIRMED:          "PI_CONFIRMED",

  // Stage 2 — Advance payment
  ADVANCE_PAYMENT_PENDING: "ADVANCE_PAYMENT_PENDING",
  ADVANCE_PAYMENT_DONE:    "ADVANCE_PAYMENT_DONE",

  // Stage 3 — Production
  IN_PRODUCTION:         "IN_PRODUCTION",
  PRODUCTION_COMPLETE:   "PRODUCTION_COMPLETE",

  // Stage 4 — QC / Dispatch
  QC_PENDING:            "QC_PENDING",
  QC_PASSED:             "QC_PASSED",
  QC_FAILED:             "QC_FAILED",
  DISPATCHED:            "DISPATCHED",

  // Stage 5 — Shipping
  BOOKING_CONFIRMED:     "BOOKING_CONFIRMED",
  SAILING:               "SAILING",

  // Stage 6 — Customs / Arrival
  ARRIVED:               "ARRIVED",
  CUSTOMS_CLEARED:       "CUSTOMS_CLEARED",
  DELIVERED:             "DELIVERED",

  // Stage 7 — Billing / Closure
  INVOICE_SENT:          "INVOICE_SENT",
  PAYMENT_RECEIVED:      "PAYMENT_RECEIVED",
  CLOSED:                "CLOSED",

  // Special
  ON_HOLD:               "ON_HOLD",
  CANCELLED:             "CANCELLED",
  DISPUTE:               "DISPUTE",
  REFUND_ISSUED:         "REFUND_ISSUED",
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

// ---------------------------------------------------------------------------
// Stage mapping — sourced from backend/enums.py STAGE_MAP
// ---------------------------------------------------------------------------

export interface StageInfo {
  /** Stage number 1–7 */
  stage: number;
  /** Human-readable stage label */
  label: string;
}

export const STATUS_STAGE_MAP: Readonly<Record<OrderStatus, StageInfo>> = {
  [OrderStatus.PI_REQUESTED]:           { stage: 1, label: "PI / Booking" },
  [OrderStatus.PI_SENT]:                { stage: 1, label: "PI / Booking" },
  [OrderStatus.PI_CONFIRMED]:           { stage: 1, label: "PI / Booking" },

  [OrderStatus.ADVANCE_PAYMENT_PENDING]:{ stage: 2, label: "Advance Payment" },
  [OrderStatus.ADVANCE_PAYMENT_DONE]:   { stage: 2, label: "Advance Payment" },

  [OrderStatus.IN_PRODUCTION]:          { stage: 3, label: "Production" },
  [OrderStatus.PRODUCTION_COMPLETE]:    { stage: 3, label: "Production" },

  [OrderStatus.QC_PENDING]:             { stage: 4, label: "QC / Dispatch" },
  [OrderStatus.QC_PASSED]:              { stage: 4, label: "QC / Dispatch" },
  [OrderStatus.QC_FAILED]:              { stage: 4, label: "QC / Dispatch" },
  [OrderStatus.DISPATCHED]:             { stage: 4, label: "QC / Dispatch" },

  [OrderStatus.BOOKING_CONFIRMED]:      { stage: 5, label: "Shipping" },
  [OrderStatus.SAILING]:                { stage: 5, label: "Shipping" },

  [OrderStatus.ARRIVED]:                { stage: 6, label: "Customs / Arrival" },
  [OrderStatus.CUSTOMS_CLEARED]:        { stage: 6, label: "Customs / Arrival" },
  [OrderStatus.DELIVERED]:              { stage: 6, label: "Customs / Arrival" },

  [OrderStatus.INVOICE_SENT]:           { stage: 7, label: "Billing / Closure" },
  [OrderStatus.PAYMENT_RECEIVED]:       { stage: 7, label: "Billing / Closure" },
  [OrderStatus.CLOSED]:                 { stage: 7, label: "Billing / Closure" },

  // Special statuses are assigned stage 0 (outside normal flow)
  [OrderStatus.ON_HOLD]:                { stage: 0, label: "Special" },
  [OrderStatus.CANCELLED]:              { stage: 0, label: "Special" },
  [OrderStatus.DISPUTE]:                { stage: 0, label: "Special" },
  [OrderStatus.REFUND_ISSUED]:          { stage: 0, label: "Special" },
} as const;

// ---------------------------------------------------------------------------
// Status groups — sourced from frontend/src/utils/constants.js
// ---------------------------------------------------------------------------

/** Statuses that appear after PI confirmation */
export const POST_PI_STATUSES = new Set<OrderStatus>([
  OrderStatus.ADVANCE_PAYMENT_PENDING,
  OrderStatus.ADVANCE_PAYMENT_DONE,
  OrderStatus.IN_PRODUCTION,
  OrderStatus.PRODUCTION_COMPLETE,
  OrderStatus.QC_PENDING,
  OrderStatus.QC_PASSED,
  OrderStatus.QC_FAILED,
  OrderStatus.DISPATCHED,
  OrderStatus.BOOKING_CONFIRMED,
  OrderStatus.SAILING,
  OrderStatus.ARRIVED,
  OrderStatus.CUSTOMS_CLEARED,
  OrderStatus.DELIVERED,
  OrderStatus.INVOICE_SENT,
  OrderStatus.PAYMENT_RECEIVED,
  OrderStatus.CLOSED,
]);

/** Stage 4+ statuses */
export const STAGE_4_PLUS = new Set<OrderStatus>([
  OrderStatus.QC_PENDING,
  OrderStatus.QC_PASSED,
  OrderStatus.QC_FAILED,
  OrderStatus.DISPATCHED,
  OrderStatus.BOOKING_CONFIRMED,
  OrderStatus.SAILING,
  OrderStatus.ARRIVED,
  OrderStatus.CUSTOMS_CLEARED,
  OrderStatus.DELIVERED,
  OrderStatus.INVOICE_SENT,
  OrderStatus.PAYMENT_RECEIVED,
  OrderStatus.CLOSED,
]);

/** Stage 6+ statuses */
export const STAGE_6_PLUS = new Set<OrderStatus>([
  OrderStatus.ARRIVED,
  OrderStatus.CUSTOMS_CLEARED,
  OrderStatus.DELIVERED,
  OrderStatus.INVOICE_SENT,
  OrderStatus.PAYMENT_RECEIVED,
  OrderStatus.CLOSED,
]);

/** Booking / shipping confirmation statuses */
export const BOOKING_STATUSES = new Set<OrderStatus>([
  OrderStatus.BOOKING_CONFIRMED,
  OrderStatus.SAILING,
]);

/** Sailing statuses */
export const SAILING_STATUSES = new Set<OrderStatus>([
  OrderStatus.SAILING,
]);

/** Customs-related statuses */
export const CUSTOMS_STATUSES = new Set<OrderStatus>([
  OrderStatus.ARRIVED,
  OrderStatus.CUSTOMS_CLEARED,
]);

/** Shipping document eligible statuses */
export const SHIPPING_DOC_STATUSES = new Set<OrderStatus>([
  OrderStatus.BOOKING_CONFIRMED,
  OrderStatus.SAILING,
  OrderStatus.ARRIVED,
  OrderStatus.CUSTOMS_CLEARED,
  OrderStatus.DELIVERED,
]);

/** Packing-related statuses */
export const PACKING_STATUSES = new Set<OrderStatus>([
  OrderStatus.QC_PASSED,
  OrderStatus.DISPATCHED,
]);

/** Terminal (end-state) statuses */
export const TERMINAL_STATUSES = new Set<OrderStatus>([
  OrderStatus.CLOSED,
  OrderStatus.CANCELLED,
  OrderStatus.REFUND_ISSUED,
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the stage number for an order status. Returns 0 for special statuses. */
export function getStage(status: OrderStatus): number {
  return STATUS_STAGE_MAP[status].stage;
}

/** Check if a status is terminal (no further transitions possible). */
export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Check if a status is in stage 4 or later. */
export function isStage4Plus(status: OrderStatus): boolean {
  return STAGE_4_PLUS.has(status);
}
