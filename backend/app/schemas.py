from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# Server schemas
class ServerBase(BaseModel):
    name: str = Field(..., description="Server name")
    host: str = Field(..., description="Server host/IP")
    port: int = Field(..., description="RCON port")
    username: Optional[str] = Field(None, description="Optional username")
    password: str = Field(..., description="RCON password")


class ServerCreate(ServerBase):
    pass


class ServerUpdate(BaseModel):
    name: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


class ServerResponse(BaseModel):
    id: int
    name: str
    host: str
    port: int
    username: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Command schemas
class CommandExecute(BaseModel):
    command: str = Field(..., description="RCON command to execute")


class CommandResponse(BaseModel):
    success: bool
    response: Optional[str] = None
    error: Optional[str] = None


# Server state schemas
class ServerStateResponse(BaseModel):
    id: int
    server_id: int
    server_name: Optional[str]
    version: Optional[str]
    players_online: int
    max_players: int
    cpu_usage: Optional[str]
    memory_usage: Optional[str]
    uptime: Optional[str]
    timestamp: datetime
    
    class Config:
        from_attributes = True


# Connection schemas
class ConnectionStatus(BaseModel):
    server_id: int
    connected: bool
    authenticated: bool


# Mod schemas
class ModCreate(BaseModel):
    workshop_id: str = Field(..., description="Steam Workshop ID")
    mod_ids: list[str] = Field(..., description="List of Mod IDs from workshop page")
    enabled_mod_ids: list[str] = Field(default_factory=list, description="List of enabled Mod IDs")
    name: Optional[str] = Field(None, description="Mod name")
    is_enabled: bool = Field(True, description="Master switch - whether mod is enabled")


class ModUpdate(BaseModel):
    mod_ids: Optional[list[str]] = None
    enabled_mod_ids: Optional[list[str]] = None
    name: Optional[str] = None
    is_enabled: Optional[bool] = None


class ModResponse(BaseModel):
    id: int
    server_id: int
    workshop_id: str
    mod_ids: list[str]  # All mod IDs for this workshop
    enabled_mod_ids: list[str]  # Which mod IDs are enabled
    name: Optional[str]
    is_enabled: bool
    workshop_url: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ModParseRequest(BaseModel):
    url: str = Field(..., description="Steam Workshop URL")


class ModParseResponse(BaseModel):
    workshop_id: str
    mod_ids: list[str]  # List of all found Mod IDs
    name: Optional[str]


class ModsExport(BaseModel):
    mods: list[ModCreate]
