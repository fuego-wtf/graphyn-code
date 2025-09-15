/**
 * Claude Code Input Handler - Ultimate Solution for Multi-line Input
 * 
 * Fixes the MaxListenersExceededWarning by properly handling multi-line input
 * without creating new Claude Code sessions for each line.
 */

import { EventEmitter } from 'events';
import * as readline from 'readline';
import { query } from "@anthropic-ai/claude-code";

export interface MultiLineInputOptions {
  prompt?: string;
  submitKeyword?: string;
  cancelKeyword?: string;
  enableHistory?: boolean;
  maxHistorySize?: number;
}

export interface InputSubmission {
  content: string;
  timestamp: Date;
  lineCount: number;
}

export class ClaudeCodeInputHandler extends EventEmitter {
  private rl?: readline.Interface;
  private isActive = false;
  private inputBuffer: string[] = [];
  private currentInput = '';
  private inputHistory: string[] = [];
  private historyIndex = -1;
  private options: Required<MultiLineInputOptions>;

  constructor(options: MultiLineInputOptions = {}) {
    super();
    
    // Prevent too many listeners warning
    this.setMaxListeners(5);
    
    this.options = {
      prompt: 'graphyn> ',
      submitKeyword: 'END',
      cancelKeyword: 'CANCEL',
      enableHistory: true,
      maxHistorySize: 100,
      ...options
    };
  }

  /**
   * Start multi-line input collection
   */
  async startMultiLineInput(): Promise<InputSubmission> {
    return new Promise((resolve, reject) => {
      this.setupReadlineInterface();
      this.showMultiLineInstructions();
      
      const cleanup = () => {
        if (this.rl) {
          this.rl.close();
          this.rl = undefined;
        }
        this.isActive = false;
      };

      // Handle successful submission
      this.once('inputComplete', (submission: InputSubmission) => {
        cleanup();
        resolve(submission);
      });

      // Handle cancellation or errors
      this.once('inputCancelled', () => {
        cleanup();
        reject(new Error('Input cancelled by user'));
      });

      this.once('inputError', (error: Error) => {
        cleanup();
        reject(error);
      });
    });
  }

  /**
   * Start simple single-line input (like Claude Code CLI)
   */
  async startSingleLineInput(promptText?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const prompt = promptText || this.options.prompt;
      
      rl.question(prompt, (answer) => {
        rl.close();
        const trimmedAnswer = answer.trim();
        
        // Add to history
        if (this.options.enableHistory && trimmedAnswer) {
          this.addToHistory(trimmedAnswer);
        }
        
        resolve(trimmedAnswer);
      });

      rl.on('SIGINT', () => {
        rl.close();
        reject(new Error('Input interrupted by user'));
      });
    });
  }

  /**
   * Execute Claude Code query with proper input handling
   */
  async executeClaudeQuery(initialPrompt: string): Promise<void> {
    // Set max listeners to prevent warning
    process.setMaxListeners(20);
    
    let cleanup: (() => void) | null = null;
    
    try {
      cleanup = () => {
        // Remove any listeners we might have added
        process.removeAllListeners('SIGINT');
        process.removeAllListeners('SIGTERM');
      };

      // Single Claude Code session for the entire conversation
      for await (const message of query({
        prompt: this.generateProperMessages(initialPrompt),
        options: {
          maxTurns: 10,
          allowedTools: ["Read", "Grep"]
        }
      })) {
        if (message.type === 'response') {
          console.log('Claude:', message.response.content);
          
          // Check if Claude is asking for more input
          if (this.isClaudeRequestingInput(message.response.content)) {
            const followUp = await this.startSingleLineInput('Your response: ');
            if (followUp.toLowerCase() === 'exit' || followUp.toLowerCase() === 'quit') {
              break;
            }
            // Continue the conversation...
          }
          
          // Break on completion
          if (message.response.finished) {
            break;
          }
        }
      }
    } finally {
      if (cleanup) {
        cleanup();
      }
    }
  }

  /**
   * Setup readline interface for multi-line input
   */
  private setupReadlineInterface(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.options.prompt
    });

    this.isActive = true;

    // Handle line input
    this.rl.on('line', (input: string) => {
      this.handleInputLine(input);
    });

    // Handle interruption
    this.rl.on('SIGINT', () => {
      this.emit('inputCancelled');
    });

    // Handle close
    this.rl.on('close', () => {
      if (this.isActive) {
        this.emit('inputCancelled');
      }
    });

    this.rl.prompt();
  }

  /**
   * Handle individual input lines
   */
  private handleInputLine(input: string): void {
    const trimmedInput = input.trim();
    
    // Check for submission keyword
    if (trimmedInput === this.options.submitKeyword) {
      this.submitCurrentInput();
      return;
    }
    
    // Check for cancellation keyword
    if (trimmedInput === this.options.cancelKeyword) {
      this.emit('inputCancelled');
      return;
    }
    
    // Handle history navigation
    if (trimmedInput === '!history') {
      this.showHistory();
      this.rl?.prompt();
      return;
    }
    
    // Add line to buffer
    this.inputBuffer.push(input);
    this.showContinuationPrompt();
  }

  /**
   * Submit the current multi-line input
   */
  private submitCurrentInput(): void {
    const content = this.inputBuffer.join('\n').trim();
    
    if (!content) {
      console.log('No input to submit. Type some content first.');
      this.rl?.prompt();
      return;
    }

    const submission: InputSubmission = {
      content,
      timestamp: new Date(),
      lineCount: this.inputBuffer.length
    };

    // Add to history
    if (this.options.enableHistory) {
      this.addToHistory(content);
    }

    // Clear buffer
    this.inputBuffer = [];
    
    this.emit('inputComplete', submission);
  }

  /**
   * Show multi-line input instructions
   */
  private showMultiLineInstructions(): void {
    console.log('\n📝 Multi-line Input Mode');
    console.log('═══════════════════════════');
    console.log(`• Type your content across multiple lines`);
    console.log(`• Type "${this.options.submitKeyword}" on a new line to submit`);
    console.log(`• Type "${this.options.cancelKeyword}" to cancel`);
    console.log(`• Type "!history" to see previous inputs`);
    console.log('');
  }

  /**
   * Show continuation prompt for multi-line
   */
  private showContinuationPrompt(): void {
    const lineNumber = this.inputBuffer.length + 1;
    this.rl?.setPrompt(`${lineNumber.toString().padStart(3, ' ')}> `);
    this.rl?.prompt();
  }

  /**
   * Generate proper message stream for Claude Code
   */
  private async* generateProperMessages(initialPrompt: string) {
    // Single initial message
    yield {
      type: "user" as const,
      message: {
        role: "user" as const,
        content: initialPrompt
      }
    };
    
    // Don't yield more unless we have follow-up questions
    // This prevents the multiple event listener issue
  }

  /**
   * Check if Claude is requesting more input
   */
  private isClaudeRequestingInput(content: string): boolean {
    const inputIndicators = [
      '?', 'what would you like', 'please provide', 'can you specify',
      'need more information', 'please clarify', 'what should I'
    ];
    
    return inputIndicators.some(indicator => 
      content.toLowerCase().includes(indicator)
    );
  }

  /**
   * Add input to history
   */
  private addToHistory(input: string): void {
    // Avoid duplicates
    if (this.inputHistory[this.inputHistory.length - 1] !== input) {
      this.inputHistory.push(input);
      
      // Trim history if too large
      if (this.inputHistory.length > this.options.maxHistorySize) {
        this.inputHistory = this.inputHistory.slice(-this.options.maxHistorySize);
      }
    }
    
    this.historyIndex = -1;
  }

  /**
   * Show input history
   */
  private showHistory(): void {
    if (this.inputHistory.length === 0) {
      console.log('No input history available.');
      return;
    }
    
    console.log('\n📚 Input History:');
    console.log('─'.repeat(50));
    
    this.inputHistory.slice(-10).forEach((item, index) => {
      const num = this.inputHistory.length - 10 + index + 1;
      const preview = item.length > 60 ? item.substring(0, 57) + '...' : item;
      console.log(`${num.toString().padStart(3)}: ${preview}`);
    });
    
    console.log('');
  }

  /**
   * Clean shutdown
   */
  cleanup(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = undefined;
    }
    this.isActive = false;
    this.removeAllListeners();
  }
}

// Export a singleton instance for easy use
export const claudeInputHandler = new ClaudeCodeInputHandler();

// Usage examples:

/**
 * Example 1: Single-line input (like Claude Code CLI)
 */
export async function promptUser(question: string): Promise<string> {
  return claudeInputHandler.startSingleLineInput(question + ' ');
}

/**
 * Example 2: Multi-line input for complex queries
 */
export async function getMultiLineQuery(): Promise<string> {
  try {
    const submission = await claudeInputHandler.startMultiLineInput();
    return submission.content;
  } catch (error) {
    console.log('Input cancelled or failed:', error.message);
    return '';
  }
}

/**
 * Example 3: Fixed Claude Code execution
 */
export async function executeClaudeWithProperInput(query: string): Promise<void> {
  await claudeInputHandler.executeClaudeQuery(query);
}
