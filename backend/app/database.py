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

    # Migration: add position column to server_mods table (left-panel order)
    try:
        await conn.execute(text("ALTER TABLE server_mods ADD COLUMN position INTEGER NOT NULL DEFAULT 0"))
    except Exception:
        # Column already exists
        pass

    # Migration: add dependencies column to server_mods table (required-mod workshop IDs)
    try:
        await conn.execute(text("ALTER TABLE server_mods ADD COLUMN dependencies TEXT"))
    except Exception:
        # Column already exists
        pass

    # Migration: add name_resolved column to server_mods table.
    # Tracks whether the real Steam Workshop title was fetched (vs a placeholder
    # like "Workshop <id>" that can result from a Steam 429 during sync/add).
    try:
        await conn.execute(text("ALTER TABLE server_mods ADD COLUMN name_resolved BOOLEAN DEFAULT 0"))
        # Backfill: treat any existing real name as resolved, but flag rows that
        # have no name or only the placeholder "Workshop <id>" as unresolved so
        # the user can refresh them.
        await conn.execute(text(
            "UPDATE server_mods SET name_resolved = 1 "
            "WHERE name IS NOT NULL AND name != '' AND name NOT LIKE 'Workshop %'"
        ))
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
