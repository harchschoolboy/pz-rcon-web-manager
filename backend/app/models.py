from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()


class Server(Base):
    """Server configuration model"""
    __tablename__ = "servers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    host = Column(String(255), nullable=False)
    port = Column(Integer, nullable=False)
    username = Column(String(255), nullable=True)  # Encrypted
    password = Column(Text, nullable=False)  # Encrypted
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ServerState(Base):
    """Server state snapshot"""
    __tablename__ = "server_states"
    
    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, nullable=False, index=True)
    
    # Server info
    server_name = Column(String(255))
    version = Column(String(50))
    
    # Player info
    players_online = Column(Integer, default=0)
    max_players = Column(Integer, default=0)
    
    # Performance metrics
    cpu_usage = Column(String(50))
    memory_usage = Column(String(50))
    uptime = Column(String(100))
    
    # Raw data
    raw_data = Column(Text)  # JSON string with full server response
    
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


class CommandLog(Base):
    """Log of executed RCON commands"""
    __tablename__ = "command_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, nullable=False, index=True)
    command = Column(Text, nullable=False)
    response = Column(Text)
    success = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    executed_at = Column(DateTime, default=datetime.utcnow, index=True)


class Player(Base):
    """Player data"""
    __tablename__ = "players"
    
    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, nullable=False, index=True)
    
    # Player identification
    username = Column(String(255), nullable=False, index=True)
    steam_id = Column(String(255), nullable=True, index=True)
    
    # Player status
    is_online = Column(Boolean, default=False)
    last_seen = Column(DateTime, default=datetime.utcnow)
    
    # Stats
    total_playtime = Column(Integer, default=0)  # in minutes
    last_position = Column(String(255))  # x,y,z coordinates
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ServerMod(Base):
    """Mod configuration for a server"""
    __tablename__ = "server_mods"
    
    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, nullable=False, index=True)
    
    # Mod identification
    workshop_id = Column(String(50), nullable=False)
    mod_ids = Column(Text, nullable=False)  # All mod IDs separated by ;
    enabled_mod_ids = Column(Text, nullable=True)  # Enabled mod IDs separated by ;
    name = Column(String(500), nullable=True)
    
    # Status
    is_enabled = Column(Boolean, default=True)  # Master switch for this workshop item
    
    # Metadata
    workshop_url = Column(String(500), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
