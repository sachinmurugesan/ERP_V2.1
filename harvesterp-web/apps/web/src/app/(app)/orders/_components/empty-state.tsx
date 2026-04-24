import * as React from "react";
import Link from "next/link";
import { Icon } from "@/components/design-system/icon";

/**
 * Two empty-state variants for the orders list:
 *   - FreshEmptyState: no orders exist anywhere yet. CTA to create one.
 *   - FilteredEmptyState: filters/search hide all rows. CTA to clear filters.
 */

export function FreshEmptyState({
  canCreate,
}: {
  canCreate: boolean;
}): React.ReactElement {
  return (
    <div
      role="status"
      style={{
        padding: "48px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 48,
          height: 48,
          borderRadius: "var(--r-full)",
          background: "var(--bg-sunken)",
          color: "var(--fg-muted)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="procurement" size={22} />
      </span>
      <p
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--fg)",
          margin: 0,
        }}
      >
        No orders yet.
      </p>
      <p
        style={{
          fontSize: 12,
          color: "var(--fg-muted)",
          margin: 0,
          textAlign: "center",
        }}
      >
        When you create an order it will appear here.
      </p>
      {canCreate && (
        <Link href="/orders/new" className="btn btn-sm btn-primary">
          <Icon name="plus" size={13} />
          Create your first order
        </Link>
      )}
    </div>
  );
}

export function FilteredEmptyState({
  onClear,
}: {
  onClear: () => void;
}): React.ReactElement {
  return (
    <div
      role="status"
      style={{
        padding: "40px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 40,
          height: 40,
          borderRadius: "var(--r-full)",
          background: "var(--bg-sunken)",
          color: "var(--fg-muted)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="filter" size={18} />
      </span>
      <p
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "var(--fg)",
          margin: 0,
        }}
      >
        No orders match this filter.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="btn btn-sm btn-secondary"
      >
        Clear filters
      </button>
    </div>
  );
}
