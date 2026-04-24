import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type { ProductsBinResponse } from "@/app/(app)/products/_components/types";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  try {
    const client = await getServerClient();
    const response = await client.getJson<ProductsBinResponse>(
      "/api/products/bin/",
      { params },
    );
    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "Failed to load bin" },
      { status: 502 },
    );
  }
}
