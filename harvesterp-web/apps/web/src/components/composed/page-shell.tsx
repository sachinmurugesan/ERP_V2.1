"use client";

/**
 * <PageShell> — standard page chrome for HarvestERP Next.js pages.
 *
 * Provides: page title (h1), optional breadcrumbs (with auto-prepended
 * Home), and an optional right-aligned action slot. Replaces inline
 * header patterns from every Vue page.
 *
 * Lifted verbatim from `apps/ui-gallery/src/components/composed/page-shell.tsx`
 * for the orders-foundation PR. Uses Next.js `<Link>` directly so callers
 * don't have to thread an `onNavigate` callback.
 *
 * Usage:
 *
 *   <PageShell
 *     title="Orders"
 *     breadcrumbs={[{ label: "Internal", href: "/dashboard" }, { label: "Orders" }]}
 *     actions={<Button>Add</Button>}
 *   >
 *     {children}
 *   </PageShell>
 */

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BreadcrumbItem {
  label: string;
  /** Optional href — when absent (or last in list), item renders as plain text. */
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
  className?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function PageShell({
  title,
  breadcrumbs,
  actions,
  children,
  className,
}: PageShellProps): React.ReactElement {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1 text-sm text-slate-500">
            <li>
              <Link
                href="/dashboard"
                className="flex items-center gap-1 transition-colors hover:text-slate-800"
                aria-label="Home"
              >
                <Home className="h-3.5 w-3.5" />
              </Link>
            </li>
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={`${crumb.label}-${idx}`}>
                  <li aria-hidden>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </li>
                  <li>
                    {crumb.href && !isLast ? (
                      <Link
                        href={crumb.href}
                        className="transition-colors hover:text-slate-800"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span
                        className="font-medium text-slate-800"
                        aria-current="page"
                      >
                        {crumb.label}
                      </span>
                    )}
                  </li>
                </React.Fragment>
              );
            })}
          </ol>
        </nav>
      ) : null}

      {/* Title + actions row */}
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-800">
          {title}
        </h1>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
