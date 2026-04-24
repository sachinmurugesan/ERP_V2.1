import * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Resource, canAccess, type UserRole } from "@harvesterp/lib";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type { Product } from "../../_components/types";
import type { ProductImage } from "@/components/composed/image-gallery";
import type { ProductFormData } from "../../_components/schemas";
import { ProductFormClient } from "../../_components/product-form-client";

export const dynamic = "force-dynamic";

async function resolveUserRole(): Promise<UserRole | undefined> {
  try {
    const token = await getSessionToken();
    if (!token) return undefined;
    const client = await getServerClient();
    const result = await client.GET("/api/auth/me");
    if (!result.data) return undefined;
    return (result.data as { role?: UserRole }).role;
  } catch {
    return undefined;
  }
}

async function fetchProduct(id: string): Promise<Product | null> {
  try {
    const client = await getServerClient();
    return await client.getJson<Product>(
      `/api/products/${encodeURIComponent(id)}/`,
    );
  } catch {
    return null;
  }
}

async function fetchImages(id: string): Promise<ProductImage[]> {
  try {
    const client = await getServerClient();
    return await client.getJson<ProductImage[]>(
      `/api/products/${encodeURIComponent(id)}/images/`,
    );
  } catch {
    return [];
  }
}

async function fetchCategories(): Promise<string[]> {
  try {
    const client = await getServerClient();
    const cats = await client.getJson<string[]>("/api/products/categories/");
    const markups = await client
      .getJson<{ name: string }[]>("/api/settings/markups/")
      .catch(() => []);
    const merged = new Set<string>([
      ...cats,
      ...markups.map((m) => m.name).filter(Boolean),
    ]);
    return Array.from(merged).sort();
  } catch {
    return [];
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Products EDIT page. Full form + right-sidebar image gallery.
 */
export default async function ProductEditPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const role = await resolveUserRole();
  if (!role) redirect("/login");
  if (!canAccess(role, Resource.PRODUCT_UPDATE)) notFound();

  const { id } = await params;
  const [product, images, categories] = await Promise.all([
    fetchProduct(id),
    fetchImages(id),
    fetchCategories(),
  ]);
  if (!product) notFound();

  const initialData: Partial<ProductFormData> = {
    product_code: product.product_code,
    product_name: product.product_name,
    product_name_chinese: product.product_name_chinese,
    part_type: product.part_type,
    dimension: product.dimension,
    material: product.material,
    variant_note: product.variant_note,
    category: product.category,
    subcategory: product.subcategory,
    unit_weight_kg: product.unit_weight_kg,
    unit_cbm: product.unit_cbm,
    standard_packing: product.standard_packing,
    moq: product.moq ?? 1,
    hs_code: product.hs_code,
    hs_code_description: product.hs_code_description,
    factory_part_number: product.factory_part_number,
    brand: product.brand,
    oem_reference: product.oem_reference,
    compatibility: product.compatibility,
    notes: product.notes,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link
        href={`/products/${product.id}`}
        className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700"
      >
        <ChevronLeft size={14} />
        Back to Product
      </Link>
      <header>
        <h1 className="text-xl font-semibold text-slate-800">
          Edit Product
        </h1>
        <p className="text-sm text-slate-500">Update product master data</p>
      </header>
      <ProductFormClient
        mode="edit"
        productId={id}
        initialData={initialData}
        categories={categories}
        initialImages={images}
      />
    </div>
  );
}
