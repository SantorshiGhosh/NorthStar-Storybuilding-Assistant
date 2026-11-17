"""
Production V2 Health Service
Deep diagnostic service verifying database, vault cryptography, vector store, and AI readiness.
"""
import time
from datetime import datetime, timezone
from typing import Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.config import settings
from app.production_v2.config import v2_settings
from app.production_v2.services.vault_key_management import vault_key_manager
from app.production_v2.schemas.v2_schemas import SystemHealthV2Out


class ProductionHealthService:
    """
    Performs live verification of all critical production subsystems.
    """

    def check_system_health(self, db: Session) -> SystemHealthV2Out:
        # 1. Database check
        db_start = time.time()
        try:
            db.execute(text("SELECT 1"))
            db_latency_ms = round((time.time() - db_start) * 1000, 2)
            db_status = {"status": "healthy", "latency_ms": db_latency_ms, "type": "sqlite" if "sqlite" in settings.DATABASE_URL else "postgresql"}
        except Exception as e:
            db_status = {"status": "unhealthy", "error": str(e)}

        # 2. Encryption Vault Cryptographic Roundtrip
        vault_start = time.time()
        try:
            test_payload = b"NorthStar_Vault_Integrity_Check_2026"
            encrypted = vault_key_manager.encrypt_bytes(test_payload)
            decrypted, _ = vault_key_manager.decrypt_bytes(encrypted)
            assert decrypted == test_payload
            vault_latency_ms = round((time.time() - vault_start) * 1000, 2)
            vault_status = {
                "status": "healthy",
                "algorithm": v2_settings.VAULT_ALGORITHM,
                "latency_ms": vault_latency_ms,
                "rotation_keys_loaded": len(vault_key_manager.rotation_keys)
            }
        except Exception as e:
            vault_status = {"status": "unhealthy", "error": str(e)}

        # 3. Vector Store check
        try:
            from app.services.vector_service import vector_service
            vec_healthy = vector_service.collection is not None or vector_service.embedder is not None
            vector_status = {
                "status": "healthy" if vec_healthy else "degraded",
                "persist_directory": settings.CHROMA_PERSIST_DIRECTORY,
                "embedding_model": "all-MiniLM-L6-v2 (384d)"
            }
        except Exception as e:
            vector_status = {"status": "degraded", "error": str(e)}

        # 4. AI Service readiness
        is_groq = getattr(settings, "AI_PROVIDER", "gemini").lower() == "groq"
        if is_groq:
            ai_configured = bool(getattr(settings, "GROQ_API_KEY", "") and len(getattr(settings, "GROQ_API_KEY", "")) > 5)
            ai_status = {
                "status": "ready" if ai_configured else "unconfigured",
                "model": getattr(settings, "GROQ_MODEL", "openai/gpt-oss-120b"),
                "provider": "groq"
            }
        else:
            ai_configured = bool(settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY) > 5)
            ai_status = {
                "status": "ready" if ai_configured else "unconfigured",
                "model": settings.GEMINI_MODEL,
                "provider": "google-gemini"
            }

        overall_status = "healthy" if (
            db_status.get("status") == "healthy" and
            vault_status.get("status") == "healthy"
        ) else "degraded"

        return SystemHealthV2Out(
            status=overall_status,
            operational_mode=v2_settings.PRODUCTION_MODE,
            database=db_status,
            vector_store=vector_status,
            encryption_vault=vault_status,
            ai_service=ai_status,
            timestamp=datetime.now(timezone.utc).isoformat()
        )


production_health_service = ProductionHealthService()
