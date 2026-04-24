import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";

/**
 * GET /api/finance/factory-ledger/{id}/download?format=xlsx|pdf
 *
 * Streams the backend's blob response back to the client. We can't use
 * the typed SDK here because the response is a binary body; fall back
 * to raw fetch with the JWT injected server-side.
 *
 * Forwards start_date + end_date query params. Pins format to xlsx|pdf
 * (defaults to xlsx) so a bad value can't be passed through.
 *
 * D-004 enforcement lives on the backend; 403 from upstream → 403 here.
 */
const DEFAULT_FORMAT = "xlsx";
const ALLOWED_FORMATS = new Set(["xlsx", "pdf"]);

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
  const rawFormat = qs.get("format") ?? DEFAULT_FORMAT;
  const format = ALLOWED_FORMATS.has(rawFormat) ? rawFormat : DEFAULT_FORMAT;

  const upstream = new URL(
    `${process.env.HARVESTERP_API_URL ?? "http://localhost:8000"}/api/finance/factory-ledger/${encodeURIComponent(id)}/download/`,
  );
  upstream.searchParams.set("format", format);
  const start = qs.get("start_date");
  const end = qs.get("end_date");
  if (start) upstream.searchParams.set("start_date", start);
  if (end) upstream.searchParams.set("end_date", end);

  try {
    const response = await fetch(upstream.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message =
        (errorBody as { detail?: string; error?: string }).detail ??
        (errorBody as { error?: string }).error ??
        "Download failed";
      return NextResponse.json(
        { error: message },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    // Stream the blob back preserving Content-Type + Content-Disposition.
    const contentType =
      response.headers.get("Content-Type") ??
      (format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const upstreamDisposition = response.headers.get("Content-Disposition");
    const fallbackName = `factory_ledger.${format}`;
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
      { error: "Download failed" },
      { status: 502 },
    );
  }
}
