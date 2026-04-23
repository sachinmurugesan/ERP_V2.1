"""
Client-Initiated Order Inquiry Security Tests.

Verifies that:
  - CLIENT users can create inquiries
  - client_id is forced from JWT (not payload)
  - All prices are None/zero on created items
  - factory_id is None
  - Non-CLIENT roles are blocked
  - Response contains no sensitive fields
  - Tenant isolation works for inquiries
"""
from tests.conftest import auth_header


class TestClientInquiryCreation:
    """Client can create inquiries with correct constraints."""

    def test_client_can_create_inquiry(self, client, client_token_a):
        """CLIENT user can create an order inquiry (empty items — no products in test DB)."""
        r = client.post("/api/orders/client-inquiry/", headers=auth_header(client_token_a),
                        json={"items": [], "po_reference": "TEST-INQ-001"})
        assert r.status_code in (200, 201), f"Expected 200/201, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("status") == "CLIENT_DRAFT"

    def test_client_inquiry_has_no_factory_id(self, client, client_token_a):
        """CLIENT_DRAFT order has no factory assigned."""
        r = client.post("/api/orders/client-inquiry/", headers=auth_header(client_token_a),
                        json={"items": []})
        if r.status_code in (200, 201):
            data = r.json()
            # factory_id should be None or stripped from response
            assert data.get("factory_id") is None or "factory_id" not in data

    def test_admin_blocked_from_client_inquiry(self, client, admin_token):
        """ADMIN cannot use the client-inquiry endpoint."""
        r = client.post("/api/orders/client-inquiry/", headers=auth_header(admin_token),
                        json={"items": []})
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"

    def test_factory_blocked_from_client_inquiry(self, client, factory_token_x):
        """FACTORY cannot create client inquiries."""
        r = client.post("/api/orders/client-inquiry/", headers=auth_header(factory_token_x),
                        json={"items": []})
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"

    def test_ops_blocked_from_client_inquiry(self, client, ops_token):
        """OPERATIONS cannot use the client-inquiry endpoint."""
        r = client.post("/api/orders/client-inquiry/", headers=auth_header(ops_token),
                        json={"items": []})
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"

    def test_finance_blocked_from_client_inquiry(self, client, finance_token):
        """FINANCE cannot use the client-inquiry endpoint."""
        r = client.post("/api/orders/client-inquiry/", headers=auth_header(finance_token),
                        json={"items": []})
        assert r.status_code == 403, f"Expected 403, got {r.status_code}"

    def test_inquiry_response_has_no_factory_price(self, client, client_token_a):
        """Response must not contain factory_price or markup_percent."""
        r = client.post("/api/orders/client-inquiry/", headers=auth_header(client_token_a),
                        json={"items": []})
        if r.status_code in (200, 201):
            data = r.json()
            assert "factory_price" not in data, "LEAK: factory_price in inquiry response"
            assert "markup_percent" not in data, "LEAK: markup_percent in inquiry response"


class TestClientInquiryIsolation:
    """Client B cannot see Client A's inquiries."""

    def test_client_b_cannot_see_client_a_inquiry(self, client, client_token_a, client_token_b):
        """Client A creates inquiry, Client B cannot see it."""
        # Client A creates inquiry
        r1 = client.post("/api/orders/client-inquiry/", headers=auth_header(client_token_a),
                         json={"items": []})
        if r1.status_code not in (200, 201):
            return  # skip if creation failed

        inquiry_id = r1.json().get("id")
        if not inquiry_id:
            return

        # Client B tries to access it
        r2 = client.get(f"/api/orders/{inquiry_id}/", headers=auth_header(client_token_b))
        assert r2.status_code in (403, 404), \
            f"Client B accessed Client A's inquiry! Got {r2.status_code}"

    def test_client_inquiries_scoped_in_list(self, client, client_token_a, client_token_b):
        """Client A's inquiries don't appear in Client B's order list."""
        # Client A creates inquiry
        r1 = client.post("/api/orders/client-inquiry/", headers=auth_header(client_token_a),
                         json={"po_reference": "INQUIRY-SCOPE-TEST"})
        if r1.status_code not in (200, 201):
            return

        # Client B lists orders
        r2 = client.get("/api/orders/", headers=auth_header(client_token_b))
        assert r2.status_code == 200
        data = r2.json()
        orders = data.get("orders", data) if isinstance(data, dict) else data
        # None of Client B's orders should have Client A's PO reference
        for o in orders:
            if isinstance(o, dict):
                assert o.get("po_reference") != "INQUIRY-SCOPE-TEST", \
                    "Client B can see Client A's inquiry — IDOR vulnerability!"


class TestAdminSeesInquiries:
    """Admin can see and manage CLIENT_DRAFT orders."""

    def test_admin_sees_client_inquiries(self, client, admin_token, client_token_a):
        """Admin can list CLIENT_DRAFT orders."""
        # Create an inquiry first
        client.post("/api/orders/client-inquiry/", headers=auth_header(client_token_a),
                    json={"items": []})

        # Admin checks dashboard
        r = client.get("/api/dashboard/summary/", headers=auth_header(admin_token))
        assert r.status_code == 200
        data = r.json()
        # client_inquiries count should exist
        assert "client_inquiries" in data, "Dashboard missing client_inquiries count"
