/**
 * Exit Protection Service - Graceful Shutdown Logic
 * 
 * Extracted from UI-based ExitProtectionHandler to preserve critical
 * signal handling and graceful shutdown logic without terminal UI.
 */

import { EventEmitter } from 'events';

export enum ExitState {
  NORMAL = 'normal',
  CONFIRMATION_PENDING = 'confirmation_pending', 
  EXECUTING = 'executing',
  FORCE_EXIT = 'force_exit'
}

export interface ExitConfiguration {
  confirmationTimeout: number;          // Time in ms before auto-cancel
  forceExitKeySequence: string[];      // Key sequence for force exit
  saveStateOnExit: boolean;            // Whether to save session state
  executionProtection: boolean;        // Whether to protect active executions
  warningThreshold: number;            // Min execution time to warn (ms)
}

export interface ExitContext {
  isExecuting: boolean;
  activeAgents: string[];
  executionStartTime?: Date;
  estimatedTimeRemaining?: number;
  hasUnsavedWork: boolean;
  currentTasks: ActiveTask[];
}

export interface ActiveTask {
  id: string;
  agentName: string;
  description: string;
  progress: number;
  estimatedTimeRemaining: number;
}

export interface ExitAttemptEvent {
  timestamp: Date;
  state: ExitState;
  context: ExitContext;
  userAction: 'interrupt' | 'force' | 'cancel' | 'timeout';
}

export class ExitProtectionService extends EventEmitter {
  private exitState: ExitState = ExitState.NORMAL;
  private exitTimer?: NodeJS.Timeout;
  private configuration: ExitConfiguration;
  private currentContext: ExitContext = {
    isExecuting: false,
    activeAgents: [],
    hasUnsavedWork: false,
    currentTasks: []
  };
  
  // State management
  private exitAttempts: ExitAttemptEvent[] = [];
  private lastExitAttempt?: Date;

  constructor(config: Partial<ExitConfiguration> = {}) {
    super();
    
    this.configuration = {
      confirmationTimeout: 5000,
      forceExitKeySequence: ['ctrl+c', 'ctrl+c'],
      saveStateOnExit: true,
      executionProtection: true,
      warningThreshold: 10000, // 10 seconds
      ...config
    };
    
    this.setupGlobalExitHandling();
  }

  /**
   * Setup global exit signal handling
   */
  private setupGlobalExitHandling(): void {
    // Handle SIGINT (Ctrl+C)
    process.removeAllListeners('SIGINT');
    process.on('SIGINT', async () => {
      await this.handleInterruptSignal();
    });

    // Handle SIGTERM (graceful shutdown)
    process.removeAllListeners('SIGTERM');
    process.on('SIGTERM', async () => {
      await this.handleTerminateSignal();
    });

    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (error) => {
      this.handleEmergencyExit(error);
    });

    process.on('unhandledRejection', (reason) => {
      this.handleEmergencyExit(new Error(`Unhandled rejection: ${reason}`));
    });
  }

  /**
   * Handle interrupt signal (Ctrl+C)
   */
  private async handleInterruptSignal(): Promise<void> {
    const shouldExit = await this.handleExitRequest('interrupt');
    
    if (shouldExit) {
      await this.performGracefulShutdown();
      process.exit(0);
    }
  }

  /**
   * Handle terminate signal
   */
  private async handleTerminateSignal(): Promise<void> {
    // SIGTERM should always exit, but gracefully
    await this.performGracefulShutdown();
    process.exit(0);
  }

  /**
   * Handle emergency exit scenarios
   */
  private handleEmergencyExit(error: Error): void {
    console.error('\n=¨ Emergency exit triggered:', error.message);
    
    // Try to save state quickly
    try {
      this.quickSaveState();
    } catch (saveError) {
      console.error('Failed to save state during emergency exit:', saveError);
    }
    
    // Exit immediately
    process.exit(1);
  }

  /**
   * Main exit request handler with state machine logic
   */
  async handleExitRequest(trigger: 'interrupt' | 'force' | 'user' = 'user'): Promise<boolean> {
    const now = new Date();
    const timeSinceLastAttempt = this.lastExitAttempt 
      ? now.getTime() - this.lastExitAttempt.getTime()
      : Infinity;
    
    // Handle rapid succession exits (force exit pattern)
    if (trigger === 'interrupt' && timeSinceLastAttempt < 1000) {
      return this.handleForceExitRequest();
    }
    
    this.lastExitAttempt = now;
    
    // For CLI orchestrator, if we're executing, show a simple confirmation
    if (this.currentContext.isExecuting && this.currentContext.activeAgents.length > 0) {
      console.log('\n   Active agents are running. Press Ctrl+C again to force exit, or wait for completion.');
      return false;
    }
    
    // If not executing or simple mode, allow immediate exit
    return true;
  }

  /**
   * Handle force exit request (multiple rapid Ctrl+C)
   */
  private handleForceExitRequest(): boolean {
    this.exitState = ExitState.FORCE_EXIT;
    
    console.log('\n=¨ Force exit requested. Shutting down...');
    
    return true; // Allow immediate exit
  }

  /**
   * Update execution context
   */
  updateExecutionContext(context: Partial<ExitContext>): void {
    this.currentContext = { ...this.currentContext, ...context };
    
    // Update exit state based on context
    if (context.isExecuting && this.currentContext.activeAgents.length > 0) {
      if (this.exitState === ExitState.NORMAL) {
        this.exitState = ExitState.EXECUTING;
      }
    } else if (!context.isExecuting && this.exitState === ExitState.EXECUTING) {
      this.exitState = ExitState.NORMAL;
    }
  }

  /**
   * Record exit attempt for analytics
   */
  private recordExitAttempt(userAction: ExitAttemptEvent['userAction'], context: ExitContext): void {
    const event: ExitAttemptEvent = {
      timestamp: new Date(),
      state: this.exitState,
      context: { ...context },
      userAction
    };
    
    this.exitAttempts.push(event);
    
    // Maintain reasonable history size
    if (this.exitAttempts.length > 10) {
      this.exitAttempts = this.exitAttempts.slice(-10);
    }
    
    this.emit('exitAttemptRecorded', event);
  }

  /**
   * Perform graceful shutdown
   */
  private async performGracefulShutdown(): Promise<void> {
    this.emit('shutdownStarted', this.currentContext);
    
    try {
      // Save session state if enabled
      if (this.configuration.saveStateOnExit) {
        await this.saveSessionState();
      }
      
      // Stop executing processes gracefully
      if (this.currentContext.isExecuting) {
        await this.gracefullyStopExecution();
      }
      
      console.log('\n=K Graphyn CLI shutdown complete');
      
      if (this.currentContext.activeAgents.length > 0) {
        console.log(`Stopped ${this.currentContext.activeAgents.length} active agents`);
      }
      
      if (this.configuration.saveStateOnExit) {
        console.log('Session state saved');
      }
      
      this.emit('shutdownCompleted');
      
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      this.emit('shutdownError', error);
    }
  }

  /**
   * Save current session state
   */
  private async saveSessionState(): Promise<void> {
    // Implementation would save to file or database
    // For now, just emit event for external handling
    this.emit('saveSessionState', this.currentContext);
  }

  /**
   * Quick save state for emergency exits
   */
  private quickSaveState(): void {
    // Synchronous version for emergency scenarios
    this.emit('quickSaveState', this.currentContext);
  }

  /**
   * Gracefully stop execution
   */
  private async gracefullyStopExecution(): Promise<void> {
    this.emit('stopExecution', this.currentContext);
  }

  /**
   * Get current exit state
   */
  getState(): ExitState {
    return this.exitState;
  }

  /**
   * Get exit attempt history
   */
  getExitHistory(): ExitAttemptEvent[] {
    return [...this.exitAttempts];
  }

  /**
   * Configure exit protection settings
   */
  updateConfiguration(config: Partial<ExitConfiguration>): void {
    this.configuration = { ...this.configuration, ...config };
    this.emit('configurationUpdated', this.configuration);
  }

  /**
   * Clean shutdown of exit protection system
   */
  cleanup(): void {
    if (this.exitTimer) {
      clearTimeout(this.exitTimer);
      this.exitTimer = undefined;
    }
    
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    this.removeAllListeners();
  }
}