"use client";

import * as React from "react";
import { Icon } from "@/components/design-system/icon";
import { HarvestERPLogo } from "@/components/design-system/logo";
import { DSAvatar } from "@/components/design-system/ds-avatar";

// ── Nav structure ────────────────────────────────────────────────────────────

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: string | number;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

/** HarvestERP canonical navigation from audit decisions */
export const HARVEST_NAV: NavGroup[] = [
  {
    group: "",
    items: [{ id: "dashboard", label: "Dashboard", icon: "dashboard" }],
  },
  {
    group: "Operations",
    items: [
      { id: "orders",     label: "Orders",     icon: "invoice" },
      { id: "products",   label: "Products",   icon: "box" },
      { id: "clients",    label: "Clients",    icon: "crm" },
      { id: "factories",  label: "Factories",  icon: "truck" },
      { id: "transport",  label: "Transport",  icon: "truck" },
      { id: "aftersales", label: "After Sales", icon: "refresh" },
      { id: "returns",    label: "Returns",    icon: "zap", badge: "3" },
      { id: "warehouse",  label: "Warehouse",  icon: "inventory" },
    ],
  },
  {
    group: "Finance",
    items: [
      { id: "receivables",     label: "Receivables",     icon: "credit" },
      { id: "client-ledger",   label: "Client Ledger",   icon: "finance" },
      { id: "factory-ledger",  label: "Factory Ledger",  icon: "finance" },
      { id: "payments",        label: "Payments",        icon: "credit" },
    ],
  },
  {
    group: "System",
    items: [
      { id: "users",      label: "Users",      icon: "user" },
      { id: "audit-logs", label: "Audit Logs", icon: "shield" },
      { id: "settings",   label: "Settings",   icon: "settings" },
    ],
  },
];

// ── User footer data ─────────────────────────────────────────────────────────

export interface SidebarUser {
  name: string;
  roleLabel?: string;
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface SidebarProps {
  /** Currently active nav item id */
  active?: string;
  /** Compact (icon-only) mode */
  compact?: boolean;
  /** Logged-in user for footer display */
  user?: SidebarUser;
  /** Called with the nav item id when a nav item is clicked */
  onNavigate?: (id: string) => void;
  /** Optional slot rendered above the user footer (replaces promo card) */
  promoSlot?: React.ReactNode;
  className?: string;
}

/**
 * HarvestERP Sidebar — the primary navigation shell.
 *
 * Architectural seam: uses `onNavigate` callback instead of importing
 * react-router-dom directly. Vite gallery wires to router; Next.js wires
 * to next/navigation.  See SEAMS.md §2.
 */
export function Sidebar({
  active = "dashboard",
  compact = false,
  user = { name: "Sachin M.", roleLabel: "Super Admin" },
  onNavigate,
  promoSlot,
  className = "",
}: SidebarProps) {
  return (
    <aside
      style={{
        width: compact ? 64 : 232,
        flexShrink: 0,
        background: "var(--bg-elev)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        padding: compact ? "16px 8px" : "16px 14px",
        gap: 4,
        height: "100%",
        overflowY: "auto",
      }}
      className={className}
      aria-label="Primary navigation"
    >
      {/* Logo / Brand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "4px 6px 16px",
        }}
      >
        <HarvestERPLogo size={26} />
        {!compact && (
          <div>
            <div
              style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2 }}
            >
              HarvestERP
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--fg-muted)",
                fontWeight: 600,
                letterSpacing: 0.4,
                textTransform: "uppercase",
              }}
            >
              Workspace
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      {!compact && (
        <div style={{ position: "relative", marginBottom: 10 }}>
          <span
            style={{
              position: "absolute",
              left: 10,
              top: 10,
              color: "var(--fg-subtle)",
            }}
          >
            <Icon name="search" size={14} />
          </span>
          <input
            className="input"
            placeholder="Search or ⌘K"
            style={{
              paddingLeft: 30,
              height: 32,
              fontSize: 12,
              background: "var(--bg-sunken)",
            }}
            aria-label="Search"
          />
        </div>
      )}

      {/* Nav groups */}
      <nav
        style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 2 }}
        aria-label="Application navigation"
      >
        {HARVEST_NAV.map((g, gi) => (
          <div key={gi} style={{ marginTop: g.group ? 14 : 0 }}>
            {g.group && !compact && (
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--fg-subtle)",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  padding: "4px 10px 6px",
                }}
              >
                {g.group}
              </div>
            )}
            {g.items.map((it) => (
              <button
                key={it.id}
                className={`nav-item ${it.id === active ? "active" : ""}`}
                style={
                  compact
                    ? { justifyContent: "center", padding: 0, width: 40, height: 40, border: "none", background: "transparent" }
                    : { border: "none", width: "100%", textAlign: "left" }
                }
                onClick={() => onNavigate?.(it.id)}
                title={compact ? it.label : undefined}
                type="button"
              >
                <Icon name={it.icon as import("@/components/design-system/icon").IconName} size={16} />
                {!compact && (
                  <>
                    <span style={{ flex: 1 }}>{it.label}</span>
                    {it.badge && (
                      <span
                        className="chip"
                        style={{
                          height: 18,
                          padding: "0 6px",
                          fontSize: 10,
                          marginLeft: "auto",
                        }}
                      >
                        {it.badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            ))}
          </div>
        ))}
      </nav>

      {/* Promo slot */}
      {!compact && promoSlot && (
        <div style={{ marginTop: 10 }}>{promoSlot}</div>
      )}

      {/* User footer */}
      <div
        style={{
          paddingTop: 10,
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <DSAvatar name={user.name} size="md" variant="gradient" />
        {!compact && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.name}
            </div>
            {user.roleLabel && (
              <div style={{ fontSize: 10, color: "var(--fg-muted)" }}>
                {user.roleLabel}
              </div>
            )}
          </div>
        )}
        {!compact && (
          <Icon name="chevronD" size={14} color="var(--fg-muted)" />
        )}
      </div>
    </aside>
  );
}
