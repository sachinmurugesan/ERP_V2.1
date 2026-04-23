import { NextResponse } from "next/server";
import { logout } from "@harvesterp/sdk";
import { clearSessionCookie, clearRefreshCookie, getSessionToken } from "@/lib/session";

/**
 * POST /api/auth/logout
 *
 * Clears the session cookie. Best-effort calls FastAPI logout to
 * invalidate the server-side token (if the endpoint exists).
 *
 * Always returns 200 — even if FastAPI is offline, the cookie is cleared.
 * The client should redirect to /login after this call.
 */
export async function POST(): Promise<NextResponse> {
  const token = await getSessionToken();

  // Best-effort: invalidate token on the backend
  if (token) {
    try {
      await logout(token, {
        baseUrl: process.env.HARVESTERP_API_URL ?? "http://localhost:8000",
      });
    } catch {
      // Ignore — SDK logout() is already best-effort; cookie cleanup happens below
    }
  }

  await clearSessionCookie();
  await clearRefreshCookie();

  return NextResponse.json({ status: "logged_out" });
}
