"use client";

/**
 * NavigationSidebar — Next.js-aware wrapper around Sidebar.
 *
 * Bridges the gap between Sidebar's `onNavigate` callback and
 * Next.js App Router navigation. Also applies role-based nav filtering:
 * items the current user cannot access are hidden (absent, not greyed).
 *
 * Seam: routing behaviour and access checks are contained here,
 * not in the generic Sidebar component.
 */

import { useRouter, usePathname } from "next/navigation";
import { canAccess, Resource, UserRole, isValidRole } from "@harvesterp/lib";
import { Sidebar, HARVEST_NAV, type SidebarUser, type NavGroup } from "@/components/shells/sidebar";

// ── Nav resource map ──────────────────────────────────────────────────────────

/**
 * Maps each nav item id to the Resource it requires.
 * `undefined` means the item is visible to all authenticated users.
 *
 * Key decisions:
 *  - Operations items use ORDER_LIST (ADMIN, OPERATIONS, FINANCE, CLIENT, FACTORY).
 *  - factory-ledger is gated by FACTORY_LEDGER_VIEW (FINANCE only — D-004/D-009).
 *  - payments is gated by FACTORY_PAYMENTS (FINANCE only).
 *  - users, audit-logs: USER_MANAGEMENT (ADMIN only).
 *  - settings: SYSTEM_SETTINGS (ADMIN only).
 */
const NAV_RESOURCE_MAP: Readonly<Record<string, Resource | undefined>> = {
  // Always visible
  dashboard:        undefined,

  // Operations — visible to any role that can list orders
  orders:           Resource.ORDER_LIST,
  products:         Resource.PRODUCT_LIST,
  clients:          Resource.ORDER_LIST,
  factories:        Resource.ORDER_LIST,
  transport:        Resource.ORDER_LIST,
  aftersales:       Resource.ORDER_LIST,
  returns:          Resource.ORDER_LIST,
  warehouse:        Resource.ORDER_LIST,

  // Finance
  receivables:      Resource.ORDER_LIST,
  "client-ledger":  Resource.ORDER_LIST,
  "factory-ledger": Resource.FACTORY_LEDGER_VIEW, // FINANCE only (D-004 / D-009)
  payments:         Resource.FACTORY_PAYMENTS,     // FINANCE only

  // System — ADMIN only
  users:            Resource.USER_MANAGEMENT,
  "audit-logs":     Resource.USER_MANAGEMENT,
  settings:         Resource.SYSTEM_SETTINGS,
} as const;

/**
 * Override the default `/${id}` routing for nav items whose URL doesn't
 * match their id. Finance items live under /finance/*; audit-logs under
 * /audit-logs (hyphenated) — just list each deviation here.
 *
 * Items not in the map route to `/${id}` (the original default).
 */
const NAV_HREF_OVERRIDES: Readonly<Record<string, string>> = {
  receivables:      "/finance/receivables",
  "client-ledger":  "/finance/client-ledger",
  "factory-ledger": "/finance/factory-ledger",
  payments:         "/finance/payments",
} as const;

// ── Filtering ─────────────────────────────────────────────────────────────────

/**
 * Return a copy of HARVEST_NAV with items inaccessible to `role` removed.
 * Groups that become empty after filtering are also removed.
 */
function filterNavForRole(role: UserRole): NavGroup[] {
  return HARVEST_NAV
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const resource = NAV_RESOURCE_MAP[item.id];
        if (resource === undefined) return true;          // no gate = always show
        return canAccess(role, resource);
      }),
    }))
    .filter((group) => group.items.length > 0);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface NavigationSidebarProps {
  user: SidebarUser;
  userRole?: string;
  compact?: boolean;
}

export function NavigationSidebar({ user, userRole, compact }: NavigationSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Derive active nav item from the first path segment
  const active = pathname.split("/")[1] ?? "dashboard";

  // Filter nav items when a valid role is supplied
  const navGroups = (userRole && isValidRole(userRole))
    ? filterNavForRole(userRole as UserRole)
    : HARVEST_NAV;

  return (
    <Sidebar
      user={user}
      active={active}
      navGroups={navGroups}
      {...(compact !== undefined ? { compact } : {})}
      onNavigate={(id) => {
        const href = NAV_HREF_OVERRIDES[id] ?? `/${id}`;
        router.push(href);
      }}
    />
  );
}
