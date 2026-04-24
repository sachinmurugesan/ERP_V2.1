"use client";

import * as React from "react";

export function ProductsErrorCard({
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
      <p
        style={{
          fontSize: 13,
          color: "var(--err)",
          margin: 0,
          fontWeight: 500,
        }}
      >
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-sm btn-secondary"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
