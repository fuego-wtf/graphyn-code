/**
 * MCPCoordinator - MCP Server Auto-Start and Coordination
 * 
 * Handles MCP server lifecycle, stdio handshake, and tool coordination
 * Maps to delivery.md steps 5-8: MCP server integration and health checks
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { EventEmitter } from 'events';

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

  constructor(serverPath?: string) {
    super();
    // Default to our MCP server
    this.serverPath = serverPath || path.resolve(process.cwd(), 'services/mcp/src/index.ts');
  }

  /**
   * Auto-start MCP server with health checks
   * Implements delivery.md steps 5-8
   */
  async startMCPServer(): Promise<MCPConnectionStatus> {
    console.log('🔍 Checking MCP server status...');

    try {
      // Check if MCP server is already running
      if (this.connected && this.mcpProcess) {
        console.log('✅ MCP server already running');
        return this.connectionStatus;
      }

      console.log('🚀 Starting MCP server...');
      
      // Spawn MCP server process
      this.mcpProcess = spawn('tsx', [this.serverPath], {
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
      const request = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: params
        }
      };

      // Write to stdin
      this.mcpProcess.stdin?.write(JSON.stringify(request) + '\n');

      // Wait for response (simplified - real implementation would handle async responses)
      const result = await this.waitForToolResponse(request.id);
      
      const duration = Date.now() - startTime;
      
      toolCall.duration = duration;
      toolCall.success = true;
      toolCall.result = result;

      this.toolCalls.push(toolCall);

      console.log(`📥 MCP: ${toolName} → Success (${duration}ms)`);
      
      return result;

    } catch (error) {
      const err = error as Error;
      const duration = Date.now() - toolCall.timestamp.getTime();
      
      toolCall.duration = duration;
      toolCall.success = false;
      toolCall.error = err.message;

      this.toolCalls.push(toolCall);

      console.error(`📥 MCP: ${toolName} → Error (${duration}ms): ${err.message}`);
      throw error;
    }
  }

  /**
   * Enqueue task via MCP
   */
  async enqueueTask(taskId: string, taskType: string, description: string, dependencies: string[] = []): Promise<void> {
    return this.executeMCPTool('enqueue_task', {
      taskId,
      taskType,
      description,
      dependencies
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
  async completeTask(taskId: string, result: any, metrics?: any): Promise<void> {
    return this.executeMCPTool('complete_task', {
      taskId,
      result,
      metrics
    });
  }

  /**
   * Get task status via MCP
   */
  async getTaskStatus(taskId?: string): Promise<any> {
    return this.executeMCPTool('get_task_status', { taskId });
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

  /**
   * Stop MCP server
   */
  async stopMCPServer(): Promise<void> {
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
      if (parsed.method === 'initialize') {
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
      // Ignore non-JSON messages (logs, etc.)
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

  private startHealthChecks(): void {
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
}