import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Icon } from "@/components/design-system/icon";
import type { IconName } from "@/components/design-system/icon";

describe("Icon", () => {
  it("renders an SVG element", () => {
    const { container } = render(<Icon name="dashboard" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("applies default size of 16", () => {
    const { container } = render(<Icon name="search" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("16");
    expect(svg.getAttribute("height")).toBe("16");
  });

  it("applies custom size", () => {
    const { container } = render(<Icon name="bell" size={24} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("24");
    expect(svg.getAttribute("height")).toBe("24");
  });

  it("applies custom stroke color", () => {
    const { container } = render(<Icon name="user" color="red" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("stroke")).toBe("red");
  });

  it("defaults stroke to currentColor", () => {
    const { container } = render(<Icon name="settings" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("stroke")).toBe("currentColor");
  });

  it("applies custom strokeWidth", () => {
    const { container } = render(<Icon name="check" stroke={2.5} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("stroke-width")).toBe("2.5");
  });

  it("renders fill=none on svg", () => {
    const { container } = render(<Icon name="finance" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("fill")).toBe("none");
  });

  it("has a 24x24 viewBox", () => {
    const { container } = render(<Icon name="globe" />);
    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe("0 0 24 24");
  });

  it("renders all icon names without crashing", () => {
    const icons: IconName[] = [
      "home","dashboard","finance","sales","crm","inventory","procurement","reports","settings",
      "search","bell","plus","filter","download","upload",
      "chevronR","chevronL","chevronD","chevronU","arrowUp","arrowDown","arrowRight",
      "check","close","more","moreV","calendar","clock","user","logout","moon","sun","expand",
      "box","truck","invoice","credit","globe","shield","tag","warning","flame","star","sparkle",
      "zap","refresh","grid","list","help",
    ];
    for (const name of icons) {
      const { container } = render(<Icon name={name} />);
      expect(container.querySelector("svg")).not.toBeNull();
    }
  });

  it("applies style prop to svg", () => {
    const { container } = render(<Icon name="box" style={{ opacity: 0.5 }} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("style")).toContain("opacity");
  });

  it("sets strokeLinecap=round", () => {
    const { container } = render(<Icon name="truck" />);
    expect(container.querySelector("svg")?.getAttribute("stroke-linecap")).toBe("round");
  });

  it("sets strokeLinejoin=round", () => {
    const { container } = render(<Icon name="invoice" />);
    expect(container.querySelector("svg")?.getAttribute("stroke-linejoin")).toBe("round");
  });
});
