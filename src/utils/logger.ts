import chalk from 'chalk';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private level: LogLevel = 'info';
  private levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };
  
  setLevel(level: LogLevel): void {
    this.level = level;
  }
  
  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level];
  }
  
  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const prefix = process.env.GRAPHYN_VERBOSE === 'true' 
      ? `[${timestamp}] [${level.toUpperCase()}]`
      : '';
    
    return `${prefix} ${message}`;
  }
  
  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.log(chalk.gray(this.formatMessage('debug', message)), ...args);
    }
  }
  
  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message), ...args);
    }
  }
  
  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(chalk.yellow(this.formatMessage('warn', message)), ...args);
    }
  }
  
  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(chalk.red(this.formatMessage('error', message)), ...args);
    }
  }
  
  success(message: string, ...args: any[]): void {
    console.log(chalk.green(`✓ ${message}`), ...args);
  }
  
  static create(verbose: boolean = false): Logger {
    const logger = new Logger();
    logger.setLevel(verbose ? 'debug' : 'info');
    return logger;
  }
}