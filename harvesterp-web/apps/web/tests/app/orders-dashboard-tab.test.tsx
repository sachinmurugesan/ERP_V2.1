/**
 * orders-dashboard-tab.test.tsx — Component tests for OrderDashboardTab.
 *
 * Mocks `fetch` per-test to drive each card's TanStack-Query state into
 * loading / success / empty / error / 403 paths. The role prop drives
 * Card 2 D-004 visibility.
 *
 * Backend shapes mirror the live-verified fixtures from
 * tests/api/orders-dashboard-proxy.test.ts (R-19).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { OrderDashboardTab } from "../../src/app/(app)/orders/[id]/_components/tabs/order-dashboard-tab";
import type {
  OrderDetail,
  OrderTimelineResponse,
} from "../../src/app/(app)/orders/[id]/_components/types";

// next/link is fine in jsdom but we mock useRouter to avoid the
// "invariant: app router context not mounted" error from <Link>.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => "/orders/o1",
  useSearchParams: () => new URLSearchParams(),
}));

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeOrder(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: "o1",
    order_number: "AB-2026-0001",
    client_id: "c1",
    factory_id: "f1",
    status: "DRAFT",
    currency: "INR",
    exchange_rate: 12,
    exchange_rate_date: null,
    po_reference: "PO-12345",
    notes: null,
    reopen_count: 0,
    last_reopen_reason: null,
    igst_credit_amount: 0,
    igst_credit_claimed: false,
    completed_at: null,
    created_at: "2026-04-26T10:00:00",
    updated_at: null,
    client_name: "Acme Corp",
    factory_name: "Acme Test Factory",
    item_count: 5,
    total_value_cny: 25000,
    stage_number: 1,
    stage_name: "Draft",
    highest_unlocked_stage: 1,
    pi_stale: false,
    version: 1,
    client_reference: null,
    client_type: "REGULAR",
    query_counts: { total: 0, open: 0, replied: 0 },
    ...overrides,
  };
}

const TIMELINE_FIXTURE: OrderTimelineResponse = {
  current_status: "DRAFT",
  current_stage: 1,
  current_name: "Draft",
  timeline: [
    { stage: 1, name: "Draft", status: "current" },
    { stage: 2, name: "Pending PI", status: "pending" },
  ],
  overrides: [],
};

const PAYMENTS_FIXTURE = {
  payments: [],
  summary: {
    pi_total_inr: 50000,
    advance_percent: 30,
    total_paid_inr: 15000,
    balance_inr: 35000,
    payment_count: 1,
    paid_percent: 30,
    has_revisions: false,
    unloaded_count: 0,
    revised_client_total_inr: 50000,
    revised_balance_inr: 35000,
    original_factory_total_cny: 25000,
    original_factory_total_inr: 300000,
    revised_factory_total_cny: 25000,
    revised_factory_total_inr: 300000,
    factory_paid_inr: 0,
    revised_factory_balance_inr: 300000,
  },
};

const FACTORY_PAYMENTS_FIXTURE = {
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
};

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

// ── Fetch dispatcher ─────────────────────────────────────────────────────────

interface FetchPlan {
  payments?: { ok: boolean; status?: number; body?: unknown };
  factoryPayments?: { ok: boolean; status?: number; body?: unknown };
  shipments?: { ok: boolean; status?: number; body?: unknown };
  boe?: { ok: boolean; status?: number; body?: unknown };
}

function setupFetch(plan: FetchPlan = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    let entry: { ok: boolean; status?: number; body?: unknown } | undefined;

    if (url.includes("/factory-payments")) entry = plan.factoryPayments;
    else if (url.includes("/payments")) entry = plan.payments;
    else if (url.includes("/shipments")) entry = plan.shipments;
    else if (url.includes("/boe")) entry = plan.boe;

    if (!entry) {
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: "no mock for url" }),
      } as Response;
    }

    return {
      ok: entry.ok,
      status: entry.status ?? (entry.ok ? 200 : 500),
      json: async () => entry.body ?? null,
    } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderTab(
  props: Partial<React.ComponentProps<typeof OrderDashboardTab>> = {},
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <OrderDashboardTab
        orderId="o1"
        order={makeOrder()}
        timeline={TIMELINE_FIXTURE}
        role="ADMIN"
        {...props}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ── Card 1 — Order Summary ───────────────────────────────────────────────────

describe("OrderDashboardTab — Card 1: Order Summary", () => {
  it("renders order data from props (no fetch)", () => {
    setupFetch();
    renderTab();
    const card = screen.getByTestId("dashboard-card-summary");
    // Order #, client, factory, PO ref all visible from props.
    expect(within(card).getByText("AB-2026-0001")).toBeInTheDocument();
    expect(within(card).getByText("Acme Corp")).toBeInTheDocument();
    expect(within(card).getByText("Acme Test Factory")).toBeInTheDocument();
    expect(within(card).getByText("PO-12345")).toBeInTheDocument();
    expect(within(card).getByText("INR")).toBeInTheDocument();
  });

  it("renders DRAFT placeholder when order_number is null", () => {
    setupFetch();
    renderTab({ order: makeOrder({ order_number: null }) });
    expect(within(screen.getByTestId("dashboard-card-summary")).getByText("DRAFT")).toBeInTheDocument();
  });

  it("renders Not assigned when factory_name is null", () => {
    setupFetch();
    renderTab({ order: makeOrder({ factory_name: null }) });
    expect(
      within(screen.getByTestId("dashboard-card-summary")).getByText("Not assigned"),
    ).toBeInTheDocument();
  });
});

// ── Card 2 — Factory & Costs (D-004) ─────────────────────────────────────────

describe("OrderDashboardTab — Card 2: Factory & Costs (D-004)", () => {
  it("renders the financial card for FINANCE role", async () => {
    setupFetch({ factoryPayments: { ok: true, body: FACTORY_PAYMENTS_FIXTURE } });
    renderTab({ role: "FINANCE" });
    // Wait for the query to resolve and the data row to render. Using a
    // text matcher is the canonical way to wait for async data in
    // @testing-library + TanStack Query (DOM-presence checks are too eager).
    await waitFor(() => {
      const card = screen.getByTestId("dashboard-card-factory");
      expect(within(card).getByText(/₹3,00,000/)).toBeInTheDocument();
    });
    const card = screen.getByTestId("dashboard-card-factory");
    // Per spec: formatINR is used for currency amounts (not raw numbers).
    expect(within(card).getByText(/₹1,20,000/)).toBeInTheDocument();
    expect(within(card).getByText(/₹1,80,000/)).toBeInTheDocument();
    expect(within(card).getByText("1")).toBeInTheDocument(); // remittance count
  });

  it("renders the financial card for SUPER_ADMIN role", async () => {
    setupFetch({ factoryPayments: { ok: true, body: FACTORY_PAYMENTS_FIXTURE } });
    renderTab({ role: "SUPER_ADMIN" });
    await waitFor(() => {
      const card = screen.getByTestId("dashboard-card-factory");
      expect(within(card).getByText(/₹3,00,000/)).toBeInTheDocument();
    });
  });

  it("shows the D-004 placeholder for ADMIN role (not the financial data)", () => {
    setupFetch({ factoryPayments: { ok: true, body: FACTORY_PAYMENTS_FIXTURE } });
    renderTab({ role: "ADMIN" });
    const placeholder = screen.getByTestId("dashboard-card-factory-restricted");
    expect(placeholder).toBeInTheDocument();
    expect(within(placeholder).getByText(/restricted to finance role/i)).toBeInTheDocument();
    expect(within(placeholder).getByText(/D-004/i)).toBeInTheDocument();
    // The financial-data card must NOT render for ADMIN.
    expect(screen.queryByTestId("dashboard-card-factory")).toBeNull();
  });

  it("shows the D-004 placeholder for OPERATIONS role", () => {
    setupFetch();
    renderTab({ role: "OPERATIONS" });
    expect(
      screen.getByTestId("dashboard-card-factory-restricted"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-card-factory")).toBeNull();
  });

  it("shows the D-004 placeholder when role is undefined", () => {
    setupFetch();
    renderTab({ role: undefined });
    expect(
      screen.getByTestId("dashboard-card-factory-restricted"),
    ).toBeInTheDocument();
  });

  it("renders skeleton while factory-payments query is in flight", () => {
    setupFetch({ factoryPayments: { ok: true, body: new Promise(() => {}) } });
    renderTab({ role: "FINANCE" });
    const card = screen.getByTestId("dashboard-card-factory");
    expect(within(card).getByTestId("dashboard-card-skeleton")).toBeInTheDocument();
  });

  it("renders error + Retry on factory-payments fetch failure", async () => {
    setupFetch({ factoryPayments: { ok: false, status: 500 } });
    renderTab({ role: "FINANCE" });
    await waitFor(() => {
      const card = screen.getByTestId("dashboard-card-factory");
      expect(within(card).getByTestId("dashboard-card-error")).toBeInTheDocument();
    });
    const card = screen.getByTestId("dashboard-card-factory");
    expect(within(card).getByText(/retry/i)).toBeInTheDocument();
  });
});

// ── Card 3 — Client Payments ─────────────────────────────────────────────────

describe("OrderDashboardTab — Card 3: Client Payments", () => {
  it("renders payment summary using formatINR (not raw numbers)", async () => {
    setupFetch({ payments: { ok: true, body: PAYMENTS_FIXTURE } });
    renderTab();
    await waitFor(() => {
      const card = screen.getByTestId("dashboard-card-payments");
      // Per spec: formatINR used on amounts, not raw numbers.
      expect(within(card).getByText(/₹50,000/)).toBeInTheDocument();
      expect(within(card).getByText(/₹15,000/)).toBeInTheDocument();
      expect(within(card).getByText(/₹35,000/)).toBeInTheDocument();
    });
    const card = screen.getByTestId("dashboard-card-payments");
    expect(within(card).getByText("1")).toBeInTheDocument(); // payment count
    // Deep-link to payments tab is rendered.
    expect(
      within(card).getByTestId("dashboard-card-payments-deeplink"),
    ).toBeInTheDocument();
  });

  it("renders skeleton while payments query is in flight", () => {
    setupFetch({ payments: { ok: true, body: new Promise(() => {}) } });
    renderTab();
    const card = screen.getByTestId("dashboard-card-payments");
    expect(within(card).getByTestId("dashboard-card-skeleton")).toBeInTheDocument();
  });

  it("renders error + Retry on payments fetch failure", async () => {
    setupFetch({ payments: { ok: false, status: 500 } });
    renderTab();
    await waitFor(() => {
      const card = screen.getByTestId("dashboard-card-payments");
      expect(within(card).getByTestId("dashboard-card-error")).toBeInTheDocument();
    });
  });
});

// ── Card 4 — Shipment Status ─────────────────────────────────────────────────

describe("OrderDashboardTab — Card 4: Shipment Status", () => {
  it("renders shipment headline (container, phase, ETD, ETA)", async () => {
    setupFetch({ shipments: { ok: true, body: SHIPMENTS_POPULATED_FIXTURE } });
    renderTab();
    await waitFor(() => {
      const card = screen.getByTestId("dashboard-card-shipment");
      expect(within(card).getByText("ABCU1234567")).toBeInTheDocument();
      expect(within(card).getByText("BOOKED")).toBeInTheDocument();
    });
  });

  it("renders empty state when no shipments", async () => {
    setupFetch({ shipments: { ok: true, body: [] } });
    renderTab();
    await waitFor(() => {
      const card = screen.getByTestId("dashboard-card-shipment");
      expect(within(card).getByText(/no shipments yet/i)).toBeInTheDocument();
    });
  });

  it("renders skeleton while shipments query is in flight", () => {
    setupFetch({ shipments: { ok: true, body: new Promise(() => {}) } });
    renderTab();
    const card = screen.getByTestId("dashboard-card-shipment");
    expect(within(card).getByTestId("dashboard-card-skeleton")).toBeInTheDocument();
  });

  it("renders error + Retry on shipments fetch failure", async () => {
    setupFetch({ shipments: { ok: false, status: 500 } });
    renderTab();
    await waitFor(() => {
      const card = screen.getByTestId("dashboard-card-shipment");
      expect(within(card).getByTestId("dashboard-card-error")).toBeInTheDocument();
    });
  });
});

// ── Card 5 — Customs / BOE ───────────────────────────────────────────────────

describe("OrderDashboardTab — Card 5: Customs / BOE", () => {
  it("renders BOE detail when present", async () => {
    setupFetch({
      shipments: { ok: true, body: SHIPMENTS_POPULATED_FIXTURE },
      boe: { ok: true, body: BOE_POPULATED_FIXTURE },
    });
    renderTab();
    await waitFor(() => {
      const card = screen.getByTestId("dashboard-card-customs");
      expect(within(card).getByText("BE-2026-100")).toBeInTheDocument();
      expect(within(card).getByText(/₹2,89,718/)).toBeInTheDocument(); // total_duty formatINR
    });
  });

  it("renders empty state when BOE is null", async () => {
    setupFetch({
      shipments: { ok: true, body: SHIPMENTS_POPULATED_FIXTURE },
      boe: { ok: true, body: null },
    });
    renderTab();
    await waitFor(() => {
      const card = screen.getByTestId("dashboard-card-customs");
      expect(within(card).getByText(/no bill of entry yet/i)).toBeInTheDocument();
    });
  });

  it("renders empty state when there are no shipments to chain on", async () => {
    setupFetch({ shipments: { ok: true, body: [] } });
    renderTab();
    await waitFor(() => {
      const card = screen.getByTestId("dashboard-card-customs");
      // No shipments → cannot fetch BOE → show "No shipments yet".
      expect(within(card).getByText(/no shipments yet/i)).toBeInTheDocument();
    });
  });

  it("renders error + Retry when shipments fetch fails (chained)", async () => {
    setupFetch({ shipments: { ok: false, status: 500 } });
    renderTab();
    await waitFor(() => {
      const card = screen.getByTestId("dashboard-card-customs");
      expect(within(card).getByTestId("dashboard-card-error")).toBeInTheDocument();
    });
  });
});

// ── Card 6 — Stage Timeline mini-view ────────────────────────────────────────

describe("OrderDashboardTab — Card 6: Stage Timeline mini-view", () => {
  it("renders progress bar + stage count using the timeline prop", () => {
    setupFetch();
    renderTab({
      order: makeOrder({ stage_number: 5, stage_name: "Factory Ordered" }),
      timeline: {
        ...TIMELINE_FIXTURE,
        timeline: [
          { stage: 1, name: "Draft", status: "completed" },
          { stage: 2, name: "Pending PI", status: "completed" },
          { stage: 3, name: "PI Sent", status: "completed" },
          { stage: 4, name: "Advance Pending", status: "completed" },
          { stage: 5, name: "Factory Ordered", status: "current" },
          { stage: 6, name: "Production 60%", status: "pending" },
        ],
      },
    });
    const card = screen.getByTestId("dashboard-card-timeline");
    // 4 stages completed of 17 total.
    expect(within(card).getByText("4 / 17")).toBeInTheDocument();
    // Progress bar with width = 5/17 ≈ 29%
    const bar = within(card).getByTestId("dashboard-card-timeline-bar");
    expect(bar.getAttribute("aria-valuenow")).toBe("29");
  });

  it("does not render the bar's stage count when timeline is null", () => {
    setupFetch();
    renderTab({ timeline: null });
    const card = screen.getByTestId("dashboard-card-timeline");
    // Stages complete falls back to 0.
    expect(within(card).getByText("0 / 17")).toBeInTheDocument();
    expect(within(card).getByText(/timeline detail loading/i)).toBeInTheDocument();
  });
});
