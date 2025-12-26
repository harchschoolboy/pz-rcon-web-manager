import struct
import socket
import asyncio
import logging
from typing import Optional
from app.config import settings

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rcon")

# Reduce noise from other loggers
logging.getLogger("aiosqlite").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy").setLevel(logging.WARNING)


class RCONError(Exception):
    """Base exception for RCON errors"""
    pass


class RCONAuthError(RCONError):
    """Authentication failed"""
    pass


class RCONConnectionError(RCONError):
    """Connection failed"""
    pass


class RCONClient:
    """
    RCON client for Project Zomboid server communication
    Based on Source RCON Protocol
    """
    
    # Packet types
    SERVERDATA_AUTH = 3
    SERVERDATA_AUTH_RESPONSE = 2
    SERVERDATA_EXECCOMMAND = 2
    SERVERDATA_RESPONSE_VALUE = 0
    
    def __init__(self, host: str, port: int, password: str, timeout: int = None):
        self.host = host
        self.port = port
        self.password = password
        self.timeout = timeout or settings.rcon_timeout
        
        self._socket: Optional[socket.socket] = None
        self._request_id = 0
        self._connected = False
        self._authenticated = False
        
        logger.info(f"RCONClient initialized for {host}:{port}")
    
    def _get_next_id(self) -> int:
        """Generate next request ID"""
        self._request_id += 1
        return self._request_id
    
    def _pack_packet(self, packet_id: int, packet_type: int, body: str) -> bytes:
        """Pack data into RCON packet format"""
        body_bytes = body.encode('utf-8') + b'\x00\x00'
        size = len(body_bytes) + 8  # 4 bytes for ID + 4 bytes for type
        
        packet = struct.pack('<i', size) + \
               struct.pack('<i', packet_id) + \
               struct.pack('<i', packet_type) + \
               body_bytes
        
        logger.debug(f"Packed packet: id={packet_id}, type={packet_type}, body='{body[:50]}...', size={size}")
        logger.debug(f"Raw packet hex: {packet.hex()}")
        return packet
    
    def _unpack_packet(self, data: bytes) -> tuple[int, int, str]:
        """Unpack RCON packet"""
        logger.debug(f"Unpacking {len(data)} bytes: {data[:100].hex()}...")
        
        if len(data) < 4:
            logger.warning(f"Packet too short: {len(data)} bytes")
            return 0, 0, ""
        
        size = struct.unpack('<i', data[0:4])[0]
        logger.debug(f"Packet size from header: {size}")
        
        if len(data) < 12:
            logger.warning(f"Packet incomplete: have {len(data)}, need at least 12")
            return 0, 0, ""
        
        packet_id = struct.unpack('<i', data[4:8])[0]
        packet_type = struct.unpack('<i', data[8:12])[0]
        
        # Body might be empty
        if size > 8:
            body = data[12:12+size-8].decode('utf-8', errors='ignore').rstrip('\x00')
        else:
            body = ""
        
        logger.debug(f"Unpacked: id={packet_id}, type={packet_type}, body='{body[:100]}'")
        return packet_id, packet_type, body
    
    def connect(self) -> None:
        """Establish connection to RCON server"""
        logger.info(f"Connecting to {self.host}:{self.port}...")
        try:
            self._socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self._socket.settimeout(self.timeout)
            self._socket.connect((self.host, self.port))
            self._connected = True
            logger.info(f"Connected successfully to {self.host}:{self.port}")
        except socket.error as e:
            logger.error(f"Connection failed: {e}")
            raise RCONConnectionError(f"Failed to connect to {self.host}:{self.port}: {e}")
    
    def authenticate(self) -> None:
        """Authenticate with RCON server"""
        if not self._connected:
            raise RCONError("Not connected")
        
        logger.info("Authenticating...")
        request_id = self._get_next_id()
        packet = self._pack_packet(request_id, self.SERVERDATA_AUTH, self.password)
        
        try:
            self._socket.send(packet)
            logger.debug(f"Sent auth packet, waiting for response...")
            
            # Read response
            response_data = self._socket.recv(4096)
            logger.debug(f"Received {len(response_data)} bytes")
            
            response_id, response_type, _ = self._unpack_packet(response_data)
            
            # Check for auth failure (ID = -1)
            if response_id == -1:
                logger.error("Authentication failed: invalid password")
                raise RCONAuthError("Authentication failed: invalid password")
            
            self._authenticated = True
            logger.info("Authentication successful")
            
        except socket.error as e:
            logger.error(f"Authentication error: {e}")
            raise RCONConnectionError(f"Authentication error: {e}")
    
    def execute(self, command: str) -> str:
        """Execute command on RCON server"""
        if not self._authenticated:
            raise RCONError("Not authenticated")
        
        logger.info(f"Executing command: '{command}'")
        request_id = self._get_next_id()
        packet = self._pack_packet(request_id, self.SERVERDATA_EXECCOMMAND, command)
        
        try:
            self._socket.send(packet)
            logger.debug(f"Sent command packet")
            
            # Read response - may come in multiple packets
            response_parts = []
            self._socket.settimeout(2)  # Short timeout for reading responses
            
            while True:
                try:
                    response_data = self._socket.recv(4096)
                    logger.debug(f"Received {len(response_data)} bytes")
                    
                    if not response_data:
                        logger.debug("Empty response, breaking")
                        break
                    
                    _, response_type, body = self._unpack_packet(response_data)
                    logger.debug(f"Parsed body: '{body[:200] if body else '(empty)'}'")
                    
                    if body:
                        response_parts.append(body)
                        
                except socket.timeout:
                    logger.debug("Socket timeout, no more data")
                    break
            
            # Restore original timeout
            self._socket.settimeout(self.timeout)
            
            result = '\n'.join(response_parts) if response_parts else "(команда виконана без відповіді)"
            logger.info(f"Command result: '{result[:200]}...'")
            return result
            
        except socket.error as e:
            logger.error(f"Command execution error: {e}")
            self._connected = False
            self._authenticated = False
            raise RCONConnectionError(f"Command execution error: {e}")
    
    def disconnect(self) -> None:
        """Close connection"""
        if self._socket:
            try:
                self._socket.close()
            except:
                pass
            finally:
                self._socket = None
                self._connected = False
                self._authenticated = False
    
    def __enter__(self):
        """Context manager entry"""
        self.connect()
        self.authenticate()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.disconnect()


class RCONManager:
    """
    Manager for persistent RCON connections
    Handles reconnection and connection pooling
    """
    
    def __init__(self):
        self._connections: dict[int, RCONClient] = {}
        self._active_tasks: dict[int, asyncio.Task] = {}
    
    async def connect(self, server_id: int, host: str, port: int, password: str, username: str = None) -> None:
        """Establish and maintain connection to server"""
        client = RCONClient(host, port, password)
        
        try:
            client.connect()
            client.authenticate()
            self._connections[server_id] = client
            
            # PZ RCON requires login command after AUTH
            if username:
                logger.info(f"Performing PZ login with username: {username}")
                login_result = client.execute(f"login {username} {password}")
                logger.info(f"Login result: {login_result}")
            
        except (RCONConnectionError, RCONAuthError) as e:
            raise RCONError(f"Failed to connect to server {server_id}: {e}")
    
    def disconnect(self, server_id: int) -> None:
        """Disconnect from server"""
        if server_id in self._connections:
            self._connections[server_id].disconnect()
            del self._connections[server_id]
    
    def execute_command(self, server_id: int, command: str) -> str:
        """Execute command on connected server"""
        if server_id not in self._connections:
            raise RCONError(f"Not connected to server {server_id}")
        
        client = self._connections[server_id]
        
        try:
            return client.execute(command)
        except RCONConnectionError:
            # Connection lost, remove from pool
            self.disconnect(server_id)
            raise
    
    def is_connected(self, server_id: int) -> bool:
        """Check if connected to server"""
        return server_id in self._connections and self._connections[server_id]._authenticated
    
    def disconnect_all(self) -> None:
        """Disconnect all servers"""
        for server_id in list(self._connections.keys()):
            self.disconnect(server_id)


# Global RCON manager instance
rcon_manager = RCONManager()
