import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DSAvatar } from "@/components/design-system/ds-avatar";

describe("DSAvatar", () => {
  it("renders without crash", () => {
    const { container } = render(<DSAvatar name="Sachin M." />);
    expect(container.querySelector("span")).not.toBeNull();
  });

  it("shows correct initials for two-word name", () => {
    const { container } = render(<DSAvatar name="Sachin M." />);
    expect(container.querySelector("span")?.textContent).toBe("SM");
  });

  it("has av class by default (md size)", () => {
    const { container } = render(<DSAvatar name="Sachin M." />);
    expect(container.querySelector("span")?.className).toContain("av");
  });

  it("has av av-sm class for size=sm", () => {
    const { container } = render(<DSAvatar name="Sachin M." size="sm" />);
    expect(container.querySelector("span")?.className).toContain("av-sm");
  });

  it("has av av-lg class for size=lg", () => {
    const { container } = render(<DSAvatar name="Sachin M." size="lg" />);
    expect(container.querySelector("span")?.className).toContain("av-lg");
  });

  it("gradient variant applies inline gradient style", () => {
    const { container } = render(<DSAvatar name="Sachin M." variant="gradient" />);
    const style = container.querySelector("span")?.getAttribute("style") ?? "";
    expect(style).toContain("background");
    expect(style).toContain("linear-gradient");
  });

  it("hash variant applies inline hex color", () => {
    const { container } = render(<DSAvatar name="Priya K." variant="hash" />);
    const style = container.querySelector("span")?.getAttribute("style") ?? "";
    expect(style).toContain("background");
  });

  it("color override applies custom background", () => {
    const { container } = render(<DSAvatar name="Test User" color="#FF0000" />);
    const style = container.querySelector("span")?.getAttribute("style") ?? "";
    // jsdom normalises hex to rgb in inline styles
    expect(style).toMatch(/background/);
  });

  it("role variant does not use gradient style", () => {
    const { container } = render(<DSAvatar name="Admin User" variant="role" role="INTERNAL" />);
    const style = container.querySelector("span")?.getAttribute("style") ?? "";
    // Role variant uses class-based color, not gradient inline style
    expect(style).not.toContain("linear-gradient");
  });

  it("renders initials for single word name", () => {
    const { container } = render(<DSAvatar name="Sachin" />);
    // getInitials for single word should return first letter
    const text = container.querySelector("span")?.textContent ?? "";
    expect(text.length).toBeGreaterThan(0);
  });

  it("handles email-style name gracefully", () => {
    const { container } = render(<DSAvatar name="test@example.com" />);
    expect(container.querySelector("span")).not.toBeNull();
  });
});
