import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type { BulkUpdatePayload } from "@/app/(app)/products/_components/types";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  let body: BulkUpdatePayload;
  try {
    body = (await req.json()) as BulkUpdatePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (
    !Array.isArray(body.product_codes) ||
    body.product_codes.length === 0
  ) {
    return NextResponse.json(
      { error: "product_codes must be a non-empty array" },
      { status: 400 },
    );
  }
  try {
    const client = await getServerClient();
    await client.postJson("/api/products/bulk-update/", body);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Bulk update failed" },
      { status: 502 },
    );
  }
}
