/**
 * Smoke tests for design tokens.
 * Tokens are pure `as const` data — tests verify shape/presence and real values
 * sourced from ERP_V1/Design/styles/tokens.css.
 */
import { describe, it, expect } from "vitest";
import {
  brand,
  neutral,
  semantic,
  chart,
  surface,
} from "../../src/tokens/colors.js";
import { spacing } from "../../src/tokens/spacing.js";
import { fontFamily, fontFeatureSettings, fontSize, fontWeight } from "../../src/tokens/typography.js";
import { radii } from "../../src/tokens/radii.js";
import { shadows } from "../../src/tokens/shadows.js";
import { cssVariables, cssVariablesDark } from "../../src/tokens/css-vars.js";

const HEX6 = /^#[0-9a-fA-F]{6}$/;

// ---------------------------------------------------------------------------
// brand
// ---------------------------------------------------------------------------

describe("brand", () => {
  it("has all 11 shades (50 through 950)", () => {
    const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
    for (const shade of shades) {
      expect(brand[shade]).toMatch(HEX6);
    }
  });

  it("brand[500] is the primary emerald #10B981", () => {
    expect(brand[500]).toBe("#10B981");
  });

  it("brand[600] is #059669 (avatar gradient start)", () => {
    expect(brand[600]).toBe("#059669");
  });

  it("brand[800] is #065F46 (avatar gradient end / primary button)", () => {
    expect(brand[800]).toBe("#065F46");
  });

  it("brand[50] is the lightest tint #ECFDF5", () => {
    expect(brand[50]).toBe("#ECFDF5");
  });

  it("brand[950] is the darkest shade #022C22", () => {
    expect(brand[950]).toBe("#022C22");
  });
});

// ---------------------------------------------------------------------------
// neutral
// ---------------------------------------------------------------------------

describe("neutral", () => {
  it("has all shades including 0, 25, and 50", () => {
    expect(neutral[0]).toBe("#FFFFFF");
    expect(neutral[25]).toBe("#FAFBFA");
    expect(neutral[50]).toBe("#F6F7F6");
  });

  it("neutral[950] is the near-black #0B0D0F", () => {
    expect(neutral[950]).toBe("#0B0D0F");
  });

  it("all values are valid hex strings", () => {
    for (const v of Object.values(neutral)) {
      expect(v).toMatch(HEX6);
    }
  });

  it("neutral[900] is #14171A (dark text / bg-inverse in light mode)", () => {
    expect(neutral[900]).toBe("#14171A");
  });
});

// ---------------------------------------------------------------------------
// semantic
// ---------------------------------------------------------------------------

describe("semantic", () => {
  it("has ok, warn, err, info", () => {
    expect(semantic.ok).toMatch(HEX6);
    expect(semantic.warn).toMatch(HEX6);
    expect(semantic.err).toMatch(HEX6);
    expect(semantic.info).toMatch(HEX6);
  });

  it("ok matches brand[500] (emerald success)", () => {
    expect(semantic.ok).toBe("#10B981");
  });

  it("warn is amber #F59E0B", () => {
    expect(semantic.warn).toBe("#F59E0B");
  });

  it("err is red #EF4444", () => {
    expect(semantic.err).toBe("#EF4444");
  });

  it("info is blue #3B82F6", () => {
    expect(semantic.info).toBe("#3B82F6");
  });
});

// ---------------------------------------------------------------------------
// chart
// ---------------------------------------------------------------------------

describe("chart", () => {
  it("has c1 through c6", () => {
    const keys = ["c1", "c2", "c3", "c4", "c5", "c6"] as const;
    for (const k of keys) {
      expect(chart[k]).toMatch(HEX6);
    }
  });

  it("chart.c1 is emerald (same as brand[500])", () => {
    expect(chart.c1).toBe("#10B981");
  });

  it("chart.c2 is sky blue #0EA5E9", () => {
    expect(chart.c2).toBe("#0EA5E9");
  });
});

// ---------------------------------------------------------------------------
// surface
// ---------------------------------------------------------------------------

describe("surface.light", () => {
  it("bg references var(--n-25)", () => {
    expect(surface.light.bg).toBe("var(--n-25)");
  });

  it("ring is rgba brand green", () => {
    expect(surface.light.ring).toBe("rgba(16,185,129,.25)");
  });

  it("has border and borderStrong", () => {
    expect(surface.light.border).toBeDefined();
    expect(surface.light.borderStrong).toBeDefined();
  });
});

describe("surface.dark", () => {
  it("bg is the darkest near-black #0B0E10", () => {
    expect(surface.dark.bg).toBe("#0B0E10");
  });

  it("ring uses brand-400 green at 30% opacity", () => {
    expect(surface.dark.ring).toBe("rgba(52,211,153,.3)");
  });

  it("fg is off-white #E8ECEA", () => {
    expect(surface.dark.fg).toBe("#E8ECEA");
  });
});

// ---------------------------------------------------------------------------
// spacing
// ---------------------------------------------------------------------------

describe("spacing", () => {
  it("s-1 is 4px", () => {
    expect(spacing["s-1"]).toBe("4px");
  });

  it("s-4 is 16px", () => {
    expect(spacing["s-4"]).toBe("16px");
  });

  it("s-6 is 24px", () => {
    expect(spacing["s-6"]).toBe("24px");
  });

  it("s-8 is 32px", () => {
    expect(spacing["s-8"]).toBe("32px");
  });

  it("s-12 is 48px", () => {
    expect(spacing["s-12"]).toBe("48px");
  });

  it("has exactly 9 defined steps (s-7/s-9/s-11 intentionally absent)", () => {
    expect(Object.keys(spacing)).toHaveLength(9);
  });
});

// ---------------------------------------------------------------------------
// typography
// ---------------------------------------------------------------------------

describe("fontFamily", () => {
  it("sans[0] is Manrope", () => {
    expect(fontFamily.sans[0]).toBe("Manrope");
  });

  it("mono[0] is JetBrains Mono", () => {
    expect(fontFamily.mono[0]).toBe("JetBrains Mono");
  });

  it("display[0] is Manrope", () => {
    expect(fontFamily.display[0]).toBe("Manrope");
  });

  it("sans is an array with fallbacks", () => {
    expect(Array.isArray(fontFamily.sans)).toBe(true);
    expect(fontFamily.sans.length).toBeGreaterThan(1);
  });
});

describe("fontFeatureSettings", () => {
  it("sans contains ss01 and cv11", () => {
    expect(fontFeatureSettings.sans).toContain("ss01");
    expect(fontFeatureSettings.sans).toContain("cv11");
  });

  it("numeric contains tnum", () => {
    expect(fontFeatureSettings.numeric).toContain("tnum");
  });
});

describe("fontSize", () => {
  it("fontSize.base[0] is 1rem", () => {
    expect(fontSize.base[0]).toBe("1rem");
  });
});

describe("fontWeight", () => {
  it("fontWeight.bold is '700'", () => {
    expect(fontWeight.bold).toBe("700");
  });

  it("fontWeight.semibold is '600'", () => {
    expect(fontWeight.semibold).toBe("600");
  });
});

// ---------------------------------------------------------------------------
// radii
// ---------------------------------------------------------------------------

describe("radii", () => {
  it("radii.xs is 4px", () => {
    expect(radii.xs).toBe("4px");
  });

  it("radii.sm is 6px", () => {
    expect(radii.sm).toBe("6px");
  });

  it("radii.md is 10px", () => {
    expect(radii.md).toBe("10px");
  });

  it("radii.lg is 14px", () => {
    expect(radii.lg).toBe("14px");
  });

  it("radii.xl is 20px", () => {
    expect(radii.xl).toBe("20px");
  });

  it("radii.full is 999px", () => {
    expect(radii.full).toBe("999px");
  });

  it("has exactly 6 keys", () => {
    expect(Object.keys(radii)).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// shadows — light
// ---------------------------------------------------------------------------

describe("shadows.light", () => {
  it("shadows.light.xs is the hairline shadow", () => {
    expect(shadows.light.xs).toBe("0 1px 1px rgba(11,13,15,.04)");
  });

  it("shadows.light.sm contains two layers with rgba(11,13,15,.06)", () => {
    expect(shadows.light.sm).toContain(",");
    expect(shadows.light.sm).toContain("rgba(11,13,15,.06)");
  });

  it("shadows.light.md starts with 0 4px", () => {
    expect(shadows.light.md).toMatch(/^0 4px/);
  });

  it("shadows.light.lg has the 32px spread", () => {
    expect(shadows.light.lg).toContain("32px");
  });

  it("has exactly 4 sizes (xs/sm/md/lg)", () => {
    expect(Object.keys(shadows.light)).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// shadows — dark
// ---------------------------------------------------------------------------

describe("shadows.dark", () => {
  it("shadows.dark.xs uses opaque black (rgba(0,0,0,.3))", () => {
    expect(shadows.dark.xs).toBe("0 1px 1px rgba(0,0,0,.3)");
  });

  it("shadows.dark.sm uses rgba(0,0,0,.4) and rgba(0,0,0,.3)", () => {
    expect(shadows.dark.sm).toContain("rgba(0,0,0,.4)");
    expect(shadows.dark.sm).toContain("rgba(0,0,0,.3)");
  });

  it("shadows.dark.md uses rgba(0,0,0,.5)", () => {
    expect(shadows.dark.md).toContain("rgba(0,0,0,.5)");
  });

  it("shadows.dark.lg uses rgba(0,0,0,.6) and has 32px spread", () => {
    expect(shadows.dark.lg).toContain("rgba(0,0,0,.6)");
    expect(shadows.dark.lg).toContain("32px");
  });

  it("has the same 4 sizes as light", () => {
    expect(Object.keys(shadows.dark)).toEqual(Object.keys(shadows.light));
  });

  it("shadows has exactly 2 themes (light/dark)", () => {
    expect(Object.keys(shadows)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// cssVariables
// ---------------------------------------------------------------------------

describe("cssVariables", () => {
  it("is a non-empty object", () => {
    expect(Object.keys(cssVariables).length).toBeGreaterThan(0);
  });

  it("all keys start with --", () => {
    for (const key of Object.keys(cssVariables)) {
      expect(key).toMatch(/^--/);
    }
  });

  it("contains --brand-500", () => {
    expect(cssVariables["--brand-500"]).toBe("#10B981");
  });

  it("contains --brand-600 and --brand-800 (avatar gradient)", () => {
    expect(cssVariables["--brand-600"]).toBe("#059669");
    expect(cssVariables["--brand-800"]).toBe("#065F46");
  });

  it("contains all 11 brand shades", () => {
    const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
    for (const s of shades) {
      expect(cssVariables[`--brand-${s}`]).toBeDefined();
    }
  });

  it("contains all 14 neutral stops", () => {
    const stops = [0, 25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
    for (const s of stops) {
      expect(cssVariables[`--n-${s}`]).toBeDefined();
    }
  });

  it("contains semantic vars --ok, --warn, --err, --info", () => {
    expect(cssVariables["--ok"]).toBe("#10B981");
    expect(cssVariables["--warn"]).toBe("#F59E0B");
    expect(cssVariables["--err"]).toBe("#EF4444");
    expect(cssVariables["--info"]).toBe("#3B82F6");
  });

  it("contains chart vars --c1 through --c6", () => {
    for (let i = 1; i <= 6; i++) {
      expect(cssVariables[`--c${i}`]).toBeDefined();
    }
  });

  it("contains all 6 radius vars", () => {
    for (const k of ["xs", "sm", "md", "lg", "xl", "full"]) {
      expect(cssVariables[`--r-${k}`]).toBeDefined();
    }
  });

  it("contains all 4 shadow vars", () => {
    for (const k of ["xs", "sm", "md", "lg"]) {
      expect(cssVariables[`--sh-${k}`]).toBeDefined();
    }
  });

  it("contains typography vars --f-sans, --f-mono, --f-display", () => {
    expect(cssVariables["--f-sans"]).toContain("Manrope");
    expect(cssVariables["--f-mono"]).toContain("JetBrains Mono");
    expect(cssVariables["--f-display"]).toContain("Manrope");
  });

  it("contains all 9 spacing vars", () => {
    for (const k of [1, 2, 3, 4, 5, 6, 8, 10, 12]) {
      expect(cssVariables[`--s-${k}`]).toBeDefined();
    }
  });

  it("--s-4 is 16px", () => {
    expect(cssVariables["--s-4"]).toBe("16px");
  });

  it("has at least 60 entries (comprehensive coverage check)", () => {
    expect(Object.keys(cssVariables).length).toBeGreaterThanOrEqual(60);
  });

  it("light shadow vars use rgba(11,13,15,…) ink", () => {
    expect(cssVariables["--sh-xs"]).toContain("rgba(11,13,15");
    expect(cssVariables["--sh-lg"]).toContain("rgba(11,13,15");
  });
});

// ---------------------------------------------------------------------------
// cssVariablesDark
// ---------------------------------------------------------------------------

describe("cssVariablesDark", () => {
  it("is a non-empty object", () => {
    expect(Object.keys(cssVariablesDark).length).toBeGreaterThan(0);
  });

  it("all keys start with --", () => {
    for (const key of Object.keys(cssVariablesDark)) {
      expect(key).toMatch(/^--/);
    }
  });

  it("has exactly 15 overrides (11 surface + 4 shadows)", () => {
    expect(Object.keys(cssVariablesDark)).toHaveLength(15);
  });

  it("overrides all 4 shadow vars with opaque black values", () => {
    expect(cssVariablesDark["--sh-xs"]).toContain("rgba(0,0,0");
    expect(cssVariablesDark["--sh-sm"]).toContain("rgba(0,0,0");
    expect(cssVariablesDark["--sh-md"]).toContain("rgba(0,0,0");
    expect(cssVariablesDark["--sh-lg"]).toContain("rgba(0,0,0");
  });

  it("--sh-xs dark value matches tokens.css .theme-dark exactly", () => {
    expect(cssVariablesDark["--sh-xs"]).toBe("0 1px 1px rgba(0,0,0,.3)");
  });

  it("--sh-lg dark uses rgba(0,0,0,.6) and 32px", () => {
    expect(cssVariablesDark["--sh-lg"]).toContain("rgba(0,0,0,.6)");
    expect(cssVariablesDark["--sh-lg"]).toContain("32px");
  });

  it("overrides --bg to #0B0E10", () => {
    expect(cssVariablesDark["--bg"]).toBe("#0B0E10");
  });

  it("overrides --fg to off-white #E8ECEA", () => {
    expect(cssVariablesDark["--fg"]).toBe("#E8ECEA");
  });

  it("overrides --ring to brand-400 green at 30%", () => {
    expect(cssVariablesDark["--ring"]).toBe("rgba(52,211,153,.3)");
  });

  it("does NOT override brand/neutral/semantic vars (they are theme-independent)", () => {
    expect(cssVariablesDark["--brand-500"]).toBeUndefined();
    expect(cssVariablesDark["--n-900"]).toBeUndefined();
    expect(cssVariablesDark["--ok"]).toBeUndefined();
  });

  it("dark shadow values differ from light shadow values", () => {
    expect(cssVariablesDark["--sh-xs"]).not.toBe(cssVariables["--sh-xs"]);
    expect(cssVariablesDark["--sh-lg"]).not.toBe(cssVariables["--sh-lg"]);
  });
});
