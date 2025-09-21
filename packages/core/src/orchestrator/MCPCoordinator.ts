/**
 * MCPCoordinator - MCP Server Auto-Start and Coordination
 * 
 * Handles MCP server lifecycle, stdio handshake, and tool coordination
 * Maps to delivery.md steps 5-8: MCP server integration and health checks
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { EventEmitter } from 'events';
import { existsSync, readFileSync } from 'fs';
import type { TransparencyEngine } from '../monitoring/TransparencyEngine.js';
import type { TaskConfig } from '../types/TaskEnvelope.js';

interface MCPClientConfig {
  mcpServers?: Record<string, {
    serverUrl: string;
    apiKey?: string;
  }>;
}

export interface MCPConnectionStatus {
  connected: boolean;
  pid?: number;
  startTime?: Date;
  lastPing?: Date;
  error?: string;
}

export interface MCPToolCall {
  tool: string;
  params: Record<string, any>;
  timestamp: Date;
  duration?: number;
  success?: boolean;
  result?: any;
  error?: string;
}

export class MCPCoordinator extends EventEmitter {
  private mcpProcess: ChildProcess | null = null;
  private connected = false;
  private serverPath: string;
  private connectionStatus: MCPConnectionStatus = { connected: false };
  private toolCalls: MCPToolCall[] = [];
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private transparency?: TransparencyEngine;
  private clientConfig: MCPClientConfig = {};
  private readonly mockMode: boolean;
  private mockDb: any = null;

  constructor(serverPath?: string) {
    super();
    // Default to our MCP server entrypoint
    this.serverPath = serverPath || path.resolve(process.cwd(), 'services/mcp/src/server.ts');
    this.loadClientConfig();

    this.mockMode = process.env.GRAPHYN_USE_MOCK_MCP === '1' || process.env.GRAPHYN_USE_MOCK_MCP === 'true';
  }

  attachTransparencyEngine(engine: TransparencyEngine): void {
    this.transparency = engine;
    engine.attachTo(this);
  }

  /**
   * Auto-start MCP server with health checks
   * Implements delivery.md steps 5-8
   */
  async startMCPServer(): Promise<MCPConnectionStatus> {
    console.log('🔍 Checking MCP server status...');

    try {
      // Check if MCP server is already running
      if (this.connected && (this.mcpProcess || this.mockMode)) {
        console.log('✅ MCP server already running');
        return this.connectionStatus;
      }

      if (this.mockMode) {
        await this.ensureMockDb();
        console.log('🧪 Using in-process mock MCP server');
        this.connected = true;
        this.connectionStatus = {
          connected: true,
          pid: process.pid,
          startTime: new Date(),
          lastPing: new Date(),
        };
        this.emit('connected', this.connectionStatus);
        return this.connectionStatus;
      }

      console.log('🚀 Starting MCP server...');
      
      // Spawn MCP server process using compiled JS
      const compiledPath = this.serverPath.replace('/src/', '/dist/').replace('.ts', '.js');
      let command = 'node';
      let args = [compiledPath];
      const compiledCoordinationPath = path.resolve(path.dirname(compiledPath), 'coordination', 'task-coordinator.js');

      const compiledBundleMissing = !existsSync(compiledCoordinationPath);

      if (!existsSync(compiledPath) || compiledBundleMissing) {
        if (!existsSync(this.serverPath)) {
          throw new Error(`MCP server entry not found at ${compiledPath} or ${this.serverPath}`);
        }

        // Fall back to tsx executing TypeScript source directly
        command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
        args = ['tsx', this.serverPath];
        console.log('⚙️  Compiled MCP server not ready; using tsx to run TypeScript sources.');
      }

      this.mcpProcess = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: { ...process.env, NODE_ENV: 'production' }
      });

      const startTime = Date.now();

      // Set up process event handlers
      this.setupProcessHandlers();

      // Wait for stdio handshake
      await this.waitForHandshake();

      const duration = Date.now() - startTime;
      
      this.connectionStatus = {
        connected: true,
        pid: this.mcpProcess.pid,
        startTime: new Date(),
        lastPing: new Date()
      };

      console.log(`✅ MCP server started [PID: ${this.mcpProcess.pid}] in ${duration}ms`);
      console.log('🤝 MCP handshake complete - stdio transport ready');

      // Start health checks
      this.startHealthChecks();

      this.emit('connected', this.connectionStatus);
      return this.connectionStatus;

    } catch (error) {
      const err = error as Error;
      console.error(`❌ Failed to start MCP server: ${err.message}`);
      
      this.connectionStatus = {
        connected: false,
        error: err.message
      };

      this.emit('error', err);
      throw error;
    }
  }

  /**
   * Execute MCP tool with proper coordination
   */
  async executeMCPTool(toolName: string, params: Record<string, any> = {}): Promise<any> {
    if (this.mockMode) {
      return this.executeMockTool(toolName, params);
    }

    if (!this.connected || !this.mcpProcess) {
      throw new Error('MCP server not connected');
    }

    const toolCall: MCPToolCall = {
      tool: toolName,
      params,
      timestamp: new Date()
    };

    console.log(`📤 MCP: ${toolName}(${JSON.stringify(params)}) →`);
    
    try {
      const startTime = Date.now();
      
      // Send tool call to MCP server via stdio
      const requestId = Date.now();
      const request = {
        jsonrpc: '2.0',
        id: requestId,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: params
        }
      };

      // Write to stdin
      this.mcpProcess.stdin?.write(JSON.stringify(request) + '\n');

      this.emit('mcp:tool-call', {
        id: requestId,
        name: toolName,
        params
      });

      // Wait for response (simplified - real implementation would handle async responses)
      const payload = await this.waitForToolResponse(requestId);
      const result = this.parseToolResult(toolName, payload);
      
      const duration = Date.now() - startTime;
      
      toolCall.duration = duration;
      toolCall.success = true;
      toolCall.result = result;

      this.toolCalls.push(toolCall);

      console.log(`📥 MCP: ${toolName} → Success (${duration}ms)`);
      this.emit('mcp:tool-response', {
        id: requestId,
        name: toolName,
        duration,
        success: true,
        result
      });

      return result;

    } catch (error) {
      const err = error as Error;
      const duration = Date.now() - toolCall.timestamp.getTime();
      
      toolCall.duration = duration;
      toolCall.success = false;
      toolCall.error = err.message;

      this.toolCalls.push(toolCall);

      console.error(`📥 MCP: ${toolName} → Error (${duration}ms): ${err.message}`);
      this.emit('mcp:tool-response', {
        id: toolCall.timestamp.getTime(),
        name: toolName,
        duration,
        success: false,
        error: err.message
      });
      throw error;
    }
  }

  /**
   * Enqueue task via MCP
   */
  async enqueueTask(
    taskId: string,
    taskType: string,
    description: string,
    dependencies: string[] = [],
    workspacePath?: string,
    priority?: number,
    config?: TaskConfig,
    metadata?: Record<string, any>,
    tags?: string[],
  ): Promise<void> {
    return this.executeMCPTool('enqueue_task', {
      task_id: taskId,
      agent_type: taskType,
      description,
      dependencies,
      workspace_path: workspacePath,
      priority,
      tools: config?.tools,
      timeout_seconds: config?.timeoutSeconds,
      max_retries: config?.maxRetries,
      environment: config?.environment,
      metadata,
      tags,
    });
  }

  /**
   * Get next ready task via MCP
   */
  async getNextTask(): Promise<any> {
    return this.executeMCPTool('get_next_task', {});
  }

  /**
   * Complete task via MCP
   */
  async completeTask(
    taskId: string,
    success: boolean,
    options: { result?: any; metrics?: any; error?: string } = {}
  ): Promise<void> {
    return this.executeMCPTool('complete_task', {
      task_id: taskId,
      success,
      result: options.result,
      metrics: options.metrics,
      error_message: options.error
    });
  }

  /**
   * Get task status via MCP
   */
  async getTaskStatus(taskId?: string): Promise<any> {
    return this.executeMCPTool('get_task_status', { task_id: taskId });
  }

  /**
   * Spawn agent via MCP
   */
  async spawnAgent(agentType: string, agentId: string, workspaceDir: string): Promise<any> {
    return this.executeMCPTool('agents_spawn', {
      agentType,
      agentId,
      workspaceDir
    });
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): MCPConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Get tool call history
   */
  getToolCallHistory(): MCPToolCall[] {
    return [...this.toolCalls];
  }

  getClientConfig(): MCPClientConfig {
    return { ...this.clientConfig };
  }

  async ingestDeepwiki(query: string, sessionId: string): Promise<any> {
    return this.executeMCPTool('ingest_deepwiki', {
      query,
      session_id: sessionId,
    });
  }

  /**
   * Stop MCP server
   */
  async stopMCPServer(): Promise<void> {
    if (this.mockMode) {
      this.connected = false;
      this.connectionStatus = { connected: false };
      return;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.mcpProcess) {
      console.log('🛑 Stopping MCP server...');
      
      this.mcpProcess.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise((resolve) => {
        this.mcpProcess?.on('exit', resolve);
        
        // Force kill after 5 seconds
        setTimeout(() => {
          if (this.mcpProcess && !this.mcpProcess.killed) {
            this.mcpProcess.kill('SIGKILL');
          }
          resolve(undefined);
        }, 5000);
      });

      this.mcpProcess = null;
      this.connected = false;
      this.connectionStatus = { connected: false };

      console.log('✅ MCP server stopped');
      this.emit('disconnected');
    }
  }

  /**
   * Private methods
   */
  private setupProcessHandlers(): void {
    if (!this.mcpProcess) return;

    // Handle stdout for responses
    this.mcpProcess.stdout?.on('data', (data) => {
      try {
        const lines = data.toString().split('\n').filter((line: string) => line.trim());
        for (const line of lines) {
          this.handleMCPMessage(line);
        }
      } catch (error) {
        console.error('Error parsing MCP stdout:', error);
      }
    });

    // Handle stderr for errors
    this.mcpProcess.stderr?.on('data', (data) => {
      console.error('MCP stderr:', data.toString());
    });

    // Handle process exit
    this.mcpProcess.on('exit', (code, signal) => {
      console.log(`MCP process exited: code=${code}, signal=${signal}`);
      this.connected = false;
      this.connectionStatus = { connected: false };
      this.emit('disconnected');
    });

    // Handle process errors
    this.mcpProcess.on('error', (error) => {
      console.error('MCP process error:', error);
      this.connected = false;
      this.connectionStatus = { connected: false, error: error.message };
      this.emit('error', error);
    });
  }

  private handleMCPMessage(message: string): void {
    try {
      const parsed = JSON.parse(message);
      
      // Handle initialization/handshake
      if ((parsed.id === 1 && parsed.result) || parsed.method === 'initialize') {
        this.connected = true;
        this.emit('handshake', parsed);
      }
      
      // Handle tool responses
      if (parsed.id && parsed.result !== undefined) {
        this.emit('toolResponse', parsed);
      }
      
      // Handle notifications
      if (parsed.method && !parsed.id) {
        this.emit('notification', parsed);
      }
    } catch (error) {
      this.emit('mcp:process-log', { message });
    }
  }

  private async waitForHandshake(timeout = 10000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`MCP handshake timeout after ${timeout}ms`));
      }, timeout);

      const onHandshake = () => {
        clearTimeout(timeoutId);
        this.off('handshake', onHandshake);
        this.off('error', onError);
        resolve();
      };

      const onError = (error: Error) => {
        clearTimeout(timeoutId);
        this.off('handshake', onHandshake);
        this.off('error', onError);
        reject(error);
      };

      this.once('handshake', onHandshake);
      this.once('error', onError);

      // Send initial handshake
      if (this.mcpProcess?.stdin) {
        const initMessage = {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'graphyn-cli',
              version: '1.0.0'
            }
          }
        };
        
        this.mcpProcess.stdin.write(JSON.stringify(initMessage) + '\n');
      }
    });
  }

  private async waitForToolResponse(requestId: number, timeout = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Tool call timeout after ${timeout}ms`));
      }, timeout);

      const onResponse = (response: any) => {
        if (response.id === requestId) {
          clearTimeout(timeoutId);
          this.off('toolResponse', onResponse);
          
          if (response.error) {
            reject(new Error(response.error.message || 'Tool call failed'));
          } else {
            resolve(response.result);
          }
        }
      };

      this.on('toolResponse', onResponse);
    });
  }

  private parseToolResult(tool: string, result: any): any {
    if (!result || !Array.isArray(result.content)) {
      return result;
    }

    const first = result.content.find((item: any) => item.type === 'text' && typeof item.text === 'string');
    if (!first) {
      return result;
    }

    try {
      return JSON.parse(first.text);
    } catch (error) {
      console.warn(`Unable to parse ${tool} response payload`, error);
      return result;
    }
  }

  private startHealthChecks(): void {
    if (this.mockMode) {
      return;
    }
    // Ping MCP server every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.executeMCPTool('health_check', {});
        this.connectionStatus.lastPing = new Date();
      } catch (error) {
        console.warn('MCP health check failed:', error);
        // Could implement reconnection logic here
      }
    }, 30000);
  }

  private async ensureMockDb(): Promise<void> {
    if (this.mockDb) {
      return;
    }

    const moduleUrl = new URL('../../../db/dist/index.js', import.meta.url).href;
    const dbModule: any = await import(moduleUrl);
    if (typeof dbModule.createDatabase !== 'function') {
      throw new Error('Failed to load mock database module');
    }
    this.mockDb = dbModule.createDatabase({ type: 'mock' });
  }

  private async executeMockTool(toolName: string, params: Record<string, any>): Promise<any> {
    await this.ensureMockDb();
    const db = this.mockDb;

    const callId = Date.now();
    this.emit('mcp:tool-call', {
      id: callId,
      name: toolName,
      params,
    });

    const startTime = Date.now();

    try {
      let result: any;

      switch (toolName) {
        case 'enqueue_task': {
          const taskId = params.task_id || params.taskId;
          if (!taskId) {
            throw new Error('Missing task_id');
          }
          await db.enqueueTask(taskId, {
            agentType: params.agent_type || params.agentType,
            description: params.description,
            priority: params.priority ?? 5,
            dependencies: params.dependencies || [],
            workspace: params.workspace_path,
            config: { tools: params.tools || [] },
          });
          result = { success: true };
          break;
        }
        case 'get_next_task': {
          const task = await db.getNextTask(params.agent_type || params.agentType);
          result = { success: true, task: task || null };
          break;
        }
        case 'complete_task': {
          await db.completeTask(params.task_id || params.taskId, {
            success: params.success,
            result: params.result,
            error: params.error_message,
          });
          result = { success: true };
          break;
        }
        case 'get_task_status': {
          const status = await db.getTaskStatus();
          result = { success: true, status };
          break;
        }
        case 'ingest_deepwiki': {
          const title = params.query || 'mock-topic';
          const content = `Mock deepwiki content for ${title}`;
          await db.upsertKnowledgeEntry({
            source: 'deepwiki',
            sessionId: params.session_id,
            title,
            content,
          });
          result = { success: true, entry: { title, content } };
          break;
        }
        case 'health_check': {
          result = { success: true };
          break;
        }
        default:
          throw new Error(`Unknown mock MCP tool: ${toolName}`);
      }

      this.emit('mcp:tool-response', {
        id: callId,
        name: toolName,
        duration: Date.now() - startTime,
        success: true,
        result,
      });

      return result;
    } catch (error) {
      this.emit('mcp:tool-response', {
        id: callId,
        name: toolName,
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private loadClientConfig(): void {
    const configPath = path.resolve(process.cwd(), 'config/mcp-clients.json');
    if (!existsSync(configPath)) {
      return;
    }

    try {
      const raw = readFileSync(configPath, 'utf-8');
      this.clientConfig = JSON.parse(raw) as MCPClientConfig;
    } catch (error) {
      console.warn('Failed to read MCP client configuration:', error);
      this.clientConfig = {};
    }
  }
}
