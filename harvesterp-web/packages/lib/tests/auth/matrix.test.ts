import { describe, it, expect } from "vitest";
import {
  Resource,
  PERMISSION_MATRIX,
  canAccess,
  allowedRoles,
} from "../../src/auth/matrix.js";
import { UserRole } from "../../src/auth/roles.js";

describe("PERMISSION_MATRIX", () => {
  it("has an entry for every Resource", () => {
    const resourceKeys = Object.values(Resource);
    for (const key of resourceKeys) {
      expect(PERMISSION_MATRIX).toHaveProperty(key);
    }
  });

  describe("Factory ledger (D-009 / Cluster A)", () => {
    const ledgerResources = [
      Resource.FACTORY_LEDGER_VIEW,
      Resource.FACTORY_PAYMENTS,
      Resource.FACTORY_CREDITS,
      Resource.FACTORY_AUDIT_LOG,
    ] as const;

    for (const res of ledgerResources) {
      // D-009 / D-004: require_factory_financial = [SUPER_ADMIN, FINANCE] only.
      // ADMIN is deliberately excluded — intersection of router-level (require_finance)
      // and endpoint-level (require_factory_financial) yields SUPER_ADMIN | FINANCE.
      it(`${res} does NOT allow ADMIN (D-009 / D-004)`, () => {
        expect(PERMISSION_MATRIX[res]).not.toContain(UserRole.ADMIN);
      });
      it(`${res} allows FINANCE`, () => {
        expect(PERMISSION_MATRIX[res]).toContain(UserRole.FINANCE);
      });
      it(`${res} does NOT allow CLIENT`, () => {
        expect(PERMISSION_MATRIX[res]).not.toContain(UserRole.CLIENT);
      });
      it(`${res} does NOT allow OPERATIONS`, () => {
        expect(PERMISSION_MATRIX[res]).not.toContain(UserRole.OPERATIONS);
      });
    }
  });

  describe("Dashboard tabs (D-010)", () => {
    it("DASHBOARD_OPERATIONS_TAB allows ADMIN and OPERATIONS", () => {
      expect(PERMISSION_MATRIX[Resource.DASHBOARD_OPERATIONS_TAB]).toContain(UserRole.ADMIN);
      expect(PERMISSION_MATRIX[Resource.DASHBOARD_OPERATIONS_TAB]).toContain(UserRole.OPERATIONS);
    });
    it("DASHBOARD_OPERATIONS_TAB does NOT allow FINANCE", () => {
      expect(PERMISSION_MATRIX[Resource.DASHBOARD_OPERATIONS_TAB]).not.toContain(UserRole.FINANCE);
    });
    it("DASHBOARD_PAYMENTS_TAB allows ADMIN and FINANCE", () => {
      expect(PERMISSION_MATRIX[Resource.DASHBOARD_PAYMENTS_TAB]).toContain(UserRole.ADMIN);
      expect(PERMISSION_MATRIX[Resource.DASHBOARD_PAYMENTS_TAB]).toContain(UserRole.FINANCE);
    });
    it("DASHBOARD_PAYMENTS_TAB does NOT allow OPERATIONS", () => {
      expect(PERMISSION_MATRIX[Resource.DASHBOARD_PAYMENTS_TAB]).not.toContain(UserRole.OPERATIONS);
    });
  });

  describe("Product factory cost (G-012 / G-013)", () => {
    it("does NOT allow CLIENT", () => {
      expect(PERMISSION_MATRIX[Resource.PRODUCT_FACTORY_COST]).not.toContain(UserRole.CLIENT);
    });
    it("does NOT allow FACTORY", () => {
      expect(PERMISSION_MATRIX[Resource.PRODUCT_FACTORY_COST]).not.toContain(UserRole.FACTORY);
    });
    it("allows FINANCE", () => {
      expect(PERMISSION_MATRIX[Resource.PRODUCT_FACTORY_COST]).toContain(UserRole.FINANCE);
    });
  });
});

describe("canAccess()", () => {
  it("returns true for SUPER_ADMIN on any resource", () => {
    for (const res of Object.values(Resource)) {
      expect(canAccess(UserRole.SUPER_ADMIN, res)).toBe(true);
    }
  });
  it("returns true when role is in matrix", () => {
    expect(canAccess(UserRole.FINANCE, Resource.FACTORY_LEDGER_VIEW)).toBe(true);
  });
  it("returns false when role is not in matrix", () => {
    expect(canAccess(UserRole.CLIENT, Resource.FACTORY_LEDGER_VIEW)).toBe(false);
  });
  // D-009 / D-004: ADMIN must NOT access factory ledger
  it("returns false for ADMIN on FACTORY_LEDGER_VIEW (D-009)", () => {
    expect(canAccess(UserRole.ADMIN, Resource.FACTORY_LEDGER_VIEW)).toBe(false);
  });
  it("returns false for CLIENT on DASHBOARD_PAYMENTS_TAB", () => {
    expect(canAccess(UserRole.CLIENT, Resource.DASHBOARD_PAYMENTS_TAB)).toBe(false);
  });
  // FACTORY users can access orders (get_scoped_query scopes by factory_id)
  it("returns true for FACTORY on ORDER_LIST", () => {
    expect(canAccess(UserRole.FACTORY, Resource.ORDER_LIST)).toBe(true);
  });
});

describe("allowedRoles()", () => {
  it("always includes SUPER_ADMIN", () => {
    for (const res of Object.values(Resource)) {
      expect(allowedRoles(res)).toContain(UserRole.SUPER_ADMIN);
    }
  });
  it("includes FINANCE for FACTORY_LEDGER_VIEW", () => {
    const roles = allowedRoles(Resource.FACTORY_LEDGER_VIEW);
    expect(roles).toContain(UserRole.FINANCE);
  });
  it("does NOT include ADMIN for FACTORY_LEDGER_VIEW (D-009)", () => {
    const roles = allowedRoles(Resource.FACTORY_LEDGER_VIEW);
    expect(roles).not.toContain(UserRole.ADMIN);
  });
  it("does not duplicate SUPER_ADMIN if already in base", () => {
    const roles = allowedRoles(Resource.FACTORY_LEDGER_VIEW);
    const saCount = roles.filter((r) => r === UserRole.SUPER_ADMIN).length;
    expect(saCount).toBe(1);
  });
});
