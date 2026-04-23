/**
 * dashboard-routes.test.ts — Unit tests for the two Next.js route handlers
 * that proxy FastAPI dashboard endpoints on behalf of client-side pollers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Shared mocks ──────────────────────────────────────────────────────────────

const mockCookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookieGet }),
}));

const mockGetJson = vi.fn();
vi.mock("@harvesterp/sdk", () => ({
  createHarvestClient: vi.fn().mockReturnValue({ getJson: mockGetJson }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ── /api/dashboard/active-shipments ───────────────────────────────────────────

describe("GET /api/dashboard/active-shipments", () => {
  it("returns 401 when no session cookie is present", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const { GET } = await import(
      "../../src/app/api/dashboard/active-shipments/route"
    );
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 200 with shipments payload when upstream succeeds", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    mockGetJson.mockResolvedValue([
      { id: "ord-1", order_number: "AB-0001", stage_number: 5 },
    ]);
    const { GET } = await import(
      "../../src/app/api/dashboard/active-shipments/route"
    );
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { shipments: Array<{ id: string }> };
    expect(body.shipments).toHaveLength(1);
    expect(body.shipments[0]!.id).toBe("ord-1");
  });

  it("returns 502 when upstream FastAPI call throws", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    mockGetJson.mockRejectedValue(new Error("network down"));
    const { GET } = await import(
      "../../src/app/api/dashboard/active-shipments/route"
    );
    const res = await GET();
    expect(res.status).toBe(502);
  });
});

// ── /api/dashboard/recent-activity ────────────────────────────────────────────

describe("GET /api/dashboard/recent-activity", () => {
  it("returns 401 when no session cookie is present", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const { GET } = await import(
      "../../src/app/api/dashboard/recent-activity/route"
    );
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 200 with events payload when upstream succeeds", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    mockGetJson.mockResolvedValue([
      {
        id: "evt-1",
        action: "Order moved to Packing",
        details: "12 SKUs",
        updated_at: new Date().toISOString(),
      },
    ]);
    const { GET } = await import(
      "../../src/app/api/dashboard/recent-activity/route"
    );
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: Array<{ id: string }> };
    expect(body.events).toHaveLength(1);
    expect(body.events[0]!.id).toBe("evt-1");
  });

  it("returns 502 when upstream FastAPI call throws", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    mockGetJson.mockRejectedValue(new Error("network down"));
    const { GET } = await import(
      "../../src/app/api/dashboard/recent-activity/route"
    );
    const res = await GET();
    expect(res.status).toBe(502);
  });
});
