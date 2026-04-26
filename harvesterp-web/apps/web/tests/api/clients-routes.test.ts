/**
 * clients-routes.test.ts — Tests for the new clients API proxy routes.
 *
 * Covers:
 *   GET /api/clients   — query forwarding + Cluster D stripping
 *   DELETE /api/clients/{id} — auth, success, 403, 404 mapping
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetToken = vi.fn<() => Promise<string | null>>();
const mockGetJson = vi.fn();
const mockDeleteJson = vi.fn();

vi.mock("@/lib/session", () => ({
  getSessionToken: () => mockGetToken(),
}));

vi.mock("@/lib/api-server", () => ({
  getServerClient: async () => ({
    getJson: mockGetJson,
    deleteJson: mockDeleteJson,
  }),
}));

import { GET as listClients } from "../../src/app/api/clients/route";
import { DELETE as deleteClient } from "../../src/app/api/clients/[id]/route";

function makeRequest(url: string) {
  return new NextRequest(new URL(url));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetToken.mockResolvedValue("tok");
});

// ── GET /api/clients ─────────────────────────────────────────────────────────

describe("GET /api/clients", () => {
  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await listClients(
      makeRequest("http://localhost/api/clients?page=1&per_page=50"),
    );
    expect(res.status).toBe(401);
  });

  it("forwards page + per_page + search params", async () => {
    mockGetJson.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      per_page: 25,
      pages: 0,
    });
    const res = await listClients(
      makeRequest("http://localhost/api/clients?page=2&per_page=25&search=acme"),
    );
    expect(res.status).toBe(200);
    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/clients/",
      expect.objectContaining({
        params: expect.objectContaining({
          page: 2,
          per_page: 25,
          search: "acme",
        }),
      }),
    );
  });

  it("strips Cluster D fields from each row before returning", async () => {
    mockGetJson.mockResolvedValueOnce({
      items: [
        {
          id: "c1",
          company_name: "Acme",
          gstin: "x",
          iec: null,
          pan: null,
          address: null,
          city: null,
          state: null,
          pincode: null,
          contact_name: null,
          contact_phone: null,
          contact_email: null,
          notes: null,
          is_active: true,
          client_type: "REGULAR",
          factory_markup_percent: 12.5,
          sourcing_commission_percent: 3.0,
        },
      ],
      total: 1,
      page: 1,
      per_page: 50,
      pages: 1,
    });
    const res = await listClients(
      makeRequest("http://localhost/api/clients?page=1&per_page=50"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items[0]).not.toHaveProperty("factory_markup_percent");
    expect(body.items[0]).not.toHaveProperty("sourcing_commission_percent");
    // But other fields preserved
    expect(body.items[0].company_name).toBe("Acme");
    expect(body.items[0].client_type).toBe("REGULAR");
  });

  it("preserves wrapper fields (total, page, per_page, pages)", async () => {
    mockGetJson.mockResolvedValueOnce({
      items: [],
      total: 393,
      page: 4,
      per_page: 50,
      pages: 8,
    });
    const res = await listClients(
      makeRequest("http://localhost/api/clients?page=4&per_page=50"),
    );
    const body = await res.json();
    expect(body.total).toBe(393);
    expect(body.page).toBe(4);
    expect(body.per_page).toBe(50);
    expect(body.pages).toBe(8);
  });

  it("returns 502 on upstream failure", async () => {
    mockGetJson.mockRejectedValueOnce(new Error("boom"));
    const res = await listClients(
      makeRequest("http://localhost/api/clients?page=1&per_page=50"),
    );
    expect(res.status).toBe(502);
  });

  it("uses safe defaults when page/per_page missing", async () => {
    mockGetJson.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      per_page: 50,
      pages: 0,
    });
    await listClients(makeRequest("http://localhost/api/clients"));
    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/clients/",
      expect.objectContaining({
        params: expect.objectContaining({ page: 1, per_page: 50 }),
      }),
    );
  });
});

// ── DELETE /api/clients/{id} ────────────────────────────────────────────────

describe("DELETE /api/clients/{id}", () => {
  function ctx(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await deleteClient(makeRequest("http://x/api/clients/c1"), ctx("c1"));
    expect(res.status).toBe(401);
  });

  it("calls upstream with encoded id", async () => {
    mockDeleteJson.mockResolvedValueOnce(undefined);
    const res = await deleteClient(
      makeRequest("http://x/api/clients/c%201"),
      ctx("c 1"),
    );
    expect(res.status).toBe(200);
    expect(mockDeleteJson).toHaveBeenCalledWith("/api/clients/c%201/");
  });

  it("maps upstream 403 with help message", async () => {
    const err: Error & { status?: number } = new Error("no");
    err.status = 403;
    mockDeleteJson.mockRejectedValueOnce(err);
    const res = await deleteClient(makeRequest("http://x/api/clients/c1"), ctx("c1"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/permission/i);
  });

  it("maps upstream 404", async () => {
    const err: Error & { status?: number } = new Error("missing");
    err.status = 404;
    mockDeleteJson.mockRejectedValueOnce(err);
    const res = await deleteClient(
      makeRequest("http://x/api/clients/missing"),
      ctx("missing"),
    );
    expect(res.status).toBe(404);
  });

  it("maps upstream 5xx to 502", async () => {
    const err: Error & { status?: number } = new Error("500");
    err.status = 500;
    mockDeleteJson.mockRejectedValueOnce(err);
    const res = await deleteClient(makeRequest("http://x/api/clients/c1"), ctx("c1"));
    expect(res.status).toBe(502);
  });
});
