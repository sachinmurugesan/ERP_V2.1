/**
 * errors.ts — D-001 typed error hierarchy for the HarvestERP SDK.
 *
 * Every network call either returns typed data or throws one of these
 * classes. Callers switch on `instanceof` or the `name` field.
 *
 * Mirrors FastAPI's error response shapes:
 *   4xx detail:  { "detail": string }              ← custom exceptions
 *   422 detail:  { "detail": ValidationDetail[] }  ← FastAPI body validation
 *   5xx:         { "detail": string } or plain HTML (guard accordingly)
 */

// ── FastAPI payload shapes ────────────────────────────────────────────────────

/** One field-level validation error from FastAPI's 422 response. */
export interface ValidationDetail {
  /** JSON path of the offending field e.g. ["body", "email"] */
  loc: (string | number)[];
  /** Human-readable message */
  msg: string;
  /** Pydantic error type e.g. "value_error.email" */
  type: string;
}

// ── Base error ────────────────────────────────────────────────────────────────

/**
 * Base class for all SDK errors. Never thrown directly — always a subclass.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  /** Original URL that produced the error */
  public readonly url: string;
  /** HTTP method */
  public readonly method: string;
  /** Raw response body (for debugging) */
  public readonly responseBody?: unknown;

  constructor(
    statusCode: number,
    message: string,
    url: string,
    method: string,
    responseBody?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.url = url;
    this.method = method;
    if (responseBody !== undefined) this.responseBody = responseBody;
    // Maintain proper prototype chain in transpiled targets
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ── Typed subclasses ──────────────────────────────────────────────────────────

/** 401 Unauthorized — token missing, expired, or invalid. */
export class UnauthorizedError extends ApiError {
  constructor(url: string, method: string, body?: unknown) {
    super(401, "Unauthorized — token missing or expired", url, method, body);
    this.name = "UnauthorizedError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 403 Forbidden — authenticated but lacks the required permission. */
export class ForbiddenError extends ApiError {
  constructor(url: string, method: string, message?: string, body?: unknown) {
    super(403, message ?? "Forbidden — insufficient permissions", url, method, body);
    this.name = "ForbiddenError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 404 Not Found — entity does not exist or has been deleted. */
export class NotFoundError extends ApiError {
  constructor(url: string, method: string, message?: string, body?: unknown) {
    super(404, message ?? "Not found", url, method, body);
    this.name = "NotFoundError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 409 Conflict — duplicate entity or state conflict.
 * e.g. duplicate SKU, re-submitting already-submitted order.
 */
export class ConflictError extends ApiError {
  constructor(url: string, method: string, message?: string, body?: unknown) {
    super(409, message ?? "Conflict — duplicate or state error", url, method, body);
    this.name = "ConflictError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 422 Unprocessable Entity — FastAPI request body validation failure.
 * Exposes field-level detail array from Pydantic.
 */
export class ValidationError extends ApiError {
  /** Parsed field-level error list from FastAPI's detail array. */
  public readonly details: ValidationDetail[];

  constructor(
    url: string,
    method: string,
    details: ValidationDetail[],
    body?: unknown,
  ) {
    const summary =
      details.length > 0
        ? details.map((d) => `${d.loc.join(".")}: ${d.msg}`).join("; ")
        : "Validation failed";
    super(422, summary, url, method, body);
    this.name = "ValidationError";
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** Returns the first error message for a given field path (e.g. "body.email"). */
  fieldError(field: string): string | undefined {
    return this.details.find((d) => d.loc.join(".").includes(field))?.msg;
  }
}

/** 429 Too Many Requests — rate limit exceeded. */
export class RateLimitError extends ApiError {
  constructor(url: string, method: string, body?: unknown) {
    super(429, "Rate limit exceeded — please retry after a moment", url, method, body);
    this.name = "RateLimitError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** 5xx Server Error — unexpected backend failure. */
export class ServerError extends ApiError {
  constructor(
    statusCode: number,
    url: string,
    method: string,
    message?: string,
    body?: unknown,
  ) {
    super(statusCode, message ?? `Server error (${statusCode})`, url, method, body);
    this.name = "ServerError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ── Error factory ─────────────────────────────────────────────────────────────

interface ErrorBody {
  detail?: string | ValidationDetail[];
}

/**
 * Construct the appropriate ApiError subclass from a non-2xx Response.
 *
 * Reads the response body once (JSON or text) and maps status codes
 * to typed error classes. Never throws — always returns an ApiError.
 */
export async function wrapError(
  response: Response,
  method: string,
): Promise<ApiError> {
  const url = response.url;
  const status = response.status;

  // Try to parse body as JSON; fall back to raw text
  let body: unknown;
  let detailStr: string | undefined;
  let detailArr: ValidationDetail[] | undefined;

  try {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = (await response.json()) as ErrorBody;
      const detail = (body as ErrorBody).detail;
      if (typeof detail === "string") {
        detailStr = detail;
      } else if (Array.isArray(detail)) {
        detailArr = detail as ValidationDetail[];
      }
    } else {
      body = await response.text();
    }
  } catch {
    // Body read failed — use generic message
  }

  switch (status) {
    case 401:
      return new UnauthorizedError(url, method, body);
    case 403:
      return new ForbiddenError(url, method, detailStr, body);
    case 404:
      return new NotFoundError(url, method, detailStr, body);
    case 409:
      return new ConflictError(url, method, detailStr, body);
    case 422:
      return new ValidationError(url, method, detailArr ?? [], body);
    case 429:
      return new RateLimitError(url, method, body);
    default:
      if (status >= 500) {
        return new ServerError(status, url, method, detailStr, body);
      }
      return new ApiError(status, detailStr ?? `HTTP ${status}`, url, method, body);
  }
}
