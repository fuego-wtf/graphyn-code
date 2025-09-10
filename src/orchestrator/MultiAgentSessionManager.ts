/**
 * Multi-Agent Session Manager for Orchestration
 * 
 * Main orchestration entry point that coordinates multiple Claude Code sessions,
 * manages task execution flow, and ensures completion synchronization.
 */

import { EventEmitter } from 'events';
import { SessionPoolManager, ClaudeSession } from './SessionPoolManager';
import { ContextSynchronizer, ProgressUpdate } from './ContextSynchronizer';
import { TaskDependencyGraph } from './TaskDependencyGraph';
import { QueryProcessor } from './QueryProcessor';
import { EventStream, createTaskEvent, createAgentEvent, createSystemEvent } from './EventStream';
// Removed InteractiveFeedbackLoop import - functionality consolidated
export interface UserFeedback {
  type: 'approval' | 'modification' | 'rejection';
  message?: string;
  modifications?: Record<string, any>;
}
import { ConsoleOutput } from '../console/ConsoleOutput';
import { 
  AgentType, 
  TaskExecution, 
  TaskDefinition,
  TaskStatus, 
  ExecutionMode,
  QueryComplexity,
  ExecutionResults,
  TaskResult,
  AgentExecutionContext
} from './types';

/**
 * Session execution state
 */
interface SessionExecution {
  readonly session: ClaudeSession;
  readonly task: TaskExecution;
  readonly startTime: Date;
  status: 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

/**
 * Execution configuration options
 */
export interface ExecutionOptions {
  readonly mode: ExecutionMode;
  readonly maxConcurrency: number;
  readonly timeout: number;
  readonly retryAttempts: number;
  readonly workingDirectory?: string;
}

/**
 * Query execution statistics
 */
export interface ExecutionStatistics {
  readonly totalTasks: number;
  readonly completedTasks: number;
  readonly failedTasks: number;
  readonly activeSessions: number;
  readonly startTime: Date;
  readonly duration: number;
  readonly totalCost: number;
  readonly averageTaskTime: number;
}

/**
 * Main multi-agent session manager and orchestration coordinator
 */
export class MultiAgentSessionManager extends EventEmitter {
  private readonly sessionPool: SessionPoolManager;
  private readonly contextSync: ContextSynchronizer;
  private readonly taskGraph: TaskDependencyGraph;
  private readonly queryProcessor: QueryProcessor;
  
  // PROCESS-008 & PROCESS-013: Real-time streaming and interaction
  private readonly eventStream: EventStream;
  // Removed feedbackLoop - functionality simplified
  private readonly consoleOutput: ConsoleOutput;
  
  private readonly activeSessions = new Map<string, SessionExecution>();
  private executionId?: string;
  private startTime?: Date;
  private isPaused: boolean = false;

  constructor(workingDirectory?: string, enableInteractive: boolean = true) {
    super();
    
    this.sessionPool = new SessionPoolManager();
    this.contextSync = new ContextSynchronizer(workingDirectory);
    this.taskGraph = new TaskDependencyGraph();
    this.queryProcessor = new QueryProcessor();
    
    // Initialize streaming and interaction components
    this.eventStream = new EventStream();
    // Removed feedbackLoop initialization - functionality simplified
    this.consoleOutput = new ConsoleOutput();

    // Setup event handlers
    this.setupSessionPoolHandlers();
    this.setupEventStreamHandlers();
    
    if (enableInteractive) {
      this.setupInteractiveFeedbackHandlers();
    }
  }

  /**
   * Main orchestration entry point - execute user query
   */
  async executeQuery(query: string, options: Partial<ExecutionOptions> = {}): Promise<ExecutionResults> {
    this.executionId = this.generateExecutionId();
    this.startTime = new Date();
    
    try {
      // Phase 1: Query Analysis
      this.emit('phaseStarted', { phase: 'query-analysis', executionId: this.executionId });
      
      const queryAnalysis = this.queryProcessor.parseQuery(query);
      const complexity = queryAnalysis.complexity;
      const requiredAgents = queryAnalysis.requiredAgents;
      
      // For now, create simple task structure from query analysis
      // TODO: Implement proper task generation from parsed query
      const simpleTasks: TaskDefinition[] = [
        {
          id: 'task-1',
          description: query,
          agent: requiredAgents[0] || 'architect',
          dependencies: [],
          priority: 1
        }
      ];
      
      this.emit('queryAnalyzed', { 
        complexity, 
        requiredAgents, 
        taskCount: simpleTasks.length 
      });

      // Phase 2: Task Planning
      this.emit('phaseStarted', { phase: 'task-planning', executionId: this.executionId });
      
      // Add tasks to dependency graph
      for (const task of simpleTasks) {
        this.taskGraph.addTask(task);
      }
      
      // Get execution order  
      const executionOrder = this.taskGraph.topologicalSort();
      
      // Convert batches to flat task array
      const taskIds: string[] = [];
      for (const batch of executionOrder.batches) {
        taskIds.push(...batch);
      }
      
      // Create TaskExecution objects from task definitions
      const taskExecutions: TaskExecution[] = taskIds.map(taskId => {
        const taskDef = simpleTasks.find(t => t.id === taskId);
        if (!taskDef) {
          throw new Error(`Task definition not found: ${taskId}`);
        }
        
        return {
          ...taskDef,
          status: 'pending' as TaskStatus,
          progress: 0,
          logs: [],
          retryCount: 0,
          maxRetries: options.retryAttempts || 3
        };
      });

      this.emit('executionPlanReady', { 
        taskCount: taskExecutions.length,
        agentTypes: Array.from(new Set(taskExecutions.map(t => t.agent)))
      });

      // Phase 3: Context Initialization
      this.emit('phaseStarted', { phase: 'context-setup', executionId: this.executionId });
      
      await this.contextSync.initialize(this.executionId, taskExecutions);
      
      this.emit('contextInitialized', { executionId: this.executionId });

      // Phase 4: Execution Coordination
      this.emit('phaseStarted', { phase: 'execution', executionId: this.executionId });
      
      const executionResults = await this.coordinateExecution(
        taskExecutions,
        this.mergeOptions(options)
      );

      // Phase 5: Cleanup
      await this.cleanup();
      
      this.emit('executionCompleted', { 
        executionId: this.executionId,
        results: executionResults 
      });

      return executionResults;

    } catch (error) {
      this.emit('executionFailed', { 
        executionId: this.executionId, 
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Cleanup on failure
      await this.cleanup();
      
      throw error;
    }
  }

  /**
   * Coordinate parallel execution of tasks across sessions
   */
  async coordinateExecution(tasks: TaskExecution[], options: ExecutionOptions): Promise<ExecutionResults> {
    const results: ExecutionResults = {
      success: true,
      executionId: this.executionId!,
      completedTasks: [],
      failedTasks: [],
      totalDuration: 0,
      statistics: this.createInitialStatistics(tasks)
    };

    const pendingTasks = [...tasks];
    const completedTaskIds = new Set<string>();
    const failedTaskIds = new Set<string>();

    while (pendingTasks.length > 0 && !this.shouldStopExecution(results)) {
      // Find tasks ready to execute (all dependencies completed)
      const readyTasks = pendingTasks.filter(task => 
        task.dependencies.every(depId => completedTaskIds.has(depId))
      );

      if (readyTasks.length === 0) {
        // Check for deadlock
        if (this.activeSessions.size === 0) {
          throw new Error('Execution deadlock: no tasks ready and no active sessions');
        }
        
        // Wait for at least one session to complete
        await this.waitForSessionCompletion();
        continue;
      }

      // Limit concurrency
      const availableSlots = Math.min(
        options.maxConcurrency - this.activeSessions.size,
        readyTasks.length
      );

      // Start execution for ready tasks
      const tasksToStart = readyTasks.slice(0, availableSlots);
      
      for (const task of tasksToStart) {
        try {
          await this.startTaskExecution(task, options);
          
          // Remove from pending
          const taskIndex = pendingTasks.indexOf(task);
          if (taskIndex !== -1) {
            pendingTasks.splice(taskIndex, 1);
          }
        } catch (error) {
          this.emit('taskStartFailed', { 
            taskId: task.id, 
            error: error instanceof Error ? error.message : String(error)
          });
          
          failedTaskIds.add(task.id);
          results.failedTasks.push({
            taskId: task.id,
            agentType: task.agent,
            error: error instanceof Error ? error.message : String(error),
            duration: 0,
            timestamp: new Date()
          });
          
          // Remove from pending
          const taskIndex = pendingTasks.indexOf(task);
          if (taskIndex !== -1) {
            pendingTasks.splice(taskIndex, 1);
          }
        }
      }

      // Wait for completion if no slots available
      if (this.activeSessions.size >= options.maxConcurrency) {
        const sessionResult = await this.waitForSessionCompletion();
        
        if (sessionResult.status === 'completed') {
          completedTaskIds.add(sessionResult.task.id);
          results.completedTasks.push({
            taskId: sessionResult.task.id,
            agentType: sessionResult.task.agent,
            result: sessionResult.result,
            duration: Date.now() - sessionResult.startTime.getTime(),
            timestamp: new Date()
          });
        } else {
          failedTaskIds.add(sessionResult.task.id);
          results.failedTasks.push({
            taskId: sessionResult.task.id,
            agentType: sessionResult.task.agent,
            error: sessionResult.error || 'Unknown error',
            duration: Date.now() - sessionResult.startTime.getTime(),
            timestamp: new Date()
          });
        }
      }
    }

    // Wait for all remaining sessions to complete
    await this.waitForCompletion();

    // Update final results
    results.totalDuration = Date.now() - this.startTime!.getTime();
    results.success = results.failedTasks.length === 0;
    results.statistics = this.calculateFinalStatistics(results);

    return results;
  }

  /**
   * Wait for all active sessions to complete
   */
  async waitForCompletion(): Promise<void> {
    while (this.activeSessions.size > 0) {
      await this.waitForSessionCompletion();
    }
  }

  /**
   * Get current execution statistics
   */
  getStatistics(): ExecutionStatistics {
    const now = Date.now();
    const duration = this.startTime ? (now - this.startTime.getTime()) : 0;
    
    let completedTasks = 0;
    let failedTasks = 0;
    let totalTaskTime = 0;

    this.activeSessions.forEach((execution) => {
      if (execution.status === 'completed') {
        completedTasks++;
        totalTaskTime += now - execution.startTime.getTime();
      } else if (execution.status === 'failed') {
        failedTasks++;
      }
    });

    return {
      totalTasks: this.activeSessions.size + completedTasks + failedTasks,
      completedTasks,
      failedTasks,
      activeSessions: this.activeSessions.size,
      startTime: this.startTime || new Date(),
      duration,
      totalCost: 0, // TODO: Implement cost tracking
      averageTaskTime: completedTasks > 0 ? totalTaskTime / completedTasks : 0
    };
  }

  /**
   * Shutdown all sessions and cleanup resources
   */
  async shutdown(): Promise<void> {
    // Cancel all active sessions
    this.activeSessions.forEach((execution, sessionId) => {
      try {
        this.sessionPool.terminateSession(sessionId);
      } catch (error) {
        // Session might already be terminated
      }
    });
    
    this.activeSessions.clear();

    // Shutdown components
    await Promise.all([
      this.sessionPool.shutdown(),
      this.contextSync.cleanup()
    ]);

    this.emit('shutdown');
  }

  // Private methods

  private async startTaskExecution(task: TaskExecution, options: ExecutionOptions): Promise<void> {
    // Get session for agent type
    const session = await this.sessionPool.getAvailableSession(task.agent, task.id);
    
    // Create session execution tracking
    const sessionExecution: SessionExecution = {
      session,
      task,
      startTime: new Date(),
      status: 'running'
    };
    
    this.activeSessions.set(session.id, sessionExecution);
    
    // Get agent-specific context
    const agentContext = await this.contextSync.getAgentContext(task.agent);
    
    // Add progress update
    await this.contextSync.addProgressUpdate({
      taskId: task.id,
      agentType: task.agent,
      status: 'started',
      timestamp: new Date(),
      message: `Starting task: ${task.description}`
    });
    
    this.emit('taskStarted', { 
      taskId: task.id, 
      agentType: task.agent,
      sessionId: session.id 
    });

    // Send task context to Claude session
    const taskPrompt = this.buildTaskPrompt(task, agentContext);
    
    if (session.process.stdin) {
      session.process.stdin.write(taskPrompt);
      session.process.stdin.end();
    }

    // Set up task timeout
    setTimeout(() => {
      const execution = this.activeSessions.get(session.id);
      if (execution && execution.status === 'running') {
        this.handleSessionTimeout(session.id);
      }
    }, options.timeout);
  }

  private buildTaskPrompt(task: TaskExecution, context: AgentExecutionContext): string {
    return `
# Task Execution Context

## Task Details
- **ID**: ${task.id}
- **Description**: ${task.description}
- **Agent Type**: ${task.agent}
- **Priority**: ${task.priority}

## Dependencies
${task.dependencies.length > 0 ? task.dependencies.map(dep => `- ${dep}`).join('\n') : 'None'}

## Repository Context
- **Root Path**: ${context.repositoryContext.rootPath}
- **Execution ID**: ${context.executionId}

## Other Active Agents
${context.otherAgents.map(agent => `- ${agent}`).join('\n')}

## Instructions
Execute this task according to your agent specialization. 
Communicate progress and coordinate with other agents as needed.
Use the shared context files for coordination.

---
Please execute the task now.
`;
  }

  private async waitForSessionCompletion(): Promise<SessionExecution> {
    return new Promise((resolve) => {
      const checkForCompletion = () => {
        let foundCompletion = false;
        this.activeSessions.forEach((execution, sessionId) => {
          if (execution.status !== 'running' && !foundCompletion) {
            this.activeSessions.delete(sessionId);
            this.sessionPool.releaseSession(sessionId, execution.status === 'completed');
            foundCompletion = true;
            resolve(execution);
            return;
          }
        });
        
        if (!foundCompletion) {
          // No completed sessions yet, check again soon
          setTimeout(checkForCompletion, 1000);
        }
      };
      
      checkForCompletion();
    });
  }

  private setupSessionPoolHandlers(): void {
    this.sessionPool.on('sessionOutput', ({ sessionId, data }) => {
      const execution = this.activeSessions.get(sessionId);
      if (execution) {
        this.emit('sessionOutput', { taskId: execution.task.id, data });
      }
    });

    this.sessionPool.on('sessionError', ({ sessionId, error }) => {
      const execution = this.activeSessions.get(sessionId);
      if (execution) {
        execution.status = 'failed';
        execution.error = error;
        this.emit('sessionError', { taskId: execution.task.id, error });
      }
    });

    this.sessionPool.on('sessionExit', ({ sessionId, code }) => {
      const execution = this.activeSessions.get(sessionId);
      if (execution && execution.status === 'running') {
        execution.status = code === 0 ? 'completed' : 'failed';
        this.emit('sessionExit', { taskId: execution.task.id, code });
      }
    });
  }

  private handleSessionTimeout(sessionId: string): void {
    const execution = this.activeSessions.get(sessionId);
    if (execution) {
      execution.status = 'failed';
      execution.error = 'Task timeout';
      
      this.sessionPool.terminateSession(sessionId);
      this.emit('sessionTimeout', { taskId: execution.task.id });
    }
  }

  private mergeOptions(options: Partial<ExecutionOptions>): ExecutionOptions {
    return {
      mode: options.mode || 'adaptive',
      maxConcurrency: options.maxConcurrency || 3,
      timeout: options.timeout || 300000, // 5 minutes
      retryAttempts: options.retryAttempts || 3,
      workingDirectory: options.workingDirectory || process.cwd()
    };
  }

  private shouldStopExecution(results: ExecutionResults): boolean {
    // Stop if too many failures
    const failureRate = results.failedTasks.length / (results.completedTasks.length + results.failedTasks.length);
    return failureRate > 0.5;
  }

  private createInitialStatistics(tasks: TaskExecution[]): ExecutionStatistics {
    return {
      totalTasks: tasks.length,
      completedTasks: 0,
      failedTasks: 0,
      activeSessions: 0,
      startTime: this.startTime || new Date(),
      duration: 0,
      totalCost: 0,
      averageTaskTime: 0
    };
  }

  private calculateFinalStatistics(results: ExecutionResults): ExecutionStatistics {
    const totalTasks = results.completedTasks.length + results.failedTasks.length;
    const totalTaskTime = results.completedTasks.reduce((sum, task) => sum + task.duration, 0);
    
    return {
      totalTasks,
      completedTasks: results.completedTasks.length,
      failedTasks: results.failedTasks.length,
      activeSessions: 0,
      startTime: this.startTime || new Date(),
      duration: results.totalDuration,
      totalCost: 0, // TODO: Implement cost calculation
      averageTaskTime: results.completedTasks.length > 0 ? totalTaskTime / results.completedTasks.length : 0
    };
  }

  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Setup event stream handlers for real-time orchestration updates
   */
  private setupEventStreamHandlers(): void {
    // Handle task events
    this.eventStream.on('task.started', (event) => {
      this.consoleOutput.streamAgentActivity(
        event.agent, 
        event.data.message || 'Starting task', 
        'starting'
      );
    });

    this.eventStream.on('task.progress', (event) => {
      if (typeof event.data.progress === 'number') {
        this.consoleOutput.streamTaskProgress(
          event.taskId,
          event.agent,
          event.data.progress,
          event.data.message
        );
      }
    });

    this.eventStream.on('task.completed', (event) => {
      this.consoleOutput.streamAgentActivity(
        event.agent,
        event.data.message || 'Task completed',
        'completed'
      );
    });

    this.eventStream.on('task.failed', (event) => {
      this.consoleOutput.streamAgentActivity(
        event.agent,
        event.data.error || 'Task failed',
        'failed'
      );
    });

    // Handle system events
    this.eventStream.on('system.phase', (event) => {
      this.consoleOutput.streamSystemEvent('coordination', event.data.message || 'Phase change');
    });

    // Handle agent communication
    this.eventStream.on('agent.message', (event) => {
      if (event.data.recipient) {
        this.consoleOutput.streamAgentMessage(
          event.agent,
          event.data.recipient,
          event.data.message || 'Message'
        );
      }
    });
  }

  /**
   * Setup interactive feedback handlers (SIMPLIFIED - removed feedback loop)
   */
  private setupInteractiveFeedbackHandlers(): void {
    // Interactive feedback system has been simplified
    // Core functionality moved to direct method calls
  }

  /**
   * Pause all active sessions
   */
  private pauseAllSessions(): void {
    // TODO: Implement session pause mechanism
    this.consoleOutput.streamSystemEvent('coordination', 'Pausing all active sessions');
  }

  /**
   * Resume all paused sessions
   */
  private resumeAllSessions(): void {
    // TODO: Implement session resume mechanism
    this.consoleOutput.streamSystemEvent('coordination', 'Resuming all sessions');
  }

  /**
   * Process user feedback and modify execution
   */
  private processFeedback(feedback: any): void {
    switch (feedback.action) {
      case 'modify_task':
        this.consoleOutput.streamSystemEvent('coordination', `Modifying task based on feedback: ${feedback.details}`);
        // TODO: Implement task modification
        break;
      case 'add_requirement':
        this.consoleOutput.streamSystemEvent('coordination', `Adding requirement: ${feedback.details}`);
        // TODO: Implement requirement addition
        break;
      case 'change_focus':
        this.consoleOutput.streamSystemEvent('coordination', `Changing focus: ${feedback.details}`);
        // TODO: Implement focus change
        break;
      case 'stop_agent':
        if (feedback.targetAgent) {
          this.consoleOutput.streamSystemEvent('coordination', `Stopping agent: ${feedback.targetAgent}`);
          // TODO: Stop specific agent
        }
        break;
      case 'restart_plan':
        this.consoleOutput.streamSystemEvent('coordination', 'Restarting execution plan');
        // TODO: Implement plan restart
        break;
      default:
        this.consoleOutput.streamSystemEvent('coordination', 'Continuing execution');
    }
  }

  /**
   * Recalibrate all agents based on current state
   */
  private recalibrateAgents(): void {
    this.consoleOutput.streamSystemEvent('coordination', 'Recalibrating all agents');
    // TODO: Implement agent recalibration
    // This should redistribute tasks, update priorities, and adjust execution strategy
    setTimeout(() => {
      // Recalibration complete - feedback loop removed
    }, 2000);
  }

  /**
   * Emergency stop with context preservation
   */
  private async emergencyStop(): Promise<void> {
    this.consoleOutput.streamSystemEvent('coordination', 'Emergency stop initiated');
    
    // Preserve current state
    const currentState = {
      activeSessions: Array.from(this.activeSessions.keys()),
      statistics: this.getStatistics(),
      timestamp: new Date()
    };
    
    // TODO: Save state to disk for recovery
    
    // Stop all sessions gracefully
    await this.shutdown();
  }

  /**
   * Graceful shutdown with cleanup
   */
  private async gracefulShutdown(): Promise<void> {
    this.consoleOutput.streamSystemEvent('coordination', 'Graceful shutdown initiated');
    
    // Allow current tasks to complete with timeout
    const shutdownTimeout = setTimeout(async () => {
      await this.shutdown();
    }, 10000); // 10 second timeout
    
    try {
      await this.waitForCompletion();
      clearTimeout(shutdownTimeout);
      await this.shutdown();
    } catch (error) {
      clearTimeout(shutdownTimeout);
      await this.shutdown();
    }
  }

  private async cleanup(): Promise<void> {
    try {
      // Cleanup event stream
      if (this.eventStream) {
        this.eventStream.stopStreaming();
      }
      
      // Feedback loop removed - simplified architecture
      
      // Context cleanup is handled by shutdown
    } catch (error) {
      this.emit('cleanupError', error);
    }
  }
}