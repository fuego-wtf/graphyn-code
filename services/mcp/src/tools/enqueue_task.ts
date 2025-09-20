/**
 * MCP Tool: enqueue_task
 * Migrated from src/mcp-server/tools/enqueue_task.ts
 */

import { z } from 'zod';

// Zod schema for input validation
const EnqueueTaskSchema = z.object({
  task_id: z.string().min(1, 'Task ID is required'),
  description: z.string().min(1, 'Description is required'),
  agent_type: z.enum(['general', 'backend', 'frontend', 'security', 'testing', 'devops', 'typescript', 'figma', 'bash']),
  dependencies: z.array(z.string()).optional().default([]),
  priority: z.number().min(1).max(10).optional().default(1),
  workspace_path: z.string().optional(),
  timeout_seconds: z.number().positive().optional().default(300),
  max_retries: z.number().nonnegative().optional().default(3)
});

export type EnqueueTaskInput = z.infer<typeof EnqueueTaskSchema>;

export interface EnqueueTaskResult {
  success: boolean;
  task_id: string;
  message: string;
  workspace_path?: string;
  error?: string;
}

/**
 * MCP Tool: enqueue_task
 * 
 * Adds a new task to the coordination queue with dependency management.
 * Tasks are automatically set to 'pending' status and will become 'ready'
 * when all their dependencies are completed.
 */
export async function enqueueMCPTask(
  input: any, 
  dbManager: any
): Promise<{ content: Array<{ type: string, text: string }> }> {
  try {
    // Validate input using Zod schema
    const validatedInput = EnqueueTaskSchema.parse(input);

    // Enqueue the task using the new database interface
    await dbManager.enqueueTask(validatedInput.task_id, {
      agentType: validatedInput.agent_type,
      description: validatedInput.description,
      priority: validatedInput.priority,
      dependencies: validatedInput.dependencies,
      workspace: validatedInput.workspace_path,
      config: {
        timeout_seconds: validatedInput.timeout_seconds,
        max_retries: validatedInput.max_retries
      }
    });

    const result: EnqueueTaskResult = {
      success: true,
      task_id: validatedInput.task_id,
      message: `Task ${validatedInput.task_id} enqueued successfully`,
      workspace_path: validatedInput.workspace_path
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result)
        }
      ]
    };

  } catch (error) {
    let result: EnqueueTaskResult;
    
    if (error instanceof z.ZodError) {
      result = {
        success: false,
        task_id: input?.task_id || 'unknown',
        message: 'Input validation failed',
        error: error.issues?.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ') || 'Invalid input'
      };
    } else if (error instanceof Error) {
      result = {
        success: false,
        task_id: input?.task_id || 'unknown',
        message: 'Failed to enqueue task',
        error: error.message
      };
    } else {
      result = {
        success: false,
        task_id: input?.task_id || 'unknown',
        message: 'Unknown error occurred',
        error: String(error)
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result)
        }
      ]
    };
  }
}

/**
 * MCP Tool Definition for integration with MCP server
 */
export const ENQUEUE_TASK_TOOL = {
  name: 'enqueue_task',
  description: 'Add a task to the coordination queue with dependency management',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'Unique identifier for the task'
      },
      description: {
        type: 'string',
        description: 'Detailed description of what the task should accomplish'
      },
      agent_type: {
        type: 'string',
        enum: ['general', 'backend', 'frontend', 'security', 'testing', 'devops', 'typescript', 'figma', 'bash'],
        description: 'Type of specialized agent that should handle this task'
      },
      dependencies: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of task IDs that must be completed before this task can run',
        default: []
      },
      priority: {
        type: 'integer',
        minimum: 1,
        maximum: 10,
        description: 'Task priority (1-10, higher numbers = higher priority)',
        default: 1
      },
      workspace_path: {
        type: 'string',
        description: 'Custom workspace directory path (optional)',
      },
      timeout_seconds: {
        type: 'integer',
        minimum: 1,
        description: 'Maximum execution time in seconds',
        default: 300
      },
      max_retries: {
        type: 'integer',
        minimum: 0,
        description: 'Maximum number of retry attempts on failure',
        default: 3
      }
    },
    required: ['task_id', 'description', 'agent_type']
  }
} as const;