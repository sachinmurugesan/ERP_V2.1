"use client";

import * as React from "react";
import { Download, FileSpreadsheet, Info } from "lucide-react";
import { Button } from "@/components/primitives/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/primitives/card";
import { Select } from "@/components/primitives/select";
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
import { cn } from "@/lib/utils";

/**
 * LedgerPage — shared layer-2 composed component for double-entry ledgers.
 *
 * Ported from apps/ui-gallery's prototype and generalized:
 *   - `columns` prop replaces the prototype's hardcoded 5-column schema,
 *     so factory ledger (10 cols) and client ledger (8 cols) can both
 *     consume the same component.
 *   - `dateRange` + `onDateRangeChange` props added (absent from prototype,
 *     required by both Vue sources).
 *   - `headerActions` + `filterActions` slots for page-specific UI.
 *
 * Consumer owns data fetching (TanStack Query, etc.). This component is
 * presentation only.
 */

export interface LedgerColumn<TRow> {
  /** Stable id — used as React key. */
  id: string;
  /** Column header label. */
  header: string;
  /** Render function for each row cell. */
  cell: (row: TRow) => React.ReactNode;
  /** Text alignment. Defaults to "left". */
  align?: "left" | "right" | "center";
  /** Column is right-aligned and part of the totals row if true. */
  totalKey?: string;
  /** Extra class on the <td>. */
  cellClassName?: string;
  /** Extra class on the <th>. */
  headerClassName?: string;
}

export interface LedgerSummaryCard {
  label: string;
  value: string;
  variant?: "default" | "positive" | "negative" | "warn";
  /** Non-colour accessibility label, e.g. "₹45,000 total debit". */
  ariaLabel?: string;
}

export interface LedgerEntityOption {
  id: string;
  name: string;
}

export interface LedgerDateRange {
  from: string | null;
  to: string | null;
}

export interface LedgerPageProps<TRow> {
  /** Heading. */
  title: string;
  /** Optional subheading (e.g. selected entity's full name). */
  subtitle?: string;
  /** Entity type label for select placeholder + empty message. */
  entityLabel: string;
  /** Currently selected entity ID — empty string = none selected. */
  entityId: string;
  /** Dropdown options. */
  entityOptions: LedgerEntityOption[];
  onEntityChange: (id: string) => void;
  /** Summary cards (debit/credit/balance etc.). */
  summary: LedgerSummaryCard[];
  /** Columns for the transactions table. */
  columns: LedgerColumn<TRow>[];
  /** Transaction rows. */
  transactions: TRow[];
  /** Totals row values (keyed by LedgerColumn.totalKey). */
  totals?: Record<string, React.ReactNode>;
  /** Date range filter. */
  dateRange: LedgerDateRange;
  onDateRangeChange: (range: LedgerDateRange) => void;
  /** Download handlers. Buttons always render; disabled state kicks in when falsy. */
  onDownloadPdf?: () => void;
  onDownloadExcel?: () => void;
  /** Disable downloads regardless of handler presence (e.g. no entity / empty txns). */
  downloadDisabled?: boolean;
  /** Optional tooltip explaining any date filter semantics surprise. */
  dateFilterTooltip?: string;
  /** Loading — swap content with skeletons. */
  loading?: boolean;
  /** Error banner shown above the table. */
  error?: string | null;
  /** Page-specific action area in the top-right (beside downloads). */
  headerActions?: React.ReactNode;
}

function summaryVariantClass(variant: LedgerSummaryCard["variant"]): string {
  switch (variant) {
    case "positive":
      return "text-emerald-700";
    case "negative":
      return "text-red-600";
    case "warn":
      return "text-amber-700";
    default:
      return "text-slate-800";
  }
}

function alignClass(align: LedgerColumn<unknown>["align"]): string {
  switch (align) {
    case "right":
      return "text-right";
    case "center":
      return "text-center";
    default:
      return "text-left";
  }
}

export function LedgerPage<TRow>({
  title,
  subtitle,
  entityLabel,
  entityId,
  entityOptions,
  onEntityChange,
  summary,
  columns,
  transactions,
  totals,
  dateRange,
  onDateRangeChange,
  onDownloadPdf,
  onDownloadExcel,
  downloadDisabled = false,
  dateFilterTooltip,
  loading = false,
  error = null,
  headerActions,
}: LedgerPageProps<TRow>): React.ReactElement {
  const hasEntitySelected = entityId.length > 0;
  const noTransactions = transactions.length === 0;
  const disableDownload = downloadDisabled || !hasEntitySelected || noTransactions;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-800">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {headerActions}
          {onDownloadPdf ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDownloadPdf}
              disabled={disableDownload}
              aria-label={`Download PDF statement${subtitle ? ` for ${subtitle}` : ""}`}
            >
              <Download size={14} className="mr-2" />
              PDF
            </Button>
          ) : null}
          {onDownloadExcel ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDownloadExcel}
              disabled={disableDownload}
              aria-label={`Download Excel statement${subtitle ? ` for ${subtitle}` : ""}`}
            >
              <FileSpreadsheet size={14} className="mr-2" />
              Excel
            </Button>
          ) : null}
        </div>
      </header>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[220px] flex-1">
          <label
            htmlFor="ledger-entity"
            className="block text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            {entityLabel}
          </label>
          <Select
            id="ledger-entity"
            className="mt-1"
            value={entityId}
            onChange={(e) => onEntityChange(e.target.value)}
          >
            <option value="">Select {entityLabel.toLowerCase()}…</option>
            {entityOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label
            htmlFor="ledger-from"
            className="block text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            From
          </label>
          <input
            id="ledger-from"
            type="date"
            value={dateRange.from ?? ""}
            onChange={(e) =>
              onDateRangeChange({ ...dateRange, from: e.target.value || null })
            }
            className="mt-1 h-9 rounded-md border border-slate-200 bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div>
          <label
            htmlFor="ledger-to"
            className="block text-xs font-medium uppercase tracking-wide text-slate-500"
          >
            To
          </label>
          <input
            id="ledger-to"
            type="date"
            value={dateRange.to ?? ""}
            onChange={(e) =>
              onDateRangeChange({ ...dateRange, to: e.target.value || null })
            }
            className="mt-1 h-9 rounded-md border border-slate-200 bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        {dateFilterTooltip ? (
          <div className="flex items-center gap-1 pb-1 text-xs text-slate-500">
            <Info size={14} aria-hidden="true" />
            <span>{dateFilterTooltip}</span>
          </div>
        ) : null}
      </div>

      {/* Error banner */}
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-3 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-6 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : summary.length > 0 ? (
        <div
          className={cn(
            "grid grid-cols-1 gap-4",
            summary.length === 2 && "sm:grid-cols-2",
            summary.length === 3 && "sm:grid-cols-3",
            summary.length >= 4 && "sm:grid-cols-4",
          )}
        >
          {summary.map((card) => (
            <Card key={card.label} role="status" aria-live="polite">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    summaryVariantClass(card.variant),
                  )}
                  aria-label={card.ariaLabel ?? `${card.label}: ${card.value}`}
                >
                  {card.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Transactions */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !hasEntitySelected ? (
            <div className="flex h-48 items-center justify-center px-4 text-center text-sm text-slate-500">
              Select {entityLabel.toLowerCase()} to view their ledger.
            </div>
          ) : noTransactions ? (
            <div className="flex h-40 items-center justify-center px-4 text-center text-sm text-slate-500">
              No ledger entries found for the selected {entityLabel.toLowerCase()}.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead
                      key={col.id}
                      className={cn(alignClass(col.align), col.headerClassName)}
                    >
                      {col.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((row, idx) => (
                  <TableRow key={idx}>
                    {columns.map((col) => (
                      <TableCell
                        key={col.id}
                        className={cn(alignClass(col.align), col.cellClassName)}
                      >
                        {col.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
              {totals ? (
                <TableFooter>
                  <TableRow>
                    {columns.map((col, idx) => {
                      const isFirst = idx === 0;
                      const content = col.totalKey
                        ? totals[col.totalKey]
                        : isFirst
                          ? "Totals"
                          : null;
                      return (
                        <TableCell
                          key={col.id}
                          className={cn(
                            alignClass(col.align),
                            "font-semibold",
                            col.cellClassName,
                          )}
                        >
                          {content}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableFooter>
              ) : null}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
