"use client";

import * as React from "react";
import { Sidebar } from "@/components/shells/sidebar";
import { Topbar, type Currency } from "@/components/shells/topbar";
import { KpiCard } from "@/components/composed/kpi-card";
import { AreaChart } from "@/components/design-system/area-chart";
import { DSAvatar } from "@/components/design-system/ds-avatar";
import { Progress } from "@/components/design-system/progress";

// ── Stub data ─────────────────────────────────────────────────────────────────

const CASH_FLOW = [[60, 55, 72, 80, 68, 90, 85, 95, 88, 102, 98, 112]];
const CASH_LABELS = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];

const RECEIVABLES = [
  { client: "Zara India",       due: "2025-01-15", amount: "₹4,28,500", overdue: false, daysLeft: 8  },
  { client: "H&M South Asia",   due: "2025-01-10", amount: "₹3,12,000", overdue: true,  daysLeft: -3 },
  { client: "Marks & Spencer",  due: "2025-01-20", amount: "₹7,85,200", overdue: false, daysLeft: 13 },
  { client: "Westside Retail",  due: "2024-12-28", amount: "₹1,94,800", overdue: true,  daysLeft: -15},
  { client: "FabIndia Ltd.",    due: "2025-01-25", amount: "₹2,60,000", overdue: false, daysLeft: 18 },
];

const LEDGER_ENTRIES = [
  { date: "03 Jan", ref: "INV-2025-0218", description: "Zara India — Shipment #841",       debit: "",          credit: "₹4,28,500", balance: "₹28,42,300" },
  { date: "02 Jan", ref: "PMT-2025-0109", description: "H&M South Asia — Part payment",    debit: "₹1,50,000", credit: "",          balance: "₹24,13,800" },
  { date: "01 Jan", ref: "INV-2025-0217", description: "Marks & Spencer — Shipment #839",  debit: "",          credit: "₹7,85,200", balance: "₹25,63,800" },
  { date: "31 Dec", ref: "PMT-2025-0108", description: "Westside Retail — Full settlement",debit: "₹1,94,800", credit: "",          balance: "₹17,78,600" },
];

/**
 * Finance Screen — Receivables, cash flow, client ledger.
 */
export function FinanceScreen() {
  const [active, setActive] = React.useState("receivables");
  const [currency, setCurrency] = React.useState<Currency>("INR");
  const [theme, setTheme] = React.useState<"light" | "dark">("light");
  const [activeTab, setActiveTab] = React.useState<"receivables" | "ledger">("receivables");

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("theme-dark", next === "dark");
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>
      <Sidebar active={active} onNavigate={setActive} user={{ name: "Kavitha R.", roleLabel: "Finance" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Topbar
          title="Finance"
          breadcrumbs={[{ label: "Finance" }, { label: "Receivables" }]}
          currency={currency}
          onCurrencyChange={setCurrency}
          theme={theme}
          onToggleTheme={toggleTheme}
          notificationCount={5}
          right={
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary btn-sm">Export</button>
              <button className="btn btn-primary btn-sm">Record Payment</button>
            </div>
          }
        />

        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            <KpiCard label="Total Receivables"  value="₹1.8 Cr" delta="+8.4%"  deltaDirection="down" spark={[80, 85, 82, 90, 95, 92, 98, 102]} icon="credit" />
            <KpiCard label="Collected This Month" value="₹84.2 L" delta="+14%" deltaDirection="up" subtext="target 80 L" icon="check" tone="ok" />
            <KpiCard label="Overdue Amount"     value="₹18.4 L" delta="2 clients" deltaDirection="down" icon="warning" tone="err" />
            <KpiCard label="Avg. Collection Days" value="24 days" delta="+2" deltaDirection="down" subtext="vs target 21" icon="clock" tone="warn" />
          </div>

          {/* Cash flow chart */}
          <div className="card card-pad">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Cash Flow Trend (₹ Lakhs)</div>
            <AreaChart series={CASH_FLOW} labels={CASH_LABELS} height={160} />
          </div>

          {/* Tabs */}
          <div>
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 16 }}>
              {(["receivables", "ledger"] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: "8px 16px",
                    fontSize: 13,
                    fontWeight: activeTab === tab ? 600 : 400,
                    color: activeTab === tab ? "var(--brand-800)" : "var(--fg-muted)",
                    border: "none",
                    borderBottom: activeTab === tab ? "2px solid var(--brand-600)" : "2px solid transparent",
                    background: "transparent",
                    cursor: "pointer",
                    textTransform: "capitalize",
                    marginBottom: -1,
                  }}
                >
                  {tab === "receivables" ? "Receivables" : "Client Ledger"}
                </button>
              ))}
            </div>

            {activeTab === "receivables" && (
              <div className="card">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th>Due Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RECEIVABLES.map(r => (
                      <tr key={r.client}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <DSAvatar name={r.client} size="sm" variant="hash" />
                            {r.client}
                          </div>
                        </td>
                        <td style={{ fontFamily: "var(--f-mono)", fontSize: 12 }}>{r.due}</td>
                        <td style={{ fontWeight: 600 }}>{r.amount}</td>
                        <td>
                          <span className={`chip ${r.overdue ? "chip-err" : "chip-ok"} chip-dot`}>
                            {r.overdue ? "Overdue" : "Upcoming"}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: r.overdue ? "var(--err)" : "var(--fg-muted)" }}>
                          {r.overdue ? `${Math.abs(r.daysLeft)}d ago` : `in ${r.daysLeft}d`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "ledger" && (
              <div className="card">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Reference</th>
                      <th>Description</th>
                      <th style={{ textAlign: "right" }}>Debit</th>
                      <th style={{ textAlign: "right" }}>Credit</th>
                      <th style={{ textAlign: "right" }}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LEDGER_ENTRIES.map(e => (
                      <tr key={e.ref}>
                        <td style={{ fontFamily: "var(--f-mono)", fontSize: 12 }}>{e.date}</td>
                        <td style={{ fontFamily: "var(--f-mono)", fontSize: 12, color: "var(--fg-muted)" }}>{e.ref}</td>
                        <td>{e.description}</td>
                        <td style={{ textAlign: "right", color: "var(--err)", fontWeight: e.debit ? 600 : 400 }}>{e.debit || "—"}</td>
                        <td style={{ textAlign: "right", color: "var(--ok)", fontWeight: e.credit ? 600 : 400 }}>{e.credit || "—"}</td>
                        <td style={{ textAlign: "right", fontWeight: 600, fontFamily: "var(--f-mono)", fontSize: 12 }}>{e.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Collection progress */}
          <div className="card card-pad">
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Monthly Collection Target</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "var(--fg-muted)" }}>Collected: ₹84.2 L / ₹1.0 Cr target</span>
                <span style={{ fontWeight: 600, color: "var(--ok)" }}>84.2%</span>
              </div>
              <Progress value={84.2} color="var(--ok)" height={8} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
