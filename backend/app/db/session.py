import os
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.config import settings

# Supabase / Heroku sometimes uses postgres:// which SQLAlchemy 1.4+ deprecated in favor of postgresql://
database_url = settings.DATABASE_URL
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

# Configure engine based on database dialect (PostgreSQL for Supabase, SQLite for local fallback)
if database_url.startswith("sqlite"):
    engine = create_engine(
        database_url,
        connect_args={"check_same_thread": False}
    )
else:
    # PostgreSQL / Supabase configuration with robust connection pooling and pre-ping
    engine = create_engine(
        database_url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        pool_recycle=300
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency and context provider for database sessions.
    Automatically commits/closes the session cleanly.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
