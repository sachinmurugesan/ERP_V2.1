import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type { RecentActivityEvent } from "@/app/(app)/dashboard/_components/types";

/**
 * GET /api/dashboard/recent-activity
 *
 * Proxies FastAPI GET /api/dashboard/recent-activity/ using the session
 * cookie. Exists so the client-side TanStack Query poller can fetch without
 * needing the raw FastAPI URL or access to the httpOnly session token.
 *
 * Response 200: { events: RecentActivityEvent[] }
 * Response 401: { error: string }
 * Response 502: { error: string }
 */
export async function GET(): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const client = await getServerClient();
    const events = await client.getJson<RecentActivityEvent[]>(
      "/api/dashboard/recent-activity/",
    );
    return NextResponse.json({ events });
  } catch {
    return NextResponse.json(
      { error: "Failed to load recent activity" },
      { status: 502 },
    );
  }
}
