"use client";

import * as React from "react";

export interface BulkFieldProps {
  label: string;
  placeholder: string;
  options?: readonly string[];
  onApply: (value: string) => Promise<void>;
  disabled?: boolean;
}

/**
 * One bulk-edit field: input + inline Apply button.
 *
 * - `options` array renders either a native `<select>` (for Type / enum
 *   values) or an autocomplete `<datalist>` (for Category / Material /
 *   HSN / Brand where the dataset is open-ended).
 * - `onApply` is awaited; submitting disables the button and flashes
 *   a local success/error flag.
 */
export function BulkField({
  label,
  placeholder,
  options,
  onApply,
  disabled = false,
}: BulkFieldProps): React.ReactElement {
  const [value, setValue] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const listId = `bulk-${label.toLowerCase().replace(/\s+/g, "-")}-list`;
  const isFixedOptions = Boolean(options && options.length > 0 && label === "Type");

  const canApply = value.trim().length > 0 && !submitting && !disabled;

  const handleApply = async (): Promise<void> => {
    if (!canApply) return;
    setSubmitting(true);
    try {
      await onApply(value.trim());
      setValue("");
    } finally {
      setSubmitting(false);
    }
  };

  const inputEl = isFixedOptions ? (
    <select
      aria-label={label}
      className="input"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      disabled={disabled || submitting}
      style={{ height: 32, fontSize: 12, minWidth: 120 }}
    >
      <option value="">{placeholder}</option>
      {options!.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  ) : (
    <>
      <input
        aria-label={label}
        className="input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled || submitting}
        list={options ? listId : undefined}
        style={{ height: 32, fontSize: 12, minWidth: 120 }}
      />
      {options && options.length > 0 && (
        <datalist id={listId}>
          {options.map((opt) => (
            <option key={opt} value={opt} />
          ))}
        </datalist>
      )}
    </>
  );

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        flex: "1 1 180px",
        minWidth: 0,
      }}
    >
      <span
        className="label"
        style={{ color: "var(--fg-muted)", whiteSpace: "nowrap" }}
      >
        {label}
      </span>
      {inputEl}
      <button
        type="button"
        onClick={handleApply}
        disabled={!canApply}
        className="btn btn-sm btn-secondary"
        style={{
          height: 28,
          opacity: canApply ? 1 : 0.5,
          cursor: canApply ? "pointer" : "not-allowed",
        }}
      >
        {submitting ? "\u2026" : "Apply"}
      </button>
    </div>
  );
}
