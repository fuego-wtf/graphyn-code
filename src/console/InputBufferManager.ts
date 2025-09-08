/**
 * REV-074: Input Buffer Management System
 * 
 * Provides sophisticated text buffer management with cursor positioning,
 * history, and editing capabilities for the enhanced input system.
 */

import { EventEmitter } from 'events';

export interface BufferState {
  buffer: string;
  cursorPosition: number;
  selectionStart?: number;
  selectionEnd?: number;
}

export interface HistoryEntry {
  content: string;
  timestamp: Date;
  context?: string;
}

export class InputBufferManager extends EventEmitter {
  private buffer: string = '';
  private cursorPosition: number = 0;
  private selectionStart?: number;
  private selectionEnd?: number;
  
  // History management
  private historyBuffer: HistoryEntry[] = [];
  private historyIndex: number = -1;
  private maxHistorySize: number = 1000;
  private temporaryBuffer?: string; // For history navigation
  
  // Undo/Redo functionality
  private undoStack: BufferState[] = [];
  private redoStack: BufferState[] = [];
  private maxUndoSize: number = 100;

  constructor(options: { maxHistorySize?: number; maxUndoSize?: number } = {}) {
    super();
    this.maxHistorySize = options.maxHistorySize ?? 1000;
    this.maxUndoSize = options.maxUndoSize ?? 100;
  }

  /**
   * Insert character(s) at the current cursor position
   */
  insertCharacter(char: string, position?: number): void {
    this.saveStateForUndo();
    
    const pos = position ?? this.cursorPosition;
    this.buffer = this.buffer.slice(0, pos) + char + this.buffer.slice(pos);
    this.cursorPosition = pos + char.length;
    this.clearSelection();
    
    this.emit('bufferChanged', this.getState());
  }

  /**
   * Delete character at specified position (or cursor - 1)
   */
  deleteCharacter(position?: number): void {
    const pos = position ?? this.cursorPosition - 1;
    if (pos >= 0 && pos < this.buffer.length) {
      this.saveStateForUndo();
      
      this.buffer = this.buffer.slice(0, pos) + this.buffer.slice(pos + 1);
      this.cursorPosition = Math.max(0, this.cursorPosition - 1);
      this.clearSelection();
      
      this.emit('bufferChanged', this.getState());
    }
  }

  /**
   * Delete character at cursor position (forward delete)
   */
  deleteForward(): void {
    if (this.cursorPosition < this.buffer.length) {
      this.saveStateForUndo();
      
      this.buffer = this.buffer.slice(0, this.cursorPosition) + 
                    this.buffer.slice(this.cursorPosition + 1);
      this.clearSelection();
      
      this.emit('bufferChanged', this.getState());
    }
  }

  /**
   * Move cursor in specified direction
   */
  moveCursor(direction: 'left' | 'right' | 'home' | 'end' | 'word_left' | 'word_right', steps: number = 1): void {
    const oldPosition = this.cursorPosition;
    
    switch (direction) {
      case 'left':
        this.cursorPosition = Math.max(0, this.cursorPosition - steps);
        break;
      case 'right':
        this.cursorPosition = Math.min(this.buffer.length, this.cursorPosition + steps);
        break;
      case 'home':
        this.cursorPosition = 0;
        break;
      case 'end':
        this.cursorPosition = this.buffer.length;
        break;
      case 'word_left':
        this.cursorPosition = this.findWordBoundary(this.cursorPosition, 'left');
        break;
      case 'word_right':
        this.cursorPosition = this.findWordBoundary(this.cursorPosition, 'right');
        break;
    }
    
    if (oldPosition !== this.cursorPosition) {
      this.clearSelection();
      this.emit('cursorMoved', { oldPosition, newPosition: this.cursorPosition });
    }
  }

  /**
   * Clear the entire buffer
   */
  clearBuffer(): void {
    if (this.buffer.length > 0) {
      this.saveStateForUndo();
      
      this.buffer = '';
      this.cursorPosition = 0;
      this.clearSelection();
      
      this.emit('bufferChanged', this.getState());
    }
  }

  /**
   * Clear from cursor to end of line
   */
  clearToEnd(): void {
    if (this.cursorPosition < this.buffer.length) {
      this.saveStateForUndo();
      
      this.buffer = this.buffer.slice(0, this.cursorPosition);
      this.clearSelection();
      
      this.emit('bufferChanged', this.getState());
    }
  }

  /**
   * Clear from beginning of line to cursor
   */
  clearToBeginning(): void {
    if (this.cursorPosition > 0) {
      this.saveStateForUndo();
      
      this.buffer = this.buffer.slice(this.cursorPosition);
      this.cursorPosition = 0;
      this.clearSelection();
      
      this.emit('bufferChanged', this.getState());
    }
  }

  /**
   * Delete word backward from cursor
   */
  deleteWordBackward(): void {
    const wordStart = this.findWordBoundary(this.cursorPosition, 'left');
    if (wordStart < this.cursorPosition) {
      this.saveStateForUndo();
      
      this.buffer = this.buffer.slice(0, wordStart) + this.buffer.slice(this.cursorPosition);
      this.cursorPosition = wordStart;
      this.clearSelection();
      
      this.emit('bufferChanged', this.getState());
    }
  }

  /**
   * Delete word forward from cursor
   */
  deleteWordForward(): void {
    const wordEnd = this.findWordBoundary(this.cursorPosition, 'right');
    if (wordEnd > this.cursorPosition) {
      this.saveStateForUndo();
      
      this.buffer = this.buffer.slice(0, this.cursorPosition) + this.buffer.slice(wordEnd);
      this.clearSelection();
      
      this.emit('bufferChanged', this.getState());
    }
  }

  /**
   * Set buffer content directly
   */
  setBuffer(content: string, moveCursorToEnd: boolean = true): void {
    this.saveStateForUndo();
    
    this.buffer = content;
    this.cursorPosition = moveCursorToEnd ? content.length : Math.min(this.cursorPosition, content.length);
    this.clearSelection();
    
    this.emit('bufferChanged', this.getState());
  }

  /**
   * Get current buffer content
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * Get current cursor position
   */
  getCursorPosition(): number {
    return this.cursorPosition;
  }

  /**
   * Get complete buffer state
   */
  getState(): BufferState {
    return {
      buffer: this.buffer,
      cursorPosition: this.cursorPosition,
      selectionStart: this.selectionStart,
      selectionEnd: this.selectionEnd
    };
  }

  /**
   * Add entry to command history
   */
  addToHistory(content: string, context?: string): void {
    // Don't add empty entries or duplicates of the last entry
    if (!content.trim() || 
        (this.historyBuffer.length > 0 && 
         this.historyBuffer[this.historyBuffer.length - 1].content === content)) {
      return;
    }

    const entry: HistoryEntry = {
      content,
      timestamp: new Date(),
      context
    };

    this.historyBuffer.push(entry);
    
    // Maintain max history size
    if (this.historyBuffer.length > this.maxHistorySize) {
      this.historyBuffer.shift();
    }
    
    // Reset history navigation
    this.historyIndex = -1;
    this.temporaryBuffer = undefined;
  }

  /**
   * Navigate history (up/down)
   */
  navigateHistory(direction: 'up' | 'down'): string | null {
    if (this.historyBuffer.length === 0) {
      return null;
    }

    // Save current buffer when starting history navigation
    if (this.historyIndex === -1) {
      this.temporaryBuffer = this.buffer;
    }

    if (direction === 'up') {
      if (this.historyIndex < this.historyBuffer.length - 1) {
        this.historyIndex++;
        const entry = this.historyBuffer[this.historyBuffer.length - 1 - this.historyIndex];
        this.setBuffer(entry.content);
        return entry.content;
      }
    } else { // down
      if (this.historyIndex > 0) {
        this.historyIndex--;
        const entry = this.historyBuffer[this.historyBuffer.length - 1 - this.historyIndex];
        this.setBuffer(entry.content);
        return entry.content;
      } else if (this.historyIndex === 0) {
        // Return to original buffer content
        this.historyIndex = -1;
        const original = this.temporaryBuffer ?? '';
        this.setBuffer(original);
        this.temporaryBuffer = undefined;
        return original;
      }
    }

    return null;
  }

  /**
   * Undo last operation
   */
  undo(): boolean {
    if (this.undoStack.length > 0) {
      // Save current state to redo stack
      this.redoStack.push(this.getState());
      if (this.redoStack.length > this.maxUndoSize) {
        this.redoStack.shift();
      }
      
      // Restore previous state
      const previousState = this.undoStack.pop()!;
      this.buffer = previousState.buffer;
      this.cursorPosition = previousState.cursorPosition;
      this.selectionStart = previousState.selectionStart;
      this.selectionEnd = previousState.selectionEnd;
      
      this.emit('bufferChanged', this.getState());
      return true;
    }
    return false;
  }

  /**
   * Redo last undone operation
   */
  redo(): boolean {
    if (this.redoStack.length > 0) {
      // Save current state to undo stack
      this.saveStateForUndo();
      
      // Restore next state
      const nextState = this.redoStack.pop()!;
      this.buffer = nextState.buffer;
      this.cursorPosition = nextState.cursorPosition;
      this.selectionStart = nextState.selectionStart;
      this.selectionEnd = nextState.selectionEnd;
      
      this.emit('bufferChanged', this.getState());
      return true;
    }
    return false;
  }

  /**
   * Find word boundary for cursor movement and word operations
   */
  private findWordBoundary(position: number, direction: 'left' | 'right'): number {
    const wordChars = /[a-zA-Z0-9_]/;
    let pos = position;

    if (direction === 'left') {
      // Move left to find start of word
      while (pos > 0 && !wordChars.test(this.buffer[pos - 1])) {
        pos--;
      }
      while (pos > 0 && wordChars.test(this.buffer[pos - 1])) {
        pos--;
      }
    } else {
      // Move right to find end of word
      while (pos < this.buffer.length && !wordChars.test(this.buffer[pos])) {
        pos++;
      }
      while (pos < this.buffer.length && wordChars.test(this.buffer[pos])) {
        pos++;
      }
    }

    return pos;
  }

  /**
   * Save current state for undo functionality
   */
  private saveStateForUndo(): void {
    this.undoStack.push(this.getState());
    if (this.undoStack.length > this.maxUndoSize) {
      this.undoStack.shift();
    }
    // Clear redo stack when new action is performed
    this.redoStack = [];
  }

  /**
   * Clear text selection
   */
  private clearSelection(): void {
    this.selectionStart = undefined;
    this.selectionEnd = undefined;
  }

  /**
   * Get command history
   */
  getHistory(): HistoryEntry[] {
    return [...this.historyBuffer];
  }

  /**
   * Clear command history
   */
  clearHistory(): void {
    this.historyBuffer = [];
    this.historyIndex = -1;
    this.temporaryBuffer = undefined;
  }

  /**
   * Clean shutdown
   */
  cleanup(): void {
    this.removeAllListeners();
    this.clearHistory();
    this.undoStack = [];
    this.redoStack = [];
  }
}