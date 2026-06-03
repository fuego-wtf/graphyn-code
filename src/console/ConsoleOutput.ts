/**
 * Console Output System
 * 
 * Simple console.log-based output replacing complex Ink.js UI
 * Features emoji indicators, timing info, and task progress tracking
 */

import { TaskExecution, TaskStatus } from '../orchestrator/types';

interface ProgressOptions {
  phase: string;
  progress: number;
  total: number;
  elapsed?: number;
  estimatedTotal?: number;
}

interface TaskPlanOptions {
  tasks: TaskExecution[];
  totalTasks: number;
  estimatedDuration?: number;
}

interface CompletionOptions {
  success: boolean;
  totalTime: number;
  tasksCompleted: number;
  tasksTotal: number;
  results?: string[];
  errors?: string[];
}

export class ConsoleOutput {
  private startTime: number;
  
  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Show progress with emoji indicators and timing info
   */
  showProgress(options: ProgressOptions): void {
    const { phase, progress, total, elapsed, estimatedTotal } = options;
    const percentage = Math.round((progress / total) * 100);
    
    // Emoji progression based on status
    let emoji = '🚀'; // Starting
    if (progress > 0 && progress < total) {
      emoji = '🔄'; // In progress
    } else if (progress === total) {
      emoji = '✅'; // Complete
    }
    
    // Progress bar
    const barLength = 20;
    const filled = Math.round((percentage / 100) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    
    // Timing info
    const currentTime = Date.now();
    const elapsedTime = elapsed || Math.round((currentTime - this.startTime) / 1000);
    const timeInfo = estimatedTotal 
      ? ` (${elapsedTime}s / ~${estimatedTotal}s)`
      : ` (${elapsedTime}s)`;
    
    console.log(`${emoji} ${phase}: [${bar}] ${percentage}%${timeInfo}`);
  }

  /**
   * Display decomposed tasks with agent assignments
   */
  showTaskPlan(options: TaskPlanOptions): void {
    const { tasks, totalTasks, estimatedDuration } = options;
    
    console.log('\n🎯 Task Plan Generated');
    console.log('══════════════════════');
    
    if (estimatedDuration) {
      console.log(`Estimated Duration: ~${Math.round(estimatedDuration / 60)}m ${estimatedDuration % 60}s`);
    }
    
    console.log(`Total Tasks: ${totalTasks}\n`);
    
    // Group tasks by agent (since TaskExecution doesn't have phase)
    const tasksByAgent = tasks.reduce((acc, task) => {
      const agent = task.agent || 'General';
      if (!acc[agent]) acc[agent] = [];
      acc[agent].push(task);
      return acc;
    }, {} as Record<string, TaskExecution[]>);
    
    Object.entries(tasksByAgent).forEach(([agent, agentTasks]) => {
      console.log(`📋 Agent: ${agent}`);
      console.log('─'.repeat(agent.length + 10));
      
      agentTasks.forEach((task, _index) => {
        const statusEmoji = this.getTaskStatusEmoji(task.status);
        const priority = task.priority ? ` [P${task.priority}]` : '';
        const dependencies = (task.dependencies || []).length > 0 
          ? ` (depends on: ${(task.dependencies || []).join(', ')})` 
          : '';
        
        console.log(`  ${statusEmoji} ${task.id}: ${task.description}${priority}${dependencies}`);
        
        if (task.estimatedDuration) {
          console.log(`     ⏱️  Est. ${task.estimatedDuration}s`);
        }
        
        if (task.tags && task.tags.length > 0) {
          console.log(`     🏷️  Tags: ${task.tags.join(', ')}`);
        }
      });
      
      console.log(''); // Empty line between agents
    });
  }

  /**
   * Show task status update
   */
  showTaskUpdate(taskId: string, status: TaskStatus, message?: string): void {
    const emoji = this.getTaskStatusEmoji(status);
    const timestamp = new Date().toLocaleTimeString();
    
    console.log(`${emoji} [${timestamp}] ${taskId}: ${status}`);
    
    if (message) {
      console.log(`   💬 ${message}`);
    }
  }

  /**
   * Show agent activity
   */
  showAgentActivity(agentId: string, activity: string, details?: string): void {
    const timestamp = new Date().toLocaleTimeString();
    
    console.log(`🤖 [${timestamp}] @${agentId}: ${activity}`);
    
    if (details) {
      console.log(`   📝 ${details}`);
    }
  }

  /**
   * Final completion summary
   */
  showCompletion(options: CompletionOptions): void {
    const { success, totalTime, tasksCompleted, tasksTotal, results, errors } = options;
    
    console.log('\n' + '='.repeat(50));
    
    if (success) {
      console.log('✅ MISSION COMPLETE!');
      console.log('═══════════════════');
    } else {
      console.log('❌ MISSION FAILED');
      console.log('════════════════');
    }
    
    // Summary stats
    const minutes = Math.floor(totalTime / 60);
    const seconds = totalTime % 60;
    const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    
    console.log(`⏱️  Total Time: ${timeStr}`);
    console.log(`📊 Tasks: ${tasksCompleted}/${tasksTotal} completed`);
    console.log(`📈 Success Rate: ${Math.round((tasksCompleted / tasksTotal) * 100)}%`);
    
    // Results
    if (results && results.length > 0) {
      console.log('\n🎉 Results:');
      results.forEach(result => {
        console.log(`   ✨ ${result}`);
      });
    }
    
    // Errors
    if (errors && errors.length > 0) {
      console.log('\n⚠️  Issues:');
      errors.forEach(error => {
        console.log(`   🚨 ${error}`);
      });
    }
    
    console.log('\n' + '='.repeat(50));
  }

  /**
   * Show real-time log stream
   */
  showLogStream(source: string, message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toLocaleTimeString();
    let emoji = '📄';
    
    switch (level) {
      case 'warn':
        emoji = '⚠️ ';
        break;
      case 'error':
        emoji = '🚨';
        break;
    }
    
    console.log(`${emoji} [${timestamp}] ${source}: ${message}`);
  }

  /**
   * Show system status
   */
  showSystemStatus(agents: { id: string; status: string; }[], connections: number): void {
    console.log('\n🖥️  System Status');
    console.log('═══════════════');
    console.log(`🔗 Active Connections: ${connections}`);
    console.log(`🤖 Active Agents: ${agents.length}`);
    
    agents.forEach(agent => {
      const statusEmoji = agent.status === 'active' ? '🟢' : 
                         agent.status === 'busy' ? '🟡' : '🔴';
      console.log(`   ${statusEmoji} @${agent.id}: ${agent.status}`);
    });
  }

  /**
   * Clear console for fresh start
   */
  clear(): void {
    console.clear();
    console.log('🚀 Graphyn Mission Control');
    console.log('═══════════════════════════');
    console.log(`Started at: ${new Date(this.startTime).toLocaleString()}\n`);
  }

  /**
   * Get emoji for task status
   */
  private getTaskStatusEmoji(status: string): string {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'in_progress':
        return '🔄';
      case 'running':
        return '🔄';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      case 'blocked':
        return '🚫';
      case 'cancelled':
        return '⏹️ ';
      default:
        return '📄';
    }
  }

  /**
   * Show spinner for loading states
   */
  showSpinner(message: string): () => void {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    
    const interval = setInterval(() => {
      process.stdout.write(`\r${frames[i]} ${message}`);
      i = (i + 1) % frames.length;
    }, 100);
    
    // Return cleanup function
    return () => {
      clearInterval(interval);
      process.stdout.write('\r');
    };
  }

  /**
   * Show error with context
   */
  showError(error: Error, context?: string): void {
    console.log(`\n🚨 ERROR${context ? ` in ${context}` : ''}`);
    console.log('═'.repeat(20));
    console.log(`❌ ${error.message}`);
    
    if (error.stack) {
      console.log('\n📚 Stack Trace:');
      console.log(error.stack);
    }
  }

  /**
   * Show warning
   */
  showWarning(message: string, details?: string): void {
    console.log(`⚠️  WARNING: ${message}`);
    if (details) {
      console.log(`   ${details}`);
    }
  }

  /**
   * Show success message
   */
  showSuccess(message: string, details?: string): void {
    console.log(`✅ ${message}`);
    if (details) {
      console.log(`   ${details}`);
    }
  }

  // ============================================================================
  // PROCESS-008: REAL-TIME STREAMING METHODS
  // ============================================================================

  /**
   * Write text without newline (real-time streaming)
   */
  writeStream(text: string): void {
    process.stdout.write(text);
  }

  /**
   * Clear current line and write new content
   */
  updateStreamLine(text: string): void {
    if (process.stdout.clearLine && process.stdout.cursorTo) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
    } else {
      // Fallback for terminals without ANSI support
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
    }
    process.stdout.write(text);
  }

  /**
   * Show animated progress with real-time updates
   */
  showStreamingProgress(phase: string, progress: number, total: number): void {
    const percentage = Math.round((progress / total) * 100);
    const barLength = 20;
    const filled = Math.round((percentage / 100) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
    
    const timestamp = new Date().toLocaleTimeString();
    const progressText = `[${timestamp}] ${phase}: [${bar}] ${percentage}%`;
    
    this.updateStreamLine(progressText);
  }

  /**
   * Stream agent activity in real-time
   */
  streamAgentActivity(agentId: string, activity: string, status: 'starting' | 'progress' | 'completed' | 'failed'): void {
    const statusEmoji = {
      'starting': '🚀',
      'progress': '🔄', 
      'completed': '✅',
      'failed': '❌'
    }[status];

    const timestamp = new Date().toLocaleTimeString();
    const message = `[${timestamp}] ${statusEmoji} @${agentId}: ${activity}`;
    
    if (status === 'progress') {
      this.updateStreamLine(message);
    } else {
      console.log(message); // New line for start/complete/fail
    }
  }

  /**
   * Stream task progress with live updates
   */
  streamTaskProgress(_taskId: string, agent: string, progress: number, message?: string): void {
    const progressBar = this.createProgressBar(progress, 15);
    const displayMessage = message || 'Working...';
    const text = `🔄 @${agent}: ${progressBar} ${progress}% - ${displayMessage}`;
    
    this.updateStreamLine(text);
  }

  /**
   * Stream system events (coordination, file changes, etc.)
   */
  streamSystemEvent(event: 'file_created' | 'file_updated' | 'session_spawned' | 'coordination', details: string): void {
    const eventEmojis = {
      'file_created': '📝',
      'file_updated': '✏️',
      'session_spawned': '🚀',
      'coordination': '🤝'
    };

    const timestamp = new Date().toLocaleTimeString();
    const message = `[${timestamp}] ${eventEmojis[event]} ${details}`;
    console.log(message);
  }

  /**
   * Stream inter-agent messages
   */
  streamAgentMessage(from: string, to: string, message: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const arrow = to === 'broadcast' ? '📢' : '💬';
    const recipient = to === 'broadcast' ? 'ALL' : `@${to}`;
    
    console.log(`[${timestamp}] ${arrow} @${from} → ${recipient}: ${message}`);
  }

  /**
   * Show streaming error with context
   */
  streamError(source: string, error: Error | string, context?: string): void {
    const timestamp = new Date().toLocaleTimeString();
    const errorMessage = error instanceof Error ? error.message : error;
    
    console.log(`\n[${timestamp}] 🚨 ERROR in ${source}${context ? ` (${context})` : ''}`);
    console.log(`❌ ${errorMessage}`);
    
    if (error instanceof Error && error.stack) {
      console.log('📚 Stack trace:');
      console.log(error.stack);
    }
  }

  /**
   * Stream coordination events between agents
   */
  streamCoordination(event: 'dependency_ready' | 'task_blocked' | 'session_sync', details: any): void {
    const coordinationEmojis = {
      'dependency_ready': '🟢',
      'task_blocked': '🔴',
      'session_sync': '🔄'
    };

    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${coordinationEmojis[event]} COORDINATION: ${JSON.stringify(details)}`);
  }

  /**
   * Create a visual progress bar
   */
  private createProgressBar(progress: number, width: number = 20): string {
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  /**
   * Start streaming mode - enables real-time updates
   */
  startStreaming(): void {
    console.log('🎬 STREAMING MODE ACTIVATED - Real-time orchestration updates');
    console.log('═'.repeat(60));
  }

  /**
   * Stop streaming mode - return to normal output
   */
  stopStreaming(): void {
    console.log('\n🎬 STREAMING MODE DEACTIVATED');
    console.log('═'.repeat(60));
  }

  /**
   * Show streaming summary at completion
   */
  showStreamingSummary(stats: {
    totalEvents: number;
    duration: number;
    activeAgents: number;
    tasksCompleted: number;
    tasksTotal: number;
  }): void {
    console.log('\n🎯 STREAMING SUMMARY');
    console.log('═'.repeat(40));
    console.log(`⏱️  Duration: ${Math.round(stats.duration / 1000)}s`);
    console.log(`📊 Events: ${stats.totalEvents} streamed`);
    console.log(`🤖 Agents: ${stats.activeAgents} coordinated`);
    console.log(`✅ Tasks: ${stats.tasksCompleted}/${stats.tasksTotal} completed`);
    console.log(`📈 Success Rate: ${Math.round((stats.tasksCompleted / stats.tasksTotal) * 100)}%`);
    console.log('═'.repeat(40));
  }
}

// Singleton instance for global use
export const consoleOutput = new ConsoleOutput();