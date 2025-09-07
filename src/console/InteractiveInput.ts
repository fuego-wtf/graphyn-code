/**
 * Interactive Input Handler - Claude Code Style
 * 
 * Provides continuous interactive input like Claude Code CLI:
 * - Single-line text input with readline
 * - Handles ctrl+c gracefully
 * - Returns to chat prompt after completion
 * - Supports both direct queries and interactive mode
 */

import * as readline from 'readline';
import { EventEmitter } from 'events';

export interface InputOptions {
  prompt?: string;
  multiline?: boolean;
  exitCommand?: string;
}

export class InteractiveInput extends EventEmitter {
  private rl?: readline.Interface;
  private isActive: boolean = false;

  constructor() {
    super();
  }

  /**
   * Start interactive mode like Claude Code
   * Returns a continuous stream of user inputs
   */
  async startInteractiveMode(options: InputOptions = {}): Promise<void> {
    const { prompt = 'graphyn> ', exitCommand = 'exit' } = options;

    this.isActive = true;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt
    });

    // Welcome message
    console.log('\n🎯 Graphyn Interactive Mode');
    console.log('═══════════════════════════');
    console.log('Type your requests naturally, like talking to Claude Code.');
    console.log(`Type "${exitCommand}" to quit.`);
    console.log('');

    this.rl.prompt();

    return new Promise((resolve) => {
      this.rl!.on('line', (input: string) => {
        const trimmedInput = input.trim();
        
        if (trimmedInput === exitCommand) {
          this.stopInteractive();
          resolve();
          return;
        }

        if (trimmedInput) {
          this.emit('userInput', trimmedInput);
        }

        // Show prompt again after processing
        setTimeout(() => {
          if (this.isActive && this.rl) {
            this.rl.prompt();
          }
        }, 100);
      });

      this.rl!.on('SIGINT', () => {
        console.log('\n👋 Goodbye!');
        this.stopInteractive();
        resolve();
      });
    });
  }

  /**
   * Get a single input (for direct queries)
   */
  async getSingleInput(prompt: string = 'Enter query: '): Promise<string> {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  /**
   * Show a continuation prompt after task completion
   */
  async showContinuationPrompt(): Promise<string> {
    console.log('\n🎉 Task completed! What would you like to do next?');
    console.log('💡 You can:');
    console.log('  • Ask for clarification or improvements');
    console.log('  • Request new features or changes');
    console.log('  • Get explanations about the implementation');
    console.log('  • Start a completely new task');
    console.log('');
    
    return this.getSingleInput('graphyn> ');
  }

  /**
   * Stop interactive mode
   */
  stopInteractive(): void {
    this.isActive = false;
    if (this.rl) {
      this.rl.close();
      this.rl = undefined;
    }
  }

  /**
   * Check if currently in interactive mode
   */
  isInteractive(): boolean {
    return this.isActive;
  }
}

export default InteractiveInput;