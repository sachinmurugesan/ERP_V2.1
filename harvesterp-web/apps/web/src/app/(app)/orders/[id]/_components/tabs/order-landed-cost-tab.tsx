"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { formatINR } from "@harvesterp/lib";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/primitives/card";
import { Button } from "@/components/primitives/button";
import { Skeleton } from "@/components/primitives/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/primitives/table";
import { useBlobDownload } from "@/lib/use-blob-download";

import { FileSpreadsheet, Info, Loader2 } from "lucide-react";

import type { OrderDetail } from "../types";
import type { LandedCostResponse } from "@/app/api/orders/[id]/landed-cost/route";

/**
 * <OrderLandedCostTab> — full-cost-breakdown read-only view for
 * TRANSPARENCY clients on CLEARED+ orders.
 *
 * VISIBILITY: this component trusts the shell predicate
 * (`order-tabs.tsx:192-199`) — it is only mounted when status ∈
 * CLEARED+, role ∈ {SUPER_ADMIN, ADMIN, FINANCE}, and client_type ===
 * "TRANSPARENCY". No defensive re-check inside the body (decision D-4
 * in the migration log). Backend triple-gates anyway.
 *
 * Layout mirrors Vue's `frontend/src/components/order/LandedCostTab.vue`
 * 1:1 — header + 4 KPI cards + expense table + per-item table — using
 * the design-system primitives (Card / Table / Button / Skeleton).
 *
 * KPI cards are duplicated locally (decision D-2) — they have a
 * coloured fill the queries-tab KpiCard doesn't, so lifting now would
 * over-engineer the API for two consumers.
 */

interface OrderLandedCostTabProps {
  orderId: string;
  order: OrderDetail;
}

export function OrderLandedCostTab({
  orderId,
  order: _order,
}: OrderLandedCostTabProps): React.ReactElement {
  const dataQuery = useQuery<LandedCostResponse | null, Error>({
    queryKey: ["order-landed-cost", orderId],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/landed-cost`,
        { signal },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          detail?: string;
        };
        const message =
          body.error ??
          body.detail ??
          (res.status === 404
            ? "Landed cost not available for this order."
            : `Failed to load landed cost (${res.status})`);
        throw new Error(message);
      }
      return (await res.json()) as LandedCostResponse | null;
    },
    staleTime: 30_000,
  });

  const blob = useBlobDownload();

  async function handleDownload(): Promise<void> {
    const orderNumber = dataQuery.data?.order_number ?? orderId;
    try {
      await blob.download(
        `/api/orders/${encodeURIComponent(orderId)}/landed-cost/download`,
        `LandedCost_${orderNumber}.xlsx`,
      );
    } catch {
      // useBlobDownload captures the error in its internal state for
      // the inline alert below.
    }
  }

  if (dataQuery.isPending) {
    return <LandedCostSkeleton />;
  }

  if (dataQuery.isError) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 py-12 text-center"
        data-testid="landed-cost-error"
      >
        <Info aria-hidden="true" className="text-amber-500" size={28} />
        <p className="text-sm text-slate-600">{dataQuery.error.message}</p>
      </div>
    );
  }

  const data = dataQuery.data;
  if (!data) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-12 text-center"
        data-testid="landed-cost-empty"
      >
        <Info aria-hidden="true" className="text-slate-400" size={28} />
        <p className="text-sm text-slate-600">
          No landed cost data yet — wait for the order to clear customs.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="landed-cost-tab">
      <Header
        orderNumber={data.order_number}
        clientName={data.client_name}
        onDownload={handleDownload}
        downloading={blob.isDownloading}
      />

      {blob.error ? (
        <div
          className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
          data-testid="landed-cost-download-error"
        >
          <span>Download failed: {blob.error}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => blob.clearError()}
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      <KpiCards summary={data.summary} />

      <ExpenseBreakdownCard
        invoice={data.invoice}
        expenses={data.expenses}
        summary={data.summary}
      />

      {data.items.length > 0 ? <PerItemBreakdownCard items={data.items} /> : null}
    </div>
  );
}

// ── Header ──────────────────────────────────────────────────────────────────

function Header({
  orderNumber,
  clientName,
  onDownload,
  downloading,
}: {
  orderNumber: string | null;
  clientName: string;
  onDownload: () => void;
  downloading: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
          Landed Cost Breakdown
        </h3>
        <p
          className="mt-0.5 text-xs text-slate-400"
          data-testid="landed-cost-subtitle"
        >
          {orderNumber ?? "—"} · {clientName}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onDownload}
        disabled={downloading}
        data-testid="landed-cost-download-button"
      >
        {downloading ? (
          <>
            <Loader2 size={14} className="mr-1.5 animate-spin" aria-hidden="true" />
            Generating...
          </>
        ) : (
          <>
            <FileSpreadsheet size={14} className="mr-1.5" aria-hidden="true" />
            Download Excel
          </>
        )}
      </Button>
    </div>
  );
}

// ── KPI cards ───────────────────────────────────────────────────────────────

const KPI_ACCENT: Record<string, string> = {
  blue: "bg-blue-50 border-blue-100 text-blue-800",
  amber: "bg-amber-50 border-amber-100 text-amber-800",
  indigo: "bg-indigo-50 border-indigo-100 text-indigo-800",
  emerald: "bg-emerald-50 border-emerald-100 text-emerald-800",
};

const KPI_LABEL_TONE: Record<string, string> = {
  blue: "text-blue-500",
  amber: "text-amber-500",
  indigo: "text-indigo-500",
  emerald: "text-emerald-500",
};

function KpiCards({
  summary,
}: {
  summary: LandedCostResponse["summary"];
}): React.ReactElement {
  return (
    <div
      className="grid grid-cols-2 gap-3 md:grid-cols-4"
      data-testid="landed-cost-kpis"
    >
      <KpiCard
        label="Invoice"
        value={formatLakh(summary.total_bill_inr)}
        accent="blue"
        testId="landed-cost-kpi-invoice"
      />
      <KpiCard
        label="Total Expenses"
        value={formatLakh(summary.total_expenses_inr)}
        accent="amber"
        testId="landed-cost-kpi-expenses"
      />
      <KpiCard
        label="Expense %"
        value={`${(summary.expense_percent ?? 0).toFixed(2)}%`}
        accent="indigo"
        testId="landed-cost-kpi-expense-pct"
      />
      <KpiCard
        label="Grand Total"
        value={formatLakh(summary.grand_total_inr)}
        accent="emerald"
        testId="landed-cost-kpi-grand-total"
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
  testId,
}: {
  label: string;
  value: string;
  accent: keyof typeof KPI_ACCENT;
  testId: string;
}): React.ReactElement {
  return (
    <div
      className={`rounded-xl border p-4 ${KPI_ACCENT[accent]}`}
      data-testid={testId}
    >
      <p
        className={`text-[10px] font-medium uppercase tracking-wider ${KPI_LABEL_TONE[accent]}`}
      >
        {label}
      </p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

// ── Expense breakdown ───────────────────────────────────────────────────────

function ExpenseBreakdownCard({
  invoice,
  expenses,
  summary,
}: {
  invoice: LandedCostResponse["invoice"];
  expenses: LandedCostResponse["expenses"];
  summary: LandedCostResponse["summary"];
}): React.ReactElement {
  return (
    <Card>
      <CardHeader className="px-5 py-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          Expense Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table data-testid="landed-cost-expense-table">
          <TableHeader>
            <TableRow>
              <TableHead className="px-5">Category</TableHead>
              <TableHead className="px-5 text-right">Amount (INR)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-blue-50/30">
              <TableCell className="px-5 py-3 font-medium text-slate-800">
                {invoice.label}
              </TableCell>
              <TableCell className="px-5 py-3 text-right font-bold text-blue-700">
                {formatINR(invoice.amount_inr)}
              </TableCell>
            </TableRow>
            {expenses.map((exp, i) => (
              <TableRow key={`${exp.label}-${i}`}>
                <TableCell className="px-5 py-2.5 text-slate-700">
                  {exp.label}
                </TableCell>
                <TableCell className="px-5 py-2.5 text-right font-mono text-slate-700">
                  {formatINR(exp.amount_inr)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter data-testid="landed-cost-expense-tfoot">
            <TableRow>
              <TableCell className="px-5 py-3 font-bold text-slate-700">
                Total Bill
              </TableCell>
              <TableCell className="px-5 py-3 text-right font-bold text-slate-800">
                {formatINR(summary.total_bill_inr)}
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="px-5 py-3 font-bold text-amber-700">
                Total Expenses
              </TableCell>
              <TableCell className="px-5 py-3 text-right font-bold text-amber-800">
                {formatINR(summary.total_expenses_inr)}
              </TableCell>
            </TableRow>
            <TableRow className="bg-emerald-50">
              <TableCell className="px-5 py-3 text-base font-bold text-emerald-700">
                Grand Total
              </TableCell>
              <TableCell
                className="px-5 py-3 text-right text-base font-bold text-emerald-800"
                data-testid="landed-cost-grand-total-amount"
              >
                {formatINR(summary.grand_total_inr)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Per-item breakdown ──────────────────────────────────────────────────────

function PerItemBreakdownCard({
  items,
}: {
  items: LandedCostResponse["items"];
}): React.ReactElement {
  return (
    <Card>
      <CardHeader className="px-5 py-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          Per-Item Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table data-testid="landed-cost-items-table">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 px-3">#</TableHead>
              <TableHead className="px-3">Product</TableHead>
              <TableHead className="w-12 px-3 text-center">Qty</TableHead>
              <TableHead className="px-3 text-right">Value</TableHead>
              <TableHead className="px-3 text-right">Freight</TableHead>
              <TableHead className="px-3 text-right">Duty</TableHead>
              <TableHead className="px-3 text-right">Clearance</TableHead>
              <TableHead className="px-3 text-right">Commission</TableHead>
              <TableHead className="px-3 text-right text-emerald-700">
                Landed Cost
              </TableHead>
              <TableHead className="px-3 text-right">Per Unit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, idx) => (
              <TableRow key={`${item.product_code}-${idx}`}>
                <TableCell className="px-3 py-2 text-xs text-slate-400">
                  {idx + 1}
                </TableCell>
                <TableCell className="px-3 py-2">
                  <div className="font-mono text-[10px] text-slate-400">
                    {item.product_code}
                  </div>
                  <div className="max-w-[200px] truncate text-xs text-slate-700">
                    {item.product_name}
                  </div>
                </TableCell>
                <TableCell className="px-3 py-2 text-center text-xs font-medium">
                  {item.quantity}
                </TableCell>
                <TableCell className="px-3 py-2 text-right font-mono text-xs">
                  {formatINR(item.item_value_inr)}
                </TableCell>
                <TableCell className="px-3 py-2 text-right font-mono text-xs">
                  {formatINR(item.freight_share)}
                </TableCell>
                <TableCell className="px-3 py-2 text-right font-mono text-xs">
                  {formatINR(item.duty_share)}
                </TableCell>
                <TableCell className="px-3 py-2 text-right font-mono text-xs">
                  {formatINR(item.clearance_share)}
                </TableCell>
                <TableCell className="px-3 py-2 text-right font-mono text-xs">
                  {formatINR(item.commission_share)}
                </TableCell>
                <TableCell className="px-3 py-2 text-right text-xs font-bold text-emerald-700">
                  {formatINR(item.total_landed_cost)}
                </TableCell>
                <TableCell className="px-3 py-2 text-right font-mono text-xs text-slate-500">
                  {formatINR(item.landed_cost_per_unit)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Loading skeleton ────────────────────────────────────────────────────────

function LandedCostSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6" data-testid="landed-cost-skeleton">
      <Skeleton className="h-9 w-72" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

// ── Local helpers ───────────────────────────────────────────────────────────

/**
 * formatLakh — port of Vue's local helper. Compresses large rupee
 * amounts to lakhs / thousands for the KPI cards. Detail rows use
 * `formatINR` (full precision); only the headline values use this.
 *
 * Keeps the Vue rule that 0 / null / NaN render as the em-dash
 * sentinel "—" (see LandedCostTab.vue:46-52).
 */
function formatLakh(val: number | null | undefined): string {
  if (val == null || Number.isNaN(val) || val === 0) return "—";
  if (val >= 100_000) return `₹${(val / 100_000).toFixed(2)}L`;
  if (val >= 1_000) return `₹${(val / 1_000).toFixed(1)}K`;
  return formatINR(val);
}
