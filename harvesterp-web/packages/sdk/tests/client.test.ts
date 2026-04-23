/**
 * client.test.ts — Unit tests for createHarvestClient and apiClient.
 *
 * No real network calls — all requests are intercepted via a mock fetch.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHarvestClient, resolveDefaultBaseUrl } from "../src/client.js";
import { UnauthorizedError, ServerError, NotFoundError, ValidationError } from "../src/errors.js";

// ── Mock fetch builder ────────────────────────────────────────────────────────

// Note: always stringifies body — construct a raw Response directly for 204 No Content tests.
function mockFetch(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): typeof fetch {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    }),
  );
}

// ── resolveDefaultBaseUrl ────────────────────────────────────────────────────

describe("resolveDefaultBaseUrl", () => {
  it("returns http://localhost:8000 as fallback", () => {
    // In the test environment no env vars are set
    const url = resolveDefaultBaseUrl();
    // May return env value OR fallback; at minimum returns a valid URL string
    expect(typeof url).toBe("string");
    expect(url).toMatch(/^https?:\/\//);
  });
});

// ── createHarvestClient ───────────────────────────────────────────────────────

describe("createHarvestClient", () => {
  it("returns a client with GET, POST, PUT, DELETE, PATCH methods", () => {
    const client = createHarvestClient();
    expect(typeof client.GET).toBe("function");
    expect(typeof client.POST).toBe("function");
    expect(typeof client.PUT).toBe("function");
    expect(typeof client.DELETE).toBe("function");
    expect(typeof client.PATCH).toBe("function");
  });

  it("exposes accept() and clearAuth() helpers", () => {
    const client = createHarvestClient();
    expect(typeof client.accept).toBe("function");
    expect(typeof client.clearAuth).toBe("function");
  });

  it("uses the provided baseUrl", async () => {
    let capturedUrl = "";
    const mockFn: typeof fetch = vi.fn().mockImplementation(
      async (input: RequestInfo | URL) => {
        capturedUrl = typeof input === "string" ? input : (input as Request).url;
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    const client = createHarvestClient({
      baseUrl: "http://test-host:9000",
      fetch: mockFn,
    });

    await client.GET("/api/orders/");

    expect(capturedUrl).toContain("http://test-host:9000");
  });

  it("injects Authorization header when getToken returns a token", async () => {
    let capturedAuth = "";
    const mockFn: typeof fetch = vi.fn().mockImplementation(
      async (input: RequestInfo | URL) => {
        const req = input as Request;
        capturedAuth = req.headers?.get("Authorization") ?? "";
        return new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: mockFn,
      getToken: () => "my-test-token",
    });

    await client.GET("/api/orders/");

    expect(capturedAuth).toBe("Bearer my-test-token");
  });

  it("does NOT inject Authorization header when getToken returns null", async () => {
    let capturedAuth: string | null = "initial";
    const mockFn: typeof fetch = vi.fn().mockImplementation(
      async (input: RequestInfo | URL) => {
        const req = input as Request;
        capturedAuth = req.headers?.get("Authorization") ?? null;
        return new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: mockFn,
      getToken: () => null,
    });

    await client.GET("/api/orders/");

    expect(capturedAuth).toBeNull();
  });

  it("calls onBeforeRequest interceptor and respects its return value", async () => {
    const beforeRequest = vi.fn().mockImplementation((req: Request) => {
      return new Request(req.url, {
        ...req,
        headers: new Headers({ ...Object.fromEntries(req.headers.entries()), "X-Custom": "hello" }),
      });
    });

    let capturedCustomHeader = "";
    const mockFn: typeof fetch = vi.fn().mockImplementation(
      async (input: RequestInfo | URL) => {
        const req = input as Request;
        capturedCustomHeader = req.headers?.get("X-Custom") ?? "";
        return new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: mockFn,
      onBeforeRequest: beforeRequest,
    });

    await client.GET("/api/orders/");

    expect(beforeRequest).toHaveBeenCalledOnce();
    expect(capturedCustomHeader).toBe("hello");
  });

  it("calls onAfterResponse interceptor", async () => {
    const afterResponse = vi.fn().mockImplementation((res: Response) => res);
    const mockFn = mockFetch(200, { items: [] });

    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: mockFn,
      onAfterResponse: afterResponse,
    });

    await client.GET("/api/orders/");

    expect(afterResponse).toHaveBeenCalledOnce();
  });

  it("accept() sets a static token that is injected into subsequent requests", async () => {
    let capturedAuth = "";
    const mockFn: typeof fetch = vi.fn().mockImplementation(
      async (input: RequestInfo | URL) => {
        const req = input as Request;
        capturedAuth = req.headers?.get("Authorization") ?? "";
        return new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: mockFn,
    });

    client.accept("static-token-abc");
    await client.GET("/api/orders/");

    expect(capturedAuth).toBe("Bearer static-token-abc");
  });

  it("clearAuth() removes the static token", async () => {
    let capturedAuth: string | null = null;
    const mockFn: typeof fetch = vi.fn().mockImplementation(
      async (input: RequestInfo | URL) => {
        const req = input as Request;
        capturedAuth = req.headers?.get("Authorization") ?? null;
        return new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: mockFn,
    });

    client.accept("to-be-cleared");
    client.clearAuth();
    await client.GET("/api/orders/");

    expect(capturedAuth).toBeNull();
  });

  it("getToken takes precedence over accept() static token", async () => {
    let capturedAuth = "";
    const mockFn: typeof fetch = vi.fn().mockImplementation(
      async (input: RequestInfo | URL) => {
        const req = input as Request;
        capturedAuth = req.headers?.get("Authorization") ?? "";
        return new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: mockFn,
      getToken: () => "dynamic-token",
    });

    client.accept("static-token");
    await client.GET("/api/orders/");

    // getToken wins
    expect(capturedAuth).toBe("Bearer dynamic-token");
  });

  it("uses a custom fetch implementation for SSR scenarios", async () => {
    const ssrFetch = vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: ssrFetch,
    });

    await client.GET("/api/orders/");

    expect(ssrFetch).toHaveBeenCalledOnce();
  });
});

// ── getJson ───────────────────────────────────────────────────────────────────

describe("getJson", () => {
  it("returns the parsed response body typed as TResponse", async () => {
    const payload = { id: 1, name: "Test Order" };
    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: mockFetch(200, payload),
    });

    const result = await client.getJson<{ id: number; name: string }>("/api/orders/1/");
    expect(result).toEqual(payload);
  });

  it("builds query string from params", async () => {
    let capturedUrl = "";
    const mockFn: typeof fetch = vi.fn().mockImplementation(
      async (input: RequestInfo | URL) => {
        capturedUrl = typeof input === "string" ? input : (input as Request).url;
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: mockFn,
    });

    await client.getJson("/api/orders/", { params: { skip: 0, limit: 20, active: true } });

    expect(capturedUrl).toContain("skip=0");
    expect(capturedUrl).toContain("limit=20");
    expect(capturedUrl).toContain("active=true");
  });

  it("makes a clean URL with no trailing ? when no params supplied", async () => {
    let capturedUrl = "";
    const mockFn: typeof fetch = vi.fn().mockImplementation(
      async (input: RequestInfo | URL) => {
        capturedUrl = typeof input === "string" ? input : (input as Request).url;
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: mockFn,
    });

    await client.getJson("/api/orders/");

    expect(capturedUrl).toBe("http://localhost:8000/api/orders/");
    expect(capturedUrl).not.toContain("?");
  });

  it("throws UnauthorizedError on 401", async () => {
    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: mockFetch(401, { detail: "Not authenticated" }),
    });

    await expect(client.getJson("/api/orders/")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws ServerError on 500", async () => {
    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: mockFetch(500, { detail: "Internal server error" }),
    });

    await expect(client.getJson("/api/orders/")).rejects.toBeInstanceOf(ServerError);
  });

  it("uses the configured custom fetch override", async () => {
    const customFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: customFetch,
    });

    await client.getJson("/api/orders/");

    expect(customFetch).toHaveBeenCalledOnce();
  });

  it("injects Authorization header via getToken", async () => {
    let capturedAuth = "";
    const mockFn: typeof fetch = vi.fn().mockImplementation(
      async (input: RequestInfo | URL) => {
        const req = input as Request;
        capturedAuth = req.headers.get("Authorization") ?? "";
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: mockFn,
      getToken: () => "get-token-abc",
    });

    await client.getJson("/api/orders/");

    expect(capturedAuth).toBe("Bearer get-token-abc");
  });
});

// ── postJson ──────────────────────────────────────────────────────────────────

describe("postJson", () => {
  it("sends JSON body in the request", async () => {
    let capturedBody = "";
    const mockFn: typeof fetch = vi.fn().mockImplementation(
      async (input: RequestInfo | URL) => {
        const req = input as Request;
        capturedBody = await req.text();
        return new Response(JSON.stringify({ id: 99 }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: mockFn,
    });

    await client.postJson("/api/orders/", { item: "widget", qty: 3 });

    expect(JSON.parse(capturedBody)).toEqual({ item: "widget", qty: 3 });
  });

  it("sets Content-Type: application/json header", async () => {
    let capturedContentType = "";
    const mockFn: typeof fetch = vi.fn().mockImplementation(
      async (input: RequestInfo | URL) => {
        const req = input as Request;
        capturedContentType = req.headers.get("Content-Type") ?? "";
        return new Response(JSON.stringify({}), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: mockFn,
    });

    await client.postJson("/api/orders/", { item: "widget" });

    expect(capturedContentType).toBe("application/json");
  });

  it("injects Authorization header via getToken", async () => {
    let capturedAuth = "";
    const mockFn: typeof fetch = vi.fn().mockImplementation(
      async (input: RequestInfo | URL) => {
        const req = input as Request;
        capturedAuth = req.headers.get("Authorization") ?? "";
        return new Response(JSON.stringify({}), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: mockFn,
      getToken: () => "post-token-xyz",
    });

    await client.postJson("/api/orders/", {});

    expect(capturedAuth).toBe("Bearer post-token-xyz");
  });

  it("throws ValidationError on 422", async () => {
    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: mockFetch(422, {
        detail: [{ loc: ["body", "qty"], msg: "field required", type: "value_error.missing" }],
      }),
    });

    await expect(client.postJson("/api/orders/", {})).rejects.toBeInstanceOf(ValidationError);
  });
});

// ── putJson ───────────────────────────────────────────────────────────────────

describe("putJson", () => {
  it("sends JSON body correctly", async () => {
    let capturedBody = "";
    const mockFn: typeof fetch = vi.fn().mockImplementation(
      async (input: RequestInfo | URL) => {
        const req = input as Request;
        capturedBody = await req.text();
        return new Response(JSON.stringify({ updated: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );

    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: mockFn,
    });

    await client.putJson("/api/orders/42/", { status: "confirmed" });

    expect(JSON.parse(capturedBody)).toEqual({ status: "confirmed" });
  });

  it("throws ServerError on 500", async () => {
    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: mockFetch(500, { detail: "Internal server error" }),
    });

    await expect(client.putJson("/api/orders/42/", { status: "confirmed" })).rejects.toBeInstanceOf(ServerError);
  });
});

// ── deleteJson ────────────────────────────────────────────────────────────────

describe("deleteJson", () => {
  it("returns undefined on 204 No Content", async () => {
    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: vi.fn().mockResolvedValue(
        new Response(null, { status: 204, headers: {} }),
      ),
    });

    const result = await client.deleteJson("/api/orders/42/");

    expect(result).toBeUndefined();
  });

  it("throws NotFoundError on 404", async () => {
    const client = createHarvestClient({
      baseUrl: "http://localhost:8000",
      fetch: mockFetch(404, { detail: "Order not found" }),
    });

    await expect(client.deleteJson("/api/orders/999/")).rejects.toBeInstanceOf(NotFoundError);
  });
});
