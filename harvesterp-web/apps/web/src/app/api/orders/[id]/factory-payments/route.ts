import { NextResponse, type NextRequest } from "next/server";
import { type UserRole } from "@harvesterp/lib";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

/**
 * GET /api/orders/{id}/factory-payments
 *
 * Proxies FastAPI GET /api/finance/orders/{id}/factory-payments/ — factory
 * payment list (per-remittance) + summary (factory bill, paid, balance,
 * currency totals).
 *
 * SECURITY GATE — D-004 (factory cost / margin visibility):
 *   ALLOWED: SUPER_ADMIN | FINANCE
 *   DENIED:  any other role → 403 with explicit policy reference.
 *
 * The backend ALSO enforces this (it returns 403 for ADMIN), but we gate at
 * the proxy too so the request never leaves the Next.js process for users
 * who can't see the data. Mirrors the gate-twice pattern used by
 * /api/orders/{id}/transition.
 *
 * R-19 verified shape (live curl, 2026-04-26):
 *   - ADMIN call → 403 `{detail: "Insufficient permissions. Required: ..."}`
 *   - FINANCE/SUPER_ADMIN call → see FactoryPaymentsResponse shape below
 *     (derived from `_serialize_factory_payment` in
 *      backend/routers/finance.py:761-805).
 */

const FACTORY_PAYMENTS_ROLES: ReadonlyArray<UserRole> = [
  "FINANCE",
  "SUPER_ADMIN",
] as UserRole[];

interface FactoryPaymentRecord {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  amount_inr: number;
  amount_usd: number;
  method: string;
  reference: string | null;
  notes: string | null;
  payment_date: string;
  created_at: string;
}

interface FactoryPaymentSummary {
  factory_total_cny: number;
  factory_total_inr: number;
  factory_currency: string;
  total_inr: number;
  total_usd: number;
  avg_exchange_rate_usd: number;
  balance_inr: number;
  paid_percent: number;
  currency_totals: Record<string, number>;
  remittance_count: number;
}

export interface FactoryPaymentsResponse {
  payments: FactoryPaymentRecord[];
  summary: FactoryPaymentSummary;
}

async function resolveCallerRole(): Promise<UserRole | undefined> {
  try {
    const client = await getServerClient();
    const result = await client.GET("/api/auth/me");
    if (!result.data) return undefined;
    return (result.data as { role?: UserRole }).role;
  } catch {
    return undefined;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing order id" }, { status: 400 });
  }

  const role = await resolveCallerRole();
  if (!role || !FACTORY_PAYMENTS_ROLES.includes(role)) {
    return NextResponse.json(
      {
        error:
          "Factory payment data is restricted to Finance role. (Policy D-004)",
      },
      { status: 403 },
    );
  }

  try {
    const client = await getServerClient();
    const result = await client.getJson<FactoryPaymentsResponse>(
      `/api/finance/orders/${encodeURIComponent(id)}/factory-payments/`,
    );
    return NextResponse.json(result);
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 403) {
      return NextResponse.json(
        {
          error:
            "Factory payment data is restricted to Finance role. (Policy D-004)",
        },
        { status: 403 },
      );
    }
    if (status === 404) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to load factory payments" },
      { status: status >= 500 ? 502 : status },
    );
  }
}
