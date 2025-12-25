import React, { useEffect, useState } from 'react';
import { serverAPI, connectionAPI } from '../../api/client';
import { useServerStore } from '../../store/serverStore';
import { useI18n } from '../../i18n';
import { Server as ServerIcon, Plus, Trash2, Power, PowerOff, Edit } from 'lucide-react';
import type { Server } from '../../types/api';

export const ServerList: React.FC = () => {
  const { t } = useI18n();
  const { servers, setServers, removeServer, selectServer, selectedServerId } = useServerStore();
  const [loading, setLoading] = useState(true);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<number, boolean>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);

  useEffect(() => {
    loadServers();
  }, []);

  useEffect(() => {
    // Check connection status for all servers
    servers.forEach((server) => {
      checkConnection(server.id);
    });
  }, [servers]);

  const loadServers = async () => {
    try {
      console.log('Loading servers...');
      const data = await serverAPI.list();
      console.log('Loaded servers:', data);
      setServers(data);
    } catch (error: any) {
      console.error('Failed to load servers:', error);
      console.error('Error response:', error.response?.data);
      alert(`${t('error.loadingServers')}: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const checkConnection = async (serverId: number) => {
    try {
      const status = await connectionAPI.status(serverId);
      setConnectionStatuses((prev) => ({ ...prev, [serverId]: status.connected }));
    } catch (error) {
      setConnectionStatuses((prev) => ({ ...prev, [serverId]: false }));
    }
  };

  const handleConnect = async (serverId: number) => {
    try {
      await connectionAPI.connect(serverId);
      await checkConnection(serverId);
    } catch (error: any) {
      alert(`${t('error.connecting')}: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleDisconnect = async (serverId: number) => {
    try {
      await connectionAPI.disconnect(serverId);
      await checkConnection(serverId);
    } catch (error: any) {
      alert(`${t('error.disconnecting')}: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleDelete = async (serverId: number) => {
    if (!confirm(t('servers.deleteConfirm').replace('{name}', ''))) return;

    try {
      await serverAPI.delete(serverId);
      removeServer(serverId);
    } catch (error: any) {
      alert(`${t('error.deleting')}: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleSelect = (serverId: number) => {
    selectServer(serverId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">{t('servers.title')}</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
        >
          <Plus size={20} />
          {t('servers.add')}
        </button>
      </div>

      {servers.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ServerIcon className="mx-auto mb-4" size={48} />
          <p>{t('connection.noServers')}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => {
            const isConnected = connectionStatuses[server.id];
            const isSelected = selectedServerId === server.id;

            return (
              <div
                key={server.id}
                className={`bg-gray-800 rounded-lg p-4 border-2 cursor-pointer transition ${
                  isSelected
                    ? 'border-blue-500 shadow-lg shadow-blue-500/50'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
                onClick={() => handleSelect(server.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{server.name}</h3>
                    <p className="text-sm text-gray-400">
                      {server.host}:{server.port}
                    </p>
                  </div>
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isConnected ? 'bg-green-500' : 'bg-gray-500'
                    }`}
                    title={isConnected ? t('connection.connected') : t('connection.disconnected')}
                  />
                </div>

                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  {isConnected ? (
                    <button
                      onClick={() => handleDisconnect(server.id)}
                      className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition"
                      title={t('connection.disconnect')}
                    >
                      <PowerOff size={16} />
                      {t('connection.disconnect')}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(server.id)}
                      className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition"
                      title={t('connection.connect')}
                    >
                      <Power size={16} />
                      {t('connection.connect')}
                    </button>
                  )}

                  <button
                    onClick={() => setEditingServer(server)}
                    className="flex items-center gap-1 bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm transition"
                    title={t('common.edit')}
                  >
                    <Edit size={16} />
                  </button>

                  <button
                    onClick={() => handleDelete(server.id)}
                    className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition"
                    title={t('common.delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {isSelected && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <span className="text-xs text-blue-400 font-semibold">
                      {t('servers.selected')}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAddForm && (
        <ServerForm
          onClose={() => setShowAddForm(false)}
          onSuccess={() => {
            setShowAddForm(false);
            loadServers();
          }}
        />
      )}

      {editingServer && (
        <ServerEditForm
          server={editingServer}
          onClose={() => setEditingServer(null)}
          onSuccess={() => {
            setEditingServer(null);
            loadServers();
          }}
        />
      )}
    </div>
  );
};

// Server Form Component
interface ServerFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const ServerForm: React.FC<ServerFormProps> = ({ onClose, onSuccess }) => {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: 27015,
    password: '',
    username: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await serverAPI.create(formData);
      onSuccess();
    } catch (error: any) {
      alert(`${t('servers.createError')}: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">{t('servers.add')}</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('servers.name')}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Host</label>
            <input
              type="text"
              value={formData.host}
              onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="localhost or IP"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">RCON Port</label>
            <input
              type="number"
              value={formData.port}
              onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('servers.usernameOptional')}</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="admin"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('servers.rconPassword')}</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white py-2 rounded transition"
            >
              {loading ? t('servers.creating') : t('servers.create')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded transition"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Server Edit Form Component
interface ServerEditFormProps {
  server: Server;
  onClose: () => void;
  onSuccess: () => void;
}

const ServerEditForm: React.FC<ServerEditFormProps> = ({ server, onClose, onSuccess }) => {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    name: server.name,
    host: server.host,
    port: server.port,
    password: '',
    username: server.username || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Only send password if it was changed
      const updateData: any = {
        name: formData.name,
        host: formData.host,
        port: formData.port,
        username: formData.username || null,
      };
      if (formData.password) {
        updateData.password = formData.password;
      }
      
      await serverAPI.update(server.id, updateData);
      onSuccess();
    } catch (error: any) {
      alert(`${t('servers.updateError')}: ${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">{t('servers.edit')}</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('servers.name')}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Host</label>
            <input
              type="text"
              value={formData.host}
              onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="localhost or IP"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">RCON Port</label>
            <input
              type="number"
              value={formData.port}
              onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('servers.usernameOptional')}</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="admin"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('servers.rconPassword')} ({t('servers.passwordHint')})</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 text-white py-2 rounded transition"
            >
              {loading ? t('servers.saving') : t('servers.save')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded transition"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
