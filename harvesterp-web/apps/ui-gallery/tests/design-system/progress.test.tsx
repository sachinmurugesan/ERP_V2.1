import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Progress } from "@/components/design-system/progress";

describe("Progress", () => {
  it("renders two divs (track + fill)", () => {
    const { container } = render(<Progress value={50} />);
    const divs = container.querySelectorAll("div");
    expect(divs.length).toBe(2);
  });

  it("fill width reflects value as percentage", () => {
    const { container } = render(<Progress value={75} />);
    const fill = container.querySelectorAll("div")[1] as HTMLElement;
    expect(fill.style.width).toBe("75%");
  });

  it("clamps to 100% when value exceeds max", () => {
    const { container } = render(<Progress value={150} max={100} />);
    const fill = container.querySelectorAll("div")[1] as HTMLElement;
    expect(fill.style.width).toBe("100%");
  });

  it("supports custom max", () => {
    const { container } = render(<Progress value={25} max={50} />);
    const fill = container.querySelectorAll("div")[1] as HTMLElement;
    expect(fill.style.width).toBe("50%");
  });

  it("uses default color var(--brand-500)", () => {
    const { container } = render(<Progress value={40} />);
    const fill = container.querySelectorAll("div")[1] as HTMLElement;
    expect(fill.style.background).toBe("var(--brand-500)");
  });

  it("accepts custom color", () => {
    const { container } = render(<Progress value={40} color="var(--err)" />);
    const fill = container.querySelectorAll("div")[1] as HTMLElement;
    expect(fill.style.background).toBe("var(--err)");
  });

  it("defaults to height 6", () => {
    const { container } = render(<Progress value={50} />);
    const track = container.querySelectorAll("div")[0] as HTMLElement;
    expect(track.style.height).toBe("6px");
  });

  it("accepts custom height", () => {
    const { container } = render(<Progress value={50} height={10} />);
    const track = container.querySelectorAll("div")[0] as HTMLElement;
    expect(track.style.height).toBe("10px");
  });

  it("track has overflow hidden", () => {
    const { container } = render(<Progress value={50} />);
    const track = container.querySelectorAll("div")[0] as HTMLElement;
    expect(track.style.overflow).toBe("hidden");
  });

  it("renders 0% correctly", () => {
    const { container } = render(<Progress value={0} />);
    const fill = container.querySelectorAll("div")[1] as HTMLElement;
    expect(fill.style.width).toBe("0%");
  });
});
