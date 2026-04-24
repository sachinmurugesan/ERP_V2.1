import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type { OrderListResponse } from "@/app/(app)/orders/_components/types";

/**
 * GET /api/orders
 *
 * Proxies FastAPI GET /api/orders/ using the httpOnly session cookie so the
 * client-side TanStack Query can fetch without exposing the JWT to the
 * browser bundle.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());

  try {
    const client = await getServerClient();
    const response = await client.getJson<OrderListResponse>(
      "/api/orders/",
      { params },
    );
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "Failed to load orders" },
      { status: 502 },
    );
  }
}
