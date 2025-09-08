/**
 * T013: PersistentInputState entity tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PersistentInputState } from '../../../src/cli/enhanced-ux/entities/persistent-input-state.js';

describe('PersistentInputState Entity Tests', () => {
  let inputState: PersistentInputState;

  beforeEach(() => {
    inputState = new PersistentInputState('/test/repo');
  });

  it('should initialize with empty buffer', () => {
    expect(inputState.buffer).toBe('');
    expect(inputState.cursorPosition).toBe(0);
    expect(inputState.activeRepository).toBe('/test/repo');
    expect(inputState.contextAware).toBe(true);
  });

  it('should update buffer and cursor', () => {
    inputState.insertText('hello world', 0);
    expect(inputState.buffer).toBe('hello world');
    expect(inputState.cursorPosition).toBe(11);
  });

  it('should maintain command history', () => {
    inputState.addToHistory('first command');
    inputState.addToHistory('second command');
    
    expect(inputState.history.commands).toHaveLength(2);
    expect(inputState.getPreviousCommand()).toBe('second command');
    expect(inputState.getPreviousCommand()).toBe('first command');
  });
});