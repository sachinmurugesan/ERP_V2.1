"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { getRoleDescriptor } from "./constants";
import type { ServiceProviderRole } from "./types";

/**
 * ProviderRoleBadge — a single role pill for a service provider.
 *
 * Renders one `<span class="chip chip-{tone}">` per role using the
 * design-system tone mapped from `SERVICE_PROVIDER_ROLES`. Unknown
 * role values fall back to a neutral chip with the raw enum text
 * (mirrors the Vue `roleColorMap[r] || 'bg-slate-100 text-slate-600'`
 * fallback so a future enum value doesn't render invisibly).
 *
 * Local component (not lifted to Layer 2) per Phase 2 §2.6 decision —
 * no second known consumer yet; lift on R-15 trigger if Shipments page
 * also needs role pills.
 */

export interface ProviderRoleBadgeProps {
  role: ServiceProviderRole;
  className?: string | undefined;
}

export function ProviderRoleBadge({
  role,
  className,
}: ProviderRoleBadgeProps): React.ReactElement {
  const descriptor = getRoleDescriptor(role);
  // Unknown enum values: render the raw string in a neutral chip.
  const label = descriptor?.label ?? role;
  const toneClass = descriptor?.chipClass ?? "";
  return (
    <span
      className={cn("chip", toneClass, className)}
      data-testid={`provider-role-${role.toLowerCase()}`}
    >
      {label}
    </span>
  );
}

/**
 * ProviderRolesCell — the "Roles" table cell.
 *
 * Desktop / mobile (≥md or <md): renders one `<ProviderRoleBadge>` per
 *   role, wrapping with `flex-wrap`.
 * Tablet (md → lg, i.e. 768–1023 px): renders a single chip-accent
 *   pill with the count ("3 roles") to save horizontal space — matches
 *   Phase 2 §2.8 responsive plan and Phase 3 step 2 spec.
 *
 * The two layouts render simultaneously and CSS picks via media
 * queries; jsdom unit tests must scope queries to one layout (Section 6
 * responsive-table rule).
 */

export interface ProviderRolesCellProps {
  roles: ServiceProviderRole[];
  className?: string | undefined;
}

export function ProviderRolesCell({
  roles,
  className,
}: ProviderRolesCellProps): React.ReactElement {
  if (roles.length === 0) {
    return (
      <span className="text-xs italic text-slate-400" data-testid="provider-roles-empty">
        No roles
      </span>
    );
  }

  const countLabel = `${roles.length} ${roles.length === 1 ? "role" : "roles"}`;

  return (
    <div className={cn("min-w-0", className)}>
      {/* Tablet (md → lg): collapsed count badge — saves horizontal space */}
      <span
        className="hidden md:inline-flex lg:hidden chip chip-accent"
        data-testid="provider-roles-count"
        aria-label={`Roles: ${roles
          .map((r) => getRoleDescriptor(r)?.label ?? r)
          .join(", ")}`}
      >
        {countLabel}
      </span>

      {/*
        Desktop (≥lg) and mobile (<md): full pill wrap.
        Cascade: base = flex (visible on mobile);
                 md:hidden hides on tablet;
                 lg:flex re-enables on desktop.
      */}
      <div
        className="flex flex-wrap gap-1 md:hidden lg:flex"
        data-testid="provider-roles-pills"
        role="group"
        aria-label={`Roles: ${roles
          .map((r) => getRoleDescriptor(r)?.label ?? r)
          .join(", ")}`}
      >
        {roles.map((r) => (
          <ProviderRoleBadge key={r} role={r} />
        ))}
      </div>
    </div>
  );
}
