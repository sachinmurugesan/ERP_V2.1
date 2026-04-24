/**
 * orders-routes.test.ts — Unit tests for the Next.js route handlers that
 * proxy FastAPI orders endpoints for the client-side TanStack Query pollers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookieGet }),
}));

const mockGetJson = vi.fn();
const mockDeleteJson = vi.fn();
const mockPutJson = vi.fn();

vi.mock("@harvesterp/sdk", () => ({
  createHarvestClient: vi.fn().mockReturnValue({
    getJson: mockGetJson,
    deleteJson: mockDeleteJson,
    putJson: mockPutJson,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

async function makeRequest(
  url: string,
  init?: RequestInit,
): Promise<import("next/server").NextRequest> {
  const { NextRequest } = await import("next/server");
  // RequestInit shapes differ between lib.dom (signal: AbortSignal | null)
  // and next/server (signal: AbortSignal); cast bridges the gap.
  return new NextRequest(url, init as never);
}

describe("GET /api/orders", () => {
  it("returns 401 when no session cookie is present", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const { GET } = await import("../../src/app/api/orders/route");
    const res = await GET(await makeRequest("http://localhost/api/orders?page=1"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with the proxied payload when upstream succeeds", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    mockGetJson.mockResolvedValue({
      items: [{ id: "ord-1" }],
      total: 1,
      page: 1,
      per_page: 25,
    });
    const { GET } = await import("../../src/app/api/orders/route");
    const res = await GET(
      await makeRequest(
        "http://localhost/api/orders?page=1&per_page=25&status=DRAFT",
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string }>; total: number };
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
    // Verifies the query params are forwarded
    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/orders/",
      expect.objectContaining({
        params: expect.objectContaining({ status: "DRAFT" }),
      }),
    );
  });

  it("returns 502 when the upstream FastAPI call throws", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    mockGetJson.mockRejectedValue(new Error("network down"));
    const { GET } = await import("../../src/app/api/orders/route");
    const res = await GET(await makeRequest("http://localhost/api/orders"));
    expect(res.status).toBe(502);
  });
});

describe("GET /api/orders/status-counts", () => {
  it("returns 401 when no session cookie is present", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const { GET } = await import(
      "../../src/app/api/orders/status-counts/route"
    );
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("wraps the upstream response in a {counts} envelope", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    mockGetJson.mockResolvedValue({
      DRAFT: { count: 3, stage: 1, name: "Draft" },
    });
    const { GET } = await import(
      "../../src/app/api/orders/status-counts/route"
    );
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      counts: Record<string, { count: number }>;
    };
    expect(body.counts.DRAFT?.count).toBe(3);
  });

  it("returns 502 when upstream throws", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    mockGetJson.mockRejectedValue(new Error("boom"));
    const { GET } = await import(
      "../../src/app/api/orders/status-counts/route"
    );
    const res = await GET();
    expect(res.status).toBe(502);
  });
});

describe("DELETE /api/orders/[id]", () => {
  it("returns 401 when no session cookie is present", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const { DELETE } = await import("../../src/app/api/orders/[id]/route");
    const res = await DELETE(
      await makeRequest("http://localhost/api/orders/abc", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "abc" }) },
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when the id is missing", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    const { DELETE } = await import("../../src/app/api/orders/[id]/route");
    const res = await DELETE(
      await makeRequest("http://localhost/api/orders/", { method: "DELETE" }),
      { params: Promise.resolve({ id: "" }) },
    );
    expect(res.status).toBe(400);
  });

  it("deletes and also persists the reason when body.reason is non-empty", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    mockDeleteJson.mockResolvedValue(undefined);
    mockPutJson.mockResolvedValue(undefined);
    const { DELETE } = await import("../../src/app/api/orders/[id]/route");
    const res = await DELETE(
      await makeRequest("http://localhost/api/orders/abc", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Client cancelled" }),
      }),
      { params: Promise.resolve({ id: "abc" }) },
    );
    expect(res.status).toBe(200);
    expect(mockDeleteJson).toHaveBeenCalledWith("/api/orders/abc/");
    expect(mockPutJson).toHaveBeenCalledWith(
      "/api/orders/abc/delete-reason/",
      { reason: "Client cancelled" },
    );
  });

  it("swallows reason-capture failure so a successful delete still returns 200", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    mockDeleteJson.mockResolvedValue(undefined);
    mockPutJson.mockRejectedValue(new Error("reason write failed"));
    const { DELETE } = await import("../../src/app/api/orders/[id]/route");
    const res = await DELETE(
      await makeRequest("http://localhost/api/orders/abc", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "ops note" }),
      }),
      { params: Promise.resolve({ id: "abc" }) },
    );
    expect(res.status).toBe(200);
  });

  it("returns 502 when the delete call fails", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    mockDeleteJson.mockRejectedValue(new Error("conflict"));
    const { DELETE } = await import("../../src/app/api/orders/[id]/route");
    const res = await DELETE(
      await makeRequest("http://localhost/api/orders/abc", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "abc" }) },
    );
    expect(res.status).toBe(502);
  });
});
