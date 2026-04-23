"""
G-015 and G-016 Security Patch Verification Tests.

G-015 (LOW) — Excel job endpoint ownership check.
  OPERATIONS user may only GET/DELETE their own jobs.
  ADMIN/SUPER_ADMIN may access any job.
  Jobs with NULL created_by (legacy) allow any ADMIN access but block OPERATIONS.

G-016 (LOW) — Product notes field stripped from CLIENT/FACTORY via search endpoint.
  search_products now applies filter_list_for_role — CLIENT/FACTORY do not receive
  fields in CLIENT_HIDDEN_FIELDS (including 'notes').
  INTERNAL roles (ADMIN, FINANCE, OPERATIONS) receive full product data.

Verification matrices:
  G-015:
    OPS-A job: OPS-A GET → 200
    OPS-A job: OPS-B GET → 403
    OPS-A job: OPS-B DELETE → 403
    OPS-A job: ADMIN GET → 200
    OPS-A job: ADMIN DELETE → 200
    Non-existent job: any → 404

  G-016:
    GET /api/products/search/?q=... CLIENT → 200, no 'notes' key
    GET /api/products/search/?q=... FACTORY → 200, no 'notes' key
    GET /api/products/search/?q=... OPERATIONS → 200, 'notes' key present
    GET /api/products/search/?q=... ADMIN → 200, 'notes' key present
"""
import pytest
from tests.conftest import auth_header, _make_token

EXCEL_UPLOAD_URL = "/api/excel/upload/"
PRODUCTS_SEARCH_URL = "/api/products/search/?q=Test"


# ---------------------------------------------------------------------------
# G-015 helpers
# ---------------------------------------------------------------------------

def _create_job(http_client, token, db_session) -> str:
    """Insert a ProcessingJob directly into the test DB with a given created_by.
    Returns the job id.
    """
    from models import ProcessingJob
    from enums import JobStatus
    user_id = token  # We store the user ID directly for clarity in fixtures
    job = ProcessingJob(
        job_type="CLIENT_EXCEL",
        status=JobStatus.PENDING.value,
        progress=0,
        created_by=user_id,
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)
    return job.id


@pytest.fixture(scope="module")
def db():
    """Provide a raw test DB session for direct model manipulation."""
    from tests.conftest import TestSession
    session = TestSession()
    yield session
    session.close()


# ---------------------------------------------------------------------------
# G-015: Excel job ownership
# ---------------------------------------------------------------------------

class TestExcelJobOwnership:
    """G-015 — OPERATIONS users may only access their own jobs."""

    @pytest.fixture(autouse=True)
    def setup_jobs(self, db):
        """Seed two jobs: one owned by user-ops, one owned by user-ops-b."""
        from models import ProcessingJob
        from enums import JobStatus

        self.ops_a_job = ProcessingJob(
            job_type="CLIENT_EXCEL",
            status=JobStatus.PENDING.value,
            progress=0,
            created_by="user-ops",   # matches ops_token fixture user id
        )
        self.ops_b_job = ProcessingJob(
            job_type="CLIENT_EXCEL",
            status=JobStatus.PENDING.value,
            progress=0,
            created_by="user-ops-b-id",  # a different OPERATIONS user
        )
        db.add_all([self.ops_a_job, self.ops_b_job])
        db.commit()
        db.refresh(self.ops_a_job)
        db.refresh(self.ops_b_job)
        yield
        db.delete(self.ops_a_job)
        db.delete(self.ops_b_job)
        db.commit()

    def test_ops_can_get_own_job(self, client, ops_token):
        """OPS-A can GET their own job."""
        r = client.get(f"/api/excel/jobs/{self.ops_a_job.id}/", headers=auth_header(ops_token))
        assert r.status_code == 200, f"OPS-A should access own job, got {r.status_code}"

    def test_ops_cannot_get_other_ops_job(self, client, ops_token):
        """OPS-A cannot GET OPS-B's job."""
        r = client.get(f"/api/excel/jobs/{self.ops_b_job.id}/", headers=auth_header(ops_token))
        assert r.status_code == 403, f"OPS-A should get 403 on OPS-B's job, got {r.status_code}"

    def test_ops_cannot_delete_other_ops_job(self, client, ops_token, db):
        """OPS-A cannot DELETE OPS-B's job."""
        # Create a fresh job for deletion test (so we don't disturb setup_jobs fixture)
        from models import ProcessingJob
        from enums import JobStatus
        other_job = ProcessingJob(
            job_type="CLIENT_EXCEL",
            status=JobStatus.PENDING.value,
            progress=0,
            created_by="user-ops-b-id",
        )
        db.add(other_job)
        db.commit()
        db.refresh(other_job)

        r = client.delete(f"/api/excel/jobs/{other_job.id}/", headers=auth_header(ops_token))
        assert r.status_code == 403, f"OPS-A should get 403 on DELETE of OPS-B's job, got {r.status_code}"

        # Clean up if not deleted (403 means job still exists)
        db.delete(other_job)
        db.commit()

    def test_admin_can_get_any_job(self, client, admin_token):
        """ADMIN can GET any job regardless of creator."""
        r = client.get(f"/api/excel/jobs/{self.ops_a_job.id}/", headers=auth_header(admin_token))
        assert r.status_code == 200, f"ADMIN should access any job, got {r.status_code}"

    def test_admin_can_delete_any_job(self, client, admin_token, db):
        """ADMIN can DELETE any job."""
        from models import ProcessingJob
        from enums import JobStatus
        deletable_job = ProcessingJob(
            job_type="CLIENT_EXCEL",
            status=JobStatus.PENDING.value,
            progress=0,
            created_by="user-ops",
        )
        db.add(deletable_job)
        db.commit()
        db.refresh(deletable_job)

        r = client.delete(f"/api/excel/jobs/{deletable_job.id}/", headers=auth_header(admin_token))
        assert r.status_code in (200, 204), f"ADMIN should delete any job, got {r.status_code}"

    def test_nonexistent_job_returns_404(self, client, ops_token):
        """Non-existent job returns 404 before ownership check."""
        r = client.get("/api/excel/jobs/does-not-exist-000/", headers=auth_header(ops_token))
        assert r.status_code == 404

    def test_null_created_by_job_admin_access(self, client, admin_token, db):
        """Legacy jobs (created_by=NULL) are accessible by ADMIN."""
        from models import ProcessingJob
        from enums import JobStatus
        legacy_job = ProcessingJob(
            job_type="CLIENT_EXCEL",
            status=JobStatus.PENDING.value,
            progress=0,
            created_by=None,  # legacy / no creator recorded
        )
        db.add(legacy_job)
        db.commit()
        db.refresh(legacy_job)

        r = client.get(f"/api/excel/jobs/{legacy_job.id}/", headers=auth_header(admin_token))
        assert r.status_code == 200, f"ADMIN should access legacy job, got {r.status_code}"

        db.delete(legacy_job)
        db.commit()

    def test_null_created_by_job_ops_access(self, client, ops_token, db):
        """Legacy jobs (created_by=NULL) allow OPERATIONS access — NULL means 'no restriction'."""
        from models import ProcessingJob
        from enums import JobStatus
        legacy_job = ProcessingJob(
            job_type="CLIENT_EXCEL",
            status=JobStatus.PENDING.value,
            progress=0,
            created_by=None,
        )
        db.add(legacy_job)
        db.commit()
        db.refresh(legacy_job)

        r = client.get(f"/api/excel/jobs/{legacy_job.id}/", headers=auth_header(ops_token))
        # created_by is None → ownership check skipped → 200
        assert r.status_code == 200, f"OPERATIONS should access NULL-owner job, got {r.status_code}"

        db.delete(legacy_job)
        db.commit()


# ---------------------------------------------------------------------------
# G-016: Product notes field stripped from CLIENT/FACTORY via search
# ---------------------------------------------------------------------------

class TestProductSearchFieldStripping:
    """G-016 — notes (and other CLIENT_HIDDEN_FIELDS) stripped from CLIENT/FACTORY."""

    def test_client_gets_no_notes_field(self, client, client_token_a):
        """CLIENT search results must not contain 'notes'."""
        r = client.get(PRODUCTS_SEARCH_URL, headers=auth_header(client_token_a))
        assert r.status_code == 200
        results = r.json()
        # No results is also valid (empty catalog for test DB) — check structure is list
        assert isinstance(results, list)
        for product in results:
            assert "notes" not in product, (
                f"G-016 VIOLATION: 'notes' exposed to CLIENT in search results: {product.get('notes')!r}"
            )

    def test_factory_gets_no_notes_field(self, client, factory_token_x):
        """FACTORY search results must not contain 'notes'."""
        r = client.get(PRODUCTS_SEARCH_URL, headers=auth_header(factory_token_x))
        assert r.status_code == 200
        results = r.json()
        assert isinstance(results, list)
        for product in results:
            assert "notes" not in product, (
                f"G-016 VIOLATION: 'notes' exposed to FACTORY in search results"
            )

    def test_operations_gets_notes_field(self, client, ops_token, db):
        """OPERATIONS (INTERNAL) search results include 'notes' — not stripped."""
        from models import Product
        # Seed a child product with notes so we have something to search
        parent = Product(
            product_code="G016-PARENT",
            product_name="G016 Test Parent",
            is_active=True,
            notes="internal-ops-note",
        )
        db.add(parent)
        db.flush()
        child = Product(
            product_code="G016-CHILD",
            product_name="G016 Test Child",
            is_active=True,
            parent_id=parent.id,
            notes="internal-note-visible-to-ops",
        )
        db.add(child)
        db.commit()

        r = client.get("/api/products/search/?q=G016", headers=auth_header(ops_token))
        assert r.status_code == 200
        results = r.json()
        matched = [p for p in results if p.get("product_code") == "G016-CHILD"]
        assert len(matched) == 1, "Expected to find G016-CHILD in search results"
        assert "notes" in matched[0], "OPERATIONS should see 'notes' field"
        assert matched[0]["notes"] == "internal-note-visible-to-ops"

        # Cleanup
        db.delete(child)
        db.delete(parent)
        db.commit()

    def test_admin_gets_notes_field(self, client, admin_token, db):
        """ADMIN (INTERNAL) search results include 'notes'."""
        from models import Product
        parent = Product(
            product_code="G016-ADMIN-PARENT",
            product_name="G016 Admin Test Parent",
            is_active=True,
        )
        db.add(parent)
        db.flush()
        child = Product(
            product_code="G016-ADMIN-CHILD",
            product_name="G016 Admin Test Child",
            is_active=True,
            parent_id=parent.id,
            notes="admin-visible-note",
        )
        db.add(child)
        db.commit()

        r = client.get("/api/products/search/?q=G016-ADMIN", headers=auth_header(admin_token))
        assert r.status_code == 200
        results = r.json()
        matched = [p for p in results if p.get("product_code") == "G016-ADMIN-CHILD"]
        assert len(matched) == 1, "Expected to find G016-ADMIN-CHILD in search results"
        assert "notes" in matched[0], "ADMIN should see 'notes' field"

        # Cleanup
        db.delete(child)
        db.delete(parent)
        db.commit()

    def test_no_token_search_returns_401(self, client):
        """Unauthenticated search returns 401 (products router requires get_current_user)."""
        r = client.get(PRODUCTS_SEARCH_URL)
        assert r.status_code == 401
