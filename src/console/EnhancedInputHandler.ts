/**
 * REV-074: Enhanced Input Handler - Main Input System
 * 
 * This component replaces the existing ContinuousInput.ts with a robust,
 * context-aware input system that eliminates Ink raw mode issues.
 */

import { EventEmitter } from 'events';
import { RawInputHandler, KeySequenceEvent, CharacterInputEvent } from './RawInputHandler.js';
import { InputBufferManager, BufferState } from './InputBufferManager.js';

export enum InputContext {
  NORMAL = 'normal',
  APPROVAL = 'approval',
  EXECUTION = 'execution',
  HELP = 'help',
  EXIT_CONFIRMATION = 'exit_confirmation'
}

export interface EnhancedInputOptions {
  enableHistory?: boolean;
  enableAutoComplete?: boolean;
  historySize?: number;
  placeholder?: string;
  initialValue?: string;
}

export interface InputSubmissionEvent {
  content: string;
  context: InputContext;
  timestamp: Date;
}

export interface ContextSwitchEvent {
  oldContext: InputContext;
  newContext: InputContext;
  timestamp: Date;
}

export class EnhancedInputHandler extends EventEmitter {
  private rawInputHandler: RawInputHandler;
  private inputBufferManager: InputBufferManager;
  private isActive: boolean = false;
  private currentContext: InputContext = InputContext.NORMAL;
  
  // Configuration
  private options: EnhancedInputOptions;
  
  // Auto-completion
  private completionSuggestions: string[] = [];
  private completionIndex: number = -1;
  private completionPrefix: string = '';

  constructor(options: EnhancedInputOptions = {}) {
    super();
    
    this.options = {
      enableHistory: true,
      enableAutoComplete: true,
      historySize: 1000,
      placeholder: 'graphyn>',
      ...options
    };
    
    this.rawInputHandler = new RawInputHandler();
    this.inputBufferManager = new InputBufferManager({
      maxHistorySize: this.options.historySize
    });
    
    this.setupInputHandlers();
    this.setupBufferHandlers();
  }

  /**
   * Start the enhanced input system
   */
  start(): void {
    if (!this.isActive) {
      this.rawInputHandler.enableRawMode();
      this.isActive = true;
      this.emit('started');
      
      // Initialize with placeholder if buffer is empty
      if (this.options.initialValue) {
        this.inputBufferManager.setBuffer(this.options.initialValue, false);
      }
    }
  }

  /**
   * Stop the enhanced input system
   */
  stop(): void {
    if (this.isActive) {
      this.rawInputHandler.disableRawMode();
      this.isActive = false;
      this.emit('stopped');
    }
  }

  /**
   * Check if input system is active
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Set the current input context for context-aware behavior
   */
  setContext(context: InputContext): void {
    const oldContext = this.currentContext;
    this.currentContext = context;
    
    this.emit('contextChanged', {
      oldContext,
      newContext: context,
      timestamp: new Date()
    } as ContextSwitchEvent);
  }

  /**
   * Get the current input context
   */
  getContext(): InputContext {
    return this.currentContext;
  }

  /**
   * Get current buffer content
   */
  getCurrentInput(): string {
    return this.inputBufferManager.getBuffer();
  }

  /**
   * Get current cursor position
   */
  getCursorPosition(): number {
    return this.inputBufferManager.getCursorPosition();
  }

  /**
   * Get current buffer state
   */
  getBufferState(): BufferState {
    return this.inputBufferManager.getState();
  }

  /**
   * Set input buffer content programmatically
   */
  setInput(content: string, moveCursorToEnd: boolean = true): void {
    this.inputBufferManager.setBuffer(content, moveCursorToEnd);
  }

  /**
   * Clear the current input
   */
  clearInput(): void {
    this.inputBufferManager.clearBuffer();
  }

  /**
   * Set auto-completion suggestions
   */
  setCompletionSuggestions(suggestions: string[]): void {
    this.completionSuggestions = suggestions;
    this.completionIndex = -1;
  }

  /**
   * Setup input event handlers
   */
  private setupInputHandlers(): void {
    this.rawInputHandler.on('keyAction', (event: KeySequenceEvent) => {
      this.handleKeyAction(event.action, event.data);
    });

    this.rawInputHandler.on('characterInput', (event: CharacterInputEvent) => {
      this.handleCharacterInput(event.character);
    });
  }

  /**
   * Setup buffer change handlers
   */
  private setupBufferHandlers(): void {
    this.inputBufferManager.on('bufferChanged', (state: BufferState) => {
      this.emit('bufferChanged', state);
      // Reset auto-completion when buffer changes
      this.resetAutoCompletion();
    });

    this.inputBufferManager.on('cursorMoved', (event) => {
      this.emit('cursorMoved', event);
    });
  }

  /**
   * Handle key actions (special key combinations)
   */
  private handleKeyAction(action: string, data?: any): void {
    switch (action) {
      // Cursor movement
      case 'cursor_left':
        this.inputBufferManager.moveCursor('left');
        break;
      case 'cursor_right':
        this.inputBufferManager.moveCursor('right');
        break;
      case 'cursor_home':
        this.inputBufferManager.moveCursor('home');
        break;
      case 'cursor_end':
        this.inputBufferManager.moveCursor('end');
        break;

      // Text operations
      case 'backspace':
        this.inputBufferManager.deleteCharacter();
        break;
      case 'delete_forward':
        this.inputBufferManager.deleteForward();
        break;
      case 'clear_line':
        this.inputBufferManager.clearBuffer();
        break;
      case 'clear_to_end':
        this.inputBufferManager.clearToEnd();
        break;
      case 'delete_word':
        this.inputBufferManager.deleteWordBackward();
        break;

      // History navigation
      case 'navigate_up':
        if (this.currentContext === InputContext.APPROVAL) {
          this.emit('navigationRequest', { direction: 'up' });
        } else if (this.options.enableHistory) {
          const historyEntry = this.inputBufferManager.navigateHistory('up');
          if (historyEntry !== null) {
            this.emit('historyNavigated', { direction: 'up', content: historyEntry });
          }
        }
        break;
      case 'navigate_down':
        if (this.currentContext === InputContext.APPROVAL) {
          this.emit('navigationRequest', { direction: 'down' });
        } else if (this.options.enableHistory) {
          const historyEntry = this.inputBufferManager.navigateHistory('down');
          if (historyEntry !== null) {
            this.emit('historyNavigated', { direction: 'down', content: historyEntry });
          }
        }
        break;

      // Auto-completion
      case 'tab_complete':
        this.handleAutoCompletion();
        break;

      // Input submission
      case 'submit_input':
        this.submitInput();
        break;

      // Context-specific actions
      case 'toggle_approval':
        if (this.currentContext === InputContext.APPROVAL) {
          this.emit('taskApprovalToggle');
        }
        break;
      case 'approve_all':
        if (this.currentContext === InputContext.APPROVAL) {
          this.emit('approveAllTasks');
        }
        break;
      case 'modify_plan':
        if (this.currentContext === InputContext.APPROVAL) {
          this.emit('modifyExecutionPlan');
        }
        break;
      case 'provide_feedback':
        if (this.currentContext === InputContext.APPROVAL) {
          this.emit('provideFeedback');
        }
        break;
      case 'cancel_execution':
        if (this.currentContext === InputContext.APPROVAL) {
          this.emit('cancelExecution');
        }
        break;

      // System control
      case 'interrupt':
        this.emit('interrupt');
        break;
      case 'suspend':
        this.emit('suspend');
        break;
      case 'escape':
        this.emit('escape');
        break;
      case 'clear_screen':
        this.emit('clearScreen');
        break;
      case 'refresh_display':
        this.emit('refreshDisplay');
        break;

      default:
        // Emit unknown key action for custom handling
        this.emit('unknownKeyAction', { action, data });
    }
  }

  /**
   * Handle regular character input
   */
  private handleCharacterInput(character: string): void {
    // Insert character into buffer
    this.inputBufferManager.insertCharacter(character);
    
    // Emit character input event for real-time feedback
    this.emit('characterTyped', { character, context: this.currentContext });
  }

  /**
   * Handle auto-completion
   */
  private handleAutoCompletion(): void {
    if (!this.options.enableAutoComplete || this.completionSuggestions.length === 0) {
      return;
    }

    const currentInput = this.inputBufferManager.getBuffer();
    const cursorPos = this.inputBufferManager.getCursorPosition();
    
    // Extract the word being completed
    const beforeCursor = currentInput.slice(0, cursorPos);
    const wordMatch = beforeCursor.match(/\S+$/);
    const prefix = wordMatch ? wordMatch[0] : '';

    if (this.completionIndex === -1) {
      // Starting new completion cycle
      this.completionPrefix = prefix;
      const matches = this.completionSuggestions.filter(suggestion =>
        suggestion.toLowerCase().startsWith(prefix.toLowerCase())
      );

      if (matches.length > 0) {
        this.completionIndex = 0;
        this.applyCompletion(matches[0]);
        this.emit('completionStarted', { prefix, matches });
      }
    } else {
      // Cycling through completions
      const matches = this.completionSuggestions.filter(suggestion =>
        suggestion.toLowerCase().startsWith(this.completionPrefix.toLowerCase())
      );

      if (matches.length > 0) {
        this.completionIndex = (this.completionIndex + 1) % matches.length;
        this.applyCompletion(matches[this.completionIndex]);
        this.emit('completionCycled', { index: this.completionIndex, suggestion: matches[this.completionIndex] });
      }
    }
  }

  /**
   * Apply auto-completion suggestion
   */
  private applyCompletion(suggestion: string): void {
    const currentInput = this.inputBufferManager.getBuffer();
    const cursorPos = this.inputBufferManager.getCursorPosition();
    
    const beforeCursor = currentInput.slice(0, cursorPos);
    const afterCursor = currentInput.slice(cursorPos);
    
    // Replace the prefix with the suggestion
    const prefixStart = beforeCursor.length - this.completionPrefix.length;
    const newInput = currentInput.slice(0, prefixStart) + suggestion + afterCursor;
    
    this.inputBufferManager.setBuffer(newInput, false);
    this.inputBufferManager.moveCursor('right', suggestion.length - this.completionPrefix.length);
  }

  /**
   * Reset auto-completion state
   */
  private resetAutoCompletion(): void {
    this.completionIndex = -1;
    this.completionPrefix = '';
  }

  /**
   * Submit the current input
   */
  private submitInput(): void {
    const content = this.inputBufferManager.getBuffer().trim();
    
    if (content) {
      // Add to history
      if (this.options.enableHistory) {
        this.inputBufferManager.addToHistory(content, this.currentContext);
      }

      // Emit submission event
      this.emit('inputSubmitted', {
        content,
        context: this.currentContext,
        timestamp: new Date()
      } as InputSubmissionEvent);

      // Clear buffer for next input
      this.inputBufferManager.clearBuffer();
    } else {
      // Handle empty submission based on context
      this.emit('emptySubmission', { context: this.currentContext });
    }
  }

  /**
   * Get input history
   */
  getHistory() {
    return this.inputBufferManager.getHistory();
  }

  /**
   * Clear input history
   */
  clearHistory(): void {
    this.inputBufferManager.clearHistory();
  }

  /**
   * Clean shutdown
   */
  cleanup(): void {
    this.stop();
    this.rawInputHandler.cleanup();
    this.inputBufferManager.cleanup();
    this.removeAllListeners();
  }
}