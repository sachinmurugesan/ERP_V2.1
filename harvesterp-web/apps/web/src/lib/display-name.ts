/**
 * display-name.ts — Resolve a friendly name for UI greetings.
 *
 * Order of preference:
 *   1. full_name if provided (future-ready once /api/auth/me exposes it)
 *   2. Title-cased local part of the email (admin@harvesterp.com → "Admin")
 *   3. "there" as a neutral last resort
 *
 * Used by the (app) layout + WelcomeCard + AppTopbar greeting so all
 * surfaces agree on how to address the signed-in user.
 */

const FALLBACK = "there";

export function resolveDisplayName(user: {
  full_name?: string | null;
  email?: string | null;
} | null | undefined): string {
  if (!user) return FALLBACK;

  const fullName = user.full_name?.trim();
  if (fullName) return fullName;

  const email = user.email?.trim();
  if (!email) return FALLBACK;

  const localPart = email.split("@")[0]?.trim();
  if (!localPart) return FALLBACK;

  return titleCase(localPart);
}

function titleCase(value: string): string {
  return value
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
