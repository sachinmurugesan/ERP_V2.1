import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type { OrderQuery } from "../../route";

/**
 * POST /api/orders/{id}/queries/{query_id}/replies
 *
 * Proxies FastAPI POST /api/orders/{id}/queries/{qid}/reply/
 * (singular `reply` on the backend — the FE-facing route uses the
 * RESTful plural `replies` to read naturally as a sub-collection).
 *
 * Tier 1: text-only. The reply-with-attachment variant
 * (`/reply/upload/?message=...`) is deferred to Tier 2 along with the
 * lightbox + video player.
 *
 * R-19 verified shape (live curl, 2026-04-27):
 *   POST { message: "a reply" } → HTTP 200
 *   Body: full OrderQuery envelope (NOT just the new reply object) —
 *   the backend returns the entire query with the appended message in
 *   its `messages` array. Caller can compare `message_count` before/
 *   after to identify the new message if needed.
 *
 * Auth: any authenticated user; backend RLS scopes CLIENT/FACTORY.
 */

interface ReplyBody {
  message?: string;
}

export async function POST(
  req: NextRequest,
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

  let body: ReplyBody;
  try {
    body = (await req.json()) as ReplyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.message?.trim()) {
    return NextResponse.json(
      { error: "message is required" },
      { status: 400 },
    );
  }

  try {
    const client = await getServerClient();
    const result = await client.postJson<OrderQuery>(
      `/api/orders/${encodeURIComponent(id)}/queries/${encodeURIComponent(query_id)}/reply/`,
      { message: body.message.trim() },
    );
    return NextResponse.json(result);
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 403) {
      return NextResponse.json(
        { error: "You don't have permission to reply to this query" },
        { status: 403 },
      );
    }
    if (status === 404) {
      return NextResponse.json({ error: "Query not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to send reply" },
      { status: status >= 500 ? 502 : status },
    );
  }
}
