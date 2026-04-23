import { describe, it, expect } from "vitest";
import { formatCurrency, formatINR } from "../../src/format/currency.js";

describe("formatCurrency", () => {
  describe("null / undefined → em dash", () => {
    it("returns '—' for null", () => {
      expect(formatCurrency(null)).toBe("—");
    });
    it("returns '—' for undefined", () => {
      expect(formatCurrency(undefined)).toBe("—");
    });
  });

  describe("INR formatting (en-IN locale)", () => {
    it("formats a whole number in INR", () => {
      const result = formatCurrency(1000, "INR");
      expect(result).toContain("1,000");
      expect(result).toContain("₹");
    });
    it("formats a large INR amount with Indian comma grouping", () => {
      const result = formatCurrency(1234567, "INR");
      // en-IN uses lakh grouping: 12,34,567
      expect(result).toContain("12,34,567");
    });
    it("includes 2 decimal places for INR", () => {
      const result = formatCurrency(500, "INR");
      expect(result).toMatch(/\.00/);
    });
    it("defaults to INR when no currency specified", () => {
      const result = formatCurrency(100);
      expect(result).toContain("₹");
    });
  });

  describe("USD formatting", () => {
    it("formats USD with $ symbol", () => {
      const result = formatCurrency(1000, "USD");
      expect(result).toContain("$");
      expect(result).toContain("1,000");
    });
    it("includes 2 decimal places for USD", () => {
      expect(formatCurrency(9.9, "USD")).toMatch(/9\.90/);
    });
  });

  describe("CNY formatting", () => {
    it("formats CNY with ¥ symbol", () => {
      const result = formatCurrency(500, "CNY");
      expect(result).toContain("¥");
    });
    it("includes 2 decimal places for CNY", () => {
      expect(formatCurrency(100, "CNY")).toMatch(/\.00/);
    });
  });

  describe("edge cases", () => {
    it("formats zero", () => {
      expect(formatCurrency(0, "INR")).toContain("0");
    });
    it("formats negative values", () => {
      const result = formatCurrency(-500, "INR");
      expect(result).toContain("500");
    });
  });
});

describe("formatINR", () => {
  it("is a convenience alias for formatCurrency with INR", () => {
    expect(formatINR(1000)).toBe(formatCurrency(1000, "INR"));
  });
  it("returns '—' for null", () => {
    expect(formatINR(null)).toBe("—");
  });
});
