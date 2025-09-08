/**
 * REV-074: Enhanced Input Handler - Raw Terminal Input Management
 * 
 * This component replaces the problematic Ink raw mode handling with a robust,
 * direct terminal input system that provides precise control over keyboard input.
 */

import { EventEmitter } from 'events';

export interface KeyAction {
  name: string;
  data?: any;
}

export interface KeySequenceEvent {
  action: string;
  data?: any;
  rawSequence: string;
}

export interface CharacterInputEvent {
  character: string;
  keyCode: number;
}

export interface KeyMapping {
  sequence: string;
  action: string;
  description: string;
  context?: string[];
}

export class RawInputHandler extends EventEmitter {
  private stdin: NodeJS.ReadStream;
  private isRawMode = false;
  private inputBuffer: Buffer[] = [];
  private keySequenceMap: Map<string, KeyAction> = new Map();

  constructor() {
    super();
    this.stdin = process.stdin;
    this.setupDefaultKeyMappings();
  }

  /**
   * Enable raw mode for precise terminal input control
   */
  enableRawMode(): void {
    if (!this.isRawMode && this.stdin.isTTY) {
      this.stdin.setRawMode(true);
      this.stdin.resume();
      this.stdin.on('data', this.handleRawData.bind(this));
      this.isRawMode = true;
      this.emit('rawModeEnabled');
    }
  }

  /**
   * Disable raw mode and restore normal terminal behavior
   */
  disableRawMode(): void {
    if (this.isRawMode && this.stdin.isTTY) {
      this.stdin.setRawMode(false);
      this.stdin.removeAllListeners('data');
      this.stdin.pause();
      this.isRawMode = false;
      this.emit('rawModeDisabled');
    }
  }

  /**
   * Check if raw mode is currently active
   */
  isRawModeActive(): boolean {
    return this.isRawMode;
  }

  /**
   * Handle raw terminal input data
   */
  private handleRawData(data: Buffer): void {
    const keySequence = this.parseKeySequence(data);
    const action = this.keySequenceMap.get(keySequence);

    if (action) {
      this.emit('keyAction', {
        action: action.name,
        data: action.data,
        rawSequence: keySequence
      } as KeySequenceEvent);
    } else {
      // Handle regular character input
      const character = data.toString('utf-8');
      
      // Filter out control characters that aren't mapped actions
      if (this.isPrintableCharacter(character)) {
        this.emit('characterInput', {
          character,
          keyCode: data[0]
        } as CharacterInputEvent);
      }
    }
  }

  /**
   * Parse raw buffer data into recognizable key sequence string
   */
  private parseKeySequence(data: Buffer): string {
    // Convert buffer to hex string for consistent mapping
    return data.toString('hex');
  }

  /**
   * Check if a character is printable and should be handled as input
   */
  private isPrintableCharacter(char: string): boolean {
    // ASCII printable characters (32-126) and common Unicode characters
    const code = char.charCodeAt(0);
    return (code >= 32 && code <= 126) || code > 127;
  }

  /**
   * Set up default key mappings for common terminal operations
   */
  private setupDefaultKeyMappings(): void {
    const defaultMappings: KeyMapping[] = [
      // Navigation
      { sequence: '1b5b41', action: 'navigate_up', description: 'Navigate up (Arrow Up)' },
      { sequence: '1b5b42', action: 'navigate_down', description: 'Navigate down (Arrow Down)' },
      { sequence: '1b5b43', action: 'cursor_right', description: 'Move cursor right (Arrow Right)' },
      { sequence: '1b5b44', action: 'cursor_left', description: 'Move cursor left (Arrow Left)' },
      
      // Line operations
      { sequence: '01', action: 'cursor_home', description: 'Move to beginning of line (Ctrl+A)' },
      { sequence: '05', action: 'cursor_end', description: 'Move to end of line (Ctrl+E)' },
      
      // Text operations
      { sequence: '08', action: 'backspace', description: 'Backspace' },
      { sequence: '7f', action: 'backspace', description: 'Delete key' },
      { sequence: '15', action: 'clear_line', description: 'Clear entire line (Ctrl+U)' },
      { sequence: '0b', action: 'delete_word', description: 'Delete word backward (Ctrl+K)' },
      
      // Control operations
      { sequence: '0d', action: 'submit_input', description: 'Submit input (Enter)' },
      { sequence: '09', action: 'tab_complete', description: 'Tab completion' },
      { sequence: '03', action: 'interrupt', description: 'Interrupt (Ctrl+C)' },
      { sequence: '1a', action: 'suspend', description: 'Suspend (Ctrl+Z)' },
      { sequence: '1b', action: 'escape', description: 'Escape key' },
      
      // Approval workflow (context-specific)
      { sequence: '20', action: 'toggle_approval', description: 'Toggle task approval (Space)', context: ['approval'] },
      { sequence: '61', action: 'approve_all', description: 'Approve all tasks (A)', context: ['approval'] },
      { sequence: '6d', action: 'modify_plan', description: 'Modify execution plan (M)', context: ['approval'] },
      { sequence: '66', action: 'provide_feedback', description: 'Provide feedback (F)', context: ['approval'] },
      { sequence: '63', action: 'cancel_execution', description: 'Cancel execution (C)', context: ['approval'] },
      
      // UI controls
      { sequence: '0c', action: 'clear_screen', description: 'Clear screen (Ctrl+L)' },
      { sequence: '12', action: 'refresh_display', description: 'Refresh display (Ctrl+R)' },
    ];

    // Build key sequence map
    defaultMappings.forEach(mapping => {
      this.keySequenceMap.set(mapping.sequence, {
        name: mapping.action,
        data: { description: mapping.description, context: mapping.context }
      });
    });
  }

  /**
   * Add custom key mapping
   */
  addKeyMapping(mapping: KeyMapping): void {
    this.keySequenceMap.set(this.stringToHex(mapping.sequence), {
      name: mapping.action,
      data: { description: mapping.description, context: mapping.context }
    });
  }

  /**
   * Remove key mapping
   */
  removeKeyMapping(sequence: string): void {
    this.keySequenceMap.delete(this.stringToHex(sequence));
  }

  /**
   * Convert string sequence to hex for internal storage
   */
  private stringToHex(str: string): string {
    return Buffer.from(str, 'utf-8').toString('hex');
  }

  /**
   * Get all current key mappings (useful for debugging)
   */
  getKeyMappings(): Map<string, KeyAction> {
    return new Map(this.keySequenceMap);
  }

  /**
   * Clean shutdown
   */
  cleanup(): void {
    this.disableRawMode();
    this.removeAllListeners();
  }
}