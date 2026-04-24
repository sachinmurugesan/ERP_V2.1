"use client";

import * as React from "react";
import { Icon } from "@/components/design-system/icon";

export interface RowCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
}

/**
 * Inline checkbox helper for the products table.
 *
 * Kept local to this page (rather than porting shadcn's checkbox) to
 * match the inline-helper pattern established in the dashboard + orders
 * migrations. Tri-state: unchecked, checked, indeterminate.
 */
export function RowCheckbox({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
  disabled = false,
}: RowCheckboxProps): React.ReactElement {
  const handleClick = (event: React.MouseEvent | React.KeyboardEvent): void => {
    event.stopPropagation();
    onChange(!checked);
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ): void => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      handleClick(event);
    }
  };

  const state: "checked" | "indeterminate" | "unchecked" = indeterminate
    ? "indeterminate"
    : checked
      ? "checked"
      : "unchecked";

  const filled = state !== "unchecked";

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{
        width: 18,
        height: 18,
        borderRadius: "var(--r-xs)",
        background: filled ? "var(--brand-700)" : "var(--bg-elev)",
        border: `1px solid ${filled ? "var(--brand-700)" : "var(--border-strong)"}`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        color: "#fff",
        padding: 0,
        transition: "background .12s, border-color .12s",
      }}
    >
      {state === "checked" && <Icon name="check" size={12} />}
      {state === "indeterminate" && (
        <span
          aria-hidden="true"
          style={{
            display: "block",
            width: 8,
            height: 2,
            background: "#fff",
            borderRadius: 1,
          }}
        />
      )}
    </button>
  );
}
