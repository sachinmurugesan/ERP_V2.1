import { describe, it, expect } from "vitest";
import { getAvatarHexColor, getAvatarClass, getAvatarGradient } from "../../src/avatar/colors.js";
import { UserRole } from "../../src/auth/roles.js";
import { brand } from "../../src/tokens/colors.js";

const VALID_HEX = /^#[0-9a-f]{6}$/i;

describe("getAvatarHexColor()", () => {
  it("returns a valid hex colour string", () => {
    expect(getAvatarHexColor("Sachin")).toMatch(VALID_HEX);
  });
  it("is deterministic — same input always returns same colour", () => {
    const name = "Sachin Murugesan";
    expect(getAvatarHexColor(name)).toBe(getAvatarHexColor(name));
  });
  it("returns one of the 8 palette colours", () => {
    const palette = new Set([
      "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b",
      "#10b981", "#06b6d4", "#6366f1", "#ef4444",
    ]);
    for (const name of ["Alice", "Bob", "Charlie", "Diana", "Edward", "Fiona", "Grace", "Hank", "Ivan"]) {
      expect(palette.has(getAvatarHexColor(name))).toBe(true);
    }
  });
  it("returns a colour for empty string (doesn't throw)", () => {
    expect(() => getAvatarHexColor("")).not.toThrow();
    expect(getAvatarHexColor("")).toMatch(VALID_HEX);
  });
  it("different names may produce different colours", () => {
    // Not guaranteed to differ, but a basic smoke test over distinct names
    const colours = new Set(
      ["Alice", "Bob", "Charlie", "Diana", "Edward", "Fiona", "Grace", "Hank"].map(getAvatarHexColor)
    );
    expect(colours.size).toBeGreaterThan(1);
  });
});

describe("getAvatarClass()", () => {
  it("returns an object with bg and text properties", () => {
    const result = getAvatarClass(UserRole.FINANCE);
    expect(result).toHaveProperty("bg");
    expect(result).toHaveProperty("text");
  });
  it("bg starts with 'bg-'", () => {
    expect(getAvatarClass(UserRole.ADMIN).bg).toMatch(/^bg-/);
  });
  it("text starts with 'text-'", () => {
    expect(getAvatarClass(UserRole.OPERATIONS).text).toMatch(/^text-/);
  });
  it("returns a value for every UserRole", () => {
    for (const role of Object.values(UserRole)) {
      const result = getAvatarClass(role);
      expect(result.bg.length).toBeGreaterThan(0);
      expect(result.text.length).toBeGreaterThan(0);
    }
  });
  it("returns fallback for unknown role", () => {
    const result = getAvatarClass("UNKNOWN_ROLE");
    expect(result.bg).toBe("bg-gray-400");
    expect(result.text).toBe("text-white");
  });
  it("SUPER_ADMIN gets a distinct (red) bg", () => {
    expect(getAvatarClass(UserRole.SUPER_ADMIN).bg).toContain("red");
  });
});

// ---------------------------------------------------------------------------
// getAvatarGradient — P-020 design-system default
// ---------------------------------------------------------------------------

describe("getAvatarGradient()", () => {
  it("returns a string", () => {
    expect(typeof getAvatarGradient()).toBe("string");
  });

  it("is a linear-gradient at 135deg", () => {
    expect(getAvatarGradient()).toMatch(/^linear-gradient\(135deg,/);
  });

  it("contains brand[600] as the start colour", () => {
    expect(getAvatarGradient()).toContain(brand[600]);
  });

  it("contains brand[800] as the end colour", () => {
    expect(getAvatarGradient()).toContain(brand[800]);
  });

  it("exact value matches design spec from components.css .av", () => {
    expect(getAvatarGradient()).toBe(
      `linear-gradient(135deg, ${brand[600]}, ${brand[800]})`,
    );
  });

  it("is deterministic — same value on every call", () => {
    expect(getAvatarGradient()).toBe(getAvatarGradient());
  });
});
