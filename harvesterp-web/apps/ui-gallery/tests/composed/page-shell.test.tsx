import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PageShell } from "@/components/composed/page-shell";

describe("PageShell", () => {
  it("renders without crash", () => {
    render(
      <PageShell title="Orders">
        <p>Content</p>
      </PageShell>,
    );
    expect(screen.getByText("Orders")).toBeInTheDocument();
  });

  it("renders title as h1 heading", () => {
    render(
      <PageShell title="Dashboard">
        <p>Content</p>
      </PageShell>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Dashboard");
  });

  it("renders children in content area", () => {
    render(
      <PageShell title="Settings">
        <span>Settings content</span>
      </PageShell>,
    );
    expect(screen.getByText("Settings content")).toBeInTheDocument();
  });

  it("renders breadcrumbs when provided", () => {
    render(
      <PageShell
        title="Order Detail"
        breadcrumbs={[
          { label: "Orders", href: "/orders" },
          { label: "ORD-001" },
        ]}
      >
        <p>Content</p>
      </PageShell>,
    );
    expect(screen.getByRole("navigation", { name: /breadcrumb/i })).toBeInTheDocument();
    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(screen.getByText("ORD-001")).toBeInTheDocument();
  });

  it("does not render breadcrumb nav when breadcrumbs omitted", () => {
    render(
      <PageShell title="Orders">
        <p>Content</p>
      </PageShell>,
    );
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("renders actions slot", () => {
    render(
      <PageShell
        title="Settings"
        actions={<button type="button">Save</button>}
      >
        <p>Content</p>
      </PageShell>,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("calls onNavigate with href when breadcrumb link clicked", async () => {
    const onNavigate = vi.fn();
    render(
      <PageShell
        title="Order Detail"
        breadcrumbs={[{ label: "Orders", href: "/orders" }, { label: "Detail" }]}
        onNavigate={onNavigate}
      >
        <p>Content</p>
      </PageShell>,
    );
    await userEvent.click(screen.getByText("Orders"));
    expect(onNavigate).toHaveBeenCalledWith("/orders");
  });

  it("current page breadcrumb has aria-current=page", () => {
    render(
      <PageShell
        title="Order Detail"
        breadcrumbs={[
          { label: "Orders", href: "/orders" },
          { label: "ORD-001" },
        ]}
      >
        <p>Content</p>
      </PageShell>,
    );
    expect(screen.getByText("ORD-001")).toHaveAttribute("aria-current", "page");
  });
});
