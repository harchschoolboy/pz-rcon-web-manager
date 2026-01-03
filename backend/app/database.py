from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.config import settings
from app.models import Base


# Create async engine
engine = create_async_engine(
    settings.database_url,
    echo=False,
    future=True
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


async def run_migrations(conn):
    """Run database migrations for new columns"""
    # Migration: add auto_sync_mods column to servers table
    try:
        await conn.execute(text("ALTER TABLE servers ADD COLUMN auto_sync_mods BOOLEAN DEFAULT 0"))
    except Exception:
        # Column already exists
        pass


async def init_db():
    """Initialize database - create all tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Run migrations for existing databases
        await run_migrations(conn)


async def get_db() -> AsyncSession:
    """Dependency for getting async database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
