/**
 * auth.test.ts — Unit tests for the auth helper functions.
 *
 * All HTTP calls are mocked. No real network traffic.
 */

import { describe, it, expect, vi } from "vitest";
import { login, logout, refreshToken, getMe } from "../src/auth.js";
import {
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
  ValidationError,
} from "../src/errors.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonFetch(status: number, body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

const MOCK_TOKEN_RESPONSE = {
  access_token: "eyJ.eyJ.sig",
  refresh_token: "eyJ.ref.sig",
  token_type: "bearer",
  user: {
    id: "usr-001",
    email: "admin@harvesterp.com",
    role: "ADMIN",
    user_type: "INTERNAL",
    portal: "/dashboard",
    roles: ["ADMIN"],
    client_id: null,
    factory_id: null,
  },
};

const MOCK_ME_RESPONSE = {
  id: "usr-001",
  email: "admin@harvesterp.com",
  role: "ADMIN",
  user_type: "INTERNAL",
  roles: ["ADMIN"],
  client_id: null,
  factory_id: null,
  tenant_id: "default",
};

// ── login ─────────────────────────────────────────────────────────────────────

describe("login", () => {
  it("returns TokenResponse on 200", async () => {
    const result = await login("admin@harvesterp.com", "pass", {
      fetch: jsonFetch(200, MOCK_TOKEN_RESPONSE),
    });
    expect(result.access_token).toBe("eyJ.eyJ.sig");
    expect(result.refresh_token).toBe("eyJ.ref.sig");
    expect(result.user.email).toBe("admin@harvesterp.com");
  });

  it("calls POST /api/auth/login", async () => {
    const mockFn = jsonFetch(200, MOCK_TOKEN_RESPONSE);
    await login("a@b.com", "p", { fetch: mockFn, baseUrl: "http://localhost:8000" });
    expect(mockFn).toHaveBeenCalledOnce();
    const [url] = (mockFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("/api/auth/login");
  });

  it("sends email and password in JSON body", async () => {
    let capturedBody: unknown;
    const mockFn: typeof fetch = vi.fn().mockImplementation(
      async (_url: unknown, init?: RequestInit) => {
        capturedBody = JSON.parse(init?.body as string);
        return new Response(JSON.stringify(MOCK_TOKEN_RESPONSE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    await login("test@example.com", "secret", {
      fetch: mockFn,
      baseUrl: "http://localhost:8000",
    });

    expect(capturedBody).toEqual({ email: "test@example.com", password: "secret" });
  });

  it("throws UnauthorizedError on 401", async () => {
    await expect(
      login("bad@email.com", "wrong", {
        fetch: jsonFetch(401, { detail: "Invalid email or password" }),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws RateLimitError on 429", async () => {
    await expect(
      login("a@b.com", "p", {
        fetch: jsonFetch(429, {
          detail: "Rate limit exceeded. Try again in 60 seconds.",
        }),
      }),
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it("throws ValidationError on 422 (malformed body)", async () => {
    await expect(
      login("", "", {
        fetch: jsonFetch(422, {
          detail: [
            { loc: ["body", "email"], msg: "Field required", type: "missing" },
          ],
        }),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("uses provided baseUrl", async () => {
    let capturedUrl = "";
    const mockFn: typeof fetch = vi.fn().mockImplementation(async (url: unknown) => {
      capturedUrl = url as string;
      return new Response(JSON.stringify(MOCK_TOKEN_RESPONSE), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    await login("a@b.com", "p", {
      fetch: mockFn,
      baseUrl: "http://custom-host:9000",
    });

    expect(capturedUrl).toContain("http://custom-host:9000");
  });
});

// ── refreshToken ──────────────────────────────────────────────────────────────

describe("refreshToken", () => {
  it("returns RefreshResponse on 200", async () => {
    const result = await refreshToken("old-refresh-token", {
      fetch: jsonFetch(200, { access_token: "new-access", token_type: "bearer" }),
    });
    expect(result.access_token).toBe("new-access");
  });

  it("calls POST /api/auth/refresh", async () => {
    const mockFn = jsonFetch(200, {
      access_token: "new",
      token_type: "bearer",
    });
    await refreshToken("tok", { fetch: mockFn, baseUrl: "http://localhost:8000" });
    const [url] = (mockFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("/api/auth/refresh");
  });

  it("throws UnauthorizedError on 401 (expired refresh token)", async () => {
    await expect(
      refreshToken("bad-token", {
        fetch: jsonFetch(401, { detail: "Refresh token expired" }),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("works without providing a token (cookie-based flow)", async () => {
    // Backend uses httpOnly cookie — passing undefined is valid
    const result = await refreshToken(undefined, {
      fetch: jsonFetch(200, { access_token: "cookie-refresh", token_type: "bearer" }),
    });
    expect(result.access_token).toBe("cookie-refresh");
  });
});

// ── logout ────────────────────────────────────────────────────────────────────

describe("logout", () => {
  it("calls POST /api/auth/logout", async () => {
    const mockFn = jsonFetch(200, { status: "logged_out" });
    await logout("access-token", { fetch: mockFn, baseUrl: "http://localhost:8000" });
    const [url] = (mockFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("/api/auth/logout");
  });

  it("injects Bearer token in Authorization header", async () => {
    let capturedAuth = "";
    const mockFn: typeof fetch = vi.fn().mockImplementation(
      async (_url: unknown, init?: RequestInit) => {
        capturedAuth = (init?.headers as Record<string, string>)?.["Authorization"] ?? "";
        return new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    await logout("my-access-token", { fetch: mockFn, baseUrl: "http://localhost:8000" });

    expect(capturedAuth).toBe("Bearer my-access-token");
  });

  it("resolves silently even if the server returns an error (best-effort)", async () => {
    // Logout should never throw — clean up locally regardless
    await expect(
      logout("token", {
        fetch: jsonFetch(500, { detail: "Internal error" }),
      }),
    ).resolves.toBeUndefined();
  });

  it("resolves silently even on network error (best-effort)", async () => {
    const networkErrorFetch: typeof fetch = vi.fn().mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    await expect(
      logout("token", { fetch: networkErrorFetch }),
    ).resolves.toBeUndefined();
  });
});

// ── getMe ─────────────────────────────────────────────────────────────────────

describe("getMe", () => {
  it("returns UserMeResponse on 200", async () => {
    const result = await getMe("valid-token", {
      fetch: jsonFetch(200, MOCK_ME_RESPONSE),
    });
    expect(result.email).toBe("admin@harvesterp.com");
    expect(result.role).toBe("ADMIN");
  });

  it("calls GET /api/auth/me", async () => {
    const mockFn = jsonFetch(200, MOCK_ME_RESPONSE);
    await getMe("token", { fetch: mockFn, baseUrl: "http://localhost:8000" });
    const [url] = (mockFn as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain("/api/auth/me");
  });

  it("injects Bearer token in Authorization header", async () => {
    let capturedAuth = "";
    const mockFn: typeof fetch = vi.fn().mockImplementation(
      async (_url: unknown, init?: RequestInit) => {
        capturedAuth =
          (init?.headers as Record<string, string>)?.["Authorization"] ?? "";
        return new Response(JSON.stringify(MOCK_ME_RESPONSE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    await getMe("bearer-xyz", { fetch: mockFn });

    expect(capturedAuth).toBe("Bearer bearer-xyz");
  });

  it("throws UnauthorizedError on 401", async () => {
    await expect(
      getMe("expired-token", {
        fetch: jsonFetch(401, { detail: "Could not validate credentials" }),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws ForbiddenError on 403", async () => {
    await expect(
      getMe("limited-token", {
        fetch: jsonFetch(403, { detail: "Account is disabled" }),
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
