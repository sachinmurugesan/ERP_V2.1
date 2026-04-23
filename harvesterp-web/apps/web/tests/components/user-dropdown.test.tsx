/**
 * user-dropdown.test.tsx — Unit tests for components/composed/user-dropdown.tsx.
 *
 * Tests trigger rendering, initials derivation, fetch call on logout, and
 * router.push redirect. Radix DropdownMenu portal behaviour is mocked by
 * jsdom — menu content renders inline in test DOM.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { UserDropdown } from "../../src/components/composed/user-dropdown";

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Avatar trigger ────────────────────────────────────────────────────────────

describe("UserDropdown trigger", () => {
  it("renders an avatar button with the correct aria-label", () => {
    render(<UserDropdown email="admin@harvesterp.com" />);
    expect(screen.getByRole("button", { name: /user menu for admin@harvesterp.com/i })).toBeInTheDocument();
  });

  it("shows first-letter initials for email addresses", () => {
    render(<UserDropdown email="john@example.com" />);
    const btn = screen.getByRole("button", { name: /user menu/i });
    expect(btn.textContent).toBe("J");
  });

  it("shows two-letter initials for display names", () => {
    render(<UserDropdown email="Jane Doe" />);
    const btn = screen.getByRole("button", { name: /user menu/i });
    expect(btn.textContent).toBe("JD");
  });

  it("falls back to 'U' for an empty email", () => {
    render(<UserDropdown email="" />);
    const btn = screen.getByRole("button", { name: /user menu/i });
    expect(btn.textContent).toBe("U");
  });
});

// ── Dropdown menu content ─────────────────────────────────────────────────────

describe("UserDropdown menu items", () => {
  it("shows the user email in the menu header when opened", async () => {
    render(<UserDropdown email="admin@harvesterp.com" />);
    const trigger = screen.getByRole("button", { name: /user menu/i });
    await userEvent.click(trigger);
    expect(screen.getByText("admin@harvesterp.com")).toBeInTheDocument();
  });

  it("renders Profile, Settings, and Logout items when open", async () => {
    render(<UserDropdown email="admin@harvesterp.com" />);
    await userEvent.click(screen.getByRole("button", { name: /user menu/i }));
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Logout")).toBeInTheDocument();
  });
});

// ── Logout action ─────────────────────────────────────────────────────────────

describe("logout flow", () => {
  it("calls POST /api/auth/logout when Logout is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    render(<UserDropdown email="admin@harvesterp.com" />);
    await userEvent.click(screen.getByRole("button", { name: /user menu/i }));
    fireEvent.click(screen.getByText("Logout"));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
    });
  });

  it("redirects to /login after logout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    render(<UserDropdown email="admin@harvesterp.com" />);
    await userEvent.click(screen.getByRole("button", { name: /user menu/i }));
    fireEvent.click(screen.getByText("Logout"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  it("still redirects to /login even if fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

    render(<UserDropdown email="admin@harvesterp.com" />);
    await userEvent.click(screen.getByRole("button", { name: /user menu/i }));
    fireEvent.click(screen.getByText("Logout"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });
});
