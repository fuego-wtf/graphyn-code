import React, { useEffect, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { MainMenu } from './components/MainMenu.js';
import { AgentContext } from './components/AgentContext.js';
import { Loading } from './components/Loading.js';
import { Authentication } from './components/Authentication.js';
import { FigmaDesign } from './components/FigmaDesign.js';
import { FigmaAuth } from './components/FigmaAuth.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { ErrorFallback } from './components/ErrorFallback.js';
import { TerminalFrame } from './components/TerminalFrame.js';
import { SquadBuilder } from './components/SquadBuilder.js';
import { SquadBuilderWithFlow } from './components/SquadBuilderWithFlow.js';
import { useAPI } from './hooks/useAPI.js';
import { AutoSetup } from './components/AutoSetup.js';
import { useErrorHandler } from './hooks/useErrorHandler.js';
import { useStore, AppMode } from './store.js';
import { initGraphynFolder } from '../utils/graphyn-folder.js';
import { runDoctor } from '../utils/doctor.js';
import { AGENT_TYPES, isAgentType } from '../constants/agents.js';
import { ConfigManager } from '../config-manager.js';
import fs from 'fs';
import path from 'path';

interface AppProps {
  command?: string;
  query?: string;
}

export const App: React.FC<AppProps> = ({ command, query }) => {
  const { exit } = useApp();
  
  // Check for direct agent command early
  const isDirectAgentCommand = command && query && isAgentType(command);
  const initialMode = isDirectAgentCommand ? 'agent' : 'menu';
  const initialAgent = isDirectAgentCommand ? command : '';
  const initialQuery = isDirectAgentCommand ? query : '';
  
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
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  // Auto-initialize .graphyn folder on startup
  // Check if first run
  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  
  useEffect(() => {
    const checkAndInitialize = async () => {
      try {
        const graphynPath = path.join(process.cwd(), '.graphyn');
        if (!fs.existsSync(graphynPath)) {
          // Initialize the folder silently
          await initGraphynFolder();
        }
        setIsInitialized(true);
        
        // Check if this is first run (no global config)
        const configPath = path.join(process.env.HOME || '', '.graphyn', 'config.json');
        const firstRun = !fs.existsSync(configPath);
        setIsFirstRun(firstRun);
        
        // Run doctor check if first run and not direct command
        if (firstRun && !isDirectAgentCommand) {
          const doctorResult = await runDoctor();
          setNeedsSetup(doctorResult.needsClaudeCode || !doctorResult.canProceed);
          
          // Show setup mode for first run
          if (!command && !query) {
            setMode('setup' as AppMode);
          }
        }
      } catch (error) {
        // Silently handle errors - don't block the app
        console.error('Failed to initialize:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    checkAndInitialize();
  }, []);

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
    // Check if graphyn was called without any arguments - show menu
    if (!command && !query) {
      // Show menu when no arguments provided
      setMode('menu');
    } else if (command === 'design' && query === 'auth') {
      // Special case: Figma OAuth authentication
      setMode('figma-auth');
    } else if (command === 'design' && query === 'logout') {
      // Special case: Figma logout
      setMode('figma-logout');
    } else if (command && query) {
      // Normalize command to lowercase to handle case-insensitive inputs
      const normalizedCmd = command.toLowerCase();
      if (normalizedCmd === 'squad') {
        // Natural language query - use SquadBuilder
        setQuery(query);
        setMode('squad');
      } else if (normalizedCmd === 'design' && query.includes('figma.com')) {
        // Special case: Figma URL - use FigmaDesign component
        setSelectedAgent('design');
        setQuery(query);
        setMode('figma-design');
      } else if (isAgentType(normalizedCmd)) {
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
        'auth': 'auth',
        'whoami': 'auth',
        'logout': 'auth'
      };
      
      // Debug logging
      console.log('Debug - command:', command);
      console.log('Debug - directCommands:', Object.keys(directCommands));
      
      if (directCommands[command]) {
        setMode(directCommands[command]);
      } else if (isAgentType(command)) {
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
        // Force exit if Ink doesn't exit properly
        setTimeout(() => {
          process.exit(0);
        }, 100);
        break;
      case 'auth':
        setMode('auth');
        break;
      case 'analyze':
        // Launch builder mode for analyzing repository
        setMode('builder');
        break;
      case 'connect':
        // Show authentication screen for connecting accounts
        setMode('auth');
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
        <Text color="red">✗ Error: {error}</Text>
        <Box marginTop={1}>
          <Text color="gray">Press ESC to return to menu</Text>
        </Box>
      </Box>
    );
  }

  // Mode-based rendering with error boundary
  const renderContent = () => {
    // For direct agent commands, skip store state and render directly
    if (isDirectAgentCommand && !selectedAgent) {
      return <AgentContext agent={initialAgent} query={initialQuery} />;
    }
    
    switch (mode) {
      case 'menu':
        return <MainMenu onSelect={handleMenuSelect} />;
      case 'agent':
        return <AgentContext agent={selectedAgent} query={query || ''} />;
      case 'auth':
        return <Authentication />;
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
                console.log('✓ Logged out from Figma');
              } catch (e) {
                console.log('✓ Already logged out from Figma');
              }
              exit();
            });
          });
        });
        return <Loading message="Logging out from Figma..." />;
      
      case 'squad':
        return <SquadBuilderWithFlow query={query || ''} />;
        
      case 'builder':
        // Dynamic import to avoid circular dependencies
        const BuilderAgent = React.lazy(() => import('./components/BuilderAgent.js').then(m => ({ default: m.BuilderAgent })));
        return (
          <React.Suspense fallback={<Loading message="Loading builder agent..." />}>
            <BuilderAgent />
          </React.Suspense>
        );
      
      case 'builder-auth':
        // Show auth flow specifically for builder mode
        return <Authentication returnToBuilder={true} />;
      
      case 'setup':
        // Auto-setup flow for first run
        return <AutoSetup onComplete={() => setMode('menu')} />;
      
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