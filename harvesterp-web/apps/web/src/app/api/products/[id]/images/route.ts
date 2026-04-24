import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type { ProductImage } from "@/components/composed/image-gallery";

/**
 * GET /api/products/{id}/images    — list images for a product
 * POST /api/products/{id}/images   — upload a new image (multipart)
 *
 * Upload forwards the raw FormData to FastAPI's /upload/ endpoint with the
 * bearer token. The backend stores the file and returns the created image.
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
  try {
    const client = await getServerClient();
    const images = await client.getJson<ProductImage[]>(
      `/api/products/${encodeURIComponent(id)}/images/`,
    );
    return NextResponse.json(images);
  } catch {
    return NextResponse.json(
      { error: "Failed to load images" },
      { status: 502 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;
  const formData = await req.formData();

  const baseUrl = process.env.HARVESTERP_API_URL ?? "http://localhost:8000";
  try {
    const response = await fetch(
      `${baseUrl}/api/products/${encodeURIComponent(id)}/images/upload/`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      },
    );
    if (!response.ok) {
      return NextResponse.json(
        { error: "Image upload failed" },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }
    const result = (await response.json()) as ProductImage;
    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Image upload failed" },
      { status: 502 },
    );
  }
}
