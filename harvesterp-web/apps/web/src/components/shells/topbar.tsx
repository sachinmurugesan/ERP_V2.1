"use client";

/**
 * Topbar — HarvestERP application-level header shell.
 * Ported from apps/ui-gallery. Identical interface.
 *
 * Seam: onToggleTheme and onCurrencyChange are callbacks delegated to the
 * consumer. AppTopbar (shells/app-topbar.tsx) wires these to ThemeProvider.
 */

import * as React from "react";
import { Icon } from "@/components/design-system/icon";

export type Currency = "INR" | "USD" | "CNY";

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface TopbarProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  right?: React.ReactNode;
  currency?: Currency;
  onCurrencyChange?: (c: Currency) => void;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
  notificationCount?: number;
  onNotificationsClick?: () => void;
  className?: string;
}

const CURRENCIES: Currency[] = ["INR", "USD", "CNY"];

export function Topbar({
  title,
  subtitle,
  breadcrumbs,
  right,
  currency = "INR",
  onCurrencyChange,
  theme = "light",
  onToggleTheme,
  notificationCount = 0,
  onNotificationsClick,
  className = "",
}: TopbarProps) {
  return (
    <header
      style={{
        height: 52,
        flexShrink: 0,
        background: "var(--bg-elev)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: 12,
      }}
      className={className}
      aria-label="Application header"
    >
      {/* Breadcrumbs + Title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 1 }}>
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={i}>
                {i > 0 && <Icon name="chevronR" size={10} color="var(--fg-subtle)" />}
                <span style={{ fontSize: 11, color: i === breadcrumbs.length - 1 ? "var(--fg-muted)" : "var(--fg-subtle)", fontWeight: i === breadcrumbs.length - 1 ? 500 : 400 }}>
                  {crumb.label}
                </span>
              </React.Fragment>
            ))}
          </nav>
        )}
        {title && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <h1 style={{ fontSize: 14, fontWeight: 700, color: "var(--fg)", margin: 0, letterSpacing: -0.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {title}
            </h1>
            {subtitle && (
              <span style={{ fontSize: 12, color: "var(--fg-muted)", fontWeight: 400 }}>
                {subtitle}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right-side controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {right}

        {/* Currency switcher */}
        {onCurrencyChange && (
          <div role="group" aria-label="Currency switcher" style={{ display: "flex", borderRadius: "var(--r-sm)", border: "1px solid var(--border)", overflow: "hidden" }}>
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onCurrencyChange(c)}
                aria-pressed={currency === c}
                style={{ height: 28, padding: "0 8px", fontSize: 11, fontWeight: 600, border: "none", background: currency === c ? "var(--brand-800)" : "transparent", color: currency === c ? "#fff" : "var(--fg-muted)", cursor: "pointer", transition: "background .12s, color .12s", letterSpacing: 0.2 }}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {/* Theme toggle */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "var(--r-sm)", border: "1px solid var(--border)", background: "transparent", color: "var(--fg-muted)", cursor: "pointer" }}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={15} />
          </button>
        )}

        {/* Notification bell */}
        <button
          type="button"
          onClick={onNotificationsClick}
          aria-label={notificationCount > 0 ? `${notificationCount} notifications` : "Notifications"}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "var(--r-sm)", border: "1px solid var(--border)", background: "transparent", color: "var(--fg-muted)", cursor: "pointer", position: "relative" }}
        >
          <Icon name="bell" size={15} />
          {notificationCount > 0 && (
            <span aria-hidden="true" style={{ position: "absolute", top: 5, right: 5, width: 8, height: 8, borderRadius: "50%", background: "var(--err)", border: "1.5px solid var(--bg-elev)" }} />
          )}
        </button>
      </div>
    </header>
  );
}
