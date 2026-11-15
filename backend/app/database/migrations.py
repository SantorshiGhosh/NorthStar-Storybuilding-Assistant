import logging
from datetime import datetime
from typing import List, Callable, Tuple
from sqlalchemy import text, inspect
from sqlalchemy.orm import Session

from app.database.connection import engine, Base
from app.database import models

logger = logging.getLogger("db_migrations")

class MigrationManager:
    def __init__(self):
        self._ensure_migration_table()

    def _ensure_migration_table(self):
        with engine.connect() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version VARCHAR(100) PRIMARY KEY,
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """))
            conn.commit()

    def get_applied_versions(self) -> List[str]:
        with engine.connect() as conn:
            rows = conn.execute(text("SELECT version FROM schema_migrations ORDER BY version ASC;")).fetchall()
            return [r[0] for r in rows]

    def record_migration(self, version: str):
        with engine.connect() as conn:
            try:
                conn.execute(
                    text("INSERT INTO schema_migrations (version, applied_at) VALUES (:v, :t) ON CONFLICT (version) DO NOTHING;"),
                    {"v": version, "t": datetime.utcnow()}
                )
                conn.commit()
            except Exception:
                conn.rollback()
                try:
                    conn.execute(
                        text("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (:v, :t);"),
                        {"v": version, "t": datetime.utcnow()}
                    )
                    conn.commit()
                except Exception:
                    conn.rollback()

    def remove_migration(self, version: str):
        with engine.connect() as conn:
            conn.execute(
                text("DELETE FROM schema_migrations WHERE version = :v;"),
                {"v": version}
            )
            conn.commit()

    def run_all(self):
        """Executes all pending migrations in transaction-safe manner."""
        applied = set(self.get_applied_versions())
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())

        # Ensure all tables defined in SQLAlchemy models exist safely
        Base.metadata.create_all(bind=engine)

        migrations = [
            ("001_core_architecture", self._mig_001_core),
            ("002_story_architect_extensions", self._mig_002_architect),
            ("003_auth_and_isolation", self._mig_003_auth_isolation),
            ("004_user_columns_and_defaults", self._mig_004_users),
        ]

        for version, func in migrations:
            if version not in applied:
                logger.info(f"[Migration] Applying {version}...")
                try:
                    func()
                    self.record_migration(version)
                    logger.info(f"[Migration] {version} applied successfully.")
                except Exception as e:
                    logger.error(f"[Migration Error] Failed applying {version}: {e}")
                    raise e

    def _mig_001_core(self):
        """Ensures core manuscript and continuity columns exist."""
        columns = [
            ("manuscripts", "is_encrypted", "BOOLEAN DEFAULT TRUE"),
            ("manuscripts", "encrypted", "BOOLEAN DEFAULT TRUE"),
            ("continuity_issues", "classification", "VARCHAR(50) DEFAULT 'likely_conflict'"),
            ("continuity_issues", "evidence", "TEXT DEFAULT '[]'"),
            ("story_facts", "fact_category", "VARCHAR(50) DEFAULT 'general'"),
        ]
        self._add_columns_if_missing(columns)

    def _mig_002_architect(self):
        """Ensures Story Architect columns exist on entities and relationships."""
        columns = [
            ("entities", "category_id", "VARCHAR(36)"),
            ("entities", "canon_status", "VARCHAR(50) DEFAULT 'established'"),
            ("entities", "protection_level", "INTEGER DEFAULT 1"),
            ("entities", "provenance", "VARCHAR(50) DEFAULT 'manual'"),
            ("entities", "custom_properties", "TEXT DEFAULT '{}'"),
            ("entities", "is_archived", "BOOLEAN DEFAULT FALSE"),
            ("entities", "first_appearance_chapter_id", "VARCHAR(36)"),
            ("relationships", "direction", "VARCHAR(50) DEFAULT 'directed'"),
            ("relationships", "custom_properties", "TEXT DEFAULT '{}'"),
            ("relationships", "provenance", "VARCHAR(50) DEFAULT 'manual'"),
            ("relationships", "protection_level", "INTEGER DEFAULT 1"),
            ("relationships", "source_quote", "TEXT"),
            ("story_facts", "canon_status", "VARCHAR(50) DEFAULT 'established'"),
            ("story_facts", "protection_level", "INTEGER DEFAULT 1"),
            ("story_facts", "provenance", "VARCHAR(50) DEFAULT 'manuscript_extracted'"),
            ("timeline_events", "canon_status", "VARCHAR(50) DEFAULT 'established'"),
            ("sensitive_approvals", "decided_by_id", "VARCHAR(36)"),
        ]
        self._add_columns_if_missing(columns)

    def _mig_003_auth_isolation(self):
        """Ensures user ownership columns exist on projects."""
        columns = [
            ("projects", "user_id", "VARCHAR(36)"),
            ("projects", "is_demo", "BOOLEAN DEFAULT FALSE"),
        ]
        self._add_columns_if_missing(columns)

    def _mig_004_users(self):
        """Ensures users table has full_name, is_active, is_superuser, updated_at."""
        columns = [
            ("users", "full_name", "VARCHAR(255)"),
            ("users", "is_active", "BOOLEAN DEFAULT TRUE"),
            ("users", "is_superuser", "BOOLEAN DEFAULT FALSE"),
            ("users", "updated_at", "TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP"),
        ]
        self._add_columns_if_missing(columns)

    def _add_columns_if_missing(self, columns: List[Tuple[str, str, str]]):
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())
        with engine.connect() as conn:
            for table_name, col_name, col_type in columns:
                if table_name in existing_tables:
                    existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
                    if col_name not in existing_cols:
                        try:
                            stmt = f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type};"
                            conn.execute(text(stmt))
                            conn.commit()
                        except Exception as e:
                            conn.rollback()
                            logger.warning(f"Column add note ({table_name}.{col_name}): {e}")

migration_manager = MigrationManager()
