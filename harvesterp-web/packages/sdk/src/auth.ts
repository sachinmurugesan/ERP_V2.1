/**
 * auth.ts — Authentication helpers for the HarvestERP SDK.
 *
 * Thin wrappers over /api/auth/* endpoints.
 *
 * Design decisions:
 *   - NO token storage. These helpers return tokens; callers decide
 *     where to persist them (localStorage, httpOnly cookie, Zustand, etc.)
 *   - Errors are mapped to typed ApiError subclasses (UnauthorizedError etc.)
 *   - Works with both the default apiClient singleton and custom instances.
 *
 * Endpoints used:
 *   POST /api/auth/login   → LoginRequest → TokenResponse
 *   POST /api/auth/refresh → RefreshRequest → RefreshResponse
 *   POST /api/auth/logout  → (cookie-based) → { status: "logged_out" }
 *   GET  /api/auth/me      → UserMeResponse
 */

import type { components } from "./generated/types.js";
import { createHarvestClient, resolveDefaultBaseUrl } from "./client.js";
import { UnauthorizedError, wrapError } from "./errors.js";

// ── Exported types (re-exported from generated for convenience) ───────────────

export type LoginRequest = components["schemas"]["LoginRequest"];
export type TokenResponse = components["schemas"]["TokenResponse"];
export type RefreshResponse = components["schemas"]["RefreshResponse"];
export type UserMeResponse = components["schemas"]["UserMeResponse"];
export type LoginUserInfo = components["schemas"]["LoginUserInfo"];

// ── Low-level auth fetch (bypasses SDK client to avoid circular auth injection) ──

async function authFetch(
  path: string,
  body: Record<string, unknown>,
  baseUrl: string,
  customFetch?: typeof fetch,
): Promise<Response> {
  const fetcher = customFetch ?? fetch;
  return fetcher(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Auth config ───────────────────────────────────────────────────────────────

export interface AuthConfig {
  /** Base URL of the FastAPI backend. Defaults to resolveDefaultBaseUrl(). */
  baseUrl?: string;
  /** Custom fetch implementation (useful for Next.js server side or tests). */
  fetch?: typeof fetch;
}

// ── Login ─────────────────────────────────────────────────────────────────────

/**
 * Authenticate with email + password.
 *
 * Returns a TokenResponse containing:
 *   - access_token: string (JWT; short-lived, ~15 min)
 *   - refresh_token: string (JWT; long-lived, ~7 days)
 *   - user: LoginUserInfo (id, email, role, user_type, portal)
 *
 * Throws UnauthorizedError on invalid credentials (401).
 * Throws RateLimitError if 5+ failed attempts triggered lockout (429).
 *
 * The caller is responsible for storing tokens.
 *
 * @example
 * const { access_token, user } = await login("admin@harvesterp.com", "password");
 * localStorage.setItem("token", access_token);
 */
export async function login(
  email: string,
  password: string,
  config: AuthConfig = {},
): Promise<TokenResponse> {
  const baseUrl = config.baseUrl ?? resolveDefaultBaseUrl();
  const res = await authFetch(
    "/api/auth/login",
    { email, password },
    baseUrl,
    config.fetch,
  );

  if (!res.ok) {
    throw await wrapError(res, "POST");
  }

  return res.json() as Promise<TokenResponse>;
}

// ── Token refresh ─────────────────────────────────────────────────────────────

/**
 * Exchange a refresh token for a new access token.
 *
 * The backend also accepts the refresh token via httpOnly cookie
 * (set by the login endpoint). Pass an explicit refreshToken when
 * you want to override the cookie (e.g. in server-side Next.js code).
 *
 * Returns a new access_token. Does NOT return a new refresh token.
 *
 * @example
 * const { access_token } = await refreshToken(storedRefreshToken);
 */
export async function refreshToken(
  token: string | undefined,
  config: AuthConfig = {},
): Promise<RefreshResponse> {
  const baseUrl = config.baseUrl ?? resolveDefaultBaseUrl();
  const body: Record<string, unknown> = {};
  if (token) body["refresh_token"] = token;

  const res = await authFetch("/api/auth/refresh", body, baseUrl, config.fetch);

  if (!res.ok) {
    throw await wrapError(res, "POST");
  }

  return res.json() as Promise<RefreshResponse>;
}

// ── Logout ────────────────────────────────────────────────────────────────────

/**
 * Revoke the current session server-side.
 *
 * Sends the access token in the Authorization header so the backend can
 * add it to the revocation list. The refresh token cookie is cleared by
 * the backend response.
 *
 * This is a best-effort call — callers should clear local token state
 * regardless of whether this succeeds.
 *
 * @example
 * await logout(accessToken);
 * localStorage.removeItem("token");
 */
export async function logout(
  accessToken: string | undefined,
  config: AuthConfig = {},
): Promise<void> {
  const baseUrl = config.baseUrl ?? resolveDefaultBaseUrl();
  const fetcher = config.fetch ?? fetch;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  try {
    await fetcher(`${baseUrl}/api/auth/logout`, { method: "POST", headers });
  } catch {
    // Best-effort — ignore network errors on logout
  }
}

// ── Current user ──────────────────────────────────────────────────────────────

/**
 * Fetch the currently authenticated user's profile.
 *
 * Uses the provided access token. Returns the full UserMeResponse which
 * includes portal_permissions for CLIENT users.
 *
 * @example
 * const me = await getMe(accessToken);
 * console.log(me.role, me.user_type);
 */
export async function getMe(
  accessToken: string,
  config: AuthConfig = {},
): Promise<UserMeResponse> {
  const baseUrl = config.baseUrl ?? resolveDefaultBaseUrl();
  const fetcher = config.fetch ?? fetch;

  const res = await fetcher(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    if (res.status === 401) throw new UnauthorizedError(res.url, "GET", undefined);
    throw await wrapError(res, "GET");
  }

  return res.json() as Promise<UserMeResponse>;
}
