import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar, HARVEST_NAV } from "@/components/shells/sidebar";

describe("Sidebar", () => {
  it("renders without crash", () => {
    render(<Sidebar />);
    expect(screen.getByRole("complementary")).toBeInTheDocument();
  });

  it("has aria-label 'Primary navigation'", () => {
    render(<Sidebar />);
    expect(screen.getByRole("complementary")).toHaveAttribute("aria-label", "Primary navigation");
  });

  it("renders all nav groups", () => {
    render(<Sidebar />);
    expect(screen.getByText("Operations")).toBeInTheDocument();
    expect(screen.getByText("Finance")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("renders Dashboard nav item", () => {
    render(<Sidebar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders all operations items", () => {
    render(<Sidebar />);
    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(screen.getByText("Products")).toBeInTheDocument();
    expect(screen.getByText("Clients")).toBeInTheDocument();
    expect(screen.getByText("Factories")).toBeInTheDocument();
    expect(screen.getByText("Transport")).toBeInTheDocument();
    expect(screen.getByText("After Sales")).toBeInTheDocument();
    expect(screen.getByText("Returns")).toBeInTheDocument();
    expect(screen.getByText("Warehouse")).toBeInTheDocument();
  });

  it("renders all finance items", () => {
    render(<Sidebar />);
    expect(screen.getByText("Receivables")).toBeInTheDocument();
    expect(screen.getByText("Client Ledger")).toBeInTheDocument();
    expect(screen.getByText("Factory Ledger")).toBeInTheDocument();
    expect(screen.getByText("Payments")).toBeInTheDocument();
  });

  it("marks active item with 'active' class", () => {
    render(<Sidebar active="orders" />);
    const btn = screen.getByRole("button", { name: "Orders" });
    expect(btn.className).toContain("active");
  });

  it("non-active items do not have 'active' class", () => {
    render(<Sidebar active="orders" />);
    const btn = screen.getByRole("button", { name: "Dashboard" });
    expect(btn.className).not.toContain("active");
  });

  it("calls onNavigate with item id on click", () => {
    const onNavigate = vi.fn();
    render(<Sidebar onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Orders" }));
    expect(onNavigate).toHaveBeenCalledWith("orders");
  });

  it("renders user name in footer", () => {
    render(<Sidebar user={{ name: "Sachin M.", roleLabel: "Super Admin" }} />);
    expect(screen.getByText("Sachin M.")).toBeInTheDocument();
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
  });

  it("renders search input in expanded mode", () => {
    render(<Sidebar compact={false} />);
    expect(screen.getByRole("textbox", { name: "Search" })).toBeInTheDocument();
  });

  it("hides search input in compact mode", () => {
    render(<Sidebar compact />);
    expect(screen.queryByRole("textbox", { name: "Search" })).toBeNull();
  });

  it("hides group labels in compact mode", () => {
    render(<Sidebar compact />);
    expect(screen.queryByText("Operations")).toBeNull();
  });

  it("renders badge for Returns item", () => {
    render(<Sidebar />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders promo slot when provided", () => {
    render(<Sidebar promoSlot={<div data-testid="promo">Promo</div>} />);
    expect(screen.getByTestId("promo")).toBeInTheDocument();
  });

  it("does not render promo slot in compact mode", () => {
    render(<Sidebar compact promoSlot={<div data-testid="promo">Promo</div>} />);
    expect(screen.queryByTestId("promo")).toBeNull();
  });

  it("HARVEST_NAV has 4 groups", () => {
    expect(HARVEST_NAV).toHaveLength(4);
  });

  it("HARVEST_NAV first group is Dashboard", () => {
    expect(HARVEST_NAV[0].items[0].id).toBe("dashboard");
  });

  it("HARVEST_NAV has Operations group with 8 items", () => {
    const ops = HARVEST_NAV.find(g => g.group === "Operations")!;
    expect(ops.items).toHaveLength(8);
  });

  it("HARVEST_NAV has Finance group with 4 items", () => {
    const fin = HARVEST_NAV.find(g => g.group === "Finance")!;
    expect(fin.items).toHaveLength(4);
  });

  it("HARVEST_NAV has System group with 3 items", () => {
    const sys = HARVEST_NAV.find(g => g.group === "System")!;
    expect(sys.items).toHaveLength(3);
  });
});
