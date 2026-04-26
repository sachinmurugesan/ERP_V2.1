import { NextResponse, type NextRequest } from "next/server";
import { type UserRole } from "@harvesterp/lib";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

/**
 * PUT /api/orders/{id}/transition
 *
 * Proxies FastAPI PUT /api/orders/{id}/transition/. Advances the order to
 * the target `target_status` (or `target_stage_number`) provided in the body.
 *
 * ⚠️ SECURITY GATE — APPLIED HERE BECAUSE BACKEND IS UNGATED ⚠️
 *
 * The backend handler at `backend/routers/orders.py:2448 transition_order`
 * (along with `go_back_order` line 2521 and `jump_to_stage` line 2553) does
 * NOT check `current_user.role` — any authenticated user with order access
 * can move stages. Only `/reopen/` is ADMIN/SUPER_ADMIN-gated.
 *
 * Until the backend is patched (tracked in
 * `docs/tech-debt/order-stage-transition-ungated.md`), this proxy enforces
 * the role check for web-UI traffic:
 *
 *   ALLOWED to transition: ADMIN | OPERATIONS | SUPER_ADMIN
 *   DENIED (403):          FINANCE | CLIENT | FACTORY | (any other)
 *
 * Direct API calls bypassing this proxy still hit the ungated backend.
 * Full fix requires backend role checks.
 *
 * See: research doc §5.5 "Who can trigger each transition: NO ROLE GATING"
 *      `docs/migration/research/orders-complete-audit-2026-04-26.md`
 */

const TRANSITION_ROLES: ReadonlyArray<UserRole> = ["ADMIN", "OPERATIONS", "SUPER_ADMIN"] as UserRole[];

/**
 * Request body shape for `PUT /api/orders/{id}/transition`.
 *
 * IMPORTANT — backend contract verified live 2026-04-26:
 *   `target_status` MUST go on the URL as a query parameter, NOT in the body.
 *   The body must contain `acknowledge_warnings` (and optionally
 *   `transition_reason` when overriding warnings).
 *
 * The original foundation-PR proxy passed `target_status` in the body and
 * would have failed in production with a 422 "field required (query)".
 * Fixed in feat/order-detail-shell.
 */
interface TransitionBody {
  /** Backend OrderStatus enum value (e.g. "PENDING_PI"). Forwarded as ?target_status=... */
  target_status: string;
  /** True when re-trying a transition that returned warnings on the first attempt. */
  acknowledge_warnings?: boolean;
  /** Required when acknowledge_warnings is true — user's reason for proceeding despite warnings. */
  transition_reason?: string;
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

  // ── Proxy-level role gate (compensates for ungated backend) ──
  const role = await resolveCallerRole();
  if (!role || !TRANSITION_ROLES.includes(role)) {
    return NextResponse.json(
      {
        error:
          "You don't have permission to transition order stages. Required roles: ADMIN, OPERATIONS, or SUPER_ADMIN.",
      },
      { status: 403 },
    );
  }

  let body: TransitionBody;
  try {
    body = (await req.json()) as TransitionBody;
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
    // ⚠️ target_status MUST be a query param — backend reads from query, not body.
    // Body carries only { acknowledge_warnings, transition_reason }.
    const url =
      `/api/orders/${encodeURIComponent(id)}/transition/` +
      `?target_status=${encodeURIComponent(body.target_status)}`;
    const upstreamBody: Record<string, unknown> = {
      acknowledge_warnings: body.acknowledge_warnings ?? false,
    };
    if (body.transition_reason !== undefined) {
      upstreamBody.transition_reason = body.transition_reason;
    }
    const result = await client.putJson<unknown>(url, upstreamBody);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 403) {
      // Backend rejected even though our gate accepted — possible auth-scope drift.
      return NextResponse.json(
        { error: "Backend denied transition (order scope)" },
        { status: 403 },
      );
    }
    if (status === 404) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 },
      );
    }
    if (status === 409 || status === 400) {
      // Backend stage-engine validation failure (e.g. preconditions not met).
      // Forward as-is — these messages are user-actionable and safe.
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Stage transition rejected by backend validation";
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json(
      { error: "Failed to transition order" },
      { status: status >= 500 ? 502 : status },
    );
  }
}
