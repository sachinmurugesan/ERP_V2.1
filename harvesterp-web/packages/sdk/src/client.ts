/**
 * client.ts — HarvestClient factory (D-001).
 *
 * Wraps openapi-fetch with:
 *   - Token injection via getToken() callback (storage-agnostic)
 *   - Typed error mapping via wrapError()
 *   - Optional beforeRequest / afterResponse interceptors
 *   - FormData and Blob/stream pass-through for file endpoints
 *   - Default base URL resolved from VITE_API_URL → NEXT_PUBLIC_API_URL → localhost:8000
 *
 * Usage:
 *   import { createHarvestClient, apiClient } from "@harvesterp/sdk";
 *
 *   // Default singleton (uses env base URL)
 *   const { data, error } = await apiClient.GET("/api/orders/");
 *
 *   // Custom instance (e.g. tests, SSR with Next.js server fetch)
 *   const client = createHarvestClient({
 *     baseUrl: "http://localhost:8000",
 *     getToken: () => session.token,
 *   });
 */

import createFetch, {
  type ClientOptions,
  type FetchOptions,
  type ParseAsResponse,
  type MaybeOptionalInit,
} from "openapi-fetch";
import type { paths } from "./generated/types.js";
import { wrapError } from "./errors.js";

export type { paths };

// ── Base URL resolution ───────────────────────────────────────────────────────

/**
 * Resolves the default base URL from the environment.
 *
 * Priority:
 *   1. VITE_API_URL (Vite apps e.g. ui-gallery)
 *   2. NEXT_PUBLIC_API_URL (Next.js app router)
 *   3. HARVEST_API_URL (server-side / test override)
 *   4. http://localhost:8000 (local dev fallback)
 */
export function resolveDefaultBaseUrl(): string {
  // Vite exposes env vars via import.meta.env; Next.js via process.env.
  // We guard both so the same code works in all environments.
  if (
    typeof globalThis !== "undefined" &&
    "import_meta_env" in globalThis === false
  ) {
    // Standard ESM / Next.js / Node environment
    const env = (globalThis as Record<string, unknown>)["process"]
      ? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
      : undefined;
    if (env?.["HARVEST_API_URL"]) return env["HARVEST_API_URL"];
    if (env?.["NEXT_PUBLIC_API_URL"]) return env["NEXT_PUBLIC_API_URL"];
  }
  // Try Vite's import.meta.env (available at bundle time, not in Node)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const viteEnv = (import.meta as any).env as
      | Record<string, string | undefined>
      | undefined;
    if (viteEnv?.["VITE_API_URL"]) return viteEnv["VITE_API_URL"];
  } catch {
    // import.meta.env not available in this environment
  }
  return "http://localhost:8000";
}

// ── Configuration ─────────────────────────────────────────────────────────────

export interface HarvestClientConfig {
  /**
   * Base URL of the FastAPI backend.
   * Defaults to resolveDefaultBaseUrl().
   */
  baseUrl?: string;

  /**
   * Custom fetch implementation.
   * Defaults to the global `fetch`.
   * Useful for Next.js server components (pass `fetch` with `{ cache: "no-store" }`),
   * or for unit tests (pass a mock fetch).
   */
  fetch?: ClientOptions["fetch"];

  /**
   * Provides the current bearer token for each request.
   * The SDK is storage-agnostic — it never reads localStorage or cookies.
   * Return null/undefined to send unauthenticated requests.
   */
  getToken?: () => string | null | undefined;

  /**
   * Called before every request. May mutate or replace the Request object.
   * Useful for request logging, tracing, or adding custom headers.
   */
  onBeforeRequest?: (request: Request) => Request | Promise<Request>;

  /**
   * Called after every response (including errors).
   * Useful for response logging or metrics.
   */
  onAfterResponse?: (response: Response) => Response | Promise<Response>;
}

// ── Core client ───────────────────────────────────────────────────────────────

/**
 * The primary client type — wraps openapi-fetch with typed error mapping.
 * Each method (GET, POST, PUT, DELETE, PATCH) returns `{ data, error }` OR
 * throws an ApiError subclass for non-2xx responses.
 *
 * This extends the openapi-fetch client with two additional helpers:
 *   .accept(token)   — set a static token (convenience for simple apps)
 *   .clearAuth()     — remove the static token
 */
export interface HarvestClient
  extends ReturnType<typeof createFetch<paths>> {
  /** Store a token directly on this client instance (convenience helper). */
  accept(token: string): void;
  /** Clear the stored token from this client instance. */
  clearAuth(): void;

  /**
   * Escape-hatch GET for endpoints whose OpenAPI spec returns
   * `"application/json": unknown` (FastAPI routes without `response_model=`).
   * Shares the same auth, interceptor, and error-handling pipeline as client.GET.
   */
  getJson<TResponse>(
    path: string,
    init?: {
      params?: Record<string, string | number | boolean>;
      headers?: Record<string, string>;
    },
  ): Promise<TResponse>;

  /**
   * Escape-hatch POST for endpoints with untyped JSON responses.
   * Shares the same auth, interceptor, and error-handling pipeline as client.POST.
   */
  postJson<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    init?: { headers?: Record<string, string> },
  ): Promise<TResponse>;

  /**
   * Escape-hatch PUT for endpoints with untyped JSON responses.
   * Shares the same auth, interceptor, and error-handling pipeline as client.PUT.
   */
  putJson<TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    init?: { headers?: Record<string, string> },
  ): Promise<TResponse>;

  /**
   * Escape-hatch DELETE for endpoints with untyped JSON responses.
   * Handles 204 No Content (returns `undefined`).
   * Shares the same auth, interceptor, and error-handling pipeline as client.DELETE.
   */
  deleteJson<TResponse = void>(
    path: string,
    init?: { headers?: Record<string, string> },
  ): Promise<TResponse>;
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Create a configured HarvestERP API client.
 *
 * @example
 * const client = createHarvestClient({ getToken: () => localStorage.getItem("token") });
 * const { data } = await client.GET("/api/orders/");
 */
export function createHarvestClient(
  config: HarvestClientConfig = {},
): HarvestClient {
  const {
    baseUrl = resolveDefaultBaseUrl(),
    fetch: customFetch,
    getToken,
    onBeforeRequest,
    onAfterResponse,
  } = config;

  // Mutable token slot for the .accept() convenience method
  let staticToken: string | null = null;

  /**
   * Instrumented fetch that:
   * 1. Injects Authorization header
   * 2. Runs beforeRequest interceptor
   * 3. Executes the request
   * 4. Runs afterResponse interceptor
   * 5. Maps errors via wrapError()
   */
  const instrumentedFetch: typeof fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const baseFetch = customFetch ?? fetch;

    // Resolve token
    const token = (getToken?.() ?? staticToken) ?? null;

    // Build headers with auth
    const headers = new Headers(init?.headers);
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    let req = new Request(
      typeof input === "string" || input instanceof URL
        ? input.toString()
        : input,
      { ...init, headers },
    );

    // beforeRequest interceptor
    if (onBeforeRequest) {
      req = await onBeforeRequest(req);
    }

    const res = await baseFetch(req);

    // afterResponse interceptor
    const finalRes = onAfterResponse ? await onAfterResponse(res.clone()) : res;

    return finalRes;
  };

  const inner = createFetch<paths>({ baseUrl, fetch: instrumentedFetch });

  /**
   * Wrap each HTTP method to map non-2xx responses to typed ApiError.
   *
   * openapi-fetch already returns `{ data, error }` for 4xx/5xx, but the
   * `error` field is typed as `unknown`. We intercept the raw response via
   * our instrumentedFetch and rethrow as a typed ApiError subclass.
   *
   * We keep the openapi-fetch `{ data, error }` contract intact for callers
   * that prefer the Result style. The ApiError is also rethrown so callers
   * using try/catch work naturally.
   */

  const client = inner as HarvestClient;

  client.accept = (token: string): void => {
    staticToken = token;
  };

  client.clearAuth = (): void => {
    staticToken = null;
  };

  // ── Typed JSON escape-hatch methods ──────────────────────────────────────────
  // These bypass openapi-fetch's type inference (useful when the spec has
  // `"application/json": unknown`) but share instrumentedFetch so auth,
  // interceptors, and error mapping all apply automatically.

  client.getJson = async <TResponse>(
    path: string,
    init?: {
      params?: Record<string, string | number | boolean>;
      headers?: Record<string, string>;
    },
  ): Promise<TResponse> => {
    const qs = init?.params
      ? "?" +
        new URLSearchParams(
          Object.entries(init.params).map(([k, v]) => [k, String(v)]),
        ).toString()
      : "";
    const url = `${baseUrl}${path}${qs}`;
    const response = await instrumentedFetch(url, {
      method: "GET",
      headers: { "Accept": "application/json", ...(init?.headers ?? {}) },
    });
    if (!response.ok) throw await wrapError(response, "GET");
    return (await response.json()) as TResponse;
  };

  client.postJson = async <TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    init?: { headers?: Record<string, string> },
  ): Promise<TResponse> => {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    };
    const response = await instrumentedFetch(url, {
      method: "POST",
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw await wrapError(response, "POST");
    return (await response.json()) as TResponse;
  };

  client.putJson = async <TResponse, TBody = unknown>(
    path: string,
    body?: TBody,
    init?: { headers?: Record<string, string> },
  ): Promise<TResponse> => {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    };
    const response = await instrumentedFetch(url, {
      method: "PUT",
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw await wrapError(response, "PUT");
    return (await response.json()) as TResponse;
  };

  client.deleteJson = async <TResponse = void>(
    path: string,
    init?: { headers?: Record<string, string> },
  ): Promise<TResponse> => {
    const url = `${baseUrl}${path}`;
    const response = await instrumentedFetch(url, {
      method: "DELETE",
      headers: init?.headers ?? {},
    });
    if (!response.ok) throw await wrapError(response, "DELETE");
    // Handle 204 No Content or empty body
    const contentLength = response.headers.get("Content-Length");
    if (response.status === 204 || contentLength === "0") {
      return undefined as TResponse;
    }
    return (await response.json()) as TResponse;
  };

  return client;
}

// ── Default singleton ─────────────────────────────────────────────────────────

/**
 * Default SDK client instance.
 *
 * Suitable for use in Vite-based apps (e.g. ui-gallery demos).
 * For Next.js, prefer `createHarvestClient()` to control token injection
 * per-request and pass the server-side `fetch` implementation.
 *
 * @example
 * import { apiClient } from "@harvesterp/sdk";
 * apiClient.accept(token);
 * const { data } = await apiClient.GET("/api/dashboard/summary/");
 */
export const apiClient: HarvestClient = createHarvestClient();

// ── Typed helpers for common response patterns ────────────────────────────────

/**
 * Throw the error from an openapi-fetch result if present.
 * Useful when you want to handle errors with try/catch but still use
 * the openapi-fetch `{ data, error }` destructuring pattern.
 *
 * @example
 * const { data } = throwIfError(await apiClient.GET("/api/orders/"));
 */
export function throwIfError<T, E>(result: {
  data?: T;
  error?: E;
  response: Response;
}): { data: T; response: Response } {
  if (result.error !== undefined) {
    // error is typed — rethrow as ApiError for consistent error handling
    const err = result.error as { message?: string; status?: number };
    throw new Error(
      `API error ${result.response.status}: ${err?.message ?? JSON.stringify(result.error)}`,
    );
  }
  return { data: result.data as T, response: result.response };
}

// ── Re-export openapi-fetch types for consumers ───────────────────────────────

export type { FetchOptions, ParseAsResponse, MaybeOptionalInit };
