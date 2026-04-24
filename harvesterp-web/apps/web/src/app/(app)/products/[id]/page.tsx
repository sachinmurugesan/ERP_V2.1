import * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Resource, canAccess, type UserRole } from "@harvesterp/lib";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type { Product } from "../_components/types";
import type { ProductImage } from "@/components/composed/image-gallery";
import { ProductDetailView } from "../_components/product-detail-view";

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

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Products DETAIL page. Read-only presentation of a product with an Edit
 * button (role-gated to PRODUCT_UPDATE).
 */
export default async function ProductDetailPage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const role = await resolveUserRole();
  if (!role) redirect("/login");
  if (!canAccess(role, Resource.PRODUCT_LIST)) notFound();

  const { id } = await params;
  const [product, images] = await Promise.all([
    fetchProduct(id),
    fetchImages(id),
  ]);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700"
      >
        <ChevronLeft size={14} />
        Back to Products
      </Link>
      <ProductDetailView
        product={product}
        images={images}
        user={{ role }}
      />
    </div>
  );
}
