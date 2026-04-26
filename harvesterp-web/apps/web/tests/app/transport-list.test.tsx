/**
 * transport-list.test.tsx — Integration tests for the TransportClient
 * orchestrator (column order, search debounce, role gating, empty
 * states, pagination wiring, mobile cards, delete flow + Vue-bug fixes).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { TransportClient } from "../../src/app/(app)/transport/_components/transport-client";
import type { TransportListResponse } from "../../src/app/(app)/transport/_components/types";

const seed: TransportListResponse = {
  items: [
    {
      id: "p1",
      name: "Maersk India Pvt Ltd",
      contact_person: "Vikram Singh",
      phone: "+91 22 6688 4400",
      city: "Mumbai",
      state: "Maharashtra",
      gst_number: "27AAACM3855B1Z5",
      pan_number: "AAACM3855B",
      roles: ["FREIGHT_FORWARDER", "CHA"],
      operating_ports: ["MUMBAI"],
      is_active: true,
      created_at: "2026-04-26T00:00:00",
      updated_at: null,
    },
    {
      id: "p2",
      name: "Chennai Container Freight Station",
      contact_person: "Sundar Raman",
      phone: "+91 44 2552 1100",
      city: "Chennai",
      state: "Tamil Nadu",
      gst_number: "33AAACC1234F1Z9",
      pan_number: "AAACC1234F",
      roles: ["CFS"],
      operating_ports: ["CHENNAI"],
      is_active: true,
      created_at: "2026-04-26T00:00:00",
      updated_at: null,
    },
  ],
  total: 2,
  page: 1,
  per_page: 50,
  pages: 1,
};

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => seed,
    } as unknown as Response)),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Rendering: header + counts ──────────────────────────────────────────────

describe("TransportClient — header + counts", () => {
  it("renders the page heading 'Service Providers'", () => {
    renderWithClient(<TransportClient initialData={seed} role="ADMIN" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Service Providers",
    );
  });

  it("renders provider count (plural)", () => {
    renderWithClient(<TransportClient initialData={seed} role="ADMIN" />);
    expect(screen.getByText(/2 providers/i)).toBeInTheDocument();
  });

  it("renders provider count (singular: '1 provider')", () => {
    const single = { ...seed, items: [seed.items[0]], total: 1 };
    renderWithClient(<TransportClient initialData={single} role="ADMIN" />);
    expect(screen.getByText(/1 provider/i)).toBeInTheDocument();
    expect(screen.queryByText(/1 providers/i)).toBeNull();
  });
});

// ── Column order (Phase 2 §2.2 + decision #1) ────────────────────────────────

describe("TransportClient — column order", () => {
  it("renders columns in the order Name | Roles | Location | Contact | GST/PAN | Actions", () => {
    renderWithClient(<TransportClient initialData={seed} role="ADMIN" />);
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent ?? "");
    // First column is Name, second is Roles. Location must precede Contact (the swap).
    const nameIdx = headers.findIndex((h) => /^Name$/i.test(h.trim()));
    const rolesIdx = headers.findIndex((h) => /^Roles$/i.test(h.trim()));
    const locIdx = headers.findIndex((h) => /^Location$/i.test(h.trim()));
    const contactIdx = headers.findIndex((h) => /^Contact$/i.test(h.trim()));
    const gstpanIdx = headers.findIndex((h) => /GST.*PAN/i.test(h.trim()));
    const actionsIdx = headers.findIndex((h) => /^Actions$/i.test(h.trim()));
    expect(nameIdx).toBeGreaterThanOrEqual(0);
    expect(rolesIdx).toBeGreaterThan(nameIdx);
    expect(locIdx).toBeGreaterThan(rolesIdx);
    expect(contactIdx).toBeGreaterThan(locIdx);
    expect(gstpanIdx).toBeGreaterThan(contactIdx);
    expect(actionsIdx).toBeGreaterThan(gstpanIdx);
  });
});

// ── Roles cell rendering ────────────────────────────────────────────────────

describe("TransportClient — roles rendering", () => {
  it("renders multi-role pill wrap inside the Maersk row", () => {
    renderWithClient(<TransportClient initialData={seed} role="ADMIN" />);
    // Both desktop pills wrap and mobile-card pills exist; just check both labels appear
    expect(screen.getAllByText(/Freight Forwarder/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/^CHA$/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders single role for the CFS row", () => {
    renderWithClient(<TransportClient initialData={seed} role="ADMIN" />);
    expect(screen.getAllByText(/^CFS$/i).length).toBeGreaterThanOrEqual(1);
  });
});

// ── Search input ────────────────────────────────────────────────────────────

describe("TransportClient — search", () => {
  it("renders search input with the right aria-label + placeholder", () => {
    renderWithClient(<TransportClient initialData={seed} role="ADMIN" />);
    const input = screen.getByRole("searchbox", {
      name: /search providers by name, contact, or city/i,
    });
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", expect.stringMatching(/Search by name, contact, city/i));
  });

  it("typing in the search input updates the input value immediately", () => {
    renderWithClient(<TransportClient initialData={seed} role="ADMIN" />);
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "maersk" } });
    expect(input.value).toBe("maersk");
  });
});

// ── Role gating (the Vue Bug 2 fix) ──────────────────────────────────────────

describe("TransportClient — role gating (Bug 2 fix)", () => {
  it("ADMIN sees Add provider + Edit + Delete", () => {
    renderWithClient(<TransportClient initialData={seed} role="ADMIN" />);
    expect(screen.getByRole("link", { name: /add provider/i })).toBeInTheDocument();
    // Edit links and Delete buttons appear in both desktop + mobile layouts (jsdom renders both)
    expect(screen.getAllByRole("link", { name: /edit Maersk/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("button", { name: /delete Maersk/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("OPERATIONS sees Add provider + Edit but NOT Delete", () => {
    renderWithClient(<TransportClient initialData={seed} role="OPERATIONS" />);
    expect(screen.getByRole("link", { name: /add provider/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /edit Maersk/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("button", { name: /delete Maersk/i })).toBeNull();
  });

  it("FINANCE sees no Add / Edit / Delete (read-only)", () => {
    renderWithClient(<TransportClient initialData={seed} role="FINANCE" />);
    expect(screen.queryByRole("link", { name: /add provider/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /edit/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });

  it("undefined role hides every write affordance (defensive)", () => {
    renderWithClient(<TransportClient initialData={seed} role={undefined} />);
    expect(screen.queryByRole("link", { name: /add provider/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /edit/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });
});

// ── Empty states ────────────────────────────────────────────────────────────

describe("TransportClient — empty states", () => {
  const empty: TransportListResponse = {
    items: [],
    total: 0,
    page: 1,
    per_page: 50,
    pages: 0,
  };

  it("fresh empty state (Pattern A) shows CTA when ADMIN", () => {
    renderWithClient(<TransportClient initialData={empty} role="ADMIN" />);
    expect(screen.getByText(/no service providers yet/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /add your first provider/i })).toBeInTheDocument();
  });

  it("fresh empty state hides CTA when FINANCE (no TRANSPORT_CREATE)", () => {
    renderWithClient(<TransportClient initialData={empty} role="FINANCE" />);
    expect(screen.getByText(/no service providers yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /add your first provider/i })).toBeNull();
  });
});

// ── Loading skeleton ─────────────────────────────────────────────────────────

describe("TransportClient — loading state", () => {
  it("shows skeletons when initial fetch resolves to undefined data", async () => {
    // Stub fetch to resolve slowly; pass empty initial so query enters loading
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise(() => {
            /* never resolves — keeps query in pending */
          }),
      ),
    );
    const { container } = renderWithClient(
      <TransportClient
        initialData={{ items: [], total: 0, page: 1, per_page: 50, pages: 0 }}
        role="ADMIN"
      />,
    );
    // Trigger non-initial key to force fetch
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "x" } });
    await waitFor(() => {
      const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });
});

// ── Error banner (Bug 1 fix — load failure) ─────────────────────────────────

describe("TransportClient — load error (Bug 1 fix)", () => {
  it("renders an error banner with retry button on fetch failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: "Upstream is on fire" }),
      } as unknown as Response)),
    );
    renderWithClient(
      <TransportClient
        initialData={{ items: [], total: 0, page: 1, per_page: 50, pages: 0 }}
        role="ADMIN"
      />,
    );
    // Trigger a non-initial-key fetch
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "trigger" } });
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
    expect(screen.getByText(/upstream is on fire/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});

// ── Pagination wiring ────────────────────────────────────────────────────────

describe("TransportClient — pagination", () => {
  const big: TransportListResponse = {
    ...seed,
    total: 200,
    pages: 4,
    per_page: 50,
  };

  it("renders pagination footer with rows-per-page selector", () => {
    renderWithClient(<TransportClient initialData={big} role="ADMIN" />);
    expect(screen.getByLabelText(/rows per page/i)).toBeInTheDocument();
  });

  it("rows-per-page selector defaults to 50 and offers 25/50/100", () => {
    renderWithClient(<TransportClient initialData={big} role="ADMIN" />);
    const select = screen.getByLabelText(/rows per page/i) as HTMLSelectElement;
    expect(select.value).toBe("50");
    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual(expect.arrayContaining(["25", "50", "100"]));
  });
});

// ── Delete dialog flow ───────────────────────────────────────────────────────

describe("TransportClient — delete dialog", () => {
  it("opens dialog with provider name when trash button clicked", async () => {
    renderWithClient(<TransportClient initialData={seed} role="ADMIN" />);
    const deleteBtns = screen.getAllByRole("button", { name: /delete Maersk/i });
    fireEvent.click(deleteBtns[0]);
    await waitFor(() => {
      expect(
        screen.getByText(/Delete Maersk India Pvt Ltd\?/i),
      ).toBeInTheDocument();
    });
  });

  it("Cancel closes the dialog without firing DELETE", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => seed,
    } as unknown as Response));
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<TransportClient initialData={seed} role="ADMIN" />);
    fireEvent.click(screen.getAllByRole("button", { name: /delete Maersk/i })[0]);
    await waitFor(() => {
      expect(screen.getByText(/Delete Maersk India Pvt Ltd\?/i)).toBeInTheDocument();
    });
    const cancelBtn = screen.getByRole("button", { name: /^cancel$/i });
    fireEvent.click(cancelBtn);
    await waitFor(() => {
      expect(screen.queryByText(/Delete Maersk India Pvt Ltd\?/i)).toBeNull();
    });
    // Only initial data — no DELETE issued
    const deleteCalls = fetchMock.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === "DELETE",
    );
    expect(deleteCalls).toHaveLength(0);
  });

  it("Confirm fires DELETE /api/transport/{id}", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true }),
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => seed,
      } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<TransportClient initialData={seed} role="ADMIN" />);
    fireEvent.click(screen.getAllByRole("button", { name: /delete Maersk/i })[0]);
    await waitFor(() => {
      expect(screen.getByText(/Delete Maersk India Pvt Ltd\?/i)).toBeInTheDocument();
    });
    const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      const deleteCall = fetchMock.mock.calls.find(
        (c) => (c[1] as RequestInit | undefined)?.method === "DELETE",
      );
      expect(deleteCall).toBeDefined();
      expect(String(deleteCall?.[0])).toMatch(/\/api\/transport\/p1$/);
    });
  });

  it("DELETE failure surfaces in the dialog (Bug 1 fix — delete error)", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return {
          ok: false,
          status: 403,
          json: async () => ({ error: "You don't have permission" }),
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => seed,
      } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<TransportClient initialData={seed} role="ADMIN" />);
    fireEvent.click(screen.getAllByRole("button", { name: /delete Maersk/i })[0]);
    await waitFor(() => {
      expect(screen.getByText(/Delete Maersk India Pvt Ltd\?/i)).toBeInTheDocument();
    });
    const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      // Error message appears in the dialog body
      expect(screen.getByText(/permission/i)).toBeInTheDocument();
    });
    // Dialog stays open
    expect(screen.getByText(/Delete Maersk India Pvt Ltd\?/i)).toBeInTheDocument();
  });
});

// ── Mobile card render at <md ───────────────────────────────────────────────

describe("TransportClient — mobile cards", () => {
  it("renders mobile cards (jsdom renders both layouts; this asserts the mobile node exists)", () => {
    const { container } = renderWithClient(
      <TransportClient initialData={seed} role="ADMIN" />,
    );
    // The mobile-cards container has the `md:hidden` class on its outer wrapper.
    const mobileSection = container.querySelector(".md\\:hidden");
    expect(mobileSection).not.toBeNull();
    // Both providers' names appear inside the mobile section
    if (mobileSection) {
      expect(within(mobileSection as HTMLElement).getByText(/Maersk India/i)).toBeInTheDocument();
      expect(within(mobileSection as HTMLElement).getByText(/Chennai Container Freight Station/i)).toBeInTheDocument();
    }
  });
});
