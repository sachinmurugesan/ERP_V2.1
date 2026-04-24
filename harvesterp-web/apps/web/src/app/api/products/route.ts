import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type {
  Product,
  ProductsListResponse,
} from "@/app/(app)/products/_components/types";

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

/**
 * POST /api/products — create new product. Forwards JSON body to FastAPI.
 * Error detail from backend is surfaced so the form can show field errors.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    const client = await getServerClient();
    const created = await client.postJson<Product>("/api/products/", body);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    const detail =
      err instanceof Error && "detail" in err
        ? String((err as { detail?: string }).detail ?? "Create failed")
        : "Create failed";
    return NextResponse.json(
      { error: detail },
      { status: status >= 500 ? 502 : status },
    );
  }
}
