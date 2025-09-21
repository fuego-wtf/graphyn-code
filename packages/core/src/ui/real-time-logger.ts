/**
 * Real-Time Logger for Graphyn CLI Streaming
 * 
 * Provides unbuffered stdout streaming with progress updates, spinners, and status indicators
 * Used by GraphynOrchestrator to show real-time agent progress and mission control updates
 */

import { ANSI, COLORS, SYMBOLS } from './ansi-codes.js';

export interface LoggerOptions {
  /**
   * Whether to use TTY features like colors and cursor control
   * @default process.stdout.isTTY
   */
  interactive?: boolean;
  
  /**
   * Whether to show timestamps on log entries
   * @default false
   */
  timestamps?: boolean;
  
  /**
   * Prefix for all log messages
   * @default ""
   */
  prefix?: string;
  
  /**
   * Maximum width for progress bars and status updates
   * @default process.stdout.columns || 80
   */
  maxWidth?: number;
}

export interface ProgressOptions {
  /**
   * Total steps for progress calculation
   * @default 100
   */
  total?: number;
  
  /**
   * Width of the progress bar
   * @default 40
   */
  width?: number;
  
  /**
   * Show percentage alongside progress bar
   * @default true
   */
  showPercentage?: boolean;
  
  /**
   * Show current/total counts
   * @default false
   */
  showCounts?: boolean;
}

export class RealTimeLogger {
  private currentLine: string = '';
  private isInteractive: boolean;
  private timestamps: boolean;
  private prefix: string;
  private maxWidth: number;
  private lastUpdateTime: number = 0;
  private readonly throttleMs = 33; // ~30fps max update rate

  constructor(options: LoggerOptions = {}) {
    this.isInteractive = options.interactive ?? (process.stdout.isTTY && process.env.CI !== 'true');
    this.timestamps = options.timestamps ?? false;
    this.prefix = options.prefix ?? '';
    this.maxWidth = options.maxWidth ?? (process.stdout.columns || 80);
  }

  /**
   * Log a permanent line (always visible)
   */
  logLine(message: string, color?: string): void {
    this.clearCurrentLine();
    const formattedMessage = this.formatMessage(message, color);
    process.stdout.write(formattedMessage + '\n');
    this.currentLine = '';
    this.flush();
  }

  /**
   * Log with specific status type (success, error, warning, info)
   */
  logStatus(type: 'success' | 'error' | 'warning' | 'info', message: string): void {
    const configs = {
      success: { symbol: SYMBOLS.SUCCESS, color: COLORS.SUCCESS },
      error: { symbol: SYMBOLS.ERROR, color: COLORS.ERROR },
      warning: { symbol: SYMBOLS.WARNING, color: COLORS.WARNING },
      info: { symbol: SYMBOLS.INFO, color: COLORS.INFO },
    };
    
    const { symbol, color } = configs[type];
    this.logLine(`${symbol} ${message}`, color);
  }

  /**
   * Update progress in place (overwrites current line)
   */
  updateProgress(message: string, current: number, options: ProgressOptions = {}): void {
    // Throttle updates for performance
    const now = Date.now();
    if (now - this.lastUpdateTime < this.throttleMs) {
      return;
    }
    this.lastUpdateTime = now;

    const {
      total = 100,
      width = 40,
      showPercentage = true,
      showCounts = false
    } = options;

    const percentage = Math.min(Math.max(current / total, 0), 1);
    const filled = Math.floor(percentage * width);
    const empty = width - filled;
    
    const progressBar = SYMBOLS.PROGRESS_FULL.repeat(filled) + SYMBOLS.PROGRESS_EMPTY.repeat(empty);
    const percentText = showPercentage ? ` ${Math.round(percentage * 100)}%` : '';
    const countText = showCounts ? ` (${current}/${total})` : '';
    
    const display = `${SYMBOLS.LOADING} ${message} [${progressBar}]${percentText}${countText}`;
    
    if (this.isInteractive) {
      process.stdout.write(`\r${ANSI.CLEAR_LINE_FROM_CURSOR}${display}`);
    } else {
      // Non-interactive mode: only log every 10%
      const roundedPercent = Math.floor(percentage * 10) * 10;
      const key = `${message}_${roundedPercent}`;
      if (!this.hasLoggedProgress(key)) {
        this.logLine(`${message} - ${roundedPercent}% complete`);
      }
    }
    
    this.currentLine = display;
  }

  private progressLogCache = new Set<string>();
  private hasLoggedProgress(key: string): boolean {
    if (this.progressLogCache.has(key)) {
      return true;
    }
    this.progressLogCache.add(key);
    return false;
  }

  /**
   * Show agent-specific progress with agent identifier
   */
  updateAgentProgress(agentName: string, message: string, progress: number): void {
    const agentEmoji = this.getAgentEmoji(agentName);
    const fullMessage = `${agentEmoji} [${agentName}] ${message}`;
    this.updateProgress(fullMessage, progress);
  }

  /**
   * Complete progress and move to new line
   */
  completeProgress(message?: string): void {
    if (this.currentLine && this.isInteractive) {
      const completedMessage = message || this.currentLine.replace(SYMBOLS.LOADING, SYMBOLS.SUCCESS);
      process.stdout.write(`\r${ANSI.CLEAR_LINE_FROM_CURSOR}${completedMessage}\n`);
    } else if (message) {
      this.logStatus('success', message);
    }
    this.currentLine = '';
  }

  /**
   * Fail progress with error message
   */
  failProgress(errorMessage: string): void {
    if (this.currentLine && this.isInteractive) {
      process.stdout.write(`\r${ANSI.CLEAR_LINE_FROM_CURSOR}${SYMBOLS.ERROR} ${errorMessage}\n`);
    } else {
      this.logStatus('error', errorMessage);
    }
    this.currentLine = '';
  }

  /**
   * Clear current progress line
   */
  clearCurrentLine(): void {
    if (this.currentLine && this.isInteractive) {
      process.stdout.write(`\r${ANSI.CLEAR_LINE_FROM_CURSOR}`);
      this.currentLine = '';
    }
  }

  /**
   * Force immediate output (flush stdout buffer)
   */
  flush(): void {
    if (this.isInteractive) {
      // Force immediate flush on TTY
      process.stdout.write('');
    }
  }

  /**
   * Create a child logger with a specific prefix
   */
  createChild(prefix: string): RealTimeLogger {
    return new RealTimeLogger({
      interactive: this.isInteractive,
      timestamps: this.timestamps,
      prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix,
      maxWidth: this.maxWidth
    });
  }

  /**
   * Log multiple lines with consistent formatting
   */
  logBlock(lines: string[], color?: string): void {
    this.clearCurrentLine();
    lines.forEach(line => {
      const formattedMessage = this.formatMessage(line, color);
      process.stdout.write(formattedMessage + '\n');
    });
    this.flush();
  }

  /**
   * Format message with prefix, timestamps, and colors
   */
  private formatMessage(message: string, color?: string): string {
    let formatted = message;
    
    if (color && this.isInteractive) {
      formatted = `${color}${formatted}${ANSI.RESET}`;
    }
    
    if (this.prefix) {
      formatted = `[${this.prefix}] ${formatted}`;
    }
    
    if (this.timestamps) {
      const timestamp = new Date().toISOString().substring(11, 23); // HH:mm:ss.sss
      formatted = `${COLORS.SUBTLE}[${timestamp}]${ANSI.RESET} ${formatted}`;
    }
    
    return formatted;
  }

  /**
   * Get emoji for agent type
   */
  private getAgentEmoji(agentName: string): string {
    const name = agentName.toLowerCase();
    if (name.includes('backend')) return SYMBOLS.ROBOT;
    if (name.includes('frontend')) return '⚛️';
    if (name.includes('security')) return SYMBOLS.SHIELD;
    if (name.includes('test')) return SYMBOLS.TEST;
    if (name.includes('figma')) return SYMBOLS.FIGMA;
    if (name.includes('devops')) return '🔧';
    return SYMBOLS.ROBOT;
  }

  /**
   * Get current progress state (for testing)
   */
  getCurrentLine(): string {
    return this.currentLine;
  }

  /**
   * Check if logger is in interactive mode
   */
  isInteractiveMode(): boolean {
    return this.isInteractive;
  }
}

/**
 * Singleton logger for global use
 */
export const globalLogger = new RealTimeLogger({
  timestamps: process.env.NODE_ENV === 'development'
});

/**
 * Quick logging functions for common use cases
 */
export const log = {
  info: (message: string) => globalLogger.logStatus('info', message),
  success: (message: string) => globalLogger.logStatus('success', message),
  error: (message: string) => globalLogger.logStatus('error', message),
  warning: (message: string) => globalLogger.logStatus('warning', message),
  line: (message: string) => globalLogger.logLine(message),
  progress: (message: string, current: number, total?: number) => 
    globalLogger.updateProgress(message, current, { total }),
  complete: (message?: string) => globalLogger.completeProgress(message),
  fail: (message: string) => globalLogger.failProgress(message),
};