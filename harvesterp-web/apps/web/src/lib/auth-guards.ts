import { type UserRole } from "@harvesterp/lib";

/**
 * auth-guards.ts — Server-side route protection helpers.
 *
 * Maps path prefixes to the minimum set of roles that may access them.
 * Used by (app)/layout.tsx to redirect users who lack the required role.
 *
 * Paths not listed here are accessible to any authenticated user.
 * SUPER_ADMIN is always included (it bypasses all role checks).
 *
 * Access decisions mirror the permission matrix in @harvesterp/lib/auth/matrix.ts.
 */

// ── Route guards ──────────────────────────────────────────────────────────────

interface RouteGuard {
  /** Path prefix that triggers this guard (exact match or startsWith + "/"). */
  prefix: string;
  /** Roles that may access the route. All others are redirected to /dashboard. */
  roles: readonly UserRole[];
}

const ROUTE_GUARDS: readonly RouteGuard[] = [
  // Finance-only routes (D-004 / D-009)
  { prefix: "/factory-ledger", roles: ["SUPER_ADMIN", "FINANCE"] as const },
  { prefix: "/payments",       roles: ["SUPER_ADMIN", "FINANCE"] as const },

  // Admin-only routes
  { prefix: "/users",          roles: ["SUPER_ADMIN", "ADMIN"] as const },
  { prefix: "/audit-logs",     roles: ["SUPER_ADMIN", "ADMIN"] as const },
  { prefix: "/settings",       roles: ["SUPER_ADMIN", "ADMIN"] as const },
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return the roles that may access the given pathname.
 *
 * Returns an empty array if the path is not guarded (accessible to any
 * authenticated user). A non-empty array means only the listed roles
 * are allowed; all others should be redirected.
 *
 * @example
 * getRequiredRoles("/factory-ledger")  // ["SUPER_ADMIN", "FINANCE"]
 * getRequiredRoles("/users/123")       // ["SUPER_ADMIN", "ADMIN"]
 * getRequiredRoles("/dashboard")       // []
 */
export function getRequiredRoles(pathname: string): readonly UserRole[] {
  const guard = ROUTE_GUARDS.find(
    (g) => pathname === g.prefix || pathname.startsWith(`${g.prefix}/`),
  );
  return guard?.roles ?? [];
}

/**
 * Returns true if the given role satisfies the route guard for `pathname`.
 * A missing or invalid role always fails a guarded route.
 */
export function hasRouteAccess(
  pathname: string,
  role: string | undefined,
): boolean {
  const required = getRequiredRoles(pathname);
  if (required.length === 0) return true;
  if (!role) return false;
  return (required as readonly string[]).includes(role);
}
