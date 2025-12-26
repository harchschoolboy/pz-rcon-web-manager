from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Set, Optional
import json
import re
import httpx
import asyncio
from datetime import datetime
from pathlib import Path

from app.database import get_db, init_db
from app.models import Server, CommandLog, ServerState, ServerMod
from app.schemas import (
    ServerCreate,
    ServerUpdate,
    ServerResponse,
    CommandExecute,
    CommandResponse,
    ServerStateResponse,
    ConnectionStatus,
    ModCreate,
    ModUpdate,
    ModResponse,
    ModParseRequest,
    ModParseResponse,
    ModsExport
)
from app.crypto import crypto_service
from app.rcon_client import rcon_manager, RCONError
from app.config import settings
from app.auth import (
    LoginRequest,
    TokenResponse,
    authenticate_user,
    create_access_token,
    get_current_user,
    verify_token
)


app = FastAPI(
    title="PZ WebAdmin API",
    description="Backend API for Project Zomboid Server Management",
    version="0.1.0"
)


def server_to_response(server: Server) -> dict:
    """Convert server model to response dict with decrypted username"""
    username = None
    if server.username:
        try:
            username = crypto_service.decrypt(server.username)
        except:
            username = "admin"  # Fallback if decryption fails
    
    return {
        "id": server.id,
        "name": server.name,
        "host": server.host,
        "port": server.port,
        "username": username or "admin",
        "is_active": server.is_active,
        "created_at": server.created_at,
        "updated_at": server.updated_at
    }


# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============= WebSocket Manager =============

class ConnectionManager:
    """Manages WebSocket connections for real-time updates"""
    
    def __init__(self):
        # Map server_id -> set of websockets
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        self._broadcast_task: asyncio.Task | None = None
    
    async def connect(self, websocket: WebSocket, server_id: int):
        await websocket.accept()
        if server_id not in self.active_connections:
            self.active_connections[server_id] = set()
        self.active_connections[server_id].add(websocket)
    
    def disconnect(self, websocket: WebSocket, server_id: int):
        if server_id in self.active_connections:
            self.active_connections[server_id].discard(websocket)
            if not self.active_connections[server_id]:
                del self.active_connections[server_id]
    
    async def broadcast_to_server(self, server_id: int, message: dict):
        """Send message to all clients subscribed to a server"""
        if server_id not in self.active_connections:
            return
        
        dead_connections = set()
        for connection in self.active_connections[server_id]:
            try:
                await connection.send_json(message)
            except:
                dead_connections.add(connection)
        
        # Clean up dead connections
        for conn in dead_connections:
            self.active_connections[server_id].discard(conn)
    
    async def broadcast_connection_status(self, server_id: int, connected: bool):
        """Broadcast connection status change"""
        await self.broadcast_to_server(server_id, {
            "type": "connection_status",
            "server_id": server_id,
            "connected": connected,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def get_connected_clients_count(self, server_id: int) -> int:
        return len(self.active_connections.get(server_id, set()))


ws_manager = ConnectionManager()


# Static files - serve React build
# Support both development and PyInstaller exe paths
def get_static_dir() -> Path:
    """Get static files directory, works for dev and PyInstaller"""
    import os
    if os.environ.get('PZ_STATIC_DIR'):
        return Path(os.environ['PZ_STATIC_DIR'])
    return Path(__file__).parent.parent / "static"

STATIC_DIR = get_static_dir()
if STATIC_DIR.exists() and (STATIC_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    await init_db()


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    rcon_manager.disconnect_all()


# Health check - moved to /api/health (no auth required)
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "PZ WebAdmin API"}


# ============= File Export =============

from pydantic import BaseModel as PydanticBaseModel

class ExportFileRequest(PydanticBaseModel):
    filename: str
    content: str

@app.post("/api/export-file")
async def export_file(
    request: ExportFileRequest,
    current_user: str = Depends(get_current_user)
):
    """Save export file to exports folder"""
    import os
    
    # Get exports directory (next to data folder)
    data_dir = Path(os.environ.get('PZ_DATA_DIR', '/data'))
    exports_dir = data_dir.parent / 'exports' if os.environ.get('PZ_DATA_DIR') else Path('/data/exports')
    exports_dir.mkdir(parents=True, exist_ok=True)
    
    # Sanitize filename
    safe_filename = re.sub(r'[^a-zA-Z0-9а-яА-ЯіІїЇєЄ._-]', '_', request.filename)
    filepath = exports_dir / safe_filename
    
    # Write file
    filepath.write_text(request.content, encoding='utf-8')
    
    return {"success": True, "path": str(filepath)}


# ============= Authentication =============

@app.post("/api/auth/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    """Authenticate user and return JWT token"""
    if not authenticate_user(request.username, request.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token, expires_in = create_access_token(request.username)
    return TokenResponse(
        access_token=access_token,
        expires_in=expires_in
    )


@app.get("/api/auth/verify")
async def verify_auth(current_user: str = Depends(get_current_user)):
    """Verify current token is valid"""
    return {"valid": True, "username": current_user}


# ============= WebSocket Endpoint =============

# Cache for MaxPlayers per server (to avoid frequent showoptions calls)
_max_players_cache: Dict[int, int] = {}

async def get_max_players(server_id: int) -> int:
    """Get max players from showoptions (cached)"""
    if server_id in _max_players_cache:
        return _max_players_cache[server_id]
    
    try:
        if not rcon_manager.is_connected(server_id):
            return 0
        
        response = rcon_manager.execute_command(server_id, "showoptions")
        if response:
            import re
            match = re.search(r'\*\s*MaxPlayers\s*=\s*(\d+)', response)
            if match:
                max_players = int(match.group(1))
                _max_players_cache[server_id] = max_players
                return max_players
    except Exception as e:
        print(f"Error getting max players: {e}")
    
    return 0

def clear_max_players_cache(server_id: int):
    """Clear cached max players when settings change"""
    _max_players_cache.pop(server_id, None)

async def get_players_count(server_id: int) -> dict:
    """Get current players count via RCON players command"""
    try:
        if not rcon_manager.is_connected(server_id):
            return {"connected": False, "current": 0, "max": 0}
        
        response = rcon_manager.execute_command(server_id, "players")
        if response is None:
            return {"connected": False, "current": 0, "max": 0}
        
        # Parse response like "Players connected (2):"
        import re
        
        # Try to parse "Players connected (X):" format
        match = re.search(r'Players connected \((\d+)\)', response)
        if match:
            current = int(match.group(1))
        else:
            # Alternative: count player names (lines starting with -)
            lines = [l.strip() for l in response.strip().split('\n') if l.strip().startswith('-')]
            current = len(lines)
        
        # Get max from showoptions (cached)
        max_players = await get_max_players(server_id)
        
        return {
            "connected": True, 
            "current": current, 
            "max": max_players
        }
        
    except Exception as e:
        print(f"Error getting players count: {e}")
        return {"connected": False, "current": 0, "max": 0}


@app.websocket("/ws/{server_id}")
async def websocket_endpoint(
    websocket: WebSocket, 
    server_id: int,
    token: Optional[str] = Query(None)
):
    """WebSocket endpoint for real-time server status updates (requires token in query param)"""
    # Verify token
    if not token or not verify_token(token):
        await websocket.close(code=4001, reason="Unauthorized")
        return
    
    await ws_manager.connect(websocket, server_id)
    
    # Send initial connection status
    is_connected = rcon_manager.is_connected(server_id)
    await websocket.send_json({
        "type": "connection_status",
        "server_id": server_id,
        "connected": is_connected,
        "timestamp": datetime.utcnow().isoformat()
    })
    
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_json()
            
            # Handle ping/pong for keepalive
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            
            # Handle status request
            elif data.get("type") == "get_status":
                is_connected = rcon_manager.is_connected(server_id)
                await websocket.send_json({
                    "type": "connection_status",
                    "server_id": server_id,
                    "connected": is_connected,
                    "timestamp": datetime.utcnow().isoformat()
                })
            
            # Handle players check - also verifies connection is alive
            elif data.get("type") == "check_players":
                players_info = await get_players_count(server_id)
                await websocket.send_json({
                    "type": "players_count",
                    "server_id": server_id,
                    "connected": players_info["connected"],
                    "current": players_info["current"],
                    "max": players_info["max"],
                    "timestamp": datetime.utcnow().isoformat()
                })
                
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, server_id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket, server_id)


# ============= Server Management =============

@app.post("/servers", response_model=ServerResponse, status_code=status.HTTP_201_CREATED)
async def create_server(
    server: ServerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Create new server configuration"""
    
    # Check if server name already exists
    result = await db.execute(
        select(Server).where(Server.name == server.name)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Server with name '{server.name}' already exists"
        )
    
    # Encrypt credentials
    encrypted_password = crypto_service.encrypt(server.password)
    encrypted_username = crypto_service.encrypt(server.username) if server.username else None
    
    # Create server
    db_server = Server(
        name=server.name,
        host=server.host,
        port=server.port,
        username=encrypted_username,
        password=encrypted_password,
        is_active=True
    )
    
    db.add(db_server)
    await db.commit()
    await db.refresh(db_server)
    
    return server_to_response(db_server)


@app.get("/servers", response_model=List[ServerResponse])
async def list_servers(
    active_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """List all servers"""
    query = select(Server)
    if active_only:
        query = query.where(Server.is_active == True)
    
    result = await db.execute(query.order_by(Server.name))
    servers = result.scalars().all()
    
    return [server_to_response(s) for s in servers]


@app.get("/servers/{server_id}", response_model=ServerResponse)
async def get_server(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Get server by ID"""
    result = await db.execute(
        select(Server).where(Server.id == server_id)
    )
    server = result.scalar_one_or_none()
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Server with ID {server_id} not found"
        )
    
    return server_to_response(server)


@app.put("/servers/{server_id}", response_model=ServerResponse)
async def update_server(
    server_id: int,
    server_update: ServerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Update server configuration"""
    result = await db.execute(
        select(Server).where(Server.id == server_id)
    )
    server = result.scalar_one_or_none()
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Server with ID {server_id} not found"
        )
    
    # Update fields
    update_data = server_update.model_dump(exclude_unset=True)
    
    # Encrypt password if provided
    if "password" in update_data:
        update_data["password"] = crypto_service.encrypt(update_data["password"])
    
    # Encrypt username if provided
    if "username" in update_data and update_data["username"]:
        update_data["username"] = crypto_service.encrypt(update_data["username"])
    
    for field, value in update_data.items():
        setattr(server, field, value)
    
    server.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(server)
    
    return server_to_response(server)


@app.delete("/servers/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_server(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Delete server"""
    result = await db.execute(
        select(Server).where(Server.id == server_id)
    )
    server = result.scalar_one_or_none()
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Server with ID {server_id} not found"
        )
    
    # Disconnect if connected
    if rcon_manager.is_connected(server_id):
        rcon_manager.disconnect(server_id)
    
    await db.delete(server)
    await db.commit()


# ============= RCON Connection Management =============

@app.post("/servers/{server_id}/connect")
async def connect_to_server(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Connect to server via RCON"""
    result = await db.execute(
        select(Server).where(Server.id == server_id)
    )
    server = result.scalar_one_or_none()
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Server with ID {server_id} not found"
        )
    
    # Decrypt credentials
    password = crypto_service.decrypt(server.password)
    username = crypto_service.decrypt(server.username) if server.username else None
    
    try:
        await rcon_manager.connect(server_id, server.host, server.port, password, username)
        # Broadcast connection status via WebSocket
        await ws_manager.broadcast_connection_status(server_id, True)
        return {"message": f"Connected to {server.name}", "server_id": server_id}
    except RCONError as e:
        # Broadcast disconnection via WebSocket
        await ws_manager.broadcast_connection_status(server_id, False)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )


@app.post("/servers/{server_id}/disconnect")
async def disconnect_from_server(
    server_id: int,
    current_user: str = Depends(get_current_user)
):
    """Disconnect from server"""
    if not rcon_manager.is_connected(server_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Not connected to server {server_id}"
        )
    
    rcon_manager.disconnect(server_id)
    # Broadcast disconnection via WebSocket
    await ws_manager.broadcast_connection_status(server_id, False)
    return {"message": f"Disconnected from server {server_id}"}


@app.get("/servers/{server_id}/status", response_model=ConnectionStatus)
async def get_connection_status(
    server_id: int,
    current_user: str = Depends(get_current_user)
):
    """Get connection status for server"""
    is_connected = rcon_manager.is_connected(server_id)
    
    return ConnectionStatus(
        server_id=server_id,
        connected=is_connected,
        authenticated=is_connected
    )


# ============= Command Execution =============

@app.post("/servers/{server_id}/execute", response_model=CommandResponse)
async def execute_command(
    server_id: int,
    command: CommandExecute,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Execute RCON command on server"""
    
    # Check if connected
    if not rcon_manager.is_connected(server_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Not connected to server {server_id}. Connect first."
        )
    
    try:
        # Execute command
        response = rcon_manager.execute_command(server_id, command.command)
        
        # Log command
        log_entry = CommandLog(
            server_id=server_id,
            command=command.command,
            response=response,
            success=True
        )
        db.add(log_entry)
        await db.commit()
        
        return CommandResponse(
            success=True,
            response=response
        )
        
    except RCONError as e:
        # Log failed command
        log_entry = CommandLog(
            server_id=server_id,
            command=command.command,
            success=False,
            error_message=str(e)
        )
        db.add(log_entry)
        await db.commit()
        
        return CommandResponse(
            success=False,
            error=str(e)
        )


# ============= Server Options (showoptions) =============

@app.get("/servers/{server_id}/options")
async def get_server_options(
    server_id: int,
    current_user: str = Depends(get_current_user)
):
    """Get server options via showoptions RCON command"""
    if not rcon_manager.is_connected(server_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Not connected to server {server_id}. Connect first."
        )
    
    try:
        response = rcon_manager.execute_command(server_id, "showoptions")
        
        # Parse key=value pairs from response
        options = {}
        mods_data = {}
        
        for line in response.split('\n'):
            line = line.strip()
            if '=' in line:
                # Split only on first '=' to handle values with '=' in them
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip()
                
                # Remove leading "* " from keys (PZ format)
                if key.startswith('* '):
                    key = key[2:]
                
                # Separate mods-related options
                if key in ['Mods', 'WorkshopItems', 'Map']:
                    mods_data[key] = value
                else:
                    options[key] = value
        
        return {
            "options": options,
            "mods": mods_data,
            "raw": response
        }
    except RCONError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============= Mods Management =============

@app.post("/mods/parse", response_model=ModParseResponse)
async def parse_workshop_url(
    request: ModParseRequest,
    current_user: str = Depends(get_current_user)
):
    """Parse Steam Workshop URL to extract mod info"""
    url = request.url
    
    # Extract workshop ID from URL
    match = re.search(r'id=(\d+)', url)
    if not match:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Steam Workshop URL. Could not find workshop ID."
        )
    
    workshop_id = match.group(1)
    
    try:
        # Fetch the workshop page
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://steamcommunity.com/sharedfiles/filedetails/?id={workshop_id}",
                follow_redirects=True,
                timeout=10.0
            )
            html = response.text
        
        # Extract mod name from title
        name_match = re.search(r'<div class="workshopItemTitle">([^<]+)</div>', html)
        name = name_match.group(1).strip() if name_match else None
        
        # Extract ALL Mod IDs from description
        # Looking for patterns like "Mod ID: xxx" or "Mod ID: <b>xxx</b>"
        mod_ids = []
        
        # Find all matches with <b> tags
        for match in re.finditer(r'Mod\s*ID:\s*<b>([A-Za-z0-9_-]+)</b>', html, re.IGNORECASE):
            mod_id = match.group(1).strip()
            if mod_id and mod_id not in mod_ids:
                mod_ids.append(mod_id)
        
        # Also find plain text patterns (but avoid duplicates)
        for match in re.finditer(r'Mod\s*ID:\s*([A-Za-z0-9_-]+)(?!</b>)', html, re.IGNORECASE):
            mod_id = match.group(1).strip()
            # Skip if it's part of HTML tag or already found
            if mod_id and mod_id not in mod_ids and mod_id.lower() not in ['b', 'br', 'div', 'span']:
                mod_ids.append(mod_id)
        
        return ModParseResponse(
            workshop_id=workshop_id,
            mod_ids=mod_ids,
            name=name
        )
        
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to fetch workshop page: {str(e)}"
        )


@app.get("/servers/{server_id}/mods", response_model=List[ModResponse])
async def list_server_mods(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """List all mods for a server"""
    result = await db.execute(
        select(ServerMod)
        .where(ServerMod.server_id == server_id)
        .order_by(ServerMod.name)
    )
    mods = result.scalars().all()
    
    # Convert stored semicolon-separated strings to lists
    response = []
    for mod in mods:
        mod_ids = mod.mod_ids.split(';') if mod.mod_ids else []
        enabled_mod_ids = mod.enabled_mod_ids.split(';') if mod.enabled_mod_ids else []
        response.append(ModResponse(
            id=mod.id,
            server_id=mod.server_id,
            workshop_id=mod.workshop_id,
            mod_ids=mod_ids,
            enabled_mod_ids=enabled_mod_ids,
            name=mod.name,
            is_enabled=mod.is_enabled,
            workshop_url=mod.workshop_url,
            created_at=mod.created_at,
            updated_at=mod.updated_at
        ))
    return response


@app.post("/servers/{server_id}/mods", response_model=ModResponse, status_code=status.HTTP_201_CREATED)
async def add_server_mod(
    server_id: int,
    mod: ModCreate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Add a mod to server (one record per workshop_id with multiple mod_ids)"""
    # Check if mod already exists for this server
    result = await db.execute(
        select(ServerMod).where(
            ServerMod.server_id == server_id,
            ServerMod.workshop_id == mod.workshop_id
        )
    )
    existing_mod = result.scalar_one_or_none()
    
    if existing_mod:
        # Update existing record - merge mod_ids
        existing_mod_ids = existing_mod.mod_ids.split(';') if existing_mod.mod_ids else []
        new_mod_ids = list(set(existing_mod_ids + mod.mod_ids))  # Merge and dedupe
        existing_mod.mod_ids = ';'.join(new_mod_ids)
        
        # Merge enabled_mod_ids
        existing_enabled = existing_mod.enabled_mod_ids.split(';') if existing_mod.enabled_mod_ids else []
        new_enabled = list(set(existing_enabled + mod.enabled_mod_ids))
        existing_mod.enabled_mod_ids = ';'.join(new_enabled)
        
        existing_mod.is_enabled = len(new_enabled) > 0
        existing_mod.updated_at = datetime.utcnow()
        
        await db.commit()
        await db.refresh(existing_mod)
        
        return ModResponse(
            id=existing_mod.id,
            server_id=existing_mod.server_id,
            workshop_id=existing_mod.workshop_id,
            mod_ids=new_mod_ids,
            enabled_mod_ids=new_enabled,
            name=existing_mod.name,
            is_enabled=existing_mod.is_enabled,
            workshop_url=existing_mod.workshop_url,
            created_at=existing_mod.created_at,
            updated_at=existing_mod.updated_at
        )
    
    # Create new record
    mod_ids_str = ';'.join(mod.mod_ids) if mod.mod_ids else ''
    enabled_mod_ids_str = ';'.join(mod.enabled_mod_ids) if mod.enabled_mod_ids else ''
    
    db_mod = ServerMod(
        server_id=server_id,
        workshop_id=mod.workshop_id,
        mod_ids=mod_ids_str,
        enabled_mod_ids=enabled_mod_ids_str,
        name=mod.name,
        is_enabled=len(mod.enabled_mod_ids) > 0,
        workshop_url=f"https://steamcommunity.com/sharedfiles/filedetails/?id={mod.workshop_id}"
    )
    
    db.add(db_mod)
    await db.commit()
    await db.refresh(db_mod)
    
    return ModResponse(
        id=db_mod.id,
        server_id=db_mod.server_id,
        workshop_id=db_mod.workshop_id,
        mod_ids=mod.mod_ids,
        enabled_mod_ids=mod.enabled_mod_ids,
        name=db_mod.name,
        is_enabled=db_mod.is_enabled,
        workshop_url=db_mod.workshop_url,
        created_at=db_mod.created_at,
        updated_at=db_mod.updated_at
    )


@app.put("/servers/{server_id}/mods/{mod_id}", response_model=ModResponse)
async def update_server_mod(
    server_id: int,
    mod_id: int,
    mod_update: ModUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Update a mod"""
    result = await db.execute(
        select(ServerMod).where(
            ServerMod.id == mod_id,
            ServerMod.server_id == server_id
        )
    )
    mod = result.scalar_one_or_none()
    
    if not mod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mod not found"
        )
    
    update_data = mod_update.model_dump(exclude_unset=True)
    
    # Handle list fields - convert to semicolon-separated strings
    if 'mod_ids' in update_data:
        mod.mod_ids = ';'.join(update_data['mod_ids']) if update_data['mod_ids'] else ''
        del update_data['mod_ids']
    
    if 'enabled_mod_ids' in update_data:
        mod.enabled_mod_ids = ';'.join(update_data['enabled_mod_ids']) if update_data['enabled_mod_ids'] else ''
        # Update is_enabled based on whether any mod_ids are enabled
        mod.is_enabled = len(update_data['enabled_mod_ids']) > 0
        del update_data['enabled_mod_ids']
    
    # Handle other fields
    for field, value in update_data.items():
        setattr(mod, field, value)
    
    mod.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(mod)
    
    # Convert back to list for response
    mod_ids_list = mod.mod_ids.split(';') if mod.mod_ids else []
    enabled_mod_ids_list = mod.enabled_mod_ids.split(';') if mod.enabled_mod_ids else []
    
    return ModResponse(
        id=mod.id,
        server_id=mod.server_id,
        workshop_id=mod.workshop_id,
        mod_ids=mod_ids_list,
        enabled_mod_ids=enabled_mod_ids_list,
        name=mod.name,
        is_enabled=mod.is_enabled,
        workshop_url=mod.workshop_url,
        created_at=mod.created_at,
        updated_at=mod.updated_at
    )


@app.delete("/servers/{server_id}/mods/{mod_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_server_mod(
    server_id: int,
    mod_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Delete a mod from server"""
    result = await db.execute(
        select(ServerMod).where(
            ServerMod.id == mod_id,
            ServerMod.server_id == server_id
        )
    )
    mod = result.scalar_one_or_none()
    
    if not mod:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mod not found"
        )
    
    await db.delete(mod)
    await db.commit()


@app.post("/servers/{server_id}/mods/apply")
async def apply_mods_to_server(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Apply mods configuration to server via RCON"""
    if not rcon_manager.is_connected(server_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Not connected to server {server_id}. Connect first."
        )
    
    # Get all mods that have enabled mod_ids
    result = await db.execute(
        select(ServerMod).where(
            ServerMod.server_id == server_id,
            ServerMod.is_enabled == True
        )
    )
    enabled_mods = result.scalars().all()
    
    if not enabled_mods:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No enabled mods to apply"
        )
    
    # Build mod strings from enabled_mod_ids
    all_mod_ids = []
    all_workshop_ids = []
    
    for mod in enabled_mods:
        enabled_mod_ids = mod.enabled_mod_ids.split(';') if mod.enabled_mod_ids else []
        if enabled_mod_ids:
            all_mod_ids.extend(enabled_mod_ids)
            # Add workshop_id once for each mod record that has enabled mod_ids
            all_workshop_ids.append(mod.workshop_id)
    
    if not all_mod_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No enabled mod IDs to apply"
        )
    
    # Build command strings with backslash prefix for mod_ids
    mod_ids_str = ";".join([f"\\{mid}" for mid in all_mod_ids])
    workshop_ids_str = ";".join(all_workshop_ids)
    
    try:
        # Execute changeoption commands
        mods_result = rcon_manager.execute_command(
            server_id, 
            f'changeoption Mods "{mod_ids_str}"'
        )
        
        workshop_result = rcon_manager.execute_command(
            server_id,
            f'changeoption WorkshopItems "{workshop_ids_str}"'
        )
        
        return {
            "success": True,
            "mods_command": f'changeoption Mods "{mod_ids_str}"',
            "workshop_command": f'changeoption WorkshopItems "{workshop_ids_str}"',
            "mods_result": mods_result,
            "workshop_result": workshop_result,
            "enabled_count": len(all_mod_ids),
            "workshops_count": len(all_workshop_ids)
        }
        
    except RCONError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/servers/{server_id}/mods/export", response_model=ModsExport)
async def export_server_mods(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Export all mods for a server"""
    result = await db.execute(
        select(ServerMod).where(ServerMod.server_id == server_id)
    )
    mods = result.scalars().all()
    
    return ModsExport(
        mods=[
            ModCreate(
                workshop_id=mod.workshop_id,
                mod_ids=mod.mod_ids.split(';') if mod.mod_ids else [],
                enabled_mod_ids=mod.enabled_mod_ids.split(';') if mod.enabled_mod_ids else [],
                name=mod.name,
                is_enabled=mod.is_enabled
            )
            for mod in mods
        ]
    )


@app.get("/servers/{server_id}/mods/download")
async def download_server_mods(
    server_id: int,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """Download mods as JSON file"""
    # Verify token manually since we get it from query param
    try:
        verify_token(token)
    except:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Get server name for filename
    server_result = await db.execute(select(Server).where(Server.id == server_id))
    server = server_result.scalar_one_or_none()
    server_name = server.name if server else f"server_{server_id}"
    # Sanitize filename
    server_name = re.sub(r'[^a-zA-Z0-9а-яА-ЯіІїЇєЄ_-]', '_', server_name)
    
    result = await db.execute(
        select(ServerMod).where(ServerMod.server_id == server_id)
    )
    mods = result.scalars().all()
    
    export_data = {
        "mods": [
            {
                "workshop_id": mod.workshop_id,
                "mod_ids": mod.mod_ids.split(';') if mod.mod_ids else [],
                "enabled_mod_ids": mod.enabled_mod_ids.split(';') if mod.enabled_mod_ids else [],
                "name": mod.name,
                "is_enabled": mod.is_enabled
            }
            for mod in mods
        ]
    }
    
    from datetime import datetime
    now = datetime.now()
    filename = f"{server_name}_{now.strftime('%Y-%m-%d_%H-%M-%S')}.json"
    
    return Response(
        content=json.dumps(export_data, indent=2, ensure_ascii=False),
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@app.post("/servers/{server_id}/mods/import", status_code=status.HTTP_201_CREATED)
async def import_server_mods(
    server_id: int,
    mods_export: ModsExport,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Import mods to a server"""
    imported = 0
    updated = 0
    
    for mod_data in mods_export.mods:
        # Check if already exists
        result = await db.execute(
            select(ServerMod).where(
                ServerMod.server_id == server_id,
                ServerMod.workshop_id == mod_data.workshop_id
            )
        )
        existing = result.scalar_one_or_none()
        
        if existing:
            # Update existing - merge mod_ids
            existing_mod_ids = existing.mod_ids.split(';') if existing.mod_ids else []
            new_mod_ids = list(set(existing_mod_ids + mod_data.mod_ids))
            existing.mod_ids = ';'.join(new_mod_ids)
            
            # Merge enabled_mod_ids
            existing_enabled = existing.enabled_mod_ids.split(';') if existing.enabled_mod_ids else []
            new_enabled = list(set(existing_enabled + mod_data.enabled_mod_ids))
            existing.enabled_mod_ids = ';'.join(new_enabled)
            existing.is_enabled = len(new_enabled) > 0
            existing.updated_at = datetime.utcnow()
            updated += 1
        else:
            # Create new
            db_mod = ServerMod(
                server_id=server_id,
                workshop_id=mod_data.workshop_id,
                mod_ids=';'.join(mod_data.mod_ids) if mod_data.mod_ids else '',
                enabled_mod_ids=';'.join(mod_data.enabled_mod_ids) if mod_data.enabled_mod_ids else '',
                name=mod_data.name,
                is_enabled=len(mod_data.enabled_mod_ids) > 0,
                workshop_url=f"https://steamcommunity.com/sharedfiles/filedetails/?id={mod_data.workshop_id}"
            )
            db.add(db_mod)
            imported += 1
    
    await db.commit()
    
    return {"imported": imported, "updated": updated}


@app.get("/servers/{server_id}/mods/server-workshop-ids")
async def get_server_workshop_ids(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    Get list of workshop IDs from server via RCON showoptions.
    Returns workshop_ids that are NOT yet in the database for this server.
    """
    if not rcon_manager.is_connected(server_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Not connected to server {server_id}. Connect first."
        )
    
    try:
        # Get current server options
        response = rcon_manager.execute_command(server_id, "showoptions")
        
        # Parse WorkshopItems
        server_workshops = []
        server_mods = []
        
        for line in response.split('\n'):
            line = line.strip()
            if 'WorkshopItems=' in line:
                workshops_part = line.split('WorkshopItems=')[1].strip().strip('"')
                server_workshops = [w.strip() for w in workshops_part.split(';') if w.strip()]
            elif 'Mods=' in line:
                mods_part = line.split('Mods=')[1].strip().strip('"')
                server_mods = [m.lstrip('\\').strip() for m in mods_part.split(';') if m.strip()]
        
        # Get existing workshop IDs from database
        result = await db.execute(
            select(ServerMod.workshop_id).where(ServerMod.server_id == server_id)
        )
        existing_workshop_ids = set(row[0] for row in result.fetchall())
        
        # Filter out already existing ones
        new_workshop_ids = [wid for wid in server_workshops if wid not in existing_workshop_ids]
        existing_on_server = [wid for wid in server_workshops if wid in existing_workshop_ids]
        
        # Create workshop_id -> mod_id mapping for existing ones that need update
        workshop_to_mod = {}
        for i, wid in enumerate(server_workshops):
            if i < len(server_mods):
                workshop_to_mod[wid] = server_mods[i]
        
        return {
            "new_workshop_ids": new_workshop_ids,
            "existing_workshop_ids": existing_on_server,
            "workshop_to_mod": workshop_to_mod,
            "total_on_server": len(server_workshops)
        }
        
    except RCONError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RCON error: {str(e)}"
        )


@app.post("/servers/{server_id}/mods/sync")
async def sync_mods_from_server(
    server_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    Synchronize mods from server with local database.
    - Fetches current mods from server via showoptions
    - Groups mods by workshop_id
    - Stores all mod_ids for each workshop_id
    - Marks which mod_ids are enabled based on server state
    """
    if not rcon_manager.is_connected(server_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Not connected to server {server_id}. Connect first."
        )
    
    sync_result = {
        "added": 0,
        "updated": 0,
        "errors": [],
        "mods_found": []
    }
    
    try:
        # Get current server options
        response = rcon_manager.execute_command(server_id, "showoptions")
        
        # Parse Mods and WorkshopItems
        server_mods = []  # List of mod_id
        server_workshops = []  # List of workshop_id
        
        for line in response.split('\n'):
            line = line.strip()
            # Handle "* Mods=" or "Mods=" format
            if 'Mods=' in line:
                mods_part = line.split('Mods=')[1].strip().strip('"')
                # Split by ; and remove \ prefix
                server_mods = [m.lstrip('\\').strip() for m in mods_part.split(';') if m.strip()]
            elif 'WorkshopItems=' in line:
                workshops_part = line.split('WorkshopItems=')[1].strip().strip('"')
                server_workshops = [w.strip() for w in workshops_part.split(';') if w.strip()]
        
        # Create mapping: workshop_id -> list of mod_ids
        # The order of Mods and WorkshopItems should correspond
        workshop_to_mods = {}
        for i, workshop_id in enumerate(server_workshops):
            if workshop_id not in workshop_to_mods:
                workshop_to_mods[workshop_id] = []
            if i < len(server_mods):
                workshop_to_mods[workshop_id].append(server_mods[i])
        
        # Get all existing mods from database for this server
        result = await db.execute(
            select(ServerMod).where(ServerMod.server_id == server_id)
        )
        db_mods_by_workshop = {mod.workshop_id: mod for mod in result.scalars().all()}
        
        # Disable all mods first (we'll enable the active ones)
        for mod in db_mods_by_workshop.values():
            mod.is_enabled = False
            mod.enabled_mod_ids = ''
        
        # Process each workshop item from server
        async with httpx.AsyncClient(timeout=15.0) as client:
            for workshop_id, active_mod_ids in workshop_to_mods.items():
                try:
                    existing_mod = db_mods_by_workshop.get(workshop_id)
                    
                    if existing_mod:
                        # Update existing record
                        existing_mod_ids = existing_mod.mod_ids.split(';') if existing_mod.mod_ids else []
                        # Merge with new mod_ids
                        merged_mod_ids = list(set(existing_mod_ids + active_mod_ids))
                        existing_mod.mod_ids = ';'.join(merged_mod_ids)
                        # Set enabled mod_ids to the ones currently on server
                        existing_mod.enabled_mod_ids = ';'.join(active_mod_ids)
                        existing_mod.is_enabled = len(active_mod_ids) > 0
                        existing_mod.updated_at = datetime.utcnow()
                        sync_result["updated"] += 1
                        sync_result["mods_found"].append({
                            "workshop_id": workshop_id,
                            "mod_ids": merged_mod_ids,
                            "enabled_mod_ids": active_mod_ids,
                            "name": existing_mod.name,
                            "status": "updated"
                        })
                    else:
                        # New workshop item - fetch name from Steam
                        name = await fetch_mod_name_from_steam(client, workshop_id)
                        
                        new_mod = ServerMod(
                            server_id=server_id,
                            workshop_id=workshop_id,
                            mod_ids=';'.join(active_mod_ids),
                            enabled_mod_ids=';'.join(active_mod_ids),
                            name=name or f"Workshop {workshop_id}",
                            is_enabled=len(active_mod_ids) > 0,
                            workshop_url=f"https://steamcommunity.com/sharedfiles/filedetails/?id={workshop_id}"
                        )
                        db.add(new_mod)
                        sync_result["added"] += 1
                        sync_result["mods_found"].append({
                            "workshop_id": workshop_id,
                            "mod_ids": active_mod_ids,
                            "enabled_mod_ids": active_mod_ids,
                            "name": name,
                            "status": "added"
                        })
                        
                except Exception as e:
                    sync_result["errors"].append(f"Error processing workshop {workshop_id}: {str(e)}")
        
        await db.commit()
        
        sync_result["success"] = True
        sync_result["server_mods_count"] = len(server_mods)
        sync_result["server_workshops_count"] = len(server_workshops)
        
        return sync_result
        
    except RCONError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RCON error: {str(e)}"
        )


async def fetch_mod_name_from_steam(client: httpx.AsyncClient, workshop_id: str) -> str | None:
    """Fetch mod name from Steam Workshop page"""
    try:
        response = await client.get(
            f"https://steamcommunity.com/sharedfiles/filedetails/?id={workshop_id}",
            follow_redirects=True
        )
        html = response.text
        name_match = re.search(r'<div class="workshopItemTitle">([^<]+)</div>', html)
        return name_match.group(1).strip() if name_match else None
    except:
        return None


async def fetch_mod_id_from_steam(client: httpx.AsyncClient, workshop_id: str) -> str | None:
    """Fetch ModId from Steam Workshop page description"""
    try:
        response = await client.get(
            f"https://steamcommunity.com/sharedfiles/filedetails/?id={workshop_id}",
            follow_redirects=True
        )
        html = response.text
        # Look for "Mod ID: <b>xxx</b>" pattern first
        mod_id_match = re.search(r'Mod\s*ID:\s*<b>([A-Za-z0-9_-]+)</b>', html, re.IGNORECASE)
        if mod_id_match:
            return mod_id_match.group(1).strip()
        # Fallback to plain text pattern
        mod_id_match = re.search(r'Mod\s*ID:\s*([A-Za-z0-9_-]+)', html, re.IGNORECASE)
        return mod_id_match.group(1).strip() if mod_id_match else None
    except:
        return None


@app.get("/servers/{server_id}/commands", response_model=List[dict])
async def get_command_history(
    server_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Get command execution history for server"""
    result = await db.execute(
        select(CommandLog)
        .where(CommandLog.server_id == server_id)
        .order_by(CommandLog.executed_at.desc())
        .limit(limit)
    )
    logs = result.scalars().all()
    
    return [
        {
            "id": log.id,
            "command": log.command,
            "response": log.response,
            "success": log.success,
            "error_message": log.error_message,
            "executed_at": log.executed_at
        }
        for log in logs
    ]


# ============= Server State =============

@app.get("/servers/{server_id}/state/latest", response_model=ServerStateResponse)
async def get_latest_server_state(
    server_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get latest server state snapshot"""
    result = await db.execute(
        select(ServerState)
        .where(ServerState.server_id == server_id)
        .order_by(ServerState.timestamp.desc())
        .limit(1)
    )
    state = result.scalar_one_or_none()
    
    if not state:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No state data found for server {server_id}"
        )
    
    return state


@app.get("/servers/{server_id}/state/history", response_model=List[ServerStateResponse])
async def get_server_state_history(
    server_id: int,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get server state history"""
    result = await db.execute(
        select(ServerState)
        .where(ServerState.server_id == server_id)
        .order_by(ServerState.timestamp.desc())
        .limit(limit)
    )
    states = result.scalars().all()
    
    return states


# ============= Static Files (React SPA) =============

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Serve React SPA for all non-API routes"""
    # Check if static directory exists
    if not STATIC_DIR.exists():
        return {"error": "Static files not found. Run in development mode or build frontend."}
    
    # Try to serve the requested file
    file_path = STATIC_DIR / full_path
    if file_path.exists() and file_path.is_file():
        return FileResponse(file_path)
    
    # Fallback to index.html for SPA routing
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    
    return {"error": "index.html not found"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True
    )
