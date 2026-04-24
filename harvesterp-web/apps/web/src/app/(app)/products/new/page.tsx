import * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Resource, canAccess, type UserRole } from "@harvesterp/lib";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type { Product } from "../_components/types";
import type { ProductFormData } from "../_components/schemas";
import { ProductFormClient } from "../_components/product-form-client";

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

async function fetchParent(id: string): Promise<Product | null> {
  try {
    const client = await getServerClient();
    return await client.getJson<Product>(
      `/api/products/${encodeURIComponent(id)}/`,
    );
  } catch {
    return null;
  }
}

interface PageProps {
  searchParams: Promise<{ parent_id?: string; code?: string }>;
}

/**
 * Products CREATE page. Serves CREATE and VARIANT modes via ?parent_id=
 * query param. Auth + role gating happens here so an unauthorized user
 * never sees the form at all.
 */
export default async function NewProductPage({
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const role = await resolveUserRole();
  if (!role) redirect("/login?next=/products/new");
  if (!canAccess(role, Resource.PRODUCT_CREATE)) {
    notFound();
  }

  const { parent_id, code } = await searchParams;
  const categories = await fetchCategories();
  const parent = parent_id ? await fetchParent(parent_id) : null;
  const isVariantMode = Boolean(parent);

  const initialData: Partial<ProductFormData> = parent
    ? {
        product_code: parent.product_code,
        category: parent.category,
        hs_code: parent.hs_code,
        hs_code_description: parent.hs_code_description,
        brand: parent.brand,
      }
    : code
      ? { product_code: code }
      : {};

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700"
      >
        <ChevronLeft size={14} />
        Back to Products
      </Link>
      <header>
        <h1 className="text-xl font-semibold text-slate-800">
          {isVariantMode ? "Add Variant" : "New Product"}
        </h1>
        <p className="text-sm text-slate-500">
          {isVariantMode
            ? `Adding a new variant under ${parent?.product_code}`
            : "Add a new product to the catalog"}
        </p>
      </header>
      <ProductFormClient
        mode={isVariantMode ? "variant" : "create"}
        initialData={initialData}
        {...(parent ? { parentProduct: parent } : {})}
        categories={categories}
      />
    </div>
  );
}
