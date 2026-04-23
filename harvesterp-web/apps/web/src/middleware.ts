import { type NextRequest, NextResponse } from "next/server";
import { isExpiringSoon } from "@/lib/jwt";

/**
 * HarvestERP middleware — auth gate, session refresh, strangler-fig marker.
 *
 * Responsibilities:
 *   1. Auth:    Require `harvesterp_session` cookie on non-public paths.
 *               Redirect to /login on missing or unrefreshable session.
 *   2. Refresh: Proactively refresh the access token when it is within
 *               EXPIRY_THRESHOLD_SECONDS of expiry. Reads the refresh token
 *               from `harvesterp_refresh` cookie (path=/api/auth). If that
 *               cookie is not present on the current request (path-scoped),
 *               the expiring token is allowed through — FastAPI will return
 *               401 on the next API call, prompting the client to re-auth.
 *   3. Marker:  Add `X-Handled-By: nextjs` response header (Task 9 strangler-fig).
 *   4. Routing: Inject `x-pathname` into forwarded request headers so
 *               Server Component layouts can read the current path.
 *
 * Public paths (no auth check):
 *   /login, /api/auth/*, /_next/*, static assets (files with extensions)
 */

// ── Constants ─────────────────────────────────────────────────────────────────

const SESSION_COOKIE = "harvesterp_session" as const;
const REFRESH_COOKIE = "harvesterp_refresh" as const;
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours in seconds
const EXPIRY_THRESHOLD_SECONDS = 30;

const PUBLIC_PREFIXES: readonly string[] = [
  "/login",
  "/api/auth/",
  "/_next/",
  "/favicon",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function hasFileExtension(pathname: string): boolean {
  const lastSegment = pathname.split("/").pop() ?? "";
  return lastSegment.includes(".") && !lastSegment.endsWith(".");
}

function redirectToLogin(request: NextRequest, pathname: string): NextResponse {
  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/" && pathname !== "/login") {
    loginUrl.searchParams.set("returnTo", pathname);
  }
  const redirect = NextResponse.redirect(loginUrl);
  redirect.headers.set("X-Handled-By", "nextjs");
  return redirect;
}

/**
 * Build a NextResponse that continues to the RSC layer with `x-pathname`
 * injected into the forwarded request headers.
 */
function nextWithPathname(request: NextRequest, pathname: string): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("X-Handled-By", "nextjs");
  return response;
}

/**
 * Attempt to exchange the refresh cookie for a new access token.
 * Calls FastAPI directly (Edge Runtime compatible).
 * Returns the new access token on success, or null on any failure.
 */
async function attemptRefresh(
  refreshToken: string,
): Promise<{ access_token: string } | null> {
  const baseUrl = process.env.HARVESTERP_API_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) return null;
    return { access_token: data.access_token };
  } catch {
    return null;
  }
}

// ── Middleware ────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Static files — pass through without X-Handled-By (served by static file server)
  if (hasFileExtension(pathname)) {
    return NextResponse.next();
  }

  // Public paths — no auth check; still inject pathname for any RSC that reads it
  if (isPublicPath(pathname)) {
    return nextWithPathname(request, pathname);
  }

  // Protected path — require session cookie
  const session = request.cookies.get(SESSION_COOKIE);
  if (!session?.value) {
    return redirectToLogin(request, pathname);
  }

  // Proactive refresh when token is expiring soon
  if (isExpiringSoon(session.value, EXPIRY_THRESHOLD_SECONDS)) {
    const refreshTokenValue = request.cookies.get(REFRESH_COOKIE)?.value;
    if (refreshTokenValue) {
      const refreshed = await attemptRefresh(refreshTokenValue);
      if (refreshed) {
        // Continue with new session cookie and pathname forwarding
        const refreshResponse = nextWithPathname(request, pathname);
        refreshResponse.cookies.set(SESSION_COOKIE, refreshed.access_token, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.HARVESTERP_COOKIE_SECURE === "true",
          path: "/",
          maxAge: SESSION_MAX_AGE,
        });
        return refreshResponse;
      }
      // Refresh cookie present but refresh failed → force re-login
      return redirectToLogin(request, pathname);
    }
    // No refresh cookie on this path — let through (token still technically valid)
  }

  return nextWithPathname(request, pathname);
}

/**
 * Matcher: run middleware on all routes except:
 * - _next/static (static files)
 * - _next/image  (Next.js image optimisation)
 * - favicon.ico
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
