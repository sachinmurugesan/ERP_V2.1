/**
 * @harvesterp/lib — Layer 1 pure TypeScript utility package
 *
 * No framework coupling. Safe to import from any Next.js app, Edge Runtime,
 * Worker, or Node script without bundle bloat from React/Vue.
 *
 * Subsystems:
 *  - tokens  : design tokens (colours, spacing, typography, radii, shadows)
 *  - format  : formatters (currency, date, number, text)
 *  - strings : D-005 string type system (InternalString, PortalString, DialogString)
 *  - auth    : roles, permissions, D-004 permission matrix
 *  - status  : OrderStatus enum, stage map, badge styles
 *  - avatar  : initials + colour helpers (P-020)
 */

export * from "./tokens/index.js";
export * from "./format/index.js";
export * from "./strings/index.js";
export * from "./auth/index.js";
export * from "./status/index.js";
export * from "./avatar/index.js";
