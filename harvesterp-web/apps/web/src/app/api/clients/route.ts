import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type {
  ClientsListResponse,
  RawClientsListResponse,
} from "@/app/(app)/clients/_components/types";

/**
 * GET /api/clients
 *
 * Proxies FastAPI GET /api/clients/ with the session cookie.
 * Forwards page, per_page, search query params verbatim.
 *
 * IMPORTANT — Cluster D projection: strips
 * `factory_markup_percent` + `sourcing_commission_percent` from every
 * row before returning. These are sensitive internal margin fields
 * not rendered by the UI; keeping them out of the client bundle
 * eliminates accidental-leak risk.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const qs = req.nextUrl.searchParams;
  const params: Record<string, string | number> = {
    page: Number(qs.get("page") ?? 1),
    per_page: Number(qs.get("per_page") ?? 50),
  };
  const search = qs.get("search");
  if (search) params.search = search;

  try {
    const client = await getServerClient();
    const raw = await client.getJson<RawClientsListResponse>(
      "/api/clients/",
      { params },
    );
    const projected: ClientsListResponse = {
      items: raw.items.map((c) => {
        // Strip Cluster D fields before sending to the client bundle.
        const {
          factory_markup_percent: _m,
          sourcing_commission_percent: _s,
          ...rest
        } = c;
        void _m;
        void _s;
        return rest;
      }),
      total: raw.total,
      page: raw.page,
      per_page: raw.per_page,
      pages: raw.pages,
    };
    return NextResponse.json(projected);
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    return NextResponse.json(
      { error: "Failed to load clients" },
      { status: status >= 500 ? 502 : status },
    );
  }
}
