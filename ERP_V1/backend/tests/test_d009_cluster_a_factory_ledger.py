"""
D-009 / Cluster A — Factory ledger and factory-cost endpoint role gating.

Background
----------
The /api/finance router is mounted with `require_finance` (router-level dep).
Nine factory-cost endpoints additionally carry `require_factory_financial`
(endpoint-level dep).  D-009 required that SUPER_ADMIN access be *explicit*,
not reliant solely on the `has_any_role()` SUPER_ADMIN bypass.

Fix (Patch 18, 2026-04-22)
---------------------------
`require_finance` widened from `[ADMIN, FINANCE]` to
`[SUPER_ADMIN, ADMIN, FINANCE]` in `core/security.py`.
Effective access for all 9 Cluster A endpoints remains SUPER_ADMIN|FINANCE
because the endpoint-level `require_factory_financial = require_role([SUPER_ADMIN,
FINANCE])` still blocks ADMIN — widening the router dep only makes SUPER_ADMIN
explicit at that layer.

Verification matrix (7 roles × factory-ledger read = 7 cells minimum)
-----------------------------------------------------------------------
Role          Router dep       Endpoint dep        Expected
SUPER_ADMIN   explicit PASS    explicit PASS       200 / 404-if-no-factory
ADMIN         explicit PASS    BLOCK               403
FINANCE       explicit PASS    explicit PASS       200 / 404-if-no-factory
OPERATIONS    BLOCK            (never reached)     403
CLIENT        BLOCK            (never reached)     403
FACTORY       BLOCK            (never reached)     403
No auth       401              (never reached)     401

Note on 200 vs 404: endpoints that need a factory_id path param will return
404 when no matching factory exists in the test DB. For auth-surface testing
this is correct — 404 proves the request passed both auth layers; 403 proves
it was blocked by a role check.  The suite accepts either 200 or 404 for
roles that should have access.
"""
import pytest
from tests.conftest import auth_header

# Use a sentinel factory/order ID — any non-existent UUID is fine; we only
# care about 401/403 vs 200/404.
FAKE_FACTORY_ID = "00000000-0000-0000-0000-000000000001"
FAKE_ORDER_ID   = "00000000-0000-0000-0000-000000000002"
FAKE_PAYMENT_ID = "00000000-0000-0000-0000-000000000003"

LEDGER_URL   = f"/api/finance/factory-ledger/{FAKE_FACTORY_ID}/"
DOWNLOAD_URL = f"/api/finance/factory-ledger/{FAKE_FACTORY_ID}/download/"
FACTORY_PAYMENTS_URL   = f"/api/finance/orders/{FAKE_ORDER_ID}/factory-payments/"
FACTORY_PAYMENT_ID_URL = f"/api/finance/orders/{FAKE_ORDER_ID}/factory-payments/{FAKE_PAYMENT_ID}/"
AUDIT_LOG_URL    = f"/api/finance/orders/{FAKE_ORDER_ID}/payment-audit-log/"
CREDITS_URL      = f"/api/finance/factories/{FAKE_FACTORY_ID}/credits/"
APPLY_CREDIT_URL = f"/api/finance/orders/{FAKE_ORDER_ID}/apply-factory-credit/"

# Roles that should be permitted (200 or 404 — auth passes, data may be missing)
PERMITTED = (200, 404)


# ---------------------------------------------------------------------------
# Factory ledger read — the primary Cluster A endpoint
# ---------------------------------------------------------------------------

class TestFactoryLedgerRoleGating:
    """D-009: GET /api/finance/factory-ledger/{id}/ role matrix."""

    def test_super_admin_can_access_factory_ledger(self, client, super_admin_token):
        """SUPER_ADMIN must not receive 403 (auth passes, 404 if no factory)."""
        r = client.get(LEDGER_URL, headers=auth_header(super_admin_token))
        assert r.status_code in PERMITTED, (
            f"D-009: SUPER_ADMIN blocked from factory-ledger — got {r.status_code}"
        )

    def test_finance_can_access_factory_ledger(self, client, finance_token):
        """FINANCE must not receive 403."""
        r = client.get(LEDGER_URL, headers=auth_header(finance_token))
        assert r.status_code in PERMITTED, (
            f"FINANCE blocked from factory-ledger — got {r.status_code}"
        )

    def test_admin_cannot_access_factory_ledger(self, client, admin_token):
        """ADMIN must receive 403 — excluded by endpoint-level require_factory_financial."""
        r = client.get(LEDGER_URL, headers=auth_header(admin_token))
        assert r.status_code == 403, (
            f"D-009: ADMIN should be blocked from factory-ledger, got {r.status_code}"
        )

    def test_operations_cannot_access_factory_ledger(self, client, ops_token):
        """OPERATIONS must receive 403 — excluded by router-level require_finance."""
        r = client.get(LEDGER_URL, headers=auth_header(ops_token))
        assert r.status_code == 403, (
            f"OPERATIONS should be blocked, got {r.status_code}"
        )

    def test_client_cannot_access_factory_ledger(self, client, client_token_a):
        """CLIENT must receive 403."""
        r = client.get(LEDGER_URL, headers=auth_header(client_token_a))
        assert r.status_code == 403, (
            f"CLIENT should be blocked, got {r.status_code}"
        )

    def test_factory_cannot_access_factory_ledger(self, client, factory_token_x):
        """FACTORY must receive 403."""
        r = client.get(LEDGER_URL, headers=auth_header(factory_token_x))
        assert r.status_code == 403, (
            f"FACTORY should be blocked, got {r.status_code}"
        )

    def test_no_auth_cannot_access_factory_ledger(self, client):
        """Unauthenticated request must receive 401."""
        r = client.get(LEDGER_URL)
        assert r.status_code == 401, (
            f"Unauthenticated should get 401, got {r.status_code}"
        )


# ---------------------------------------------------------------------------
# Factory ledger download
# ---------------------------------------------------------------------------

class TestFactoryLedgerDownloadRoleGating:
    """D-009: GET /api/finance/factory-ledger/{id}/download/ role matrix."""

    def test_super_admin_can_access_download(self, client, super_admin_token):
        r = client.get(DOWNLOAD_URL, headers=auth_header(super_admin_token))
        assert r.status_code in PERMITTED, (
            f"D-009: SUPER_ADMIN blocked from ledger download — got {r.status_code}"
        )

    def test_finance_can_access_download(self, client, finance_token):
        r = client.get(DOWNLOAD_URL, headers=auth_header(finance_token))
        assert r.status_code in PERMITTED

    def test_admin_cannot_access_download(self, client, admin_token):
        r = client.get(DOWNLOAD_URL, headers=auth_header(admin_token))
        assert r.status_code == 403

    def test_operations_cannot_access_download(self, client, ops_token):
        r = client.get(DOWNLOAD_URL, headers=auth_header(ops_token))
        assert r.status_code == 403

    def test_no_auth_cannot_access_download(self, client):
        r = client.get(DOWNLOAD_URL)
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Factory payments list
# ---------------------------------------------------------------------------

class TestFactoryPaymentsListRoleGating:
    """D-009: GET /api/finance/orders/{id}/factory-payments/ role matrix."""

    def test_super_admin_can_access_factory_payments(self, client, super_admin_token):
        r = client.get(FACTORY_PAYMENTS_URL, headers=auth_header(super_admin_token))
        assert r.status_code in PERMITTED, (
            f"D-009: SUPER_ADMIN blocked from factory-payments — got {r.status_code}"
        )

    def test_finance_can_access_factory_payments(self, client, finance_token):
        r = client.get(FACTORY_PAYMENTS_URL, headers=auth_header(finance_token))
        assert r.status_code in PERMITTED

    def test_admin_cannot_access_factory_payments(self, client, admin_token):
        r = client.get(FACTORY_PAYMENTS_URL, headers=auth_header(admin_token))
        assert r.status_code == 403

    def test_operations_cannot_access_factory_payments(self, client, ops_token):
        r = client.get(FACTORY_PAYMENTS_URL, headers=auth_header(ops_token))
        assert r.status_code == 403

    def test_no_auth_cannot_access_factory_payments(self, client):
        r = client.get(FACTORY_PAYMENTS_URL)
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Factory credits list
# ---------------------------------------------------------------------------

class TestFactoryCreditsRoleGating:
    """D-009: GET /api/finance/factories/{id}/credits/ role matrix."""

    def test_super_admin_can_access_factory_credits(self, client, super_admin_token):
        r = client.get(CREDITS_URL, headers=auth_header(super_admin_token))
        assert r.status_code in PERMITTED, (
            f"D-009: SUPER_ADMIN blocked from factory-credits — got {r.status_code}"
        )

    def test_finance_can_access_factory_credits(self, client, finance_token):
        r = client.get(CREDITS_URL, headers=auth_header(finance_token))
        assert r.status_code in PERMITTED

    def test_admin_cannot_access_factory_credits(self, client, admin_token):
        r = client.get(CREDITS_URL, headers=auth_header(admin_token))
        assert r.status_code == 403

    def test_operations_cannot_access_factory_credits(self, client, ops_token):
        r = client.get(CREDITS_URL, headers=auth_header(ops_token))
        assert r.status_code == 403

    def test_no_auth_cannot_access_factory_credits(self, client):
        r = client.get(CREDITS_URL)
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Payment audit log
# ---------------------------------------------------------------------------

class TestPaymentAuditLogRoleGating:
    """D-009: GET /api/finance/orders/{id}/payment-audit-log/ role matrix."""

    def test_super_admin_can_access_audit_log(self, client, super_admin_token):
        r = client.get(AUDIT_LOG_URL, headers=auth_header(super_admin_token))
        assert r.status_code in PERMITTED, (
            f"D-009: SUPER_ADMIN blocked from payment-audit-log — got {r.status_code}"
        )

    def test_finance_can_access_audit_log(self, client, finance_token):
        r = client.get(AUDIT_LOG_URL, headers=auth_header(finance_token))
        assert r.status_code in PERMITTED

    def test_admin_cannot_access_audit_log(self, client, admin_token):
        r = client.get(AUDIT_LOG_URL, headers=auth_header(admin_token))
        assert r.status_code == 403

    def test_operations_cannot_access_audit_log(self, client, ops_token):
        r = client.get(AUDIT_LOG_URL, headers=auth_header(ops_token))
        assert r.status_code == 403

    def test_no_auth_cannot_access_audit_log(self, client):
        r = client.get(AUDIT_LOG_URL)
        assert r.status_code == 401
