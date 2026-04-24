import * as React from "react";

/**
 * StageChip — shared chip for order workflow stages.
 *
 * Stages 1–14 map to semantic chip tones (neutral / warn / info / accent / ok).
 * Stages ≥15 (DELIVERED / AFTER_SALES / COMPLETED) fall back to the neutral
 * chip so they're distinct from Stage 1 slate but don't mis-signal urgency —
 * see the dashboard migration's Issue 1 for the reasoning.
 *
 * Used by both the dashboard (Active Shipments) and the orders list. Before
 * this lift, the component was copy-pasted into both pages; the refactor
 * extracts it so future pages can import from one place.
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
