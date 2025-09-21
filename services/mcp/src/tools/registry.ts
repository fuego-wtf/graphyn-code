import { z } from 'zod';
import { TaskCoordinator, Task, Agent } from '../coordination/task-coordinator.js';
import { TransparencyLogger } from '../monitoring/transparency-logger.js';
import { SQLiteManager } from '../database/sqlite-manager.js';

export interface ToolDefinition {
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: unknown) => Promise<unknown>;
}

export interface ToolContext {
  taskCoordinator: TaskCoordinator;
  transparencyLogger?: TransparencyLogger;
  dbManager: SQLiteManager;
}

const enqueueTaskSchema = z.object({
  taskId: z.string().min(1),
  description: z.string().min(1),
  agentType: z.string().min(1),
  dependencies: z.array(z.string()).optional().default([]),
  priority: z.number().int().min(1).max(10).optional().default(3),
  metadata: z.record(z.string(), z.any()).optional().default({}),
  workspacePath: z.string().optional(),
  timeoutSeconds: z.number().int().positive().optional(),
  maxRetries: z.number().int().nonnegative().optional(),
});

const getNextTaskSchema = z.object({
  agentId: z.string().min(1),
  agentType: z.string().min(1),
  capabilities: z.array(z.string()).optional().default([]),
});

const completeTaskSchema = z.object({
  taskId: z.string().min(1),
  agentId: z.string().min(1),
  result: z.record(z.string(), z.any()).optional().default({}),
  metrics: z.object({
    duration: z.number().optional(),
    tokensUsed: z.number().optional(),
    toolsUsed: z.array(z.string()).optional(),
    memoryUsage: z.number().optional(),
    cpuUsage: z.number().optional(),
  }).optional().default({}),
});

const getTaskStatusSchema = z.object({
  taskIds: z.array(z.string()).optional(),
  sessionId: z.string().optional(),
});

const transparencyLogSchema = z.object({
  sessionId: z.string().optional(),
  agentId: z.string().optional(),
  eventType: z.string().optional(),
  since: z.string().optional(),
  until: z.string().optional(),
  success: z.boolean().optional(),
  limit: z.number().int().positive().optional(),
});

const registerAgentSchema = z.object({
  agentId: z.string().min(1),
  agentType: z.string().min(1),
  sessionId: z.string().min(1),
  capabilities: z.array(z.string()).optional().default([]),
  metadata: z.record(z.string(), z.any()).optional().default({}),
});

const updateAgentStatusSchema = z.object({
  agentId: z.string().min(1),
  status: z.enum(['idle', 'busy', 'error', 'offline']),
  currentTask: z.string().optional(),
  metrics: z.object({
    cpu: z.number().optional(),
    memory: z.number().optional(),
    tasksCompleted: z.number().optional(),
    averageTaskTime: z.number().optional(),
  }).optional(),
});

const agentMetricsSchema = z.object({
  sessionId: z.string().optional(),
});

const healthCheckSchema = z.object({});

function formatTask(task: Task) {
  return {
    id: task.id,
    description: task.description,
    agentType: task.agentType,
    dependencies: task.dependencies,
    priority: task.priority,
    status: task.status,
    metadata: task.metadata,
    assignedAgent: task.assignedAgent,
    result: task.result,
    metrics: task.metrics,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    assignedAt: task.assignedAt?.toISOString(),
    completedAt: task.completedAt?.toISOString(),
  };
}

function formatAgent(agent: Agent) {
  return {
    id: agent.id,
    type: agent.type,
    capabilities: agent.capabilities,
    sessionId: agent.sessionId,
    metadata: agent.metadata,
    status: agent.status,
    currentTask: agent.currentTask,
    metrics: agent.metrics,
    registeredAt: agent.registeredAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  };
}

export function createToolRegistry(context: ToolContext): Record<string, ToolDefinition> {
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
            description: 'Task dependencies'
          },
          priority: { type: 'integer', minimum: 1, maximum: 10, description: 'Task priority' },
          metadata: { type: 'object', description: 'Additional metadata' },
        },
        required: ['taskId', 'description', 'agentType']
      },
      handler: async (args) => {
        const input = enqueueTaskSchema.parse(args);
        const now = new Date();

        await context.taskCoordinator.enqueueTask({
          id: input.taskId,
          description: input.description,
          agentType: input.agentType,
          dependencies: input.dependencies,
          priority: input.priority,
          status: 'pending',
          metadata: input.metadata,
          createdAt: now,
          updatedAt: now,
        });

        return {
          success: true,
          taskId: input.taskId,
          message: 'Task enqueued successfully'
        };
      }
    },

    get_next_task: {
      description: 'Get the next available task for an agent',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string', description: 'Agent identifier' },
          agentType: { type: 'string', description: 'Agent specialization' },
          capabilities: {
            type: 'array',
            items: { type: 'string' },
            description: 'Agent capabilities'
          }
        },
        required: ['agentId', 'agentType']
      },
      handler: async (args) => {
        const input = getNextTaskSchema.parse(args);
        const task = await context.taskCoordinator.getNextTask(input.agentType, input.capabilities);

        if (!task) {
          const status = await context.taskCoordinator.getStatus();
          return {
            success: true,
            task: null,
            message: 'No available tasks',
            queueStatus: status.tasks
          };
        }

        await context.taskCoordinator.assignTask(task.id, input.agentId);

        return {
          success: true,
          task: formatTask(task),
          message: `Task ${task.id} assigned to agent ${input.agentId}`
        };
      }
    },

    complete_task: {
      description: 'Mark a task as completed',
      inputSchema: {
        type: 'object',
        properties: {
          taskId: { type: 'string' },
          agentId: { type: 'string' },
          result: { type: 'object' },
          metrics: { type: 'object' }
        },
        required: ['taskId', 'agentId']
      },
      handler: async (args) => {
        const input = completeTaskSchema.parse(args);
        await context.taskCoordinator.completeTask(input.taskId, {
          agentId: input.agentId,
          result: input.result,
          metrics: input.metrics,
          completedAt: new Date(),
        });

        return {
          success: true,
          taskId: input.taskId,
          agentId: input.agentId,
          message: 'Task completed successfully'
        };
      }
    },

    get_task_status: {
      description: 'Get the current status of tasks',
      inputSchema: {
        type: 'object',
        properties: {
          taskIds: { type: 'array', items: { type: 'string' } },
          sessionId: { type: 'string' }
        }
      },
      handler: async (args) => {
        const input = getTaskStatusSchema.parse(args);
        const tasks = await context.taskCoordinator.getTaskStatuses(input.taskIds, input.sessionId);
        return {
          success: true,
          count: tasks.length,
          tasks: tasks.map(formatTask)
        };
      }
    },

    get_transparency_log: {
      description: 'Retrieve transparency events',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          agentId: { type: 'string' },
          eventType: { type: 'string' },
          since: { type: 'string' },
          until: { type: 'string' },
          success: { type: 'boolean' },
          limit: { type: 'integer', minimum: 1 }
        }
      },
      handler: async (args) => {
        if (!context.transparencyLogger) {
          return { success: false, message: 'Transparency logging is disabled' };
        }
        const input = transparencyLogSchema.parse(args);
        const events = await context.transparencyLogger.getEvents({
          sessionId: input.sessionId,
          agentId: input.agentId,
          eventType: input.eventType,
          since: input.since ? new Date(input.since) : undefined,
          until: input.until ? new Date(input.until) : undefined,
          success: input.success,
          limit: input.limit,
        });
        return {
          success: true,
          count: events.length,
          events
        };
      }
    },

    register_agent: {
      description: 'Register an agent with the coordination system',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          agentType: { type: 'string' },
          sessionId: { type: 'string' },
          capabilities: { type: 'array', items: { type: 'string' } },
          metadata: { type: 'object' }
        },
        required: ['agentId', 'agentType', 'sessionId']
      },
      handler: async (args) => {
        const input = registerAgentSchema.parse(args);
        const now = new Date();
        await context.taskCoordinator.registerAgent({
          id: input.agentId,
          type: input.agentType,
          capabilities: input.capabilities,
          sessionId: input.sessionId,
          metadata: input.metadata,
          status: 'idle',
          currentTask: undefined,
          metrics: {},
          registeredAt: now,
          updatedAt: now,
        });
        return { success: true, agentId: input.agentId, message: 'Agent registered' };
      }
    },

    update_agent_status: {
      description: 'Update agent status and metrics',
      inputSchema: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          status: { type: 'string', enum: ['idle', 'busy', 'error', 'offline'] },
          currentTask: { type: 'string' },
          metrics: { type: 'object' }
        },
        required: ['agentId', 'status']
      },
      handler: async (args) => {
        const input = updateAgentStatusSchema.parse(args);
        await context.taskCoordinator.updateAgentStatus(input.agentId, {
          status: input.status,
          currentTask: input.currentTask,
          metrics: input.metrics,
          updatedAt: new Date(),
        });
        return { success: true, agentId: input.agentId, message: 'Agent status updated' };
      }
    },

    get_agent_metrics: {
      description: 'Get aggregate agent metrics',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' }
        }
      },
      handler: async (args) => {
        agentMetricsSchema.parse(args);
        const status = await context.taskCoordinator.getStatus();
        return {
          success: true,
          metrics: status.agents
        };
      }
    },

    health_check: {
      description: 'Get MCP server health information',
      inputSchema: {
        type: 'object',
        properties: {}
      },
      handler: async (args) => {
        healthCheckSchema.parse(args ?? {});
        const [dbStatus, coordinatorStatus] = await Promise.all([
          context.dbManager.getStatus(),
          context.taskCoordinator.getStatus()
        ]);
        return {
          success: true,
          database: dbStatus,
          coordinator: coordinatorStatus,
        };
      }
    }
  } satisfies Record<string, ToolDefinition>;
}
