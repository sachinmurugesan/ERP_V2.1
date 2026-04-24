"use client";

import * as React from "react";
import { Icon } from "@/components/design-system/icon";
import { computeTotalPages } from "./formatters";

export interface PaginationProps {
  page: number;
  perPage: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onPerPageChange?: (newPerPage: number) => void;
  perPageOptions?: readonly number[];
}

const DEFAULT_PER_PAGE_OPTIONS = [25, 50, 100] as const;

export function ProductsPagination({
  page,
  perPage,
  total,
  onPrev,
  onNext,
  onPerPageChange,
  perPageOptions = DEFAULT_PER_PAGE_OPTIONS,
}: PaginationProps): React.ReactElement | null {
  if (total === 0) return null;
  const totalPages = computeTotalPages(total, perPage);
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <nav
      aria-label="Products pagination"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 18px",
        borderTop: "1px solid var(--border)",
        flexWrap: "wrap",
      }}
    >
      <p style={{ fontSize: 12, color: "var(--fg-muted)", margin: 0 }}>
        Page <span className="num">{page}</span> of{" "}
        <span className="num">{totalPages}</span>
        {" \u00b7 Showing "}
        <span className="num">{from}</span>&ndash;
        <span className="num">{to}</span> of{" "}
        <span className="num">{total.toLocaleString("en-IN")}</span>
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {onPerPageChange && (
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "var(--fg-muted)",
            }}
          >
            Rows per page
            <select
              className="input"
              aria-label="Rows per page"
              value={perPage}
              onChange={(e) => onPerPageChange(Number(e.target.value))}
              style={{ height: 28, padding: "0 10px", fontSize: 12, width: "auto" }}
            >
              {perPageOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        )}

        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={onPrev}
            disabled={prevDisabled}
            aria-label="Previous page"
            className="btn btn-sm btn-secondary"
            style={{
              opacity: prevDisabled ? 0.45 : 1,
              cursor: prevDisabled ? "not-allowed" : "pointer",
            }}
          >
            <Icon name="chevronL" size={13} />
            Prev
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            aria-label="Next page"
            className="btn btn-sm btn-secondary"
            style={{
              opacity: nextDisabled ? 0.45 : 1,
              cursor: nextDisabled ? "not-allowed" : "pointer",
            }}
          >
            Next
            <Icon name="chevronR" size={13} />
          </button>
        </div>
      </div>
    </nav>
  );
}
