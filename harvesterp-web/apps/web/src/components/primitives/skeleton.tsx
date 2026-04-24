"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton — shimmer placeholder for loading states.
 *
 * Pairs with Tailwind's `animate-pulse`. Used in LedgerPage's loading
 * state (summary cards + table rows).
 */

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

function Skeleton({ className, ...props }: SkeletonProps): React.ReactElement {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-slate-200/60", className)}
      {...props}
    />
  );
}

export { Skeleton };
