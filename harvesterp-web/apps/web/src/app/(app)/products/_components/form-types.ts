/**
 * Form-specific response shapes for the product form.
 *
 * Extends the list-page types in ./types.ts with shapes needed only by the
 * create/edit/detail/variant flow.
 */

import type { ProductImage } from "@/components/composed/image-gallery";
import type { Product } from "./types";

/**
 * Response shape from GET /api/products/check-variants/{product_code}/.
 * Used during submit to detect existing variants and show the resolution
 * dialog, AND during variant-mode mount to pull parent info for prefill.
 */
export interface VariantCheckResponse {
  parent_id: string | null;
  variant_count: number;
  parent_code?: string;
  parent_category?: string | null;
  parent_hs_code?: string | null;
  parent_brand?: string | null;
  variants: VariantSummary[];
}

export interface VariantSummary {
  id: string;
  product_name: string;
  material: string | null;
  dimension: string | null;
  part_type: string | null;
  variant_note: string | null;
  is_default: boolean;
  category: string | null;
  hs_code: string | null;
  brand: string | null;
  oem_reference: string | null;
}

/** MarkupSetting from /api/settings/markups. */
export interface MarkupSetting {
  id?: string;
  name: string;
  markup_percent: number;
}

export type ProductFormMode = "create" | "edit" | "detail" | "variant";

/** The Product shape is re-exported so components import from one place. */
export type { Product, ProductImage };
