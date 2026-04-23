"use client";

/**
 * <LedgerPage> — P-017 canonical implementation.
 *
 * Extracted shared structure of ClientLedger.vue and FactoryLedger.vue:
 *   filter bar, summary cards, transaction table, download buttons.
 *
 * Entity-agnostic: consumer passes entity type + data props.
 * Consumer owns data fetching (TanStack Query or equivalent at Task 7).
 *
 * "use client" — interactive (entity select, download handlers).
 */

import { Download, FileSpreadsheet } from "lucide-react";
import { type InternalString, type Currency, formatCurrency, resolveString } from "@harvesterp/lib";
import { Button } from "@/components/primitives/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/primitives/card";
import { Skeleton } from "@/components/primitives/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/primitives/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/primitives/table";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

export interface LedgerSummaryCard {
  label: string;
  value: string;
  variant?: "default" | "positive" | "negative";
}

export interface LedgerTransaction {
  date: string;
  description: string;
  debit?: number;
  credit?: number;
  runningBalance?: number;
  /** ISO currency code. Default "INR". */
  currency?: string;
}

export interface LedgerEntityOption {
  id: string;
  name: string;
}

export interface LedgerPageProps {
  /** Page heading (D-005 InternalString — admin context). */
  title: InternalString;
  /** Drives column labels and any entity-specific rendering. */
  entityType: "client" | "factory";
  /** Currently selected entity ID. */
  entityId: string;
  /** Dropdown options for entity selector. */
  entityOptions: LedgerEntityOption[];
  /** Called when user selects a different entity. */
  onEntityChange: (id: string) => void;
  /** Summary cards shown above the table. */
  summary: LedgerSummaryCard[];
  /** Transaction rows. */
  transactions: LedgerTransaction[];
  /** Optional PDF download handler. */
  onDownloadPdf?: () => void;
  /** Optional Excel download handler. */
  onDownloadExcel?: () => void;
  /** Shows skeleton loading state when true. */
  loading?: boolean;
  /** Shows empty state when true (and not loading). */
  empty?: boolean;
  /** Active locale for title resolution. Default "en". */
  locale?: "en" | "ta";
}

// ── Helpers ────────────────────────────────────────────────────────────────

function SummaryCardVariantClass(variant: LedgerSummaryCard["variant"]) {
  switch (variant) {
    case "positive":
      return "text-green-700";
    case "negative":
      return "text-red-600";
    default:
      return "text-foreground";
  }
}

// ── Component ─────────────────────────────────────────────────────────────

export function LedgerPage({
  title,
  entityType,
  entityId,
  entityOptions,
  onEntityChange,
  summary,
  transactions,
  onDownloadPdf,
  onDownloadExcel,
  loading = false,
  empty = false,
  locale = "en",
}: LedgerPageProps) {
  const resolvedTitle = resolveString(title, locale);
  const entityLabel = entityType === "client" ? "Client" : "Factory";

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{resolvedTitle}</h1>
        <div className="flex items-center gap-2">
          {onDownloadPdf && (
            <Button variant="outline" size="sm" onClick={onDownloadPdf}>
              <Download className="mr-2 h-4 w-4" />
              PDF
            </Button>
          )}
          {onDownloadExcel && (
            <Button variant="outline" size="sm" onClick={onDownloadExcel}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel
            </Button>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground">
          {entityLabel}
        </label>
        <Select value={entityId} onValueChange={onEntityChange}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder={`Select ${entityLabel.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {entityOptions.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                {opt.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(summary.length || 4)].map((_, i) => (
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
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {summary.map((card) => (
            <Card key={card.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={cn(
                    "text-xl font-bold",
                    SummaryCardVariantClass(card.variant),
                  )}
                >
                  {card.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Transaction table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : empty || transactions.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No transactions found for the selected {entityLabel.toLowerCase()}.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx, i) => {
                  const currency = (tx.currency ?? "INR") as Currency;
                  return (
                    <TableRow key={i}>
                      <TableCell className="text-muted-foreground">
                        {tx.date}
                      </TableCell>
                      <TableCell>{tx.description}</TableCell>
                      <TableCell className="text-right text-red-600">
                        {tx.debit != null
                          ? formatCurrency(tx.debit, currency)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right text-green-700">
                        {tx.credit != null
                          ? formatCurrency(tx.credit, currency)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {tx.runningBalance != null
                          ? formatCurrency(tx.runningBalance, currency)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
