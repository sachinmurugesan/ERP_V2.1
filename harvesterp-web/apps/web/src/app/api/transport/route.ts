import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type {
  RawTransportListResponse,
  TransportListResponse,
} from "@/app/(app)/transport/_components/types";

/**
 * GET /api/transport
 *
 * Proxies FastAPI GET /api/shipping/transport/ with the session cookie.
 * Forwards page, per_page, search query params verbatim.
 *
 * IMPORTANT — list-projection: strips fields the list page never
 * displays (email, address, country, bank_*, ifsc_code, notes) before
 * returning. Defense-in-depth + payload reduction. Same projection as
 * the RSC initial fetch in `apps/web/src/app/(app)/transport/page.tsx`.
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
    const raw = await client.getJson<RawTransportListResponse>(
      "/api/shipping/transport/",
      { params },
    );
    const projected: TransportListResponse = {
      items: raw.items.map((p) => {
        const {
          email: _e,
          address: _a,
          country: _c,
          bank_name: _bn,
          bank_account: _ba,
          ifsc_code: _ic,
          notes: _n,
          ...rest
        } = p;
        void _e;
        void _a;
        void _c;
        void _bn;
        void _ba;
        void _ic;
        void _n;
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
      { error: "Failed to load transporters" },
      { status: status >= 500 ? 502 : status },
    );
  }
}
