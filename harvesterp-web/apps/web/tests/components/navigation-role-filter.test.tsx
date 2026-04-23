/**
 * navigation-role-filter.test.tsx — Unit tests for role-based nav filtering
 * in NavigationSidebar (shells/navigation-sidebar.tsx).
 *
 * Tests the filtering behaviour (which items are rendered for each role)
 * without mounting the full Next.js router. Mocks next/navigation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NavigationSidebar } from "../../src/components/shells/navigation-sidebar";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard",
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_USER = { name: "Test User", roleLabel: "Member" };

function renderSidebar(role?: string) {
  render(
    <NavigationSidebar
      user={TEST_USER}
      {...(role !== undefined ? { userRole: role } : {})}
    />,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("no role / unknown role", () => {
  it("shows all nav items when no userRole is provided", () => {
    renderSidebar();
    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(screen.getByText("Factory Ledger")).toBeInTheDocument();
    expect(screen.getByText("Users")).toBeInTheDocument();
  });

  it("shows all nav items when an invalid role string is given", () => {
    renderSidebar("NOT_A_ROLE");
    expect(screen.getByText("Factory Ledger")).toBeInTheDocument();
  });
});

describe("SUPER_ADMIN", () => {
  it("sees all nav items", () => {
    renderSidebar("SUPER_ADMIN");
    expect(screen.getByText("Orders")).toBeInTheDocument();
    expect(screen.getByText("Factory Ledger")).toBeInTheDocument();
    expect(screen.getByText("Users")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });
});

describe("ADMIN", () => {
  beforeEach(() => renderSidebar("ADMIN"));

  it("sees Orders", () => expect(screen.getByText("Orders")).toBeInTheDocument());
  it("sees Users", () => expect(screen.getByText("Users")).toBeInTheDocument());
  it("sees Settings", () => expect(screen.getByText("Settings")).toBeInTheDocument());

  it("does NOT see Factory Ledger (D-004: ADMIN excluded from factory cost data)", () => {
    expect(screen.queryByText("Factory Ledger")).toBeNull();
  });

  it("does NOT see Payments (FINANCE only)", () => {
    expect(screen.queryByText("Payments")).toBeNull();
  });
});

describe("OPERATIONS", () => {
  beforeEach(() => renderSidebar("OPERATIONS"));

  it("sees Orders", () => expect(screen.getByText("Orders")).toBeInTheDocument());
  it("sees Products", () => expect(screen.getByText("Products")).toBeInTheDocument());
  it("sees Returns", () => expect(screen.getByText("Returns")).toBeInTheDocument());

  it("does NOT see Factory Ledger", () => {
    expect(screen.queryByText("Factory Ledger")).toBeNull();
  });

  it("does NOT see Users", () => {
    expect(screen.queryByText("Users")).toBeNull();
  });

  it("does NOT see Settings", () => {
    expect(screen.queryByText("Settings")).toBeNull();
  });
});

describe("FINANCE", () => {
  beforeEach(() => renderSidebar("FINANCE"));

  it("sees Factory Ledger", () => expect(screen.getByText("Factory Ledger")).toBeInTheDocument());
  it("sees Payments", () => expect(screen.getByText("Payments")).toBeInTheDocument());
  it("sees Orders", () => expect(screen.getByText("Orders")).toBeInTheDocument());

  it("does NOT see Users", () => expect(screen.queryByText("Users")).toBeNull());
  it("does NOT see Settings", () => expect(screen.queryByText("Settings")).toBeNull());
});

describe("Dashboard is always visible", () => {
  const roles = ["SUPER_ADMIN", "ADMIN", "OPERATIONS", "FINANCE", "CLIENT", "FACTORY"];
  roles.forEach((role) => {
    it(`shows Dashboard for ${role}`, () => {
      renderSidebar(role);
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });
  });
});
