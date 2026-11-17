import os
import hashlib
from pathlib import Path
from pydantic_settings import BaseSettings

# Resolve paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"

class Settings(BaseSettings):
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"

    # Database
    DATABASE_URL: str = "sqlite:///./story_bible.db"

    # Authentication & Security
    SECRET_KEY: str = ""
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # AI Provider ("groq" or "gemini")
    AI_PROVIDER: str = "groq"
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"

    # Supabase (Optional for local mode, required for Supabase cloud sync)
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_KEY: str = ""  # alias for SUPABASE_ANON_KEY
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_JWT_SECRET: str = ""
    SUPABASE_STORAGE_BUCKET: str = "manuscripts"

    # Encryption (AES-256-GCM 32-byte hex key)
    ENCRYPTION_KEY: str = ""
    VAULT_ENCRYPTION_KEY: str = ""

    # Vector Storage
    CHROMA_PERSIST_DIRECTORY: str = str(BASE_DIR / "storage" / "chroma_db")

    # Vault Storage
    VAULT_STORAGE_DIRECTORY: str = str(BASE_DIR / "storage" / "private_vault")

    # Email & Official Support
    SUPPORT_EMAIL: str = "codebrew@gmail.com"
    SUPPORT_PHONE: str = "+919231456311"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_USE_TLS: bool = True
    SMTP_FROM_EMAIL: str = ""

    class Config:
        env_file = (str(BASE_DIR / ".env"), str(BASE_DIR / "backend" / ".env"))
        extra = "ignore"

settings = Settings()

# Resolve relative SQLite URL to absolute path relative to BASE_DIR
if settings.DATABASE_URL.startswith("sqlite:///./") or settings.DATABASE_URL == "sqlite:///story_bible.db":
    db_rel = settings.DATABASE_URL.replace("sqlite:///./", "").replace("sqlite:///", "")
    resolved_db_path = (BASE_DIR / db_rel).as_posix()
    settings.DATABASE_URL = f"sqlite:///{resolved_db_path}"

# Validate or dynamically generate development fallback secrets
is_prod = settings.ENVIRONMENT.lower() in ("production", "prod")

if not settings.JWT_SECRET_KEY:
    if settings.SECRET_KEY:
        settings.JWT_SECRET_KEY = settings.SECRET_KEY
    elif is_prod:
        raise RuntimeError("CRITICAL SECURITY ERROR: JWT_SECRET_KEY must be set in production.")
    else:
        # Stable local development secret derived from project path
        settings.JWT_SECRET_KEY = hashlib.sha256(f"northstar_dev_jwt_{BASE_DIR}".encode()).hexdigest()

if settings.ENCRYPTION_KEY:
    settings.VAULT_ENCRYPTION_KEY = settings.ENCRYPTION_KEY
elif not settings.VAULT_ENCRYPTION_KEY:
    if is_prod:
        raise RuntimeError("CRITICAL SECURITY ERROR: ENCRYPTION_KEY must be configured in production.")
    else:
        # Stable local development AES-256 key derived from project path
        settings.VAULT_ENCRYPTION_KEY = hashlib.sha256(f"northstar_dev_vault_{BASE_DIR}".encode()).hexdigest()

if settings.SUPABASE_KEY and not settings.SUPABASE_ANON_KEY:
    settings.SUPABASE_ANON_KEY = settings.SUPABASE_KEY

# Ensure directories exist
os.makedirs(settings.CHROMA_PERSIST_DIRECTORY, exist_ok=True)
os.makedirs(settings.VAULT_STORAGE_DIRECTORY, exist_ok=True)
