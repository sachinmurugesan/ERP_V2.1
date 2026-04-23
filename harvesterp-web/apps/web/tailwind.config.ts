import type { Config } from "tailwindcss";

/**
 * Tailwind CSS v3 configuration for @harvesterp/web (Next.js 15).
 *
 * EXACT MIRROR of apps/ui-gallery/tailwind.config.ts.
 * Only difference: content paths updated for Next.js App Router layout.
 *
 * Color tokens mirror @harvesterp/lib Layer 1 real values (from tokens.css).
 *
 * ARCHITECTURAL SEAM — Task 7 note:
 *   Tailwind v3 kept for shadcn/ui primitive compatibility (v3 HSL CSS-var pattern).
 *   v4 migration: replace tailwind.config.ts with CSS-first @theme {} in globals.css.
 *   See SEAMS.md for full migration notes.
 */
const config: Config = {
  darkMode: ["class", '[class="theme-dark"]'],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        // ── shadcn CSS-variable mappings ──────────────────────────────────
        border:     "hsl(var(--border))",
        input:      "hsl(var(--input))",
        ring:       "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // ── Layer 1 brand palette — real Emerald values ───────────────────
        brand: {
          50:      "#ECFDF5",
          100:     "#D1FAE5",
          200:     "#A7F3D0",
          300:     "#6EE7B7",
          400:     "#34D399",
          500:     "#10B981",
          600:     "#059669",
          700:     "#047857",
          800:     "#065F46",
          900:     "#064E3B",
          950:     "#022C22",
          DEFAULT: "#059669",
        },

        // ── Layer 1 neutral palette — real warm-slate values ──────────────
        neutral: {
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
        },

        // ── Layer 1 semantic tokens ───────────────────────────────────────
        ok:   "#10B981",
        warn: "#F59E0B",
        err:  "#EF4444",
        info: "#3B82F6",

        // ── Layer 1 chart palette ─────────────────────────────────────────
        chart: {
          1: "#10B981",
          2: "#0EA5E9",
          3: "#F59E0B",
          4: "#8B5CF6",
          5: "#F43F5E",
          6: "#64748B",
        },
      },

      borderRadius: {
        xs:      "4px",          // --r-xs
        sm:      "6px",          // --r-sm
        md:      "10px",         // --r-md ← var(--radius)
        lg:      "14px",         // --r-lg
        xl:      "20px",         // --r-xl
        full:    "999px",        // --r-full
        DEFAULT: "var(--radius)",
      },

      fontFamily: {
        sans:    ["Manrope", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono:    ["JetBrains Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
        display: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
        "highlight-flash": {
          "0%":   { backgroundColor: "rgba(16,185,129,0.18)" },
          "100%": { backgroundColor: "transparent" },
        },
        "erp-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.5" },
        },
      },
      animation: {
        "accordion-down":  "accordion-down 0.2s ease-out",
        "accordion-up":    "accordion-up 0.2s ease-out",
        "highlight-flash": "highlight-flash 2s ease-out forwards",
        "erp-pulse":       "erp-pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
