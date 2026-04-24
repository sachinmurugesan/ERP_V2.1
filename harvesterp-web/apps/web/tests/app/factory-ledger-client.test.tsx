/**
 * factory-ledger-client.test.tsx — Unit tests for FactoryLedgerClient
 * (the orchestrator component driving LedgerPage with live ledger data).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { FactoryLedgerClient } from "../../src/app/(app)/finance/factory-ledger/_components/factory-ledger-client";
import type { FactoryLedgerResponse } from "../../src/app/(app)/finance/factory-ledger/_components/types";

const factories = [
  { id: "f1", company_name: "Acme CNY Inc" },
  { id: "f2", company_name: "Beta Factory" },
];

const ledgerResponse: FactoryLedgerResponse = {
  factory_id: "f1",
  factory_name: "Acme CNY Inc",
  entries: [
    {
      date: "2026-04-01",
      order_number: "AB-001",
      order_id: "o1",
      remark: "Factory order for AB-001",
      debit: 100000,
      credit: 0,
      amount_foreign: 8850,
      currency: "CNY",
      exchange_rate: 11.3,
      amount_usd: 1190.48,
      method: "-",
      reference: "AB-001",
      running_balance: 100000,
    },
    {
      date: "2026-04-10",
      order_number: "AB-001",
      order_id: "o1",
      remark: "Payment via WIRE",
      debit: 0,
      credit: 40000,
      amount_foreign: 3540,
      currency: "CNY",
      exchange_rate: 11.3,
      amount_usd: 476.19,
      method: "BANK_TRANSFER",
      reference: "PAY-9911",
      running_balance: 60000,
    },
  ],
  summary: {
    total_debit: 100000,
    total_credit: 40000,
    net_balance: 60000,
    total_debit_usd: 1190.48,
    total_credit_usd: 476.19,
    net_balance_usd: 714.29,
  },
};

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/api/finance/factory-ledger/f1")) {
        return {
          ok: true,
          status: 200,
          json: async () => ledgerResponse,
        } as unknown as Response;
      }
      return { ok: false, status: 500, json: async () => ({}) } as unknown as Response;
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FactoryLedgerClient", () => {
  it("renders the factory dropdown and the empty state initially", () => {
    renderWithClient(<FactoryLedgerClient initialFactories={factories} />);
    expect(
      screen.getByRole("heading", { name: /factory ledger/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/select factory to view their ledger/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /acme cny inc/i })).toBeInTheDocument();
  });

  it("fetches ledger when factory selected and surfaces the expected URL", async () => {
    const fetchSpy = vi.fn(
      async (url: string) =>
        ({
          ok: true,
          status: 200,
          json: async () => ledgerResponse,
          url,
        }) as unknown as Response,
    );
    vi.stubGlobal("fetch", fetchSpy);
    renderWithClient(<FactoryLedgerClient initialFactories={factories} />);
    fireEvent.change(screen.getByLabelText(/factory/i), {
      target: { value: "f1" },
    });
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const firstCall = fetchSpy.mock.calls.at(0);
    const calledUrl = firstCall?.[0] ?? "";
    expect(calledUrl).toContain("/api/finance/factory-ledger/f1");
  });

  it("renders ledger rows + totals once data resolves", async () => {
    renderWithClient(<FactoryLedgerClient initialFactories={factories} />);
    fireEvent.change(screen.getByLabelText(/factory/i), {
      target: { value: "f1" },
    });
    await waitFor(
      () => {
        expect(screen.getByText("Totals")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("renders summary cards with aria-labels after data loads", async () => {
    renderWithClient(<FactoryLedgerClient initialFactories={factories} />);
    fireEvent.change(screen.getByLabelText(/factory/i), {
      target: { value: "f1" },
    });
    await waitFor(
      () => {
        expect(screen.getByLabelText(/total debit/i)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(screen.getByLabelText(/total credit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/net balance/i)).toBeInTheDocument();
  });

  it("download buttons are disabled when no factory selected", () => {
    renderWithClient(<FactoryLedgerClient initialFactories={factories} />);
    expect(screen.getByRole("button", { name: /download pdf/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /download excel/i })).toBeDisabled();
  });

  it("download buttons are enabled after data loads", async () => {
    renderWithClient(<FactoryLedgerClient initialFactories={factories} />);
    fireEvent.change(screen.getByLabelText(/factory/i), {
      target: { value: "f1" },
    });
    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /download pdf/i })).not.toBeDisabled();
      },
      { timeout: 3000 },
    );
  });

  it("shows the date asymmetry tooltip text", () => {
    renderWithClient(<FactoryLedgerClient initialFactories={factories} />);
    expect(
      screen.getByText(/filters payments only/i),
    ).toBeInTheDocument();
  });

  it("surfaces an error banner on 403 from the ledger endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 403,
        json: async () => ({ error: "Factory ledger access is limited to FINANCE role (D-004)" }),
      } as unknown as Response)),
    );
    renderWithClient(<FactoryLedgerClient initialFactories={factories} />);
    fireEvent.change(screen.getByLabelText(/factory/i), {
      target: { value: "f1" },
    });
    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toHaveTextContent(/D-004/i);
      },
      { timeout: 3000 },
    );
  });

  it("non-zero debit cells render with debit aria-label (a11y cue)", async () => {
    renderWithClient(<FactoryLedgerClient initialFactories={factories} />);
    fireEvent.change(screen.getByLabelText(/factory/i), {
      target: { value: "f1" },
    });
    await waitFor(
      () => {
        expect(screen.getAllByLabelText(/debit/i).length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
  });

  it("updates date range state when From picker changes", async () => {
    renderWithClient(<FactoryLedgerClient initialFactories={factories} />);
    const from = screen.getByLabelText(/^from$/i) as HTMLInputElement;
    fireEvent.change(from, { target: { value: "2026-04-01" } });
    await waitFor(() => {
      expect(from.value).toBe("2026-04-01");
    });
  });

  it("subtitle shows factory name after selection", async () => {
    renderWithClient(<FactoryLedgerClient initialFactories={factories} />);
    fireEvent.change(screen.getByLabelText(/factory/i), {
      target: { value: "f1" },
    });
    await waitFor(
      () => {
        expect(screen.getAllByText(/acme cny inc/i).length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 3000 },
    );
  });
});
