"use client";

/**
 * QuickStatsCard — client component demonstrating React Query + polling.
 *
 * Polls /api/auth/session every 30 seconds to show the current user info.
 * This is a scaffold placeholder: in a real dashboard migration, this would
 * poll a real stats endpoint (e.g. /api/dashboard/summary/).
 *
 * Demonstrates the "Client+React Query" pattern from Task 7 spec:
 *   - Fetches via Next.js API route (not directly to FastAPI)
 *   - Cookie is sent automatically (same-origin, httpOnly)
 *   - React Query handles caching, loading, error, and refetch
 */

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/primitives/card";

interface SessionResponse {
  user?: { email?: string; role?: string };
}

async function fetchSession(): Promise<SessionResponse> {
  const res = await fetch("/api/auth/session");
  if (!res.ok) {
    throw new Error("Session unavailable");
  }
  return res.json() as Promise<SessionResponse>;
}

export function QuickStatsCard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-session"],
    queryFn: fetchSession,
    refetchInterval: 30_000, // poll every 30 seconds
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Session Info</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <p className="text-sm text-muted-foreground animate-pulse">
            Loading…
          </p>
        )}
        {error && (
          <p className="text-sm text-destructive">
            Backend offline — connect to FastAPI to see live data
          </p>
        )}
        {data && (
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Signed in as</dt>
              <dd className="font-medium">{data.user?.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Role</dt>
              <dd className="font-medium">{data.user?.role ?? "—"}</dd>
            </div>
            <p className="text-xs text-muted-foreground border-t pt-3">
              Polls every 30 s via React Query — demonstrates client+query pattern
            </p>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
