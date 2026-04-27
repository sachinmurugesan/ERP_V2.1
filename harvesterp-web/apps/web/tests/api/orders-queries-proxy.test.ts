/**
 * orders-queries-proxy.test.ts — Tests for the queries-tab proxy
 * routes added in feat/orders-queries-tab (Tier 1).
 *
 * Per R-19: every fixture mirrors a shape captured live from the
 * FastAPI backend on 2026-04-27 (`admin@harvesterp.com`, order
 * `de2258e0-…`). See migration log §1.5 for the curl evidence.
 *
 * Covers:
 *   GET    /api/orders/[id]/queries
 *   POST   /api/orders/[id]/queries
 *   GET    /api/orders/[id]/queries/[qid]
 *   DELETE /api/orders/[id]/queries/[qid]            (D-005 gated)
 *   POST   /api/orders/[id]/queries/[qid]/replies
 *   PUT    /api/orders/[id]/queries/[qid]/resolve
 *   PUT    /api/orders/[id]/queries/[qid]/reopen
 *   PUT    /api/notifications/mark-read-by-resource
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetToken = vi.fn<() => Promise<string | null>>();
const mockGetJson = vi.fn();
const mockPostJson = vi.fn();
const mockPutJson = vi.fn();
const mockDeleteJson = vi.fn();
const mockGET = vi.fn();

vi.mock("@/lib/session", () => ({
  getSessionToken: () => mockGetToken(),
}));

vi.mock("@/lib/api-server", () => ({
  getServerClient: async () => ({
    getJson: mockGetJson,
    postJson: mockPostJson,
    putJson: mockPutJson,
    deleteJson: mockDeleteJson,
    GET: mockGET,
  }),
}));

import {
  GET as listQueries,
  POST as createQuery,
} from "../../src/app/api/orders/[id]/queries/route";
import {
  GET as getQuery,
  DELETE as deleteQuery,
} from "../../src/app/api/orders/[id]/queries/[query_id]/route";
import { POST as replyToQuery } from "../../src/app/api/orders/[id]/queries/[query_id]/replies/route";
import { PUT as resolveQuery } from "../../src/app/api/orders/[id]/queries/[query_id]/resolve/route";
import { PUT as reopenQuery } from "../../src/app/api/orders/[id]/queries/[query_id]/reopen/route";
import { PUT as markRead } from "../../src/app/api/notifications/mark-read-by-resource/route";

function makeReq(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url), init);
}

function ctx(p: { id?: string; query_id?: string }) {
  return { params: Promise.resolve(p) };
}

beforeEach(() => {
  vi.resetAllMocks();
  mockGetToken.mockResolvedValue("tok");
});

// ── Verified-live fixtures (R-19, 2026-04-27) ───────────────────────────────

const QUERY_FIXTURE = {
  id: "abad4ad5-2a7d-431e-a801-5eebb0629d57",
  order_id: "de2258e0-34f5-4fd3-8c70-539671425eb4",
  order_item_id: null,
  product_id: null,
  query_type: "GENERAL" as const,
  status: "OPEN" as const,
  subject: "Test query for R-19",
  created_by_id: "4d878430-a76c-46d1-a083-d692c37c978f",
  created_by_role: "INTERNAL",
  created_at: "2026-04-27T10:06:05.673357",
  updated_at: null,
  resolved_at: null,
  resolution_remark: null,
  messages: [
    {
      id: "c56cdfde-17ef-4d02-bc0e-3f725947d24c",
      query_id: "abad4ad5-2a7d-431e-a801-5eebb0629d57",
      sender_id: "4d878430-a76c-46d1-a083-d692c37c978f",
      sender_role: "INTERNAL",
      sender_name: "admin@harvesterp.com",
      message: "Body of the question",
      attachments: null,
      created_at: "2026-04-27T10:06:05.704268",
    },
  ],
  product_code: null,
  product_name: null,
  message_count: 1,
  last_message_at: "2026-04-27T10:06:05.704268",
};

// ── GET /queries (list) ──────────────────────────────────────────────────────

describe("GET /api/orders/[id]/queries (list)", () => {
  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await listQueries(
      makeReq("http://x/api/orders/o1/queries"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when order id missing", async () => {
    const res = await listQueries(
      makeReq("http://x/api/orders//queries"),
      ctx({ id: "" }),
    );
    expect(res.status).toBe(400);
  });

  it("forwards bare-array shape on populated case", async () => {
    mockGetJson.mockResolvedValueOnce([QUERY_FIXTURE]);
    const res = await listQueries(
      makeReq("http://x/api/orders/o1/queries"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(200);
    expect(mockGetJson).toHaveBeenCalledWith("/api/orders/o1/queries/");
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    // Per R-19: assert on `messages` array + `message_count` (the
    // wrapper fields unique to backend reality — an inferred
    // {queries:[]} shape would not have these).
    expect(body[0].messages).toHaveLength(1);
    expect(body[0].message_count).toBe(1);
    expect(body[0].query_type).toBe("GENERAL");
  });

  it("returns empty array when no queries", async () => {
    mockGetJson.mockResolvedValueOnce([]);
    const res = await listQueries(
      makeReq("http://x/api/orders/o1/queries"),
      ctx({ id: "o1" }),
    );
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("encodes order id in upstream URL", async () => {
    mockGetJson.mockResolvedValueOnce([]);
    await listQueries(
      makeReq("http://x/api/orders/weird%20id/queries"),
      ctx({ id: "weird id" }),
    );
    expect(mockGetJson).toHaveBeenCalledWith(
      "/api/orders/weird%20id/queries/",
    );
  });

  it("maps backend 403 to 403 with permission message", async () => {
    const err: Error & { status?: number } = new Error("nope");
    err.status = 403;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await listQueries(
      makeReq("http://x/api/orders/o1/queries"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(403);
  });

  it("maps backend 404 to 404", async () => {
    const err: Error & { status?: number } = new Error("missing");
    err.status = 404;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await listQueries(
      makeReq("http://x/api/orders/missing/queries"),
      ctx({ id: "missing" }),
    );
    expect(res.status).toBe(404);
  });

  it("maps backend 5xx to 502", async () => {
    const err: Error & { status?: number } = new Error("boom");
    err.status = 500;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await listQueries(
      makeReq("http://x/api/orders/o1/queries"),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(502);
  });
});

// ── POST /queries (create) ───────────────────────────────────────────────────

describe("POST /api/orders/[id]/queries (create)", () => {
  function postReq(body: object) {
    return makeReq("http://x/api/orders/o1/queries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await createQuery(
      postReq({ subject: "hi", message: "hi" }),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when subject missing", async () => {
    const res = await createQuery(
      postReq({ message: "hi" }),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when message missing", async () => {
    const res = await createQuery(
      postReq({ subject: "hi" }),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(400);
  });

  it("forwards subject + message + default query_type=GENERAL", async () => {
    mockPostJson.mockResolvedValueOnce(QUERY_FIXTURE);
    const res = await createQuery(
      postReq({ subject: "Test", message: "Body" }),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(200);
    expect(mockPostJson).toHaveBeenCalledWith(
      "/api/orders/o1/queries/",
      expect.objectContaining({
        subject: "Test",
        message: "Body",
        query_type: "GENERAL",
      }),
    );
    const body = await res.json();
    // Per R-19: assert on full envelope, including message_count and
    // last_message_at — proves we're forwarding the real backend shape.
    expect(body.message_count).toBe(1);
    expect(body.last_message_at).toBe("2026-04-27T10:06:05.704268");
  });

  it("forwards explicit query_type when provided", async () => {
    mockPostJson.mockResolvedValueOnce(QUERY_FIXTURE);
    await createQuery(
      postReq({
        subject: "Test",
        message: "Body",
        query_type: "PHOTO_REQUEST",
      }),
      ctx({ id: "o1" }),
    );
    expect(mockPostJson).toHaveBeenCalledWith(
      "/api/orders/o1/queries/",
      expect.objectContaining({ query_type: "PHOTO_REQUEST" }),
    );
  });

  it("trims whitespace from subject and message", async () => {
    mockPostJson.mockResolvedValueOnce(QUERY_FIXTURE);
    await createQuery(
      postReq({ subject: "  Test  ", message: "  Body  " }),
      ctx({ id: "o1" }),
    );
    expect(mockPostJson).toHaveBeenCalledWith(
      "/api/orders/o1/queries/",
      expect.objectContaining({ subject: "Test", message: "Body" }),
    );
  });

  it("rejects subject of only whitespace", async () => {
    const res = await createQuery(
      postReq({ subject: "   ", message: "Body" }),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(400);
  });

  it("maps upstream 403 to 403", async () => {
    const err: Error & { status?: number } = new Error("nope");
    err.status = 403;
    mockPostJson.mockRejectedValueOnce(err);
    const res = await createQuery(
      postReq({ subject: "Test", message: "Body" }),
      ctx({ id: "o1" }),
    );
    expect(res.status).toBe(403);
  });
});

// ── GET /queries/[qid] (single) ──────────────────────────────────────────────

describe("GET /api/orders/[id]/queries/[query_id]", () => {
  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await getQuery(
      makeReq("http://x/api/orders/o1/queries/q1"),
      ctx({ id: "o1", query_id: "q1" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when query id missing", async () => {
    const res = await getQuery(
      makeReq("http://x/api/orders/o1/queries/"),
      ctx({ id: "o1", query_id: "" }),
    );
    expect(res.status).toBe(400);
  });

  it("forwards full envelope shape", async () => {
    mockGetJson.mockResolvedValueOnce(QUERY_FIXTURE);
    const res = await getQuery(
      makeReq("http://x/api/orders/o1/queries/q1"),
      ctx({ id: "o1", query_id: "q1" }),
    );
    expect(res.status).toBe(200);
    expect(mockGetJson).toHaveBeenCalledWith("/api/orders/o1/queries/q1/");
    const body = await res.json();
    expect(body.subject).toBe("Test query for R-19");
    expect(body.messages).toHaveLength(1);
  });

  it("maps backend 404 to 404", async () => {
    const err: Error & { status?: number } = new Error("missing");
    err.status = 404;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getQuery(
      makeReq("http://x/api/orders/o1/queries/missing"),
      ctx({ id: "o1", query_id: "missing" }),
    );
    expect(res.status).toBe(404);
  });
});

// ── DELETE /queries/[qid] (role-gated) ───────────────────────────────────────

describe("DELETE /api/orders/[id]/queries/[query_id]", () => {
  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await deleteQuery(
      makeReq("http://x/api/orders/o1/queries/q1", { method: "DELETE" }),
      ctx({ id: "o1", query_id: "q1" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 403 with permission message for FINANCE role", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "FINANCE" } });
    const res = await deleteQuery(
      makeReq("http://x/api/orders/o1/queries/q1", { method: "DELETE" }),
      ctx({ id: "o1", query_id: "q1" }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/ADMIN, OPERATIONS, or SUPER_ADMIN/i);
    expect(mockDeleteJson).not.toHaveBeenCalled();
  });

  it("returns 403 for CLIENT role (admin-portal-only)", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "CLIENT" } });
    const res = await deleteQuery(
      makeReq("http://x/api/orders/o1/queries/q1", { method: "DELETE" }),
      ctx({ id: "o1", query_id: "q1" }),
    );
    expect(res.status).toBe(403);
  });

  it("forwards DELETE for ADMIN and returns deleted envelope", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "ADMIN" } });
    mockDeleteJson.mockResolvedValueOnce({ deleted: true, id: "q1" });
    const res = await deleteQuery(
      makeReq("http://x/api/orders/o1/queries/q1", { method: "DELETE" }),
      ctx({ id: "o1", query_id: "q1" }),
    );
    expect(res.status).toBe(200);
    expect(mockDeleteJson).toHaveBeenCalledWith("/api/orders/o1/queries/q1/");
    const body = await res.json();
    // Per R-19: backend returns `{deleted: true, id}` — NOT 204, NOT
    // the documents-style `{message: "..."}`. Different convention,
    // assert the exact shape.
    expect(body.deleted).toBe(true);
    expect(body.id).toBe("q1");
  });

  it("forwards DELETE for OPERATIONS role", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "OPERATIONS" } });
    mockDeleteJson.mockResolvedValueOnce({ deleted: true, id: "q1" });
    const res = await deleteQuery(
      makeReq("http://x/api/orders/o1/queries/q1", { method: "DELETE" }),
      ctx({ id: "o1", query_id: "q1" }),
    );
    expect(res.status).toBe(200);
  });

  it("forwards DELETE for SUPER_ADMIN role", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "SUPER_ADMIN" } });
    mockDeleteJson.mockResolvedValueOnce({ deleted: true, id: "q1" });
    const res = await deleteQuery(
      makeReq("http://x/api/orders/o1/queries/q1", { method: "DELETE" }),
      ctx({ id: "o1", query_id: "q1" }),
    );
    expect(res.status).toBe(200);
  });

  it("maps upstream 404 to 404", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "ADMIN" } });
    const err: Error & { status?: number } = new Error("missing");
    err.status = 404;
    mockDeleteJson.mockRejectedValueOnce(err);
    const res = await deleteQuery(
      makeReq("http://x/api/orders/o1/queries/missing", { method: "DELETE" }),
      ctx({ id: "o1", query_id: "missing" }),
    );
    expect(res.status).toBe(404);
  });
});

// ── POST /queries/[qid]/replies ──────────────────────────────────────────────

describe("POST /api/orders/[id]/queries/[query_id]/replies", () => {
  function replyReq(body: object) {
    return makeReq("http://x/api/orders/o1/queries/q1/replies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await replyToQuery(
      replyReq({ message: "hi" }),
      ctx({ id: "o1", query_id: "q1" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when message missing", async () => {
    const res = await replyToQuery(
      replyReq({}),
      ctx({ id: "o1", query_id: "q1" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects whitespace-only messages", async () => {
    const res = await replyToQuery(
      replyReq({ message: "   " }),
      ctx({ id: "o1", query_id: "q1" }),
    );
    expect(res.status).toBe(400);
  });

  it("forwards message to upstream `/reply/` (singular) and returns envelope", async () => {
    mockPostJson.mockResolvedValueOnce({
      ...QUERY_FIXTURE,
      message_count: 2,
    });
    const res = await replyToQuery(
      replyReq({ message: "Reply body" }),
      ctx({ id: "o1", query_id: "q1" }),
    );
    expect(res.status).toBe(200);
    // Backend URL is /reply/ (singular) — proxy URL is /replies/ (plural).
    expect(mockPostJson).toHaveBeenCalledWith(
      "/api/orders/o1/queries/q1/reply/",
      { message: "Reply body" },
    );
    const body = await res.json();
    // Per R-19: backend returns the FULL UPDATED ENVELOPE, not just
    // the new message. message_count incremented confirms it.
    expect(body.message_count).toBe(2);
  });

  it("trims message before forwarding", async () => {
    mockPostJson.mockResolvedValueOnce(QUERY_FIXTURE);
    await replyToQuery(
      replyReq({ message: "  hi  " }),
      ctx({ id: "o1", query_id: "q1" }),
    );
    expect(mockPostJson).toHaveBeenCalledWith(
      "/api/orders/o1/queries/q1/reply/",
      { message: "hi" },
    );
  });

  it("maps upstream 404 to 404", async () => {
    const err: Error & { status?: number } = new Error("missing");
    err.status = 404;
    mockPostJson.mockRejectedValueOnce(err);
    const res = await replyToQuery(
      replyReq({ message: "hi" }),
      ctx({ id: "o1", query_id: "missing" }),
    );
    expect(res.status).toBe(404);
  });
});

// ── PUT /queries/[qid]/resolve (?remark=... query-param translation) ────────

describe("PUT /api/orders/[id]/queries/[query_id]/resolve", () => {
  function putReq(body: object | null) {
    return makeReq("http://x/api/orders/o1/queries/q1/resolve", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  function mockUpstream(opts: { ok: boolean; status: number; json?: unknown }) {
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
    const res = await resolveQuery(
      putReq({ remark: "ok" }),
      ctx({ id: "o1", query_id: "q1" }),
    );
    expect(res.status).toBe(401);
  });

  it("translates JSON body remark to backend `?remark=` query param", async () => {
    let calledUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calledUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => ({ ...QUERY_FIXTURE, status: "RESOLVED" }),
        } as unknown as Response;
      }),
    );
    const res = await resolveQuery(
      putReq({ remark: "All good" }),
      ctx({ id: "o1", query_id: "q1" }),
    );
    expect(res.status).toBe(200);
    // Per R-19: backend takes `remark` as a query param, NOT a body
    // field. Proxy must translate.
    expect(calledUrl).toContain("/queries/q1/resolve/?remark=All%20good");
    const body = await res.json();
    expect(body.status).toBe("RESOLVED");
  });

  it("accepts empty body (remark optional)", async () => {
    let calledUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calledUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => QUERY_FIXTURE,
        } as unknown as Response;
      }),
    );
    const res = await resolveQuery(
      putReq(null),
      ctx({ id: "o1", query_id: "q1" }),
    );
    expect(res.status).toBe(200);
    expect(calledUrl).toContain("/queries/q1/resolve/?remark=");
  });

  it("propagates upstream 403", async () => {
    mockUpstream({ ok: false, status: 403, json: { detail: "Access denied" } });
    const res = await resolveQuery(
      putReq({ remark: "x" }),
      ctx({ id: "o1", query_id: "q1" }),
    );
    expect(res.status).toBe(403);
  });

  it("propagates upstream 404", async () => {
    mockUpstream({ ok: false, status: 404, json: { detail: "Query not found" } });
    const res = await resolveQuery(
      putReq({ remark: "x" }),
      ctx({ id: "o1", query_id: "missing" }),
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
    const res = await resolveQuery(
      putReq({ remark: "x" }),
      ctx({ id: "o1", query_id: "q1" }),
    );
    expect(res.status).toBe(502);
  });
});

// ── PUT /queries/[qid]/reopen ────────────────────────────────────────────────

describe("PUT /api/orders/[id]/queries/[query_id]/reopen", () => {
  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await reopenQuery(
      makeReq("http://x/api/orders/o1/queries/q1/reopen", { method: "PUT" }),
      ctx({ id: "o1", query_id: "q1" }),
    );
    expect(res.status).toBe(401);
  });

  it("forwards PUT and returns OPEN envelope", async () => {
    mockPutJson.mockResolvedValueOnce({ ...QUERY_FIXTURE, status: "OPEN" });
    const res = await reopenQuery(
      makeReq("http://x/api/orders/o1/queries/q1/reopen", { method: "PUT" }),
      ctx({ id: "o1", query_id: "q1" }),
    );
    expect(res.status).toBe(200);
    expect(mockPutJson).toHaveBeenCalledWith(
      "/api/orders/o1/queries/q1/reopen/",
      {},
    );
    const body = await res.json();
    expect(body.status).toBe("OPEN");
  });

  it("maps backend 404 to 404", async () => {
    const err: Error & { status?: number } = new Error("missing");
    err.status = 404;
    mockPutJson.mockRejectedValueOnce(err);
    const res = await reopenQuery(
      makeReq("http://x/api/orders/o1/queries/missing/reopen", {
        method: "PUT",
      }),
      ctx({ id: "o1", query_id: "missing" }),
    );
    expect(res.status).toBe(404);
  });
});

// ── PUT /api/notifications/mark-read-by-resource ─────────────────────────────

describe("PUT /api/notifications/mark-read-by-resource", () => {
  function markReq(body: object) {
    return makeReq("http://x/api/notifications/mark-read-by-resource", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await markRead(
      markReq({ resource_type: "order", resource_id: "o1" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when resource_type missing", async () => {
    const res = await markRead(markReq({ resource_id: "o1" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when resource_id missing", async () => {
    const res = await markRead(markReq({ resource_type: "order" }));
    expect(res.status).toBe(400);
  });

  it("translates body to backend query params + returns marked_read count", async () => {
    let calledUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calledUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => ({ marked_read: 3 }),
        } as unknown as Response;
      }),
    );
    const res = await markRead(
      markReq({
        resource_type: "order",
        resource_id: "o1",
        notification_type: "ITEM_QUERY_REPLY",
      }),
    );
    expect(res.status).toBe(200);
    // Per R-19: backend wants resource_type + resource_id +
    // notification_type as URL query params, not a JSON body.
    expect(calledUrl).toContain("resource_type=order");
    expect(calledUrl).toContain("resource_id=o1");
    expect(calledUrl).toContain("notification_type=ITEM_QUERY_REPLY");
    const body = await res.json();
    expect(body.marked_read).toBe(3);
  });

  it("omits notification_type query param when not provided", async () => {
    let calledUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calledUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => ({ marked_read: 0 }),
        } as unknown as Response;
      }),
    );
    await markRead(markReq({ resource_type: "order", resource_id: "o1" }));
    expect(calledUrl).toContain("resource_type=order");
    expect(calledUrl).not.toContain("notification_type");
  });

  it("maps upstream 5xx to 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ detail: "boom" }),
      } as unknown as Response)),
    );
    const res = await markRead(
      markReq({ resource_type: "order", resource_id: "o1" }),
    );
    expect(res.status).toBe(502);
  });
});
