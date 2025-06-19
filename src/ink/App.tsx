import React, { useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { MainMenu } from './components/MainMenu.js';
import { AgentContext } from './components/AgentContext.js';
import { Loading } from './components/Loading.js';
import { Init } from './components/Init.js';
import { ThreadManagement } from './components/ThreadManagement.js';
import { useStore } from './store.js';

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
    contextPath,
    setMode,
    setSelectedAgent,
    setQuery,
    reset
  } = useStore();

  // Handle keyboard input - only if TTY available
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
    
    if (key.escape && mode !== 'menu') {
      reset();
    }
  }, { isActive: process.stdin.isTTY });

  // Handle direct command mode
  useEffect(() => {
    if (command === 'init') {
      setMode('init');
    } else if (command && query) {
      const agents = ['backend', 'frontend', 'architect', 'design', 'cli'];
      // Normalize command to lowercase to handle case-insensitive inputs
      const normalizedCmd = command.toLowerCase();
      if (agents.includes(normalizedCmd)) {
        setSelectedAgent(normalizedCmd);
        setQuery(query);
        setMode('agent');
      } else {
        // Unknown command with query
        console.error(`Unknown command: ${command}`);
        console.error('Run "graphyn --help" for usage information');
        exit();
      }
    } else if (command && !query) {
      // Command without query (not init)
      const validCommands = ['backend', 'frontend', 'architect', 'design', 'cli', 'threads', 'auth', 'doctor'];
      if (!validCommands.includes(command)) {
        console.error(`Unknown command: ${command}`);
        console.error('Run "graphyn --help" for usage information');
        exit();
      }
    }
  }, [command, query, exit]);

  const handleMenuSelect = (value: string) => {
    switch (value) {
      case 'exit':
        exit();
        break;
      case 'backend':
      case 'frontend':
      case 'architect':
      case 'design':
      case 'cli':
        setSelectedAgent(value);
        setQuery('');
        setMode('agent');
        break;
      case 'threads':
        setMode('threads');
        break;
      case 'auth':
        setMode('auth');
        break;
      case 'doctor':
        setMode('doctor');
        break;
    }
  };


  // Loading state
  if (loading) {
    return <Loading message="Processing..." />;
  }

  // Error state
  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">❌ Error: {error}</Text>
        <Box marginTop={1}>
          <Text dimColor>Press ESC to return to menu</Text>
        </Box>
      </Box>
    );
  }

  // Mode-based rendering
  switch (mode) {
    case 'menu':
      return <MainMenu onSelect={handleMenuSelect} />;
    
    case 'init':
      return <Init />;
    
    case 'agent':
      return <AgentContext agent={selectedAgent} query={query} />;
    
    case 'threads':
      return <ThreadManagement />;
    
    case 'auth':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>Authentication</Text>
          <Text color="gray">Coming soon...</Text>
          <Box marginTop={1}>
            <Text dimColor>Press ESC to return to menu</Text>
          </Box>
        </Box>
      );
    
    case 'doctor':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>System Check</Text>
          <Text color="gray">Coming soon...</Text>
          <Box marginTop={1}>
            <Text dimColor>Press ESC to return to menu</Text>
          </Box>
        </Box>
      );
    
    default:
      return null;
  }
};