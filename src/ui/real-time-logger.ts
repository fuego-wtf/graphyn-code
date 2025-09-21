import { ANSI, colorize, isTTY } from './ansi-codes.js';

/**
 * Real-time logger with unbuffered stdout for immediate terminal updates
 * Replaces console.log with streaming output that appears instantly
 */

export interface LogLevel {
  name: string;
  color: string;
  emoji: string;
}

export const LOG_LEVELS = {
  DEBUG: { name: 'DEBUG', color: ANSI.BRIGHT_BLACK, emoji: '🔍' },
  INFO: { name: 'INFO', color: ANSI.BLUE, emoji: 'ℹ️' },
  SUCCESS: { name: 'SUCCESS', color: ANSI.GREEN, emoji: '✅' },
  WARN: { name: 'WARN', color: ANSI.YELLOW, emoji: '⚠️' },
  ERROR: { name: 'ERROR', color: ANSI.RED, emoji: '❌' },
  AGENT: { name: 'AGENT', color: ANSI.MAGENTA, emoji: '🤖' },
  PROGRESS: { name: 'PROGRESS', color: ANSI.CYAN, emoji: '📊' }
} as const;

export type LogLevelName = keyof typeof LOG_LEVELS;

export class RealTimeLogger {
  private isEnabled: boolean = true;
  private lastUpdateTime: number = 0;
  private updateThrottle: number = 16; // ~60fps max update rate

  constructor(private options: { throttle?: number; tty?: boolean } = {}) {\n    this.updateThrottle = options.throttle || 16;\n    this.isEnabled = options.tty !== false;\n  }\n\n  /**\n   * Log message with unbuffered output - appears immediately\n   */\n  log(level: LogLevelName, message: string, ...args: any[]): void {\n    if (!this.isEnabled) return;\n\n    const logLevel = LOG_LEVELS[level];\n    const timestamp = new Date().toISOString().substr(11, 12); // HH:mm:ss.sss\n    \n    const prefix = isTTY() \n      ? `${logLevel.emoji} ${colorize(`[${timestamp}]`, ANSI.DIM)} ${colorize(logLevel.name, logLevel.color)}`\n      : `[${timestamp}] ${logLevel.name}`;\n    \n    const fullMessage = `${prefix}: ${message}`;\n    \n    // Use unbuffered write for immediate output\n    process.stdout.write(fullMessage + '\\n');\n    \n    // Log additional arguments if provided\n    if (args.length > 0) {\n      args.forEach(arg => {\n        const argStr = typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);\n        process.stdout.write(`  ${colorize(argStr, ANSI.DIM)}\\n`);\n      });\n    }\n  }\n\n  /**\n   * Write raw message without formatting - for progress bars, spinners etc\n   */\n  writeRaw(message: string): void {\n    if (!this.isEnabled) return;\n    process.stdout.write(message);\n  }\n\n  /**\n   * Write message on same line (overwrites previous)\n   */\n  writeSameLine(message: string): void {\n    if (!this.isEnabled) return;\n    \n    const now = Date.now();\n    if (now - this.lastUpdateTime < this.updateThrottle) {\n      return; // Throttle rapid updates\n    }\n    this.lastUpdateTime = now;\n    \n    if (isTTY()) {\n      process.stdout.write(ANSI.CURSOR_TO_COLUMN_1 + ANSI.CLEAR_LINE_FROM_CURSOR + message);\n    } else {\n      // Fallback for non-TTY: just write the message\n      process.stdout.write(message + '\\n');\n    }\n  }\n\n  /**\n   * Clear current line\n   */\n  clearLine(): void {\n    if (!this.isEnabled || !isTTY()) return;\n    process.stdout.write(ANSI.CURSOR_TO_COLUMN_1 + ANSI.CLEAR_LINE_FROM_CURSOR);\n  }\n\n  /**\n   * Move cursor up by specified lines\n   */\n  moveCursorUp(lines: number): void {\n    if (!this.isEnabled || !isTTY()) return;\n    process.stdout.write(ANSI.MOVE_UP(lines));\n  }\n\n  /**\n   * Convenience methods for common log levels\n   */\n  debug(message: string, ...args: any[]): void {\n    this.log('DEBUG', message, ...args);\n  }\n\n  info(message: string, ...args: any[]): void {\n    this.log('INFO', message, ...args);\n  }\n\n  success(message: string, ...args: any[]): void {\n    this.log('SUCCESS', message, ...args);\n  }\n\n  warn(message: string, ...args: any[]): void {\n    this.log('WARN', message, ...args);\n  }\n\n  error(message: string, ...args: any[]): void {\n    this.log('ERROR', message, ...args);\n  }\n\n  agent(message: string, ...args: any[]): void {\n    this.log('AGENT', message, ...args);\n  }\n\n  progress(message: string, ...args: any[]): void {\n    this.log('PROGRESS', message, ...args);\n  }\n\n  /**\n   * Disable logging (useful for testing)\n   */\n  disable(): void {\n    this.isEnabled = false;\n  }\n\n  /**\n   * Enable logging\n   */\n  enable(): void {\n    this.isEnabled = true;\n  }\n}\n\n// Export singleton instance\nexport const logger = new RealTimeLogger();