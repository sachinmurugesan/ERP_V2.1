import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";

/**
 * PUT /api/notifications/mark-read-by-resource
 *
 * Proxies FastAPI PUT /api/notifications/mark-read-by-resource/?
 * resource_type=...&resource_id=...&notification_type=...
 *
 * BACKEND CONTRACT QUIRK (verified live, R-19 2026-04-27):
 *   - HTTP method: PUT (not POST as the spec suggested — this is the
 *     same backend method that Vue's composables/useNotifications.js
 *     line 84 uses).
 *   - Parameters live in the URL query string (`?resource_type=...`),
 *     not the JSON body.
 *
 * The FE-facing proxy accepts a PUT with JSON body
 * `{ resource_type, resource_id, notification_type? }` (the natural
 * REST shape) and translates to the backend's query-param convention.
 *
 * R-19 sample response: HTTP 200, body `{"marked_read": 0}` (or
 * higher when there are matching unread notifications). Idempotent —
 * repeated calls just keep returning 0.
 *
 * Used by <OrderQueriesTab> on mount to clear ITEM_QUERY_REPLY +
 * ITEM_QUERY_CREATED notifications for the current order so the
 * topbar bell badge doesn't keep counting them once the user is
 * looking at the queries.
 */

interface MarkReadBody {
  resource_type?: string;
  resource_id?: string;
  notification_type?: string;
}

interface MarkReadResponse {
  marked_read: number;
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: MarkReadBody;
  try {
    body = (await req.json()) as MarkReadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.resource_type?.trim() || !body.resource_id?.trim()) {
    return NextResponse.json(
      { error: "resource_type and resource_id are required" },
      { status: 400 },
    );
  }

  const upstreamUrl = new URL(
    `${process.env.HARVESTERP_API_URL ?? "http://localhost:8000"}/api/notifications/mark-read-by-resource/`,
  );
  upstreamUrl.searchParams.set("resource_type", body.resource_type.trim());
  upstreamUrl.searchParams.set("resource_id", body.resource_id.trim());
  if (body.notification_type?.trim()) {
    upstreamUrl.searchParams.set(
      "notification_type",
      body.notification_type.trim(),
    );
  }

  try {
    const response = await fetch(upstreamUrl.toString(), {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      // Mark-read failure is best-effort: surface the status but never
      // block the calling component (the topbar bell will reconcile on
      // its own polling cycle). The component should not throw on this
      // response either way.
      const errBody = (await response.json().catch(() => ({}))) as {
        detail?: string;
      };
      return NextResponse.json(
        { error: errBody.detail ?? "Mark-read failed" },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }
    const result = (await response.json()) as MarkReadResponse;
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Mark-read failed" },
      { status: 502 },
    );
  }
}
