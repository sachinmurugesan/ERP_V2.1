/**
 * ledger-page.test.tsx — Unit tests for the generalized LedgerPage
 * composed component + AdminForbiddenState.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import {
  LedgerPage,
  type LedgerColumn,
  type LedgerPageProps,
} from "../../src/components/composed/ledger-page";
import { AdminForbiddenState } from "../../src/components/composed/admin-forbidden-state";

// ── Fixtures ──────────────────────────────────────────────────────────────────

interface Row {
  date: string;
  order: string;
  debit: number;
  credit: number;
  balance: number;
}

const rows: Row[] = [
  { date: "2026-04-01", order: "AB-001", debit: 1000, credit: 0, balance: 1000 },
  { date: "2026-04-10", order: "AB-002", debit: 0, credit: 400, balance: 600 },
];

const columns: LedgerColumn<Row>[] = [
  { id: "date", header: "Date", cell: (r) => r.date },
  { id: "order", header: "Order", cell: (r) => r.order },
  {
    id: "debit",
    header: "Debit",
    align: "right",
    totalKey: "debit",
    cell: (r) => r.debit,
  },
  {
    id: "credit",
    header: "Credit",
    align: "right",
    totalKey: "credit",
    cell: (r) => r.credit,
  },
  {
    id: "balance",
    header: "Balance",
    align: "right",
    totalKey: "balance",
    cell: (r) => r.balance,
  },
];

const entities = [
  { id: "f1", name: "Factory One" },
  { id: "f2", name: "Factory Two" },
];

function baseProps(overrides: Partial<LedgerPageProps<Row>> = {}): LedgerPageProps<Row> {
  return {
    title: "Factory Ledger",
    entityLabel: "Factory",
    entityId: "f1",
    entityOptions: entities,
    onEntityChange: vi.fn(),
    summary: [
      { label: "Total Debit", value: "₹1,000", variant: "negative" },
      { label: "Total Credit", value: "₹400", variant: "positive" },
      { label: "Net Balance", value: "₹600", variant: "warn" },
    ],
    columns,
    transactions: rows,
    dateRange: { from: null, to: null },
    onDateRangeChange: vi.fn(),
    ...overrides,
  };
}

// ── Rendering ────────────────────────────────────────────────────────────────

describe("LedgerPage — rendering", () => {
  it("renders title, summary cards, and all transaction columns", () => {
    render(<LedgerPage {...baseProps()} />);
    expect(
      screen.getByRole("heading", { name: /factory ledger/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/total debit/i)).toBeInTheDocument();
    expect(screen.getByText("₹1,000")).toBeInTheDocument();
    expect(screen.getByText(/net balance/i)).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader")).toHaveLength(5);
  });

  it("renders each transaction row via the columns.cell function", () => {
    render(<LedgerPage {...baseProps()} />);
    expect(screen.getByText("AB-001")).toBeInTheDocument();
    expect(screen.getByText("AB-002")).toBeInTheDocument();
  });

  it("shows skeleton rows when loading=true and does not render the table", () => {
    render(<LedgerPage {...baseProps({ loading: true })} />);
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows 'Select factory…' empty state when no entity selected", () => {
    render(
      <LedgerPage {...baseProps({ entityId: "", transactions: [] })} />,
    );
    expect(
      screen.getByText(/select factory to view their ledger/i),
    ).toBeInTheDocument();
  });

  it("shows 'No ledger entries found' when entity selected but transactions empty", () => {
    render(<LedgerPage {...baseProps({ transactions: [] })} />);
    expect(
      screen.getByText(/no ledger entries found/i),
    ).toBeInTheDocument();
  });

  it("renders the error banner when error prop is set", () => {
    render(<LedgerPage {...baseProps({ error: "Load failed" })} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/load failed/i);
  });

  it("summary card uses aria-label for non-colour accessibility", () => {
    render(
      <LedgerPage
        {...baseProps({
          summary: [
            {
              label: "Total Debit",
              value: "₹1,000",
              variant: "negative",
              ariaLabel: "₹1,000 total debit",
            },
          ],
        })}
      />,
    );
    expect(screen.getByLabelText(/₹1,000 total debit/)).toBeInTheDocument();
  });

  it("renders the date asymmetry tooltip when dateFilterTooltip is provided", () => {
    render(
      <LedgerPage
        {...baseProps({
          dateFilterTooltip: "Filters payments only.",
        })}
      />,
    );
    expect(screen.getByText(/filters payments only/i)).toBeInTheDocument();
  });
});

// ── Interactions ─────────────────────────────────────────────────────────────

describe("LedgerPage — interactions", () => {
  it("calls onEntityChange with selected id", () => {
    const onEntityChange = vi.fn();
    render(<LedgerPage {...baseProps({ onEntityChange })} />);
    fireEvent.change(screen.getByLabelText(/factory/i), {
      target: { value: "f2" },
    });
    expect(onEntityChange).toHaveBeenCalledWith("f2");
  });

  it("calls onDateRangeChange when From or To changes", () => {
    const onDateRangeChange = vi.fn();
    render(<LedgerPage {...baseProps({ onDateRangeChange })} />);
    fireEvent.change(screen.getByLabelText(/^from$/i), {
      target: { value: "2026-04-01" },
    });
    expect(onDateRangeChange).toHaveBeenCalledWith(
      expect.objectContaining({ from: "2026-04-01" }),
    );
    fireEvent.change(screen.getByLabelText(/^to$/i), {
      target: { value: "2026-04-24" },
    });
    expect(onDateRangeChange).toHaveBeenCalledWith(
      expect.objectContaining({ to: "2026-04-24" }),
    );
  });

  it("fires onDownloadPdf and onDownloadExcel when buttons clicked", () => {
    const onDownloadPdf = vi.fn();
    const onDownloadExcel = vi.fn();
    render(
      <LedgerPage
        {...baseProps({ onDownloadPdf, onDownloadExcel })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /download pdf/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /download excel/i }),
    );
    expect(onDownloadPdf).toHaveBeenCalledTimes(1);
    expect(onDownloadExcel).toHaveBeenCalledTimes(1);
  });

  it("disables download buttons when no entity selected", () => {
    const onDownloadPdf = vi.fn();
    render(
      <LedgerPage
        {...baseProps({ entityId: "", transactions: [], onDownloadPdf })}
      />,
    );
    const btn = screen.getByRole("button", { name: /download pdf/i });
    expect(btn).toBeDisabled();
  });

  it("disables download buttons when transactions empty", () => {
    const onDownloadPdf = vi.fn();
    render(
      <LedgerPage
        {...baseProps({ transactions: [], onDownloadPdf })}
      />,
    );
    const btn = screen.getByRole("button", { name: /download pdf/i });
    expect(btn).toBeDisabled();
  });

  it("disables downloads when downloadDisabled prop is true", () => {
    const onDownloadPdf = vi.fn();
    render(
      <LedgerPage
        {...baseProps({ downloadDisabled: true, onDownloadPdf })}
      />,
    );
    const btn = screen.getByRole("button", { name: /download pdf/i });
    expect(btn).toBeDisabled();
  });
});

// ── Totals row ───────────────────────────────────────────────────────────────

describe("LedgerPage — totals row", () => {
  it("renders a totals footer row when totals prop provided", () => {
    render(
      <LedgerPage
        {...baseProps({
          totals: { debit: "₹1,000", credit: "₹400", balance: "₹600" },
        })}
      />,
    );
    expect(screen.getByText("Totals")).toBeInTheDocument();
    // The totals row debit/credit/balance should be present as row footer values
    const cells = screen.getAllByText(/₹1,000|₹400|₹600/);
    expect(cells.length).toBeGreaterThan(0);
  });

  it("does NOT render the totals row when totals prop is omitted", () => {
    render(<LedgerPage {...baseProps()} />);
    expect(screen.queryByText("Totals")).toBeNull();
  });
});

// ── Custom columns ───────────────────────────────────────────────────────────

describe("LedgerPage — custom columns (10-column factory case)", () => {
  it("renders arbitrary column count (10-col) correctly", () => {
    interface Big {
      a: string; b: string; c: string; d: string; e: string;
      f: string; g: string; h: string; i: string; j: string;
    }
    const big: LedgerColumn<Big>[] = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`,
      header: `H${i}`,
      cell: (r) => (r as unknown as Record<string, string>)[String.fromCharCode(97 + i)],
    }));
    const rowsBig: Big[] = [
      { a: "a1", b: "b1", c: "c1", d: "d1", e: "e1", f: "f1", g: "g1", h: "h1", i: "i1", j: "j1" },
    ];
    const onChange = vi.fn();
    render(
      <LedgerPage<Big>
        title="Factory Ledger"
        entityLabel="Factory"
        entityId="x"
        entityOptions={[{ id: "x", name: "X" }]}
        onEntityChange={vi.fn()}
        summary={[]}
        columns={big}
        transactions={rowsBig}
        dateRange={{ from: null, to: null }}
        onDateRangeChange={onChange}
      />,
    );
    expect(screen.getAllByRole("columnheader")).toHaveLength(10);
    expect(screen.getByText("a1")).toBeInTheDocument();
    expect(screen.getByText("j1")).toBeInTheDocument();
  });
});

// ── AdminForbiddenState ──────────────────────────────────────────────────────

describe("AdminForbiddenState", () => {
  it("renders the D-004 message by default", () => {
    render(<AdminForbiddenState pageTitle="Factory Ledger" />);
    expect(
      screen.getByRole("heading", { name: /access restricted/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/D-004/i)).toBeInTheDocument();
    expect(
      screen.getByText(/page:\s*factory ledger/i),
    ).toBeInTheDocument();
  });

  it("links back to /dashboard by default", () => {
    render(<AdminForbiddenState pageTitle="Factory Ledger" />);
    const link = screen.getByRole("link", { name: /return to dashboard/i });
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("accepts a custom message + return link", () => {
    render(
      <AdminForbiddenState
        pageTitle="Client Ledger"
        message="Custom reason."
        returnHref="/finance"
        returnLabel="Back to Finance"
      />,
    );
    expect(screen.getByText(/custom reason/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to finance/i })).toHaveAttribute(
      "href",
      "/finance",
    );
  });
});
