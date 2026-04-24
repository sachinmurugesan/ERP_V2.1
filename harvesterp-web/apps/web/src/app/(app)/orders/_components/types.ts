/**
 * Local response shapes for /api/orders endpoints.
 *
 * Derived from what the Vue `OrderList.vue` consumes today — the OpenAPI
 * spec declares these endpoints with empty response schemas so the typed
 * SDK client can't infer them. When the backend gains typed response
 * models, swap these for imports from `@harvesterp/sdk`.
 */

export interface OrderListItem {
  id: string;
  order_number: string | null;
  po_reference?: string | null;
  client_name?: string | null;
  client_location?: string | null;
  factory_name?: string | null;
  stage_number: number;
  stage_name: string;
  status: string;
  item_count: number;
  total_value_cny: number | null;
  created_at: string;
}

export interface OrderListResponse {
  items: OrderListItem[];
  total: number;
  page: number;
  per_page: number;
}

export interface StatusCountEntry {
  count: number;
  stage?: number;
  name?: string;
}

/**
 * Raw backend shape: `{ DRAFT: {count, stage, name}, PI_SENT: {...}, ... }`
 * Keys are `OrderStatus` enum values.
 */
export type StatusCountsRaw = Record<string, StatusCountEntry>;

/**
 * Mapped per-tab counts after grouping statuses.
 * Keys are the 9 stage-group ids used by the UI.
 */
export interface StageGroupCounts {
  all: number;
  draft: number;
  pricing: number;
  payment: number;
  production: number;
  shipping: number;
  customs: number;
  delivered: number;
  completed: number;
}

export interface OrdersQueryParams {
  page: number;
  per_page: number;
  search?: string;
  status?: string;
}
