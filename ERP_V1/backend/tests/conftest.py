"""
HarvestERP Security Test Configuration.

Creates an isolated in-memory SQLite database, seeds test users/orders,
and provides JWT token fixtures for all 5 user roles.
"""
import sys
import os

# Ensure backend is on path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Allow insecure JWT default during testing (config.py validates at import time)
os.environ.setdefault("DEBUG", "true")

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from database import Base, get_db
from core.security import create_access_token, get_password_hash


# ---------------------------------------------------------------------------
# Isolated test database (in-memory SQLite)
# ---------------------------------------------------------------------------
TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(TEST_ENGINE, "connect")
def _set_pragma(conn, _):
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestSession = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)


def _override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def setup_database():
    """Create all tables once for the test session."""
    import models  # noqa: F401 — registers all models with Base.metadata
    Base.metadata.create_all(bind=TEST_ENGINE)
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture(scope="session")
def app():
    """Create a FastAPI test app with overridden DB dependency."""
    from main import app as _app
    _app.dependency_overrides[get_db] = _override_get_db
    return _app


@pytest.fixture(scope="session")
def client(app):
    """HTTP test client."""
    return TestClient(app)


# ---------------------------------------------------------------------------
# Seed data fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session", autouse=True)
def seed_test_data(setup_database):
    """Seed users, clients, factories, and orders for security tests."""
    from models import User, Client, Factory, Order, OrderItem

    db = TestSession()

    # --- Clients ---
    client_a = Client(
        id="client-a-id",
        company_name="Client Alpha",
        gstin="GSTIN_A",
        contact_name="Alice",
    )
    client_b = Client(
        id="client-b-id",
        company_name="Client Beta",
        gstin="GSTIN_B",
        contact_name="Bob",
    )
    db.add_all([client_a, client_b])

    # --- Factories ---
    factory_x = Factory(
        id="factory-x-id",
        factory_code="FX001",
        company_name="Factory X",
    )
    factory_y = Factory(
        id="factory-y-id",
        factory_code="FY001",
        company_name="Factory Y",
    )
    db.add_all([factory_x, factory_y])
    db.flush()

    # --- Users ---
    admin_user = User(
        id="user-admin",
        email="admin@test.com",
        full_name="Test Admin",
        password_hash=get_password_hash("testpass"),
        role="ADMIN",
        user_type="INTERNAL",
    )
    finance_user = User(
        id="user-finance",
        email="finance@test.com",
        full_name="Test Finance",
        password_hash=get_password_hash("testpass"),
        role="FINANCE",
        user_type="INTERNAL",
    )
    ops_user = User(
        id="user-ops",
        email="ops@test.com",
        full_name="Test Ops",
        password_hash=get_password_hash("testpass"),
        role="OPERATIONS",
        user_type="INTERNAL",
    )
    client_user_a = User(
        id="user-client-a",
        email="clienta@test.com",
        full_name="Client A User",
        password_hash=get_password_hash("testpass"),
        role="CLIENT",
        user_type="CLIENT",
        client_id="client-a-id",
    )
    client_user_b = User(
        id="user-client-b",
        email="clientb@test.com",
        full_name="Client B User",
        password_hash=get_password_hash("testpass"),
        role="CLIENT",
        user_type="CLIENT",
        client_id="client-b-id",
    )
    factory_user_x = User(
        id="user-factory-x",
        email="factoryx@test.com",
        full_name="Factory X User",
        password_hash=get_password_hash("testpass"),
        role="FACTORY",
        user_type="FACTORY",
        factory_id="factory-x-id",
    )
    factory_user_y = User(
        id="user-factory-y",
        email="factoryy@test.com",
        full_name="Factory Y User",
        password_hash=get_password_hash("testpass"),
        role="FACTORY",
        user_type="FACTORY",
        factory_id="factory-y-id",
    )
    super_admin_user = User(
        id="user-super-admin",
        email="superadmin@test.com",
        full_name="Test Super Admin",
        password_hash=get_password_hash("testpass"),
        role="SUPER_ADMIN",
        user_type="INTERNAL",
    )
    db.add_all([admin_user, finance_user, ops_user, super_admin_user, client_user_a, client_user_b, factory_user_x, factory_user_y])
    db.flush()

    # --- Orders ---
    order_a = Order(
        id="order-a-id",
        order_number="ORD-A-001",
        client_id="client-a-id",
        factory_id="factory-x-id",
        status="FACTORY_ORDERED",
    )
    order_b = Order(
        id="order-b-id",
        order_number="ORD-B-001",
        client_id="client-b-id",
        factory_id="factory-y-id",
        status="PRODUCTION_60",
    )
    db.add_all([order_a, order_b])
    db.flush()

    # --- Order Items (with both price types) ---
    item_a = OrderItem(
        id="item-a-id",
        order_id="order-a-id",
        product_id=None,
        product_code_snapshot="PART-001",
        product_name_snapshot="Test Part Alpha",
        category_snapshot="Gearbox",
        quantity=10,
        factory_price=50.0,
        selling_price_inr=1200.0,
        markup_percent=25.0,
    )
    item_b = OrderItem(
        id="item-b-id",
        order_id="order-b-id",
        product_id=None,
        product_code_snapshot="PART-002",
        product_name_snapshot="Test Part Beta",
        category_snapshot="Engine",
        quantity=5,
        factory_price=100.0,
        selling_price_inr=2400.0,
        markup_percent=30.0,
    )
    db.add_all([item_a, item_b])

    # --- Transparency Client + Order ---
    client_t = Client(
        id="client-transparency-id",
        company_name="Transparency Corp",
        client_type="TRANSPARENCY",
        factory_markup_percent=13.0,
        sourcing_commission_percent=4.0,
    )
    db.add(client_t)
    db.flush()

    transparency_client_user = User(
        id="user-client-t",
        email="transparency@test.com",
        full_name="Transparency Client User",
        password_hash=get_password_hash("testpass"),
        role="CLIENT",
        user_type="CLIENT",
        client_id="client-transparency-id",
    )
    db.add(transparency_client_user)
    db.flush()

    order_t = Order(
        id="order-t-id",
        order_number="ORD-T-001",
        client_id="client-transparency-id",
        factory_id="factory-x-id",
        status="PENDING_PI",
    )
    db.add(order_t)
    db.flush()

    from decimal import Decimal
    item_t = OrderItem(
        id="item-t-id",
        order_id="order-t-id",
        product_id=None,
        product_code_snapshot="TPART-001",
        product_name_snapshot="Transparency Test Part",
        quantity=100,
        factory_price=100.0,
        client_factory_price=Decimal("113.00"),
        markup_percent=13.0,
        selling_price_inr=0,
    )
    db.add(item_t)

    db.commit()
    db.close()


# ---------------------------------------------------------------------------
# Token fixtures
# ---------------------------------------------------------------------------
def _make_token(user_id, email, role, user_type, client_id=None, factory_id=None):
    return create_access_token({
        "sub": user_id,
        "email": email,
        "role": role,
        "user_type": user_type,
        "client_id": client_id,
        "factory_id": factory_id,
        "tenant_id": "default",
    })


@pytest.fixture(scope="session")
def admin_token():
    return _make_token("user-admin", "admin@test.com", "ADMIN", "INTERNAL")


@pytest.fixture(scope="session")
def finance_token():
    return _make_token("user-finance", "finance@test.com", "FINANCE", "INTERNAL")


@pytest.fixture(scope="session")
def ops_token():
    return _make_token("user-ops", "ops@test.com", "OPERATIONS", "INTERNAL")


@pytest.fixture(scope="session")
def client_token_a():
    return _make_token("user-client-a", "clienta@test.com", "CLIENT", "CLIENT", client_id="client-a-id")


@pytest.fixture(scope="session")
def client_token_b():
    return _make_token("user-client-b", "clientb@test.com", "CLIENT", "CLIENT", client_id="client-b-id")


@pytest.fixture(scope="session")
def factory_token_x():
    return _make_token("user-factory-x", "factoryx@test.com", "FACTORY", "FACTORY", factory_id="factory-x-id")


@pytest.fixture(scope="session")
def factory_token_y():
    return _make_token("user-factory-y", "factoryy@test.com", "FACTORY", "FACTORY", factory_id="factory-y-id")


@pytest.fixture(scope="session")
def super_admin_token():
    return _make_token("user-super-admin", "superadmin@test.com", "SUPER_ADMIN", "INTERNAL")


@pytest.fixture(scope="session")
def client_token_t():
    return _make_token("user-client-t", "transparency@test.com", "CLIENT", "CLIENT", client_id="client-transparency-id")


def auth_header(token):
    """Helper to create Authorization header dict."""
    return {"Authorization": f"Bearer {token}"}
