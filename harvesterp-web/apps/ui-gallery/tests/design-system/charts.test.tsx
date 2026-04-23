import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { AreaChart } from "@/components/design-system/area-chart";
import { BarChart } from "@/components/design-system/bar-chart";
import { Donut } from "@/components/design-system/donut";
import { SparkLine } from "@/components/design-system/spark-line";

// ── AreaChart ─────────────────────────────────────────────────────────────────

describe("AreaChart", () => {
  it("renders an SVG", () => {
    const { container } = render(<AreaChart series={[[10, 20, 15, 30]]} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("applies default dimensions", () => {
    const { container } = render(<AreaChart series={[[10, 20, 30]]} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("600");
    expect(svg.getAttribute("height")).toBe("200");
  });

  it("applies custom dimensions", () => {
    const { container } = render(<AreaChart series={[[10, 20]]} width={400} height={150} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("400");
    expect(svg.getAttribute("height")).toBe("150");
  });

  it("renders a path for the series", () => {
    const { container } = render(<AreaChart series={[[10, 20, 30, 40]]} />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);
  });

  it("renders x-axis labels when provided", () => {
    const { container } = render(
      <AreaChart series={[[10, 20, 30]]} labels={["Jan", "Feb", "Mar"]} />
    );
    const texts = Array.from(container.querySelectorAll("text")).map(t => t.textContent);
    expect(texts).toContain("Jan");
    expect(texts).toContain("Feb");
  });

  it("renders multiple series", () => {
    const { container } = render(
      <AreaChart series={[[10, 20], [5, 15]]} colors={["red", "blue"]} />
    );
    // Should render 2 path groups (1 area + 1 line per series)
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThanOrEqual(4);
  });

  it("renders y-axis grid lines", () => {
    const { container } = render(<AreaChart series={[[10, 50, 30]]} />);
    const lines = container.querySelectorAll("line");
    expect(lines.length).toBeGreaterThan(0);
  });

  it("renders a linearGradient defs element", () => {
    const { container } = render(<AreaChart series={[[10, 20]]} />);
    expect(container.querySelector("defs")).not.toBeNull();
    expect(container.querySelector("linearGradient")).not.toBeNull();
  });
});

// ── BarChart ──────────────────────────────────────────────────────────────────

describe("BarChart", () => {
  const DATA = [
    { label: "Mon", values: [120] },
    { label: "Tue", values: [150] },
    { label: "Wed", values: [130] },
  ];

  it("renders an SVG", () => {
    const { container } = render(<BarChart data={DATA} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("applies default dimensions", () => {
    const { container } = render(<BarChart data={DATA} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("600");
    expect(svg.getAttribute("height")).toBe("180");
  });

  it("applies custom dimensions", () => {
    const { container } = render(<BarChart data={DATA} width={300} height={120} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("300");
    expect(svg.getAttribute("height")).toBe("120");
  });

  it("renders a rect for each data point", () => {
    const { container } = render(<BarChart data={DATA} />);
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBe(DATA.length);
  });

  it("renders group labels as text", () => {
    const { container } = render(<BarChart data={DATA} />);
    const texts = Array.from(container.querySelectorAll("text")).map(t => t.textContent);
    expect(texts).toContain("Mon");
    expect(texts).toContain("Tue");
  });

  it("renders multi-value bars", () => {
    const multiData = [
      { label: "A", values: [10, 20] },
      { label: "B", values: [15, 25] },
    ];
    const { container } = render(<BarChart data={multiData} />);
    const rects = container.querySelectorAll("rect");
    expect(rects.length).toBe(4); // 2 values × 2 groups
  });

  it("renders grid lines", () => {
    const { container } = render(<BarChart data={DATA} />);
    const lines = container.querySelectorAll("line");
    expect(lines.length).toBeGreaterThan(0);
  });
});

// ── Donut ─────────────────────────────────────────────────────────────────────

describe("Donut", () => {
  const DATA = [
    { value: 60, color: "var(--ok)" },
    { value: 30, color: "var(--warn)" },
    { value: 10, color: "var(--err)" },
  ];

  it("renders an SVG", () => {
    const { container } = render(<Donut data={DATA} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("applies default size", () => {
    const { container } = render(<Donut data={DATA} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("140");
    expect(svg.getAttribute("height")).toBe("140");
  });

  it("applies custom size", () => {
    const { container } = render(<Donut data={DATA} size={100} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("100");
    expect(svg.getAttribute("height")).toBe("100");
  });

  it("renders a circle for each segment + background", () => {
    const { container } = render(<Donut data={DATA} />);
    const circles = container.querySelectorAll("circle");
    // 1 background + 3 segments = 4
    expect(circles.length).toBe(DATA.length + 1);
  });

  it("renders total as center text", () => {
    const { container } = render(<Donut data={DATA} />);
    const texts = Array.from(container.querySelectorAll("text")).map(t => t.textContent);
    // Total = 60+30+10 = 100
    expect(texts.some(t => t?.includes("100"))).toBe(true);
  });

  it("renders 'Total' label text", () => {
    const { container } = render(<Donut data={DATA} />);
    const texts = Array.from(container.querySelectorAll("text")).map(t => t.textContent);
    expect(texts).toContain("Total");
  });

  it("renders custom cap text", () => {
    const { container } = render(<Donut data={DATA} cap="68%" />);
    const texts = Array.from(container.querySelectorAll("text")).map(t => t.textContent);
    expect(texts).toContain("68%");
  });

  it("applies segment colors", () => {
    const { container } = render(<Donut data={DATA} />);
    const circles = Array.from(container.querySelectorAll("circle"));
    const strokes = circles.map(c => c.getAttribute("stroke")).filter(Boolean);
    expect(strokes).toContain("var(--ok)");
    expect(strokes).toContain("var(--warn)");
  });
});

// ── SparkLine ─────────────────────────────────────────────────────────────────

describe("SparkLine", () => {
  it("renders an SVG", () => {
    const { container } = render(<SparkLine data={[10, 20, 15, 30]} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("applies default dimensions", () => {
    const { container } = render(<SparkLine data={[10, 20]} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("120");
    expect(svg.getAttribute("height")).toBe("36");
  });

  it("applies custom dimensions", () => {
    const { container } = render(<SparkLine data={[10, 20]} width={80} height={24} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("80");
    expect(svg.getAttribute("height")).toBe("24");
  });

  it("renders the line path", () => {
    const { container } = render(<SparkLine data={[10, 20, 15]} />);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThan(0);
  });

  it("renders gradient fill area by default", () => {
    const { container } = render(<SparkLine data={[10, 20, 15]} />);
    // 2 paths: area fill + line
    expect(container.querySelectorAll("path").length).toBe(2);
  });

  it("renders only line path when fill=false", () => {
    const { container } = render(<SparkLine data={[10, 20, 15]} fill={false} />);
    expect(container.querySelectorAll("path").length).toBe(1);
  });

  it("renders a linearGradient", () => {
    const { container } = render(<SparkLine data={[10, 20]} />);
    expect(container.querySelector("linearGradient")).not.toBeNull();
  });
});
