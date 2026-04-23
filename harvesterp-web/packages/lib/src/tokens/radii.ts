/**
 * Design token: border-radius scale
 *
 * Source: ERP_V1/Design/styles/tokens.css  (--r-xs … --r-full)
 */

export const radii = {
  xs:   "4px",
  sm:   "6px",
  md:   "10px",
  lg:   "14px",
  xl:   "20px",
  full: "999px",
} as const;

export type RadiusKey = keyof typeof radii;
