/**
 * Multi-Agent Orchestrator
 * Core system that coordinates multiple AI agents working together on complex tasks
 */
import { EventEmitter } from 'events';
import { AgentSpawnManager } from './agent-spawn-manager.js';
import { TaskDistributor } from './task-distributor.js';
import { InterAgentCommunicationBus } from './communication-bus.js';
import { ExecutionCoordinator } from './execution-coordinator.js';
import { ProgressTracker } from './progress-tracker.js';
import { debug } from '../utils/debug.js';

export interface Task {
  id: string;
  description: string;
  agent: string; // 'backend', 'frontend', 'architect', etc.
  dependencies: string[]; // Task IDs this task depends on
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface OrchestrationRequest {
  query: string;
  context: {
    repository: string;
    framework?: string;
    language?: string;
    dependencies?: string[];
  };
  agents: string[]; // Which agents to involve
  mode: 'sequential' | 'parallel' | 'adaptive';
}

export interface OrchestrationResult {
  taskId: string;
  status: 'running' | 'completed' | 'failed';
  tasks: Task[];
  progress: {
    completed: number;
    total: number;
    currentStage: string;
  };
  results: Record<string, any>;
  errors: string[];
}

export class MultiAgentOrchestrator extends EventEmitter {
  private spawnManager: AgentSpawnManager;
  private taskDistributor: TaskDistributor;
  private communicationBus: InterAgentCommunicationBus;
  private executionCoordinator: ExecutionCoordinator;
  private progressTracker: ProgressTracker;
  
  private activeTasks = new Map<string, Task[]>();
  private taskResults = new Map<string, any>();

  constructor() {
    super();
    
    this.spawnManager = new AgentSpawnManager();
    this.taskDistributor = new TaskDistributor();
    this.communicationBus = new InterAgentCommunicationBus();
    this.executionCoordinator = new ExecutionCoordinator();
    this.progressTracker = new ProgressTracker();

    this.setupEventHandlers();
  }

  /**
   * Main orchestration entry point
   */
  async orchestrate(request: OrchestrationRequest): Promise<string> {
    const taskId = this.generateTaskId();
    debug('Starting orchestration:', taskId, request);

    try {
      // 1. Analyze the request and break it down into tasks
      const tasks = await this.taskDistributor.decompose(request);
      this.activeTasks.set(taskId, tasks);

      // 2. Initialize progress tracking
      this.progressTracker.initializeTask(taskId, tasks);

      // 3. Start execution based on mode (execution coordinator handles workspace preparation)
      await this.executionCoordinator.execute(taskId, tasks, request.mode);

      this.emit('orchestration_started', { taskId, tasks, request });
      return taskId;

    } catch (error) {
      debug('Orchestration error:', taskId, error);
      this.emit('orchestration_error', { taskId, error });
      throw error;
    }
  }

  /**
   * Get current status of an orchestration task
   */
  getStatus(taskId: string): OrchestrationResult | null {
    const tasks = this.activeTasks.get(taskId);
    if (!tasks) return null;

    const progress = this.progressTracker.getProgress(taskId);
    const results = this.taskResults.get(taskId) || {};
    
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const failedTasks = tasks.filter(t => t.status === 'failed');
    const errors = failedTasks.map(t => t.error).filter(Boolean) as string[];

    return {
      taskId,
      status: this.determineOverallStatus(tasks),
      tasks,
      progress: {
        completed: completedTasks.length,
        total: tasks.length,
        currentStage: progress?.currentStage || 'initializing'
      },
      results,
      errors
    };
  }

  /**
   * Stream real-time updates for a task
   */
  async *streamProgress(taskId: string): AsyncGenerator<OrchestrationResult> {
    let lastStatus = this.getStatus(taskId);
    if (!lastStatus) return;

    yield lastStatus;

    // Set up listeners for updates
    const updateHandler = (data: any) => {
      if (data.taskId === taskId) {
        const currentStatus = this.getStatus(taskId);
        if (currentStatus && JSON.stringify(currentStatus) !== JSON.stringify(lastStatus)) {
          lastStatus = currentStatus;
          // This is an event handler, return value is ignored in async generators
          // We would need to use a different pattern for real streaming
        }
      }
    };

    this.on('task_updated', updateHandler);
    this.on('task_completed', updateHandler);
    this.on('task_failed', updateHandler);

    // Keep streaming until completion or failure
    while (lastStatus && lastStatus.status === 'running') {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Poll every second
      const currentStatus = this.getStatus(taskId);
      if (currentStatus && JSON.stringify(currentStatus) !== JSON.stringify(lastStatus)) {
        lastStatus = currentStatus;
        yield currentStatus;
      }
    }

    // Clean up listeners
    this.removeListener('task_updated', updateHandler);
    this.removeListener('task_completed', updateHandler);
    this.removeListener('task_failed', updateHandler);
  }

  /**
   * Cancel a running orchestration
   */
  async cancel(taskId: string): Promise<void> {
    debug('Cancelling orchestration:', taskId);
    
    const tasks = this.activeTasks.get(taskId);
    if (!tasks) return;

    // Mark all pending/in_progress tasks as cancelled
    for (const task of tasks) {
      if (task.status === 'pending' || task.status === 'in_progress') {
        task.status = 'failed';
        task.error = 'Cancelled by user';
      }
    }

    // Notify execution coordinator to stop
    await this.executionCoordinator.cancel(taskId);
    
    // Clean up progress tracking
    this.progressTracker.cleanup(taskId);
    
    // Clean up active tasks
    this.activeTasks.delete(taskId);
    this.taskResults.delete(taskId);
    
    this.emit('orchestration_cancelled', { taskId });
  }

  /**
   * Get available agents and their capabilities
   */
  getAvailableAgents(): string[] {
    return [
      'backend',
      'frontend', 
      'architect',
      'design',
      'cli',
      'test-writer',
      'pr-merger',
      'task-dispatcher',
      'production-architect'
    ];
  }

  private setupEventHandlers(): void {
    // Listen to task completion from execution coordinator
    this.executionCoordinator.on('task_completed', (data) => {
      this.handleTaskCompletion(data);
    });

    this.executionCoordinator.on('task_failed', (data) => {
      this.handleTaskFailure(data);
    });

    // Listen to execution events
    this.executionCoordinator.on('execution_completed', (data) => {
      this.emit('orchestration_completed', data);
    });

    this.executionCoordinator.on('execution_failed', (data) => {
      this.emit('orchestration_failed', data);
    });

    // Listen to communication bus for inter-agent messages
    this.communicationBus.on('agent_message', (data) => {
      this.handleInterAgentMessage(data);
    });

    // Listen to progress updates
    this.progressTracker.on('progress_updated', (data) => {
      this.emit('progress_updated', data);
    });

    // Listen to agent spawn events
    this.spawnManager.on('agent_spawned', (data) => {
      this.communicationBus.registerAgent(data.sessionId, data.agent, 'default');
    });

    this.spawnManager.on('agent_terminated', (data) => {
      this.communicationBus.unregisterAgent(data.sessionId);
    });

    // Listen to agent output for progress tracking
    this.spawnManager.on('agent_output', (data) => {
      const session = this.spawnManager.getAgent(data.sessionId);
      if (session) {
        this.progressTracker.addAgentOutput(session.workspaceId, session.agent, data.chunk);
      }
    });
  }

  private handleTaskCompletion(data: { taskId: string; task: Task; result: any }): void {
    debug('Task completed:', data.task.id);
    
    // Update task status
    data.task.status = 'completed';
    data.task.result = data.result;

    // Store result
    let taskResults = this.taskResults.get(data.taskId) || {};
    taskResults[data.task.id] = data.result;
    this.taskResults.set(data.taskId, taskResults);

    // Update progress
    this.progressTracker.markTaskComplete(data.taskId, data.task.id);

    this.emit('task_completed', data);
  }

  private handleTaskFailure(data: { taskId: string; task: Task; error: string }): void {
    debug('Task failed:', data.task.id, data.error);
    
    // Update task status
    data.task.status = 'failed';
    data.task.error = data.error;

    // Update progress
    this.progressTracker.markTaskFailed(data.taskId, data.task.id, data.error);

    this.emit('task_failed', data);
  }

  private handleInterAgentMessage(data: { from: string; to: string; message: any }): void {
    debug('Inter-agent message:', data);
    // Forward relevant messages to execution coordinator
    this.executionCoordinator.handleAgentMessage(data);
  }

  private determineOverallStatus(tasks: Task[]): 'running' | 'completed' | 'failed' {
    const hasRunning = tasks.some(t => t.status === 'in_progress' || t.status === 'pending');
    const hasFailed = tasks.some(t => t.status === 'failed');
    const allCompleted = tasks.every(t => t.status === 'completed');

    if (hasFailed) return 'failed';
    if (allCompleted) return 'completed';
    return 'running';
  }

  private generateTaskId(): string {
    return `orch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}