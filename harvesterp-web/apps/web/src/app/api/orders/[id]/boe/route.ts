import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

/**
 * GET /api/orders/{id}/boe?shipment_id={shipment_id}
 *
 * Proxies FastAPI GET /api/customs/shipments/{shipment_id}/boe/ — fetches
 * the Bill of Entry for one shipment, or null when none has been filed yet.
 *
 * Why does this live under /api/orders/[id]/ when the upstream is keyed by
 * shipment id? Routing organization — every dashboard-tab proxy lives under
 * /api/orders/[id]/* so the FE only ever has to know the order id; the
 * shipment id comes from the shipments query the tab already runs.
 *
 * R-19 verified shape (live curl, 2026-04-26):
 *   - missing BOE: HTTP 200, body `null` (not 404 — backend returns null
 *     so the FE can render "no BOE filed" without a try/catch).
 *   - existing BOE: per `_serialize_boe` in
 *     backend/routers/customs.py:239-291 — full BOE envelope with
 *     line_items.
 *
 * Auth: INTERNAL roles only (backend `_require_internal`). CLIENT/FACTORY
 * are forbidden.
 */

interface BoeLineItem {
  id: string;
  shipment_item_id: string | null;
  product_name: string | null;
  product_code: string | null;
  hsn_code: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  assessable_value_inr: number;
  bcd_rate: number;
  bcd_amount: number;
  swc_rate: number;
  swc_amount: number;
  igst_rate: number;
  igst_amount: number;
  total_duty: number;
  is_compensation: boolean;
}

export interface BillOfEntry {
  id: string;
  shipment_id: string;
  order_id: string;
  be_number: string | null;
  be_date: string | null;
  port_of_import: string | null;
  cha_id: string | null;
  cha_name: string | null;
  exchange_rate: number;
  fob_inr: number;
  freight_inr: number;
  insurance_inr: number;
  cif_inr: number;
  landing_charges_inr: number;
  assessment_value_inr: number;
  total_bcd: number;
  total_swc: number;
  total_igst: number;
  total_duty: number;
  status: string | null;
  notes: string | null;
  created_at: string | null;
  line_items: BoeLineItem[];
}

export async function GET(
  req: NextRequest,
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

  const shipmentId = req.nextUrl.searchParams.get("shipment_id");
  if (!shipmentId) {
    return NextResponse.json(
      { error: "Missing shipment_id query param" },
      { status: 400 },
    );
  }

  try {
    const client = await getServerClient();
    // Backend returns `null` (HTTP 200) when no BOE exists for the shipment.
    const result = await client.getJson<BillOfEntry | null>(
      `/api/customs/shipments/${encodeURIComponent(shipmentId)}/boe/`,
    );
    // NextResponse.json(null) is valid JSON `null` — pass through.
    return NextResponse.json(result);
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 403) {
      return NextResponse.json(
        { error: "Bill of Entry data is restricted to internal roles" },
        { status: 403 },
      );
    }
    if (status === 404) {
      return NextResponse.json(
        { error: "Shipment not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Failed to load Bill of Entry" },
      { status: status >= 500 ? 502 : status },
    );
  }
}
