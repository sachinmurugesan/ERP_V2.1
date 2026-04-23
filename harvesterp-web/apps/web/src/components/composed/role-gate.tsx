"use client";

/**
 * RoleGate — D-004 canonical implementation.
 * Ported from apps/ui-gallery. Identical interface.
 *
 * Frontend defence-in-depth only. Backend is the authoritative enforcement
 * layer (D-006). Never trust client-side role gates for security.
 */

import * as React from "react";
import { type UserRole, type Resource, canAccess } from "@harvesterp/lib";

export interface RoleGateUser {
  role: UserRole;
  id?: string;
}

export interface RoleGateProps {
  user: RoleGateUser | null | undefined;
  permission: Resource;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

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
