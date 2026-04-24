import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

/**
 * DELETE /api/products/{id}/images/{imageId}
 *
 * Proxies FastAPI /api/products/{id}/images/{imageId}/.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> },
): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id, imageId } = await params;
  try {
    const client = await getServerClient();
    await client.deleteJson(
      `/api/products/${encodeURIComponent(id)}/images/${encodeURIComponent(imageId)}/`,
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Image delete failed" },
      { status: 502 },
    );
  }
}
