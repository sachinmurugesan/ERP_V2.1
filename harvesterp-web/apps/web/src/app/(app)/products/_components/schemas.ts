/**
 * Zod schemas for the product form.
 *
 * Kept co-located with the form rather than in a global schemas dir so the
 * form's validation contract lives next to the UI that enforces it.
 */

import { z } from "zod";

export const productFormSchema = z.object({
  product_code: z
    .string()
    .trim()
    .min(1, "Part code is required")
    .max(100, "Part code must be 100 characters or fewer"),
  product_name: z
    .string()
    .trim()
    .min(1, "Product name is required")
    .max(200, "Product name must be 200 characters or fewer"),
  product_name_chinese: z.string().trim().nullable().optional(),
  part_type: z.string().trim().nullable().optional(),
  dimension: z.string().trim().nullable().optional(),
  material: z.string().trim().nullable().optional(),
  variant_note: z.string().trim().nullable().optional(),
  category: z.string().trim().nullable().optional(),
  subcategory: z.string().trim().nullable().optional(),
  unit_weight_kg: z
    .number()
    .nonnegative("Weight cannot be negative")
    .finite("Weight must be a finite number")
    .nullable()
    .optional(),
  unit_cbm: z
    .number()
    .nonnegative("CBM cannot be negative")
    .finite("CBM must be a finite number")
    .nullable()
    .optional(),
  standard_packing: z.string().trim().nullable().optional(),
  moq: z
    .number()
    .int("MOQ must be a whole number")
    .min(1, "MOQ must be at least 1"),
  hs_code: z.string().trim().nullable().optional(),
  hs_code_description: z.string().trim().nullable().optional(),
  factory_part_number: z.string().trim().nullable().optional(),
  brand: z.string().trim().nullable().optional(),
  oem_reference: z.string().trim().nullable().optional(),
  compatibility: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export type ProductFormData = z.infer<typeof productFormSchema>;

/**
 * Fields that should be sent as null when empty (rather than "") on submit.
 * MOQ is numeric and required; weight/cbm are coerced separately.
 */
export const OPTIONAL_STRING_FIELDS = [
  "product_name_chinese",
  "part_type",
  "dimension",
  "material",
  "variant_note",
  "category",
  "subcategory",
  "standard_packing",
  "hs_code",
  "hs_code_description",
  "factory_part_number",
  "brand",
  "oem_reference",
  "compatibility",
  "notes",
] as const;
