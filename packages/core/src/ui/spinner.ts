/**
 * Spinner Component for Graphyn CLI Loading States
 * 
 * Provides animated loading indicators for:
 * - Agent initialization
 * - Task processing
 * - File operations
 * - API calls and network requests
 */

import { ANSI, COLORS, SYMBOLS } from './ansi-codes.js';

export interface SpinnerOptions {
  /**
   * Spinner animation style
   * @default 'dots'
   */
  style?: 'dots' | 'line' | 'bounce' | 'pulse' | 'clock' | 'custom';
  
  /**
   * Animation speed in milliseconds
   * @default 80
   */
  interval?: number;
  
  /**
   * Color of the spinner
   * @default 'cyan'
   */
  color?: 'cyan' | 'green' | 'yellow' | 'red' | 'blue' | 'magenta' | 'white' | 'none';
  
  /**
   * Text to display alongside spinner
   */
  text?: string;
  
  /**
   * Custom spinner frames (only used when style is 'custom')
   */
  frames?: string[];
  
  /**
   * Whether to hide cursor during animation
   * @default true
   */
  hideCursor?: boolean;
  
  /**
   * Prefix text before spinner
   */
  prefix?: string;
  
  /**
   * Suffix text after spinner and message
   */
  suffix?: string;
}

export class Spinner {
  private readonly frames: string[];
  private readonly interval: number;
  private readonly color: string;
  private readonly hideCursor: boolean;
  private readonly prefix: string;
  private readonly suffix: string;
  private readonly isInteractive: boolean;
  
  private text: string;
  private frameIndex = 0;
  private intervalId: NodeJS.Timeout | null = null;
  private isSpinning = false;
  private startTime = 0;

  constructor(options: SpinnerOptions = {}) {
    this.frames = this.getFrames(options.style ?? 'dots', options.frames);
    this.interval = options.interval ?? 80;
    this.color = this.getColorCode(options.color ?? 'cyan');
    this.hideCursor = options.hideCursor ?? true;
    this.prefix = options.prefix ?? '';
    this.suffix = options.suffix ?? '';
    this.text = options.text ?? '';
    this.isInteractive = process.stdout.isTTY && process.env.CI !== 'true';
  }

  /**
   * Start the spinner animation
   */
  start(text?: string): void {
    if (text !== undefined) {
      this.text = text;
    }
    
    if (this.isSpinning) {
      return;
    }
    
    this.isSpinning = true;
    this.startTime = Date.now();
    this.frameIndex = 0;
    
    if (!this.isInteractive) {
      // Non-interactive mode: just log once
      process.stdout.write(`${this.renderStaticMessage()}\n`);
      return;
    }
    
    if (this.hideCursor) {
      process.stdout.write(ANSI.CURSOR_HIDE);
    }
    
    this.intervalId = setInterval(() => {
      this.render();
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
    }, this.interval);
    
    // Initial render
    this.render();
  }

  /**
   * Update spinner text while running
   */
  updateText(text: string): void {
    this.text = text;
    if (this.isSpinning && this.isInteractive) {
      this.render();
    }
  }

  /**
   * Stop the spinner with success message
   */
  succeed(message?: string): void {
    this.stop(SYMBOLS.SUCCESS, message || this.text, COLORS.SUCCESS);
  }

  /**
   * Stop the spinner with failure message
   */
  fail(message?: string): void {
    this.stop(SYMBOLS.ERROR, message || this.text, COLORS.ERROR);
  }

  /**
   * Stop the spinner with warning message
   */
  warn(message?: string): void {
    this.stop(SYMBOLS.WARNING, message || this.text, COLORS.WARNING);
  }

  /**
   * Stop the spinner with info message
   */
  info(message?: string): void {
    this.stop(SYMBOLS.INFO, message || this.text, COLORS.INFO);
  }

  /**
   * Stop the spinner without any symbol
   */
  stop(symbol?: string, message?: string, color?: string): void {
    if (!this.isSpinning) {
      return;
    }
    
    this.isSpinning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (!this.isInteractive) {
      // Non-interactive mode: show completion
      if (message || symbol) {
        const finalMessage = symbol ? `${symbol} ${message || this.text}` : (message || this.text);
        process.stdout.write(`${finalMessage}\n`);
      }
      return;
    }
    
    // Clear current line
    process.stdout.write(`\r${ANSI.CLEAR_LINE_FROM_CURSOR}`);
    
    // Show final message if provided
    if (message !== undefined || symbol) {
      const finalSymbol = symbol || '';
      const finalMessage = message || this.text;
      const fullMessage = this.formatMessage(finalSymbol, finalMessage);
      
      if (color) {
        process.stdout.write(`${color}${fullMessage}${ANSI.RESET}\n`);
      } else {
        process.stdout.write(`${fullMessage}\n`);
      }
    }
    
    if (this.hideCursor) {
      process.stdout.write(ANSI.CURSOR_SHOW);
    }
  }

  /**
   * Check if spinner is currently running
   */
  isRunning(): boolean {
    return this.isSpinning;
  }

  /**
   * Get elapsed time since start
   */
  getElapsedTime(): number {
    if (!this.isSpinning) {
      return 0;
    }
    return Date.now() - this.startTime;
  }

  /**
   * Create a timer that shows elapsed time
   */
  startTimer(text?: string): void {
    if (text !== undefined) {
      this.text = text;
    }
    
    this.start();
    
    if (this.isInteractive) {
      // Update text with elapsed time every second
      const timerInterval = setInterval(() => {
        if (!this.isSpinning) {
          clearInterval(timerInterval);
          return;
        }
        
        const elapsed = Math.floor(this.getElapsedTime() / 1000);
        const baseText = this.text.split(' (')[0]; // Remove existing timer
        this.updateText(`${baseText} (${elapsed}s)`);
      }, 1000);
    }
  }

  /**
   * Render the current spinner frame
   */
  private render(): void {
    if (!this.isInteractive || !this.isSpinning) {
      return;
    }
    
    const frame = this.frames[this.frameIndex];
    const message = this.formatMessage(frame, this.text);
    const coloredMessage = this.color !== ANSI.RESET 
      ? `${this.color}${frame}${ANSI.RESET}${message.substring(frame.length)}`
      : message;
    
    process.stdout.write(`\r${ANSI.CLEAR_LINE_FROM_CURSOR}${coloredMessage}`);
  }

  /**
   * Render static message for non-interactive mode
   */
  private renderStaticMessage(): string {
    const message = this.text || 'Loading...';
    return this.formatMessage(SYMBOLS.LOADING, message);
  }

  /**
   * Format message with prefix and suffix
   */
  private formatMessage(symbol: string, text: string): string {
    let result = '';
    if (this.prefix) result += `${this.prefix} `;
    result += `${symbol}`;
    if (text) result += ` ${text}`;
    if (this.suffix) result += ` ${this.suffix}`;
    return result;
  }

  /**
   * Get spinner frames based on style
   */
  private getFrames(style: string, customFrames?: string[]): string[] {
    if (style === 'custom' && customFrames) {
      return customFrames;
    }
    
    switch (style) {
      case 'dots':
        return ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        
      case 'line':
        return ['-', '\\', '|', '/'];
        
      case 'bounce':
        return ['⠁', '⠂', '⠄', '⠂'];
        
      case 'pulse':
        return ['●', '○', '●', '○'];
        
      case 'clock':
        return ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'];
        
      default:
        return ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    }
  }

  /**
   * Get ANSI color code from color name
   */
  private getColorCode(color: string): string {
    switch (color) {
      case 'cyan': return COLORS.INFO;
      case 'green': return COLORS.SUCCESS;
      case 'yellow': return COLORS.WARNING;
      case 'red': return COLORS.ERROR;
      case 'blue': return ANSI.BLUE;
      case 'magenta': return ANSI.MAGENTA;
      case 'white': return ANSI.WHITE;
      case 'none': return ANSI.RESET;
      default: return COLORS.INFO;
    }
  }
}

/**
 * Multi-spinner manager for concurrent operations
 */
export class MultiSpinner {
  private spinners: Map<string, { spinner: Spinner; message: string }> = new Map();
  private isActive = false;
  private renderInterval: NodeJS.Timeout | null = null;
  private readonly isInteractive: boolean;

  constructor() {
    this.isInteractive = process.stdout.isTTY && process.env.CI !== 'true';
  }

  /**
   * Add a new spinner
   */
  add(key: string, message: string, options: SpinnerOptions = {}): void {
    const spinner = new Spinner({
      ...options,
      hideCursor: false // We'll manage cursor centrally
    });
    
    this.spinners.set(key, { spinner, message });
    
    if (!this.isActive) {
      this.start();
    } else if (this.isInteractive) {
      this.render();
    }
  }

  /**
   * Update spinner message
   */
  update(key: string, message: string): void {
    const entry = this.spinners.get(key);
    if (entry) {
      entry.message = message;
      entry.spinner.updateText(message);
      if (this.isInteractive && this.isActive) {
        this.render();
      }
    }
  }

  /**
   * Complete a spinner with success
   */
  succeed(key: string, message?: string): void {
    const entry = this.spinners.get(key);
    if (entry) {
      const finalMessage = message || entry.message;
      if (!this.isInteractive) {
        process.stdout.write(`${SYMBOLS.SUCCESS} ${finalMessage}\n`);
      }
      this.spinners.delete(key);
      if (this.isInteractive && this.isActive) {
        this.render();
      }
    }
  }

  /**
   * Fail a spinner with error message
   */
  fail(key: string, message?: string): void {
    const entry = this.spinners.get(key);
    if (entry) {
      const finalMessage = message || entry.message;
      if (!this.isInteractive) {
        process.stdout.write(`${SYMBOLS.ERROR} ${finalMessage}\n`);
      }
      this.spinners.delete(key);
      if (this.isInteractive && this.isActive) {
        this.render();
      }
    }
  }

  /**
   * Stop all spinners
   */
  stopAll(): void {
    this.isActive = false;
    
    if (this.renderInterval) {
      clearInterval(this.renderInterval);
      this.renderInterval = null;
    }
    
    if (this.isInteractive) {
      // Clear all spinner lines
      const count = this.spinners.size;
      for (let i = 0; i < count; i++) {
        process.stdout.write(ANSI.CURSOR_UP(1) + ANSI.CLEAR_LINE);
      }
      process.stdout.write(ANSI.CURSOR_SHOW);
    }
    
    this.spinners.clear();
  }

  /**
   * Start the multi-spinner rendering
   */
  private start(): void {
    this.isActive = true;
    
    if (!this.isInteractive) {
      return;
    }
    
    process.stdout.write(ANSI.CURSOR_HIDE);
    
    this.renderInterval = setInterval(() => {
      this.render();
    }, 100); // 10fps for multi-spinner
    
    this.render();
  }

  /**
   * Render all active spinners
   */
  private render(): void {
    if (!this.isInteractive || this.spinners.size === 0) {
      return;
    }
    
    // Move cursor to start of spinner block
    const spinnerCount = this.spinners.size;
    if (spinnerCount > 1) {
      process.stdout.write(ANSI.CURSOR_UP(spinnerCount - 1));
    }
    
    // Render each spinner
    let index = 0;
    this.spinners.forEach(({ spinner, message }, key) => {
      process.stdout.write(`\r${ANSI.CLEAR_LINE}`);
      
      const frame = spinner['frames'][spinner['frameIndex']];
      const coloredFrame = `${COLORS.INFO}${frame}${ANSI.RESET}`;
      process.stdout.write(`${coloredFrame} [${key}] ${message}`);
      
      if (index < spinnerCount - 1) {
        process.stdout.write('\n');
      }
      
      // Update frame index
      spinner['frameIndex'] = (spinner['frameIndex'] + 1) % spinner['frames'].length;
      index++;
    });
  }
}