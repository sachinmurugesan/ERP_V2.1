import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

/**
 * Backend `GET /api/orders/{id}/timeline/` (orders.py:2828) returns a wrapped
 * envelope — NOT a bare array, NOT `{events: [...]}`. Live shape verified
 * 2026-04-26 (see migration log §7a):
 *
 *   {
 *     current_status: "DRAFT",
 *     current_stage: 1,
 *     current_name: "Draft",
 *     timeline: [{ stage, name, status: 'completed' | 'current' | 'pending' | 'unlocked' | 'locked' }, ...],
 *     overrides?: [{ stage, reason, ... }]
 *   }
 *
 * The original foundation-PR proxy expected `{events: [...]}` and silently
 * returned `{events: []}` because that key never existed. Fixed in
 * feat/order-detail-shell to pass the full envelope through.
 */

interface TimelineEntry {
  stage: number;
  name: string;
  status: "completed" | "current" | "pending" | "unlocked" | "locked";
  // Pass-through for any extra fields the backend may add.
  [key: string]: unknown;
}

interface TimelineOverride {
  stage: number;
  reason: string;
  // Pass-through.
  [key: string]: unknown;
}

interface TimelineResponse {
  current_status: string;
  current_stage: number;
  current_name: string;
  timeline: TimelineEntry[];
  overrides?: TimelineOverride[];
}

/**
 * GET /api/orders/{id}/timeline
 *
 * Proxies FastAPI GET /api/orders/{id}/timeline/. Returns the full stage
 * history envelope unchanged — consumers (the order-detail stepper) read
 * `timeline[]` for stage states and `overrides[]` for the override-history
 * card.
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
    const result = await client.getJson<TimelineResponse>(
      `/api/orders/${encodeURIComponent(id)}/timeline/`,
    );
    return NextResponse.json({
      current_status: result.current_status,
      current_stage: result.current_stage,
      current_name: result.current_name,
      timeline: result.timeline ?? [],
      overrides: result.overrides ?? [],
    });
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
