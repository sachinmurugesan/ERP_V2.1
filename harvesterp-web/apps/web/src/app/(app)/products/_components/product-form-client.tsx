"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ProductForm, buildPayload } from "./product-form";
import { ProductImageSidebar } from "./product-image-sidebar";
import type {
  Product,
  ProductFormMode,
  ProductImage,
  VariantCheckResponse,
} from "./form-types";
import type { ProductFormData } from "./schemas";

interface ProductFormClientProps {
  mode: ProductFormMode;
  initialData?: Partial<ProductFormData> | undefined;
  parentProduct?: Product | undefined;
  productId?: string | undefined;
  categories: string[];
  initialImages?: ProductImage[] | undefined;
}

/**
 * Client wrapper around ProductForm that supplies submit + variant-check
 * handlers and wires the image sidebar for EDIT mode. RSC pages import
 * this to get a fully functional form without moving server data fetching
 * into the client tree.
 */
export function ProductFormClient({
  mode,
  initialData,
  parentProduct,
  productId,
  categories,
  initialImages = [],
}: ProductFormClientProps): React.ReactElement {
  const router = useRouter();
  const [images, setImages] = React.useState<ProductImage[]>(initialImages);

  async function reloadImages() {
    if (!productId) return;
    const res = await fetch(`/api/products/${productId}/images`);
    if (res.ok) {
      const next = (await res.json()) as ProductImage[];
      setImages(next);
    }
  }

  async function handleUpload(files: File[]) {
    if (!productId) return;
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/products/${productId}/images`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const msg = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(msg.error || "Image upload failed");
      }
    }
    await reloadImages();
  }

  async function handleDelete(imageId: string) {
    if (!productId) return;
    const res = await fetch(
      `/api/products/${productId}/images/${imageId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      const msg = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(msg.error || "Image delete failed");
    }
    setImages((prev) => prev.filter((i) => i.id !== imageId));
  }

  async function submitCreate(
    payload: Record<string, unknown>,
  ): Promise<{ ok: true; id?: string } | { ok: false; error: string; fieldError?: keyof ProductFormData }> {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      const msg = body.error || "Failed to save product";
      if (
        typeof msg === "string" &&
        msg.toLowerCase().includes("name already exists")
      ) {
        return { ok: false, error: msg, fieldError: "product_name" };
      }
      return { ok: false, error: msg };
    }
    const created = (await res.json()) as Product;
    return { ok: true, id: created.id };
  }

  async function submitUpdate(
    id: string,
    payload: Record<string, unknown>,
  ): Promise<{ ok: true } | { ok: false; error: string; fieldError?: keyof ProductFormData }> {
    const res = await fetch(`/api/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: body.error || "Failed to save product" };
    }
    return { ok: true };
  }

  async function onSubmit(payload_: {
    data: ProductFormData;
    variantAction?: "add_new" | "replace" | undefined;
    replaceVariantId?: string | undefined;
  }) {
    const { data, variantAction, replaceVariantId } = payload_;
    const payload =
      variantAction === "replace" && replaceVariantId
        ? buildPayload(data, { replace_variant_id: replaceVariantId })
        : buildPayload(data);

    if (mode === "edit" && productId) {
      const result = await submitUpdate(productId, payload);
      if (result.ok) {
        router.refresh();
      }
      return result;
    }

    const result = await submitCreate(payload);
    if (result.ok) {
      if (result.id) router.push(`/products/${result.id}`);
      else router.push("/products");
    }
    return result;
  }

  async function onCheckVariants(
    code: string,
  ): Promise<VariantCheckResponse | null> {
    const res = await fetch(
      `/api/products/check-variants/${encodeURIComponent(code)}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as VariantCheckResponse;
  }

  const rightSlot =
    mode === "edit" && productId ? (
      <ProductImageSidebar
        productId={productId}
        images={images}
        onUpload={handleUpload}
        onDelete={handleDelete}
      />
    ) : null;

  return (
    <ProductForm
      mode={mode}
      {...(initialData ? { initialData } : {})}
      {...(parentProduct ? { parentProduct } : {})}
      {...(productId ? { productId } : {})}
      categories={categories}
      onSubmit={onSubmit}
      {...(mode === "create" ? { onCheckVariants } : {})}
      {...(rightSlot ? { rightSlot } : {})}
    />
  );
}
