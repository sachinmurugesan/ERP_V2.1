/**
 * orders-dashboard-proxy.test.ts — Tests for the 4 new dashboard-tab API
 * proxies introduced in feat/orders-dashboard-tab.
 *
 * Per R-19: every fixture below mirrors a shape captured live from the
 * FastAPI backend on 2026-04-26 (`admin@harvesterp.com`, order
 * `6214e677-…`). Inferred shapes are NOT used. The factory-payment
 * populated shape comes directly from `_serialize_factory_payment` in
 * backend/routers/finance.py:761-805 because the live probe at ADMIN
 * returns 403 (D-004) before the populated shape is observable.
 *
 * Covers:
 *   GET /api/orders/[id]/payments
 *   GET /api/orders/[id]/factory-payments  (D-004 gated)
 *   GET /api/orders/[id]/shipments
 *   GET /api/orders/[id]/boe?shipment_id=…
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetToken = vi.fn<() => Promise<string | null>>();
const mockGetJson = vi.fn();
const mockGET = vi.fn();

vi.mock("@/lib/session", () => ({
  getSessionToken: () => mockGetToken(),
}));

vi.mock("@/lib/api-server", () => ({
  getServerClient: async () => ({
    getJson: mockGetJson,
    GET: mockGET,
  }),
}));

import { GET as getPayments } from "../../src/app/api/orders/[id]/payments/route";
import { GET as getFactoryPayments } from "../../src/app/api/orders/[id]/factory-payments/route";
import { GET as getShipments } from "../../src/app/api/orders/[id]/shipments/route";
import { GET as getBoe } from "../../src/app/api/orders/[id]/boe/route";

function makeReq(url: string) {
  return new NextRequest(new URL(url));
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  // resetAllMocks (NOT clearAllMocks): the latter only clears `.mock.calls`
  // but leaves `.mockResolvedValueOnce` queues intact, which causes leakage
  // between tests where one test queues a value but the route returns early
  // without consuming it (e.g. role-gate denial). resetAllMocks drops the
  // queue + restores default `vi.fn() → undefined` behaviour.
  vi.resetAllMocks();
  mockGetToken.mockResolvedValue("tok");
});

// ── Verified-live fixtures (R-19) ────────────────────────────────────────────

/** R-19 verified 2026-04-26: ADMIN call to a draft order returns this shape. */
const PAYMENTS_VERIFIED_FIXTURE = {
  payments: [],
  summary: {
    pi_total_inr: 0,
    advance_percent: 30,
    total_paid_inr: 0,
    balance_inr: 0,
    payment_count: 0,
    paid_percent: 0,
    has_revisions: false,
    unloaded_count: 0,
    revised_client_total_inr: 0,
    revised_balance_inr: 0,
    original_factory_total_cny: 0,
    original_factory_total_inr: 0,
    revised_factory_total_cny: 0,
    revised_factory_total_inr: 0,
    factory_paid_inr: 0,
    revised_factory_balance_inr: 0,
  },
} as const;

/**
 * From `backend/routers/finance.py:791-805` — the populated shape for
 * factory-payments (FINANCE/SUPER_ADMIN can observe; ADMIN gets 403).
 */
const FACTORY_PAYMENTS_VERIFIED_FIXTURE = {
  payments: [
    {
      id: "fp1",
      order_id: "o1",
      amount: 10000,
      currency: "CNY",
      exchange_rate: 12,
      amount_inr: 120000,
      amount_usd: 1500,
      method: "BANK",
      reference: "TT-2026-001",
      notes: null,
      payment_date: "2026-04-20",
      created_at: "2026-04-20T10:00:00",
    },
  ],
  summary: {
    factory_total_cny: 25000,
    factory_total_inr: 300000,
    factory_currency: "CNY",
    total_inr: 120000,
    total_usd: 1500,
    avg_exchange_rate_usd: 80,
    balance_inr: 180000,
    paid_percent: 40,
    currency_totals: { CNY: 10000 },
    remittance_count: 1,
  },
} as const;

/** R-19 verified 2026-04-26: empty case returns `[]` (no envelope). */
const SHIPMENTS_EMPTY_FIXTURE: readonly unknown[] = [];

/**
 * From `backend/routers/shipping.py:323-389` — the populated shape (live
 * probe order had no shipments so the populated fixture is taken from the
 * backend serializer source).
 */
const SHIPMENTS_POPULATED_FIXTURE = [
  {
    id: "s1",
    order_id: "o1",
    container_type: "20FT",
    container_number: "ABCU1234567",
    vessel_name: null,
    voyage_number: null,
    bl_number: null,
    port_of_loading: "Shenzhen",
    port_of_discharge: "Chennai",
    etd: "2026-05-01",
    eta: "2026-05-15",
    atd: null,
    ata: null,
    actual_departure_date: null,
    actual_arrival_date: null,
    phase: "BOOKED",
    freight_cost_inr: 50000,
    thc_inr: 5000,
    doc_fees_inr: 1000,
    sailing_phase: "BOOKED",
    shipper: null,
    consignee: null,
    notify_party: null,
    description_of_goods: null,
    freight_terms: "FOB",
    seal_number: null,
    loading_date: null,
    loading_notes: null,
    cfs_receipt_number: null,
    arrival_notes: null,
    freight_forwarder_id: null,
    freight_forwarder_name: null,
    cha_id: null,
    cha_name: null,
    cfs_id: null,
    cfs_name: null,
    transport_id: null,
    transport_name: null,
    items: [],
    created_at: "2026-04-25T12:00:00",
  },
];

/** R-19 verified 2026-04-26: missing-BOE case → HTTP 200, body `null`. */
const BOE_NULL_FIXTURE = null;

const BOE_POPULATED_FIXTURE = {
  id: "boe1",
  shipment_id: "s1",
  order_id: "o1",
  be_number: "BE-2026-100",
  be_date: "2026-05-20",
  port_of_import: "Chennai",
  cha_id: "cha1",
  cha_name: "Acme CHA",
  exchange_rate: 84,
  fob_inr: 1000000,
  freight_inr: 50000,
  insurance_inr: 11250,
  cif_inr: 1061250,
  landing_charges_inr: 10612,
  assessment_value_inr: 1071862,
  total_bcd: 75030,
  total_swc: 7503,
  total_igst: 207185,
  total_duty: 289718,
  status: "DRAFT",
  notes: null,
  created_at: "2026-05-20T10:00:00",
  line_items: [],
};

// ── GET /api/orders/[id]/payments ────────────────────────────────────────────

describe("GET /api/orders/[id]/payments", () => {
  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await getPayments(makeReq("http://x/api/orders/o1/payments"), ctx("o1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when order id missing", async () => {
    const res = await getPayments(makeReq("http://x/api/orders//payments"), ctx(""));
    expect(res.status).toBe(400);
  });

  it("forwards the verified envelope shape (payments + summary)", async () => {
    mockGetJson.mockResolvedValueOnce(PAYMENTS_VERIFIED_FIXTURE);
    const res = await getPayments(
      makeReq("http://x/api/orders/o1/payments"),
      ctx("o1"),
    );
    expect(res.status).toBe(200);
    expect(mockGetJson).toHaveBeenCalledWith("/api/finance/orders/o1/payments/");
    const body = await res.json();
    // Per R-19: assert on a non-trivial wrapper field unique to backend reality.
    // `revised_balance_inr` would be undefined if the proxy mocked an inferred
    // {payments, total} shape instead of the verified envelope.
    expect(body.summary.revised_balance_inr).toBe(0);
    expect(body.summary.advance_percent).toBe(30);
    expect(body.payments).toEqual([]);
  });

  it("encodes order id in upstream URL", async () => {
    mockGetJson.mockResolvedValueOnce(PAYMENTS_VERIFIED_FIXTURE);
    await getPayments(
      makeReq("http://x/api/orders/weird%20id/payments"),
      ctx("weird id"),
    );
    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/finance/orders/weird%20id/payments/",
    );
  });

  it("maps backend 403 to 403 with permission message", async () => {
    const err: Error & { status?: number } = new Error("nope");
    err.status = 403;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getPayments(
      makeReq("http://x/api/orders/o1/payments"),
      ctx("o1"),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/permission/i);
  });

  it("maps backend 404 to 404", async () => {
    const err: Error & { status?: number } = new Error("missing");
    err.status = 404;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getPayments(
      makeReq("http://x/api/orders/missing/payments"),
      ctx("missing"),
    );
    expect(res.status).toBe(404);
  });

  it("maps backend 5xx to 502", async () => {
    const err: Error & { status?: number } = new Error("boom");
    err.status = 500;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getPayments(
      makeReq("http://x/api/orders/o1/payments"),
      ctx("o1"),
    );
    expect(res.status).toBe(502);
  });
});

// ── GET /api/orders/[id]/factory-payments (D-004) ────────────────────────────

describe("GET /api/orders/[id]/factory-payments", () => {
  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await getFactoryPayments(
      makeReq("http://x/api/orders/o1/factory-payments"),
      ctx("o1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when order id missing", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "FINANCE" } });
    const res = await getFactoryPayments(
      makeReq("http://x/api/orders//factory-payments"),
      ctx(""),
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 with D-004 message for ADMIN role", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "ADMIN" } });
    const res = await getFactoryPayments(
      makeReq("http://x/api/orders/o1/factory-payments"),
      ctx("o1"),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/finance/i);
    expect(body.error).toMatch(/D-004/i);
    // Critically: no upstream call made — proxy gates BEFORE proxying.
    expect(mockGetJson).not.toHaveBeenCalled();
  });

  it("returns 403 with D-004 message for OPERATIONS role", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "OPERATIONS" } });
    const res = await getFactoryPayments(
      makeReq("http://x/api/orders/o1/factory-payments"),
      ctx("o1"),
    );
    expect(res.status).toBe(403);
    expect(mockGetJson).not.toHaveBeenCalled();
  });

  it("returns 403 with D-004 message for CLIENT role", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "CLIENT" } });
    const res = await getFactoryPayments(
      makeReq("http://x/api/orders/o1/factory-payments"),
      ctx("o1"),
    );
    expect(res.status).toBe(403);
    expect(mockGetJson).not.toHaveBeenCalled();
  });

  it("returns data for FINANCE role (forwards verified envelope)", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "FINANCE" } });
    mockGetJson.mockResolvedValueOnce(FACTORY_PAYMENTS_VERIFIED_FIXTURE);
    const res = await getFactoryPayments(
      makeReq("http://x/api/orders/o1/factory-payments"),
      ctx("o1"),
    );
    expect(res.status).toBe(200);
    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/finance/orders/o1/factory-payments/",
    );
    const body = await res.json();
    // Per R-19: assert on `currency_totals` (a non-trivial wrapper field that
    // would not exist on an inferred {payments: []} shape).
    expect(body.summary.currency_totals).toEqual({ CNY: 10000 });
    expect(body.summary.factory_total_cny).toBe(25000);
    expect(body.payments).toHaveLength(1);
    expect(body.payments[0].amount_usd).toBe(1500);
  });

  it("returns data for SUPER_ADMIN role", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "SUPER_ADMIN" } });
    mockGetJson.mockResolvedValueOnce(FACTORY_PAYMENTS_VERIFIED_FIXTURE);
    const res = await getFactoryPayments(
      makeReq("http://x/api/orders/o1/factory-payments"),
      ctx("o1"),
    );
    expect(res.status).toBe(200);
  });

  it("re-maps upstream 403 (defence-in-depth) to D-004 message", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "FINANCE" } });
    const err: Error & { status?: number } = new Error("forbidden");
    err.status = 403;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getFactoryPayments(
      makeReq("http://x/api/orders/o1/factory-payments"),
      ctx("o1"),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/D-004/i);
  });

  it("maps upstream 404 to 404 for FINANCE", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "FINANCE" } });
    const err: Error & { status?: number } = new Error("missing");
    err.status = 404;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getFactoryPayments(
      makeReq("http://x/api/orders/missing/factory-payments"),
      ctx("missing"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when caller role cannot be resolved", async () => {
    mockGET.mockResolvedValueOnce({ data: null });
    const res = await getFactoryPayments(
      makeReq("http://x/api/orders/o1/factory-payments"),
      ctx("o1"),
    );
    expect(res.status).toBe(403);
  });
});

// ── GET /api/orders/[id]/shipments ───────────────────────────────────────────

describe("GET /api/orders/[id]/shipments", () => {
  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await getShipments(
      makeReq("http://x/api/orders/o1/shipments"),
      ctx("o1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns bare empty array (no envelope wrapping)", async () => {
    mockGetJson.mockResolvedValueOnce(SHIPMENTS_EMPTY_FIXTURE);
    const res = await getShipments(
      makeReq("http://x/api/orders/o1/shipments"),
      ctx("o1"),
    );
    expect(res.status).toBe(200);
    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/shipping/orders/o1/shipments/",
    );
    const body = await res.json();
    // Per R-19: assert the response is a bare array, NOT { items: [] } or
    // { shipments: [] }. A proxy that wraps in an envelope would silently
    // break the FE which iterates over the result directly.
    expect(Array.isArray(body)).toBe(true);
    expect(body).toEqual([]);
  });

  it("forwards the verified populated shape (FE-alias fields preserved)", async () => {
    mockGetJson.mockResolvedValueOnce(SHIPMENTS_POPULATED_FIXTURE);
    const res = await getShipments(
      makeReq("http://x/api/orders/o1/shipments"),
      ctx("o1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    // Per R-19: assert on `actual_departure_date` (the FE alias the backend
    // adds in `_serialize_shipment` lines 358-360). Inferred shapes would
    // miss this field.
    expect(body[0]).toHaveProperty("actual_departure_date");
    expect(body[0]).toHaveProperty("sailing_phase", "BOOKED");
    expect(body[0].container_number).toBe("ABCU1234567");
  });

  it("maps backend 403 to 403", async () => {
    const err: Error & { status?: number } = new Error("nope");
    err.status = 403;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getShipments(
      makeReq("http://x/api/orders/o1/shipments"),
      ctx("o1"),
    );
    expect(res.status).toBe(403);
  });

  it("maps backend 404 to 404", async () => {
    const err: Error & { status?: number } = new Error("missing");
    err.status = 404;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getShipments(
      makeReq("http://x/api/orders/missing/shipments"),
      ctx("missing"),
    );
    expect(res.status).toBe(404);
  });
});

// ── GET /api/orders/[id]/boe?shipment_id=… ───────────────────────────────────

describe("GET /api/orders/[id]/boe", () => {
  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await getBoe(
      makeReq("http://x/api/orders/o1/boe?shipment_id=s1"),
      ctx("o1"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when shipment_id query param is missing", async () => {
    const res = await getBoe(
      makeReq("http://x/api/orders/o1/boe"),
      ctx("o1"),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/shipment_id/i);
  });

  it("returns null cleanly (HTTP 200) when no BOE filed", async () => {
    mockGetJson.mockResolvedValueOnce(BOE_NULL_FIXTURE);
    const res = await getBoe(
      makeReq("http://x/api/orders/o1/boe?shipment_id=s1"),
      ctx("o1"),
    );
    expect(res.status).toBe(200);
    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/customs/shipments/s1/boe/",
    );
    const body = await res.json();
    // Per R-19: backend returns `null` (HTTP 200) for missing-BOE — must
    // NOT be remapped to 404 or wrapped in `{ data: null }`. The FE treats
    // null as the empty-state signal.
    expect(body).toBe(null);
  });

  it("forwards the populated BOE envelope when one exists", async () => {
    mockGetJson.mockResolvedValueOnce(BOE_POPULATED_FIXTURE);
    const res = await getBoe(
      makeReq("http://x/api/orders/o1/boe?shipment_id=s1"),
      ctx("o1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // Per R-19: assert on `total_duty` (sum across BCD/SWC/IGST), a
    // non-trivial computed wrapper field unique to backend reality.
    expect(body.total_duty).toBe(289718);
    expect(body.be_number).toBe("BE-2026-100");
    expect(Array.isArray(body.line_items)).toBe(true);
  });

  it("encodes the shipment id in the upstream URL", async () => {
    mockGetJson.mockResolvedValueOnce(BOE_NULL_FIXTURE);
    await getBoe(
      makeReq("http://x/api/orders/o1/boe?shipment_id=weird%20ship"),
      ctx("o1"),
    );
    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/customs/shipments/weird%20ship/boe/",
    );
  });

  it("maps backend 403 (non-internal role) to 403", async () => {
    const err: Error & { status?: number } = new Error("nope");
    err.status = 403;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getBoe(
      makeReq("http://x/api/orders/o1/boe?shipment_id=s1"),
      ctx("o1"),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/internal/i);
  });

  it("maps backend 404 to 404 (shipment missing)", async () => {
    const err: Error & { status?: number } = new Error("missing");
    err.status = 404;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getBoe(
      makeReq("http://x/api/orders/o1/boe?shipment_id=missing"),
      ctx("o1"),
    );
    expect(res.status).toBe(404);
  });

  it("maps backend 5xx to 502 (does NOT 500 on null)", async () => {
    const err: Error & { status?: number } = new Error("boom");
    err.status = 500;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getBoe(
      makeReq("http://x/api/orders/o1/boe?shipment_id=s1"),
      ctx("o1"),
    );
    expect(res.status).toBe(502);
  });
});
