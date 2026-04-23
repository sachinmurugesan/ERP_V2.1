/**
 * Date formatters — mirrors frontend/src/utils/formatters.js formatDate()
 *
 * Rules:
 *  - Null / undefined / empty string → em dash "—"
 *  - Accepts Date objects, ISO strings, or Unix timestamps (ms)
 *  - Default display: "DD MMM YYYY"  e.g. "22 Apr 2026"
 *  - locale "en-IN" for consistency with the rest of the app
 */

const EMPTY = "—";

export type DateInput = Date | string | number | null | undefined;

export interface FormatDateOptions {
  /** Override the locale. Defaults to "en-IN". */
  locale?: string;
  /** Override Intl.DateTimeFormatOptions. Defaults to day/month(short)/year numeric. */
  dateStyle?: "full" | "long" | "medium" | "short";
}

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format a date value for display.
 *
 * @example
 * formatDate("2026-04-22")            // "22 Apr 2026"
 * formatDate(null)                    // "—"
 * formatDate("2026-04-22", { dateStyle: "long" }) // "22 April 2026"
 */
export function formatDate(
  value: DateInput,
  options: FormatDateOptions = {},
): string {
  const d = toDate(value);
  if (!d) return EMPTY;

  const { locale = "en-IN", dateStyle } = options;

  if (dateStyle) {
    return new Intl.DateTimeFormat(locale, { dateStyle }).format(d);
  }

  // Default: "22 Apr 2026"
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/**
 * Format a date+time value.
 *
 * @example
 * formatDateTime("2026-04-22T14:30:00Z") // "22 Apr 2026, 8:00 pm"
 */
export function formatDateTime(
  value: DateInput,
  options: FormatDateOptions = {},
): string {
  const d = toDate(value);
  if (!d) return EMPTY;

  const { locale = "en-IN" } = options;

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}
