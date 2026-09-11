"""Small idempotent SQL migration runner for the local/Supabase project database."""
from pathlib import Path

from app.db.session import engine


def apply_migrations() -> None:
    migrations_dir = Path(__file__).with_name("migrations")
    if not migrations_dir.exists():
        return
    if engine.dialect.name != "postgresql":
        raise RuntimeError(
            "Phase 2 Payment Guardian lifecycle enforcement requires PostgreSQL. "
            "Configure DATABASE_URL with a PostgreSQL/Supabase connection string; "
            "the legacy SQLite fallback cannot provide the required durable lifecycle schema."
        )

    connection = engine.raw_connection()
    try:
        cursor = connection.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS public.guardian_schema_migrations (
                name TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        cursor.execute("SELECT name FROM public.guardian_schema_migrations")
        applied = {row[0] for row in cursor.fetchall()}
        for migration_path in sorted(migrations_dir.glob("*.sql")):
            if migration_path.name in applied:
                continue
            cursor.execute(migration_path.read_text(encoding="utf-8"))
            cursor.execute("INSERT INTO public.guardian_schema_migrations (name) VALUES (%s)", (migration_path.name,))
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
