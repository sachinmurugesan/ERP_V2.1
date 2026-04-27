/**
 * orders-landed-cost-tab.test.tsx — Component tests for OrderLandedCostTab.
 *
 * Mocks `fetch` per-test with a single dispatcher keyed on URL +
 * method. Fixtures mirror the live R-19 shapes from the proxy test file
 * (orders-landed-cost-proxy.test.ts) — same envelope, same field names.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { OrderLandedCostTab } from "../../src/app/(app)/orders/[id]/_components/tabs/order-landed-cost-tab";
import type { OrderDetail } from "../../src/app/(app)/orders/[id]/_components/types";
import type { LandedCostResponse } from "../../src/app/api/orders/[id]/landed-cost/route";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/orders/o1",
  useSearchParams: () => new URLSearchParams(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeOrder(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: "o1",
    order_number: "AB-2026-0001",
    client_id: "c1",
    factory_id: "f1",
    status: "DELIVERED",
    currency: "INR",
    exchange_rate: 12.5,
    exchange_rate_date: null,
    po_reference: "PO-1",
    notes: null,
    reopen_count: 0,
    last_reopen_reason: null,
    igst_credit_amount: 0,
    igst_credit_claimed: false,
    completed_at: null,
    created_at: "2026-04-26T10:00:00",
    updated_at: null,
    client_name: "Acme Corp",
    factory_name: "Changzhou",
    item_count: 5,
    total_value_cny: 25_000,
    stage_number: 11,
    stage_name: "Cleared",
    highest_unlocked_stage: 11,
    pi_stale: false,
    version: 1,
    client_reference: null,
    client_type: "TRANSPARENCY",
    query_counts: { total: 0, open: 0, replied: 0 },
    ...overrides,
  };
}

function makeLandedCost(
  overrides: Partial<LandedCostResponse> = {},
): LandedCostResponse {
  return {
    order_id: "o1",
    order_number: "AB-2026-0001",
    client_name: "Acme Corp",
    exchange_rate: 12.5,
    currency: "CNY",
    invoice: { label: "Invoice @12.50", amount_inr: 1_250_000 },
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
        product_name: "Tyre 4x16 widget",
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
    ...overrides,
  };
}

interface FetchPlan {
  data?: LandedCostResponse | null;
  status?: number;
  detail?: string;
  blobOk?: boolean;
  blobStatus?: number;
}

function mockFetch(plan: FetchPlan) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/landed-cost/download")) {
        return {
          ok: plan.blobOk ?? true,
          status: plan.blobStatus ?? 200,
          headers: new Headers({
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition":
              'attachment; filename="LandedCost_AB-2026-0001.xlsx"',
          }),
          blob: async () => new Blob(["xlsx-bytes"], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
          json: async () => ({ error: "download failed" }),
        } as unknown as Response;
      }
      if (url.includes("/landed-cost") && (init?.method ?? "GET") === "GET") {
        if (plan.status && plan.status !== 200) {
          return {
            ok: false,
            status: plan.status,
            json: async () => ({
              error: plan.detail ?? "Failed",
              detail: plan.detail ?? "Failed",
            }),
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => plan.data ?? null,
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as unknown as Response;
    }),
  );
}

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.restoreAllMocks();
  // jsdom doesn't implement URL.createObjectURL — useBlobDownload calls
  // it during anchor.click. Stub both ends.
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn(() => "blob:fake"),
    revokeObjectURL: vi.fn(),
  });
});

// ── Loading / error / empty ──────────────────────────────────────────────────

describe("OrderLandedCostTab — loading + error + empty", () => {
  it("shows the skeleton while data is pending", () => {
    mockFetch({ data: makeLandedCost() });
    renderWithQuery(
      <OrderLandedCostTab orderId="o1" order={makeOrder()} />,
    );
    expect(screen.getByTestId("landed-cost-skeleton")).toBeInTheDocument();
  });

  it("shows the backend's 400 detail message verbatim (stage-not-cleared)", async () => {
    mockFetch({
      status: 400,
      detail:
        "Landed cost is available after customs clearance. Current stage: Draft (stage 1)",
    });
    renderWithQuery(
      <OrderLandedCostTab orderId="o1" order={makeOrder()} />,
    );
    const error = await screen.findByTestId("landed-cost-error");
    expect(error).toHaveTextContent(/customs clearance/i);
    expect(error).toHaveTextContent(/Current stage: Draft/i);
  });

  it("shows a friendly error for 404 (REGULAR client / feature flag off)", async () => {
    // The proxy rewrites the upstream {detail:"Not found"} to a
    // user-facing {error:"Landed cost not available for this order."},
    // so the component should render that proxy-shaped message.
    mockFetch({
      status: 404,
      detail: "Landed cost not available for this order.",
    });
    renderWithQuery(
      <OrderLandedCostTab orderId="o1" order={makeOrder()} />,
    );
    const error = await screen.findByTestId("landed-cost-error");
    expect(error).toHaveTextContent(/not available/i);
  });

  it("shows the soft-empty card when data resolves to null", async () => {
    mockFetch({ data: null });
    renderWithQuery(
      <OrderLandedCostTab orderId="o1" order={makeOrder()} />,
    );
    const empty = await screen.findByTestId("landed-cost-empty");
    expect(empty).toHaveTextContent(/no landed cost data yet/i);
  });
});

// ── Header ──────────────────────────────────────────────────────────────────

describe("OrderLandedCostTab — header", () => {
  it("renders title + subtitle (order_number · client_name)", async () => {
    mockFetch({ data: makeLandedCost() });
    renderWithQuery(
      <OrderLandedCostTab orderId="o1" order={makeOrder()} />,
    );
    await waitFor(() => {
      expect(screen.getByTestId("landed-cost-tab")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("heading", { name: /landed cost breakdown/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("landed-cost-subtitle")).toHaveTextContent(
      "AB-2026-0001",
    );
    expect(screen.getByTestId("landed-cost-subtitle")).toHaveTextContent(
      "Acme Corp",
    );
  });

  it("renders Download Excel button by default", async () => {
    mockFetch({ data: makeLandedCost() });
    renderWithQuery(
      <OrderLandedCostTab orderId="o1" order={makeOrder()} />,
    );
    expect(
      await screen.findByRole("button", { name: /download excel/i }),
    ).toBeInTheDocument();
  });
});

// ── KPI cards ───────────────────────────────────────────────────────────────

describe("OrderLandedCostTab — KPI cards", () => {
  it("renders the 4 KPI cards (Invoice / Total Expenses / Expense % / Grand Total)", async () => {
    mockFetch({ data: makeLandedCost() });
    renderWithQuery(
      <OrderLandedCostTab orderId="o1" order={makeOrder()} />,
    );
    await screen.findByTestId("landed-cost-kpis");
    const kpis = screen.getByTestId("landed-cost-kpis");
    expect(within(kpis).getByText(/^Invoice$/)).toBeInTheDocument();
    expect(within(kpis).getByText(/^Total Expenses$/)).toBeInTheDocument();
    expect(within(kpis).getByText(/^Expense %$/)).toBeInTheDocument();
    expect(within(kpis).getByText(/^Grand Total$/)).toBeInTheDocument();
  });

  it("formats Invoice as a lakh value (₹12.50L)", async () => {
    mockFetch({ data: makeLandedCost() });
    renderWithQuery(
      <OrderLandedCostTab orderId="o1" order={makeOrder()} />,
    );
    const kpiInvoice = await screen.findByTestId("landed-cost-kpi-invoice");
    expect(kpiInvoice).toHaveTextContent("₹12.50L");
  });

  it("formats Expense % with 2 decimal places", async () => {
    mockFetch({ data: makeLandedCost() });
    renderWithQuery(
      <OrderLandedCostTab orderId="o1" order={makeOrder()} />,
    );
    const kpiPct = await screen.findByTestId("landed-cost-kpi-expense-pct");
    // Vue: `(data.summary?.expense_percent || 0).toFixed(2) + '%'` → "28.24%"
    expect(kpiPct).toHaveTextContent("28.24%");
  });

  it("formatLakh shows thousands suffix when < 1L (₹50.0K)", async () => {
    mockFetch({
      data: makeLandedCost({
        summary: {
          total_bill_inr: 50_000,
          total_expenses_inr: 12_000,
          grand_total_inr: 62_000,
          expense_percent: 24,
        },
      }),
    });
    renderWithQuery(
      <OrderLandedCostTab orderId="o1" order={makeOrder()} />,
    );
    const kpiInvoice = await screen.findByTestId("landed-cost-kpi-invoice");
    expect(kpiInvoice).toHaveTextContent("₹50.0K");
  });

  it("formatLakh renders em-dash for zero / null amounts", async () => {
    mockFetch({
      data: makeLandedCost({
        summary: {
          total_bill_inr: 0,
          total_expenses_inr: 0,
          grand_total_inr: 0,
          expense_percent: 0,
        },
      }),
    });
    renderWithQuery(
      <OrderLandedCostTab orderId="o1" order={makeOrder()} />,
    );
    const kpiInvoice = await screen.findByTestId("landed-cost-kpi-invoice");
    expect(kpiInvoice).toHaveTextContent("—");
  });
});

// ── Expense breakdown table ─────────────────────────────────────────────────

describe("OrderLandedCostTab — expense table", () => {
  it("renders the invoice row with backend label (e.g. 'Invoice @12.50')", async () => {
    mockFetch({ data: makeLandedCost() });
    renderWithQuery(
      <OrderLandedCostTab orderId="o1" order={makeOrder()} />,
    );
    const table = await screen.findByTestId("landed-cost-expense-table");
    expect(within(table).getByText(/Invoice @12\.50/)).toBeInTheDocument();
  });

  it("renders all 6 fixed expense rows in source order", async () => {
    mockFetch({ data: makeLandedCost() });
    renderWithQuery(
      <OrderLandedCostTab orderId="o1" order={makeOrder()} />,
    );
    const table = await screen.findByTestId("landed-cost-expense-table");
    expect(within(table).getByText("Freight + THC")).toBeInTheDocument();
    expect(within(table).getByText("Clearance + CFS")).toBeInTheDocument();
    expect(within(table).getByText("Sourcing Charge (3.0%)")).toBeInTheDocument();
    expect(within(table).getByText("Duty + IGST")).toBeInTheDocument();
    expect(within(table).getByText("Transport")).toBeInTheDocument();
    expect(within(table).getByText("Miscellaneous")).toBeInTheDocument();
  });

  it("renders the 3-row tfoot (Total Bill / Total Expenses / Grand Total) with formatINR amounts", async () => {
    mockFetch({ data: makeLandedCost() });
    renderWithQuery(
      <OrderLandedCostTab orderId="o1" order={makeOrder()} />,
    );
    await screen.findByTestId("landed-cost-expense-table");
    const tfoot = screen.getByTestId("landed-cost-expense-tfoot");
    expect(within(tfoot).getByText(/Total Bill/i)).toBeInTheDocument();
    expect(within(tfoot).getByText(/Total Expenses/i)).toBeInTheDocument();
    expect(within(tfoot).getByText(/Grand Total/i)).toBeInTheDocument();
    // Grand Total amount uses formatINR — full ₹X,XX,XXX.XX (Indian
    // grouping). We assert the rupee glyph + a digit subset rather than
    // the exact string because Intl formatting can vary per Node ICU.
    expect(within(tfoot).getByTestId("landed-cost-grand-total-amount").textContent ?? "").toMatch(
      /₹.*1.*6.*0.*3/,
    );
  });
});

// ── Per-item table ──────────────────────────────────────────────────────────

describe("OrderLandedCostTab — per-item table", () => {
  it("renders the per-item table when items.length > 0", async () => {
    mockFetch({ data: makeLandedCost() });
    renderWithQuery(
      <OrderLandedCostTab orderId="o1" order={makeOrder()} />,
    );
    const itemsTable = await screen.findByTestId("landed-cost-items-table");
    expect(within(itemsTable).getByText("AB-001")).toBeInTheDocument();
    expect(within(itemsTable).getByText("Tyre 4x16 widget")).toBeInTheDocument();
  });

  it("hides the per-item table when items is empty", async () => {
    mockFetch({ data: makeLandedCost({ items: [] }) });
    renderWithQuery(
      <OrderLandedCostTab orderId="o1" order={makeOrder()} />,
    );
    await screen.findByTestId("landed-cost-tab");
    expect(screen.queryByTestId("landed-cost-items-table")).toBeNull();
  });

  it("renders 10 columns in the per-item table header (matches Vue layout)", async () => {
    mockFetch({ data: makeLandedCost() });
    renderWithQuery(
      <OrderLandedCostTab orderId="o1" order={makeOrder()} />,
    );
    const itemsTable = await screen.findByTestId("landed-cost-items-table");
    // 10 columns: # / Product / Qty / Value / Freight / Duty / Clearance /
    // Commission / Landed Cost / Per Unit
    const headers = within(itemsTable).getAllByRole("columnheader");
    expect(headers.length).toBe(10);
  });
});

// ── Excel download ──────────────────────────────────────────────────────────

describe("OrderLandedCostTab — Excel download", () => {
  it("clicking Download Excel calls the download proxy URL via useBlobDownload", async () => {
    mockFetch({ data: makeLandedCost() });
    renderWithQuery(
      <OrderLandedCostTab orderId="o1" order={makeOrder()} />,
    );
    const btn = await screen.findByRole("button", { name: /download excel/i });
    fireEvent.click(btn);

    await waitFor(() => {
      const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
      const calls = fetchMock.mock.calls.map((c: unknown[]) => c[0]);
      expect(
        calls.some(
          (url: unknown) =>
            typeof url === "string" &&
            url.includes("/api/orders/o1/landed-cost/download"),
        ),
      ).toBe(true);
    });
  });

  it("surfaces a download error via the inline alert", async () => {
    mockFetch({ data: makeLandedCost(), blobOk: false, blobStatus: 403 });
    renderWithQuery(
      <OrderLandedCostTab orderId="o1" order={makeOrder()} />,
    );
    const btn = await screen.findByRole("button", { name: /download excel/i });
    fireEvent.click(btn);
    await screen.findByTestId("landed-cost-download-error");
  });
});
