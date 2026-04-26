import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

/**
 * DELETE /api/transport/{id}
 *
 * Proxies FastAPI DELETE /api/shipping/transport/{id}/. Backend performs
 * a soft-delete (G-014 closed via Patch 13 → ADMIN | SUPER_ADMIN).
 * Frontend RoleGate matches: TRANSPORT_DELETE = [ADMIN] (SUPER_ADMIN
 * implicit via canAccess() bypass).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const client = await getServerClient();
    await client.deleteJson(
      `/api/shipping/transport/${encodeURIComponent(id)}/`,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 403) {
      return NextResponse.json(
        { error: "You don't have permission to delete this provider" },
        { status: 403 },
      );
    }
    if (status === 404) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Failed to delete provider" },
      { status: status >= 500 ? 502 : status },
    );
  }
}
