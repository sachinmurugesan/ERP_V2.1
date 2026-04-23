import { describe, it, expect } from "vitest";
import { formatNumber, formatPercent, formatQuantity } from "../../src/format/number.js";

describe("formatNumber", () => {
  it("returns '—' for null", () => {
    expect(formatNumber(null)).toBe("—");
  });
  it("returns '—' for undefined", () => {
    expect(formatNumber(undefined)).toBe("—");
  });
  it("formats an integer with no decimals by default", () => {
    const result = formatNumber(1000);
    expect(result).toContain("1,000");
  });
  it("formats a large number with en-IN grouping", () => {
    const result = formatNumber(1234567);
    expect(result).toContain("12,34,567");
  });
  it("respects minimumFractionDigits", () => {
    const result = formatNumber(100, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    expect(result).toMatch(/100\.00/);
  });
  it("respects maximumFractionDigits", () => {
    const result = formatNumber(1.23456, { maximumFractionDigits: 2 });
    expect(result).toMatch(/1\.23/);
  });
  it("formats zero", () => {
    expect(formatNumber(0)).toBe("0");
  });
  it("formats negative numbers", () => {
    const result = formatNumber(-500);
    expect(result).toContain("500");
  });
});

describe("formatPercent", () => {
  it("returns '—' for null", () => {
    expect(formatPercent(null)).toBe("—");
  });
  it("formats a percentage with 1 decimal by default", () => {
    expect(formatPercent(42.5)).toBe("42.5%");
  });
  it("respects decimalPlaces parameter", () => {
    expect(formatPercent(33.333, 2)).toBe("33.33%");
  });
  it("formats zero", () => {
    expect(formatPercent(0)).toBe("0.0%");
  });
  it("formats 100", () => {
    expect(formatPercent(100)).toBe("100.0%");
  });
});

describe("formatQuantity", () => {
  it("returns '—' for null", () => {
    expect(formatQuantity(null)).toBe("—");
  });
  it("formats an integer quantity with no decimals", () => {
    const result = formatQuantity(10000);
    expect(result).toContain("10,000");
    expect(result).not.toContain(".");
  });
});
