/**
 * Design token: colour palette
 *
 * Source: ERP_V1/Design/styles/tokens.css  (AB_SPARES ERP — Design Tokens)
 * These are the authoritative values from the design system.
 */

// ---------------------------------------------------------------------------
// Brand — Emerald scale (--brand-50 … --brand-950)
// ---------------------------------------------------------------------------

export const brand = {
  50:  "#ECFDF5",
  100: "#D1FAE5",
  200: "#A7F3D0",
  300: "#6EE7B7",
  400: "#34D399",
  500: "#10B981",
  600: "#059669",
  700: "#047857",
  800: "#065F46",
  900: "#064E3B",
  950: "#022C22",
} as const;

export type BrandShade = keyof typeof brand;

// ---------------------------------------------------------------------------
// Neutral — Warm slate (--n-0 … --n-950)
// ---------------------------------------------------------------------------

export const neutral = {
  0:   "#FFFFFF",
  25:  "#FAFBFA",
  50:  "#F6F7F6",
  100: "#EEF0EE",
  200: "#E2E5E2",
  300: "#CBD0CC",
  400: "#9BA39D",
  500: "#6B736D",
  600: "#4B524D",
  700: "#363C38",
  800: "#23272A",
  900: "#14171A",
  950: "#0B0D0F",
} as const;

export type NeutralShade = keyof typeof neutral;

// ---------------------------------------------------------------------------
// Semantic colours (--ok / --warn / --err / --info)
// ---------------------------------------------------------------------------

export const semantic = {
  ok:   "#10B981",
  warn: "#F59E0B",
  err:  "#EF4444",
  info: "#3B82F6",
} as const;

export type SemanticKey = keyof typeof semantic;

// ---------------------------------------------------------------------------
// Chart palette (--c1 … --c6)
// ---------------------------------------------------------------------------

export const chart = {
  c1: "#10B981",
  c2: "#0EA5E9",
  c3: "#F59E0B",
  c4: "#8B5CF6",
  c5: "#F43F5E",
  c6: "#64748B",
} as const;

export type ChartKey = keyof typeof chart;

// ---------------------------------------------------------------------------
// Surface tokens — light & dark
// Surface values use CSS variable references so they adapt when the
// neutral palette is injected into the DOM.
// ---------------------------------------------------------------------------

export const surface = {
  light: {
    bg:          "var(--n-25)",
    bgElev:      "var(--n-0)",
    bgSunken:    "var(--n-50)",
    bgInverse:   "var(--n-900)",
    fg:          "var(--n-900)",
    fgMuted:     "var(--n-500)",
    fgSubtle:    "var(--n-400)",
    fgInverse:   "var(--n-0)",
    border:      "var(--n-200)",
    borderStrong:"var(--n-300)",
    ring:        "rgba(16,185,129,.25)",
  },
  dark: {
    bg:          "#0B0E10",
    bgElev:      "#14181B",
    bgSunken:    "#0F1214",
    bgInverse:   "#FAFBFA",
    fg:          "#E8ECEA",
    fgMuted:     "#9BA39D",
    fgSubtle:    "#6B736D",
    fgInverse:   "#0B0E10",
    border:      "#222729",
    borderStrong:"#2E3437",
    ring:        "rgba(52,211,153,.3)",
  },
} as const;

export type SurfaceMode = keyof typeof surface;
export type SurfaceKey  = keyof typeof surface.light;
