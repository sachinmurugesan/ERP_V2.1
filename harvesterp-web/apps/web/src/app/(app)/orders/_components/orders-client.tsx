"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@/components/design-system/icon";
import type {
  OrderListItem,
  OrderListResponse,
  StatusCountsRaw,
  StageGroupCounts,
} from "./types";
import {
  STAGE_GROUPS,
  groupCounts,
  statusQueryFor,
  type StageGroupId,
} from "./stage-groups";
import { FilterTabs } from "./filter-tabs";
import { OrdersTable } from "./orders-table";
import { OrderRowsSkeleton } from "./skeletons";
import { FreshEmptyState, FilteredEmptyState } from "./empty-state";
import { OrdersErrorCard } from "./error-card";
import { OrdersPagination } from "./pagination";
import { DeleteOrderDialog } from "./delete-order-dialog";

const PER_PAGE = 25;
const SEARCH_DEBOUNCE_MS = 400;
const COUNTS_REFETCH_MS = 60_000;

export interface OrdersClientProps {
  canDelete: boolean;
  canCreate: boolean;
}

async function fetchOrders(params: {
  page: number;
  search: string;
  status: string | undefined;
}): Promise<OrderListResponse> {
  const query = new URLSearchParams();
  query.set("page", String(params.page));
  query.set("per_page", String(PER_PAGE));
  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  const res = await fetch(`/api/orders?${query.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Orders list failed: ${res.status}`);
  return (await res.json()) as OrderListResponse;
}

async function fetchStatusCounts(): Promise<StatusCountsRaw> {
  const res = await fetch("/api/orders/status-counts", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Status counts failed: ${res.status}`);
  const body = (await res.json()) as { counts: StatusCountsRaw };
  return body.counts ?? {};
}

async function deleteOrder(id: string, reason: string): Promise<void> {
  const res = await fetch(`/api/orders/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    let message = `Delete failed: ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // leave default
    }
    throw new Error(message);
  }
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function OrdersClient({
  canDelete,
  canCreate,
}: OrdersClientProps): React.ReactElement {
  const queryClient = useQueryClient();
  const [activeGroupId, setActiveGroupIdRaw] =
    React.useState<StageGroupId>("all");
  const [searchInput, setSearchInputRaw] = React.useState("");
  const search = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
  const [page, setPage] = React.useState(1);
  const [pendingDelete, setPendingDelete] =
    React.useState<OrderListItem | null>(null);

  const activeGroup = React.useMemo(
    () => STAGE_GROUPS.find((g) => g.id === activeGroupId) ?? STAGE_GROUPS[0]!,
    [activeGroupId],
  );

  /** Filter changes always reset to page 1 — side-effect lives on the action,
   *  not in a post-hoc useEffect, to satisfy react-hooks/set-state-in-effect. */
  const setActiveGroupId = (id: StageGroupId): void => {
    setActiveGroupIdRaw(id);
    setPage(1);
  };
  const setSearchInput = (value: string): void => {
    setSearchInputRaw(value);
    setPage(1);
  };

  const statusQuery = statusQueryFor(activeGroup);

  const listQuery = useQuery<OrderListResponse, Error>({
    queryKey: ["orders", "list", { page, search, status: statusQuery ?? "" }],
    queryFn: () => fetchOrders({ page, search, status: statusQuery }),
  });

  const countsQuery = useQuery<StatusCountsRaw, Error>({
    queryKey: ["orders", "status-counts"],
    queryFn: fetchStatusCounts,
    refetchInterval: COUNTS_REFETCH_MS,
  });

  const orders = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const isFiltered = search.length > 0 || statusQuery !== undefined;

  const groupedCounts: StageGroupCounts = React.useMemo(() => {
    const counts = groupCounts(countsQuery.data ?? null);
    // "all" count comes from the list-endpoint total, not the status-counts sum,
    // so we always show an accurate total even when a filter is active.
    counts.all = activeGroupId === "all" ? total : sumAllCounts(counts);
    return counts;
  }, [countsQuery.data, activeGroupId, total]);

  const handleDelete = async (reason: string): Promise<void> => {
    if (!pendingDelete) return;
    await deleteOrder(pendingDelete.id, reason);
    setPendingDelete(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["orders", "list"] }),
      queryClient.invalidateQueries({ queryKey: ["orders", "status-counts"] }),
    ]);
  };

  const clearFilters = (): void => {
    setActiveGroupId("all");
    setSearchInput("");
  };

  const showSkeleton = listQuery.isLoading && orders.length === 0;
  const showFreshEmpty =
    !listQuery.isLoading && !listQuery.isError && total === 0 && !isFiltered;
  const showFilteredEmpty =
    !listQuery.isLoading &&
    !listQuery.isError &&
    orders.length === 0 &&
    isFiltered;
  const showError = listQuery.isError && orders.length === 0;

  return (
    <>
      <section
        aria-label="Orders list"
        className="card"
        style={{ padding: 0, overflow: "hidden" }}
      >
        <FilterTabs
          activeId={activeGroupId}
          counts={groupedCounts}
          loading={countsQuery.isLoading}
          onSelect={setActiveGroupId}
        />

        <div
          style={{
            padding: "12px 18px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              flex: "1 1 280px",
              maxWidth: 520,
            }}
          >
            <span className="sr-only-no-class" style={{ display: "none" }}>
              Search orders
            </span>
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                left: 10,
                color: "var(--fg-subtle)",
                display: "inline-flex",
              }}
            >
              <Icon name="search" size={14} />
            </span>
            <input
              type="search"
              aria-label="Search orders by order number or PO reference"
              placeholder="Search by order number or PO reference…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="input"
              style={{ paddingLeft: 32 }}
            />
          </label>
          {isFiltered && (
            <button
              type="button"
              onClick={clearFilters}
              className="btn btn-sm btn-ghost"
            >
              <Icon name="close" size={13} />
              Clear filters
            </button>
          )}
        </div>

        {showSkeleton && <OrderRowsSkeleton rows={8} />}

        {showError && (
          <OrdersErrorCard
            message="Couldn't load orders."
            onRetry={() => void listQuery.refetch()}
            retryLabel={listQuery.isFetching ? "Retrying\u2026" : "Retry"}
          />
        )}

        {showFreshEmpty && <FreshEmptyState canCreate={canCreate} />}

        {showFilteredEmpty && <FilteredEmptyState onClear={clearFilters} />}

        {!showSkeleton && !showError && orders.length > 0 && (
          <OrdersTable
            orders={orders}
            canDelete={canDelete}
            onRequestDelete={(order) => setPendingDelete(order)}
          />
        )}

        <OrdersPagination
          page={page}
          perPage={PER_PAGE}
          total={total}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
        />
      </section>

      <DeleteOrderDialog
        open={pendingDelete !== null}
        orderNumber={pendingDelete?.order_number ?? pendingDelete?.id ?? ""}
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </>
  );
}

function sumAllCounts(counts: StageGroupCounts): number {
  return (
    counts.draft +
    counts.pricing +
    counts.payment +
    counts.production +
    counts.shipping +
    counts.customs +
    counts.delivered +
    counts.completed
  );
}
