/**
 * ANSI escape codes for terminal control and styling
 * Used by streaming UI components for real-time terminal updates
 */

export const ANSI = {
  // Cursor control
  HIDE_CURSOR: '\u001B[?25l',
  SHOW_CURSOR: '\u001B[?25h',
  CLEAR_LINE: '\u001B[2K',
  CURSOR_TO_COLUMN_1: '\u001B[1G',
  MOVE_UP: (lines: number) => `\u001B[${lines}A`,
  MOVE_DOWN: (lines: number) => `\u001B[${lines}B`,
  MOVE_TO_COLUMN: (col: number) => `\u001B[${col}G`,
  
  // Screen control
  CLEAR_SCREEN: '\u001B[2J',
  CLEAR_SCREEN_FROM_CURSOR: '\u001B[0J',
  CLEAR_LINE_FROM_CURSOR: '\u001B[0K',
  
  // Colors
  RESET: '\u001B[0m',
  BOLD: '\u001B[1m',
  DIM: '\u001B[2m',
  
  // Foreground colors
  BLACK: '\u001B[30m',
  RED: '\u001B[31m',
  GREEN: '\u001B[32m',
  YELLOW: '\u001B[33m',
  BLUE: '\u001B[34m',
  MAGENTA: '\u001B[35m',
  CYAN: '\u001B[36m',
  WHITE: '\u001B[37m',
  
  // Bright foreground colors
  BRIGHT_BLACK: '\u001B[90m',
  BRIGHT_RED: '\u001B[91m',
  BRIGHT_GREEN: '\u001B[92m',
  BRIGHT_YELLOW: '\u001B[93m',
  BRIGHT_BLUE: '\u001B[94m',
  BRIGHT_MAGENTA: '\u001B[95m',
  BRIGHT_CYAN: '\u001B[96m',
  BRIGHT_WHITE: '\u001B[97m',
  
  // Background colors
  BG_BLACK: '\u001B[40m',
  BG_RED: '\u001B[41m',
  BG_GREEN: '\u001B[42m',
  BG_YELLOW: '\u001B[43m',
  BG_BLUE: '\u001B[44m',
  BG_MAGENTA: '\u001B[45m',
  BG_CYAN: '\u001B[46m',
  BG_WHITE: '\u001B[47m',
};

/**
 * Check if current environment supports TTY (terminal) features
 */
export function isTTY(): boolean {
  return process.stdout.isTTY === true;
}

/**
 * Wrap text with ANSI color codes, with fallback for non-TTY environments
 */
export function colorize(text: string, ...codes: string[]): string {
  if (!isTTY()) {
    return text; // No coloring in non-TTY environments (CI, pipes, etc.)
  }
  
  return codes.join('') + text + ANSI.RESET;
}

/**
 * Apply cursor control only in TTY environments
 */
export function cursorControl(code: string): string {
  return isTTY() ? code : '';
}