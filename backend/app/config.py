from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""
    
    # Database - SQLite file outside container via volume mount
    database_url: str = "sqlite+aiosqlite:////data/pz_webadmin.db"
    
    # Encryption key (must be 32 url-safe base64-encoded bytes)
    encryption_key: str = ""
    
    # Auth credentials
    auth_username: str = "admin"
    auth_password: str = "admin"
    jwt_secret: str = "change-me-in-production-use-long-random-string"
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
