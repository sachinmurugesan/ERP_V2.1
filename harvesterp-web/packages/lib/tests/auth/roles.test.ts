import { describe, it, expect } from "vitest";
import {
  UserRole,
  ALL_ROLES,
  INTERNAL_ROLES,
  PORTAL_ROLES,
  ADMIN_ROLES,
  isValidRole,
  isSuperAdmin,
} from "../../src/auth/roles.js";

describe("UserRole enum", () => {
  it("has 7 distinct roles", () => {
    expect(Object.keys(UserRole)).toHaveLength(7);
  });
  it("contains SUPER_ADMIN", () => {
    expect(UserRole.SUPER_ADMIN).toBe("SUPER_ADMIN");
  });
  it("contains FACTORY", () => {
    expect(UserRole.FACTORY).toBe("FACTORY");
  });
});

describe("ALL_ROLES", () => {
  it("contains all 7 roles", () => {
    expect(ALL_ROLES).toHaveLength(7);
  });
  it("starts with SUPER_ADMIN", () => {
    expect(ALL_ROLES[0]).toBe(UserRole.SUPER_ADMIN);
  });
});

describe("INTERNAL_ROLES", () => {
  it("contains 5 internal roles", () => {
    expect(INTERNAL_ROLES).toHaveLength(5);
  });
  it("does not include CLIENT", () => {
    expect(INTERNAL_ROLES).not.toContain(UserRole.CLIENT);
  });
  it("does not include FACTORY", () => {
    expect(INTERNAL_ROLES).not.toContain(UserRole.FACTORY);
  });
});

describe("PORTAL_ROLES", () => {
  it("contains CLIENT and FACTORY", () => {
    expect(PORTAL_ROLES).toContain(UserRole.CLIENT);
    expect(PORTAL_ROLES).toContain(UserRole.FACTORY);
  });
  it("has exactly 2 roles", () => {
    expect(PORTAL_ROLES).toHaveLength(2);
  });
});

describe("ADMIN_ROLES", () => {
  it("contains SUPER_ADMIN and ADMIN", () => {
    expect(ADMIN_ROLES).toContain(UserRole.SUPER_ADMIN);
    expect(ADMIN_ROLES).toContain(UserRole.ADMIN);
  });
  it("has exactly 2 roles", () => {
    expect(ADMIN_ROLES).toHaveLength(2);
  });
});

describe("isValidRole()", () => {
  it("returns true for valid roles", () => {
    expect(isValidRole("FINANCE")).toBe(true);
    expect(isValidRole("CLIENT")).toBe(true);
  });
  it("returns false for invalid strings", () => {
    expect(isValidRole("HACKER")).toBe(false);
    expect(isValidRole("")).toBe(false);
    expect(isValidRole("finance")).toBe(false); // case-sensitive
  });
});

describe("isSuperAdmin()", () => {
  it("returns true for SUPER_ADMIN", () => {
    expect(isSuperAdmin(UserRole.SUPER_ADMIN)).toBe(true);
  });
  it("returns false for all other roles", () => {
    const others: UserRole[] = [
      UserRole.ADMIN, UserRole.OPERATIONS, UserRole.FINANCE,
      UserRole.TA, UserRole.CLIENT, UserRole.FACTORY,
    ];
    for (const r of others) {
      expect(isSuperAdmin(r)).toBe(false);
    }
  });
});
