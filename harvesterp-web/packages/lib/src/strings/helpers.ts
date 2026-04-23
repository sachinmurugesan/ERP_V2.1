/**
 * Helpers for the D-005 string type system.
 */

import type { AppString, InternalString, PortalString, DialogString } from "./types.js";

export type Locale = "en" | "ta";

/**
 * Resolve a string to the requested locale, falling back to English if the
 * Tamil translation is absent.
 *
 * @example
 * resolveString({ en: "Order", ta: "ஆர்டர்" }, "ta") // "ஆர்டர்"
 * resolveString({ en: "Order" }, "ta")                 // "Order"  (fallback)
 */
export function resolveString(s: AppString, locale: Locale): string {
  if (locale === "ta" && s.ta !== undefined) return s.ta;
  return s.en;
}

/**
 * Type guard: check if an AppString has a Tamil translation available.
 */
export function hasTamilTranslation(s: AppString): s is PortalString | DialogString {
  return s.ta !== undefined && s.ta.trim().length > 0;
}

/**
 * Create an InternalString (admin-only, translation optional).
 *
 * @example
 * internal("Order reference") // { en: "Order reference" }
 * internal("Order reference", "ஆர்டர் குறிப்பு") // { en: "...", ta: "..." }
 */
export function internal(en: string, ta?: string): InternalString {
  return ta !== undefined ? { en, ta } : { en };
}

/**
 * Create a PortalString (client/factory portal — translation required).
 *
 * @example
 * portal("Submit", "சமர்ப்பிக்கவும்")
 */
export function portal(en: string, ta: string): PortalString {
  return { en, ta };
}

/**
 * Create a DialogString (confirm/action dialogs — translation required).
 *
 * @example
 * dialog("Are you sure?", "நீங்கள் உறுதியாக இருக்கிறீர்களா?")
 */
export function dialog(en: string, ta: string): DialogString {
  return { en, ta };
}
