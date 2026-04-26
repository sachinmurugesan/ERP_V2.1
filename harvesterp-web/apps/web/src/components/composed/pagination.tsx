"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pagination — shared paged-list footer.
 *
 * Lifted from products `_components/pagination.tsx` (renamed from
 * ProductsPagination). Used by clients-list (this migration) and
 * future cross-list cleanup PR will retroactively migrate orders /
 * products / factories / transporters to this single component.
 *
 * The component is presentation only. Consumer owns page state +
 * fetch (TanStack Query etc.). Renders nothing when `total === 0`.
 */

export interface PaginationProps {
  page: number;
  perPage: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  /** Optional rows-per-page change. When omitted the selector is hidden. */
  onPerPageChange?: ((newPerPage: number) => void) | undefined;
  /** Defaults to [25, 50, 100]. */
  perPageOptions?: readonly number[] | undefined;
  /** Aria label override for the nav. Defaults to "Pagination". */
  label?: string | undefined;
  className?: string | undefined;
}

const DEFAULT_PER_PAGE_OPTIONS = [25, 50, 100] as const;

export function computeTotalPages(total: number, perPage: number): number {
  if (perPage <= 0) return 0;
  return Math.max(1, Math.ceil(total / perPage));
}

export function Pagination({
  page,
  perPage,
  total,
  onPrev,
  onNext,
  onPerPageChange,
  perPageOptions = DEFAULT_PER_PAGE_OPTIONS,
  label = "Pagination",
  className,
}: PaginationProps): React.ReactElement | null {
  if (total === 0) return null;
  const totalPages = computeTotalPages(total, perPage);
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <nav
      aria-label={label}
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3",
        className,
      )}
    >
      <p className="text-xs text-slate-500">
        Page <span className="font-medium text-slate-700">{page}</span> of{" "}
        <span className="font-medium text-slate-700">{totalPages}</span>
        {" · Showing "}
        <span className="font-medium text-slate-700">{from}</span>–
        <span className="font-medium text-slate-700">{to}</span> of{" "}
        <span className="font-medium text-slate-700">
          {total.toLocaleString("en-IN")}
        </span>
      </p>

      <div className="flex items-center gap-2">
        {onPerPageChange ? (
          <label className="inline-flex items-center gap-2 text-xs text-slate-500">
            Rows per page
            <select
              aria-label="Rows per page"
              value={perPage}
              onChange={(e) => onPerPageChange(Number(e.target.value))}
              className="h-8 rounded-md border border-slate-200 bg-transparent px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {perPageOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="flex gap-1">
          <button
            type="button"
            onClick={onPrev}
            disabled={prevDisabled}
            aria-label="Previous page"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ChevronLeft size={12} />
            Prev
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            aria-label="Next page"
            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Next
            <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </nav>
  );
}
