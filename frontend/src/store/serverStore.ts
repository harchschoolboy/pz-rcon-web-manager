import { create } from 'zustand';
import type { Server } from '../types/api';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface PlayersOnline {
  current: number;
  max: number;
}

interface ServerState {
  servers: Server[];
  selectedServerId: number | null;
  connectionStatus: ConnectionStatus;
  autoReconnect: boolean;
  reconnectAttempt: number;
  reconnectCountdown: number;
  playersOnline: PlayersOnline | null;
  modsRefreshTrigger: number;
  setServers: (servers: Server[]) => void;
  addServer: (server: Server) => void;
  updateServer: (id: number, updates: Partial<Server>) => void;
  removeServer: (id: number) => void;
  selectServer: (id: number) => void;
  getSelectedServer: () => Server | undefined;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setAutoReconnect: (enabled: boolean) => void;
  setReconnectAttempt: (attempt: number) => void;
  setReconnectCountdown: (seconds: number) => void;
  setPlayersOnline: (players: PlayersOnline | null) => void;
  triggerModsRefresh: () => void;
}

export const useServerStore = create<ServerState>((set, get) => ({
  servers: [],
  selectedServerId: null,
  connectionStatus: 'disconnected',
  autoReconnect: true,
  reconnectAttempt: 0,
  reconnectCountdown: 0,
  playersOnline: null,
  modsRefreshTrigger: 0,

  setServers: (servers) => set({ servers }),

  addServer: (server) =>
    set((state) => ({ servers: [...state.servers, server] })),

  updateServer: (id, updates) =>
    set((state) => ({
      servers: state.servers.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),

  removeServer: (id) =>
    set((state) => ({
      servers: state.servers.filter((s) => s.id !== id),
      selectedServerId: state.selectedServerId === id ? null : state.selectedServerId,
    })),

  selectServer: (id) => set({ 
    selectedServerId: id, 
    connectionStatus: 'disconnected', 
    reconnectAttempt: 0,
    playersOnline: null 
  }),

  getSelectedServer: () => {
    const state = get();
    return state.servers.find((s) => s.id === state.selectedServerId);
  },

  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setAutoReconnect: (enabled) => set({ autoReconnect: enabled }),
  setReconnectAttempt: (attempt) => set({ reconnectAttempt: attempt }),
  setReconnectCountdown: (seconds) => set({ reconnectCountdown: seconds }),
  setPlayersOnline: (players) => set({ playersOnline: players }),
  triggerModsRefresh: () => set((state) => ({ modsRefreshTrigger: state.modsRefreshTrigger + 1 })),
}));
