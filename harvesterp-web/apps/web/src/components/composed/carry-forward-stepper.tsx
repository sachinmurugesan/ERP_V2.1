"use client";

/**
 * <CarryForwardStepper> — P-005 canonical implementation.
 *
 * Lifted verbatim from `apps/ui-gallery/src/components/composed/carry-forward-stepper.tsx`
 * for the orders-foundation PR. Foundation for the future order-detail
 * `<StageStepper>` (research §5.6) and reused by the Payments tab,
 * Shipping tab, and Order Draft wizard.
 *
 * Statuses:
 *   "complete"  → green check mark
 *   "current"   → blue pulsing indicator (active step)
 *   "upcoming"  → gray circle (not yet reached)
 *   "blocked"   → red X (error/blocked state)
 *
 * Works in both horizontal and vertical orientations.
 */

import * as React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type StepStatus = "complete" | "current" | "upcoming" | "blocked";

export interface StepperStep {
  id: string;
  label: string;
  status: StepStatus;
  /** Optional ISO timestamp (or any string) shown below the label. */
  timestamp?: string;
}

export interface CarryForwardStepperProps {
  steps: StepperStep[];
  orientation?: "horizontal" | "vertical";
  compact?: boolean;
  className?: string;
}

// ── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ status }: { status: StepStatus }): React.ReactElement {
  const base =
    "flex items-center justify-center rounded-full border-2 shrink-0";

  switch (status) {
    case "complete":
      return (
        <span
          className={cn(base, "h-8 w-8 border-emerald-600 bg-emerald-600")}
          data-testid="step-complete"
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
            "h-8 w-8 animate-pulse border-blue-600 bg-blue-600",
          )}
          data-testid="step-current"
          aria-label="Current step"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-white" />
        </span>
      );
    case "blocked":
      return (
        <span
          className={cn(base, "h-8 w-8 border-red-500 bg-red-500")}
          data-testid="step-blocked"
          aria-label="Blocked"
        >
          <X className="h-4 w-4 text-white" strokeWidth={3} />
        </span>
      );
    case "upcoming":
    default:
      return (
        <span
          className={cn(base, "h-8 w-8 border-slate-300 bg-white")}
          data-testid="step-upcoming"
          aria-label="Upcoming"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        </span>
      );
  }
}

// ── Label styling ────────────────────────────────────────────────────────────

function labelClass(status: StepStatus): string {
  switch (status) {
    case "complete":
      return "text-emerald-700 font-medium";
    case "current":
      return "text-blue-700 font-semibold";
    case "blocked":
      return "text-red-600 font-medium";
    default:
      return "text-slate-500";
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function CarryForwardStepper({
  steps,
  orientation = "horizontal",
  compact = false,
  className,
}: CarryForwardStepperProps): React.ReactElement {
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
              {idx < steps.length - 1 ? (
                <div
                  className={cn(
                    "my-1 w-0.5 flex-1",
                    step.status === "complete"
                      ? "bg-emerald-400"
                      : "bg-slate-200",
                  )}
                  style={{ minHeight: compact ? "20px" : "32px" }}
                />
              ) : null}
            </div>
            <div className={cn(compact ? "pb-2" : "pb-6")}>
              <p className={cn("text-sm", labelClass(step.status))}>
                {step.label}
              </p>
              {step.timestamp ? (
                <p className="mt-0.5 text-xs text-slate-400">
                  {step.timestamp}
                </p>
              ) : null}
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
            {idx < steps.length - 1 ? (
              <div
                className={cn(
                  "h-0.5 flex-1",
                  step.status === "complete"
                    ? "bg-emerald-400"
                    : "bg-slate-200",
                )}
              />
            ) : null}
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
            {step.timestamp ? (
              <p className="mt-0.5 text-[10px] text-slate-400">
                {step.timestamp}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
