/**
 * @harvesterp/sdk — Public API
 *
 * TypeScript SDK generated from the HarvestERP FastAPI OpenAPI spec.
 * Architectural decision: D-001.
 *
 * Quick start:
 *
 *   import { apiClient, createHarvestClient, login } from "@harvesterp/sdk";
 *
 *   // Authenticate
 *   const { access_token } = await login("user@example.com", "password");
 *   apiClient.accept(access_token);
 *
 *   // Call typed API
 *   const { data } = await apiClient.GET("/api/orders/");
 *
 * For Next.js server components:
 *
 *   const client = createHarvestClient({
 *     baseUrl: process.env.HARVEST_API_URL,
 *     getToken: () => session.accessToken,
 *     fetch: (url, init) => fetch(url, { ...init, cache: "no-store" }),
 *   });
 */

// ── Client factory ────────────────────────────────────────────────────────────
export {
  createHarvestClient,
  apiClient,
  resolveDefaultBaseUrl,
  throwIfError,
} from "./client.js";
export type {
  HarvestClient,
  HarvestClientConfig,
  paths,
  FetchOptions,
} from "./client.js";

// ── Auth helpers ──────────────────────────────────────────────────────────────
export { login, logout, refreshToken, getMe } from "./auth.js";
export type {
  LoginRequest,
  TokenResponse,
  RefreshResponse,
  UserMeResponse,
  LoginUserInfo,
  AuthConfig,
} from "./auth.js";

// ── Error classes ─────────────────────────────────────────────────────────────
export {
  ApiError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  RateLimitError,
  ServerError,
  wrapError,
} from "./errors.js";
export type { ValidationDetail } from "./errors.js";

// ── Generated types (re-exported for consumers that need raw schema types) ────
export type { components, operations } from "./generated/types.js";
