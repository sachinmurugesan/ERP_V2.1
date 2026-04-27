import { NextResponse, type NextRequest } from "next/server";
import { type UserRole, Resource, canAccess } from "@harvesterp/lib";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

/**
 * DELETE /api/orders/{id}/documents/{doc_id}
 *
 * Proxies FastAPI DELETE /api/documents/{doc_id}/ — the order id in the
 * URL is FE-routing organization (the upstream is keyed only on doc id).
 *
 * Backend gate (verified live, documents.py:132):
 *   if current_user.role not in ("ADMIN", "SUPER_ADMIN", "OPERATIONS"):
 *     raise 403
 *
 * R-19 verified shape (live curl, 2026-04-27, ADMIN as
 * admin@harvesterp.com):
 *   ADMIN  → HTTP 200, body `{"message":"Document deleted"}`
 *   (NOT 204 — the spec assumed 204 No Content; backend returns 200
 *   with a JSON message body instead.)
 *
 * Defense-in-depth: this proxy ALSO short-circuits with 403 for any
 * role outside DOCUMENT_DELETE before forwarding upstream. Mirrors the
 * pattern used by /api/orders/{id}/factory-payments.
 */

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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; doc_id: string }> },
): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id, doc_id } = await params;
  if (!id || !doc_id) {
    return NextResponse.json(
      { error: "Missing order id or document id" },
      { status: 400 },
    );
  }

  const role = await resolveCallerRole();
  if (!role || !canAccess(role, Resource.DOCUMENT_DELETE)) {
    return NextResponse.json(
      {
        error:
          "You don't have permission to delete documents. Required: ADMIN, OPERATIONS, or SUPER_ADMIN.",
      },
      { status: 403 },
    );
  }

  try {
    const client = await getServerClient();
    const result = await client.deleteJson<{ message?: string }>(
      `/api/documents/${encodeURIComponent(doc_id)}/`,
    );
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 403) {
      return NextResponse.json(
        { error: "Backend denied document deletion" },
        { status: 403 },
      );
    }
    if (status === 404) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: status >= 500 ? 502 : status },
    );
  }
}
