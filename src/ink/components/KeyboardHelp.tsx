import React from 'react';
import { Box, Text } from 'ink';

interface KeyBinding {
  keys: string;
  description: string;
  context?: string;
}

interface KeyboardHelpProps {
  context?: 'global' | 'menu' | 'input' | 'thread' | 'auth';
  inline?: boolean;
}

const keyBindings: Record<string, KeyBinding[]> = {
  global: [
    { keys: '↑↓', description: 'Navigate' },
    { keys: '↵', description: 'Select/Confirm' },
    { keys: 'ESC', description: 'Go back' },
    { keys: 'Ctrl+C', description: 'Exit' },
    { keys: '?', description: 'Show help' }
  ],
  menu: [
    { keys: '↑↓', description: 'Navigate menu' },
    { keys: '↵', description: 'Select item' },
    { keys: 'ESC', description: 'Return to main menu' },
    { keys: '/', description: 'Search (coming soon)' }
  ],
  input: [
    { keys: '←→', description: 'Move cursor' },
    { keys: 'Backspace', description: 'Delete character' },
    { keys: '↵', description: 'Submit' },
    { keys: 'ESC', description: 'Cancel' },
    { keys: 'Ctrl+U', description: 'Clear input' }
  ],
  thread: [
    { keys: '↑↓', description: 'Navigate threads' },
    { keys: '↵', description: 'View thread' },
    { keys: 'n', description: 'New thread' },
    { keys: 'd', description: 'Delete thread' },
    { keys: 'p', description: 'Manage participants' }
  ],
  auth: [
    { keys: '↑↓', description: 'Select auth method' },
    { keys: '↵', description: 'Confirm' },
    { keys: 'Tab', description: 'Next field' },
    { keys: 'Shift+Tab', description: 'Previous field' }
  ]
};

export const KeyboardHelp: React.FC<KeyboardHelpProps> = ({ context = 'global', inline = false }) => {
  const bindings = keyBindings[context] || keyBindings.global;
  
  if (inline) {
    return (
      <Box>
        <Text dimColor>
          {bindings.slice(0, 3).map((kb, i) => (
            <Text key={i}>
              {i > 0 && '  '}
              <Text color="cyan">{kb.keys}</Text> {kb.description}
            </Text>
          ))}
        </Text>
      </Box>
    );
  }
  
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1}>
      <Text bold>⌨️  Keyboard Shortcuts</Text>
      <Box marginTop={1} flexDirection="column">
        {bindings.map((kb, i) => (
          <Box key={i}>
            <Box width={12}>
              <Text color="cyan">{kb.keys}</Text>
            </Box>
            <Text>{kb.description}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
};