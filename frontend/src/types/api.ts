export interface Server {
  id: number;
  name: string;
  host: string;
  port: number;
  username?: string;
  is_active: boolean;
  auto_sync_mods: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServerCreate {
  name: string;
  host: string;
  port: number;
  password: string;
  username?: string;
  auto_sync_mods?: boolean;
}

export interface ServerUpdate {
  name?: string;
  host?: string;
  port?: number;
  password?: string;
  username?: string;
  is_active?: boolean;
  auto_sync_mods?: boolean;
}

export interface ConnectionStatus {
  server_id: number;
  connected: boolean;
  authenticated: boolean;
}

export interface CommandExecute {
  command: string;
}

export interface CommandResponse {
  success: boolean;
  response?: string;
  error?: string;
}

export interface CommandLog {
  id: number;
  command: string;
  response?: string;
  success: boolean;
  error_message?: string;
  executed_at: string;
}

export interface ServerState {
  id: number;
  server_id: number;
  server_name?: string;
  version?: string;
  players_online: number;
  max_players: number;
  cpu_usage?: string;
  memory_usage?: string;
  uptime?: string;
  timestamp: string;
}
