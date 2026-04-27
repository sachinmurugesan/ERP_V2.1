"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { type UserRole, Resource } from "@harvesterp/lib";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/primitives/card";
import { Button } from "@/components/primitives/button";
import { Skeleton } from "@/components/primitives/skeleton";
import { Select } from "@/components/primitives/select";
import { Label } from "@/components/primitives/label";
import { RoleGate } from "@/components/composed/role-gate";
import { DeleteConfirmDialog } from "@/components/composed/delete-confirm-dialog";
import { HighlightScrollTarget } from "@/components/composed/highlight-scroll-target";

import * as Dialog from "@radix-ui/react-dialog";
import {
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  MessageCircle,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";

import type { OrderDetail } from "../types";
import type {
  OrderQuery,
  OrderQueryStatus,
  OrderQueryType,
} from "@/app/api/orders/[id]/queries/route";

/**
 * <OrderQueriesTab> — Tier 1 migration of QueriesTab.vue (1019 LOC).
 *
 * Tier 1 scope (this PR):
 *   - List queries with filter pills + search + sort
 *   - 4 KPI cards (Total / Open / Replied / Resolved)
 *   - Inline-expand query cards with thread + reply form
 *   - Create new query (modal)
 *   - Reply (text-only — attachments deferred to Tier 2)
 *   - Resolve / Reopen / Delete (DELETE role-gated to QUERY_DELETE)
 *   - ?query={id} deep-link → auto-expand + scroll-highlight
 *   - Notification mark-read-on-mount via /api/notifications/
 *     mark-read-by-resource proxy
 *
 * Tier 2 deferred (separate PR):
 *   - Reply with file attachment (multipart) + image lightbox + video
 *     player
 *   - Bulk select + bulk resolve
 *   - CSV export
 *   - Analytics panel (3 charts)
 *   - Polling refresh (TanStack staleTime/refetchInterval — easy add)
 */

type FilterStatus = "all" | OrderQueryStatus;
type SortBy = "newest" | "oldest" | "activity";

const QUERY_TYPE_LABELS: Record<OrderQueryType, string> = {
  PHOTO_REQUEST: "Photo Request",
  VIDEO_REQUEST: "Video Request",
  DIMENSION_CHECK: "Dimensions",
  QUALITY_QUERY: "Quality",
  ALTERNATIVE: "Alternative",
  GENERAL: "General",
};

const REMARK_PRESETS: Record<OrderQueryType, string> = {
  PHOTO_REQUEST: "Correct photo provided",
  VIDEO_REQUEST: "Video provided",
  DIMENSION_CHECK: "Dimension confirmed: ",
  QUALITY_QUERY: "Quality confirmed — ",
  ALTERNATIVE: "Alternative: ",
  GENERAL: "",
};

const SEARCH_DEBOUNCE_MS = 400;

interface OrderQueriesTabProps {
  orderId: string;
  order: OrderDetail;
  role: UserRole | undefined;
  /** From `?query={id}` — auto-expands the matching query on mount. */
  highlightSection?: string | null;
}

export function OrderQueriesTab({
  orderId,
  order,
  role,
  highlightSection,
}: OrderQueriesTabProps): React.ReactElement {
  const queryClient = useQueryClient();
  const user = role ? { role } : null;

  const queriesQuery = useQuery<OrderQuery[], Error>({
    queryKey: ["order-queries", orderId],
    queryFn: async ({ signal }) => {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/queries`,
        { signal },
      );
      if (!res.ok) throw new Error(`Failed to load queries (${res.status})`);
      return (await res.json()) as OrderQuery[];
    },
    staleTime: 30_000,
  });

  // Mark notifications read on mount (best-effort — the topbar bell
  // will reconcile via its own polling if this fails).
  const markedRead = React.useRef(false);
  React.useEffect(() => {
    if (markedRead.current) return;
    markedRead.current = true;
    void fetch("/api/notifications/mark-read-by-resource", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource_type: "order",
        resource_id: orderId,
        notification_type: "ITEM_QUERY_REPLY",
      }),
    }).catch(() => {});
    void fetch("/api/notifications/mark-read-by-resource", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource_type: "order",
        resource_id: orderId,
        notification_type: "ITEM_QUERY_CREATED",
      }),
    }).catch(() => {});
  }, [orderId]);

  // ── Filters ───────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = React.useState<FilterStatus>("all");
  const [searchInput, setSearchInput] = React.useState("");
  const [search, setSearch] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);
  const [sortBy, setSortBy] = React.useState<SortBy>("newest");

  // ── Modals / dialogs ──────────────────────────────────────────────
  const [newQueryOpen, setNewQueryOpen] = React.useState(false);
  const [resolveTarget, setResolveTarget] = React.useState<OrderQuery | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<OrderQuery | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // ── Expand state ──────────────────────────────────────────────────
  // Auto-expand the deep-linked query once data arrives. This is the
  // React canonical "derived state from changing props" pattern using
  // a tracker state (prevHighlight). We branch on (a) the URL prop
  // changed since last render, AND (b) the matching query is now in
  // the data — both conditions can become true on different renders
  // depending on whether the URL changed before or after the fetch
  // resolved, which is why we can't replace this with a simple
  // useState initializer.
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [appliedHighlight, setAppliedHighlight] = React.useState<string | null>(
    null,
  );
  if (
    highlightSection &&
    highlightSection !== appliedHighlight &&
    queriesQuery.data?.some((q) => q.id === highlightSection)
  ) {
    // Both inputs have stabilized — the deep-linked query is now visible.
    // Apply once (the appliedHighlight setter prevents loops).
    setAppliedHighlight(highlightSection);
    setExpandedId(highlightSection);
  }

  function refresh(): void {
    void queryClient.invalidateQueries({
      queryKey: ["order-queries", orderId],
    });
  }

  async function handleDelete(): Promise<void> {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/queries/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Delete failed");
      }
      setDeleteTarget(null);
      if (expandedId === deleteTarget.id) setExpandedId(null);
      refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  // ── Derived data ──────────────────────────────────────────────────
  // Wrap the empty-fallback in useMemo so child useMemos don't see a
  // fresh `[]` reference on every render (lint exhaustive-deps).
  const queries = React.useMemo(
    () => queriesQuery.data ?? [],
    [queriesQuery.data],
  );

  const counts = React.useMemo(() => {
    let open = 0;
    let replied = 0;
    let resolved = 0;
    for (const q of queries) {
      if (q.status === "OPEN") open += 1;
      else if (q.status === "REPLIED") replied += 1;
      else if (q.status === "RESOLVED") resolved += 1;
    }
    return { total: queries.length, open, replied, resolved };
  }, [queries]);

  const filtered = React.useMemo(() => {
    let result = queries;
    if (filterStatus !== "all") {
      result = result.filter((q) => q.status === filterStatus);
    }
    if (search) {
      result = result.filter((q) => {
        if (q.subject.toLowerCase().includes(search)) return true;
        if (q.product_code?.toLowerCase().includes(search)) return true;
        if (q.product_name?.toLowerCase().includes(search)) return true;
        return q.messages.some((m) => m.message.toLowerCase().includes(search));
      });
    }
    const sorted = [...result];
    if (sortBy === "newest") {
      sorted.sort((a, b) => {
        const aT = new Date(a.last_message_at ?? a.created_at ?? 0).getTime();
        const bT = new Date(b.last_message_at ?? b.created_at ?? 0).getTime();
        return bT - aT;
      });
    } else if (sortBy === "oldest") {
      sorted.sort((a, b) => {
        const aT = new Date(a.created_at ?? 0).getTime();
        const bT = new Date(b.created_at ?? 0).getTime();
        return aT - bT;
      });
    } else {
      sorted.sort((a, b) => b.message_count - a.message_count);
    }
    return sorted;
  }, [queries, filterStatus, search, sortBy]);

  const hasActiveFilter = filterStatus !== "all" || search.length > 0;

  return (
    <div className="space-y-3" data-testid="order-queries-tab">
      <KpiCards counts={counts} />

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle
              size={16}
              aria-hidden="true"
              className="text-indigo-600"
            />
            Queries{counts.total > 0 ? ` (${counts.total})` : ""}
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setNewQueryOpen(true)}
            data-testid="queries-new-button"
          >
            <MessageCircle size={14} className="mr-1.5" aria-hidden="true" />
            Ask a question
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterPills
              counts={counts}
              value={filterStatus}
              onChange={setFilterStatus}
            />
            <div className="ml-auto flex items-center gap-2">
              <SortSelect value={sortBy} onChange={setSortBy} />
            </div>
          </div>
          <SearchInput value={searchInput} onChange={setSearchInput} />

          {queriesQuery.isPending ? <ListSkeleton /> : null}
          {queriesQuery.isError ? (
            <ListError onRetry={() => queriesQuery.refetch()} />
          ) : null}

          {queriesQuery.isSuccess && filtered.length === 0 ? (
            <EmptyState
              hasActiveFilter={hasActiveFilter}
              onClear={() => {
                setFilterStatus("all");
                setSearchInput("");
              }}
              onCreate={() => setNewQueryOpen(true)}
            />
          ) : null}

          {queriesQuery.isSuccess && filtered.length > 0 ? (
            <div className="space-y-2" data-testid="queries-list">
              {filtered.map((q) => (
                <HighlightScrollTarget
                  key={q.id}
                  id={q.id}
                  currentHash={highlightSection ?? undefined}
                >
                  <QueryCard
                    query={q}
                    expanded={expandedId === q.id}
                    onToggle={() =>
                      setExpandedId((prev) => (prev === q.id ? null : q.id))
                    }
                    user={user}
                    onResolve={(query) => setResolveTarget(query)}
                    onReopen={async (query) => {
                      try {
                        await fetch(
                          `/api/orders/${encodeURIComponent(orderId)}/queries/${encodeURIComponent(query.id)}/reopen`,
                          { method: "PUT" },
                        );
                        refresh();
                      } catch {
                        // refresh will surface stale state
                      }
                    }}
                    onDelete={(query) => {
                      setDeleteError(null);
                      setDeleteTarget(query);
                    }}
                    onReplied={refresh}
                    orderId={orderId}
                  />
                </HighlightScrollTarget>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <NewQueryModal
        open={newQueryOpen}
        orderId={orderId}
        orderNumber={order.order_number}
        onClose={() => setNewQueryOpen(false)}
        onCreated={() => {
          setNewQueryOpen(false);
          refresh();
        }}
      />

      <ResolveQueryModal
        target={resolveTarget}
        orderId={orderId}
        onClose={() => setResolveTarget(null)}
        onResolved={() => {
          setResolveTarget(null);
          refresh();
        }}
      />

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={handleDelete}
        title="Delete query?"
        body={
          deleteTarget
            ? `Delete “${deleteTarget.subject}” and all its messages? This cannot be undone.`
            : ""
        }
        isPending={deleting}
      />

      {deleteError ? (
        <p
          className="text-sm text-red-700"
          role="alert"
          data-testid="queries-delete-error"
        >
          Delete failed: {deleteError}
        </p>
      ) : null}
    </div>
  );
}

// ── KPI cards ────────────────────────────────────────────────────────────────

function KpiCards({
  counts,
}: {
  counts: { total: number; open: number; replied: number; resolved: number };
}): React.ReactElement {
  return (
    <div
      className="grid grid-cols-2 gap-3 md:grid-cols-4"
      data-testid="queries-kpis"
    >
      <KpiCard label="Total" value={counts.total} accent="slate" />
      <KpiCard
        label="Open"
        value={counts.open}
        accent="amber"
        testId="queries-kpi-open"
      />
      <KpiCard
        label="Replied"
        value={counts.replied}
        accent="blue"
        testId="queries-kpi-replied"
      />
      <KpiCard
        label="Resolved"
        value={counts.resolved}
        accent="emerald"
        testId="queries-kpi-resolved"
      />
    </div>
  );
}

const ACCENT_BORDER: Record<string, string> = {
  slate: "border-l-slate-400",
  amber: "border-l-amber-400",
  blue: "border-l-blue-400",
  emerald: "border-l-emerald-400",
};

function KpiCard({
  label,
  value,
  accent,
  testId,
}: {
  label: string;
  value: number;
  accent: keyof typeof ACCENT_BORDER;
  testId?: string;
}): React.ReactElement {
  return (
    <div
      className={`rounded-xl border-l-4 ${ACCENT_BORDER[accent]} border-y border-r border-slate-200 bg-white p-4 shadow-sm`}
      data-testid={testId}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

// ── Filter pills + sort + search ─────────────────────────────────────────────

function FilterPills({
  counts,
  value,
  onChange,
}: {
  counts: { total: number; open: number; replied: number; resolved: number };
  value: FilterStatus;
  onChange: (next: FilterStatus) => void;
}): React.ReactElement {
  const items: Array<{ key: FilterStatus; label: string; count: number }> = [
    { key: "all", label: "All", count: counts.total },
    { key: "OPEN", label: "Open", count: counts.open },
    { key: "REPLIED", label: "Replied", count: counts.replied },
    { key: "RESOLVED", label: "Resolved", count: counts.resolved },
  ];
  return (
    <div className="flex items-center gap-1.5" data-testid="queries-filter-pills">
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            data-testid={`queries-filter-${it.key.toLowerCase()}`}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {it.label}{" "}
            <span className={active ? "opacity-80" : "opacity-60"}>
              ({it.count})
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SortSelect({
  value,
  onChange,
}: {
  value: SortBy;
  onChange: (next: SortBy) => void;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor="queries-sort" className="text-xs text-slate-500">
        Sort
      </Label>
      <Select
        id="queries-sort"
        className="h-8 w-32 text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value as SortBy)}
        data-testid="queries-sort-select"
      >
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="activity">Most active</option>
      </Select>
    </div>
  );
}

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}): React.ReactElement {
  return (
    <div className="relative">
      <Search
        size={14}
        aria-hidden="true"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search subject, product, or message body..."
        className="w-full rounded-md border border-slate-200 bg-transparent py-2 pl-9 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        data-testid="queries-search-input"
      />
    </div>
  );
}

// ── Query card ───────────────────────────────────────────────────────────────

function QueryCard({
  query,
  expanded,
  onToggle,
  user,
  orderId,
  onResolve,
  onReopen,
  onDelete,
  onReplied,
}: {
  query: OrderQuery;
  expanded: boolean;
  onToggle: () => void;
  user: { role: UserRole } | null;
  orderId: string;
  onResolve: (query: OrderQuery) => void;
  onReopen: (query: OrderQuery) => void | Promise<void>;
  onDelete: (query: OrderQuery) => void;
  onReplied: () => void;
}): React.ReactElement {
  return (
    <div
      className="rounded-lg border border-slate-200 bg-white p-3"
      data-testid={`query-card-${query.id}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 text-left"
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-start gap-2">
          {expanded ? (
            <ChevronDown
              size={16}
              aria-hidden="true"
              className="mt-0.5 text-slate-500"
            />
          ) : (
            <ChevronRight
              size={16}
              aria-hidden="true"
              className="mt-0.5 text-slate-500"
            />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">
              {query.subject}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {QUERY_TYPE_LABELS[query.query_type] ?? query.query_type} ·{" "}
              {query.message_count}{" "}
              {query.message_count === 1 ? "message" : "messages"} ·{" "}
              {formatRelative(query.last_message_at ?? query.created_at)}
            </p>
          </div>
        </div>
        <StatusChip status={query.status} />
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <Thread query={query} />
          <ReplyForm
            orderId={orderId}
            queryId={query.id}
            onReplied={onReplied}
          />
          <div className="flex flex-wrap items-center gap-2">
            {query.status !== "RESOLVED" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onResolve(query)}
                data-testid={`query-resolve-${query.id}`}
              >
                <CheckCircle
                  size={14}
                  aria-hidden="true"
                  className="mr-1.5 text-emerald-600"
                />
                Resolve
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReopen(query)}
                data-testid={`query-reopen-${query.id}`}
              >
                <RotateCcw size={14} aria-hidden="true" className="mr-1.5" />
                Reopen
              </Button>
            )}
            <RoleGate
              user={user}
              permission={Resource.QUERY_DELETE}
              fallback={null}
            >
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelete(query)}
                aria-label={`Delete query ${query.subject}`}
                data-testid={`query-delete-${query.id}`}
              >
                <Trash2
                  size={14}
                  aria-hidden="true"
                  className="text-red-600"
                />
              </Button>
            </RoleGate>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusChip({
  status,
}: {
  status: OrderQueryStatus;
}): React.ReactElement {
  const tone =
    status === "OPEN"
      ? "chip chip-warn"
      : status === "REPLIED"
        ? "chip chip-info"
        : "chip chip-ok";
  return (
    <span className={tone} aria-label={`Status: ${status}`}>
      {status}
    </span>
  );
}

function Thread({ query }: { query: OrderQuery }): React.ReactElement {
  return (
    <div
      className="space-y-2"
      data-testid={`query-thread-${query.id}`}
    >
      {query.messages.map((m) => (
        <div
          key={m.id}
          className="rounded-md bg-slate-50 p-2.5"
          data-testid={`query-message-${m.id}`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-700">{m.sender_name}</span>
            <span className="text-slate-500">
              {m.sender_role} · {formatRelative(m.created_at)}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
            {m.message}
          </p>
        </div>
      ))}
    </div>
  );
}

function ReplyForm({
  orderId,
  queryId,
  onReplied,
}: {
  orderId: string;
  queryId: string;
  onReplied: () => void;
}): React.ReactElement {
  const [text, setText] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const canSend = text.trim().length > 0 && !sending;

  async function send(): Promise<void> {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/queries/${encodeURIComponent(queryId)}/replies`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text.trim() }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Reply failed");
      }
      setText("");
      onReplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reply failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="space-y-2 rounded-md border border-slate-200 bg-white p-2.5"
      data-testid={`query-reply-form-${queryId}`}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a reply..."
        rows={2}
        disabled={sending}
        className="w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        data-testid={`query-reply-textarea-${queryId}`}
      />
      {error ? (
        <p
          className="text-xs text-red-700"
          role="alert"
          data-testid={`query-reply-error-${queryId}`}
        >
          {error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={send}
          disabled={!canSend}
          data-testid={`query-reply-send-${queryId}`}
        >
          {sending ? (
            <>
              <Loader2 size={14} className="mr-1.5 animate-spin" aria-hidden="true" />
              Sending...
            </>
          ) : (
            "Send reply"
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Empty / loading / error ──────────────────────────────────────────────────

function EmptyState({
  hasActiveFilter,
  onClear,
  onCreate,
}: {
  hasActiveFilter: boolean;
  onClear: () => void;
  onCreate: () => void;
}): React.ReactElement {
  if (hasActiveFilter) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 py-10 text-center"
        data-testid="queries-empty-filtered"
      >
        <p className="text-sm font-medium text-slate-600">
          No queries match this filter.
        </p>
        <Button variant="outline" size="sm" onClick={onClear}>
          Clear filters
        </Button>
      </div>
    );
  }
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-10 text-center"
      data-testid="queries-empty-state"
    >
      <MessageCircle
        size={32}
        aria-hidden="true"
        className="text-slate-300"
      />
      <p className="text-sm font-medium text-slate-600">
        No queries on this order yet.
      </p>
      <Button onClick={onCreate} data-testid="queries-empty-cta">
        <MessageCircle size={14} className="mr-1.5" aria-hidden="true" />
        Ask the first question
      </Button>
    </div>
  );
}

function ListSkeleton(): React.ReactElement {
  return (
    <div className="space-y-2" data-testid="queries-skeleton">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );
}

function ListError({ onRetry }: { onRetry: () => void }): React.ReactElement {
  return (
    <div
      className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
      data-testid="queries-error"
    >
      <span>Failed to load queries.</span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

// ── New query modal ──────────────────────────────────────────────────────────

function NewQueryModal({
  open,
  orderId,
  orderNumber,
  onClose,
  onCreated,
}: {
  open: boolean;
  orderId: string;
  orderNumber: string | null;
  onClose: () => void;
  onCreated: () => void;
}): React.ReactElement {
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [queryType, setQueryType] = React.useState<OrderQueryType>("GENERAL");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [prevOpen, setPrevOpen] = React.useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setSubject("");
      setMessage("");
      setQueryType("GENERAL");
      setSubmitting(false);
      setError(null);
    }
  }

  const canSubmit =
    subject.trim().length > 0 &&
    message.trim().length > 0 &&
    !submitting;

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/queries`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: subject.trim(),
            message: message.trim(),
            query_type: queryType,
          }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Create failed");
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (submitting) return;
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl"
          data-testid="queries-new-modal"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-800">
                Ask a question
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-500">
                {orderNumber
                  ? `New query on order ${orderNumber}.`
                  : "New query on this order."}
              </Dialog.Description>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-query-type">Type</Label>
              <Select
                id="new-query-type"
                value={queryType}
                onChange={(e) => setQueryType(e.target.value as OrderQueryType)}
                disabled={submitting}
                data-testid="queries-new-type"
              >
                {(Object.keys(QUERY_TYPE_LABELS) as OrderQueryType[]).map((t) => (
                  <option key={t} value={t}>
                    {QUERY_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-query-subject">Subject</Label>
              <input
                id="new-query-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={submitting}
                maxLength={200}
                placeholder="One-line summary"
                className="h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                data-testid="queries-new-subject"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-query-message">Question</Label>
              <textarea
                id="new-query-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={submitting}
                rows={4}
                placeholder="What's the question?"
                className="w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                data-testid="queries-new-message"
              />
            </div>

            {error ? (
              <p
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
                data-testid="queries-new-error"
              >
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={submitting}>
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                type="submit"
                disabled={!canSubmit}
                data-testid="queries-new-submit"
              >
                {submitting ? (
                  <>
                    <Loader2
                      size={14}
                      className="mr-1.5 animate-spin"
                      aria-hidden="true"
                    />
                    Creating...
                  </>
                ) : (
                  "Create query"
                )}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Resolve modal ────────────────────────────────────────────────────────────

function ResolveQueryModal({
  target,
  orderId,
  onClose,
  onResolved,
}: {
  target: OrderQuery | null;
  orderId: string;
  onClose: () => void;
  onResolved: () => void;
}): React.ReactElement {
  const [remark, setRemark] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [prevId, setPrevId] = React.useState<string | null>(null);
  const currentId = target?.id ?? null;
  if (prevId !== currentId) {
    setPrevId(currentId);
    setRemark(target ? REMARK_PRESETS[target.query_type] : "");
    setSubmitting(false);
    setError(null);
  }

  async function handleConfirm(): Promise<void> {
    if (!target) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}/queries/${encodeURIComponent(target.id)}/resolve`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remark: remark.trim() }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Resolve failed");
      }
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resolve failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root
      open={target !== null}
      onOpenChange={(next) => {
        if (submitting) return;
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl"
          data-testid="queries-resolve-modal"
        >
          <Dialog.Title className="text-base font-semibold text-slate-800">
            Resolve query?
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-500">
            {target
              ? `Mark “${target.subject}” as resolved.`
              : "Mark this query as resolved."}
          </Dialog.Description>

          <div className="mt-4 space-y-2">
            <Label htmlFor="resolve-remark">Resolution note (optional)</Label>
            <textarea
              id="resolve-remark"
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              disabled={submitting}
              rows={3}
              placeholder="What was the outcome?"
              className="w-full rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              data-testid="queries-resolve-remark"
            />
          </div>

          {error ? (
            <p
              className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
              data-testid="queries-resolve-error"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button type="button" variant="outline" disabled={submitting}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={submitting}
              data-testid="queries-resolve-submit"
            >
              {submitting ? (
                <>
                  <Loader2
                    size={14}
                    className="mr-1.5 animate-spin"
                    aria-hidden="true"
                  />
                  Resolving...
                </>
              ) : (
                "Mark resolved"
              )}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(input: string | null | undefined): string {
  if (!input) return "—";
  const ms = Date.now() - new Date(input).getTime();
  if (Number.isNaN(ms)) return "—";
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
