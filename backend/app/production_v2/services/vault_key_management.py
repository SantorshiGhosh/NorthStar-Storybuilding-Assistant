"""
Production V2 Cryptographic Vault Key Manager
Implements AES-256-GCM key rotation, versioned nonce headers, and strict integrity verification.
"""
import os
import secrets
from typing import List, Tuple, Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

from app.config import settings
from app.production_v2.config import v2_settings


class VaultIntegrityError(Exception):
    """Raised when ciphertext payload is corrupted, truncated, or forged."""
    pass


class VaultConfigurationError(Exception):
    """Raised when vault encryption key is missing or invalid, enforcing fail-closed security."""
    pass


class VaultKeyManager:
    """
    Enterprise-grade AES-256-GCM Vault Manager with key rotation.
    Supports both legacy v1 format (12-byte IV + ciphertext + tag)
    and production v2 format (b'\\x02' + 12-byte IV + ciphertext + tag).
    Fails closed if encryption key is unconfigured or invalid.
    """

    MAGIC_V2 = b"\x02"

    def __init__(self, custom_key: Optional[str] = None):
        key_source = custom_key if custom_key is not None else (settings.VAULT_ENCRYPTION_KEY or settings.ENCRYPTION_KEY)
        self.primary_key = self._normalize_key(key_source)
        self.primary_cipher = AESGCM(self.primary_key)
        
        # Load secondary / rotation keys
        self.rotation_keys: List[bytes] = []
        for raw_k in v2_settings.VAULT_ROTATION_KEYS:
            if raw_k and raw_k.strip():
                try:
                    self.rotation_keys.append(self._normalize_key(raw_k))
                except Exception:
                    pass

    @staticmethod
    def _normalize_key(raw_key: str) -> bytes:
        if not raw_key or not raw_key.strip():
            raise VaultConfigurationError(
                "CRITICAL SECURITY ERROR: VAULT_ENCRYPTION_KEY is unconfigured. "
                "Vault refuses to operate with empty or all-zero fallback keys."
            )
        clean = raw_key.strip()
        try:
            if len(clean) == 64:
                return bytes.fromhex(clean)
            elif len(clean.encode("utf-8")) == 32:
                return clean.encode("utf-8")
            else:
                raise VaultConfigurationError(
                    f"Invalid vault key length ({len(clean)} chars). "
                    "Must be exactly 64 hex characters or 32 UTF-8 bytes."
                )
        except VaultConfigurationError:
            raise
        except Exception as exc:
            raise VaultConfigurationError(f"Failed to parse vault encryption key: {exc}") from exc

    def encrypt_bytes(self, plaintext: bytes) -> bytes:
        """
        Encrypts plaintext with primary key using production v2 format:
        [1-byte magic 0x02] + [12-byte nonce] + [ciphertext + 16-byte GCM tag]
        """
        nonce = secrets.token_bytes(12)
        ciphertext = self.primary_cipher.encrypt(nonce, plaintext, None)
        return self.MAGIC_V2 + nonce + ciphertext

    def decrypt_bytes(self, encrypted_payload: bytes) -> Tuple[bytes, bool]:
        """
        Decrypts AES-256-GCM payload.
        Attempts primary key first; if InvalidTag and rotation keys exist, attempts rotation keys.
        Returns:
            Tuple[plaintext_bytes, was_rotated_key_used]
        Raises:
            VaultIntegrityError if corrupted or no key can decrypt.
        """
        if not encrypted_payload or len(encrypted_payload) < 28:
            raise VaultIntegrityError("Payload too short to contain valid AES-256-GCM nonce and tag.")

        # Check for v2 magic header
        if encrypted_payload.startswith(self.MAGIC_V2):
            nonce = encrypted_payload[1:13]
            ciphertext_and_tag = encrypted_payload[13:]
        else:
            # Legacy v1 format
            nonce = encrypted_payload[:12]
            ciphertext_and_tag = encrypted_payload[12:]

        # Attempt with primary key
        try:
            decrypted = self.primary_cipher.decrypt(nonce, ciphertext_and_tag, None)
            return decrypted, False
        except InvalidTag:
            pass
        except Exception as e:
            raise VaultIntegrityError(f"Vault decryption failed: {e}")

        # Attempt fallback rotation keys
        for idx, fallback_key in enumerate(self.rotation_keys):
            try:
                cipher = AESGCM(fallback_key)
                decrypted = cipher.decrypt(nonce, ciphertext_and_tag, None)
                return decrypted, True
            except InvalidTag:
                continue
            except Exception:
                continue

        raise VaultIntegrityError("Authentication tag verification failed. Ciphertext corrupted or key mismatch.")

    def encrypt_and_save_file(self, content_bytes: bytes, target_path: str) -> str:
        """Saves encrypted bytes to target path securely."""
        dir_name = os.path.dirname(target_path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
        payload = self.encrypt_bytes(content_bytes)
        with open(target_path, "wb") as f:
            f.write(payload)
        return target_path

    def read_and_decrypt_file(self, source_path: str) -> bytes:
        """Reads and decrypts file, raising VaultIntegrityError on tamper."""
        if not os.path.exists(source_path):
            raise FileNotFoundError(f"Vault file not found: {source_path}")
        with open(source_path, "rb") as f:
            payload = f.read()
        decrypted, _ = self.decrypt_bytes(payload)
        return decrypted

    def re_encrypt_file_with_primary_key(self, file_path: str) -> bool:
        """
        Re-encrypts a file with the current primary key if it was encrypted with an older key.
        Returns True if rotated/re-encrypted, False if already encrypted with primary key.
        """
        if not os.path.exists(file_path):
            return False
        with open(file_path, "rb") as f:
            payload = f.read()

        plaintext, used_fallback = self.decrypt_bytes(payload)
        is_v2 = payload.startswith(self.MAGIC_V2)

        if used_fallback or not is_v2:
            # Re-encrypt with primary key in v2 format
            new_payload = self.encrypt_bytes(plaintext)
            temp_path = f"{file_path}.tmp"
            with open(temp_path, "wb") as f:
                f.write(new_payload)
            os.replace(temp_path, file_path)
            return True
        return False


vault_key_manager = VaultKeyManager()
