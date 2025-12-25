import axios from 'axios';
import type {
  Server,
  ServerCreate,
  ServerUpdate,
  ConnectionStatus,
  CommandExecute,
  CommandResponse,
  CommandLog,
  ServerState
} from '../types/api';

// В production frontend і backend на одному порту
// В development - проксі або окремий URL
const getBaseUrl = (): string => {
  // @ts-ignore - Vite injects these
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    // @ts-ignore
    return import.meta.env.VITE_API_URL as string;
  }
  // @ts-ignore - Vite injects these
  if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) {
    return '';
  }
  // Development fallback
  return 'http://localhost:8000';
};

const api = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Debug logging
api.interceptors.request.use((config) => {
  console.log('API Request:', config.method?.toUpperCase(), config.url);
  return config;
}, (error) => {
  console.error('API Request Error:', error);
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.status, error.config?.url, error.response?.data);
    return Promise.reject(error);
  }
);

// Request interceptor для додавання токену авторизації
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Response interceptor для обробки помилок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      // Don't redirect if already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ========== Authentication ==========

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export const authAPI = {
  login: async (credentials: LoginRequest): Promise<TokenResponse> => {
    const { data } = await api.post('/api/auth/login', credentials);
    return data;
  },
  
  verify: async (): Promise<{ valid: boolean; username: string }> => {
    const { data } = await api.get('/api/auth/verify');
    return data;
  },
  
  logout: () => {
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
  },
  
  getToken: (): string | null => {
    return localStorage.getItem('auth_token');
  },
  
  setToken: (token: string) => {
    localStorage.setItem('auth_token', token);
  },
  
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('auth_token');
  }
};

// ========== Server Management ==========

export const serverAPI = {
  list: async (activeOnly = false): Promise<Server[]> => {
    const { data } = await api.get('/servers', { params: { active_only: activeOnly } });
    return data;
  },

  get: async (id: number): Promise<Server> => {
    const { data } = await api.get(`/servers/${id}`);
    return data;
  },

  create: async (server: ServerCreate): Promise<Server> => {
    const { data } = await api.post('/servers', server);
    return data;
  },

  update: async (id: number, updates: ServerUpdate): Promise<Server> => {
    const { data } = await api.put(`/servers/${id}`, updates);
    return data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/servers/${id}`);
  },
};

// ========== RCON Connection ==========

export const connectionAPI = {
  connect: async (serverId: number): Promise<{ message: string; server_id: number }> => {
    const { data } = await api.post(`/servers/${serverId}/connect`);
    return data;
  },

  disconnect: async (serverId: number): Promise<{ message: string }> => {
    const { data } = await api.post(`/servers/${serverId}/disconnect`);
    return data;
  },

  status: async (serverId: number): Promise<ConnectionStatus> => {
    const { data } = await api.get(`/servers/${serverId}/status`);
    return data;
  },
};

// ========== Command Execution ==========

export const commandAPI = {
  execute: async (serverId: number, command: string | CommandExecute): Promise<CommandResponse> => {
    const payload = typeof command === 'string' ? { command } : command;
    const { data } = await api.post(`/servers/${serverId}/execute`, payload);
    return data;
  },

  history: async (serverId: number, limit = 50): Promise<CommandLog[]> => {
    const { data } = await api.get(`/servers/${serverId}/commands`, { params: { limit } });
    return data;
  },
};

// ========== Server State ==========

export const stateAPI = {
  latest: async (serverId: number): Promise<ServerState> => {
    const { data } = await api.get(`/servers/${serverId}/state/latest`);
    return data;
  },

  history: async (serverId: number, limit = 100): Promise<ServerState[]> => {
    const { data } = await api.get(`/servers/${serverId}/state/history`, { params: { limit } });
    return data;
  },
};

// ========== Server Options ==========

export interface ServerOptionsResponse {
  options: Record<string, string>;
  mods: {
    Mods?: string;
    WorkshopItems?: string;
    Map?: string;
  };
  raw: string;
}

export const optionsAPI = {
  get: async (serverId: number): Promise<ServerOptionsResponse> => {
    const { data } = await api.get(`/servers/${serverId}/options`);
    return data;
  },
};

// ========== Mods Management ==========

export interface Mod {
  id: number;
  server_id: number;
  workshop_id: string;
  mod_ids: string[];           // All mod IDs for this workshop item
  enabled_mod_ids: string[];   // Which mod IDs are enabled
  name: string | null;
  is_enabled: boolean;
  workshop_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModCreate {
  workshop_id: string;
  mod_ids: string[];
  enabled_mod_ids: string[];
  name?: string;
  is_enabled?: boolean;
}

export interface ModUpdate {
  mod_ids?: string[];
  enabled_mod_ids?: string[];
  name?: string;
  is_enabled?: boolean;
}

export interface ModParseResponse {
  workshop_id: string;
  mod_ids: string[];  // List of all found Mod IDs
  name: string | null;
}

export interface ModsExport {
  mods: ModCreate[];
}

export interface ApplyModsResponse {
  success: boolean;
  mods_command: string;
  workshop_command: string;
  mods_result: string;
  workshop_result: string;
  enabled_count: number;
  workshops_count: number;
}

export interface SyncModsResponse {
  success: boolean;
  added: number;
  updated: number;
  errors: string[];
  mods_found: Array<{
    workshop_id: string;
    mod_ids: string[];
    enabled_mod_ids: string[];
    name: string | null;
    status: string;
  }>;
  server_mods_count: number;
  server_workshops_count: number;
}

export const modsAPI = {
  parse: async (url: string): Promise<ModParseResponse> => {
    const { data } = await api.post('/mods/parse', { url });
    return data;
  },

  list: async (serverId: number): Promise<Mod[]> => {
    const { data } = await api.get(`/servers/${serverId}/mods`);
    return data;
  },

  add: async (serverId: number, mod: ModCreate): Promise<Mod> => {
    const { data } = await api.post(`/servers/${serverId}/mods`, mod);
    return data;
  },

  update: async (serverId: number, modId: number, updates: ModUpdate): Promise<Mod> => {
    const { data } = await api.put(`/servers/${serverId}/mods/${modId}`, updates);
    return data;
  },

  delete: async (serverId: number, modId: number): Promise<void> => {
    await api.delete(`/servers/${serverId}/mods/${modId}`);
  },

  apply: async (serverId: number): Promise<ApplyModsResponse> => {
    const { data } = await api.post(`/servers/${serverId}/mods/apply`);
    return data;
  },

  export: async (serverId: number): Promise<ModsExport> => {
    const { data } = await api.get(`/servers/${serverId}/mods/export`);
    return data;
  },

  import: async (serverId: number, modsExport: ModsExport): Promise<{ imported: number; updated: number }> => {
    const { data } = await api.post(`/servers/${serverId}/mods/import`, modsExport);
    return data;
  },

  sync: async (serverId: number): Promise<SyncModsResponse> => {
    const { data } = await api.post(`/servers/${serverId}/mods/sync`);
    return data;
  },
};

export default api;
