from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

db_url = settings.DATABASE_URL

# Auto-fix legacy postgres:// scheme commonly provided by Render, Supabase, and Heroku
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

connect_args = {}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=True
)

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
    try:
        Base.metadata.create_all(bind=engine)
        print("[DB] Database tables initialized successfully.")
    except Exception as e:
        print(f"[DB Warning] Could not auto-create database tables on startup: {e}")
