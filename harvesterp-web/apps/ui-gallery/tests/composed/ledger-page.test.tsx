import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LedgerPage, type LedgerPageProps } from "@/components/composed/ledger-page";

const BASE_PROPS: LedgerPageProps = {
  title: { en: "Client Ledger" },
  entityType: "client",
  entityId: "c1",
  entityOptions: [
    { id: "c1", name: "Acme Corp" },
    { id: "c2", name: "Beta Ltd" },
  ],
  onEntityChange: vi.fn(),
  summary: [
    { label: "Total Invoiced", value: "₹6,00,000" },
    { label: "Outstanding", value: "₹0", variant: "positive" },
  ],
  transactions: [
    {
      date: "2026-03-01",
      description: "Invoice #INV-001",
      debit: 420000,
      runningBalance: -420000,
    },
  ],
};

describe("LedgerPage", () => {
  it("renders without crash", () => {
    render(<LedgerPage {...BASE_PROPS} />);
    expect(screen.getByText("Client Ledger")).toBeInTheDocument();
  });

  it("shows the entity type label", () => {
    render(<LedgerPage {...BASE_PROPS} />);
    expect(screen.getByText("Client")).toBeInTheDocument();
  });

  it("renders summary card labels", () => {
    render(<LedgerPage {...BASE_PROPS} />);
    expect(screen.getByText("Total Invoiced")).toBeInTheDocument();
    expect(screen.getByText("Outstanding")).toBeInTheDocument();
  });

  it("renders transaction rows", () => {
    render(<LedgerPage {...BASE_PROPS} />);
    expect(screen.getByText("Invoice #INV-001")).toBeInTheDocument();
  });

  it("shows skeleton loading state", () => {
    const { container } = render(<LedgerPage {...BASE_PROPS} loading />);
    // Skeleton elements have animate-pulse class
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state when empty=true", () => {
    render(<LedgerPage {...BASE_PROPS} empty transactions={[]} />);
    expect(screen.getByText(/no transactions/i)).toBeInTheDocument();
  });

  it("renders download buttons when handlers provided", () => {
    render(
      <LedgerPage
        {...BASE_PROPS}
        onDownloadPdf={vi.fn()}
        onDownloadExcel={vi.fn()}
      />,
    );
    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.getByText("Excel")).toBeInTheDocument();
  });

  it("does not render download buttons when handlers absent", () => {
    render(<LedgerPage {...BASE_PROPS} />);
    expect(screen.queryByText("PDF")).not.toBeInTheDocument();
  });

  it("calls onDownloadPdf when PDF button clicked", async () => {
    const onDownloadPdf = vi.fn();
    render(<LedgerPage {...BASE_PROPS} onDownloadPdf={onDownloadPdf} />);
    await userEvent.click(screen.getByText("PDF"));
    expect(onDownloadPdf).toHaveBeenCalledTimes(1);
  });
});
