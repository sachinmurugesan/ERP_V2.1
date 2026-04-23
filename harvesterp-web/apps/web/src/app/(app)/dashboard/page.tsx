import * as React from "react";
import { Suspense } from "react";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import { resolveDisplayName } from "@/lib/display-name";
import { WelcomeCard } from "./_components/welcome-card";
import {
  KpiSummary,
  KpiSummarySkeleton,
} from "./_components/kpi-summary";
import { ClientInquiriesSection } from "./_components/client-inquiries";
import { ActiveShipmentsSection } from "./_components/active-shipments";
import { RecentActivitySection } from "./_components/recent-activity";

export const dynamic = "force-dynamic";

/**
 * Internal dashboard landing page.
 *
 * Content hierarchy (top → bottom):
 *   1. WelcomeCard           — client, first-login only (localStorage gated)
 *   2. ClientInquiriesSection — RSC, hidden when empty
 *   3. KpiSummary             — RSC, 5 counters
 *   4. ActiveShipments + RecentActivity — client, 30 s TanStack Query polling
 *
 * Data strategy:
 *   - Server-side fetches (summary, client-inquiries) run per request via
 *     getServerClient() using the httpOnly session cookie.
 *   - Client-side pollers (active-shipments, recent-activity) hit Next.js
 *     route handlers at /api/dashboard/* which proxy FastAPI, so the httpOnly
 *     cookie stays server-side.
 *
 * This replaces the Task 7 scaffold dashboard. See
 * docs/migration/logs/2026-04-23-dashboard.md for migration notes.
 */
async function resolveUserName(): Promise<string> {
  try {
    const token = await getSessionToken();
    if (!token) return "there";
    const client = await getServerClient();
    const result = await client.GET("/api/auth/me");
    if (!result.data) return "there";
    return resolveDisplayName(
      result.data as { full_name?: string | null; email?: string | null },
    );
  } catch {
    return "there";
  }
}

export default async function DashboardPage(): Promise<React.ReactElement> {
  const userName = await resolveUserName();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <WelcomeCard userName={userName} />

      <Suspense fallback={null}>
        <ClientInquiriesSection />
      </Suspense>

      <Suspense fallback={<KpiSummarySkeleton />}>
        <KpiSummary />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ActiveShipmentsSection />
        <RecentActivitySection />
      </div>
    </div>
  );
}
