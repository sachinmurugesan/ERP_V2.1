/**
 * Currency formatters — mirrors frontend/src/utils/formatters.js
 *
 * Rules (derived from existing JS implementation):
 *  - Null / undefined → em dash "—"
 *  - INR → locale "en-IN", symbol ₹, 2 decimal places
 *  - CNY → locale "en-US", symbol ¥, 2 decimal places
 *  - USD → locale "en-US", symbol $, 2 decimal places
 *  - Unknown currency → falls back to USD formatting
 */

export type Currency = "INR" | "CNY" | "USD";

const LOCALE_MAP: Record<Currency, string> = {
  INR: "en-IN",
  CNY: "en-US",
  USD: "en-US",
};

const EMPTY = "—";

/**
 * Format a monetary amount with the given currency.
 *
 * @example
 * formatCurrency(12500, "INR") // "₹12,500.00"
 * formatCurrency(null, "USD")  // "—"
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: Currency = "INR",
): string {
  if (value === null || value === undefined) return EMPTY;

  const locale = LOCALE_MAP[currency];

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Convenience: format as Indian Rupees.
 *
 * @example
 * formatINR(5000) // "₹5,000.00"
 */
export function formatINR(value: number | null | undefined): string {
  return formatCurrency(value, "INR");
}
