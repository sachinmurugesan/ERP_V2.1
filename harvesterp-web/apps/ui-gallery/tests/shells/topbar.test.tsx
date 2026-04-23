import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Topbar } from "@/components/shells/topbar";

describe("Topbar", () => {
  it("renders without crash", () => {
    render(<Topbar />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("has aria-label 'Application header'", () => {
    render(<Topbar />);
    expect(screen.getByRole("banner")).toHaveAttribute("aria-label", "Application header");
  });

  it("renders title", () => {
    render(<Topbar title="Dashboard" />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders subtitle", () => {
    render(<Topbar title="Dashboard" subtitle="Overview" />);
    expect(screen.getByText("Overview")).toBeInTheDocument();
  });

  it("renders breadcrumbs", () => {
    render(<Topbar breadcrumbs={[{ label: "Finance" }, { label: "Receivables" }]} />);
    expect(screen.getByText("Finance")).toBeInTheDocument();
    expect(screen.getByText("Receivables")).toBeInTheDocument();
  });

  it("has breadcrumb nav aria-label", () => {
    render(<Topbar breadcrumbs={[{ label: "Finance" }]} />);
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
  });

  it("renders INR currency button selected by default", () => {
    render(<Topbar currency="INR" onCurrencyChange={vi.fn()} />);
    const inrBtn = screen.getByRole("button", { name: "INR" });
    expect(inrBtn).toBeInTheDocument();
    expect(inrBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("renders USD and CNY currency buttons", () => {
    render(<Topbar currency="INR" onCurrencyChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "USD" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CNY" })).toBeInTheDocument();
  });

  it("calls onCurrencyChange with 'USD' when clicked", () => {
    const onCurrencyChange = vi.fn();
    render(<Topbar currency="INR" onCurrencyChange={onCurrencyChange} />);
    fireEvent.click(screen.getByRole("button", { name: "USD" }));
    expect(onCurrencyChange).toHaveBeenCalledWith("USD");
  });

  it("calls onCurrencyChange with 'CNY' when clicked", () => {
    const onCurrencyChange = vi.fn();
    render(<Topbar currency="INR" onCurrencyChange={onCurrencyChange} />);
    fireEvent.click(screen.getByRole("button", { name: "CNY" }));
    expect(onCurrencyChange).toHaveBeenCalledWith("CNY");
  });

  it("does not render currency switcher when onCurrencyChange not provided", () => {
    render(<Topbar />);
    expect(screen.queryByRole("button", { name: "INR" })).toBeNull();
  });

  it("renders theme toggle button when onToggleTheme provided", () => {
    render(<Topbar theme="light" onToggleTheme={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();
  });

  it("renders sun icon label when theme=dark", () => {
    render(<Topbar theme="dark" onToggleTheme={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
  });

  it("calls onToggleTheme when theme toggle clicked", () => {
    const onToggleTheme = vi.fn();
    render(<Topbar theme="light" onToggleTheme={onToggleTheme} />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it("renders notification bell button", () => {
    render(<Topbar />);
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
  });

  it("bell aria-label shows count when notificationCount > 0", () => {
    render(<Topbar notificationCount={4} />);
    expect(screen.getByRole("button", { name: "4 notifications" })).toBeInTheDocument();
  });

  it("calls onNotificationsClick when bell clicked", () => {
    const onNotificationsClick = vi.fn();
    render(<Topbar onNotificationsClick={onNotificationsClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(onNotificationsClick).toHaveBeenCalledTimes(1);
  });

  it("renders right slot", () => {
    render(<Topbar right={<button data-testid="action">Action</button>} />);
    expect(screen.getByTestId("action")).toBeInTheDocument();
  });

  it("renders notification dot when count > 0", () => {
    const { container } = render(<Topbar notificationCount={3} />);
    // aria-hidden dot span
    const dot = container.querySelector("[aria-hidden='true'][style*='border-radius']");
    expect(dot).not.toBeNull();
  });
});
