/**
 * String type system — D-005 (DECISIONS.md)
 *
 * Three string contexts with different translation-awareness requirements:
 *
 *   InternalString  — admin/ops panels only; translation optional (ta?: string)
 *   PortalString    — client or factory portal; translation REQUIRED (ta: string)
 *   DialogString    — confirm/action dialogs; translation REQUIRED (ta: string)
 *
 * The `en` field is always the English (source) copy.
 * The `ta` field is Tamil translation copy.
 *
 * Callers that render to the portal MUST provide `ta`.
 * Admin-only callers MAY omit `ta` but should prefer providing it.
 */

/** Used in admin/ops panels — translation optional */
export interface InternalString {
  /** English (source) copy */
  en: string;
  /** Tamil translation — optional for internal/admin use */
  ta?: string;
}

/** Used in client-facing or factory-facing portals — translation required */
export interface PortalString {
  /** English (source) copy */
  en: string;
  /** Tamil translation — REQUIRED for portal display */
  ta: string;
}

/** Used in confirm/action dialogs — translation required */
export interface DialogString {
  /** English (source) copy */
  en: string;
  /** Tamil translation — REQUIRED for dialog display */
  ta: string;
}

/** Union of all string types */
export type AppString = InternalString | PortalString | DialogString;
