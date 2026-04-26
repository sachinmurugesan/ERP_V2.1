/**
 * carry-forward-stepper.test.tsx — Unit tests for the lifted
 * CarryForwardStepper composed component.
 */

import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";

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
