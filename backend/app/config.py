import os
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

    # AI Provider
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash"

    # Supabase (Optional)
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_STORAGE_BUCKET: str = "manuscripts"

    # Encryption (AES-256-GCM 32-byte hex key)
    VAULT_ENCRYPTION_KEY: str = "5f1d7a8e9b0c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e"

    # Vector Storage
    CHROMA_PERSIST_DIRECTORY: str = str(BASE_DIR / "storage" / "chroma_db")

    # Vault Storage
    VAULT_STORAGE_DIRECTORY: str = str(BASE_DIR / "storage" / "private_vault")

    class Config:
        env_file = str(ENV_FILE)
        extra = "ignore"

settings = Settings()

# Ensure directories exist
os.makedirs(settings.CHROMA_PERSIST_DIRECTORY, exist_ok=True)
os.makedirs(settings.VAULT_STORAGE_DIRECTORY, exist_ok=True)
