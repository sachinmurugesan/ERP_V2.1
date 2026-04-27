import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

/**
 * GET /api/orders/{id}/payments
 *
 * Proxies FastAPI GET /api/finance/orders/{id}/payments/ — client-payment
 * list + financial summary (PI total, balance, paid, etc.).
 *
 * R-19 verified shape (live curl, 2026-04-26):
 *   {
 *     payments: PaymentRecord[],
 *     summary: {
 *       pi_total_inr, advance_percent, total_paid_inr, balance_inr,
 *       payment_count, paid_percent, has_revisions, unloaded_count,
 *       revised_client_total_inr, revised_balance_inr,
 *       original_factory_total_cny, original_factory_total_inr,
 *       revised_factory_total_cny, revised_factory_total_inr,
 *       factory_paid_inr, revised_factory_balance_inr
 *     }
 *   }
 *
 * Auth: any authenticated INTERNAL/CLIENT/FACTORY user (backend enforces
 * row-level scope). Not D-004 gated — payments are a client-facing concept.
 * Factory cost fields inside `summary` are scrubbed by the backend for the
 * OPERATIONS role per D-010.
 */

interface PaymentRecord {
  id: string;
  order_id: string;
  payment_type: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  amount_inr: number;
  method: string;
  reference: string | null;
  notes: string | null;
  payment_date: string;
  created_at: string;
  verification_status: string;
  proof_file_path: string | null;
  rejection_reason: string | null;
  submitted_by: string | null;
  utilized_inr: number;
  surplus_inr: number;
}

interface PaymentSummary {
  pi_total_inr: number;
  advance_percent: number;
  total_paid_inr: number;
  balance_inr: number;
  payment_count: number;
  paid_percent: number;
  has_revisions: boolean;
  unloaded_count: number;
  revised_client_total_inr: number;
  revised_balance_inr: number;
  // The factory_* fields are nullable because the backend nulls them
  // for OPERATIONS callers per D-010.
  original_factory_total_cny: number | null;
  original_factory_total_inr: number | null;
  revised_factory_total_cny: number | null;
  revised_factory_total_inr: number | null;
  factory_paid_inr: number | null;
  revised_factory_balance_inr: number | null;
}

export interface OrderPaymentsResponse {
  payments: PaymentRecord[];
  summary: PaymentSummary;
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
  try {
    const client = await getServerClient();
    const result = await client.getJson<OrderPaymentsResponse>(
      `/api/finance/orders/${encodeURIComponent(id)}/payments/`,
    );
    return NextResponse.json(result);
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    if (status === 403) {
      return NextResponse.json(
        { error: "You don't have permission to view payments for this order" },
        { status: 403 },
      );
    }
    if (status === 404) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to load order payments" },
      { status: status >= 500 ? 502 : status },
    );
  }
}
