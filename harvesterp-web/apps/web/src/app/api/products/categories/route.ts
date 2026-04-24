import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

/**
 * GET /api/products/categories
 *
 * Proxies FastAPI GET /api/products/categories/. Returns a flat
 * `{ categories: string[] }` envelope so the client can rely on a
 * consistent shape even if upstream ever changes.
 */
export async function GET(): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const client = await getServerClient();
    const categories = await client.getJson<string[]>(
      "/api/products/categories/",
    );
    return NextResponse.json({ categories });
  } catch {
    return NextResponse.json(
      { error: "Failed to load categories" },
      { status: 502 },
    );
  }
}
