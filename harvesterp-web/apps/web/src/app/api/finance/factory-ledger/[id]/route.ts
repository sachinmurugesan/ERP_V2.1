import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type { FactoryLedgerResponse } from "@/app/(app)/finance/factory-ledger/_components/types";

/**
 * GET /api/finance/factory-ledger/{id}
 *
 * Proxies FastAPI /api/finance/factory-ledger/{factory_id}/ with the
 * session cookie. Forwards start_date + end_date query params.
 *
 * D-004 enforcement lives on the backend via Depends(require_factory_financial).
 * We preserve the status code from the upstream so the client can show
 * the appropriate forbidden state.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const qs = req.nextUrl.searchParams;
  const forwarded: Record<string, string | number | boolean> = {};
  const start = qs.get("start_date");
  const end = qs.get("end_date");
  if (start) forwarded.start_date = start;
  if (end) forwarded.end_date = end;

  try {
    const client = await getServerClient();
    const result = await client.getJson<FactoryLedgerResponse>(
      `/api/finance/factory-ledger/${encodeURIComponent(id)}/`,
      { params: forwarded },
    );
    return NextResponse.json(result);
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 403) {
      return NextResponse.json(
        { error: "Factory ledger access is limited to FINANCE role (D-004)" },
        { status: 403 },
      );
    }
    if (status === 404) {
      return NextResponse.json({ error: "Factory not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to load factory ledger" },
      { status: status >= 500 ? 502 : status },
    );
  }
}
