import React, { useState, useEffect, useRef } from 'react';
import { commandAPI } from '../../api/client';
import { useServerStore } from '../../store/serverStore';
import { useI18n } from '../../i18n';
import { Terminal, Send, Trash2, Clock } from 'lucide-react';
import type { CommandLog } from '../../types/api';

export const RconConsole: React.FC = () => {
  const { t } = useI18n();
  const { selectedServerId, getSelectedServer } = useServerStore();
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<CommandLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const consoleRef = useRef<HTMLDivElement>(null);

  const selectedServer = getSelectedServer();

  useEffect(() => {
    if (selectedServerId) {
      loadHistory();
    }
  }, [selectedServerId]);

  useEffect(() => {
    // Auto scroll to bottom
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [history]);

  const loadHistory = async () => {
    if (!selectedServerId) return;

    try {
      const data = await commandAPI.history(selectedServerId, 100);
      setHistory(data);
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || !selectedServerId) return;

    setLoading(true);

    try {
      const result = await commandAPI.execute(selectedServerId, { command });
      
      // Add to command history for up/down navigation
      setCommandHistory((prev) => [...prev, command]);
      setHistoryIndex(-1);

      // Add to display history
      setHistory((prev) => [
        ...prev,
        {
          id: Date.now(),
          command,
          response: result.response,
          success: result.success,
          error_message: result.error,
          executed_at: new Date().toISOString(),
        },
      ]);

      setCommand('');
    } catch (error: any) {
      alert(`${t('console.executeError')}: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex + 1;
        if (newIndex < commandHistory.length) {
          setHistoryIndex(newIndex);
          setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  const clearHistory = () => {
    if (confirm(t('console.clearConfirm'))) {
      setHistory([]);
    }
  };

  if (!selectedServerId || !selectedServer) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center border border-gray-700">
        <Terminal className="mx-auto mb-4 text-gray-500" size={48} />
        <p className="text-gray-400 mb-2">{t('connection.selectServer')}</p>
        <p className="text-sm text-gray-500">
          {t('console.selectServer')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{t('console.title')}</h2>
          <p className="text-sm text-gray-400">
            {t('console.serverLabel')}: <span className="text-blue-400">{selectedServer.name}</span>
          </p>
        </div>
        <button
          onClick={clearHistory}
          className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition"
        >
          <Trash2 size={16} />
          {t('console.clear')}
        </button>
      </div>

      {/* Console Output */}
      <div
        ref={consoleRef}
        className="bg-gray-900 rounded-lg p-4 min-h-48 overflow-y-auto font-mono text-sm border border-gray-700 resize-y"
        style={{ height: '384px' }}
      >
        {history.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            {t('console.empty')}
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((log) => (
              <div key={log.id} className="border-l-2 border-blue-500 pl-3">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <Clock size={12} />
                  {new Date(log.executed_at).toLocaleString()}
                </div>
                <div className="text-blue-400 mb-1">
                  <span className="text-gray-500">$</span> {log.command}
                </div>
                {log.success ? (
                  <div className="text-green-400 whitespace-pre-wrap">
                    {log.response || `(${t('console.noResponse')})`}
                  </div>
                ) : (
                  <div className="text-red-400">
                    ❌ {t('console.error')}: {log.error_message}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Command Input */}
      <form onSubmit={handleExecute} className="flex gap-2">
        <div className="flex-1 relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('console.inputPlaceholder')}
            className="w-full pl-8 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            disabled={loading}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !command.trim()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg transition font-semibold"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('console.executing')}
            </>
          ) : (
            <>
              <Send size={20} />
              {t('console.execute')}
            </>
          )}
        </button>
      </form>

      {/* Command hints */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300 mb-2">{t('console.popularCommands')}:</h3>
        <div className="flex flex-wrap gap-2">
          {['players', 'help', 'servermsg "Hello"', 'kickuser "username"', 'save', 'quit'].map(
            (cmd) => (
              <button
                key={cmd}
                onClick={() => setCommand(cmd)}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm font-mono transition"
              >
                {cmd}
              </button>
            )
          )}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          {t('console.historyHint')}
        </p>
      </div>
    </div>
  );
};
