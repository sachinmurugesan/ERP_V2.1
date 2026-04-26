/**
 * highlight-scroll-target.test.tsx — Unit tests for the lifted
 * HighlightScrollTarget composed component.
 *
 * jsdom does not implement scrollIntoView; we mock it on every render to
 * avoid `TypeError: scrollIntoView is not a function`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

import { HighlightScrollTarget } from "../../src/components/composed/highlight-scroll-target";

const scrollIntoViewMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  Element.prototype.scrollIntoView = scrollIntoViewMock;
  scrollIntoViewMock.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("HighlightScrollTarget — rendering", () => {
  it("renders children inside a div with the provided id", () => {
    render(
      <HighlightScrollTarget id="upload">
        <p>Upload section</p>
      </HighlightScrollTarget>,
    );
    const wrap = screen.getByTestId("highlight-target-upload");
    expect(wrap).toBeInTheDocument();
    expect(wrap.id).toBe("upload");
    expect(wrap).toHaveTextContent("Upload section");
  });

  it("does NOT have animate-highlight-flash class when currentHash mismatches id", () => {
    render(
      <HighlightScrollTarget id="upload" currentHash="other">
        <p>x</p>
      </HighlightScrollTarget>,
    );
    expect(
      screen.getByTestId("highlight-target-upload").className,
    ).not.toMatch(/animate-highlight-flash/);
  });

  it("does NOT have animate-highlight-flash when no currentHash", () => {
    render(
      <HighlightScrollTarget id="upload">
        <p>x</p>
      </HighlightScrollTarget>,
    );
    expect(
      screen.getByTestId("highlight-target-upload").className,
    ).not.toMatch(/animate-highlight-flash/);
  });
});

describe("HighlightScrollTarget — activation", () => {
  it("when currentHash matches id, calls scrollIntoView and applies the flash class after the 50ms tick", () => {
    render(
      <HighlightScrollTarget id="upload" currentHash="upload">
        <p>x</p>
      </HighlightScrollTarget>,
    );

    // Before the timer fires, scrollIntoView hasn't been called and class isn't applied
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("highlight-target-upload").className,
    ).not.toMatch(/animate-highlight-flash/);

    // Advance the 50ms scroll timer
    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
    expect(
      screen.getByTestId("highlight-target-upload").className,
    ).toMatch(/animate-highlight-flash/);
  });

  it("clears the flash class after highlightDurationMs elapses", () => {
    render(
      <HighlightScrollTarget
        id="upload"
        currentHash="upload"
        highlightDurationMs={500}
      >
        <p>x</p>
      </HighlightScrollTarget>,
    );

    // Apply highlight
    act(() => {
      vi.advanceTimersByTime(60);
    });
    expect(
      screen.getByTestId("highlight-target-upload").className,
    ).toMatch(/animate-highlight-flash/);

    // Pass the duration window (500 + 50 + buffer)
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(
      screen.getByTestId("highlight-target-upload").className,
    ).not.toMatch(/animate-highlight-flash/);
  });
});
