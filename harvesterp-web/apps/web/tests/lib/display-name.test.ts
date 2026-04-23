import { describe, it, expect } from "vitest";
import { resolveDisplayName } from "../../src/lib/display-name";

describe("resolveDisplayName", () => {
  it("returns 'there' when the user is null or undefined", () => {
    expect(resolveDisplayName(null)).toBe("there");
    expect(resolveDisplayName(undefined)).toBe("there");
  });

  it("prefers full_name when present", () => {
    expect(
      resolveDisplayName({ full_name: "Ravi Shah", email: "ravi@x.com" }),
    ).toBe("Ravi Shah");
  });

  it("ignores an empty or whitespace-only full_name and falls back to email", () => {
    expect(
      resolveDisplayName({ full_name: "   ", email: "admin@harvesterp.com" }),
    ).toBe("Admin");
  });

  it("title-cases the local part of the email when full_name is missing", () => {
    expect(resolveDisplayName({ email: "admin@harvesterp.com" })).toBe("Admin");
    expect(resolveDisplayName({ email: "sachin.m@example.co" })).toBe("Sachin M");
    expect(resolveDisplayName({ email: "ravi_shah@x.com" })).toBe("Ravi Shah");
    expect(resolveDisplayName({ email: "jd-doe@x.com" })).toBe("Jd Doe");
  });

  it("returns 'there' when both full_name and email are unusable", () => {
    expect(resolveDisplayName({ full_name: null, email: null })).toBe("there");
    expect(resolveDisplayName({ email: "" })).toBe("there");
  });
});
