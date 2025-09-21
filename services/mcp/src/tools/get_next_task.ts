/**
 * MCP Tool: get_next_task
 * Migrated from src/mcp-server/tools/get_next_task.ts
 */

import { z } from 'zod';

const GetNextTaskSchema = z.object({
  agent_type: z.string().optional(),
  min_priority: z.number().min(1).max(10).optional(),
  max_priority: z.number().min(1).max(10).optional()
});

export async function getNextMCPTask(
  input: any,
  dbManager: any
): Promise<{ content: Array<{ type: string, text: string }> }> {
  try {
    const validatedInput = GetNextTaskSchema.parse(input);
    
    // Get task with optional filters
    const task = await dbManager.getNextReadyTaskWithFilters(
      validatedInput.agent_type,
      validatedInput.min_priority,
      validatedInput.max_priority
    );
    
    if (task) {
      // Mark the task as running
      const marked = await dbManager.markTaskRunning(task.id);
      if (!marked) {
        // Task might have been taken by another agent concurrently
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                task: undefined,
                message: 'No tasks available (concurrent access)',
                queue_status: await getQueueStatus(dbManager)
              })
            }
          ]
        };
      }
      
      console.log(`📥 Mock: Getting task ${task.id} for ${validatedInput.agent_type || 'any'} agent`);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              task: task,
              message: `Task ${task.id} assigned and marked as running`,
              queue_status: await getQueueStatus(dbManager)
            })
          }
        ]
      };
    } else {
      const systemStatus = await dbManager.getSystemStatus();
      const hasPendingTasks = systemStatus.pendingTasks > 0;
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              task: undefined,
              message: hasPendingTasks 
                ? 'No tasks available - pending tasks are waiting for dependencies'
                : 'No tasks available',
              queue_status: await getQueueStatus(dbManager)
            })
          }
        ]
      };
    }
    
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            task: undefined,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      ]
    };
  }
}

async function getQueueStatus(dbManager: any) {
  const systemStatus = await dbManager.getSystemStatus();
  return {
    total_tasks: systemStatus.totalTasks,
    pending_tasks: systemStatus.pendingTasks,
    ready_tasks: systemStatus.readyTasks,
    running_tasks: systemStatus.runningTasks.length
  };
}

export const GET_NEXT_TASK_TOOL = {
  name: 'get_next_task',
  description: 'Get the next ready task for execution',
  inputSchema: {
    type: 'object',
    properties: {
      agent_type: {
        type: 'string',
        description: 'Agent type filter'
      },
      min_priority: {
        type: 'number',
        minimum: 1,
        maximum: 10,
        description: 'Minimum priority filter'
      },
      max_priority: {
        type: 'number', 
        minimum: 1,
        maximum: 10,
        description: 'Maximum priority filter'
      }
    },
    required: []
  }
} as const;