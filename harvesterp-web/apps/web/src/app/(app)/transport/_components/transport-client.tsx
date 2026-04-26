"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2, Truck } from "lucide-react";
import {
  canAccess,
  Resource,
  type UserRole,
} from "@harvesterp/lib";
import { Button } from "@/components/primitives/button";
import { Card, CardContent } from "@/components/primitives/card";
import { Input } from "@/components/primitives/input";
import { Skeleton } from "@/components/primitives/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/primitives/table";
import { DeleteConfirmDialog } from "@/components/composed/delete-confirm-dialog";
import { Pagination } from "@/components/composed/pagination";
import { TRANSPORT_COLUMNS, hideBelowClass } from "./columns";
import { TransportMobileCard } from "./transport-mobile-card";
import type {
  TransporterListItem,
  TransportListResponse,
} from "./types";

const PER_PAGE_OPTIONS = [25, 50, 100] as const;
const SEARCH_DEBOUNCE_MS = 400;
const DEFAULT_PER_PAGE = 50;

interface TransportClientProps {
  initialData: TransportListResponse;
  role: UserRole | undefined;
}

export function TransportClient({
  initialData,
  role,
}: TransportClientProps): React.ReactElement {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(DEFAULT_PER_PAGE);
  const [deleteTarget, setDeleteTarget] =
    React.useState<TransporterListItem | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // Debounce search → reset to page 1.
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const canCreate = role ? canAccess(role, Resource.TRANSPORT_CREATE) : false;
  const canEdit = role ? canAccess(role, Resource.TRANSPORT_UPDATE) : false;
  const canDelete = role ? canAccess(role, Resource.TRANSPORT_DELETE) : false;

  const isInitialKey =
    page === 1 && perPage === DEFAULT_PER_PAGE && debouncedSearch.length === 0;

  const queryResult = useQuery<TransportListResponse, Error>({
    queryKey: ["transport-list", page, perPage, debouncedSearch],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", String(perPage));
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/transport?${params.toString()}`, {
        credentials: "include",
        signal,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(
          body.error ?? `Failed to load transporters (${res.status})`,
        );
      }
      return (await res.json()) as TransportListResponse;
    },
    ...(isInitialKey ? { initialData } : {}),
    staleTime: 30_000,
  });
  const { data, isLoading, isFetching, error, refetch } = queryResult;

  const providers = data?.items ?? [];
  const total = data?.total ?? 0;
  const isEmpty = !isLoading && providers.length === 0;
  const hasSearch = debouncedSearch.length > 0;

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(
        `/api/transport/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Delete failed");
      }
      setDeleteTarget(null);
      await refetch();
    } catch (err) {
      // Bug 1 fix: surface delete errors instead of swallowing.
      setDeleteError(
        err instanceof Error ? err.message : "Delete failed — try again",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function handleCloseDeleteDialog() {
    setDeleteTarget(null);
    setDeleteError(null);
  }

  function clearSearch() {
    setSearch("");
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            Service Providers
          </h1>
          <p className="text-sm text-slate-500">
            {total} {total === 1 ? "provider" : "providers"}
          </p>
        </div>
        {canCreate ? (
          <Link href="/transport/new">
            <Button size="sm">
              <Plus size={14} />
              Add provider
            </Button>
          </Link>
        ) : null}
      </header>

      {/* Search bar */}
      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, contact, city…"
              aria-label="Search providers by name, contact, or city"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Bug 1 fix: surface load errors via banner with retry */}
      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{error.message}</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-md border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* Table / cards */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isEmpty ? (
            <TransportEmptyState
              hasSearch={hasSearch}
              canCreate={canCreate}
              onClearSearch={clearSearch}
            />
          ) : (
            <>
              {/* Mobile cards (< md) */}
              <div className="space-y-3 p-3 md:hidden">
                {providers.map((p) => (
                  <TransportMobileCard
                    key={p.id}
                    provider={p}
                    role={role}
                    onDelete={(provider) => setDeleteTarget(provider)}
                  />
                ))}
              </div>

              {/* Desktop table (>= md) */}
              <div className="hidden md:block">
                <Table>
                  <caption className="sr-only">Service providers</caption>
                  <TableHeader>
                    <TableRow>
                      {TRANSPORT_COLUMNS.map((col) => (
                        <TableHead key={col.id} className={hideBelowClass(col)}>
                          {col.header}
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providers.map((p) => (
                      <TableRow key={p.id}>
                        {TRANSPORT_COLUMNS.map((col) => (
                          <TableCell
                            key={col.id}
                            className={hideBelowClass(col)}
                          >
                            {col.cell(p)}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Bug 2 fix: role-gate Edit + Delete buttons */}
                            {canEdit ? (
                              <Link
                                href={`/transport/${p.id}/edit`}
                                aria-label={`Edit ${p.name}`}
                                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                              >
                                <Pencil size={14} />
                              </Link>
                            ) : null}
                            {canDelete ? (
                              <button
                                type="button"
                                aria-label={`Delete ${p.name}`}
                                onClick={() => setDeleteTarget(p)}
                                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 size={14} />
                              </button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Pagination
                page={page}
                perPage={perPage}
                total={total}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => p + 1)}
                onPerPageChange={(n) => {
                  setPerPage(n);
                  setPage(1);
                }}
                perPageOptions={PER_PAGE_OPTIONS}
                label="Transporters pagination"
              />
            </>
          )}
        </CardContent>
      </Card>

      {isFetching && !isLoading ? (
        <div className="text-xs text-slate-400">Updating…</div>
      ) : null}

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        title={`Delete ${deleteTarget?.name ?? "provider"}?`}
        body={
          deleteError
            ? `${deleteError}. The provider has not been deleted.`
            : "This will soft-delete the service provider. Their record can be restored by an administrator."
        }
        isPending={isDeleting}
      />
    </div>
  );
}

interface TransportEmptyStateProps {
  hasSearch: boolean;
  canCreate: boolean;
  onClearSearch: () => void;
}

function TransportEmptyState({
  hasSearch,
  canCreate,
  onClearSearch,
}: TransportEmptyStateProps): React.ReactElement {
  if (hasSearch) {
    // Pattern B (CONVENTIONS Section 10) — filtered empty state.
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <Truck size={32} className="text-slate-300" aria-hidden="true" />
        <p className="text-sm text-slate-500">
          No providers match this search
        </p>
        <button
          type="button"
          onClick={onClearSearch}
          className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
        >
          Clear search
        </button>
      </div>
    );
  }
  // Pattern A — fresh empty state (the resource has never had rows).
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Truck size={32} className="text-slate-300" aria-hidden="true" />
      <p className="text-sm text-slate-500">No service providers yet</p>
      <p className="text-xs text-slate-400">
        Add your first provider to get started.
      </p>
      {canCreate ? (
        <Link href="/transport/new">
          <Button size="sm" variant="outline">
            <Plus size={14} />
            Add your first provider
          </Button>
        </Link>
      ) : null}
    </div>
  );
}
