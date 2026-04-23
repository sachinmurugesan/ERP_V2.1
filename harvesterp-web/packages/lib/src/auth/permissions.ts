/**
 * Permission primitives — role-set membership checks.
 *
 * Frontend counterpart to backend `has_any_role()` in security.py.
 * Note: SUPER_ADMIN implicitly passes ALL checks (mirrors backend bypass).
 */

import { UserRole } from "./roles.js";

/**
 * Check whether `role` is in the `allowed` set.
 * SUPER_ADMIN bypasses the check and always returns true.
 *
 * @example
 * hasAnyRole(UserRole.FINANCE, [UserRole.FINANCE, UserRole.ADMIN]) // true
 * hasAnyRole(UserRole.CLIENT,  [UserRole.FINANCE, UserRole.ADMIN]) // false
 * hasAnyRole(UserRole.SUPER_ADMIN, [UserRole.CLIENT])              // true  (bypass)
 */
export function hasAnyRole(role: UserRole, allowed: readonly UserRole[]): boolean {
  if (role === UserRole.SUPER_ADMIN) return true;
  return allowed.includes(role);
}

/**
 * Check whether `role` can perform the given action on the given resource.
 * Thin wrapper around `hasAnyRole` for use with the permission matrix.
 */
export function can(
  role: UserRole,
  allowed: readonly UserRole[],
): boolean {
  return hasAnyRole(role, allowed);
}
