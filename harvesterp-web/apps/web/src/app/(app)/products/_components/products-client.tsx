"use client";

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import type {
  Product,
  ProductGroup,
  ProductsBinResponse,
  ProductsListResponse,
  BulkUpdatePayload,
  ViewMode,
} from "./types";
import { useDebouncedValue } from "./formatters";
import { FilterRow } from "./filter-row";
import { BinTabs } from "./bin-tabs";
import { BulkActionBar } from "./bulk-action-bar";
import { ProductsTable } from "./products-table";
import { ProductRowsSkeleton } from "./skeletons";
import {
  FreshEmptyState,
  FilteredEmptyState,
  BinEmptyState,
} from "./empty-state";
import { ProductsErrorCard } from "./error-card";
import { ProductsPagination } from "./pagination";
import {
  ProductConfirmDialog,
  type ConfirmScenario,
} from "./product-confirm-dialog";
import { useRouter } from "next/navigation";

const PER_PAGE_DEFAULT = 50;
const SEARCH_DEBOUNCE_MS = 400;
const CATEGORIES_STALE_MS = 5 * 60_000;

export interface ProductsClientProps {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

// ── Fetchers ────────────────────────────────────────────────────────

async function fetchProducts(params: {
  page: number;
  perPage: number;
  search: string;
  category: string;
}): Promise<ProductsListResponse> {
  const q = new URLSearchParams();
  q.set("page", String(params.page));
  q.set("per_page", String(params.perPage));
  q.set("group", "true");
  if (params.search) q.set("search", params.search);
  if (params.category) q.set("category", params.category);
  const res = await fetch(`/api/products?${q.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Products list failed: ${res.status}`);
  return (await res.json()) as ProductsListResponse;
}

async function fetchBin(params: {
  page: number;
  perPage: number;
  search: string;
}): Promise<ProductsBinResponse> {
  const q = new URLSearchParams();
  q.set("page", String(params.page));
  q.set("per_page", String(params.perPage));
  if (params.search) q.set("search", params.search);
  const res = await fetch(`/api/products/bin?${q.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Bin list failed: ${res.status}`);
  return (await res.json()) as ProductsBinResponse;
}

async function fetchCategories(): Promise<string[]> {
  const res = await fetch("/api/products/categories", {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Categories failed: ${res.status}`);
  const body = (await res.json()) as { categories: string[] };
  return body.categories ?? [];
}

async function postBulkUpdate(
  productCodes: string[],
  field: keyof Omit<BulkUpdatePayload, "product_codes">,
  value: string,
): Promise<void> {
  const res = await fetch("/api/products/bulk-update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_codes: productCodes, [field]: value }),
  });
  if (!res.ok) throw new Error(`Bulk update failed: ${res.status}`);
}

async function postBulkDelete(productIds: string[]): Promise<void> {
  const res = await fetch("/api/products/bulk-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_ids: productIds }),
  });
  if (!res.ok) throw new Error(`Bulk delete failed: ${res.status}`);
}

async function postBinRestore(productIds: string[]): Promise<void> {
  const res = await fetch("/api/products/bin/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_ids: productIds }),
  });
  if (!res.ok) throw new Error(`Restore failed: ${res.status}`);
}

async function postBinPermanentDelete(productIds: string[]): Promise<void> {
  const res = await fetch("/api/products/bin/permanent-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_ids: productIds }),
  });
  if (!res.ok) throw new Error(`Permanent delete failed: ${res.status}`);
}

async function postSetDefault(variantId: string): Promise<void> {
  const res = await fetch(
    `/api/products/${encodeURIComponent(variantId)}/set-default`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error(`Set default failed: ${res.status}`);
}

// ── Orchestrator ────────────────────────────────────────────────────

interface ConfirmState {
  scenario: ConfirmScenario;
  productCode?: string | null;
  productName?: string | null;
  count?: number;
  /** Closure that actually performs the destructive action. */
  execute: () => Promise<void>;
}

export function ProductsClient({
  canCreate,
  canEdit,
  canDelete,
}: ProductsClientProps): React.ReactElement {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [viewMode, setViewModeRaw] = React.useState<ViewMode>("products");
  const [searchInput, setSearchInputRaw] = React.useState("");
  const [categoryValue, setCategoryValueRaw] = React.useState("");
  const [perPage, setPerPageRaw] = React.useState(PER_PAGE_DEFAULT);
  const [page, setPage] = React.useState(1);
  const search = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);

  const [expandedCodes, setExpandedCodes] = React.useState<Set<string>>(
    new Set(),
  );
  const [selectedCodes, setSelectedCodes] = React.useState<Set<string>>(
    new Set(),
  );
  const [selectedVariantIds, setSelectedVariantIds] = React.useState<
    Set<string>
  >(new Set());

  const [bulkMessage, setBulkMessage] = React.useState<
    { kind: "ok" | "err"; text: string } | null
  >(null);
  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null);

  // Filter / view changes reset pagination + expanded + selection.
  const setViewMode = (next: ViewMode): void => {
    setViewModeRaw(next);
    setPage(1);
    setExpandedCodes(new Set());
    setSelectedCodes(new Set());
    setSelectedVariantIds(new Set());
  };
  const setSearchInput = (next: string): void => {
    setSearchInputRaw(next);
    setPage(1);
    setExpandedCodes(new Set());
  };
  const setCategoryValue = (next: string): void => {
    setCategoryValueRaw(next);
    setPage(1);
    setExpandedCodes(new Set());
  };
  const setPerPage = (next: number): void => {
    setPerPageRaw(next);
    setPage(1);
    setExpandedCodes(new Set());
  };

  const isFiltered = search.length > 0 || categoryValue.length > 0;

  // ── Queries ───────────────────────────────────────────────────────

  const listQuery = useQuery<ProductsListResponse, Error>({
    queryKey: ["products", "list", { page, perPage, search, category: categoryValue }],
    queryFn: () =>
      fetchProducts({ page, perPage, search, category: categoryValue }),
    enabled: viewMode === "products",
  });

  // Bin runs always so the "Bin N" tab badge stays accurate even when the
  // user is on the Products tab (and vice versa).
  const binQuery = useQuery<ProductsBinResponse, Error>({
    queryKey: ["products", "bin", { page, perPage, search }],
    queryFn: () => fetchBin({ page, perPage, search }),
  });

  const categoriesQuery = useQuery<string[], Error>({
    queryKey: ["products", "categories"],
    queryFn: fetchCategories,
    staleTime: CATEGORIES_STALE_MS,
  });

  // ── Derived state ─────────────────────────────────────────────────

  const groups: ProductGroup[] =
    viewMode === "products" ? (listQuery.data?.items ?? []) : [];
  const binItems = viewMode === "bin" ? (binQuery.data?.items ?? []) : [];
  // Tab counts use each query's cached `total` regardless of which view is
  // active, so "Products 393 / Bin 0" stays stable as the user switches tabs.
  const productsTotal = listQuery.data?.total ?? 0;
  const binTotal = binQuery.data?.total ?? 0;
  const activeTotal = viewMode === "products" ? productsTotal : binTotal;

  const anyExpanded = expandedCodes.size > 0;
  const selectedCount = selectedCodes.size + selectedVariantIds.size;

  const showSkeleton =
    viewMode === "products"
      ? listQuery.isLoading && groups.length === 0
      : binQuery.isLoading && binItems.length === 0;

  const showError =
    viewMode === "products"
      ? listQuery.isError && groups.length === 0
      : binQuery.isError && binItems.length === 0;

  const showFreshEmpty =
    viewMode === "products" &&
    !listQuery.isLoading &&
    !listQuery.isError &&
    groups.length === 0 &&
    !isFiltered;

  const showFilteredEmpty =
    viewMode === "products" &&
    !listQuery.isLoading &&
    !listQuery.isError &&
    groups.length === 0 &&
    isFiltered;

  const showBinEmpty =
    viewMode === "bin" &&
    !binQuery.isLoading &&
    !binQuery.isError &&
    binItems.length === 0;

  // ── Handlers ──────────────────────────────────────────────────────

  const clearFilters = (): void => {
    setSearchInput("");
    setCategoryValue("");
  };

  const toggleExpanded = (productCode: string): void => {
    setExpandedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(productCode)) next.delete(productCode);
      else next.add(productCode);
      return next;
    });
  };

  const expandAll = (): void => {
    setExpandedCodes(
      new Set(groups.map((g) => g.parent.product_code)),
    );
  };
  const collapseAll = (): void => {
    setExpandedCodes(new Set());
  };

  const toggleSelectedParent = (productCode: string): void => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(productCode)) next.delete(productCode);
      else next.add(productCode);
      return next;
    });
    // When a parent is toggled, clear any per-variant selections for that group —
    // the parent checkbox covers them.
    const group = groups.find((g) => g.parent.product_code === productCode);
    if (group) {
      setSelectedVariantIds((prev) => {
        const next = new Set(prev);
        for (const v of group.variants) next.delete(v.id);
        return next;
      });
    }
  };

  const toggleSelectedVariant = (variantId: string): void => {
    setSelectedVariantIds((prev) => {
      const next = new Set(prev);
      if (next.has(variantId)) next.delete(variantId);
      else next.add(variantId);
      return next;
    });
  };

  const clearSelection = (): void => {
    setSelectedCodes(new Set());
    setSelectedVariantIds(new Set());
    setBulkMessage(null);
  };

  const applyBulkField = async (
    field: keyof Omit<BulkUpdatePayload, "product_codes">,
    value: string,
  ): Promise<void> => {
    const codes = Array.from(selectedCodes);
    const extraCodes = groups
      .filter((g) => g.variants.some((v) => selectedVariantIds.has(v.id)))
      .map((g) => g.parent.product_code)
      .filter((code) => !codes.includes(code));
    const allCodes = [...codes, ...extraCodes];
    if (allCodes.length === 0) {
      setBulkMessage({ kind: "err", text: "No products selected." });
      return;
    }
    try {
      await postBulkUpdate(allCodes, field, value);
      setBulkMessage({
        kind: "ok",
        text: `${labelFor(field)} updated to "${value}" for ${allCodes.length} products.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["products", "list"] });
    } catch (err) {
      setBulkMessage({
        kind: "err",
        text:
          err instanceof Error ? err.message : "Bulk update failed.",
      });
    }
  };

  // ── Delete / restore flows ────────────────────────────────────────

  const requestDeleteGroup = (group: ProductGroup): void => {
    setConfirm({
      scenario: "single",
      productCode: group.parent.product_code,
      productName: group.variants[0]?.product_name ?? null,
      execute: async () => {
        await postBulkDelete([group.parent.id]);
        await queryClient.invalidateQueries({ queryKey: ["products"] });
        setConfirm(null);
      },
    });
  };

  const requestDeleteVariant = (_group: ProductGroup, variant: Product): void => {
    setConfirm({
      scenario: "single",
      productCode: variant.product_name ?? variant.id,
      productName: variant.product_name,
      execute: async () => {
        await postBulkDelete([variant.id]);
        await queryClient.invalidateQueries({ queryKey: ["products"] });
        setConfirm(null);
      },
    });
  };

  const requestBulkDelete = (): void => {
    const codes = Array.from(selectedCodes);
    const extraParentIdsFromVariants = groups
      .filter((g) => g.variants.some((v) => selectedVariantIds.has(v.id)))
      .map((g) => g.parent.id);
    const productIdsFromCodes: string[] = [];
    for (const code of codes) {
      const g = groups.find((gg) => gg.parent.product_code === code);
      if (g) productIdsFromCodes.push(g.parent.id);
    }
    const productIdsFromVariants = Array.from(selectedVariantIds);
    const allIds = Array.from(
      new Set([
        ...productIdsFromCodes,
        ...productIdsFromVariants,
        ...extraParentIdsFromVariants.filter(
          (id) => !productIdsFromCodes.includes(id),
        ),
      ]),
    );

    setConfirm({
      scenario: "bulk",
      count: allIds.length,
      execute: async () => {
        await postBulkDelete(allIds);
        await queryClient.invalidateQueries({ queryKey: ["products"] });
        clearSelection();
        setConfirm(null);
      },
    });
  };

  const requestBinPermanentDelete = (item: Product): void => {
    setConfirm({
      scenario: "bin-permanent",
      productCode: item.product_code,
      productName: item.product_name,
      execute: async () => {
        await postBinPermanentDelete([item.id]);
        await queryClient.invalidateQueries({ queryKey: ["products"] });
        setConfirm(null);
      },
    });
  };

  const restoreBinItem = async (item: Product): Promise<void> => {
    await postBinRestore([item.id]);
    await queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const setDefaultMutation = useMutation({
    mutationFn: (variantId: string) => postSetDefault(variantId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const handleSetDefault = (
    _group: ProductGroup,
    variant: Product,
  ): void => {
    setDefaultMutation.mutate(variant.id);
  };

  const handleAddVariant = (group: ProductGroup): void => {
    router.push(
      `/products/new?parent_id=${encodeURIComponent(group.parent.id)}&product_code=${encodeURIComponent(group.parent.product_code)}`,
    );
  };

  // ── Render ────────────────────────────────────────────────────────

  return (
    <>
      <section
        aria-label={viewMode === "products" ? "Products list" : "Products bin"}
        className="card"
        style={{ padding: 0, overflow: "hidden" }}
      >
        <header
          style={{
            padding: "12px 18px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <BinTabs
            active={viewMode}
            productsCount={productsTotal}
            binCount={binTotal}
            onChange={setViewMode}
          />
        </header>

        <FilterRow
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          categoryValue={categoryValue}
          onCategoryChange={setCategoryValue}
          categoryOptions={categoriesQuery.data ?? []}
          perPage={perPage}
          onPerPageChange={setPerPage}
          onClearFilters={clearFilters}
          isFiltered={isFiltered}
          onExpandAll={expandAll}
          onCollapseAll={collapseAll}
          anyExpanded={anyExpanded}
        />

        {viewMode === "products" && selectedCount > 0 && (
          <BulkActionBar
            selectedCount={selectedCount}
            onClear={clearSelection}
            onDelete={requestBulkDelete}
            onApplyField={applyBulkField}
            categoryOptions={categoriesQuery.data ?? []}
            lastMessage={bulkMessage}
          />
        )}

        {showSkeleton && <ProductRowsSkeleton rows={10} />}

        {showError && (
          <ProductsErrorCard
            message={
              viewMode === "products"
                ? "Couldn't load products."
                : "Couldn't load bin."
            }
            onRetry={() =>
              viewMode === "products"
                ? void listQuery.refetch()
                : void binQuery.refetch()
            }
          />
        )}

        {showFreshEmpty && <FreshEmptyState canCreate={canCreate} />}
        {showFilteredEmpty && <FilteredEmptyState onClear={clearFilters} />}
        {showBinEmpty && <BinEmptyState />}

        {viewMode === "products" &&
          !showSkeleton &&
          !showError &&
          groups.length > 0 && (
            <ProductsTable
              groups={groups}
              expandedCodes={expandedCodes}
              selectedCodes={selectedCodes}
              selectedVariantIds={selectedVariantIds}
              canEdit={canEdit}
              canDelete={canDelete}
              onToggleExpanded={toggleExpanded}
              onToggleSelectedParent={toggleSelectedParent}
              onToggleSelectedVariant={toggleSelectedVariant}
              onAddVariant={handleAddVariant}
              onDeleteGroup={requestDeleteGroup}
              onDeleteVariant={requestDeleteVariant}
              onSetDefault={handleSetDefault}
            />
          )}

        {viewMode === "bin" &&
          !showSkeleton &&
          !showError &&
          binItems.length > 0 && (
            <BinList
              items={binItems}
              canManage={canDelete}
              onRestore={restoreBinItem}
              onPermanentDelete={requestBinPermanentDelete}
            />
          )}

        <ProductsPagination
          page={page}
          perPage={perPage}
          total={activeTotal}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
          onPerPageChange={setPerPage}
        />
      </section>

      <ProductConfirmDialog
        open={confirm !== null}
        scenario={confirm?.scenario ?? "single"}
        productCode={confirm?.productCode ?? null}
        productName={confirm?.productName ?? null}
        count={confirm?.count ?? 0}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm) await confirm.execute();
        }}
      />
    </>
  );
}

function labelFor(
  field: keyof Omit<BulkUpdatePayload, "product_codes">,
): string {
  switch (field) {
    case "category":
      return "Category";
    case "material":
      return "Material";
    case "hs_code":
      return "HS Code";
    case "part_type":
      return "Type";
    case "brand":
      return "Brand";
  }
}

// ── Bin list (flat variant rows) ───────────────────────────────────

function BinList({
  items,
  canManage,
  onRestore,
  onPermanentDelete,
}: {
  items: Product[];
  canManage: boolean;
  onRestore: (item: Product) => Promise<void> | void;
  onPermanentDelete: (item: Product) => void;
}): React.ReactElement {
  return (
    <div style={{ padding: "0" }}>
      <table className="tbl" aria-label="Archived products">
        <thead>
          <tr>
            <th scope="col">Part Code</th>
            <th scope="col">Product Name</th>
            <th scope="col">Category</th>
            <th scope="col" style={{ textAlign: "right" }}>
              <span className="sr-only-no-class">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td
                className="mono"
                style={{ fontWeight: 700, color: "var(--fg-muted)" }}
              >
                {item.product_code}
              </td>
              <td style={{ color: "var(--fg-muted)" }}>
                {item.product_name}
              </td>
              <td>
                {item.category ? (
                  <span
                    className="chip"
                    style={{ fontSize: 11 }}
                  >
                    {item.category}
                  </span>
                ) : (
                  <span style={{ color: "var(--fg-subtle)" }}>&mdash;</span>
                )}
              </td>
              <td style={{ textAlign: "right" }}>
                {canManage && (
                  <>
                    <button
                      type="button"
                      onClick={() => void onRestore(item)}
                      className="btn btn-sm btn-ghost"
                      aria-label={`Restore ${item.product_code}`}
                    >
                      Restore
                    </button>
                    <button
                      type="button"
                      onClick={() => onPermanentDelete(item)}
                      className="btn btn-sm btn-danger"
                      aria-label={`Permanently delete ${item.product_code}`}
                      style={{ marginLeft: 6 }}
                    >
                      Delete forever
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
