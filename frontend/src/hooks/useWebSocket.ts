import { useEffect, useRef, useCallback } from 'react';
import { useServerStore } from '../store/serverStore';

interface WSMessage {
  type: string;
  server_id?: number;
  connected?: boolean;
  current?: number;
  max?: number;
  timestamp?: string;
  [key: string]: unknown;
}

const WS_RECONNECT_DELAY = 3000;
const WS_PING_INTERVAL = 30000;
const STATUS_CHECK_INTERVAL = 10000; // Check connection every 10 seconds

export const useWebSocket = () => {
  const {
    selectedServerId,
    setConnectionStatus,
    setPlayersOnline,
  } = useServerStore();

  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (statusCheckIntervalRef.current) {
      clearInterval(statusCheckIntervalRef.current);
      statusCheckIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!selectedServerId) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Get auth token
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.warn('WebSocket: No auth token, skipping connection');
      return;
    }

    // Determine WebSocket URL with token
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/${selectedServerId}?token=${encodeURIComponent(token)}`;

    console.log('WebSocket connecting to:', wsUrl.replace(token, '***'));

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      
      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, WS_PING_INTERVAL);

      // Start status check interval - request players count every 10 sec
      statusCheckIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'check_players' }));
        }
      }, STATUS_CHECK_INTERVAL);
    };

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        
        switch (message.type) {
          case 'connection_status':
            if (message.server_id === selectedServerId) {
              setConnectionStatus(message.connected ? 'connected' : 'disconnected');
              if (!message.connected) {
                setPlayersOnline(null);
              }
            }
            break;
          
          case 'players_count':
            if (message.server_id === selectedServerId) {
              if (message.connected === true) {
                setPlayersOnline({ 
                  current: message.current ?? 0, 
                  max: message.max ?? 0 
                });
                setConnectionStatus('connected');
              } else {
                // Failed to get players - server might be down
                setConnectionStatus('disconnected');
                setPlayersOnline(null);
              }
            }
            break;
          
          case 'pong':
            // Keepalive response, ignore
            break;
          
          default:
            console.log('Unknown WS message:', message);
        }
      } catch (e) {
        console.error('Failed to parse WS message:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      clearTimers();
      
      // Reconnect after delay
      reconnectTimeoutRef.current = setTimeout(() => {
        if (selectedServerId) {
          connect();
        }
      }, WS_RECONNECT_DELAY);
    };
  }, [selectedServerId, setConnectionStatus, setPlayersOnline, clearTimers]);

  const disconnect = useCallback(() => {
    clearTimers();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, [clearTimers]);

  const sendMessage = useCallback((message: object) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const requestStatus = useCallback(() => {
    sendMessage({ type: 'get_status' });
  }, [sendMessage]);

  const requestPlayers = useCallback(() => {
    sendMessage({ type: 'check_players' });
  }, [sendMessage]);

  // Connect when server changes
  useEffect(() => {
    if (selectedServerId) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [selectedServerId]);

  return {
    sendMessage,
    requestStatus,
    requestPlayers,
  };
};
