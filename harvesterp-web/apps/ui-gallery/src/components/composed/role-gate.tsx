"use client";

/**
 * <RoleGate> — D-004 / D-009-A2 / D-010 canonical implementation.
 *
 * Canonical frontend role gate for the Next.js rebuild. Every permission-
 * gated UI element MUST use this component — never check user.role directly
 * in component JSX (D-004-A6).
 *
 * Uses canAccess() from @harvesterp/lib which mirrors the backend
 * has_any_role() bypass (SUPER_ADMIN passes all checks automatically).
 *
 * Known usage sites:
 *   D-009-A2: Factory Ledger nav tab  → permission="FACTORY_LEDGER_VIEW"
 *   D-010-A3: Dashboard Factory panel → permission="DASHBOARD_PAYMENTS_TAB"
 *   D-010-A4: Payments tab factory    → permission="DASHBOARD_PAYMENTS_TAB"
 *
 * IMPORTANT: This is a defence-in-depth frontend gate only.
 * The backend is the authoritative enforcement layer (D-006).
 *
 * "use client" — may be rendered in client components; keep directive.
 */

import * as React from "react";
import { type UserRole, type Resource, canAccess } from "@harvesterp/lib";

// ── Types ──────────────────────────────────────────────────────────────────

export interface RoleGateUser {
  role: UserRole;
  id?: string;
}

export interface RoleGateProps {
  /**
   * The authenticated user. Pass the full user object from auth context.
   * RoleGate renders `fallback` (default null) when user is undefined/null.
   */
  user: RoleGateUser | null | undefined;
  /**
   * The Resource key to gate on — typed against the verified permission matrix
   * (packages/lib/src/auth/matrix.ts).
   * e.g. "FACTORY_LEDGER_VIEW" | "DASHBOARD_PAYMENTS_TAB" | …
   */
  permission: Resource;
  /**
   * Rendered when permission is denied. Default null (renders nothing).
   * Pass a fallback to show alternative UI (e.g. an upgrade prompt).
   */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────

/**
 * Renders `children` when the user has the required permission.
 * Renders `fallback` (default null) when denied.
 *
 * @example
 * // D-009-A2: Factory ledger nav link — hide from ADMIN
 * <RoleGate user={currentUser} permission="FACTORY_LEDGER_VIEW">
 *   <NavLink to="/finance/factory-ledger">Factory Ledger</NavLink>
 * </RoleGate>
 *
 * @example
 * // D-010-A4: Payment tab factory section — hide from OPERATIONS
 * <RoleGate user={currentUser} permission="DASHBOARD_PAYMENTS_TAB">
 *   <FactoryPaymentsSection />
 * </RoleGate>
 */
export function RoleGate({
  user,
  permission,
  fallback = null,
  children,
}: RoleGateProps) {
  if (!user) return <>{fallback}</>;
  if (!canAccess(user.role, permission)) return <>{fallback}</>;
  return <>{children}</>;
}
