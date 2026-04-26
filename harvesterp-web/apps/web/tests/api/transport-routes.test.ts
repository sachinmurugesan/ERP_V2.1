/**
 * transport-routes.test.ts — Tests for the new transporters API proxy routes.
 *
 * Covers:
 *   GET /api/transport          — query forwarding + list-projection stripping
 *   DELETE /api/transport/{id}  — auth, success, 403, 404, 5xx mapping
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

import { GET as listTransport } from "../../src/app/api/transport/route";
import { DELETE as deleteTransport } from "../../src/app/api/transport/[id]/route";

function makeRequest(url: string) {
  return new NextRequest(new URL(url));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetToken.mockResolvedValue("tok");
});

// ── GET /api/transport ────────────────────────────────────────────────────────

describe("GET /api/transport", () => {
  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await listTransport(
      makeRequest("http://localhost/api/transport?page=1&per_page=50"),
    );
    expect(res.status).toBe(401);
  });

  it("forwards page + per_page + search params to upstream", async () => {
    mockGetJson.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 2,
      per_page: 25,
      pages: 0,
    });
    const res = await listTransport(
      makeRequest(
        "http://localhost/api/transport?page=2&per_page=25&search=maersk",
      ),
    );
    expect(res.status).toBe(200);
    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/shipping/transport/",
      expect.objectContaining({
        params: expect.objectContaining({
          page: 2,
          per_page: 25,
          search: "maersk",
        }),
      }),
    );
  });

  it("calls the correct upstream URL (/api/shipping/transport/, not /api/transporters/)", async () => {
    mockGetJson.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      per_page: 50,
      pages: 0,
    });
    await listTransport(
      makeRequest("http://localhost/api/transport"),
    );
    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/shipping/transport/",
      expect.any(Object),
    );
  });

  it("strips email/address/country/bank_*/ifsc_code/notes from each row", async () => {
    mockGetJson.mockResolvedValueOnce({
      items: [
        {
          id: "p1",
          name: "Maersk India",
          contact_person: "Vikram",
          phone: "+91 22 0000 0000",
          email: "ops@maersk.example",
          address: "1 Quay Lane",
          city: "Mumbai",
          state: "MH",
          country: "India",
          bank_name: "HDFC",
          bank_account: "12345678",
          ifsc_code: "HDFC0001234",
          gst_number: "27AAACM0000A1Z5",
          pan_number: "AAACM0000A",
          roles: ["FREIGHT_FORWARDER", "CHA"],
          operating_ports: ["MUMBAI"],
          notes: "preferred for AS lanes",
          is_active: true,
          created_at: "2026-04-26T00:00:00",
          updated_at: null,
        },
      ],
      total: 1,
      page: 1,
      per_page: 50,
      pages: 1,
    });
    const res = await listTransport(
      makeRequest("http://localhost/api/transport?page=1&per_page=50"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const row = body.items[0];
    // Stripped fields
    expect(row).not.toHaveProperty("email");
    expect(row).not.toHaveProperty("address");
    expect(row).not.toHaveProperty("country");
    expect(row).not.toHaveProperty("bank_name");
    expect(row).not.toHaveProperty("bank_account");
    expect(row).not.toHaveProperty("ifsc_code");
    expect(row).not.toHaveProperty("notes");
    // Kept fields
    expect(row.id).toBe("p1");
    expect(row.name).toBe("Maersk India");
    expect(row.contact_person).toBe("Vikram");
    expect(row.phone).toBe("+91 22 0000 0000");
    expect(row.city).toBe("Mumbai");
    expect(row.state).toBe("MH");
    expect(row.gst_number).toBe("27AAACM0000A1Z5");
    expect(row.pan_number).toBe("AAACM0000A");
    expect(row.roles).toEqual(["FREIGHT_FORWARDER", "CHA"]);
    expect(row.operating_ports).toEqual(["MUMBAI"]);
    expect(row.is_active).toBe(true);
    expect(row.created_at).toBe("2026-04-26T00:00:00");
    expect(row.updated_at).toBeNull();
  });

  it("preserves wrapper fields (total, page, per_page, pages)", async () => {
    mockGetJson.mockResolvedValueOnce({
      items: [],
      total: 142,
      page: 3,
      per_page: 50,
      pages: 3,
    });
    const res = await listTransport(
      makeRequest("http://localhost/api/transport?page=3&per_page=50"),
    );
    const body = await res.json();
    expect(body.total).toBe(142);
    expect(body.page).toBe(3);
    expect(body.per_page).toBe(50);
    expect(body.pages).toBe(3);
  });

  it("returns 502 on upstream failure", async () => {
    mockGetJson.mockRejectedValueOnce(new Error("boom"));
    const res = await listTransport(
      makeRequest("http://localhost/api/transport?page=1&per_page=50"),
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
    await listTransport(makeRequest("http://localhost/api/transport"));
    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/shipping/transport/",
      expect.objectContaining({
        params: expect.objectContaining({ page: 1, per_page: 50 }),
      }),
    );
  });

  it("does not pass search param when empty", async () => {
    mockGetJson.mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      per_page: 50,
      pages: 0,
    });
    await listTransport(
      makeRequest("http://localhost/api/transport?page=1&per_page=50"),
    );
    const callParams = mockGetJson.mock.calls[0][1].params as Record<string, unknown>;
    expect(callParams).not.toHaveProperty("search");
  });
});

// ── DELETE /api/transport/{id} ───────────────────────────────────────────────

describe("DELETE /api/transport/{id}", () => {
  function ctx(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await deleteTransport(
      makeRequest("http://x/api/transport/p1"),
      ctx("p1"),
    );
    expect(res.status).toBe(401);
  });

  it("calls upstream /api/shipping/transport/{id}/ with encoded id", async () => {
    mockDeleteJson.mockResolvedValueOnce(undefined);
    const res = await deleteTransport(
      makeRequest("http://x/api/transport/p%201"),
      ctx("p 1"),
    );
    expect(res.status).toBe(200);
    expect(mockDeleteJson).toHaveBeenCalledWith(
      "/api/shipping/transport/p%201/",
    );
  });

  it("maps upstream 403 with help message about permission", async () => {
    const err: Error & { status?: number } = new Error("no");
    err.status = 403;
    mockDeleteJson.mockRejectedValueOnce(err);
    const res = await deleteTransport(
      makeRequest("http://x/api/transport/p1"),
      ctx("p1"),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/permission/i);
  });

  it("maps upstream 404 to 404 with 'Provider not found'", async () => {
    const err: Error & { status?: number } = new Error("missing");
    err.status = 404;
    mockDeleteJson.mockRejectedValueOnce(err);
    const res = await deleteTransport(
      makeRequest("http://x/api/transport/missing"),
      ctx("missing"),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  it("maps upstream 5xx to 502", async () => {
    const err: Error & { status?: number } = new Error("500");
    err.status = 500;
    mockDeleteJson.mockRejectedValueOnce(err);
    const res = await deleteTransport(
      makeRequest("http://x/api/transport/p1"),
      ctx("p1"),
    );
    expect(res.status).toBe(502);
  });

  it("returns ok:true on success", async () => {
    mockDeleteJson.mockResolvedValueOnce(undefined);
    const res = await deleteTransport(
      makeRequest("http://x/api/transport/p1"),
      ctx("p1"),
    );
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
