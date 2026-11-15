from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

db_url = settings.DATABASE_URL.strip().strip('"').strip("'")

# Auto-fix legacy postgres:// scheme commonly provided by Render, Supabase, and Heroku
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

# Attempt engine creation with automatic driver fallback (psycopg vs psycopg2)
try:
    engine = create_engine(
        db_url,
        connect_args=connect_args,
        pool_pre_ping=True
    )
except Exception as e:
    # If psycopg (v3) driver requested but missing, fallback to psycopg2
    if "postgresql+psycopg://" in db_url:
        fallback_url = db_url.replace("postgresql+psycopg://", "postgresql+psycopg2://", 1)
        engine = create_engine(fallback_url, connect_args=connect_args, pool_pre_ping=True)
    # If psycopg2 driver requested but missing, fallback to psycopg
    elif "postgresql+psycopg2://" in db_url:
        fallback_url = db_url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)
        engine = create_engine(fallback_url, connect_args=connect_args, pool_pre_ping=True)
    else:
        raise e

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    from app.database import models
    from app.database.migrations import migration_manager
    try:
        migration_manager.run_all()
        print("[DB] Database migrations and tables initialized successfully.")
    except Exception as e:
        print(f"[DB Warning] Could not auto-run database migrations on startup: {e}")

    # Dialect-agnostic column migrations using SQLAlchemy inspection
    columns_to_ensure = [
        ("projects", "is_demo", "BOOLEAN DEFAULT 0"),
        ("projects", "user_id", "VARCHAR(36)"),
        ("manuscripts", "is_encrypted", "BOOLEAN DEFAULT 1"),
        ("manuscripts", "encrypted", "BOOLEAN DEFAULT 1"),
        ("entities", "category_id", "VARCHAR(36)"),
        ("entities", "canon_status", "VARCHAR(50) DEFAULT 'established'"),
        ("entities", "protection_level", "INTEGER DEFAULT 1"),
        ("entities", "provenance", "VARCHAR(50) DEFAULT 'manual'"),
        ("entities", "custom_properties", "TEXT DEFAULT '{}'"),
        ("entities", "is_archived", "BOOLEAN DEFAULT 0"),
        ("entities", "first_appearance_chapter_id", "VARCHAR(36)"),
        ("relationships", "direction", "VARCHAR(50) DEFAULT 'directed'"),
        ("relationships", "custom_properties", "TEXT DEFAULT '{}'"),
        ("relationships", "provenance", "VARCHAR(50) DEFAULT 'manual'"),
        ("relationships", "protection_level", "INTEGER DEFAULT 1"),
        ("relationships", "source_quote", "TEXT"),
        ("story_facts", "canon_status", "VARCHAR(50) DEFAULT 'established'"),
        ("story_facts", "protection_level", "INTEGER DEFAULT 1"),
        ("story_facts", "provenance", "VARCHAR(50) DEFAULT 'manuscript_extracted'"),
        ("story_facts", "fact_category", "VARCHAR(50) DEFAULT 'general'"),
        ("timeline_events", "canon_status", "VARCHAR(50) DEFAULT 'established'"),
        ("continuity_issues", "classification", "VARCHAR(50) DEFAULT 'likely_conflict'"),
        ("continuity_issues", "evidence", "TEXT DEFAULT '[]'"),
        ("sensitive_approvals", "decided_by_id", "VARCHAR(36)"),
    ]

    try:
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())
        with engine.connect() as conn:
            for table_name, col_name, col_type in columns_to_ensure:
                if table_name in existing_tables:
                    existing_cols = {c["name"] for c in inspector.get_columns(table_name)}
                    if col_name not in existing_cols:
                        try:
                            stmt = f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type};"
                            conn.execute(text(stmt))
                            conn.commit()
                        except Exception as add_err:
                            print(f"[DB Info] Column addition ({table_name}.{col_name}): {add_err}")
    except Exception as e:
        print(f"[DB Warning] Column migration inspection skipped: {e}")
