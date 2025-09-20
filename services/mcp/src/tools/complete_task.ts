/**
 * MCP Tool: complete_task
 * Migrated from src/mcp-server/tools/complete_task.ts
 */

import { z } from 'zod';

const CompleteTaskSchema = z.object({
  task_id: z.string().min(1, 'Task ID is required'),
  success: z.boolean(),
  result: z.any().optional(),
  error_message: z.string().optional()
});

export async function completeMCPTask(
  input: any,
  dbManager: any
): Promise<{ content: Array<{ type: string, text: string }> }> {
  try {
    const validatedInput = CompleteTaskSchema.parse(input);
    
    await dbManager.completeTask(validatedInput.task_id, {
      success: validatedInput.success,
      result: validatedInput.result,
      error: validatedInput.error_message
    });
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Task ${validatedInput.task_id} marked as ${validatedInput.success ? 'completed' : 'failed'}`,
            task_id: validatedInput.task_id,
            status: validatedInput.success ? 'completed' : 'failed'
          })
        }
      ]
    };
    
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            message: 'Failed to complete task',
            error: error instanceof Error ? error.message : String(error)
          })
        }
      ]
    };
  }
}

export const COMPLETE_TASK_TOOL = {
  name: 'complete_task',
  description: 'Mark a task as completed or failed',
  inputSchema: {
    type: 'object',
    properties: {
      task_id: {
        type: 'string',
        description: 'Task identifier'
      },
      success: {
        type: 'boolean',
        description: 'Task success status'
      },
      result: {
        type: 'object',
        description: 'Task execution result'
      },
      error_message: {
        type: 'string',
        description: 'Error message if failed'
      }
    },
    required: ['task_id', 'success']
  }
} as const;