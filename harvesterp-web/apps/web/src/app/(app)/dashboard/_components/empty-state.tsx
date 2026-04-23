import * as React from "react";
import Link from "next/link";

/**
 * Shared empty-state card used across dashboard sections.
 *
 * CTA pattern: every empty state includes a named action so users know what
 * to do next. "No active shipments. Create a new order to get started."
 * is the canonical phrasing for this migration.
 */
export function EmptyState({
  message,
  ctaHref,
  ctaLabel,
}: {
  message: string;
  ctaHref?: string;
  ctaLabel?: string;
}): React.ReactElement {
  return (
    <div
      style={{
        padding: "32px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
      }}
    >
      <p style={{ fontSize: 13, color: "var(--fg-muted)", margin: 0 }}>{message}</p>
      {ctaHref && ctaLabel && (
        <Link href={ctaHref} className="btn btn-sm btn-secondary">
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
