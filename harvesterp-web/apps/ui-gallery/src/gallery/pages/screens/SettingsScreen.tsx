"use client";

import * as React from "react";
import { Sidebar } from "@/components/shells/sidebar";
import { Topbar, type Currency } from "@/components/shells/topbar";
import { DSAvatar } from "@/components/design-system/ds-avatar";

type SettingsTab = "profile" | "users" | "system" | "notifications";

const USERS = [
  { name: "Sachin M.",   email: "sachin@harvesterp.com",   role: "Super Admin",      status: "active",   last: "Just now" },
  { name: "Meena T.",    email: "meena@harvesterp.com",    role: "Sales Manager",    status: "active",   last: "2h ago" },
  { name: "Kavitha R.",  email: "kavitha@harvesterp.com",  role: "Finance",          status: "active",   last: "1d ago" },
  { name: "Deepa V.",    email: "deepa@harvesterp.com",    role: "Warehouse Manager",status: "active",   last: "3h ago" },
  { name: "Arun P.",     email: "arun@harvesterp.com",     role: "Operations",       status: "active",   last: "5h ago" },
  { name: "Vikram S.",   email: "vikram@harvesterp.com",   role: "Viewer",           status: "inactive", last: "14d ago" },
];

/**
 * Settings Screen — profile, user management, system preferences.
 */
export function SettingsScreen() {
  const [active, setActive] = React.useState("settings");
  const [currency, setCurrency] = React.useState<Currency>("INR");
  const [theme, setTheme] = React.useState<"light" | "dark">("light");
  const [tab, setTab] = React.useState<SettingsTab>("profile");

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("theme-dark", next === "dark");
  };

  const TABS: { id: SettingsTab; label: string }[] = [
    { id: "profile",       label: "Profile" },
    { id: "users",         label: "Users" },
    { id: "system",        label: "System" },
    { id: "notifications", label: "Notifications" },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)", overflow: "hidden" }}>
      <Sidebar active={active} onNavigate={setActive} user={{ name: "Sachin M.", roleLabel: "Super Admin" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Topbar
          title="Settings"
          breadcrumbs={[{ label: "System" }, { label: "Settings" }]}
          currency={currency}
          onCurrencyChange={setCurrency}
          theme={theme}
          onToggleTheme={toggleTheme}
          notificationCount={0}
        />

        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {/* Tab bar */}
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: tab === t.id ? 600 : 400,
                  color: tab === t.id ? "var(--brand-800)" : "var(--fg-muted)",
                  border: "none",
                  borderBottom: tab === t.id ? "2px solid var(--brand-600)" : "2px solid transparent",
                  background: "transparent",
                  cursor: "pointer",
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Profile tab */}
          {tab === "profile" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 560 }}>
              <div className="card card-pad" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <DSAvatar name="Sachin M." size="lg" variant="gradient" />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>Sachin M.</div>
                  <div style={{ fontSize: 13, color: "var(--fg-muted)" }}>Super Admin · sachin@harvesterp.com</div>
                </div>
                <button className="btn btn-secondary btn-sm" style={{ marginLeft: "auto" }}>Edit</button>
              </div>

              <div className="card card-pad">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Account Details</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { label: "Full Name",     value: "Sachin M." },
                    { label: "Email",         value: "sachin@harvesterp.com" },
                    { label: "Phone",         value: "+91 98765 43210" },
                    { label: "Role",          value: "Super Admin" },
                    { label: "Organisation",  value: "HarvestERP Workspace" },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", gap: 16 }}>
                      <span className="label" style={{ width: 140, flexShrink: 0, paddingTop: 2 }}>{label}</span>
                      <span style={{ fontSize: 13 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card card-pad">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Change Password</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <div className="label" style={{ marginBottom: 4 }}>Current Password</div>
                    <input className="input" type="password" placeholder="••••••••" />
                  </div>
                  <div>
                    <div className="label" style={{ marginBottom: 4 }}>New Password</div>
                    <input className="input" type="password" placeholder="••••••••" />
                  </div>
                  <div>
                    <div className="label" style={{ marginBottom: 4 }}>Confirm Password</div>
                    <input className="input" type="password" placeholder="••••••••" />
                  </div>
                  <button className="btn btn-primary" style={{ marginTop: 4, alignSelf: "flex-start" }}>
                    Update Password
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Users tab */}
          {tab === "users" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-primary btn-sm">+ Invite User</button>
              </div>
              <div className="card">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Last Active</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {USERS.map(u => (
                      <tr key={u.email}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <DSAvatar name={u.name} size="sm" variant="hash" />
                            <div>
                              <div style={{ fontWeight: 500, fontSize: 13 }}>{u.name}</div>
                              <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 12 }}>{u.role}</td>
                        <td>
                          <span className={`chip chip-dot ${u.status === "active" ? "chip-ok" : "chip-err"}`}>
                            {u.status}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: "var(--fg-muted)" }}>{u.last}</td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className="btn btn-ghost btn-sm">Edit</button>
                            {u.status === "active" && (
                              <button className="btn btn-danger btn-sm">Disable</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* System tab */}
          {tab === "system" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
              <div className="card card-pad">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Workspace</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <div className="label" style={{ marginBottom: 4 }}>Organisation Name</div>
                    <input className="input" defaultValue="HarvestERP Workspace" />
                  </div>
                  <div>
                    <div className="label" style={{ marginBottom: 4 }}>Default Currency</div>
                    <select className="input" defaultValue="INR">
                      <option>INR — Indian Rupee</option>
                      <option>USD — US Dollar</option>
                      <option>CNY — Chinese Yuan</option>
                    </select>
                  </div>
                  <div>
                    <div className="label" style={{ marginBottom: 4 }}>Fiscal Year Start</div>
                    <select className="input" defaultValue="April">
                      <option>April</option>
                      <option>January</option>
                    </select>
                  </div>
                  <button className="btn btn-primary" style={{ alignSelf: "flex-start" }}>Save Changes</button>
                </div>
              </div>

              <div className="card card-pad">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "var(--err)" }}>Danger Zone</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button className="btn btn-danger btn-sm">Export All Data</button>
                  <button className="btn btn-danger btn-sm">Purge Audit Logs</button>
                </div>
              </div>
            </div>
          )}

          {/* Notifications tab */}
          {tab === "notifications" && (
            <div style={{ maxWidth: 560 }}>
              <div className="card card-pad">
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Notification Preferences</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {[
                    { label: "Order status changes",    sub: "Dispatched, delayed, cancelled" },
                    { label: "Payment received",        sub: "Receivable collections" },
                    { label: "Low stock alerts",        sub: "Inventory below reorder level" },
                    { label: "Overdue receivables",     sub: "Payment due dates exceeded" },
                    { label: "New client registration", sub: "Client portal sign-ups" },
                    { label: "System maintenance",      sub: "Downtime and update notices" },
                  ].map(({ label, sub }, i) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                        <div style={{ fontSize: 11, color: "var(--fg-muted)" }}>{sub}</div>
                      </div>
                      <label style={{ position: "relative", display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                        <input type="checkbox" defaultChecked={i < 4} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
                        <span style={{
                          display: "inline-block", width: 36, height: 20, borderRadius: 999,
                          background: i < 4 ? "var(--brand-500)" : "var(--border)",
                          transition: "background .15s",
                        }} />
                      </label>
                    </div>
                  ))}
                </div>
                <button className="btn btn-primary" style={{ marginTop: 20, alignSelf: "flex-start" }}>Save Preferences</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
