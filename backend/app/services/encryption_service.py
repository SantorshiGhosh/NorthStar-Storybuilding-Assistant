import os
import secrets
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.config import settings

class EncryptionService:
    def __init__(self):
        # 32-byte key for AES-256-GCM
        raw_key = settings.VAULT_ENCRYPTION_KEY
        try:
            if len(raw_key) == 64:
                self.key = bytes.fromhex(raw_key)
            else:
                # Pad or slice to 32 bytes
                self.key = raw_key.encode('utf-8')[:32].ljust(32, b'0')
        except Exception:
            self.key = b'0' * 32
        self.aesgcm = AESGCM(self.key)

    def encrypt_bytes(self, plaintext: bytes) -> bytes:
        """
        Encrypts plaintext bytes with AES-256-GCM.
        Returns 12-byte nonce prepended to the ciphertext and tag.
        """
        nonce = secrets.token_bytes(12)
        ciphertext = self.aesgcm.encrypt(nonce, plaintext, None)
        return nonce + ciphertext

    def decrypt_bytes(self, encrypted_data: bytes) -> bytes:
        """
        Decrypts AES-256-GCM data (nonce + ciphertext + tag).
        """
        if len(encrypted_data) < 28:
            raise ValueError("Encrypted data is too short to be valid AES-256-GCM payload.")
        nonce = encrypted_data[:12]
        ciphertext = encrypted_data[12:]
        return self.aesgcm.decrypt(nonce, ciphertext, None)

    def encrypt_and_save_file(self, content_bytes: bytes, target_path: str) -> str:
        """
        Encrypts content and saves it to private vault storage.
        """
        dir_name = os.path.dirname(target_path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
        encrypted_payload = self.encrypt_bytes(content_bytes)
        with open(target_path, "wb") as f:
            f.write(encrypted_payload)
        return target_path

    def read_and_decrypt_file(self, source_path: str) -> bytes:
        """
        Reads encrypted file from vault and decrypts it.
        """
        with open(source_path, "rb") as f:
            encrypted_payload = f.read()
        return self.decrypt_bytes(encrypted_payload)

encryption_service = EncryptionService()
