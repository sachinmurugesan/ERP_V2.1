"use client";

/**
 * <CarryForwardStepper> — P-005 canonical implementation.
 *
 * Lifted from `apps/ui-gallery/...` in the orders-foundation PR. Extended in
 * feat/order-detail-shell with a 5th status (`unlocked`) so it can power the
 * order-detail StageStepper — clickable amber circles for forward-jump
 * targets are a hard requirement for that page.
 *
 * Statuses:
 *   "complete"  → green check (finished step)
 *   "current"   → blue pulsing dot (active step)
 *   "upcoming"  → gray ring (not yet reached)
 *   "blocked"   → red X (error / cannot proceed)
 *   "unlocked"  → amber circle with open-padlock icon — high-water-mark for
 *                 a forward-jump target. Renders as clickable when
 *                 `onStepClick` is supplied; otherwise visually distinct but
 *                 inert.
 *
 * Works in both horizontal and vertical orientations.
 */

import * as React from "react";
import { Check, LockOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type StepStatus =
  | "complete"
  | "current"
  | "upcoming"
  | "blocked"
  | "unlocked";

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
  /**
   * Optional callback fired when a step's indicator is clicked. Used by the
   * order-detail StageStepper to route stepper-circle clicks to
   * `confirmJumpToStage` (forward jump on `unlocked`, backward jump on
   * `complete` if it's in the reachable-previous set).
   *
   * The component itself does NOT decide which steps are clickable — it
   * passes every click through. The parent decides whether to act on a given
   * step's status.
   */
  onStepClick?: (stepIndex: number, step: StepperStep) => void;
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
    case "unlocked":
      return (
        <span
          className={cn(base, "h-8 w-8 border-amber-500 bg-amber-100")}
          data-testid="step-unlocked"
          aria-label="Unlocked — jump forward to this stage"
        >
          <LockOpen className="h-4 w-4 text-amber-700" strokeWidth={2.5} />
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
    case "unlocked":
      return "text-amber-700 font-medium";
    default:
      return "text-slate-500";
  }
}

/**
 * Wrapper that adds keyboard / mouse interactivity around the indicator
 * when an `onStepClick` is provided. We use a real <button> for a11y
 * (focus ring, Enter/Space activation, screen-reader role).
 */
interface ClickableIndicatorProps {
  step: StepperStep;
  index: number;
  onStepClick: ((stepIndex: number, step: StepperStep) => void) | undefined;
}

function ClickableIndicator({
  step,
  index,
  onStepClick,
}: ClickableIndicatorProps): React.ReactElement {
  if (!onStepClick) {
    return <StepIndicator status={step.status} />;
  }
  return (
    <button
      type="button"
      onClick={() => onStepClick(index, step)}
      title={
        step.status === "unlocked"
          ? "Jump forward to this stage"
          : step.status === "complete"
          ? "Jump back to this stage"
          : step.label
      }
      aria-label={`${step.label} — ${step.status}`}
      className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
    >
      <StepIndicator status={step.status} />
    </button>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function CarryForwardStepper({
  steps,
  orientation = "horizontal",
  compact = false,
  className,
  onStepClick,
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
              <ClickableIndicator
                step={step}
                index={idx}
                onStepClick={onStepClick}
              />
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
            <ClickableIndicator
              step={step}
              index={idx}
              onStepClick={onStepClick}
            />
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
