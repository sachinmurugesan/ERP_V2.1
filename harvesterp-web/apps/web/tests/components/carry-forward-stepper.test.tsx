/**
 * carry-forward-stepper.test.tsx — Unit tests for the CarryForwardStepper
 * composed component.
 *
 * Extended in feat/order-detail-shell to cover the 5th `unlocked` status
 * (forward-jump high-water-mark) and the optional `onStepClick` callback
 * that the order-detail StageStepper uses to route stepper-circle clicks
 * to confirmJumpToStage / confirmGoBack.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";

import {
  CarryForwardStepper,
  type StepperStep,
} from "../../src/components/composed/carry-forward-stepper";

const steps: StepperStep[] = [
  { id: "s1", label: "Started", status: "complete", timestamp: "2026-04-25" },
  { id: "s2", label: "In progress", status: "current" },
  { id: "s3", label: "Awaiting review", status: "upcoming" },
  { id: "s4", label: "Failed import", status: "blocked" },
];

// Steps including the new `unlocked` status for the order-detail StageStepper.
const stepsWithUnlocked: StepperStep[] = [
  { id: "s1", label: "Draft", status: "complete" },
  { id: "s2", label: "Pending PI", status: "current" },
  { id: "s3", label: "Production 60%", status: "unlocked" },
  { id: "s4", label: "Plan Packing", status: "upcoming" },
];

describe("CarryForwardStepper — rendering", () => {
  it("renders an ordered list with one li per step", () => {
    render(<CarryForwardStepper steps={steps} />);
    const list = screen.getByRole("list", { name: /progress steps/i });
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
  });

  it("renders each step's label", () => {
    render(<CarryForwardStepper steps={steps} />);
    expect(screen.getByText("Started")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Awaiting review")).toBeInTheDocument();
    expect(screen.getByText("Failed import")).toBeInTheDocument();
  });

  it("renders the timestamp when provided", () => {
    render(<CarryForwardStepper steps={steps} />);
    expect(screen.getByText("2026-04-25")).toBeInTheDocument();
  });
});

describe("CarryForwardStepper — status indicators", () => {
  it("complete status renders the complete indicator", () => {
    render(<CarryForwardStepper steps={[steps[0]]} />);
    expect(screen.getByTestId("step-complete")).toBeInTheDocument();
  });

  it("current status renders the pulsing current indicator", () => {
    render(<CarryForwardStepper steps={[steps[1]]} />);
    const ind = screen.getByTestId("step-current");
    expect(ind).toBeInTheDocument();
    expect(ind.className).toMatch(/animate-pulse/);
  });

  it("upcoming status renders the upcoming indicator", () => {
    render(<CarryForwardStepper steps={[steps[2]]} />);
    expect(screen.getByTestId("step-upcoming")).toBeInTheDocument();
  });

  it("blocked status renders the blocked indicator", () => {
    render(<CarryForwardStepper steps={[steps[3]]} />);
    expect(screen.getByTestId("step-blocked")).toBeInTheDocument();
  });

  it("indicators have aria-labels", () => {
    render(<CarryForwardStepper steps={steps} />);
    expect(screen.getByLabelText("Complete")).toBeInTheDocument();
    expect(screen.getByLabelText("Current step")).toBeInTheDocument();
    expect(screen.getByLabelText("Upcoming")).toBeInTheDocument();
    expect(screen.getByLabelText("Blocked")).toBeInTheDocument();
  });
});

describe("CarryForwardStepper — orientation", () => {
  it("horizontal (default) lays out flex-row with flex-1 connectors between steps", () => {
    const { container } = render(<CarryForwardStepper steps={steps} />);
    const ol = container.querySelector('ol[aria-label="Progress steps"]');
    expect(ol?.className).toMatch(/flex/);
    // First three list items have flex-1 on the wrapper
    const items = ol?.querySelectorAll("li");
    expect(items?.[0].className).toMatch(/flex-1/);
    expect(items?.[1].className).toMatch(/flex-1/);
    expect(items?.[2].className).toMatch(/flex-1/);
    expect(items?.[3].className).not.toMatch(/flex-1/);
  });

  it("vertical orientation lays out flex-col", () => {
    const { container } = render(
      <CarryForwardStepper steps={steps} orientation="vertical" />,
    );
    const ol = container.querySelector('ol[aria-label="Progress steps"]');
    expect(ol?.className).toMatch(/flex-col/);
  });
});

// ── 5th 'unlocked' status (added in feat/order-detail-shell) ────────────────

describe("CarryForwardStepper — unlocked status", () => {
  it("renders the unlocked indicator with amber styling and lock-open icon", () => {
    render(<CarryForwardStepper steps={[stepsWithUnlocked[2]]} />);
    const ind = screen.getByTestId("step-unlocked");
    expect(ind).toBeInTheDocument();
    expect(ind.className).toMatch(/border-amber-500/);
    expect(ind.className).toMatch(/bg-amber-100/);
  });

  it("unlocked indicator has aria-label hinting at jump-forward", () => {
    render(<CarryForwardStepper steps={[stepsWithUnlocked[2]]} />);
    expect(
      screen.getByLabelText(/Unlocked.*jump forward/i),
    ).toBeInTheDocument();
  });

  it("label text uses the amber tone for unlocked steps", () => {
    render(<CarryForwardStepper steps={[stepsWithUnlocked[2]]} />);
    expect(screen.getByText("Production 60%").className).toMatch(
      /text-amber-700/,
    );
  });

  it("renders all 5 statuses cleanly in one stepper without crashing", () => {
    const allFive: StepperStep[] = [
      { id: "1", label: "Done", status: "complete" },
      { id: "2", label: "Now", status: "current" },
      { id: "3", label: "Soon", status: "upcoming" },
      { id: "4", label: "Open", status: "unlocked" },
      { id: "5", label: "Stuck", status: "blocked" },
    ];
    render(<CarryForwardStepper steps={allFive} />);
    expect(screen.getByTestId("step-complete")).toBeInTheDocument();
    expect(screen.getByTestId("step-current")).toBeInTheDocument();
    expect(screen.getByTestId("step-upcoming")).toBeInTheDocument();
    expect(screen.getByTestId("step-unlocked")).toBeInTheDocument();
    expect(screen.getByTestId("step-blocked")).toBeInTheDocument();
  });
});

// ── onStepClick callback (added in feat/order-detail-shell) ─────────────────

describe("CarryForwardStepper — onStepClick callback", () => {
  it("when onStepClick is provided, every indicator wraps in a <button>", () => {
    const onStepClick = vi.fn();
    render(
      <CarryForwardStepper
        steps={stepsWithUnlocked}
        onStepClick={onStepClick}
      />,
    );
    // 4 steps → 4 buttons, each containing one indicator
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(4);
  });

  it("when onStepClick is NOT provided, no <button> elements are rendered", () => {
    render(<CarryForwardStepper steps={stepsWithUnlocked} />);
    // Indicators are inert <span>s
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("clicking the unlocked step calls onStepClick with index + step", () => {
    const onStepClick = vi.fn();
    render(
      <CarryForwardStepper
        steps={stepsWithUnlocked}
        onStepClick={onStepClick}
      />,
    );
    // The unlocked step is at index 2 ("Production 60%")
    const unlockedButton = screen
      .getAllByRole("button")
      [2];
    fireEvent.click(unlockedButton);
    expect(onStepClick).toHaveBeenCalledTimes(1);
    expect(onStepClick).toHaveBeenCalledWith(2, stepsWithUnlocked[2]);
  });

  it("clicking a complete step also fires onStepClick (parent decides whether to act on backward jump)", () => {
    const onStepClick = vi.fn();
    render(
      <CarryForwardStepper
        steps={stepsWithUnlocked}
        onStepClick={onStepClick}
      />,
    );
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onStepClick).toHaveBeenCalledWith(0, stepsWithUnlocked[0]);
  });

  it("button title attribute differs for unlocked vs complete vs other steps", () => {
    const onStepClick = vi.fn();
    render(
      <CarryForwardStepper
        steps={stepsWithUnlocked}
        onStepClick={onStepClick}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons[0].getAttribute("title")).toBe("Jump back to this stage");
    expect(buttons[2].getAttribute("title")).toBe("Jump forward to this stage");
    // Current step gets the label as title fallback
    expect(buttons[1].getAttribute("title")).toBe("Pending PI");
  });
});
