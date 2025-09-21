/**
 * MCP Client - Real Model Context Protocol client
 * 
 * Implements actual MCP protocol communication for agents to connect
 * to MCP servers and call tools like Figma API integration
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  ListToolsResult,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

export interface MCPClientConfig {
  serverCommand?: string;
  serverArgs?: string[];
  timeout?: number;
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolResult {
  success: boolean;
  content?: any;
  error?: string;
  toolUsed: string;
  duration: number;
}

/**
 * MCP Client for real protocol communication
 */
export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;
  private config: MCPClientConfig;
  private isConnected = false;
  private availableTools: string[] = [];

  constructor(config: MCPClientConfig = {}) {
    this.config = {
      serverCommand: config.serverCommand || 'node',
      serverArgs: config.serverArgs || [],
      timeout: config.timeout || 30000
    };

    this.client = new Client({
      name: 'graphyn-agent-client',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });
  }

  /**
   * Connect to MCP server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      // Create transport to MCP server
      this.transport = new StdioClientTransport({
        command: this.config.serverCommand!,
        args: this.config.serverArgs!
      });

      // Connect client
      await this.client.connect(this.transport);
      this.isConnected = true;

      // Load available tools
      await this.loadAvailableTools();

      this.log('info', 'Connected to MCP server successfully');
    } catch (error) {
      this.log('error', `Failed to connect to MCP server: ${error}`);
      throw error;
    }
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      if (this.client) {
        await this.client.close();
      }
      
      this.isConnected = false;
      this.transport = null;
      this.availableTools = [];
      
      this.log('info', 'Disconnected from MCP server');
    } catch (error) {
      this.log('error', `Error disconnecting from MCP server: ${error}`);
    }
  }

  /**
   * Load available tools from MCP server
   */
  private async loadAvailableTools(): Promise<void> {
    try {
      const result = await this.client.listTools();
      this.availableTools = result.tools.map(tool => tool.name);
      
      this.log('info', `Loaded ${this.availableTools.length} MCP tools: ${this.availableTools.join(', ')}`);
    } catch (error) {
      this.log('warn', `Failed to load MCP tools: ${error}`);
    }
  }

  /**
   * Call an MCP tool
   */
  async callTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    if (!this.isConnected) {
      throw new Error('MCP client not connected');
    }

    const startTime = Date.now();

    try {
      this.log('debug', `Calling MCP tool: ${toolCall.name}`, toolCall.arguments);
      
      const result = await this.client.callTool({
        name: toolCall.name,
        arguments: toolCall.arguments
      });
      const duration = Date.now() - startTime;

      this.log('debug', `MCP tool ${toolCall.name} completed in ${duration}ms`);

      return {
        success: true,
        content: result.content,
        toolUsed: toolCall.name,
        duration
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      this.log('error', `MCP tool ${toolCall.name} failed: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
        toolUsed: toolCall.name,
        duration
      };
    }
  }

  /**
   * Call Figma-specific MCP tools
   */
  async callFigmaTool(toolName: string, args: Record<string, any>): Promise<MCPToolResult> {
    return this.callTool({
      name: toolName,
      arguments: args
    });
  }

  /**
   * Get code from Figma node
   */
  async getFigmaCode(nodeId?: string, options: {
    clientFrameworks?: string;
    clientLanguages?: string;
    forceCode?: boolean;
  } = {}): Promise<MCPToolResult> {
    return this.callFigmaTool('get_code', {
      nodeId,
      clientFrameworks: options.clientFrameworks || 'react',
      clientLanguages: options.clientLanguages || 'typescript',
      forceCode: options.forceCode || false
    });
  }

  /**
   * Get Figma metadata
   */
  async getFigmaMetadata(nodeId?: string, options: {
    clientFrameworks?: string;
    clientLanguages?: string;
  } = {}): Promise<MCPToolResult> {
    return this.callFigmaTool('get_metadata', {
      nodeId,
      clientFrameworks: options.clientFrameworks || 'react',
      clientLanguages: options.clientLanguages || 'typescript'
    });
  }

  /**
   * Get Figma screenshot
   */
  async getFigmaScreenshot(nodeId?: string, options: {
    clientFrameworks?: string;
    clientLanguages?: string;
  } = {}): Promise<MCPToolResult> {
    return this.callFigmaTool('get_screenshot', {
      nodeId,
      clientFrameworks: options.clientFrameworks || 'react',
      clientLanguages: options.clientLanguages || 'typescript'
    });
  }

  /**
   * Get Figma variable definitions
   */
  async getFigmaVariables(nodeId?: string, options: {
    clientFrameworks?: string;
    clientLanguages?: string;
  } = {}): Promise<MCPToolResult> {
    return this.callFigmaTool('get_variable_defs', {
      nodeId,
      clientFrameworks: options.clientFrameworks || 'react',
      clientLanguages: options.clientLanguages || 'typescript'
    });
  }

  /**
   * Get Code Connect mapping
   */
  async getCodeConnect(nodeId?: string, options: {
    clientFrameworks?: string;
    clientLanguages?: string;
  } = {}): Promise<MCPToolResult> {
    return this.callFigmaTool('get_code_connect_map', {
      nodeId,
      clientFrameworks: options.clientFrameworks || 'react',
      clientLanguages: options.clientLanguages || 'typescript'
    });
  }

  /**
   * Add Figma file to context
   */
  async addFigmaFile(url: string): Promise<MCPToolResult> {
    return this.callFigmaTool('add_figma_file', { url });
  }

  /**
   * Create design system rules
   */
  async createDesignSystemRules(options: {
    clientFrameworks?: string;
    clientLanguages?: string;
  } = {}): Promise<MCPToolResult> {
    return this.callFigmaTool('create_design_system_rules', {
      clientFrameworks: options.clientFrameworks || 'react',
      clientLanguages: options.clientLanguages || 'typescript'
    });
  }

  /**
   * Check if client is connected
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Get available tools
   */
  getAvailableTools(): string[] {
    return [...this.availableTools];
  }

  /**
   * Check if specific tool is available
   */
  hasTools(toolName: string): boolean {
    return this.availableTools.includes(toolName);
  }

  /**
   * Get client status
   */
  getStatus(): {
    connected: boolean;
    availableTools: string[];
    serverCommand: string | undefined;
  } {
    return {
      connected: this.isConnected,
      availableTools: this.getAvailableTools(),
      serverCommand: this.config.serverCommand
    };
  }

  /**
   * Structured logging
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [MCPClient]`;
    
    const logMessage = data ? `${message} ${JSON.stringify(data)}` : message;
    
    switch (level) {
      case 'debug':
        if (process.env.DEBUG) console.debug(`${prefix} ${logMessage}`);
        break;
      case 'info':
        console.log(`${prefix} ${logMessage}`);
        break;
      case 'warn':
        console.warn(`${prefix} ${logMessage}`);
        break;
      case 'error':
        console.error(`${prefix} ${logMessage}`);
        break;
    }
  }
}