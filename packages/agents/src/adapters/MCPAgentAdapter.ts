/**
 * MCP Agent Adapter - Bridge between ClaudeCodeAgent and MCP server
 * 
 * Wraps existing specialized agents to work with MCP task coordination
 * while maintaining their original capabilities
 */

import { v4 as uuidv4 } from 'uuid';
import { ClaudeCodeAgent, type AgentConfig as BaseAgentConfig } from '../base/ClaudeCodeAgent.js';
import { MCPClient, type MCPToolResult } from '../clients/MCPClient.js';
import type { Task } from '@graphyn/core';

export interface MCPAgentConfig extends BaseAgentConfig {
  sessionId: string;
  mcpServerUrl?: string;
  mcpServerCommand?: string;
  mcpServerArgs?: string[];
  pollInterval?: number;
}

export interface MCPTask {
  id: string;
  description: string;
  agentType: string;
  dependencies: string[];
  priority: number;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface MCPTaskResult {
  success: boolean;
  result: Record<string, any>;
  metrics: {
    duration: number;
    tokensUsed?: number;
    toolsUsed: string[];
    memoryUsage?: number;
    cpuUsage?: number;
  };
  error?: string;
}

/**
 * MCP Agent Adapter - Connects existing agents to MCP coordination
 */
export class MCPAgentAdapter {
  private agent: ClaudeCodeAgent;
  private config: MCPAgentConfig;
  private mcpClient: MCPClient;
  private isRunning = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private currentMCPTask: MCPTask | null = null;
  private status: 'idle' | 'busy' | 'error' | 'offline' = 'offline';

  constructor(agent: ClaudeCodeAgent, config: MCPAgentConfig) {
    this.agent = agent;
    this.config = {
      ...config,
      mcpServerUrl: config.mcpServerUrl || process.env.MCP_SERVER_URL,
      mcpServerCommand: config.mcpServerCommand || process.env.MCP_SERVER_COMMAND,
      mcpServerArgs: config.mcpServerArgs || (process.env.MCP_SERVER_ARGS?.split(' ') || []),
      pollInterval: config.pollInterval || 5000
    };
    
    // Initialize MCP client
    this.mcpClient = new MCPClient({
      serverCommand: this.config.mcpServerCommand,
      serverArgs: this.config.mcpServerArgs
    });
  }

  private mapAgentTypeToTaskType(agentType: string | undefined): Task['type'] {
    switch ((agentType || 'implementation').toLowerCase()) {
      case 'backend':
        return 'backend_development';
      case 'security':
        return 'security_analysis';
      case 'frontend':
        return 'implementation';
      case 'figma':
        return 'analysis';
      case 'test':
      case 'testing':
        return 'testing';
      case 'devops':
        return 'deployment';
      default:
        return 'implementation';
    }
  }

  /**
   * Start MCP agent coordination
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.log('info', 'Starting MCP agent coordination...');

    try {
      // Initialize the underlying agent
      await this.agent.initialize({
        sessionId: this.config.sessionId,
        taskDescription: 'MCP-coordinated agent execution',
        dependencies: []
      });

      // Connect to MCP server
      if (this.config.mcpServerCommand) {
        await this.mcpClient.connect();
      }

      // Register with MCP coordinator
      await this.registerWithMCP();

      // Start task polling
      this.startTaskPolling();

      this.isRunning = true;
      this.status = 'idle';
      
      this.log('info', `MCP agent started: ${this.config.id}`);

    } catch (error) {
      this.log('error', `Failed to start MCP agent: ${error}`);
      this.status = 'error';
      throw error;
    }
  }

  /**
   * Stop MCP agent coordination
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.log('info', 'Stopping MCP agent...');

    this.isRunning = false;
    this.status = 'offline';

    // Stop polling
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Clean up current task if any
    if (this.currentMCPTask) {
      this.log('warn', `Stopping with active task: ${this.currentMCPTask.id}`);
    }

    // Disconnect from MCP server
    if (this.mcpClient.connected) {
      await this.mcpClient.disconnect();
    }

    // Clean up underlying agent
    await this.agent.cleanup();

    this.log('info', `MCP agent stopped: ${this.config.id}`);
  }

  /**
   * Register agent with MCP coordinator
   */
  private async registerWithMCP(): Promise<void> {
    try {
      const response = await this.callMCPTool('register_agent', {
        agentId: this.config.id,
        agentType: this.config.type,
        capabilities: this.config.capabilities,
        sessionId: this.config.sessionId,
        metadata: {
          specialization: this.config.specialization,
          tools: this.config.tools || [],
          workspaceDir: this.config.workspaceDir
        }
      });

      if (!response.success) {
        throw new Error(`MCP registration failed: ${response.message || 'Unknown error'}`);
      }

      this.log('info', 'Successfully registered with MCP coordinator');
    } catch (error) {
      this.log('error', `MCP registration failed: ${error}`);
      throw error;
    }
  }

  /**
   * Start task polling loop
   */
  private startTaskPolling(): void {
    const poll = async () => {
      if (!this.isRunning) {
        return;
      }

      try {
        if (this.status === 'idle') {
          await this.checkForTasks();
        }

        // Update status with MCP server
        await this.updateMCPStatus();

        // Schedule next poll
        this.pollTimer = setTimeout(poll, this.config.pollInterval);

      } catch (error) {
        this.log('error', `Task polling error: ${error}`);
        this.status = 'error';
        
        // Retry with longer delay on error
        this.pollTimer = setTimeout(poll, this.config.pollInterval! * 2);
      }
    };

    // Start polling after a brief delay
    this.pollTimer = setTimeout(poll, 1000);
  }

  /**
   * Check for new tasks from MCP coordinator
   */
  private async checkForTasks(): Promise<void> {
    try {
      const response = await this.callMCPTool('get_next_task', {
        agentId: this.config.id,
        agentType: this.config.type,
        capabilities: this.config.capabilities
      });

      if (response.success && response.task) {
        const mcpTask = response.task as MCPTask;
        this.log('info', `Received MCP task: ${mcpTask.id} - ${mcpTask.description}`);
        await this.executeMCPTask(mcpTask);
      }
    } catch (error) {
      this.log('error', `Failed to check for tasks: ${error}`);
    }
  }

  /**
   * Execute an MCP task using the underlying agent
   */
  private async executeMCPTask(mcpTask: MCPTask): Promise<void> {
    const startTime = new Date();
    this.currentMCPTask = mcpTask;
    this.status = 'busy';

    this.log('info', `Starting execution of MCP task: ${mcpTask.id}`);

    try {
      // Convert MCP task to internal task format
      const internalTask: Task = {
        id: mcpTask.id,
        description: mcpTask.description,
        type: this.mapAgentTypeToTaskType(mcpTask.agentType),
        priority: mcpTask.priority ?? 3,
        dependencies: mcpTask.dependencies ?? [],
        config: {
          ...(mcpTask.metadata || {}),
          tools: mcpTask.metadata?.tools || [],
        },
        workingDirectory: this.config.workspaceDir || process.cwd(),
        deliverables: [],
        requiredSkills: [],
        acceptanceCriteria: [],
        estimatedDuration: 60,
      };

      // Execute using the underlying agent
      const execution = await this.agent.executeTask(internalTask, {
        sessionId: this.config.sessionId,
        taskDescription: mcpTask.description,
        dependencies: mcpTask.dependencies
      });

      // Prepare result for MCP coordinator
      const result: MCPTaskResult = {
        success: execution.status === 'completed',
        result: {
          output: execution.output,
          execution: execution
        },
        metrics: {
          duration: execution.metrics?.duration || (new Date().getTime() - startTime.getTime()),
          tokensUsed: execution.metrics?.tokensUsed,
          toolsUsed: execution.metrics?.toolsUsed || [],
          memoryUsage: this.getMemoryUsage(),
          cpuUsage: this.getCPUUsage()
        },
        error: execution.error
      };

      // Report completion to MCP coordinator
      await this.callMCPTool('complete_task', {
        taskId: mcpTask.id,
        agentId: this.config.id,
        result: result.result,
        metrics: result.metrics
      });

      const duration = new Date().getTime() - startTime.getTime();
      this.log('info', `MCP task ${mcpTask.id} completed successfully in ${duration}ms`);

    } catch (error) {
      this.log('error', `MCP task ${mcpTask.id} failed: ${error}`);

      // Report failure to MCP coordinator
      try {
        await this.callMCPTool('complete_task', {
          taskId: mcpTask.id,
          agentId: this.config.id,
          result: { 
            error: error instanceof Error ? error.message : String(error) 
          },
          metrics: {
            duration: new Date().getTime() - startTime.getTime(),
            toolsUsed: [],
            success: false
          }
        });
      } catch (reportError) {
        this.log('error', `Failed to report task failure: ${reportError}`);
      }

      this.status = 'error';
    } finally {
      this.currentMCPTask = null;
      
      // Return to idle after brief delay
      setTimeout(() => {
        if (this.isRunning && this.status !== 'offline') {
          this.status = 'idle';
        }
      }, 1000);
    }
  }

  /**
   * Update agent status with MCP coordinator
   */
  private async updateMCPStatus(): Promise<void> {
    try {
      await this.callMCPTool('update_agent_status', {
        agentId: this.config.id,
        status: this.status,
        currentTask: this.currentMCPTask?.id,
        metrics: {
          cpu: this.getCPUUsage(),
          memory: this.getMemoryUsage(),
          tasksCompleted: 0 // Tracked by coordinator
        }
      });
    } catch (error) {
      this.log('debug', `Status update failed: ${error}`);
      // Non-critical, don't change agent state
    }
  }

  /**
   * Call MCP server tool (real implementation)
   */
  private async callMCPTool(toolName: string, args: Record<string, any>): Promise<any> {
    try {
      // If MCP client is available and connected, use real MCP protocol
      if (this.mcpClient && this.mcpClient.connected) {
        const result = await this.mcpClient.callTool({ name: toolName, arguments: args });
        
        if (result.success) {
          return {
            success: true,
            message: `${toolName} completed`,
            [toolName.includes('get_next_task') ? 'task' : 'data']: result.content,
            ...result.content
          };
        } else {
          throw new Error(result.error || 'MCP tool call failed');
        }
      }
      
      // Fallback to simulation for testing without MCP server
      this.log('debug', `MCP call (simulated): ${toolName}`, args);
      
      const simulatedResponse = {
        success: true,
        message: `${toolName} completed (simulated)`,
        [toolName.includes('get_next_task') ? 'task' : 'data']: 
          toolName.includes('get_next_task') ? null : args
      };
      
      await new Promise(resolve => setTimeout(resolve, 50));
      return simulatedResponse;
      
    } catch (error) {
      this.log('error', `MCP tool call failed: ${toolName}`, error);
      throw error;
    }
  }

  /**
   * Get current CPU usage percentage
   */
  private getCPUUsage(): number {
    const usage = process.cpuUsage();
    return Math.round((usage.user + usage.system) / 1000000);
  }

  /**
   * Get current memory usage in MB
   */
  private getMemoryUsage(): number {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024);
  }

  /**
   * Get adapter status
   */
  getStatus(): {
    agentId: string;
    type: string;
    status: string;
    isRunning: boolean;
    currentTask: string | null;
    sessionId: string;
    mcpConnected: boolean;
  } {
    return {
      agentId: this.config.id,
      type: this.config.type,
      status: this.status,
      isRunning: this.isRunning,
      currentTask: this.currentMCPTask?.id || null,
      sessionId: this.config.sessionId,
      mcpConnected: this.isRunning && this.status !== 'offline'
    };
  }

  /**
   * Get underlying agent
   */
  getAgent(): ClaudeCodeAgent {
    return this.agent;
  }

  /**
   * Structured logging
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [MCP-${this.config.type}:${this.config.id}]`;
    
    const logMessage = data ? `${message} ${JSON.stringify(data)}` : message;
    
    switch (level) {
      case 'debug':
        console.debug(`${prefix} ${logMessage}`);
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
