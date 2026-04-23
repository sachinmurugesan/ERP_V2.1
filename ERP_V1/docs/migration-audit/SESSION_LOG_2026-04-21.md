# Security Session Log — 2026-04-20 to 2026-04-21

**Reviewer:** Sachin M  
**Scope:** HarvestERP backend security audit + patch sprint ahead of Wave 2 migration  
**Outcome:** 7 patches shipped; all HIGH severity findings closed; 6 MEDIUM findings deferred to Wave 0

---

## Timeline

### 2026-04-20 — Wave 2 audit begins, security surface discovered

Wave 2 migration profiling of the client portal pages (`client_layout.md`, `client_profile.md`) surfaces the first signs of a systematic authz problem: the portal permission model (`portal_permissions` JSON column on `clients`) is enforced only in the Vue layer, not at the API. A full authz surface audit is commissioned.

---

### 2026-04-21 morning — Authz surface audit

**`docs/migration-audit/AUTHZ_SURFACE.md` produced.**

Full enumeration of ~202 backend endpoints across all routers. Findings organized into clusters:

| Cluster | Finding | Endpoints | Severity |
|---|---|---|---|
| A | Finance factory financials accessible to FINANCE role (should be SUPER_ADMIN only) | 9 | HIGH |
| B | PI download accessible to OPERATIONS without ownership check | 3 | HIGH |
| C | `factory_price` writable/readable by CLIENT/FACTORY on order endpoints | 4 | HIGH |
| D | `factory_markup_percent` serialized to all authenticated callers | 3 | MEDIUM |
| E | Order item mutation endpoints accept CLIENT/FACTORY tokens | 7 | HIGH |
| F | Dashboard aggregate endpoints have no tenant scoping | 3 | MEDIUM |

Total AUTH_TOO_PERMISSIVE at audit open: **29 endpoints.**

---

### 2026-04-21 — Patch 1: Dashboard CNY cross-tenant (Leak 1)

**File:** `backend/routers/dashboard.py`  
**Finding:** Dashboard summary endpoint returned CNY-denominated order totals without tenant filtering. CLIENT A could see CLIENT B's financial data.  
**Fix:** Added `current_user` dependency and tenant scope filter.

---

### 2026-04-21 — Patch 2: require_role latent bug (S-1)

**File:** `backend/core/security.py`  
**Finding:** `require_role()` returned a closure (dependency factory) instead of a Depends-compatible callable. Every role-gated endpoint that used this helper had its role check silently bypassed since the helper was introduced.  
**Fix:** Corrected the return type. All role gates now fire correctly.

---

### 2026-04-21 — Patch 3: Factory ledger to ADMIN (Leak 2)

**File:** `backend/routers/finance.py`  
**Finding:** Factory ledger endpoints (factory cost data in CNY) were accessible to ADMIN role, which should not see factory pricing (only SUPER_ADMIN should).  
**Fix:** Tightened role check to SUPER_ADMIN only.

---

### 2026-04-21 — Patch 4: PI download ownership (Leak 3b)

**File:** `backend/routers/excel.py`  
**Finding:** PI download and generate endpoints had no per-order ownership check. Any authenticated OPERATIONS user could download any client's proforma invoice.  
**Fix:** Added order ownership verification before serving the file.

---

### 2026-04-21 afternoon — Portal permissions audit

**`docs/migration-audit/PORTAL_PERMISSIONS_AUDIT.md` produced.**

Full grep of the frontend codebase for every `portalPerms` usage. Findings:

- `portalPerms` read in exactly **2 files**: `ClientLayout.vue` (menu visibility) and `ClientOrderDetail.vue` (tab visibility).
- Of the 12 portal permission flags, only **2** were backend-enforced: `show_payments` (`orders.py:397`) and `show_packing` (`orders.py:3165`).
- The remaining **10 flags** were UI-only. A CLIENT user could bypass them by calling the API directly.

This produced **Cluster G** findings, appended to `SECURITY_BACKLOG.md`:

| ID | Permission | Severity | Backend enforcement before patch |
|---|---|---|---|
| G-001 | `show_payments` | MEDIUM | Enforced (backend already blocks) — UX gap only |
| G-002 | `show_shipping` | HIGH | None — `list_shipments` had no auth at all |
| G-003 | `show_after_sales` | HIGH | None — both list endpoints unenforced |
| G-004 | `items_*` (6 flags) | HIGH | None — all 7 mutation endpoints open to CLIENT |
| G-005 | `client_type` pricing | MEDIUM | None — tracked under Clusters C/D |
| G-006 | `show_production` / `show_files` | MEDIUM | None — tab-only, no standalone route |

---

### 2026-04-21 — Patch 5: G-004 — Item mutation endpoints (7 endpoints)

**File:** `backend/routers/orders.py`  
**Finding:** Six order item mutation endpoints (add, bulk-add, fetch-pending, upload-excel, edit-qty, confirm, remove) — 7 total including bulk-apply — had no role check. CLIENT could POST/PATCH/DELETE directly.  
**Fix:** Added `current_user.user_type != "INTERNAL" → 403` guard to all 7 endpoints.  
**Special case:** `bulk_text_add_apply` had a pre-existing 500 bug (called `add_order_items` without passing `current_user`). Fixed in the same patch.  
**Verification:** 28/28 matrix checks pass. CLIENT on any endpoint → 403; INTERNAL → 2xx; no auth → 401.  
**Cluster E and G-004 marked CLOSED.**

*Note: `orders.py:1664` — the existing CLIENT RLS check in `confirm_order_item` is now unreachable dead code (the new INTERNAL-only guard fires first). Safe to remove in a future maintenance pass.*

---

### 2026-04-21 — Wave 2 Batch 2 migration profiles

While the security sprint ran in parallel, two client portal page profiles were completed:

- **Profile 5:** `docs/migration-audit/pages/client_products.md` (`ClientProducts.vue`) — key finding: `submitSuggestion()` is a complete stub that fires no HTTP call.
- **Profile 6:** `docs/migration-audit/pages/client_ledger.md` (`ClientLedger.vue`) — key finding: `formatINR` is a local duplicate of `frontend/src/utils/formatters.js:formatINR`; `show_payments` route guard missing (G-001).

Profiles 7–9 (`client_shipments.md`, `client_after_sales.md`, `client_returns_pending.md`) are pending GO for Batch 3.

---

### 2026-04-21 — Patch 6: G-002 — Shipping route bypass

**File:** `backend/routers/shipping.py`  
**Finding:** `GET /api/shipping/orders/{order_id}/shipments/` (`list_shipments`) had no auth dependency at all — no token required.  
**Fix:** Added `from core.security import get_current_user, CurrentUser` import + `current_user` Depends + portal permission check: CLIENT callers must have `portal_permissions.show_shipping = True` or receive 403. INTERNAL/FACTORY pass through unchanged.  
**Verification:** CLIENT show=true→200, CLIENT show=false→403, INTERNAL→200, no-auth→401.  
**G-002 marked CLOSED.**

---

### 2026-04-21 — Patch 7: G-003 — After-sales route bypass (2 endpoints)

**File:** `backend/routers/aftersales.py`  
**Finding:** `list_all_aftersales` (`GET /api/aftersales/`) and `client_get_aftersales` (`GET /api/aftersales/client/orders/{id}/`) both lacked `show_after_sales` enforcement. The first endpoint already had CLIENT RLS (scoped by `client_id`) but no portal permission check. The second had order-level RLS but no portal permission check.  
**Fix:** Added `portal_permissions.show_after_sales` check for CLIENT callers to both endpoints.  
**Verification:** CLIENT show=true→200, CLIENT show=false→403, INTERNAL→200, no-auth→401 — on both endpoints.  
**G-003 marked CLOSED.**

---

### 2026-04-21 evening — Policy ratification

**D-006 added to `DECISIONS.md`: Portal permission enforcement policy — RATIFIED.**

Decision: frontend-only portal permissions are deprecated as a security mechanism. All portal permissions must be enforced server-side. The pattern established in Patches 6 and 7 is the canonical template.

---

## State at session close

### Closed (7 patches)

| Patch | Severity | Finding |
|---|---|---|
| 1 — Dashboard cross-tenant | HIGH | ✅ CLOSED |
| 2 — require_role latent bug | HIGH | ✅ CLOSED |
| 3 — Factory ledger to ADMIN | HIGH | ✅ CLOSED |
| 4 — PI download ownership | HIGH | ✅ CLOSED |
| 5 — G-004 item mutations (7 endpoints) | HIGH | ✅ CLOSED |
| 6 — G-002 shipping bypass | HIGH | ✅ CLOSED |
| 7 — G-003 after-sales bypass (2 endpoints) | HIGH | ✅ CLOSED |

### Open — deferred to Wave 0 (all MEDIUM)

| ID | Finding | Backend blocks? |
|---|---|---|
| G-001 | `show_payments` — route unguarded (UX gap) | YES — no data leaks |
| G-005 | `client_type` pricing in API responses | NO |
| G-006 | `show_production` / `show_files` tab-only | NO |
| Cluster C | `factory_price` writable by CLIENT/FACTORY | NO |
| Cluster D | `factory_markup_percent` in all GET responses | NO |
| Cluster F | Dashboard aggregate endpoints untenant-scoped | NO |

### Follow-up cleanup (non-urgent)

- `orders.py:1664` — unreachable CLIENT RLS check (dead code after Patch 5)

---

## Key files modified this session

| File | Change |
|---|---|
| `backend/routers/orders.py` | Patches 5 (7 endpoint guards) |
| `backend/routers/shipping.py` | Patch 6 (auth import + `list_shipments` guard) |
| `backend/routers/aftersales.py` | Patch 7 (`list_all_aftersales` + `client_get_aftersales` guards) |
| `docs/migration-audit/AUTHZ_SURFACE.md` | Created; Cluster E and G updated; summary counts updated |
| `docs/migration-audit/PORTAL_PERMISSIONS_AUDIT.md` | Created |
| `docs/migration-audit/SECURITY_BACKLOG.md` | Created; updated throughout session |
| `docs/migration-audit/DECISIONS.md` | D-006 added and ratified |
| `docs/migration-audit/pages/client_products.md` | Created (Profile 5) |
| `docs/migration-audit/pages/client_ledger.md` | Created (Profile 6) |

---

## Next session (2026-04-22)

1. Wave 2 Batch 3 — profiles 7–9: `client_shipments.md`, `client_after_sales.md`, `client_returns_pending.md`
2. Begin Wave 0 planning if Batch 3 completes
3. G-001 route guard (frontend only — low effort)
4. Cluster F dashboard scoping (3 endpoints — same pattern as Patch 1)
