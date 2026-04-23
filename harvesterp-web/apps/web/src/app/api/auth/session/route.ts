import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

/**
 * GET /api/auth/session
 *
 * Returns the current user from FastAPI using the session cookie.
 * Used by client components that need to display user info without
 * making a server-side request (e.g. QuickStatsCard with React Query).
 *
 * Response 200: { user: UserMeResponse }
 * Response 401: { error: string }   — no cookie or expired token
 */
export async function GET(): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const client = await getServerClient();
    const result = await client.GET("/api/auth/me");

    if (result.error) {
      return NextResponse.json({ error: "Session invalid or expired" }, { status: 401 });
    }

    return NextResponse.json({ user: result.data });
  } catch {
    return NextResponse.json(
      { error: "Session validation failed" },
      { status: 401 },
    );
  }
}
