import EventSource from 'eventsource';
import { ConfigManager } from './config-manager.js';

export interface Thread {
  id: string;
  name: string;
  type: 'testing' | 'builder';
  organization_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ThreadsResponse {
  threads: Thread[];
}

export interface AuthResponse {
  token: string;
  warning?: string;
  user: {
    email: string;
    name: string;
    orgID: string;
    userID: string;
  };
  expiresAt: string;
}

export interface CreateThreadRequest {
  name: string;
  type: 'testing' | 'builder';
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  applicablePaths?: string[];
  created_by: string;
  shared: boolean;
  configuration?: {
    prompt?: string;
    tools?: string[];
    context?: Record<string, any>;
  };
  organization_id?: string;
  team_id?: string;
}

export interface AgentAvailableResponse {
  agents: Agent[];
  suggestedMappings?: Record<string, string[]>;
}

export interface CreateAgentRequest {
  name: string;
  description: string;
  applicablePaths?: string[];
  configuration: {
    prompt?: string;
    tools?: string[];
    context?: Record<string, any>;
  };
}

export interface RepositoryContext {
  url?: string;
  path?: string;
  type?: 'monorepo' | 'single' | 'unknown';
  framework?: string;
  language?: string;
}

export interface Team {
  id: string;
  name: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}

export interface Squad {
  id: string;
  name: string;
  team_id: string;
  repository_url?: string;
  agents: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateSquadRequest {
  name: string;
  team_id: string;
  repository_url?: string;
  agents?: string[];
}

export class GraphynAPIClient {
  private baseUrl: string;
  private token?: string;
  private configManager: ConfigManager;

  // Getter for token (read-only)
  get currentToken(): string | undefined {
    return this.token;
  }

  constructor(baseUrl: string = 'https://api.graphyn.xyz') {
    this.baseUrl = baseUrl;
    this.configManager = new ConfigManager();
  }

  async initialize(): Promise<void> {
    // Load token from config if available
    this.token = await this.configManager.getAuthToken();
  }

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorText;
      } catch {
        errorMessage = errorText || `HTTP ${response.status}`;
      }
      
      throw new Error(`API Error (${response.status}): ${errorMessage}`);
    }

    return response.json() as Promise<T>;
  }

  // Authentication
  async getTestToken(): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/test-token', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // Thread Management
  async listThreads(): Promise<Thread[]> {
    const response = await this.request<ThreadsResponse>('/api/threads');
    return response.threads;
  }

  async createThread(data: CreateThreadRequest): Promise<Thread> {
    const response = await this.request<{thread: Thread}>('/api/threads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.thread;
  }

  async getThread(threadId: string): Promise<Thread> {
    const response = await this.request<{thread: Thread; participants: any[]; recentMessages: any[]}>(`/api/threads/${threadId}`);
    return response.thread;
  }

  async deleteThread(threadId: string): Promise<void> {
    await this.request<void>(`/api/threads/${threadId}`, {
      method: 'DELETE',
    });
  }

  // SSE Streaming
  streamThread(threadId: string): EventSource {
    if (!this.token) {
      throw new Error('Authentication required for streaming');
    }

    const url = `${this.baseUrl}/api/threads/${threadId}/stream`;
    
    // Create EventSource with Authorization header support
    // The eventsource package supports headers
    const eventSource = new EventSource(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    } as any);
    
    return eventSource;
  }

  // Health Check
  async ping(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/ping');
  }

  // Generic POST method for custom endpoints
  async post<T>(endpoint: string, data: any, options?: RequestInit): Promise<T> {
    const headers = options?.headers as Record<string, string> | undefined;
    const contentType = headers?.['Content-Type'] || 'application/json';
    
    let body: string;
    if (contentType === 'application/x-www-form-urlencoded') {
      // Convert object to URL-encoded string
      body = new URLSearchParams(data).toString();
    } else {
      body = JSON.stringify(data);
    }
    
    return this.request<T>(endpoint, {
      method: 'POST',
      body,
      ...options,
    });
  }

  // Generic GET method for custom endpoints
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
    });
  }

  // Generic DELETE method for custom endpoints
  async delete<T = void>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  // Agent Management
  async getAvailableAgents(context?: RepositoryContext): Promise<Agent[]> {
    let endpoint = '/api/agents/available';
    const params = new URLSearchParams();
    
    if (context?.url) params.append('repoUrl', context.url);
    if (context?.path) params.append('path', context.path);
    if (context?.type) params.append('type', context.type);
    
    const queryString = params.toString();
    if (queryString) {
      endpoint += `?${queryString}`;
    }
    
    const response = await this.request<AgentAvailableResponse>(endpoint);
    return response.agents;
  }

  async listAgents(): Promise<Agent[]> {
    const response = await this.request<{ agents: Agent[] }>('/api/agents');
    return response.agents;
  }

  async getAgent(agentId: string): Promise<Agent> {
    const response = await this.request<{ agent: Agent }>(`/api/agents/${agentId}`);
    return response.agent;
  }

  async createAgent(data: CreateAgentRequest): Promise<Agent> {
    const response = await this.request<{ agent: Agent }>('/api/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.agent;
  }

  async updateAgent(agentId: string, data: Partial<CreateAgentRequest>): Promise<Agent> {
    const response = await this.request<{ agent: Agent }>(`/api/agents/${agentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.agent;
  }

  async deleteAgent(agentId: string): Promise<void> {
    await this.request<void>(`/api/agents/${agentId}`, {
      method: 'DELETE',
    });
  }

  async shareAgent(agentId: string, shareWith: 'team' | 'organization'): Promise<{ shareUrl: string }> {
    return this.request<{ shareUrl: string }>(`/api/agents/${agentId}/share`, {
      method: 'POST',
      body: JSON.stringify({ shareWith }),
    });
  }

  async learnAgentPatterns(agentId: string, patterns: Record<string, any>): Promise<Agent> {
    const response = await this.request<{ agent: Agent }>(`/api/agents/${agentId}/learn`, {
      method: 'POST',
      body: JSON.stringify({ patterns }),
    });
    return response.agent;
  }

  // Team Management
  async listTeams(): Promise<Team[]> {
    const response = await this.request<{ teams: Team[] }>('/v1/auth/teams');
    return response.teams;
  }

  async getTeam(teamId: string): Promise<Team> {
    const response = await this.request<{ team: Team }>(`/api/teams/${teamId}`);
    return response.team;
  }

  // Squad Management
  async listSquads(teamId?: string): Promise<Squad[]> {
    let endpoint = '/api/squads';
    if (teamId) {
      endpoint += `?team_id=${teamId}`;
    }
    const response = await this.request<{ squads: Squad[] }>(endpoint);
    return response.squads;
  }

  async createSquad(data: CreateSquadRequest): Promise<Squad> {
    const response = await this.request<{ squad: Squad }>('/api/squads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.squad;
  }

  async getSquad(squadId: string): Promise<Squad> {
    const response = await this.request<{ squad: Squad }>(`/api/squads/${squadId}`);
    return response.squad;
  }

  async updateSquad(squadId: string, data: Partial<CreateSquadRequest>): Promise<Squad> {
    const response = await this.request<{ squad: Squad }>(`/api/squads/${squadId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.squad;
  }

  async deleteSquad(squadId: string): Promise<void> {
    await this.request<void>(`/api/squads/${squadId}`, {
      method: 'DELETE',
    });
  }

  async addAgentToSquad(squadId: string, agentId: string): Promise<Squad> {
    const response = await this.request<{ squad: Squad }>(`/api/squads/${squadId}/agents`, {
      method: 'POST',
      body: JSON.stringify({ agent_id: agentId }),
    });
    return response.squad;
  }

  async removeAgentFromSquad(squadId: string, agentId: string): Promise<Squad> {
    const response = await this.request<{ squad: Squad }>(`/api/squads/${squadId}/agents/${agentId}`, {
      method: 'DELETE',
    });
    return response.squad;
  }
}

export default GraphynAPIClient;