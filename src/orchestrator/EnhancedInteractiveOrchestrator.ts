/**
 * Enhanced Interactive Orchestrator - Phase 2 Integration
 * 
 * Integrates the new Enhanced UX Phase 2 components with existing orchestration logic.
 * This extends the current InteractiveOrchestrator with split-screen capabilities.
 */

import { EventEmitter } from 'events';
import { RealTimeExecutor } from './RealTimeExecutor.js';
import { TaskPlanner } from './TaskPlanner.js';
import { SplitScreenInterface, ExecutionEvent, SplitScreenConfig } from '../ui/split-screen/SplitScreenInterface.js';
import { InputSubmissionEvent, InputContext } from '../console/EnhancedInputHandler.js';
import { TaskDecomposition } from '../ui/split-screen/ApprovalWorkflowPanel.js';
import { AgentStatus } from '../ui/split-screen/StreamingOutputPanel.js';

export interface EnhancedSession {
  id: string;
  startTime: Date;
  queryCount: number;
  totalTokens: number;
  isActive: boolean;
  mode: 'standard' | 'split-screen';
  repositoryContext?: any;
}

export interface ExecutionContext {
  workingDirectory: string;
  repositoryContext?: any;
  availableAgents: any[];
  sessionId: string;
}

export class EnhancedInteractiveOrchestrator extends EventEmitter {
  private realTimeExecutor: RealTimeExecutor;
  private taskPlanner: TaskPlanner;
  private splitScreenInterface?: SplitScreenInterface;
  
  // Session management
  private currentSession?: EnhancedSession;
  private isExecuting = false;
  private executionQueue: string[] = [];
  
  // Configuration
  private useSplitScreen = true;
  
  constructor() {
    super();
    
    this.realTimeExecutor = new RealTimeExecutor();
    this.taskPlanner = new TaskPlanner();
    
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for coordination
   */
  private setupEventHandlers(): void {
    // Real-time executor events
    this.realTimeExecutor.on('agentResponse', (data) => {
      this.handleAgentResponse(data);
    });

    this.realTimeExecutor.on('executionComplete', (data) => {
      this.handleExecutionComplete(data);
    });

    this.realTimeExecutor.on('executionError', (error) => {
      this.handleExecutionError(error);
    });

    this.realTimeExecutor.on('agentStatusUpdate', (data) => {
      this.handleAgentStatusUpdate(data);
    });
  }

  /**
   * Start interactive session with enhanced UX
   */
  async startInteractive(options: { splitScreen?: boolean } = {}): Promise<void> {
    this.useSplitScreen = options.splitScreen ?? true;
    
    // Create session
    this.currentSession = {
      id: `session-${Date.now()}`,
      startTime: new Date(),
      queryCount: 0,
      totalTokens: 0,
      isActive: true,
      mode: this.useSplitScreen ? 'split-screen' : 'standard'
    };

    if (this.useSplitScreen) {
      await this.initializeSplitScreenInterface();
    } else {
      await this.initializeStandardInterface();
    }

    this.emit('sessionStarted', this.currentSession);
  }

  /**
   * Initialize split-screen interface
   */
  private async initializeSplitScreenInterface(): Promise<void> {
    const config: SplitScreenConfig = {
      terminalDimensions: {
        width: process.stdout.columns || 80,
        height: process.stdout.rows || 24
      },
      enableExitProtection: true,
      enableRepositoryContext: true,
      enableAnimation: true,
      updateInterval: 16 // 60 FPS
    };

    this.splitScreenInterface = new SplitScreenInterface(config);
    
    // Setup split-screen event handlers
    this.setupSplitScreenHandlers();
    
    // Initialize and start interface
    await this.splitScreenInterface.initialize();
    await this.splitScreenInterface.startInterface();
  }

  /**
   * Setup split-screen interface event handlers
   */
  private setupSplitScreenHandlers(): void {
    if (!this.splitScreenInterface) {
      return;
    }

    // User input handling
    this.splitScreenInterface.on('userInput', (event: InputSubmissionEvent) => {
      this.handleUserInput(event);
    });

    // Task approval handling
    this.splitScreenInterface.on('allTasksApproved', (taskIds: string[]) => {
      this.handleTasksApproved(taskIds);
    });

    // Execution control
    this.splitScreenInterface.on('cancelExecution', () => {
      this.cancelExecution();
    });

    this.splitScreenInterface.on('modifyExecutionPlan', () => {
      this.emit('modifyExecutionPlan');
    });

    this.splitScreenInterface.on('provideFeedback', () => {
      this.emit('provideFeedback');
    });

    // Exit handling
    this.splitScreenInterface.on('exitRequested', () => {
      this.handleExitRequest();
    });

    // Repository context updates
    this.splitScreenInterface.on('repositoryContextUpdated', (event) => {
      this.handleRepositoryContextUpdate(event);
    });
  }

  /**
   * Initialize standard (non-split-screen) interface
   */
  private async initializeStandardInterface(): Promise<void> {
    // Fallback to existing interface logic
    console.log('🎯 Starting Graphyn CLI in standard mode...');
    console.log('💡 Use --split-screen flag for enhanced UI experience');
  }

  /**
   * Handle user input from split-screen interface
   */
  private async handleUserInput(event: InputSubmissionEvent): Promise<void> {
    if (this.isExecuting) {
      // Queue input during execution
      this.executionQueue.push(event.content);
      return;
    }

    if (!this.currentSession) {
      return;
    }

    // Update session stats
    this.currentSession.queryCount++;

    // Process the query
    await this.executeQuery(event.content);
  }

  /**
   * Execute user query with enhanced workflow
   */
  private async executeQuery(query: string): Promise<void> {
    if (!this.splitScreenInterface || !this.currentSession) {
      return;
    }

    this.isExecuting = true;

    try {
      // Step 1: Generate task decomposition
      const context: ExecutionContext = {
        workingDirectory: process.cwd(),
        availableAgents: await this.taskPlanner.getAvailableAgents(),
        sessionId: this.currentSession.id
      };

      const decomposition = await this.taskPlanner.decomposeQuery(query, context);
      
      // Step 2: Show task decomposition in UI
      this.splitScreenInterface.handleExecutionEvent({
        type: 'task_decomposition',
        data: decomposition,
        timestamp: new Date(),
        source: 'task-planner'
      });

      // Step 3: Request approval
      this.splitScreenInterface.handleExecutionEvent({
        type: 'approval_required',
        data: decomposition,
        timestamp: new Date(),
        source: 'system'
      });

      // Wait for user approval (handled by event system)

    } catch (error) {
      console.error('Error executing query:', error);
      this.splitScreenInterface.handleExecutionEvent({
        type: 'execution_error',
        data: { message: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date(),
        source: 'system'
      });
      
      this.isExecuting = false;
    }
  }

  /**
   * Handle tasks approved by user
   */
  private async handleTasksApproved(taskIds: string[]): Promise<void> {
    if (!this.splitScreenInterface) {
      return;
    }

    try {
      // Start execution of approved tasks
      for await (const event of this.executeApprovedTasks(taskIds)) {
        this.splitScreenInterface.handleExecutionEvent(event);
      }

    } catch (error) {
      console.error('Error executing approved tasks:', error);
      this.splitScreenInterface.handleExecutionEvent({
        type: 'execution_error',
        data: { message: error instanceof Error ? error.message : 'Execution failed' },
        timestamp: new Date(),
        source: 'executor'
      });
    } finally {
      this.isExecuting = false;
      
      // Process any queued inputs
      if (this.executionQueue.length > 0) {
        const nextQuery = this.executionQueue.shift()!;
        await this.executeQuery(nextQuery);
      }
    }
  }

  /**
   * Execute approved tasks using the real-time executor
   */
  private async *executeApprovedTasks(taskIds: string[]): AsyncGenerator<ExecutionEvent> {
    // This is a simplified implementation
    // In the real system, this would coordinate with the RealTimeExecutor
    
    yield {
      type: 'execution_started',
      data: { taskIds },
      timestamp: new Date(),
      source: 'executor'
    };

    // Simulate task execution
    for (const taskId of taskIds) {
      yield {
        type: 'task_started',
        data: { taskId, agentName: 'backend' },
        timestamp: new Date(),
        source: 'executor'
      };

      // Simulate agent work
      await this.simulateAgentWork(taskId);

      yield {
        type: 'task_completed',
        data: { taskId },
        timestamp: new Date(),
        source: 'executor'
      };
    }

    yield {
      type: 'execution_complete',
      data: { completedTasks: taskIds },
      timestamp: new Date(),
      source: 'executor'
    };
  }

  /**
   * Simulate agent work (replace with real execution)
   */
  private async simulateAgentWork(taskId: string): Promise<void> {
    return new Promise(resolve => {
      setTimeout(() => {
        if (this.splitScreenInterface) {
          this.splitScreenInterface.handleExecutionEvent({
            type: 'agent_response',
            data: {
              agentName: 'backend',
              content: `Completed task: ${taskId}`,
              taskId
            },
            timestamp: new Date(),
            source: 'backend-agent'
          });
        }
        resolve();
      }, 2000); // 2 second simulation
    });
  }

  /**
   * Handle agent response from real-time executor
   */
  private handleAgentResponse(data: any): void {
    if (this.splitScreenInterface) {
      this.splitScreenInterface.handleExecutionEvent({
        type: 'agent_response',
        data,
        timestamp: new Date(),
        source: data.agentName || 'agent'
      });
    }
  }

  /**
   * Handle execution completion
   */
  private handleExecutionComplete(data: any): void {
    this.isExecuting = false;
    
    if (this.splitScreenInterface) {
      this.splitScreenInterface.handleExecutionEvent({
        type: 'execution_complete',
        data,
        timestamp: new Date(),
        source: 'executor'
      });
    }

    this.emit('executionComplete', data);
  }

  /**
   * Handle execution errors
   */
  private handleExecutionError(error: any): void {
    this.isExecuting = false;
    
    if (this.splitScreenInterface) {
      this.splitScreenInterface.handleExecutionEvent({
        type: 'execution_error',
        data: error,
        timestamp: new Date(),
        source: 'executor'
      });
    }

    this.emit('executionError', error);
  }

  /**
   * Handle agent status updates
   */
  private handleAgentStatusUpdate(data: { agentName: string; status: AgentStatus }): void {
    if (this.splitScreenInterface) {
      this.splitScreenInterface.updateAgentStatus(data.agentName, data.status);
    }
  }

  /**
   * Cancel current execution
   */
  private async cancelExecution(): Promise<void> {
    if (this.isExecuting) {
      // Stop real-time executor
      await this.realTimeExecutor.stop();
      this.isExecuting = false;
      
      if (this.splitScreenInterface) {
        this.splitScreenInterface.handleExecutionEvent({
          type: 'execution_cancelled',
          data: {},
          timestamp: new Date(),
          source: 'user'
        });
      }
    }
  }

  /**
   * Handle repository context updates
   */
  private handleRepositoryContextUpdate(event: any): void {
    if (this.currentSession) {
      this.currentSession.repositoryContext = event.context;
    }
    
    this.emit('repositoryContextUpdated', event);
  }

  /**
   * Handle exit request
   */
  private async handleExitRequest(): Promise<void> {
    await this.cleanup();
    process.exit(0);
  }

  /**
   * Get current session information
   */
  getCurrentSession(): EnhancedSession | undefined {
    return this.currentSession;
  }

  /**
   * Check if orchestrator is currently executing
   */
  isCurrentlyExecuting(): boolean {
    return this.isExecuting;
  }

  /**
   * Force enable/disable split-screen mode
   */
  setSplitScreenMode(enabled: boolean): void {
    this.useSplitScreen = enabled;
  }

  /**
   * Get current split-screen interface state
   */
  getSplitScreenState() {
    return this.splitScreenInterface?.getState();
  }

  /**
   * Add output to split-screen interface
   */
  addOutput(content: string, source: string = 'system', type: 'text' | 'error' | 'success' = 'text'): void {
    if (this.splitScreenInterface) {
      this.splitScreenInterface.addOutput({
        id: `output-${Date.now()}`,
        source,
        content,
        timestamp: new Date(),
        type
      });
    }
  }

  /**
   * Clean shutdown
   */
  async cleanup(): Promise<void> {
    if (this.currentSession) {
      this.currentSession.isActive = false;
    }

    if (this.splitScreenInterface) {
      await this.splitScreenInterface.cleanup();
    }

    // Stop real-time executor
    await this.realTimeExecutor.stop();

    this.removeAllListeners();
    this.emit('cleaned');
  }
}