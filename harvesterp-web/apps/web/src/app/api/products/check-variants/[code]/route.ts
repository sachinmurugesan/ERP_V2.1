import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type { VariantCheckResponse } from "@/app/(app)/products/_components/form-types";

/**
 * GET /api/products/check-variants/{code}
 *
 * Proxies FastAPI's /api/products/check-variants/{product_code}/. Used by
 * the form to detect existing variants before CREATE submit (so the user
 * can choose to add_new or replace) AND by the variant-mode mount flow to
 * pull parent info for prefill.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { code } = await params;
  if (!code) {
    return NextResponse.json(
      { error: "Missing product code" },
      { status: 400 },
    );
  }
  try {
    const client = await getServerClient();
    const result = await client.getJson<VariantCheckResponse>(
      `/api/products/check-variants/${encodeURIComponent(code)}/`,
    );
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Variant check failed" },
      { status: 502 },
    );
  }
}
