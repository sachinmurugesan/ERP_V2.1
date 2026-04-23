/**
 * CSS variable bundles — exact variable names from tokens.css
 *
 * Source: ERP_V1/Design/styles/tokens.css
 *
 * `cssVariables`     — all `:root` tokens (light mode defaults)
 * `cssVariablesDark` — only the subset that `.theme-dark` overrides
 *
 * Usage — inject light defaults + dark overrides on theme toggle:
 *
 *   const root = document.documentElement;
 *   Object.entries(cssVariables).forEach(([k, v]) => root.style.setProperty(k, v));
 *   // on dark mode:
 *   Object.entries(cssVariablesDark).forEach(([k, v]) => root.style.setProperty(k, v));
 *
 * Surface tokens that reference other vars (e.g. "var(--n-25)") will
 * resolve correctly once the neutral vars are also set.
 */
export const cssVariables: Readonly<Record<string, string>> = {
  // Brand — Emerald
  "--brand-50":  "#ECFDF5",
  "--brand-100": "#D1FAE5",
  "--brand-200": "#A7F3D0",
  "--brand-300": "#6EE7B7",
  "--brand-400": "#34D399",
  "--brand-500": "#10B981",
  "--brand-600": "#059669",
  "--brand-700": "#047857",
  "--brand-800": "#065F46",
  "--brand-900": "#064E3B",
  "--brand-950": "#022C22",

  // Neutrals — warm slate
  "--n-0":   "#FFFFFF",
  "--n-25":  "#FAFBFA",
  "--n-50":  "#F6F7F6",
  "--n-100": "#EEF0EE",
  "--n-200": "#E2E5E2",
  "--n-300": "#CBD0CC",
  "--n-400": "#9BA39D",
  "--n-500": "#6B736D",
  "--n-600": "#4B524D",
  "--n-700": "#363C38",
  "--n-800": "#23272A",
  "--n-900": "#14171A",
  "--n-950": "#0B0D0F",

  // Semantic
  "--ok":   "#10B981",
  "--warn": "#F59E0B",
  "--err":  "#EF4444",
  "--info": "#3B82F6",

  // Chart palette
  "--c1": "#10B981",
  "--c2": "#0EA5E9",
  "--c3": "#F59E0B",
  "--c4": "#8B5CF6",
  "--c5": "#F43F5E",
  "--c6": "#64748B",

  // Surfaces — light (var refs resolve after neutral vars are injected)
  "--bg":           "var(--n-25)",
  "--bg-elev":      "var(--n-0)",
  "--bg-sunken":    "var(--n-50)",
  "--bg-inverse":   "var(--n-900)",
  "--fg":           "var(--n-900)",
  "--fg-muted":     "var(--n-500)",
  "--fg-subtle":    "var(--n-400)",
  "--fg-inverse":   "var(--n-0)",
  "--border":       "var(--n-200)",
  "--border-strong":"var(--n-300)",
  "--ring":         "rgba(16,185,129,.25)",

  // Radii
  "--r-xs":   "4px",
  "--r-sm":   "6px",
  "--r-md":   "10px",
  "--r-lg":   "14px",
  "--r-xl":   "20px",
  "--r-full": "999px",

  // Shadows — light mode (default :root)
  "--sh-xs": "0 1px 1px rgba(11,13,15,.04)",
  "--sh-sm": "0 1px 2px rgba(11,13,15,.06), 0 1px 3px rgba(11,13,15,.04)",
  "--sh-md": "0 4px 10px rgba(11,13,15,.06), 0 2px 4px rgba(11,13,15,.04)",
  "--sh-lg": "0 12px 32px rgba(11,13,15,.08), 0 4px 8px rgba(11,13,15,.04)",

  // Typography
  "--f-sans":    '"Manrope", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  "--f-mono":    '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace',
  "--f-display": '"Manrope", ui-sans-serif, system-ui, sans-serif',

  // Spacing
  "--s-1":  "4px",
  "--s-2":  "8px",
  "--s-3":  "12px",
  "--s-4":  "16px",
  "--s-5":  "20px",
  "--s-6":  "24px",
  "--s-8":  "32px",
  "--s-10": "40px",
  "--s-12": "48px",
};

/**
 * Dark-mode CSS variable overrides — the subset of `.theme-dark` from tokens.css.
 *
 * Apply these *on top of* `cssVariables` when switching to dark mode.
 * Only 15 variables change; brand/neutral/semantic/chart/radii/typography/spacing
 * are identical in both themes.
 */
export const cssVariablesDark: Readonly<Record<string, string>> = {
  // Surfaces — dark overrides
  "--bg":          "#0B0E10",
  "--bg-elev":     "#14181B",
  "--bg-sunken":   "#0F1214",
  "--bg-inverse":  "#FAFBFA",
  "--fg":          "#E8ECEA",
  "--fg-muted":    "#9BA39D",
  "--fg-subtle":   "#6B736D",
  "--fg-inverse":  "#0B0E10",
  "--border":      "#222729",
  "--border-strong":"#2E3437",
  "--ring":        "rgba(52,211,153,.3)",

  // Shadows — dark overrides
  "--sh-xs": "0 1px 1px rgba(0,0,0,.3)",
  "--sh-sm": "0 1px 2px rgba(0,0,0,.4), 0 1px 3px rgba(0,0,0,.3)",
  "--sh-md": "0 4px 10px rgba(0,0,0,.5), 0 2px 4px rgba(0,0,0,.3)",
  "--sh-lg": "0 12px 32px rgba(0,0,0,.6), 0 4px 8px rgba(0,0,0,.3)",
};
