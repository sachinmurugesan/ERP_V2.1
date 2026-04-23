"use client";

import * as React from "react";
import { GallerySection } from "@/gallery/GallerySection";
import { Sidebar } from "@/components/shells/sidebar";

export function SidebarGallery() {
  const [active, setActive] = React.useState("dashboard");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Sidebar</h2>
        <p style={{ color: "var(--fg-muted)", fontSize: 13 }}>
          Primary navigation shell. Uses <code>onNavigate</code> callback seam for router independence.
        </p>
      </div>

      {/* Expanded */}
      <GallerySection title="Expanded (default)">
        <div style={{ height: 600, display: "flex", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
          <Sidebar
            active={active}
            onNavigate={setActive}
            user={{ name: "Sachin M.", roleLabel: "Super Admin" }}
          />
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-muted)", fontSize: 13 }}>
            Active: <strong style={{ marginLeft: 6, color: "var(--fg)" }}>{active}</strong>
          </div>
        </div>
      </GallerySection>

      {/* Compact */}
      <GallerySection title="Compact (icon-only)">
        <div style={{ height: 600, display: "flex", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
          <Sidebar
            compact
            active={active}
            onNavigate={setActive}
            user={{ name: "Sachin M." }}
          />
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-muted)", fontSize: 13 }}>
            Active: <strong style={{ marginLeft: 6, color: "var(--fg)" }}>{active}</strong>
          </div>
        </div>
      </GallerySection>

      {/* With promo slot */}
      <GallerySection title="With promo slot">
        <div style={{ height: 620, display: "flex", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
          <Sidebar
            active={active}
            onNavigate={setActive}
            user={{ name: "Priya K.", roleLabel: "Client" }}
            promoSlot={
              <div style={{
                padding: "12px 14px",
                background: "var(--brand-50)",
                border: "1px solid var(--brand-200)",
                borderRadius: "var(--r-md)",
                fontSize: 12,
              }}>
                <div style={{ fontWeight: 700, color: "var(--brand-800)", marginBottom: 4 }}>
                  HarvestERP Pro
                </div>
                <div style={{ color: "var(--brand-700)", lineHeight: 1.4 }}>
                  Upgrade for advanced analytics & multi-warehouse support.
                </div>
                <button className="btn btn-accent btn-sm" style={{ marginTop: 8, width: "100%" }}>
                  Learn More
                </button>
              </div>
            }
          />
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-muted)", fontSize: 13 }}>
            Active: <strong style={{ marginLeft: 6, color: "var(--fg)" }}>{active}</strong>
          </div>
        </div>
      </GallerySection>

      {/* Factory user */}
      <GallerySection title="Factory role user">
        <div style={{ height: 600, display: "flex", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", overflow: "hidden" }}>
          <Sidebar
            active="orders"
            onNavigate={() => undefined}
            user={{ name: "Rajan Textiles", roleLabel: "Factory" }}
          />
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-muted)", fontSize: 13 }}>
            Factory view — Orders active
          </div>
        </div>
      </GallerySection>
    </div>
  );
}
