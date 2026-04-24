"use client";

import * as React from "react";
import type { ViewMode } from "./types";

export interface BinTabsProps {
  active: ViewMode;
  productsCount: number;
  binCount: number;
  onChange: (next: ViewMode) => void;
}

/**
 * Two pill buttons inside the card header. Matches the Vue source's
 * same-page tab toggle — no URL change.
 */
export function BinTabs({
  active,
  productsCount,
  binCount,
  onChange,
}: BinTabsProps): React.ReactElement {
  return (
    <div
      role="tablist"
      aria-label="Products view"
      style={{ display: "inline-flex", gap: 6 }}
    >
      <Tab
        label="Products"
        count={productsCount}
        isActive={active === "products"}
        onClick={() => onChange("products")}
      />
      <Tab
        label="Bin"
        count={binCount}
        isActive={active === "bin"}
        onClick={() => onChange("bin")}
      />
    </div>
  );
}

function Tab({
  label,
  count,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className={isActive ? "btn btn-sm btn-secondary" : "btn btn-sm btn-ghost"}
      style={{ gap: 6 }}
    >
      {label}
      <span
        className="num"
        aria-hidden="true"
        style={{
          fontSize: 11,
          opacity: 0.8,
          fontWeight: 700,
        }}
      >
        {count.toLocaleString("en-IN")}
      </span>
    </button>
  );
}
