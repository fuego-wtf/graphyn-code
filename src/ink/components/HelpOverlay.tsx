import React from 'react';
import { Box, Text } from 'ink';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';

interface HelpOverlayProps {
  shortcuts: Array<{
    keys: string;
    description: string;
  }>;
  onClose: () => void;
  title?: string;
}

export const HelpOverlay: React.FC<HelpOverlayProps> = ({
  shortcuts,
  onClose,
  title = 'Keyboard Shortcuts',
}) => {
  // Close on escape or ?
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: ['escape', '?'],
        handler: onClose,
        description: 'Close help',
      },
    ],
  });

  // Group shortcuts by category (if they have categories)
  const maxKeyWidth = Math.max(...shortcuts.map(s => s.keys.length));

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="yellow"
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text bold color="yellow">
          {title}
        </Text>
      </Box>

      {shortcuts.map((shortcut, index) => (
        <Box key={index} marginBottom={index === shortcuts.length - 1 ? 0 : 0}>
          <Box width={maxKeyWidth + 2}>
            <Text color="cyan">{shortcut.keys}</Text>
          </Box>
          <Text color="gray">→ </Text>
          <Text>{shortcut.description}</Text>
        </Box>
      ))}

      <Box marginTop={1}>
        <Text dimColor italic>
          Press ESC or ? to close
        </Text>
      </Box>
    </Box>
  );
};