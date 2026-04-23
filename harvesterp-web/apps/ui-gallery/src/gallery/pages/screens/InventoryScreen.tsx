"use client";

import * as React from "react";
import { Sidebar } from "@/components/shells/sidebar";
import { Topbar, type Currency } from "@/components/shells/topbar";
import { KpiCard } from "@/components/composed/kpi-card";
import { BarChart } from "@/components/design-system/bar-chart";
import { Progress } from "@/components/design-system/progress";

// ── Stub data ─────────────────────────────────────────────────────────────────

const STOCK_MOVEMENT_RAW = [320, 280, 410, 380, 450, 420, 390, 480];
const STOCK_MOVEMENT = ["28 Dec","29 Dec","30 Dec","31 Dec","1 Jan","2 Jan","3 Jan","4 Jan"].map((label, i) => ({ label, values: [STOCK_MOVEMENT_RAW[i]] }));

const STOCK_ITEMS = [
  { sku: "FAB-WOV-001", name: "Premium Woven Cotton — 60\"",   qty: 12400, unit: "m",  reorder: 5000,  util: 82, location: "Rack A-12" },
  { sku: "FAB-KNT-008", name: "Single Jersey Knit — 180gsm",   qty: 8200,  unit: "m",  reorder: 3000,  util: 65, location: "Rack B-04" },
  { sku: "ACC-BUT-022", name: "Horn Buttons 18L — Natural",     qty: 48000, unit: "pc", reorder: 20000, util: 42, location: "Bin C-11" },
  { sku: "FAB-DEN-005", name: "Denim 14oz — Indigo Washed",     qty: 3200,  unit: "m",  reorder: 4000,  util: 91, location: "Rack D-02" },
  { sku: "ACC-THR-014", name: "Polyester Thread — Spun 40s",    qty: 920,   unit: "kg", reorder: 500,   util: 28, location: "Bin E-07" },
  { sku: "FAB-LIN-003", name: "Linen Blend 55/45 — Natural",    qty: 6800,  unit: "m",  reorder: 2000,  util: 72, location: "Rack A-09" },
];

const LOW_STOCK = STOCK_ITEMS.filter(i => i.qty <= i.reorder * 1.1);

/**
 * Inventory Screen — stock levels, movement, low-stock alerts.
 */
export function InventoryScreen() {
  const [active, setActive] = React.useState("warehouse");
  const [currency, setCurrency] = React.useState<Currency>("INR");
  const [theme, setTheme] = React.useState<"light" | "dark">("light");
  const [search, setSearch] = React.useState("");

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("theme-dark", next === "dark");
  };

  const filtered = STOCK_ITEMS.filter(
    i => i.name.toLowerCase().includes(search.toLowerCase()) || i.sku.includes(search.toUpperCase())
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>
      <Sidebar active={active} onNavigate={setActive} user={{ name: "Deepa V.", roleLabel: "Warehouse Manager" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Topbar
          title="Warehouse"
          breadcrumbs={[{ label: "Operations" }, { label: "Warehouse" }]}
          currency={currency}
          onCurrencyChange={setCurrency}
          theme={theme}
          onToggleTheme={toggleTheme}
          notificationCount={2}
          right={
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary btn-sm">Import</button>
              <button className="btn btn-primary btn-sm">+ Add SKU</button>
            </div>
          }
        />

        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            <KpiCard label="Total SKUs"         value="284"    delta="+12" deltaDirection="up" subtext="active" icon="inventory" />
            <KpiCard label="Low Stock Alerts"   value={`${LOW_STOCK.length}`}  tone="warn" icon="warning" subtext="need reorder" />
            <KpiCard label="Units Moved Today"  value="1,840"  delta="+6.2%"  deltaDirection="up" icon="box" spark={[280, 320, 310, 350, 380, 360, 400, 420]} />
            <KpiCard label="Warehouse Utilisation" value="72%" delta="+3%"    deltaDirection="up" icon="grid" tone="ok" />
          </div>

          {/* Movement chart + low stock */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
            <div className="card card-pad">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Stock Movement (units)</div>
              <BarChart data={STOCK_MOVEMENT} height={160} />
            </div>

            <div className="card card-pad">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: "var(--warn)" }}>
                ⚠ Low Stock ({LOW_STOCK.length})
              </div>
              {LOW_STOCK.length === 0 ? (
                <div style={{ fontSize: 12, color: "var(--fg-muted)" }}>All items above reorder level</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {LOW_STOCK.map(item => (
                    <div key={item.sku} style={{ padding: "8px 10px", background: "color-mix(in oklch, var(--warn) 10%, transparent)", borderRadius: "var(--r-sm)", border: "1px solid color-mix(in oklch, var(--warn) 20%, transparent)" }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 2 }}>
                        {item.qty.toLocaleString()} {item.unit} · reorder at {item.reorder.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Stock table */}
          <div className="card">
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Stock Inventory</div>
              <div style={{ position: "relative", width: 200 }}>
                <input
                  className="input"
                  style={{ height: 30, fontSize: 12, paddingLeft: 28 }}
                  placeholder="Search SKU or name…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  aria-label="Search inventory"
                />
                <span style={{ position: "absolute", left: 8, top: 8, color: "var(--fg-subtle)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
                </span>
              </div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Qty</th>
                  <th>Location</th>
                  <th>Utilisation</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(i => (
                  <tr key={i.sku}>
                    <td style={{ fontFamily: "var(--f-mono)", fontSize: 11, color: "var(--fg-muted)" }}>{i.sku}</td>
                    <td style={{ fontWeight: 500 }}>{i.name}</td>
                    <td>{i.qty.toLocaleString()} {i.unit}</td>
                    <td style={{ fontSize: 12, color: "var(--fg-muted)" }}>{i.location}</td>
                    <td style={{ width: 120 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Progress
                          value={i.util}
                          color={i.util >= 80 ? "var(--err)" : i.util >= 60 ? "var(--ok)" : "var(--warn)"}
                          height={6}
                        />
                        <span style={{ fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{i.util}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`chip chip-dot ${i.qty <= i.reorder ? "chip-err" : i.qty <= i.reorder * 1.5 ? "chip-warn" : "chip-ok"}`}>
                        {i.qty <= i.reorder ? "Reorder" : i.qty <= i.reorder * 1.5 ? "Low" : "OK"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
