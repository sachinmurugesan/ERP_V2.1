import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type { Product } from "@/app/(app)/products/_components/types";

/**
 * GET /api/products/{id}    — fetch single product
 * PUT /api/products/{id}    — update product
 * DELETE is defined in [id]/route.ts (pre-existing soft-delete endpoint).
 *
 * NOTE: DELETE isn't co-located here because the existing products-list
 * migration defined its own DELETE handler for soft-deletes. This file
 * adds the missing GET + PUT verbs.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;
  try {
    const client = await getServerClient();
    const product = await client.getJson<Product>(
      `/api/products/${encodeURIComponent(id)}/`,
    );
    return NextResponse.json(product);
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 404) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to load product" },
      { status: status >= 500 ? 502 : status },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    const client = await getServerClient();
    const result = await client.putJson<Product>(
      `/api/products/${encodeURIComponent(id)}/`,
      body,
    );
    return NextResponse.json(result);
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    const message =
      err instanceof Error && "detail" in err
        ? String((err as { detail?: string }).detail ?? "Update failed")
        : "Update failed";
    return NextResponse.json(
      { error: message },
      { status: status >= 500 ? 502 : status },
    );
  }
}
