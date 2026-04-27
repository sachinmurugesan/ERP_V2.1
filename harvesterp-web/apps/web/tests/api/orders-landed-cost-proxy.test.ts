/**
 * orders-landed-cost-proxy.test.ts — Tests for the 2 landed-cost proxy
 * routes introduced in feat/orders-landed-cost-tab.
 *
 * Per R-19: every fixture mirrors the backend shape derived from the
 * FastAPI source (`backend/routers/landed_cost.py:1-241`) and the live
 * 400/404 cases captured 2026-04-27. See
 * `ERP_V1/docs/migration/logs/2026-04-27-orders-landed-cost-tab.md` §1.5
 * for the curl evidence.
 *
 * Covers:
 *   GET /api/orders/[id]/landed-cost          → JSON envelope
 *   GET /api/orders/[id]/landed-cost/download → .xlsx binary stream
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

import { GET as getLandedCost } from "../../src/app/api/orders/[id]/landed-cost/route";
import { GET as downloadLandedCost } from "../../src/app/api/orders/[id]/landed-cost/download/route";

function makeReq(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url), init);
}

function ctx(p: { id: string }) {
  return { params: Promise.resolve(p) };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockGetToken.mockResolvedValue("tok");
});

// ── R-19 fixture: populated landed cost envelope ─────────────────────────────
//
// Source-derived from `landed_cost.py:187-216`. Six fixed expense labels
// in this exact order. The 400 case ("stage not yet cleared") and 404 case
// (REGULAR client) were verified live 2026-04-27.

const LANDED_COST_FIXTURE = {
  order_id: "de2258e0-34f5-4fd3-8c70-539671425eb4",
  order_number: "AB-2026-0001",
  client_name: "Acme Corp",
  exchange_rate: 12.5,
  currency: "CNY",
  invoice: {
    label: "Invoice @12.50",
    amount_inr: 1_250_000,
  },
  expenses: [
    { label: "Freight + THC", amount_inr: 50_000 },
    { label: "Clearance + CFS", amount_inr: 18_000 },
    { label: "Sourcing Charge (3.0%)", amount_inr: 37_500 },
    { label: "Duty + IGST", amount_inr: 230_000 },
    { label: "Transport", amount_inr: 12_000 },
    { label: "Miscellaneous", amount_inr: 5_500 },
  ],
  summary: {
    total_bill_inr: 1_250_000,
    total_expenses_inr: 353_000,
    grand_total_inr: 1_603_000,
    expense_percent: 28.24,
  },
  items: [
    {
      product_code: "AB-001",
      product_name: "Tyre 4x16",
      quantity: 50,
      client_factory_price_cny: 200,
      item_value_inr: 125_000,
      freight_share: 5_000,
      duty_share: 23_000,
      clearance_share: 1_800,
      commission_share: 3_750,
      total_landed_cost: 158_550,
      landed_cost_per_unit: 3_171,
    },
  ],
};

// ── GET /api/orders/[id]/landed-cost ─────────────────────────────────────────

describe("GET /api/orders/[id]/landed-cost", () => {
  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await getLandedCost(
      makeReq("http://x/api/orders/o1/landed-cost"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when order id missing", async () => {
    const res = await getLandedCost(
      makeReq("http://x/api/orders//landed-cost"),
      ctx({ id: "" }),
    );
    expect(res.status).toBe(400);
  });

  it("forwards the populated envelope on 200", async () => {
    mockGetJson.mockResolvedValueOnce(LANDED_COST_FIXTURE);
    const res = await getLandedCost(
      makeReq("http://x/api/orders/o1/landed-cost"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(200);
    // Per R-19: backend URL is /api/orders/{id}/landed-cost/ (trailing
    // slash). Vue's ordersApi.getLandedCost hits this exact path —
    // confirmed live 2026-04-27.
    expect(mockGetJson).toHaveBeenCalledWith("/api/orders/o1/landed-cost/");
    const body = await res.json();
    // Per R-19: assert on multiple non-trivial wrapper fields unique to
    // the real backend serializer. A bare {data: …} envelope or a
    // {expenses: []} array would fail these.
    expect(body.summary.expense_percent).toBe(28.24);
    expect(body.summary.grand_total_inr).toBe(1_603_000);
    expect(body.invoice.label).toBe("Invoice @12.50");
    expect(body.expenses).toHaveLength(6);
    expect(body.expenses[2].label).toBe("Sourcing Charge (3.0%)");
    expect(body.items[0].landed_cost_per_unit).toBe(3_171);
    expect(body.exchange_rate).toBe(12.5);
    expect(body.currency).toBe("CNY");
  });

  it("encodes the order id in the URL", async () => {
    mockGetJson.mockResolvedValueOnce(LANDED_COST_FIXTURE);
    await getLandedCost(
      makeReq("http://x/api/orders/weird%20id/landed-cost"),
      ctx({ id: "weird id" }),
    );
    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/orders/weird%20id/landed-cost/",
    );
  });

  it("maps backend 400 to 400 with the upstream detail (stage-not-cleared case)", async () => {
    // Live-verified 2026-04-27: TRANSPARENCY client at DRAFT stage returns
    //   {"detail":"Landed cost is available after customs clearance.
    //     Current stage: Draft (stage 1)"}
    const err: Error & { status?: number; detail?: string } = new Error(
      "Landed cost is available after customs clearance. Current stage: Draft (stage 1)",
    );
    err.status = 400;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getLandedCost(
      makeReq("http://x/api/orders/o1/landed-cost"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/customs clearance/i);
  });

  it("maps backend 403 to 403 (caller has wrong role)", async () => {
    // landed_cost.py:68-75 raises 403 for OPERATIONS / FACTORY roles.
    const err: Error & { status?: number } = new Error("forbidden");
    err.status = 403;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getLandedCost(
      makeReq("http://x/api/orders/o1/landed-cost"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/permission/i);
  });

  it("maps backend 404 to 404 (REGULAR client OR feature-flag off)", async () => {
    // Live-verified 2026-04-27: REGULAR client returns
    //   {"detail":"Not found"}
    // Same code path triggers when TRANSPARENCY_ENABLED=false.
    const err: Error & { status?: number } = new Error("Not found");
    err.status = 404;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getLandedCost(
      makeReq("http://x/api/orders/o1/landed-cost"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(404);
  });

  it("maps backend 5xx to 502 (Bad Gateway)", async () => {
    const err: Error & { status?: number } = new Error("boom");
    err.status = 500;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getLandedCost(
      makeReq("http://x/api/orders/o1/landed-cost"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(502);
  });
});

// ── GET /api/orders/[id]/landed-cost/download ────────────────────────────────

describe("GET /api/orders/[id]/landed-cost/download", () => {
  function mockUpstreamBinary(opts: {
    ok: boolean;
    status: number;
    body?: ArrayBuffer;
    headers?: Record<string, string>;
    jsonError?: { detail?: string };
  }) {
    const headers = new Headers(opts.headers ?? {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: opts.ok,
        status: opts.status,
        headers,
        arrayBuffer: async () => opts.body ?? new ArrayBuffer(0),
        json: async () => opts.jsonError ?? {},
      } as unknown as Response)),
    );
  }

  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await downloadLandedCost(
      makeReq("http://x/api/orders/o1/landed-cost/download"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when order id missing", async () => {
    const res = await downloadLandedCost(
      makeReq("http://x/api/orders//landed-cost/download"),
      ctx({ id: "" }),
    );
    expect(res.status).toBe(400);
  });

  it("streams .xlsx binary with Content-Type + Content-Disposition preserved", async () => {
    const body = new TextEncoder().encode("xlsx-bytes-here").buffer;
    mockUpstreamBinary({
      ok: true,
      status: 200,
      body,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="LandedCost_AB-2026-0001.xlsx"',
      },
    });
    const res = await downloadLandedCost(
      makeReq("http://x/api/orders/o1/landed-cost/download"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(200);
    // Per R-19: backend serves a StreamingResponse with media-type
    // application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
    // and a `LandedCost_{order_number}.xlsx` filename header. Proxy
    // must pass both through verbatim — useBlobDownload reads them
    // client-side.
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="LandedCost_AB-2026-0001.xlsx"',
    );
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("uses fallback filename when upstream omits Content-Disposition", async () => {
    mockUpstreamBinary({
      ok: true,
      status: 200,
      body: new ArrayBuffer(8),
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
    const res = await downloadLandedCost(
      makeReq("http://x/api/orders/abc/landed-cost/download"),
      ctx({ id: "abc" }),
    );
    expect(res.headers.get("Content-Disposition")).toMatch(
      /LandedCost_abc\.xlsx/,
    );
  });

  it("propagates upstream 400 with the stage-not-cleared detail", async () => {
    mockUpstreamBinary({
      ok: false,
      status: 400,
      jsonError: {
        detail:
          "Landed cost is available after customs clearance. Current stage: Draft (stage 1)",
      },
    });
    const res = await downloadLandedCost(
      makeReq("http://x/api/orders/o1/landed-cost/download"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/customs clearance/i);
  });

  it("propagates upstream 403 with detail message", async () => {
    mockUpstreamBinary({
      ok: false,
      status: 403,
      jsonError: { detail: "Access denied" },
    });
    const res = await downloadLandedCost(
      makeReq("http://x/api/orders/o1/landed-cost/download"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/access denied/i);
  });

  it("propagates upstream 404 (REGULAR client OR feature-flag off)", async () => {
    mockUpstreamBinary({
      ok: false,
      status: 404,
      jsonError: { detail: "Not found" },
    });
    const res = await downloadLandedCost(
      makeReq("http://x/api/orders/o1/landed-cost/download"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(404);
  });

  it("maps upstream 5xx to 502", async () => {
    mockUpstreamBinary({
      ok: false,
      status: 500,
      jsonError: { detail: "boom" },
    });
    const res = await downloadLandedCost(
      makeReq("http://x/api/orders/o1/landed-cost/download"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(502);
  });

  it("maps network error to 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("net down");
      }),
    );
    const res = await downloadLandedCost(
      makeReq("http://x/api/orders/o1/landed-cost/download"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(502);
  });
});
