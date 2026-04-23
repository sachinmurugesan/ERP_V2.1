/**
 * session.test.ts — Unit tests for lib/session.ts cookie helpers.
 *
 * Mocks next/headers so the tests run without a Next.js runtime.
 * vi.mock hoisting note: factory must not reference const/let declared in the
 * same file. We set up fresh mock objects in beforeEach via vi.mocked().
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SESSION_COOKIE,
  REFRESH_COOKIE,
  getSessionToken,
  setSessionCookie,
  clearSessionCookie,
  getRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  refreshSession,
} from "../../src/lib/session";

// ── Mock next/headers ─────────────────────────────────────────────────────────
// Factory uses no outer refs (hoisting-safe).

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

// ── Mock @harvesterp/sdk ──────────────────────────────────────────────────────
// Mocks the refreshToken export used by refreshSession().

vi.mock("@harvesterp/sdk", () => ({
  refreshToken: vi.fn(),
}));

// We import `cookies` to get the mock handle after it's set up.
import { cookies } from "next/headers";
import { refreshToken as sdkRefreshToken } from "@harvesterp/sdk";

// ── Per-test cookie jar ───────────────────────────────────────────────────────

interface MockJar {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

let jar: MockJar;

beforeEach(() => {
  vi.clearAllMocks();
  jar = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
  vi.mocked(cookies).mockResolvedValue(
    jar as unknown as Awaited<ReturnType<typeof cookies>>,
  );
});

// ── SESSION_COOKIE constant ───────────────────────────────────────────────────

describe("SESSION_COOKIE", () => {
  it("is named 'harvesterp_session'", () => {
    expect(SESSION_COOKIE).toBe("harvesterp_session");
  });
});

// ── getSessionToken ───────────────────────────────────────────────────────────

describe("getSessionToken", () => {
  it("returns the token value when cookie exists", async () => {
    jar.get.mockReturnValue({ name: SESSION_COOKIE, value: "test-jwt-token" });
    const token = await getSessionToken();
    expect(token).toBe("test-jwt-token");
    expect(jar.get).toHaveBeenCalledWith(SESSION_COOKIE);
  });

  it("returns undefined when cookie is absent", async () => {
    jar.get.mockReturnValue(undefined);
    const token = await getSessionToken();
    expect(token).toBeUndefined();
  });
});

// ── setSessionCookie ──────────────────────────────────────────────────────────

describe("setSessionCookie", () => {
  it("calls set with the correct cookie name and token", async () => {
    await setSessionCookie("my-jwt");
    expect(jar.set).toHaveBeenCalledOnce();
    const [name, value] = jar.set.mock.calls[0] as [string, string, object];
    expect(name).toBe(SESSION_COOKIE);
    expect(value).toBe("my-jwt");
  });

  it("always sets httpOnly: true", async () => {
    await setSessionCookie("tok");
    const [, , opts] = jar.set.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(opts.httpOnly).toBe(true);
  });

  it("sets sameSite: 'lax'", async () => {
    await setSessionCookie("tok");
    const [, , opts] = jar.set.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(opts.sameSite).toBe("lax");
  });

  it("sets secure: false when HARVESTERP_COOKIE_SECURE is not 'true'", async () => {
    const original = process.env.HARVESTERP_COOKIE_SECURE;
    process.env.HARVESTERP_COOKIE_SECURE = "false";
    await setSessionCookie("tok");
    const [, , opts] = jar.set.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(opts.secure).toBe(false);
    process.env.HARVESTERP_COOKIE_SECURE = original;
  });

  it("sets secure: true when HARVESTERP_COOKIE_SECURE is 'true'", async () => {
    const original = process.env.HARVESTERP_COOKIE_SECURE;
    process.env.HARVESTERP_COOKIE_SECURE = "true";
    await setSessionCookie("tok");
    const [, , opts] = jar.set.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(opts.secure).toBe(true);
    process.env.HARVESTERP_COOKIE_SECURE = original;
  });

  it("sets maxAge to 8 hours (28800 seconds)", async () => {
    await setSessionCookie("tok");
    const [, , opts] = jar.set.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(opts.maxAge).toBe(60 * 60 * 8);
  });

  it("sets path: '/'", async () => {
    await setSessionCookie("tok");
    const [, , opts] = jar.set.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(opts.path).toBe("/");
  });
});

// ── clearSessionCookie ────────────────────────────────────────────────────────

describe("clearSessionCookie", () => {
  it("calls delete with the session cookie name", async () => {
    await clearSessionCookie();
    expect(jar.delete).toHaveBeenCalledOnce();
    expect(jar.delete).toHaveBeenCalledWith(SESSION_COOKIE);
  });
});

// ── REFRESH_COOKIE constant ───────────────────────────────────────────────────

describe("REFRESH_COOKIE", () => {
  it("is named 'harvesterp_refresh'", () => {
    expect(REFRESH_COOKIE).toBe("harvesterp_refresh");
  });
});

// ── getRefreshToken ───────────────────────────────────────────────────────────

describe("getRefreshToken", () => {
  it("returns the token value when cookie exists", async () => {
    jar.get.mockReturnValue({ name: REFRESH_COOKIE, value: "refresh-jwt" });
    const token = await getRefreshToken();
    expect(token).toBe("refresh-jwt");
    expect(jar.get).toHaveBeenCalledWith(REFRESH_COOKIE);
  });

  it("returns undefined when cookie is absent", async () => {
    jar.get.mockReturnValue(undefined);
    const token = await getRefreshToken();
    expect(token).toBeUndefined();
  });
});

// ── setRefreshCookie ──────────────────────────────────────────────────────────

describe("setRefreshCookie", () => {
  it("calls set with the correct cookie name and token", async () => {
    await setRefreshCookie("my-refresh-jwt");
    expect(jar.set).toHaveBeenCalledOnce();
    const [name, value] = jar.set.mock.calls[0] as [string, string, object];
    expect(name).toBe(REFRESH_COOKIE);
    expect(value).toBe("my-refresh-jwt");
  });

  it("always sets httpOnly: true", async () => {
    await setRefreshCookie("tok");
    const [, , opts] = jar.set.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(opts.httpOnly).toBe(true);
  });

  it("sets sameSite: 'lax'", async () => {
    await setRefreshCookie("tok");
    const [, , opts] = jar.set.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(opts.sameSite).toBe("lax");
  });

  it("sets path: '/api/auth'", async () => {
    await setRefreshCookie("tok");
    const [, , opts] = jar.set.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(opts.path).toBe("/api/auth");
  });

  it("sets maxAge to 7 days (604800 seconds)", async () => {
    await setRefreshCookie("tok");
    const [, , opts] = jar.set.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(opts.maxAge).toBe(60 * 60 * 24 * 7);
  });

  it("sets secure: false when HARVESTERP_COOKIE_SECURE is not 'true'", async () => {
    const original = process.env.HARVESTERP_COOKIE_SECURE;
    process.env.HARVESTERP_COOKIE_SECURE = "false";
    await setRefreshCookie("tok");
    const [, , opts] = jar.set.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(opts.secure).toBe(false);
    process.env.HARVESTERP_COOKIE_SECURE = original;
  });

  it("sets secure: true when HARVESTERP_COOKIE_SECURE is 'true'", async () => {
    const original = process.env.HARVESTERP_COOKIE_SECURE;
    process.env.HARVESTERP_COOKIE_SECURE = "true";
    await setRefreshCookie("tok");
    const [, , opts] = jar.set.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(opts.secure).toBe(true);
    process.env.HARVESTERP_COOKIE_SECURE = original;
  });
});

// ── clearRefreshCookie ────────────────────────────────────────────────────────

describe("clearRefreshCookie", () => {
  it("calls delete with the refresh cookie name", async () => {
    await clearRefreshCookie();
    expect(jar.delete).toHaveBeenCalledOnce();
    expect(jar.delete).toHaveBeenCalledWith(REFRESH_COOKIE);
  });
});

// ── refreshSession ────────────────────────────────────────────────────────────

describe("refreshSession", () => {
  it("returns null when no refresh cookie is present", async () => {
    jar.get.mockReturnValue(undefined);
    const result = await refreshSession();
    expect(result).toBeNull();
  });

  it("does not call SDK refreshToken when no refresh cookie", async () => {
    jar.get.mockReturnValue(undefined);
    await refreshSession();
    expect(sdkRefreshToken).not.toHaveBeenCalled();
  });

  it("calls SDK refreshToken with the stored refresh token", async () => {
    jar.get.mockReturnValue({ value: "stored-refresh-token" });
    vi.mocked(sdkRefreshToken).mockResolvedValue({ access_token: "new-access-token", token_type: "bearer" });
    await refreshSession();
    expect(sdkRefreshToken).toHaveBeenCalledWith(
      "stored-refresh-token",
      expect.objectContaining({ baseUrl: expect.any(String) }),
    );
  });

  it("uses HARVESTERP_API_URL env var as baseUrl", async () => {
    const original = process.env.HARVESTERP_API_URL;
    process.env.HARVESTERP_API_URL = "http://api-test:9000";
    jar.get.mockReturnValue({ value: "refresh-tok" });
    vi.mocked(sdkRefreshToken).mockResolvedValue({ access_token: "new-tok", token_type: "bearer" });
    await refreshSession();
    expect(sdkRefreshToken).toHaveBeenCalledWith(
      "refresh-tok",
      expect.objectContaining({ baseUrl: "http://api-test:9000" }),
    );
    process.env.HARVESTERP_API_URL = original;
  });

  it("falls back to http://localhost:8000 when HARVESTERP_API_URL is unset", async () => {
    const original = process.env.HARVESTERP_API_URL;
    delete process.env.HARVESTERP_API_URL;
    jar.get.mockReturnValue({ value: "refresh-tok" });
    vi.mocked(sdkRefreshToken).mockResolvedValue({ access_token: "new-tok", token_type: "bearer" });
    await refreshSession();
    expect(sdkRefreshToken).toHaveBeenCalledWith(
      "refresh-tok",
      expect.objectContaining({ baseUrl: "http://localhost:8000" }),
    );
    process.env.HARVESTERP_API_URL = original;
  });

  it("calls setSessionCookie with the new access token on success", async () => {
    jar.get.mockReturnValue({ value: "refresh-tok" });
    vi.mocked(sdkRefreshToken).mockResolvedValue({ access_token: "fresh-access", token_type: "bearer" });
    await refreshSession();
    // jar.set is called by setSessionCookie
    const setCall = jar.set.mock.calls.find(
      (c) => (c as [string, ...unknown[]])[0] === SESSION_COOKIE,
    );
    expect(setCall).toBeDefined();
    expect((setCall as [string, string, ...unknown[]])[1]).toBe("fresh-access");
  });

  it("returns the new access token on success", async () => {
    jar.get.mockReturnValue({ value: "refresh-tok" });
    vi.mocked(sdkRefreshToken).mockResolvedValue({ access_token: "fresh-access", token_type: "bearer" });
    const result = await refreshSession();
    expect(result).toBe("fresh-access");
  });

  it("returns null when SDK refreshToken throws", async () => {
    jar.get.mockReturnValue({ value: "refresh-tok" });
    vi.mocked(sdkRefreshToken).mockRejectedValue(new Error("401 Unauthorized"));
    const result = await refreshSession();
    expect(result).toBeNull();
  });

  it("clears the session cookie on refresh failure", async () => {
    jar.get.mockReturnValue({ value: "refresh-tok" });
    vi.mocked(sdkRefreshToken).mockRejectedValue(new Error("Network error"));
    await refreshSession();
    const deleteCall = jar.delete.mock.calls.find(
      (c) => (c as [string])[0] === SESSION_COOKIE,
    );
    expect(deleteCall).toBeDefined();
  });

  it("clears the refresh cookie on refresh failure", async () => {
    jar.get.mockReturnValue({ value: "refresh-tok" });
    vi.mocked(sdkRefreshToken).mockRejectedValue(new Error("Network error"));
    await refreshSession();
    const deleteCall = jar.delete.mock.calls.find(
      (c) => (c as [string])[0] === REFRESH_COOKIE,
    );
    expect(deleteCall).toBeDefined();
  });
});
