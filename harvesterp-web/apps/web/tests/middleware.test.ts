/**
 * middleware.test.ts — Unit tests for middleware.ts auth gate + routing marker.
 *
 * Uses real NextRequest from next/server.
 * Mocks @/lib/jwt (isExpiringSoon) to control expiry scenarios.
 * Mocks global fetch for token-refresh flow tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock jwt helpers ──────────────────────────────────────────────────────────
// isExpiringSoon is the only jwt export used in middleware.

vi.mock("../src/lib/jwt", () => ({
  isExpiringSoon: vi.fn().mockReturnValue(false),
}));

import { isExpiringSoon } from "../src/lib/jwt";
import { middleware } from "../src/middleware";

// ── Helpers ───────────────────────────────────────────────────────────────────

interface RequestOptions {
  withSessionCookie?: boolean;
  sessionValue?: string;
  withRefreshCookie?: boolean;
  refreshValue?: string;
}

function makeRequest(path: string, options?: RequestOptions): NextRequest {
  const url = `http://localhost:3000${path}`;
  const cookieParts: string[] = [];
  if (options?.withSessionCookie) {
    const val = options.sessionValue ?? "valid-jwt-token";
    cookieParts.push(`harvesterp_session=${val}`);
  }
  if (options?.withRefreshCookie) {
    const val = options.refreshValue ?? "valid-refresh-token";
    cookieParts.push(`harvesterp_refresh=${val}`);
  }
  const headers: HeadersInit = {};
  if (cookieParts.length > 0) {
    headers["Cookie"] = cookieParts.join("; ");
  }
  return new NextRequest(url, { method: "GET", headers });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isExpiringSoon).mockReturnValue(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Public path pass-through ──────────────────────────────────────────────────

describe("public paths", () => {
  it("passes through /login without redirecting", async () => {
    const res = await middleware(makeRequest("/login"));
    expect(res.status).not.toBe(307);
    expect(res.status).not.toBe(302);
  });

  it("passes through /api/auth/login without redirecting", async () => {
    const res = await middleware(makeRequest("/api/auth/login"));
    expect(res.status).not.toBe(307);
  });

  it("passes through /api/auth/logout without redirecting", async () => {
    const res = await middleware(makeRequest("/api/auth/logout"));
    expect(res.status).not.toBe(307);
  });

  it("sets X-Handled-By: nextjs on public path responses", async () => {
    const res = await middleware(makeRequest("/login"));
    expect(res.headers.get("X-Handled-By")).toBe("nextjs");
  });
});

// ── Static file pass-through ──────────────────────────────────────────────────

describe("static files", () => {
  it("passes through files with extensions (e.g. logo.png)", async () => {
    const res = await middleware(makeRequest("/images/logo.png"));
    expect(res.status).not.toBe(307);
  });

  it("does NOT set X-Handled-By on static file responses", async () => {
    const res = await middleware(makeRequest("/images/logo.png"));
    expect(res.headers.get("X-Handled-By")).toBeNull();
  });
});

// ── Auth gate ─────────────────────────────────────────────────────────────────

describe("auth gate", () => {
  it("redirects to /login when no session cookie on /dashboard", async () => {
    const res = await middleware(makeRequest("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location") ?? "").toContain("/login");
  });

  it("includes returnTo param in redirect URL", async () => {
    const res = await middleware(makeRequest("/dashboard"));
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("returnTo=%2Fdashboard");
  });

  it("passes through /dashboard when session cookie is present", async () => {
    const res = await middleware(makeRequest("/dashboard", { withSessionCookie: true }));
    expect(res.status).not.toBe(307);
  });

  it("sets X-Handled-By when authenticated on protected path", async () => {
    const res = await middleware(makeRequest("/dashboard", { withSessionCookie: true }));
    expect(res.headers.get("X-Handled-By")).toBe("nextjs");
  });

  it("unauthenticated redirect includes X-Handled-By header", async () => {
    const res = await middleware(makeRequest("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("X-Handled-By")).toBe("nextjs");
  });
});

// ── Token expiry + refresh ────────────────────────────────────────────────────

describe("token expiry and refresh", () => {
  it("passes through when token is not expiring soon (no refresh attempt)", async () => {
    vi.mocked(isExpiringSoon).mockReturnValue(false);
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const res = await middleware(makeRequest("/dashboard", { withSessionCookie: true }));
    expect(res.status).not.toBe(307);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("passes through when token is expiring but no refresh cookie is present", async () => {
    vi.mocked(isExpiringSoon).mockReturnValue(true);
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const res = await middleware(makeRequest("/dashboard", { withSessionCookie: true }));
    // No redirect — token still technically valid
    expect(res.status).not.toBe(307);
    // No fetch call made (no refresh cookie to use)
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("calls the FastAPI refresh endpoint when token is expiring and refresh cookie exists", async () => {
    vi.mocked(isExpiringSoon).mockReturnValue(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: "new-access-jwt" }),
    }));

    await middleware(makeRequest("/dashboard", {
      withSessionCookie: true,
      withRefreshCookie: true,
      refreshValue: "my-refresh-token",
    }));

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/auth/refresh"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sets new session cookie on successful token refresh", async () => {
    vi.mocked(isExpiringSoon).mockReturnValue(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: "refreshed-jwt" }),
    }));

    const res = await middleware(makeRequest("/dashboard", {
      withSessionCookie: true,
      withRefreshCookie: true,
    }));

    const setCookieHeader = res.headers.get("set-cookie") ?? "";
    expect(setCookieHeader).toContain("harvesterp_session=refreshed-jwt");
  });

  it("passes through (does not redirect) on successful refresh", async () => {
    vi.mocked(isExpiringSoon).mockReturnValue(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ access_token: "refreshed-jwt" }),
    }));

    const res = await middleware(makeRequest("/dashboard", {
      withSessionCookie: true,
      withRefreshCookie: true,
    }));

    expect(res.status).not.toBe(307);
    expect(res.headers.get("X-Handled-By")).toBe("nextjs");
  });

  it("redirects to /login when refresh cookie present but refresh endpoint returns non-ok", async () => {
    vi.mocked(isExpiringSoon).mockReturnValue(true);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    const res = await middleware(makeRequest("/dashboard", {
      withSessionCookie: true,
      withRefreshCookie: true,
    }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location") ?? "").toContain("/login");
  });

  it("redirects to /login when refresh throws a network error", async () => {
    vi.mocked(isExpiringSoon).mockReturnValue(true);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    const res = await middleware(makeRequest("/dashboard", {
      withSessionCookie: true,
      withRefreshCookie: true,
    }));

    expect(res.status).toBe(307);
    expect(res.headers.get("location") ?? "").toContain("/login");
  });
});
