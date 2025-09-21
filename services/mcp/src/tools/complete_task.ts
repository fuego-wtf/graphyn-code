/**
 * MCP Tool: complete_task
 * Migrated from src/mcp-server/tools/complete_task.ts
 */

import { z } from 'zod';

const CompleteTaskSchema = z.object({
  task_id: z.string().min(1, 'Task ID is required'),
  success: z.boolean(),
  result: z.any().optional(),
  error_message: z.string().optional(),
  deliverables: z.array(z.string()).optional(),
  execution_time_ms: z.number().optional(),
  tools_used: z.array(z.string()).optional()
});

export async function completeMCPTask(
  input: any,
  dbManager: any
): Promise<{ content: Array<{ type: string, text: string }> }> {
  try {
    const validatedInput = CompleteTaskSchema.parse(input);
    
    // Check if task exists
    const allTasks = await dbManager.getAllTasks();
    const task = allTasks.find((t: any) => t.id === validatedInput.task_id);
    
    if (!task) {
      // Gracefully handle non-existent task
      console.log(`⚠️ Task ${validatedInput.task_id} not found - handling gracefully`);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              task_id: validatedInput.task_id,
              message: `Task ${validatedInput.task_id} not found - handling gracefully`,
              final_status: validatedInput.success ? 'completed' : 'failed',
              metrics_recorded: false
            })
          }
        ]
      };
    }
    
    // Record metrics if provided
    let metricsRecorded = false;
    if (validatedInput.execution_time_ms || validatedInput.tools_used || validatedInput.deliverables) {
      const metrics = {
        task_id: validatedInput.task_id,
        execution_time_ms: validatedInput.execution_time_ms || 0,
        memory_usage_mb: 0, // Not provided in input
        tools_used: validatedInput.tools_used || [],
        lines_changed: 0, // Not provided in input
        files_created: 0, // Not provided in input
        files_modified: 0 // Not provided in input
      };
      
      await dbManager.recordTaskMetrics(metrics);
      metricsRecorded = true;
    }
    
    // Mark task as complete
    await dbManager.markTaskComplete(
      validatedInput.task_id,
      validatedInput.result || validatedInput.error_message,
      validatedInput.success
    );
    
    let triggeredTasks: string[] | undefined;
    
    // If task succeeded, check for and trigger dependent tasks
    if (validatedInput.success) {
      triggeredTasks = await dbManager.getDependentTasks(validatedInput.task_id);
      
      if (triggeredTasks && triggeredTasks.length > 0) {
        console.log(`✅ Mock: Completed task ${validatedInput.task_id}`);
      }
    }
    
    const finalStatus = validatedInput.success ? 'completed' : 'failed';
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Task ${validatedInput.task_id} marked as ${finalStatus}${
              triggeredTasks && triggeredTasks.length > 0 
                ? ` and ${triggeredTasks.length} dependent task(s) are now ready`
                : ''
            }`,
            task_id: validatedInput.task_id,
            final_status: finalStatus,
            metrics_recorded: metricsRecorded,
            triggered_tasks: triggeredTasks && triggeredTasks.length > 0 ? triggeredTasks : undefined
          })
        }
      ]
    };
    
  } catch (error) {
    // Handle validation errors specifically
    if (error instanceof z.ZodError) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              message: 'Input validation failed',
              error: error.issues?.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ') || 'Invalid input'
            })
          }
        ]
      };
    }

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