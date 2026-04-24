"use client";

import * as React from "react";
import { BulkField } from "./bulk-field";
import type { BulkUpdatePayload } from "./types";

export interface BulkActionBarProps {
  selectedCount: number;
  crossPage?: boolean;
  onClear: () => void;
  onDelete: () => void;
  onApplyField: (field: keyof Omit<BulkUpdatePayload, "product_codes">, value: string) => Promise<void>;
  categoryOptions: readonly string[];
  materialOptions?: readonly string[];
  hsCodeOptions?: readonly string[];
  partTypeOptions?: readonly string[];
  brandOptions?: readonly string[];
  lastMessage?: { kind: "ok" | "err"; text: string } | null;
}

const PART_TYPES = ["Original", "Copy", "OEM", "Aftermarket"] as const;

/**
 * Shown between the filter row and the table when `selectedCount > 0`.
 * Per-field Apply buttons (not apply-on-change) — the Phase 2 safer
 * pattern chosen over the audit's immediate-apply intent.
 */
export function BulkActionBar({
  selectedCount,
  crossPage = false,
  onClear,
  onDelete,
  onApplyField,
  categoryOptions,
  materialOptions = [],
  hsCodeOptions = [],
  partTypeOptions = PART_TYPES,
  brandOptions = [],
  lastMessage = null,
}: BulkActionBarProps): React.ReactElement {
  return (
    <div
      role="region"
      aria-label="Bulk actions"
      style={{
        padding: "12px 18px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-sunken)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <p
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--fg)",
            margin: 0,
          }}
        >
          {selectedCount} product{selectedCount === 1 ? "" : "s"} selected
          {crossPage && " (across all pages)"}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onClear}
            className="btn btn-sm btn-ghost"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="btn btn-sm btn-danger"
          >
            Delete Selected
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <BulkField
          label="Category"
          placeholder="Set category"
          options={categoryOptions}
          onApply={(v) => onApplyField("category", v)}
        />
        <BulkField
          label="Material"
          placeholder="Set material"
          options={materialOptions}
          onApply={(v) => onApplyField("material", v)}
        />
        <BulkField
          label="HS Code"
          placeholder="Set HS code"
          options={hsCodeOptions}
          onApply={(v) => onApplyField("hs_code", v)}
        />
        <BulkField
          label="Type"
          placeholder="Select type"
          options={partTypeOptions}
          onApply={(v) => onApplyField("part_type", v)}
        />
        <BulkField
          label="Brand"
          placeholder="Set brand"
          options={brandOptions}
          onApply={(v) => onApplyField("brand", v)}
        />
      </div>

      {lastMessage && (
        <p
          role="status"
          style={{
            fontSize: 12,
            fontWeight: 500,
            margin: 0,
            color:
              lastMessage.kind === "ok" ? "var(--ok)" : "var(--err)",
          }}
        >
          {lastMessage.text}
        </p>
      )}
    </div>
  );
}
