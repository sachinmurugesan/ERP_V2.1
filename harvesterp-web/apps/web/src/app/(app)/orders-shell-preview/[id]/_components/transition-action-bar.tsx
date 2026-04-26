"use client";

import * as React from "react";
import { canAccess, Resource, type UserRole } from "@harvesterp/lib";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/primitives/dropdown-menu";
import type { NextStagesResponse, StageOption } from "./types";

/**
 * <TransitionActionBar> — the row of stage-action buttons.
 *
 * Mirrors `OrderDetail.vue:680-717`:
 *   - Go back button (when prev_stage exists)
 *   - Return to S{n} forward-jump button(s) (when reachable_forward non-empty)
 *   - One "Next: S{n} · {name}" button per next_stages entry
 *
 * Role-gated to ORDER_TRANSITION (ADMIN | OPERATIONS | SUPER_ADMIN).
 *
 * Mobile (<md): collapses into a primary "Advance" button + DropdownMenu
 * containing all other actions, to save vertical space.
 *
 * Disabled-while-busy: `pending` flag from parent.
 */

interface TransitionActionBarProps {
  nextStages: NextStagesResponse | null;
  role: UserRole | undefined;
  pending: boolean;
  onAdvance: (target: StageOption) => void;
  onGoBack: () => void;
  onReturnTo: (target: StageOption) => void;
}

export function TransitionActionBar({
  nextStages,
  role,
  pending,
  onAdvance,
  onGoBack,
  onReturnTo,
}: TransitionActionBarProps): React.ReactElement | null {
  if (!role || !canAccess(role, Resource.ORDER_TRANSITION)) {
    return null;
  }
  if (!nextStages) return null;

  const { next_stages, prev_stage, reachable_forward } = nextStages;
  const hasAnyAction =
    next_stages.length > 0 ||
    prev_stage !== null ||
    reachable_forward.length > 0;
  if (!hasAnyAction) return null;

  // Mobile primary action: prefer the first next_stages forward button;
  // fall back to "Return to {last reachable_forward}" then "Go back".
  const mobilePrimary: { label: string; action: () => void } | null =
    next_stages.length > 0
      ? {
          label: `Next: S${next_stages[0].stage} · ${next_stages[0].name}`,
          action: () => onAdvance(next_stages[0]),
        }
      : reachable_forward.length > 0
      ? {
          label: `Return to S${reachable_forward[reachable_forward.length - 1].stage}`,
          action: () =>
            onReturnTo(reachable_forward[reachable_forward.length - 1]),
        }
      : prev_stage
      ? { label: `Go back to S${prev_stage.stage}`, action: onGoBack }
      : null;

  return (
    <section
      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3"
      aria-label="Stage transition actions"
    >
      {/* Desktop + tablet: full button row */}
      <div className="hidden flex-wrap items-center gap-2 md:flex" data-testid="transition-bar-desktop">
        {prev_stage ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onGoBack}
            disabled={pending}
            aria-label={`Go back to ${prev_stage.name}`}
          >
            <ArrowLeft size={14} />
            Go back
          </Button>
        ) : null}

        {reachable_forward.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onReturnTo(reachable_forward[reachable_forward.length - 1])
            }
            disabled={pending}
            aria-label={`Return to stage ${reachable_forward[reachable_forward.length - 1].stage}`}
          >
            <RotateCcw size={14} />
            Return to S{reachable_forward[reachable_forward.length - 1].stage}
          </Button>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {next_stages.map((ns) => (
            <Button
              key={ns.status}
              size="sm"
              onClick={() => onAdvance(ns)}
              disabled={pending}
              aria-label={`Advance to ${ns.name}`}
            >
              <ArrowRight size={14} />
              Next: S{ns.stage} · {ns.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Mobile (<md): primary button + DropdownMenu of secondary actions */}
      <div className="flex w-full items-center gap-2 md:hidden" data-testid="transition-bar-mobile">
        {mobilePrimary ? (
          <Button
            size="sm"
            onClick={mobilePrimary.action}
            disabled={pending}
            className="flex-1"
          >
            {mobilePrimary.label}
          </Button>
        ) : null}
        {/* Show kebab if there are MORE actions beyond the primary */}
        {next_stages.length + (prev_stage ? 1 : 0) + reachable_forward.length >
        1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                aria-label="More stage actions"
                disabled={pending}
              >
                ⋯
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {next_stages.slice(1).map((ns) => (
                <DropdownMenuItem
                  key={ns.status}
                  onSelect={() => onAdvance(ns)}
                >
                  Advance to S{ns.stage} · {ns.name}
                </DropdownMenuItem>
              ))}
              {reachable_forward.length > 0
                ? reachable_forward
                    .slice(0, -1)
                    .map((rf) => (
                      <DropdownMenuItem
                        key={`rf-${rf.stage}`}
                        onSelect={() => onReturnTo(rf)}
                      >
                        Return to S{rf.stage} · {rf.name}
                      </DropdownMenuItem>
                    ))
                : null}
              {prev_stage ? (
                <DropdownMenuItem onSelect={onGoBack}>
                  Go back to S{prev_stage.stage} · {prev_stage.name}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </section>
  );
}
