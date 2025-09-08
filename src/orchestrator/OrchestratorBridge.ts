/**
 * Orchestrator Bridge - Connects orchestrator backend to Ink UI frontend
 * 
 * This bridge allows the orchestrator system to work seamlessly with existing
 * Ink.js React components while preserving all UI investment.
 */

import { EventEmitter } from 'events';
import { RealTimeExecutor } from './RealTimeExecutor.js';
import { ConsoleOutput } from '../console/ConsoleOutput.js';

export interface BridgeEvent {
  type: 'agent_start' | 'agent_progress' | 'agent_complete' | 'task_complete' | 'error';
  agent?: string;
  message?: string;
  data?: any;
  timestamp: number;
}

export interface ExecutionState {
  isRunning: boolean;
  currentAgent?: string;
  currentTask?: string;
  progress: number;
  completedTasks: string[];
  failedTasks: string[];
  activeAgents: string[];
}

/**
 * Bridge between orchestrator backend and Ink UI components
 */
export class OrchestratorBridge extends EventEmitter {
  private realTimeExecutor: RealTimeExecutor;
  private consoleOutput: ConsoleOutput;
  private executionState: ExecutionState;
  private isInkUIMode: boolean = false;

  constructor() {
    super();
    this.realTimeExecutor = new RealTimeExecutor();
    this.consoleOutput = new ConsoleOutput();
    this.executionState = {
      isRunning: false,
      progress: 0,
      completedTasks: [],
      failedTasks: [],
      activeAgents: []
    };
    
    this.setupEventHandlers();
  }

  /**
   * Initialize the bridge and executor
   */
  async initialize(): Promise<void> {
    await this.realTimeExecutor.initialize();
  }

  /**
   * Enable Ink UI mode - streams events to UI components
   */
  enableInkUIMode(): void {
    this.isInkUIMode = true;
    this.emit('ui_mode_enabled');
  }

  /**
   * Disable Ink UI mode - falls back to console output
   */
  disableInkUIMode(): void {
    this.isInkUIMode = false;
    this.emit('ui_mode_disabled');
  }

  /**
   * Execute query with UI streaming support
   */
  async executeQuery(
    query: string, 
    options?: { workingDirectory?: string }
  ): Promise<any> {
    try {
      // Update state
      this.executionState.isRunning = true;
      this.executionState.progress = 0;
      this.executionState.completedTasks = [];
      this.executionState.failedTasks = [];
      this.executionState.activeAgents = [];
      this.executionState.currentTask = query;

      // Emit start event
      this.emitBridgeEvent({
        type: 'agent_start',
        message: `Processing: "${query}"`,
        data: { query, options },
        timestamp: Date.now()
      });

      // Execute through real-time executor
      const executionContext = {
        workingDirectory: options?.workingDirectory || process.cwd()
      };
      const result = await this.realTimeExecutor.executeQuery(query, executionContext);

      // Update final state
      this.executionState.isRunning = false;
      this.executionState.progress = 100;
      this.executionState.completedTasks = result.completedTasks.map((t: any) => t.result || t.output || 'Task completed');
      this.executionState.failedTasks = result.failedTasks.map((t: any) => t.error || 'Task failed');

      // Emit completion event
      this.emitBridgeEvent({
        type: 'task_complete',
        message: `Completed with ${result.completedTasks.length}/${result.completedTasks.length + result.failedTasks.length} tasks`,
        data: result,
        timestamp: Date.now()
      });

      return result;

    } catch (error) {
      this.executionState.isRunning = false;
      
      this.emitBridgeEvent({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
        data: { error },
        timestamp: Date.now()
      });
      
      throw error;
    }
  }

  /**
   * Get current execution state for UI components
   */
  getExecutionState(): ExecutionState {
    return { ...this.executionState };
  }

  /**
   * Setup event handlers from the executor
   */
  private setupEventHandlers(): void {
    // Listen to console output events if available
    if (typeof (this.consoleOutput as any).on === 'function') {
      (this.consoleOutput as any).on('agent_activity', (data: any) => {
        if (this.isInkUIMode) {
          this.emitBridgeEvent({
            type: 'agent_progress',
            agent: data.agent,
            message: data.message,
            data,
            timestamp: Date.now()
          });
        }
      });
    }

    // Listen to executor events if available
    this.realTimeExecutor.on?.('task_progress', (data: any) => {
      if (this.isInkUIMode) {
        this.executionState.progress = Math.min(100, (data.completed || 0) * 10);
        
        this.emitBridgeEvent({
          type: 'agent_progress',
          message: data.message || 'Processing...',
          data,
          timestamp: Date.now()
        });
      }
    });
  }

  /**
   * Emit bridge event to UI components
   */
  private emitBridgeEvent(event: BridgeEvent): void {
    if (this.isInkUIMode) {
      this.emit('bridge_event', event);
      this.emit(event.type, event);
    }
  }

  /**
   * Create adapter for Ink UI components
   */
  createInkUIAdapter(): any {
    return {
      // State getters for React components
      getExecutionState: () => this.getExecutionState(),
      
      // Event subscription for React hooks
      subscribe: (callback: (event: BridgeEvent) => void) => {
        this.on('bridge_event', callback);
        return () => this.off('bridge_event', callback);
      },
      
      // Control methods
      executeQuery: (query: string) => this.executeQuery(query),
      enableUIMode: () => this.enableInkUIMode(),
      disableUIMode: () => this.disableInkUIMode(),
      
      // Helper methods for UI
      isRunning: () => this.executionState.isRunning,
      getProgress: () => this.executionState.progress,
      getCompletedTasks: () => this.executionState.completedTasks,
      getFailedTasks: () => this.executionState.failedTasks
    };
  }

  /**
   * Get available agents for UI display
   */
  async getAvailableAgents(): Promise<string[]> {
    // Get agents from the executor's orchestrator
    try {
      return this.realTimeExecutor.getAvailableAgents?.() || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.removeAllListeners();
    await this.realTimeExecutor.cleanup?.();
  }
}

/**
 * Global bridge instance for easy access
 */
export const orchestratorBridge = new OrchestratorBridge();