/**
 * User roles — mirrors backend/core/security.py UserRole enum.
 *
 * Source: backend/enums.py + backend/core/security.py
 */

export const UserRole = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN:       "ADMIN",
  OPERATIONS:  "OPERATIONS",
  FINANCE:     "FINANCE",
  TA:          "TA",
  CLIENT:      "CLIENT",
  FACTORY:     "FACTORY",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** All roles in priority order (highest first) */
export const ALL_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.OPERATIONS,
  UserRole.FINANCE,
  UserRole.TA,
  UserRole.CLIENT,
  UserRole.FACTORY,
] as const;

/** Internal staff roles (not portal users) */
export const INTERNAL_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.OPERATIONS,
  UserRole.FINANCE,
  UserRole.TA,
] as const;

/** Portal (external) roles */
export const PORTAL_ROLES: readonly UserRole[] = [
  UserRole.CLIENT,
  UserRole.FACTORY,
] as const;

/** Roles with full admin capability */
export const ADMIN_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
] as const;

/**
 * Check if a given role string is a valid UserRole.
 */
export function isValidRole(role: string): role is UserRole {
  return Object.values(UserRole).includes(role as UserRole);
}

/**
 * Check if a role is a SUPER_ADMIN (bypasses all role checks in backend).
 */
export function isSuperAdmin(role: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN;
}
