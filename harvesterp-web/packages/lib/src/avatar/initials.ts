/**
 * Avatar initials helper — P-020 (CROSS_CUTTING.md)
 *
 * Contract:
 *   getInitials(name: string): string
 *   - Split on /[@\s.]/  (handles "First Last", "first.last", "user@domain.com")
 *   - Take first letter of first and last non-empty segments, uppercased
 *   - If only one segment: first two chars, uppercased
 *   - If empty input: return "?"
 */

const SPLIT_RE = /[@\s.]+/;

/**
 * Derive 1–2 letter initials from a name or email address.
 *
 * @example
 * getInitials("Sachin Murugesan")      // "SM"
 * getInitials("sachin.murugesan")      // "SM"
 * getInitials("sachin@harvesterp.com") // "SH"
 * getInitials("Alice")                 // "AL"
 * getInitials("")                      // "?"
 */
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";

  const parts = trimmed.split(SPLIT_RE).filter((p) => p.length > 0);

  if (parts.length === 0) return "?";

  if (parts.length === 1) {
    const part = parts[0]!;
    return part.length >= 2
      ? part.slice(0, 2).toUpperCase()
      : part.toUpperCase();
  }

  const first = parts[0]![0]!.toUpperCase();
  const last  = parts[parts.length - 1]![0]!.toUpperCase();
  return `${first}${last}`;
}
