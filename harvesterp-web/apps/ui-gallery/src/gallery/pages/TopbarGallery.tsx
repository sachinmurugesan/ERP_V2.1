"use client";

import * as React from "react";
import { GallerySection } from "@/gallery/GallerySection";
import { Topbar, type Currency } from "@/components/shells/topbar";

export function TopbarGallery() {
  const [theme, setTheme] = React.useState<"light" | "dark">("light");
  const [currency, setCurrency] = React.useState<Currency>("INR");

  const toggleTheme = () => setTheme(t => t === "light" ? "dark" : "light");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Topbar</h2>
        <p style={{ color: "var(--fg-muted)", fontSize: 13 }}>
          Application header shell. Currency switcher (INR/USD/CNY), theme toggle, and notification bell.
        </p>
      </div>

      {/* Default */}
      <GallerySection title="Default — title + controls">
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
          <Topbar
            title="Dashboard"
            subtitle="Overview"
            currency={currency}
            onCurrencyChange={setCurrency}
            theme={theme}
            onToggleTheme={toggleTheme}
            notificationCount={4}
          />
        </div>
        <p style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 8 }}>
          Currency: <strong>{currency}</strong> · Theme: <strong>{theme}</strong>
        </p>
      </GallerySection>

      {/* With breadcrumbs */}
      <GallerySection title="Breadcrumbs">
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
          <Topbar
            title="PO-2024-0042"
            breadcrumbs={[
              { label: "Orders" },
              { label: "Purchase Orders" },
              { label: "PO-2024-0042" },
            ]}
            currency={currency}
            onCurrencyChange={setCurrency}
            theme={theme}
            onToggleTheme={toggleTheme}
            notificationCount={0}
          />
        </div>
      </GallerySection>

      {/* With right slot */}
      <GallerySection title="Custom right slot">
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
          <Topbar
            title="Orders"
            currency={currency}
            onCurrencyChange={setCurrency}
            theme={theme}
            onToggleTheme={toggleTheme}
            notificationCount={2}
            right={
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary btn-sm">Export</button>
                <button className="btn btn-primary btn-sm">+ New Order</button>
              </div>
            }
          />
        </div>
      </GallerySection>

      {/* No controls */}
      <GallerySection title="Minimal (no controls)">
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
          <Topbar title="Settings" />
        </div>
      </GallerySection>
    </div>
  );
}
