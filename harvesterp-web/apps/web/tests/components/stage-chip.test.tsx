/**
 * stage-chip.test.tsx — Unit tests for the StageChip component covering
 * all 17 stages of the canonical workflow (0..17 inclusive of CLIENT_DRAFT).
 *
 * Source-of-truth for the stage list: `ERP_V1/backend/enums.py:258-282
 * STAGE_MAP` — see the orders module audit at
 * `docs/migration/research/orders-complete-audit-2026-04-26.md` §5.
 */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  StageChip,
  stageToneFor,
} from "../../src/components/composed/stage-chip";

// ── stageToneFor — every stage maps to a non-empty class string ──────────────

describe("stageToneFor — coverage of all 17 stages (0..17 inclusive)", () => {
  // Stage 0 — CLIENT_DRAFT (added in orders-foundation PR)
  it("stage 0 (CLIENT_DRAFT) → neutral 'chip'", () => {
    expect(stageToneFor(0)).toBe("chip");
  });

  // Stages 1..14 — pre-existing tone map
  it.each([
    [1, "chip"],
    [2, "chip chip-warn"],
    [3, "chip chip-warn"],
    [4, "chip chip-warn"],
    [5, "chip chip-info"],
    [6, "chip chip-info"],
    [7, "chip chip-info"],
    [8, "chip chip-info"],
    [9, "chip chip-info"],
    [10, "chip chip-info"],
    [11, "chip chip-accent"],
    [12, "chip chip-accent"],
    [13, "chip chip-ok"],
    [14, "chip chip-ok"],
  ])("stage %i → '%s'", (n, expected) => {
    expect(stageToneFor(n)).toBe(expected);
  });

  // Stages 15..17 — added in orders-foundation PR (research §5.5)
  it("stage 15 (DELIVERED) → 'chip chip-ok'", () => {
    expect(stageToneFor(15)).toBe("chip chip-ok");
  });
  it("stage 16 (AFTER_SALES) → 'chip chip-ok'", () => {
    expect(stageToneFor(16)).toBe("chip chip-ok");
  });
  it("stage 17 (COMPLETED) → 'chip chip-accent'", () => {
    expect(stageToneFor(17)).toBe("chip chip-accent");
  });

  // Out-of-range stages fall through to neutral
  it("unknown stage (e.g. 99) falls through to 'chip'", () => {
    expect(stageToneFor(99)).toBe("chip");
  });
  it("phantom FACTORY_PAYMENT (Vue's bogus stage 18) falls through to 'chip'", () => {
    // The Vue frontend constants.js wrongly inserted a phantom FACTORY_PAYMENT
    // as stage 18. Backend has no such stage. StageChip must never render it
    // with a meaningful tone — falling through to neutral is the right defense.
    expect(stageToneFor(18)).toBe("chip");
  });
});

// ── StageChip render tests ───────────────────────────────────────────────────

describe("StageChip — rendering", () => {
  it("renders the stage number prefix (S{n}) plus the stageName", () => {
    render(<StageChip stageNumber={5} stageName="Factory Ordered" />);
    expect(
      screen.getByLabelText(/stage 5: factory ordered/i),
    ).toHaveTextContent("S5 Factory Ordered");
  });

  it("falls back to 'Stage {n}' when stageName is empty", () => {
    render(<StageChip stageNumber={3} stageName="" />);
    expect(screen.getByLabelText(/stage 3: stage 3/i)).toHaveTextContent(
      "S3 Stage 3",
    );
  });

  it("applies the correct tone class for stage 0 (CLIENT_DRAFT)", () => {
    render(<StageChip stageNumber={0} stageName="Client Inquiry" />);
    const chip = screen.getByLabelText(/stage 0: client inquiry/i);
    expect(chip.className).toBe("chip");
  });

  it("applies the correct tone class for stage 17 (COMPLETED)", () => {
    render(<StageChip stageNumber={17} stageName="Completed" />);
    const chip = screen.getByLabelText(/stage 17: completed/i);
    expect(chip.className).toBe("chip chip-accent");
  });

  it("aria-label is the canonical 'Stage N: name' format", () => {
    render(<StageChip stageNumber={11} stageName="Production 100%" />);
    const chip = screen.getByLabelText("Stage 11: Production 100%");
    expect(chip).toBeInTheDocument();
  });
});
