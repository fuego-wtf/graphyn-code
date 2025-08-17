import axios, { AxiosInstance, AxiosError } from 'axios';
import { OAuthManager } from '../auth/oauth.js';
import { config } from '../config.js';

interface RetryConfig {
  maxAttempts: number;
  delay: number;
  backoffMultiplier: number;
}

interface Thread {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  participants: string[];
  type: 'builder' | 'testing' | 'production';
}

interface Agent {
  id: string;
  name: string;
  description?: string;
  instructions?: string;
  model?: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

interface Squad {
  id: string;
  name: string;
  description?: string;
  agents: string[];
  organization_id: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export class GraphynAPIClient {
  private client: AxiosInstance;
  private oauthManager: OAuthManager;
  private retryConfig: RetryConfig = {
    maxAttempts: 3,
    delay: 1000,
    backoffMultiplier: 2
  };

  constructor() {
    const apiUrl = process.env.GRAPHYN_API_URL || config.apiBaseUrl || 'https://api.graphyn.xyz';
    
    this.client = axios.create({
      baseURL: apiUrl,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `Graphyn-CLI/${process.env.npm_package_version || '0.0.0'}`
      }
    });

    this.oauthManager = new OAuthManager();
    
    // Add request interceptor for authentication
    this.client.interceptors.request.use(
      async (config) => {
        const token = await this.oauthManager.getValidToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling and retry
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest: any = error.config;
        
        // If we get a 401, try to refresh the token once
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
          originalRequest._retry = true;
          
          const newToken = await this.oauthManager.getValidToken();
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.client(originalRequest);
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Execute a request with retry logic
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const retryConfig = { ...this.retryConfig, ...config };
    let lastError: Error | undefined;
    let delay = retryConfig.delay;

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on 4xx errors (except 429 rate limit)
        if (axios.isAxiosError(error)) {
          const status = error.response?.status;
          if (status && status >= 400 && status < 500 && status !== 429) {
            throw error;
          }
        }

        if (attempt < retryConfig.maxAttempts) {
          console.debug(`Request failed (attempt ${attempt}/${retryConfig.maxAttempts}), retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= retryConfig.backoffMultiplier;
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Check if the client is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    return this.oauthManager.isAuthenticated();
  }

  /**
   * Authenticate using PKCE OAuth flow
   */
  async authenticate(): Promise<void> {
    await this.oauthManager.authenticate();
  }

  /**
   * Logout and clear stored credentials
   */
  async logout(): Promise<void> {
    await this.oauthManager.logout();
  }

  // Thread endpoints
  
  /**
   * Create a new thread
   */
  async createThread(data: {
    name: string;
    type?: 'builder' | 'testing' | 'production';
    participants?: string[];
  }): Promise<Thread> {
    return this.withRetry(async () => {
      const response = await this.client.post<Thread>('/api/threads', data);
      return response.data;
    });
  }

  /**
   * Get a thread by ID
   */
  async getThread(threadId: string): Promise<Thread> {
    return this.withRetry(async () => {
      const response = await this.client.get<Thread>(`/api/threads/${threadId}`);
      return response.data;
    });
  }

  /**
   * List all threads
   */
  async listThreads(params?: {
    limit?: number;
    offset?: number;
    type?: 'builder' | 'testing' | 'production';
  }): Promise<Thread[]> {
    return this.withRetry(async () => {
      const response = await this.client.get<Thread[]>('/api/threads', { params });
      return response.data;
    });
  }

  /**
   * Send a message to a thread
   */
  async sendMessage(threadId: string, content: string): Promise<Message> {
    return this.withRetry(async () => {
      const response = await this.client.post<Message>(`/api/threads/${threadId}/messages`, {
        content,
        role: 'user'
      });
      return response.data;
    });
  }

  /**
   * Get messages from a thread
   */
  async getMessages(threadId: string, params?: {
    limit?: number;
    offset?: number;
  }): Promise<Message[]> {
    return this.withRetry(async () => {
      const response = await this.client.get<Message[]>(`/api/threads/${threadId}/messages`, { params });
      return response.data;
    });
  }

  /**
   * Add a participant to a thread
   */
  async addParticipant(threadId: string, agentId: string): Promise<void> {
    return this.withRetry(async () => {
      await this.client.post(`/api/threads/${threadId}/participants`, {
        agent_id: agentId
      });
    });
  }

  /**
   * Remove a participant from a thread
   */
  async removeParticipant(threadId: string, agentId: string): Promise<void> {
    return this.withRetry(async () => {
      await this.client.delete(`/api/threads/${threadId}/participants/${agentId}`);
    });
  }

  // Agent endpoints

  /**
   * Create a new agent
   */
  async createAgent(data: {
    name: string;
    description?: string;
    instructions?: string;
    model?: string;
  }): Promise<Agent> {
    return this.withRetry(async () => {
      const response = await this.client.post<Agent>('/api/agents', data);
      return response.data;
    });
  }

  /**
   * Get an agent by ID
   */
  async getAgent(agentId: string): Promise<Agent> {
    return this.withRetry(async () => {
      const response = await this.client.get<Agent>(`/api/agents/${agentId}`);
      return response.data;
    });
  }

  /**
   * List all agents
   */
  async listAgents(params?: {
    limit?: number;
    offset?: number;
  }): Promise<Agent[]> {
    return this.withRetry(async () => {
      const response = await this.client.get<Agent[]>('/api/agents', { params });
      return response.data;
    });
  }

  /**
   * Update an agent
   */
  async updateAgent(agentId: string, data: {
    name?: string;
    description?: string;
    instructions?: string;
    model?: string;
  }): Promise<Agent> {
    return this.withRetry(async () => {
      const response = await this.client.patch<Agent>(`/api/agents/${agentId}`, data);
      return response.data;
    });
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: string): Promise<void> {
    return this.withRetry(async () => {
      await this.client.delete(`/api/agents/${agentId}`);
    });
  }

  // Squad endpoints

  /**
   * Create a new squad
   */
  async createSquad(data: {
    name: string;
    description?: string;
    agents?: string[];
  }): Promise<Squad> {
    return this.withRetry(async () => {
      const response = await this.client.post<Squad>('/api/squads', data);
      return response.data;
    });
  }

  /**
   * Get a squad by ID
   */
  async getSquad(squadId: string): Promise<Squad> {
    return this.withRetry(async () => {
      const response = await this.client.get<Squad>(`/api/squads/${squadId}`);
      return response.data;
    });
  }

  /**
   * List all squads
   */
  async listSquads(params?: {
    limit?: number;
    offset?: number;
  }): Promise<Squad[]> {
    return this.withRetry(async () => {
      const response = await this.client.get<Squad[]>('/api/squads', { params });
      return response.data;
    });
  }

  /**
   * Update a squad
   */
  async updateSquad(squadId: string, data: {
    name?: string;
    description?: string;
    agents?: string[];
  }): Promise<Squad> {
    return this.withRetry(async () => {
      const response = await this.client.patch<Squad>(`/api/squads/${squadId}`, data);
      return response.data;
    });
  }

  /**
   * Delete a squad
   */
  async deleteSquad(squadId: string): Promise<void> {
    return this.withRetry(async () => {
      await this.client.delete(`/api/squads/${squadId}`);
    });
  }

  /**
   * Add an agent to a squad
   */
  async addAgentToSquad(squadId: string, agentId: string): Promise<void> {
    return this.withRetry(async () => {
      await this.client.post(`/api/squads/${squadId}/agents`, {
        agent_id: agentId
      });
    });
  }

  /**
   * Remove an agent from a squad
   */
  async removeAgentFromSquad(squadId: string, agentId: string): Promise<void> {
    return this.withRetry(async () => {
      await this.client.delete(`/api/squads/${squadId}/agents/${agentId}`);
    });
  }

  /**
   * Get user profile
   */
  async getUserProfile(): Promise<any> {
    return this.withRetry(async () => {
      const response = await this.client.get('/auth/me');
      return response.data;
    });
  }

  /**
   * Get organizations
   */
  async getOrganizations(): Promise<any[]> {
    return this.withRetry(async () => {
      const response = await this.client.get('/api/organizations');
      return response.data;
    });
  }

  /**
   * Get authentication providers (for compatibility)
   */
  async getAuthProviders(): Promise<any> {
    return this.withRetry(async () => {
      const response = await this.client.get('/auth/providers');
      return response.data;
    });
  }
}

// Export a singleton instance
export const apiClient = new GraphynAPIClient();