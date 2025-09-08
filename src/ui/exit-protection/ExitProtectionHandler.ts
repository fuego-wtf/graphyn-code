/**
 * REV-072: Exit Protection Handler - Two-Step Confirmation System
 * 
 * Implements a robust exit protection system that prevents accidental termination
 * of active Claude sessions with intelligent state management and user feedback.
 */

import { EventEmitter } from 'events';
import { ANSIController } from '../split-screen/ANSIController.js';

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

export class ExitProtectionHandler extends EventEmitter {
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
  private pendingExitResolve?: (value: boolean) => void;
  
  // UI management
  private confirmationDisplayed = false;
  private originalTerminalState?: any;

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
    console.error('\n🚨 Emergency exit triggered:', error.message);
    
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
    
    return new Promise((resolve) => {
      this.pendingExitResolve = resolve;
      
      switch (this.exitState) {
        case ExitState.NORMAL:
          this.initiateExitConfirmation(trigger);
          break;
          
        case ExitState.CONFIRMATION_PENDING:
          this.handleSecondExitAttempt(trigger);
          break;
          
        case ExitState.EXECUTING:
          this.handleExecutingExit(trigger);
          break;
          
        case ExitState.FORCE_EXIT:
          this.confirmExit(true);
          break;
      }
    });
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
   * Initiate exit confirmation process
   */
  private initiateExitConfirmation(trigger: string): void {
    this.exitState = ExitState.CONFIRMATION_PENDING;
    
    const context: ExitContext = { ...this.currentContext };
    
    // Record exit attempt
    this.recordExitAttempt(trigger as any, context);
    
    // Display confirmation UI
    this.displayExitConfirmation(context);
    
    // Setup timeout
    this.exitTimer = setTimeout(() => {
      this.handleConfirmationTimeout();
    }, this.configuration.confirmationTimeout);
    
    this.emit('exitConfirmationStarted', { trigger, context });
  }

  /**
   * Handle second exit attempt while confirmation is pending
   */
  private handleSecondExitAttempt(trigger: string): void {
    if (this.exitTimer) {
      clearTimeout(this.exitTimer);
      this.exitTimer = undefined;
    }
    
    // Second attempt confirms exit
    this.confirmExit(true);
  }

  /**
   * Handle exit request while execution is active
   */
  private handleExecutingExit(trigger: string): void {
    const context = this.currentContext;
    
    // Calculate if this is a significant interruption
    const isSignificantExecution = context.executionStartTime &&
      (Date.now() - context.executionStartTime.getTime()) > this.configuration.warningThreshold;
    
    if (!isSignificantExecution || !this.configuration.executionProtection) {
      // Allow exit for short executions
      this.confirmExit(true);
      return;
    }
    
    // Show execution protection warning
    this.displayExecutionProtectionWarning(context);
    
    // Wait for user decision
    this.exitState = ExitState.CONFIRMATION_PENDING;
    this.exitTimer = setTimeout(() => {
      // Default to continue execution
      this.confirmExit(false);
    }, this.configuration.confirmationTimeout * 2); // Longer timeout for executing state
  }

  /**
   * Handle force exit request (multiple rapid Ctrl+C)
   */
  private handleForceExitRequest(): boolean {
    this.exitState = ExitState.FORCE_EXIT;
    
    this.displayForceExitWarning();
    
    // Force exit after short delay
    setTimeout(() => {
      this.confirmExit(true);
    }, 1000);
    
    return false; // Don't exit immediately, wait for confirmation
  }

  /**
   * Confirm exit decision
   */
  private confirmExit(shouldExit: boolean): void {
    if (this.exitTimer) {
      clearTimeout(this.exitTimer);
      this.exitTimer = undefined;
    }
    
    this.clearExitConfirmation();
    
    if (shouldExit) {
      this.exitState = ExitState.FORCE_EXIT;
      this.emit('exitConfirmed', this.currentContext);
    } else {
      this.exitState = this.currentContext.isExecuting ? ExitState.EXECUTING : ExitState.NORMAL;
      this.emit('exitCancelled', this.currentContext);
    }
    
    if (this.pendingExitResolve) {
      this.pendingExitResolve(shouldExit);
      this.pendingExitResolve = undefined;
    }
  }

  /**
   * Handle confirmation timeout
   */
  private handleConfirmationTimeout(): void {
    this.recordExitAttempt('timeout', this.currentContext);
    this.confirmExit(false); // Default to not exiting
  }

  /**
   * Display exit confirmation UI
   */
  private displayExitConfirmation(context: ExitContext): void {
    if (this.confirmationDisplayed) {
      return;
    }
    
    this.confirmationDisplayed = true;
    this.preserveTerminalState();
    
    let output = '';
    
    // Clear screen and position cursor
    output += ANSIController.clearScreen();
    output += ANSIController.moveCursor(1, 1);
    output += ANSIController.hideCursor();
    
    const termWidth = process.stdout.columns || 80;
    const termHeight = process.stdout.rows || 24;
    
    // Calculate confirmation box dimensions
    const boxWidth = Math.min(60, termWidth - 4);
    const boxHeight = Math.min(12, termHeight - 4);
    const startRow = Math.floor((termHeight - boxHeight) / 2);
    const startCol = Math.floor((termWidth - boxWidth) / 2);
    
    // Create confirmation box
    output += ANSIController.createBox(
      startRow,
      startCol,
      boxWidth,
      boxHeight,
      'double',
      '⚠️  Exit Confirmation'
    );
    
    // Content area
    let contentRow = startRow + 2;
    
    if (context.isExecuting && context.activeAgents.length > 0) {
      // Execution in progress warning
      output += ANSIController.moveCursor(contentRow++, startCol + 2);
      output += ANSIController.color('🔄 Active Claude Sessions Running', { foreground: 'yellow', style: 'bold' });
      
      contentRow++; // Spacing
      
      // List active agents
      context.currentTasks.slice(0, 3).forEach(task => {
        output += ANSIController.moveCursor(contentRow++, startCol + 2);
        const timeStr = task.estimatedTimeRemaining > 0 
          ? `(${Math.ceil(task.estimatedTimeRemaining / 60)}m remaining)`
          : '';
        output += `• @${task.agentName}: ${task.description.substring(0, 25)}... ${timeStr}`;
      });
      
      if (context.currentTasks.length > 3) {
        output += ANSIController.moveCursor(contentRow++, startCol + 2);
        output += ANSIController.color(`... and ${context.currentTasks.length - 3} more tasks`, { foreground: 'gray' });
      }
    } else {
      output += ANSIController.moveCursor(contentRow++, startCol + 2);
      output += 'Are you sure you want to exit Graphyn CLI?';
    }
    
    // Options
    contentRow++;
    const optionsRow = startRow + boxHeight - 3;
    output += ANSIController.moveCursor(optionsRow, startCol + 2);
    
    if (context.isExecuting) {
      const options = '[ESC] Force Exit (⚠️ lose progress)     [ENTER] Continue Working';
      output += ANSIController.positionText(options, boxWidth - 4, 'center');
    } else {
      const options = '[ENTER] Yes, exit     [ESC] No, continue     [Ctrl+C] Force exit';
      output += ANSIController.positionText(options, boxWidth - 4, 'center');
    }
    
    // Auto-continue timer
    const timerRow = optionsRow + 1;
    output += ANSIController.moveCursor(timerRow, startCol + 2);
    const timeoutSec = Math.ceil(this.configuration.confirmationTimeout / 1000);
    const timerText = context.isExecuting 
      ? `Auto-continue in: ${timeoutSec}s... (or press any key)`
      : `Auto-cancel in: ${timeoutSec}s... (or press any key)`;
    output += ANSIController.positionText(
      ANSIController.color(timerText, { foreground: 'gray' }),
      boxWidth - 4,
      'center'
    );
    
    process.stdout.write(output);
    
    // Start countdown timer
    this.startConfirmationCountdown(timerRow, startCol, boxWidth, timeoutSec);
  }

  /**
   * Display execution protection warning
   */
  private displayExecutionProtectionWarning(context: ExitContext): void {
    this.displayExitConfirmation(context); // Reuse confirmation UI with execution context
  }

  /**
   * Display force exit warning
   */
  private displayForceExitWarning(): void {
    let output = '';
    
    output += ANSIController.moveCursor(1, 1);
    output += ANSIController.color('🚨 FORCE EXIT DETECTED - Terminating in 1 second...', { 
      foreground: 'red', 
      style: 'bold' 
    });
    
    process.stdout.write(output);
  }

  /**
   * Start confirmation countdown timer
   */
  private startConfirmationCountdown(row: number, col: number, width: number, seconds: number): void {
    const countdownInterval = setInterval(() => {
      seconds--;
      
      let output = ANSIController.moveCursor(row, col + 2);
      const timerText = this.currentContext.isExecuting 
        ? `Auto-continue in: ${seconds}s... (or press any key)`
        : `Auto-cancel in: ${seconds}s... (or press any key)`;
      output += ANSIController.positionText(
        ANSIController.color(timerText, { foreground: 'gray' }),
        width - 4,
        'center'
      );
      
      process.stdout.write(output);
      
      if (seconds <= 0 || this.exitState !== ExitState.CONFIRMATION_PENDING) {
        clearInterval(countdownInterval);
      }
    }, 1000);
  }

  /**
   * Clear exit confirmation UI
   */
  private clearExitConfirmation(): void {
    if (!this.confirmationDisplayed) {
      return;
    }
    
    this.confirmationDisplayed = false;
    
    // Restore terminal state
    let output = '';
    output += ANSIController.clearScreen();
    output += ANSIController.moveCursor(1, 1);
    output += ANSIController.showCursor();
    
    process.stdout.write(output);
    
    this.restoreTerminalState();
  }

  /**
   * Preserve current terminal state
   */
  private preserveTerminalState(): void {
    this.originalTerminalState = {
      cursorVisible: true, // Assume cursor was visible
      alternateScreen: false
    };
  }

  /**
   * Restore terminal state
   */
  private restoreTerminalState(): void {
    if (this.originalTerminalState) {
      // Restore cursor and screen state
      let output = '';
      if (this.originalTerminalState.cursorVisible) {
        output += ANSIController.showCursor();
      }
      process.stdout.write(output);
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
      
      // Clean up terminal state
      this.clearExitConfirmation();
      
      // Display shutdown summary
      this.displayShutdownSummary();
      
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
   * Display shutdown summary
   */
  private displayShutdownSummary(): void {
    let output = '';
    
    output += '\n';
    output += ANSIController.color('👋 Graphyn CLI shutdown complete', { foreground: 'green' });
    
    if (this.currentContext.activeAgents.length > 0) {
      output += '\n';
      output += ANSIController.color(`Stopped ${this.currentContext.activeAgents.length} active agents`, { foreground: 'yellow' });
    }
    
    if (this.configuration.saveStateOnExit) {
      output += '\n';
      output += ANSIController.color('Session state saved', { foreground: 'blue' });
    }
    
    output += '\n\n';
    
    process.stdout.write(output);
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
   * Force set exit state (for testing)
   */
  setExitState(state: ExitState): void {
    this.exitState = state;
  }

  /**
   * Clean shutdown of exit protection system
   */
  cleanup(): void {
    if (this.exitTimer) {
      clearTimeout(this.exitTimer);
      this.exitTimer = undefined;
    }
    
    this.clearExitConfirmation();
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
    this.removeAllListeners();
  }
}