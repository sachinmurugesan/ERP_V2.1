import * as React from "react";
import Link from "next/link";
import { Icon } from "@/components/design-system/icon";

/**
 * Three empty-state variants for the products list, per Section 10
 * CTA rule:
 *   - Fresh: no products yet, CTA gated by RoleGate for PRODUCT_CREATE
 *   - Filtered: filters hide all rows, CTA is Clear Filters
 *   - Bin empty: nothing to do, no CTA
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
        <Icon name="inventory" size={22} />
      </span>
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", margin: 0 }}>
        No products yet.
      </p>
      <p
        style={{
          fontSize: 12,
          color: "var(--fg-muted)",
          margin: 0,
          textAlign: "center",
        }}
      >
        When you add a product it will appear here.
      </p>
      {canCreate && (
        <Link href="/products/new" className="btn btn-sm btn-primary">
          <Icon name="plus" size={13} />
          Add your first product
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
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", margin: 0 }}>
        No products match this filter.
      </p>
      <button type="button" onClick={onClear} className="btn btn-sm btn-secondary">
        Clear filters
      </button>
    </div>
  );
}

export function BinEmptyState(): React.ReactElement {
  return (
    <div
      role="status"
      style={{
        padding: "40px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
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
        <Icon name="close" size={18} />
      </span>
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", margin: 0 }}>
        Bin is empty.
      </p>
    </div>
  );
}
