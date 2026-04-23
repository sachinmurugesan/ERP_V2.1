/**
 * errors.test.ts — Unit tests for the SDK error hierarchy and wrapError factory.
 *
 * No network calls. All responses are constructed in-process.
 */

import { describe, it, expect } from "vitest";
import {
  ApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  ServerError,
  wrapError,
  type ValidationDetail,
} from "../src/errors.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockResponse(
  status: number,
  body: unknown,
  contentType = "application/json",
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": contentType },
    // Response.url is read-only but we need a URL for assertions
  });
}

// ── Error class hierarchy ─────────────────────────────────────────────────────

describe("ApiError", () => {
  it("constructs with all fields", () => {
    const e = new ApiError(400, "Bad request", "http://x/api", "GET", {});
    expect(e.statusCode).toBe(400);
    expect(e.message).toBe("Bad request");
    expect(e.url).toBe("http://x/api");
    expect(e.method).toBe("GET");
    expect(e.name).toBe("ApiError");
  });

  it("is an instance of Error", () => {
    const e = new ApiError(500, "fail", "u", "GET");
    expect(e).toBeInstanceOf(Error);
  });
});

describe("UnauthorizedError", () => {
  it("has statusCode 401", () => {
    const e = new UnauthorizedError("http://x", "GET");
    expect(e.statusCode).toBe(401);
    expect(e.name).toBe("UnauthorizedError");
  });

  it("is instanceof ApiError", () => {
    expect(new UnauthorizedError("u", "GET")).toBeInstanceOf(ApiError);
  });

  it("message mentions token expiry", () => {
    const e = new UnauthorizedError("u", "POST");
    expect(e.message).toMatch(/token/i);
  });
});

describe("ForbiddenError", () => {
  it("has statusCode 403", () => {
    const e = new ForbiddenError("http://x", "DELETE");
    expect(e.statusCode).toBe(403);
    expect(e.name).toBe("ForbiddenError");
  });

  it("accepts custom message", () => {
    const e = new ForbiddenError("u", "GET", "Admin only");
    expect(e.message).toBe("Admin only");
  });

  it("uses default message when none provided", () => {
    const e = new ForbiddenError("u", "GET");
    expect(e.message).toMatch(/permission/i);
  });
});

describe("NotFoundError", () => {
  it("has statusCode 404", () => {
    const e = new NotFoundError("http://x", "GET");
    expect(e.statusCode).toBe(404);
    expect(e.name).toBe("NotFoundError");
  });
});

describe("ConflictError", () => {
  it("has statusCode 409", () => {
    const e = new ConflictError("http://x", "POST");
    expect(e.statusCode).toBe(409);
    expect(e.name).toBe("ConflictError");
  });
});

describe("RateLimitError", () => {
  it("has statusCode 429", () => {
    const e = new RateLimitError("http://x", "POST");
    expect(e.statusCode).toBe(429);
    expect(e.name).toBe("RateLimitError");
  });
});

describe("ServerError", () => {
  it("has statusCode 500", () => {
    const e = new ServerError(500, "u", "GET");
    expect(e.statusCode).toBe(500);
    expect(e.name).toBe("ServerError");
  });

  it("uses custom message", () => {
    const e = new ServerError(503, "u", "GET", "Service unavailable");
    expect(e.message).toBe("Service unavailable");
  });

  it("uses generic message when none provided", () => {
    const e = new ServerError(500, "u", "GET");
    expect(e.message).toContain("500");
  });
});

describe("ValidationError", () => {
  const details: ValidationDetail[] = [
    { loc: ["body", "email"], msg: "Invalid email", type: "value_error.email" },
    { loc: ["body", "password"], msg: "Too short", type: "value_error.min_length" },
  ];

  it("has statusCode 422", () => {
    const e = new ValidationError("u", "POST", details);
    expect(e.statusCode).toBe(422);
    expect(e.name).toBe("ValidationError");
  });

  it("exposes the detail array", () => {
    const e = new ValidationError("u", "POST", details);
    expect(e.details).toHaveLength(2);
    expect(e.details[0]!.msg).toBe("Invalid email");
  });

  it("summarises field errors in message", () => {
    const e = new ValidationError("u", "POST", details);
    expect(e.message).toContain("email");
    expect(e.message).toContain("password");
  });

  it("fieldError() returns the message for a matching path", () => {
    const e = new ValidationError("u", "POST", details);
    expect(e.fieldError("email")).toBe("Invalid email");
    expect(e.fieldError("password")).toBe("Too short");
    expect(e.fieldError("nonexistent")).toBeUndefined();
  });

  it("handles empty details array gracefully", () => {
    const e = new ValidationError("u", "POST", []);
    expect(e.details).toHaveLength(0);
    expect(e.message).toMatch(/validation/i);
  });
});

// ── wrapError factory ─────────────────────────────────────────────────────────

describe("wrapError", () => {
  it("maps 401 → UnauthorizedError", async () => {
    const res = mockResponse(401, { detail: "Not authenticated" });
    const err = await wrapError(res, "GET");
    expect(err).toBeInstanceOf(UnauthorizedError);
    expect(err.statusCode).toBe(401);
  });

  it("maps 403 → ForbiddenError with detail message", async () => {
    const res = mockResponse(403, { detail: "Admin only" });
    const err = await wrapError(res, "DELETE");
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(err.message).toBe("Admin only");
  });

  it("maps 404 → NotFoundError with detail message", async () => {
    const res = mockResponse(404, { detail: "Order not found" });
    const err = await wrapError(res, "GET");
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.message).toBe("Order not found");
  });

  it("maps 409 → ConflictError", async () => {
    const res = mockResponse(409, { detail: "SKU already exists" });
    const err = await wrapError(res, "POST");
    expect(err).toBeInstanceOf(ConflictError);
  });

  it("maps 422 → ValidationError with parsed details", async () => {
    const body = {
      detail: [
        { loc: ["body", "email"], msg: "Invalid email", type: "value_error" },
      ],
    };
    const res = mockResponse(422, body);
    const err = await wrapError(res, "POST");
    expect(err).toBeInstanceOf(ValidationError);
    const ve = err as ValidationError;
    expect(ve.details).toHaveLength(1);
    expect(ve.details[0]!.msg).toBe("Invalid email");
  });

  it("maps 429 → RateLimitError", async () => {
    const res = mockResponse(429, { detail: "Rate limit exceeded" });
    const err = await wrapError(res, "POST");
    expect(err).toBeInstanceOf(RateLimitError);
  });

  it("maps 500 → ServerError", async () => {
    const res = mockResponse(500, { detail: "Internal server error" });
    const err = await wrapError(res, "GET");
    expect(err).toBeInstanceOf(ServerError);
    expect(err.statusCode).toBe(500);
  });

  it("maps 503 → ServerError", async () => {
    const res = mockResponse(503, { detail: "Service unavailable" });
    const err = await wrapError(res, "GET");
    expect(err).toBeInstanceOf(ServerError);
    expect(err.statusCode).toBe(503);
  });

  it("returns base ApiError for unknown 4xx (e.g. 400)", async () => {
    const res = mockResponse(400, { detail: "Bad request" });
    const err = await wrapError(res, "POST");
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(400);
  });

  it("handles non-JSON body gracefully", async () => {
    const res = new Response("<html>Error</html>", {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
    const err = await wrapError(res, "GET");
    expect(err).toBeInstanceOf(ServerError);
    expect(err.statusCode).toBe(500);
  });

  it("records the HTTP method on the error", async () => {
    const res = mockResponse(403, { detail: "Forbidden" });
    const err = await wrapError(res, "DELETE");
    expect(err.method).toBe("DELETE");
  });
});
