/**
 * MCP Tool: get_task_status
 * Migrated from src/mcp-server/tools/get_task_status.ts
 */

import { z } from 'zod';

const GetTaskStatusSchema = z.object({
  include_details: z.boolean().optional().default(false),
  include_tasks: z.boolean().optional().default(false),
  agent_type: z.string().optional(),
  status: z.string().optional(),
  task_id: z.string().optional()
});

export async function getTaskStatusMCP(
  input: any,
  dbManager: any
): Promise<{ content: Array<{ type: string, text: string }> }> {
  try {
    const options = GetTaskStatusSchema.parse(input || {});
    
    // Get comprehensive system status
    const systemStatus = await dbManager.getSystemStatus();
    const allTasks = await dbManager.getAllTasks();
    const readyTasks = await dbManager.getReadyTasks();

    // Calculate current timestamp for elapsed time calculations
    const now = Math.floor(Date.now() / 1000);

    // Process running tasks with elapsed time
    const runningTasksDetailed = systemStatus.runningTasks.map((task: any) => ({
      id: task.id,
      description: task.description.substring(0, 100) + (task.description.length > 100 ? '...' : ''),
      agent_type: task.agent_type,
      priority: task.priority,
      started_at: task.started_at || now,
      elapsed_seconds: (task.started_at ? now - task.started_at : 0),
      workspace_path: task.workspace_path
    }));

    // Get next ready task (highest priority)
    const nextReadyTask = readyTasks.length > 0 ? {
      id: readyTasks[0].id,
      description: readyTasks[0].description.substring(0, 100) + (readyTasks[0].description.length > 100 ? '...' : ''),
      agent_type: readyTasks[0].agent_type,
      priority: readyTasks[0].priority
    } : undefined;

    // Calculate blocked tasks (pending but not ready)
    const blockedTasks = systemStatus.pendingTasks - systemStatus.readyTasks;

    // Group tasks by agent type and status
    const byAgentType: Record<string, any> = {};
    const agentTypes = ['backend', 'frontend', 'security', 'testing', 'devops'];
    
    for (const agentType of agentTypes) {
      const agentTasks = allTasks.filter((t: any) => t.agent_type === agentType);
      byAgentType[agentType] = {
        pending: agentTasks.filter((t: any) => t.status === 'pending').length,
        ready: readyTasks.filter((t: any) => t.agent_type === agentType).length,
        running: agentTasks.filter((t: any) => t.status === 'running').length,
        completed: agentTasks.filter((t: any) => t.status === 'completed').length,
        failed: agentTasks.filter((t: any) => t.status === 'failed').length
      };
    }

    // Apply task filters if requested
    let filteredTasks: any[] | undefined;
    if (options.include_tasks) {
      filteredTasks = [...allTasks]; // Create a copy

      if (options.task_id && filteredTasks) {
        filteredTasks = filteredTasks.filter((t: any) => t.id.includes(options.task_id!));
      }

      if (options.agent_type && filteredTasks) {
        filteredTasks = filteredTasks.filter((t: any) => t.agent_type === options.agent_type);
      }

      if (options.status && filteredTasks) {
        if (options.status === 'ready') {
          // Special case: ready tasks are pending with satisfied dependencies
          const readyTaskIds = new Set(readyTasks.map((t: any) => t.id));
          filteredTasks = filteredTasks.filter((t: any) => readyTaskIds.has(t.id));
        } else {
          filteredTasks = filteredTasks.filter((t: any) => t.status === options.status);
        }
      }
    }

    const result = {
      success: true,
      system_status: {
        total_tasks: systemStatus.totalTasks,
        pending_tasks: systemStatus.pendingTasks,
        ready_tasks: systemStatus.readyTasks,
        running_tasks: systemStatus.runningTasks.length,
        completed_tasks: systemStatus.completedTasks,
        failed_tasks: systemStatus.failedTasks
      },
      performance: {
        avg_execution_time_ms: systemStatus.performance.avgExecutionTimeMs,
        success_rate: systemStatus.performance.successRate,
        efficiency: systemStatus.performance.efficiency
      },
      running_tasks: runningTasksDetailed,
      queue_summary: {
        next_ready_task: nextReadyTask,
        blocked_tasks: blockedTasks,
        by_agent_type: byAgentType
      },
      tasks: filteredTasks,
      message: `System status retrieved: ${systemStatus.totalTasks} total tasks, ${systemStatus.runningTasks.length} running, ${systemStatus.readyTasks} ready`
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
    const errorResult = {
      success: false,
      system_status: { total_tasks: 0, pending_tasks: 0, ready_tasks: 0, running_tasks: 0, completed_tasks: 0, failed_tasks: 0 },
      performance: { avg_execution_time_ms: 0, success_rate: 0, efficiency: 0 },
      running_tasks: [],
      queue_summary: { blocked_tasks: 0, by_agent_type: {} },
      message: error instanceof z.ZodError ? 'Input validation failed' : 'Failed to get task status',
      error: error instanceof Error ? error.message : String(error)
    };
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(errorResult)
        }
      ]
    };
  }
}

export const GET_TASK_STATUS_TOOL = {
  name: 'get_task_status',
  description: 'Get comprehensive task and system status',
  inputSchema: {
    type: 'object',
    properties: {
      include_details: {
        type: 'boolean',
        description: 'Include detailed task information'
      },
      agent_type: {
        type: 'string',
        description: 'Filter by agent type'
      },
      status: {
        type: 'string',
        description: 'Filter by task status'
      },
      task_id: {
        type: 'string',
        description: 'Get specific task details'
      }
    },
    required: []
  }
} as const;