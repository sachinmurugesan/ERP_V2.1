/**
 * Local response shapes for /api/dashboard/* endpoints.
 *
 * The OpenAPI spec declares these endpoints with empty (`{}`) response
 * schemas (pre-existing tech debt — FastAPI routes without `response_model=`).
 * Shapes here are derived from what the legacy Vue dashboard consumes
 * at ERP_V1/frontend/src/views/Dashboard.vue.
 *
 * When the backend gains typed response models, swap these for imports
 * from @harvesterp/sdk generated types.
 */

export interface DashboardSummary {
  total_orders: number;
  in_production: number;
  in_transit: number;
  aftersales_open: number;
  client_inquiries: number;
}

export interface ActiveShipment {
  id: string;
  order_number: string;
  po_reference: string | null;
  factory_name: string | null;
  total_value_cny: number | null;
  stage_number: number;
  stage_name: string;
}

export interface RecentActivityEvent {
  id: string;
  action: string;
  details: string;
  updated_at: string;
}

export interface ClientInquiry {
  id: string;
  client_name: string;
  po_reference: string | null;
  item_count: number;
  created_at: string;
}

export interface ClientInquiriesResponse {
  inquiries: ClientInquiry[];
}
