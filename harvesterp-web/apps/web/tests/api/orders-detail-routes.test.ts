/**
 * orders-detail-routes.test.ts — Tests for the new order-detail proxy routes
 * added in the orders-foundation PR.
 *
 * Covers:
 *   GET    /api/orders/[id]            — full order detail
 *   GET    /api/orders/[id]/timeline   — stage history
 *   GET    /api/orders/[id]/next-stages — valid forward transitions
 *   PUT    /api/orders/[id]/transition  — role-gated stage move (research §5.5)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetToken = vi.fn<() => Promise<string | null>>();
const mockGetJson = vi.fn();
const mockPutJson = vi.fn();
const mockDeleteJson = vi.fn();
const mockGET = vi.fn();

vi.mock("@/lib/session", () => ({
  getSessionToken: () => mockGetToken(),
}));

vi.mock("@/lib/api-server", () => ({
  getServerClient: async () => ({
    getJson: mockGetJson,
    putJson: mockPutJson,
    deleteJson: mockDeleteJson,
    GET: mockGET,
  }),
}));

import { GET as getOrder } from "../../src/app/api/orders/[id]/route";
import { GET as getTimeline } from "../../src/app/api/orders/[id]/timeline/route";
import { GET as getNextStages } from "../../src/app/api/orders/[id]/next-stages/route";
import { PUT as transitionOrder } from "../../src/app/api/orders/[id]/transition/route";
import { PUT as goBackOrder } from "../../src/app/api/orders/[id]/go-back/route";
import { PUT as jumpToStageOrder } from "../../src/app/api/orders/[id]/jump-to-stage/route";

function makeRequest(url: string, init?: RequestInit) {
  return new NextRequest(new URL(url), init);
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetToken.mockResolvedValue("tok");
});

// ── GET /api/orders/[id] ─────────────────────────────────────────────────────

describe("GET /api/orders/[id]", () => {
  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await getOrder(makeRequest("http://x/api/orders/o1"), ctx("o1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when id missing", async () => {
    const res = await getOrder(makeRequest("http://x/api/orders/"), ctx(""));
    expect(res.status).toBe(400);
  });

  it("forwards to backend and returns the order JSON", async () => {
    mockGetJson.mockResolvedValueOnce({
      id: "o1",
      order_number: "ORD-100",
      stage_number: 5,
      stage_name: "Factory Ordered",
      status: "FACTORY_ORDERED",
      client_id: "c1",
      factory_id: "f1",
      total_value_cny: 100000,
      created_at: "2026-04-26T00:00:00",
    });
    const res = await getOrder(
      makeRequest("http://x/api/orders/o1"),
      ctx("o1"),
    );
    expect(res.status).toBe(200);
    expect(mockGetJson).toHaveBeenCalledWith("/api/orders/o1/");
    const body = await res.json();
    expect(body.id).toBe("o1");
    expect(body.stage_number).toBe(5);
  });

  it("encodes the order id in the URL", async () => {
    mockGetJson.mockResolvedValueOnce({
      id: "weird id",
      stage_number: 1,
      stage_name: "Draft",
      status: "DRAFT",
      created_at: "2026-04-26T00:00:00",
    });
    await getOrder(
      makeRequest("http://x/api/orders/weird%20id"),
      ctx("weird id"),
    );
    expect(mockGetJson).toHaveBeenCalledWith("/api/orders/weird%20id/");
  });

  it("maps backend 403 to 403 with permission message", async () => {
    const err: Error & { status?: number } = new Error("nope");
    err.status = 403;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getOrder(makeRequest("http://x/api/orders/o1"), ctx("o1"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/permission/i);
  });

  it("maps backend 404 to 404", async () => {
    const err: Error & { status?: number } = new Error("missing");
    err.status = 404;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getOrder(
      makeRequest("http://x/api/orders/missing"),
      ctx("missing"),
    );
    expect(res.status).toBe(404);
  });

  it("maps backend 5xx to 502", async () => {
    const err: Error & { status?: number } = new Error("boom");
    err.status = 500;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getOrder(makeRequest("http://x/api/orders/o1"), ctx("o1"));
    expect(res.status).toBe(502);
  });
});

// ── GET /api/orders/[id]/timeline ────────────────────────────────────────────

describe("GET /api/orders/[id]/timeline", () => {
  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await getTimeline(
      makeRequest("http://x/api/orders/o1/timeline"),
      ctx("o1"),
    );
    expect(res.status).toBe(401);
  });

  it("forwards backend's wrapped envelope (timeline + overrides + context) verbatim", async () => {
    // Backend's actual live shape — verified 2026-04-26 — NOT { events: [...] }.
    mockGetJson.mockResolvedValueOnce({
      current_status: "DRAFT",
      current_stage: 1,
      current_name: "Draft",
      timeline: [
        { stage: 1, name: "Draft", status: "current" },
        { stage: 2, name: "Pending PI", status: "pending" },
      ],
      overrides: [{ stage: 3, reason: "Skipped per ops manager" }],
    });
    const res = await getTimeline(
      makeRequest("http://x/api/orders/o1/timeline"),
      ctx("o1"),
    );
    expect(res.status).toBe(200);
    expect(mockGetJson).toHaveBeenCalledWith("/api/orders/o1/timeline/");
    const body = await res.json();
    // The proxy MUST pass the wrapped envelope through, NOT { events: [...] }.
    expect(body.timeline).toHaveLength(2);
    expect(body.timeline[0]).toEqual({ stage: 1, name: "Draft", status: "current" });
    expect(body.overrides).toHaveLength(1);
    expect(body.current_status).toBe("DRAFT");
    expect(body.current_stage).toBe(1);
    expect(body.current_name).toBe("Draft");
    // The legacy `{events: [...]}` field MUST NOT be added back.
    expect(body.events).toBeUndefined();
  });

  it("defaults overrides to [] when backend omits the field", async () => {
    mockGetJson.mockResolvedValueOnce({
      current_status: "DRAFT",
      current_stage: 1,
      current_name: "Draft",
      timeline: [{ stage: 1, name: "Draft", status: "current" }],
      // no `overrides` field
    });
    const res = await getTimeline(
      makeRequest("http://x/api/orders/o1/timeline"),
      ctx("o1"),
    );
    const body = await res.json();
    expect(body.overrides).toEqual([]);
  });

  it("maps backend 404 to 404", async () => {
    const err: Error & { status?: number } = new Error("nope");
    err.status = 404;
    mockGetJson.mockRejectedValueOnce(err);
    const res = await getTimeline(
      makeRequest("http://x/api/orders/missing/timeline"),
      ctx("missing"),
    );
    expect(res.status).toBe(404);
  });
});

// ── GET /api/orders/[id]/next-stages ─────────────────────────────────────────

describe("GET /api/orders/[id]/next-stages", () => {
  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await getNextStages(
      makeRequest("http://x/api/orders/o1/next-stages"),
      ctx("o1"),
    );
    expect(res.status).toBe(401);
  });

  it("forwards backend's full 7-field envelope (4 stage lists + context) verbatim", async () => {
    // Backend's actual live shape — verified 2026-04-26 — NOT { options: [...] }.
    mockGetJson.mockResolvedValueOnce({
      current_status: "DRAFT",
      current_stage: [1, "Draft"],
      next_stages: [{ status: "PENDING_PI", stage: 2, name: "Pending PI" }],
      prev_stage: null,
      reachable_previous: [],
      reachable_forward: [
        { status: "PRODUCTION_60", stage: 6, name: "Production 60%" },
      ],
      highest_unlocked_stage: 6,
    });
    const res = await getNextStages(
      makeRequest("http://x/api/orders/o1/next-stages"),
      ctx("o1"),
    );
    expect(res.status).toBe(200);
    expect(mockGetJson).toHaveBeenCalledWith("/api/orders/o1/next-stages/");
    const body = await res.json();
    expect(body.current_status).toBe("DRAFT");
    expect(body.current_stage).toEqual([1, "Draft"]);
    expect(body.next_stages).toHaveLength(1);
    expect(body.next_stages[0].status).toBe("PENDING_PI");
    expect(body.prev_stage).toBeNull();
    expect(body.reachable_previous).toEqual([]);
    expect(body.reachable_forward).toHaveLength(1);
    expect(body.reachable_forward[0].stage).toBe(6);
    expect(body.highest_unlocked_stage).toBe(6);
    // Legacy `{options: [...]}` MUST NOT be added back.
    expect(body.options).toBeUndefined();
  });

  it("defaults the four list fields to [] / null when backend omits them", async () => {
    mockGetJson.mockResolvedValueOnce({
      current_status: "DRAFT",
      current_stage: [1, "Draft"],
      // no next_stages, prev_stage, reachable_previous, reachable_forward, highest_unlocked_stage
    });
    const res = await getNextStages(
      makeRequest("http://x/api/orders/o1/next-stages"),
      ctx("o1"),
    );
    const body = await res.json();
    expect(body.next_stages).toEqual([]);
    expect(body.prev_stage).toBeNull();
    expect(body.reachable_previous).toEqual([]);
    expect(body.reachable_forward).toEqual([]);
    expect(body.highest_unlocked_stage).toBeNull();
  });
});

// ── PUT /api/orders/[id]/transition (role-gated) ─────────────────────────────

describe("PUT /api/orders/[id]/transition", () => {
  function makeBodyRequest(role: string, body: unknown) {
    mockGET.mockResolvedValueOnce({ data: { role } });
    return makeRequest("http://x/api/orders/o1/transition", {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await transitionOrder(
      makeRequest("http://x/api/orders/o1/transition", {
        method: "PUT",
        body: JSON.stringify({ target_status: "PI_SENT" }),
      }),
      ctx("o1"),
    );
    expect(res.status).toBe(401);
  });

  it("ADMIN role: forwards target_status as a QUERY PARAM (not body field), body has only acknowledge_warnings", async () => {
    mockPutJson.mockResolvedValueOnce({ ok: true });
    const res = await transitionOrder(
      makeBodyRequest("ADMIN", { target_status: "PI_SENT" }),
      ctx("o1"),
    );
    expect(res.status).toBe(200);
    // URL contains target_status as query string — NOT in body.
    expect(mockPutJson).toHaveBeenCalledWith(
      "/api/orders/o1/transition/?target_status=PI_SENT",
      expect.objectContaining({ acknowledge_warnings: false }),
    );
    // Body sent to backend MUST NOT contain target_status.
    const upstreamBody = mockPutJson.mock.calls[0][1] as Record<string, unknown>;
    expect(upstreamBody).not.toHaveProperty("target_status");
  });

  it("forwards transition_reason in body when provided", async () => {
    mockPutJson.mockResolvedValueOnce({ ok: true });
    await transitionOrder(
      makeBodyRequest("ADMIN", {
        target_status: "PI_SENT",
        acknowledge_warnings: true,
        transition_reason: "Underpayment acknowledged",
      }),
      ctx("o1"),
    );
    expect(mockPutJson).toHaveBeenCalledWith(
      "/api/orders/o1/transition/?target_status=PI_SENT",
      {
        acknowledge_warnings: true,
        transition_reason: "Underpayment acknowledged",
      },
    );
  });

  it("encodes the target_status query value (e.g. statuses with spaces)", async () => {
    mockPutJson.mockResolvedValueOnce({ ok: true });
    await transitionOrder(
      makeBodyRequest("ADMIN", { target_status: "PRODUCTION 60" }),
      ctx("o1"),
    );
    expect(mockPutJson).toHaveBeenCalledWith(
      "/api/orders/o1/transition/?target_status=PRODUCTION%2060",
      expect.any(Object),
    );
  });

  it("OPERATIONS role: forwards to backend (allowed)", async () => {
    mockPutJson.mockResolvedValueOnce({ ok: true });
    const res = await transitionOrder(
      makeBodyRequest("OPERATIONS", { target_status: "PI_SENT" }),
      ctx("o1"),
    );
    expect(res.status).toBe(200);
    expect(mockPutJson).toHaveBeenCalled();
  });

  it("SUPER_ADMIN role: forwards to backend (allowed)", async () => {
    mockPutJson.mockResolvedValueOnce({ ok: true });
    const res = await transitionOrder(
      makeBodyRequest("SUPER_ADMIN", { target_status: "PI_SENT" }),
      ctx("o1"),
    );
    expect(res.status).toBe(200);
  });

  it("FINANCE role: returns 403 (denied at proxy gate)", async () => {
    const res = await transitionOrder(
      makeBodyRequest("FINANCE", { target_status: "PI_SENT" }),
      ctx("o1"),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/permission|don't have/i);
    // Backend was NOT called — gate caught it.
    expect(mockPutJson).not.toHaveBeenCalled();
  });

  it("CLIENT role: returns 403", async () => {
    const res = await transitionOrder(
      makeBodyRequest("CLIENT", { target_status: "PI_SENT" }),
      ctx("o1"),
    );
    expect(res.status).toBe(403);
    expect(mockPutJson).not.toHaveBeenCalled();
  });

  it("FACTORY role: returns 403", async () => {
    const res = await transitionOrder(
      makeBodyRequest("FACTORY", { target_status: "PI_SENT" }),
      ctx("o1"),
    );
    expect(res.status).toBe(403);
    expect(mockPutJson).not.toHaveBeenCalled();
  });

  it("missing role (auth/me failed): returns 403", async () => {
    mockGET.mockResolvedValueOnce({ data: null });
    const res = await transitionOrder(
      makeRequest("http://x/api/orders/o1/transition", {
        method: "PUT",
        body: JSON.stringify({ target_status: "PI_SENT" }),
        headers: { "Content-Type": "application/json" },
      }),
      ctx("o1"),
    );
    expect(res.status).toBe(403);
    expect(mockPutJson).not.toHaveBeenCalled();
  });

  it("missing target_status: returns 400", async () => {
    const res = await transitionOrder(
      makeBodyRequest("ADMIN", { acknowledge_warnings: false }),
      ctx("o1"),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/target_status/i);
    expect(mockPutJson).not.toHaveBeenCalled();
  });

  it("invalid JSON body: returns 400", async () => {
    mockGET.mockResolvedValueOnce({ data: { role: "ADMIN" } });
    // NextRequest with non-JSON body
    const req = new NextRequest(new URL("http://x/api/orders/o1/transition"), {
      method: "PUT",
      body: "not-json{",
      headers: { "Content-Type": "application/json" },
    });
    const res = await transitionOrder(req, ctx("o1"));
    expect(res.status).toBe(400);
  });

  it("backend 409 (stage-engine validation): forwards 409 with backend message", async () => {
    const err: Error & { status?: number } = new Error("Cannot advance: PI not generated yet");
    err.status = 409;
    mockPutJson.mockRejectedValueOnce(err);
    const res = await transitionOrder(
      makeBodyRequest("ADMIN", { target_status: "PI_SENT" }),
      ctx("o1"),
    );
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/PI not generated/);
  });

  it("backend 5xx: returns 502", async () => {
    const err: Error & { status?: number } = new Error("boom");
    err.status = 500;
    mockPutJson.mockRejectedValueOnce(err);
    const res = await transitionOrder(
      makeBodyRequest("ADMIN", { target_status: "PI_SENT" }),
      ctx("o1"),
    );
    expect(res.status).toBe(502);
  });
});

// ── PUT /api/orders/[id]/go-back (role-gated) ────────────────────────────────

describe("PUT /api/orders/[id]/go-back", () => {
  function makeBodyRequest(role: string, body: unknown) {
    mockGET.mockResolvedValueOnce({ data: { role } });
    return makeRequest("http://x/api/orders/o1/go-back", {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await goBackOrder(
      makeRequest("http://x/api/orders/o1/go-back", {
        method: "PUT",
        body: JSON.stringify({ reason: "test" }),
      }),
      ctx("o1"),
    );
    expect(res.status).toBe(401);
  });

  it("ADMIN role: forwards reason to backend body", async () => {
    mockPutJson.mockResolvedValueOnce({ ok: true });
    const res = await goBackOrder(
      makeBodyRequest("ADMIN", { reason: "Wrong stage advanced" }),
      ctx("o1"),
    );
    expect(res.status).toBe(200);
    expect(mockPutJson).toHaveBeenCalledWith(
      "/api/orders/o1/go-back/",
      { reason: "Wrong stage advanced" },
    );
  });

  it("default reason 'Stage reversal' applied when body omits reason", async () => {
    mockPutJson.mockResolvedValueOnce({ ok: true });
    await goBackOrder(makeBodyRequest("ADMIN", {}), ctx("o1"));
    expect(mockPutJson).toHaveBeenCalledWith(
      "/api/orders/o1/go-back/",
      { reason: "Stage reversal" },
    );
  });

  it("OPERATIONS role: forwards (allowed)", async () => {
    mockPutJson.mockResolvedValueOnce({ ok: true });
    const res = await goBackOrder(
      makeBodyRequest("OPERATIONS", { reason: "x" }),
      ctx("o1"),
    );
    expect(res.status).toBe(200);
  });

  it("FINANCE role: returns 403", async () => {
    const res = await goBackOrder(
      makeBodyRequest("FINANCE", { reason: "x" }),
      ctx("o1"),
    );
    expect(res.status).toBe(403);
    expect(mockPutJson).not.toHaveBeenCalled();
  });

  it("backend 400 (no previous stage): forwards 400 with backend message", async () => {
    const err: Error & { status?: number } = new Error(
      "Cannot go back from DRAFT — no previous status defined",
    );
    err.status = 400;
    mockPutJson.mockRejectedValueOnce(err);
    const res = await goBackOrder(
      makeBodyRequest("ADMIN", { reason: "test" }),
      ctx("o1"),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Cannot go back/);
  });
});

// ── PUT /api/orders/[id]/jump-to-stage (role-gated) ─────────────────────────

describe("PUT /api/orders/[id]/jump-to-stage", () => {
  function makeBodyRequest(role: string, body: unknown) {
    mockGET.mockResolvedValueOnce({ data: { role } });
    return makeRequest("http://x/api/orders/o1/jump-to-stage", {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }

  it("returns 401 without session", async () => {
    mockGetToken.mockResolvedValueOnce(null);
    const res = await jumpToStageOrder(
      makeRequest("http://x/api/orders/o1/jump-to-stage", {
        method: "PUT",
        body: JSON.stringify({ target_status: "PI_SENT" }),
      }),
      ctx("o1"),
    );
    expect(res.status).toBe(401);
  });

  it("ADMIN role: forwards target_status + reason to backend body (NOT query)", async () => {
    mockPutJson.mockResolvedValueOnce({ ok: true });
    const res = await jumpToStageOrder(
      makeBodyRequest("ADMIN", {
        target_status: "FACTORY_ORDERED",
        reason: "Skipping ahead to ready production",
      }),
      ctx("o1"),
    );
    expect(res.status).toBe(200);
    // jump-to-stage uses BODY for target_status (unlike /transition/ which uses query).
    expect(mockPutJson).toHaveBeenCalledWith(
      "/api/orders/o1/jump-to-stage/",
      {
        target_status: "FACTORY_ORDERED",
        reason: "Skipping ahead to ready production",
      },
    );
  });

  it("default reason 'Direct stage navigation' applied when body omits reason", async () => {
    mockPutJson.mockResolvedValueOnce({ ok: true });
    await jumpToStageOrder(
      makeBodyRequest("ADMIN", { target_status: "FACTORY_ORDERED" }),
      ctx("o1"),
    );
    expect(mockPutJson).toHaveBeenCalledWith(
      "/api/orders/o1/jump-to-stage/",
      {
        target_status: "FACTORY_ORDERED",
        reason: "Direct stage navigation",
      },
    );
  });

  it("missing target_status: returns 400", async () => {
    const res = await jumpToStageOrder(
      makeBodyRequest("ADMIN", { reason: "no target" }),
      ctx("o1"),
    );
    expect(res.status).toBe(400);
    expect(mockPutJson).not.toHaveBeenCalled();
  });

  it("FINANCE role: returns 403", async () => {
    const res = await jumpToStageOrder(
      makeBodyRequest("FINANCE", { target_status: "PI_SENT" }),
      ctx("o1"),
    );
    expect(res.status).toBe(403);
    expect(mockPutJson).not.toHaveBeenCalled();
  });

  it("backend 400 (target not in reachable range): forwards 400 with message", async () => {
    const err: Error & { status?: number } = new Error(
      "Cannot jump from DRAFT to DRAFT. Not in reachable range.",
    );
    err.status = 400;
    mockPutJson.mockRejectedValueOnce(err);
    const res = await jumpToStageOrder(
      makeBodyRequest("ADMIN", { target_status: "DRAFT" }),
      ctx("o1"),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/reachable range/i);
  });
});
