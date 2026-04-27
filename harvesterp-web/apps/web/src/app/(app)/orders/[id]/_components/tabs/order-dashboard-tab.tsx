"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { type UserRole, formatINR, formatDate, Resource } from "@harvesterp/lib";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/primitives/card";
import { Button } from "@/components/primitives/button";
import { Skeleton } from "@/components/primitives/skeleton";
import { RoleGate } from "@/components/composed/role-gate";
import { StageChip } from "@/components/composed/stage-chip";

import type {
  OrderDetail,
  OrderTimelineResponse,
  TimelineEntry,
} from "../types";
import type { OrderPaymentsResponse } from "@/app/api/orders/[id]/payments/route";
import type { FactoryPaymentsResponse } from "@/app/api/orders/[id]/factory-payments/route";
import type { OrderShipment } from "@/app/api/orders/[id]/shipments/route";
import type { BillOfEntry } from "@/app/api/orders/[id]/boe/route";

/**
 * <OrderDashboardTab> — first migrated tab content for the order-detail
 * shell. Read-only rollup view of the order's headline financials, shipping
 * status, customs filing, and stage progress.
 *
 * Vue source: `frontend/src/components/order/OrderDashboardTab.vue` (552 LOC).
 * Migration log: `ERP_V1/docs/migration/logs/2026-04-26-orders-dashboard-tab.md`.
 *
 * Six cards laid out in a responsive 2-column grid (1 col on mobile):
 *   1. Order Summary          — props only, no fetch
 *   2. Factory & Costs        — D-004 gated; SUPER_ADMIN | FINANCE only
 *   3. Client Payments        — /api/orders/{id}/payments
 *   4. Shipment Status        — /api/orders/{id}/shipments
 *   5. Customs / BOE          — /api/orders/{id}/boe (chained on most recent shipment)
 *   6. Stage Timeline (mini)  — timeline prop (already fetched by shell)
 *
 * Each card owns its loading / empty / error state — there is no global
 * spinner. Cards render in parallel as their queries resolve.
 *
 * D-004 enforcement is double-belt:
 *   - This component wraps Card 2 in <RoleGate permission={FACTORY_PAYMENTS}>;
 *     non-FINANCE users see <FactoryFinancialsRestricted /> instead.
 *   - The proxy at /api/orders/{id}/factory-payments also gates server-side,
 *     so even if the client wrapper were bypassed the data would not be sent.
 */

const ORDER_DETAIL_QUERY_STALE_MS = 30_000;
const TOTAL_STAGES = 17;

interface OrderDashboardTabProps {
  orderId: string;
  order: OrderDetail;
  timeline: OrderTimelineResponse | null;
  /**
   * Caller role. Drives Card 2 (Factory & Costs) D-004 gating. Optional
   * because some callers (e.g. tests) may not have a resolved role; an
   * undefined role is treated the same as a non-FINANCE role — Card 2
   * shows the restricted placeholder.
   */
  role: UserRole | undefined;
}

export function OrderDashboardTab({
  orderId,
  order,
  timeline,
  role,
}: OrderDashboardTabProps): React.ReactElement {
  return (
    <div
      className="grid grid-cols-1 gap-3 md:grid-cols-2"
      data-testid="order-dashboard-tab"
    >
      <OrderSummaryCard order={order} />
      <FactoryAndCostsCard orderId={orderId} role={role} />
      <ClientPaymentsCard orderId={orderId} currency={order.currency} />
      <ShipmentStatusCard orderId={orderId} />
      <CustomsBoeCard orderId={orderId} />
      <StageTimelineMiniCard order={order} timeline={timeline} />
    </div>
  );
}

// ── Card 1 — Order Summary (no fetch) ────────────────────────────────────────

function OrderSummaryCard({ order }: { order: OrderDetail }): React.ReactElement {
  return (
    <Card data-testid="dashboard-card-summary">
      <CardHeader>
        <CardTitle>Order summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <SummaryRow
          label="Order #"
          value={order.order_number ?? "DRAFT"}
        />
        <SummaryRow
          label="Stage"
          value={
            <StageChip
              stageNumber={order.stage_number}
              stageName={order.stage_name}
            />
          }
        />
        <SummaryRow
          label="Client"
          value={order.client_name ?? "—"}
        />
        <SummaryRow
          label="Factory"
          value={order.factory_name ?? "Not assigned"}
        />
        <SummaryRow
          label="PO reference"
          value={order.po_reference ?? "—"}
        />
        <SummaryRow
          label="Currency"
          value={order.currency ?? "—"}
        />
        <SummaryRow
          label="Created"
          value={formatDate(order.created_at)}
        />
      </CardContent>
    </Card>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

// ── Card 2 — Factory & Costs (D-004 gated) ───────────────────────────────────

function FactoryAndCostsCard({
  orderId,
  role,
}: {
  orderId: string;
  role: UserRole | undefined;
}): React.ReactElement {
  const user = role ? { role } : null;
  return (
    <RoleGate
      user={user}
      permission={Resource.FACTORY_PAYMENTS}
      fallback={<FactoryFinancialsRestricted />}
    >
      <FactoryAndCostsContent orderId={orderId} />
    </RoleGate>
  );
}

function FactoryAndCostsContent({
  orderId,
}: {
  orderId: string;
}): React.ReactElement {
  const query = useQuery<FactoryPaymentsResponse, Error>({
    queryKey: ["order-factory-payments", orderId],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/factory-payments`,
        { signal },
      );
      if (!res.ok) {
        throw Object.assign(
          new Error(`Factory payments fetch failed (${res.status})`),
          { status: res.status },
        );
      }
      return (await res.json()) as FactoryPaymentsResponse;
    },
    staleTime: ORDER_DETAIL_QUERY_STALE_MS,
  });

  return (
    <Card data-testid="dashboard-card-factory">
      <CardHeader>
        <CardTitle>Factory &amp; costs</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isPending ? <FourMetricSkeleton /> : null}
        {query.isError ? (
          <CardError onRetry={() => query.refetch()} />
        ) : null}
        {query.isSuccess && query.data ? (
          <div className="space-y-2">
            <SummaryRow
              label="Factory bill"
              value={formatINR(query.data.summary.factory_total_inr)}
            />
            <SummaryRow
              label="Paid to factory"
              value={formatINR(query.data.summary.total_inr)}
            />
            <SummaryRow
              label="Balance"
              value={formatINR(query.data.summary.balance_inr)}
            />
            <SummaryRow
              label="Remittances"
              value={String(query.data.summary.remittance_count)}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function FactoryFinancialsRestricted(): React.ReactElement {
  return (
    <Card data-testid="dashboard-card-factory-restricted">
      <CardHeader>
        <CardTitle>Factory &amp; costs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
          <p className="font-medium text-slate-700">
            Restricted to Finance role
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Factory cost data is restricted to the Finance role. (Policy D-004)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Card 3 — Client Payments ─────────────────────────────────────────────────

function ClientPaymentsCard({
  orderId,
  currency: _currency,
}: {
  orderId: string;
  currency: string;
}): React.ReactElement {
  const query = useQuery<OrderPaymentsResponse, Error>({
    queryKey: ["order-payments", orderId],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/payments`,
        { signal },
      );
      if (!res.ok) {
        throw Object.assign(
          new Error(`Payments fetch failed (${res.status})`),
          { status: res.status },
        );
      }
      return (await res.json()) as OrderPaymentsResponse;
    },
    staleTime: ORDER_DETAIL_QUERY_STALE_MS,
  });

  return (
    <Card data-testid="dashboard-card-payments">
      <CardHeader>
        <CardTitle>Client payments</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isPending ? <FourMetricSkeleton /> : null}
        {query.isError ? (
          <CardError onRetry={() => query.refetch()} />
        ) : null}
        {query.isSuccess && query.data ? (
          <div className="space-y-2">
            <SummaryRow
              label="PI total"
              value={formatINR(query.data.summary.pi_total_inr)}
            />
            <SummaryRow
              label="Total received"
              value={formatINR(query.data.summary.total_paid_inr)}
            />
            <SummaryRow
              label="Balance"
              value={formatINR(query.data.summary.balance_inr)}
            />
            <SummaryRow
              label="Payment count"
              value={String(query.data.summary.payment_count)}
            />
            <Link
              href={`?tab=payments`}
              className="mt-2 inline-block text-xs font-medium text-emerald-700 underline-offset-2 hover:underline"
              data-testid="dashboard-card-payments-deeplink"
            >
              View payments tab →
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ── Card 4 — Shipment Status ─────────────────────────────────────────────────

function ShipmentStatusCard({
  orderId,
}: {
  orderId: string;
}): React.ReactElement {
  const query = useShipmentsQuery(orderId);

  return (
    <Card data-testid="dashboard-card-shipment">
      <CardHeader>
        <CardTitle>Shipment status</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isPending ? <ThreeRowSkeleton /> : null}
        {query.isError ? (
          <CardError onRetry={() => query.refetch()} />
        ) : null}
        {query.isSuccess && query.data ? (
          query.data.length === 0 ? (
            <EmptyState message="No shipments yet" />
          ) : (
            <ShipmentList shipments={query.data} />
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

function useShipmentsQuery(orderId: string) {
  return useQuery<OrderShipment[], Error>({
    queryKey: ["order-shipments", orderId],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/shipments`,
        { signal },
      );
      if (!res.ok) {
        throw Object.assign(
          new Error(`Shipments fetch failed (${res.status})`),
          { status: res.status },
        );
      }
      return (await res.json()) as OrderShipment[];
    },
    staleTime: ORDER_DETAIL_QUERY_STALE_MS,
  });
}

function ShipmentList({
  shipments,
}: {
  shipments: OrderShipment[];
}): React.ReactElement {
  // Show the most recent shipment as the headline; collapse the rest into a
  // count so the card stays compact. The Sailing tab has the full list.
  const headline = shipments[0];
  const overflow = shipments.length - 1;
  if (!headline) {
    return <EmptyState message="No shipments yet" />;
  }
  return (
    <div className="space-y-2 text-sm">
      <SummaryRow
        label="Container"
        value={headline.container_number ?? "—"}
      />
      <SummaryRow
        label="Phase"
        value={headline.sailing_phase ?? headline.phase ?? "—"}
      />
      <SummaryRow label="ETD" value={formatDate(headline.etd)} />
      <SummaryRow label="ETA" value={formatDate(headline.eta)} />
      {overflow > 0 ? (
        <p className="text-xs text-slate-500">
          + {overflow} more shipment{overflow === 1 ? "" : "s"}
        </p>
      ) : null}
      <Link
        href={`?tab=sailing`}
        className="mt-2 inline-block text-xs font-medium text-emerald-700 underline-offset-2 hover:underline"
        data-testid="dashboard-card-shipment-deeplink"
      >
        View sailing tab →
      </Link>
    </div>
  );
}

// ── Card 5 — Customs / BOE ───────────────────────────────────────────────────

function CustomsBoeCard({
  orderId,
}: {
  orderId: string;
}): React.ReactElement {
  // BOE is keyed on a shipment id, so we wait for shipments to resolve, then
  // fan out to the most recent shipment's BOE. (Vue iterates all shipments
  // and sums the duty; for the dashboard headline we just show the most
  // recent shipment's BOE.)
  const shipmentsQuery = useShipmentsQuery(orderId);
  const headlineShipmentId = shipmentsQuery.data?.[0]?.id;

  const boeQuery = useQuery<BillOfEntry | null, Error>({
    queryKey: ["order-boe", orderId, headlineShipmentId],
    queryFn: async ({ signal }) => {
      if (!headlineShipmentId) return null;
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/boe?shipment_id=${encodeURIComponent(headlineShipmentId)}`,
        { signal },
      );
      if (!res.ok) {
        throw Object.assign(new Error(`BOE fetch failed (${res.status})`), {
          status: res.status,
        });
      }
      return (await res.json()) as BillOfEntry | null;
    },
    enabled: shipmentsQuery.isSuccess && !!headlineShipmentId,
    staleTime: ORDER_DETAIL_QUERY_STALE_MS,
  });

  return (
    <Card data-testid="dashboard-card-customs">
      <CardHeader>
        <CardTitle>Customs / BOE</CardTitle>
      </CardHeader>
      <CardContent>
        {shipmentsQuery.isPending || boeQuery.isPending ? (
          <ThreeRowSkeleton />
        ) : null}
        {shipmentsQuery.isError ? (
          <CardError onRetry={() => shipmentsQuery.refetch()} />
        ) : null}
        {boeQuery.isError ? (
          <CardError onRetry={() => boeQuery.refetch()} />
        ) : null}
        {shipmentsQuery.isSuccess && shipmentsQuery.data?.length === 0 ? (
          <EmptyState message="No shipments yet" />
        ) : null}
        {shipmentsQuery.isSuccess && headlineShipmentId && boeQuery.isSuccess ? (
          boeQuery.data === null ? (
            <EmptyState message="No Bill of Entry yet" />
          ) : (
            <BoeDetail boe={boeQuery.data} />
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

function BoeDetail({ boe }: { boe: BillOfEntry }): React.ReactElement {
  return (
    <div className="space-y-2 text-sm">
      <SummaryRow label="BE number" value={boe.be_number ?? "—"} />
      <SummaryRow label="Status" value={boe.status ?? "DRAFT"} />
      <SummaryRow label="BE date" value={formatDate(boe.be_date)} />
      <SummaryRow
        label="Total duty"
        value={formatINR(boe.total_duty)}
      />
      <Link
        href={`?tab=customs`}
        className="mt-2 inline-block text-xs font-medium text-emerald-700 underline-offset-2 hover:underline"
        data-testid="dashboard-card-customs-deeplink"
      >
        View customs tab →
      </Link>
    </div>
  );
}

// ── Card 6 — Stage Timeline (mini-view) ──────────────────────────────────────

function StageTimelineMiniCard({
  order,
  timeline,
}: {
  order: OrderDetail;
  timeline: OrderTimelineResponse | null;
}): React.ReactElement {
  const completed = countCompleted(timeline?.timeline ?? []);
  const percent = Math.round(
    (Math.max(order.stage_number, 0) / TOTAL_STAGES) * 100,
  );
  return (
    <Card data-testid="dashboard-card-timeline">
      <CardHeader>
        <CardTitle>Stage progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Current</span>
            <StageChip
              stageNumber={order.stage_number}
              stageName={order.stage_name}
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Stages complete</span>
            <span className="font-medium text-slate-900">
              {completed} / {TOTAL_STAGES}
            </span>
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${percent}%` }}
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Stage progress ${percent}%`}
            data-testid="dashboard-card-timeline-bar"
          />
        </div>
        {timeline === null ? (
          <p className="text-xs text-slate-400">
            Timeline detail loading…
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function countCompleted(entries: TimelineEntry[]): number {
  return entries.filter((e) => e.status === "completed").length;
}

// ── Shared sub-components ────────────────────────────────────────────────────

function FourMetricSkeleton(): React.ReactElement {
  return (
    <div className="space-y-2" data-testid="dashboard-card-skeleton">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

function ThreeRowSkeleton(): React.ReactElement {
  return (
    <div className="space-y-2" data-testid="dashboard-card-skeleton">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

function EmptyState({ message }: { message: string }): React.ReactElement {
  return (
    <p
      className="py-3 text-center text-sm text-slate-500"
      data-testid="dashboard-card-empty"
    >
      {message}
    </p>
  );
}

function CardError({ onRetry }: { onRetry: () => void }): React.ReactElement {
  return (
    <div
      className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      data-testid="dashboard-card-error"
    >
      <span>Failed to load</span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
