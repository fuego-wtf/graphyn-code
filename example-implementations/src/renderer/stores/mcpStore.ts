import { create } from 'zustand';
import { MCPServer } from '../../shared/types';

interface MCPState {
  servers: MCPServer[];
  toggleServer: (serverId: string, enabled: boolean) => void;
  addServer: (server: Omit<MCPServer, 'id' | 'status'>) => void;
  removeServer: (serverId: string) => void;
  updateServerConfig: (serverId: string, config: Partial<MCPServer['config']>) => void;
  updateServerStatus: (serverId: string, status: MCPServer['status']) => void;
}

// Sample initial servers
const initialServers: MCPServer[] = [
  {
    id: '1',
    name: 'linear',
    displayName: 'Linear',
    enabled: true,
    icon: '🔗',
    description: 'Linear issue tracking integration',
    config: {
      command: 'mcp-server-linear',
      transport: 'stdio'
    },
    status: {
      state: 'connected',
      lastConnected: new Date(),
      version: '1.0.0'
    }
  },
  {
    id: '2',
    name: 'figma',
    displayName: 'Figma',
    enabled: true,
    icon: '🎨',
    description: 'Figma design integration',
    config: {
      command: 'mcp-server-figma',
      transport: 'stdio'
    },
    status: {
      state: 'connected',
      lastConnected: new Date(),
      version: '1.0.0'
    }
  },
  {
    id: '3',
    name: 'context7',
    displayName: 'Context7',
    enabled: true,
    icon: '🔍',
    description: 'Context-aware code search',
    config: {
      command: 'mcp-server-context7',
      transport: 'stdio'
    },
    status: {
      state: 'connected',
      lastConnected: new Date(),
      version: '1.0.0'
    }
  },
  {
    id: '4',
    name: 'sentry',
    displayName: 'Sentry',
    enabled: false,
    icon: '🐛',
    description: 'Error tracking and monitoring',
    config: {
      command: 'mcp-server-sentry',
      transport: 'stdio'
    },
    status: {
      state: 'disconnected'
    }
  }
];

export const useMCPStore = create<MCPState>((set) => ({
  servers: initialServers,
  
  toggleServer: (serverId, enabled) => set((state) => ({
    servers: state.servers.map(server =>
      server.id === serverId 
        ? { 
            ...server, 
            enabled,
            status: {
              ...server.status,
              state: enabled ? 'connecting' : 'disconnected'
            }
          } 
        : server
    )
  })),
  
  addServer: (serverData) => set((state) => {
    const newServer: MCPServer = {
      ...serverData,
      id: Date.now().toString(),
      status: {
        state: 'disconnected'
      }
    };
    return { servers: [...state.servers, newServer] };
  }),
  
  removeServer: (serverId) => set((state) => ({
    servers: state.servers.filter(server => server.id !== serverId)
  })),
  
  updateServerConfig: (serverId, config) => set((state) => ({
    servers: state.servers.map(server =>
      server.id === serverId 
        ? { ...server, config: { ...server.config, ...config } }
        : server
    )
  })),
  
  updateServerStatus: (serverId, status) => set((state) => ({
    servers: state.servers.map(server =>
      server.id === serverId 
        ? { ...server, status }
        : server
    )
  }))
}));