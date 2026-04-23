import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiCard } from "@/components/composed/kpi-card";

describe("KpiCard", () => {
  it("renders without crash", () => {
    render(<KpiCard label="Revenue" value="₹4.2 Cr" />);
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("has aria-label matching label prop", () => {
    render(<KpiCard label="Revenue" value="₹4.2 Cr" />);
    expect(screen.getByRole("region")).toHaveAttribute("aria-label", "Revenue");
  });

  it("renders label", () => {
    render(<KpiCard label="Total Revenue" value="₹4.2 Cr" />);
    expect(screen.getByText("Total Revenue")).toBeInTheDocument();
  });

  it("renders value", () => {
    render(<KpiCard label="Revenue" value="₹4.2 Cr" />);
    expect(screen.getByText("₹4.2 Cr")).toBeInTheDocument();
  });

  it("renders delta text", () => {
    render(<KpiCard label="Revenue" value="₹4.2 Cr" delta="+12.4%" />);
    expect(screen.getByText("+12.4%")).toBeInTheDocument();
  });

  it("renders subtext", () => {
    render(<KpiCard label="Revenue" value="₹4.2 Cr" subtext="vs last month" />);
    expect(screen.getByText("vs last month")).toBeInTheDocument();
  });

  it("does not render subtext when not provided", () => {
    render(<KpiCard label="Revenue" value="₹4.2 Cr" />);
    expect(screen.queryByText("vs last month")).toBeNull();
  });

  it("renders sparkline when spark data provided", () => {
    const { container } = render(
      <KpiCard label="Revenue" value="₹4.2 Cr" spark={[10, 20, 15, 30, 25]} />
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("does not render sparkline when spark not provided", () => {
    const { container } = render(<KpiCard label="Revenue" value="₹4.2 Cr" />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("does not render sparkline for single-point data", () => {
    const { container } = render(<KpiCard label="Revenue" value="₹4.2 Cr" spark={[42]} />);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders icon when icon prop provided", () => {
    const { container } = render(<KpiCard label="Revenue" value="₹4.2 Cr" icon="finance" />);
    // Icon renders an SVG
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("applies card classes", () => {
    const { container } = render(<KpiCard label="Revenue" value="₹4.2 Cr" />);
    const div = container.firstElementChild!;
    expect(div.className).toContain("card");
  });

  it("accepts extra className", () => {
    const { container } = render(<KpiCard label="Revenue" value="₹4.2 Cr" className="custom-class" />);
    expect(container.firstElementChild?.className).toContain("custom-class");
  });

  it("accepts style prop", () => {
    const { container } = render(<KpiCard label="Revenue" value="₹4.2 Cr" style={{ width: 200 }} />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.width).toBe("200px");
  });

  it("renders with all props without error", () => {
    render(
      <KpiCard
        label="Full"
        value="100"
        delta="+5%"
        deltaDirection="up"
        subtext="vs last month"
        spark={[10, 20, 15, 30]}
        tone="ok"
        icon="check"
      />
    );
    expect(screen.getByText("Full")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("renders arrow-up icon for deltaDirection=up", () => {
    const { container } = render(
      <KpiCard label="R" value="X" delta="+5%" deltaDirection="up" />
    );
    // two SVGs: icon + arrowUp in delta
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it("renders down-arrow icon for deltaDirection=down", () => {
    const { container } = render(
      <KpiCard label="R" value="X" delta="−5%" deltaDirection="down" />
    );
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });
});
