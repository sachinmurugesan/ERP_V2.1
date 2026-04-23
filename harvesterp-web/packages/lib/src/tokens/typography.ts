/**
 * Design token: typography
 *
 * Source: ERP_V1/Design/styles/tokens.css  (--f-sans / --f-mono / --f-display)
 *         ERP_V1/Design/styles/components.css  (.erp-root font-feature-settings)
 */

// ---------------------------------------------------------------------------
// Font stacks (--f-sans / --f-mono / --f-display)
// ---------------------------------------------------------------------------

export const fontFamily = {
  sans:    ["Manrope", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
  mono:    ["JetBrains Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
  display: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
} as const;

// ---------------------------------------------------------------------------
// Font feature settings
// Applied via font-feature-settings on the erp-root base class.
// ---------------------------------------------------------------------------

export const fontFeatureSettings = {
  /** Humanist sans alternates (Manrope ss01 + cv11) */
  sans:    '"ss01", "cv11"',
  /** Tabular numerics for tables, financial data, mono font */
  numeric: '"tnum"',
} as const;

// ---------------------------------------------------------------------------
// Font size / weight scales
// Design system does not tokenise these at the CSS-variable level;
// the values below are the standard Tailwind scale in use throughout.
// ---------------------------------------------------------------------------

export const fontSize = {
  xs:    ["0.75rem",  { lineHeight: "1rem" }],
  sm:    ["0.875rem", { lineHeight: "1.25rem" }],
  base:  ["1rem",     { lineHeight: "1.5rem" }],
  lg:    ["1.125rem", { lineHeight: "1.75rem" }],
  xl:    ["1.25rem",  { lineHeight: "1.75rem" }],
  "2xl": ["1.5rem",   { lineHeight: "2rem" }],
  "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
  "4xl": ["2.25rem",  { lineHeight: "2.5rem" }],
} as const;

export const fontWeight = {
  normal:   "400",
  medium:   "500",
  semibold: "600",
  bold:     "700",
} as const;

export type FontFamilyKey   = keyof typeof fontFamily;
export type FontSizeKey     = keyof typeof fontSize;
export type FontWeightKey   = keyof typeof fontWeight;
