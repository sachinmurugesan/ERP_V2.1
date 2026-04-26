/**
 * page-shell.test.tsx — Unit tests for the lifted PageShell composed component.
 */

import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { PageShell } from "../../src/components/composed/page-shell";

describe("PageShell — title + content", () => {
  it("renders an h1 with the title", () => {
    render(<PageShell title="Orders">body</PageShell>);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Orders");
  });

  it("renders children below the title", () => {
    render(<PageShell title="Orders">body content</PageShell>);
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("does not render a breadcrumb when none provided", () => {
    render(<PageShell title="Orders">x</PageShell>);
    expect(screen.queryByRole("navigation", { name: /breadcrumb/i })).toBeNull();
  });

  it("does not render the actions slot when actions is undefined", () => {
    const { container } = render(<PageShell title="Orders">x</PageShell>);
    // The actions container has `flex shrink-0` — verify by absence of any
    // sibling div on the title row beyond the h1.
    const h1 = container.querySelector("h1");
    expect(h1?.nextElementSibling).toBeNull();
  });
});

describe("PageShell — breadcrumbs", () => {
  it("renders a Home link first, then provided crumbs", () => {
    render(
      <PageShell
        title="Order Detail"
        breadcrumbs={[
          { label: "Orders", href: "/orders" },
          { label: "Order #123" },
        ]}
      >
        body
      </PageShell>,
    );
    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(nav).toBeInTheDocument();
    // Home link present
    expect(within(nav).getByLabelText("Home")).toBeInTheDocument();
    // Intermediate crumb is a link
    expect(within(nav).getByRole("link", { name: "Orders" })).toHaveAttribute(
      "href",
      "/orders",
    );
    // Last crumb is plain text with aria-current="page"
    const last = within(nav).getByText("Order #123");
    expect(last.getAttribute("aria-current")).toBe("page");
  });

  it("the last crumb renders as text (no link) even when href is provided", () => {
    render(
      <PageShell
        title="Detail"
        breadcrumbs={[
          { label: "First", href: "/first" },
          { label: "Second", href: "/second" },
        ]}
      >
        body
      </PageShell>,
    );
    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    // "Second" should not be a link (it's the current page)
    expect(within(nav).queryByRole("link", { name: "Second" })).toBeNull();
    expect(within(nav).getByText("Second")).toBeInTheDocument();
  });
});

describe("PageShell — actions slot", () => {
  it("renders the actions node to the right of the title", () => {
    render(
      <PageShell title="Orders" actions={<button type="button">Add</button>}>
        body
      </PageShell>,
    );
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });
});
