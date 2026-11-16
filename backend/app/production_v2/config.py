"""
Production V2 Configuration
Provides additive settings and feature flags without altering app/config.py.
"""
import os
from typing import List
from app.config import settings

class ProductionV2Settings:
    """Additive settings for NorthStar Production V2 pipeline."""
    
    # Operational Mode: LEGACY, SHADOW, PRODUCTION_V2
    PRODUCTION_MODE: str = os.getenv("PRODUCTION_MODE", "LEGACY").upper()
    
    # Cryptographic Vault Settings
    VAULT_ALGORITHM: str = "AES-256-GCM"
    VAULT_VERSION_BYTE: bytes = b"\x02"  # Version 2 format indicator
    
    # Secondary / Previous encryption keys for seamless key rotation
    # Comma-separated hex keys in environment
    _rotation_keys_raw: str = os.getenv("VAULT_ROTATION_KEYS", "")
    
    @property
    def VAULT_ROTATION_KEYS(self) -> List[str]:
        keys = [k.strip() for k in self._rotation_keys_raw.split(",") if k.strip()]
        return keys

    # Evidence Verification Thresholds
    EXACT_SPAN_VERIFICATION_STRICT: bool = True
    CANDIDATE_SIMILARITY_THRESHOLD: float = 0.85
    MIN_QUOTE_LENGTH_CHARS: int = 10

    # Durable Job Processing
    JOB_HEARTBEAT_TIMEOUT_SECONDS: int = 300  # 5 minutes before considering job stalled
    JOB_MAX_RETRIES: int = 3

    # Retrieval Weights
    VECTOR_DENSE_WEIGHT: float = 0.65
    BM25_LEXICAL_WEIGHT: float = 0.35

    @classmethod
    def is_legacy(cls) -> bool:
        return cls.PRODUCTION_MODE == "LEGACY"

    @classmethod
    def is_shadow(cls) -> bool:
        return cls.PRODUCTION_MODE == "SHADOW"

    @classmethod
    def is_production_v2(cls) -> bool:
        return cls.PRODUCTION_MODE == "PRODUCTION_V2"


v2_settings = ProductionV2Settings()
