// Agent related types
export interface Agent {
  id: string;
  name: string;
  displayName: string;
  type: 'agent' | 'project' | 'global';
  status: 'active' | 'inactive' | 'error' | 'loading';
  color: string;
  description?: string;
  scope?: 'project' | 'global';
  capabilities?: string[];
  lastActive?: Date;
}

// MCP Server related types
export interface MCPServer {
  id: string;
  name: string;
  displayName: string;
  enabled: boolean;
  icon?: string;
  description?: string;
  config: MCPServerConfig;
  status: MCPServerStatus;
  capabilities?: MCPCapability[];
}

export interface MCPServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  workingDirectory?: string;
  transport?: 'stdio' | 'http' | 'websocket';
}

export interface MCPServerStatus {
  state: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastConnected?: Date;
  errorMessage?: string;
  version?: string;
}

export interface MCPCapability {
  name: string;
  description?: string;
  parameters?: Record<string, any>;
}

// Command/Input related types
export interface Command {
  id: string;
  text: string;
  timestamp: Date;
  agentId?: string;
  result?: CommandResult;
}

export interface CommandResult {
  success: boolean;
  output?: string;
  error?: string;
  duration?: number;
}

// UI State types
export interface UIState {
  activeAgentId?: string;
  selectedServerId?: string;
  commandHistory: Command[];
  isCommandPaletteOpen: boolean;
}

// IPC Channel types
export enum IPCChannels {
  // Agent channels
  GET_AGENTS = 'agents:get',
  UPDATE_AGENT = 'agents:update',
  AGENT_STATUS_CHANGED = 'agents:status-changed',
  
  // MCP channels
  GET_MCP_SERVERS = 'mcp:get-servers',
  ADD_MCP_SERVER = 'mcp:add-server',
  REMOVE_MCP_SERVER = 'mcp:remove-server',
  TOGGLE_MCP_SERVER = 'mcp:toggle-server',
  UPDATE_MCP_SERVER_CONFIG = 'mcp:update-config',
  MCP_SERVER_STATUS_CHANGED = 'mcp:status-changed',
  
  // Command channels
  EXECUTE_COMMAND = 'command:execute',
  GET_COMMAND_HISTORY = 'command:get-history',
  CLEAR_COMMAND_HISTORY = 'command:clear-history',
}

// Event payloads
export interface AgentStatusChangedPayload {
  agentId: string;
  status: Agent['status'];
  timestamp: Date;
}

export interface MCPServerStatusChangedPayload {
  serverId: string;
  status: MCPServerStatus;
  timestamp: Date;
}

export interface ExecuteCommandPayload {
  command: string;
  agentId?: string;
  context?: Record<string, any>;
}