import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";

/**
 * GET /api/orders/{id}/documents/{doc_id}/download
 *
 * Streams the backend's binary FileResponse back to the browser. We
 * cannot use the typed SDK because the body is octet-stream; falls
 * back to raw fetch with the JWT injected server-side.
 *
 * Mirrors `apps/web/src/app/api/finance/factory-ledger/[id]/download/`
 * (canonical streaming-binary pattern). The order id in the URL is
 * FE-routing organization; the upstream is keyed only on doc id.
 *
 * R-19 verified shape (live curl, 2026-04-27):
 *   ADMIN → HTTP 200, Content-Type: application/octet-stream,
 *           Content-Disposition: attachment; filename="<original>"
 *           Body: raw file bytes.
 *   404   → HTTP 404 if doc id missing OR file gone from disk.
 *
 * Auth: backend uses Depends(get_current_user) — JWT must be in the
 * Authorization header (cookie auth alone won't work). The proxy
 * reads the session cookie via getSessionToken() and re-injects as
 * Bearer for the upstream fetch.
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; doc_id: string }> },
): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id, doc_id } = await params;
  if (!id || !doc_id) {
    return NextResponse.json(
      { error: "Missing order id or document id" },
      { status: 400 },
    );
  }

  const upstreamUrl = `${process.env.HARVESTERP_API_URL ?? "http://localhost:8000"}/api/documents/${encodeURIComponent(doc_id)}/download/`;

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
      response.headers.get("Content-Type") ?? "application/octet-stream";
    const upstreamDisposition = response.headers.get("Content-Disposition");
    const fallbackName = `document-${doc_id}.bin`;
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
      { error: "Document download failed" },
      { status: 502 },
    );
  }
}
