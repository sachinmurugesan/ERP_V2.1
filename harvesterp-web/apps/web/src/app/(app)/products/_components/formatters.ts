import * as React from "react";

const EMPTY_DASH = "\u2014";

export function dashIfEmpty(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return EMPTY_DASH;
  if (typeof value === "string" && value.trim() === "") return EMPTY_DASH;
  return String(value);
}

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => {
      window.clearTimeout(id);
    };
  }, [value, delayMs]);
  return debounced;
}

/**
 * Compute total pages client-side. Backend returns `pages: null` for
 * grouped lists; never trust the server value.
 */
export function computeTotalPages(total: number, perPage: number): number {
  if (perPage <= 0) return 1;
  return Math.max(1, Math.ceil(total / perPage));
}

/**
 * Aggregate a unique-and-sorted list of non-empty field values across
 * a product group — used for the Material / Size columns on parent rows.
 */
export function uniqueTags(
  variants: Array<{ [key: string]: unknown }>,
  field: string,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const variant of variants) {
    const value = variant[field];
    if (typeof value === "string" && value.trim().length > 0 && !seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}
