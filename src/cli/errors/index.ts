import chalk from 'chalk';

export enum ErrorCode {
  AUTH_FAILED = 'AUTH_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_COMMAND = 'INVALID_COMMAND',
  CONFIG_ERROR = 'CONFIG_ERROR',
  INVALID_REPO = 'INVALID_REPO',
  SQUAD_ERROR = 'SQUAD_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED'
}

export class CLIError extends Error {
  constructor(
    message: string,
    public code: string,
    public exitCode: number = 1,
    public details?: any
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

export class GraphynCLIError extends CLIError {
  static authFailed(details?: string): GraphynCLIError {
    return new GraphynCLIError(
      'Authentication failed. Please run "graphyn auth" to login.',
      ErrorCode.AUTH_FAILED,
      1,
      details
    );
  }
  
  static networkError(url: string, error: any): GraphynCLIError {
    return new GraphynCLIError(
      `Failed to connect to ${url}`,
      ErrorCode.NETWORK_ERROR,
      2,
      { url, originalError: error.message }
    );
  }
  
  static invalidCommand(command: string, suggestions?: string[]): GraphynCLIError {
    let message = `Unknown command: ${command}`;
    if (suggestions && suggestions.length > 0) {
      message += `\n\nDid you mean one of these?\n${suggestions.map(s => `  - ${s}`).join('\n')}`;
    }
    return new GraphynCLIError(
      message,
      ErrorCode.INVALID_COMMAND,
      1,
      { command, suggestions }
    );
  }
  
  static configError(message: string, file?: string): GraphynCLIError {
    return new GraphynCLIError(
      `Configuration error: ${message}`,
      ErrorCode.CONFIG_ERROR,
      1,
      { file }
    );
  }
  
  static invalidRepo(path: string): GraphynCLIError {
    return new GraphynCLIError(
      `Not a valid repository: ${path}`,
      ErrorCode.INVALID_REPO,
      1,
      { path }
    );
  }
  
  static squadError(message: string, squadId?: string): GraphynCLIError {
    return new GraphynCLIError(
      `Squad error: ${message}`,
      ErrorCode.SQUAD_ERROR,
      1,
      { squadId }
    );
  }
  
  static permissionDenied(resource: string): GraphynCLIError {
    return new GraphynCLIError(
      `Permission denied: ${resource}`,
      ErrorCode.PERMISSION_DENIED,
      1,
      { resource }
    );
  }
}

export class ErrorHandler {
  static handle(error: unknown): never {
    if (error instanceof CLIError) {
      console.error(chalk.red(`✗ ${error.message}`));
      if (process.env.GRAPHYN_VERBOSE === 'true' && error.details) {
        console.error(chalk.gray('\nDetails:'));
        console.error(chalk.gray(JSON.stringify(error.details, null, 2)));
      }
      process.exit(error.exitCode);
    }
    
    // Handle common errors
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        console.error(chalk.red('✗ Connection refused. Is the Graphyn service running?'));
      } else if (error.message.includes('ETIMEDOUT')) {
        console.error(chalk.red('✗ Connection timed out. Please check your network.'));
      } else {
        console.error(chalk.red(`✗ ${error.message}`));
      }
      
      if (process.env.GRAPHYN_VERBOSE === 'true') {
        console.error(chalk.gray('\nStack trace:'));
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
    
    // Unknown errors
    console.error(chalk.red('✗ An unexpected error occurred'));
    if (process.env.GRAPHYN_VERBOSE === 'true') {
      console.error(chalk.gray('\nError details:'));
      console.error(error);
    } else {
      console.error(chalk.gray('Run with --verbose for more details'));
    }
    process.exit(1);
  }
}