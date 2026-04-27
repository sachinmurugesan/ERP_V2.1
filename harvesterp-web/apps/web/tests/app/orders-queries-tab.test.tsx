/**
 * orders-queries-tab.test.tsx — Component tests for OrderQueriesTab.
 *
 * Mocks `fetch` per-test with a single dispatcher keyed on URL +
 * method. Fixtures mirror the live R-19 shapes from the proxy test
 * file (orders-queries-proxy.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
  act,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { OrderQueriesTab } from "../../src/app/(app)/orders/[id]/_components/tabs/order-queries-tab";
import type { OrderDetail } from "../../src/app/(app)/orders/[id]/_components/types";
import type {
  OrderQuery,
  OrderQueryStatus,
} from "../../src/app/api/orders/[id]/queries/route";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/orders/o1",
  useSearchParams: () => new URLSearchParams(),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeOrder(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: "o1",
    order_number: "AB-2026-0001",
    client_id: "c1",
    factory_id: "f1",
    status: "DRAFT",
    currency: "INR",
    exchange_rate: 12,
    exchange_rate_date: null,
    po_reference: "PO-1",
    notes: null,
    reopen_count: 0,
    last_reopen_reason: null,
    igst_credit_amount: 0,
    igst_credit_claimed: false,
    completed_at: null,
    created_at: "2026-04-26T10:00:00",
    updated_at: null,
    client_name: "Acme",
    factory_name: "F1",
    item_count: 5,
    total_value_cny: 25000,
    stage_number: 1,
    stage_name: "Draft",
    highest_unlocked_stage: 1,
    pi_stale: false,
    version: 1,
    client_reference: null,
    client_type: "REGULAR",
    query_counts: { total: 0, open: 0, replied: 0 },
    ...overrides,
  };
}

function makeQuery(overrides: Partial<OrderQuery> = {}): OrderQuery {
  return {
    id: "q1",
    order_id: "o1",
    order_item_id: null,
    product_id: null,
    query_type: "GENERAL",
    status: "OPEN",
    subject: "Test query",
    created_by_id: "u1",
    created_by_role: "INTERNAL",
    created_at: "2026-04-27T10:00:00",
    updated_at: null,
    resolved_at: null,
    resolution_remark: null,
    messages: [
      {
        id: "m1",
        query_id: "q1",
        sender_id: "u1",
        sender_role: "INTERNAL",
        sender_name: "admin@harvesterp.com",
        message: "Body",
        attachments: null,
        created_at: "2026-04-27T10:00:00",
      },
    ],
    product_code: null,
    product_name: null,
    message_count: 1,
    last_message_at: "2026-04-27T10:00:00",
    ...overrides,
  };
}

interface FetchPlan {
  list?: OrderQuery[];
  listError?: { status?: number };
  create?: { ok: boolean; status?: number; body?: unknown };
  reply?: { ok: boolean; status?: number; body?: unknown };
  resolve?: { ok: boolean; status?: number; body?: unknown };
  reopen?: { ok: boolean; status?: number; body?: unknown };
  delete?: { ok: boolean; status?: number; body?: unknown };
  markRead?: { ok: boolean; status?: number };
}

let lastReplyBody: unknown = null;
let lastResolveBody: unknown = null;
let lastDeleteUrl: string | null = null;
let lastCreateBody: unknown = null;
let markReadCallCount = 0;

function setupFetch(plan: FetchPlan = {}) {
  lastReplyBody = null;
  lastResolveBody = null;
  lastDeleteUrl = null;
  lastCreateBody = null;
  markReadCallCount = 0;

  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url.includes("/notifications/mark-read-by-resource")) {
      markReadCallCount += 1;
      const e = plan.markRead ?? { ok: true };
      return new Response(
        JSON.stringify({ marked_read: 0 }),
        { status: e.status ?? (e.ok ? 200 : 500) },
      );
    }

    if (method === "PUT" && url.includes("/resolve")) {
      lastResolveBody = init?.body
        ? JSON.parse(init.body as string)
        : null;
      const e = plan.resolve ?? { ok: true, body: makeQuery({ status: "RESOLVED" }) };
      return new Response(JSON.stringify(e.body ?? null), {
        status: e.status ?? (e.ok ? 200 : 500),
      });
    }

    if (method === "PUT" && url.includes("/reopen")) {
      const e = plan.reopen ?? { ok: true, body: makeQuery({ status: "OPEN" }) };
      return new Response(JSON.stringify(e.body ?? null), {
        status: e.status ?? (e.ok ? 200 : 500),
      });
    }

    if (method === "POST" && url.includes("/replies")) {
      lastReplyBody = init?.body ? JSON.parse(init.body as string) : null;
      const e = plan.reply ?? { ok: true, body: makeQuery({ message_count: 2 }) };
      return new Response(JSON.stringify(e.body ?? null), {
        status: e.status ?? (e.ok ? 200 : 500),
      });
    }

    if (method === "DELETE") {
      lastDeleteUrl = url;
      const e = plan.delete ?? { ok: true, body: { deleted: true, id: "q1" } };
      return new Response(JSON.stringify(e.body ?? null), {
        status: e.status ?? (e.ok ? 200 : 500),
      });
    }

    if (method === "POST" && url.includes("/queries") && !url.includes("/replies")) {
      lastCreateBody = init?.body ? JSON.parse(init.body as string) : null;
      const e = plan.create ?? { ok: true, body: makeQuery({ id: "qNew" }) };
      return new Response(JSON.stringify(e.body ?? null), {
        status: e.status ?? (e.ok ? 200 : 500),
      });
    }

    // Default: GET list
    if (plan.listError) {
      return new Response(JSON.stringify({ error: "boom" }), {
        status: plan.listError.status ?? 500,
      });
    }
    return new Response(JSON.stringify(plan.list ?? []), { status: 200 });
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

function renderTab(
  props: Partial<React.ComponentProps<typeof OrderQueriesTab>> = {},
) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <OrderQueriesTab
        orderId="o1"
        order={makeOrder()}
        role="ADMIN"
        {...props}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ── KPI cards ────────────────────────────────────────────────────────────────

describe("OrderQueriesTab — KPI cards", () => {
  it("renders 4 KPI cards with correct counts", async () => {
    setupFetch({
      list: [
        makeQuery({ id: "a", status: "OPEN" }),
        makeQuery({ id: "b", status: "OPEN" }),
        makeQuery({ id: "c", status: "REPLIED" }),
        makeQuery({ id: "d", status: "RESOLVED" }),
      ],
    });
    renderTab();
    // Wait for the data-driven count to arrive (the card renders
    // immediately with 0, then updates when the query resolves).
    await waitFor(() => {
      expect(
        within(screen.getByTestId("queries-kpi-open")).getByText("2"),
      ).toBeInTheDocument();
    });
    expect(within(screen.getByTestId("queries-kpi-replied")).getByText("1")).toBeInTheDocument();
    expect(within(screen.getByTestId("queries-kpi-resolved")).getByText("1")).toBeInTheDocument();
  });

  it("KPI counts default to zero when no queries", async () => {
    setupFetch({ list: [] });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("queries-kpis")).toBeInTheDocument();
    });
    // All four cards show 0
    expect(within(screen.getByTestId("queries-kpi-open")).getByText("0")).toBeInTheDocument();
    expect(within(screen.getByTestId("queries-kpi-replied")).getByText("0")).toBeInTheDocument();
    expect(within(screen.getByTestId("queries-kpi-resolved")).getByText("0")).toBeInTheDocument();
  });
});

// ── List + status chip ───────────────────────────────────────────────────────

describe("OrderQueriesTab — list + status chip", () => {
  it("renders one card per query", async () => {
    setupFetch({
      list: [
        makeQuery({ id: "a", subject: "Subject A" }),
        makeQuery({ id: "b", subject: "Subject B" }),
      ],
    });
    renderTab();
    await waitFor(() => {
      expect(screen.getByText("Subject A")).toBeInTheDocument();
    });
    expect(screen.getByText("Subject B")).toBeInTheDocument();
    expect(screen.getByTestId("query-card-a")).toBeInTheDocument();
    expect(screen.getByTestId("query-card-b")).toBeInTheDocument();
  });

  it("renders status chip with correct tone for OPEN / REPLIED / RESOLVED", async () => {
    setupFetch({
      list: [
        makeQuery({ id: "a", status: "OPEN" }),
        makeQuery({ id: "b", status: "REPLIED" }),
        makeQuery({ id: "c", status: "RESOLVED" }),
      ],
    });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("query-card-a")).toBeInTheDocument();
    });
    const cardA = screen.getByTestId("query-card-a");
    const chipA = within(cardA).getByText("OPEN");
    expect(chipA.className).toMatch(/chip-warn/);

    const cardB = screen.getByTestId("query-card-b");
    expect(within(cardB).getByText("REPLIED").className).toMatch(/chip-info/);

    const cardC = screen.getByTestId("query-card-c");
    expect(within(cardC).getByText("RESOLVED").className).toMatch(/chip-ok/);
  });
});

// ── Filter pills + search ────────────────────────────────────────────────────

describe("OrderQueriesTab — filter + search", () => {
  it("filter pill: All shows every query", async () => {
    setupFetch({
      list: [
        makeQuery({ id: "a", status: "OPEN" }),
        makeQuery({ id: "b", status: "RESOLVED" }),
      ],
    });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("query-card-a")).toBeInTheDocument();
    });
    expect(screen.getByTestId("query-card-b")).toBeInTheDocument();
  });

  it("filter pill: Open hides resolved queries", async () => {
    setupFetch({
      list: [
        makeQuery({ id: "a", status: "OPEN" }),
        makeQuery({ id: "b", status: "RESOLVED" }),
      ],
    });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("queries-filter-open")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("queries-filter-open"));
    await waitFor(() => {
      expect(screen.queryByTestId("query-card-b")).toBeNull();
    });
    expect(screen.getByTestId("query-card-a")).toBeInTheDocument();
  });

  it("search filters queries by subject (debounced)", async () => {
    setupFetch({
      list: [
        makeQuery({ id: "a", subject: "Apple question" }),
        makeQuery({ id: "b", subject: "Banana question" }),
      ],
    });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("query-card-a")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId("queries-search-input"), {
      target: { value: "apple" },
    });
    // Wait past the debounce
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });
    await waitFor(() => {
      expect(screen.queryByTestId("query-card-b")).toBeNull();
    });
    expect(screen.getByTestId("query-card-a")).toBeInTheDocument();
  });
});

// ── Expand + reply ───────────────────────────────────────────────────────────

describe("OrderQueriesTab — expand + reply", () => {
  it("expanding a card shows the thread and reply form", async () => {
    setupFetch({ list: [makeQuery({ id: "q1" })] });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("query-card-q1")).toBeInTheDocument();
    });
    // Expand
    const card = screen.getByTestId("query-card-q1");
    fireEvent.click(within(card).getByRole("button", { expanded: false }));
    await waitFor(() => {
      expect(screen.getByTestId("query-thread-q1")).toBeInTheDocument();
    });
    expect(screen.getByTestId("query-reply-form-q1")).toBeInTheDocument();
  });

  it("submit reply calls the proxy with {message: trimmed}", async () => {
    setupFetch({ list: [makeQuery({ id: "q1" })] });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("query-card-q1")).toBeInTheDocument();
    });
    fireEvent.click(
      within(screen.getByTestId("query-card-q1")).getByRole("button", {
        expanded: false,
      }),
    );
    await waitFor(() => {
      expect(screen.getByTestId("query-reply-textarea-q1")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId("query-reply-textarea-q1"), {
      target: { value: "  My reply  " },
    });
    fireEvent.click(screen.getByTestId("query-reply-send-q1"));
    await waitFor(() => {
      expect(lastReplyBody).toEqual({ message: "My reply" });
    });
  });

  it("send button disabled until reply has content", async () => {
    setupFetch({ list: [makeQuery({ id: "q1" })] });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("query-card-q1")).toBeInTheDocument();
    });
    fireEvent.click(
      within(screen.getByTestId("query-card-q1")).getByRole("button", {
        expanded: false,
      }),
    );
    const send = (await screen.findByTestId(
      "query-reply-send-q1",
    )) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(screen.getByTestId("query-reply-textarea-q1"), {
      target: { value: "ok" },
    });
    expect(send.disabled).toBe(false);
  });
});

// ── New query modal ──────────────────────────────────────────────────────────

describe("OrderQueriesTab — new query modal", () => {
  it("opens the modal on Ask a question click", async () => {
    setupFetch({ list: [] });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("queries-new-button")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("queries-new-button"));
    await waitFor(() => {
      expect(screen.getByTestId("queries-new-modal")).toBeInTheDocument();
    });
  });

  it("submit disabled without subject AND message", async () => {
    setupFetch({ list: [] });
    renderTab();
    fireEvent.click(await screen.findByTestId("queries-new-button"));
    const submit = (await screen.findByTestId(
      "queries-new-submit",
    )) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    // Subject only
    fireEvent.change(screen.getByTestId("queries-new-subject"), {
      target: { value: "Hello" },
    });
    expect(submit.disabled).toBe(true);
    // Subject + message
    fireEvent.change(screen.getByTestId("queries-new-message"), {
      target: { value: "Body" },
    });
    expect(submit.disabled).toBe(false);
  });

  it("submit POSTs subject + message + query_type and closes modal", async () => {
    setupFetch({ list: [] });
    renderTab();
    fireEvent.click(await screen.findByTestId("queries-new-button"));
    fireEvent.change(
      await screen.findByTestId("queries-new-subject"),
      { target: { value: "Subj" } },
    );
    fireEvent.change(screen.getByTestId("queries-new-message"), {
      target: { value: "Body" },
    });
    fireEvent.change(screen.getByTestId("queries-new-type"), {
      target: { value: "PHOTO_REQUEST" },
    });
    fireEvent.click(screen.getByTestId("queries-new-submit"));
    await waitFor(() => {
      expect(lastCreateBody).toEqual({
        subject: "Subj",
        message: "Body",
        query_type: "PHOTO_REQUEST",
      });
    });
    await waitFor(() => {
      expect(screen.queryByTestId("queries-new-modal")).toBeNull();
    });
  });

  it("shows inline error in modal on POST failure (does not close modal)", async () => {
    setupFetch({
      list: [],
      create: { ok: false, status: 500, body: { error: "Boom" } },
    });
    renderTab();
    fireEvent.click(await screen.findByTestId("queries-new-button"));
    fireEvent.change(
      await screen.findByTestId("queries-new-subject"),
      { target: { value: "Subj" } },
    );
    fireEvent.change(screen.getByTestId("queries-new-message"), {
      target: { value: "Body" },
    });
    fireEvent.click(screen.getByTestId("queries-new-submit"));
    await waitFor(() => {
      expect(screen.getByTestId("queries-new-error")).toBeInTheDocument();
    });
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
    // Modal stays open so user can retry
    expect(screen.getByTestId("queries-new-modal")).toBeInTheDocument();
  });
});

// ── Resolve / Reopen ─────────────────────────────────────────────────────────

describe("OrderQueriesTab — resolve / reopen", () => {
  it("resolve button visible on OPEN, hidden on RESOLVED (and vice versa)", async () => {
    setupFetch({
      list: [
        makeQuery({ id: "open", status: "OPEN" }),
        makeQuery({ id: "done", status: "RESOLVED" }),
      ],
    });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("query-card-open")).toBeInTheDocument();
    });
    // Expand both
    fireEvent.click(
      within(screen.getByTestId("query-card-open")).getByRole("button", {
        expanded: false,
      }),
    );
    expect(
      await screen.findByTestId("query-resolve-open"),
    ).toBeInTheDocument();
    // Reopen button hidden on OPEN
    expect(screen.queryByTestId("query-reopen-open")).toBeNull();

    // Collapse the open card and expand the resolved one
    fireEvent.click(
      within(screen.getByTestId("query-card-open")).getByRole("button", {
        expanded: true,
      }),
    );
    fireEvent.click(
      within(screen.getByTestId("query-card-done")).getByRole("button", {
        expanded: false,
      }),
    );
    expect(
      await screen.findByTestId("query-reopen-done"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("query-resolve-done")).toBeNull();
  });

  it("resolve click opens modal, submit calls PUT proxy with remark", async () => {
    setupFetch({ list: [makeQuery({ id: "q1", status: "OPEN" })] });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("query-card-q1")).toBeInTheDocument();
    });
    fireEvent.click(
      within(screen.getByTestId("query-card-q1")).getByRole("button", {
        expanded: false,
      }),
    );
    fireEvent.click(await screen.findByTestId("query-resolve-q1"));
    const dialog = await screen.findByTestId("queries-resolve-modal");
    fireEvent.change(screen.getByTestId("queries-resolve-remark"), {
      target: { value: "All good" },
    });
    fireEvent.click(within(dialog).getByTestId("queries-resolve-submit"));
    await waitFor(() => {
      expect(lastResolveBody).toEqual({ remark: "All good" });
    });
  });
});

// ── Delete + role gate ───────────────────────────────────────────────────────

describe("OrderQueriesTab — delete + role gate", () => {
  it("delete button visible for ADMIN role", async () => {
    setupFetch({ list: [makeQuery({ id: "q1" })] });
    renderTab({ role: "ADMIN" });
    await waitFor(() => {
      expect(screen.getByTestId("query-card-q1")).toBeInTheDocument();
    });
    fireEvent.click(
      within(screen.getByTestId("query-card-q1")).getByRole("button", {
        expanded: false,
      }),
    );
    expect(
      await screen.findByTestId("query-delete-q1"),
    ).toBeInTheDocument();
  });

  it("HIDES delete button for FINANCE role (FE defense-in-depth)", async () => {
    setupFetch({ list: [makeQuery({ id: "q1" })] });
    renderTab({ role: "FINANCE" });
    await waitFor(() => {
      expect(screen.getByTestId("query-card-q1")).toBeInTheDocument();
    });
    fireEvent.click(
      within(screen.getByTestId("query-card-q1")).getByRole("button", {
        expanded: false,
      }),
    );
    await screen.findByTestId("query-thread-q1");
    expect(screen.queryByTestId("query-delete-q1")).toBeNull();
    // Resolve still visible — FINANCE can resolve
    expect(screen.getByTestId("query-resolve-q1")).toBeInTheDocument();
  });

  it("delete click opens DeleteConfirmDialog with the subject", async () => {
    setupFetch({ list: [makeQuery({ id: "q1", subject: "Important" })] });
    renderTab({ role: "ADMIN" });
    await waitFor(() => {
      expect(screen.getByTestId("query-card-q1")).toBeInTheDocument();
    });
    fireEvent.click(
      within(screen.getByTestId("query-card-q1")).getByRole("button", {
        expanded: false,
      }),
    );
    fireEvent.click(await screen.findByTestId("query-delete-q1"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/delete query\?/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/important/i)).toBeInTheDocument();
  });

  it("delete confirm fires DELETE proxy and clears expanded card", async () => {
    setupFetch({ list: [makeQuery({ id: "q1" })] });
    renderTab({ role: "ADMIN" });
    await waitFor(() => {
      expect(screen.getByTestId("query-card-q1")).toBeInTheDocument();
    });
    fireEvent.click(
      within(screen.getByTestId("query-card-q1")).getByRole("button", {
        expanded: false,
      }),
    );
    fireEvent.click(await screen.findByTestId("query-delete-q1"));
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(lastDeleteUrl).toContain("/queries/q1");
    });
  });
});

// ── Empty + loading + error ──────────────────────────────────────────────────

describe("OrderQueriesTab — empty / loading / error states", () => {
  it("renders no-data empty state with Ask CTA when list is empty", async () => {
    setupFetch({ list: [] });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("queries-empty-state")).toBeInTheDocument();
    });
    expect(screen.getByText(/no queries on this order yet/i)).toBeInTheDocument();
    expect(screen.getByTestId("queries-empty-cta")).toBeInTheDocument();
  });

  it("renders filtered empty state when filter hides all matches", async () => {
    setupFetch({ list: [makeQuery({ id: "q1", status: "OPEN" })] });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("query-card-q1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("queries-filter-resolved"));
    await waitFor(() => {
      expect(screen.getByTestId("queries-empty-filtered")).toBeInTheDocument();
    });
  });

  it("renders skeleton while loading", () => {
    setupFetch({ list: undefined });
    // Override to keep promise pending
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    renderTab();
    expect(screen.getByTestId("queries-skeleton")).toBeInTheDocument();
  });

  it("renders error card with retry on fetch failure", async () => {
    setupFetch({ listError: { status: 500 } });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("queries-error")).toBeInTheDocument();
    });
    expect(screen.getByText(/retry/i)).toBeInTheDocument();
  });
});

// ── Deep-link + notification mark-read ───────────────────────────────────────

describe("OrderQueriesTab — deep-link + notifications", () => {
  it("auto-expands the highlightSection query when data loads", async () => {
    setupFetch({
      list: [makeQuery({ id: "q1" }), makeQuery({ id: "q2" })],
    });
    renderTab({ highlightSection: "q2" });
    // Wait for thread to render -> the q2 card auto-expanded.
    await waitFor(() => {
      expect(screen.getByTestId("query-thread-q2")).toBeInTheDocument();
    });
    // q1 is NOT expanded.
    expect(screen.queryByTestId("query-thread-q1")).toBeNull();
  });

  it("calls mark-read-by-resource on mount (twice — REPLY + CREATED)", async () => {
    setupFetch({ list: [] });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("queries-empty-state")).toBeInTheDocument();
    });
    // Two fire-and-forget calls (one for ITEM_QUERY_REPLY, one for ITEM_QUERY_CREATED).
    expect(markReadCallCount).toBe(2);
  });
});
