import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { HighlightScrollTarget } from "@/components/composed/highlight-scroll-target";

// jsdom does not implement scrollIntoView — mock it globally for these tests.
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("HighlightScrollTarget", () => {
  it("renders children", () => {
    render(
      <HighlightScrollTarget id="upload">
        <p>Upload section</p>
      </HighlightScrollTarget>,
    );
    expect(screen.getByText("Upload section")).toBeInTheDocument();
  });

  it("has the correct id attribute", () => {
    render(
      <HighlightScrollTarget id="payment-upload">
        <span>Payment</span>
      </HighlightScrollTarget>,
    );
    const el = screen.getByText("Payment").parentElement;
    expect(el).toHaveAttribute("id", "payment-upload");
  });

  it("does not add aria attributes that disrupt accessibility", () => {
    render(
      <HighlightScrollTarget id="packing">
        <span>Packing</span>
      </HighlightScrollTarget>,
    );
    const parent = screen.getByText("Packing").parentElement!;
    expect(parent).not.toHaveAttribute("aria-live");
    expect(parent).not.toHaveAttribute("aria-atomic");
    expect(parent).not.toHaveAttribute("role");
  });

  it("applies highlight animation class when hash matches", async () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <HighlightScrollTarget id="items" currentHash="">
        <span>Items</span>
      </HighlightScrollTarget>,
    );
    const parent = screen.getByText("Items").parentElement!;
    expect(parent.className).not.toMatch(/animate-highlight-flash/);

    rerender(
      <HighlightScrollTarget id="items" currentHash="items">
        <span>Items</span>
      </HighlightScrollTarget>,
    );

    // Advance past the 50ms scroll delay
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(parent.className).toMatch(/animate-highlight-flash/);
    vi.useRealTimers();
  });

  it("removes highlight class after duration expires", async () => {
    vi.useFakeTimers();
    render(
      <HighlightScrollTarget id="items" currentHash="items" highlightDurationMs={500}>
        <span>Items</span>
      </HighlightScrollTarget>,
    );

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    const parent = screen.getByText("Items").parentElement!;
    expect(parent.className).toMatch(/animate-highlight-flash/);

    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(parent.className).not.toMatch(/animate-highlight-flash/);
    vi.useRealTimers();
  });

  it("does not highlight when hash does not match", () => {
    vi.useFakeTimers();
    render(
      <HighlightScrollTarget id="upload" currentHash="something-else">
        <span>Upload</span>
      </HighlightScrollTarget>,
    );
    const parent = screen.getByText("Upload").parentElement!;
    vi.advanceTimersByTime(200);
    expect(parent.className).not.toMatch(/animate-highlight-flash/);
    vi.useRealTimers();
  });
});
