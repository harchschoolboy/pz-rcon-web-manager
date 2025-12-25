import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useServerStore, ConnectionStatus } from '../../store/serverStore';
import { useI18n } from '../../i18n';
import { connectionAPI, commandAPI } from '../../api/client';
import { Wifi, WifiOff, Loader2, RefreshCw, Users, RotateCcw } from 'lucide-react';

const RECONNECT_DELAYS = [5, 10, 15, 30, 60]; // seconds

export const ConnectionIndicator: React.FC = () => {
  const { t } = useI18n();
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const {
    selectedServerId,
    connectionStatus,
    autoReconnect,
    reconnectAttempt,
    reconnectCountdown,
    playersOnline,
    setConnectionStatus,
    setAutoReconnect,
    setReconnectAttempt,
    setReconnectCountdown,
    getSelectedServer,
  } = useServerStore();

  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!selectedServerId) return;

    setConnectionStatus('connecting');
    clearTimers();

    try {
      await connectionAPI.connect(selectedServerId);
      setConnectionStatus('connected');
      setReconnectAttempt(0);
    } catch (err) {
      console.error('Connection failed:', err);
      setConnectionStatus('disconnected');

      // Start reconnect if enabled
      if (autoReconnect) {
        scheduleReconnect();
      }
    }
  }, [selectedServerId, autoReconnect]);

  const disconnect = useCallback(async () => {
    if (!selectedServerId) return;

    clearTimers();
    setReconnectAttempt(0);
    setReconnectCountdown(0);

    try {
      await connectionAPI.disconnect(selectedServerId);
    } catch (err) {
      console.error('Disconnect error:', err);
    }
    setConnectionStatus('disconnected');
  }, [selectedServerId]);

  const scheduleReconnect = useCallback(() => {
    const attempt = reconnectAttempt;
    const delayIndex = Math.min(attempt, RECONNECT_DELAYS.length - 1);
    const delay = RECONNECT_DELAYS[delayIndex];

    setConnectionStatus('reconnecting');
    let countdown = delay;
    setReconnectCountdown(countdown);

    // Countdown timer
    countdownTimerRef.current = setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) {
        clearInterval(countdownTimerRef.current!);
        setReconnectCountdown(0);
      } else {
        setReconnectCountdown(countdown);
      }
    }, 1000);

    // Actual reconnect timer
    reconnectTimerRef.current = setTimeout(() => {
      setReconnectAttempt(attempt + 1);
      connect();
    }, delay * 1000);
  }, [reconnectAttempt, connect]);

  const restart = useCallback(async () => {
    if (!selectedServerId) return;
    
    setIsRestarting(true);
    setShowRestartConfirm(false);
    
    try {
      // Step 1: Save the server
      const saveResult = await commandAPI.execute(selectedServerId, 'save');
      
      // Check if save was successful (look for success indicators)
      const saveResponse = saveResult.response?.toLowerCase() || '';
      if (saveResponse.includes('error') || saveResponse.includes('fail')) {
        throw new Error('Save command failed');
      }
      
      // Wait a bit for save to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 2: Quit (restart) the server
      await commandAPI.execute(selectedServerId, 'quit');
      
      // Server will disconnect, auto-reconnect will handle reconnection
      setConnectionStatus('disconnected');
      
    } catch (err) {
      console.error('Restart failed:', err);
      alert(t('connection.restartFailed'));
    } finally {
      setIsRestarting(false);
    }
  }, [selectedServerId, t]);

  // Handle auto-reconnect when connection is lost (detected via WebSocket)
  useEffect(() => {
    if (connectionStatus === 'disconnected' && autoReconnect && selectedServerId) {
      // Only start reconnect if we were previously connected
      const wasConnected = reconnectAttempt > 0 || playersOnline !== null;
      if (wasConnected) {
        scheduleReconnect();
      }
    }
  }, [connectionStatus, autoReconnect, selectedServerId]);

  // Cleanup on unmount or server change
  useEffect(() => {
    return () => clearTimers();
  }, [selectedServerId]);

  const server = getSelectedServer();

  if (!selectedServerId || !server) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700">
        <WifiOff size={18} className="text-gray-500" />
        <span className="text-gray-500 text-sm">{t('connection.selectServer')}</span>
      </div>
    );
  }

  const getStatusColor = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return 'text-green-500';
      case 'connecting':
      case 'reconnecting':
        return 'text-yellow-500';
      case 'disconnected':
      default:
        return 'text-red-500';
    }
  };

  const getStatusBgColor = (status: ConnectionStatus) => {
    switch (status) {
      case 'connected':
        return 'bg-green-500/10 border-green-500/30';
      case 'connecting':
      case 'reconnecting':
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 'disconnected':
      default:
        return 'bg-red-500/10 border-red-500/30';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return t('connection.connected');
      case 'connecting':
        return t('connection.connecting');
      case 'reconnecting':
        return reconnectCountdown > 0
          ? t('connection.retryIn', { seconds: reconnectCountdown })
          : t('connection.reconnecting');
      case 'disconnected':
      default:
        return t('connection.disconnected');
    }
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border ${getStatusBgColor(connectionStatus)}`}>
      {/* Status Icon */}
      <div className={`flex items-center gap-2 ${getStatusColor(connectionStatus)}`}>
        {connectionStatus === 'connecting' || connectionStatus === 'reconnecting' ? (
          <Loader2 size={18} className="animate-spin" />
        ) : connectionStatus === 'connected' ? (
          <Wifi size={18} />
        ) : (
          <WifiOff size={18} />
        )}
      </div>

      {/* Server Name & Status */}
      <div className="flex flex-col">
        <span className="text-white text-sm font-medium">{server.name}</span>
        <span className={`text-xs ${getStatusColor(connectionStatus)}`}>
          {getStatusText()}
          {reconnectAttempt > 0 && connectionStatus === 'reconnecting' && (
            <span className="text-gray-500 ml-1">(#{reconnectAttempt})</span>
          )}
        </span>
      </div>

      {/* Players Online */}
      {connectionStatus === 'connected' && playersOnline && (
        <div className="flex items-center gap-1 px-2 py-1 bg-gray-700/50 rounded text-sm">
          <Users size={14} className="text-blue-400" />
          <span className="text-white">
            {playersOnline.current}
            {playersOnline.max > 0 && <span className="text-gray-400">/{playersOnline.max}</span>}
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 ml-auto">
        {connectionStatus === 'disconnected' && (
          <button
            onClick={connect}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition"
          >
            {t('connection.connect')}
          </button>
        )}
        {connectionStatus === 'connected' && (
          <>
            <button
              onClick={() => setShowRestartConfirm(true)}
              disabled={isRestarting}
              className="px-3 py-1 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-800 text-white text-sm rounded transition flex items-center gap-1"
              title={t('connection.restart')}
            >
              <RotateCcw size={14} className={isRestarting ? 'animate-spin' : ''} />
              {isRestarting ? t('connection.restarting') : t('connection.restart')}
            </button>
            <button
              onClick={disconnect}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition"
            >
              {t('connection.disconnect')}
            </button>
          </>
        )}
        {connectionStatus === 'reconnecting' && (
          <>
            <button
              onClick={connect}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition"
              title="Reconnect now"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => {
                clearTimers();
                setConnectionStatus('disconnected');
                setReconnectAttempt(0);
                setReconnectCountdown(0);
              }}
              className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition"
              title="Cancel"
            >
              ✕
            </button>
          </>
        )}
      </div>

      {/* Auto-reconnect toggle */}
      <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer ml-2">
        <input
          type="checkbox"
          checked={autoReconnect}
          onChange={(e) => setAutoReconnect(e.target.checked)}
          className="w-3 h-3 rounded"
        />
        Auto
      </label>

      {/* Restart Confirmation Modal */}
      {showRestartConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm mx-4 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-2">
              {t('connection.restartConfirm')}
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              {t('connection.restartDesc')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRestartConfirm(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={restart}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded transition"
              >
                {t('connection.restart')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
