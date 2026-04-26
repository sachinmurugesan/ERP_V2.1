/**
 * order-detail-shell.test.tsx — Integration tests for the order-detail
 * shell page at /orders-shell-preview/:id (B3 sandbox).
 *
 * Covers: header rendering, role gating, banners, stage stepper, transition
 * action bar, modals, deferred-tab fallback, deep-link surface, and mobile
 * responsive behaviour.
 *
 * The page-level RSC wrapper (page.tsx) handles fetch + 404/403/error
 * branches before the client orchestrator mounts; these tests exercise the
 * client orchestrator directly with mocked initial data.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { OrderShellClient } from "../../src/app/(app)/orders-shell-preview/[id]/_components/order-shell-client";
import { OrderHeader } from "../../src/app/(app)/orders-shell-preview/[id]/_components/order-header";
import { ClientDraftBanner } from "../../src/app/(app)/orders-shell-preview/[id]/_components/client-draft-banner";
import { FactoryNotAssignedBanner } from "../../src/app/(app)/orders-shell-preview/[id]/_components/factory-not-assigned-banner";
import { TransitionActionBar } from "../../src/app/(app)/orders-shell-preview/[id]/_components/transition-action-bar";
import {
  TransitionErrorBanner,
  navigateToFix,
} from "../../src/app/(app)/orders-shell-preview/[id]/_components/transition-error-banner";
import { OrderTabs } from "../../src/app/(app)/orders-shell-preview/[id]/_components/order-tabs";
import type {
  OrderDetail,
  OrderTimelineResponse,
  NextStagesResponse,
} from "../../src/app/(app)/orders-shell-preview/[id]/_components/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/orders-shell-preview/o1",
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
    currency: "CNY",
    exchange_rate: null,
    exchange_rate_date: null,
    po_reference: "PO-100",
    notes: null,
    reopen_count: 0,
    last_reopen_reason: null,
    igst_credit_amount: 0,
    igst_credit_claimed: false,
    completed_at: null,
    created_at: "2026-04-26T00:00:00",
    updated_at: null,
    client_name: "Acme Corp",
    factory_name: "Changzhou Xinlikang",
    item_count: 0,
    total_value_cny: 0,
    stage_number: 1,
    stage_name: "Draft",
    highest_unlocked_stage: null,
    pi_stale: false,
    version: 1,
    client_reference: null,
    client_type: "REGULAR",
    query_counts: { total: 0, open: 0, replied: 0 },
    ...overrides,
  };
}

function makeTimeline(): OrderTimelineResponse {
  return {
    current_status: "DRAFT",
    current_stage: 1,
    current_name: "Draft",
    timeline: [
      { stage: 1, name: "Draft", status: "current" },
      { stage: 2, name: "Pending PI", status: "pending" },
      { stage: 3, name: "PI Sent", status: "pending" },
    ],
    overrides: [],
  };
}

function makeNextStages(): NextStagesResponse {
  return {
    current_status: "DRAFT",
    current_stage: [1, "Draft"],
    next_stages: [{ status: "PENDING_PI", stage: 2, name: "Pending PI" }],
    prev_stage: null,
    reachable_previous: [],
    reachable_forward: [],
    highest_unlocked_stage: null,
  };
}

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/timeline")) {
        return {
          ok: true,
          status: 200,
          json: async () => makeTimeline(),
        } as unknown as Response;
      }
      if (url.includes("/next-stages")) {
        return {
          ok: true,
          status: 200,
          json: async () => makeNextStages(),
        } as unknown as Response;
      }
      if (url.includes("/factories")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: [] }),
        } as unknown as Response;
      }
      if (url.includes("/api/orders/")) {
        return {
          ok: true,
          status: 200,
          json: async () => makeOrder(),
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as unknown as Response;
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── OrderHeader (unit) ──────────────────────────────────────────────────────

describe("OrderHeader", () => {
  it("renders order number, client, factory, PO", () => {
    render(
      <OrderHeader
        order={makeOrder()}
        role="ADMIN"
        onDeleteClick={() => {}}
        onReopenClick={() => {}}
      />,
    );
    expect(screen.getByText("AB-2026-0001")).toBeInTheDocument();
    expect(screen.getByTestId("header-client")).toHaveTextContent("Acme Corp");
    expect(screen.getByTestId("header-factory")).toHaveTextContent(
      "Changzhou Xinlikang",
    );
    expect(screen.getByTestId("header-po")).toHaveTextContent("PO: PO-100");
  });

  it("falls back to 'DRAFT ORDER' when order_number is null", () => {
    render(
      <OrderHeader
        order={makeOrder({ order_number: null })}
        role="ADMIN"
        onDeleteClick={() => {}}
        onReopenClick={() => {}}
      />,
    );
    expect(screen.getByText("DRAFT ORDER")).toBeInTheDocument();
  });

  it("renders the StageChip with stage_number + stage_name", () => {
    render(
      <OrderHeader
        order={makeOrder({ stage_number: 5, stage_name: "Factory Ordered" })}
        role="ADMIN"
        onDeleteClick={() => {}}
        onReopenClick={() => {}}
      />,
    );
    expect(
      screen.getByLabelText(/stage 5: factory ordered/i),
    ).toBeInTheDocument();
  });

  it("Transparency Client badge visible only to SUPER_ADMIN/ADMIN AND TRANSPARENCY clients", () => {
    const { rerender } = render(
      <OrderHeader
        order={makeOrder({ client_type: "TRANSPARENCY" })}
        role="SUPER_ADMIN"
        onDeleteClick={() => {}}
        onReopenClick={() => {}}
      />,
    );
    expect(screen.getByTestId("transparency-badge")).toBeInTheDocument();

    rerender(
      <OrderHeader
        order={makeOrder({ client_type: "TRANSPARENCY" })}
        role="FINANCE"
        onDeleteClick={() => {}}
        onReopenClick={() => {}}
      />,
    );
    expect(screen.queryByTestId("transparency-badge")).toBeNull();

    rerender(
      <OrderHeader
        order={makeOrder({ client_type: "REGULAR" })}
        role="SUPER_ADMIN"
        onDeleteClick={() => {}}
        onReopenClick={() => {}}
      />,
    );
    expect(screen.queryByTestId("transparency-badge")).toBeNull();
  });

  it("Delete button visible only for DRAFT + ORDER_UPDATE roles", () => {
    const { rerender } = render(
      <OrderHeader
        order={makeOrder({ status: "DRAFT" })}
        role="ADMIN"
        onDeleteClick={() => {}}
        onReopenClick={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: /delete draft order/i }),
    ).toBeInTheDocument();

    // Non-DRAFT status hides delete
    rerender(
      <OrderHeader
        order={makeOrder({ status: "PENDING_PI" })}
        role="ADMIN"
        onDeleteClick={() => {}}
        onReopenClick={() => {}}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /delete draft order/i }),
    ).toBeNull();

    // DRAFT but FINANCE role (no ORDER_UPDATE) hides delete
    rerender(
      <OrderHeader
        order={makeOrder({ status: "DRAFT" })}
        role="FINANCE"
        onDeleteClick={() => {}}
        onReopenClick={() => {}}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /delete draft order/i }),
    ).toBeNull();
  });

  it("Re-open button visible only for COMPLETED + ORDER_REOPEN role (ADMIN)", () => {
    const { rerender } = render(
      <OrderHeader
        order={makeOrder({ status: "COMPLETED" })}
        role="ADMIN"
        onDeleteClick={() => {}}
        onReopenClick={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: /re-open order/i }),
    ).toBeInTheDocument();

    // OPERATIONS lacks ORDER_REOPEN — hidden.
    rerender(
      <OrderHeader
        order={makeOrder({ status: "COMPLETED" })}
        role="OPERATIONS"
        onDeleteClick={() => {}}
        onReopenClick={() => {}}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /re-open order/i }),
    ).toBeNull();

    // COMPLETED but no role — hidden.
    rerender(
      <OrderHeader
        order={makeOrder({ status: "COMPLETED" })}
        role={undefined}
        onDeleteClick={() => {}}
        onReopenClick={() => {}}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /re-open order/i }),
    ).toBeNull();
  });
});

// ── ClientDraftBanner ───────────────────────────────────────────────────────

describe("ClientDraftBanner", () => {
  it("renders factory + currency selectors and Approve button for ADMIN", () => {
    render(
      <ClientDraftBanner
        role="ADMIN"
        factories={[
          { id: "f1", name: "Acme Factory" },
          { id: "f2", name: "Beta Factory" },
        ]}
        factoriesLoading={false}
        onFactoriesNeeded={() => {}}
        onApprove={() => {}}
        isPending={false}
      />,
    );
    expect(screen.getByTestId("cd-factory-select")).toBeInTheDocument();
    expect(screen.getByTestId("cd-currency-select")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /approve and create order/i }),
    ).toBeInTheDocument();
  });

  it("Approve button disabled until factory selected", () => {
    render(
      <ClientDraftBanner
        role="ADMIN"
        factories={[{ id: "f1", name: "Acme" }]}
        factoriesLoading={false}
        onFactoriesNeeded={() => {}}
        onApprove={() => {}}
        isPending={false}
      />,
    );
    const btn = screen.getByRole("button", { name: /approve and create order/i });
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByTestId("cd-factory-select"), {
      target: { value: "f1" },
    });
    expect(btn).not.toBeDisabled();
  });

  it("hides selectors + button for FACTORY role (no ORDER_APPROVE_INQUIRY)", () => {
    render(
      <ClientDraftBanner
        role="FACTORY"
        factories={[]}
        factoriesLoading={false}
        onFactoriesNeeded={() => {}}
        onApprove={() => {}}
        isPending={false}
      />,
    );
    expect(screen.queryByTestId("cd-factory-select")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /approve/i }),
    ).toBeNull();
  });

  it("FINANCE role can approve (matches backend's any-INTERNAL gate)", () => {
    render(
      <ClientDraftBanner
        role="FINANCE"
        factories={[{ id: "f1", name: "Acme" }]}
        factoriesLoading={false}
        onFactoriesNeeded={() => {}}
        onApprove={() => {}}
        isPending={false}
      />,
    );
    expect(screen.getByTestId("cd-factory-select")).toBeInTheDocument();
  });
});

// ── FactoryNotAssignedBanner ────────────────────────────────────────────────

describe("FactoryNotAssignedBanner", () => {
  it("renders factory picker + Assign button for OPERATIONS", () => {
    render(
      <FactoryNotAssignedBanner
        role="OPERATIONS"
        factories={[{ id: "f1", name: "Acme" }]}
        factoriesLoading={false}
        onFactoriesNeeded={() => {}}
        onAssign={() => {}}
        isPending={false}
      />,
    );
    expect(screen.getByTestId("fna-factory-select")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /assign factory to this order/i }),
    ).toBeInTheDocument();
  });

  it("hides picker for FINANCE role (no ORDER_UPDATE)", () => {
    render(
      <FactoryNotAssignedBanner
        role="FINANCE"
        factories={[]}
        factoriesLoading={false}
        onFactoriesNeeded={() => {}}
        onAssign={() => {}}
        isPending={false}
      />,
    );
    expect(screen.queryByTestId("fna-factory-select")).toBeNull();
  });
});

// ── TransitionActionBar ─────────────────────────────────────────────────────

describe("TransitionActionBar", () => {
  it("renders 'Next: ...' button for each next_stages entry (ADMIN)", () => {
    render(
      <TransitionActionBar
        nextStages={makeNextStages()}
        role="ADMIN"
        pending={false}
        onAdvance={() => {}}
        onGoBack={() => {}}
        onReturnTo={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: /advance to pending pi/i }),
    ).toBeInTheDocument();
  });

  it("hides entire bar for FINANCE role (no ORDER_TRANSITION)", () => {
    const { container } = render(
      <TransitionActionBar
        nextStages={makeNextStages()}
        role="FINANCE"
        pending={false}
        onAdvance={() => {}}
        onGoBack={() => {}}
        onReturnTo={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("hides entire bar when no actions available", () => {
    const empty: NextStagesResponse = {
      current_status: "COMPLETED",
      current_stage: [17, "Completed"],
      next_stages: [],
      prev_stage: null,
      reachable_previous: [],
      reachable_forward: [],
      highest_unlocked_stage: null,
    };
    const { container } = render(
      <TransitionActionBar
        nextStages={empty}
        role="ADMIN"
        pending={false}
        onAdvance={() => {}}
        onGoBack={() => {}}
        onReturnTo={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("disables all buttons when pending=true", () => {
    render(
      <TransitionActionBar
        nextStages={makeNextStages()}
        role="ADMIN"
        pending={true}
        onAdvance={() => {}}
        onGoBack={() => {}}
        onReturnTo={() => {}}
      />,
    );
    const advance = screen.getByRole("button", {
      name: /advance to pending pi/i,
    });
    expect(advance).toBeDisabled();
  });

  it("clicking 'Next' fires onAdvance with the target option", () => {
    const onAdvance = vi.fn();
    render(
      <TransitionActionBar
        nextStages={makeNextStages()}
        role="ADMIN"
        pending={false}
        onAdvance={onAdvance}
        onGoBack={() => {}}
        onReturnTo={() => {}}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /advance to pending pi/i }),
    );
    expect(onAdvance).toHaveBeenCalledWith({
      status: "PENDING_PI",
      stage: 2,
      name: "Pending PI",
    });
  });
});

// ── TransitionErrorBanner ───────────────────────────────────────────────────

describe("TransitionErrorBanner + navigateToFix", () => {
  it("renders nothing when error is null", () => {
    const { container } = render(
      <TransitionErrorBanner
        error={null}
        onDismiss={() => {}}
        onJumpToFix={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders error message + click-to-fix link for known errors", () => {
    const onJumpToFix = vi.fn();
    render(
      <TransitionErrorBanner
        error="Order must have at least one item"
        onDismiss={() => {}}
        onJumpToFix={onJumpToFix}
      />,
    );
    const banner = screen.getByTestId("transition-error-banner");
    expect(banner).toHaveTextContent(/at least one item/i);
    expect(banner).toHaveTextContent(/click to fix/i);
    fireEvent.click(within(banner).getByRole("button", { name: /click to fix/i }));
    expect(onJumpToFix).toHaveBeenCalledWith({
      tab: "items",
      highlightSection: "add-item",
    });
  });

  it("dismiss button calls onDismiss", () => {
    const onDismiss = vi.fn();
    render(
      <TransitionErrorBanner
        error="random error"
        onDismiss={onDismiss}
        onJumpToFix={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("navigateToFix maps known error substrings to (tab, section) pairs", () => {
    expect(navigateToFix("Client is required")).toEqual({
      tab: "items",
      highlightSection: "client",
    });
    expect(navigateToFix("Items are missing selling prices")).toEqual({
      tab: "items",
      highlightSection: "pricing",
    });
    expect(navigateToFix("payment must be recorded first")).toEqual({
      tab: "payments",
      highlightSection: "add-payment",
    });
    expect(navigateToFix("PI not generated for this order")).toEqual({
      tab: "items",
      highlightSection: "pi",
    });
    expect(navigateToFix("unrecognized error message")).toBeNull();
  });
});

// ── OrderTabs (visibility + deferred fallback) ──────────────────────────────

describe("OrderTabs", () => {
  it("renders only Dashboard / Items / Queries / Files for DRAFT order (no PostPI tabs)", () => {
    render(
      <OrderTabs
        order={makeOrder({ status: "DRAFT" })}
        role="ADMIN"
        initialTab={null}
        initialQuery={null}
      />,
    );
    const tablist = screen.getByTestId("tabs-list");
    expect(within(tablist).getByRole("tab", { name: /dashboard/i })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: /order items/i })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: /queries/i })).toBeInTheDocument();
    expect(within(tablist).getByRole("tab", { name: /files/i })).toBeInTheDocument();
    // Stage-gated tabs hidden for DRAFT
    expect(within(tablist).queryByRole("tab", { name: /payments/i })).toBeNull();
    expect(within(tablist).queryByRole("tab", { name: /production/i })).toBeNull();
    expect(within(tablist).queryByRole("tab", { name: /booking/i })).toBeNull();
  });

  it("renders Payments tab when status is PostPI (e.g. PI_SENT)", () => {
    render(
      <OrderTabs
        order={makeOrder({ status: "PI_SENT" })}
        role="ADMIN"
        initialTab={null}
        initialQuery={null}
      />,
    );
    expect(screen.getByRole("tab", { name: /payments/i })).toBeInTheDocument();
  });

  it("renders Landed Cost tab only for TRANSPARENCY + CLEARED+ + ADMIN/SUPER_ADMIN/FINANCE", () => {
    render(
      <OrderTabs
        order={makeOrder({ status: "DELIVERED", client_type: "TRANSPARENCY" })}
        role="FINANCE"
        initialTab={null}
        initialQuery={null}
      />,
    );
    expect(
      screen.getByRole("tab", { name: /landed cost/i }),
    ).toBeInTheDocument();
  });

  it("hides Landed Cost tab for OPERATIONS role even on TRANSPARENCY DELIVERED order", () => {
    render(
      <OrderTabs
        order={makeOrder({ status: "DELIVERED", client_type: "TRANSPARENCY" })}
        role="OPERATIONS"
        initialTab={null}
        initialQuery={null}
      />,
    );
    expect(
      screen.queryByRole("tab", { name: /landed cost/i }),
    ).toBeNull();
  });

  it("Queries tab shows badge with count when total > 0", () => {
    render(
      <OrderTabs
        order={makeOrder({
          query_counts: { total: 5, open: 3, replied: 1 },
        })}
        role="ADMIN"
        initialTab={null}
        initialQuery={null}
      />,
    );
    const badge = screen.getByTestId("queries-tab-badge");
    expect(badge).toHaveTextContent("5");
    // Pulse + red tone when there are open queries
    expect(badge.className).toMatch(/animate-pulse/);
  });

  it("Queries tab has NO badge when total === 0", () => {
    render(
      <OrderTabs
        order={makeOrder({
          query_counts: { total: 0, open: 0, replied: 0 },
        })}
        role="ADMIN"
        initialTab={null}
        initialQuery={null}
      />,
    );
    expect(screen.queryByTestId("queries-tab-badge")).toBeNull();
  });

  it("sticky tab bar element has the sticky class hint", () => {
    render(
      <OrderTabs
        order={makeOrder()}
        role="ADMIN"
        initialTab={null}
        initialQuery={null}
      />,
    );
    expect(screen.getByTestId("sticky-tab-bar").className).toMatch(/sticky/);
    expect(screen.getByTestId("sticky-tab-bar").className).toMatch(/top-0/);
  });

  it("deep-link initialTab='payments' on PI_SENT order activates Payments tab", () => {
    render(
      <OrderTabs
        order={makeOrder({ status: "PI_SENT" })}
        role="ADMIN"
        initialTab="payments"
        initialQuery={null}
      />,
    );
    const paymentsTab = screen.getByRole("tab", { name: /payments/i });
    expect(paymentsTab.getAttribute("data-state")).toBe("active");
  });

  it("invalid initialTab falls back to default for current status", () => {
    render(
      <OrderTabs
        order={makeOrder({ status: "FACTORY_ORDERED" })}
        role="ADMIN"
        initialTab="not-a-real-tab"
        initialQuery={null}
      />,
    );
    // FACTORY_ORDERED defaults to production
    const productionTab = screen.getByRole("tab", { name: /production/i });
    expect(productionTab.getAttribute("data-state")).toBe("active");
  });

  it("active TabsContent renders the deferred-tab fallback skeleton", () => {
    render(
      <OrderTabs
        order={makeOrder()}
        role="ADMIN"
        initialTab={null}
        initialQuery={null}
      />,
    );
    // Default tab for DRAFT is "dashboard"
    expect(screen.getByTestId("deferred-tab-dashboard")).toBeInTheDocument();
    expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/redirecting to legacy view/i)).toBeInTheDocument();
  });
});

// ── OrderShellClient (orchestrator integration) ─────────────────────────────

describe("OrderShellClient — orchestration", () => {
  it("renders the full shell skeleton (header + tab nav) for an ADMIN viewing a DRAFT order", async () => {
    renderWithQuery(
      <OrderShellClient initialOrder={makeOrder()} role="ADMIN" />,
    );
    expect(screen.getByText("AB-2026-0001")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    // Wait for tabs to render after queries settle
    await waitFor(() => {
      expect(screen.getByTestId("tabs-list")).toBeInTheDocument();
    });
  });

  it("shows CLIENT_DRAFT banner when status is CLIENT_DRAFT", () => {
    renderWithQuery(
      <OrderShellClient
        initialOrder={makeOrder({ status: "CLIENT_DRAFT" })}
        role="ADMIN"
      />,
    );
    expect(screen.getByTestId("client-draft-banner")).toBeInTheDocument();
  });

  it("shows factory-not-assigned banner when DRAFT + factory_id is null", () => {
    renderWithQuery(
      <OrderShellClient
        initialOrder={makeOrder({ status: "DRAFT", factory_id: null })}
        role="ADMIN"
      />,
    );
    expect(
      screen.getByTestId("factory-not-assigned-banner"),
    ).toBeInTheDocument();
  });

  it("does NOT show factory-not-assigned banner when factory IS assigned", () => {
    renderWithQuery(
      <OrderShellClient
        initialOrder={makeOrder({ status: "DRAFT", factory_id: "f1" })}
        role="ADMIN"
      />,
    );
    expect(screen.queryByTestId("factory-not-assigned-banner")).toBeNull();
  });

  it("clicking Delete opens the confirmation modal", async () => {
    renderWithQuery(
      <OrderShellClient initialOrder={makeOrder({ status: "DRAFT" })} role="ADMIN" />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /delete draft order/i }),
    );
    await waitFor(() => {
      expect(
        screen.getByText(/delete draft order ab-2026-0001/i),
      ).toBeInTheDocument();
    });
  });

  it("clicking Re-open opens the re-open modal (COMPLETED + ADMIN)", async () => {
    renderWithQuery(
      <OrderShellClient
        initialOrder={makeOrder({ status: "COMPLETED" })}
        role="ADMIN"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /re-open order/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/re-open this completed order/i),
      ).toBeInTheDocument();
    });
  });
});
