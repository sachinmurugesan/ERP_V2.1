/**
 * Number formatters — mirrors frontend/src/utils/formatters.js formatNumber()
 *
 * Rules:
 *  - Null / undefined → em dash "—"
 *  - Locale "en-IN" for Indian comma grouping (e.g. 12,34,567)
 *  - Accepts optional decimal places override
 */

const EMPTY = "—";

export interface FormatNumberOptions {
  /** Minimum fraction digits. Default 0. */
  minimumFractionDigits?: number;
  /** Maximum fraction digits. Default 2. */
  maximumFractionDigits?: number;
  /** Override locale. Default "en-IN". */
  locale?: string;
}

/**
 * Format a raw number for display.
 *
 * @example
 * formatNumber(1234567)         // "12,34,567"
 * formatNumber(1234.5, { maximumFractionDigits: 2 }) // "1,234.50"  (en-IN)
 * formatNumber(null)            // "—"
 */
export function formatNumber(
  value: number | null | undefined,
  options: FormatNumberOptions = {},
): string {
  if (value === null || value === undefined) return EMPTY;

  const {
    locale = "en-IN",
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
  } = options;

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

/**
 * Format a percentage (0–100 scale).
 *
 * @example
 * formatPercent(42.5) // "42.5%"
 * formatPercent(null) // "—"
 */
export function formatPercent(
  value: number | null | undefined,
  decimalPlaces = 1,
): string {
  if (value === null || value === undefined) return EMPTY;
  return `${value.toFixed(decimalPlaces)}%`;
}

/**
 * Format a quantity — integer display with en-IN grouping.
 *
 * @example
 * formatQuantity(10000) // "10,000"
 */
export function formatQuantity(value: number | null | undefined): string {
  return formatNumber(value, { maximumFractionDigits: 0 });
}
