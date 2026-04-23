/**
 * Avatar colour helpers — P-020 (CROSS_CUTTING.md)
 *
 * Two distinct functions with different signatures:
 *
 *   getAvatarHexColor(name: string): string
 *     - Hash-based: deterministic hex colour from the name string
 *     - Returns one of 8 brand hex values
 *     - Used for user avatars (initials circles)
 *
 *   getAvatarClass(role: string): { bg: string; text: string }
 *     - Role-based: fixed Tailwind class pair per UserRole
 *     - Used for role badge chips / role-coloured avatars
 *
 * ⚠️  These are TWO distinct functions — do NOT merge their signatures.
 */

import { UserRole } from "../auth/roles.js";
import { brand } from "../tokens/colors.js";

// ---------------------------------------------------------------------------
// getAvatarHexColor — hash-based palette (P-020)
// ---------------------------------------------------------------------------

/** 8-colour hex palette sourced from CROSS_CUTTING.md P-020 */
const HEX_PALETTE: readonly string[] = [
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#f59e0b", // amber-500
  "#10b981", // emerald-500
  "#06b6d4", // cyan-500
  "#6366f1", // indigo-500
  "#ef4444", // red-500
] as const;

/**
 * Deterministic hex colour derived from the name string.
 * Same name always produces the same colour.
 *
 * @example
 * getAvatarHexColor("Sachin") // e.g. "#3b82f6"  (stable across calls)
 */
export function getAvatarHexColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0; // keep unsigned 32-bit
  }
  return HEX_PALETTE[hash % HEX_PALETTE.length]!;
}

// ---------------------------------------------------------------------------
// getAvatarClass — role-based Tailwind classes (P-020)
// ---------------------------------------------------------------------------

export interface AvatarClassPair {
  /** Tailwind background class */
  bg: string;
  /** Tailwind text colour class */
  text: string;
}

/**
 * Role → Tailwind class pair mapping.
 *
 * TA is intentionally excluded — it has no backend counterpart (verified in
 * Task 4 permission-matrix verification / D-009). Requests for UserRole.TA
 * will fall through to FALLBACK_CLASS.
 */
const ROLE_CLASS_MAP: Readonly<Partial<Record<UserRole, AvatarClassPair>>> = {
  [UserRole.SUPER_ADMIN]: { bg: "bg-red-500",    text: "text-white" },
  [UserRole.ADMIN]:       { bg: "bg-orange-500", text: "text-white" },
  [UserRole.OPERATIONS]:  { bg: "bg-blue-500",   text: "text-white" },
  [UserRole.FINANCE]:     { bg: "bg-emerald-500",text: "text-white" },
  [UserRole.CLIENT]:      { bg: "bg-cyan-500",   text: "text-white" },
  [UserRole.FACTORY]:     { bg: "bg-amber-500",  text: "text-white" },
} as const;

/** Fallback for unknown roles */
const FALLBACK_CLASS: AvatarClassPair = { bg: "bg-gray-400", text: "text-white" };

/**
 * Get Tailwind bg/text class pair for a role-based avatar or badge chip.
 *
 * @example
 * getAvatarClass(UserRole.FINANCE) // { bg: "bg-emerald-500", text: "text-white" }
 * getAvatarClass("UNKNOWN")        // { bg: "bg-gray-400",    text: "text-white" }
 */
export function getAvatarClass(role: string): AvatarClassPair {
  return (ROLE_CLASS_MAP as Record<string, AvatarClassPair | undefined>)[role] ?? FALLBACK_CLASS;
}

// ---------------------------------------------------------------------------
// getAvatarGradient — design-system default gradient (P-020)
// ---------------------------------------------------------------------------

/**
 * Returns the design system's canonical avatar background gradient.
 * Sourced from ERP_V1/Design/styles/components.css (.av class).
 *
 * Uses brand[600] → brand[800] so the values stay in sync with the token
 * palette automatically — no hardcoded hex strings.
 *
 * @example
 * getAvatarGradient() // "linear-gradient(135deg, #059669, #065F46)"
 */
export function getAvatarGradient(): string {
  return `linear-gradient(135deg, ${brand[600]}, ${brand[800]})`;
}
