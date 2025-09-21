import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export interface Task {
  id: string;
  description: string;
  agent_type: string;
  status: 'pending' | 'ready' | 'running' | 'completed' | 'failed';
  dependencies: string[];
  priority: number;
  created_at: number;
  started_at?: number;
  completed_at?: number;
  result?: string;
  workspace_path: string;
  timeout_seconds: number;
  retry_count: number;
  max_retries: number;
}

export interface TaskParams {
  task_id: string;
  description: string;
  agent_type: string;
  dependencies?: string[];
  priority?: number;
  workspace_path?: string;
  timeout_seconds?: number;
  max_retries?: number;
}

export interface TaskMetrics {
  task_id: string;
  execution_time_ms: number;
  memory_usage_mb: number;
  tools_used: string[];
  lines_changed: number;
  files_created: number;
  files_modified: number;
}

export interface SystemStatus {
  totalTasks: number;
  pendingTasks: number;
  readyTasks: number;
  runningTasks: Task[];
  completedTasks: number;
  failedTasks: number;
  performance: {
    avgExecutionTimeMs: number;
    successRate: number;
    efficiency: number;
  };
}

/**
 * Mock SQLite Manager for testing MCP coordination logic
 * Uses in-memory storage to avoid native module compilation issues
 */
export class MockSQLiteManager {
  private tasks: Map<string, Task> = new Map();
  private metrics: Map<string, TaskMetrics> = new Map();
  private isInitialized = false;

  constructor(private dbPath?: string) {
    // Ensure directory exists for workspace creation if dbPath provided
    if (dbPath) {
      const dbDir = dirname(dbPath);
      if (!existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true });
      }
    }
    
    this.isInitialized = true;
    console.log('✅ Mock SQLiteManager initialized (in-memory)');
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('ℹ️ Mock SQLiteManager already initialized');
      return;
    }
    
    this.isInitialized = true;
    console.log('✅ Mock SQLiteManager initialized (in-memory)');
  }

  async enqueueTask(params: TaskParams): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('SQLiteManager not initialized');
    }

    // Validate agent type
    const validAgentTypes = ['backend', 'frontend', 'security', 'testing', 'devops'];
    if (!validAgentTypes.includes(params.agent_type)) {
      throw new Error(`Invalid agent type: ${params.agent_type}`);
    }

    // Validate priority
    const priority = params.priority || 1;
    if (priority < 1 || priority > 10) {
      throw new Error(`Invalid priority: ${priority}. Must be between 1 and 10`);
    }

    // Check for duplicate task IDs
    if (this.tasks.has(params.task_id)) {
      throw new Error(`Task ${params.task_id} already exists`);
    }

    const workspacePath = params.workspace_path || `./workspaces/${params.task_id}`;
    
    // Ensure workspace directory exists
    if (!existsSync(workspacePath)) {
      mkdirSync(workspacePath, { recursive: true });
    }

    const task: Task = {
      id: params.task_id,
      description: params.description,
      agent_type: params.agent_type,
      status: 'pending',
      dependencies: params.dependencies || [],
      priority: priority,
      created_at: Math.floor(Date.now() / 1000),
      workspace_path: workspacePath,
      timeout_seconds: params.timeout_seconds || 300,
      retry_count: 0,
      max_retries: params.max_retries || 3
    };

    this.tasks.set(params.task_id, task);
    console.log(`✅ Task ${params.task_id} enqueued successfully`);
  }

  async getReadyTasks(): Promise<Task[]> {
    const readyTasks: Task[] = [];

    for (const task of this.tasks.values()) {
      if (task.status === 'pending') {
        if (task.dependencies.length === 0 || await this.checkDependencies(task.dependencies)) {
          readyTasks.push(task);
        }
      }
    }

    return readyTasks.sort((a, b) => b.priority - a.priority);
  }

  async getNextReadyTask(): Promise<Task | null> {
    const readyTasks = await this.getReadyTasks();
    return readyTasks.length > 0 ? readyTasks[0] : null;
  }

  async markTaskRunning(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'pending') {
      if (task) {
        console.warn(`⚠️ Task ${taskId} was not in pending status (current: ${task.status})`);
      }
      return false;
    }

    task.status = 'running';
    task.started_at = Math.floor(Date.now() / 1000);
    this.tasks.set(taskId, task);
    
    console.log(`✅ Task ${taskId} marked as running`);
    return true;
  }

  async markTaskComplete(taskId: string, result: any, success: boolean = true): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      console.warn(`⚠️ Task ${taskId} not found`);
      return;
    }

    task.status = success ? 'completed' : 'failed';
    task.completed_at = Math.floor(Date.now() / 1000);
    task.result = JSON.stringify(result);
    this.tasks.set(taskId, task);
    
    console.log(`✅ Task ${taskId} marked as ${task.status}`);
    console.log(`🔄 Dependencies updated for completed task ${taskId}`);
  }

  async recordTaskMetrics(metrics: TaskMetrics): Promise<void> {
    this.metrics.set(metrics.task_id, metrics);
    console.log(`📊 Metrics recorded for task ${metrics.task_id}`);
  }

  async getSystemStatus(): Promise<SystemStatus> {
    const allTasks = Array.from(this.tasks.values());
    
    const statusCounts = allTasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const runningTasks = allTasks.filter(t => t.status === 'running');
    const completedTasks = statusCounts.completed || 0;
    const failedTasks = statusCounts.failed || 0;
    const totalTasks = allTasks.length;
    
    // Calculate performance metrics
    const completedTasksWithTiming = allTasks.filter(t => 
      t.status === 'completed' && t.started_at && t.completed_at
    );
    
    const avgExecutionTimeMs = completedTasksWithTiming.length > 0
      ? Math.round(completedTasksWithTiming.reduce((sum, t) => 
          sum + ((t.completed_at! - t.started_at!) * 1000), 0
        ) / completedTasksWithTiming.length)
      : 0;

    const successRate = (completedTasks + failedTasks) > 0 
      ? completedTasks / (completedTasks + failedTasks) 
      : 1.0;
      
    const efficiency = successRate * (completedTasks / Math.max(totalTasks, 1));

    return {
      totalTasks,
      pendingTasks: statusCounts.pending || 0,
      readyTasks: (await this.getReadyTasks()).length,
      runningTasks,
      completedTasks,
      failedTasks,
      performance: {
        avgExecutionTimeMs,
        successRate,
        efficiency
      }
    };
  }

  private async checkDependencies(dependencies: string[]): Promise<boolean> {
    if (dependencies.length === 0) return true;

    for (const depId of dependencies) {
      const depTask = this.tasks.get(depId);
      if (!depTask || depTask.status !== 'completed') {
        return false;
      }
    }

    return true;
  }

  async transaction<T>(operation: () => Promise<T> | T): Promise<T> {
    // For mock implementation, just execute the operation
    // In real implementation, this would use database transactions
    try {
      return await operation();
    } catch (error) {
      console.error('❌ Transaction failed:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.isInitialized) {
      this.tasks.clear();
      this.metrics.clear();
      this.isInitialized = false;
      console.log('✅ Mock database connection closed');
    }
  }

  // Enhanced methods for MCP tools
  async getNextReadyTaskWithFilters(agentType?: string, minPriority?: number, maxPriority?: number): Promise<Task | null> {
    const readyTasks = await this.getReadyTasks();
    
    let filteredTasks = readyTasks;
    
    if (agentType) {
      filteredTasks = filteredTasks.filter(t => t.agent_type === agentType);
    }
    
    if (minPriority !== undefined) {
      filteredTasks = filteredTasks.filter(t => t.priority >= minPriority);
    }
    
    if (maxPriority !== undefined) {
      filteredTasks = filteredTasks.filter(t => t.priority <= maxPriority);
    }
    
    return filteredTasks.length > 0 ? filteredTasks[0] : null;
  }
  
  async getDependentTasks(completedTaskId: string): Promise<string[]> {
    const dependentTaskIds: string[] = [];
    
    for (const task of this.tasks.values()) {
      if (task.status === 'pending' && task.dependencies.includes(completedTaskId)) {
        // Check if all dependencies are now satisfied
        const allDepsSatisfied = await this.checkDependencies(task.dependencies);
        if (allDepsSatisfied) {
          dependentTaskIds.push(task.id);
        }
      }
    }
    
    return dependentTaskIds;
  }

  // Test helper methods
  async getAllTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values()).sort((a, b) => a.created_at - b.created_at);
  }

  async clearAllTasks(): Promise<void> {
    this.tasks.clear();
    this.metrics.clear();
    console.log('🧹 All tasks cleared');
  }
}