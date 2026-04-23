/**
 * Formatters local to the dashboard.
 *
 * CNY formatting (formatCNY) deliberately does not use @harvesterp/lib's
 * formatCurrency because the Vue dashboard it replaces renders CNY without
 * decimals (whole-yen granularity). The behaviour is preserved to avoid a
 * visible change for users during migration.
 */

const EMPTY = "\u2014";

export function formatCNY(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return EMPTY;
  return `\u00a5 ${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/**
 * Format a whole-number count using Indian grouping (en-IN locale).
 * 100000 → "1,00,000" rather than the US "100,000". Used on KPI cards.
 */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return EMPTY;
  return value.toLocaleString("en-IN");
}

export function timeAgo(isoStr: string | null | undefined, now: number = Date.now()): string {
  if (!isoStr) return "";
  const diff = now - new Date(isoStr).getTime();
  if (Number.isNaN(diff)) return "";
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} mins ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}
