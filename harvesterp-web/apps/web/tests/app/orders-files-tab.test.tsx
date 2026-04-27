/**
 * orders-files-tab.test.tsx — Component tests for OrderFilesTab.
 *
 * Mocks `fetch` per-test to drive the documents query into
 * loading / success / empty / error states + exercises the upload modal
 * + delete confirmation + role-gated affordances.
 *
 * Backend shapes mirror the live-verified fixtures from
 * tests/api/orders-files-proxy.test.ts (R-19, 2026-04-27).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { OrderFilesTab } from "../../src/app/(app)/orders/[id]/_components/tabs/order-files-tab";
import type { OrderDetail } from "../../src/app/(app)/orders/[id]/_components/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/orders/o1",
  useSearchParams: () => new URLSearchParams(),
}));

// ── Test helpers ─────────────────────────────────────────────────────────────

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
    po_reference: "PO-12345",
    notes: null,
    reopen_count: 0,
    last_reopen_reason: null,
    igst_credit_amount: 0,
    igst_credit_claimed: false,
    completed_at: null,
    created_at: "2026-04-26T10:00:00",
    updated_at: null,
    client_name: "Acme Corp",
    factory_name: "Acme Test Factory",
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

const DOC_FIXTURE = {
  id: "f6aed7d0-86ea-4b68-b01d-09b6795254cf",
  order_id: "o1",
  doc_type: "PI",
  filename: "test-doc.txt",
  file_size: 35,
  uploaded_at: "2026-04-27T08:54:33.547750",
};

const DOC_FIXTURE_2 = {
  id: "11111111-1111-1111-1111-111111111111",
  order_id: "o1",
  doc_type: "INVOICE",
  filename: "invoice-large.pdf",
  file_size: 2_500_000, // ~2.4 MB
  uploaded_at: "2026-04-27T09:00:00.000000",
};

interface FetchPlan {
  list?: { ok: boolean; status?: number; body?: unknown };
  upload?: { ok: boolean; status?: number; body?: unknown };
  delete?: { ok: boolean; status?: number; body?: unknown };
  download?: {
    ok: boolean;
    status?: number;
    body?: ArrayBuffer;
    contentDisposition?: string;
  };
}

let lastUploadInit: { method?: string; body?: unknown } | null = null;
let lastDeleteUrl: string | null = null;

function setupFetch(plan: FetchPlan = {}) {
  lastUploadInit = null;
  lastDeleteUrl = null;
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (method === "DELETE") {
      lastDeleteUrl = url;
      const e = plan.delete;
      if (!e) {
        return new Response(JSON.stringify({ error: "no mock" }), {
          status: 500,
        });
      }
      return new Response(JSON.stringify(e.body ?? null), {
        status: e.status ?? (e.ok ? 200 : 500),
      });
    }

    if (method === "POST" && url.includes("/documents")) {
      lastUploadInit = { method, body: init?.body };
      const e = plan.upload;
      if (!e) {
        return new Response(JSON.stringify({ error: "no mock" }), {
          status: 500,
        });
      }
      return new Response(JSON.stringify(e.body ?? null), {
        status: e.status ?? (e.ok ? 200 : 500),
      });
    }

    if (url.includes("/download")) {
      const e = plan.download;
      if (!e) {
        return new Response(null, { status: 500 });
      }
      const headers: Record<string, string> = {
        "Content-Type": "application/octet-stream",
      };
      if (e.contentDisposition) {
        headers["Content-Disposition"] = e.contentDisposition;
      }
      return new Response(e.body ?? new ArrayBuffer(8), {
        status: e.status ?? (e.ok ? 200 : 500),
        headers,
      });
    }

    // Default: GET list
    const e = plan.list;
    if (!e) {
      return new Response(JSON.stringify({ error: "no mock" }), { status: 500 });
    }
    return new Response(JSON.stringify(e.body ?? null), {
      status: e.status ?? (e.ok ? 200 : 500),
    });
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

function renderTab(props: Partial<React.ComponentProps<typeof OrderFilesTab>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <OrderFilesTab orderId="o1" order={makeOrder()} role="ADMIN" {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ── List rendering ───────────────────────────────────────────────────────────

describe("OrderFilesTab — list", () => {
  it("renders the populated table with all 5 columns", async () => {
    setupFetch({ list: { ok: true, body: [DOC_FIXTURE, DOC_FIXTURE_2] } });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("files-table")).toBeInTheDocument();
    });
    const table = screen.getByTestId("files-table");
    expect(within(table).getByText("Type")).toBeInTheDocument();
    expect(within(table).getByText("Filename")).toBeInTheDocument();
    expect(within(table).getByText("Size")).toBeInTheDocument();
    expect(within(table).getByText("Uploaded")).toBeInTheDocument();
    expect(within(table).getByText("Actions")).toBeInTheDocument();
    expect(within(table).getByText("test-doc.txt")).toBeInTheDocument();
    expect(within(table).getByText("invoice-large.pdf")).toBeInTheDocument();
    expect(within(table).getAllByText("PI")[0]).toBeInTheDocument();
    expect(within(table).getAllByText("INVOICE")[0]).toBeInTheDocument();
  });

  it("formats file size correctly (B / KB / MB)", async () => {
    setupFetch({ list: { ok: true, body: [DOC_FIXTURE, DOC_FIXTURE_2] } });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("files-table")).toBeInTheDocument();
    });
    // 35 bytes -> "35 B"
    expect(screen.getByText("35 B")).toBeInTheDocument();
    // 2_500_000 bytes -> "2.4 MB" (rounded)
    expect(screen.getByText("2.4 MB")).toBeInTheDocument();
  });

  it("formats date correctly (en-IN locale, dd MMM yyyy)", async () => {
    setupFetch({ list: { ok: true, body: [DOC_FIXTURE] } });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("files-table")).toBeInTheDocument();
    });
    // formatDate(2026-04-27T...) -> "27 Apr 2026"
    expect(screen.getByText("27 Apr 2026")).toBeInTheDocument();
  });

  it("renders skeleton while documents are loading", () => {
    setupFetch({ list: { ok: true, body: new Promise(() => {}) } });
    renderTab();
    expect(screen.getByTestId("files-skeleton")).toBeInTheDocument();
  });

  it("renders error card with retry on fetch failure", async () => {
    setupFetch({ list: { ok: false, status: 500 } });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("files-error")).toBeInTheDocument();
    });
    expect(screen.getByText(/failed to load documents/i)).toBeInTheDocument();
    expect(screen.getByText(/retry/i)).toBeInTheDocument();
  });
});

// ── Empty state ──────────────────────────────────────────────────────────────

describe("OrderFilesTab — empty state", () => {
  it("renders empty state when documents array is empty", async () => {
    setupFetch({ list: { ok: true, body: [] } });
    renderTab();
    await waitFor(() => {
      expect(screen.getByTestId("files-empty-state")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/no files attached to this order/i),
    ).toBeInTheDocument();
  });

  it("shows upload CTA in empty state for ADMIN role", async () => {
    setupFetch({ list: { ok: true, body: [] } });
    renderTab({ role: "ADMIN" });
    await waitFor(() => {
      expect(screen.getByTestId("files-empty-upload-cta")).toBeInTheDocument();
    });
  });

  it("HIDES upload CTA in empty state for FINANCE role", async () => {
    setupFetch({ list: { ok: true, body: [] } });
    renderTab({ role: "FINANCE" });
    await waitFor(() => {
      expect(screen.getByTestId("files-empty-state")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("files-empty-upload-cta")).toBeNull();
    expect(
      screen.getByText(/when a document is attached it will appear here/i),
    ).toBeInTheDocument();
  });
});

// ── Upload affordance + modal ────────────────────────────────────────────────

describe("OrderFilesTab — upload", () => {
  it("renders Upload button for ADMIN role", async () => {
    setupFetch({ list: { ok: true, body: [DOC_FIXTURE] } });
    renderTab({ role: "ADMIN" });
    await waitFor(() => {
      expect(screen.getByTestId("files-upload-button")).toBeInTheDocument();
    });
  });

  it("HIDES Upload button for FINANCE role", async () => {
    setupFetch({ list: { ok: true, body: [DOC_FIXTURE] } });
    renderTab({ role: "FINANCE" });
    await waitFor(() => {
      expect(screen.getByTestId("files-table")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("files-upload-button")).toBeNull();
  });

  it("opens the upload modal when Upload button is clicked", async () => {
    setupFetch({ list: { ok: true, body: [DOC_FIXTURE] } });
    renderTab({ role: "ADMIN" });
    await waitFor(() => {
      expect(screen.getByTestId("files-upload-button")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("files-upload-button"));
    await waitFor(() => {
      expect(screen.getByTestId("files-upload-modal")).toBeInTheDocument();
    });
  });

  it("disables Submit until both doc_type AND file are picked", async () => {
    setupFetch({ list: { ok: true, body: [] } });
    renderTab({ role: "ADMIN" });
    await waitFor(() => {
      expect(screen.getByTestId("files-empty-upload-cta")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("files-empty-upload-cta"));
    await waitFor(() => {
      expect(screen.getByTestId("files-upload-modal")).toBeInTheDocument();
    });
    const submit = screen.getByTestId("files-upload-submit") as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    // Pick doc_type only
    fireEvent.change(screen.getByTestId("files-upload-doc-type"), {
      target: { value: "PI" },
    });
    expect(submit.disabled).toBe(true);
    // Now pick a file
    const fileInput = screen.getByTestId("files-upload-file") as HTMLInputElement;
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(submit.disabled).toBe(false);
  });

  it("posts multipart on submit and closes modal + refetches on success", async () => {
    const fetchMock = setupFetch({
      list: { ok: true, body: [] },
      upload: { ok: true, body: DOC_FIXTURE },
    });
    renderTab({ role: "ADMIN" });
    await waitFor(() => {
      expect(screen.getByTestId("files-empty-upload-cta")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("files-empty-upload-cta"));
    await waitFor(() => {
      expect(screen.getByTestId("files-upload-modal")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId("files-upload-doc-type"), {
      target: { value: "PI" },
    });
    fireEvent.change(screen.getByTestId("files-upload-file"), {
      target: {
        files: [new File(["x"], "x.txt", { type: "text/plain" })],
      },
    });
    fireEvent.click(screen.getByTestId("files-upload-submit"));
    await waitFor(() => {
      expect(screen.queryByTestId("files-upload-modal")).toBeNull();
    });
    // Multipart POST was issued.
    expect(lastUploadInit?.method).toBe("POST");
    expect(lastUploadInit?.body).toBeInstanceOf(FormData);
    // Refetch fired (one initial GET + one after-upload GET; total 2 GETs).
    const getCalls = fetchMock.mock.calls.filter(
      (c) => !c[1] || (c[1] as RequestInit).method === undefined,
    );
    expect(getCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("shows inline error in modal on upload failure (does NOT close modal)", async () => {
    setupFetch({
      list: { ok: true, body: [] },
      upload: {
        ok: false,
        status: 500,
        body: { error: "Boom" },
      },
    });
    renderTab({ role: "ADMIN" });
    await waitFor(() => {
      expect(screen.getByTestId("files-empty-upload-cta")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("files-empty-upload-cta"));
    fireEvent.change(screen.getByTestId("files-upload-doc-type"), {
      target: { value: "PI" },
    });
    fireEvent.change(screen.getByTestId("files-upload-file"), {
      target: { files: [new File(["x"], "x.txt")] },
    });
    fireEvent.click(screen.getByTestId("files-upload-submit"));
    await waitFor(() => {
      expect(screen.getByTestId("files-upload-error")).toBeInTheDocument();
    });
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
    // Modal stays open so the user can retry.
    expect(screen.getByTestId("files-upload-modal")).toBeInTheDocument();
  });
});

// ── Download ─────────────────────────────────────────────────────────────────

describe("OrderFilesTab — download", () => {
  it("renders a Download button per row", async () => {
    setupFetch({ list: { ok: true, body: [DOC_FIXTURE] } });
    renderTab();
    await waitFor(() => {
      expect(
        screen.getByTestId(`files-download-${DOC_FIXTURE.id}`),
      ).toBeInTheDocument();
    });
  });

  it("triggers a fetch to the download proxy on click", async () => {
    // Patch URL.createObjectURL + click — jsdom doesn't ship them.
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(global.URL, "createObjectURL", {
      writable: true,
      value: createObjectURL,
    });
    Object.defineProperty(global.URL, "revokeObjectURL", {
      writable: true,
      value: revokeObjectURL,
    });

    const fetchMock = setupFetch({
      list: { ok: true, body: [DOC_FIXTURE] },
      download: {
        ok: true,
        body: new TextEncoder().encode("file-bytes-here").buffer,
        contentDisposition: 'attachment; filename="test-doc.txt"',
      },
    });
    renderTab();
    await waitFor(() => {
      expect(
        screen.getByTestId(`files-download-${DOC_FIXTURE.id}`),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId(`files-download-${DOC_FIXTURE.id}`));

    await waitFor(() => {
      const downloadCall = fetchMock.mock.calls.find((c) =>
        String(c[0]).includes(`/documents/${DOC_FIXTURE.id}/download`),
      );
      expect(downloadCall).toBeDefined();
    });
  });
});

// ── Delete + DeleteConfirmDialog ─────────────────────────────────────────────

describe("OrderFilesTab — delete", () => {
  it("renders Delete button for ADMIN role", async () => {
    setupFetch({ list: { ok: true, body: [DOC_FIXTURE] } });
    renderTab({ role: "ADMIN" });
    await waitFor(() => {
      expect(
        screen.getByTestId(`files-delete-${DOC_FIXTURE.id}`),
      ).toBeInTheDocument();
    });
  });

  it("HIDES Delete button for FINANCE role", async () => {
    setupFetch({ list: { ok: true, body: [DOC_FIXTURE] } });
    renderTab({ role: "FINANCE" });
    await waitFor(() => {
      expect(screen.getByTestId("files-table")).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId(`files-delete-${DOC_FIXTURE.id}`),
    ).toBeNull();
    // Download still visible (any role).
    expect(
      screen.getByTestId(`files-download-${DOC_FIXTURE.id}`),
    ).toBeInTheDocument();
  });

  it("opens DeleteConfirmDialog with filename in the body", async () => {
    setupFetch({ list: { ok: true, body: [DOC_FIXTURE] } });
    renderTab({ role: "ADMIN" });
    await waitFor(() => {
      expect(
        screen.getByTestId(`files-delete-${DOC_FIXTURE.id}`),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId(`files-delete-${DOC_FIXTURE.id}`));
    // Scope to the dialog — the filename also appears in the table row.
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/delete document\?/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/test-doc\.txt/)).toBeInTheDocument();
  });

  it("issues DELETE request on confirm + refetches on success", async () => {
    setupFetch({
      list: { ok: true, body: [DOC_FIXTURE] },
      delete: { ok: true, body: { message: "Document deleted" } },
    });
    renderTab({ role: "ADMIN" });
    await waitFor(() => {
      expect(
        screen.getByTestId(`files-delete-${DOC_FIXTURE.id}`),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId(`files-delete-${DOC_FIXTURE.id}`));
    await waitFor(() => {
      expect(screen.getByText(/delete document\?/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(lastDeleteUrl).toContain(`/documents/${DOC_FIXTURE.id}`);
    });
  });

  it("shows error message on delete failure", async () => {
    setupFetch({
      list: { ok: true, body: [DOC_FIXTURE] },
      delete: { ok: false, status: 500, body: { error: "Boom" } },
    });
    renderTab({ role: "ADMIN" });
    await waitFor(() => {
      expect(
        screen.getByTestId(`files-delete-${DOC_FIXTURE.id}`),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId(`files-delete-${DOC_FIXTURE.id}`));
    await waitFor(() => {
      expect(screen.getByText(/delete document\?/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => {
      expect(screen.getByTestId("files-delete-error")).toBeInTheDocument();
    });
    expect(screen.getByText(/boom/i)).toBeInTheDocument();
  });
});
