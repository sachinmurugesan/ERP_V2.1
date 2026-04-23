/**
 * auth-guards.test.ts — Unit tests for lib/auth-guards.ts.
 *
 * getRequiredRoles and hasRouteAccess are pure functions — no mocking needed.
 */

import { describe, it, expect } from "vitest";
import { getRequiredRoles, hasRouteAccess } from "../../src/lib/auth-guards";

// ── getRequiredRoles ──────────────────────────────────────────────────────────

describe("getRequiredRoles", () => {
  it("returns [] for /dashboard (accessible to all)", () => {
    expect(getRequiredRoles("/dashboard")).toHaveLength(0);
  });

  it("returns [] for / (root)", () => {
    expect(getRequiredRoles("/")).toHaveLength(0);
  });

  it("returns [] for /orders (not guarded)", () => {
    expect(getRequiredRoles("/orders")).toHaveLength(0);
  });

  it("returns [] for an unknown path", () => {
    expect(getRequiredRoles("/some-unknown-route")).toHaveLength(0);
  });

  it("guards /factory-ledger for SUPER_ADMIN and FINANCE only", () => {
    const roles = getRequiredRoles("/factory-ledger");
    expect(roles).toContain("SUPER_ADMIN");
    expect(roles).toContain("FINANCE");
    expect(roles).not.toContain("ADMIN");
    expect(roles).not.toContain("OPERATIONS");
  });

  it("prefix-matches /factory-ledger/123 as a sub-path of /factory-ledger", () => {
    const roles = getRequiredRoles("/factory-ledger/123");
    expect(roles).toContain("FINANCE");
  });

  it("guards /payments for SUPER_ADMIN and FINANCE only", () => {
    const roles = getRequiredRoles("/payments");
    expect(roles).toContain("SUPER_ADMIN");
    expect(roles).toContain("FINANCE");
    expect(roles).not.toContain("ADMIN");
  });

  it("guards /users for SUPER_ADMIN and ADMIN only", () => {
    const roles = getRequiredRoles("/users");
    expect(roles).toContain("SUPER_ADMIN");
    expect(roles).toContain("ADMIN");
    expect(roles).not.toContain("FINANCE");
    expect(roles).not.toContain("OPERATIONS");
  });

  it("prefix-matches /users/123", () => {
    expect(getRequiredRoles("/users/123")).toContain("ADMIN");
  });

  it("guards /audit-logs for SUPER_ADMIN and ADMIN only", () => {
    const roles = getRequiredRoles("/audit-logs");
    expect(roles).toContain("ADMIN");
    expect(roles).not.toContain("FINANCE");
  });

  it("guards /settings for SUPER_ADMIN and ADMIN only", () => {
    const roles = getRequiredRoles("/settings");
    expect(roles).toContain("ADMIN");
    expect(roles).not.toContain("OPERATIONS");
  });

  it("does not match /pay as prefix of /payments", () => {
    expect(getRequiredRoles("/pay")).toHaveLength(0);
  });
});

// ── hasRouteAccess ────────────────────────────────────────────────────────────

describe("hasRouteAccess", () => {
  it("allows any role on unguarded paths", () => {
    expect(hasRouteAccess("/dashboard", "OPERATIONS")).toBe(true);
    expect(hasRouteAccess("/orders", "CLIENT")).toBe(true);
  });

  it("allows undefined role on unguarded paths", () => {
    expect(hasRouteAccess("/dashboard", undefined)).toBe(true);
  });

  it("denies undefined role on a guarded path", () => {
    expect(hasRouteAccess("/factory-ledger", undefined)).toBe(false);
  });

  it("allows FINANCE on /factory-ledger", () => {
    expect(hasRouteAccess("/factory-ledger", "FINANCE")).toBe(true);
  });

  it("denies ADMIN on /factory-ledger (D-004)", () => {
    expect(hasRouteAccess("/factory-ledger", "ADMIN")).toBe(false);
  });

  it("denies OPERATIONS on /factory-ledger", () => {
    expect(hasRouteAccess("/factory-ledger", "OPERATIONS")).toBe(false);
  });

  it("allows SUPER_ADMIN on all guarded paths", () => {
    expect(hasRouteAccess("/factory-ledger", "SUPER_ADMIN")).toBe(true);
    expect(hasRouteAccess("/users", "SUPER_ADMIN")).toBe(true);
    expect(hasRouteAccess("/settings", "SUPER_ADMIN")).toBe(true);
  });

  it("allows ADMIN on /users", () => {
    expect(hasRouteAccess("/users", "ADMIN")).toBe(true);
  });

  it("denies FINANCE on /users", () => {
    expect(hasRouteAccess("/users", "FINANCE")).toBe(false);
  });

  it("denies OPERATIONS on /settings", () => {
    expect(hasRouteAccess("/settings", "OPERATIONS")).toBe(false);
  });
});
