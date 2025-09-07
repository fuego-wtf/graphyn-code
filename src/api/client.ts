import axios, { AxiosInstance, AxiosError } from 'axios';

import { config } from '../config.js';
import chalk from 'chalk';

interface RetryConfig {
  maxAttempts: number;
  delay: number;
  backoffMultiplier: number;
}

type ThreadState = 'building' | 'testing' | 'deployed' | 'disabled' | 'archived';

interface Thread {
  id: string;
  name: string;
  state: ThreadState;
  created_at: string;
  updated_at: string;
  organization_id: string;
  participants: string[];
  metadata?: {
    repository?: any;
    created_by?: string;
    [key: string]: any;
  };
  // Legacy field for backward compatibility
  type?: 'builder' | 'testing' | 'production';
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
  // Extended properties for compatibility
  status?: 'active' | 'draft' | 'inactive';
  capabilities?: string[];
  lastModified?: string;
}

interface UpdateAgentRequest {
  name?: string;
  description?: string;
  instructions?: string;
  model?: string;
  status?: 'active' | 'draft' | 'inactive';
  capabilities?: string[];
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
  private retryConfig: RetryConfig = {
    maxAttempts: 3,
    delay: 1000,
    backoffMultiplier: 2
  };

  constructor() {
    const apiUrl = process.env.GRAPHYN_API_URL || config.apiBaseUrl || 'https://api.graphyn.xyz';
    const isDev = apiUrl.includes('localhost');
    
    this.client = axios.create({
      baseURL: apiUrl,
      timeout: 90000, // 90 second timeout for AI processing
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `Graphyn-CLI/${process.env.npm_package_version || '0.0.0'}`,
        // Add dev header for local development
        ...(isDev && { 'X-Dev-Mode': 'true' })
      }
    });

    
    // Add request interceptor for authentication
    this.client.interceptors.request.use(
      async (config) => {
        let token: string | null = null;
        
        // Try to get OAuth token, but handle keychain errors in dev mode
        try {
          token = null; // TODO: Implement OAuth token retrieval
          console.log(chalk.gray(`🔐 OAuth token retrieved: None (TODO: Implement OAuth)`));
        } catch (error) {
          // In dev mode, allow requests without token for keychain errors
          if (isDev) {
            const errorMsg = (error as any).message || (error as any).toString();
            if (errorMsg.includes('keychain') || 
                errorMsg.includes('SecKeychainSearchCopyNext') ||
                errorMsg.includes('specified item could not be found')) {
              console.log(chalk.yellow(`⚠️  Dev mode: proceeding without auth token due to keychain error: ${errorMsg.substring(0, 50)}...`));
              // Continue without token in dev mode
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        }
        
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        console.log(chalk.gray(`📤 Request headers being sent:`, JSON.stringify(config.headers, null, 2)));
        
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
          
          const newToken = await null;
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
    const isDev = (process.env.GRAPHYN_API_URL || '').includes('localhost');
    
    try {
      return false; // TODO: Implement OAuth authentication check
    } catch (error) {
      // In dev mode, return true for keychain errors (auth bypass)
      if (isDev) {
        const errorMsg = (error as any).message || (error as any).toString();
        if (errorMsg.includes('keychain') || 
            errorMsg.includes('SecKeychainSearchCopyNext') ||
            errorMsg.includes('specified item could not be found')) {
          return true; // Bypass auth in dev mode for keychain errors
        }
      }
      throw error;
    }
  }

  /**
   * Authenticate using PKCE OAuth flow
   */
  async authenticate(): Promise<void> {
    await null;
  }

  /**
   * Logout and clear stored credentials
   */
  async logout(): Promise<void> {
    await null;
  }

  // Thread endpoints
  
  /**
   * Create a new thread
   */
  async createThread(data: {
    name: string;
    state?: ThreadState;
    participants?: string[];
    metadata?: {
      repository?: any;
      created_by?: string;
      [key: string]: any;
    };
    // Legacy field for backward compatibility
    type?: 'builder' | 'testing' | 'production';
    // Support for agent_metadata for builder threads
    agent_metadata?: {
      is_builder?: boolean;
      [key: string]: any;
    };
  }): Promise<Thread> {
    return this.withRetry(async () => {
      console.log(chalk.gray(`📡 Making HTTP POST request to /api/threads`));
      console.log(chalk.gray(`   Payload:`, JSON.stringify(data, null, 2)));
      
      try {
        const response = await this.client.post<any>('/api/threads', data);
        console.log(chalk.gray(`✅ Raw response:`, JSON.stringify(response.data, null, 2)));
        
        // Handle wrapped response format {"thread": {...}}
        const threadData = response.data.thread || response.data;
        console.log(chalk.gray(`✅ Thread created successfully:`, threadData?.id));
        return threadData;
      } catch (error) {
        console.log(chalk.red(`❌ Failed to create thread:`));
        if ((error as any).response) {
          console.log(chalk.red(`   Status: ${(error as any).response.status} ${(error as any).response.statusText}`));
          console.log(chalk.red(`   Response data:`, (error as any).response.data));
          console.log(chalk.red(`   Request URL: ${(error as any).config?.baseURL}${(error as any).config?.url}`));
        } else {
          console.log(chalk.red(`   Error:`, (error as any).message));
        }
        throw error;
      }
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
    state?: ThreadState;
    // Legacy field for backward compatibility
    type?: 'builder' | 'testing' | 'production';
  }): Promise<Thread[]> {
    return this.withRetry(async () => {
      console.log(chalk.gray(`📡 Making HTTP request to /api/threads`));
      console.log(chalk.gray(`   Base URL: ${this.client.defaults.baseURL}`));
      console.log(chalk.gray(`   Default headers:`, JSON.stringify(this.client.defaults.headers, null, 2)));
      
      const response = await this.client.get<Thread[]>('/api/threads', { params });
      
      console.log(chalk.gray(`✅ HTTP response received:`));
      console.log(chalk.gray(`   Status: ${response.status} ${response.statusText}`));
      console.log(chalk.gray(`   Response headers:`, JSON.stringify(response.headers, null, 2)));
      console.log(chalk.gray(`   Data type: ${typeof response.data}`));
      console.log(chalk.gray(`   Data preview:`, JSON.stringify(response.data).substring(0, 200) + '...'));
      
      // Handle empty response body as empty array (backend bug workaround)
      if (!response.data || (response.data as any) === '') {
        console.log(chalk.yellow(`⚠️  Empty response from backend, treating as empty array (backend should return [])`));
        return [];
      }
      
      // Handle string responses that might be JSON
      if (typeof response.data === 'string') {
        try {
          const parsed = JSON.parse(response.data);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        } catch (parseError) {
          console.log(chalk.yellow(`⚠️  Failed to parse string response as JSON:`, (parseError as any).message));
        }
        // If string is empty or not JSON, treat as empty array
        return [];
      }
      
      return Array.isArray(response.data) ? response.data : [];
    });
  }

  /**
   * Update thread state
   */
  async updateThreadState(threadId: string, state: ThreadState): Promise<Thread> {
    return this.withRetry(async () => {
      const response = await this.client.patch<Thread>(`/api/threads/${threadId}`, { state });
      return response.data;
    });
  }

  /**
   * Update thread metadata and other properties
   */
  async updateThread(threadId: string, data: {
    name?: string;
    state?: ThreadState;
    participants?: string[];
    metadata?: {
      repository?: any;
      agents?: any[];
      [key: string]: any;
    };
  }): Promise<Thread> {
    return this.withRetry(async () => {
      const response = await this.client.patch<Thread>(`/api/threads/${threadId}`, data);
      return response.data;
    });
  }

  /**
   * Get SSE stream URL for a thread (for use with EventSource)
   */
  getThreadStreamUrl(threadId: string): string {
    const baseUrl = this.client.defaults.baseURL;
    return `${baseUrl}/api/threads/${threadId}/stream`;
  }

  /**
   * Send a message to a thread
   */
  async sendMessage(threadId: string, content: string): Promise<Message> {
    return this.withRetry(async () => {
      console.log(chalk.gray(`📡 Making HTTP POST request to /api/threads/${threadId}/messages`));
      console.log(chalk.gray(`   Content length: ${content.length} characters`));
      
      try {
        const response = await this.client.post<Message>(`/api/threads/${threadId}/messages`, {
          content,
          role: 'user'
        });
        console.log(chalk.gray(`✅ Message sent successfully:`, response.data?.id));
        return response.data;
      } catch (error) {
        console.log(chalk.red(`❌ Failed to send message:`));
        if ((error as any).response) {
          console.log(chalk.red(`   Status: ${(error as any).response.status} ${(error as any).response.statusText}`));
          console.log(chalk.red(`   Response data:`, (error as any).response.data));
          console.log(chalk.red(`   Request URL: ${(error as any).config?.baseURL}${(error as any).config?.url}`));
        } else {
          console.log(chalk.red(`   Error:`, (error as any).message));
        }
        throw error;
      }
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
    capabilities?: string[];
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
  async updateAgent(agentId: string, data: UpdateAgentRequest): Promise<Agent> {
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


  /**
   * Generic post method for API requests
   */
  async post<T>(path: string, data: any): Promise<T> {
    return this.withRetry(async () => {
      const response = await this.client.post<T>(path, data);
      return response.data;
    });
  }
}

// Export types and singleton instance
export type { ThreadState, Thread, Agent, Squad, Message };
export const apiClient = new GraphynAPIClient();