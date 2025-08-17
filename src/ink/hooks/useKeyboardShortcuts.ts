import { useEffect, useCallback } from 'react';
import { useInput, Key } from 'ink';

export interface ShortcutHandler {
  key: string | string[];
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
  handler: () => void;
  description?: string;
  enabled?: boolean;
}

export interface UseKeyboardShortcutsOptions {
  shortcuts: ShortcutHandler[];
  enabled?: boolean;
  preventDefault?: boolean;
}

/**
 * Hook for managing keyboard shortcuts in Ink components
 */
export const useKeyboardShortcuts = ({
  shortcuts,
  enabled = true,
  preventDefault = true,
}: UseKeyboardShortcutsOptions) => {
  const handleInput = useCallback(
    (input: string, key: Key) => {
      if (!enabled) return;

      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue;

        // Check modifier keys
        if (shortcut.ctrl && !key.ctrl) continue;
        if (shortcut.shift && !key.shift) continue;
        if (shortcut.meta && !key.meta) continue;

        // Check if the key matches
        const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key];
        let keyMatches = false;

        for (const k of keys) {
          if (k === input) {
            keyMatches = true;
            break;
          }
          
          // Check special keys
          if (key.tab && k === 'tab') {
            keyMatches = true;
            break;
          }
          if (key.return && (k === 'return' || k === 'enter')) {
            keyMatches = true;
            break;
          }
          if (key.escape && (k === 'escape' || k === 'esc')) {
            keyMatches = true;
            break;
          }
          if (key.upArrow && (k === 'up' || k === 'upArrow')) {
            keyMatches = true;
            break;
          }
          if (key.downArrow && (k === 'down' || k === 'downArrow')) {
            keyMatches = true;
            break;
          }
          if (key.leftArrow && (k === 'left' || k === 'leftArrow')) {
            keyMatches = true;
            break;
          }
          if (key.rightArrow && (k === 'right' || k === 'rightArrow')) {
            keyMatches = true;
            break;
          }
          if (key.pageUp && k === 'pageUp') {
            keyMatches = true;
            break;
          }
          if (key.pageDown && k === 'pageDown') {
            keyMatches = true;
            break;
          }
          if (key.delete && (k === 'delete' || k === 'del')) {
            keyMatches = true;
            break;
          }
          if (key.backspace && k === 'backspace') {
            keyMatches = true;
            break;
          }
        }

        if (keyMatches) {
          shortcut.handler();
          if (preventDefault) {
            return;
          }
        }
      }
    },
    [shortcuts, enabled, preventDefault]
  );

  useInput(handleInput);

  // Return helper functions
  return {
    getShortcutDescriptions: () => {
      return shortcuts
        .filter(s => s.description && s.enabled !== false)
        .map(s => {
          const keys = Array.isArray(s.key) ? s.key : [s.key];
          const keyStr = keys.map(k => {
            let str = '';
            if (s.ctrl) str += 'Ctrl+';
            if (s.shift) str += 'Shift+';
            if (s.meta) str += 'Cmd+';
            str += k.toUpperCase();
            return str;
          }).join(' or ');
          
          return {
            keys: keyStr,
            description: s.description!,
          };
        });
    },
  };
};

// Export common shortcut definitions for consistency
export const commonShortcuts = {
  search: { key: '/', description: 'Search/Filter' },
  help: { key: '?', description: 'Show help' },
  tab: { key: 'tab', description: 'Next item' },
  shiftTab: { key: 'tab', shift: true, description: 'Previous item' },
  escape: { key: 'escape', description: 'Go back/Cancel' },
  enter: { key: 'enter', description: 'Select/Confirm' },
  clear: { key: 'l', ctrl: true, description: 'Clear screen' },
  refresh: { key: 'r', ctrl: true, description: 'Refresh' },
  quit: { key: 'q', description: 'Quit' },
  commandPalette: { key: 'k', ctrl: true, description: 'Command palette' },
} as const;