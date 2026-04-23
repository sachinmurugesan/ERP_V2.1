/**
 * logout-route.test.ts — Unit tests for POST /api/auth/logout route handler.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockDelete = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: mockGet,
    set: vi.fn(),
    delete: mockDelete,
  }),
}));

const mockLogout = vi.fn().mockResolvedValue(undefined);
vi.mock("@harvesterp/sdk", () => ({
  logout: mockLogout,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/auth/logout", () => {
  it("returns 200 with status: 'logged_out'", async () => {
    mockGet.mockReturnValue(undefined);
    const { POST } = await import("../../src/app/api/auth/logout/route");
    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe("logged_out");
  });

  it("clears the session cookie", async () => {
    mockGet.mockReturnValue(undefined);
    const { POST } = await import("../../src/app/api/auth/logout/route");
    await POST();
    expect(mockDelete).toHaveBeenCalledWith("harvesterp_session");
  });

  it("clears the refresh cookie", async () => {
    mockGet.mockReturnValue(undefined);
    const { POST } = await import("../../src/app/api/auth/logout/route");
    await POST();
    expect(mockDelete).toHaveBeenCalledWith("harvesterp_refresh");
  });

  it("calls SDK logout with the token when session cookie exists", async () => {
    mockGet.mockReturnValue({ value: "existing-jwt" });
    const { POST } = await import("../../src/app/api/auth/logout/route");
    await POST();
    expect(mockLogout).toHaveBeenCalledWith("existing-jwt", expect.anything());
  });

  it("still clears the cookie even if SDK logout throws", async () => {
    mockGet.mockReturnValue({ value: "token" });
    mockLogout.mockRejectedValueOnce(new Error("Network error"));
    const { POST } = await import("../../src/app/api/auth/logout/route");
    const res = await POST();
    // Should not throw — cookie still cleared
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith("harvesterp_session");
  });
});
