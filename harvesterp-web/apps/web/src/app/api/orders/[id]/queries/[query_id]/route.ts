import { NextResponse, type NextRequest } from "next/server";
import { type UserRole, Resource, canAccess } from "@harvesterp/lib";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type { OrderQuery } from "../route";

/**
 * GET / DELETE  /api/orders/{id}/queries/{query_id}
 *
 * GET    → proxies FastAPI GET    /api/orders/{id}/queries/{qid}/
 * DELETE → proxies FastAPI DELETE /api/orders/{id}/queries/{qid}/
 *
 * R-19 verified shape (live curl, 2026-04-27):
 *   GET    → HTTP 200, full OrderQuery envelope
 *   DELETE → HTTP 200, body `{"deleted": true, "id": "..."}`
 *            (NOT 204 No Content — different convention than the
 *            documents DELETE which returns `{message: "Document
 *            deleted"}`. Both are HTTP 200.)
 *
 * Backend gate (queries.py:437): creator OR INTERNAL user. So FINANCE
 * could in principle delete a query they created. The FE proxy is
 * STRICTER — DOCUMENT_DELETE / QUERY_DELETE = [ADMIN, OPERATIONS] —
 * defense-in-depth UI policy. Backend remains the source of truth for
 * any actual rejection if FE gate is bypassed.
 */

interface DeleteResponse {
  deleted: boolean;
  id: string;
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

export async function GET(
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
    const result = await client.getJson<OrderQuery>(
      `/api/orders/${encodeURIComponent(id)}/queries/${encodeURIComponent(query_id)}/`,
    );
    return NextResponse.json(result);
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 403) {
      return NextResponse.json(
        { error: "You don't have permission to view this query" },
        { status: 403 },
      );
    }
    if (status === 404) {
      return NextResponse.json(
        { error: "Query not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Failed to load query" },
      { status: status >= 500 ? 502 : status },
    );
  }
}

export async function DELETE(
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

  const role = await resolveCallerRole();
  if (!role || !canAccess(role, Resource.QUERY_DELETE)) {
    return NextResponse.json(
      {
        error:
          "You don't have permission to delete queries. Required: ADMIN, OPERATIONS, or SUPER_ADMIN.",
      },
      { status: 403 },
    );
  }

  try {
    const client = await getServerClient();
    const result = await client.deleteJson<DeleteResponse>(
      `/api/orders/${encodeURIComponent(id)}/queries/${encodeURIComponent(query_id)}/`,
    );
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 403) {
      return NextResponse.json(
        { error: "Backend denied query deletion" },
        { status: 403 },
      );
    }
    if (status === 404) {
      return NextResponse.json(
        { error: "Query not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Failed to delete query" },
      { status: status >= 500 ? 502 : status },
    );
  }
}
