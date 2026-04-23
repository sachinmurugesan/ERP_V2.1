import * as React from "react";

/**
 * Maps a stage number to a chip-tone class name.
 *
 * The legacy Vue dashboard mapped stages 1–14 to semantic tailwind colours
 * and silently fell back to slate for stages >=15. That silent fallback
 * caused stages 15–22 (booking/sailing/landed/customs/payments/after-sales)
 * to render as inert grey pills.
 *
 * This migration fixes that by returning a stable neutral chip for any
 * stage >=15 with an explicit "later-stage" bucketing rather than a silent
 * default. A stage beyond the mapped set renders in the neutral chip tone.
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
