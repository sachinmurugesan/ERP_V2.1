"use client";

import * as React from "react";
import { Sidebar } from "@/components/shells/sidebar";
import { Topbar, type Currency } from "@/components/shells/topbar";
import { KpiCard } from "@/components/composed/kpi-card";
import { AreaChart } from "@/components/design-system/area-chart";
import { Donut } from "@/components/design-system/donut";
import { DSAvatar } from "@/components/design-system/ds-avatar";

// ── Stub data ─────────────────────────────────────────────────────────────────

const SALES_MONTHLY_RAW = [52, 58, 54, 66, 74, 70, 82, 88, 84, 94, 98, 108];
const SALES_MONTHLY = [SALES_MONTHLY_RAW];
const SALES_LABELS  = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];

const CATEGORY_LABELS = ["Woven Fabric", "Knit Fabric", "Denim", "Accessories"];
const CATEGORY_MIX = [
  { value: 38, color: "var(--c1)" },
  { value: 27, color: "var(--c2)" },
  { value: 19, color: "var(--c4)" },
  { value: 16, color: "var(--c3)" },
];

const TOP_CLIENTS = [
  { name: "Zara India",        revenue: "₹1.2 Cr",  orders: 42, spark: [30,34,32,38,40,36,44] },
  { name: "H&M South Asia",    revenue: "₹88.4 L",  orders: 31, spark: [24,28,26,30,32,28,34] },
  { name: "Marks & Spencer",   revenue: "₹76.2 L",  orders: 27, spark: [20,22,24,22,26,28,30] },
  { name: "Westside Retail",   revenue: "₹52.8 L",  orders: 19, spark: [16,18,16,20,18,22,24] },
];

import { SparkLine } from "@/components/design-system/spark-line";

/**
 * Dashboard V3 — Sales + client overview.
 */
export function DashboardV3Screen() {
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
      <Sidebar active={active} onNavigate={setActive} user={{ name: "Meena T.", roleLabel: "Sales Manager" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Topbar
          title="Dashboard"
          subtitle="Sales performance · FY 2024-25"
          currency={currency}
          onCurrencyChange={setCurrency}
          theme={theme}
          onToggleTheme={toggleTheme}
          notificationCount={2}
          right={
            <button className="btn btn-primary btn-sm">+ New Inquiry</button>
          }
        />

        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            <KpiCard label="Gross Sales"      value="₹8.6 Cr"  delta="+18.4%" deltaDirection="up" subtext="vs FY 23-24" spark={SALES_MONTHLY_RAW.slice(0,8)} icon="sales" />
            <KpiCard label="Active Clients"   value="248"      delta="+16"    deltaDirection="up" subtext="new this year" icon="crm" />
            <KpiCard label="Avg. Order Value" value="₹3.4 L"   delta="+4.2%"  deltaDirection="up" icon="invoice" />
            <KpiCard label="Conversion Rate"  value="34.2%"    delta="+2.1%"  deltaDirection="up" tone="ok" icon="check" />
          </div>

          {/* Chart + donut */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
            <div className="card card-pad">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Monthly Sales (₹ Lakhs)</div>
              <AreaChart series={SALES_MONTHLY} labels={SALES_LABELS} height={180} />
            </div>
            <div className="card card-pad">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Product Mix</div>
              <Donut data={CATEGORY_MIX} size={130} />
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                {CATEGORY_MIX.map((d, i) => (
                  <div key={CATEGORY_LABELS[i]} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: "var(--fg-muted)" }}>{CATEGORY_LABELS[i]}</span>
                    <span style={{ fontWeight: 600 }}>{d.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top clients */}
          <div className="card">
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Top Clients by Revenue</div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Revenue</th>
                  <th>Orders</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {TOP_CLIENTS.map(c => (
                  <tr key={c.name}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <DSAvatar name={c.name} size="sm" variant="hash" />
                        <span style={{ fontWeight: 500 }}>{c.name}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{c.revenue}</td>
                    <td style={{ color: "var(--fg-muted)" }}>{c.orders}</td>
                    <td><SparkLine data={c.spark} width={80} height={28} /></td>
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
