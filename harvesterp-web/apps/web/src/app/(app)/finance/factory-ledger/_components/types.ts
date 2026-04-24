/**
 * Local response shapes for /api/finance/factory-ledger endpoints.
 *
 * Derived from backend/routers/finance.py:1480-1617 (verified against live
 * backend on 2026-04-24). OpenAPI declares the response schema as `{}` so
 * we maintain a local interface here per Section 10 local-interface rule.
 */

export interface LedgerEntry {
  /** ISO date "YYYY-MM-DD". */
  date: string;
  /** Factory order number, monospace-rendered. */
  order_number: string;
  /** Parent Order id (not rendered; useful for row keys / future links). */
  order_id: string;
  /** Human-readable remark (e.g. "Factory order for ABC-001" or payment notes). */
  remark: string;
  /** INR debit value for factory-order entries; 0 for payments. */
  debit: number;
  /** INR credit value for payments; 0 for order entries. */
  credit: number;
  /** Amount in the factory's source currency (usually CNY). */
  amount_foreign: number;
  /** ISO currency code (e.g. "CNY"). */
  currency: string;
  /** FX rate used for this entry (e.g. 11.3 for CNY→INR). */
  exchange_rate: number;
  /** Pre-computed USD-equivalent — backend derives from the USD→INR rate. Not rendered; kept for future toggle. */
  amount_usd: number;
  /** Payment method for credit rows; "-" for debit rows. */
  method: string;
  /** Reference number / order number for debit rows. */
  reference: string;
  /** Cumulative debit-credit running total, in INR. */
  running_balance: number;
}

export interface LedgerSummary {
  total_debit: number;
  total_credit: number;
  /** Positive = factory is owed; negative = overpaid. */
  net_balance: number;
  /** USD-denominated counterparts. Preserved in the type for a future toggle per Phase 2 decision 10 (not rendered today). */
  total_debit_usd: number;
  total_credit_usd: number;
  net_balance_usd: number;
}

export interface FactoryLedgerResponse {
  entries: LedgerEntry[];
  summary: LedgerSummary;
  factory_name: string;
  factory_id: string;
}

/** Paginated factory list response — used for the entity dropdown. */
export interface FactorySummary {
  id: string;
  company_name: string;
  is_active?: boolean;
}

export interface FactoriesListResponse {
  items: FactorySummary[];
  total: number;
  page: number;
  per_page: number;
  pages: number | null;
}
