import { ConfigManager } from '../config-manager.js';
import fetch from 'node-fetch';
import EventSource from 'eventsource';

export interface MCPServer {
  id: string;
  name: string;
  type: 'filesystem' | 'github' | 'slack' | 'claude-flow' | 'custom';
  command: string;
  args?: string[];
  capabilities: string[];
  status: 'active' | 'inactive' | 'error';
}

export interface MCPToolExecution {
  serverId: string;
  toolName: string;
  arguments: Record<string, any>;
}

export interface MCPResource {
  serverId: string;
  uri: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
}

export class MCPClient {
  private apiUrl: string;
  private token: string | null = null;
  private configManager: ConfigManager;

  constructor() {
    this.configManager = new ConfigManager();
    this.apiUrl = process.env.GRAPHYN_API_URL || 'https://api.graphyn.xyz';
  }

  /**
   * Set authentication token
   */
  setToken(token: string): void {
    this.token = token;
  }

  /**
   * Register a new MCP server
   */
  async registerServer(config: {
    name: string;
    type: MCPServer['type'];
    command: string;
    args?: string[];
    env?: Record<string, string>;
    capabilities?: string[];
  }): Promise<{ serverId: string; status: string }> {
    const response = await this.request('/api/mcp/servers/register', {
      method: 'POST',
      body: JSON.stringify(config)
    });

    return response;
  }

  /**
   * List all registered MCP servers
   */
  async listServers(): Promise<MCPServer[]> {
    const response = await this.request('/api/mcp/servers');
    return response.servers;
  }

  /**
   * Execute a tool on an MCP server
   */
  async executeTool(execution: MCPToolExecution): Promise<{
    success: boolean;
    result?: any;
    error?: string;
    executionTime: number;
  }> {
    const response = await this.request('/api/mcp/tools/execute', {
      method: 'POST',
      body: JSON.stringify(execution)
    });

    return response;
  }

  /**
   * Access a resource from an MCP server
   */
  async accessResource(resource: MCPResource): Promise<{
    success: boolean;
    data?: any;
    contentType?: string;
    error?: string;
  }> {
    const response = await this.request('/api/mcp/resources/access', {
      method: 'POST',
      body: JSON.stringify(resource)
    });

    return response;
  }

  /**
   * Check MCP server health
   */
  async checkServerHealth(serverId: string): Promise<{
    status: 'healthy' | 'unhealthy' | 'unknown';
    latency?: number;
    lastCheck?: string;
  }> {
    const response = await this.request(`/api/mcp/servers/${serverId}/health`);
    return response;
  }

  /**
   * Stream MCP suggestions
   */
  async streamSuggestions(
    agentId: string,
    query: string,
    context?: any,
    onMessage?: (message: any) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    // Get stream URL
    const response = await this.request('/api/v1/mcp/stream', {
      method: 'POST',
      body: JSON.stringify({ agentId, query, context })
    });

    const streamUrl = `${this.apiUrl}${response.streamUrl}`;
    
    // Create SSE connection
    const eventSource = new EventSource(streamUrl, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onMessage) {
          onMessage(data);
        }
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      if (onError) {
        onError(error as Error);
      }
      eventSource.close();
    };

    // Return cleanup function
    return new Promise((resolve) => {
      eventSource.addEventListener('close', () => {
        resolve();
      });
    });
  }

  /**
   * Initialize Claude Flow MCP server
   */
  async initializeClaudeFlow(): Promise<void> {
    try {
      // Check if Claude Flow server already exists
      const servers = await this.listServers();
      const claudeFlowServer = servers.find(s => s.type === 'claude-flow');
      
      if (!claudeFlowServer) {
        // Register Claude Flow MCP server
        const result = await this.registerServer({
          name: 'Claude Flow',
          type: 'claude-flow',
          command: 'npx',
          args: ['claude-flow@alpha', 'mcp', 'start'],
          capabilities: [
            'swarm', 'agent', 'memory', 'task', 
            'neural', 'performance', 'github', 'daa'
          ]
        });

        console.log('✅ Claude Flow MCP server registered:', result.serverId);
      } else {
        console.log('✅ Claude Flow MCP server already registered:', claudeFlowServer.id);
      }
    } catch (error) {
      console.error('Failed to initialize Claude Flow MCP:', error);
    }
  }

  /**
   * Execute Claude Flow swarm operations
   */
  async executeSwarmOperation(operation: string, args: Record<string, any>): Promise<any> {
    // Find Claude Flow server
    const servers = await this.listServers();
    const claudeFlowServer = servers.find(s => s.type === 'claude-flow');
    
    if (!claudeFlowServer) {
      throw new Error('Claude Flow MCP server not found. Run initializeClaudeFlow() first.');
    }

    // Execute the operation
    const result = await this.executeTool({
      serverId: claudeFlowServer.id,
      toolName: operation,
      arguments: args
    });

    if (!result.success) {
      throw new Error(result.error || 'Operation failed');
    }

    return result.result;
  }

  /**
   * Common swarm operations
   */
  async initSwarm(topology: string, maxAgents: number = 5): Promise<any> {
    return this.executeSwarmOperation('swarm_init', { topology, maxAgents });
  }

  async spawnAgent(type: string, capabilities?: string[]): Promise<any> {
    return this.executeSwarmOperation('agent_spawn', { type, capabilities });
  }

  async orchestrateTask(task: string, strategy: string = 'adaptive'): Promise<any> {
    return this.executeSwarmOperation('task_orchestrate', { task, strategy });
  }

  async storeMemory(key: string, value: string, namespace?: string): Promise<any> {
    return this.executeSwarmOperation('memory_store', { key, value, namespace });
  }

  async retrieveMemory(key: string, namespace?: string): Promise<any> {
    return this.executeSwarmOperation('memory_retrieve', { key, namespace });
  }

  /**
   * Make authenticated request to API
   */
  private async request(path: string, options: any = {}): Promise<any> {
    if (!this.token) {
      throw new Error('Authentication required. Call setToken() first.');
    }

    const url = `${this.apiUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MCP API error: ${error}`);
    }

    return response.json();
  }
}

// Export singleton instance
export const mcpClient = new MCPClient();