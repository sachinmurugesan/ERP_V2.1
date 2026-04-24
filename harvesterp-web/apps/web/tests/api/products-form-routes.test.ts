/**
 * products-form-routes.test.ts — Unit tests for the new Next.js route
 * handlers added by the product-form migration:
 *
 *   GET  /api/products/{id}
 *   PUT  /api/products/{id}
 *   POST /api/products (create)
 *   GET  /api/products/check-variants/{code}
 *   GET  /api/products/{id}/images
 *   DELETE /api/products/{id}/images/{imageId}
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetToken = vi.fn<() => Promise<string | null>>();
const mockGetJson = vi.fn();
const mockPostJson = vi.fn();
const mockPutJson = vi.fn();
const mockDeleteJson = vi.fn();

vi.mock("@/lib/session", () => ({
  getSessionToken: () => mockGetToken(),
}));

vi.mock("@/lib/api-server", () => ({
  getServerClient: async () => ({
    getJson: mockGetJson,
    postJson: mockPostJson,
    putJson: mockPutJson,
    deleteJson: mockDeleteJson,
  }),
}));

import { GET as getById, PUT as putById } from "../../src/app/api/products/[id]/route";
import { GET as listProducts, POST as createProduct } from "../../src/app/api/products/route";
import { GET as checkVariants } from "../../src/app/api/products/check-variants/[code]/route";
import { GET as listImages } from "../../src/app/api/products/[id]/images/route";
import { DELETE as deleteImage } from "../../src/app/api/products/[id]/images/[imageId]/route";

function makeRequest(url = "http://localhost/api/products", init: RequestInit = {}) {
  return new NextRequest(new URL(url), init as never);
}

function ctx<T extends Record<string, string>>(p: T) {
  return { params: Promise.resolve(p) } as { params: Promise<T> };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetToken.mockResolvedValue("tok");
});

// ── GET /api/products/{id} ────────────────────────────────────────────────────

describe("GET /api/products/{id}", () => {
  it("returns 401 without session token", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await getById(makeRequest(), ctx({ id: "p1" }));
    expect(res.status).toBe(401);
  });

  it("returns the product on success", async () => {
    mockGetJson.mockResolvedValueOnce({ id: "p1", product_code: "X" });
    const res = await getById(makeRequest(), ctx({ id: "p1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.product_code).toBe("X");
    expect(mockGetJson).toHaveBeenCalledWith("/api/products/p1/");
  });

  it("returns 502 on upstream failure", async () => {
    mockGetJson.mockRejectedValueOnce(new Error("boom"));
    const res = await getById(makeRequest(), ctx({ id: "p1" }));
    expect(res.status).toBe(502);
  });
});

// ── PUT /api/products/{id} ────────────────────────────────────────────────────

describe("PUT /api/products/{id}", () => {
  it("returns 400 on invalid JSON", async () => {
    const req = new NextRequest(new URL("http://localhost/api/products/p1"), {
      method: "PUT",
      body: "{not-json",
      headers: { "Content-Type": "application/json" },
    } as never);
    const res = await putById(req, ctx({ id: "p1" }));
    expect(res.status).toBe(400);
  });

  it("forwards the payload to backend PUT", async () => {
    mockPutJson.mockResolvedValueOnce({ id: "p1", product_code: "Y" });
    const req = new NextRequest(new URL("http://localhost/api/products/p1"), {
      method: "PUT",
      body: JSON.stringify({ product_name: "Updated" }),
      headers: { "Content-Type": "application/json" },
    } as never);
    const res = await putById(req, ctx({ id: "p1" }));
    expect(res.status).toBe(200);
    expect(mockPutJson).toHaveBeenCalledWith(
      "/api/products/p1/",
      expect.objectContaining({ product_name: "Updated" }),
    );
  });
});

// ── POST /api/products (create) ───────────────────────────────────────────────

describe("POST /api/products", () => {
  it("returns 201 on success", async () => {
    mockPostJson.mockResolvedValueOnce({ id: "new-id" });
    const req = new NextRequest(new URL("http://localhost/api/products"), {
      method: "POST",
      body: JSON.stringify({ product_code: "X", product_name: "Y" }),
      headers: { "Content-Type": "application/json" },
    } as never);
    const res = await createProduct(req);
    expect(res.status).toBe(201);
  });

  it("surfaces backend error detail", async () => {
    const err: Error & { status?: number; detail?: string } = new Error("dupe");
    err.status = 409;
    err.detail = "Product name already exists";
    mockPostJson.mockRejectedValueOnce(err);
    const req = new NextRequest(new URL("http://localhost/api/products"), {
      method: "POST",
      body: JSON.stringify({ product_code: "X", product_name: "Y" }),
      headers: { "Content-Type": "application/json" },
    } as never);
    const res = await createProduct(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/name already exists/i);
  });
});

// ── GET /api/products (list) — still works after adding POST ─────────────────

describe("GET /api/products", () => {
  it("forwards query params", async () => {
    mockGetJson.mockResolvedValueOnce({ items: [], total: 0, page: 1, per_page: 25, pages: 1 });
    const req = new NextRequest(
      new URL("http://localhost/api/products?per_page=25&group=true"),
    );
    const res = await listProducts(req);
    expect(res.status).toBe(200);
    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/products/",
      expect.objectContaining({
        params: expect.objectContaining({ per_page: "25", group: "true" }),
      }),
    );
  });
});

// ── check-variants ────────────────────────────────────────────────────────────

describe("GET /api/products/check-variants/{code}", () => {
  it("encodes the code into the upstream URL", async () => {
    mockGetJson.mockResolvedValueOnce({
      parent_id: null,
      variant_count: 0,
      variants: [],
    });
    const res = await checkVariants(makeRequest(), ctx({ code: "ABC/1 " }));
    expect(res.status).toBe(200);
    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/products/check-variants/ABC%2F1%20/",
    );
  });

  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await checkVariants(makeRequest(), ctx({ code: "X" }));
    expect(res.status).toBe(401);
  });
});

// ── images list ───────────────────────────────────────────────────────────────

describe("GET /api/products/{id}/images", () => {
  it("returns image array", async () => {
    mockGetJson.mockResolvedValueOnce([
      { id: "i1", image_url: "/a.jpg" },
    ]);
    const res = await listImages(makeRequest(), ctx({ id: "p1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
  });

  it("returns 502 on upstream failure", async () => {
    mockGetJson.mockRejectedValueOnce(new Error("nope"));
    const res = await listImages(makeRequest(), ctx({ id: "p1" }));
    expect(res.status).toBe(502);
  });
});

// ── delete image ──────────────────────────────────────────────────────────────

describe("DELETE /api/products/{id}/images/{imageId}", () => {
  it("calls upstream delete with encoded segments", async () => {
    mockDeleteJson.mockResolvedValueOnce(undefined);
    const res = await deleteImage(
      makeRequest(),
      ctx({ id: "p1", imageId: "img 1" }),
    );
    expect(res.status).toBe(200);
    expect(mockDeleteJson).toHaveBeenCalledWith(
      "/api/products/p1/images/img%201/",
    );
  });

  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await deleteImage(
      makeRequest(),
      ctx({ id: "p1", imageId: "i1" }),
    );
    expect(res.status).toBe(401);
  });
});
