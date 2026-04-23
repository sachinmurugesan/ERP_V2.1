import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComposedGallery } from "@/gallery/pages/ComposedGallery";

// ComposedGallery is a static aggregator page — all 5 composed components
// render in their initial/default states without needing user interaction.

describe("ComposedGallery", () => {
  it("renders without crash", () => {
    const { container } = render(<ComposedGallery />);
    expect(container.firstChild).not.toBeNull();
  });

  it('shows ConfirmDialog section heading', () => {
    render(<ComposedGallery />);
    expect(screen.getByText(/ConfirmDialog \(D-003\)/)).toBeInTheDocument();
  });

  it('shows LedgerPage section heading', () => {
    render(<ComposedGallery />);
    expect(screen.getByText(/LedgerPage \(P-017\)/)).toBeInTheDocument();
  });

  it('shows HighlightScrollTarget section heading', () => {
    render(<ComposedGallery />);
    expect(screen.getByText(/HighlightScrollTarget \(P-022\)/)).toBeInTheDocument();
  });

  it('shows CarryForwardStepper section heading', () => {
    render(<ComposedGallery />);
    expect(screen.getByText(/CarryForwardStepper \(P-005\)/)).toBeInTheDocument();
  });

  it('shows RoleGate section heading', () => {
    render(<ComposedGallery />);
    expect(screen.getByText(/RoleGate \(D-004\/D-009\/D-010\)/)).toBeInTheDocument();
  });

  it('renders all four ConfirmDialog trigger buttons', () => {
    render(<ComposedGallery />);
    expect(screen.getByRole("button", { name: "Basic confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Destructive delete" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "With context card" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Async loading" })).toBeInTheDocument();
  });

  it('ADMIN user sees "Access granted — order creation"', () => {
    render(<ComposedGallery />);
    // ADMIN has ORDER_CREATE → children render
    expect(
      screen.getByText("Access granted — order creation"),
    ).toBeInTheDocument();
  });

  it('CLIENT user sees "Access denied" fallback for ORDER_CREATE', () => {
    render(<ComposedGallery />);
    // CLIENT lacks ORDER_CREATE → fallback renders; there may be multiple "Access denied" nodes
    const denied = screen.getAllByText("Access denied");
    expect(denied.length).toBeGreaterThan(0);
  });

  it("CarryForwardStepper renders step lists with aria-label", () => {
    render(<ComposedGallery />);
    const stepLists = screen.getAllByRole("list", { name: "Progress steps" });
    // 3 stepper variants on the page
    expect(stepLists.length).toBe(3);
  });
});
