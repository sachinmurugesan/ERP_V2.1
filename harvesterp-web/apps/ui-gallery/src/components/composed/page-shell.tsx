"use client";

/**
 * <PageShell> — standard page chrome for every HarvestERP Next.js page.
 *
 * Provides: page title (h1), optional breadcrumbs, optional action slot,
 * and a content area. Replaces inline header patterns from every Vue page.
 *
 * At Task 7: breadcrumb hrefs will wire to Next.js <Link> instead of <a>.
 * The `onNavigate` prop abstracts the router dependency for Vite demo use.
 *
 * "use client" — interactive breadcrumb clicks need client context.
 */

import * as React from "react";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string;
  /** Optional href — when absent, item renders as plain text (current page). */
  href?: string;
}

export interface PageShellProps {
  /** Page heading — rendered as <h1>. */
  title: string;
  /** Optional breadcrumb trail. Home is always prepended automatically. */
  breadcrumbs?: BreadcrumbItem[];
  /**
   * Right-aligned action slot (buttons, dropdowns, etc.).
   * Rendered to the right of the title row.
   */
  actions?: React.ReactNode;
  children: React.ReactNode;
  /**
   * Navigation callback — Vite demo uses react-router navigate();
   * Task 7 will wire to Next.js router.push().
   * When absent, breadcrumbs render as plain <a> tags.
   */
  onNavigate?: (href: string) => void;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────

export function PageShell({
  title,
  breadcrumbs,
  actions,
  children,
  onNavigate,
  className,
}: PageShellProps) {
  const handleNav = (href: string, e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onNavigate) {
      e.preventDefault();
      onNavigate(href);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1 text-sm text-muted-foreground">
            <li>
              <a
                href="/"
                onClick={(e) => handleNav("/", e)}
                className="flex items-center gap-1 hover:text-foreground transition-colors"
                aria-label="Home"
              >
                <Home className="h-3.5 w-3.5" />
              </a>
            </li>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                <li aria-hidden>
                  <ChevronRight className="h-3.5 w-3.5" />
                </li>
                <li>
                  {crumb.href && idx < breadcrumbs.length - 1 ? (
                    <a
                      href={crumb.href}
                      onClick={(e) => crumb.href && handleNav(crumb.href, e)}
                      className="hover:text-foreground transition-colors"
                    >
                      {crumb.label}
                    </a>
                  ) : (
                    <span
                      className="text-foreground font-medium"
                      aria-current="page"
                    >
                      {crumb.label}
                    </span>
                  )}
                </li>
              </React.Fragment>
            ))}
          </ol>
        </nav>
      )}

      {/* Title + actions row */}
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {actions && (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
