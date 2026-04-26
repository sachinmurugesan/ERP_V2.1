"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
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
import { CLIENT_COLUMNS, hideBelowClass } from "./columns";
import { ClientMobileCard } from "./client-mobile-card";
import type {
  ClientListItem,
  ClientsListResponse,
} from "./types";

const PER_PAGE_OPTIONS = [25, 50, 100] as const;
const SEARCH_DEBOUNCE_MS = 400;

interface ClientsClientProps {
  initialData: ClientsListResponse;
  role: UserRole | undefined;
}

export function ClientsClient({
  initialData,
  role,
}: ClientsClientProps): React.ReactElement {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(50);
  const [deleteTarget, setDeleteTarget] = React.useState<ClientListItem | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Debounce search → reset to page 1 + refetch.
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const canCreate = role ? canAccess(role, Resource.CLIENT_CREATE) : false;
  const canEdit = role ? canAccess(role, Resource.CLIENT_UPDATE) : false;
  const canDelete = role ? canAccess(role, Resource.CLIENT_DELETE) : false;

  // Use the RSC-fetched data only when the user is on the default key
  // (page 1, perPage 50, no search). Once any of those change, the
  // query refetches with the new key.
  const isInitialKey =
    page === 1 && perPage === 50 && debouncedSearch.length === 0;

  const queryResult = useQuery<ClientsListResponse, Error>({
    queryKey: ["clients-list", page, perPage, debouncedSearch],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", String(perPage));
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/clients?${params.toString()}`, {
        credentials: "include",
        signal,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to load clients (${res.status})`);
      }
      return (await res.json()) as ClientsListResponse;
    },
    ...(isInitialKey ? { initialData } : {}),
    staleTime: 30_000,
  });
  const { data, isLoading, isFetching, error, refetch } = queryResult;

  const clients = data?.items ?? [];
  const total = data?.total ?? 0;
  const isEmpty = !isLoading && clients.length === 0;
  const hasSearch = debouncedSearch.length > 0;

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/clients/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Delete failed");
      }
      setDeleteTarget(null);
      await refetch();
    } catch (err) {
      console.error(err);
      // Keep dialog open + show no-op (errors fall through to user via thrown)
    } finally {
      setIsDeleting(false);
    }
  }

  function clearSearch() {
    setSearch("");
  }

  return (
    <div className="space-y-4">
      {/* Page header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Clients</h1>
          <p className="text-sm text-slate-500">
            {total} {total === 1 ? "client" : "clients"}
          </p>
        </div>
        {canCreate ? (
          <Link href="/clients/new">
            <Button size="sm">
              <Plus size={14} />
              Add client
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
              placeholder="Search by company name, GSTIN, city, contact…"
              aria-label="Search clients"
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Error banner */}
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
            <ClientsEmptyState
              hasSearch={hasSearch}
              canCreate={canCreate}
              onClearSearch={clearSearch}
            />
          ) : (
            <>
              {/* Mobile cards (< md) */}
              <div className="space-y-3 p-3 md:hidden">
                {clients.map((c) => (
                  <ClientMobileCard
                    key={c.id}
                    client={c}
                    role={role}
                    onDelete={(client) => setDeleteTarget(client)}
                  />
                ))}
              </div>

              {/* Desktop table (>= md) */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {CLIENT_COLUMNS.map((col) => (
                        <TableHead key={col.id} className={hideBelowClass(col)}>
                          {col.header}
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((c) => (
                      <TableRow key={c.id}>
                        {CLIENT_COLUMNS.map((col) => (
                          <TableCell key={col.id} className={hideBelowClass(col)}>
                            {col.cell(c)}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canEdit ? (
                              <Link
                                href={`/clients/${c.id}/edit`}
                                aria-label={`Edit ${c.company_name}`}
                                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                              >
                                <Pencil size={14} />
                              </Link>
                            ) : null}
                            {canDelete ? (
                              <button
                                type="button"
                                aria-label={`Delete ${c.company_name}`}
                                onClick={() => setDeleteTarget(c)}
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
                label="Clients pagination"
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Subtle "refreshing" hint when refetching after a search/page change */}
      {isFetching && !isLoading ? (
        <div className="text-xs text-slate-400">Updating…</div>
      ) : null}

      {/* Delete confirmation */}
      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={`Delete ${deleteTarget?.company_name ?? "client"}?`}
        body="This will soft-delete the client. Their order history is preserved and the record can be restored by an administrator."
        isPending={isDeleting}
      />
    </div>
  );
}

interface ClientsEmptyStateProps {
  hasSearch: boolean;
  canCreate: boolean;
  onClearSearch: () => void;
}

function ClientsEmptyState({
  hasSearch,
  canCreate,
  onClearSearch,
}: ClientsEmptyStateProps): React.ReactElement {
  if (hasSearch) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <Users size={32} className="text-slate-300" aria-hidden="true" />
        <p className="text-sm text-slate-500">No clients match this search</p>
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
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <Users size={32} className="text-slate-300" aria-hidden="true" />
      <p className="text-sm text-slate-500">No clients yet</p>
      <p className="text-xs text-slate-400">
        Add your first client to get started.
      </p>
      {canCreate ? (
        <Link href="/clients/new">
          <Button size="sm" variant="outline">
            <Plus size={14} />
            Add client
          </Button>
        </Link>
      ) : null}
    </div>
  );
}
