/**
 * login-route.test.ts — Unit tests for POST /api/auth/login route handler.
 *
 * Mocks @harvesterp/sdk login() and next/headers cookies().
 * No real network calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockSet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
    set: mockSet,
    delete: vi.fn(),
  }),
}));

const mockLogin = vi.fn();
vi.mock("@harvesterp/sdk", async () => {
  const { UnauthorizedError } = await import("@harvesterp/sdk");
  return {
    login: mockLogin,
    UnauthorizedError,
    ValidationError: class ValidationError extends Error {
      constructor(msg: string) { super(msg); this.name = "ValidationError"; }
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const MOCK_SESSION = {
  access_token: "eyJ.token",
  refresh_token: "eyJ.refresh",
  token_type: "bearer",
  user: { id: "usr-1", email: "admin@harvesterp.com", role: "ADMIN", user_type: "INTERNAL", portal: "/dashboard", roles: ["ADMIN"], client_id: null, factory_id: null },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/auth/login", () => {
  it("returns 200 with user on valid credentials", async () => {
    mockLogin.mockResolvedValue(MOCK_SESSION);
    const { POST } = await import("../../src/app/api/auth/login/route");
    const req = makeRequest({ username: "admin@harvesterp.com", password: "secret" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json() as { user: { email: string } };
    expect(body.user.email).toBe("admin@harvesterp.com");
  });

  it("sets the session cookie on success", async () => {
    mockLogin.mockResolvedValue(MOCK_SESSION);
    const { POST } = await import("../../src/app/api/auth/login/route");
    await POST(makeRequest({ username: "a@b.com", password: "pass" }));
    // Two cookies are set: session + refresh
    expect(mockSet).toHaveBeenCalledTimes(2);
    expect(mockSet).toHaveBeenCalledWith(
      "harvesterp_session",
      "eyJ.token",
      expect.objectContaining({ httpOnly: true, path: "/" }),
    );
  });

  it("sets the refresh cookie on success", async () => {
    mockLogin.mockResolvedValue(MOCK_SESSION);
    const { POST } = await import("../../src/app/api/auth/login/route");
    await POST(makeRequest({ username: "a@b.com", password: "pass" }));
    expect(mockSet).toHaveBeenCalledWith(
      "harvesterp_refresh",
      "eyJ.refresh",
      expect.objectContaining({ httpOnly: true, path: "/api/auth" }),
    );
  });

  it("returns 401 on invalid credentials (UnauthorizedError)", async () => {
    const { UnauthorizedError } = await import("@harvesterp/sdk");
    mockLogin.mockRejectedValue(
      new UnauthorizedError("http://localhost:8000/api/auth/login", "POST"),
    );
    const { POST } = await import("../../src/app/api/auth/login/route");
    const res = await POST(makeRequest({ username: "bad@email.com", password: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when username is missing", async () => {
    const { POST } = await import("../../src/app/api/auth/login/route");
    const res = await POST(makeRequest({ password: "pass" }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("username");
  });

  it("returns 400 when password is missing", async () => {
    const { POST } = await import("../../src/app/api/auth/login/route");
    const res = await POST(makeRequest({ username: "a@b.com" }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("password");
  });

  it("returns 400 on invalid JSON body", async () => {
    const { POST } = await import("../../src/app/api/auth/login/route");
    const req = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("calls login with username as email and password", async () => {
    mockLogin.mockResolvedValue(MOCK_SESSION);
    const { POST } = await import("../../src/app/api/auth/login/route");
    await POST(makeRequest({ username: "user@test.com", password: "p4ss" }));
    expect(mockLogin).toHaveBeenCalledWith("user@test.com", "p4ss", expect.anything());
  });
});
