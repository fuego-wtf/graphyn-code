/**
 * ANSI Escape Sequence Constants for Terminal Control
 * Used by real-time streaming components for cursor management and colors
 */

export const ANSI = {
  // Cursor Control
  CURSOR_UP: (lines: number) => `\x1b[${lines}A`,
  CURSOR_DOWN: (lines: number) => `\x1b[${lines}B`,
  CURSOR_FORWARD: (cols: number) => `\x1b[${cols}C`,
  CURSOR_BACK: (cols: number) => `\x1b[${cols}D`,
  CURSOR_TO_COLUMN: (col: number) => `\x1b[${col}G`,
  CURSOR_SAVE: '\x1b[s',
  CURSOR_RESTORE: '\x1b[u',
  CURSOR_HIDE: '\x1b[?25l',
  CURSOR_SHOW: '\x1b[?25h',

  // Line Control
  CLEAR_LINE: '\x1b[2K',
  CLEAR_LINE_FROM_CURSOR: '\x1b[0K',
  CLEAR_LINE_TO_CURSOR: '\x1b[1K',
  CLEAR_SCREEN: '\x1b[2J',
  CLEAR_SCREEN_FROM_CURSOR: '\x1b[0J',
  CLEAR_SCREEN_TO_CURSOR: '\x1b[1J',

  // Text Formatting
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  ITALIC: '\x1b[3m',
  UNDERLINE: '\x1b[4m',
  BLINK: '\x1b[5m',
  REVERSE: '\x1b[7m',
  STRIKETHROUGH: '\x1b[9m',

  // Colors (Foreground)
  BLACK: '\x1b[30m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',
  GRAY: '\x1b[90m',
  BRIGHT_RED: '\x1b[91m',
  BRIGHT_GREEN: '\x1b[92m',
  BRIGHT_YELLOW: '\x1b[93m',
  BRIGHT_BLUE: '\x1b[94m',
  BRIGHT_MAGENTA: '\x1b[95m',
  BRIGHT_CYAN: '\x1b[96m',
  BRIGHT_WHITE: '\x1b[97m',

  // Background Colors
  BG_BLACK: '\x1b[40m',
  BG_RED: '\x1b[41m',
  BG_GREEN: '\x1b[42m',
  BG_YELLOW: '\x1b[43m',
  BG_BLUE: '\x1b[44m',
  BG_MAGENTA: '\x1b[45m',
  BG_CYAN: '\x1b[46m',
  BG_WHITE: '\x1b[47m',
  BG_GRAY: '\x1b[100m',
} as const;

/**
 * Common color combinations for Graphyn CLI
 */
export const COLORS = {
  SUCCESS: ANSI.BRIGHT_GREEN,
  ERROR: ANSI.BRIGHT_RED,
  WARNING: ANSI.BRIGHT_YELLOW,
  INFO: ANSI.BRIGHT_BLUE,
  AGENT: ANSI.BRIGHT_MAGENTA,
  TASK: ANSI.BRIGHT_CYAN,
  EMPHASIS: ANSI.BOLD + ANSI.WHITE,
  SUBTLE: ANSI.DIM + ANSI.GRAY,
  RESET: ANSI.RESET,
} as const;

/**
 * Unicode symbols for status indicators
 */
export const SYMBOLS = {
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  LOADING: '🔄',
  ROCKET: '🚀',
  ROBOT: '🤖',
  SHIELD: '🛡️',
  TEST: '🧪',
  FIGMA: '🎨',
  DATABASE: '💾',
  NETWORK: '🔗',
  TIMER: '⏱️',
  GRAPH: '📊',
  CONTROL: '🎛️',
  TRANSPARENCY: '🔍',
  PROGRESS_FULL: '█',
  PROGRESS_PARTIAL: '▒',
  PROGRESS_EMPTY: '░',
  ARROW_RIGHT: '→',
  ARROW_DOWN: '↓',
  BRANCH: '├─',
  BRANCH_END: '└─',
  VERTICAL: '│',
  DOT: '•',
} as const;

/**
 * Utility function to colorize text
 */
export function colorize(text: string, color: string): string {
  return `${color}${text}${ANSI.RESET}`;
}

/**
 * Utility function to format status with symbol and color
 */
export function formatStatus(status: string, symbol: string, color: string): string {
  return `${symbol} ${colorize(status, color)}`;
}