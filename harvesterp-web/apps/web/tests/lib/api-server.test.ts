/**
 * api-server.test.ts — Unit tests for lib/api-server.ts.
 *
 * Hoisting-safe: vi.mock factories use no outer const/let refs.
 * Mock handles obtained via vi.mocked() after factory runs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getServerClient } from "../../src/lib/api-server";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@harvesterp/sdk", () => ({
  createHarvestClient: vi.fn().mockReturnValue({ GET: vi.fn(), POST: vi.fn() }),
}));

import { cookies } from "next/headers";
import { createHarvestClient } from "@harvesterp/sdk";

// Helper to configure the mock cookie jar
function setupCookies(token?: string) {
  const jar = {
    get: vi.fn().mockReturnValue(token ? { value: token } : undefined),
  };
  vi.mocked(cookies).mockResolvedValue(
    jar as unknown as Awaited<ReturnType<typeof cookies>>,
  );
  return jar;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createHarvestClient).mockReturnValue({ GET: vi.fn(), POST: vi.fn() } as unknown as ReturnType<typeof createHarvestClient>);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getServerClient", () => {
  it("returns a client object with GET and POST methods", async () => {
    setupCookies();
    const client = await getServerClient();
    expect(typeof client.GET).toBe("function");
    expect(typeof client.POST).toBe("function");
  });

  it("passes the session token to getToken when cookie is present", async () => {
    setupCookies("session-jwt-token");

    // Capture the config passed to createHarvestClient
    let capturedGetToken: (() => string | null | undefined) | undefined;
    vi.mocked(createHarvestClient).mockImplementationOnce((config) => {
      capturedGetToken = config?.getToken;
      return { GET: vi.fn(), POST: vi.fn() } as unknown as ReturnType<typeof createHarvestClient>;
    });

    await getServerClient();
    expect(capturedGetToken?.()).toBe("session-jwt-token");
  });

  it("returns null from getToken when no cookie is present", async () => {
    setupCookies(undefined);

    let capturedGetToken: (() => string | null | undefined) | undefined;
    vi.mocked(createHarvestClient).mockImplementationOnce((config) => {
      capturedGetToken = config?.getToken;
      return { GET: vi.fn(), POST: vi.fn() } as unknown as ReturnType<typeof createHarvestClient>;
    });

    await getServerClient();
    expect(capturedGetToken?.()).toBeNull();
  });

  it("uses HARVESTERP_API_URL env var as baseUrl", async () => {
    const original = process.env.HARVESTERP_API_URL;
    process.env.HARVESTERP_API_URL = "http://fastapi-test:9000";
    setupCookies();
    await getServerClient();
    expect(createHarvestClient).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "http://fastapi-test:9000" }),
    );
    process.env.HARVESTERP_API_URL = original;
  });

  it("falls back to http://localhost:8000 when HARVESTERP_API_URL is unset", async () => {
    const original = process.env.HARVESTERP_API_URL;
    delete process.env.HARVESTERP_API_URL;
    setupCookies();
    await getServerClient();
    expect(createHarvestClient).toHaveBeenCalledWith(
      expect.objectContaining({ baseUrl: "http://localhost:8000" }),
    );
    process.env.HARVESTERP_API_URL = original;
  });
});
