"""
Field Leakage Tests.

Verifies that the response serializer correctly strips sensitive fields
from API responses based on the user's role.

Attack vectors tested:
  - CLIENT sees factory_price → LEAK
  - CLIENT sees markup_percent → LEAK
  - CLIENT sees factory_id → LEAK
  - FACTORY sees selling_price_inr → LEAK
  - FACTORY sees markup_percent → LEAK
  - FACTORY sees client_id → LEAK
  - Admin sees all fields → CORRECT
"""
from tests.conftest import auth_header


# Fields that MUST NOT appear in CLIENT responses
CLIENT_FORBIDDEN = [
    "factory_price",
    "markup_percent",
    "factory_id",
    "factory_name",
]

# Fields that MUST NOT appear in FACTORY responses
FACTORY_FORBIDDEN = [
    "selling_price_inr",
    "markup_percent",
    "client_id",
    "client_name",
]


def _get_order_data(http_client, order_id, token):
    """Helper: fetch an order and return the JSON dict."""
    r = http_client.get(f"/api/orders/{order_id}/", headers=auth_header(token))
    try:
        data = r.json() if r.status_code == 200 else {}
    except Exception:
        data = {}
    return r.status_code, data


# ===================================================================
# 1. Client Field Scrubbing
# ===================================================================

class TestClientFieldScrubbing:
    """Client A's view of their order must not contain factory data."""

    def test_client_order_has_no_factory_price(self, client, client_token_a):
        status, data = _get_order_data(client, "order-a-id", client_token_a)
        assert status == 200
        assert "factory_price" not in data, \
            "LEAK: factory_price exposed to CLIENT"

    def test_client_order_has_no_markup(self, client, client_token_a):
        status, data = _get_order_data(client, "order-a-id", client_token_a)
        assert status == 200
        assert "markup_percent" not in data, \
            "LEAK: markup_percent exposed to CLIENT"

    def test_client_order_has_no_factory_id(self, client, client_token_a):
        status, data = _get_order_data(client, "order-a-id", client_token_a)
        assert status == 200
        assert "factory_id" not in data, \
            "LEAK: factory_id exposed to CLIENT"

    def test_client_items_have_no_factory_prices(self, client, client_token_a):
        status, data = _get_order_data(client, "order-a-id", client_token_a)
        assert status == 200
        items = data.get("items", [])
        for item in items:
            for field in CLIENT_FORBIDDEN:
                assert field not in item, \
                    f"LEAK: item field '{field}' exposed to CLIENT"

    def test_client_can_see_selling_price(self, client, client_token_a):
        """Positive test: CLIENT should see selling_price_inr."""
        status, data = _get_order_data(client, "order-a-id", client_token_a)
        assert status == 200
        items = data.get("items", [])
        if items:
            # selling_price_inr should be present (not stripped)
            assert "selling_price_inr" in items[0], \
                "CLIENT should see selling_price_inr but it's missing"


# ===================================================================
# 2. Factory Field Scrubbing
# ===================================================================

class TestFactoryFieldScrubbing:
    """Factory X's view of their order must not contain client/selling data."""

    def test_factory_order_has_no_selling_price(self, client, factory_token_x):
        status, data = _get_order_data(client, "order-a-id", factory_token_x)
        assert status == 200
        assert "selling_price_inr" not in data, \
            "LEAK: selling_price_inr exposed to FACTORY"

    def test_factory_order_has_no_markup(self, client, factory_token_x):
        status, data = _get_order_data(client, "order-a-id", factory_token_x)
        assert status == 200
        assert "markup_percent" not in data, \
            "LEAK: markup_percent exposed to FACTORY"

    def test_factory_order_has_no_client_id(self, client, factory_token_x):
        status, data = _get_order_data(client, "order-a-id", factory_token_x)
        assert status == 200
        assert "client_id" not in data, \
            "LEAK: client_id exposed to FACTORY"

    def test_factory_items_have_no_selling_prices(self, client, factory_token_x):
        status, data = _get_order_data(client, "order-a-id", factory_token_x)
        assert status == 200
        items = data.get("items", [])
        for item in items:
            for field in FACTORY_FORBIDDEN:
                assert field not in item, \
                    f"LEAK: item field '{field}' exposed to FACTORY"

    def test_factory_can_see_factory_price(self, client, factory_token_x):
        """Positive test: FACTORY should see factory_price."""
        status, data = _get_order_data(client, "order-a-id", factory_token_x)
        assert status == 200
        items = data.get("items", [])
        if items:
            assert "factory_price" in items[0], \
                "FACTORY should see factory_price but it's missing"


# ===================================================================
# 3. Admin Sees All Fields (Positive Control)
# ===================================================================

class TestAdminSeesAllFields:
    """Admin must see ALL fields — proves stripping is role-based, not global."""

    def test_admin_sees_factory_price(self, client, admin_token):
        status, data = _get_order_data(client, "order-a-id", admin_token)
        assert status == 200
        items = data.get("items", [])
        if items:
            assert "factory_price" in items[0], \
                "Admin should see factory_price"

    def test_admin_sees_selling_price(self, client, admin_token):
        status, data = _get_order_data(client, "order-a-id", admin_token)
        assert status == 200
        items = data.get("items", [])
        if items:
            assert "selling_price_inr" in items[0], \
                "Admin should see selling_price_inr"

    def test_admin_sees_markup(self, client, admin_token):
        status, data = _get_order_data(client, "order-a-id", admin_token)
        assert status == 200
        items = data.get("items", [])
        if items:
            assert "markup_percent" in items[0], \
                "Admin should see markup_percent"
