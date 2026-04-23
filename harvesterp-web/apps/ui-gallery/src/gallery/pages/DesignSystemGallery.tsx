"use client";

import { GallerySection } from "@/gallery/GallerySection";
import { Icon, type IconName } from "@/components/design-system/icon";
import { DSAvatar } from "@/components/design-system/ds-avatar";
import { Progress } from "@/components/design-system/progress";
import { HarvestERPLogo } from "@/components/design-system/logo";

// ── Colour palette ────────────────────────────────────────────────────────────

const BRAND_SHADES = [
  { shade: "50",  hex: "#ECFDF5" },
  { shade: "100", hex: "#D1FAE5" },
  { shade: "200", hex: "#A7F3D0" },
  { shade: "300", hex: "#6EE7B7" },
  { shade: "400", hex: "#34D399" },
  { shade: "500", hex: "#10B981" },
  { shade: "600", hex: "#059669" },
  { shade: "700", hex: "#047857" },
  { shade: "800", hex: "#065F46" },
  { shade: "900", hex: "#064E3B" },
  { shade: "950", hex: "#022C22" },
];

const NEUTRAL_SHADES = [
  { shade: "0",   hex: "#FFFFFF" },
  { shade: "25",  hex: "#FAFBFA" },
  { shade: "50",  hex: "#F6F7F6" },
  { shade: "100", hex: "#EEF0EE" },
  { shade: "200", hex: "#E2E5E2" },
  { shade: "300", hex: "#CBD0CC" },
  { shade: "400", hex: "#9BA39D" },
  { shade: "500", hex: "#6B736D" },
  { shade: "600", hex: "#4B524D" },
  { shade: "700", hex: "#363C38" },
  { shade: "800", hex: "#23272A" },
  { shade: "900", hex: "#14171A" },
  { shade: "950", hex: "#0B0D0F" },
];

const SEMANTIC = [
  { name: "ok (success)",  hex: "#10B981", var: "--ok"   },
  { name: "warn",          hex: "#F59E0B", var: "--warn" },
  { name: "err (danger)",  hex: "#EF4444", var: "--err"  },
  { name: "info",          hex: "#3B82F6", var: "--info" },
];

const CHART = [
  { name: "c1 emerald", hex: "#10B981" },
  { name: "c2 sky",     hex: "#0EA5E9" },
  { name: "c3 amber",   hex: "#F59E0B" },
  { name: "c4 violet",  hex: "#8B5CF6" },
  { name: "c5 rose",    hex: "#F43F5E" },
  { name: "c6 slate",   hex: "#64748B" },
];

// ── Icons ─────────────────────────────────────────────────────────────────────

const ALL_ICONS: IconName[] = [
  "home","dashboard","finance","sales","crm","inventory","procurement","reports","settings",
  "search","bell","plus","filter","download","upload",
  "chevronR","chevronL","chevronD","chevronU","arrowUp","arrowDown","arrowRight",
  "check","close","more","moreV","calendar","clock","user","logout","moon","sun","expand",
  "box","truck","invoice","credit","globe","shield","tag","warning","flame","star","sparkle",
  "zap","refresh","grid","list","help",
];

// ── Component ─────────────────────────────────────────────────────────────────

export function DesignSystemGallery() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Design System</h2>
        <p style={{ color: "var(--fg-muted)", fontSize: 13 }}>
          Layer 1 tokens, icons, avatars, and primitives — sourced from <code>@harvesterp/lib</code>.
        </p>
      </div>

      {/* Brand */}
      <GallerySection title="Brand palette — Emerald">
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {BRAND_SHADES.map(({ shade, hex }) => (
            <div key={shade} style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 52, height: 52, borderRadius: "var(--r-md)",
                  background: hex, border: "1px solid rgba(0,0,0,.08)",
                }}
              />
              <div style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 4 }}>{shade}</div>
              <div style={{ fontSize: 9, color: "var(--fg-subtle)", fontFamily: "var(--f-mono)" }}>{hex}</div>
            </div>
          ))}
        </div>
      </GallerySection>

      {/* Neutral */}
      <GallerySection title="Neutral palette — Warm Slate">
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {NEUTRAL_SHADES.map(({ shade, hex }) => (
            <div key={shade} style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 52, height: 52, borderRadius: "var(--r-md)",
                  background: hex, border: "1px solid rgba(0,0,0,.08)",
                }}
              />
              <div style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 4 }}>{shade}</div>
              <div style={{ fontSize: 9, color: "var(--fg-subtle)", fontFamily: "var(--f-mono)" }}>{hex}</div>
            </div>
          ))}
        </div>
      </GallerySection>

      {/* Semantic */}
      <GallerySection title="Semantic tokens">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {SEMANTIC.map(({ name, hex, var: cssVar }) => (
            <div key={cssVar} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: "var(--r-sm)", background: hex }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{name}</div>
                <div style={{ fontSize: 11, color: "var(--fg-muted)", fontFamily: "var(--f-mono)" }}>{cssVar} · {hex}</div>
              </div>
            </div>
          ))}
        </div>
      </GallerySection>

      {/* Chart */}
      <GallerySection title="Chart palette">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {CHART.map(({ name, hex }) => (
            <div key={hex} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "var(--r-xs)", background: hex }} />
              <div>
                <div style={{ fontSize: 11, fontWeight: 600 }}>{name}</div>
                <div style={{ fontSize: 10, color: "var(--fg-subtle)", fontFamily: "var(--f-mono)" }}>{hex}</div>
              </div>
            </div>
          ))}
        </div>
      </GallerySection>

      {/* Logo */}
      <GallerySection title="Logo">
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          {([16, 24, 32, 48] as const).map(size => (
            <div key={size} style={{ textAlign: "center" }}>
              <HarvestERPLogo size={size} />
              <div style={{ fontSize: 10, color: "var(--fg-subtle)", marginTop: 4 }}>{size}px</div>
            </div>
          ))}
        </div>
      </GallerySection>

      {/* Icons */}
      <GallerySection title={`Icons (${ALL_ICONS.length})`}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {ALL_ICONS.map(name => (
            <div
              key={name}
              title={name}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 4, padding: "10px 8px", borderRadius: "var(--r-sm)",
                border: "1px solid var(--border)", width: 68,
                background: "var(--bg-elev)",
              }}
            >
              <Icon name={name} size={18} />
              <span style={{ fontSize: 9, color: "var(--fg-subtle)", textAlign: "center", lineHeight: 1.2 }}>
                {name}
              </span>
            </div>
          ))}
        </div>
      </GallerySection>

      {/* Avatars */}
      <GallerySection title="DSAvatar">
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          {(["sm", "md", "lg"] as const).map(size => (
            <div key={size} style={{ textAlign: "center" }}>
              <DSAvatar name="Sachin M." size={size} variant="gradient" />
              <div style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 6 }}>{size} gradient</div>
            </div>
          ))}
          {(["sm", "md", "lg"] as const).map(size => (
            <div key={`hash-${size}`} style={{ textAlign: "center" }}>
              <DSAvatar name="Priya K." size={size} variant="hash" />
              <div style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 6 }}>{size} hash</div>
            </div>
          ))}
          <div style={{ textAlign: "center" }}>
            <DSAvatar name="Admin User" size="md" variant="role" role="INTERNAL" />
            <div style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 6 }}>role</div>
          </div>
        </div>
      </GallerySection>

      {/* Buttons */}
      <GallerySection title="Buttons (.btn)">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn btn-primary">Primary</button>
          <button className="btn btn-secondary">Secondary</button>
          <button className="btn btn-ghost">Ghost</button>
          <button className="btn btn-accent">Accent</button>
          <button className="btn btn-danger">Danger</button>
          <button className="btn btn-primary btn-sm">Small</button>
          <button className="btn btn-primary btn-lg">Large</button>
        </div>
      </GallerySection>

      {/* Chips */}
      <GallerySection title="Chips (.chip)">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="chip">Default</span>
          <span className="chip chip-ok chip-dot">Paid</span>
          <span className="chip chip-warn chip-dot">Pending</span>
          <span className="chip chip-err chip-dot">Overdue</span>
          <span className="chip chip-info chip-dot">Draft</span>
          <span className="chip chip-accent">New</span>
        </div>
      </GallerySection>

      {/* Progress */}
      <GallerySection title="Progress">
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 320 }}>
          <Progress value={72} />
          <Progress value={45} color="var(--warn)" />
          <Progress value={20} color="var(--err)" />
          <Progress value={90} color="var(--info)" height={10} />
        </div>
      </GallerySection>

      {/* Radii */}
      <GallerySection title="Border radii">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          {[
            { name: "xs (4px)",  r: "var(--r-xs)" },
            { name: "sm (6px)",  r: "var(--r-sm)" },
            { name: "md (10px)", r: "var(--r-md)" },
            { name: "lg (14px)", r: "var(--r-lg)" },
            { name: "xl (20px)", r: "var(--r-xl)" },
            { name: "full",      r: "var(--r-full)" },
          ].map(({ name, r }) => (
            <div key={name} style={{ textAlign: "center" }}>
              <div style={{
                width: 52, height: 52, background: "var(--brand-100)",
                border: "2px solid var(--brand-400)", borderRadius: r,
              }} />
              <div style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 6 }}>{name}</div>
            </div>
          ))}
        </div>
      </GallerySection>

      {/* Shadows */}
      <GallerySection title="Shadows">
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {[
            { name: "xs", sh: "var(--sh-xs)" },
            { name: "sm", sh: "var(--sh-sm)" },
            { name: "md", sh: "var(--sh-md)" },
            { name: "lg", sh: "var(--sh-lg)" },
          ].map(({ name, sh }) => (
            <div
              key={name}
              style={{
                width: 80, height: 80, borderRadius: "var(--r-md)",
                background: "var(--bg-elev)", boxShadow: sh,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 600, color: "var(--fg-muted)",
              }}
            >
              {name}
            </div>
          ))}
        </div>
      </GallerySection>

      {/* Typography */}
      <GallerySection title="Typography">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.8 }}>Display / H1 · 30 700</div>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4 }}>Heading 2 · 22 700</div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Heading 3 · 16 600</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Body large · 14 500</div>
          <div style={{ fontSize: 13 }}>Body default · 13 400 — Lorem ipsum dolor sit amet.</div>
          <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>Small / muted · 12 400</div>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--fg-muted)" }}>Label · 11 600</div>
          <div style={{ fontFamily: "var(--f-mono)", fontSize: 12 }}>Mono · JetBrains Mono · 12px</div>
        </div>
      </GallerySection>
    </div>
  );
}
