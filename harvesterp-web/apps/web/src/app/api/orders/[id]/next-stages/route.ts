import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

/**
 * One option in the "where can I go from here?" list returned by the
 * backend's stage-engine.
 *
 * Backend `backend/routers/orders.py:2437 GET /api/orders/{id}/next-stages/`
 * returns an array; fields derived from `stage_engine.next_stages_for()`
 * (research §5).
 */
interface NextStageOption {
  stage_number: number;
  status: string;
  label: string;
  /** True when transitioning to this stage requires an override warning ack. */
  requires_warning_override?: boolean;
  /** Human-readable reason if the transition is not currently valid. */
  blocked_reason?: string | null;
  // Pass-through.
  [key: string]: unknown;
}

interface NextStagesResponse {
  options: NextStageOption[];
}

/**
 * GET /api/orders/{id}/next-stages
 *
 * Proxies FastAPI GET /api/orders/{id}/next-stages/. Returns valid forward
 * transitions for this order from its current stage (typically 1-2 options
 * but can include skip-ahead jumps in some stage families).
 *
 * Auth required.
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
    const result = await client.getJson<
      NextStagesResponse | NextStageOption[]
    >(`/api/orders/${encodeURIComponent(id)}/next-stages/`);
    // Normalize bare-array vs wrapper shapes — always return { options: [...] }.
    const options = Array.isArray(result) ? result : (result?.options ?? []);
    return NextResponse.json({ options });
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 403) {
      return NextResponse.json(
        { error: "You don't have permission to view stage options for this order" },
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
      { error: "Failed to load next-stage options" },
      { status: status >= 500 ? 502 : status },
    );
  }
}
