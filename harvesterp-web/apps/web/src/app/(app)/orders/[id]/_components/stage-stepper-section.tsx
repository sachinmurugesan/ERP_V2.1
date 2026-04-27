"use client";

import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  CarryForwardStepper,
  type StepperStep,
  type StepStatus,
} from "@/components/composed/carry-forward-stepper";
import type {
  OrderTimelineResponse,
  TimelineEntry,
  TimelineEntryStatus,
  NextStagesResponse,
  StageOption,
} from "./types";

/**
 * <StageStepperSection> — the 17-stage horizontal stepper + override history.
 *
 * Mirrors `OrderDetail.vue:539-631`:
 *   - One step per timeline[] entry, ~17 total.
 *   - Backend's `unlocked` status (forward-jump high-water-mark) maps
 *     directly to the stepper's new `unlocked` status (added in commit 3).
 *   - Clicking an `unlocked` step calls onJumpToStage with the matching
 *     reachable_forward target.
 *   - Clicking a `complete` step calls onJumpBackToStage if it's in
 *     reachable_previous.
 *   - Override history is collapsible — only renders when overrides[].length > 0.
 *
 * Responsive:
 *   - Desktop (≥lg): horizontal full-width
 *   - Tablet (md→lg): horizontal compact
 *   - Mobile (<md): vertical inside <details> (collapsed by default)
 */

interface StageStepperSectionProps {
  timeline: OrderTimelineResponse | null;
  nextStages: NextStagesResponse | null;
  onJumpToStage: (target: StageOption) => void;
  onJumpBackToStage: (target: StageOption) => void;
}

function backendStatusToStepStatus(s: TimelineEntryStatus): StepStatus {
  switch (s) {
    case "completed":
      return "complete";
    case "current":
      return "current";
    case "unlocked":
      return "unlocked";
    case "pending":
    case "locked":
    default:
      return "upcoming";
  }
}

function timelineEntryToStep(entry: TimelineEntry): StepperStep {
  return {
    id: `s${entry.stage}`,
    label: entry.name,
    status: backendStatusToStepStatus(entry.status),
  };
}

/**
 * Decide what to do when a stepper circle is clicked.
 *
 * `unlocked` → forward jump to the stage if it's in reachable_forward.
 * `complete` → backward jump if it's in reachable_previous.
 * Anything else → no-op.
 */
function buildClickHandler(
  timeline: OrderTimelineResponse,
  nextStages: NextStagesResponse | null,
  onJumpForward: (target: StageOption) => void,
  onJumpBack: (target: StageOption) => void,
) {
  return function handleClick(stepIndex: number, step: StepperStep): void {
    if (!nextStages) return;
    const entry = timeline.timeline[stepIndex];
    if (!entry) return;
    if (step.status === "unlocked") {
      const target = nextStages.reachable_forward.find(
        (s) => s.stage === entry.stage,
      );
      if (target) onJumpForward(target);
      return;
    }
    if (step.status === "complete") {
      const target = nextStages.reachable_previous.find(
        (s) => s.stage === entry.stage,
      );
      if (target) onJumpBack(target);
    }
  };
}

export function StageStepperSection({
  timeline,
  nextStages,
  onJumpToStage,
  onJumpBackToStage,
}: StageStepperSectionProps): React.ReactElement | null {
  const [showOverrides, setShowOverrides] = React.useState(false);

  if (!timeline) return null;

  const steps = timeline.timeline.map(timelineEntryToStep);
  const handleStepClick = buildClickHandler(
    timeline,
    nextStages,
    onJumpToStage,
    onJumpBackToStage,
  );

  const hasOverrides = (timeline.overrides?.length ?? 0) > 0;

  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-4"
      aria-label="Stage progression"
    >
      {/* Mobile: collapsed <details> with vertical stepper */}
      <details className="md:hidden" data-testid="stepper-mobile-details">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">
          View progress (S{timeline.current_stage} of {steps.length})
        </summary>
        <div className="mt-3">
          <CarryForwardStepper
            steps={steps}
            orientation="vertical"
            compact
            onStepClick={handleStepClick}
          />
        </div>
      </details>

      {/* Tablet (md→lg): compact horizontal */}
      <div
        className="hidden md:block lg:hidden"
        data-testid="stepper-tablet"
      >
        <CarryForwardStepper
          steps={steps}
          orientation="horizontal"
          compact
          onStepClick={handleStepClick}
        />
      </div>

      {/* Desktop (≥lg): full horizontal */}
      <div className="hidden lg:block" data-testid="stepper-desktop">
        <CarryForwardStepper
          steps={steps}
          orientation="horizontal"
          onStepClick={handleStepClick}
        />
      </div>

      {/* Override history — collapsible, only when overrides exist */}
      {hasOverrides ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setShowOverrides((s) => !s)}
            className="flex w-full items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-800"
            aria-expanded={showOverrides}
            aria-controls="override-history-list"
          >
            {showOverrides ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
            Stage Override History ({timeline.overrides.length})
          </button>
          {showOverrides ? (
            <ul
              id="override-history-list"
              className="mt-2 space-y-1 text-xs text-slate-600"
            >
              {timeline.overrides.map((o, i) => (
                <li key={`${o.stage}-${i}`} className="flex gap-2">
                  <span className="font-mono text-amber-700">S{o.stage}</span>
                  <span>{o.reason}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
