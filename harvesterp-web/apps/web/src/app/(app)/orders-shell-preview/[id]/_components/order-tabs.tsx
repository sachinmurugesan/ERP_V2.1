"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/primitives/tabs";
import type { OrderDetail, OrderStatus } from "./types";

/**
 * <OrderTabs> — sticky tab navigation for the order-detail shell.
 *
 * 14 tabs with stage-driven progressive visibility (mirrors
 * `OrderDetail.vue:312-334 availableTabs`):
 *
 *   Always:    Dashboard, Order Items, Queries, Files
 *   PostPI:    Payments
 *   Production: Production
 *   Packing:   Packing List
 *   Booking:   Booking
 *   Sailing:   Sailing, Shipping Docs
 *   Customs:   Customs/BOE
 *   AfterSales: After-Sales
 *   Completed: Final Draft
 *   Transparency+Cleared+Role: Landed Cost
 *
 * For Phase 1 (sandbox), NONE of the tab content is migrated yet — every
 * `<TabsContent>` shows a brief "Loading {Tab Name}…" skeleton then
 * `window.location.assign("/orders/{id}?tab={value}")` to fall back to Vue.
 *
 * Sticky: `sticky top-0 z-10 bg-white shadow-sm` so the bar stays visible
 * as the user scrolls through tab content.
 */

interface TabDef {
  value: string;
  label: string;
  visible: (status: OrderStatus, role?: string, clientType?: string) => boolean;
}

// Stage-set helpers (mirrors `OrderDetail.vue:269-307` computeds)
const POST_PI: ReadonlySet<string> = new Set([
  "PI_SENT",
  "ADVANCE_PENDING",
  "ADVANCE_RECEIVED",
  "FACTORY_ORDERED",
  "PRODUCTION_60",
  "PRODUCTION_80",
  "PRODUCTION_90",
  "PLAN_PACKING",
  "FINAL_PI",
  "PRODUCTION_100",
  "BOOKED",
  "LOADED",
  "SAILED",
  "ARRIVED",
  "CUSTOMS_FILED",
  "CLEARED",
  "DELIVERED",
  "AFTER_SALES",
  "COMPLETED",
  "COMPLETED_EDITING",
]);
const PRODUCTION_STAGES: ReadonlySet<string> = new Set([
  "FACTORY_ORDERED",
  "PRODUCTION_60",
  "PRODUCTION_80",
  "PRODUCTION_90",
  "PRODUCTION_100",
]);
const PACKING_PLUS: ReadonlySet<string> = new Set([
  "PLAN_PACKING",
  "FINAL_PI",
  "PRODUCTION_100",
  "BOOKED",
  "LOADED",
  "SAILED",
  "ARRIVED",
  "CUSTOMS_FILED",
  "CLEARED",
  "DELIVERED",
  "AFTER_SALES",
  "COMPLETED",
  "COMPLETED_EDITING",
]);
const BOOKING_PLUS: ReadonlySet<string> = new Set([
  "BOOKED",
  "LOADED",
  "SAILED",
  "ARRIVED",
  "CUSTOMS_FILED",
  "CLEARED",
  "DELIVERED",
  "AFTER_SALES",
  "COMPLETED",
  "COMPLETED_EDITING",
]);
const SAILING_PLUS: ReadonlySet<string> = new Set([
  "LOADED",
  "SAILED",
  "ARRIVED",
  "CUSTOMS_FILED",
  "CLEARED",
  "DELIVERED",
  "AFTER_SALES",
  "COMPLETED",
  "COMPLETED_EDITING",
]);
const CUSTOMS_PLUS: ReadonlySet<string> = new Set([
  "ARRIVED",
  "CUSTOMS_FILED",
  "CLEARED",
  "DELIVERED",
  "AFTER_SALES",
  "COMPLETED",
  "COMPLETED_EDITING",
]);
const AFTER_SALES_PLUS: ReadonlySet<string> = new Set([
  "AFTER_SALES",
  "COMPLETED",
  "COMPLETED_EDITING",
]);
const COMPLETED_SET: ReadonlySet<string> = new Set([
  "COMPLETED",
  "COMPLETED_EDITING",
]);
const LANDED_COST_STAGES: ReadonlySet<string> = new Set([
  "CLEARED",
  "DELIVERED",
  "AFTER_SALES",
  "COMPLETED",
  "COMPLETED_EDITING",
]);
const LANDED_COST_ROLES: ReadonlySet<string> = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "FINANCE",
]);

const TAB_DEFS: TabDef[] = [
  { value: "dashboard", label: "Dashboard", visible: () => true },
  { value: "items", label: "Order Items", visible: () => true },
  { value: "payments", label: "Payments", visible: (s) => POST_PI.has(s) },
  {
    value: "production",
    label: "Production",
    visible: (s) => PRODUCTION_STAGES.has(s),
  },
  { value: "packing", label: "Packing List", visible: (s) => PACKING_PLUS.has(s) },
  { value: "booking", label: "Booking", visible: (s) => BOOKING_PLUS.has(s) },
  { value: "sailing", label: "Sailing", visible: (s) => SAILING_PLUS.has(s) },
  {
    value: "shipping-docs",
    label: "Shipping Docs",
    visible: (s) => SAILING_PLUS.has(s),
  },
  { value: "customs", label: "Customs/BOE", visible: (s) => CUSTOMS_PLUS.has(s) },
  {
    value: "after-sales",
    label: "After-Sales",
    visible: (s) => AFTER_SALES_PLUS.has(s),
  },
  {
    value: "final-draft",
    label: "Final Draft",
    visible: (s) => COMPLETED_SET.has(s),
  },
  { value: "queries", label: "Queries", visible: () => true },
  { value: "files", label: "Files", visible: () => true },
  {
    value: "landed-cost",
    label: "Landed Cost",
    visible: (s, role, ct) =>
      LANDED_COST_STAGES.has(s) &&
      LANDED_COST_ROLES.has(role ?? "") &&
      ct === "TRANSPARENCY",
  },
];

/**
 * Pick a sensible default tab when ?tab= is missing or invalid for the
 * current stage. Mirrors `OrderDetail.vue:336-349 getDefaultTab`.
 */
function getDefaultTab(status: OrderStatus): string {
  if (status === "PLAN_PACKING") return "packing";
  if (status === "BOOKED") return "booking";
  if (
    status === "FACTORY_ORDERED" ||
    status === "PRODUCTION_60" ||
    status === "PRODUCTION_80" ||
    status === "PRODUCTION_90"
  ) {
    return "production";
  }
  if (
    status === "PI_SENT" ||
    status === "ADVANCE_PENDING" ||
    status === "ADVANCE_RECEIVED"
  ) {
    return "payments";
  }
  return "dashboard";
}

interface OrderTabsProps {
  order: OrderDetail;
  role: string | undefined;
  initialTab: string | null;
  initialQuery: string | null;
  /**
   * When true, the deferred-tab fallback shows its skeleton + a manual
   * "Open in legacy view" link instead of auto-redirecting after 600 ms.
   *
   * Triggered by the `?_inspect=1` query param. Lets developers and
   * R-16 / R-17 visual verification inspect the shell without it
   * auto-bouncing to the (possibly unavailable) Vue legacy URL in dev
   * setups that don't have nginx fronting both servers.
   */
  inspectMode?: boolean;
}

export function OrderTabs({
  order,
  role,
  initialTab,
  initialQuery,
  inspectMode = false,
}: OrderTabsProps): React.ReactElement {
  const router = useRouter();

  const visibleTabs = React.useMemo(
    () =>
      TAB_DEFS.filter((t) => t.visible(order.status, role, order.client_type)),
    [order.status, order.client_type, role],
  );

  const validInitial =
    initialTab && visibleTabs.some((t) => t.value === initialTab)
      ? initialTab
      : getDefaultTab(order.status);

  const [activeTab, setActiveTab] = React.useState(validInitial);

  // Keep URL in sync when tab changes (mirrors Vue OrderDetail.vue:358-362).
  // Preserves the `_inspect=1` dev-only escape hatch so it doesn't get
  // stripped by the URL rewrite on every tab change.
  React.useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", activeTab);
    if (initialQuery) params.set("query", initialQuery);
    if (inspectMode) params.set("_inspect", "1");
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [activeTab, initialQuery, inspectMode, router]);

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="space-y-3"
    >
      <div
        className="sticky top-0 z-10 -mx-4 bg-white px-4 pt-2 shadow-sm md:-mx-0 md:px-0"
        data-testid="sticky-tab-bar"
      >
        <TabsList className="overflow-x-auto" data-testid="tabs-list">
          {visibleTabs.map((t) => {
            const showQueryBadge =
              t.value === "queries" && order.query_counts.total > 0;
            const queryPulse =
              t.value === "queries" && order.query_counts.open > 0;
            return (
              <TabsTrigger key={t.value} value={t.value}>
                <span className="flex items-center gap-1.5">
                  {t.label}
                  {showQueryBadge ? (
                    <span
                      className={`inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                        queryPulse
                          ? "animate-pulse bg-red-100 text-red-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                      data-testid="queries-tab-badge"
                    >
                      {order.query_counts.total}
                    </span>
                  ) : null}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {visibleTabs.map((t) => (
        <TabsContent key={t.value} value={t.value}>
          <DeferredTabFallback
            orderId={order.id}
            tabValue={t.value}
            tabLabel={t.label}
            inspectMode={inspectMode}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

/**
 * <DeferredTabFallback> — Phase 1 stub.
 *
 * Every tab content panel renders this in the sandbox. It shows a friendly
 * skeleton for ~600 ms then redirects to the Vue page at
 * `/orders/{id}?tab={value}` (which nginx fall-through serves from Vue).
 *
 * When `inspectMode` is true, the auto-redirect is suppressed and a
 * manual "Open in legacy view" link is shown instead. Used for R-16 / R-17
 * visual verification + dev setups that don't have nginx fronting Vue.
 *
 * When an individual tab is migrated in Phase 2-4, replace its case in the
 * `<TabsContent>` map above with the real React component instead of
 * <DeferredTabFallback>.
 */
function DeferredTabFallback({
  orderId,
  tabValue,
  tabLabel,
  inspectMode,
}: {
  orderId: string;
  tabValue: string;
  tabLabel: string;
  inspectMode: boolean;
}): React.ReactElement {
  React.useEffect(() => {
    if (inspectMode) return undefined;
    const timer = setTimeout(() => {
      window.location.assign(
        `/orders/${encodeURIComponent(orderId)}?tab=${encodeURIComponent(tabValue)}`,
      );
    }, 600);
    return () => clearTimeout(timer);
  }, [orderId, tabValue, inspectMode]);

  if (inspectMode) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 py-10 text-center"
        data-testid={`deferred-tab-${tabValue}`}
      >
        <p className="text-sm font-medium text-blue-800">{tabLabel} tab</p>
        <p className="text-xs text-blue-700">
          Tab content not yet migrated. In production this redirects to the
          Vue legacy view.
        </p>
        <a
          href={`/orders/${encodeURIComponent(orderId)}?tab=${encodeURIComponent(tabValue)}`}
          className="mt-1 text-xs font-medium text-blue-700 underline-offset-2 hover:underline"
        >
          Open in legacy view →
        </a>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-12 text-center"
      data-testid={`deferred-tab-${tabValue}`}
    >
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600" />
      <p className="text-sm text-slate-600">Loading {tabLabel}…</p>
      <p className="text-xs text-slate-400">Redirecting to legacy view.</p>
    </div>
  );
}
