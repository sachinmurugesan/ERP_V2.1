import { NextResponse, type NextRequest } from "next/server";
import { getSessionToken } from "@/lib/session";
import { getServerClient } from "@/lib/api-server";

/**
 * GET /api/orders/{id}/landed-cost
 *
 * Proxies FastAPI GET /api/orders/{id}/landed-cost/ — full cost
 * breakdown (invoice + 6 expense rows + summary KPIs + per-item split)
 * for TRANSPARENCY clients on CLEARED+ orders.
 *
 * The backend triple-gates the call:
 *   1. TRANSPARENCY_ENABLED feature flag (env var) — 404 when off.
 *   2. client.client_type === "TRANSPARENCY" — 404 when REGULAR (so a
 *      REGULAR-client caller cannot even probe the URL's existence).
 *   3. role ∈ {SUPER_ADMIN, ADMIN, FINANCE} OR (CLIENT && own order) —
 *      403 otherwise.
 *   4. order.status ∈ {CLEARED, DELIVERED, AFTER_SALES, COMPLETED,
 *      COMPLETED_EDITING} — 400 otherwise with a stage-aware message.
 *
 * The shell (`order-tabs.tsx:192-199`) mirrors gates 2+3+4 inline so the
 * tab never mounts when the call would fail. We do NOT re-gate at this
 * proxy layer (decisions D-3 + D-4 in the migration log) — backend is
 * authoritative; this proxy just forwards and surfaces the upstream
 * error code verbatim.
 *
 * R-19 verified shape (live curl, 2026-04-27, ADMIN as
 * admin@harvesterp.com):
 *   - REGULAR client (gate 2)        → HTTP 404 `{"detail":"Not found"}`
 *   - TRANSPARENCY+DRAFT (gate 4)    → HTTP 400 `{"detail":"Landed cost
 *       is available after customs clearance. Current stage: Draft
 *       (stage 1)"}`
 *   - Populated case shape           → derived from
 *       backend/routers/landed_cost.py:187-216 (no live CLEARED+ order
 *       seedable in this session — same approach used in
 *       feat/orders-files-tab and feat/orders-queries-tab when the live
 *       happy-path required a multi-stage advance).
 *
 * See `ERP_V1/docs/migration/logs/2026-04-27-orders-landed-cost-tab.md`
 * §1.5 for the full curl evidence.
 */

interface LandedCostInvoice {
  label: string;
  amount_inr: number;
}

interface LandedCostExpense {
  label: string;
  amount_inr: number;
}

interface LandedCostSummary {
  total_bill_inr: number;
  total_expenses_inr: number;
  grand_total_inr: number;
  expense_percent: number;
}

interface LandedCostItem {
  product_code: string;
  product_name: string;
  quantity: number;
  client_factory_price_cny: number;
  item_value_inr: number;
  freight_share: number;
  duty_share: number;
  clearance_share: number;
  commission_share: number;
  total_landed_cost: number;
  landed_cost_per_unit: number;
}

export interface LandedCostResponse {
  order_id: string;
  order_number: string | null;
  client_name: string;
  exchange_rate: number;
  currency: string;
  invoice: LandedCostInvoice;
  expenses: LandedCostExpense[];
  summary: LandedCostSummary;
  items: LandedCostItem[];
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
    const result = await client.getJson<LandedCostResponse>(
      `/api/orders/${encodeURIComponent(id)}/landed-cost/`,
    );
    return NextResponse.json(result);
  } catch (err) {
    const status =
      err instanceof Error && "status" in err
        ? Number((err as { status?: number }).status ?? 502)
        : 502;
    const detail =
      err instanceof Error && "detail" in err
        ? String((err as { detail?: string }).detail ?? "")
        : err instanceof Error
          ? err.message
          : "";

    if (status === 400) {
      return NextResponse.json(
        { error: detail || "Landed cost not available at the current stage" },
        { status: 400 },
      );
    }
    if (status === 403) {
      return NextResponse.json(
        {
          error:
            "You don't have permission to view landed cost for this order.",
        },
        { status: 403 },
      );
    }
    if (status === 404) {
      return NextResponse.json(
        { error: "Landed cost not available for this order." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      { error: "Failed to load landed cost" },
      { status: status >= 500 ? 502 : status },
    );
  }
}
