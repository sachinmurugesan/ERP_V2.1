"use client";

import * as React from "react";

/**
 * Inline error panel with a Retry action.
 *
 * Each dashboard section renders this in-place when its fetch fails, so a
 * single endpoint failure does not cascade-blank the whole page. The retry
 * handler typically invalidates the React Query cache or rethrows from an
 * RSC-driven boundary.
 */
export function ErrorCard({
  message,
  onRetry,
  retryLabel = "Retry",
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}): React.ReactElement {
  return (
    <div
      role="alert"
      style={{
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        background: "color-mix(in oklch, var(--err) 6%, transparent)",
        border: "1px solid color-mix(in oklch, var(--err) 20%, transparent)",
        borderRadius: "var(--r-md)",
        margin: 16,
      }}
    >
      <p style={{ fontSize: 13, color: "var(--err)", margin: 0, fontWeight: 500 }}>
        {message}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-sm btn-secondary">
          {retryLabel}
        </button>
      )}
    </div>
  );
}
