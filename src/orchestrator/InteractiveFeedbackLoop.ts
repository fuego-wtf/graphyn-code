/**
 * Interactive Feedback Loop System
 * 
 * PROCESS-013: Interactive Real-Time User Control
 * Enables users to interrupt, provide feedback, and trigger agent recalibration 
 * at any point during multi-agent orchestration.
 */

import { EventEmitter } from 'events';
import { createInterface, emitKeypressEvents, Interface } from 'readline';
import inquirer from 'inquirer';
import chalk from 'chalk';

// ============================================================================
// INTERACTION EVENT TYPES
// ============================================================================

/**
 * User interruption types
 */
export type InterruptionType = 
  | 'pause_for_feedback'    // SPACE: Pause execution, allow review
  | 'provide_feedback'      // F: Collect user feedback and modify direction  
  | 'recalibrate'          // R: Trigger agent recalibration
  | 'show_status'          // S: Show current status and recent activity
  | 'emergency_stop'       // E: Emergency stop with context preservation
  | 'graceful_shutdown'    // Ctrl+C: Graceful shutdown with cleanup
  | 'force_exit';          // Double Ctrl+C: Force exit immediately

/**
 * User feedback structure
 */
export interface UserFeedback {
  action: 'continue' | 'modify_task' | 'add_requirement' | 'change_focus' | 'stop_agent' | 'restart_plan';
  details: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  targetAgent?: string;
  timestamp: Date;
}

/**
 * Interruption event data
 */
export interface InterruptionEvent {
  type: InterruptionType;
  timestamp: Date;
  context?: any;
}

/**
 * System status for user review
 */
export interface SystemStatus {
  activeAgents: Array<{
    name: string;
    status: string;
    currentTask: string;
    progress: number;
  }>;
  recentActivity: string[];
  totalProgress: number;
  startTime: Date;
  duration: number;
}

// ============================================================================
// INTERACTIVE FEEDBACK LOOP IMPLEMENTATION
// ============================================================================

/**
 * Manages real-time user interaction during orchestration
 */
export class InteractiveFeedbackLoop extends EventEmitter {
  private isActive: boolean = false;
  private isRawMode: boolean = false;
  private rl: Interface | null = null;
  private interruptionCount: number = 0;
  private lastInterruption: Date = new Date();
  
  constructor() {
    super();
    this.setMaxListeners(20); // Allow multiple listeners
  }

  /**
   * Activate interactive mode with keypress detection
   */
  activate(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.setupKeyPressDetection();
    this.setupSignalHandling();
    this.showControlsHelp();

    this.emit('interactive_activated');
  }

  /**
   * Deactivate interactive mode and cleanup
   */
  deactivate(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.cleanup();
    
    console.log(chalk.gray('\n🎮 Interactive controls deactivated'));
    this.emit('interactive_deactivated');
  }

  /**
   * Setup keypress detection for real-time interaction
   */
  private setupKeyPressDetection(): void {
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    emitKeypressEvents(process.stdin, this.rl);
    
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      this.isRawMode = true;
    }

    process.stdin.on('keypress', (str, key) => {
      if (!this.isActive) return;

      this.handleKeyPress(str, key);
    });
  }

  /**
   * Handle individual key presses
   */
  private handleKeyPress(str: string, key: any): void {
    if (!key) return;

    // Handle special key combinations
    if (key.ctrl && key.name === 'c') {
      this.handleControlC();
      return;
    }

    // Handle single key commands
    switch (key.name.toLowerCase()) {
      case 'space':
        this.handleInterruption('pause_for_feedback');
        break;
      case 'f':
        this.handleInterruption('provide_feedback');
        break;
      case 'r':
        this.handleInterruption('recalibrate');
        break;
      case 's':
        this.handleInterruption('show_status');
        break;
      case 'e':
        this.handleInterruption('emergency_stop');
        break;
      case 'h':
        this.showControlsHelp();
        break;
    }
  }

  /**
   * Handle Control+C with double-press detection
   */
  private handleControlC(): void {
    const now = new Date();
    const timeSinceLastInterruption = now.getTime() - this.lastInterruption.getTime();

    if (timeSinceLastInterruption < 2000) {
      // Double Ctrl+C within 2 seconds = force exit
      this.handleInterruption('force_exit');
    } else {
      // Single Ctrl+C = graceful shutdown
      this.handleInterruption('graceful_shutdown');
    }

    this.lastInterruption = now;
    this.interruptionCount++;
  }

  /**
   * Handle user interruption
   */
  private async handleInterruption(type: InterruptionType): Promise<void> {
    const event: InterruptionEvent = {
      type,
      timestamp: new Date(),
      context: { interruptionCount: this.interruptionCount }
    };

    this.emit('user_interruption', event);

    switch (type) {
      case 'pause_for_feedback':
        await this.pauseForReview();
        break;
      case 'provide_feedback':
        await this.collectUserFeedback();
        break;
      case 'recalibrate':
        await this.triggerRecalibration();
        break;
      case 'show_status':
        await this.showSystemStatus();
        break;
      case 'emergency_stop':
        await this.emergencyStop();
        break;
      case 'graceful_shutdown':
        await this.gracefulShutdown();
        break;
      case 'force_exit':
        this.forceExit();
        break;
    }
  }

  /**
   * Pause execution for user review
   */
  private async pauseForReview(): Promise<void> {
    this.disableRawMode();
    
    console.log(chalk.yellow('\n⏸️  EXECUTION PAUSED'));
    console.log(chalk.gray('Review current progress above. Press any key to continue, or use commands:'));
    console.log(chalk.gray('  F - Provide feedback    R - Recalibrate    S - Show status    E - Emergency stop'));

    this.emit('execution_paused');

    return new Promise((resolve) => {
      const handler = () => {
        process.stdin.off('data', handler);
        this.enableRawMode();
        
        console.log(chalk.green('▶️  EXECUTION RESUMED\n'));
        this.emit('execution_resumed');
        resolve();
      };

      process.stdin.once('data', handler);
    });
  }

  /**
   * Collect detailed user feedback
   */
  private async collectUserFeedback(): Promise<void> {
    this.disableRawMode();

    console.log(chalk.cyan('\n💬 FEEDBACK MODE ACTIVATED'));
    
    try {
      const feedback = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'Continue as planned', value: 'continue' },
            { name: 'Modify current task', value: 'modify_task' },
            { name: 'Add new requirement', value: 'add_requirement' },
            { name: 'Change agent focus', value: 'change_focus' },
            { name: 'Stop current agent', value: 'stop_agent' },
            { name: 'Restart with new plan', value: 'restart_plan' }
          ]
        },
        {
          type: 'input',
          name: 'details',
          message: 'Please provide details:',
          when: (answers: any) => answers.action !== 'continue'
        },
        {
          type: 'list',
          name: 'priority',
          message: 'Priority level:',
          choices: ['low', 'medium', 'high', 'critical'],
          default: 'medium',
          when: (answers: any) => answers.action !== 'continue'
        },
        {
          type: 'input',
          name: 'targetAgent',
          message: 'Target specific agent (optional):',
          when: (answers: any) => ['modify_task', 'change_focus', 'stop_agent'].includes(answers.action)
        }
      ]);

      const userFeedback: UserFeedback = {
        ...feedback,
        timestamp: new Date()
      };

      this.emit('feedback_received', userFeedback);
      
      if (userFeedback.action === 'continue') {
        console.log(chalk.green('✅ Continuing execution...'));
      } else {
        console.log(chalk.yellow(`🔄 Processing feedback: ${userFeedback.action}`));
      }

    } catch (error) {
      console.error(chalk.red('❌ Failed to collect feedback:'), error);
      this.emit('feedback_error', error);
    } finally {
      this.enableRawMode();
    }
  }

  /**
   * Trigger agent recalibration
   */
  private async triggerRecalibration(): Promise<void> {
    console.log(chalk.yellow('\n🔄 TRIGGERING AGENT RECALIBRATION...'));
    
    this.emit('recalibration_requested', {
      timestamp: new Date(),
      reason: 'user_request'
    });

    // Show recalibration progress
    const spinner = this.showRecalibrationSpinner();
    
    // Wait for recalibration to complete (will be handled by orchestrator)
    await new Promise(resolve => {
      this.once('recalibration_complete', () => {
        spinner();
        console.log(chalk.green('\n✅ Agent recalibration complete!'));
        resolve(true);
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        spinner();
        console.log(chalk.yellow('\n⏰ Recalibration timeout - continuing...'));
        resolve(true);
      }, 30000);
    });
  }

  /**
   * Show current system status
   */
  private async showSystemStatus(): Promise<void> {
    console.log(chalk.cyan('\n📊 SYSTEM STATUS'));
    console.log('═'.repeat(50));

    this.emit('status_requested');

    // Request status from orchestrator
    const statusPromise = new Promise<SystemStatus>((resolve) => {
      this.once('status_response', resolve);
      
      // Timeout with default status
      setTimeout(() => {
        resolve({
          activeAgents: [],
          recentActivity: ['Status request timeout'],
          totalProgress: 0,
          startTime: new Date(),
          duration: 0
        });
      }, 5000);
    });

    const status = await statusPromise;

    // Display status information
    console.log(`⏱️  Runtime: ${Math.round(status.duration / 1000)}s`);
    console.log(`📈 Progress: ${status.totalProgress}%`);
    console.log(`🤖 Active Agents: ${status.activeAgents.length}`);

    if (status.activeAgents.length > 0) {
      console.log('\n🎯 Agent Status:');
      status.activeAgents.forEach(agent => {
        const statusEmoji = agent.status === 'active' ? '🟢' : 
                           agent.status === 'busy' ? '🟡' : '🔴';
        console.log(`  ${statusEmoji} @${agent.name}: ${agent.currentTask} (${agent.progress}%)`);
      });
    }

    if (status.recentActivity.length > 0) {
      console.log('\n📋 Recent Activity:');
      status.recentActivity.slice(-5).forEach(activity => {
        console.log(`  • ${activity}`);
      });
    }

    console.log('═'.repeat(50));
    console.log(chalk.gray('Press any key to continue...\n'));

    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
  }

  /**
   * Emergency stop with context preservation
   */
  private async emergencyStop(): Promise<void> {
    console.log(chalk.red('\n🚨 EMERGENCY STOP INITIATED'));
    console.log(chalk.yellow('Preserving context and stopping all agents...'));

    this.emit('emergency_stop_requested', {
      timestamp: new Date(),
      preserveContext: true
    });

    // Give orchestrator time to cleanup
    await this.delay(2000);
    
    console.log(chalk.green('✅ Emergency stop complete. Context preserved.'));
    this.deactivate();
  }

  /**
   * Graceful shutdown with cleanup
   */
  private async gracefulShutdown(): Promise<void> {
    console.log(chalk.yellow('\n🛑 Graceful shutdown initiated...'));
    console.log(chalk.gray('Press Ctrl+C again within 2 seconds to force exit'));

    this.emit('shutdown_requested', {
      timestamp: new Date(),
      graceful: true
    });

    // Give orchestrator time to cleanup gracefully
    await this.delay(3000);
    
    this.deactivate();
    process.exit(0);
  }

  /**
   * Force immediate exit
   */
  private forceExit(): void {
    console.log(chalk.red('\n💥 FORCE EXIT'));
    this.cleanup();
    process.exit(1);
  }

  /**
   * Setup signal handling for process control
   */
  private setupSignalHandling(): void {
    process.on('SIGINT', () => {
      if (!this.isActive) process.exit(0);
      // SIGINT is handled by keypress detection when active
    });

    process.on('SIGTERM', () => {
      this.handleInterruption('graceful_shutdown');
    });
  }

  /**
   * Show controls help
   */
  private showControlsHelp(): void {
    console.log(chalk.cyan('\n🎮 INTERACTIVE CONTROLS'));
    console.log('═'.repeat(40));
    console.log(chalk.green('SPACE') + chalk.gray(' - Pause execution and review progress'));
    console.log(chalk.green('F')     + chalk.gray(' - Provide feedback and modify direction'));
    console.log(chalk.green('R')     + chalk.gray(' - Recalibrate agent priorities'));
    console.log(chalk.green('S')     + chalk.gray(' - Show system status'));
    console.log(chalk.green('E')     + chalk.gray(' - Emergency stop (preserve context)'));
    console.log(chalk.green('H')     + chalk.gray(' - Show this help'));
    console.log(chalk.red('Ctrl+C')   + chalk.gray(' - Graceful shutdown (press twice to force)'));
    console.log('═'.repeat(40) + '\n');
  }

  /**
   * Show recalibration spinner
   */
  private showRecalibrationSpinner(): () => void {
    const frames = ['🔄', '🔃', '🔄', '🔃'];
    let i = 0;
    
    const interval = setInterval(() => {
      process.stdout.write(`\r${frames[i]} Recalibrating agents...`);
      i = (i + 1) % frames.length;
    }, 200);

    return () => {
      clearInterval(interval);
      process.stdout.write('\r');
    };
  }

  /**
   * Disable raw mode for inquirer compatibility
   */
  private disableRawMode(): void {
    if (this.isRawMode && process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      this.isRawMode = false;
    }
  }

  /**
   * Re-enable raw mode for keypress detection
   */
  private enableRawMode(): void {
    if (!this.isRawMode && process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      this.isRawMode = true;
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    if (this.isRawMode && process.stdin.isTTY) {
      process.stdin.setRawMode(false);
      this.isRawMode = false;
    }
    
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }

    // Remove all listeners
    process.stdin.removeAllListeners('keypress');
    this.removeAllListeners();
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if currently active
   */
  get active(): boolean {
    return this.isActive;
  }

  /**
   * Get interruption statistics
   */
  get stats() {
    return {
      interruptionCount: this.interruptionCount,
      lastInterruption: this.lastInterruption,
      isActive: this.isActive
    };
  }
}

export default InteractiveFeedbackLoop;