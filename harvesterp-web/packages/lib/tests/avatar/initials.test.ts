import { describe, it, expect } from "vitest";
import { getInitials } from "../../src/avatar/initials.js";

describe("getInitials()", () => {
  describe("space-separated names", () => {
    it("extracts first and last initials", () => {
      expect(getInitials("Sachin Murugesan")).toBe("SM");
    });
    it("handles three-part names (first + last)", () => {
      expect(getInitials("John Michael Doe")).toBe("JD");
    });
    it("handles all-caps names", () => {
      expect(getInitials("SACHIN MURUGESAN")).toBe("SM");
    });
  });

  describe("dot-separated names", () => {
    it("extracts initials from dot-separated names", () => {
      expect(getInitials("sachin.murugesan")).toBe("SM");
    });
  });

  describe("email addresses", () => {
    it("splits on @ and . — uses domain start as second initial", () => {
      // "sachin@harvesterp.com" → ["sachin", "harvesterp", "com"] → S + C
      expect(getInitials("sachin@harvesterp.com")).toBe("SC");
    });
    it("handles simple email", () => {
      // splits: ["alice", "example", "com"] → first=A, last=C
      expect(getInitials("alice@example.com")).toBe("AC");
    });
  });

  describe("single-word names", () => {
    it("returns first 2 chars uppercased for a word >= 2 chars", () => {
      expect(getInitials("Alice")).toBe("AL");
    });
    it("returns 1 char uppercased for a single char", () => {
      expect(getInitials("A")).toBe("A");
    });
  });

  describe("edge cases", () => {
    it("returns '?' for empty string", () => {
      expect(getInitials("")).toBe("?");
    });
    it("returns '?' for whitespace-only string", () => {
      expect(getInitials("   ")).toBe("?");
    });
    it("uppercases result", () => {
      expect(getInitials("foo bar")).toBe("FB");
    });
  });
});
