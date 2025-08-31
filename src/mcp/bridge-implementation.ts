/**
 * MCP (Model Context Protocol) Bridge Implementation
 * Connects @graphyn/code CLI with Claude Code via MCP server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { GraphynAPIClient } from '../api/client.js';


export interface MCPBridgeOptions {
  apiUrl?: string;
  debug?: boolean;
}

export class GraphynMCPBridge {
  private server: Server;
  private apiClient: GraphynAPIClient;
  // Auth manager removed - offline mode
  
  constructor(options: MCPBridgeOptions = {}) {
    // Auth disabled for offline mode
    this.apiClient = new GraphynAPIClient();
    
    this.server = new Server(
      {
        name: 'graphyn',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );
    
    this.setupHandlers();
  }
  
  /**
   * Initialize the MCP bridge
   * Handles authentication and starts the server
   */
  async initialize(): Promise<void> {
    try {
      // Check for existing authentication
      const isAuthenticated = await this.apiClient.isAuthenticated();
      
      if (!isAuthenticated) {
        // Need to authenticate
        console.error('Authentication required. Please run: graphyn auth');
        process.exit(1);
      }
      
      // Register MCP server with backend (optional - if the backend supports it)
      // await this.registerWithBackend();
      
      // Start the MCP server
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      console.error('Graphyn MCP Bridge initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MCP bridge:', error);
      process.exit(1);
    }
  }
  
  /**
   * Register this MCP server with the Graphyn backend
   * This is optional and only if the backend supports MCP registration
   */
  private async registerWithBackend(): Promise<void> {
    // This can be implemented when the backend adds MCP registration support
    // For now, the MCP bridge works locally without backend registration
    console.debug('MCP backend registration not yet implemented');
  }
  
  /**
   * Setup MCP protocol handlers
   */
  private setupHandlers(): void {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.getAvailableTools(),
    }));
    
    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      if (!this.apiClient) {
        throw new Error('Not authenticated');
      }
      
      // Route tool calls to appropriate handlers
      switch (name) {
        case 'create_thread':
          return this.handleCreateThread(args);
        case 'send_message':
          return this.handleSendMessage(args);
        case 'list_threads':
          return this.handleListThreads(args);
        case 'spawn_agent':
          return this.handleSpawnAgent(args);
        case 'configure_squad':
          return this.handleConfigureSquad(args);
        case 'analyze_repository':
          return this.handleAnalyzeRepository(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
    
    // Handle resource listing
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: this.getAvailableResources(),
    }));
    
    // Handle resource reading
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      return this.handleReadResource(uri);
    });
  }
  
  /**
   * Get list of available tools
   */
  private getAvailableTools() {
    return [
      {
        name: 'create_thread',
        description: 'Create a new Graphyn thread for AI agent configuration',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Thread name' },
            description: { type: 'string', description: 'Thread description' },
            type: { 
              type: 'string', 
              enum: ['builder', 'testing', 'production'],
              description: 'Thread type'
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'send_message',
        description: 'Send a message to a thread',
        inputSchema: {
          type: 'object',
          properties: {
            thread_id: { type: 'string', description: 'Thread ID' },
            message: { type: 'string', description: 'Message content' },
          },
          required: ['thread_id', 'message'],
        },
      },
      {
        name: 'list_threads',
        description: 'List all threads in the current organization',
        inputSchema: {
          type: 'object',
          properties: {
            state: { 
              type: 'string',
              enum: ['building', 'testing', 'deployed', 'disabled', 'archived'],
              description: 'Filter by thread state'
            },
            limit: { type: 'number', description: 'Maximum number of threads' },
          },
        },
      },
      {
        name: 'spawn_agent',
        description: 'Create a new AI agent in a thread',
        inputSchema: {
          type: 'object',
          properties: {
            thread_id: { type: 'string', description: 'Thread ID' },
            name: { type: 'string', description: 'Agent name' },
            model: { 
              type: 'string',
              enum: ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet'],
              description: 'AI model'
            },
            system_prompt: { type: 'string', description: 'System prompt' },
            capabilities: {
              type: 'array',
              items: { type: 'string' },
              description: 'Agent capabilities',
            },
          },
          required: ['thread_id', 'name'],
        },
      },
      {
        name: 'configure_squad',
        description: 'Configure a squad of agents',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Squad name' },
            thread_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'Thread IDs to include in squad',
            },
            configuration: {
              type: 'object',
              description: 'Squad configuration',
            },
          },
          required: ['name', 'thread_ids'],
        },
      },
      {
        name: 'analyze_repository',
        description: 'Analyze the current repository context',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Repository path' },
            include_patterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'File patterns to include',
            },
            exclude_patterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'File patterns to exclude',
            },
          },
        },
      },
    ];
  }
  
  /**
   * Get list of available resources
   */
  private getAvailableResources() {
    return [
      {
        uri: 'graphyn://threads',
        name: 'Threads',
        description: 'All threads in your organization',
        mimeType: 'application/json',
      },
      {
        uri: 'graphyn://agents',
        name: 'Agents',
        description: 'All agents across threads',
        mimeType: 'application/json',
      },
      {
        uri: 'graphyn://squads',
        name: 'Squads',
        description: 'Agent squad configurations',
        mimeType: 'application/json',
      },
      {
        uri: 'graphyn://context',
        name: 'Repository Context',
        description: 'Current repository analysis',
        mimeType: 'application/json',
      },
    ];
  }
  
  // Tool handlers
  private async handleCreateThread(args: any) {
    const thread = await this.apiClient.createThread({
      name: args.name,
      type: args.type || 'builder',
      participants: []
    });
    
    return {
      content: [
        {
          type: 'text',
          text: `Created thread: ${thread.id} (${thread.name})`,
        },
      ],
    };
  }
  
  private async handleSendMessage(args: any) {
    const response = await this.apiClient.sendMessage(
      args.thread_id,
      args.message
    );
    
    return {
      content: [
        {
          type: 'text',
          text: response.content,
        },
      ],
    };
  }
  
  private async handleListThreads(args: any) {
    const threads = await this.apiClient.listThreads({
      limit: args.limit || 10,
      type: args.type
    });
    
    const threadList = threads.map((t: any) => 
      `- ${t.name} (${t.id}): ${t.type}`
    ).join('\n');
    
    return {
      content: [
        {
          type: 'text',
          text: `Threads:\n${threadList}`,
        },
      ],
    };
  }
  
  private async handleSpawnAgent(args: any) {
    const agent = await this.apiClient.createAgent({
      name: args.name,
      model: args.model || 'gpt-4',
      instructions: args.system_prompt,
    });
    
    // Add agent to thread if specified
    if (args.thread_id) {
      await this.apiClient.addParticipant(args.thread_id, agent.id);
    }
    
    return {
      content: [
        {
          type: 'text',
          text: `Created agent: ${agent.name}${args.thread_id ? ` and added to thread ${args.thread_id}` : ''}`,
        },
      ],
    };
  }
  
  private async handleConfigureSquad(args: any) {
    const squad = await this.apiClient.createSquad({
      name: args.name,
      agents: args.thread_ids || []
    });
    
    return {
      content: [
        {
          type: 'text',
          text: `Configured squad: ${squad.name} with ${squad.agents.length} agents`,
        },
      ],
    };
  }
  
  private async handleAnalyzeRepository(args: any) {
    // Import repository analyzer
    const { RepositoryAnalyzer } = await import('../services/repository-analyzer');
    
    const analyzer = new RepositoryAnalyzer();
    const analysis = await analyzer.analyze({
      path: args.path || process.cwd(),
      includePatterns: args.include_patterns,
      excludePatterns: args.exclude_patterns,
    });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(analysis, null, 2),
        },
      ],
    };
  }
  
  // Resource handlers
  private async handleReadResource(uri: string) {
    switch (uri) {
      case 'graphyn://threads': {
        const threads = await this.apiClient.listThreads();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(threads, null, 2),
            },
          ],
        };
      }
      
      case 'graphyn://agents': {
        const agents = await this.apiClient.listAgents();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(agents, null, 2),
            },
          ],
        };
      }
      
      case 'graphyn://squads': {
        const squads = await this.apiClient.listSquads();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(squads, null, 2),
            },
          ],
        };
      }
      
      case 'graphyn://context': {
        const { RepositoryAnalyzer } = await import('../services/repository-analyzer');
        const analyzer = new RepositoryAnalyzer();
        const context = await analyzer.analyze({ path: process.cwd() });
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(context, null, 2),
            },
          ],
        };
      }
      
      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  }
}

// Export for CLI usage
export async function startMCPServer(): Promise<void> {
  const bridge = new GraphynMCPBridge({
    apiUrl: process.env.GRAPHYN_API_URL,
    debug: process.env.DEBUG === 'true',
  });
  
  await bridge.initialize();
}