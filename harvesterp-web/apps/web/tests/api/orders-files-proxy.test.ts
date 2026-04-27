/**
 * orders-files-proxy.test.ts — Tests for the 4 documents proxy routes
 * introduced in feat/orders-files-tab.
 *
 * Per R-19: every fixture mirrors a shape captured live from the
 * FastAPI backend on 2026-04-27 (`admin@harvesterp.com`, order
 * `de2258e0-…`). See migration log §1.5 for the curl evidence.
 *
 * Covers:
 *   GET    /api/orders/[id]/documents
 *   POST   /api/orders/[id]/documents
 *   DELETE /api/orders/[id]/documents/[doc_id]
 *   GET    /api/orders/[id]/documents/[doc_id]/download
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetToken = vi.fn<() => Promise<string | null>>();
const mockGetJson = vi.fn();
const mockDeleteJson = vi.fn();
const mockGET = vi.fn();

vi.mock("@/lib/session", () => ({
  getSessionToken: () => mockGetToken(),
}));

vi.mock("@/lib/api-server", () => ({
  getServerClient: async () => ({
    getJson: mockGetJson,
    deleteJson: mockDeleteJson,
    GET: mockGET,
  }),
}));

import { GET as listDocs, POST as uploadDoc } from "../../src/app/api/orders/[id]/documents/route";
import { DELETE as deleteDoc } from "../../src/app/api/orders/[id]/documents/[doc_id]/route";
import { GET as downloadDoc } from "../../src/app/api/orders/[id]/documents/[doc_id]/download/route";

function makeReq(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url), init);
}

function ctx(p: { id: string; doc_id?: string }) {
  return { params: Promise.resolve(p) };
}

beforeEach(() => {
  // resetAllMocks (not clearAllMocks) — drops the mockResolvedValueOnce
  // queue so role-gate-denied tests don't bleed leftover values into
  // subsequent tests. Same gotcha noted in orders-dashboard-proxy.test.ts.
  vi.resetAllMocks();
  mockGetToken.mockResolvedValue("tok");
});

// ── Verified-live fixtures (R-19 captured 2026-04-27) ────────────────────────

/** GET list — populated case from `f6aed7d0` after upload. */
const DOCS_LIST_FIXTURE = [
  {
    id: "f6aed7d0-86ea-4b68-b01d-09b6795254cf",
    order_id: "de2258e0-34f5-4fd3-8c70-539671425eb4",
    doc_type: "PI",
    filename: "test-doc.txt",
    file_size: 35,
    uploaded_at: "2026-04-27T08:54:33.547750",
  },
];

/** POST upload response — single doc envelope. */
const UPLOAD_RESPONSE_FIXTURE = {
  id: "f6aed7d0-86ea-4b68-b01d-09b6795254cf",
  order_id: "de2258e0-34f5-4fd3-8c70-539671425eb4",
  doc_type: "PI",
  filename: "test-doc.txt",
  file_size: 35,
  uploaded_at: "2026-04-27T08:54:33.547750",
};

/** DELETE response — backend returns 200 with message body, NOT 204. */
const DELETE_RESPONSE_FIXTURE = { message: "Document deleted" };

// ── GET /api/orders/[id]/documents (list) ────────────────────────────────────

describe("GET /api/orders/[id]/documents", () => {
  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await listDocs(makeReq("http://x/api/orders/o1/documents"), ctx({ id: "o1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when order id missing", async () => {
    const res = await listDocs(
      makeReq("http://x/api/orders//documents"),
      ctx({ id: "" }),
    );
    expect(res.status).toBe(400);
  });

  it("forwards bare-array shape from upstream", async () => {
    mockGetJson.mockResolvedValueOnce(DOCS_LIST_FIXTURE);
    const res = await listDocs(makeReq("http://x/api/orders/o1/documents"), ctx({ id: "o1" }));
    expect(res.status).toBe(200);
    // Per R-19: backend URL is /api/documents/orders/{id}/, NOT
    // /api/orders/{id}/documents/. Confirmed by curl 2026-04-27.
    expect(mockGetJson).toHaveBeenCalledWith("/api/documents/orders/o1/");
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    // Per R-19: assert on `uploaded_at` (the only field unique to the
    // backend serializer that proves we got the real shape, not an
    // inferred {documents: []} envelope).
    expect(body[0]).toHaveProperty("uploaded_at");
    expect(body[0].doc_type).toBe("PI");
    expect(body[0].file_size).toBe(35);
  });

  it("forwards empty array when no documents", async () => {
    mockGetJson.mockResolvedValueOnce([]);
    const res = await listDocs(makeReq("http://x/api/orders/o1/documents"), ctx({ id: "o1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("encodes the order id in the URL", async () => {
    mockGetJson.mockResolvedValueOnce([]);
    await listDocs(
      makeReq("http://x/api/orders/weird%20id/documents"),
      ctx({ id: "weird id" }),
    );
    expect(mockGetJson).toHaveBeenCalledWith("/api/documents/orders/weird%20id/");
  });

  it("maps backend 403 to 403 with permission message", async () => {
    const err: Error & { status?: number } = new Error("nope");
    err.status = 403;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await listDocs(makeReq("http://x/api/orders/o1/documents"), ctx({ id: "o1" }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/permission/i);
  });

  it("maps backend 404 to 404", async () => {
    const err: Error & { status?: number } = new Error("missing");
    err.status = 404;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await listDocs(
      makeReq("http://x/api/orders/missing/documents"),
      ctx({ id: "missing" }),
    );
    expect(res.status).toBe(404);
  });

  it("maps backend 5xx to 502", async () => {
    const err: Error & { status?: number } = new Error("boom");
    err.status = 500;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await listDocs(makeReq("http://x/api/orders/o1/documents"), ctx({ id: "o1" }));
    expect(res.status).toBe(502);
  });
});

// ── POST /api/orders/[id]/documents (upload) ─────────────────────────────────

describe("POST /api/orders/[id]/documents", () => {
  function makeMultipartReq(url: string, body: BodyInit, ctype = "multipart/form-data; boundary=----WebKitTest") {
    return new NextRequest(new URL(url), {
      method: "POST",
      headers: { "content-type": ctype },
      body,
      // @ts-expect-error — undici-only flag required to send a streaming body in tests
      duplex: "half",
    });
  }

  function mockUpstreamResponse(opts: {
    ok: boolean;
    status: number;
    json?: unknown;
  }) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: opts.ok,
        status: opts.status,
        json: async () => opts.json ?? {},
      } as unknown as Response)),
    );
  }

  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await uploadDoc(
      makeMultipartReq("http://x/api/orders/o1/documents", "---fake"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 with permission message for FINANCE role", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "FINANCE" } });
    const res = await uploadDoc(
      makeMultipartReq("http://x/api/orders/o1/documents", "---fake"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/permission/i);
  });

  it("returns 403 for CLIENT role (admin-portal-only)", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "CLIENT" } });
    const res = await uploadDoc(
      makeMultipartReq("http://x/api/orders/o1/documents", "---fake"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 when content-type is not multipart", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "ADMIN" } });
    const res = await uploadDoc(
      makeMultipartReq(
        "http://x/api/orders/o1/documents",
        '{"foo":"bar"}',
        "application/json",
      ),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/multipart/i);
  });

  it("forwards multipart upload for ADMIN role and returns the new doc envelope", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "ADMIN" } });
    mockUpstreamResponse({ ok: true, status: 200, json: UPLOAD_RESPONSE_FIXTURE });
    const res = await uploadDoc(
      makeMultipartReq("http://x/api/orders/o1/documents", "---file-bytes---"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    // Per R-19: assert on the full backend envelope shape (uploaded_at +
    // numeric file_size + doc_type all required; the inferred {file: {...}}
    // shape would not have these top-level fields).
    expect(body.id).toBe("f6aed7d0-86ea-4b68-b01d-09b6795254cf");
    expect(body.uploaded_at).toBe("2026-04-27T08:54:33.547750");
    expect(body.file_size).toBe(35);
    expect(body.doc_type).toBe("PI");
  });

  it("returns 429 with rate-limit message on backend 429", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "ADMIN" } });
    mockUpstreamResponse({
      ok: false,
      status: 429,
      json: { detail: "Rate limit exceeded" },
    });
    const res = await uploadDoc(
      makeMultipartReq("http://x/api/orders/o1/documents", "---fake"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/rate limit/i);
  });

  it("maps upstream 5xx to 502", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "ADMIN" } });
    mockUpstreamResponse({ ok: false, status: 500, json: { detail: "boom" } });
    const res = await uploadDoc(
      makeMultipartReq("http://x/api/orders/o1/documents", "---fake"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(502);
  });
});

// ── DELETE /api/orders/[id]/documents/[doc_id] ───────────────────────────────

describe("DELETE /api/orders/[id]/documents/[doc_id]", () => {
  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await deleteDoc(
      makeReq("http://x/api/orders/o1/documents/d1", { method: "DELETE" }),
      ctx({ id: "o1", doc_id: "d1" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when doc_id missing", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "ADMIN" } });
    const res = await deleteDoc(
      makeReq("http://x/api/orders/o1/documents/", { method: "DELETE" }),
      ctx({ id: "o1", doc_id: "" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 for FINANCE role with permission message", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "FINANCE" } });
    const res = await deleteDoc(
      makeReq("http://x/api/orders/o1/documents/d1", { method: "DELETE" }),
      ctx({ id: "o1", doc_id: "d1" }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/ADMIN, OPERATIONS, or SUPER_ADMIN/i);
    // Critically: the proxy gates BEFORE forwarding upstream.
    expect(mockDeleteJson).not.toHaveBeenCalled();
  });

  it("returns 403 for CLIENT role", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "CLIENT" } });
    const res = await deleteDoc(
      makeReq("http://x/api/orders/o1/documents/d1", { method: "DELETE" }),
      ctx({ id: "o1", doc_id: "d1" }),
    );
    expect(res.status).toBe(403);
  });

  it("forwards DELETE for ADMIN and returns the message envelope", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "ADMIN" } });
    mockDeleteJson.mockResolvedValueOnce(DELETE_RESPONSE_FIXTURE);
    const res = await deleteDoc(
      makeReq("http://x/api/orders/o1/documents/d1", { method: "DELETE" }),
      ctx({ id: "o1", doc_id: "d1" }),
    );
    expect(res.status).toBe(200);
    expect(mockDeleteJson).toHaveBeenCalledWith("/api/documents/d1/");
    const body = await res.json();
    // Per R-19: assert on the EXACT message text (not just any 200) — backend
    // returns 200 with `{message: "Document deleted"}`, NOT 204 No Content
    // as the spec assumed.
    expect(body.message).toBe("Document deleted");
  });

  it("forwards DELETE for OPERATIONS role", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "OPERATIONS" } });
    mockDeleteJson.mockResolvedValueOnce(DELETE_RESPONSE_FIXTURE);
    const res = await deleteDoc(
      makeReq("http://x/api/orders/o1/documents/d1", { method: "DELETE" }),
      ctx({ id: "o1", doc_id: "d1" }),
    );
    expect(res.status).toBe(200);
  });

  it("forwards DELETE for SUPER_ADMIN role", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "SUPER_ADMIN" } });
    mockDeleteJson.mockResolvedValueOnce(DELETE_RESPONSE_FIXTURE);
    const res = await deleteDoc(
      makeReq("http://x/api/orders/o1/documents/d1", { method: "DELETE" }),
      ctx({ id: "o1", doc_id: "d1" }),
    );
    expect(res.status).toBe(200);
  });

  it("maps upstream 404 to 404", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "ADMIN" } });
    const err: Error & { status?: number } = new Error("missing");
    err.status = 404;
    mockDeleteJson.mockRejectedValueOnce(err);
    const res = await deleteDoc(
      makeReq("http://x/api/orders/o1/documents/missing", { method: "DELETE" }),
      ctx({ id: "o1", doc_id: "missing" }),
    );
    expect(res.status).toBe(404);
  });

  it("maps upstream 5xx to 502", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "ADMIN" } });
    const err: Error & { status?: number } = new Error("boom");
    err.status = 500;
    mockDeleteJson.mockRejectedValueOnce(err);
    const res = await deleteDoc(
      makeReq("http://x/api/orders/o1/documents/d1", { method: "DELETE" }),
      ctx({ id: "o1", doc_id: "d1" }),
    );
    expect(res.status).toBe(502);
  });
});

// ── GET /api/orders/[id]/documents/[doc_id]/download ─────────────────────────

describe("GET /api/orders/[id]/documents/[doc_id]/download", () => {
  function mockUpstreamBinary(opts: {
    ok: boolean;
    status: number;
    body?: ArrayBuffer;
    headers?: Record<string, string>;
    jsonError?: { detail?: string };
  }) {
    const headers = new Headers(opts.headers ?? {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: opts.ok,
        status: opts.status,
        headers,
        arrayBuffer: async () => opts.body ?? new ArrayBuffer(0),
        json: async () => opts.jsonError ?? {},
      } as unknown as Response)),
    );
  }

  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await downloadDoc(
      makeReq("http://x/api/orders/o1/documents/d1/download"),
      ctx({ id: "o1", doc_id: "d1" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when doc_id missing", async () => {
    const res = await downloadDoc(
      makeReq("http://x/api/orders/o1/documents//download"),
      ctx({ id: "o1", doc_id: "" }),
    );
    expect(res.status).toBe(400);
  });

  it("streams binary body with Content-Type + Content-Disposition preserved", async () => {
    const body = new TextEncoder().encode("file-bytes-here").buffer;
    mockUpstreamBinary({
      ok: true,
      status: 200,
      body,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": 'attachment; filename="test-doc.txt"',
      },
    });
    const res = await downloadDoc(
      makeReq("http://x/api/orders/o1/documents/d1/download"),
      ctx({ id: "o1", doc_id: "d1" }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    // Per R-19: backend sets `attachment; filename="<original>"` —
    // proxy must pass through verbatim so useBlobDownload picks up the
    // original filename instead of falling back to the generic name.
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="test-doc.txt"',
    );
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("uses fallback filename when upstream omits Content-Disposition", async () => {
    mockUpstreamBinary({
      ok: true,
      status: 200,
      body: new ArrayBuffer(8),
      headers: { "Content-Type": "application/octet-stream" },
    });
    const res = await downloadDoc(
      makeReq("http://x/api/orders/o1/documents/abc/download"),
      ctx({ id: "o1", doc_id: "abc" }),
    );
    expect(res.headers.get("Content-Disposition")).toMatch(/document-abc\.bin/);
  });

  it("propagates upstream 403 with detail message", async () => {
    mockUpstreamBinary({
      ok: false,
      status: 403,
      jsonError: { detail: "Access denied" },
    });
    const res = await downloadDoc(
      makeReq("http://x/api/orders/o1/documents/d1/download"),
      ctx({ id: "o1", doc_id: "d1" }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/access denied/i);
  });

  it("propagates upstream 404 (file gone from disk)", async () => {
    mockUpstreamBinary({
      ok: false,
      status: 404,
      jsonError: { detail: "File not found on disk" },
    });
    const res = await downloadDoc(
      makeReq("http://x/api/orders/o1/documents/d1/download"),
      ctx({ id: "o1", doc_id: "d1" }),
    );
    expect(res.status).toBe(404);
  });

  it("maps network error to 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("net down");
      }),
    );
    const res = await downloadDoc(
      makeReq("http://x/api/orders/o1/documents/d1/download"),
      ctx({ id: "o1", doc_id: "d1" }),
    );
    expect(res.status).toBe(502);
  });
});
