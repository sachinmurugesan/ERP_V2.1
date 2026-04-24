import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type { ProductsListResponse } from "@/app/(app)/products/_components/types";

/**
 * GET /api/products
 *
 * Proxies FastAPI GET /api/products/ with the session cookie so the
 * client-side TanStack Query can fetch without exposing the JWT. All
 * query params are forwarded verbatim; `group=true` is the default for
 * the products list page but the proxy is agnostic.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  try {
    const client = await getServerClient();
    const response = await client.getJson<ProductsListResponse>(
      "/api/products/",
      { params },
    );
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "Failed to load products" },
      { status: 502 },
    );
  }
}
