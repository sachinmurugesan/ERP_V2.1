import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime } from "../../src/format/date.js";

describe("formatDate", () => {
  describe("null / empty → em dash", () => {
    it("returns '—' for null", () => {
      expect(formatDate(null)).toBe("—");
    });
    it("returns '—' for undefined", () => {
      expect(formatDate(undefined)).toBe("—");
    });
    it("returns '—' for empty string", () => {
      expect(formatDate("")).toBe("—");
    });
    it("returns '—' for an invalid date string", () => {
      expect(formatDate("not-a-date")).toBe("—");
    });
  });

  describe("ISO string input", () => {
    it("formats an ISO date string (default: day month year)", () => {
      const result = formatDate("2026-04-22");
      expect(result).toContain("2026");
      expect(result).toContain("Apr");
      expect(result).toContain("22");
    });
    it("formats with dateStyle 'long'", () => {
      const result = formatDate("2026-04-22", { dateStyle: "long" });
      expect(result).toContain("April");
      expect(result).toContain("2026");
    });
  });

  describe("Date object input", () => {
    it("accepts a Date object", () => {
      const d = new Date("2026-01-15T00:00:00Z");
      const result = formatDate(d);
      expect(result).toContain("2026");
    });
  });

  describe("numeric timestamp input", () => {
    it("accepts a Unix timestamp in ms", () => {
      const ts = new Date("2026-06-01T00:00:00Z").getTime();
      const result = formatDate(ts);
      expect(result).toContain("2026");
    });
  });
});

describe("formatDateTime", () => {
  it("returns '—' for null", () => {
    expect(formatDateTime(null)).toBe("—");
  });
  it("includes time component", () => {
    const result = formatDateTime("2026-04-22T12:00:00Z");
    expect(result).toContain("2026");
    // Either AM/PM indicator present
    expect(result.toLowerCase()).toMatch(/am|pm/);
  });
});
