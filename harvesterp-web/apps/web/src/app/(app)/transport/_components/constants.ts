/**
 * SERVICE_PROVIDER_ROLES — single source of truth for the four
 * service-provider categories defined by backend G-014.
 *
 * Consolidates what the Vue source split across two maps
 * (`roleLabelMap` + `roleColorMap` in `TransportList.vue` and a
 * separate `availableRoles` array in `TransportForm.vue`) into one
 * typed list keyed by enum value.
 *
 * The `chipClass` is the design-system chip tone variant from
 * `globals.css` (mirrored in `Design/styles/components.css`):
 *   - chip-info   — blue   — FREIGHT_FORWARDER
 *   - chip-ok     — green  — CHA
 *   - chip-warn   — amber  — CFS
 *   - chip-purple — purple — TRANSPORT (added 2026-04-26 for this migration)
 *
 * Future TransportForm migration will import this constant verbatim
 * to render the role-card grid; if a future fifth role is added the
 * constant lives in one place.
 */

import type { ServiceProviderRole } from "./types";

export interface ServiceProviderRoleDescriptor {
  value: ServiceProviderRole;
  label: string;
  /** Design-system chip tone class (`chip-{tone}`). */
  chipClass: "chip-info" | "chip-ok" | "chip-warn" | "chip-purple";
}

export const SERVICE_PROVIDER_ROLES: readonly ServiceProviderRoleDescriptor[] = [
  { value: "FREIGHT_FORWARDER", label: "Freight Forwarder", chipClass: "chip-info" },
  { value: "CHA",               label: "CHA",               chipClass: "chip-ok" },
  { value: "CFS",               label: "CFS",               chipClass: "chip-warn" },
  { value: "TRANSPORT",         label: "Transport",         chipClass: "chip-purple" },
] as const;

const BY_VALUE: Readonly<Record<ServiceProviderRole, ServiceProviderRoleDescriptor>> =
  Object.freeze(
    SERVICE_PROVIDER_ROLES.reduce(
      (acc, descriptor) => {
        acc[descriptor.value] = descriptor;
        return acc;
      },
      {} as Record<ServiceProviderRole, ServiceProviderRoleDescriptor>,
    ),
  );

/** Lookup a role descriptor by its enum value. Returns `undefined` for unknown values. */
export function getRoleDescriptor(
  role: ServiceProviderRole,
): ServiceProviderRoleDescriptor | undefined {
  return BY_VALUE[role];
}
