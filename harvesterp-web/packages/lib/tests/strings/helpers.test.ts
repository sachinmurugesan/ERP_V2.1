import { describe, it, expect } from "vitest";
import {
  resolveString,
  hasTamilTranslation,
  internal,
  portal,
  dialog,
} from "../../src/strings/helpers.js";
import type { InternalString, PortalString } from "../../src/strings/types.js";

describe("resolveString", () => {
  it("returns English for 'en' locale", () => {
    const s: PortalString = { en: "Order", ta: "ஆர்டர்" };
    expect(resolveString(s, "en")).toBe("Order");
  });
  it("returns Tamil for 'ta' locale when available", () => {
    const s: PortalString = { en: "Order", ta: "ஆர்டர்" };
    expect(resolveString(s, "ta")).toBe("ஆர்டர்");
  });
  it("falls back to English when Tamil is absent", () => {
    const s: InternalString = { en: "Order" };
    expect(resolveString(s, "ta")).toBe("Order");
  });
  it("falls back to English when Tamil is undefined", () => {
    const s: InternalString = { en: "Reference", ta: undefined };
    expect(resolveString(s, "ta")).toBe("Reference");
  });
});

describe("hasTamilTranslation", () => {
  it("returns true when ta is present and non-empty", () => {
    expect(hasTamilTranslation({ en: "X", ta: "Y" })).toBe(true);
  });
  it("returns false when ta is absent", () => {
    expect(hasTamilTranslation({ en: "X" })).toBe(false);
  });
  it("returns false when ta is empty string", () => {
    expect(hasTamilTranslation({ en: "X", ta: "" })).toBe(false);
  });
  it("returns false when ta is whitespace only", () => {
    expect(hasTamilTranslation({ en: "X", ta: "   " })).toBe(false);
  });
});

describe("internal()", () => {
  it("creates an InternalString with en only", () => {
    expect(internal("Hello")).toEqual({ en: "Hello" });
  });
  it("creates an InternalString with en and ta", () => {
    expect(internal("Hello", "வணக்கம்")).toEqual({ en: "Hello", ta: "வணக்கம்" });
  });
});

describe("portal()", () => {
  it("creates a PortalString with both en and ta", () => {
    expect(portal("Submit", "சமர்ப்பிக்கவும்")).toEqual({
      en: "Submit",
      ta: "சமர்ப்பிக்கவும்",
    });
  });
});

describe("dialog()", () => {
  it("creates a DialogString with both en and ta", () => {
    expect(dialog("Are you sure?", "நீங்கள் உறுதியாக இருக்கிறீர்களா?")).toEqual({
      en: "Are you sure?",
      ta: "நீங்கள் உறுதியாக இருக்கிறீர்களா?",
    });
  });
});
