/**
 * session-route.test.ts — Unit tests for GET /api/auth/session route handler.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockGet }),
}));

const mockClientGet = vi.fn();
vi.mock("@harvesterp/sdk", () => ({
  createHarvestClient: vi.fn().mockReturnValue({ GET: mockClientGet }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const MOCK_USER = { id: "usr-1", email: "admin@harvesterp.com", role: "ADMIN", user_type: "INTERNAL", roles: ["ADMIN"], client_id: null, factory_id: null, tenant_id: "default" };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/auth/session", () => {
  it("returns 401 when no session cookie exists", async () => {
    mockGet.mockReturnValue(undefined);
    const { GET } = await import("../../src/app/api/auth/session/route");
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("authenticated");
  });

  it("returns 200 with user when session cookie is valid", async () => {
    mockGet.mockReturnValue({ value: "valid-jwt" });
    mockClientGet.mockResolvedValue({ data: MOCK_USER, error: undefined, response: new Response() });
    const { GET } = await import("../../src/app/api/auth/session/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json() as { user: { email: string } };
    expect(body.user.email).toBe("admin@harvesterp.com");
  });

  it("returns 401 when FastAPI returns an error (invalid/expired token)", async () => {
    mockGet.mockReturnValue({ value: "expired-jwt" });
    mockClientGet.mockResolvedValue({
      data: undefined,
      error: { detail: "Could not validate credentials" },
      response: new Response(null, { status: 401 }),
    });
    const { GET } = await import("../../src/app/api/auth/session/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 401 when the client GET throws (backend offline)", async () => {
    mockGet.mockReturnValue({ value: "some-jwt" });
    mockClientGet.mockRejectedValue(new Error("fetch failed"));
    const { GET } = await import("../../src/app/api/auth/session/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
