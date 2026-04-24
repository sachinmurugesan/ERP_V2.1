const EMPTY = "\u2014";

export function formatCNY(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return EMPTY;
  return `\u00a5 ${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return EMPTY;
  return value.toLocaleString("en-IN");
}

/**
 * "22 Apr 2026" — the legacy Vue dashboard used dd-mm-yyyy; this migration
 * follows the Section 8 rule (dd MMM yyyy) which reads better at a glance.
 */
export function formatDate(isoStr: string | null | undefined): string {
  if (!isoStr) return EMPTY;
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return EMPTY;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Deterministic colour for a client-avatar circle. Hashing the name keeps
 * the same client always rendering the same hue — useful for scanning.
 */
export function avatarBackgroundFor(name: string | null | undefined): string {
  if (!name) return "var(--bg-sunken)";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const palette = [
    "var(--brand-600)",
    "var(--info)",
    "var(--warn)",
    "var(--ok)",
    "var(--err)",
    "var(--c4)",
    "var(--c5)",
    "var(--c6)",
  ];
  const idx = Math.abs(hash) % palette.length;
  return palette[idx] ?? "var(--bg-sunken)";
}

export function initialsFor(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
