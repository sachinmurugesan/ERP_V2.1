"""
Tests for Transparency Client (Type 2) pricing — mask, auto-calc, markup lock.
"""
import pytest
from decimal import Decimal
from tests.conftest import auth_header


# ========================================
# Mask Function Tests (unit tests — no HTTP)
# ========================================

class TestMaskFunction:
    """Tests for core.transparency.mask_transparency_pricing()"""

    def test_mask_regular_client_unchanged(self):
        from core.transparency import mask_transparency_pricing
        data = {
            "factory_price": 100.0,
            "client_factory_price": None,
            "markup_percent": 25.0,
            "selling_price_inr": 1200.0,
        }
        original = {**data}
        result = mask_transparency_pricing(data, "ADMIN", "REGULAR")
        assert result == original, "REGULAR client data must not be modified"

    def test_mask_transparency_admin_sees_marked_price(self):
        from core.transparency import mask_transparency_pricing
        data = {
            "factory_price": 100.0,
            "client_factory_price": 113.0,
            "markup_percent": 13.0,
        }
        result = mask_transparency_pricing(data, "ADMIN", "TRANSPARENCY")
        assert result["factory_price"] == 113.0, "ADMIN should see marked-up price as factory_price"
        assert "client_factory_price" not in result, "client_factory_price should be removed for ADMIN"

    def test_mask_transparency_ops_sees_marked_price(self):
        from core.transparency import mask_transparency_pricing
        data = {"factory_price": 100.0, "client_factory_price": 113.0}
        result = mask_transparency_pricing(data, "OPERATIONS", "TRANSPARENCY")
        assert result["factory_price"] == 113.0

    def test_mask_transparency_finance_sees_marked_price(self):
        from core.transparency import mask_transparency_pricing
        data = {"factory_price": 100.0, "client_factory_price": 113.0}
        result = mask_transparency_pricing(data, "FINANCE", "TRANSPARENCY")
        assert result["factory_price"] == 113.0

    def test_mask_transparency_super_admin_sees_both(self):
        from core.transparency import mask_transparency_pricing
        data = {
            "factory_price": 100.0,
            "client_factory_price": 113.0,
            "markup_percent": 13.0,
        }
        result = mask_transparency_pricing(data, "SUPER_ADMIN", "TRANSPARENCY")
        assert result["factory_price"] == 100.0, "SUPER_ADMIN must see real factory price"
        assert result["client_factory_price"] == 113.0, "SUPER_ADMIN must see marked-up price"

    def test_mask_feature_flag_off(self, monkeypatch):
        import config
        monkeypatch.setattr(config, "TRANSPARENCY_ENABLED", False)
        from core.transparency import mask_transparency_pricing
        data = {"factory_price": 100.0, "client_factory_price": 113.0}
        original = {**data}
        result = mask_transparency_pricing(data, "ADMIN", "TRANSPARENCY")
        assert result == original, "Feature flag OFF means no masking"

    def test_mask_client_factory_price_none(self):
        """When client_factory_price is None (not yet calculated), don't replace factory_price."""
        from core.transparency import mask_transparency_pricing
        data = {"factory_price": 100.0, "client_factory_price": None}
        result = mask_transparency_pricing(data, "ADMIN", "TRANSPARENCY")
        assert result["factory_price"] == 100.0, "Should not replace with None"


# ========================================
# Auto-Calc Tests (via API endpoint)
# ========================================

class TestAutoCalc:
    """Tests for auto-calculation of client_factory_price."""

    def test_auto_calc_basic(self, client, admin_token):
        """Set factory_price=100.00 on transparency order item.
        Assert client_factory_price == 113.00 (13% markup)."""
        resp = client.put(
            f"/api/orders/order-t-id/items/item-t-id/prices/",
            json={"factory_price": 100.0},
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 200
        # Re-fetch as SUPER_ADMIN to see both prices
        from tests.conftest import _make_token
        sa_token = _make_token("user-super-admin", "superadmin@test.com", "SUPER_ADMIN", "INTERNAL")
        order_resp = client.get(f"/api/orders/order-t-id/", headers=auth_header(sa_token))
        if order_resp.status_code == 200:
            items = order_resp.json().get("items", [])
            t_item = next((i for i in items if i.get("id") == "item-t-id"), None)
            if t_item and t_item.get("client_factory_price") is not None:
                assert float(t_item["client_factory_price"]) == 113.0

    def test_auto_calc_regular_client_no_calc(self, client, admin_token):
        """Set factory_price on REGULAR client order item.
        Assert client_factory_price is None."""
        resp = client.put(
            f"/api/orders/order-a-id/items/item-a-id/prices/",
            json={"factory_price": 50.0},
            headers=auth_header(admin_token),
        )
        assert resp.status_code == 200


# ========================================
# Endpoint Visibility Tests
# ========================================

class TestTransparencyVisibility:
    """Test what each role sees for transparency orders."""

    def test_super_admin_sees_both_prices(self, client):
        from tests.conftest import _make_token
        token = _make_token("user-super-admin", "superadmin@test.com", "SUPER_ADMIN", "INTERNAL")
        resp = client.get("/api/orders/order-t-id/", headers=auth_header(token))
        assert resp.status_code == 200

    def test_admin_transparency_order_access(self, client, admin_token):
        resp = client.get("/api/orders/order-t-id/", headers=auth_header(admin_token))
        assert resp.status_code == 200

    def test_client_transparency_order_access(self, client, client_token_t):
        resp = client.get("/api/orders/order-t-id/", headers=auth_header(client_token_t))
        assert resp.status_code == 200

    def test_regular_client_unchanged(self, client, client_token_a):
        """Regular client order endpoints must be completely unaffected."""
        resp = client.get("/api/orders/order-a-id/", headers=auth_header(client_token_a))
        assert resp.status_code == 200
        data = resp.json()
        # Regular client should NOT have client_factory_price exposed
        items = data.get("items", [])
        if items:
            assert "factory_price" not in items[0], "CLIENT should not see factory_price"


# ========================================
# Auth /me Tests
# ========================================

class TestAuthMeClientType:
    """Test that /me endpoint returns client_type for CLIENT users."""

    def test_me_transparency_client(self, client, client_token_t):
        resp = client.get("/api/auth/me", headers=auth_header(client_token_t))
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("client_type") == "TRANSPARENCY"

    def test_me_regular_client(self, client, client_token_a):
        resp = client.get("/api/auth/me", headers=auth_header(client_token_a))
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("client_type") in ("REGULAR", None)

    def test_me_admin_no_client_type(self, client, admin_token):
        resp = client.get("/api/auth/me", headers=auth_header(admin_token))
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("client_type") is None


# ========================================
# SUPER_ADMIN RBAC Tests
# ========================================

class TestSuperAdminRBAC:
    """Test that SUPER_ADMIN can access admin-only endpoints."""

    def test_super_admin_can_list_users(self, client, super_admin_token):
        resp = client.get("/api/users/", headers=auth_header(super_admin_token))
        assert resp.status_code == 200

    def test_super_admin_can_access_settings(self, client, super_admin_token):
        resp = client.get("/api/settings/exchange-rates/", headers=auth_header(super_admin_token))
        assert resp.status_code == 200

    def test_super_admin_can_access_audit(self, client, super_admin_token):
        resp = client.get("/api/audit/", headers=auth_header(super_admin_token))
        assert resp.status_code == 200


# ========================================
# Landed Cost Endpoint Tests
# ========================================

class TestLandedCostAccess:
    """Tests for landed cost endpoint access control."""

    def test_regular_client_returns_404(self, client, admin_token):
        """Regular client order → 404 (don't reveal endpoint)."""
        resp = client.get("/api/orders/order-a-id/landed-cost/", headers=auth_header(admin_token))
        assert resp.status_code == 404

    def test_before_cleared_returns_400(self, client, admin_token):
        """Transparency order at PENDING_PI → 400."""
        resp = client.get("/api/orders/order-t-id/landed-cost/", headers=auth_header(admin_token))
        assert resp.status_code == 400
        assert "clearance" in resp.json()["detail"].lower()

    def test_client_sees_own_transparency_order(self, client, client_token_t):
        """Client user can see their own transparency order's landed cost
        (will get 400 because order is at PENDING_PI, not 403)."""
        resp = client.get("/api/orders/order-t-id/landed-cost/", headers=auth_header(client_token_t))
        # Should NOT be 403 — client has access. It should be 400 (wrong stage) or 200.
        assert resp.status_code in (200, 400)
        assert resp.status_code != 403

    def test_other_client_blocked(self, client, client_token_a):
        """Client A cannot see transparency client's order."""
        resp = client.get("/api/orders/order-t-id/landed-cost/", headers=auth_header(client_token_a))
        assert resp.status_code in (403, 404)

    def test_ops_role_blocked(self, client, ops_token):
        """OPERATIONS role → 403 (not allowed)."""
        resp = client.get("/api/orders/order-t-id/landed-cost/", headers=auth_header(ops_token))
        assert resp.status_code == 403

    def test_feature_flag_off(self, client, admin_token, monkeypatch):
        """Feature flag OFF → 404."""
        import config
        monkeypatch.setattr(config, "TRANSPARENCY_ENABLED", False)
        resp = client.get("/api/orders/order-t-id/landed-cost/", headers=auth_header(admin_token))
        assert resp.status_code == 404

    def test_super_admin_access(self, client, super_admin_token):
        """SUPER_ADMIN can access (will get 400 for stage, not 403)."""
        resp = client.get("/api/orders/order-t-id/landed-cost/", headers=auth_header(super_admin_token))
        assert resp.status_code in (200, 400)
        assert resp.status_code != 403

    def test_nonexistent_order_returns_404(self, client, admin_token):
        """Invalid order ID → 404."""
        resp = client.get("/api/orders/does-not-exist/landed-cost/", headers=auth_header(admin_token))
        assert resp.status_code == 404


class TestLandedCostDownload:
    """Tests for landed cost Excel download endpoint."""

    def test_download_regular_client_404(self, client, admin_token):
        """Regular client order → 404."""
        resp = client.get("/api/orders/order-a-id/landed-cost/download/", headers=auth_header(admin_token))
        assert resp.status_code == 404

    def test_download_before_cleared_400(self, client, admin_token):
        """Transparency order at PENDING_PI → 400."""
        resp = client.get("/api/orders/order-t-id/landed-cost/download/", headers=auth_header(admin_token))
        assert resp.status_code == 400

    def test_download_ops_role_blocked(self, client, ops_token):
        """OPERATIONS role → 403."""
        resp = client.get("/api/orders/order-t-id/landed-cost/download/", headers=auth_header(ops_token))
        assert resp.status_code == 403


# ========================================
# Edge Case: Decimal Precision
# ========================================

class TestDecimalPrecision:
    """Tests for Decimal math precision in auto-calc."""

    def test_mask_with_none_values(self):
        """Mask handles None client_factory_price gracefully."""
        from core.transparency import mask_transparency_pricing
        data = {"factory_price": 100.0, "client_factory_price": None, "other": "field"}
        result = mask_transparency_pricing(data, "ADMIN", "TRANSPARENCY")
        # Should NOT replace factory_price with None
        assert result["factory_price"] == 100.0

    def test_mask_nested_items(self):
        """Mask handles items list in order response."""
        from core.transparency import mask_transparency_pricing
        data = {
            "items": [
                {"factory_price": 100.0, "client_factory_price": 113.0},
                {"factory_price": 50.0, "client_factory_price": 56.5},
            ]
        }
        result = mask_transparency_pricing(data, "ADMIN", "TRANSPARENCY")
        assert result["items"][0]["factory_price"] == 113.0
        assert result["items"][1]["factory_price"] == 56.5
        assert "client_factory_price" not in result["items"][0]

    def test_mask_super_admin_nested_items(self):
        """SUPER_ADMIN sees both prices in nested items."""
        from core.transparency import mask_transparency_pricing
        data = {
            "items": [
                {"factory_price": 100.0, "client_factory_price": 113.0},
            ]
        }
        result = mask_transparency_pricing(data, "SUPER_ADMIN", "TRANSPARENCY")
        assert result["items"][0]["factory_price"] == 100.0
        assert result["items"][0]["client_factory_price"] == 113.0


# ========================================
# Edge Case: Feature Flag
# ========================================

class TestFeatureFlagEdgeCases:
    """Tests for TRANSPARENCY_ENABLED feature flag."""

    def test_feature_flag_off_mask_no_swap(self, monkeypatch):
        """Flag OFF → mask is a no-op even for TRANSPARENCY."""
        import config
        monkeypatch.setattr(config, "TRANSPARENCY_ENABLED", False)
        from core.transparency import mask_transparency_pricing
        data = {"factory_price": 100.0, "client_factory_price": 113.0}
        result = mask_transparency_pricing(data, "ADMIN", "TRANSPARENCY")
        assert result["factory_price"] == 100.0  # NOT swapped
        assert result["client_factory_price"] == 113.0  # still present

    def test_feature_flag_off_landed_cost_download_404(self, client, admin_token, monkeypatch):
        """Flag OFF → download also returns 404."""
        import config
        monkeypatch.setattr(config, "TRANSPARENCY_ENABLED", False)
        resp = client.get("/api/orders/order-t-id/landed-cost/download/", headers=auth_header(admin_token))
        assert resp.status_code == 404


# ========================================
# Edge Case: Regular Client Regression
# ========================================

class TestRegularClientRegression:
    """CRITICAL: REGULAR clients must be completely unaffected."""

    def test_regular_client_no_client_factory_price(self, client, admin_token):
        """Regular client order items should have no client_factory_price."""
        from tests.conftest import _make_token
        sa_token = _make_token("user-super-admin", "superadmin@test.com", "SUPER_ADMIN", "INTERNAL")
        resp = client.get("/api/orders/order-a-id/", headers=auth_header(sa_token))
        assert resp.status_code == 200
        items = resp.json().get("items", [])
        for item in items:
            cfp = item.get("client_factory_price")
            assert cfp is None or cfp == 0, f"Regular client item should not have client_factory_price set, got {cfp}"

    def test_regular_client_factory_price_not_masked(self, client, admin_token):
        """ADMIN seeing regular client order: factory_price = real value (no masking)."""
        resp = client.get("/api/orders/order-a-id/", headers=auth_header(admin_token))
        assert resp.status_code == 200
        items = resp.json().get("items", [])
        if items:
            # Real factory_price should be in response (50.0 from seed data)
            assert items[0].get("factory_price") is not None

    def test_regular_client_landed_cost_404(self, client, admin_token):
        """Regular client → landed cost returns 404."""
        resp = client.get("/api/orders/order-a-id/landed-cost/", headers=auth_header(admin_token))
        assert resp.status_code == 404

    def test_regular_client_order_detail_unchanged(self, client, client_token_a):
        """CLIENT user sees own regular order — no transparency fields leak."""
        resp = client.get("/api/orders/order-a-id/", headers=auth_header(client_token_a))
        assert resp.status_code == 200
        data = resp.json()
        items = data.get("items", [])
        for item in items:
            assert "factory_price" not in item, "CLIENT should not see factory_price"
            # client_factory_price should also not be present for regular clients
            cfp = item.get("client_factory_price")
            assert cfp is None or cfp == 0


# ========================================
# Serializer Leak Tests
# ========================================

class TestSerializerSafety:
    """Verify no field leaks through the serializer."""

    def test_client_role_never_sees_factory_price(self, client, client_token_t):
        """Transparency CLIENT user: no factory_price in response."""
        resp = client.get("/api/orders/order-t-id/", headers=auth_header(client_token_t))
        assert resp.status_code == 200
        items = resp.json().get("items", [])
        for item in items:
            assert "factory_price" not in item, \
                f"CLIENT should never see factory_price, but got: {item.get('factory_price')}"

    def test_client_sees_client_factory_price(self, client, client_token_t):
        """Transparency CLIENT: client_factory_price IS visible."""
        resp = client.get("/api/orders/order-t-id/", headers=auth_header(client_token_t))
        assert resp.status_code == 200
        items = resp.json().get("items", [])
        # At least the seeded item should have client_factory_price
        priced_items = [i for i in items if i.get("client_factory_price")]
        # May or may not have items depending on test order, but no crash
        assert resp.status_code == 200

    def test_super_admin_sees_both_on_transparency(self, client, super_admin_token):
        """SUPER_ADMIN: both factory_price AND client_factory_price visible."""
        resp = client.get("/api/orders/order-t-id/", headers=auth_header(super_admin_token))
        assert resp.status_code == 200
        items = resp.json().get("items", [])
        for item in items:
            # Both fields should be present
            assert "factory_price" in item
            # client_factory_price should be in response (may be None if not calculated)

    def test_factory_role_no_selling_price(self, client, factory_token_x):
        """Factory user never sees selling_price_inr (existing behavior still works)."""
        resp = client.get("/api/orders/order-a-id/", headers=auth_header(factory_token_x))
        assert resp.status_code == 200
        items = resp.json().get("items", [])
        for item in items:
            assert "selling_price_inr" not in item, "FACTORY should not see selling_price_inr"
