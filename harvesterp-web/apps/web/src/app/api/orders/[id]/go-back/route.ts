import { NextResponse, type NextRequest } from "next/server";
import { type UserRole } from "@harvesterp/lib";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

/**
 * PUT /api/orders/{id}/go-back
 *
 * Proxies FastAPI PUT /api/orders/{id}/go-back/. Reverts the order to the
 * previous stage in the workflow chain.
 *
 * Backend contract verified live 2026-04-26:
 *   Body: { reason: string }     (the audit trail note for the reversal)
 *   No query params.
 *
 * SECURITY GATE — same proxy-level role check as transition (backend is
 * ungated; tracked in `docs/tech-debt/order-stage-transition-ungated.md`).
 *   ALLOWED: ADMIN | OPERATIONS | SUPER_ADMIN
 *   DENIED (403):  FINANCE | CLIENT | FACTORY | (any other)
 */

const TRANSITION_ROLES: ReadonlyArray<UserRole> = [
  "ADMIN",
  "OPERATIONS",
  "SUPER_ADMIN",
] as UserRole[];

interface GoBackBody {
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
          "You don't have permission to revert order stages. Required roles: ADMIN, OPERATIONS, or SUPER_ADMIN.",
      },
      { status: 403 },
    );
  }

  let body: GoBackBody;
  try {
    body = (await req.json()) as GoBackBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  try {
    const client = await getServerClient();
    const result = await client.putJson<unknown>(
      `/api/orders/${encodeURIComponent(id)}/go-back/`,
      { reason: body.reason ?? "Stage reversal" },
    );
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 403) {
      return NextResponse.json(
        { error: "Backend denied stage reversal (order scope)" },
        { status: 403 },
      );
    }
    if (status === 404) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (status === 409 || status === 400) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Stage reversal rejected by backend (e.g. no previous stage exists)";
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json(
      { error: "Failed to revert order stage" },
      { status: status >= 500 ? 502 : status },
    );
  }
}
