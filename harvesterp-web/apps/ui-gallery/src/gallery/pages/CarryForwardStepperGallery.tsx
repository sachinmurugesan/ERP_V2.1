import { CarryForwardStepper, type StepperStep } from "@/components/composed/carry-forward-stepper";
import { GallerySection } from "../GallerySection";

const STEPS_COMPLETE: StepperStep[] = [
  { id: "pending", label: "Pending", status: "complete", timestamp: "2026-03-01" },
  { id: "in-order", label: "In Order", status: "complete", timestamp: "2026-03-10" },
  { id: "fulfilled", label: "Fulfilled", status: "complete", timestamp: "2026-04-02" },
];

const STEPS_IN_PROGRESS: StepperStep[] = [
  { id: "pending", label: "Pending", status: "complete", timestamp: "2026-03-01" },
  { id: "in-order", label: "In Order", status: "current" },
  { id: "fulfilled", label: "Fulfilled", status: "upcoming" },
];

const STEPS_BLOCKED: StepperStep[] = [
  { id: "pending", label: "Pending", status: "complete" },
  { id: "in-order", label: "In Order", status: "blocked" },
  { id: "fulfilled", label: "Fulfilled", status: "upcoming" },
];

const STEPS_EXTENDED: StepperStep[] = [
  { id: "pi", label: "PI Confirmed", status: "complete" },
  { id: "production", label: "In Production", status: "complete" },
  { id: "booking", label: "Booking", status: "current" },
  { id: "sailing", label: "Sailing", status: "upcoming" },
  { id: "delivered", label: "Delivered", status: "upcoming" },
];

export function CarryForwardStepperGallery() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-xl font-semibold">CarryForwardStepper (P-005)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Extracted from 4 independent implementations across client and internal portals.
          Replaces STEPPER_STEPS constants + stepperState() in ClientAfterSales, ClientReturnsPending,
          AfterSales, ReturnsPending.
        </p>
      </div>

      <GallerySection title="Horizontal — all complete" stacked>
        <div className="w-full max-w-lg">
          <CarryForwardStepper steps={STEPS_COMPLETE} />
        </div>
      </GallerySection>

      <GallerySection title="Horizontal — in progress" stacked>
        <div className="w-full max-w-lg">
          <CarryForwardStepper steps={STEPS_IN_PROGRESS} />
        </div>
      </GallerySection>

      <GallerySection title="Horizontal — blocked" stacked>
        <div className="w-full max-w-lg">
          <CarryForwardStepper steps={STEPS_BLOCKED} />
        </div>
      </GallerySection>

      <GallerySection title="Horizontal — compact (5 steps)" stacked>
        <div className="w-full max-w-2xl">
          <CarryForwardStepper steps={STEPS_EXTENDED} compact />
        </div>
      </GallerySection>

      <GallerySection title="Vertical — in progress" stacked>
        <div className="w-60">
          <CarryForwardStepper steps={STEPS_IN_PROGRESS} orientation="vertical" />
        </div>
      </GallerySection>
    </div>
  );
}
