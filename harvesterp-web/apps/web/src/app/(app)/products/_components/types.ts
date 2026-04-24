/**
 * Local response shapes for /api/products endpoints.
 *
 * Derived from the live backend response (verified 2026-04-24 via
 * curl /api/products/?per_page=3&group=true). The OpenAPI spec
 * declares these endpoints with empty response schemas, so per the
 * Section 10 local-interface rule these live here as a single source
 * of truth until the backend adds `response_model=` annotations.
 */

/**
 * A single product variant (or parent placeholder).
 *
 * Parents carry an auto-generated `product_name` of the form `[CODE]`
 * and `is_default === false`; children carry the human-readable name
 * and exactly one child per group has `is_default === true`.
 */
export interface Product {
  id: string;
  product_code: string;
  product_name: string;
  product_name_chinese: string | null;
  part_type: string | null;
  dimension: string | null;
  material: string | null;
  variant_note: string | null;
  category: string | null;
  subcategory: string | null;
  unit_weight_kg: number | null;
  unit_cbm: number | null;
  standard_packing: string | null;
  moq: number | null;
  hs_code: string | null;
  hs_code_description: string | null;
  factory_part_number: string | null;
  brand: string | null;
  oem_reference: string | null;
  compatibility: string | null;
  notes: string | null;
  replace_variant_id: string | null;
  is_active: boolean;
  parent_id: string | null;
  is_default: boolean;
  thumbnail_url: string | null;
  /** Parent rows carry the count; child rows return null here. */
  variant_count: number | null;
}

/** A parent + its variants, as returned by GET /api/products/?group=true. */
export interface ProductGroup {
  parent: Product;
  variants: Product[];
}

export interface ProductsListResponse {
  items: ProductGroup[];
  total: number;
  page: number;
  per_page: number;
  /** Backend returns null when pages are not computed — client computes via Math.ceil(total/per_page). */
  pages: number | null;
}

/** Bin list response — flat variants, no grouping. */
export interface ProductsBinResponse {
  items: Product[];
  total: number;
  page: number;
  per_page: number;
  pages: number | null;
}

export interface BulkUpdatePayload {
  product_codes: string[];
  /** Field values — only the chosen bulk-edit field is set per request. */
  category?: string;
  material?: string;
  hs_code?: string;
  part_type?: string;
  brand?: string;
}

export interface BulkDeletePayload {
  product_ids: string[];
}

export interface BinRestorePayload {
  product_ids: string[];
}

export interface BinPermanentDeletePayload {
  product_ids: string[];
}

export interface ProductsQueryParams {
  page: number;
  per_page: number;
  search?: string;
  category?: string;
  sort_by?: SortableColumn;
  sort_dir?: "asc" | "desc";
  /** Always true for this page; bin fetches skip grouping. */
  group?: boolean;
}

export type SortableColumn =
  | "product_code"
  | "product_name"
  | "variants"
  | "category"
  | "hs_code";

export type SortDir = "asc" | "desc";

export interface SortState {
  by: SortableColumn | null;
  dir: SortDir;
}

export type ViewMode = "products" | "bin";
