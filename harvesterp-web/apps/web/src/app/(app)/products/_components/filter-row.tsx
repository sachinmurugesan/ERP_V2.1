"use client";

import * as React from "react";
import { Icon } from "@/components/design-system/icon";

export interface FilterRowProps {
  searchInput: string;
  onSearchChange: (next: string) => void;
  categoryValue: string;
  onCategoryChange: (next: string) => void;
  categoryOptions: readonly string[];
  perPage: number;
  onPerPageChange: (next: number) => void;
  perPageOptions?: readonly number[];
  onClearFilters: () => void;
  isFiltered: boolean;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
  anyExpanded?: boolean;
}

const DEFAULT_PER_PAGE_OPTIONS = [25, 50, 100] as const;

export function FilterRow({
  searchInput,
  onSearchChange,
  categoryValue,
  onCategoryChange,
  categoryOptions,
  perPage,
  onPerPageChange,
  perPageOptions = DEFAULT_PER_PAGE_OPTIONS,
  onClearFilters,
  isFiltered,
  onExpandAll,
  onCollapseAll,
  anyExpanded = false,
}: FilterRowProps): React.ReactElement {
  return (
    <div
      style={{
        padding: "12px 18px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <label
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          flex: "1 1 260px",
          maxWidth: 420,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 10,
            color: "var(--fg-subtle)",
            display: "inline-flex",
          }}
        >
          <Icon name="search" size={14} />
        </span>
        <input
          type="search"
          aria-label="Search products by code, name, or material"
          placeholder="Search by code, name, or material…"
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          className="input"
          style={{ paddingLeft: 32 }}
        />
      </label>

      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "var(--fg-muted)",
        }}
      >
        <span className="label" style={{ color: "var(--fg-muted)" }}>
          Category
        </span>
        <select
          aria-label="Filter by category"
          className="input"
          value={categoryValue}
          onChange={(e) => onCategoryChange(e.target.value)}
          style={{ width: "auto", minWidth: 160, fontSize: 13 }}
        >
          <option value="">All categories</option>
          {categoryOptions.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </label>

      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "var(--fg-muted)",
        }}
      >
        <span className="label" style={{ color: "var(--fg-muted)" }}>
          Per page
        </span>
        <select
          aria-label="Rows per page"
          className="input"
          value={perPage}
          onChange={(e) => onPerPageChange(Number(e.target.value))}
          style={{ width: "auto", minWidth: 72, fontSize: 13 }}
        >
          {perPageOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>

      {(onExpandAll || onCollapseAll) && (
        <button
          type="button"
          onClick={anyExpanded ? onCollapseAll : onExpandAll}
          className="btn btn-sm btn-ghost"
        >
          {anyExpanded ? "Collapse all" : "Expand all"}
        </button>
      )}

      {isFiltered && (
        <button
          type="button"
          onClick={onClearFilters}
          className="btn btn-sm btn-ghost"
          style={{ marginLeft: "auto" }}
        >
          <Icon name="close" size={12} />
          Clear filters
        </button>
      )}
    </div>
  );
}
