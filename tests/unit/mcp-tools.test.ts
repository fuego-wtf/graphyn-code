import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockSQLiteManager as SQLiteManager } from '../../packages/db/dist/index.js';
import { enqueueMCPTask as _enqueueMCPTask, ENQUEUE_TASK_TOOL } from '../../services/mcp/src/tools/enqueue_task';
import { getNextMCPTask as _getNextMCPTask, GET_NEXT_TASK_TOOL } from '../../services/mcp/src/tools/get_next_task';
import { completeMCPTask as _completeMCPTask, COMPLETE_TASK_TOOL } from '../../services/mcp/src/tools/complete_task';
import { getTaskStatusMCP as _getTaskStatusMCP, GET_TASK_STATUS_TOOL } from '../../services/mcp/src/tools/get_task_status';

// Helper functions to extract data from MCP responses
function extractMCPResponse(mcpResponse: any) {
  if (mcpResponse?.content?.[0]?.text) {
    return JSON.parse(mcpResponse.content[0].text);
  }
  return mcpResponse;
}

// Wrapper functions for testing that return raw data instead of MCP format
async function enqueueMCPTask(input: any, manager: any) {
  const mcpResponse = await _enqueueMCPTask(input, manager);
  return extractMCPResponse(mcpResponse);
}

async function getNextMCPTask(input: any, manager: any) {
  const mcpResponse = await _getNextMCPTask(input, manager);
  return extractMCPResponse(mcpResponse);
}

async function completeMCPTask(input: any, manager: any) {
  const mcpResponse = await _completeMCPTask(input, manager);
  return extractMCPResponse(mcpResponse);
}

async function getTaskStatusMCP(input: any, manager: any) {
  const mcpResponse = await _getTaskStatusMCP(input, manager);
  return extractMCPResponse(mcpResponse);
}
import { TEST_CONFIG } from '../setup';

describe('MCP Tools', () => {
  let sqliteManager: SQLiteManager;

  beforeEach(() => {
    sqliteManager = new SQLiteManager(TEST_CONFIG.TEST_DB_PATH);
  });

  afterEach(() => {
    if (sqliteManager) {
      sqliteManager.close();
    }
  });

  describe('Tool Schema Definitions', () => {
    it('should have proper MCP tool definitions', () => {
      expect(ENQUEUE_TASK_TOOL.name).toBe('enqueue_task');
      expect(ENQUEUE_TASK_TOOL.description).toBeDefined();
      expect(ENQUEUE_TASK_TOOL.inputSchema).toBeDefined();

      expect(GET_NEXT_TASK_TOOL.name).toBe('get_next_task');
      expect(GET_NEXT_TASK_TOOL.description).toBeDefined();
      expect(GET_NEXT_TASK_TOOL.inputSchema).toBeDefined();

      expect(COMPLETE_TASK_TOOL.name).toBe('complete_task');
      expect(COMPLETE_TASK_TOOL.description).toBeDefined();
      expect(COMPLETE_TASK_TOOL.inputSchema).toBeDefined();

      expect(GET_TASK_STATUS_TOOL.name).toBe('get_task_status');
      expect(GET_TASK_STATUS_TOOL.description).toBeDefined();
      expect(GET_TASK_STATUS_TOOL.inputSchema).toBeDefined();
    });
  });

  describe('enqueue_task Tool', () => {
    it('should enqueue a valid task', async () => {
      const input = {
        task_id: 'test-task-1',
        description: 'Test backend task',
        agent_type: 'backend',
        priority: 5
      };

      const result = await enqueueMCPTask(input, sqliteManager);

      expect(result.success).toBe(true);
      expect(result.task_id).toBe('test-task-1');
      expect(result.message).toContain('enqueued successfully');
      expect(result.workspace_path).toBeDefined();
    });

    it('should enqueue task with dependencies', async () => {
      const input = {
        task_id: 'dependent-task',
        description: 'Task with dependencies',
        agent_type: 'frontend',
        dependencies: ['task-1', 'task-2'],
        priority: 3
      };

      const result = await enqueueMCPTask(input, sqliteManager);

      expect(result.success).toBe(true);
      expect(result.task_id).toBe('dependent-task');
    });

    it('should validate input and return error for invalid data', async () => {
      const input = {
        task_id: '',
        description: 'Invalid task',
        agent_type: 'invalid-type'
      };

      const result = await enqueueMCPTask(input, sqliteManager);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.message).toBe('Input validation failed');
    });

    it('should handle duplicate task IDs', async () => {
      const input1 = {
        task_id: 'duplicate-id',
        description: 'First task',
        agent_type: 'backend'
      };

      const input2 = {
        task_id: 'duplicate-id',
        description: 'Second task',
        agent_type: 'security'
      };

      const result1 = await enqueueMCPTask(input1, sqliteManager);
      expect(result1.success).toBe(true);

      const result2 = await enqueueMCPTask(input2, sqliteManager);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain('already exists');
    });

    it('should validate priority range', async () => {
      const input = {
        task_id: 'invalid-priority',
        description: 'Task with invalid priority',
        agent_type: 'backend',
        priority: 15
      };

      const result = await enqueueMCPTask(input, sqliteManager);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.message).toBe('Input validation failed');
    });
  });

  describe('get_next_task Tool', () => {
    beforeEach(async () => {
      // Set up test tasks
      await enqueueMCPTask({
        task_id: 'ready-task-1',
        description: 'Ready task 1',
        agent_type: 'backend',
        priority: 5
      }, sqliteManager);

      await enqueueMCPTask({
        task_id: 'ready-task-2',
        description: 'Ready task 2', 
        agent_type: 'backend',
        priority: 8
      }, sqliteManager);

      await enqueueMCPTask({
        task_id: 'blocked-task',
        description: 'Task with unmet dependencies',
        agent_type: 'frontend',
        dependencies: ['non-existent-task']
      }, sqliteManager);
    });

    it('should return highest priority ready task', async () => {
      const result = await getNextMCPTask({}, sqliteManager);

      expect(result.success).toBe(true);
      expect(result.task).toBeDefined();
      expect(result.task!.id).toBe('ready-task-2'); // Higher priority (8)
      expect(result.task!.priority).toBe(8);
      expect(result.message).toContain('assigned and marked as running');
      expect(result.queue_status).toBeDefined();
    });

    it('should filter tasks by agent type', async () => {
      const result = await getNextMCPTask({
        agent_type: 'frontend'
      }, sqliteManager);

      expect(result.success).toBe(true);
      expect(result.task).toBeUndefined(); // No ready frontend tasks
      expect(result.message).toContain('No tasks');
    });

    it('should filter by priority range', async () => {
      const result = await getNextMCPTask({
        max_priority: 6
      }, sqliteManager);

      expect(result.success).toBe(true);
      expect(result.task).toBeDefined();
      expect(result.task!.id).toBe('ready-task-1'); // Priority 5, within range
    });

    it('should return status when no tasks available', async () => {
      // Get all ready tasks first
      await getNextMCPTask({}, sqliteManager);
      await getNextMCPTask({}, sqliteManager);

      const result = await getNextMCPTask({}, sqliteManager);

      expect(result.success).toBe(true);
      expect(result.task).toBeUndefined();
      expect(result.message).toContain('pending tasks are waiting for dependencies');
      expect(result.queue_status).toBeDefined();
    });

    it('should handle concurrent access gracefully', async () => {
      // Simulate two agents trying to get the same task
      const [result1, result2] = await Promise.all([
        getNextMCPTask({}, sqliteManager),
        getNextMCPTask({}, sqliteManager)
      ]);

      expect(result1.success).toBe(true);
      // The second result might fail if the first one took the last available task
      // This is expected behavior for the mock implementation
      
      // At least one should succeed
      const successfulResults = [result1, result2].filter(r => r.success);
      expect(successfulResults.length).toBeGreaterThanOrEqual(1);
      
      // If both succeeded, they should get different tasks
      if (result1.success && result2.success && result1.task && result2.task) {
        expect(result1.task.id).not.toBe(result2.task.id);
      }
    });
  });

  describe('complete_task Tool', () => {
    beforeEach(async () => {
      // Set up and start a task
      await enqueueMCPTask({
        task_id: 'running-task',
        description: 'Task to complete',
        agent_type: 'backend'
      }, sqliteManager);

      await getNextMCPTask({}, sqliteManager); // This marks it as running
    });

    it('should complete a task successfully', async () => {
      const input = {
        task_id: 'running-task',
        success: true,
        result: { message: 'Task completed successfully' },
        deliverables: ['output.txt', 'result.json'],
        execution_time_ms: 5000,
        tools_used: ['read_file', 'write_file']
      };

      const result = await completeMCPTask(input, sqliteManager);

      expect(result.success).toBe(true);
      expect(result.task_id).toBe('running-task');
      expect(result.final_status).toBe('completed');
      expect(result.metrics_recorded).toBe(true);
      expect(result.message).toContain('marked as completed');
    });

    it('should handle task failure', async () => {
      const input = {
        task_id: 'running-task',
        success: false,
        error_message: 'Task failed due to network timeout',
        execution_time_ms: 30000
      };

      const result = await completeMCPTask(input, sqliteManager);

      expect(result.success).toBe(true);
      expect(result.final_status).toBe('failed');
      expect(result.message).toContain('marked as failed');
    });

    it('should trigger dependent tasks', async () => {
      // Create dependent tasks
      await enqueueMCPTask({
        task_id: 'dependent-1',
        description: 'Depends on running-task',
        agent_type: 'security',
        dependencies: ['running-task']
      }, sqliteManager);

      await enqueueMCPTask({
        task_id: 'dependent-2',
        description: 'Also depends on running-task',
        agent_type: 'testing',
        dependencies: ['running-task']
      }, sqliteManager);

      const input = {
        task_id: 'running-task',
        success: true,
        result: { completed: true }
      };

      const result = await completeMCPTask(input, sqliteManager);

      expect(result.success).toBe(true);
      expect(result.triggered_tasks).toBeDefined();
      expect(result.triggered_tasks!.length).toBe(2);
      expect(result.triggered_tasks).toContain('dependent-1');
      expect(result.triggered_tasks).toContain('dependent-2');
      expect(result.message).toContain('dependent task(s) are now ready');
    });

    it('should not trigger dependents for failed tasks', async () => {
      await enqueueMCPTask({
        task_id: 'dependent-fail',
        description: 'Should not be triggered',
        agent_type: 'backend',
        dependencies: ['running-task']
      }, sqliteManager);

      const input = {
        task_id: 'running-task',
        success: false,
        error_message: 'Task failed'
      };

      const result = await completeMCPTask(input, sqliteManager);

      expect(result.success).toBe(true);
      expect(result.final_status).toBe('failed');
      expect(result.triggered_tasks).toBeUndefined();
    });

    it('should validate input', async () => {
      const input = {
        task_id: '', // Invalid empty task ID
        success: true
      };

      const result = await completeMCPTask(input, sqliteManager);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Input validation failed');
      expect(result.error).toBeDefined();
    });

    it('should handle non-existent task', async () => {
      const input = {
        task_id: 'non-existent-task',
        success: true
      };

      const result = await completeMCPTask(input, sqliteManager);

      expect(result.success).toBe(true); // Doesn't error, just completes gracefully
      expect(result.task_id).toBe('non-existent-task');
    });
  });

  describe('get_task_status Tool', () => {
    beforeEach(async () => {
      // Create diverse set of tasks for comprehensive status testing
      await enqueueMCPTask({
        task_id: 'pending-1',
        description: 'Pending task 1',
        agent_type: 'backend'
      }, sqliteManager);

      await enqueueMCPTask({
        task_id: 'pending-2',
        description: 'Pending task 2',
        agent_type: 'frontend'
      }, sqliteManager);

      await enqueueMCPTask({
        task_id: 'blocked',
        description: 'Blocked by dependencies',
        agent_type: 'security',
        dependencies: ['non-existent']
      }, sqliteManager);

      // Start one task
      const task = await getNextMCPTask({}, sqliteManager);
      
      // Complete one task
      await completeMCPTask({
        task_id: 'pending-2',
        success: true,
        execution_time_ms: 3000
      }, sqliteManager);
    });

    it('should return comprehensive system status', async () => {
      const result = await getTaskStatusMCP({}, sqliteManager);

      expect(result.success).toBe(true);
      expect(result.system_status).toBeDefined();
      expect(result.system_status.total_tasks).toBeGreaterThan(0);
      expect(result.performance).toBeDefined();
      expect(result.running_tasks).toBeDefined();
      expect(result.queue_summary).toBeDefined();
      expect(result.message).toContain('System status retrieved');
    });

    it('should include task details when requested', async () => {
      const result = await getTaskStatusMCP({
        include_tasks: true
      }, sqliteManager);

      expect(result.success).toBe(true);
      expect(result.tasks).toBeDefined();
      expect(Array.isArray(result.tasks)).toBe(true);
      expect(result.tasks!.length).toBeGreaterThan(0);
    });

    it('should filter tasks by agent type', async () => {
      const result = await getTaskStatusMCP({
        include_tasks: true,
        agent_type: 'backend'
      }, sqliteManager);

      expect(result.success).toBe(true);
      expect(result.tasks).toBeDefined();
      
      if (result.tasks!.length > 0) {
        expect(result.tasks!.every(t => t.agent_type === 'backend')).toBe(true);
      }
    });

    it('should filter tasks by status', async () => {
      const result = await getTaskStatusMCP({
        include_tasks: true,
        status: 'pending'
      }, sqliteManager);

      expect(result.success).toBe(true);
      expect(result.tasks).toBeDefined();
      
      if (result.tasks!.length > 0) {
        expect(result.tasks!.every(t => t.status === 'pending')).toBe(true);
      }
    });

    it('should show running task details with elapsed time', async () => {
      const result = await getTaskStatusMCP({}, sqliteManager);

      expect(result.success).toBe(true);
      expect(result.running_tasks).toBeDefined();
      
      if (result.running_tasks.length > 0) {
        const runningTask = result.running_tasks[0];
        expect(runningTask.id).toBeDefined();
        expect(runningTask.description).toBeDefined();
        expect(runningTask.agent_type).toBeDefined();
        expect(runningTask.elapsed_seconds).toBeGreaterThanOrEqual(0);
        expect(runningTask.workspace_path).toBeDefined();
      }
    });

    it('should calculate queue metrics correctly', async () => {
      const result = await getTaskStatusMCP({}, sqliteManager);

      expect(result.success).toBe(true);
      expect(result.queue_summary.by_agent_type).toBeDefined();
      expect(result.queue_summary.blocked_tasks).toBeGreaterThanOrEqual(0);
      
      const agentTypes = ['backend', 'frontend', 'security', 'testing', 'devops'];
      for (const agentType of agentTypes) {
        expect(result.queue_summary.by_agent_type[agentType]).toBeDefined();
        expect(typeof result.queue_summary.by_agent_type[agentType].pending).toBe('number');
        expect(typeof result.queue_summary.by_agent_type[agentType].running).toBe('number');
        expect(typeof result.queue_summary.by_agent_type[agentType].completed).toBe('number');
      }
    });

    it('should show next ready task', async () => {
      const result = await getTaskStatusMCP({}, sqliteManager);

      expect(result.success).toBe(true);
      expect(result.queue_summary).toBeDefined();
      
      if (result.queue_summary.next_ready_task) {
        expect(result.queue_summary.next_ready_task.id).toBeDefined();
        expect(result.queue_summary.next_ready_task.agent_type).toBeDefined();
        expect(result.queue_summary.next_ready_task.priority).toBeDefined();
      }
    });

    it('should handle partial task ID filtering', async () => {
      const result = await getTaskStatusMCP({
        include_tasks: true,
        task_id: 'pending'
      }, sqliteManager);

      expect(result.success).toBe(true);
      expect(result.tasks).toBeDefined();
      
      if (result.tasks!.length > 0) {
        expect(result.tasks!.every(t => t.id.includes('pending'))).toBe(true);
      }
    });
  });

  describe('End-to-End MCP Workflow', () => {
    it('should execute complete task coordination workflow', async () => {
      // 1. Enqueue base task
      const enqueueResult1 = await enqueueMCPTask({
        task_id: 'e2e-base',
        description: 'Base task for E2E test',
        agent_type: 'backend',
        priority: 5
      }, sqliteManager);

      expect(enqueueResult1.success).toBe(true);

      // 2. Enqueue dependent task
      const enqueueResult2 = await enqueueMCPTask({
        task_id: 'e2e-dependent',
        description: 'Dependent task for E2E test',
        agent_type: 'security',
        dependencies: ['e2e-base'],
        priority: 7
      }, sqliteManager);

      expect(enqueueResult2.success).toBe(true);

      // 3. Get system status - should show 1 ready, 1 blocked
      const statusResult1 = await getTaskStatusMCP({}, sqliteManager);
      expect(statusResult1.success).toBe(true);
      expect(statusResult1.system_status.ready_tasks).toBe(1);
      expect(statusResult1.queue_summary.blocked_tasks).toBe(1);

      // 4. Get next task (should be base task)
      const nextTaskResult = await getNextMCPTask({}, sqliteManager);
      expect(nextTaskResult.success).toBe(true);
      expect(nextTaskResult.task!.id).toBe('e2e-base');

      // 5. Check status - should show 1 running, 1 blocked
      const statusResult2 = await getTaskStatusMCP({}, sqliteManager);
      expect(statusResult2.success).toBe(true);
      expect(statusResult2.system_status.running_tasks).toBe(1);
      expect(statusResult2.queue_summary.blocked_tasks).toBe(1);

      // 6. Complete base task
      const completeResult = await completeMCPTask({
        task_id: 'e2e-base',
        success: true,
        result: { completed: true },
        execution_time_ms: 2500,
        deliverables: ['output.txt']
      }, sqliteManager);

      expect(completeResult.success).toBe(true);
      expect(completeResult.triggered_tasks).toContain('e2e-dependent');

      // 7. Final status check - should show dependent task now ready
      const statusResult3 = await getTaskStatusMCP({}, sqliteManager);
      expect(statusResult3.success).toBe(true);
      expect(statusResult3.system_status.completed_tasks).toBe(1);
      expect(statusResult3.system_status.ready_tasks).toBe(1);
      expect(statusResult3.queue_summary.blocked_tasks).toBe(0);

      // 8. Get next task (should be dependent task)
      const nextTaskResult2 = await getNextMCPTask({}, sqliteManager);
      expect(nextTaskResult2.success).toBe(true);
      expect(nextTaskResult2.task!.id).toBe('e2e-dependent');
      expect(nextTaskResult2.task!.priority).toBe(7);
    });

    it('should handle complex dependency chains', async () => {
      // Create chain: A -> B -> C, A -> D
      await enqueueMCPTask({
        task_id: 'chain-a',
        description: 'Chain root task',
        agent_type: 'backend'
      }, sqliteManager);

      await enqueueMCPTask({
        task_id: 'chain-b',
        description: 'Chain middle task',
        agent_type: 'frontend',
        dependencies: ['chain-a']
      }, sqliteManager);

      await enqueueMCPTask({
        task_id: 'chain-c',
        description: 'Chain end task',
        agent_type: 'security',
        dependencies: ['chain-b']
      }, sqliteManager);

      await enqueueMCPTask({
        task_id: 'chain-d',
        description: 'Parallel branch task',
        agent_type: 'testing',
        dependencies: ['chain-a']
      }, sqliteManager);

      // Only chain-a should be ready initially
      const status1 = await getTaskStatusMCP({}, sqliteManager);
      expect(status1.system_status.ready_tasks).toBe(1);

      // Execute chain-a
      const taskA = await getNextMCPTask({}, sqliteManager);
      expect(taskA.task!.id).toBe('chain-a');
      
      await completeMCPTask({
        task_id: 'chain-a',
        success: true
      }, sqliteManager);

      // Now chain-b and chain-d should be ready
      const status2 = await getTaskStatusMCP({}, sqliteManager);
      expect(status2.system_status.ready_tasks).toBe(2);

      // Execute chain-b
      const taskB = await getNextMCPTask({}, sqliteManager);
      expect(['chain-b', 'chain-d']).toContain(taskB.task!.id);
      
      if (taskB.task!.id === 'chain-b') {
        await completeMCPTask({
          task_id: 'chain-b',
          success: true
        }, sqliteManager);

        // Now chain-c should become ready (along with chain-d if still pending)
        const status3 = await getTaskStatusMCP({}, sqliteManager);
        expect(status3.system_status.ready_tasks).toBeGreaterThanOrEqual(1);
      }
    });
  });
});