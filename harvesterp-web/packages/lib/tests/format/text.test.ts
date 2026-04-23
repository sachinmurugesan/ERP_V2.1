import { describe, it, expect } from "vitest";
import { orDash, truncate, toTitleCase, normaliseWhitespace, humanise } from "../../src/format/text.js";

describe("orDash", () => {
  it("returns value when non-empty", () => {
    expect(orDash("hello")).toBe("hello");
  });
  it("returns '—' for null", () => {
    expect(orDash(null)).toBe("—");
  });
  it("returns '—' for undefined", () => {
    expect(orDash(undefined)).toBe("—");
  });
  it("returns '—' for empty string", () => {
    expect(orDash("")).toBe("—");
  });
  it("returns '—' for whitespace-only string", () => {
    expect(orDash("   ")).toBe("—");
  });
  it("preserves whitespace in non-empty strings", () => {
    expect(orDash("foo bar")).toBe("foo bar");
  });
});

describe("truncate", () => {
  it("returns unchanged string when within limit", () => {
    expect(truncate("Hello", 10)).toBe("Hello");
  });
  it("truncates and appends ellipsis when over limit", () => {
    expect(truncate("Hello World", 5)).toBe("Hello…");
  });
  it("returns unchanged string at exactly limit length", () => {
    expect(truncate("Hello", 5)).toBe("Hello");
  });
  it("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });
});

describe("toTitleCase", () => {
  it("capitalises first letter of each word", () => {
    expect(toTitleCase("hello world")).toBe("Hello World");
  });
  it("lowercases remaining letters", () => {
    expect(toTitleCase("HELLO WORLD")).toBe("Hello World");
  });
  it("handles single word", () => {
    expect(toTitleCase("hello")).toBe("Hello");
  });
  it("handles empty string", () => {
    expect(toTitleCase("")).toBe("");
  });
});

describe("normaliseWhitespace", () => {
  it("collapses multiple spaces", () => {
    expect(normaliseWhitespace("foo   bar")).toBe("foo bar");
  });
  it("trims leading and trailing whitespace", () => {
    expect(normaliseWhitespace("  foo bar  ")).toBe("foo bar");
  });
  it("collapses tabs and newlines", () => {
    expect(normaliseWhitespace("foo\t\nbar")).toBe("foo bar");
  });
  it("handles empty string", () => {
    expect(normaliseWhitespace("")).toBe("");
  });
});

describe("humanise", () => {
  it("converts snake_case to title case", () => {
    expect(humanise("factory_part_number")).toBe("Factory Part Number");
  });
  it("converts kebab-case to title case", () => {
    expect(humanise("order-status")).toBe("Order Status");
  });
  it("handles already-readable strings", () => {
    expect(humanise("order status")).toBe("Order Status");
  });
  it("handles single word", () => {
    expect(humanise("order")).toBe("Order");
  });
});
