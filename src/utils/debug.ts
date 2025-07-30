import chalk from 'chalk';

let debugMode = false;

export function setDebugMode(enabled: boolean) {
  debugMode = enabled;
}

export function isDebugMode(): boolean {
  return debugMode || process.env.DEBUG_GRAPHYN === 'true';
}

export function debug(message: string, ...args: any[]) {
  if (isDebugMode()) {
    console.log(chalk.blue(`[DEBUG] ${message}`), ...args);
  }
}

export function debugError(message: string, ...args: any[]) {
  if (isDebugMode()) {
    console.log(chalk.red(`[DEBUG ERROR] ${message}`), ...args);
  }
}

export function debugSuccess(message: string, ...args: any[]) {
  if (isDebugMode()) {
    console.log(chalk.green(`[DEBUG SUCCESS] ${message}`), ...args);
  }
}