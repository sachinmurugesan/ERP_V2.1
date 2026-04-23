import { createHarvestClient } from "@harvesterp/sdk";
import { getSessionToken } from "@/lib/session";

/**
 * api-server.ts — Server-side SDK client factory.
 *
 * Creates a typed HarvestClient with the current user's token injected
 * from the httpOnly session cookie. The SDK never reads cookies directly.
 *
 * Usage:
 *   // In an RSC:
 *   const client = await getServerClient();
 *   const result = await client.GET("/api/auth/me");
 *
 *   // In a Route Handler:
 *   const client = await getServerClient();
 *   const result = await client.GET("/api/orders/", { params: { query: { skip: 0, limit: 20 } } });
 *
 * If no cookie is present, the client is created without a token.
 * The FastAPI backend will return 401 for protected endpoints.
 */
export async function getServerClient() {
  const token = await getSessionToken();
  return createHarvestClient({
    baseUrl: process.env.HARVESTERP_API_URL ?? "http://localhost:8000",
    getToken: () => token ?? null,
  });
}
