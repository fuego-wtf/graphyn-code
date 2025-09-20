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
    
    const task = await dbManager.getNextTask(validatedInput.agent_type);
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            task: task || null,
            message: task ? `Task ${task.id} ready for execution` : 'No tasks available'
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
            task: null,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      ]
    };
  }
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