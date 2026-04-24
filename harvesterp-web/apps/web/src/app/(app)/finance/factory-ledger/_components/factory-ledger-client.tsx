"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { formatINR } from "@harvesterp/lib";
import {
  LedgerPage,
  type LedgerDateRange,
  type LedgerSummaryCard,
} from "@/components/composed/ledger-page";
import { useBlobDownload } from "@/lib/use-blob-download";
import { FACTORY_LEDGER_COLUMNS } from "./columns";
import type {
  FactoryLedgerResponse,
  FactorySummary,
  LedgerEntry,
} from "./types";

interface FactoryLedgerClientProps {
  initialFactories: FactorySummary[];
}

const DATE_FILTER_TOOLTIP =
  "Date range filters payments only — factory-order debits are always included for the selected factory.";

export function FactoryLedgerClient({
  initialFactories,
}: FactoryLedgerClientProps): React.ReactElement {
  const [selectedFactoryId, setSelectedFactoryId] = React.useState<string>("");
  const [dateRange, setDateRange] = React.useState<LedgerDateRange>({
    from: null,
    to: null,
  });

  const {
    data: ledger,
    isLoading: ledgerLoading,
    error: ledgerError,
  } = useQuery<FactoryLedgerResponse>({
    queryKey: ["factory-ledger", selectedFactoryId, dateRange.from, dateRange.to],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (dateRange.from) params.set("start_date", dateRange.from);
      if (dateRange.to) params.set("end_date", dateRange.to);
      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(
        `/api/finance/factory-ledger/${encodeURIComponent(selectedFactoryId)}${query}`,
        { credentials: "include", signal },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to load ledger (${res.status})`);
      }
      return (await res.json()) as FactoryLedgerResponse;
    },
    enabled: Boolean(selectedFactoryId),
    staleTime: 30_000,
  });

  const blob = useBlobDownload();

  const factoryName =
    ledger?.factory_name ??
    initialFactories.find((f) => f.id === selectedFactoryId)?.company_name ??
    "";

  const ledgerSummary = ledger?.summary;
  const summary: LedgerSummaryCard[] = ledgerSummary
    ? [
        {
          label: "Total Debit",
          value: formatINR(ledgerSummary.total_debit),
          variant: "negative",
          ariaLabel: `${formatINR(ledgerSummary.total_debit)} total debit`,
        },
        {
          label: "Total Credit",
          value: formatINR(ledgerSummary.total_credit),
          variant: "positive",
          ariaLabel: `${formatINR(ledgerSummary.total_credit)} total credit`,
        },
        {
          label: "Net Balance",
          value: formatINR(ledgerSummary.net_balance),
          variant: ledgerSummary.net_balance > 0 ? "warn" : "positive",
          ariaLabel: `${formatINR(ledgerSummary.net_balance)} net balance`,
        },
      ]
    : [];

  const totals: Record<string, React.ReactNode> | undefined = ledgerSummary
    ? {
        debit: formatINR(ledgerSummary.total_debit),
        credit: formatINR(ledgerSummary.total_credit),
        balance: formatINR(ledgerSummary.net_balance),
      }
    : undefined;

  const entityOptions = initialFactories.map((f) => ({
    id: f.id,
    name: f.company_name,
  }));

  async function handleDownload(format: "xlsx" | "pdf") {
    if (!selectedFactoryId) return;
    const params = new URLSearchParams({ format });
    if (dateRange.from) params.set("start_date", dateRange.from);
    if (dateRange.to) params.set("end_date", dateRange.to);
    const url = `/api/finance/factory-ledger/${encodeURIComponent(selectedFactoryId)}/download?${params.toString()}`;
    const filenameBase = factoryName
      ? `factory_ledger_${factoryName.replace(/\s+/g, "_")}`
      : "factory_ledger_statement";
    const filename = `${filenameBase}.${format === "xlsx" ? "xlsx" : "pdf"}`;
    try {
      await blob.download(url, filename);
    } catch {
      // surfaced in LedgerPage's error banner via the combined error below
    }
  }

  const combinedError = blob.error ?? (ledgerError instanceof Error ? ledgerError.message : null);

  return (
    <LedgerPage<LedgerEntry>
      title="Factory Ledger"
      subtitle={selectedFactoryId && factoryName ? factoryName : undefined}
      entityLabel="Factory"
      entityId={selectedFactoryId}
      entityOptions={entityOptions}
      onEntityChange={setSelectedFactoryId}
      summary={summary}
      columns={FACTORY_LEDGER_COLUMNS}
      transactions={ledger?.entries ?? []}
      totals={totals}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      onDownloadPdf={() => handleDownload("pdf")}
      onDownloadExcel={() => handleDownload("xlsx")}
      downloadDisabled={blob.isDownloading}
      dateFilterTooltip={DATE_FILTER_TOOLTIP}
      loading={Boolean(selectedFactoryId) && ledgerLoading}
      error={combinedError}
    />
  );
}
