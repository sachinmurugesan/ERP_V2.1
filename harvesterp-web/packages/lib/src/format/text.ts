/**
 * Text / string formatters
 *
 * Rules:
 *  - Null / undefined / empty string → em dash "—"
 *  - Truncation adds ellipsis "…"
 *  - Title case follows basic English word capitalisation
 */

const EMPTY = "—";

/**
 * Return the value or em dash if absent.
 *
 * @example
 * orDash("hello")   // "hello"
 * orDash(null)      // "—"
 * orDash("")        // "—"
 */
export function orDash(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim() === "") return EMPTY;
  return value;
}

/**
 * Truncate a string to maxLength, appending "…" if truncated.
 *
 * @example
 * truncate("Hello World", 5) // "Hello…"
 * truncate("Hi", 10)         // "Hi"
 */
export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}…`;
}

/**
 * Convert a string to Title Case.
 *
 * @example
 * toTitleCase("hello world") // "Hello World"
 */
export function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (char) => char.toUpperCase());
}

/**
 * Normalise whitespace: collapse multiple spaces / newlines to a single space,
 * and trim leading/trailing whitespace.
 *
 * @example
 * normaliseWhitespace("  foo   bar  ") // "foo bar"
 */
export function normaliseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Convert snake_case or kebab-case to a human-readable label.
 *
 * @example
 * humanise("factory_part_number") // "Factory Part Number"
 * humanise("order-status")        // "Order Status"
 */
export function humanise(value: string): string {
  return toTitleCase(value.replace(/[-_]/g, " "));
}
