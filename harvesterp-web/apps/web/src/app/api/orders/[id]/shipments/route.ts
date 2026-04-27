import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

/**
 * GET /api/orders/{id}/shipments
 *
 * Proxies FastAPI GET /api/shipping/orders/{id}/shipments/ — list of
 * container bookings (shipments) for an order.
 *
 * R-19 verified shape (live curl, 2026-04-26):
 *   - empty case: `[]` (bare array, NO envelope)
 *   - populated: `OrderShipment[]` per `_serialize_shipment` in
 *     backend/routers/shipping.py:323-389. Note `etd` / `eta` / `atd` / `ata`
 *     are ISO date strings or null; the backend also exposes
 *     `actual_departure_date` / `actual_arrival_date` aliases for FE parity.
 *
 * Auth: any authenticated user; backend enforces row-level scope (CLIENT
 * users need `show_shipping` portal permission, FACTORY users only their
 * factory's orders).
 */

interface ShipmentItem {
  id: string;
  shipment_id: string;
  packing_list_item_id: string | null;
  allocated_qty: number;
  pallet_number: number | null;
  product_name?: string | null;
  product_code?: string | null;
  ordered_qty?: number;
  factory_ready_qty?: number;
}

export interface OrderShipment {
  id: string;
  order_id: string;
  container_type: string | null;
  container_number: string | null;
  vessel_name: string | null;
  voyage_number: string | null;
  bl_number: string | null;
  port_of_loading: string | null;
  port_of_discharge: string | null;
  etd: string | null;
  eta: string | null;
  atd: string | null;
  ata: string | null;
  actual_departure_date: string | null;
  actual_arrival_date: string | null;
  phase: string | null;
  freight_cost_inr: number | null;
  thc_inr: number | null;
  doc_fees_inr: number | null;
  sailing_phase: string | null;
  shipper: string | null;
  consignee: string | null;
  notify_party: string | null;
  description_of_goods: string | null;
  freight_terms: string | null;
  seal_number: string | null;
  loading_date: string | null;
  loading_notes: string | null;
  cfs_receipt_number: string | null;
  arrival_notes: string | null;
  freight_forwarder_id: string | null;
  freight_forwarder_name: string | null;
  cha_id: string | null;
  cha_name: string | null;
  cfs_id: string | null;
  cfs_name: string | null;
  transport_id: string | null;
  transport_name: string | null;
  items: ShipmentItem[];
  created_at: string | null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing order id" }, { status: 400 });
  }
  try {
    const client = await getServerClient();
    const result = await client.getJson<OrderShipment[]>(
      `/api/shipping/orders/${encodeURIComponent(id)}/shipments/`,
    );
    return NextResponse.json(result);
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 403) {
      return NextResponse.json(
        { error: "You don't have permission to view shipments for this order" },
        { status: 403 },
      );
    }
    if (status === 404) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to load shipments" },
      { status: status >= 500 ? 502 : status },
    );
  }
}
