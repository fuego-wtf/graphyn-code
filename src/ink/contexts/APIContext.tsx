import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { GraphynAPIClient, Thread, Agent, AuthResponse, Squad, CreateSquadRequest } from '../../api-client.js';
import { ConfigManager } from '../../config-manager.js';
import { config as appConfig } from '../../config.js';
import { tokenManager } from '../../utils/token-manager.js';
import EventSource from 'eventsource';

interface APIContextValue {
  client: GraphynAPIClient | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  error: string | null;
  
  // Auth methods
  authenticate: (token: string) => Promise<void>;
  getTestToken: () => Promise<void>;
  logout: () => Promise<void>;
  
  // Thread methods
  threads: {
    list: () => Promise<Thread[]>;
    create: (name: string, type?: 'testing' | 'builder') => Promise<Thread>;
    get: (id: string) => Promise<Thread>;
    delete: (id: string) => Promise<void>;
    stream: (id: string) => EventSource;
  };
  
  // Agent methods
  agents: {
    list: () => Promise<Agent[]>;
    getAvailable: (context?: any) => Promise<Agent[]>;
    get: (id: string) => Promise<Agent>;
    create: (data: any) => Promise<Agent>;
    update: (id: string, data: any) => Promise<Agent>;
    delete: (id: string) => Promise<void>;
  };
  
  
  // Squad methods
  listSquads: () => Promise<Squad[]>;
  createSquad: (data: CreateSquadRequest) => Promise<Squad>;
  getSquad: (id: string) => Promise<Squad>;
  updateSquad: (id: string, data: Partial<CreateSquadRequest>) => Promise<Squad>;
  deleteSquad: (id: string) => Promise<void>;
  
  // Agent methods for squads
  getAvailableAgents: (context?: any) => Promise<Agent[]>;
  
  // Generic methods
  get: <T>(endpoint: string) => Promise<T>;
  post: <T>(endpoint: string, data?: any) => Promise<T>;
  delete: <T = void>(endpoint: string) => Promise<T>;
}

const APIContext = createContext<APIContextValue | null>(null);

export const useAPI = () => {
  const context = useContext(APIContext);
  if (!context) {
    throw new Error('useAPI must be used within an APIProvider');
  }
  return context;
};

interface APIProviderProps {
  children: ReactNode;
}

export const APIProvider: React.FC<APIProviderProps> = ({ children }) => {
  const [client, setClient] = useState<GraphynAPIClient | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize API client on mount
  useEffect(() => {
    initializeClient();
  }, []);

  const initializeClient = async () => {
    try {
      const token = await tokenManager.getToken();
      
      const apiClient = new GraphynAPIClient(appConfig.apiBaseUrl);
      
      if (token) {
        apiClient.setToken(token);
        
        // Validate token
        try {
          await apiClient.ping();
          setIsAuthenticated(true);
        } catch (err) {
          // Token is invalid, clear it
          await tokenManager.clearToken();
          setIsAuthenticated(false);
        }
      }
      
      setClient(apiClient);
      setIsInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize API client');
      setIsInitialized(true);
    }
  };

  const authenticate = async (tokenOrCode: string) => {
    if (!client) throw new Error('API client not initialized');
    
    try {
      let accessToken = tokenOrCode;
      let expiresIn: number | undefined;
      let refreshToken: string | undefined;
      
      // Check if this is an OAuth code that needs to be exchanged
      if (tokenOrCode.startsWith('cli_auth_')) {
        // Extract the session token from the pseudo-code
        const sessionToken = tokenOrCode.replace('cli_auth_', '');
        
        // For now, use the session token directly
        // In production, this should exchange the code for a proper access token
        accessToken = sessionToken;
        expiresIn = 3600; // 1 hour default
      }
      
      client.setToken(accessToken);
      
      // Validate token
      await client.ping();
      
      // Save token with expiry info
      await tokenManager.saveToken(accessToken, expiresIn, refreshToken);
      
      setIsAuthenticated(true);
      setError(null);
    } catch (err) {
      throw new Error('Invalid token');
    }
  };

  const getTestToken = async () => {
    if (!client) throw new Error('API client not initialized');
    
    try {
      const response = await client.getTestToken();
      
      // Save token and user info
      const configManager = new ConfigManager();
      await configManager.setAuthToken(response.token);
      await configManager.set('auth.user', response.user);
      
      client.setToken(response.token);
      setIsAuthenticated(true);
      setError(null);
    } catch (err) {
      throw new Error('Failed to get test token');
    }
  };

  const logout = async () => {
    await tokenManager.clearToken();
    
    const configManager = new ConfigManager();
    await configManager.delete('auth');
    
    if (client) {
      client.setToken('');
    }
    
    setIsAuthenticated(false);
  };

  // Thread methods
  const threads = {
    list: async (): Promise<Thread[]> => {
      if (!client) throw new Error('API client not initialized');
      return client.listThreads();
    },
    
    create: async (name: string, type: 'testing' | 'builder' = 'testing'): Promise<Thread> => {
      if (!client) throw new Error('API client not initialized');
      return client.createThread({ name, type });
    },
    
    get: async (id: string): Promise<Thread> => {
      if (!client) throw new Error('API client not initialized');
      return client.getThread(id);
    },
    
    delete: async (id: string): Promise<void> => {
      if (!client) throw new Error('API client not initialized');
      return client.deleteThread(id);
    },
    
    stream: (id: string): EventSource => {
      if (!client) throw new Error('API client not initialized');
      return client.streamThread(id);
    }
  };

  // Agent methods
  const agents = {
    list: async (): Promise<Agent[]> => {
      if (!client) throw new Error('API client not initialized');
      return client.listAgents();
    },
    
    getAvailable: async (context?: any): Promise<Agent[]> => {
      if (!client) throw new Error('API client not initialized');
      return client.getAvailableAgents(context);
    },
    
    get: async (id: string): Promise<Agent> => {
      if (!client) throw new Error('API client not initialized');
      return client.getAgent(id);
    },
    
    create: async (data: any): Promise<Agent> => {
      if (!client) throw new Error('API client not initialized');
      return client.createAgent(data);
    },
    
    update: async (id: string, data: any): Promise<Agent> => {
      if (!client) throw new Error('API client not initialized');
      return client.updateAgent(id, data);
    },
    
    delete: async (id: string): Promise<void> => {
      if (!client) throw new Error('API client not initialized');
      return client.deleteAgent(id);
    }
  };

  // Generic methods
  const get = async <T,>(endpoint: string): Promise<T> => {
    if (!client) throw new Error('API client not initialized');
    return client.get<T>(endpoint);
  };

  const post = async <T,>(endpoint: string, data?: any): Promise<T> => {
    if (!client) throw new Error('API client not initialized');
    return client.post<T>(endpoint, data);
  };

  const deleteMethod = async <T = void,>(endpoint: string): Promise<T> => {
    if (!client) throw new Error('API client not initialized');
    return client.delete<T>(endpoint);
  };

  // Squad methods
  const listSquads = async (): Promise<Squad[]> => {
    if (!client) throw new Error('API client not initialized');
    return client.listSquads();
  };

  const createSquad = async (data: CreateSquadRequest): Promise<Squad> => {
    if (!client) throw new Error('API client not initialized');
    return client.createSquad(data);
  };

  const getSquad = async (id: string): Promise<Squad> => {
    if (!client) throw new Error('API client not initialized');
    return client.getSquad(id);
  };

  const updateSquad = async (id: string, data: Partial<CreateSquadRequest>): Promise<Squad> => {
    if (!client) throw new Error('API client not initialized');
    return client.updateSquad(id, data);
  };

  const deleteSquad = async (id: string): Promise<void> => {
    if (!client) throw new Error('API client not initialized');
    return client.deleteSquad(id);
  };

  // Agent methods for squads
  const getAvailableAgents = async (context?: any): Promise<Agent[]> => {
    if (!client) throw new Error('API client not initialized');
    return client.getAvailableAgents(context);
  };

  const value: APIContextValue = {
    client,
    isAuthenticated,
    isInitialized,
    error,
    authenticate,
    getTestToken,
    logout,
    threads,
    agents,
    listSquads,
    createSquad,
    getSquad,
    updateSquad,
    deleteSquad,
    getAvailableAgents,
    get,
    post,
    delete: deleteMethod
  };

  return (
    <APIContext.Provider value={value}>
      {children}
    </APIContext.Provider>
  );
};