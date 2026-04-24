import * as React from "react";
import { formatINR } from "@harvesterp/lib";
import type { LedgerColumn } from "@/components/composed/ledger-page";
import { cn } from "@/lib/utils";
import type { LedgerEntry } from "./types";

/**
 * 10-column schema for the Factory Ledger table.
 *
 * Mirrors the Vue source's column order and formatting. Bold weight is
 * applied to non-zero debit/credit/balance cells as the non-colour a11y
 * cue per Phase 2 decision 8; aria-label on each cell includes the
 * semantic value ("₹45,000 debit" etc.).
 *
 * Date column has `sticky left-0` so horizontal scroll on mobile keeps
 * the date visible per Phase 2 decision 7.
 */

function moneyCell(
  value: number,
  label: "debit" | "credit" | "balance",
  tone: string,
): React.ReactElement {
  if (value === 0) {
    return (
      <span
        aria-label={`₹0 ${label}`}
        className="text-slate-300"
      >
        —
      </span>
    );
  }
  return (
    <span
      aria-label={`${formatINR(value)} ${label}`}
      className={cn("font-semibold", tone)}
    >
      {formatINR(value)}
    </span>
  );
}

function balanceCell(value: number): React.ReactElement {
  // Positive = factory owed (warn amber); zero/negative = neutral or overpaid.
  const tone = value > 0 ? "text-amber-700" : value < 0 ? "text-emerald-700" : "text-slate-600";
  return (
    <span
      aria-label={`${formatINR(value)} running balance`}
      className={cn("font-semibold", tone)}
    >
      {formatINR(value)}
    </span>
  );
}

export const FACTORY_LEDGER_COLUMNS: LedgerColumn<LedgerEntry>[] = [
  {
    id: "date",
    header: "Date",
    cell: (e) => <span className="text-slate-600">{e.date}</span>,
    headerClassName: "sticky left-0 z-10 bg-slate-50",
    cellClassName: "sticky left-0 z-10 bg-white text-slate-600",
  },
  {
    id: "order",
    header: "Order",
    cell: (e) => (
      <span className="font-mono text-xs text-indigo-600">{e.order_number}</span>
    ),
  },
  {
    id: "remark",
    header: "Remark",
    cell: (e) => <span className="text-slate-700">{e.remark}</span>,
  },
  {
    id: "currency",
    header: "Currency",
    cell: (e) => (
      <span className="font-mono text-xs text-slate-500">{e.currency || "-"}</span>
    ),
  },
  {
    id: "forex",
    header: "Forex Rate",
    align: "right",
    cell: (e) => (
      <span className="text-xs text-slate-500">
        {e.exchange_rate ? Number(e.exchange_rate).toFixed(2) : "-"}
      </span>
    ),
  },
  {
    id: "debit",
    header: "Debit (₹)",
    align: "right",
    totalKey: "debit",
    cell: (e) => moneyCell(e.debit, "debit", "text-red-600"),
  },
  {
    id: "credit",
    header: "Credit (₹)",
    align: "right",
    totalKey: "credit",
    cell: (e) => moneyCell(e.credit, "credit", "text-emerald-600"),
  },
  {
    id: "balance",
    header: "Balance (₹)",
    align: "right",
    totalKey: "balance",
    cell: (e) => balanceCell(e.running_balance),
  },
  {
    id: "method",
    header: "Method",
    cell: (e) => (
      <span className="text-xs text-slate-500">
        {e.method && e.method !== "-" ? e.method.replace(/_/g, " ") : "-"}
      </span>
    ),
  },
  {
    id: "reference",
    header: "Reference",
    cell: (e) => <span className="text-xs text-slate-400">{e.reference || "-"}</span>,
  },
];
