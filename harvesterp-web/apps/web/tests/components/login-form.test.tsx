/**
 * login-form.test.tsx — Unit tests for the LoginForm client component.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "../../src/app/(auth)/login/_components/login-form";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetchSuccess() {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ user: { email: "admin@harvesterp.com" } }),
  }));
}

function mockFetchFailure(errorMsg = "Invalid credentials") {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: false,
    json: async () => ({ error: errorMsg }),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("LoginForm", () => {
  it("renders the email address label and input", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });

  it("renders the password label and input", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("renders the Sign in submit button", () => {
    render(<LoginForm />);
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders the HarvestERP heading", () => {
    render(<LoginForm />);
    expect(screen.getByText(/sign in to harvesterp/i)).toBeInTheDocument();
  });

  it("calls POST /api/auth/login with username and password on submit", async () => {
    mockFetchSuccess();
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/email address/i), "user@test.com");
    await userEvent.type(screen.getByLabelText(/password/i), "secret");
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/auth/login");
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body as string) as { username: string; password: string };
      expect(body.username).toBe("user@test.com");
      expect(body.password).toBe("secret");
    });
  });

  it("redirects to /dashboard on successful login", async () => {
    mockFetchSuccess();
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/email address/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/password/i), "pass");
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("redirects to returnTo prop on successful login", async () => {
    mockFetchSuccess();
    render(<LoginForm returnTo="/orders" />);

    await userEvent.type(screen.getByLabelText(/email address/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/password/i), "pass");
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/orders");
    });
  });

  it("displays error message when login fails", async () => {
    mockFetchFailure("Invalid email or password");
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/email address/i), "bad@email.com");
    await userEvent.type(screen.getByLabelText(/password/i), "wrong");
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Invalid email or password");
    });
  });

  it("shows error on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/email address/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/password/i), "p");
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/network error/i);
    });
  });

  it("disables the submit button while pending", async () => {
    // Slow fetch — never resolves during this test
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => undefined)));
    render(<LoginForm />);

    await userEvent.type(screen.getByLabelText(/email address/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/password/i), "p");
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
    });
  });
});
