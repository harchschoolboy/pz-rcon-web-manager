import React, { useEffect, useState } from 'react';
import { serverAPI, connectionAPI } from '../../api/client';
import { useServerStore } from '../../store/serverStore';
import { useI18n } from '../../i18n';
import { 
  Server as ServerIcon, Plus, Trash2, Power, PowerOff, Edit, 
  ChevronLeft, ChevronRight, X
} from 'lucide-react';
import type { Server } from '../../types/api';

interface ServerSidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const ServerSidebar: React.FC<ServerSidebarProps> = ({ 
  collapsed = false, 
  onToggleCollapse 
}) => {
  const { t } = useI18n();
  const { servers, setServers, addServer, updateServer, removeServer, selectServer, selectedServerId } = useServerStore();
  const [loading, setLoading] = useState(true);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<number, boolean>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: '27015',
    username: '',
    password: ''
  });

  useEffect(() => {
    loadServers();
  }, []);

  useEffect(() => {
    servers.forEach((server) => {
      checkConnection(server.id);
    });
  }, [servers]);

  const loadServers = async () => {
    try {
      const data = await serverAPI.list();
      setServers(data);
    } catch (error: any) {
      console.error('Failed to load servers:', error);
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
      selectServer(serverId);
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

  const handleDelete = async (serverId: number, serverName: string) => {
    if (!confirm(t('servers.deleteConfirm').replace('{name}', serverName))) return;
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

  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const server = await serverAPI.create({
        name: formData.name,
        host: formData.host,
        port: parseInt(formData.port),
        username: formData.username || undefined,
        password: formData.password
      });
      addServer(server);
      setShowAddForm(false);
      resetForm();
      selectServer(server.id);
    } catch (error: any) {
      alert(`${t('error.saving')}: ${error.response?.data?.detail || error.message}`);
    }
  };

  const handleEditServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingServer) return;
    
    try {
      const updated = await serverAPI.update(editingServer.id, {
        name: formData.name,
        host: formData.host,
        port: parseInt(formData.port),
        username: formData.username || undefined,
        password: formData.password || undefined
      });
      updateServer(editingServer.id, updated);
      setEditingServer(null);
      resetForm();
    } catch (error: any) {
      alert(`${t('error.saving')}: ${error.response?.data?.detail || error.message}`);
    }
  };

  const startEdit = (server: Server) => {
    setEditingServer(server);
    setFormData({
      name: server.name,
      host: server.host,
      port: String(server.port),
      username: '',
      password: ''
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      host: '',
      port: '27015',
      username: '',
      password: ''
    });
  };

  const closeForm = () => {
    setShowAddForm(false);
    setEditingServer(null);
    resetForm();
  };

  if (collapsed) {
    return (
      <div className="w-16 bg-gray-800 border-r border-gray-700 flex flex-col">
        <button
          onClick={onToggleCollapse}
          className="p-4 hover:bg-gray-700 text-gray-400 hover:text-white transition"
        >
          <ChevronRight size={24} />
        </button>
        <div className="flex-1 py-2 space-y-2">
          {servers.map((server) => {
            const isConnected = connectionStatuses[server.id];
            const isSelected = selectedServerId === server.id;
            return (
              <button
                key={server.id}
                onClick={() => handleSelect(server.id)}
                className={`w-full p-3 flex justify-center transition ${
                  isSelected ? 'bg-blue-600' : 'hover:bg-gray-700'
                }`}
                title={server.name}
              >
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
              </button>
            );
          })}
        </div>
        <button
          onClick={() => { onToggleCollapse?.(); setShowAddForm(true); }}
          className="p-4 hover:bg-gray-700 text-gray-400 hover:text-green-400 transition border-t border-gray-700"
        >
          <Plus size={24} />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="w-72 bg-gray-800 border-r border-gray-700 flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <ServerIcon size={20} className="text-blue-500" />
            {t('servers.title')}
          </h2>
          <button
            onClick={onToggleCollapse}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Server List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : servers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ServerIcon className="mx-auto mb-2 opacity-50" size={32} />
              <p className="text-sm">{t('connection.noServers')}</p>
            </div>
          ) : (
            servers.map((server) => {
              const isConnected = connectionStatuses[server.id];
              const isSelected = selectedServerId === server.id;

              return (
                <div
                  key={server.id}
                  className={`rounded-lg p-3 cursor-pointer transition border ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500'
                      : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700 hover:border-gray-500'
                  }`}
                  onClick={() => handleSelect(server.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white truncate">{server.name}</h3>
                      <p className="text-xs text-gray-400 truncate">
                        {server.host}:{server.port}
                      </p>
                    </div>
                    <div
                      className={`w-2.5 h-2.5 rounded-full mt-1 ${
                        isConnected ? 'bg-green-500' : 'bg-gray-500'
                      }`}
                    />
                  </div>

                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    {isConnected ? (
                      <button
                        onClick={() => handleDisconnect(server.id)}
                        className="flex-1 flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs transition"
                      >
                        <PowerOff size={12} />
                        {t('connection.disconnect')}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(server.id)}
                        className="flex-1 flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs transition"
                      >
                        <Power size={12} />
                        {t('connection.connect')}
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(server)}
                      className="p-1 bg-gray-600 hover:bg-gray-500 text-white rounded transition"
                    >
                      <Edit size={12} />
                    </button>
                    <button
                      onClick={() => handleDelete(server.id, server.name)}
                      className="p-1 bg-gray-600 hover:bg-red-600 text-white rounded transition"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>

                  {isSelected && (
                    <div className="mt-2 text-xs text-blue-400">
                      ✓ {t('servers.selected')}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Add Server Button */}
        <div className="p-3 border-t border-gray-700">
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg transition"
          >
            <Plus size={18} />
            {t('servers.add')}
          </button>
        </div>
      </div>

      {/* Add/Edit Server Modal */}
      {(showAddForm || editingServer) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">
                {editingServer ? t('servers.edit') : t('servers.add')}
              </h3>
              <button
                onClick={closeForm}
                className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={editingServer ? handleEditServer : handleAddServer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {t('common.name')} *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {t('servers.host')} *
                  </label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="192.168.1.100"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {t('servers.port')} *
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {t('servers.username')}
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  {t('servers.password')} {!editingServer && '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingServer ? t('servers.leaveEmpty') : ''}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={!editingServer}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded-lg transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition"
                >
                  {editingServer ? t('common.save') : t('servers.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
