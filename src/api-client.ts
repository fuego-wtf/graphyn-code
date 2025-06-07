import { EventSource } from 'eventsource';

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

export class GraphynAPIClient {
  private baseUrl: string;
  private token?: string;

  constructor(baseUrl: string = 'http://localhost:4000') {
    this.baseUrl = baseUrl;
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
    
    // For now, let's create a basic EventSource
    // In production, you might need to handle auth headers differently
    const eventSource = new EventSource(`${url}?token=${this.token}`);
    
    return eventSource;
  }

  // Health Check
  async ping(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/ping');
  }
}

export default GraphynAPIClient;