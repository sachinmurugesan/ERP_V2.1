"""
RBAC Matrix Tests.

Verifies that role-based access control correctly blocks unauthorized
access to protected endpoints.

Attack vectors tested:
  - CLIENT accessing admin-only endpoints (users, settings, audit)
  - FACTORY accessing admin-only endpoints
  - CLIENT accessing finance endpoints
  - FACTORY accessing finance endpoints
  - All roles accessing their authorized endpoints (positive tests)
"""
from tests.conftest import auth_header


# ===================================================================
# 1. Admin-Only Endpoints: /api/users/
# ===================================================================

class TestUsersEndpointRBAC:
    """Only ADMIN can access /api/users/."""

    def test_admin_can_list_users(self, client, admin_token):
        r = client.get("/api/users/", headers=auth_header(admin_token))
        assert r.status_code == 200

    def test_client_blocked_from_users(self, client, client_token_a):
        r = client.get("/api/users/", headers=auth_header(client_token_a))
        assert r.status_code == 403

    def test_factory_blocked_from_users(self, client, factory_token_x):
        r = client.get("/api/users/", headers=auth_header(factory_token_x))
        assert r.status_code == 403

    def test_finance_blocked_from_users(self, client, finance_token):
        r = client.get("/api/users/", headers=auth_header(finance_token))
        assert r.status_code == 403

    def test_ops_blocked_from_users(self, client, ops_token):
        r = client.get("/api/users/", headers=auth_header(ops_token))
        assert r.status_code == 403


# ===================================================================
# 2. Admin-Only Endpoints: /api/settings/
# ===================================================================

class TestSettingsEndpointRBAC:
    """Only ADMIN can access /api/settings/."""

    def test_admin_can_access_settings(self, client, admin_token):
        r = client.get("/api/settings/exchange-rates/", headers=auth_header(admin_token))
        assert r.status_code == 200

    def test_client_blocked_from_settings(self, client, client_token_a):
        r = client.get("/api/settings/exchange-rates/", headers=auth_header(client_token_a))
        assert r.status_code == 403

    def test_factory_blocked_from_settings(self, client, factory_token_x):
        r = client.get("/api/settings/exchange-rates/", headers=auth_header(factory_token_x))
        assert r.status_code == 403


# ===================================================================
# 3. Admin-Only Endpoints: /api/audit/
# ===================================================================

class TestAuditEndpointRBAC:
    """Only ADMIN can access /api/audit/."""

    def test_admin_can_access_audit(self, client, admin_token):
        r = client.get("/api/audit/", headers=auth_header(admin_token))
        assert r.status_code == 200

    def test_client_blocked_from_audit(self, client, client_token_a):
        r = client.get("/api/audit/", headers=auth_header(client_token_a))
        assert r.status_code == 403

    def test_factory_blocked_from_audit(self, client, factory_token_x):
        r = client.get("/api/audit/", headers=auth_header(factory_token_x))
        assert r.status_code == 403


# ===================================================================
# 4. Finance Endpoints: /api/finance/
# ===================================================================

class TestFinanceEndpointRBAC:
    """Only ADMIN + FINANCE can access /api/finance/."""

    def test_admin_can_access_finance(self, client, admin_token):
        r = client.get("/api/finance/receivables/", headers=auth_header(admin_token))
        assert r.status_code == 200

    def test_finance_can_access_finance(self, client, finance_token):
        r = client.get("/api/finance/receivables/", headers=auth_header(finance_token))
        assert r.status_code == 200

    def test_client_blocked_from_finance(self, client, client_token_a):
        r = client.get("/api/finance/receivables/", headers=auth_header(client_token_a))
        assert r.status_code == 403

    def test_factory_blocked_from_finance(self, client, factory_token_x):
        r = client.get("/api/finance/receivables/", headers=auth_header(factory_token_x))
        assert r.status_code == 403

    def test_ops_blocked_from_finance(self, client, ops_token):
        r = client.get("/api/finance/receivables/", headers=auth_header(ops_token))
        assert r.status_code == 403


# ===================================================================
# 5. Positive Tests: Authorized access
# ===================================================================

class TestAuthorizedAccess:
    """Verify each role CAN access their allowed endpoints."""

    def test_client_can_list_orders(self, client, client_token_a):
        r = client.get("/api/orders/", headers=auth_header(client_token_a))
        assert r.status_code == 200

    def test_factory_can_list_orders(self, client, factory_token_x):
        r = client.get("/api/orders/", headers=auth_header(factory_token_x))
        assert r.status_code == 200

    def test_admin_can_list_orders(self, client, admin_token):
        r = client.get("/api/orders/", headers=auth_header(admin_token))
        assert r.status_code == 200

    def test_ops_can_list_orders(self, client, ops_token):
        r = client.get("/api/orders/", headers=auth_header(ops_token))
        assert r.status_code == 200

    def test_client_can_access_products(self, client, client_token_a):
        r = client.get("/api/products/", headers=auth_header(client_token_a))
        assert r.status_code == 200

    def test_auth_me_returns_correct_role(self, client, client_token_a):
        r = client.get("/api/auth/me", headers=auth_header(client_token_a))
        assert r.status_code == 200
        assert r.json()["role"] == "CLIENT"
