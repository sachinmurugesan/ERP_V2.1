import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

/**
 * Local shape for one timeline event.
 *
 * Backend `backend/routers/orders.py:2828 GET /api/orders/{id}/timeline/`
 * returns an array of stage-history events. No `response_model` upstream;
 * fields below are derived from `_serialize_timeline` and verified live
 * during the orders module audit (research §6.1).
 */
interface OrderTimelineEvent {
  stage_number: number;
  stage_name: string;
  status: string;
  reached_at: string | null;
  reached_by_user_id: string | null;
  reached_by_user_name: string | null;
  override_reason: string | null;
  warnings: string[] | null;
  // Pass-through for any extra fields the backend may add.
  [key: string]: unknown;
}

interface TimelineResponse {
  /** Some endpoints return a bare array; others wrap. The backend wraps. */
  events: OrderTimelineEvent[];
}

/**
 * GET /api/orders/{id}/timeline
 *
 * Proxies FastAPI GET /api/orders/{id}/timeline/. Returns the full stage
 * history for an order — used by the future order-detail StageStepper.
 *
 * Auth required; backend enforces order-scope.
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
    const result = await client.getJson<TimelineResponse | OrderTimelineEvent[]>(
      `/api/orders/${encodeURIComponent(id)}/timeline/`,
    );
    // Normalize: always return { events: [...] } for stable client typing.
    const events = Array.isArray(result) ? result : (result?.events ?? []);
    return NextResponse.json({ events });
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 403) {
      return NextResponse.json(
        { error: "You don't have permission to view this order's timeline" },
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
      { error: "Failed to load timeline" },
      { status: status >= 500 ? 502 : status },
    );
  }
}
