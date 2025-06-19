import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput, Newline } from 'ink';
import Spinner from 'ink-spinner';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
import SelectInput from 'ink-select-input';
import { useStore } from './store.js';
import { AgentContext } from './components/AgentContext.js';

// Main menu items
const menuItems = [
  { label: 'Backend Agent', value: 'backend' },
  { label: 'Frontend Agent', value: 'frontend' },
  { label: 'Architect Agent', value: 'architect' },
  { label: 'Design Agent', value: 'design' },
  { label: 'CLI Agent', value: 'cli' },
  { label: 'Manage Threads', value: 'threads' },
  { label: 'Authentication', value: 'auth' },
  { label: 'Exit', value: 'exit' },
];

interface AppProps {
  command?: string;
  query?: string;
}

export const App: React.FC<AppProps> = ({ command, query }) => {
  const { exit } = useApp();
  const {
    mode,
    selectedAgent,
    loading,
    error,
    contextPrepared,
    setMode,
    setSelectedAgent,
    setLoading,
    setError,
    setContextPrepared,
  } = useStore();

  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape || (key.ctrl && input === 'c')) {
      exit();
    }
    
    if (mode === 'agent' && key.return && contextPrepared) {
      exit();
    }
  });

  // Auto-execute if command provided
  useEffect(() => {
    if (command && query) {
      setSelectedAgent(command);
      setMode('agent');
      // Prepare context logic will go here
    }
  }, [command, query]);

  const handleMenuSelect = (item: { value: string }) => {
    if (item.value === 'exit') {
      exit();
    } else if (item.value === 'threads') {
      setMode('thread');
    } else if (item.value === 'auth') {
      setMode('auth');
    } else {
      setSelectedAgent(item.value);
      setMode('agent');
    }
  };

  // Render different screens based on mode
  if (mode === 'menu') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Gradient name="rainbow">
            <BigText text="GRAPHYN" font="chrome" />
          </Gradient>
        </Box>
        
        <Text color="gray">
          AI Development Tool for Claude Code
        </Text>
        <Newline />
        
        <Text bold>Select an option:</Text>
        <Box marginTop={1}>
          <SelectInput items={menuItems} onSelect={handleMenuSelect} />
        </Box>
        
        <Box marginTop={2}>
          <Text dimColor>
            Use arrow keys to navigate, Enter to select, Esc to exit
          </Text>
        </Box>
      </Box>
    );
  }

  if (mode === 'agent' && selectedAgent && query) {
    return <AgentContext agent={selectedAgent} query={query} />;
  }

  if (mode === 'agent' && loading) {
    return (
      <Box padding={1}>
        <Text>
          <Spinner type="dots" /> Preparing {selectedAgent} agent context...
        </Text>
      </Box>
    );
  }

  if (mode === 'agent' && error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">❌ Error: {error}</Text>
        <Text dimColor>Press Esc to return to menu</Text>
      </Box>
    );
  }

  if (mode === 'agent' && contextPrepared) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="green">✅ Context prepared successfully!</Text>
        <Newline />
        <Text>Launch Claude Code with:</Text>
        <Box marginLeft={2} flexDirection="column">
          <Text color="cyan">claude "Your query here..."</Text>
          <Text dimColor>or</Text>
          <Text color="cyan">claude /read /tmp/graphyn-context.md</Text>
        </Box>
        <Newline />
        <Text dimColor>Press Enter to exit</Text>
      </Box>
    );
  }

  if (mode === 'thread') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Thread Management</Text>
        <Text color="gray">Coming soon...</Text>
        <Newline />
        <Text dimColor>Press Esc to return to menu</Text>
      </Box>
    );
  }

  if (mode === 'auth') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Authentication</Text>
        <Text color="gray">Coming soon...</Text>
        <Newline />
        <Text dimColor>Press Esc to return to menu</Text>
      </Box>
    );
  }

  return null;
};