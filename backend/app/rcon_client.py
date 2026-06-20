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
        # Raw byte buffer for length-framed packet reassembly. TCP is a byte
        # stream, so a single recv() may contain a partial packet, multiple
        # packets, or a packet split across reads. We buffer and frame manually.
        self._recv_buffer = b''
        
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
    
    def _recv_into_buffer(self) -> bool:
        """Pull more bytes from the socket into the receive buffer.

        Returns True if bytes were appended, False on a socket timeout (which we
        use to detect "no more data is coming"). Raises on a closed connection.
        """
        chunk = self._socket.recv(4096)
        if not chunk:
            raise RCONConnectionError("Connection closed by server")
        self._recv_buffer += chunk
        logger.debug(f"Buffered {len(chunk)} bytes (buffer now {len(self._recv_buffer)})")
        return True

    def _read_packet(self) -> Optional[tuple[int, int, str]]:
        """Read exactly one complete RCON packet using length framing.

        RCON packets are prefixed with a 4-byte little-endian size that covers
        the id (4) + type (4) + body + 2 null terminators. We wait until the
        whole frame is in the buffer before parsing, so TCP segmentation can no
        longer split a packet (which previously corrupted large responses and
        injected stray newlines). Returns None when the socket times out while
        waiting for the next packet, signalling the end of the response.
        """
        # Wait for the 4-byte length prefix. A timeout here means no further
        # packet is pending -> end of this response.
        while len(self._recv_buffer) < 4:
            try:
                self._recv_into_buffer()
            except socket.timeout:
                return None

        size = struct.unpack('<i', self._recv_buffer[0:4])[0]
        if size < 8 or size > 4 * 1024 * 1024:
            raise RCONConnectionError(f"Invalid RCON packet size: {size}")

        total = 4 + size
        # We are now mid-packet: the remaining bytes are in flight, so keep
        # reading (tolerating a few transient timeouts) until the frame is whole.
        consecutive_timeouts = 0
        while len(self._recv_buffer) < total:
            try:
                self._recv_into_buffer()
                consecutive_timeouts = 0
            except socket.timeout:
                consecutive_timeouts += 1
                if consecutive_timeouts > 5:
                    raise RCONConnectionError("Timed out reading packet body")

        frame = self._recv_buffer[:total]
        self._recv_buffer = self._recv_buffer[total:]

        packet_id = struct.unpack('<i', frame[4:8])[0]
        packet_type = struct.unpack('<i', frame[8:12])[0]
        # Body is everything after the header, up to the first null terminator.
        body = frame[12:total].split(b'\x00', 1)[0].decode('utf-8', errors='ignore')

        logger.debug(f"Read packet: id={packet_id}, type={packet_type}, body_len={len(body)}")
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
            self._recv_buffer = b''
            self._socket.send(packet)
            logger.debug(f"Sent auth packet, waiting for response...")

            # The server may send an empty SERVERDATA_RESPONSE_VALUE before the
            # actual auth response; read framed packets until we get the auth
            # response (type 2) or run out of data.
            response_id = 0
            while True:
                pkt = self._read_packet()
                if pkt is None:
                    raise RCONConnectionError("No authentication response from server")
                response_id, response_type, _ = pkt
                if response_type == self.SERVERDATA_AUTH_RESPONSE:
                    break

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
            self._recv_buffer = b''
            self._socket.send(packet)
            logger.debug(f"Sent command packet")
            
            # Read the response as length-framed packets. A large response (e.g.
            # showoptions / WorkshopItems) may arrive as one big packet or be
            # split by the server into several RESPONSE_VALUE packets; either way
            # we reassemble bodies in order with NO separator, so the original
            # text is reproduced exactly.
            response_parts = []
            self._socket.settimeout(2)  # Short timeout to detect end-of-response

            try:
                while True:
                    pkt = self._read_packet()
                    if pkt is None:
                        # Timed out waiting for the next packet -> response done.
                        logger.debug("No more packets, response complete")
                        break
                    _, _, body = pkt
                    if body:
                        response_parts.append(body)
            finally:
                # Restore original timeout
                self._socket.settimeout(self.timeout)
            
            result = ''.join(response_parts) if response_parts else "(команда виконана без відповіді)"
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
                self._recv_buffer = b''
    
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
