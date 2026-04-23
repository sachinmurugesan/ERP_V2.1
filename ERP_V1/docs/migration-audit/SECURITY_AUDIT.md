# HarvestERP — Backend Security Audit (D-004)

**Date:** 2026-04-21
**Scope:** Every FastAPI endpoint under `backend/routers/*` that returns factory pricing, factory margins, supplier costs in CNY, raw-INR (pre-markup), or margin/profit/markup fields.
**Baseline:** Permission matrix proposed in [DECISIONS.md § D-004](./DECISIONS.md#d-004--super_admin-role-consistency-production-data-exposure--highest-priority).
**Method:** Static analysis only — matched router files against the permission matrix. Runtime testing not performed.
**Limitation:** "Current role check" reflects what is nominally declared. See the three systemic findings below — two of them invalidate many of the OK-looking declarations.

---

## Three systemic findings (read first — they drive most LEAKs)

### S-1. `require_role` silently grants ADMIN access to every dependency — including `require_super_admin`
[`backend/core/security.py:238-249`](../../backend/core/security.py#L238)
```python
def require_role(allowed_roles: List[str]):
    async def _check_role(current_user: CurrentUser = Depends(get_current_user)):
        if UserRole.ADMIN in current_user.roles:
            return None   # ← hard-coded ADMIN bypass
        if not current_user.has_any_role(allowed_roles):
            raise HTTPException(status_code=403, ...)
```
Every dependency built on `require_role` (including the `require_super_admin` convenience helper at line 253) returns success for an ADMIN token. **`require_super_admin` does not actually require SUPER_ADMIN.** Secondary bypass: `CurrentUser.has_any_role()` also returns True for both ADMIN and SUPER_ADMIN.

**Impact:** Every LEAK-classified row in the table below stems in part from this single function. Even if we later mark endpoints as "require SUPER_ADMIN", they would remain permissive until this function is fixed.

### S-2. `filter_for_role` treats SUPER_ADMIN, ADMIN, FINANCE, OPERATIONS identically
[`backend/core/serializers.py:85-96`](../../backend/core/serializers.py#L85)
```python
if role in ("SUPER_ADMIN", "ADMIN", "FINANCE", "OPERATIONS"):
    return data   # no stripping at all
```
Any endpoint that relies on `filter_for_role` for field-level stripping assumes all four internal roles are equivalent. The hidden-field sets (`CLIENT_HIDDEN_FIELDS`, `FACTORY_HIDDEN_FIELDS`) only apply to CLIENT / FACTORY tokens. **`factory_price`, `markup_percent`, `selling_price_inr`, `client_factory_price` are all returned to ADMIN/FINANCE/OPERATIONS unchanged** for regular (non-transparency) clients.

### S-3. `mask_transparency_pricing` is only applied on ONE endpoint
[`backend/core/transparency.py`](../../backend/core/transparency.py) is the only code path that distinguishes SUPER_ADMIN from ADMIN. Grep of routers shows exactly one call site: [`backend/routers/orders.py:664`](../../backend/routers/orders.py#L664) inside `get_order`. Every other endpoint that returns pricing — `list_orders`, `/dashboard/recent-orders`, `/dashboard/active-shipments`, the `/landed-cost/`, `/factory-ledger/`, `/factory-payments/`, PI downloads, reconciliation — **does not apply the transparency mask**. For TRANSPARENCY clients, ADMIN can read real `factory_price` by hitting any endpoint except `GET /api/orders/{id}/`.

---

## Findings table

| # | Endpoint | Method | File:Line | Current role check | Should require | Status |
|---|----------|--------|-----------|--------------------|----------------|--------|
|  1 | `/api/orders/` | GET | [`routers/orders.py:312`](../../backend/routers/orders.py#L312) | Router: `get_current_user`; endpoint: `get_current_user`; stripping via `filter_list_for_role` which is a no-op for 4 internal roles (S-2) | `view_factory_real_pricing` (SUPER_ADMIN) to see `factory_price`; `view_selling_pricing` for the rest | **LEAK** (ADMIN/FINANCE/OPERATIONS see real `factory_price` and `markup_percent` on regular clients) |
|  2 | `/api/orders/{order_id}/` | GET | [`routers/orders.py:643`](../../backend/routers/orders.py#L643) | Router: `get_current_user`; endpoint: `get_current_user`; applies `mask_transparency_pricing` + `filter_for_role` | `view_factory_real_pricing` (SUPER_ADMIN) | **LEAK** (transparency mask is fine for TRANSPARENCY clients, but for REGULAR clients ADMIN/FINANCE/OPERATIONS still see real `factory_price` — no mask applies) |
|  3 | `/api/orders/reconciliation/{order_id}/` | GET | [`routers/orders.py:492`](../../backend/routers/orders.py#L492) | `get_current_user`; uses `selling_price_inr` / `client_factory_price` — does **not** surface real `factory_price` | `view_selling_pricing` | **OK** (returns client-view totals only; no raw `factory_price` in response shape) |
|  4 | `/api/orders/{order_id}/download-pi/` | GET | [`routers/orders.py:4316`](../../backend/routers/orders.py#L4316) | `get_current_user` + `_get_order_for_pi` ownership check; **file served as-is** with full pricing columns | `view_factory_quoted_pricing` (SUPER_ADMIN + ADMIN) for internal; CLIENT for own PI | **LEAK** (FINANCE/OPERATIONS can download any PI containing `factory_price` on REGULAR clients; the Excel file is not stripped per-role) |
|  5 | `/api/orders/{order_id}/download-pi-with-images/` | GET | [`routers/orders.py:4336`](../../backend/routers/orders.py#L4336) | same as #4 — delegates to `excel.download_pi_with_images` with no role filter | same as #4 | **LEAK** |
|  6 | `/api/excel/download-pi/{order_id}/` | GET | [`routers/excel.py:602`](../../backend/routers/excel.py#L602) | Router: `require_operations` (ADMIN + OPERATIONS + SUPER_ADMIN via bypass); **endpoint has no `current_user` param — no ownership check at all** | `view_factory_quoted_pricing` + per-order ownership | **LEAK** (OPERATIONS can download PIs containing `factory_price`; no per-order scoping — any order's PI is readable) |
|  7 | `/api/excel/download-pi-with-images/{order_id}/` | GET | [`routers/excel.py:618`](../../backend/routers/excel.py#L618) | same as #6 | same as #6 | **LEAK** |
|  8 | `/api/excel/generate-pi/{order_id}/` | POST | [`routers/excel.py:457`](../../backend/routers/excel.py#L457) | Router: `require_operations`; response includes factory pricing fields | `view_factory_quoted_pricing` | **LEAK** (OPERATIONS sees factory pricing in response body) |
|  9 | `/api/orders/{order_id}/landed-cost/` | GET | [`routers/landed_cost.py:44`](../../backend/routers/landed_cost.py#L44) | Inline allowlist `{"SUPER_ADMIN","ADMIN","FINANCE"}` + CLIENT scoped by own `client_id`; uses `client_factory_price` (quoted, not real) | `view_factory_quoted_pricing` (SUPER_ADMIN + ADMIN) + CLIENT for own | **LEAK** (FINANCE is in the inline allowlist but not in the matrix for `view_factory_quoted_pricing`) |
| 10 | `/api/orders/{order_id}/landed-cost/download/` | GET | [`routers/landed_cost.py:219`](../../backend/routers/landed_cost.py#L219) | same as #9 | same as #9 | **LEAK** |
| 11 | `/api/orders/{order_id}/copy-previous-prices/` | POST | [`routers/orders.py:2142`](../../backend/routers/orders.py#L2142) | `get_current_user`; copies `factory_price`/`markup_percent`/`selling_price_inr` from a prior order and returns them | `view_factory_real_pricing` (writes real prices into a new order) | **LEAK** (FINANCE/OPERATIONS can trigger + read the copied real `factory_price` in response) |
| 12 | `/api/orders/{order_id}/recalculate-prices/` | POST | [`routers/orders.py:2059`](../../backend/routers/orders.py#L2059) | `get_current_user`; response shape includes updated pricing | `view_factory_real_pricing` for the response | **LEAK** |
| 13 | `/api/orders/{order_id}/items/{item_id}/prices/` | PUT | [`routers/orders.py:1998`](../../backend/routers/orders.py#L1998) | `get_current_user`; accepts + echoes `factory_price` / `markup_percent` / `selling_price_inr` | `view_factory_real_pricing` (write + read) | **LEAK** |
| 14 | `/api/orders/{order_id}/parse-price-excel/` | POST | [`routers/orders.py:2290`](../../backend/routers/orders.py#L2290) | `get_current_user`; returns parsed `factory_price` rows | `view_factory_real_pricing` | **LEAK** |
| 15 | `/api/finance/orders/{order_id}/factory-payments/` | GET | [`routers/finance.py:724`](../../backend/routers/finance.py#L724) | Router: `require_finance` (ADMIN + FINANCE + SUPER_ADMIN via S-1); response in CNY/USD | `view_factory_ledger` (SUPER_ADMIN + FINANCE — **ADMIN excluded** per matrix) | **LEAK** (ADMIN gets factory-side CNY payments) |
| 16 | `/api/finance/orders/{order_id}/factory-payments/` | POST | [`routers/finance.py:804`](../../backend/routers/finance.py#L804) | same as #15; response echoes amount_cny | same as #15 | **LEAK** |
| 17 | `/api/finance/factory-ledger/{factory_id}/` | GET | [`routers/finance.py:1475`](../../backend/routers/finance.py#L1475) | Router: `require_finance`; endpoint has **no `current_user` parameter** — relies purely on router auth; returns per-order CNY totals computed from `factory_price * qty` | `view_factory_ledger` (SUPER_ADMIN + FINANCE) | **LEAK** (ADMIN sees every factory's CNY obligations + real `factory_price` aggregates) |
| 18 | `/api/finance/factory-ledger/{factory_id}/download/` | GET | [`routers/finance.py:1834`](../../backend/routers/finance.py#L1834) | same as #17 | same as #17 | **LEAK** |
| 19 | `/api/finance/factories/{factory_id}/credits/` | GET | [`routers/finance.py:1384`](../../backend/routers/finance.py#L1384) | Router: `require_finance`; no current_user param; returns credit amounts in factory currency | `view_factory_ledger` | **LEAK** |
| 20 | `/api/finance/orders/{order_id}/apply-factory-credit/` | POST | [`routers/finance.py:1410`](../../backend/routers/finance.py#L1410) | Router: `require_finance`; response includes factory-side amount_cny | `view_factory_ledger` | **LEAK** |
| 21 | `/api/finance/orders/{order_id}/payment-audit-log/` | GET | [`routers/finance.py:952`](../../backend/routers/finance.py#L952) | Router: `require_finance`; before/after JSON snapshots include factory payment amounts | `view_factory_ledger` | **LEAK** |
| 22 | `/api/finance/orders/{order_id}/pi-history/` | GET | [`routers/finance.py:982`](../../backend/routers/finance.py#L982) | Router: `require_finance`; returns revised PI totals derived from `factory_price` × `markup_percent` | `view_factory_quoted_pricing` (SUPER_ADMIN + ADMIN) | **OK** (returns INR totals only; does not leak factory_price directly — but confirm during Day 3 audit) |
| 23 | `/api/finance/orders/{order_id}/payments/` | GET | [`routers/finance.py:46`](../../backend/routers/finance.py#L46) | Router: `require_finance`; client-side INR payments | `view_finance` (SUPER_ADMIN + ADMIN + FINANCE) | **OK** |
| 24 | `/api/finance/client-ledger/{client_id}/` | GET | [`routers/finance.py:1253`](../../backend/routers/finance.py#L1253) | Router: `require_finance`; endpoint has **no current_user param** — relies on router auth + no per-tenant check beyond `client_id` in path | `view_client_ledger` (SUPER_ADMIN + ADMIN + FINANCE) | **OK** (matches matrix; note: still missing ownership check so FINANCE/ADMIN can pull any client — see Top-3 below) |
| 25 | `/api/finance/client-ledger/{client_id}/download/` | GET | [`routers/finance.py:1619`](../../backend/routers/finance.py#L1619) | same as #24 | same as #24 | **OK** |
| 26 | `/api/finance/receivables/` | GET | [`routers/finance.py:1163`](../../backend/routers/finance.py#L1163) | Router: `require_finance`; INR only | `view_finance` | **OK** |
| 27 | `/api/finance/exchange-rates/` | GET | [`routers/finance.py:1029`](../../backend/routers/finance.py#L1029) | Router: `require_finance`; rates only | `view_finance` | **OK** |
| 28 | `/api/dashboard/summary/` | GET | [`routers/dashboard.py:24`](../../backend/routers/dashboard.py#L24) | Router: `get_current_user`; endpoint has **no current_user param**; returns order counts across ALL tenants (no pricing) | `view_selling_pricing` or broader (read-only counts) | **OK** (no pricing fields; but cross-tenant count exposure is a separate concern) |
| 29 | `/api/dashboard/recent-orders/` | GET | [`routers/dashboard.py:67`](../../backend/routers/dashboard.py#L67) | Router: `get_current_user`; endpoint has **no current_user param**; returns `total_value_cny` computed from `factory_price × quantity` | `view_supplier_chinese_yuan_pricing` (SUPER_ADMIN only) | **LEAK** (any authenticated user — including CLIENT and FACTORY — can read cross-tenant CNY totals) |
| 30 | `/api/dashboard/active-shipments/` | GET | [`routers/dashboard.py:96`](../../backend/routers/dashboard.py#L96) | same as #29; returns `total_value_cny` per active order | same as #29 | **LEAK** |
| 31 | `/api/dashboard/client-inquiries/` | GET | [`routers/dashboard.py:132`](../../backend/routers/dashboard.py#L132) | same; returns inquiry metadata (no pricing) | `view_selling_pricing` | **OK** (no pricing; admin-queue metadata) |
| 32 | `/api/dashboard/recent-activity/` | GET | [`routers/dashboard.py:161`](../../backend/routers/dashboard.py#L161) | same; returns stage transitions (no pricing) | any internal | **OK** |
| 33 | `/api/clients/{client_id}/` | GET | [`routers/clients.py:72`](../../backend/routers/clients.py#L72) | Router: `get_current_user`; returns `ClientResponse` which includes `factory_markup_percent` ([`schemas/clients.py:67`](../../backend/schemas/clients.py#L67)) | `view_factory_quoted_pricing` (SUPER_ADMIN + ADMIN) — markup is a pricing primitive | **LEAK** (any authenticated user — including CLIENT and FACTORY — can GET a client record and read `factory_markup_percent`) |
| 34 | `/api/clients/` | GET | [`routers/clients.py:22`](../../backend/routers/clients.py#L22) | Router: `get_current_user`; returns list of `ClientResponse` | same as #33 | **LEAK** |
| 35 | `/api/settings/markups/` | GET | [`routers/settings.py`](../../backend/routers/settings.py) | Router: `require_admin` (ADMIN + SUPER_ADMIN via bypass); returns per-category default markups | `manage_system_settings` + `view_factory_quoted_pricing` | **OK** (matches matrix as written — ADMIN + SUPER_ADMIN) |
| 36 | `/api/orders/{order_id}/items/send-prices/` | POST | [`routers/orders.py:1811`](../../backend/routers/orders.py#L1811) | `get_current_user`; sends pending prices to client — response body echoes selling prices | `view_selling_pricing` | **OK** (selling prices only, not factory) |
| 37 | `/api/orders/{order_id}/reset-aftersales-prices/` | POST | [`routers/orders.py:2246`](../../backend/routers/orders.py#L2246) | `get_current_user`; response echoes recomputed selling prices | `view_selling_pricing` | **OK** |

---

## Summary

- **Total endpoints audited:** 37 (all pricing/margin/CNY surfaces located in routers)
- **LEAK:** 19
- **MISSING:** 0 (nominally — every endpoint has *some* auth; see Top-3 for the "missing ownership check" pattern, which is a different hazard)
- **OK:** 18

### Top 3 highest-risk leaks

1. **Dashboard endpoints leak cross-tenant CNY totals to every authenticated user (#29, #30).**
Any CLIENT or FACTORY token can call `/api/dashboard/recent-orders/` or `/api/dashboard/active-shipments/` and read `total_value_cny` — i.e. factory-side CNY cost aggregated across all tenants. Router dependency is `get_current_user` only, endpoint functions have no `current_user` parameter, no role filter, no tenant scope. This is not just an ADMIN-vs-SUPER_ADMIN issue — it exposes CNY data to external users (CLIENT, FACTORY). If these tokens ever leak or a client curl-ferrets around, the blast radius is the entire supplier cost book.

2. **Factory ledger + factory payments expose CNY obligations to ADMIN (#15–#21).**
`require_finance` lets ADMIN through (allowlist includes ADMIN, and S-1 bypass makes it unconditional). The matrix in D-004 deliberately excludes ADMIN from `view_factory_ledger` (ADMIN gets quoted pricing, not real factory costs). Five endpoints in the `/api/finance/factor*` family all share this posture. Combined with S-3 (no transparency mask on these routes), ADMIN can read both the real `factory_price × qty` totals and the actual CNY amounts paid out to factories.

3. **PI downloads (#4–#7) serve the raw Excel file with no per-role field stripping.**
The generated PI Excel contains `factory_price`, `markup_percent`, and `selling_price_inr` in columns consumed by downstream admin flows. Four endpoints across `routers/orders.py` and `routers/excel.py` stream the file as-is. OPERATIONS + ADMIN + FINANCE + SUPER_ADMIN (plus CLIENT via the orders-scoped variant's ownership check) can all download — but there is no role-aware regeneration that strips `factory_price` for roles that should not see it. Compounding this, `routers/excel.py:602` and `:618` have no `current_user` parameter at all, so **there is no per-order ownership check for those two endpoints** — any OPERATIONS user can download any client's PI.

### Secondary observations (not in LEAK count, logged for Day 2)

- **Missing `current_user` parameter pattern.** Endpoints `routers/dashboard.py:24, 67, 96, 132, 161`, `routers/finance.py:1029, 1044, 1253, 1384, 1475, 1619, 1834`, and `routers/excel.py:602, 618` omit `current_user` from the function signature. Router-level `Depends(...)` ensures the token is validated but no per-request user-scoped check runs inside the function. This is orthogonal to the SUPER_ADMIN problem but compounds it — even if we fix `require_role`, these endpoints remain unable to enforce per-tenant or per-order ownership.
- **`require_super_admin` is defined but unused.** Grep of `backend/routers/` returns zero usages. Even if `require_role` were fixed, no endpoint currently opts into SUPER_ADMIN-only protection.
- **Transparency mask is not applied on list, download, reconciliation, or dashboard endpoints.** For transparency clients, real `factory_price` leaks via every pricing endpoint except `GET /api/orders/{id}/`. The mask lives in one file ([`core/transparency.py`](../../backend/core/transparency.py)) and is invoked in exactly one call site ([`orders.py:664`](../../backend/routers/orders.py#L664)).

---

**End of audit.** Per request, no fixes are proposed in this document. Remediation plan belongs in the Day 2 action for D-004-A1 (backend hotfix) — authored only after this audit is reviewed and the permission matrix in D-004 is signed off.
