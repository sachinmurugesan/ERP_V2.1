"use client";

/**
 * <HighlightScrollTarget> — P-022 canonical implementation.
 *
 * Lifted verbatim from `apps/ui-gallery/src/components/composed/highlight-scroll-target.tsx`
 * for the orders-foundation PR. Designed for OrderItemsTab / PaymentsTab /
 * PackingListTab deep-links — when the URL hash matches the section id, the
 * component scrolls into view and applies a brief highlight-flash animation.
 *
 * Pair with the Next.js searchParams pattern: read `searchParams.query` (or
 * the page's anchor query param) on the server, pass through to this component
 * as `currentHash`, and the matching section auto-scrolls + flashes.
 *
 * Accessibility: no ARIA attributes added — the `id` is the natural anchor.
 * No focus disruption; animation is CSS-only via `animate-highlight-flash`
 * (defined in `apps/web/src/app/globals.css` + tailwind.config.ts).
 */

import * as React from "react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HighlightScrollTargetProps {
  /**
   * The section id — matches a URL hash segment (without `#`) or a query-param
   * value passed in via `currentHash`. e.g. id="upload" matches hash="#upload"
   * or `currentHash="upload"`.
   */
  id: string;
  /**
   * Current URL hash (without leading `#`) or query-param value to match
   * against `id`. When equal, the component scrolls + flashes.
   */
  currentHash?: string | undefined;
  children: React.ReactNode;
  /**
   * How long the highlight flash persists in ms. Default 2000.
   * Matches the `highlight-flash` keyframes duration.
   */
  highlightDurationMs?: number;
  className?: string | undefined;
}

// ── Component ────────────────────────────────────────────────────────────────

export function HighlightScrollTarget({
  id,
  currentHash,
  children,
  highlightDurationMs = 2000,
  className,
}: HighlightScrollTargetProps): React.ReactElement {
  const ref = React.useRef<HTMLDivElement>(null);
  const [highlighted, setHighlighted] = React.useState(false);

  const isActive = currentHash === id;

  React.useEffect(() => {
    if (!isActive) return;

    // Scroll into view on next tick so the DOM is fully painted.
    const scrollTimer = setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlighted(true);
    }, 50);

    // Remove highlight class after the animation completes.
    const clearTimer = setTimeout(() => {
      setHighlighted(false);
    }, highlightDurationMs + 50);

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [isActive, highlightDurationMs]);

  return (
    <div
      ref={ref}
      id={id}
      data-testid={`highlight-target-${id}`}
      className={cn(
        "rounded-md transition-colors",
        highlighted && "animate-highlight-flash",
        className,
      )}
    >
      {children}
    </div>
  );
}
