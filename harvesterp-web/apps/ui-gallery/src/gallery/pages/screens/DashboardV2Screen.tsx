"use client";

import * as React from "react";
import { Sidebar } from "@/components/shells/sidebar";
import { Topbar, type Currency } from "@/components/shells/topbar";
import { KpiCard } from "@/components/composed/kpi-card";
import { BarChart } from "@/components/design-system/bar-chart";
import { Progress } from "@/components/design-system/progress";
import { SparkLine } from "@/components/design-system/spark-line";

// ── Stub data ─────────────────────────────────────────────────────────────────

const DISPATCH_RAW = [142, 165, 158, 172, 180, 168, 191];
const DISPATCH_WEEKLY = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((label, i) => ({ label, values: [DISPATCH_RAW[i]] }));

const FACTORY_UTIL = [
  { name: "Rajan Textiles",     util: 84, orders: 32 },
  { name: "Sunrise Garments",   util: 72, orders: 24 },
  { name: "Denim Craft Ltd.",   util: 91, orders: 41 },
  { name: "Fabric Palace",      util: 58, orders: 18 },
  { name: "Weave Masters",      util: 45, orders: 14 },
];

const TRANSPORT_STATUS = [
  { route: "Mumbai → Delhi",    units: 42, eta: "2h",  status: "In Transit",  chip: "chip chip-info chip-dot" },
  { route: "Surat → Bangalore", units: 28, eta: "5h",  status: "In Transit",  chip: "chip chip-info chip-dot" },
  { route: "Ahmedabad → Pune",  units: 15, eta: "1h",  status: "Near Dest.",  chip: "chip chip-ok chip-dot" },
  { route: "Delhi → Kolkata",   units: 38, eta: "12h", status: "Delayed",     chip: "chip chip-warn chip-dot" },
];

/**
 * Dashboard V2 — Operations overview (dispatch, factory utilisation, transport).
 */
export function DashboardV2Screen() {
  const [active, setActive] = React.useState("dashboard");
  const [currency, setCurrency] = React.useState<Currency>("INR");
  const [theme, setTheme] = React.useState<"light" | "dark">("light");

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("theme-dark", next === "dark");
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>
      <Sidebar active={active} onNavigate={setActive} user={{ name: "Arun P.", roleLabel: "Operations Manager" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Topbar
          title="Dashboard"
          subtitle="Operations overview"
          currency={currency}
          onCurrencyChange={setCurrency}
          theme={theme}
          onToggleTheme={toggleTheme}
          notificationCount={7}
        />

        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            <KpiCard label="Units Dispatched"  value="1,176"  delta="+6.2%"  deltaDirection="up"   subtext="this week" spark={DISPATCH_RAW} icon="truck" />
            <KpiCard label="Active Factories"  value="12"     delta="2 new"  deltaDirection="up"   icon="box" />
            <KpiCard label="Pending Shipments" value="84"     delta="+12"    deltaDirection="down"  icon="warning" />
            <KpiCard label="On-time Rate"       value="94.1%"  delta="+1.8%"  deltaDirection="up"   icon="check" tone="ok" />
          </div>

          {/* Dispatch chart + transport */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
            <div className="card card-pad">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Weekly Dispatch Volume</div>
              <BarChart data={DISPATCH_WEEKLY} height={160} />
            </div>

            <div className="card card-pad">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Live Transport</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {TRANSPORT_STATUS.map(t => (
                  <div key={t.route} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 500 }}>{t.route}</span>
                      <span className={t.chip} style={{ fontSize: 10 }}>{t.status}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                      {t.units} units · ETA {t.eta}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Factory utilisation */}
          <div className="card card-pad">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Factory Utilisation</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {FACTORY_UTIL.map(f => (
                <div key={f.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                    <span style={{ fontWeight: 500 }}>{f.name}</span>
                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--fg-muted)" }}>
                      <span>{f.orders} active orders</span>
                      <span style={{ fontWeight: 600, color: f.util >= 80 ? "var(--ok)" : f.util >= 60 ? "var(--warn)" : "var(--err)" }}>
                        {f.util}%
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={f.util}
                    color={f.util >= 80 ? "var(--ok)" : f.util >= 60 ? "var(--warn)" : "var(--err)"}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Sparkline row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { label: "Dispatch trend", color: "var(--ok)",   data: [38,44,41,52,58,55,63,70] },
              { label: "Returns trend",  color: "var(--warn)",  data: [8,10,9,12,14,13,16,18] },
              { label: "Delays trend",   color: "var(--err)",   data: [4,3,5,4,6,5,7,6] },
            ].map(({ label, color, data }) => (
              <div key={label} className="card card-pad-sm" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="kpi-label">{label}</span>
                <SparkLine data={data} color={color} width={160} height={40} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
