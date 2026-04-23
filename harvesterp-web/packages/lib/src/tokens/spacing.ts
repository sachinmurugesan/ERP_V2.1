/**
 * Design token: spacing scale
 *
 * Source: ERP_V1/Design/styles/tokens.css  (--s-1 … --s-12)
 * Steps s-7, s-9, s-11 are intentionally absent from the design system.
 */

export const spacing = {
  "s-1":  "4px",
  "s-2":  "8px",
  "s-3":  "12px",
  "s-4":  "16px",
  "s-5":  "20px",
  "s-6":  "24px",
  "s-8":  "32px",
  "s-10": "40px",
  "s-12": "48px",
} as const;

export type SpacingKey = keyof typeof spacing;
