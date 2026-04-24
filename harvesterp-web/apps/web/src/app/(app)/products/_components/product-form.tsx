"use client";

import * as React from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Save } from "lucide-react";

import { Button } from "@/components/primitives/button";
import { SectionCard } from "./section-card";
import { VariantParentCard } from "./variant-parent-card";
import { VariantResolutionDialog } from "./variant-resolution-dialog";
import {
  TextField,
  TextareaField,
  CategoryField,
  PartTypeField,
  FieldRow,
} from "./product-form-fields";
import { useUnsavedChanges } from "./use-unsaved-changes";
import { productFormSchema, OPTIONAL_STRING_FIELDS } from "./schemas";
import type { ProductFormData } from "./schemas";
import type { Product, ProductFormMode, VariantCheckResponse } from "./form-types";

export interface ProductFormProps {
  mode: ProductFormMode;
  initialData?: Partial<ProductFormData> | undefined;
  parentProduct?: Product | undefined;
  productId?: string | undefined;
  categories: string[];
  onSubmit: (
    payload: ProductFormSubmitPayload,
  ) => Promise<
    { ok: true } | { ok: false; error: string; fieldError?: keyof ProductFormData }
  >;
  onCheckVariants?:
    | ((productCode: string) => Promise<VariantCheckResponse | null>)
    | undefined;
  /** Children slot rendered to the right of the form (e.g. image sidebar on EDIT). */
  rightSlot?: React.ReactNode | undefined;
}

export interface ProductFormSubmitPayload {
  data: ProductFormData;
  variantAction?: "add_new" | "replace" | undefined;
  replaceVariantId?: string | undefined;
}

const DEFAULT_VALUES: ProductFormData = {
  product_code: "",
  product_name: "",
  product_name_chinese: null,
  part_type: null,
  dimension: null,
  material: null,
  variant_note: null,
  category: null,
  subcategory: null,
  unit_weight_kg: null,
  unit_cbm: null,
  standard_packing: null,
  moq: 1,
  hs_code: null,
  hs_code_description: null,
  factory_part_number: null,
  brand: null,
  oem_reference: null,
  compatibility: null,
  notes: null,
};

export function ProductForm({
  mode,
  initialData,
  parentProduct,
  categories,
  onSubmit,
  onCheckVariants,
  rightSlot,
}: ProductFormProps): React.ReactElement {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [generalError, setGeneralError] = React.useState<string | null>(null);
  const [variantDialog, setVariantDialog] =
    React.useState<VariantCheckResponse | null>(null);
  const [pendingData, setPendingData] = React.useState<ProductFormData | null>(
    null,
  );

  const methods = useForm<ProductFormData>({
    // zodResolver's input/output types don't align perfectly with RHF's
    // generic under exactOptionalPropertyTypes — cast is safe because the
    // schema output type matches ProductFormData.
    resolver: zodResolver(productFormSchema) as never,
    defaultValues: { ...DEFAULT_VALUES, ...(initialData ?? {}) },
    mode: "onBlur",
  });

  const { handleSubmit, formState, setError } = methods;
  const isReadOnly = mode === "detail";
  const isVariant = mode === "variant";
  const isEdit = mode === "edit";

  useUnsavedChanges(!isReadOnly && formState.isDirty && !submitting);

  async function runSubmit(data: ProductFormData) {
    setGeneralError(null);
    setSubmitting(true);
    try {
      const result = await onSubmit({ data });
      if (!result.ok) {
        if (result.fieldError) {
          setError(result.fieldError, { message: result.error });
        } else {
          setGeneralError(result.error);
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateSubmit(data: ProductFormData) {
    if (!onCheckVariants || isEdit || isVariant) {
      return runSubmit(data);
    }
    setSubmitting(true);
    try {
      const check = await onCheckVariants(data.product_code);
      if (check && check.variant_count > 0) {
        setPendingData(data);
        setVariantDialog(check);
        setSubmitting(false);
        return;
      }
    } catch {
      // Silent — proceed to create if the check fails (network etc).
    }
    setSubmitting(false);
    return runSubmit(data);
  }

  async function handleVariantResolutionConfirm(
    action: "add_new" | "replace",
    replaceId?: string,
  ) {
    if (!pendingData) return;
    setVariantDialog(null);
    setGeneralError(null);
    setSubmitting(true);
    try {
      const payload: ProductFormSubmitPayload = {
        data: pendingData,
        variantAction: action,
        ...(replaceId ? { replaceVariantId: replaceId } : {}),
      };
      const result = await onSubmit(payload);
      if (!result.ok) {
        setGeneralError(result.error);
      }
    } finally {
      setPendingData(null);
      setSubmitting(false);
    }
  }

  const submitLabel = isEdit
    ? "Save Changes"
    : isVariant
      ? "Add Variant"
      : "Create Product";

  return (
    <FormProvider {...methods}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <form
          onSubmit={handleSubmit(
            (mode === "create"
              ? handleCreateSubmit
              : runSubmit) as never,
          )}
          className="space-y-6"
          noValidate
        >
          {parentProduct ? <VariantParentCard parent={parentProduct} /> : null}

          {generalError ? (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              <AlertCircle size={16} />
              {generalError}
            </div>
          ) : null}

          <SectionCard
            title="Product Identification"
            description="Part code is required and used everywhere else as the primary identifier."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField
                name="product_code"
                label="Part Code"
                required
                readOnly={isVariant}
                placeholder="e.g. AH-ENG-001"
                helperText={
                  isVariant
                    ? "Inherited from parent — can't be changed here."
                    : "Same code can exist for different materials."
                }
              />
              <TextField
                name="product_name"
                label="Product Name"
                required
                placeholder="e.g. Engine Cylinder Head Gasket"
              />
              <TextField
                name="product_name_chinese"
                label="Chinese Name"
                placeholder="中文名称"
              />
              <PartTypeField />
              <TextField name="dimension" label="Dimension" placeholder="430*105*64" />
              <TextField name="material" label="Material" placeholder="Steel" />
              <TextField
                name="variant_note"
                label="Variant Note"
                placeholder="Short note describing this variant"
                className="md:col-span-2"
              />
            </div>
          </SectionCard>

          <SectionCard title="Category">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <CategoryField categories={categories} />
              <TextField
                name="subcategory"
                label="Subcategory"
                placeholder="Optional"
              />
            </div>
          </SectionCard>

          <SectionCard title="Specifications">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField
                name="unit_weight_kg"
                label="Unit Weight (kg)"
                type="number"
                step="0.01"
                placeholder="0.00"
              />
              <TextField
                name="unit_cbm"
                label="Unit CBM"
                type="number"
                step="0.0001"
                placeholder="0.0000"
              />
              <TextField
                name="standard_packing"
                label="Standard Packing"
                placeholder="e.g. 10 pcs/box"
              />
              <TextField
                name="moq"
                label="MOQ"
                required
                type="number"
                step="1"
                placeholder="1"
              />
            </div>
          </SectionCard>

          <SectionCard title="Reference Codes">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField name="hs_code" label="HS Code" placeholder="84159000" />
              <TextField
                name="hs_code_description"
                label="HS Code Description"
                placeholder="Free text"
              />
              <TextField
                name="factory_part_number"
                label="Factory Part Number"
                placeholder="Optional"
              />
              <TextField name="brand" label="Brand" placeholder="Brand name" />
              <TextField
                name="oem_reference"
                label="OEM Reference"
                placeholder="Original equipment manufacturer reference"
              />
              <TextField
                name="compatibility"
                label="Compatibility"
                placeholder="Compatible models/machines"
              />
            </div>
          </SectionCard>

          <SectionCard title="Notes">
            <FieldRow name="notes" label="Notes">
              <TextareaField
                name="notes"
                label="Notes"
                placeholder="Additional notes about this product…"
                rows={3}
              />
            </FieldRow>
          </SectionCard>

          <div className="sticky bottom-0 -mx-6 flex items-center justify-end gap-3 rounded-b-xl border-t border-slate-200 bg-white px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/products")}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 size={14} className="mr-2 animate-spin" />
              ) : (
                <Save size={14} className="mr-2" />
              )}
              {submitLabel}
            </Button>
          </div>
        </form>

        {rightSlot ? <aside className="lg:sticky lg:top-6">{rightSlot}</aside> : null}
      </div>

      {variantDialog && pendingData ? (
        <VariantResolutionDialog
          open={true}
          productCode={pendingData.product_code}
          check={variantDialog}
          onCancel={() => {
            setVariantDialog(null);
            setPendingData(null);
          }}
          onConfirm={(action, replaceId) =>
            handleVariantResolutionConfirm(action, replaceId)
          }
        />
      ) : null}
    </FormProvider>
  );
}

/**
 * Build the API payload from form data — coerces empty strings to null on
 * optional string fields and ensures numerics round-trip correctly.
 */
export function buildPayload(
  data: ProductFormData,
  extras?: { replace_variant_id?: string },
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  for (const field of OPTIONAL_STRING_FIELDS) {
    const v = out[field];
    if (v === "" || v === undefined) out[field] = null;
  }
  if (out.unit_weight_kg === undefined || out.unit_weight_kg === "") {
    out.unit_weight_kg = null;
  }
  if (out.unit_cbm === undefined || out.unit_cbm === "") out.unit_cbm = null;
  out.moq = Number(out.moq) || 1;
  if (extras?.replace_variant_id) {
    out.replace_variant_id = extras.replace_variant_id;
  }
  return out;
}
