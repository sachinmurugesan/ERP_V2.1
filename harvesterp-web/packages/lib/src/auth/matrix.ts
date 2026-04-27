/**
 * Permission matrix — D-004 (DECISIONS.md)
 *
 * Each entry lists the roles that MAY access the resource/action,
 * EXCLUDING SUPER_ADMIN (which bypasses all checks via has_any_role — see permissions.ts).
 *
 * ── Verification status ─────────────────────────────────────────────────────
 *
 * Every entry has been verified against the actual backend authorization code
 * as of 2026-04-22. Sources listed per-entry.
 *
 * Annotation key:
 *   // VERIFIED <source>   — confirmed against backend endpoint / security.py
 *   // FRONTEND_ONLY       — no backend endpoint; pure client-side tab/route visibility
 *   // INVENTED            — no backend counterpart confirmed; needs Sachin review
 *
 * ── Backend role enum ────────────────────────────────────────────────────────
 * backend/core/security.py UserRole has exactly 6 values:
 *   SUPER_ADMIN | ADMIN | FINANCE | OPERATIONS | CLIENT | FACTORY
 *
 * NOTE: The TA (Technical Assistant) role is defined in Layer 1 roles.ts for
 * future use but does NOT currently exist in the backend. It must NOT appear
 * in any matrix entry that gates a backend API call.
 *
 * ── Key security.py dependencies ─────────────────────────────────────────────
 *   require_finance           = [SUPER_ADMIN, ADMIN, FINANCE]    — router-level /api/finance
 *   require_factory_financial = [SUPER_ADMIN, FINANCE]           — endpoint-level factory cost
 *   require_operations        = [ADMIN, OPERATIONS]
 *   require_admin             = [ADMIN]  (SUPER_ADMIN bypass applies)
 *   require_read              = [ADMIN, FINANCE, OPERATIONS, CLIENT, FACTORY]
 *
 * ── Factory ledger effective access (D-009 / D-004) ──────────────────────────
 * Cluster A endpoints carry BOTH:
 *   router-level:    require_finance           = [SUPER_ADMIN, ADMIN, FINANCE]
 *   endpoint-level:  require_factory_financial = [SUPER_ADMIN, FINANCE]
 * Intersection → SUPER_ADMIN | FINANCE only.
 * ADMIN is deliberately excluded per D-004: "ADMIN remains excluded from factory
 * cost data." D-009-A2 requires a frontend role gate to hide the Factory Ledger
 * tab from ADMIN.
 */

import { UserRole } from "./roles.js";

const {
  SUPER_ADMIN,
  ADMIN,
  OPERATIONS,
  FINANCE,
  CLIENT,
  FACTORY,
} = UserRole;

// NOTE: TA is intentionally omitted from destructuring — it has no backend counterpart.

// ---------------------------------------------------------------------------
// Resource keys
// ---------------------------------------------------------------------------

export const Resource = {
  // Orders
  ORDER_LIST:           "ORDER_LIST",
  ORDER_DETAIL:         "ORDER_DETAIL",
  ORDER_CREATE:         "ORDER_CREATE",
  ORDER_UPDATE:         "ORDER_UPDATE",

  // Products
  PRODUCT_LIST:         "PRODUCT_LIST",
  PRODUCT_DETAIL:       "PRODUCT_DETAIL",
  PRODUCT_CREATE:       "PRODUCT_CREATE",
  PRODUCT_UPDATE:       "PRODUCT_UPDATE",
  PRODUCT_FACTORY_COST: "PRODUCT_FACTORY_COST", // G-012 / G-013: factory cost fields

  // Clients
  CLIENT_CREATE:        "CLIENT_CREATE",
  CLIENT_UPDATE:        "CLIENT_UPDATE",
  CLIENT_DELETE:        "CLIENT_DELETE",

  // Transporters (Service Providers)
  TRANSPORT_CREATE:     "TRANSPORT_CREATE",
  TRANSPORT_UPDATE:     "TRANSPORT_UPDATE",
  TRANSPORT_DELETE:     "TRANSPORT_DELETE",

  // Orders — stage workflow actions (added in feat/order-detail-shell)
  ORDER_REOPEN:           "ORDER_REOPEN",
  ORDER_TRANSITION:       "ORDER_TRANSITION",
  ORDER_APPROVE_INQUIRY:  "ORDER_APPROVE_INQUIRY",

  // Order documents (added in feat/orders-files-tab — FilesTab CRUD)
  DOCUMENT_UPLOAD: "DOCUMENT_UPLOAD",
  DOCUMENT_DELETE: "DOCUMENT_DELETE",

  // Order queries (added in feat/orders-queries-tab — QueriesTab Tier 1)
  QUERY_DELETE: "QUERY_DELETE",

  // Factory ledger (Cluster A — D-009)
  FACTORY_LEDGER_VIEW:  "FACTORY_LEDGER_VIEW",
  FACTORY_PAYMENTS:     "FACTORY_PAYMENTS",
  FACTORY_CREDITS:      "FACTORY_CREDITS",
  FACTORY_AUDIT_LOG:    "FACTORY_AUDIT_LOG",

  // Dashboard tabs (D-010) — FRONTEND_ONLY: no backend endpoint gates these tabs
  DASHBOARD_OPERATIONS_TAB: "DASHBOARD_OPERATIONS_TAB",
  DASHBOARD_PAYMENTS_TAB:   "DASHBOARD_PAYMENTS_TAB",

  // Portal access — FRONTEND_ONLY: frontend routing only, no single backend gate
  CLIENT_PORTAL_ACCESS:  "CLIENT_PORTAL_ACCESS",
  FACTORY_PORTAL_ACCESS: "FACTORY_PORTAL_ACCESS",

  // Settings / admin
  USER_MANAGEMENT: "USER_MANAGEMENT",
  SYSTEM_SETTINGS: "SYSTEM_SETTINGS",
} as const;

export type Resource = (typeof Resource)[keyof typeof Resource];

// ---------------------------------------------------------------------------
// Matrix
// ---------------------------------------------------------------------------

/** Map from Resource to the set of roles allowed (excluding SUPER_ADMIN bypass). */
export const PERMISSION_MATRIX: Readonly<Record<Resource, readonly UserRole[]>> = {

  // --- Orders ---
  // GET /api/orders/ — get_scoped_query (no role check; CLIENT/FACTORY scoped by RLS)
  // GET /api/orders/{id}/ — same; FACTORY users can access orders for their factory_id
  // VERIFIED: orders.py list_orders / get_order + security.py get_scoped_query
  [Resource.ORDER_LIST]:   [ADMIN, OPERATIONS, FINANCE, CLIENT, FACTORY],
  [Resource.ORDER_DETAIL]: [ADMIN, OPERATIONS, FINANCE, CLIENT, FACTORY],

  // POST /api/orders/ — role not in ("ADMIN","SUPER_ADMIN","OPERATIONS") → 403
  // PUT  /api/orders/{id}/ — same check
  // VERIFIED: orders.py create_order (line 905), update_order (line 1003)
  [Resource.ORDER_CREATE]: [ADMIN, OPERATIONS],
  [Resource.ORDER_UPDATE]: [ADMIN, OPERATIONS],

  // --- Products ---
  // GET /api/products/ — get_current_user only; CLIENT brand-scoped; FACTORY sees all
  // GET /api/products/{id}/ — no role check (only get_db dep)
  // VERIFIED: products.py list_products / get_product
  [Resource.PRODUCT_LIST]:   [ADMIN, OPERATIONS, FINANCE, CLIENT, FACTORY],
  [Resource.PRODUCT_DETAIL]: [ADMIN, OPERATIONS, FINANCE, CLIENT, FACTORY],

  // POST /api/products/ — G-011 Patch 10 (2026-04-22): role not in
  //   ("ADMIN","SUPER_ADMIN","OPERATIONS") → 403. CLIENT/FACTORY rejected.
  // Mirror of ORDER_CREATE. SUPER_ADMIN bypass applies via canAccess().
  [Resource.PRODUCT_CREATE]: [ADMIN, OPERATIONS],

  // PUT /api/products/{id}/ + DELETE /api/products/{id}/ +
  // POST /api/products/bulk-update/ + bulk-delete/ + bin/restore +
  // bin/permanent-delete — same G-011 gate as PRODUCT_CREATE.
  [Resource.PRODUCT_UPDATE]: [ADMIN, OPERATIONS],

  // Serializer field stripping (not an endpoint gate — applies in every product response):
  //   CLIENT_HIDDEN_FIELDS ∋ factory_cost_* fields → stripped for CLIENT role
  //   FACTORY_HIDDEN_FIELDS ∋ factory_cost_* fields → stripped for FACTORY role
  // Remaining internal roles (ADMIN, OPERATIONS, FINANCE) receive unstripped data.
  // VERIFIED: core/serializers.py + patches G-011–G-014 + G-017
  [Resource.PRODUCT_FACTORY_COST]: [ADMIN, OPERATIONS, FINANCE],

  // --- Clients ---
  // Backend (G-013, Patch 12) gates POST /api/clients/, PUT /api/clients/{id}/,
  // and DELETE /api/clients/{id}/ to ADMIN | OPERATIONS | SUPER_ADMIN.
  // CREATE + UPDATE mirror that scope. DELETE is intentionally STRICTER than
  // backend (UI hides delete from OPERATIONS) — defense-in-depth UI hardening.
  // Backend remains the source of truth for actual rejection.
  [Resource.CLIENT_CREATE]: [ADMIN, OPERATIONS],
  [Resource.CLIENT_UPDATE]: [ADMIN, OPERATIONS],
  [Resource.CLIENT_DELETE]: [ADMIN],

  // --- Transporters (Service Providers) ---
  // Backend (G-014, Patch 13) gates POST /api/shipping/transport/, PUT /api/shipping/transport/{id}/,
  // and DELETE /api/shipping/transport/{id}/ to ADMIN | OPERATIONS | SUPER_ADMIN
  // (CREATE/UPDATE) and ADMIN | SUPER_ADMIN (DELETE).
  // CREATE + UPDATE mirror that scope. DELETE matches backend exactly — only ADMIN
  // (SUPER_ADMIN bypass is implicit via canAccess()). Same pattern as CLIENT_DELETE.
  // VERIFIED: backend/routers/shipping.py + G-014 patch + live POST/DELETE 2026-04-26.
  [Resource.TRANSPORT_CREATE]: [ADMIN, OPERATIONS],
  [Resource.TRANSPORT_UPDATE]: [ADMIN, OPERATIONS],
  [Resource.TRANSPORT_DELETE]: [ADMIN],

  // --- Orders — stage workflow actions ---
  // ORDER_REOPEN: backend `reopen_order` (orders.py:2498) gates to ADMIN/SUPER_ADMIN.
  //   Matrix entry [ADMIN] (SUPER_ADMIN bypass implicit). Mirrors backend.
  // ORDER_TRANSITION: backend `transition_order` / `go_back_order` / `jump_to_stage`
  //   (orders.py:2448, 2521, 2553) are CURRENTLY UNGATED on backend (any auth user
  //   with order access can transition). UI gates to [ADMIN, OPERATIONS] as
  //   defense in depth. Backend-fix tracked in
  //   `docs/tech-debt/order-stage-transition-ungated.md`. Same role set is
  //   enforced inside `apps/web/src/app/api/orders/[id]/transition/route.ts` etc.
  // ORDER_APPROVE_INQUIRY: backend `approve_inquiry` (orders.py:826) only checks
  //   `current_user.user_type == "INTERNAL"` — accepts ADMIN, OPERATIONS, AND
  //   FINANCE. Matrix matches backend exactly. (Verified live 2026-04-26 in
  //   feat/order-detail-shell Phase 1 — see migration log §9.)
  [Resource.ORDER_REOPEN]:           [ADMIN],
  [Resource.ORDER_TRANSITION]:       [ADMIN, OPERATIONS],
  [Resource.ORDER_APPROVE_INQUIRY]:  [ADMIN, OPERATIONS, FINANCE],

  // --- Order documents (FilesTab — feat/orders-files-tab) ---
  // Backend `documents.py:upload_document` accepts any authenticated user
  // (CLIENT/FACTORY restricted by RLS to their own orders). Internal portal
  // surfaces upload to ADMIN + OPERATIONS only — FINANCE is excluded
  // because finance users do not own document uploads in our admin flow.
  // VERIFIED: backend/routers/documents.py:60-103 (any auth user) +
  //           live curl 2026-04-27 (ADMIN upload returns 200).
  [Resource.DOCUMENT_UPLOAD]: [ADMIN, OPERATIONS],

  // Backend `documents.py:delete_document` (line 132) explicitly checks:
  //   if current_user.role not in ("ADMIN", "SUPER_ADMIN", "OPERATIONS"):
  //     raise 403
  // Mirrors backend exactly (SUPER_ADMIN bypass implicit via canAccess()).
  // VERIFIED: live curl 2026-04-27 (ADMIN DELETE returns 200, body
  // `{"message":"Document deleted"}`).
  [Resource.DOCUMENT_DELETE]: [ADMIN, OPERATIONS],

  // Backend `queries.py:delete_query` (line 437) gates on creator-or-admin:
  //   - INTERNAL users (ADMIN/OPERATIONS/FINANCE) can delete any query.
  //   - CLIENT users can only delete queries they created.
  // FE gate is STRICTER than backend on purpose — FINANCE could create AND
  // delete a query as the creator under backend rules, but admin-portal
  // policy reserves delete for ADMIN/OPERATIONS only. Defense-in-depth:
  // backend remains the source of truth for actual rejection.
  // VERIFIED: live curl 2026-04-27 (ADMIN DELETE returns 200, body
  // `{"deleted":true,"id":"..."}`).
  [Resource.QUERY_DELETE]: [ADMIN, OPERATIONS],

  // --- Factory ledger (D-009 / Cluster A) ---
  // All 9 endpoints carry Depends(require_factory_financial) = [SUPER_ADMIN, FINANCE].
  // Router-level require_finance = [SUPER_ADMIN, ADMIN, FINANCE] is the outer gate;
  // endpoint-level require_factory_financial is the inner gate.
  // Effective access = SUPER_ADMIN | FINANCE. ADMIN is deliberately excluded (D-004).
  // VERIFIED: finance.py lines 728, 808, 854, 891, 956, 1388, 1414, 1479, 1839
  //           + D-009 decision record (DECISIONS.md § D-009)
  [Resource.FACTORY_LEDGER_VIEW]: [FINANCE],
  [Resource.FACTORY_PAYMENTS]:    [FINANCE],
  [Resource.FACTORY_CREDITS]:     [FINANCE],
  [Resource.FACTORY_AUDIT_LOG]:   [FINANCE],

  // --- Dashboard tabs (D-010) — FRONTEND_ONLY ---
  // backend/routers/dashboard.py uses only get_current_user — no tab-level gate.
  // These entries represent the FRONTEND visibility rule per D-010:
  //   estProfit / Factory Costs panel → SUPER_ADMIN | ADMIN | FINANCE (hide from OPERATIONS)
  //   Factory Payments section        → SUPER_ADMIN | ADMIN | FINANCE (hide from OPERATIONS)
  // VERIFIED: D-010 decision record (DECISIONS.md § D-010); dashboard.py has no tab gate
  [Resource.DASHBOARD_OPERATIONS_TAB]: [ADMIN, OPERATIONS],  // FRONTEND_ONLY
  [Resource.DASHBOARD_PAYMENTS_TAB]:   [ADMIN, FINANCE],     // FRONTEND_ONLY

  // --- Portal access — FRONTEND_ONLY ---
  // These gate which portal layout is rendered. No single backend endpoint maps to them.
  // CLIENT portal: accessible only by CLIENT role users
  // FACTORY portal: accessible only by FACTORY role users
  // INVENTED (frontend routing concept — no backend counterpart)
  [Resource.CLIENT_PORTAL_ACCESS]:  [CLIENT],   // FRONTEND_ONLY / INVENTED
  [Resource.FACTORY_PORTAL_ACCESS]: [FACTORY],  // FRONTEND_ONLY / INVENTED

  // --- Admin resources ---
  // /api/users:    mounted with Depends(require_admin) = require_role([ADMIN])
  //                + all endpoints also carry Depends(require_role([UserRole.ADMIN]))
  // /api/settings: mounted with Depends(require_admin) = require_role([ADMIN])
  // Effective: ADMIN (SUPER_ADMIN passes via has_any_role bypass)
  // VERIFIED: main.py lines 238-241; users.py lines 62, 90, 106
  [Resource.USER_MANAGEMENT]: [ADMIN],
  [Resource.SYSTEM_SETTINGS]: [ADMIN],

} as const;

/**
 * Convenience: check if a role can access a resource using the matrix.
 * SUPER_ADMIN bypasses all checks.
 *
 * @example
 * canAccess(UserRole.FINANCE, Resource.FACTORY_LEDGER_VIEW) // true
 * canAccess(UserRole.ADMIN,   Resource.FACTORY_LEDGER_VIEW) // false  (D-004: ADMIN excluded)
 * canAccess(UserRole.CLIENT,  Resource.FACTORY_LEDGER_VIEW) // false
 */
export function canAccess(role: UserRole, resource: Resource): boolean {
  if (role === SUPER_ADMIN) return true;
  return PERMISSION_MATRIX[resource].includes(role);
}

/**
 * Return all roles that have access to a given resource (including SUPER_ADMIN).
 */
export function allowedRoles(resource: Resource): readonly UserRole[] {
  const base = PERMISSION_MATRIX[resource];
  if (base.includes(SUPER_ADMIN)) return base;
  return [SUPER_ADMIN, ...base] as const;
}
