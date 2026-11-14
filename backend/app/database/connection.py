from sqlalchemy import create_engine
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
    from sqlalchemy import text
    from app.database import models
    try:
        Base.metadata.create_all(bind=engine)
        print("[DB] Database tables initialized successfully.")
    except Exception as e:
        print(f"[DB Warning] Could not auto-create database tables on startup: {e}")

    # Safe schema migration for new roadmap columns
    alter_statements = [
        "ALTER TABLE manuscripts ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE manuscripts ADD COLUMN IF NOT EXISTS encrypted BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE entities ADD COLUMN IF NOT EXISTS first_appearance_chapter_id UUID;",
        "ALTER TABLE relationships ADD COLUMN IF NOT EXISTS source_quote TEXT;",
        "ALTER TABLE story_facts ADD COLUMN IF NOT EXISTS fact_category VARCHAR(50) DEFAULT 'general';",
        "ALTER TABLE continuity_issues ADD COLUMN IF NOT EXISTS classification VARCHAR(50) DEFAULT 'likely_conflict';",
        "ALTER TABLE continuity_issues ADD COLUMN IF NOT EXISTS evidence JSONB;",
    ]
    try:
        with engine.connect() as conn:
            for stmt in alter_statements:
                try:
                    conn.execute(text(stmt))
                    conn.commit()
                except Exception:
                    pass
    except Exception as e:
        print(f"[DB Warning] Column migration skipped: {e}")

