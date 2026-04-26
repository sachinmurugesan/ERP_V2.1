/**
 * Local TypeScript shapes for the order-detail shell sandbox preview.
 *
 * These mirror the corrected proxy responses from feat/order-detail-shell
 * commit 1 (`fix(api): correct order proxy shapes …`). Keeping them local
 * to the sandbox route per CONVENTIONS Section 10 — once the shell is
 * promoted to `/orders/{id}` the file moves to a shared types module.
 *
 * Backend source: `ERP_V1/backend/routers/orders.py:643` GET /api/orders/{id}/.
 * Live shape verified 2026-04-26 — see migration log §7.
 */

// ── GET /api/orders/{id}/ — order detail envelope ────────────────────────────

/** Workflow status enum (subset shown — backend `OrderStatus` has 23 values). */
export type OrderStatus =
  | "CLIENT_DRAFT"
  | "DRAFT"
  | "PENDING_PI"
  | "PI_SENT"
  | "ADVANCE_PENDING"
  | "ADVANCE_RECEIVED"
  | "FACTORY_ORDERED"
  | "PRODUCTION_60"
  | "PRODUCTION_80"
  | "PRODUCTION_90"
  | "PLAN_PACKING"
  | "FINAL_PI"
  | "PRODUCTION_100"
  | "BOOKED"
  | "LOADED"
  | "SAILED"
  | "ARRIVED"
  | "CUSTOMS_FILED"
  | "CLEARED"
  | "DELIVERED"
  | "AFTER_SALES"
  | "COMPLETED"
  | "COMPLETED_EDITING";

export interface QueryCounts {
  total: number;
  open: number;
  replied: number;
  resolved?: number;
}

export interface OrderDetail {
  id: string;
  order_number: string | null;
  client_id: string | null;
  factory_id: string | null;
  status: OrderStatus;
  currency: string;
  exchange_rate: number | null;
  exchange_rate_date: string | null;
  po_reference: string | null;
  notes: string | null;
  reopen_count: number;
  last_reopen_reason: string | null;
  igst_credit_amount: number;
  igst_credit_claimed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
  client_name: string | null;
  factory_name: string | null;
  item_count: number;
  total_value_cny: number;
  stage_number: number;
  stage_name: string;
  highest_unlocked_stage: number | null;
  pi_stale: boolean;
  version: number;
  client_reference: string | null;
  client_type: "REGULAR" | "TRANSPARENCY" | string;
  query_counts: QueryCounts;
  // Pass-through for any extra fields.
  [key: string]: unknown;
}

// ── GET /api/orders/{id}/timeline/ ───────────────────────────────────────────

export type TimelineEntryStatus =
  | "completed"
  | "current"
  | "pending"
  | "unlocked"
  | "locked";

export interface TimelineEntry {
  stage: number;
  name: string;
  status: TimelineEntryStatus;
  [key: string]: unknown;
}

export interface TimelineOverride {
  stage: number;
  reason: string;
  [key: string]: unknown;
}

export interface OrderTimelineResponse {
  current_status: OrderStatus;
  current_stage: number;
  current_name: string;
  timeline: TimelineEntry[];
  overrides: TimelineOverride[];
}

// ── GET /api/orders/{id}/next-stages/ ────────────────────────────────────────

export interface StageOption {
  status: OrderStatus | string;
  stage: number;
  name: string;
}

export interface NextStagesResponse {
  current_status: OrderStatus;
  current_stage: [number, string];
  next_stages: StageOption[];
  prev_stage: StageOption | null;
  reachable_previous: StageOption[];
  reachable_forward: StageOption[];
  highest_unlocked_stage: number | null;
}

// ── PUT /api/orders/{id}/transition/ — response ──────────────────────────────

export type TransitionResponseStatus = "ok" | "warnings" | "error";

export interface TransitionResponseBody {
  status: TransitionResponseStatus;
  warnings?: string[];
  message?: string;
}

export interface TransitionApiEnvelope {
  ok: boolean;
  result?: TransitionResponseBody;
  error?: string;
}
