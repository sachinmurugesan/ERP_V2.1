import { NextResponse, type NextRequest } from "next/server";
import { type UserRole, Resource, canAccess } from "@harvesterp/lib";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

/**
 * GET / POST  /api/orders/{id}/documents
 *
 * GET  → proxies FastAPI GET  /api/documents/orders/{id}/  (list)
 * POST → proxies FastAPI POST /api/documents/orders/{id}/  (upload)
 *
 * The order-id segment is FE-routing organization (every order-scoped
 * proxy lives at /api/orders/[id]/*); the upstream URL prefix is
 * /api/documents/orders/{id}/ as confirmed by R-19 live curl
 * (2026-04-27, see migration log §1.5).
 *
 * R-19 verified shape (live curl, 2026-04-27, ADMIN as
 * admin@harvesterp.com on order de2258e0-…):
 *   GET empty-case  → HTTP 200, body `[]` (bare array)
 *   GET populated   → HTTP 200, body Array<OrderDocument>
 *   POST upload     → HTTP 200, body OrderDocument (single)
 *
 * OrderDocument: { id, order_id, doc_type, filename, file_size,
 *                  uploaded_at }. NOTE: backend does NOT return
 * `uploaded_by` or `file_path` — only the 6 fields above.
 *
 * Upload: multipart/form-data with `file` (binary) + `document_type`
 * (string). Backend rate-limited to 30/hour per IP. MAX_UPLOAD_SIZE
 * default 600 MB (env-tunable). The proxy forwards multipart streams
 * via undici fetch — does not buffer in memory.
 */

export interface OrderDocument {
  id: string;
  order_id: string;
  doc_type: string;
  filename: string;
  file_size: number;
  uploaded_at: string | null;
}

const UPLOAD_ROLES: ReadonlyArray<UserRole> = [
  "ADMIN",
  "OPERATIONS",
  "SUPER_ADMIN",
] as UserRole[];

async function resolveCallerRole(): Promise<UserRole | undefined> {
  try {
    const client = await getServerClient();
    const result = await client.GET("/api/auth/me");
    if (!result.data) return undefined;
    return (result.data as { role?: UserRole }).role;
  } catch {
    return undefined;
  }
}

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
  try {
    const client = await getServerClient();
    const result = await client.getJson<OrderDocument[]>(
      `/api/documents/orders/${encodeURIComponent(id)}/`,
    );
    return NextResponse.json(result);
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 403) {
      return NextResponse.json(
        { error: "You don't have permission to view documents for this order" },
        { status: 403 },
      );
    }
    if (status === 404) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to load documents" },
      { status: status >= 500 ? 502 : status },
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
  if (!id) {
    return NextResponse.json({ error: "Missing order id" }, { status: 400 });
  }

  // Defense-in-depth gate: backend allows any auth user, but admin portal
  // restricts upload to ADMIN | OPERATIONS | SUPER_ADMIN per matrix.ts
  // Resource.DOCUMENT_UPLOAD.
  const role = await resolveCallerRole();
  if (!role || !canAccess(role, Resource.DOCUMENT_UPLOAD)) {
    return NextResponse.json(
      { error: "You don't have permission to upload documents" },
      { status: 403 },
    );
  }

  // Forward the multipart request body unchanged. Using undici fetch
  // with the original ReadableStream avoids buffering the whole file in
  // Next.js memory — important because MAX_UPLOAD_SIZE is 600 MB on the
  // backend. The Content-Type carries the multipart boundary, so we
  // copy it through verbatim.
  const contentType = req.headers.get("content-type");
  if (!contentType || !contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Expected multipart/form-data body" },
      { status: 400 },
    );
  }

  const upstreamUrl = `${process.env.HARVESTERP_API_URL ?? "http://localhost:8000"}/api/documents/orders/${encodeURIComponent(id)}/`;

  try {
    const response = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body: req.body,
      // @ts-expect-error — undici-only flag required to stream a request body.
      duplex: "half",
    });

    if (!response.ok) {
      const errBody = (await response.json().catch(() => ({}))) as {
        detail?: string;
        error?: string;
      };
      const message =
        errBody.detail ?? errBody.error ?? "Upload failed";
      if (response.status === 429) {
        return NextResponse.json(
          { error: "Upload rate limit exceeded — try again in a few minutes" },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: message },
        { status: response.status >= 500 ? 502 : response.status },
      );
    }

    const body = (await response.json()) as OrderDocument;
    return NextResponse.json(body, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Upload failed" }, { status: 502 });
  }
}

/**
 * Allow upload roles to be discovered by tests without importing the
 * matrix directly (helps keep test fixtures stable).
 */
export const __INTERNAL_UPLOAD_ROLES = UPLOAD_ROLES;
