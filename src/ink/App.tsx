import React, { useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { MainMenu } from './components/MainMenu.js';
import { AgentContextV2 } from './components/AgentContextV2.js';
import { Loading } from './components/Loading.js';
import { Init } from './components/Init.js';
import { ThreadManagementV2 } from './components/ThreadManagementV2.js';
import { AuthenticationV2 } from './components/AuthenticationV2.js';
import { Doctor } from './components/Doctor.js';
import { ShareAgent } from './components/ShareAgent.js';
import { History } from './components/History.js';
import { Status } from './components/Status.js';
import { Sync } from './components/Sync.js';
import { Monitor } from './components/Monitor.js';
import { AgentCollaboration } from './components/AgentCollaboration.js';
import { FigmaDesign } from './components/FigmaDesign.js';
import { FigmaAuth } from './components/FigmaAuth.js';
import { AgentCommands } from './components/AgentCommands.js';
import { ThreadCommand } from './components/ThreadCommand.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { ErrorFallback } from './components/ErrorFallback.js';
import { useErrorHandler } from './hooks/useErrorHandler.js';
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
  const { handleError, clearError } = useErrorHandler();

  // Handle keyboard input - only if TTY available
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
    
    if (key.escape && mode !== 'menu') {
      reset();
      clearError();
    }

    // Add R key for retry when error is shown
    if (input === 'r' && error) {
      clearError();
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
    } else if (command === 'design' && query === 'auth') {
      // Special case: Figma OAuth authentication
      setMode('figma-auth');
    } else if (command === 'design' && query === 'logout') {
      // Special case: Figma logout
      setMode('figma-logout');
    } else if (command === 'agent' && query) {
      // Handle agent commands
      const [subCommand, ...args] = query.split(' ');
      if (['list', 'test', 'deploy'].includes(subCommand)) {
        setMode('agent-command');
        setQuery(query);
      } else {
        console.error('Invalid agent command. Use: list, test <id>, or deploy <id>');
        exit();
      }
    } else if (command === 'thread') {
      // Handle thread command
      setMode('thread');
      setQuery(query || '');
    } else if (command && query) {
      const agents = ['backend', 'frontend', 'architect', 'design', 'cli'];
      // Normalize command to lowercase to handle case-insensitive inputs
      const normalizedCmd = command.toLowerCase();
      if (normalizedCmd === 'design' && query.includes('figma.com')) {
        // Special case: Figma URL - use FigmaDesign component
        setSelectedAgent('design');
        setQuery(query);
        setMode('figma-design');
      } else if (agents.includes(normalizedCmd)) {
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

  // Mode-based rendering with error boundary
  const renderContent = () => {
    switch (mode) {
      case 'menu':
        return <MainMenu onSelect={handleMenuSelect} />;
      
      case 'init':
        return <Init />;
      
      case 'agent':
        return <AgentContextV2 agent={selectedAgent} query={query || ''} />;
      
      case 'threads':
        return <ThreadManagementV2 />;
      
      case 'auth':
        return <AuthenticationV2 />;
      
      case 'doctor':
        return <Doctor />;
        
      case 'share':
        return <ShareAgent />;
        
      case 'history':
        return <History />;
        
      case 'status':
        return <Status />;
        
      case 'sync':
        return <Sync />;
        
      case 'monitor':
        return <Monitor />;
        
      case 'collaborate':
        return <AgentCollaboration query={query || ''} agents={['backend', 'frontend', 'architect']} />;
        
      case 'figma-design':
        return <FigmaDesign url={query || ''} framework="react" />;
        
      case 'figma-auth':
        return <FigmaAuth />;
        
      case 'figma-logout':
        // Handle logout inline without complex imports
        import('fs').then((fs) => {
          import('path').then((path) => {
            import('os').then((os) => {
              const configPath = path.join(os.homedir(), '.graphyn', 'config.json');
              try {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                // Remove all Figma-related data
                delete config['figma.oauth'];
                delete config['figma'];
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                console.log('✅ Logged out from Figma');
              } catch (e) {
                console.log('✅ Already logged out from Figma');
              }
              exit();
            });
          });
        });
        return <Loading message="Logging out from Figma..." />;
      
      case 'agent-command':
        const [subCommand, ...args] = (query || '').split(' ');
        return <AgentCommands command={subCommand as any} agentId={args[0]} />;
      
      case 'thread':
        return <ThreadCommand threadId={query} />;
      
      default:
        return null;
    }
  };

  return (
    <ErrorBoundary 
      fallback={
        <ErrorFallback 
          error={new Error('Application crashed')} 
          resetError={() => {
            clearError();
            reset();
          }}
        />
      }
    >
      {renderContent()}
    </ErrorBoundary>
  );
};