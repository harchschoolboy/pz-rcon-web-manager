import os
from pathlib import Path
from pydantic_settings import BaseSettings


def get_data_dir() -> Path:
    """Get data directory path"""
    if os.environ.get('PZ_DATA_DIR'):
        # PyInstaller exe mode - use data dir next to exe
        return Path(os.environ['PZ_DATA_DIR'])
    # Docker/development mode - use /data volume
    return Path('/data')


def get_database_url() -> str:
    """Get database URL, supporting both Docker and exe modes"""
    data_dir = get_data_dir()
    return f"sqlite+aiosqlite:///{data_dir / 'pz_webadmin.db'}"


def get_or_create_encryption_key() -> str:
    """Get encryption key from env or generate and save new one"""
    # First check environment variable
    if os.environ.get('ENCRYPTION_KEY'):
        return os.environ['ENCRYPTION_KEY']
    
    # Check for saved key file
    data_dir = get_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    key_file = data_dir / '.encryption_key'
    
    if key_file.exists():
        return key_file.read_text().strip()
    
    # Generate new key
    from cryptography.fernet import Fernet
    key = Fernet.generate_key().decode()
    key_file.write_text(key)
    return key


def get_or_create_jwt_secret() -> str:
    """Get JWT secret from env or generate and save new one"""
    # First check environment variable
    if os.environ.get('JWT_SECRET'):
        return os.environ['JWT_SECRET']
    
    # Check for saved secret file
    data_dir = get_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    secret_file = data_dir / '.jwt_secret'
    
    if secret_file.exists():
        return secret_file.read_text().strip()
    
    # Generate new secret
    import secrets
    secret = secrets.token_urlsafe(32)
    secret_file.write_text(secret)
    return secret


class Settings(BaseSettings):
    """Application settings"""
    
    # Database - SQLite file outside container via volume mount
    database_url: str = get_database_url()
    
    # Encryption key (auto-generated if not provided)
    encryption_key: str = get_or_create_encryption_key()
    
    # Auth credentials
    auth_username: str = "admin"
    auth_password: str = "admin"
    jwt_secret: str = get_or_create_jwt_secret()
    jwt_expire_hours: int = 24
    
    # API settings
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    
    # RCON settings
    rcon_timeout: int = 10
    rcon_reconnect_delay: int = 5
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
