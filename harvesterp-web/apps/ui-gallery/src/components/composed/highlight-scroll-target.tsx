"use client";

/**
 * <HighlightScrollTarget> — P-022 canonical implementation.
 *
 * Replaces the `highlightSection` prop + nextTick scrollIntoView pattern
 * from OrderItemsTab.vue, PaymentsTab.vue, PackingListTab.vue.
 *
 * Each highlightable section gets an `id` attribute. The parent passes the
 * current URL hash (`location.hash` in Vite demo; `useSearchParams` in
 * Next.js). When the hash matches the id, the component scrolls into view
 * and applies a brief highlight flash animation.
 *
 * Accessibility: no ARIA attributes added — the `id` is the natural anchor.
 * No focus disruption; animation uses CSS only.
 *
 * "use client" — uses useEffect + useRef.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export interface HighlightScrollTargetProps {
  /**
   * The section id — matches a URL hash segment (without `#`).
   * e.g. id="upload" matches hash="#upload".
   */
  id: string;
  /**
   * Current URL hash from the router (without leading `#`).
   * Vite demo: pass `location.hash.slice(1)`.
   * Next.js Task 7: wire to useSearchParams() / usePathname() hash.
   */
  currentHash?: string;
  children: React.ReactNode;
  /**
   * How long the highlight flash persists in ms. Default 2000.
   * Matches the `highlight-flash` Tailwind animation duration.
   */
  highlightDurationMs?: number;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────

export function HighlightScrollTarget({
  id,
  currentHash,
  children,
  highlightDurationMs = 2000,
  className,
}: HighlightScrollTargetProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [highlighted, setHighlighted] = React.useState(false);

  const isActive = currentHash === id;

  React.useEffect(() => {
    if (!isActive) return;

    // Scroll into view on next tick so the DOM is fully painted
    const scrollTimer = setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlighted(true);
    }, 50);

    // Remove highlight class after animation completes
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
