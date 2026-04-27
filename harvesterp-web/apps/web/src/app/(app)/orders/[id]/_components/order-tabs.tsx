"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { type UserRole } from "@harvesterp/lib";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/primitives/tabs";
import { OrderDashboardTab } from "./tabs/order-dashboard-tab";
import { OrderFilesTab } from "./tabs/order-files-tab";
import type {
  OrderDetail,
  OrderStatus,
  OrderTimelineResponse,
} from "./types";

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
 * Migration status (post feat/orders-files-tab):
 *   - dashboard tab → migrated; renders <OrderDashboardTab>.
 *   - files tab     → migrated; renders <OrderFilesTab> (full CRUD).
 *   - All other 12 tabs → still render <DeferredTabFallback> with a
 *     friendly "Tab not yet migrated" message + an "Open in legacy
 *     system" link to /_legacy/orders/{uuid}?tab={value} which nginx
 *     forwards to Vue's OrderDetail.vue (strangler-fig escape hatch).
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
  role: UserRole | undefined;
  /**
   * Order timeline (already fetched by the shell). Forwarded into
   * <OrderDashboardTab> for the stage-progress mini-card so the dashboard
   * doesn't need to re-fetch.
   */
  timeline: OrderTimelineResponse | null;
  initialTab: string | null;
  initialQuery: string | null;
}

export function OrderTabs({
  order,
  role,
  timeline,
  initialTab,
  initialQuery,
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
  React.useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", activeTab);
    if (initialQuery) params.set("query", initialQuery);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [activeTab, initialQuery, router]);

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
          {t.value === "dashboard" ? (
            <OrderDashboardTab
              orderId={order.id}
              order={order}
              timeline={timeline}
              role={role}
            />
          ) : t.value === "files" ? (
            <OrderFilesTab
              orderId={order.id}
              order={order}
              role={role}
            />
          ) : (
            <DeferredTabFallback
              orderId={order.id}
              tabValue={t.value}
              tabLabel={t.label}
            />
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

/**
 * <DeferredTabFallback> — placeholder for tabs that haven't been migrated
 * to the Next.js shell yet.
 *
 * Pre-promotion (when /orders/{uuid} still routed to Vue) this component
 * auto-redirected to the Vue legacy view after a 600 ms skeleton flash.
 * After the nginx flip, that redirect would loop back to this same
 * Next.js page, so the auto-redirect has been REMOVED.
 *
 * Renders two manual escape hatches instead:
 *   1. "Open in legacy system" → `/_legacy/orders/{id}?tab={value}`.
 *      nginx routes /_legacy/* to vue_upstream with the prefix stripped,
 *      so Vue receives /orders/{id}?tab=items and renders OrderDetail.vue
 *      normally. Without this link, ADMIN users would lose access to all
 *      13 unmigrated tabs the moment the nginx flip lands (Items,
 *      Payments, Production, Packing, Booking, Sailing, Shipping Docs,
 *      Customs/BOE, After-Sales, Final Draft, Queries, Files,
 *      Landed Cost) — that's the regression this link prevents.
 *   2. "Go to dashboard tab" → `?tab=dashboard`. Stays inside Next.js
 *      since the dashboard IS migrated.
 *
 * As each remaining tab is migrated in subsequent PRs, replace its case
 * in the `<TabsContent>` map above with the real React component.
 */
function DeferredTabFallback({
  orderId,
  tabValue,
  tabLabel,
}: {
  orderId: string;
  tabValue: string;
  tabLabel: string;
}): React.ReactElement {
  const legacyHref = `/_legacy/orders/${encodeURIComponent(orderId)}?tab=${encodeURIComponent(tabValue)}`;
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 py-10 text-center"
      data-testid={`deferred-tab-${tabValue}`}
    >
      <p className="text-sm font-medium text-blue-800">{tabLabel} tab</p>
      <p className="text-xs text-blue-700">
        Tab content is being migrated to the new design.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <a
          href={legacyHref}
          className="text-xs font-medium text-blue-800 underline-offset-2 hover:underline"
          data-testid={`deferred-tab-${tabValue}-legacy-link`}
        >
          Open in legacy system →
        </a>
        <span aria-hidden="true" className="text-xs text-blue-400">
          ·
        </span>
        <a
          href="?tab=dashboard"
          className="text-xs font-medium text-blue-700 underline-offset-2 hover:underline"
        >
          Go to dashboard tab →
        </a>
      </div>
    </div>
  );
}
