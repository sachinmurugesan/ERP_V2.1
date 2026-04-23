import * as React from "react";
import { KpiCard } from "@/components/composed/kpi-card";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type { IconName } from "@/components/design-system/icon";
import type { DashboardSummary } from "./types";
import { KpiSkeleton } from "./skeletons";
import { ErrorCard } from "./error-card";
import { formatCount } from "./formatters";

/**
 * Server component that fetches the summary counters and renders five
 * KpiCards. Runs per request; refetches happen on client navigation to
 * /dashboard or explicit refresh — active shipments / recent activity get
 * short-interval polling separately (decision #5).
 *
 * Falls back to a skeleton grid when no session is present (middleware
 * should redirect before this renders in practice), and an inline error
 * card when the backend is unreachable.
 */

type KpiKey = keyof DashboardSummary;

interface KpiDefinition {
  key: KpiKey;
  label: string;
  subtext: string;
  icon: IconName;
  tone: "neutral" | "ok" | "warn" | "err" | "info";
}

const KPI_DEFINITIONS: ReadonlyArray<KpiDefinition> = [
  {
    key: "total_orders",
    label: "TOTAL ORDERS",
    subtext: "All active orders",
    icon: "procurement",
    tone: "info",
  },
  {
    key: "in_production",
    label: "IN PRODUCTION",
    subtext: "Factory stages",
    icon: "settings",
    tone: "warn",
  },
  {
    key: "in_transit",
    label: "IN TRANSIT",
    subtext: "Loaded / Sailing / Arrived",
    icon: "truck",
    tone: "info",
  },
  {
    key: "aftersales_open",
    label: "OPEN ISSUES",
    subtext: "Needs attention",
    icon: "warning",
    tone: "err",
  },
  {
    key: "client_inquiries",
    label: "CLIENT INQUIRIES",
    subtext: "Pending approval",
    icon: "invoice",
    tone: "ok",
  },
];

function gridStyle(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 16,
  };
}

async function loadSummary(): Promise<DashboardSummary | null> {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    const client = await getServerClient();
    return await client.getJson<DashboardSummary>("/api/dashboard/summary/");
  } catch {
    return null;
  }
}

export async function KpiSummary(): Promise<React.ReactElement> {
  const summary = await loadSummary();

  if (summary === null) {
    return (
      <section aria-label="Key metrics">
        <div style={gridStyle()}>
          {KPI_DEFINITIONS.map((d) => (
            <KpiSkeleton key={d.key} />
          ))}
        </div>
        <ErrorCard message="Unable to load dashboard summary right now. The feed below may still be up to date." />
      </section>
    );
  }

  return (
    <section aria-label="Key metrics" style={gridStyle()}>
      {KPI_DEFINITIONS.map((def) => (
        <KpiCard
          key={def.key}
          label={def.label}
          value={formatCount(summary[def.key])}
          subtext={def.subtext}
          icon={def.icon}
          tone={def.tone}
        />
      ))}
    </section>
  );
}

export function KpiSummarySkeleton(): React.ReactElement {
  return (
    <section aria-label="Key metrics (loading)" style={gridStyle()}>
      {KPI_DEFINITIONS.map((d) => (
        <KpiSkeleton key={d.key} />
      ))}
    </section>
  );
}
