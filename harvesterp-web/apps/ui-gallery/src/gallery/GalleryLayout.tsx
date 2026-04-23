"use client";

import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";

const PRIMITIVES = [
  "button",
  "input",
  "select",
  "dialog",
  "dropdown-menu",
  "tabs",
  "badge",
  "card",
  "checkbox",
  "textarea",
  "tooltip",
  "skeleton",
  "alert",
  "table",
  "toast",
] as const;

const COMPOSED = [
  { path: "composed",       label: "✦ All Composed" },
  { path: "confirm-dialog", label: "ConfirmDialog (D-003)" },
  { path: "client-avatar", label: "ClientAvatar (P-020)" },
  { path: "ledger-page", label: "LedgerPage (P-017)" },
  {
    path: "highlight-scroll-target",
    label: "HighlightScrollTarget (P-022)",
  },
  {
    path: "carry-forward-stepper",
    label: "CarryForwardStepper (P-005)",
  },
  { path: "role-gate", label: "RoleGate (D-004/D-009/D-010)" },
  { path: "page-shell", label: "PageShell" },
  { path: "kpi-card", label: "KpiCard" },
] as const;

const DESIGN_SYSTEM = [
  { path: "design-system", label: "Tokens & Primitives" },
  { path: "sidebar", label: "Sidebar" },
  { path: "topbar", label: "Topbar" },
] as const;

const SCREENS = [
  { path: "screen/dashboard-v1", label: "Dashboard V1 — Finance" },
  { path: "screen/dashboard-v2", label: "Dashboard V2 — Ops" },
  { path: "screen/dashboard-v3", label: "Dashboard V3 — Sales" },
  { path: "screen/finance",      label: "Finance" },
  { path: "screen/inventory",    label: "Inventory" },
  { path: "screen/sales",        label: "Sales / Orders" },
  { path: "screen/settings",     label: "Settings" },
] as const;

function SidebarLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "block rounded-md px-3 py-1.5 text-sm transition-colors",
          isActive
            ? "bg-primary text-primary-foreground font-medium"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )
      }
    >
      {label}
    </NavLink>
  );
}

export function GalleryLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r bg-card px-3 py-6">
        <div className="mb-6 px-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            HarvestERP
          </p>
          <h1 className="mt-0.5 text-lg font-semibold text-foreground">
            UI Gallery
          </h1>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Layer 2 — Wave 0 Task 5
          </p>
        </div>

        <nav className="space-y-4">
          <section>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Primitives (shadcn)
            </p>
            <div className="space-y-0.5">
              {PRIMITIVES.map((p) => (
                <SidebarLink
                  key={p}
                  to={`/gallery/${p}`}
                  label={p
                    .split("-")
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join("")}
                />
              ))}
            </div>
          </section>

          <section>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Composed (audit-driven)
            </p>
            <div className="space-y-0.5">
              {COMPOSED.map((c) => (
                <SidebarLink
                  key={c.path}
                  to={`/gallery/${c.path}`}
                  label={c.label}
                />
              ))}
            </div>
          </section>

          <section>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Design System (Wave 0)
            </p>
            <div className="space-y-0.5">
              {DESIGN_SYSTEM.map((d) => (
                <SidebarLink
                  key={d.path}
                  to={`/gallery/${d.path}`}
                  label={d.label}
                />
              ))}
            </div>
          </section>

          <section>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Screen Ports
            </p>
            <div className="space-y-0.5">
              {SCREENS.map((s) => (
                <SidebarLink
                  key={s.path}
                  to={`/gallery/${s.path}`}
                  label={s.label}
                />
              ))}
            </div>
          </section>
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
