import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Resource, UserRole } from "@harvesterp/lib";
import { RoleGate } from "@/components/composed/role-gate";

describe("RoleGate (D-004 / D-009-A2 / D-010)", () => {
  it("renders children when permission is granted", () => {
    render(
      <RoleGate user={{ role: UserRole.FINANCE }} permission={Resource.FACTORY_LEDGER_VIEW}>
        <span>Factory ledger content</span>
      </RoleGate>,
    );
    expect(screen.getByText("Factory ledger content")).toBeInTheDocument();
  });

  it("renders fallback when permission is denied", () => {
    render(
      <RoleGate
        user={{ role: UserRole.ADMIN }}
        permission={Resource.FACTORY_LEDGER_VIEW}
        fallback={<span>Access denied</span>}
      >
        <span>Factory ledger content</span>
      </RoleGate>,
    );
    expect(screen.getByText("Access denied")).toBeInTheDocument();
    expect(screen.queryByText("Factory ledger content")).not.toBeInTheDocument();
  });

  it("SUPER_ADMIN always sees children (bypass — D-009/D-004)", () => {
    render(
      <RoleGate user={{ role: UserRole.SUPER_ADMIN }} permission={Resource.FACTORY_LEDGER_VIEW}>
        <span>Super admin content</span>
      </RoleGate>,
    );
    expect(screen.getByText("Super admin content")).toBeInTheDocument();
  });

  it("ADMIN is blocked from FACTORY_LEDGER_VIEW (D-009-A2)", () => {
    render(
      <RoleGate
        user={{ role: UserRole.ADMIN }}
        permission={Resource.FACTORY_LEDGER_VIEW}
        fallback={<span>Blocked</span>}
      >
        <span>Ledger</span>
      </RoleGate>,
    );
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.queryByText("Ledger")).not.toBeInTheDocument();
  });

  it("OPERATIONS is blocked from DASHBOARD_PAYMENTS_TAB (D-010)", () => {
    render(
      <RoleGate
        user={{ role: UserRole.OPERATIONS }}
        permission={Resource.DASHBOARD_PAYMENTS_TAB}
        fallback={<span>Hidden from ops</span>}
      >
        <span>Factory payments</span>
      </RoleGate>,
    );
    expect(screen.getByText("Hidden from ops")).toBeInTheDocument();
  });

  it("renders null (not fallback) by default when denied and no fallback prop", () => {
    const { container } = render(
      <RoleGate user={{ role: UserRole.CLIENT }} permission={Resource.FACTORY_LEDGER_VIEW}>
        <span>Content</span>
      </RoleGate>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders fallback when user is null (unauthenticated)", () => {
    render(
      <RoleGate user={null} permission={Resource.ORDER_LIST} fallback={<span>Please log in</span>}>
        <span>Content</span>
      </RoleGate>,
    );
    expect(screen.getByText("Please log in")).toBeInTheDocument();
  });

  it("FINANCE can access ORDER_LIST", () => {
    render(
      <RoleGate user={{ role: UserRole.FINANCE }} permission={Resource.ORDER_LIST}>
        <span>Order list</span>
      </RoleGate>,
    );
    expect(screen.getByText("Order list")).toBeInTheDocument();
  });

  it("CLIENT can access CLIENT_PORTAL_ACCESS", () => {
    render(
      <RoleGate user={{ role: UserRole.CLIENT }} permission={Resource.CLIENT_PORTAL_ACCESS}>
        <span>Client portal</span>
      </RoleGate>,
    );
    expect(screen.getByText("Client portal")).toBeInTheDocument();
  });
});
