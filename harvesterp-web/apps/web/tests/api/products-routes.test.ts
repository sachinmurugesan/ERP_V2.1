/**
 * products-routes.test.ts — Unit tests for the Next.js route handlers
 * that proxy FastAPI products endpoints.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: mockCookieGet }),
}));

const mockGetJson = vi.fn();
const mockPostJson = vi.fn();

vi.mock("@harvesterp/sdk", () => ({
  createHarvestClient: vi.fn().mockReturnValue({
    getJson: mockGetJson,
    postJson: mockPostJson,
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
  return new NextRequest(url, init);
}

describe("GET /api/products", () => {
  it("returns 401 when no session cookie is present", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const { GET } = await import("../../src/app/api/products/route");
    const res = await GET(
      await makeRequest("http://localhost/api/products?page=1"),
    );
    expect(res.status).toBe(401);
  });

  it("forwards all query params to the upstream /api/products/", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    mockGetJson.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      per_page: 50,
      pages: 0,
    });
    const { GET } = await import("../../src/app/api/products/route");
    const res = await GET(
      await makeRequest(
        "http://localhost/api/products?page=1&per_page=50&group=true&category=Chassis%20Spare%20Parts&search=thermo",
      ),
    );
    expect(res.status).toBe(200);
    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/products/",
      expect.objectContaining({
        params: expect.objectContaining({
          page: "1",
          per_page: "50",
          group: "true",
          category: "Chassis Spare Parts",
          search: "thermo",
        }),
      }),
    );
  });

  it("returns 502 when upstream throws", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    mockGetJson.mockRejectedValue(new Error("upstream down"));
    const { GET } = await import("../../src/app/api/products/route");
    const res = await GET(await makeRequest("http://localhost/api/products"));
    expect(res.status).toBe(502);
  });
});

describe("GET /api/products/categories", () => {
  it("wraps upstream string[] in {categories} envelope", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    mockGetJson.mockResolvedValue(["A", "B", "C"]);
    const { GET } = await import("../../src/app/api/products/categories/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { categories: string[] };
    expect(body.categories).toEqual(["A", "B", "C"]);
  });

  it("returns 401 when no session cookie is present", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const { GET } = await import("../../src/app/api/products/categories/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("POST /api/products/bulk-update", () => {
  it("rejects an empty product_codes array with 400", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    const { POST } = await import(
      "../../src/app/api/products/bulk-update/route"
    );
    const res = await POST(
      await makeRequest("http://localhost/api/products/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_codes: [], category: "X" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("forwards the body to upstream and returns 200 on success", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    mockPostJson.mockResolvedValue(undefined);
    const { POST } = await import(
      "../../src/app/api/products/bulk-update/route"
    );
    const res = await POST(
      await makeRequest("http://localhost/api/products/bulk-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_codes: ["A", "B"],
          category: "Chassis Spare Parts",
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(mockPostJson).toHaveBeenCalledWith(
      "/api/products/bulk-update/",
      expect.objectContaining({ product_codes: ["A", "B"] }),
    );
  });
});

describe("POST /api/products/bulk-delete", () => {
  it("returns 400 when product_ids is empty", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    const { POST } = await import(
      "../../src/app/api/products/bulk-delete/route"
    );
    const res = await POST(
      await makeRequest("http://localhost/api/products/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids: [] }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("forwards to upstream on success", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    mockPostJson.mockResolvedValue(undefined);
    const { POST } = await import(
      "../../src/app/api/products/bulk-delete/route"
    );
    const res = await POST(
      await makeRequest("http://localhost/api/products/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids: ["id-1"] }),
      }),
    );
    expect(res.status).toBe(200);
    expect(mockPostJson).toHaveBeenCalledWith(
      "/api/products/bulk-delete/",
      expect.objectContaining({ product_ids: ["id-1"] }),
    );
  });
});

describe("Bin routes", () => {
  it("GET /api/products/bin forwards query params", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    mockGetJson.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      per_page: 50,
      pages: 0,
    });
    const { GET } = await import("../../src/app/api/products/bin/route");
    const res = await GET(
      await makeRequest("http://localhost/api/products/bin?page=2&per_page=25"),
    );
    expect(res.status).toBe(200);
    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/products/bin/",
      expect.objectContaining({
        params: expect.objectContaining({ page: "2", per_page: "25" }),
      }),
    );
  });

  it("POST /api/products/bin/restore forwards product_ids and returns 200", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    mockPostJson.mockResolvedValue(undefined);
    const { POST } = await import(
      "../../src/app/api/products/bin/restore/route"
    );
    const res = await POST(
      await makeRequest("http://localhost/api/products/bin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids: ["x"] }),
      }),
    );
    expect(res.status).toBe(200);
    expect(mockPostJson).toHaveBeenCalledWith(
      "/api/products/bin/restore/",
      expect.objectContaining({ product_ids: ["x"] }),
    );
  });

  it("POST /api/products/bin/permanent-delete returns 502 when upstream fails", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    mockPostJson.mockRejectedValue(new Error("no"));
    const { POST } = await import(
      "../../src/app/api/products/bin/permanent-delete/route"
    );
    const res = await POST(
      await makeRequest(
        "http://localhost/api/products/bin/permanent-delete",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product_ids: ["z"] }),
        },
      ),
    );
    expect(res.status).toBe(502);
  });
});

describe("POST /api/products/[id]/set-default", () => {
  it("returns 401 without a session cookie", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const { POST } = await import(
      "../../src/app/api/products/[id]/set-default/route"
    );
    const res = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 200 and forwards to upstream", async () => {
    mockCookieGet.mockReturnValue({ value: "jwt" });
    mockPostJson.mockResolvedValue(undefined);
    const { POST } = await import(
      "../../src/app/api/products/[id]/set-default/route"
    );
    const res = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "abc-123" }),
    });
    expect(res.status).toBe(200);
    expect(mockPostJson).toHaveBeenCalledWith(
      "/api/products/abc-123/set-default/",
    );
  });
});
