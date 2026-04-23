/**
 * jwt.test.ts — Unit tests for lib/jwt.ts.
 *
 * Uses real jose decodeJwt (no mocking) with hand-crafted base64url tokens.
 * The helper makeJWT() produces tokens that jose can decode without
 * signature verification.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { decodeToken, isExpiringSoon } from "../../src/lib/jwt";

// ── JWT test builder ──────────────────────────────────────────────────────────

/**
 * Build a minimal unsigned JWT with the given payload.
 * jose.decodeJwt reads claims only and does NOT verify the signature.
 */
function makeJWT(payload: Record<string, unknown>): string {
  const toBase64Url = (s: string) =>
    btoa(unescape(encodeURIComponent(s)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  const header = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = toBase64Url(JSON.stringify(payload));
  return `${header}.${body}.fakesignature`;
}

// ── decodeToken ───────────────────────────────────────────────────────────────

describe("decodeToken", () => {
  it("returns null for an empty string", () => {
    expect(decodeToken("")).toBeNull();
  });

  it("returns null for a non-JWT string", () => {
    expect(decodeToken("not-a-jwt")).toBeNull();
  });

  it("returns null for a malformed token (only one segment)", () => {
    expect(decodeToken("onlyone")).toBeNull();
  });

  it("returns the decoded payload for a valid JWT", () => {
    const token = makeJWT({ sub: "usr-1", email: "a@b.com" });
    const payload = decodeToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("usr-1");
    expect(payload?.email).toBe("a@b.com");
  });

  it("returns exp field when present", () => {
    const exp = Math.floor(Date.now() / 1000) + 900; // 15 min from now
    const token = makeJWT({ sub: "usr-1", exp });
    const payload = decodeToken(token);
    expect(payload?.exp).toBe(exp);
  });

  it("returns undefined exp when not in payload", () => {
    const token = makeJWT({ sub: "usr-1" });
    const payload = decodeToken(token);
    expect(payload?.exp).toBeUndefined();
  });
});

// ── isExpiringSoon ────────────────────────────────────────────────────────────

describe("isExpiringSoon", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false for a token without exp claim", () => {
    const token = makeJWT({ sub: "usr-1" });
    expect(isExpiringSoon(token)).toBe(false);
  });

  it("returns false for a malformed token", () => {
    expect(isExpiringSoon("not-a-token")).toBe(false);
  });

  it("returns false when token expires well beyond the threshold", () => {
    vi.useFakeTimers();
    const now = 1_700_000_000;
    vi.setSystemTime(now * 1000);
    const token = makeJWT({ exp: now + 900 }); // 900s > default 30s
    expect(isExpiringSoon(token)).toBe(false);
  });

  it("returns true when token expires within the default 30-second threshold", () => {
    vi.useFakeTimers();
    const now = 1_700_000_000;
    vi.setSystemTime(now * 1000);
    const token = makeJWT({ exp: now + 20 }); // 20s < 30s
    expect(isExpiringSoon(token)).toBe(true);
  });

  it("returns true for an already-expired token", () => {
    vi.useFakeTimers();
    const now = 1_700_000_000;
    vi.setSystemTime(now * 1000);
    const token = makeJWT({ exp: now - 60 }); // expired 60s ago
    expect(isExpiringSoon(token)).toBe(true);
  });

  it("returns false exactly at the threshold boundary (exp - now === threshold)", () => {
    vi.useFakeTimers();
    const now = 1_700_000_000;
    vi.setSystemTime(now * 1000);
    const token = makeJWT({ exp: now + 30 }); // exactly 30s → NOT expiring soon
    expect(isExpiringSoon(token)).toBe(false);
  });

  it("returns true one second inside the threshold (exp - now < threshold)", () => {
    vi.useFakeTimers();
    const now = 1_700_000_000;
    vi.setSystemTime(now * 1000);
    const token = makeJWT({ exp: now + 29 }); // 29s < 30s
    expect(isExpiringSoon(token)).toBe(true);
  });

  it("respects a custom threshold of 60 seconds", () => {
    vi.useFakeTimers();
    const now = 1_700_000_000;
    vi.setSystemTime(now * 1000);
    const token = makeJWT({ exp: now + 45 }); // 45s < custom 60s
    expect(isExpiringSoon(token, 60)).toBe(true);
  });

  it("returns false with custom threshold when well within bounds", () => {
    vi.useFakeTimers();
    const now = 1_700_000_000;
    vi.setSystemTime(now * 1000);
    const token = makeJWT({ exp: now + 120 }); // 120s > custom 60s
    expect(isExpiringSoon(token, 60)).toBe(false);
  });
});
