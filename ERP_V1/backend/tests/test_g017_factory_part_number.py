"""
G-017 Security Patch Verification Tests.

G-017 (LOW) — `factory_part_number` stripped from CLIENT and FACTORY
  via search_products (and any other endpoint using filter_list_for_role /
  filter_for_role).

  `factory_part_number` is added to both CLIENT_HIDDEN_FIELDS and
  FACTORY_HIDDEN_FIELDS in core/serializers.py.  Because search_products
  already pipes results through filter_list_for_role (G-016 patch), the
  field is automatically stripped for both external role types.

  INTERNAL roles (ADMIN, FINANCE, OPERATIONS, SUPER_ADMIN) continue to
  receive the field.

Verification matrix:
  GET /api/products/search/?q=G017 CLIENT   → 200, no 'factory_part_number'
  GET /api/products/search/?q=G017 FACTORY  → 200, no 'factory_part_number'
  GET /api/products/search/?q=G017 OPS      → 200, 'factory_part_number' present
  GET /api/products/search/?q=G017 ADMIN    → 200, 'factory_part_number' present

Serializer unit tests:
  filter_for_role(data, "CLIENT")  → 'factory_part_number' absent
  filter_for_role(data, "FACTORY") → 'factory_part_number' absent
  filter_for_role(data, "OPERATIONS") → 'factory_part_number' present
  filter_for_role(data, "ADMIN")      → 'factory_part_number' present
  CLIENT_HIDDEN_FIELDS membership assertion
  FACTORY_HIDDEN_FIELDS membership assertion
"""
import pytest
from tests.conftest import auth_header

SEARCH_BASE_URL = "/api/products/search/?q=G017"


# ---------------------------------------------------------------------------
# Serializer unit tests (no DB / no HTTP)
# ---------------------------------------------------------------------------

class TestSerializerFieldSets:
    """Confirm field-set membership at the unit level."""

    def test_factory_part_number_in_client_hidden_fields(self):
        from core.serializers import CLIENT_HIDDEN_FIELDS
        assert "factory_part_number" in CLIENT_HIDDEN_FIELDS, (
            "G-017: 'factory_part_number' must be in CLIENT_HIDDEN_FIELDS"
        )

    def test_factory_part_number_in_factory_hidden_fields(self):
        from core.serializers import FACTORY_HIDDEN_FIELDS
        assert "factory_part_number" in FACTORY_HIDDEN_FIELDS, (
            "G-017: 'factory_part_number' must be in FACTORY_HIDDEN_FIELDS"
        )

    def test_filter_for_role_strips_factory_part_number_for_client(self):
        from core.serializers import filter_for_role
        data = {
            "product_code": "TEST-001",
            "product_name": "Test Product",
            "factory_part_number": "FPN-ABC-123",
            "notes": "internal note",
        }
        result = filter_for_role(data, "CLIENT")
        assert "factory_part_number" not in result, (
            "G-017 VIOLATION: filter_for_role passed 'factory_part_number' to CLIENT"
        )

    def test_filter_for_role_strips_factory_part_number_for_factory(self):
        from core.serializers import filter_for_role
        data = {
            "product_code": "TEST-001",
            "product_name": "Test Product",
            "factory_part_number": "FPN-ABC-123",
        }
        result = filter_for_role(data, "FACTORY")
        assert "factory_part_number" not in result, (
            "G-017 VIOLATION: filter_for_role passed 'factory_part_number' to FACTORY"
        )

    def test_filter_for_role_passes_factory_part_number_for_operations(self):
        from core.serializers import filter_for_role
        data = {"product_code": "TEST-001", "factory_part_number": "FPN-ABC-123"}
        result = filter_for_role(data, "OPERATIONS")
        assert "factory_part_number" in result, (
            "OPERATIONS should see 'factory_part_number'"
        )
        assert result["factory_part_number"] == "FPN-ABC-123"

    def test_filter_for_role_passes_factory_part_number_for_admin(self):
        from core.serializers import filter_for_role
        data = {"product_code": "TEST-001", "factory_part_number": "FPN-XYZ"}
        result = filter_for_role(data, "ADMIN")
        assert "factory_part_number" in result
        assert result["factory_part_number"] == "FPN-XYZ"

    def test_filter_for_role_passes_factory_part_number_for_finance(self):
        from core.serializers import filter_for_role
        data = {"product_code": "TEST-001", "factory_part_number": "FPN-FINANCE"}
        result = filter_for_role(data, "FINANCE")
        assert "factory_part_number" in result

    def test_filter_for_role_strips_for_unknown_role(self):
        """Unknown roles get the combined field set stripped (maximum safety)."""
        from core.serializers import filter_for_role
        data = {"product_code": "TEST-001", "factory_part_number": "FPN-??"}
        result = filter_for_role(data, "UNKNOWN_ROLE")
        assert "factory_part_number" not in result, (
            "Unknown roles must have factory_part_number stripped"
        )


# ---------------------------------------------------------------------------
# Module-level DB fixture (mirrors test_g015_g016_patches.py)
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def db():
    from tests.conftest import TestSession
    session = TestSession()
    yield session
    session.close()


# ---------------------------------------------------------------------------
# Integration tests via /api/products/search/
# ---------------------------------------------------------------------------

class TestProductSearchFactoryPartNumber:
    """G-017 — factory_part_number stripped from CLIENT/FACTORY search results."""

    @pytest.fixture(autouse=True)
    def seed_product(self, db):
        """Seed a parent + searchable child with factory_part_number set."""
        from models import Product

        parent = Product(
            product_code="G017-PARENT",
            product_name="G017 Test Parent",
            is_active=True,
        )
        db.add(parent)
        db.flush()

        self.child = Product(
            product_code="G017-CHILD",
            product_name="G017 Test Child",
            is_active=True,
            parent_id=parent.id,
            factory_part_number="FPN-G017-SECRET",
            notes="also-secret",
        )
        db.add(self.child)
        db.commit()
        self._parent = parent
        yield

        db.delete(self.child)
        db.delete(self._parent)
        db.commit()

    def test_client_does_not_see_factory_part_number(self, client, client_token_a):
        """CLIENT search results must not contain 'factory_part_number'."""
        r = client.get(SEARCH_BASE_URL, headers=auth_header(client_token_a))
        assert r.status_code == 200
        results = r.json()
        assert isinstance(results, list)
        matched = [p for p in results if p.get("product_code") == "G017-CHILD"]
        assert len(matched) == 1, "Expected G017-CHILD in search results"
        assert "factory_part_number" not in matched[0], (
            f"G-017 VIOLATION: 'factory_part_number' exposed to CLIENT: "
            f"{matched[0].get('factory_part_number')!r}"
        )

    def test_factory_does_not_see_factory_part_number(self, client, factory_token_x):
        """FACTORY search results must not contain 'factory_part_number'."""
        r = client.get(SEARCH_BASE_URL, headers=auth_header(factory_token_x))
        assert r.status_code == 200
        results = r.json()
        assert isinstance(results, list)
        matched = [p for p in results if p.get("product_code") == "G017-CHILD"]
        assert len(matched) == 1, "Expected G017-CHILD in search results"
        assert "factory_part_number" not in matched[0], (
            f"G-017 VIOLATION: 'factory_part_number' exposed to FACTORY"
        )

    def test_operations_sees_factory_part_number(self, client, ops_token):
        """OPERATIONS (INTERNAL) must receive 'factory_part_number' in full."""
        r = client.get(SEARCH_BASE_URL, headers=auth_header(ops_token))
        assert r.status_code == 200
        results = r.json()
        matched = [p for p in results if p.get("product_code") == "G017-CHILD"]
        assert len(matched) == 1, "Expected G017-CHILD in search results"
        assert "factory_part_number" in matched[0], (
            "OPERATIONS should see 'factory_part_number'"
        )
        assert matched[0]["factory_part_number"] == "FPN-G017-SECRET"

    def test_admin_sees_factory_part_number(self, client, admin_token):
        """ADMIN (INTERNAL) must receive 'factory_part_number' in full."""
        r = client.get(SEARCH_BASE_URL, headers=auth_header(admin_token))
        assert r.status_code == 200
        results = r.json()
        matched = [p for p in results if p.get("product_code") == "G017-CHILD"]
        assert len(matched) == 1, "Expected G017-CHILD in search results"
        assert "factory_part_number" in matched[0], (
            "ADMIN should see 'factory_part_number'"
        )
        assert matched[0]["factory_part_number"] == "FPN-G017-SECRET"

    def test_all_client_results_lack_factory_part_number(self, client, client_token_a):
        """Broad scan: no result in CLIENT search contains 'factory_part_number'."""
        r = client.get("/api/products/search/?q=G017", headers=auth_header(client_token_a))
        assert r.status_code == 200
        for product in r.json():
            assert "factory_part_number" not in product, (
                f"G-017 VIOLATION: product {product.get('product_code')!r} "
                f"exposes 'factory_part_number' to CLIENT"
            )

    def test_all_factory_results_lack_factory_part_number(self, client, factory_token_x):
        """Broad scan: no result in FACTORY search contains 'factory_part_number'."""
        r = client.get("/api/products/search/?q=G017", headers=auth_header(factory_token_x))
        assert r.status_code == 200
        for product in r.json():
            assert "factory_part_number" not in product, (
                f"G-017 VIOLATION: product {product.get('product_code')!r} "
                f"exposes 'factory_part_number' to FACTORY"
            )
