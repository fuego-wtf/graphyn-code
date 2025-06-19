import React, { useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { MainMenu } from './components/MainMenu.js';
import { AgentContext } from './components/AgentContext.js';
import { AgentContextV2 } from './components/AgentContextV2.js';
import { Loading } from './components/Loading.js';
import { Init } from './components/Init.js';
import { ThreadManagement } from './components/ThreadManagement.js';
import { ThreadManagementV2 } from './components/ThreadManagementV2.js';
import { Authentication } from './components/Authentication.js';
import { AuthenticationV2 } from './components/AuthenticationV2.js';
import { Doctor } from './components/Doctor.js';
import { ShareAgent } from './components/ShareAgent.js';
import { History } from './components/History.js';
import { Status } from './components/Status.js';
import { Sync } from './components/Sync.js';
import { Monitor } from './components/Monitor.js';
import { AgentCollaboration } from './components/AgentCollaboration.js';
import { useStore, AppMode } from './store.js';

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
    } else if (command === 'share' && query === 'agent') {
      setMode('share');
    } else if (command === 'sync' && query) {
      setMode('sync');
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
      // Command without query
      const directCommands: Record<string, AppMode> = {
        'threads': 'threads',
        'auth': 'auth',
        'doctor': 'doctor',
        'status': 'status',
        'history': 'history',
        'whoami': 'auth',
        'logout': 'auth'
      };
      
      if (directCommands[command]) {
        setMode(directCommands[command]);
      } else if (['backend', 'frontend', 'architect', 'design', 'cli'].includes(command)) {
        // Agent without query - interactive mode
        console.error(`Agent command requires a query: graphyn ${command} <query>`);
        console.error('Or run "graphyn" for interactive mode');
        exit();
      } else {
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
      return <AgentContextV2 agent={selectedAgent} query={query} />;
    
    case 'threads':
      return <ThreadManagementV2 />;
    
    case 'auth':
      return <AuthenticationV2 />;
    
    case 'doctor':
      return <Doctor />;
    
    default:
      return null;
  }
};