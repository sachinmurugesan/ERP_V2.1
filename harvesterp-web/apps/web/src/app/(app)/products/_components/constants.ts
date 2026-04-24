/**
 * Constants shared by the product form components.
 *
 * part_type is a hardcoded enum in the Vue source (not an API list) — kept
 * hardcoded here too since no backend endpoint exposes it dynamically.
 */

export const PART_TYPES = ["Original", "Copy", "OEM", "Aftermarket"] as const;

export type PartType = (typeof PART_TYPES)[number];

/**
 * Category select supports an inline "add new" sentinel — picking it opens
 * a small inline form that creates a new markup via /api/settings/markups.
 */
export const CATEGORY_ADD_SENTINEL = "__add__";

/** Form sections, in render order. */
export const FORM_SECTIONS = [
  "identification",
  "category",
  "specifications",
  "reference",
  "notes",
] as const;

export type FormSection = (typeof FORM_SECTIONS)[number];
