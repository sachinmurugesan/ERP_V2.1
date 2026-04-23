import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/primitives/card";
import { getServerClient } from "@/lib/api-server";
import { getSessionToken } from "@/lib/session";
import { QuickStatsCard } from "./_components/quick-stats-card";

interface RecentOrder {
  id: string;
  order_number: string;
  client_name: string;
  total_value: number;
  status: string;
  created_at: string;
}

/**
 * Async RSC that fetches recent orders from FastAPI.
 * Renders all returned orders, or an empty-state card if the backend is offline.
 */
async function RecentOrdersCard() {
  let orders: RecentOrder[] = [];
  try {
    const client = await getServerClient();
    // Uses /api/dashboard/recent-orders/ — confirmed in openapi.json
    orders = await client.getJson<RecentOrder[]>("/api/dashboard/recent-orders/");
  } catch {
    // Backend offline — show placeholder
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Orders</CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No orders to display — connect the FastAPI backend to load live
            data.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {orders.map((order, i) => (
              <li key={i} className="flex justify-between py-1 border-b last:border-0">
                <span className="font-medium font-mono text-xs">
                  {JSON.stringify(order).slice(0, 60)}…
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Dashboard page — scaffold placeholder demonstrating two data-fetching patterns:
 *
 *   1. RSC pattern: fetches user + orders server-side via getServerClient().
 *      Data is available before the page HTML is streamed to the client.
 *
 *   2. Client+React Query pattern: QuickStatsCard fetches via /api/auth/session
 *      route handler, polling every 30 seconds.
 *
 * This is NOT a real HarvestERP dashboard migration. Real module migrations
 * happen post-Wave-0 (Task 10+).
 */
export default async function DashboardPage() {
  // RSC: read current user (best-effort)
  let userName = "User";
  try {
    const token = await getSessionToken();
    if (token) {
      const client = await getServerClient();
      const result = await client.GET("/api/auth/me");
      if (result.data) {
        const u = result.data as { email?: string };
        userName = u.email ?? "User";
      }
    }
  } catch {
    // Backend offline
  }

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, <span className="font-medium">{userName}</span>
        </p>
      </div>

      {/* Cards grid — three columns on large screens */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: RSC — welcome / scaffold notice */}
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              You are signed in as <strong>{userName}</strong>.
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              This dashboard is a Task 7 scaffold placeholder. Real module
              migrations begin post-Wave-0 (Task 10+).
            </p>
          </CardContent>
        </Card>

        {/* Card 2: RSC — recent orders (streams separately) */}
        <Suspense
          fallback={
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground animate-pulse">
                  Loading orders…
                </p>
              </CardContent>
            </Card>
          }
        >
          <RecentOrdersCard />
        </Suspense>

        {/* Card 3: Client+React Query — polling demo */}
        <QuickStatsCard />
      </div>
    </div>
  );
}
