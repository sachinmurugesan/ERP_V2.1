import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";
import type { StatusCountsRaw } from "@/app/(app)/orders/_components/types";

/**
 * GET /api/orders/status-counts
 *
 * Proxies FastAPI GET /api/orders/status-counts/ for the client-side filter
 * tab count badges.
 */
export async function GET(): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const client = await getServerClient();
    const counts = await client.getJson<StatusCountsRaw>(
      "/api/orders/status-counts/",
    );
    return NextResponse.json({ counts });
  } catch {
    return NextResponse.json(
      { error: "Failed to load status counts" },
      { status: 502 },
    );
  }
}
