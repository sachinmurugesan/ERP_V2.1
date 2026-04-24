import * as React from "react";

/**
 * Stage-chip for the orders list.
 *
 * Mirrors the implementation shipped with the dashboard migration
 * (dashboard/_components/stage-chip.tsx). Copied verbatim per the Phase 3
 * plan rather than refactored into a shared location — once a third caller
 * arrives we can lift it into `src/components/composed/`.
 */

type ChipTone =
  | "chip"
  | "chip chip-accent"
  | "chip chip-info"
  | "chip chip-ok"
  | "chip chip-warn"
  | "chip chip-err";

const STAGE_TONE: Record<number, ChipTone> = {
  1: "chip",
  2: "chip chip-warn",
  3: "chip chip-warn",
  4: "chip chip-warn",
  5: "chip chip-info",
  6: "chip chip-info",
  7: "chip chip-info",
  8: "chip chip-info",
  9: "chip chip-info",
  10: "chip chip-info",
  11: "chip chip-accent",
  12: "chip chip-accent",
  13: "chip chip-ok",
  14: "chip chip-ok",
};

export function stageToneFor(stageNumber: number): ChipTone {
  return STAGE_TONE[stageNumber] ?? "chip";
}

export function StageChip({
  stageNumber,
  stageName,
}: {
  stageNumber: number;
  stageName: string;
}): React.ReactElement {
  const tone = stageToneFor(stageNumber);
  const safeName = stageName || `Stage ${stageNumber}`;
  return (
    <span className={tone} aria-label={`Stage ${stageNumber}: ${safeName}`}>
      S{stageNumber} {safeName}
    </span>
  );
}
