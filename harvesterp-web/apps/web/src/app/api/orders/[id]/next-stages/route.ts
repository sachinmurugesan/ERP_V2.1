import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

/**
 * Backend `GET /api/orders/{id}/next-stages/` (orders.py:2437) returns FOUR
 * lists in one shot — NOT `{options: [...]}` and NOT a bare array. Live
 * shape verified 2026-04-26 (see migration log §7a):
 *
 *   {
 *     current_status: "DRAFT",
 *     current_stage: [1, "Draft"],
 *     next_stages: [{ status, stage, name }],
 *     prev_stage: null | { status, stage, name },
 *     reachable_previous: [{ status, stage, name }, ...],
 *     reachable_forward: [{ status, stage, name }, ...],
 *     highest_unlocked_stage: number | null,
 *   }
 *
 * The four lists drive distinct UI affordances on the order-detail shell:
 *   - next_stages[]        → forward "Next: ..." buttons
 *   - prev_stage           → "Go back" button
 *   - reachable_previous[] → clickable completed stepper circles
 *   - reachable_forward[]  → clickable amber unlocked stepper circles +
 *                            "Return to S{n}" button
 *
 * The original foundation-PR proxy expected `{options: [...]}` and silently
 * returned `{options: []}` because that key never existed. Fixed in
 * feat/order-detail-shell to pass the full envelope through.
 */

interface StageOption {
  status: string;
  stage: number;
  name: string;
}

interface NextStagesResponse {
  current_status: string;
  current_stage: [number, string];
  next_stages: StageOption[];
  prev_stage: StageOption | null;
  reachable_previous: StageOption[];
  reachable_forward: StageOption[];
  highest_unlocked_stage: number | null;
}

/**
 * GET /api/orders/{id}/next-stages
 *
 * Forwards the backend's full 7-field envelope unchanged so the shell can
 * render the stepper + transition action bar correctly.
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
    const result = await client.getJson<NextStagesResponse>(
      `/api/orders/${encodeURIComponent(id)}/next-stages/`,
    );
    return NextResponse.json({
      current_status: result.current_status,
      current_stage: result.current_stage,
      next_stages: result.next_stages ?? [],
      prev_stage: result.prev_stage ?? null,
      reachable_previous: result.reachable_previous ?? [],
      reachable_forward: result.reachable_forward ?? [],
      highest_unlocked_stage: result.highest_unlocked_stage ?? null,
    });
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
