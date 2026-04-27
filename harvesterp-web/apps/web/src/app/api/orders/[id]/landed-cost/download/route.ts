import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";

/**
 * GET /api/orders/{id}/landed-cost/download
 *
 * Streams the backend's .xlsx StreamingResponse back to the browser.
 * We can't use the typed SDK because the body is binary; falls back to
 * raw fetch with the JWT injected server-side (mirrors the
 * factory-ledger-download / documents-download pattern).
 *
 * R-19 verified upstream (live curl, 2026-04-27):
 *   - URL    : /api/orders/{id}/landed-cost/download/
 *   - Auth   : Bearer JWT in Authorization header (cookie alone won't
 *              authenticate — backend uses Depends(get_current_user))
 *   - 200    : Content-Type:
 *                application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 *              Content-Disposition:
 *                `attachment; filename="LandedCost_{order_number}.xlsx"`
 *   - 400    : same stage-not-cleared message as the GET sibling
 *   - 404    : REGULAR client OR TRANSPARENCY_ENABLED=false
 *   - 403    : OPERATIONS / FACTORY caller (or CLIENT viewing other
 *              client's order)
 *
 * Backend source: `backend/routers/landed_cost.py:219-241`. Re-uses
 * `get_landed_cost()` for shape + RLS — same triple gate as the data
 * endpoint.
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing order id" }, { status: 400 });
  }

  const upstreamUrl = `${process.env.HARVESTERP_API_URL ?? "http://localhost:8000"}/api/orders/${encodeURIComponent(id)}/landed-cost/download/`;

  try {
    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({}))) as {
        detail?: string;
        error?: string;
      };
      const message =
        errorBody.detail ?? errorBody.error ?? "Download failed";
      return NextResponse.json(
        { error: message },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    const contentType =
      response.headers.get("Content-Type") ??
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const upstreamDisposition = response.headers.get("Content-Disposition");
    const fallbackName = `LandedCost_${id}.xlsx`;
    const disposition =
      upstreamDisposition ?? `attachment; filename="${fallbackName}"`;

    const buffer = await response.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Landed cost download failed" },
      { status: 502 },
    );
  }
}
