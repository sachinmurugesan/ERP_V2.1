import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

/**
 * DELETE /api/clients/{id}
 *
 * Proxies FastAPI DELETE /api/clients/{id}/. The backend performs a
 * soft-delete (G-013 closed → ADMIN | OPERATIONS | SUPER_ADMIN).
 * Frontend RoleGate is stricter (CLIENT_DELETE = [ADMIN]) so OPS
 * users never see the button.
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
      `/api/clients/${encodeURIComponent(id)}/`,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 403) {
      return NextResponse.json(
        { error: "You don't have permission to delete this client" },
        { status: 403 },
      );
    }
    if (status === 404) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Failed to delete client" },
      { status: status >= 500 ? 502 : status },
    );
  }
}
