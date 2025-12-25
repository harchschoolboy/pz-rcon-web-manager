from cryptography.fernet import Fernet
from app.config import settings


class CryptoService:
    """Service for encrypting and decrypting sensitive data"""
    
    def __init__(self):
        if not settings.encryption_key:
            raise ValueError(
                "ENCRYPTION_KEY not set. Generate one with: "
                "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        self.cipher = Fernet(settings.encryption_key.encode())
    
    def encrypt(self, data: str) -> str:
        """Encrypt string data"""
        if not data:
            return ""
        encrypted = self.cipher.encrypt(data.encode())
        return encrypted.decode()
    
    def decrypt(self, encrypted_data: str) -> str:
        """Decrypt string data"""
        if not encrypted_data:
            return ""
        decrypted = self.cipher.decrypt(encrypted_data.encode())
        return decrypted.decode()


# Global instance
crypto_service = CryptoService()
