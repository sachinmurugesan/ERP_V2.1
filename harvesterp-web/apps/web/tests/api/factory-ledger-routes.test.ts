/**
 * factory-ledger-routes.test.ts — Route handler tests for the
 * factory-ledger API proxy and download endpoints.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetToken = vi.fn<() => Promise<string | null>>();
const mockGetJson = vi.fn();

vi.mock("@/lib/session", () => ({
  getSessionToken: () => mockGetToken(),
}));

vi.mock("@/lib/api-server", () => ({
  getServerClient: async () => ({
    getJson: mockGetJson,
  }),
}));

import { GET as getLedger } from "../../src/app/api/finance/factory-ledger/[id]/route";
import { GET as downloadLedger } from "../../src/app/api/finance/factory-ledger/[id]/download/route";

function ledgerRequest(url: string) {
  return new NextRequest(new URL(url));
}

function ctx(p: { id: string }) {
  return { params: Promise.resolve(p) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetToken.mockResolvedValue("tok");
  vi.unstubAllGlobals();
});

// ── GET /api/finance/factory-ledger/{id} ─────────────────────────────────────

describe("GET /api/finance/factory-ledger/{id}", () => {
  it("returns 401 when session missing", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await getLedger(
      ledgerRequest("http://localhost/api/finance/factory-ledger/f1"),
      ctx({ id: "f1" }),
    );
    expect(res.status).toBe(401);
  });

  it("forwards start_date + end_date params", async () => {
    mockGetJson.mockResolvedValueOnce({
      entries: [],
      summary: { total_debit: 0, total_credit: 0, net_balance: 0 },
      factory_name: "X",
      factory_id: "f1",
    });
    const res = await getLedger(
      ledgerRequest(
        "http://localhost/api/finance/factory-ledger/f1?start_date=2026-04-01&end_date=2026-04-24",
      ),
      ctx({ id: "f1" }),
    );
    expect(res.status).toBe(200);
    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/finance/factory-ledger/f1/",
      expect.objectContaining({
        params: expect.objectContaining({
          start_date: "2026-04-01",
          end_date: "2026-04-24",
        }),
      }),
    );
  });

  it("surfaces upstream 403 with D-004 message", async () => {
    const err: Error & { status?: number } = new Error("forbidden");
    err.status = 403;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getLedger(
      ledgerRequest("http://localhost/api/finance/factory-ledger/f1"),
      ctx({ id: "f1" }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/D-004/i);
  });

  it("maps upstream 404 to 404", async () => {
    const err: Error & { status?: number } = new Error("not found");
    err.status = 404;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getLedger(
      ledgerRequest("http://localhost/api/finance/factory-ledger/missing"),
      ctx({ id: "missing" }),
    );
    expect(res.status).toBe(404);
  });

  it("maps upstream 500 to 502", async () => {
    const err: Error & { status?: number } = new Error("boom");
    err.status = 500;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getLedger(
      ledgerRequest("http://localhost/api/finance/factory-ledger/f1"),
      ctx({ id: "f1" }),
    );
    expect(res.status).toBe(502);
  });
});

// ── GET /api/finance/factory-ledger/{id}/download ────────────────────────────

describe("GET /api/finance/factory-ledger/{id}/download", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  function mockUpstream(opts: {
    ok: boolean;
    status: number;
    body?: ArrayBuffer;
    headers?: Record<string, string>;
    jsonError?: { detail?: string };
  }) {
    const headers = new Headers(opts.headers ?? {});
    const response = {
      ok: opts.ok,
      status: opts.status,
      headers,
      arrayBuffer: async () => opts.body ?? new ArrayBuffer(8),
      json: async () => opts.jsonError ?? {},
    } as unknown as Response;
    vi.stubGlobal("fetch", vi.fn(async () => response));
  }

  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await downloadLedger(
      ledgerRequest(
        "http://localhost/api/finance/factory-ledger/f1/download?format=xlsx",
      ),
      ctx({ id: "f1" }),
    );
    expect(res.status).toBe(401);
  });

  it("streams upstream body with Content-Type + Content-Disposition", async () => {
    const body = new TextEncoder().encode("binary-payload").buffer;
    mockUpstream({
      ok: true,
      status: 200,
      body,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="factory_x.xlsx"',
      },
    });
    const res = await downloadLedger(
      ledgerRequest(
        "http://localhost/api/finance/factory-ledger/f1/download?format=xlsx",
      ),
      ctx({ id: "f1" }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
    expect(res.headers.get("Content-Disposition")).toMatch(/factory_x\.xlsx/);
  });

  it("clamps unknown format to xlsx default", async () => {
    const body = new ArrayBuffer(4);
    let calledUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calledUrl = url;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "Content-Type": "application/octet-stream" }),
          arrayBuffer: async () => body,
          json: async () => ({}),
        } as unknown as Response;
      }),
    );
    await downloadLedger(
      ledgerRequest(
        "http://localhost/api/finance/factory-ledger/f1/download?format=evil",
      ),
      ctx({ id: "f1" }),
    );
    expect(calledUrl).toContain("format=xlsx");
  });

  it("propagates upstream 403 with detail message", async () => {
    mockUpstream({
      ok: false,
      status: 403,
      jsonError: { detail: "Insufficient permissions." },
    });
    const res = await downloadLedger(
      ledgerRequest(
        "http://localhost/api/finance/factory-ledger/f1/download?format=pdf",
      ),
      ctx({ id: "f1" }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/insufficient/i);
  });

  it("maps network error to 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("net down");
      }),
    );
    const res = await downloadLedger(
      ledgerRequest(
        "http://localhost/api/finance/factory-ledger/f1/download?format=xlsx",
      ),
      ctx({ id: "f1" }),
    );
    expect(res.status).toBe(502);
  });

  it("uses fallback filename when upstream omits Content-Disposition", async () => {
    const body = new ArrayBuffer(4);
    mockUpstream({
      ok: true,
      status: 200,
      body,
      headers: { "Content-Type": "application/pdf" },
    });
    const res = await downloadLedger(
      ledgerRequest(
        "http://localhost/api/finance/factory-ledger/f1/download?format=pdf",
      ),
      ctx({ id: "f1" }),
    );
    expect(res.headers.get("Content-Disposition")).toMatch(
      /factory_ledger\.pdf/,
    );
  });
});
