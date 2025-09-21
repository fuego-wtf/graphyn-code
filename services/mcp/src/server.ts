/**
 * MCP Server - Local MCP server for task coordination
 * 
 * Implements the Model Context Protocol server with SQLite WAL2 database
 * for coordinating multi-agent orchestration as specified in DELIVERY.md
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { SQLiteManager } from './database/sqlite-manager.js';
import { TaskCoordinator } from './coordination/task-coordinator.js';
import { TransparencyLogger } from './monitoring/transparency-logger.js';
import { createToolRegistry, ToolContext, ToolDefinition } from './tools/registry.js';

export interface MCPServerConfig {
  databasePath: string;
  enableWAL2: boolean;
  maxConnections: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  transparencyEnabled: boolean;
}

export class MCPServer {
  private readonly server: Server;
  private dbManager!: SQLiteManager;
  private taskCoordinator!: TaskCoordinator;
  private transparencyLogger?: TransparencyLogger;
  private readonly config: MCPServerConfig;
  private initializationPromise?: Promise<void>;
  private toolDefinitions: Record<string, ToolDefinition> | null = null;

  constructor(config: Partial<MCPServerConfig> = {}) {
    this.config = {
      databasePath: config.databasePath || './data/graphyn-tasks.db',
      enableWAL2: config.enableWAL2 ?? true,
      maxConnections: config.maxConnections || 10,
      logLevel: config.logLevel || 'info',
      transparencyEnabled: config.transparencyEnabled ?? true
    };

    this.server = new Server(
      {
        name: 'graphyn-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
  }

  private async listTools(): Promise<Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>> {
    await this.ensureInitialized();
    if (!this.toolDefinitions) {
      throw new Error('Tool registry not initialized');
    }

    return Object.entries(this.toolDefinitions).map(([name, definition]) => ({
      name,
      description: definition.description,
      inputSchema: definition.inputSchema
    }));
  }

  private async getToolDefinition(name: string): Promise<ToolDefinition | undefined> {
    await this.ensureInitialized();
    return this.toolDefinitions ? this.toolDefinitions[name] : undefined;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.initializeComponents().catch((error) => {
      this.initializationPromise = undefined;
      throw error;
    });

    return this.initializationPromise;
  }

  private async initializeComponents(): Promise<void> {
    // Initialize SQLite database manager
    this.dbManager = new SQLiteManager({
      path: this.config.databasePath,
      enableWAL2: this.config.enableWAL2,
      maxConnections: this.config.maxConnections
    });

    await this.dbManager.initialize();

    // Initialize task coordinator
    this.taskCoordinator = new TaskCoordinator(this.dbManager);
    await this.taskCoordinator.loadFromDatabase();

    // Initialize transparency logger
    if (this.config.transparencyEnabled) {
      this.transparencyLogger = new TransparencyLogger(this.dbManager);
    }

    const toolContext: ToolContext = {
      taskCoordinator: this.taskCoordinator,
      transparencyLogger: this.transparencyLogger,
      dbManager: this.dbManager,
    };

    this.toolDefinitions = createToolRegistry(toolContext);

    this.log('info', 'MCP Server components initialized');
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: await this.listTools()
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const startTime = Date.now();

      try {
        const tool = await this.getToolDefinition(name);
        if (!tool) {
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }

        const result = await tool.handler(args);

        const duration = Date.now() - startTime;
        
        // Log transparency event
        if (this.transparencyLogger) {
          await this.transparencyLogger.logEvent({
            type: 'mcp_tool_call',
            toolName: name,
            duration,
            success: true,
            timestamp: new Date()
          });
        }

        this.log('debug', `Tool ${name} executed in ${duration}ms`);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };

      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Log error event
        if (this.transparencyLogger) {
          await this.transparencyLogger.logEvent({
            type: 'mcp_tool_error',
            toolName: name,
            duration,
            success: false,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date()
          });
        }

        this.log('error', `Tool ${name} failed: ${error}`);
        
        if (error instanceof McpError) {
          throw error;
        }
        
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  // Tool handler implementations
  private buildToolRegistry(): Record<string, ToolDefinition> {
    return {
      enqueue_task: {
        description: 'Add a new task to the coordination queue',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Unique task identifier' },
            description: { type: 'string', description: 'Task description' },
            agentType: { type: 'string', description: 'Required agent type' },
            dependencies: {
              type: 'array',
              items: { type: 'string' },
              description: 'List of task IDs this task depends on'
            },
            priority: { type: 'number', description: 'Task priority (1-5)' },
            metadata: { type: 'object', description: 'Additional task metadata' }
          },
          required: ['taskId', 'description', 'agentType']
        },
        handler: (args: any) => this.handleEnqueueTask(args)
      },
      get_next_task: {
        description: 'Get the next available task for an agent',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent identifier' },
            agentType: { type: 'string', description: 'Agent type capabilities' },
            capabilities: {
              type: 'array',
              items: { type: 'string' },
              description: 'Agent capabilities'
            }
          },
          required: ['agentId', 'agentType']
        },
        handler: (args: any) => this.handleGetNextTask(args)
      },
      complete_task: {
        description: 'Mark a task as completed',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Task identifier' },
            agentId: { type: 'string', description: 'Agent that completed the task' },
            result: { type: 'object', description: 'Task execution result' },
            metrics: {
              type: 'object',
              properties: {
                duration: { type: 'number', description: 'Execution time in ms' },
                tokensUsed: { type: 'number', description: 'Tokens consumed' },
                toolsUsed: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Tools used during execution'
                }
              }
            }
          },
          required: ['taskId', 'agentId']
        },
        handler: (args: any) => this.handleCompleteTask(args)
      },
      get_task_status: {
        description: 'Get current status of one or more tasks',
        inputSchema: {
          type: 'object',
          properties: {
            taskIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Task IDs to check status for'
            },
            sessionId: { type: 'string', description: 'Filter by session ID' }
          }
        },
        handler: (args: any) => this.handleGetTaskStatus(args)
      },
      get_transparency_log: {
        description: 'Retrieve transparency events for monitoring',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', description: 'Session to get logs for' },
            agentId: { type: 'string', description: 'Filter by specific agent' },
            eventType: { type: 'string', description: 'Filter by event type' },
            since: { type: 'string', description: 'ISO timestamp to get events since' },
            limit: { type: 'number', description: 'Maximum number of events' }
          }
        },
        handler: (args: any) => this.handleGetTransparencyLog(args)
      },
      register_agent: {
        description: 'Register an agent with the coordination system',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Unique agent identifier' },
            agentType: { type: 'string', description: 'Agent specialization type' },
            capabilities: {
              type: 'array',
              items: { type: 'string' },
              description: 'Agent capabilities'
            },
            sessionId: { type: 'string', description: 'Session the agent belongs to' },
            metadata: { type: 'object', description: 'Additional agent metadata' }
          },
          required: ['agentId', 'agentType', 'sessionId']
        },
        handler: (args: any) => this.handleRegisterAgent(args)
      },
      update_agent_status: {
        description: 'Update agent status and metrics',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent identifier' },
            status: {
              type: 'string',
              enum: ['idle', 'busy', 'error', 'offline'],
              description: 'Agent status'
            },
            currentTask: { type: 'string', description: 'Currently executing task ID' },
            metrics: {
              type: 'object',
              properties: {
                cpu: { type: 'number', description: 'CPU usage percentage' },
                memory: { type: 'number', description: 'Memory usage in MB' },
                tasksCompleted: { type: 'number', description: 'Total completed tasks' }
              }
            }
          },
          required: ['agentId', 'status']
        },
        handler: (args: any) => this.handleUpdateAgentStatus(args)
      }
    } satisfies Record<string, ToolDefinition>;
  }

  private async handleEnqueueTask(args: any) {
    await this.ensureInitialized();
    const { taskId, description, agentType, dependencies = [], priority = 3, metadata = {} } = args;
    
    await this.taskCoordinator.enqueueTask({
      id: taskId,
      description,
      agentType,
      dependencies,
      priority,
      metadata,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return {
      success: true,
      taskId,
      message: 'Task enqueued successfully'
    };
  }

  private async handleGetNextTask(args: any) {
    await this.ensureInitialized();
    const { agentId, agentType, capabilities = [] } = args;
    
    const task = await this.taskCoordinator.getNextTask(agentType, capabilities);
    
    if (!task) {
      return {
        success: true,
        task: null,
        message: 'No available tasks matching agent capabilities'
      };
    }

    // Assign task to agent
    await this.taskCoordinator.assignTask(task.id, agentId);

    return {
      success: true,
      task,
      message: `Task ${task.id} assigned to agent ${agentId}`
    };
  }

  private async handleCompleteTask(args: any) {
    await this.ensureInitialized();
    const { taskId, agentId, result = {}, metrics = {} } = args;
    
    await this.taskCoordinator.completeTask(taskId, {
      agentId,
      result,
      metrics,
      completedAt: new Date()
    });

    return {
      success: true,
      taskId,
      agentId,
      message: 'Task completed successfully'
    };
  }

  private async handleGetTaskStatus(args: any) {
    await this.ensureInitialized();
    const { taskIds, sessionId } = args;
    
    const statuses = await this.taskCoordinator.getTaskStatuses(taskIds, sessionId);
    
    return {
      success: true,
      statuses,
      count: statuses.length
    };
  }

  private async handleGetTransparencyLog(args: any) {
    await this.ensureInitialized();
    if (!this.transparencyLogger) {
      return {
        success: false,
        message: 'Transparency logging is disabled'
      };
    }

    const { sessionId, agentId, eventType, since, limit = 100 } = args;
    
    const events = await this.transparencyLogger.getEvents({
      sessionId,
      agentId,
      eventType,
      since: since ? new Date(since) : undefined,
      limit
    });

    return {
      success: true,
      events,
      count: events.length
    };
  }

  private async handleRegisterAgent(args: any) {
    await this.ensureInitialized();
    const { agentId, agentType, capabilities = [], sessionId, metadata = {} } = args;
    
    await this.taskCoordinator.registerAgent({
      id: agentId,
      type: agentType,
      capabilities,
      sessionId,
      metadata,
      status: 'idle',
      registeredAt: new Date(),
      updatedAt: new Date()
    });

    return {
      success: true,
      agentId,
      message: 'Agent registered successfully'
    };
  }

  private async handleUpdateAgentStatus(args: any) {
    await this.ensureInitialized();
    const { agentId, status, currentTask, metrics = {} } = args;
    
    await this.taskCoordinator.updateAgentStatus(agentId, {
      status,
      currentTask,
      metrics,
      updatedAt: new Date()
    });

    return {
      success: true,
      agentId,
      status,
      message: 'Agent status updated successfully'
    };
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    await this.ensureInitialized();
    const transport = new StdioServerTransport();
    
    await this.server.connect(transport);
    
    this.log('info', `MCP Server started with database: ${this.config.databasePath}`);
    this.log('info', `WAL2 mode: ${this.config.enableWAL2 ? 'enabled' : 'disabled'}`);
    this.log('info', `Transparency logging: ${this.config.transparencyEnabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Stop the MCP server gracefully
   */
  async stop(): Promise<void> {
    await this.ensureInitialized();
    this.log('info', 'Shutting down MCP server...');
    
    if (this.taskCoordinator) {
      await this.taskCoordinator.cleanup();
    }
    
    if (this.dbManager) {
      await this.dbManager.cleanup();
    }
    
    await this.server.close();
    
    this.log('info', 'MCP server stopped');
  }

  /**
   * Get server status and metrics
   */
  async getStatus(): Promise<any> {
    await this.ensureInitialized();
    const dbStatus = await this.dbManager.getStatus();
    const coordinatorStatus = await this.taskCoordinator.getStatus();
    
    return {
      server: {
        name: 'graphyn-mcp-server',
        version: '1.0.0',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        config: {
          databasePath: this.config.databasePath,
          enableWAL2: this.config.enableWAL2,
          transparencyEnabled: this.config.transparencyEnabled
        }
      },
      database: dbStatus,
      coordinator: coordinatorStatus
    };
  }

  private log(level: string, message: string): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
  }
}

// CLI entry point when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const config: Partial<MCPServerConfig> = {};

  // Look for --database-path argument
  const dbPathIndex = args.indexOf('--database-path');
  if (dbPathIndex !== -1 && args[dbPathIndex + 1]) {
    config.databasePath = args[dbPathIndex + 1];
  }

  // Look for --log-level argument
  const logLevelIndex = args.indexOf('--log-level');
  if (logLevelIndex !== -1 && args[logLevelIndex + 1]) {
    config.logLevel = args[logLevelIndex + 1] as 'debug' | 'info' | 'warn' | 'error';
  }

  const server = new MCPServer(config);
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.error('\n🛑 Received SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('\n🛑 Received SIGTERM, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  // Start server
  server.start().catch((error) => {
    console.error('❌ Failed to start MCP server:', error);
    process.exit(1);
  });
}
