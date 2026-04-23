import { cookies } from "next/headers";
import { refreshToken as sdkRefreshToken } from "@harvesterp/sdk";

/**
 * session.ts — Server-side httpOnly cookie management.
 *
 * These functions are Server-only. Call from RSC, Route Handlers,
 * and Server Actions only. Never import in "use client" modules.
 *
 * Cookie design (Task 7):
 *   - Name:     harvesterp_session
 *   - Value:    JWT access token from FastAPI
 *   - httpOnly: true  — browser JS cannot read this token
 *   - sameSite: lax   — CSRF protection; cookies sent on top-level navigation
 *   - secure:   controlled by HARVESTERP_COOKIE_SECURE env var
 *   - maxAge:   8 hours (28 800 seconds)
 *   - path:     /  — visible across the full site
 *
 * Session refresh (Task 8):
 *   - Name:     harvesterp_refresh
 *   - Value:    JWT refresh token from FastAPI
 *   - httpOnly: true
 *   - sameSite: lax
 *   - secure:   controlled by HARVESTERP_COOKIE_SECURE env var
 *   - maxAge:   7 days (604 800 seconds)
 *   - path:     /api/auth  — scoped so browser only sends on refresh calls
 */

export const SESSION_COOKIE = "harvesterp_session" as const;

const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours in seconds

/**
 * Read the session JWT from the httpOnly cookie.
 * Returns undefined when the cookie is absent.
 */
export async function getSessionToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value;
}

/**
 * Persist the JWT in an httpOnly cookie after a successful login.
 * Must be called from a Route Handler or Server Action, not RSC.
 */
export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.HARVESTERP_COOKIE_SECURE === "true",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

/**
 * Delete the session cookie on logout.
 * Must be called from a Route Handler or Server Action.
 */
export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

// ── Refresh token ─────────────────────────────────────────────────────────────

export const REFRESH_COOKIE = "harvesterp_refresh" as const;

const REFRESH_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

/**
 * Read the refresh JWT from the httpOnly cookie.
 * Returns undefined when the cookie is absent.
 */
export async function getRefreshToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value;
}

/**
 * Persist the refresh JWT in an httpOnly cookie after a successful login.
 * Scoped to /api/auth so the browser only sends it on refresh requests.
 */
export async function setRefreshCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.HARVESTERP_COOKIE_SECURE === "true",
    path: "/api/auth",
    maxAge: REFRESH_MAX_AGE,
  });
}

/**
 * Delete the refresh cookie on logout or session invalidation.
 * Must be called from a Route Handler or Server Action.
 */
export async function clearRefreshCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(REFRESH_COOKIE);
}

/**
 * Attempt to exchange the stored refresh token for a new access token.
 *
 * - Reads `harvesterp_refresh` cookie
 * - POSTs to FastAPI /api/auth/refresh via SDK
 * - On success: updates `harvesterp_session` cookie, returns new access token
 * - On failure (no cookie, 401, network): clears both cookies, returns null
 *
 * Call only from Route Handlers or RSC — uses next/headers cookies().
 */
export async function refreshSession(): Promise<string | null> {
  const token = await getRefreshToken();
  if (!token) return null;

  try {
    const response = await sdkRefreshToken(token, {
      baseUrl: process.env.HARVESTERP_API_URL ?? "http://localhost:8000",
    });
    await setSessionCookie(response.access_token);
    return response.access_token;
  } catch {
    // Refresh failed — force re-login
    await clearSessionCookie();
    await clearRefreshCookie();
    return null;
  }
}
