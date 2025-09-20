#!/usr/bin/env node

/**
 * Graphyn MCP Server - Model Context Protocol Server Adapter
 * Migrated from src/mcp-server/index.ts
 * Provides MCP tools for task coordination and orchestration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { EventEmitter } from 'events';

// Import from migrated database components
import { createDatabase } from '@graphyn/db';
// Logger temporarily removed - obs package doesn't exist
// import { Logger, getLogger } from '@graphyn/obs';
const getLogger = (name: string) => ({ info: console.log, error: console.error, debug: console.log, warn: console.warn });

// Import MCP tools
import { ENQUEUE_TASK_TOOL, enqueueMCPTask } from './tools/enqueue_task.js';
import { GET_NEXT_TASK_TOOL, getNextMCPTask } from './tools/get_next_task.js';
import { COMPLETE_TASK_TOOL, completeMCPTask } from './tools/complete_task.js';
import { GET_TASK_STATUS_TOOL, getTaskStatusMCP } from './tools/get_task_status.js';
import { HEALTH_CHECK_TOOL, healthCheckMCP } from './tools/health_check.js';
import { GET_TRANSPARENCY_LOG_TOOL, getTransparencyLogMCP } from './tools/get_transparency_log.js';

/**
 * Configuration for the MCP server
 */
interface ServerConfig {
  name: string;
  version: string;
  databasePath?: string;
  useMockDatabase?: boolean;
}

/**
 * MCP Task Coordination Server Class
 */
class TaskCoordinationServer extends EventEmitter {
  private server: Server;
  private dbManager: any; // Will use proper type from @graphyn/db
  private config: ServerConfig;
  private logger: any;

  constructor(config: ServerConfig) {
    super();
    this.config = config;
    this.logger = { ...getLogger('mcp-server'), child: () => getLogger('mcp-server') };
    
    this.server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize database manager
    this.dbManager = createDatabase({
      type: config.useMockDatabase ? 'mock' : 'sqlite',
      path: config.databasePath
    });
    
    if (config.useMockDatabase) {
      this.logger.info('Using mock database for testing/development');
    } else {
      this.logger.info('Using SQLite database for production');
    }
  }

  /**
   * Initialize the MCP server and register tools
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Database initialized successfully');

      // Register MCP tools
      this.registerTools();
      this.logger.info('MCP tools registered');

      // Set up error handling
      this.setupErrorHandling();
      this.logger.info('Server initialized and ready');

    } catch (error) {
        this.logger.error('Failed to initialize server', { 
          error: error instanceof Error ? error.message : String(error) 
        });
        throw error;
    }
  }

  /**
   * Register all MCP tools with the server
   */
  private registerTools(): void {
    // Register list tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        ENQUEUE_TASK_TOOL,
        GET_NEXT_TASK_TOOL,
        COMPLETE_TASK_TOOL,
        GET_TASK_STATUS_TOOL,
        HEALTH_CHECK_TOOL,
        GET_TRANSPARENCY_LOG_TOOL,
      ],
    }));

    // Register call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'enqueue_task':
            return await enqueueMCPTask(args || {}, this.dbManager);

          case 'get_next_task':
            return await getNextMCPTask(args || {}, this.dbManager);

          case 'complete_task':
            return await completeMCPTask(args || {}, this.dbManager);

          case 'get_task_status':
            return await getTaskStatusMCP(args || {}, this.dbManager);

          case 'health_check':
            return await healthCheckMCP(args || {}, this.dbManager);

          case 'get_transparency_log':
            return await getTransparencyLogMCP(args || {}, this.dbManager);

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        // Handle Zod validation errors
        if (error instanceof z.ZodError) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Validation error: ${error.issues.map((e: any) => e.message).join(', ')}`
          );
        }

        // Re-throw MCP errors as-is
        if (error instanceof McpError) {
          throw error;
        }

        // Handle other errors
        this.logger.error(`Tool execution error for ${name}`, { 
          error: error instanceof Error ? error.message : String(error) 
        });
        throw new McpError(
          ErrorCode.InternalError,
          error instanceof Error ? error.message : 'Unknown error occurred'
        );
      }
    });
  }

  /**
   * Set up global error handling
   */
  private setupErrorHandling(): void {
    process.on('SIGINT', async () => {
      this.logger.info('Received SIGINT, shutting down gracefully...');
      await this.shutdown();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      this.logger.info('Received SIGTERM, shutting down gracefully...');
      await this.shutdown();
      process.exit(0);
    });

    process.on('uncaughtException', async (error) => {
      this.logger.error('Uncaught exception', { error });
      await this.shutdown();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      this.logger.error('Unhandled promise rejection', { 
        metadata: { reason: String(reason), promise: String(promise) } 
      });
      await this.shutdown();
      process.exit(1);
    });
  }

  /**
   * Start the MCP server with stdio transport
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    this.logger.info('MCP Task Coordination Server is running');
  }

  /**
   * Gracefully shutdown the server and cleanup resources
   */
  async shutdown(): Promise<void> {
    try {
      this.logger.info('Cleaning up resources...');
      
      if (this.dbManager && this.dbManager.close) {
        this.dbManager.close();
        this.logger.info('Database connection closed');
      }
      
      this.logger.info('Graceful shutdown complete');
    } catch (error) {
      this.logger.error('Error during shutdown', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
}

/**
 * Parse command line arguments and environment variables
 */
function parseConfig(): ServerConfig {
  const config: ServerConfig = {
    name: 'graphyn-mcp-server',
    version: '0.1.70',
    databasePath: process.env.DATABASE_PATH || './data/graphyn.db',
    useMockDatabase: process.env.USE_MOCK_DB === 'true' || process.argv.includes('--mock'),
  };

  // Check for help flag
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Graphyn Task Coordination MCP Server

Usage: ${process.argv[1]} [options]

Options:
  --mock                Use mock database (for testing/development)
  --help, -h           Show this help message

Environment Variables:
  DATABASE_PATH        Path to SQLite database file (default: ./data/graphyn.db)
  USE_MOCK_DB         Set to 'true' to use mock database

Examples:
  # Production mode with SQLite
  ${process.argv[1]}

  # Development mode with mock database
  ${process.argv[1]} --mock

  # Custom database path
  DATABASE_PATH=/path/to/graphyn.db ${process.argv[1]}
`);
    process.exit(0);
  }

  return config;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const config = parseConfig();
    
    const logger = getLogger('mcp-main');
    logger.info('Task Coordination MCP Server Starting...', {
      metadata: {
        version: config.version,
        database: config.useMockDatabase ? 'Mock (In-Memory)' : config.databasePath
      }
    });

    const server = new TaskCoordinationServer(config);
    
    await server.initialize();
    await server.start();
    
  } catch (error) {
    console.error('💥 Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

export { TaskCoordinationServer, type ServerConfig };
