import { describe, it, expect } from "vitest";
import { hasAnyRole, can } from "../../src/auth/permissions.js";
import { UserRole } from "../../src/auth/roles.js";

describe("hasAnyRole()", () => {
  describe("SUPER_ADMIN bypass", () => {
    it("returns true for SUPER_ADMIN regardless of allowed list", () => {
      expect(hasAnyRole(UserRole.SUPER_ADMIN, [UserRole.CLIENT])).toBe(true);
      expect(hasAnyRole(UserRole.SUPER_ADMIN, [])).toBe(true);
      expect(hasAnyRole(UserRole.SUPER_ADMIN, [UserRole.FACTORY])).toBe(true);
    });
  });

  describe("normal role matching", () => {
    it("returns true when role is in allowed list", () => {
      expect(hasAnyRole(UserRole.FINANCE, [UserRole.FINANCE, UserRole.ADMIN])).toBe(true);
    });
    it("returns false when role is not in allowed list", () => {
      expect(hasAnyRole(UserRole.CLIENT, [UserRole.FINANCE, UserRole.ADMIN])).toBe(false);
    });
    it("returns false when allowed list is empty", () => {
      expect(hasAnyRole(UserRole.ADMIN, [])).toBe(false);
    });
    it("is case-sensitive (exact match)", () => {
      expect(hasAnyRole(UserRole.FINANCE, [UserRole.FINANCE])).toBe(true);
      expect(hasAnyRole(UserRole.FACTORY, [UserRole.FINANCE])).toBe(false);
    });
  });
});

describe("can()", () => {
  it("is an alias for hasAnyRole", () => {
    // Same behaviour as hasAnyRole
    expect(can(UserRole.SUPER_ADMIN, [])).toBe(true);
    expect(can(UserRole.TA, [UserRole.TA])).toBe(true);
    expect(can(UserRole.TA, [UserRole.ADMIN])).toBe(false);
  });
});
