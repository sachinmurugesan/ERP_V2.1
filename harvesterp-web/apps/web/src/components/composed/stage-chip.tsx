import * as React from "react";

/**
 * StageChip — shared chip for order workflow stages.
 *
 * Covers all 17 stages of the canonical workflow (0..17 inclusive of
 * CLIENT_DRAFT). Source of truth: `ERP_V1/backend/enums.py:258-282
 * STAGE_MAP`. The `frontend/src/utils/constants.js` 18-stage list with
 * a phantom `FACTORY_PAYMENT` is a Vue-side bug — NOT mirrored here.
 *
 * Tone scheme (mirrors the existing pattern + extends it for 0/15-17):
 *   0:    chip           (CLIENT_DRAFT — pre-pipeline inquiry; neutral)
 *   1:    chip           (DRAFT)
 *   2-4:  chip chip-warn (PENDING_PI / PI_SENT / ADVANCE_*)
 *   5-10: chip chip-info (FACTORY_ORDERED through FINAL_PI)
 *   11-12: chip chip-accent (PRODUCTION_100 / BOOKED — brand emerald; "we're moving")
 *   13-14: chip chip-ok  (LOADED/SAILED/ARRIVED through CUSTOMS — green; "in transit / cleared")
 *   15:   chip chip-ok   (DELIVERED — done; green)
 *   16:   chip chip-ok   (AFTER_SALES — post-completion service; green stays consistent with 15)
 *   17:   chip chip-accent (COMPLETED — brand emerald; terminal good)
 *
 * Used by the dashboard (Active Shipments), orders list, and any future
 * order-detail-shaped page that renders a stage indicator.
 *
 * Stage extension to 0 + 15-17 was done in the orders-foundation PR
 * (research §5.5 finding — backend has 17 stages; previous coverage was
 * only 1-14, which made stages 0/15/16/17 silently fall through to neutral).
 */

type ChipTone =
  | "chip"
  | "chip chip-accent"
  | "chip chip-info"
  | "chip chip-ok"
  | "chip chip-warn"
  | "chip chip-err";

const STAGE_TONE: Record<number, ChipTone> = {
  0: "chip",
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
  15: "chip chip-ok",
  16: "chip chip-ok",
  17: "chip chip-accent",
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
