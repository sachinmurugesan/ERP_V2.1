import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type { OrderQuery } from "../../route";

/**
 * PUT /api/orders/{id}/queries/{query_id}/reopen
 *
 * Proxies FastAPI PUT /api/orders/{id}/queries/{qid}/reopen/
 *
 * No body, no query params — just the path. R-19 verified live curl
 * 2026-04-27: PUT with empty body returns 200 + full OrderQuery
 * envelope with status="OPEN", resolved_at=null.
 *
 * Auth: any authenticated user; RLS scopes CLIENT/FACTORY.
 */

export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; query_id: string }> },
): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id, query_id } = await params;
  if (!id || !query_id) {
    return NextResponse.json(
      { error: "Missing order id or query id" },
      { status: 400 },
    );
  }

  try {
    const client = await getServerClient();
    const result = await client.putJson<OrderQuery>(
      `/api/orders/${encodeURIComponent(id)}/queries/${encodeURIComponent(query_id)}/reopen/`,
      {},
    );
    return NextResponse.json(result);
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 403) {
      return NextResponse.json(
        { error: "You don't have permission to reopen this query" },
        { status: 403 },
      );
    }
    if (status === 404) {
      return NextResponse.json({ error: "Query not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to reopen query" },
      { status: status >= 500 ? 502 : status },
    );
  }
}
