/**
 * Continuous Input Handler - Non-blocking Terminal Input
 * 
 * Provides continuous input handling that doesn't block during execution:
 * - Raw terminal input for immediate character processing
 * - Input buffering during execution
 * - Persistent input line at bottom of terminal
 * - Keyboard shortcuts and command completion
 */

import { EventEmitter } from 'events';
import * as readline from 'readline';

export interface ContinuousInputOptions {
  prompt?: string;
  enableHistory?: boolean;
  enableCompletion?: boolean;
  maxHistorySize?: number;
}

export interface InputEvent {
  type: 'input' | 'command' | 'history' | 'completion';
  data: {
    text: string;
    timestamp: number;
    metadata?: any;
  };
}

export class ContinuousInput extends EventEmitter {
  private rl?: readline.Interface;
  private isActive = false;
  private inputBuffer = '';
  private cursorPosition = 0;
  private history: string[] = [];
  private historyIndex = -1;
  private completions: string[] = [];
  private options: ContinuousInputOptions;

  constructor(options: ContinuousInputOptions = {}) {
    super();
    this.options = {
      prompt: 'graphyn> ',
      enableHistory: true,
      enableCompletion: true,
      maxHistorySize: 100,
      ...options
    };
  }

  /**
   * Start continuous input handling
   */
  async startContinuousInput(): Promise<void> {
    if (this.isActive) {
      return;
    }

    this.isActive = true;

    // Set up raw terminal input for better control
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    // Handle raw input data
    process.stdin.on('data', this.handleRawInput.bind(this));

    // Handle process signals
    process.on('SIGINT', this.handleSigInt.bind(this));
    process.on('SIGTERM', this.handleSigTerm.bind(this));

    this.renderInputLine();
  }

  /**
   * Handle raw terminal input
   */
  private handleRawInput(data: Buffer | string): void {
    const input = data.toString();
    
    // Handle special key sequences
    switch (input) {
      case '\u0003': // Ctrl+C
        this.handleSigInt();
        break;
        
      case '\r': // Enter
      case '\n':
        this.handleEnterKey();
        break;
        
      case '\u007f': // Backspace
        this.handleBackspace();
        break;
        
      case '\u001b[A': // Up arrow
        this.handleUpArrow();
        break;
        
      case '\u001b[B': // Down arrow
        this.handleDownArrow();
        break;
        
      case '\u001b[C': // Right arrow
        this.handleRightArrow();
        break;
        
      case '\u001b[D': // Left arrow
        this.handleLeftArrow();
        break;
        
      case '\t': // Tab
        this.handleTab();
        break;
        
      case '\u0015': // Ctrl+U (clear line)
        this.clearInputLine();
        break;
        
      default:
        // Regular character input
        if (input.length === 1 && input.charCodeAt(0) >= 32) {
          this.insertCharacter(input);
        }
        break;
    }
  }

  /**
   * Handle Enter key press
   */
  private handleEnterKey(): void {
    const input = this.inputBuffer.trim();
    
    if (input) {
      // Add to history
      if (this.options.enableHistory) {
        this.addToHistory(input);
      }

      // Emit input event
      this.emit('input', {
        type: 'input',
        data: {
          text: input,
          timestamp: Date.now()
        }
      } as InputEvent);

      // Clear input buffer
      this.inputBuffer = '';
      this.cursorPosition = 0;
      this.historyIndex = -1;
    }

    // Move to next line and redraw
    process.stdout.write('\n');
    this.renderInputLine();
  }

  /**
   * Handle backspace
   */
  private handleBackspace(): void {
    if (this.cursorPosition > 0) {
      this.inputBuffer = 
        this.inputBuffer.slice(0, this.cursorPosition - 1) + 
        this.inputBuffer.slice(this.cursorPosition);
      this.cursorPosition--;
      this.renderInputLine();
    }
  }

  /**
   * Handle up arrow (history navigation)
   */
  private handleUpArrow(): void {
    if (!this.options.enableHistory || this.history.length === 0) {
      return;
    }

    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.inputBuffer = this.history[this.history.length - 1 - this.historyIndex];
      this.cursorPosition = this.inputBuffer.length;
      this.renderInputLine();
    }
  }

  /**
   * Handle down arrow (history navigation)
   */
  private handleDownArrow(): void {
    if (!this.options.enableHistory) {
      return;
    }

    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.inputBuffer = this.history[this.history.length - 1 - this.historyIndex];
      this.cursorPosition = this.inputBuffer.length;
      this.renderInputLine();
    } else if (this.historyIndex === 0) {
      this.historyIndex = -1;
      this.inputBuffer = '';
      this.cursorPosition = 0;
      this.renderInputLine();
    }
  }

  /**
   * Handle right arrow (cursor movement)
   */
  private handleRightArrow(): void {
    if (this.cursorPosition < this.inputBuffer.length) {
      this.cursorPosition++;
      this.renderInputLine();
    }
  }

  /**
   * Handle left arrow (cursor movement)
   */
  private handleLeftArrow(): void {
    if (this.cursorPosition > 0) {
      this.cursorPosition--;
      this.renderInputLine();
    }
  }

  /**
   * Handle tab completion
   */
  private handleTab(): void {
    if (!this.options.enableCompletion) {
      return;
    }

    // Basic completion logic - can be extended
    const currentWord = this.getCurrentWord();
    const matches = this.completions.filter(comp => 
      comp.toLowerCase().startsWith(currentWord.toLowerCase())
    );

    if (matches.length === 1) {
      // Complete with the single match
      this.completeCurrentWord(matches[0]);
    } else if (matches.length > 1) {
      // Show available completions
      this.showCompletions(matches);
    }
  }

  /**
   * Insert character at cursor position
   */
  private insertCharacter(char: string): void {
    this.inputBuffer = 
      this.inputBuffer.slice(0, this.cursorPosition) + 
      char + 
      this.inputBuffer.slice(this.cursorPosition);
    this.cursorPosition++;
    this.renderInputLine();
  }

  /**
   * Clear input line
   */
  private clearInputLine(): void {
    this.inputBuffer = '';
    this.cursorPosition = 0;
    this.renderInputLine();
  }

  /**
   * Render the input line at current cursor position
   */
  private renderInputLine(): void {
    if (!this.isActive) return;

    // Clear current line
    process.stdout.write('\r\x1b[K');
    
    // Write prompt and input
    const prompt = this.options.prompt || 'graphyn> ';
    const displayText = prompt + this.inputBuffer;
    process.stdout.write(displayText);
    
    // Position cursor correctly
    const cursorPos = prompt.length + this.cursorPosition;
    process.stdout.write('\r');
    if (cursorPos > 0) {
      process.stdout.write(`\x1b[${cursorPos}C`);
    }
  }

  /**
   * Add input to history
   */
  private addToHistory(input: string): void {
    // Don't add duplicates or empty strings
    if (!input || this.history[this.history.length - 1] === input) {
      return;
    }

    this.history.push(input);
    
    // Trim history if too large
    if (this.history.length > (this.options.maxHistorySize || 100)) {
      this.history.shift();
    }
  }

  /**
   * Get current word for completion
   */
  private getCurrentWord(): string {
    const beforeCursor = this.inputBuffer.slice(0, this.cursorPosition);
    const words = beforeCursor.split(/\s+/);
    return words[words.length - 1] || '';
  }

  /**
   * Complete current word with given completion
   */
  private completeCurrentWord(completion: string): void {
    const beforeCursor = this.inputBuffer.slice(0, this.cursorPosition);
    const afterCursor = this.inputBuffer.slice(this.cursorPosition);
    const words = beforeCursor.split(/\s+/);
    
    if (words.length > 0) {
      words[words.length - 1] = completion;
      const newBeforeCursor = words.join(' ');
      this.inputBuffer = newBeforeCursor + afterCursor;
      this.cursorPosition = newBeforeCursor.length;
      this.renderInputLine();
    }
  }

  /**
   * Show available completions
   */
  private showCompletions(completions: string[]): void {
    process.stdout.write('\n');
    completions.forEach(comp => {
      process.stdout.write(`  ${comp}\n`);
    });
    this.renderInputLine();
  }

  /**
   * Handle Ctrl+C
   */
  private handleSigInt(): void {
    this.emit('interrupt');
  }

  /**
   * Handle SIGTERM
   */
  private handleSigTerm(): void {
    this.stopContinuousInput();
  }

  /**
   * Set completion suggestions
   */
  setCompletions(completions: string[]): void {
    this.completions = [...completions];
  }

  /**
   * Update the prompt
   */
  setPrompt(prompt: string): void {
    this.options.prompt = prompt;
    this.renderInputLine();
  }

  /**
   * Get current input buffer
   */
  getCurrentInput(): string {
    return this.inputBuffer;
  }

  /**
   * Get input history
   */
  getHistory(): string[] {
    return [...this.history];
  }

  /**
   * Stop continuous input
   */
  stopContinuousInput(): void {
    if (!this.isActive) return;

    this.isActive = false;
    
    // Restore terminal mode
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }
    
    process.stdin.removeAllListeners('data');
    process.stdin.pause();
    
    // Clear current line and move cursor
    process.stdout.write('\r\x1b[K\n');
  }

  /**
   * Check if input is active
   */
  isInputActive(): boolean {
    return this.isActive;
  }
}

export default ContinuousInput;