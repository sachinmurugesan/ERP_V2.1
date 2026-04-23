"""
D-010 Visibility Tests — OPERATIONS role factory cost field exclusion.

Decision: D-010 RATIFIED 2026-04-22
  OPERATIONS cannot see factory cost or margin fields in the payment summary,
  and cannot access factory payment endpoints.

Architecture note (confirmed during implementation):
  finance.router is mounted with `dependencies=[Depends(require_finance)]` where
  `require_finance = require_role([ADMIN, FINANCE])`.
  `has_any_role()` also has a SUPER_ADMIN bypass (security.py:61-62).
  Therefore OPERATIONS is already blocked at the router level (→ 403) before
  any endpoint handler executes.

  The field-level D-010 patch in list_payments() (finance.py:150-175) is
  defence-in-depth — it activates if OPERATIONS is ever added to require_finance,
  and explicitly documents the exclusion intent at the data layer.

Endpoints under test (correct prefix: /api/finance/):
  GET /api/finance/orders/{order_id}/payments/          — list_payments()
  GET /api/finance/orders/{order_id}/factory-payments/  — require_factory_financial

Verification matrix:
  R1: OPERATIONS → payments summary → 403 (router-level require_finance)
  R2: FINANCE    → payments summary → 200, factory fields present
  R3: ADMIN      → payments summary → 200, factory fields present
  R4: SUPER_ADMIN → payments summary → 200, factory fields present (bypass)
  R5: OPERATIONS → factory-payments list → 403 (require_factory_financial)
  R6: ADMIN      → factory-payments list → 403 (not in require_factory_financial)
  R7: FINANCE    → factory-payments list → 200 (in require_factory_financial)
  R8: SUPER_ADMIN → factory-payments list → 200 (bypass)
  R9: No token   → payments summary → 401
  R10: No token  → factory-payments list → 401
"""
from tests.conftest import auth_header

FACTORY_COST_FIELDS = [
    "original_factory_total_cny",
    "original_factory_total_inr",
    "revised_factory_total_cny",
    "revised_factory_total_inr",
    "factory_paid_inr",
    "revised_factory_balance_inr",
]

ORDER_ID = "order-a-id"
PAYMENT_SUMMARY_URL = f"/api/finance/orders/{ORDER_ID}/payments/"
FACTORY_PAYMENTS_URL = f"/api/finance/orders/{ORDER_ID}/factory-payments/"


def _get_payment_summary(http_client, token):
    headers = auth_header(token) if token else {}
    r = http_client.get(PAYMENT_SUMMARY_URL, headers=headers)
    return r.status_code, r.json() if r.status_code == 200 else {}


class TestOperationsBlockedAtRouterLevel:
    """R1 — OPERATIONS cannot reach list_payments() (require_finance blocks at router level)."""

    def test_ops_payment_summary_returns_403(self, client, ops_token):
        """router-level require_finance = [ADMIN, FINANCE] → OPERATIONS → 403."""
        status, _ = _get_payment_summary(client, ops_token)
        assert status == 403, (
            f"OPERATIONS should get 403 from require_finance router guard, got {status}"
        )


class TestFinanceSeesFactoryCostFields:
    """R2 — FINANCE receives 200 with real factory cost field values."""

    def test_finance_gets_200(self, client, finance_token):
        status, _ = _get_payment_summary(client, finance_token)
        assert status == 200

    def test_finance_factory_fields_are_numeric(self, client, finance_token):
        _, data = _get_payment_summary(client, finance_token)
        summary = data.get("summary", {})
        for field in FACTORY_COST_FIELDS:
            assert field in summary, f"Field '{field}' missing from FINANCE summary"
            assert summary[field] is not None, (
                f"FINANCE should see '{field}' but got null — over-stripping (D-010 only targets OPERATIONS)"
            )
            assert isinstance(summary[field], (int, float)), (
                f"FINANCE '{field}' should be numeric, got {type(summary[field])}"
            )

    def test_finance_client_fields_also_present(self, client, finance_token):
        _, data = _get_payment_summary(client, finance_token)
        summary = data.get("summary", {})
        for field in ("pi_total_inr", "total_paid_inr", "balance_inr", "payment_count"):
            assert field in summary, f"Non-factory field '{field}' missing from FINANCE summary"


class TestAdminSeesFactoryCostFields:
    """R3 — ADMIN receives 200 with real factory cost field values."""

    def test_admin_gets_200(self, client, admin_token):
        status, _ = _get_payment_summary(client, admin_token)
        assert status == 200

    def test_admin_factory_fields_are_numeric(self, client, admin_token):
        _, data = _get_payment_summary(client, admin_token)
        summary = data.get("summary", {})
        for field in FACTORY_COST_FIELDS:
            assert summary.get(field) is not None, (
                f"ADMIN should see '{field}' but got null"
            )


class TestSuperAdminSeesFactoryCostFields:
    """R4 — SUPER_ADMIN bypasses require_finance; gets 200 with factory fields."""

    def test_super_admin_gets_200(self, client, super_admin_token):
        """SUPER_ADMIN has has_any_role() bypass — passes require_finance."""
        status, _ = _get_payment_summary(client, super_admin_token)
        assert status == 200, (
            f"SUPER_ADMIN should bypass require_finance via has_any_role(), got {status}"
        )

    def test_super_admin_factory_fields_are_numeric(self, client, super_admin_token):
        _, data = _get_payment_summary(client, super_admin_token)
        summary = data.get("summary", {})
        for field in FACTORY_COST_FIELDS:
            assert summary.get(field) is not None, (
                f"SUPER_ADMIN should see '{field}' but got null"
            )


class TestFactoryPaymentsAccessControl:
    """R5–R8 — factory-payments endpoint gated by require_factory_financial=[SUPER_ADMIN, FINANCE]."""

    def test_ops_factory_payments_returns_403(self, client, ops_token):
        """R5: OPERATIONS blocked."""
        r = client.get(FACTORY_PAYMENTS_URL, headers=auth_header(ops_token))
        assert r.status_code == 403, (
            f"OPERATIONS should get 403 on factory-payments, got {r.status_code}"
        )

    def test_admin_factory_payments_returns_403(self, client, admin_token):
        """R6: ADMIN not in require_factory_financial — blocked."""
        r = client.get(FACTORY_PAYMENTS_URL, headers=auth_header(admin_token))
        assert r.status_code == 403, (
            f"ADMIN should get 403 on factory-payments (require_factory_financial=[SUPER_ADMIN,FINANCE]), got {r.status_code}"
        )

    def test_finance_factory_payments_allowed(self, client, finance_token):
        """R7: FINANCE in require_factory_financial — allowed."""
        r = client.get(FACTORY_PAYMENTS_URL, headers=auth_header(finance_token))
        assert r.status_code == 200, (
            f"FINANCE should access factory-payments, got {r.status_code}"
        )

    def test_super_admin_factory_payments_allowed(self, client, super_admin_token):
        """R8: SUPER_ADMIN bypass — allowed."""
        r = client.get(FACTORY_PAYMENTS_URL, headers=auth_header(super_admin_token))
        assert r.status_code == 200, (
            f"SUPER_ADMIN should access factory-payments via bypass, got {r.status_code}"
        )


class TestNoTokenBlocked:
    """R9–R10 — Unauthenticated callers get 401."""

    def test_no_token_payments_returns_401(self, client):
        r = client.get(PAYMENT_SUMMARY_URL)
        assert r.status_code == 401

    def test_no_token_factory_payments_returns_401(self, client):
        r = client.get(FACTORY_PAYMENTS_URL)
        assert r.status_code == 401
