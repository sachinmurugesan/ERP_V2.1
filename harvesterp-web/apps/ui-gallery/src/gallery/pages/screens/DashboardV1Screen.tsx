"use client";

import * as React from "react";
import { Sidebar } from "@/components/shells/sidebar";
import { Topbar, type Currency } from "@/components/shells/topbar";
import { KpiCard } from "@/components/composed/kpi-card";
import { AreaChart } from "@/components/design-system/area-chart";
import { Donut } from "@/components/design-system/donut";
import { DSAvatar } from "@/components/design-system/ds-avatar";

// ── Stub data ─────────────────────────────────────────────────────────────────

const REVENUE_SERIES = [[38, 44, 41, 52, 58, 55, 63, 70, 67, 74, 78, 84]];
const REVENUE_LABELS = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];

const DONUT_LABELS = ["Collected", "Pending", "Overdue"];
const DONUT_DATA = [
  { value: 68, color: "var(--ok)"   },
  { value: 22, color: "var(--warn)"  },
  { value: 10, color: "var(--err)"   },
];

const RECENT_ORDERS = [
  { id: "ORD-2024-0841", client: "Zara India",       amount: "₹4,28,500", status: "Dispatched", statusClass: "chip chip-ok" },
  { id: "ORD-2024-0840", client: "H&M South Asia",   amount: "₹3,12,000", status: "Pending",    statusClass: "chip chip-warn" },
  { id: "ORD-2024-0839", client: "Marks & Spencer",  amount: "₹7,85,200", status: "Dispatched", statusClass: "chip chip-ok" },
  { id: "ORD-2024-0838", client: "Westside Retail",  amount: "₹1,94,800", status: "Overdue",    statusClass: "chip chip-err" },
  { id: "ORD-2024-0837", client: "FabIndia Ltd.",    amount: "₹2,60,000", status: "Processing", statusClass: "chip chip-info" },
];

/**
 * Dashboard V1 — Finance + KPI overview screen port.
 * Full-bleed layout: Sidebar + Topbar + content area.
 */
export function DashboardV1Screen() {
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
      <Sidebar active={active} onNavigate={setActive} user={{ name: "Sachin M.", roleLabel: "Super Admin" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Topbar
          title="Dashboard"
          subtitle="Financial overview · FY 2024-25"
          currency={currency}
          onCurrencyChange={setCurrency}
          theme={theme}
          onToggleTheme={toggleTheme}
          notificationCount={3}
        />

        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            <KpiCard label="Total Revenue"     value="₹4.2 Cr"  delta="+12.4%" deltaDirection="up"   subtext="vs last month" spark={[38,44,41,52,58,55,63,70]} icon="finance" />
            <KpiCard label="Orders Dispatched" value="1,284"    delta="+8.3%"  deltaDirection="up"   subtext="this month"    spark={[120,135,128,142,155,148,162,170]} icon="box" />
            <KpiCard label="Overdue Receivables" value="₹18.4 L" delta="+23%" deltaDirection="down"  subtext="action needed" spark={[8,10,9,12,14,13,16,18]} icon="warning" />
            <KpiCard label="Active Clients"    value="248"      delta="+4"     deltaDirection="up"   subtext="this quarter"  icon="crm" />
          </div>

          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
            <div className="card card-pad">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Monthly Revenue (₹ Lakhs)</div>
              <AreaChart series={REVENUE_SERIES} labels={REVENUE_LABELS} height={180} />
            </div>
            <div className="card card-pad">
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Receivables Breakdown</div>
              <Donut data={DONUT_DATA} size={140} />
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {DONUT_DATA.map((d, i) => (
                  <div key={DONUT_LABELS[i]} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: "var(--fg-muted)" }}>{DONUT_LABELS[i]}</span>
                    <span style={{ fontWeight: 600 }}>{d.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent orders */}
          <div className="card">
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Recent Orders</div>
              <button className="btn btn-ghost btn-sm">View All</button>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {RECENT_ORDERS.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: "var(--f-mono)", fontSize: 12 }}>{o.id}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <DSAvatar name={o.client} size="sm" variant="hash" />
                        {o.client}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{o.amount}</td>
                    <td><span className={o.statusClass}>{o.status}</span></td>
                    <td><button className="btn btn-ghost btn-sm">View</button></td>
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
