"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@/components/design-system/icon";
import type { ActiveShipment } from "./types";
import { formatCNY } from "./formatters";
import { StageChip } from "@/components/composed/stage-chip";
import { TableRowsSkeleton } from "./skeletons";
import { EmptyState } from "./empty-state";
import { ErrorCard } from "./error-card";

const REFETCH_INTERVAL_MS = 30_000;

interface ActiveShipmentsResponse {
  shipments: ActiveShipment[];
}

async function fetchActiveShipments(): Promise<ActiveShipment[]> {
  const res = await fetch("/api/dashboard/active-shipments", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Active shipments failed: ${res.status}`);
  }
  const body = (await res.json()) as ActiveShipmentsResponse;
  return Array.isArray(body.shipments) ? body.shipments : [];
}

function Header({
  count,
  live,
}: {
  count: number;
  live?: boolean;
}): React.ReactElement {
  return (
    <header
      style={{
        padding: "16px 24px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: "var(--fg)" }}>
          Active Shipments
        </h2>
        {live && <span className="chip chip-accent">{count} Live</span>}
      </div>
      <Link
        href="/orders"
        className="btn btn-sm btn-ghost"
        style={{ color: "var(--brand-700)" }}
      >
        View All
        <Icon name="arrowRight" size={12} />
      </Link>
    </header>
  );
}

export function ActiveShipmentsSection(): React.ReactElement {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<
    ActiveShipment[],
    Error
  >({
    queryKey: ["dashboard", "active-shipments"],
    queryFn: fetchActiveShipments,
    refetchInterval: REFETCH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

  const shipments = data ?? [];
  const count = shipments.length;

  return (
    <section aria-label="Active shipments" className="card">
      <Header count={count} live={!isError && !isLoading} />

      {isLoading && <TableRowsSkeleton rows={4} />}

      {isError && !isLoading && (
        <ErrorCard
          message="Couldn't load active shipments."
          onRetry={() => void refetch()}
          retryLabel={isFetching ? "Retrying\u2026" : "Retry"}
        />
      )}

      {!isLoading && !isError && count === 0 && (
        <EmptyState
          message="No active shipments."
          ctaLabel="Create a new order"
          ctaHref="/orders/new"
        />
      )}

      {!isLoading && !isError && count > 0 && (
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">Order / PO</th>
              <th scope="col">Factory</th>
              <th scope="col" style={{ textAlign: "right" }}>
                Value
              </th>
              <th scope="col">Status</th>
              <th scope="col" style={{ textAlign: "right" }}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {shipments.map((s) => (
              <tr key={s.id}>
                <td>
                  <div
                    className="mono"
                    style={{ fontWeight: 700, color: "var(--fg)" }}
                  >
                    {s.order_number}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--fg-subtle)" }}>
                    {s.po_reference ?? "\u2014"}
                  </div>
                </td>
                <td style={{ color: "var(--fg-muted)" }}>
                  {s.factory_name ?? "\u2014"}
                </td>
                <td
                  className="mono"
                  style={{ textAlign: "right", color: "var(--fg)" }}
                >
                  {formatCNY(s.total_value_cny)}
                </td>
                <td>
                  <StageChip
                    stageNumber={s.stage_number}
                    stageName={s.stage_name}
                  />
                </td>
                <td style={{ textAlign: "right" }}>
                  <Link
                    href={`/orders/${s.id}`}
                    aria-label={`Open order ${s.order_number}`}
                    className="btn btn-sm btn-ghost"
                  >
                    <Icon name="arrowRight" size={12} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
