"""
IDOR (Insecure Direct Object Reference) Tests.

Verifies tenant isolation: users can only access resources belonging
to their own client_id or factory_id.

Attack vectors tested:
  - Client A accesses Client B's order → 404/403
  - Factory X accesses Factory Y's order → 404/403
  - Client A lists orders → only sees their own
  - Factory X lists orders → only sees their assigned orders
"""
from tests.conftest import auth_header


# ===================================================================
# 1. Client Tenant Isolation
# ===================================================================

class TestClientTenantIsolation:
    """Client A cannot see Client B's data."""

    def test_client_a_sees_own_orders(self, client, client_token_a):
        """Client A should see orders where client_id = client-a-id."""
        r = client.get("/api/orders/", headers=auth_header(client_token_a))
        assert r.status_code == 200
        data = r.json()
        orders = data.get("orders", data) if isinstance(data, dict) else data
        # Every returned order must belong to client A
        for order in orders:
            if "client_id" in order:
                assert order["client_id"] == "client-a-id", \
                    f"Client A saw order belonging to {order.get('client_id')}"

    def test_client_a_cannot_access_client_b_order(self, client, client_token_a):
        """Client A requesting Client B's order must get 403 or 404."""
        r = client.get("/api/orders/order-b-id/", headers=auth_header(client_token_a))
        assert r.status_code in (403, 404), \
            f"Expected 403/404, got {r.status_code}. IDOR vulnerability!"

    def test_client_b_cannot_access_client_a_order(self, client, client_token_b):
        """Client B requesting Client A's order must get 403 or 404."""
        r = client.get("/api/orders/order-a-id/", headers=auth_header(client_token_b))
        assert r.status_code in (403, 404), \
            f"Expected 403/404, got {r.status_code}. IDOR vulnerability!"

    def test_client_a_order_count_is_scoped(self, client, client_token_a):
        """Client A should not see Client B's orders."""
        r = client.get("/api/orders/", headers=auth_header(client_token_a))
        assert r.status_code == 200
        data = r.json()
        orders = data.get("orders", data) if isinstance(data, dict) else data
        # Extract IDs regardless of format (dict or str)
        order_ids = [o.get("id") if isinstance(o, dict) else o for o in orders]
        assert "order-b-id" not in order_ids, \
            "Client A can see Client B's order — IDOR vulnerability!"


# ===================================================================
# 2. Factory Tenant Isolation
# ===================================================================

class TestFactoryTenantIsolation:
    """Factory X cannot see Factory Y's data."""

    def test_factory_x_sees_own_orders(self, client, factory_token_x):
        """Factory X should only see orders where factory_id = factory-x-id."""
        r = client.get("/api/orders/", headers=auth_header(factory_token_x))
        assert r.status_code == 200
        data = r.json()
        orders = data.get("orders", data) if isinstance(data, dict) else data
        for order in orders:
            if "factory_id" in order:
                assert order["factory_id"] == "factory-x-id", \
                    f"Factory X saw order belonging to {order.get('factory_id')}"

    def test_factory_x_cannot_access_factory_y_order(self, client, factory_token_x):
        """Factory X requesting Factory Y's order must get 403 or 404."""
        r = client.get("/api/orders/order-b-id/", headers=auth_header(factory_token_x))
        assert r.status_code in (403, 404), \
            f"Expected 403/404, got {r.status_code}. IDOR vulnerability!"

    def test_factory_y_cannot_access_factory_x_order(self, client, factory_token_y):
        """Factory Y requesting Factory X's order must get 403 or 404."""
        r = client.get("/api/orders/order-a-id/", headers=auth_header(factory_token_y))
        assert r.status_code in (403, 404), \
            f"Expected 403/404, got {r.status_code}. IDOR vulnerability!"

    def test_factory_x_order_count_is_scoped(self, client, factory_token_x):
        """Factory X should not see Factory Y's orders."""
        r = client.get("/api/orders/", headers=auth_header(factory_token_x))
        assert r.status_code == 200
        data = r.json()
        orders = data.get("orders", data) if isinstance(data, dict) else data
        order_ids = [o.get("id") if isinstance(o, dict) else o for o in orders]
        assert "order-b-id" not in order_ids, \
            "Factory X can see Factory Y's order — IDOR vulnerability!"


# ===================================================================
# 3. Admin Sees Everything (Positive Control)
# ===================================================================

class TestAdminSeesAll:
    """Admin must see all orders — proves the filter is role-based, not broken."""

    def test_admin_sees_both_orders(self, client, admin_token):
        r = client.get("/api/orders/", headers=auth_header(admin_token))
        assert r.status_code == 200
        data = r.json()
        orders = data.get("orders", data) if isinstance(data, dict) else data
        assert len(orders) >= 2, \
            f"Admin sees {len(orders)} orders, expected at least 2"

    def test_admin_can_access_any_order(self, client, admin_token):
        r1 = client.get("/api/orders/order-a-id/", headers=auth_header(admin_token))
        r2 = client.get("/api/orders/order-b-id/", headers=auth_header(admin_token))
        assert r1.status_code == 200
        assert r2.status_code == 200
