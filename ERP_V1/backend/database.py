"""
HarvestERP - Database Configuration
Supports SQLite (dev) and PostgreSQL (production).
Connection pool tuned for enterprise concurrent traffic.
"""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import QueuePool, StaticPool
from config import DATABASE_URL

_is_sqlite = DATABASE_URL.startswith("sqlite")

# Engine configuration — adapts to database backend
if _is_sqlite:
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )
else:
    # PostgreSQL: production-grade connection pool
    engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool,
        pool_size=10,          # Steady-state connections
        max_overflow=20,       # Burst capacity (total max: 30)
        pool_pre_ping=True,    # Test connections before use (handles dropped conns)
        pool_recycle=1800,     # Recycle connections every 30 minutes
        pool_timeout=30,       # Wait max 30s for a connection from pool
        echo=False,
    )

# SQLite: enable WAL mode for better concurrent reads
if _is_sqlite:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Base model class
class Base(DeclarativeBase):
    pass


# Dependency for FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
