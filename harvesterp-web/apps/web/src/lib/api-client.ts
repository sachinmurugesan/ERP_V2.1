/**
 * api-client.ts — Client-side API access helpers.
 *
 * For this task (Task 7), ALL client-side data fetching goes THROUGH
 * Next.js API route handlers at /api/*, never directly to FastAPI.
 *
 * Why:
 *   - The session token lives in an httpOnly cookie. Browsers send it
 *     automatically on same-origin requests, so no token handling is
 *     needed on the client side.
 *   - Task 9 (strangler-fig proxy) may forward some paths directly to
 *     FastAPI via nginx, but client code will not need to change.
 *
 * Usage:
 *   import { apiFetch } from "@/lib/api-client";
 *   const data = await apiFetch<OrderList>("/api/orders/");
 */

/**
 * Returns the base URL for client-side API calls.
 * Empty string = same origin, meaning requests go through Next.js route handlers.
 */
export function getClientApiBase(): string {
  return "";
}

/**
 * Typed JSON fetch for client components.
 * Throws a descriptive Error on non-2xx responses.
 *
 * @param path - Path starting with /api/ (e.g. "/api/auth/session")
 * @param init - Standard fetch RequestInit options
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${getClientApiBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}
