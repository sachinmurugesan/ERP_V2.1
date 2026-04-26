/**
 * clients-list.test.tsx — Integration tests for the ClientsClient
 * orchestrator (search debounce, role gating, empty states,
 * pagination wiring, mobile cards, delete flow).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

import { ClientsClient } from "../../src/app/(app)/clients/_components/clients-client";
import type { ClientsListResponse } from "../../src/app/(app)/clients/_components/types";

const seed: ClientsListResponse = {
  items: [
    {
      id: "c1",
      company_name: "Acme Corp",
      gstin: "22AAAAA0000A1Z5",
      iec: "0123456789",
      pan: "AAAAA0000A",
      address: null,
      city: "Mumbai",
      state: "MH",
      pincode: "400001",
      contact_name: "Anil",
      contact_phone: "+91 99999 99999",
      contact_email: "anil@acme.test",
      notes: null,
      is_active: true,
      client_type: "REGULAR",
    },
    {
      id: "c2",
      company_name: "Beta Industries",
      gstin: null,
      iec: null,
      pan: null,
      address: null,
      city: "Pune",
      state: "MH",
      pincode: null,
      contact_name: null,
      contact_phone: null,
      contact_email: null,
      notes: null,
      is_active: true,
      client_type: "REGULAR",
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

// ── Rendering ───────────────────────────────────────────────────────────────

describe("ClientsClient — rendering", () => {
  it("renders the client count and table rows from initial data", () => {
    renderWithClient(<ClientsClient initialData={seed} role="ADMIN" />);
    expect(screen.getByText(/2 clients/i)).toBeInTheDocument();
    // Both desktop table + mobile cards render simultaneously in jsdom.
    expect(screen.getAllByText("Acme Corp").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Beta Industries").length).toBeGreaterThanOrEqual(1);
  });

  it("renders GSTIN value monospace and Not provided fallback", () => {
    renderWithClient(<ClientsClient initialData={seed} role="ADMIN" />);
    expect(screen.getAllByText("22AAAAA0000A1Z5").length).toBeGreaterThanOrEqual(1);
    // Beta has no GSTIN — desktop column shows "Not provided"; mobile card shows "No GSTIN"
    expect(screen.getByText(/not provided/i)).toBeInTheDocument();
    expect(screen.getByText(/no gstin/i)).toBeInTheDocument();
  });

  it("renders ClientAvatar img for each company", () => {
    renderWithClient(<ClientsClient initialData={seed} role="ADMIN" />);
    expect(screen.getAllByRole("img", { name: /acme corp/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("img", { name: /beta industries/i }).length).toBeGreaterThan(0);
  });

  it("renders the IEC + PAN badges", () => {
    renderWithClient(<ClientsClient initialData={seed} role="ADMIN" />);
    expect(screen.getAllByText(/IEC: 0123456789/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/PAN: AAAAA0000A/).length).toBeGreaterThanOrEqual(1);
  });
});

// ── Empty states ────────────────────────────────────────────────────────────

describe("ClientsClient — empty states", () => {
  const empty: ClientsListResponse = {
    items: [],
    total: 0,
    page: 1,
    per_page: 50,
    pages: 0,
  };

  it("shows 'No clients yet' when initial DB is empty", () => {
    renderWithClient(<ClientsClient initialData={empty} role="ADMIN" />);
    expect(screen.getByText(/no clients yet/i)).toBeInTheDocument();
    expect(
      screen.getByText(/add your first client to get started/i),
    ).toBeInTheDocument();
  });

  it("shows the Add client CTA in empty state for users with CLIENT_CREATE", () => {
    renderWithClient(<ClientsClient initialData={empty} role="ADMIN" />);
    // Two "Add client" buttons (header + empty state CTA)
    expect(screen.getAllByRole("link", { name: /add client/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("hides the Add client CTA for users without CLIENT_CREATE", () => {
    renderWithClient(<ClientsClient initialData={empty} role="FINANCE" />);
    expect(screen.queryByRole("link", { name: /add client/i })).toBeNull();
  });
});

// ── Role gating ─────────────────────────────────────────────────────────────

describe("ClientsClient — role gating", () => {
  it("ADMIN sees Add client + Edit + Delete buttons", () => {
    renderWithClient(<ClientsClient initialData={seed} role="ADMIN" />);
    expect(screen.getByRole("link", { name: /add client/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /edit acme corp/i }).length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: /delete acme corp/i }).length,
    ).toBeGreaterThan(0);
  });

  it("OPERATIONS sees Add + Edit but NOT Delete (CLIENT_DELETE = [ADMIN])", () => {
    renderWithClient(<ClientsClient initialData={seed} role="OPERATIONS" />);
    expect(screen.getByRole("link", { name: /add client/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /edit/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });

  it("FINANCE sees no mutation buttons (read-only)", () => {
    renderWithClient(<ClientsClient initialData={seed} role="FINANCE" />);
    expect(screen.queryByRole("link", { name: /add client/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /edit/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });

  it("SUPER_ADMIN sees everything (via canAccess bypass)", () => {
    renderWithClient(<ClientsClient initialData={seed} role="SUPER_ADMIN" />);
    expect(screen.getByRole("link", { name: /add client/i })).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /delete/i }).length,
    ).toBeGreaterThan(0);
  });
});

// ── Search ─────────────────────────────────────────────────────────────────

describe("ClientsClient — search", () => {
  it("debounces search and refetches with the query param", async () => {
    const fetchSpy = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => ({ ...seed, items: [] }),
      url,
    } as unknown as Response));
    vi.stubGlobal("fetch", fetchSpy);
    renderWithClient(<ClientsClient initialData={seed} role="ADMIN" />);
    const input = screen.getByLabelText(/search clients/i);
    fireEvent.change(input, { target: { value: "acme" } });
    await waitFor(
      () => {
        const last = fetchSpy.mock.calls.at(-1)?.[0];
        expect(typeof last === "string" && last.includes("search=acme")).toBe(true);
      },
      { timeout: 1500 },
    );
  });
});

// ── Delete flow ─────────────────────────────────────────────────────────────

describe("ClientsClient — delete flow", () => {
  it("opens delete dialog with the company name", () => {
    renderWithClient(<ClientsClient initialData={seed} role="ADMIN" />);
    fireEvent.click(
      screen.getAllByRole("button", { name: /delete acme corp/i })[0]!,
    );
    expect(screen.getByText(/delete acme corp\?/i)).toBeInTheDocument();
  });

  it("dialog Cancel button dismisses", () => {
    renderWithClient(<ClientsClient initialData={seed} role="ADMIN" />);
    fireEvent.click(
      screen.getAllByRole("button", { name: /delete acme corp/i })[0]!,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByText(/delete acme corp\?/i)).toBeNull();
  });
});
