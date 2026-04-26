import { NextResponse, type NextRequest } from "next/server";
import { type UserRole } from "@harvesterp/lib";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

/**
 * PUT /api/orders/{id}/jump-to-stage
 *
 * Proxies FastAPI PUT /api/orders/{id}/jump-to-stage/. Jumps the order to
 * a non-adjacent stage that's already in `reachable_previous` (backward) or
 * `reachable_forward` (forward) — these "reachable" lists are returned by
 * `GET /next-stages/`.
 *
 * Distinct from `/transition/`:
 *   - `/transition/` advances ONE step forward in the linear chain
 *   - `/jump-to-stage/` jumps to ANY stage in the reachable sets, used for
 *     stepper-circle clicks and "Return to S{n}" buttons
 *
 * Backend contract verified live 2026-04-26:
 *   Body: { target_status: string, reason: string }
 *   No query params (unlike /transition/, target_status IS in body here).
 *
 * SECURITY GATE — same proxy-level role check as transition (backend is
 * ungated; tracked in `docs/tech-debt/order-stage-transition-ungated.md`).
 *   ALLOWED: ADMIN | OPERATIONS | SUPER_ADMIN
 */

const TRANSITION_ROLES: ReadonlyArray<UserRole> = [
  "ADMIN",
  "OPERATIONS",
  "SUPER_ADMIN",
] as UserRole[];

interface JumpToStageBody {
  target_status?: string;
  reason?: string;
}

async function resolveCallerRole(): Promise<UserRole | undefined> {
  try {
    const client = await getServerClient();
    const result = await client.GET("/api/auth/me");
    if (!result.data) return undefined;
    return (result.data as { role?: UserRole }).role;
  } catch {
    return undefined;
  }
}

export async function PUT(
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

  const role = await resolveCallerRole();
  if (!role || !TRANSITION_ROLES.includes(role)) {
    return NextResponse.json(
      {
        error:
          "You don't have permission to jump order stages. Required roles: ADMIN, OPERATIONS, or SUPER_ADMIN.",
      },
      { status: 403 },
    );
  }

  let body: JumpToStageBody;
  try {
    body = (await req.json()) as JumpToStageBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body.target_status) {
    return NextResponse.json(
      { error: "Body must include target_status" },
      { status: 400 },
    );
  }

  try {
    const client = await getServerClient();
    const result = await client.putJson<unknown>(
      `/api/orders/${encodeURIComponent(id)}/jump-to-stage/`,
      {
        target_status: body.target_status,
        reason: body.reason ?? "Direct stage navigation",
      },
    );
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 403) {
      return NextResponse.json(
        { error: "Backend denied stage jump (order scope)" },
        { status: 403 },
      );
    }
    if (status === 404) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (status === 409 || status === 400) {
      // Backend stage-engine rejection (e.g. target not in reachable range).
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Stage jump rejected by backend (target not in reachable range)";
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json(
      { error: "Failed to jump order stage" },
      { status: status >= 500 ? 502 : status },
    );
  }
}
