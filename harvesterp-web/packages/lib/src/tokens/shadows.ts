/**
 * Design token: box-shadow scale
 *
 * Source: ERP_V1/Design/styles/tokens.css
 *   :root        → shadows.light  (default `:root` values)
 *   .theme-dark  → shadows.dark   (overrides applied via .theme-dark class)
 *
 * Structure mirrors `surface` in colors.ts so consumers select by theme
 * the same way: `shadows[theme][size]`.
 */

export const shadows = {
  light: {
    xs: "0 1px 1px rgba(11,13,15,.04)",
    sm: "0 1px 2px rgba(11,13,15,.06), 0 1px 3px rgba(11,13,15,.04)",
    md: "0 4px 10px rgba(11,13,15,.06), 0 2px 4px rgba(11,13,15,.04)",
    lg: "0 12px 32px rgba(11,13,15,.08), 0 4px 8px rgba(11,13,15,.04)",
  },
  dark: {
    xs: "0 1px 1px rgba(0,0,0,.3)",
    sm: "0 1px 2px rgba(0,0,0,.4), 0 1px 3px rgba(0,0,0,.3)",
    md: "0 4px 10px rgba(0,0,0,.5), 0 2px 4px rgba(0,0,0,.3)",
    lg: "0 12px 32px rgba(0,0,0,.6), 0 4px 8px rgba(0,0,0,.3)",
  },
} as const;

export type ShadowSize  = keyof typeof shadows.light;
export type ShadowTheme = keyof typeof shadows;
