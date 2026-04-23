import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CarryForwardStepper, type StepperStep } from "@/components/composed/carry-forward-stepper";

const STEPS: StepperStep[] = [
  { id: "pending", label: "Pending", status: "complete", timestamp: "2026-03-01" },
  { id: "in-order", label: "In Order", status: "current" },
  { id: "fulfilled", label: "Fulfilled", status: "upcoming" },
];

const BLOCKED_STEPS: StepperStep[] = [
  { id: "pending", label: "Pending", status: "complete" },
  { id: "in-order", label: "In Order", status: "blocked" },
  { id: "fulfilled", label: "Fulfilled", status: "upcoming" },
];

describe("CarryForwardStepper", () => {
  it("renders without crash", () => {
    render(<CarryForwardStepper steps={STEPS} />);
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("renders all step labels", () => {
    render(<CarryForwardStepper steps={STEPS} />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("In Order")).toBeInTheDocument();
    expect(screen.getByText("Fulfilled")).toBeInTheDocument();
  });

  it("renders timestamp for completed step", () => {
    render(<CarryForwardStepper steps={STEPS} />);
    expect(screen.getByText("2026-03-01")).toBeInTheDocument();
  });

  it('shows "Complete" aria-label for complete step indicator', () => {
    render(<CarryForwardStepper steps={STEPS} />);
    expect(screen.getByLabelText("Complete")).toBeInTheDocument();
  });

  it('shows "Current step" aria-label for current step indicator', () => {
    render(<CarryForwardStepper steps={STEPS} />);
    expect(screen.getByLabelText("Current step")).toBeInTheDocument();
  });

  it('shows "Upcoming" aria-label for upcoming step indicator', () => {
    render(<CarryForwardStepper steps={STEPS} />);
    expect(screen.getByLabelText("Upcoming")).toBeInTheDocument();
  });

  it('shows "Blocked" aria-label for blocked step', () => {
    render(<CarryForwardStepper steps={BLOCKED_STEPS} />);
    expect(screen.getByLabelText("Blocked")).toBeInTheDocument();
  });

  it("renders as ordered list with aria-label", () => {
    render(<CarryForwardStepper steps={STEPS} />);
    expect(screen.getByRole("list", { name: /progress steps/i })).toBeInTheDocument();
  });

  it("renders vertical orientation", () => {
    const { container } = render(
      <CarryForwardStepper steps={STEPS} orientation="vertical" />,
    );
    expect(container.querySelector("ol")).toHaveClass("flex-col");
  });

  it("renders horizontal orientation by default", () => {
    const { container } = render(<CarryForwardStepper steps={STEPS} />);
    expect(container.querySelector("ol")).not.toHaveClass("flex-col");
  });
});
