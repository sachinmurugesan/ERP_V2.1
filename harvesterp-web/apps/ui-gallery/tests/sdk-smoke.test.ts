/**
 * sdk-smoke.test.ts — Import-level smoke test for @harvesterp/sdk.
 *
 * Verifies the SDK can be imported and its key symbols are the right
 * shape. No network calls — no mocks needed.
 */

import { describe, it, expect } from "vitest";
import {
  createHarvestClient,
  apiClient,
  resolveDefaultBaseUrl,
  ApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  ServerError,
  login,
  logout,
  refreshToken,
  getMe,
} from "@harvesterp/sdk";

describe("@harvesterp/sdk — smoke tests", () => {
  it("resolveDefaultBaseUrl returns a valid URL string", () => {
    const url = resolveDefaultBaseUrl();
    expect(typeof url).toBe("string");
    expect(url).toMatch(/^https?:\/\//);
  });

  it("createHarvestClient is a function", () => {
    expect(typeof createHarvestClient).toBe("function");
  });

  it("apiClient exposes GET, POST, PUT, DELETE, PATCH, accept, clearAuth", () => {
    expect(typeof apiClient.GET).toBe("function");
    expect(typeof apiClient.POST).toBe("function");
    expect(typeof apiClient.PUT).toBe("function");
    expect(typeof apiClient.DELETE).toBe("function");
    expect(typeof apiClient.PATCH).toBe("function");
    expect(typeof apiClient.accept).toBe("function");
    expect(typeof apiClient.clearAuth).toBe("function");
  });

  it("ApiError and all subclasses are constructible", () => {
    const base = new ApiError(400, "bad", "http://x", "GET");
    expect(base).toBeInstanceOf(ApiError);
    expect(base).toBeInstanceOf(Error);

    const e401 = new UnauthorizedError("http://x", "POST");
    expect(e401).toBeInstanceOf(UnauthorizedError);
    expect(e401).toBeInstanceOf(ApiError);
    expect(e401.statusCode).toBe(401);

    const e403 = new ForbiddenError("http://x", "GET");
    expect(e403.statusCode).toBe(403);

    const e404 = new NotFoundError("http://x", "GET");
    expect(e404.statusCode).toBe(404);

    const e409 = new ConflictError("http://x", "POST");
    expect(e409.statusCode).toBe(409);

    const e422 = new ValidationError("http://x", "POST", [
      { loc: ["body", "email"], msg: "Field required", type: "missing" },
    ]);
    expect(e422.statusCode).toBe(422);
    expect(e422.details).toHaveLength(1);

    const e429 = new RateLimitError("http://x", "POST");
    expect(e429.statusCode).toBe(429);

    const e500 = new ServerError(500, "http://x", "GET");
    expect(e500.statusCode).toBe(500);
  });

  it("auth helpers are functions", () => {
    expect(typeof login).toBe("function");
    expect(typeof logout).toBe("function");
    expect(typeof refreshToken).toBe("function");
    expect(typeof getMe).toBe("function");
  });
});
