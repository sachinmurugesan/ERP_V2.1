import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

/**
 * GET / POST  /api/orders/{id}/queries
 *
 * GET  → proxies FastAPI GET  /api/orders/{id}/queries/  (list)
 * POST → proxies FastAPI POST /api/orders/{id}/queries/  (create thread)
 *
 * R-19 verified shape (live curl, 2026-04-27, ADMIN as
 * admin@harvesterp.com on order de2258e0-…):
 *   GET empty-case  → HTTP 200, body `[]` (bare array)
 *   GET populated   → HTTP 200, body Array<OrderQuery>
 *   POST create     → HTTP 200, body OrderQuery (full envelope with
 *                     messages[0] = the first message)
 *
 * Create body fields are `{subject, message, query_type, order_item_id?,
 * product_id?}`. NOTE: the Vue api wrapper labels the payload field as
 * `message` (not `body` like the spec sketch suggested) — backend's
 * CreateQueryRequest schema accepts `message`. Tier 1 only sends
 * `subject` + `message` + `query_type`; inline-from-item is a Tier 2
 * feature.
 *
 * Auth: any authenticated user; backend RLS scopes CLIENT/FACTORY to
 * their own orders.
 */

export type OrderQueryStatus = "OPEN" | "REPLIED" | "RESOLVED";
export type OrderQueryType =
  | "PHOTO_REQUEST"
  | "VIDEO_REQUEST"
  | "DIMENSION_CHECK"
  | "QUALITY_QUERY"
  | "ALTERNATIVE"
  | "GENERAL";

export interface OrderQueryMessage {
  id: string;
  query_id: string;
  sender_id: string;
  sender_role: string;
  sender_name: string;
  message: string;
  attachments: string[] | null;
  created_at: string | null;
}

export interface OrderQuery {
  id: string;
  order_id: string;
  order_item_id: string | null;
  product_id: string | null;
  query_type: OrderQueryType;
  status: OrderQueryStatus;
  subject: string;
  created_by_id: string;
  created_by_role: string;
  created_at: string | null;
  updated_at: string | null;
  resolved_at: string | null;
  resolution_remark: string | null;
  messages: OrderQueryMessage[];
  product_code: string | null;
  product_name: string | null;
  message_count: number;
  last_message_at: string | null;
}

interface CreateBody {
  subject?: string;
  message?: string;
  query_type?: OrderQueryType;
  order_item_id?: string | null;
  product_id?: string | null;
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
    const result = await client.getJson<OrderQuery[]>(
      `/api/orders/${encodeURIComponent(id)}/queries/`,
    );
    return NextResponse.json(result);
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 403) {
      return NextResponse.json(
        { error: "You don't have permission to view queries for this order" },
        { status: 403 },
      );
    }
    if (status === 404) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to load queries" },
      { status: status >= 500 ? 502 : status },
    );
  }
}

export async function POST(
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

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body.subject?.trim() || !body.message?.trim()) {
    return NextResponse.json(
      { error: "subject and message are required" },
      { status: 400 },
    );
  }

  const payload = {
    subject: body.subject.trim(),
    message: body.message.trim(),
    query_type: body.query_type ?? "GENERAL",
    ...(body.order_item_id ? { order_item_id: body.order_item_id } : {}),
    ...(body.product_id ? { product_id: body.product_id } : {}),
  };

  try {
    const client = await getServerClient();
    const result = await client.postJson<OrderQuery>(
      `/api/orders/${encodeURIComponent(id)}/queries/`,
      payload,
    );
    return NextResponse.json(result);
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 403) {
      return NextResponse.json(
        { error: "You don't have permission to create queries on this order" },
        { status: 403 },
      );
    }
    if (status === 404) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to create query" },
      { status: status >= 500 ? 502 : status },
    );
  }
}
