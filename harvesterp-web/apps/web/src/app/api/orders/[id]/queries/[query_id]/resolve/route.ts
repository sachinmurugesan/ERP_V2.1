import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import type { OrderQuery } from "../../route";

/**
 * PUT /api/orders/{id}/queries/{query_id}/resolve
 *
 * Proxies FastAPI PUT /api/orders/{id}/queries/{qid}/resolve/?remark=...
 *
 * BACKEND CONTRACT QUIRK: the upstream takes `remark` as a **query
 * string parameter**, NOT a JSON body. Vue's wrapper (`queriesApi.
 * resolve`) URL-encodes the remark and tacks it on:
 *
 *   api.put(`.../resolve/?remark=${encodeURIComponent(remark)}`)
 *
 * The FE-facing proxy here accepts a JSON body `{ remark?: string }`
 * (the natural REST shape) and translates to the backend's
 * query-param convention server-side. R-19 verified live curl
 * 2026-04-27 — the body-vs-param translation is necessary; sending a
 * body to the upstream resolve endpoint silently ignores the body.
 *
 * Returns: full OrderQuery envelope with status="RESOLVED",
 * resolution_remark set, resolved_at populated.
 *
 * Auth: any authenticated user; RLS scopes CLIENT/FACTORY.
 */

interface ResolveBody {
  remark?: string;
}

export async function PUT(
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

  let body: ResolveBody = {};
  try {
    body = (await req.json()) as ResolveBody;
  } catch {
    // Empty body is valid — remark is optional.
  }
  const remark = body.remark?.trim() ?? "";

  // Backend wants the remark on the URL, not in the body. The SDK
  // putJson always sends a JSON body, so we side-step it via raw fetch
  // with the JWT manually injected (same pattern as the download
  // proxies).
  const upstream = `${process.env.HARVESTERP_API_URL ?? "http://localhost:8000"}/api/orders/${encodeURIComponent(id)}/queries/${encodeURIComponent(query_id)}/resolve/?remark=${encodeURIComponent(remark)}`;

  try {
    const response = await fetch(upstream, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const errBody = (await response.json().catch(() => ({}))) as {
        detail?: string;
        error?: string;
      };
      const message = errBody.detail ?? errBody.error ?? "Resolve failed";
      if (response.status === 403) {
        return NextResponse.json(
          { error: "You don't have permission to resolve this query" },
          { status: 403 },
        );
      }
      if (response.status === 404) {
        return NextResponse.json({ error: "Query not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: message },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }
    const result = (await response.json()) as OrderQuery;
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to resolve query" },
      { status: 502 },
    );
  }
}
