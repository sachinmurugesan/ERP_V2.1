/**
 * orders-list.test.tsx — Unit tests for the migrated internal orders list.
 *
 * Covers the interactive client pieces (filter tabs, table, kebab, delete
 * dialog, pagination, stage chip, role-gated CTA) plus a few integration
 * flows through the orchestrator. Route handlers are covered by their
 * own suite at tests/api/orders-routes.test.ts.
 *
 * The suite uses fireEvent (synchronous) wherever possible to avoid timing
 * surprises from userEvent's pointer-event cascade; userEvent is reserved
 * for text input where we actually need keystroke simulation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import {
  act,
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Resource, UserRole } from "@harvesterp/lib";

import { OrdersClient } from "../../src/app/(app)/orders/_components/orders-client";
import { FilterTabs } from "../../src/app/(app)/orders/_components/filter-tabs";
import { OrderKebab } from "../../src/app/(app)/orders/_components/order-kebab";
import { DeleteOrderDialog } from "../../src/app/(app)/orders/_components/delete-order-dialog";
import { OrdersPagination } from "../../src/app/(app)/orders/_components/pagination";
import {
  StageChip,
  stageToneFor,
} from "../../src/components/composed/stage-chip";
import { RoleGate } from "../../src/components/composed/role-gate";
import type { OrderListItem } from "../../src/app/(app)/orders/_components/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, prefetch: vi.fn() }),
  usePathname: () => "/orders",
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderWithQuery(ui: React.ReactElement): void {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: 0 },
    },
  });
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function mockOrder(overrides: Partial<OrderListItem> = {}): OrderListItem {
  return {
    id: "ord-1",
    order_number: "AB-2026-0001",
    po_reference: "PO-100",
    client_name: "Halder Solutions",
    client_location: "Kolkata",
    factory_name: "Changzhou Xinlikang",
    stage_number: 7,
    stage_name: "Production 80%",
    status: "PRODUCTION_80",
    item_count: 42,
    total_value_cny: 1_500_000,
    created_at: "2026-04-20T10:00:00Z",
    ...overrides,
  };
}

const SAMPLE_ORDERS: OrderListItem[] = [
  mockOrder({
    id: "ord-1",
    order_number: "AB-2026-0001",
    stage_number: 1,
    stage_name: "Draft",
    status: "DRAFT",
  }),
  mockOrder({
    id: "ord-2",
    order_number: "AB-2026-0002",
    stage_number: 5,
    stage_name: "Factory Ordered",
  }),
  mockOrder({
    id: "ord-3",
    order_number: "AB-2026-0003",
    stage_number: 13,
    stage_name: "Sailing",
  }),
  mockOrder({
    id: "ord-4",
    order_number: "AB-2026-0004",
    stage_number: 15,
    stage_name: "Delivered",
    status: "DELIVERED",
  }),
  mockOrder({
    id: "ord-5",
    order_number: "AB-2026-0005",
    stage_number: 17,
    stage_name: "Completed",
    status: "COMPLETED",
  }),
];

const SAMPLE_STATUS_COUNTS = {
  DRAFT: { count: 3, stage: 1, name: "Draft" },
  PI_SENT: { count: 2, stage: 3, name: "PI Sent" },
  FACTORY_ORDERED: { count: 4, stage: 5, name: "Factory Ordered" },
  SAILED: { count: 1, stage: 13, name: "Sailing" },
  DELIVERED: { count: 1, stage: 15, name: "Delivered" },
  COMPLETED: { count: 5, stage: 17, name: "Completed" },
};

interface FetchCallsSpy {
  lastListQuery: URLSearchParams | null;
  deleteCalls: number;
}

function mockFetch({
  orders = SAMPLE_ORDERS,
  total = SAMPLE_ORDERS.length,
  listOk = true,
  statusOk = true,
  deleteOk = true,
}: {
  orders?: OrderListItem[];
  total?: number;
  listOk?: boolean;
  statusOk?: boolean;
  deleteOk?: boolean;
} = {}): FetchCallsSpy {
  const spy: FetchCallsSpy = { lastListQuery: null, deleteCalls: 0 };
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method ?? "GET";

      if (url.includes("/api/orders/status-counts")) {
        return Promise.resolve({
          ok: statusOk,
          status: statusOk ? 200 : 502,
          json: () =>
            Promise.resolve(
              statusOk ? { counts: SAMPLE_STATUS_COUNTS } : { error: "oops" },
            ),
        });
      }

      if (method === "DELETE" && url.match(/\/api\/orders\/[^/?]+$/)) {
        spy.deleteCalls += 1;
        return Promise.resolve({
          ok: deleteOk,
          status: deleteOk ? 200 : 502,
          json: () =>
            Promise.resolve(
              deleteOk ? { ok: true } : { error: "delete failed" },
            ),
        });
      }

      if (url.includes("/api/orders")) {
        const qIndex = url.indexOf("?");
        spy.lastListQuery =
          qIndex > -1
            ? new URLSearchParams(url.slice(qIndex + 1))
            : new URLSearchParams();
        return Promise.resolve({
          ok: listOk,
          status: listOk ? 200 : 502,
          json: () =>
            Promise.resolve(
              listOk
                ? { items: orders, total, page: 1, per_page: 25 }
                : { error: "list failed" },
            ),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    }),
  );
  return spy;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── OrdersClient happy path + filters + pagination ────────────────────────────

describe("OrdersClient", () => {
  it("renders 5 orders with mocked backend data", async () => {
    mockFetch();
    renderWithQuery(<OrdersClient canCreate canDelete />);
    // Each order renders in BOTH the desktop table row AND the mobile card list
    // because jsdom doesn't apply the responsive media queries — assert the
    // desktop table specifically instead of globally.
    const tables = await screen.findAllByRole("table");
    const desktopTable = tables[0]!;
    expect(within(desktopTable).getByText("AB-2026-0001")).toBeInTheDocument();
    expect(within(desktopTable).getByText("AB-2026-0005")).toBeInTheDocument();
    expect(
      within(desktopTable).getAllByText("Halder Solutions").length,
    ).toBeGreaterThan(0);
  });

  it("renders status-count tabs with summed per-group counts", async () => {
    mockFetch();
    renderWithQuery(<OrdersClient canCreate canDelete />);
    const draftTab = await screen.findByRole("tab", { name: /Draft/i });
    await waitFor(() => {
      expect(within(draftTab).getByText("3")).toBeInTheDocument();
    });
    const pricingTab = screen.getByRole("tab", { name: /Pricing/i });
    expect(within(pricingTab).getByText("2")).toBeInTheDocument();
  });

  it("clicking a tab filters the displayed orders (sends status= query)", async () => {
    const spy = mockFetch();
    renderWithQuery(<OrdersClient canCreate canDelete />);
    await screen.findAllByText("AB-2026-0001");
    const draftTab = screen.getByRole("tab", { name: /Draft/i });
    fireEvent.click(draftTab);
    await waitFor(() => {
      expect(spy.lastListQuery?.get("status")).toBe("DRAFT");
    });
  });

  it("search input forwards the typed query to the list endpoint", async () => {
    const spy = mockFetch();
    renderWithQuery(<OrdersClient canCreate canDelete />);
    await screen.findAllByText("AB-2026-0001");
    const input = screen.getByLabelText(/search orders/i);
    fireEvent.change(input, { target: { value: "AB-0042" } });
    await waitFor(
      () => {
        expect(spy.lastListQuery?.get("search")).toBe("AB-0042");
      },
      { timeout: 2000 },
    );
  });

  it("renders the fresh empty state with a Create CTA when no orders exist", async () => {
    mockFetch({ orders: [], total: 0 });
    renderWithQuery(<OrdersClient canCreate canDelete />);
    expect(await screen.findByText(/no orders yet\./i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /create your first order/i }),
    ).toBeInTheDocument();
  });

  it("renders the filtered empty state + Clear Filters when filters hide every row", async () => {
    mockFetch({ orders: [], total: 0 });
    renderWithQuery(<OrdersClient canCreate canDelete />);
    const draftTab = await screen.findByRole("tab", { name: /Draft/i });
    fireEvent.click(draftTab);
    expect(
      await screen.findByText(/no orders match this filter\./i),
    ).toBeInTheDocument();
  });

  it("renders the loading skeleton while the initial fetch is pending", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    renderWithQuery(<OrdersClient canCreate canDelete />);
    expect(screen.queryByText(/no orders yet\./i)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText(/orders list/i)).toBeInTheDocument();
  });

  it("shows an error card with a Retry button when the list endpoint fails", async () => {
    mockFetch({ listOk: false });
    renderWithQuery(<OrdersClient canCreate canDelete />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't load orders/i);
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});

// ── OrderKebab role-gated menu items ──────────────────────────────────────────

describe("OrderKebab", () => {
  it("shows both View and Delete when onDelete is passed (OPERATIONS/ADMIN role)", () => {
    render(
      <OrderKebab
        orderLabel="AB-001"
        onView={() => undefined}
        onDelete={() => undefined}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /actions for AB-001/i }),
    );
    expect(
      screen.getByRole("menuitem", { name: /view/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /delete/i }),
    ).toBeInTheDocument();
  });

  it("shows View only when onDelete is omitted (FINANCE/VIEWER role)", () => {
    render(<OrderKebab orderLabel="AB-001" onView={() => undefined} />);
    fireEvent.click(
      screen.getByRole("button", { name: /actions for AB-001/i }),
    );
    expect(
      screen.getByRole("menuitem", { name: /view/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /delete/i })).toBeNull();
  });
});

// ── DeleteOrderDialog typed confirmation + error surfacing ────────────────────

describe("DeleteOrderDialog", () => {
  it("renders the dialog with the order number when open", () => {
    render(
      <DeleteOrderDialog
        open
        orderNumber="AB-2026-0001"
        onCancel={() => undefined}
        onConfirm={async () => undefined}
      />,
    );
    expect(
      screen.getByRole("dialog", { name: /delete order AB-2026-0001/i }),
    ).toBeInTheDocument();
  });

  it("disables the Delete button until DELETE is typed", async () => {
    const user = userEvent.setup();
    render(
      <DeleteOrderDialog
        open
        orderNumber="AB-001"
        onCancel={() => undefined}
        onConfirm={async () => undefined}
      />,
    );
    const button = screen.getByRole("button", { name: /delete order/i });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText(/type DELETE to confirm/i), "DELETE");
    expect(button).not.toBeDisabled();
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(
      <DeleteOrderDialog
        open
        orderNumber="AB-001"
        onCancel={onCancel}
        onConfirm={async () => undefined}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("shows an inline error message when onConfirm rejects", async () => {
    const onConfirm = vi
      .fn()
      .mockRejectedValue(new Error("Delete failed on the server"));
    render(
      <DeleteOrderDialog
        open
        orderNumber="AB-001"
        onCancel={() => undefined}
        onConfirm={onConfirm}
      />,
    );
    const input = screen.getByLabelText(/type DELETE to confirm/i);
    fireEvent.change(input, { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: /delete order/i }));
    expect(
      await screen.findByText(/delete failed on the server/i),
    ).toBeInTheDocument();
  });
});

// ── OrdersPagination disabled states + label ─────────────────────────────────

describe("OrdersPagination", () => {
  it("disables Prev on page 1 and enables Next", () => {
    render(
      <OrdersPagination
        page={1}
        perPage={25}
        total={100}
        onPrev={() => undefined}
        onNext={() => undefined}
      />,
    );
    expect(
      screen.getByRole("button", { name: /previous page/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /next page/i }),
    ).not.toBeDisabled();
  });

  it("disables Next on the last page", () => {
    render(
      <OrdersPagination
        page={4}
        perPage={25}
        total={100}
        onPrev={() => undefined}
        onNext={() => undefined}
      />,
    );
    expect(
      screen.getByRole("button", { name: /next page/i }),
    ).toBeDisabled();
  });

  it("renders Showing A–B of N label", () => {
    render(
      <OrdersPagination
        page={2}
        perPage={25}
        total={1_248}
        onPrev={() => undefined}
        onNext={() => undefined}
      />,
    );
    const nav = screen.getByRole("navigation", { name: /orders pagination/i });
    expect(nav).toHaveTextContent(/Showing 26–50 of 1,248/);
  });
});

// ── RoleGate integration for "+ New order" CTA ───────────────────────────────

describe("role-gated New Order CTA", () => {
  const Cta = (
    <button type="button" aria-label="new order">
      New order
    </button>
  );

  it("is visible to OPERATIONS users", () => {
    render(
      <RoleGate
        user={{ role: UserRole.OPERATIONS }}
        permission={Resource.ORDER_CREATE}
      >
        {Cta}
      </RoleGate>,
    );
    expect(
      screen.getByRole("button", { name: /new order/i }),
    ).toBeInTheDocument();
  });

  it("is hidden from FINANCE users", () => {
    render(
      <RoleGate
        user={{ role: UserRole.FINANCE }}
        permission={Resource.ORDER_CREATE}
      >
        {Cta}
      </RoleGate>,
    );
    expect(screen.queryByRole("button", { name: /new order/i })).toBeNull();
  });
});

// ── Stage chip (reused from dashboard) ───────────────────────────────────────

describe("StageChip (orders copy)", () => {
  it("returns distinct tones for stages 2, 5, 11, 13", () => {
    expect(stageToneFor(2)).toBe("chip chip-warn");
    expect(stageToneFor(5)).toBe("chip chip-info");
    expect(stageToneFor(11)).toBe("chip chip-accent");
    expect(stageToneFor(13)).toBe("chip chip-ok");
  });

  it("encodes stages 15-17 with their late-stage tones + handles out-of-range gracefully", () => {
    // Updated in orders-foundation PR (research §5.5):
    //   15 DELIVERED → chip-ok ; 17 COMPLETED → chip-accent ; 99 (unknown) → neutral.
    expect(stageToneFor(15)).toBe("chip chip-ok");
    expect(stageToneFor(17)).toBe("chip chip-accent");
    expect(stageToneFor(99)).toBe("chip");
    render(<StageChip stageNumber={17} stageName="Completed" />);
    expect(
      screen.getByLabelText(/stage 17: completed/i),
    ).toBeInTheDocument();
  });
});

// ── Responsive column hiding ─────────────────────────────────────────────────

describe("responsive orders table", () => {
  it("marks Factory + Items cells with hideable classes and injects a media query", async () => {
    mockFetch();
    renderWithQuery(<OrdersClient canCreate canDelete />);
    await screen.findAllByText("AB-2026-0001");
    expect(
      document.querySelectorAll("td.orders-col-factory").length,
    ).toBeGreaterThan(0);
    expect(
      document.querySelectorAll("td.orders-col-items").length,
    ).toBeGreaterThan(0);
    const styleTag = document.querySelector("style");
    expect(styleTag?.textContent).toMatch(/orders-col-factory/);
    expect(styleTag?.textContent).toMatch(/max-width: 1023px/);
  });
});

// ── FilterTabs standalone (selection) ────────────────────────────────────────

describe("FilterTabs (standalone)", () => {
  it("fires onSelect with the clicked group id", () => {
    const onSelect = vi.fn();
    render(
      <FilterTabs
        activeId="all"
        counts={{
          all: 10,
          draft: 3,
          pricing: 2,
          payment: 1,
          production: 4,
          shipping: 0,
          customs: 0,
          delivered: 0,
          completed: 0,
        }}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: /Production/i }));
    expect(onSelect).toHaveBeenCalledWith("production");
  });
});

// Re-export act to keep TS linter happy even though we rarely call it.
void act;
