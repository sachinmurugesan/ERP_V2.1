import { decodeJwt } from "jose";

/**
 * jwt.ts — Lightweight JWT claim reader for Edge Runtime.
 *
 * Uses jose.decodeJwt which reads claims WITHOUT verifying the signature.
 * Suitable for middleware expiry checks where the goal is "should I refresh
 * proactively?" not "is this token cryptographically valid?".
 * (Signature validity is enforced by FastAPI on every API call.)
 *
 * Edge Runtime compatible — no Node crypto required.
 */

export interface DecodedToken {
  /** Expiry timestamp in seconds since Unix epoch. */
  exp?: number;
  /** Subject (user id). */
  sub?: string;
  /** Issued-at timestamp. */
  iat?: number;
  [key: string]: unknown;
}

/**
 * Decode the claims from a JWT string without verifying the signature.
 *
 * Returns null if the token is malformed or cannot be decoded.
 */
export function decodeToken(token: string): DecodedToken | null {
  try {
    return decodeJwt(token) as DecodedToken;
  } catch {
    return null;
  }
}

/**
 * Returns true when the token will expire within `thresholdSeconds` seconds.
 *
 * Tokens without an `exp` claim are treated as non-expiring (returns false).
 *
 * @param token          - Raw JWT string
 * @param thresholdSeconds - Proactive refresh window (default 30 s)
 */
export function isExpiringSoon(token: string, thresholdSeconds = 30): boolean {
  const payload = decodeToken(token);
  if (!payload?.exp) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp - nowSeconds < thresholdSeconds;
}
