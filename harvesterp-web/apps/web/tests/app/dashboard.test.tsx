/**
 * dashboard.test.tsx — Unit tests for the migrated Internal dashboard.
 *
 * Covers the interactive client pieces and helper utilities directly.
 * The page-level RSC orchestration (page.tsx + RSC sections) is E2E scope
 * per apps/web/vitest.config.ts coverage excludes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import * as React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { WelcomeCard } from "../../src/app/(app)/dashboard/_components/welcome-card";
import { ActiveShipmentsSection } from "../../src/app/(app)/dashboard/_components/active-shipments";
import { RecentActivitySection } from "../../src/app/(app)/dashboard/_components/recent-activity";
import {
  StageChip,
  stageToneFor,
} from "../../src/components/composed/stage-chip";
import {
  formatCNY,
  formatCount,
  timeAgo,
} from "../../src/app/(app)/dashboard/_components/formatters";
import type {
  ActiveShipment,
  RecentActivityEvent,
} from "../../src/app/(app)/dashboard/_components/types";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard",
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

const SAMPLE_SHIPMENTS: ActiveShipment[] = [
  {
    id: "ord-1",
    order_number: "AB-2026-0042",
    po_reference: "PO-500",
    factory_name: "Changzhou Xinlikang",
    total_value_cny: 1_234_567,
    stage_number: 7,
    stage_name: "Packing",
  },
  {
    id: "ord-2",
    order_number: "AB-2026-0088",
    po_reference: null,
    factory_name: "Changzhou Xinlikang",
    total_value_cny: 500_000,
    stage_number: 18,
    stage_name: "Sailing",
  },
];

const SAMPLE_EVENTS: RecentActivityEvent[] = [
  {
    id: "evt-1",
    action: "Order AB-2026-0042 moved to Packing",
    details: "Factory reported pack complete for 12 SKUs",
    updated_at: new Date(Date.now() - 3 * 60_000).toISOString(),
  },
];

function mockFetchShipments(shipments: ActiveShipment[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/dashboard/active-shipments")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ shipments }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    }),
  );
}

function mockFetchEvents(events: RecentActivityEvent[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/dashboard/recent-activity")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ events }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      });
    }),
  );
}

function mockFetchFailure(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.resolve({ error: "upstream down" }),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  try {
    window.localStorage.clear();
  } catch {
    // jsdom always has localStorage; ignore just in case
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── WelcomeCard ───────────────────────────────────────────────────────────────

describe("WelcomeCard", () => {
  it("welcome card appears on first visit (no localStorage key)", async () => {
    render(<WelcomeCard userName="Ravi" />);
    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: /welcome/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/welcome to harvesterp, ravi/i)).toBeInTheDocument();
  });

  it("welcome card dismissed and does not reappear on the same browser", async () => {
    const { unmount } = render(<WelcomeCard userName="Ravi" />);
    await userEvent.click(
      await screen.findByRole("button", { name: /dismiss welcome message/i }),
    );
    expect(
      screen.queryByRole("region", { name: /welcome/i }),
    ).not.toBeInTheDocument();
    expect(window.localStorage.getItem("dashboard_welcomed")).toBe("1");

    unmount();
    render(<WelcomeCard userName="Ravi" />);
    // wait a tick for the effect to run
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("region", { name: /welcome/i })).toBeNull();
  });

  it("welcome card stays hidden when localStorage key is already set", async () => {
    window.localStorage.setItem("dashboard_welcomed", "1");
    render(<WelcomeCard userName="Ravi" />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByRole("region", { name: /welcome/i })).toBeNull();
  });
});

// ── ActiveShipmentsSection ────────────────────────────────────────────────────

describe("ActiveShipmentsSection", () => {
  it("renders with mocked data from the active-shipments endpoint", async () => {
    mockFetchShipments(SAMPLE_SHIPMENTS);
    renderWithQuery(<ActiveShipmentsSection />);
    expect(await screen.findByText("AB-2026-0042")).toBeInTheDocument();
    expect(screen.getByText("AB-2026-0088")).toBeInTheDocument();
    // CNY formatting: ¥ 1,234,567
    expect(screen.getByText(/¥\s*1,234,567/)).toBeInTheDocument();
  });

  it("empty state renders when active-shipments returns empty array", async () => {
    mockFetchShipments([]);
    renderWithQuery(<ActiveShipmentsSection />);
    expect(
      await screen.findByText(/no active shipments\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /create a new order/i }),
    ).toBeInTheDocument();
  });

  it("loading skeleton renders while data fetches", () => {
    // fetch never resolves in this test — verifies the initial state
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    renderWithQuery(<ActiveShipmentsSection />);
    // Skeleton uses aria-hidden="true" containers — assert via absence of
    // the empty state message and error text while still in flight
    expect(screen.queryByText(/no active shipments\./i)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText(/active shipments/i)).toBeInTheDocument();
  });

  it("error state renders with a Retry button when the endpoint fails", async () => {
    mockFetchFailure();
    renderWithQuery(<ActiveShipmentsSection />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/couldn't load active shipments/i);
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("stage >=15 renders the shipment row without crashing (color fallback fixed)", async () => {
    mockFetchShipments(SAMPLE_SHIPMENTS);
    renderWithQuery(<ActiveShipmentsSection />);
    const stageChip = await screen.findByLabelText(/stage 18: sailing/i);
    expect(stageChip).toBeInTheDocument();
    // Also confirms the chip uses the shared .chip class (not the legacy
    // silent-slate fallback via custom tailwind strings)
    expect(stageChip.className).toMatch(/\bchip\b/);
  });

  it("retry invokes another fetch after a failure", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: () => Promise.resolve({ error: "x" }),
    });
    vi.stubGlobal("fetch", fetchFn);
    renderWithQuery(<ActiveShipmentsSection />);
    const retry = await screen.findByRole("button", { name: /retry/i });
    // Second call resolves with empty list so the UI settles on the empty state
    fetchFn.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ shipments: [] }),
    });
    fireEvent.click(retry);
    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });
  });
});

// ── RecentActivitySection ─────────────────────────────────────────────────────

describe("RecentActivitySection", () => {
  it("empty state uses CTA pattern when no events are returned", async () => {
    mockFetchEvents([]);
    renderWithQuery(<RecentActivitySection />);
    expect(await screen.findByText(/no recent activity\./i)).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /view all orders/i }).length,
    ).toBeGreaterThan(0);
  });

  it("renders activity rows with the mocked events", async () => {
    mockFetchEvents(SAMPLE_EVENTS);
    renderWithQuery(<RecentActivitySection />);
    expect(
      await screen.findByText(/order ab-2026-0042 moved to packing/i),
    ).toBeInTheDocument();
  });
});

// ── Formatters / stage chip ───────────────────────────────────────────────────

describe("formatters", () => {
  it("formatCNY returns an em dash for null and zero", () => {
    expect(formatCNY(null)).toBe("\u2014");
    expect(formatCNY(undefined)).toBe("\u2014");
    expect(formatCNY(0)).toBe("\u2014");
  });

  it("formatCNY renders ¥ symbol and US grouping for positive numbers", () => {
    expect(formatCNY(1_234_567)).toBe("\u00a5 1,234,567");
  });

  it("formatCount applies Indian grouping (en-IN locale) on KPI values", () => {
    // 100,000 in Indian locale is "1,00,000" (lakhs grouping)
    expect(formatCount(100_000)).toBe("1,00,000");
    expect(formatCount(null)).toBe("\u2014");
  });

  it("timeAgo buckets recent times into Just now / mins / hours / days", () => {
    const base = new Date("2026-04-23T12:00:00Z").getTime();
    expect(timeAgo(new Date(base - 30_000).toISOString(), base)).toBe(
      "Just now",
    );
    expect(timeAgo(new Date(base - 5 * 60_000).toISOString(), base)).toBe(
      "5 mins ago",
    );
    expect(
      timeAgo(new Date(base - 3 * 60 * 60_000).toISOString(), base),
    ).toBe("3 hours ago");
    expect(
      timeAgo(new Date(base - 24 * 60 * 60_000).toISOString(), base),
    ).toBe("Yesterday");
  });
});

describe("stage chip tone mapping", () => {
  it("returns distinct tones for stages 1, 2, 5, 11, 13", () => {
    expect(stageToneFor(1)).toBe("chip");
    expect(stageToneFor(2)).toBe("chip chip-warn");
    expect(stageToneFor(5)).toBe("chip chip-info");
    expect(stageToneFor(11)).toBe("chip chip-accent");
    expect(stageToneFor(13)).toBe("chip chip-ok");
  });

  it("encodes the late stages 15-17 + falls through to neutral for out-of-range values", () => {
    // Stages 15-17 added in orders-foundation PR (research §5.5):
    //   15 DELIVERED → chip-ok ; 16 AFTER_SALES → chip-ok ; 17 COMPLETED → chip-accent
    expect(stageToneFor(15)).toBe("chip chip-ok");
    expect(stageToneFor(16)).toBe("chip chip-ok");
    expect(stageToneFor(17)).toBe("chip chip-accent");
    // Truly out-of-range (incl. Vue's phantom FACTORY_PAYMENT at 18) → neutral.
    expect(stageToneFor(18)).toBe("chip");
    expect(stageToneFor(22)).toBe("chip");
    expect(stageToneFor(99)).toBe("chip");
  });

  it("StageChip renders stage name and an accessible label even at high stage numbers", () => {
    render(<StageChip stageNumber={18} stageName="Sailing" />);
    const chip = screen.getByLabelText(/stage 18: sailing/i);
    expect(chip).toBeInTheDocument();
    expect(chip.textContent).toMatch(/S18\s+Sailing/);
  });
});

// ── No accidental role-gating ─────────────────────────────────────────────────

describe("no RoleGate on dashboard (decision #2)", () => {
  const DASHBOARD_COMPONENTS = [
    "kpi-summary.tsx",
    "client-inquiries.tsx",
    "active-shipments.tsx",
    "recent-activity.tsx",
    "welcome-card.tsx",
    "../page.tsx",
  ];
  const HERE = dirname(fileURLToPath(import.meta.url));
  const base = resolve(HERE, "../../src/app/(app)/dashboard/_components");

  for (const rel of DASHBOARD_COMPONENTS) {
    it(`does not import RoleGate in ${rel}`, () => {
      const src = readFileSync(resolve(base, rel), "utf8");
      expect(src).not.toMatch(/role-gate/i);
      expect(src).not.toMatch(/RoleGate/);
    });
  }
});
