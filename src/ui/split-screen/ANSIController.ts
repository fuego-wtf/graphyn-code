/**
 * REV-071: ANSI Escape Sequence Controller
 * 
 * Provides precise terminal control using ANSI escape sequences for
 * cursor positioning, screen clearing, colors, and styling.
 */

export interface CursorPosition {
  row: number;
  col: number;
}

export interface ColorConfig {
  foreground?: string;
  background?: string;
  style?: 'bold' | 'dim' | 'italic' | 'underline' | 'strikethrough' | 'reset';
}

export interface BoxStyle {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  vertical: string;
}

export class ANSIController {
  // ANSI escape sequences
  private static readonly ESC = '\x1b[';
  
  // Standard box drawing characters
  public static readonly BOX_STYLES: { [key: string]: BoxStyle } = {
    single: {
      topLeft: '┌',
      topRight: '┐',
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '─',
      vertical: '│'
    },
    double: {
      topLeft: '╔',
      topRight: '╗',
      bottomLeft: '╚',
      bottomRight: '╝',
      horizontal: '═',
      vertical: '║'
    },
    rounded: {
      topLeft: '╭',
      topRight: '╮',
      bottomLeft: '╰',
      bottomRight: '╯',
      horizontal: '─',
      vertical: '│'
    },
    thick: {
      topLeft: '┏',
      topRight: '┓',
      bottomLeft: '┗',
      bottomRight: '┛',
      horizontal: '━',
      vertical: '┃'
    }
  };

  // Color codes
  public static readonly COLORS = {
    reset: '0',
    black: '30',
    red: '31',
    green: '32',
    yellow: '33',
    blue: '34',
    magenta: '35',
    cyan: '36',
    white: '37',
    gray: '90',
    brightRed: '91',
    brightGreen: '92',
    brightYellow: '93',
    brightBlue: '94',
    brightMagenta: '95',
    brightCyan: '96',
    brightWhite: '97'
  };

  // Background colors
  public static readonly BG_COLORS = {
    black: '40',
    red: '41',
    green: '42',
    yellow: '43',
    blue: '44',
    magenta: '45',
    cyan: '46',
    white: '47',
    gray: '100',
    brightRed: '101',
    brightGreen: '102',
    brightYellow: '103',
    brightBlue: '104',
    brightMagenta: '105',
    brightCyan: '106',
    brightWhite: '107'
  };

  /**
   * Move cursor to specific position (1-based coordinates)
   */
  static moveCursor(row: number, col: number): string {
    return `${this.ESC}${row};${col}H`;
  }

  /**
   * Move cursor relative to current position
   */
  static moveCursorUp(lines: number = 1): string {
    return `${this.ESC}${lines}A`;
  }

  static moveCursorDown(lines: number = 1): string {
    return `${this.ESC}${lines}B`;
  }

  static moveCursorRight(cols: number = 1): string {
    return `${this.ESC}${cols}C`;
  }

  static moveCursorLeft(cols: number = 1): string {
    return `${this.ESC}${cols}D`;
  }

  /**
   * Save and restore cursor position
   */
  static saveCursor(): string {
    return `${this.ESC}s`;
  }

  static restoreCursor(): string {
    return `${this.ESC}u`;
  }

  /**
   * Hide and show cursor
   */
  static hideCursor(): string {
    return `${this.ESC}?25l`;
  }

  static showCursor(): string {
    return `${this.ESC}?25h`;
  }

  /**
   * Clear operations
   */
  static clearScreen(): string {
    return `${this.ESC}2J`;
  }

  static clearLine(): string {
    return `${this.ESC}2K`;
  }

  static clearToEndOfLine(): string {
    return `${this.ESC}0K`;
  }

  static clearToBeginningOfLine(): string {
    return `${this.ESC}1K`;
  }

  static clearToEndOfScreen(): string {
    return `${this.ESC}0J`;
  }

  static clearToBeginningOfScreen(): string {
    return `${this.ESC}1J`;
  }

  /**
   * Clear specific region of the screen
   */
  static clearRegion(startRow: number, endRow: number, startCol: number = 1, endCol?: number): string {
    let commands = '';
    
    for (let row = startRow; row <= endRow; row++) {
      commands += this.moveCursor(row, startCol);
      
      if (endCol) {
        // Clear specific columns
        const width = endCol - startCol + 1;
        commands += ' '.repeat(width);
      } else {
        // Clear entire line
        commands += this.clearLine();
      }
    }
    
    return commands;
  }

  /**
   * Color and styling
   */
  static color(text: string, config: ColorConfig): string {
    let codes: string[] = [];
    
    if (config.foreground && this.COLORS[config.foreground as keyof typeof this.COLORS]) {
      codes.push(this.COLORS[config.foreground as keyof typeof this.COLORS]);
    }
    
    if (config.background && this.BG_COLORS[config.background as keyof typeof this.BG_COLORS]) {
      codes.push(this.BG_COLORS[config.background as keyof typeof this.BG_COLORS]);
    }
    
    if (config.style) {
      switch (config.style) {
        case 'bold': codes.push('1'); break;
        case 'dim': codes.push('2'); break;
        case 'italic': codes.push('3'); break;
        case 'underline': codes.push('4'); break;
        case 'strikethrough': codes.push('9'); break;
        case 'reset': codes.push('0'); break;
      }
    }
    
    if (codes.length === 0) {
      return text;
    }
    
    return `${this.ESC}${codes.join(';')}m${text}${this.ESC}0m`;
  }

  /**
   * Create horizontal line (border)
   */
  static createHorizontalLine(width: number, char: string = '─'): string {
    return char.repeat(width);
  }

  /**
   * Create vertical line
   */
  static createVerticalLine(height: number, char: string = '│'): string {
    return Array(height).fill(char).join('\n');
  }

  /**
   * Create a box with borders
   */
  static createBox(
    startRow: number, 
    startCol: number, 
    width: number, 
    height: number, 
    style: keyof typeof ANSIController.BOX_STYLES = 'single',
    title?: string
  ): string {
    const boxStyle = this.BOX_STYLES[style];
    let result = '';
    
    // Top border
    result += this.moveCursor(startRow, startCol);
    result += boxStyle.topLeft;
    
    if (title && title.length < width - 2) {
      const titlePadding = width - 2 - title.length;
      const leftPadding = Math.floor(titlePadding / 2);
      const rightPadding = titlePadding - leftPadding;
      result += boxStyle.horizontal.repeat(leftPadding);
      result += title;
      result += boxStyle.horizontal.repeat(rightPadding);
    } else {
      result += boxStyle.horizontal.repeat(width - 2);
    }
    
    result += boxStyle.topRight;
    
    // Side borders
    for (let row = 1; row < height - 1; row++) {
      result += this.moveCursor(startRow + row, startCol);
      result += boxStyle.vertical;
      result += this.moveCursor(startRow + row, startCol + width - 1);
      result += boxStyle.vertical;
    }
    
    // Bottom border
    result += this.moveCursor(startRow + height - 1, startCol);
    result += boxStyle.bottomLeft;
    result += boxStyle.horizontal.repeat(width - 2);
    result += boxStyle.bottomRight;
    
    return result;
  }

  /**
   * Create progress bar
   */
  static createProgressBar(
    progress: number, 
    width: number, 
    filled: string = '█', 
    empty: string = '▓',
    showPercentage: boolean = true
  ): string {
    const normalizedProgress = Math.max(0, Math.min(1, progress));
    const filledWidth = Math.floor(width * normalizedProgress);
    const emptyWidth = width - filledWidth;
    
    let bar = filled.repeat(filledWidth) + empty.repeat(emptyWidth);
    
    if (showPercentage) {
      const percentage = Math.round(normalizedProgress * 100);
      bar += ` ${percentage}%`;
    }
    
    return bar;
  }

  /**
   * Create status indicator with color
   */
  static createStatusIndicator(
    status: 'success' | 'error' | 'warning' | 'info' | 'running',
    text?: string
  ): string {
    let indicator = '';
    let color: ColorConfig = {};
    
    switch (status) {
      case 'success':
        indicator = '✅';
        color = { foreground: 'green' };
        break;
      case 'error':
        indicator = '❌';
        color = { foreground: 'red' };
        break;
      case 'warning':
        indicator = '⚠️ ';
        color = { foreground: 'yellow' };
        break;
      case 'info':
        indicator = 'ℹ️ ';
        color = { foreground: 'blue' };
        break;
      case 'running':
        indicator = '⚡';
        color = { foreground: 'cyan' };
        break;
    }
    
    const coloredIndicator = this.color(indicator, color);
    return text ? `${coloredIndicator} ${text}` : coloredIndicator;
  }

  /**
   * Create spinner animation frame
   */
  static createSpinnerFrame(frame: number): string {
    const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    const char = spinnerChars[frame % spinnerChars.length];
    return this.color(char, { foreground: 'cyan' });
  }

  /**
   * Position text within a container
   */
  static positionText(
    text: string,
    containerWidth: number,
    alignment: 'left' | 'center' | 'right' = 'left',
    padding: number = 0
  ): string {
    const availableWidth = containerWidth - (padding * 2);
    const textLength = this.stripAnsi(text).length;
    
    if (textLength >= availableWidth) {
      // Truncate if too long
      return ' '.repeat(padding) + text.substring(0, availableWidth - 3) + '...' + ' '.repeat(padding);
    }
    
    let paddedText = '';
    const remainingSpace = availableWidth - textLength;
    
    switch (alignment) {
      case 'left':
        paddedText = text + ' '.repeat(remainingSpace);
        break;
      case 'center':
        const leftPadding = Math.floor(remainingSpace / 2);
        const rightPadding = remainingSpace - leftPadding;
        paddedText = ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
        break;
      case 'right':
        paddedText = ' '.repeat(remainingSpace) + text;
        break;
    }
    
    return ' '.repeat(padding) + paddedText + ' '.repeat(padding);
  }

  /**
   * Strip ANSI escape sequences from text (for length calculations)
   */
  static stripAnsi(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\[[0-9]*[A-Za-z]/g, '');
  }

  /**
   * Enable/disable alternate screen buffer
   */
  static enterAlternateScreen(): string {
    return `${this.ESC}?1049h`;
  }

  static exitAlternateScreen(): string {
    return `${this.ESC}?1049l`;
  }

  /**
   * Set terminal title
   */
  static setTitle(title: string): string {
    return `\x1b]0;${title}\x07`;
  }

  /**
   * Bell/beep
   */
  static bell(): string {
    return '\x07';
  }

  /**
   * Reset terminal to default state
   */
  static reset(): string {
    return `${this.ESC}c`;
  }
}