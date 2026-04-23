"use client";

/**
 * <CarryForwardStepper> — P-005 canonical implementation.
 *
 * Extracted from 4 independent implementations in:
 *   ClientAfterSales.vue, ClientReturnsPending.vue, AfterSales.vue, ReturnsPending.vue
 *
 * Statuses:
 *   "complete"  → green check mark
 *   "current"   → blue pulsing indicator (active step)
 *   "upcoming"  → gray circle (not yet reached)
 *   "blocked"   → red X (error/blocked state)
 *
 * Works across both client and internal portals.
 * "use client" — pure render, but keeps directive for Task 7 RSC boundary.
 */

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export type StepStatus = "complete" | "current" | "upcoming" | "blocked";

export interface StepperStep {
  id: string;
  label: string;
  status: StepStatus;
  /** Optional ISO timestamp shown below the label (e.g. completion date). */
  timestamp?: string;
}

export interface CarryForwardStepperProps {
  steps: StepperStep[];
  orientation?: "horizontal" | "vertical";
  compact?: boolean;
  className?: string;
}

// ── Step indicator ─────────────────────────────────────────────────────────

function StepIndicator({ status }: { status: StepStatus }) {
  const base =
    "flex items-center justify-center rounded-full border-2 shrink-0";

  switch (status) {
    case "complete":
      return (
        <span
          className={cn(base, "h-8 w-8 border-green-600 bg-green-600")}
          aria-label="Complete"
        >
          <Check className="h-4 w-4 text-white" strokeWidth={3} />
        </span>
      );
    case "current":
      return (
        <span
          className={cn(
            base,
            "h-8 w-8 border-blue-600 bg-blue-600 animate-pulse",
          )}
          aria-label="Current step"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-white" />
        </span>
      );
    case "blocked":
      return (
        <span
          className={cn(base, "h-8 w-8 border-red-500 bg-red-500")}
          aria-label="Blocked"
        >
          <X className="h-4 w-4 text-white" strokeWidth={3} />
        </span>
      );
    case "upcoming":
    default:
      return (
        <span
          className={cn(base, "h-8 w-8 border-gray-300 bg-background")}
          aria-label="Upcoming"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
        </span>
      );
  }
}

// ── Label styling ──────────────────────────────────────────────────────────

function labelClass(status: StepStatus) {
  switch (status) {
    case "complete":
      return "text-green-700 font-medium";
    case "current":
      return "text-blue-700 font-semibold";
    case "blocked":
      return "text-red-600 font-medium";
    default:
      return "text-muted-foreground";
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export function CarryForwardStepper({
  steps,
  orientation = "horizontal",
  compact = false,
  className,
}: CarryForwardStepperProps) {
  if (orientation === "vertical") {
    return (
      <ol
        aria-label="Progress steps"
        className={cn("flex flex-col gap-0", className)}
      >
        {steps.map((step, idx) => (
          <li key={step.id} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <StepIndicator status={step.status} />
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    "w-0.5 flex-1 my-1",
                    step.status === "complete"
                      ? "bg-green-400"
                      : "bg-gray-200",
                  )}
                  style={{ minHeight: compact ? "20px" : "32px" }}
                />
              )}
            </div>
            <div className={cn("pb-4", compact ? "pb-2" : "pb-6")}>
              <p className={cn("text-sm", labelClass(step.status))}>
                {step.label}
              </p>
              {step.timestamp && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {step.timestamp}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    );
  }

  // Horizontal
  return (
    <ol
      aria-label="Progress steps"
      className={cn(
        "flex items-start",
        compact ? "gap-2" : "gap-0",
        className,
      )}
    >
      {steps.map((step, idx) => (
        <li
          key={step.id}
          className={cn(
            "flex flex-col items-center",
            idx < steps.length - 1 && "flex-1",
          )}
        >
          <div className="flex w-full items-center">
            <StepIndicator status={step.status} />
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 flex-1",
                  step.status === "complete" ? "bg-green-400" : "bg-gray-200",
                )}
              />
            )}
          </div>
          <div
            className={cn(
              "mt-2 text-center",
              compact ? "max-w-[80px]" : "max-w-[120px]",
            )}
          >
            <p className={cn("text-xs leading-tight", labelClass(step.status))}>
              {step.label}
            </p>
            {step.timestamp && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {step.timestamp}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
