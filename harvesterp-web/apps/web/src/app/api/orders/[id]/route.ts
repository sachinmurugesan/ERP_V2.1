import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

/**
 * Local shape for the order-detail GET response.
 *
 * Backend `_serialize_order` returns ~40 fields including embedded items,
 * client/factory references, production dates, PI metadata, etc. This
 * interface declares only the fields the foundation PR needs to type at
 * the proxy boundary; consumers are free to extend it (and SHOULD declare
 * their own narrower types in `_components/types.ts` per CONVENTIONS
 * Section 10 local-interface rule).
 *
 * The backend endpoint (`backend/routers/orders.py:643 GET /api/orders/{id}/`)
 * has no `response_model` → OpenAPI types it as `unknown`. Hence the
 * `getJson<OrderDetail>` escape hatch.
 */
interface OrderDetail {
  id: string;
  order_number?: string | null;
  stage_number: number;
  stage_name: string;
  status: string;
  client_id?: string | null;
  factory_id?: string | null;
  total_value_cny?: number | null;
  created_at: string;
  updated_at?: string | null;
  // Pass-through for the rest of the order object.
  [key: string]: unknown;
}

interface DeleteBody {
  reason?: string;
}

/**
 * GET /api/orders/{id}
 *
 * Proxies FastAPI GET /api/orders/{id}/. Returns the full order-detail
 * object. Auth is required; backend enforces order-scope (CLIENT users can
 * only see their own orders; FACTORY users only their factory's orders).
 */
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
    const order = await client.getJson<OrderDetail>(
      `/api/orders/${encodeURIComponent(id)}/`,
    );
    return NextResponse.json(order);
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 403) {
      return NextResponse.json(
        { error: "You don't have permission to view this order" },
        { status: 403 },
      );
    }
    if (status === 404) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Failed to load order" },
      { status: status >= 500 ? 502 : status },
    );
  }
}

/**
 * DELETE /api/orders/{id}
 *
 * Proxies FastAPI DELETE /api/orders/{id}/ and, if a non-empty `reason`
 * string is provided in the JSON body, follows up with
 * PUT /api/orders/{id}/delete-reason/ to persist the audit note.
 */
export async function DELETE(
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

  let body: DeleteBody = {};
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    // Empty body is fine — reason is optional.
  }

  try {
    const client = await getServerClient();
    await client.deleteJson(`/api/orders/${encodeURIComponent(id)}/`);

    const reason = body.reason?.trim();
    if (reason) {
      try {
        await client.putJson(
          `/api/orders/${encodeURIComponent(id)}/delete-reason/`,
          { reason },
        );
      } catch {
        // Reason capture is best-effort — the delete already succeeded.
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Failed to delete order";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
