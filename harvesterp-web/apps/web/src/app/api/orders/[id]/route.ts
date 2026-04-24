import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

interface DeleteBody {
  reason?: string;
}

/**
 * DELETE /api/orders/{id}
 *
 * Proxies FastAPI DELETE /api/orders/{id}/ and, if a non-empty `reason`
 * string is provided in the JSON body, follows up with
 * PUT /api/orders/{id}/delete-reason/ to persist the audit note.
 */
export async function DELETE(
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

  let body: DeleteBody = {};
  try {
    body = (await req.json()) as DeleteBody;
  } catch {
    // Empty body is fine — reason is optional.
  }

  try {
    const client = await getServerClient();
    await client.deleteJson(`/api/orders/${encodeURIComponent(id)}/`);

    const reason = body.reason?.trim();
    if (reason) {
      try {
        await client.putJson(
          `/api/orders/${encodeURIComponent(id)}/delete-reason/`,
          { reason },
        );
      } catch {
        // Reason capture is best-effort — the delete already succeeded.
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Failed to delete order";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
