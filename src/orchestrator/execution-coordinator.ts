/**
 * Execution Coordinator
 * Manages parallel execution of tasks with dependency resolution
 */
import { EventEmitter } from 'events';
import { Task } from './multi-agent-orchestrator.js';
import { AgentSpawnManager } from './agent-spawn-manager.js';
import { debug } from '../utils/debug.js';

export type ExecutionMode = 'sequential' | 'parallel' | 'adaptive';

export interface ExecutionSession {
  id: string;
  mode: ExecutionMode;
  startTime: number;
  endTime?: number;
  status: 'running' | 'completed' | 'failed';
}

export interface TaskExecution {
  taskId: string;
  sessionId: string;
  agentId: string;
  startTime: number;
  endTime?: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: string;
  error?: string;
}

export interface DependencyGraph {
  nodes: { id: string; dependencies: string[] }[];
  resolved: string[];
  pending: string[];
}

export interface ExecutionState {
  taskId: string;
  mode: ExecutionMode;
  tasks: Task[];
  completedTasks: Set<string>;
  failedTasks: Set<string>;
  runningTasks: Set<string>;
  workspaceId: string;
}

export class ExecutionCoordinator extends EventEmitter {
  private executions = new Map<string, ExecutionState>();
  private agentManager: AgentSpawnManager;

  constructor() {
    super();
    this.agentManager = new AgentSpawnManager();
    this.setupAgentManagerEvents();
  }

  private setupAgentManagerEvents(): void {
    this.agentManager.on('agent_task_completed', (data) => {
      this.handleTaskCompletion(data);
    });

    this.agentManager.on('agent_task_failed', (data) => {
      this.handleTaskFailure(data);
    });
  }

  /**
   * Start executing tasks
   */
  async execute(orchestrationId: string, tasks: Task[], mode: ExecutionMode): Promise<void> {
    debug('Starting execution:', orchestrationId, mode, tasks.length, 'tasks');

    // Create workspace
    const workspaceId = await this.agentManager.prepareWorkspace(process.cwd());

    const executionState: ExecutionState = {
      taskId: orchestrationId,
      mode,
      tasks,
      completedTasks: new Set(),
      failedTasks: new Set(),
      runningTasks: new Set(),
      workspaceId
    };

    this.executions.set(orchestrationId, executionState);

    // Start execution based on mode
    switch (mode) {
      case 'sequential':
        await this.executeSequential(executionState);
        break;
      case 'parallel':
        await this.executeParallel(executionState);
        break;
      case 'adaptive':
        await this.executeAdaptive(executionState);
        break;
    }
  }

  /**
   * Execute tasks sequentially
   */
  private async executeSequential(state: ExecutionState): Promise<void> {
    debug('Executing tasks sequentially');

    // Sort tasks by priority
    const sortedTasks = state.tasks.sort((a, b) => a.priority - b.priority);

    for (const task of sortedTasks) {
      if (state.failedTasks.size > 0) {
        // Stop if any task has failed
        break;
      }

      await this.executeTask(state, task);
    }
  }

  /**
   * Execute tasks in parallel where possible
   */
  private async executeParallel(state: ExecutionState): Promise<void> {
    debug('Executing tasks in parallel');

    // Start with tasks that have no dependencies
    let availableTasks = this.getAvailableTasks(state);
    
    while (availableTasks.length > 0 && state.failedTasks.size === 0) {
      // Execute all available tasks in parallel
      const taskPromises = availableTasks.map(task => this.executeTask(state, task));
      
      // Wait for at least one task to complete before checking for new available tasks
      await Promise.race(taskPromises);
      
      // Check for newly available tasks
      availableTasks = this.getAvailableTasks(state);
      
      // Small delay to prevent tight loop
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Wait for all running tasks to complete
    while (state.runningTasks.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * Adaptive execution - starts sequential, moves to parallel for independent tasks
   */
  private async executeAdaptive(state: ExecutionState): Promise<void> {
    debug('Executing tasks adaptively');

    // Group tasks by dependency levels
    const dependencyLevels = this.groupTasksByDependencyLevel(state.tasks);
    
    for (const level of dependencyLevels) {
      if (state.failedTasks.size > 0) break;

      if (level.length === 1) {
        // Single task - execute sequentially
        await this.executeTask(state, level[0]);
      } else {
        // Multiple tasks at same level - execute in parallel
        const taskPromises = level.map(task => this.executeTask(state, task));
        await Promise.all(taskPromises);
      }
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(state: ExecutionState, task: Task): Promise<void> {
    // Check if dependencies are satisfied
    if (!this.areDependenciesSatisfied(task, state)) {
      debug('Task dependencies not satisfied:', task.id);
      return;
    }

    // Check if task is already running or completed
    if (state.runningTasks.has(task.id) || state.completedTasks.has(task.id)) {
      return;
    }

    debug('Starting task:', task.id, task.agent);
    
    task.status = 'in_progress';
    state.runningTasks.add(task.id);
    
    this.emit('task_started', {
      taskId: state.taskId,
      task
    });

    try {
      // Spawn agent if needed
      const agentId = await this.agentManager.spawnAgent(task.agent, state.workspaceId);
      
      // Send task to agent
      const result = await this.agentManager.sendTask(agentId, task.description);
      
      // Task completed successfully
      task.status = 'completed';
      task.result = result;
      state.completedTasks.add(task.id);
      state.runningTasks.delete(task.id);

      this.emit('task_completed', {
        taskId: state.taskId,
        task,
        result
      });

      debug('Task completed:', task.id);

    } catch (error) {
      // Task failed
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      state.failedTasks.add(task.id);
      state.runningTasks.delete(task.id);

      this.emit('task_failed', {
        taskId: state.taskId,
        task,
        error: task.error
      });

      debug('Task failed:', task.id, task.error);
    }
  }

  /**
   * Get tasks that are available to execute (dependencies satisfied)
   */
  private getAvailableTasks(state: ExecutionState): Task[] {
    return state.tasks.filter(task => 
      task.status === 'pending' &&
      !state.runningTasks.has(task.id) &&
      !state.completedTasks.has(task.id) &&
      !state.failedTasks.has(task.id) &&
      this.areDependenciesSatisfied(task, state)
    );
  }

  /**
   * Check if task dependencies are satisfied
   */
  private areDependenciesSatisfied(task: Task, state: ExecutionState): boolean {
    return task.dependencies.every(depId => state.completedTasks.has(depId));
  }

  /**
   * Group tasks by dependency level for adaptive execution
   */
  private groupTasksByDependencyLevel(tasks: Task[]): Task[][] {
    const levels: Task[][] = [];
    const processed = new Set<string>();
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    while (processed.size < tasks.length) {
      const currentLevel: Task[] = [];

      for (const task of tasks) {
        if (processed.has(task.id)) continue;

        // Check if all dependencies are already processed
        const dependenciesMet = task.dependencies.every(depId => processed.has(depId));
        
        if (dependenciesMet) {
          currentLevel.push(task);
          processed.add(task.id);
        }
      }

      if (currentLevel.length === 0) {
        // Circular dependency or other issue - add remaining tasks to break deadlock
        const remaining = tasks.filter(t => !processed.has(t.id));
        if (remaining.length > 0) {
          currentLevel.push(...remaining);
          remaining.forEach(t => processed.add(t.id));
        }
      }

      levels.push(currentLevel);
    }

    return levels;
  }

  /**
   * Handle task completion from agent manager
   */
  private handleTaskCompletion(data: { sessionId: string; output: string; task: string }): void {
    // This is handled in executeTask method
    debug('Agent task completed:', data.sessionId);
  }

  /**
   * Handle task failure from agent manager
   */
  private handleTaskFailure(data: { sessionId: string; error: string; task: string }): void {
    // This is handled in executeTask method
    debug('Agent task failed:', data.sessionId, data.error);
  }

  /**
   * Handle inter-agent messages
   */
  handleAgentMessage(data: { from: string; to: string; message: any }): void {
    debug('Inter-agent message:', data);
    // Forward to specific execution contexts if needed
    this.emit('agent_message', data);
  }

  /**
   * Cancel execution
   */
  async cancel(orchestrationId: string): Promise<void> {
    const state = this.executions.get(orchestrationId);
    if (!state) return;

    debug('Cancelling execution:', orchestrationId);

    // Mark all pending/running tasks as failed
    for (const task of state.tasks) {
      if (task.status === 'pending' || task.status === 'in_progress') {
        task.status = 'failed';
        task.error = 'Cancelled by user';
      }
    }

    // Clean up workspace
    await this.agentManager.cleanup(state.workspaceId);

    this.executions.delete(orchestrationId);
    
    this.emit('execution_cancelled', { orchestrationId });
  }

  /**
   * Get execution state
   */
  getExecutionState(orchestrationId: string): ExecutionState | null {
    return this.executions.get(orchestrationId) || null;
  }
}