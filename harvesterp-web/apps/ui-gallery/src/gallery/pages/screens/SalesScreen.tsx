"use client";

import * as React from "react";
import { Sidebar } from "@/components/shells/sidebar";
import { Topbar, type Currency } from "@/components/shells/topbar";
import { KpiCard } from "@/components/composed/kpi-card";
import { AreaChart } from "@/components/design-system/area-chart";
import { DSAvatar } from "@/components/design-system/ds-avatar";

// ── Stub data ─────────────────────────────────────────────────────────────────

const ORDERS_TREND_RAW = [48, 52, 58, 54, 66, 74, 70, 82, 88, 84, 94, 98];
const ORDERS_TREND = [ORDERS_TREND_RAW];
const ORDERS_LABELS = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];

const ORDERS = [
  { id: "ORD-2025-0001", client: "Zara India",      product: "Woven Cotton 60\"", qty: "4,200 m",  value: "₹4,28,500", status: "Dispatched",  statusChip: "chip chip-ok chip-dot",   created: "03 Jan 2025" },
  { id: "ORD-2025-0002", client: "H&M South Asia",  product: "Jersey Knit 180g",  qty: "2,800 m",  value: "₹3,12,000", status: "Processing",  statusChip: "chip chip-info chip-dot", created: "02 Jan 2025" },
  { id: "ORD-2025-0003", client: "Marks & Spencer", product: "Denim 14oz Indigo", qty: "6,100 m",  value: "₹7,85,200", status: "Dispatched",  statusChip: "chip chip-ok chip-dot",   created: "01 Jan 2025" },
  { id: "ORD-2025-0004", client: "Westside Retail", product: "Linen Blend 55/45", qty: "1,600 m",  value: "₹1,94,800", status: "Overdue",     statusChip: "chip chip-err chip-dot",  created: "30 Dec 2024" },
  { id: "ORD-2025-0005", client: "FabIndia Ltd.",   product: "Premium Cotton 40s", qty: "2,000 m", value: "₹2,60,000", status: "Confirmed",   statusChip: "chip chip-warn chip-dot", created: "29 Dec 2024" },
  { id: "ORD-2025-0006", client: "Myntra B2B",      product: "Polyester Blend",   qty: "5,500 m",  value: "₹5,12,500", status: "Draft",       statusChip: "chip",                    created: "28 Dec 2024" },
];

/**
 * Sales / Orders screen — order list with status, search, and KPIs.
 */
export function SalesScreen() {
  const [active, setActive] = React.useState("orders");
  const [currency, setCurrency] = React.useState<Currency>("INR");
  const [theme, setTheme] = React.useState<"light" | "dark">("light");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("All");

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("theme-dark", next === "dark");
  };

  const statuses = ["All", "Draft", "Confirmed", "Processing", "Dispatched", "Overdue"];

  const filtered = ORDERS.filter(o => {
    const matchSearch =
      o.id.includes(search) ||
      o.client.toLowerCase().includes(search.toLowerCase()) ||
      o.product.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>
      <Sidebar active={active} onNavigate={setActive} user={{ name: "Meena T.", roleLabel: "Sales Manager" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Topbar
          title="Orders"
          breadcrumbs={[{ label: "Operations" }, { label: "Orders" }]}
          currency={currency}
          onCurrencyChange={setCurrency}
          theme={theme}
          onToggleTheme={toggleTheme}
          notificationCount={1}
          right={
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary btn-sm">Export</button>
              <button className="btn btn-primary btn-sm">+ New Order</button>
            </div>
          }
        />

        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            <KpiCard label="Orders This Month" value="312"    delta="+18%"  deltaDirection="up" spark={ORDERS_TREND_RAW.slice(-8)} icon="invoice" />
            <KpiCard label="Order Value"        value="₹3.8 Cr" delta="+22%" deltaDirection="up" icon="finance" />
            <KpiCard label="Pending Dispatch"   value="28"    delta="4 urgent" tone="warn" icon="truck" />
            <KpiCard label="Overdue Orders"     value="6"     delta="+1" deltaDirection="down" tone="err" icon="warning" />
          </div>

          {/* Trend chart */}
          <div className="card card-pad">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Orders per Month</div>
            <AreaChart series={ORDERS_TREND} labels={ORDERS_LABELS} height={140} />
          </div>

          {/* Filters + table */}
          <div className="card">
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              {/* Search */}
              <div style={{ position: "relative", flex: "1 1 200px" }}>
                <input
                  className="input"
                  style={{ height: 30, fontSize: 12, paddingLeft: 28 }}
                  placeholder="Search order, client, product…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  aria-label="Search orders"
                />
                <span style={{ position: "absolute", left: 8, top: 8, color: "var(--fg-subtle)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
                </span>
              </div>

              {/* Status filter chips */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {statuses.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`chip${statusFilter === s ? " chip-accent" : ""}`}
                    style={{ cursor: "pointer", border: "none", background: statusFilter === s ? undefined : "transparent" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <table className="tbl">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Client</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: "var(--f-mono)", fontSize: 11 }}>{o.id}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <DSAvatar name={o.client} size="sm" variant="hash" />
                        <span style={{ fontWeight: 500, fontSize: 12 }}>{o.client}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--fg-muted)" }}>{o.product}</td>
                    <td style={{ fontFamily: "var(--f-mono)", fontSize: 12 }}>{o.qty}</td>
                    <td style={{ fontWeight: 600 }}>{o.value}</td>
                    <td><span className={o.statusChip}>{o.status}</span></td>
                    <td style={{ fontSize: 11, color: "var(--fg-muted)" }}>{o.created}</td>
                    <td><button className="btn btn-ghost btn-sm">View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div style={{ padding: 32, textAlign: "center", color: "var(--fg-muted)", fontSize: 13 }}>
                No orders match your filters.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
