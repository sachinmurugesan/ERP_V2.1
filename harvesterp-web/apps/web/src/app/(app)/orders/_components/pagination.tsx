"use client";

import * as React from "react";
import { Icon } from "@/components/design-system/icon";

export interface PaginationProps {
  page: number;
  perPage: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * Compact Prev/Next pagination with a "Page X of Y · Showing A–B of N"
 * label. Chosen over numbered pages in Phase 2 (decision #7).
 */
export function OrdersPagination({
  page,
  perPage,
  total,
  onPrev,
  onNext,
}: PaginationProps): React.ReactElement | null {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, perPage)));
  if (total === 0) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <nav
      aria-label="Orders pagination"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 18px",
        borderTop: "1px solid var(--border)",
      }}
    >
      <p
        style={{
          fontSize: 12,
          color: "var(--fg-muted)",
          margin: 0,
        }}
      >
        Page <span className="num">{page}</span> of{" "}
        <span className="num">{totalPages}</span>
        {" \u00b7 Showing "}
        <span className="num">{from}</span>&ndash;
        <span className="num">{to}</span> of{" "}
        <span className="num">{total.toLocaleString("en-IN")}</span>
      </p>
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
          aria-current={nextDisabled ? undefined : "page"}
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
    </nav>
  );
}
