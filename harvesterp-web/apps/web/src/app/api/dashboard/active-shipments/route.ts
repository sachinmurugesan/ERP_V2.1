import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type { ActiveShipment } from "@/app/(app)/dashboard/_components/types";

/**
 * GET /api/dashboard/active-shipments
 *
 * Proxies FastAPI GET /api/dashboard/active-shipments/ using the session
 * cookie. Exists so the client-side TanStack Query poller can fetch without
 * needing the raw FastAPI URL or access to the httpOnly session token.
 *
 * Response 200: { shipments: ActiveShipment[] }
 * Response 401: { error: string }
 * Response 502: { error: string }
 */
export async function GET(): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const client = await getServerClient();
    const shipments = await client.getJson<ActiveShipment[]>(
      "/api/dashboard/active-shipments/",
    );
    return NextResponse.json({ shipments });
  } catch {
    return NextResponse.json(
      { error: "Failed to load active shipments" },
      { status: 502 },
    );
  }
}
