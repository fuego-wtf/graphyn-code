import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts.js';

interface InlineSearchProps {
  onSearch: (query: string) => void;
  onClose: () => void;
  placeholder?: string;
  initialValue?: string;
}

export const InlineSearch: React.FC<InlineSearchProps> = ({
  onSearch,
  onClose,
  placeholder = 'Search...',
  initialValue = '',
}) => {
  const [query, setQuery] = useState(initialValue);

  // Handle search changes
  useEffect(() => {
    onSearch(query);
  }, [query, onSearch]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 'escape',
        handler: onClose,
        description: 'Close search',
      },
      {
        key: 'enter',
        handler: onClose,
        description: 'Confirm search',
      },
    ],
  });

  return (
    <Box borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text color="cyan">🔍 </Text>
      <TextInput
        value={query}
        onChange={setQuery}
        placeholder={placeholder}
        showCursor
      />
    </Box>
  );
};