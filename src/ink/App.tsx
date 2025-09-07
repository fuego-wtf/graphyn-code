import React, { useEffect, useState, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { MainMenu } from './components/MainMenu.js';
import { AgentContext } from './components/AgentContext.js';
import { Loading } from './components/Loading.js';
import { Authentication } from './components/Authentication.js';
import { FigmaDesign } from './components/FigmaDesign.js';
import { FigmaAuth } from './components/FigmaAuth.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { ErrorFallback } from './components/ErrorFallback.js';
import { AgentRevival } from './components/AgentRevival.js';
import { RepositoryAnalysis } from './components/RepositoryAnalysis.js';
import { MultiAgentOrchestrator } from './components/MultiAgentOrchestrator.js';
import { EnhancedMissionControl } from './components/EnhancedMissionControl.js';
import { TerminalFrame } from './components/TerminalFrame.js';
import { useAPI } from './hooks/useAPI.js';
import { AutoSetup } from './components/AutoSetup.js';
import { useErrorHandler } from './hooks/useErrorHandler.js';
import { useStore, AppMode } from './store.js';
import { initGraphynFolder } from '../utils/graphyn-folder.js';
import { runDoctor } from '../utils/doctor.js';
import { AGENT_TYPES, isAgentType } from '../constants/agents.js';
import { ConfigManager } from '../config-manager.js';
import { debug } from '../utils/debug.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import fs from 'fs';
import path from 'path';

interface AppProps {
  command?: string;
  query?: string;
}

export const App: React.FC<AppProps> = ({ command, query }) => {
  // Debug logging right at component start
  if (process.env.DEBUG_GRAPHYN) {
    console.log('=== App Component Started ===');
    console.log('Props received:');
    console.log('- command:', JSON.stringify(command));
    console.log('- query:', JSON.stringify(query));
    console.log('- typeof command:', typeof command);
    console.log('- typeof query:', typeof query);
  }
  
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
  
  // Update store state for squad queries (for consistency)
  if (command === 'squad' && mode !== 'squad') {
    setMode('squad');
    setQuery(query || '');
  }

  // Debug current state immediately
  if (process.env.DEBUG_GRAPHYN) {
    console.log('🔍 Current state:');
    console.log('- mode:', mode);
    console.log('- selectedAgent:', selectedAgent);
    console.log('- loading:', loading);
    console.log('- error:', error);
  }
  
  // Squad mode is handled in the main useEffect below
  
  // Debug mode changes
  useEffect(() => {
    if (process.env.DEBUG_GRAPHYN) {
      console.log('🎯 Mode changed to:', mode);
    }
  }, [mode]);
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

  // Clear screen function
  const clearScreen = useCallback(() => {
    console.clear();
  }, []);

  // Refresh current view
  const refreshView = useCallback(() => {
    // Trigger a re-render by clearing error or resetting state
    if (error) {
      clearError();
    }
    // Force re-render by toggling a state
    setIsInitialized(prev => !prev);
    setTimeout(() => setIsInitialized(prev => !prev), 10);
  }, [error, clearError]);

  // Global keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      // Global clear screen
      {
        key: 'l',
        ctrl: true,
        handler: clearScreen,
        description: 'Clear screen',
        enabled: true,
      },
      // Global refresh
      {
        key: 'r',
        ctrl: true,
        handler: refreshView,
        description: 'Refresh view',
        enabled: true,
      },
      // Exit on Ctrl+C
      {
        key: 'c',
        ctrl: true,
        handler: () => exit(),
        enabled: true,
      },
      // Escape to go back
      {
        key: 'escape',
        handler: () => {
          if (mode !== 'menu') {
            reset();
            clearError();
          }
        },
        enabled: true,
      },
      // Retry on error
      {
        key: 'r',
        handler: () => {
          if (error) {
            clearError();
            reset();
          }
        },
        enabled: !!error,
      },
      // Future: Command palette (placeholder)
      {
        key: 'k',
        ctrl: true,
        handler: () => {
          // TODO: Implement command palette in future
          console.log('Command palette coming soon!');
        },
        description: 'Command palette (coming soon)',
        enabled: false, // Disabled for now
      },
    ],
    enabled: process.stdin.isTTY !== false,
  });

  // Legacy input handler disabled
  useInput(() => {});

  // Handle direct command mode
  useEffect(() => {
    // Debug logging
    if (process.env.DEBUG_GRAPHYN) {
      console.log('🔍 useEffect triggered with dependencies:');
      console.log('- command:', command);
      console.log('- query:', query);
      console.log('- current mode:', mode);
    }
    
    // Check if graphyn was called without any arguments - show menu
    if (!command && !query) {
      if (process.env.DEBUG_GRAPHYN) {
        console.log('→ Taking no command/query path - showing menu');
      }
      // Show menu when no arguments provided
      setMode('menu');
    } else if (command === 'design' && query === 'auth') {
      if (process.env.DEBUG_GRAPHYN) {
        console.log('→ Taking figma auth path');
      }
      // Special case: Figma OAuth authentication
      setMode('figma-auth');
    } else if (command === 'design' && query === 'logout') {
      if (process.env.DEBUG_GRAPHYN) {
        console.log('→ Taking figma logout path');
      }
      // Special case: Figma logout
      setMode('figma-logout');
    } else if (command && query) {
      if (process.env.DEBUG_GRAPHYN) {
        console.log('→ Taking command + query path, checking command:', command);
      }
      // Normalize command to lowercase to handle case-insensitive inputs
      const normalizedCmd = command.toLowerCase();
      if (normalizedCmd === 'design' && query.includes('figma.com')) {
        // Special case: Figma URL - use FigmaDesign component
        setSelectedAgent('design');
        setQuery(query);
        setMode('figma-design');
      } else if (normalizedCmd === 'squad') {
        // Natural language query - use multi-agent orchestration
        if (process.env.DEBUG_GRAPHYN) {
          console.log('✓ Squad mode detected! Setting mode to squad with query:', query);
          console.log('📝 About to call setQuery and setMode...');
        }
        setQuery(query);
        setMode('squad');
        if (process.env.DEBUG_GRAPHYN) {
          console.log('✅ setQuery and setMode called successfully');
        }
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
      if (process.env.DEBUG_GRAPHYN) {
        console.log('→ Taking command without query path:', command);
      }
      // Command without query - auth commands removed
      const directCommands: Record<string, AppMode> = {
        // All auth commands removed - no authentication required
      };
      
      // Debug logging
      debug('command:', command);
      debug('directCommands:', Object.keys(directCommands));
      
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
  }, [command, query, exit, setMode, setQuery, setSelectedAgent]);

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
        // Auth disabled - redirect to menu
        setMode('menu');
        break;
      case 'analyze':
        // Launch repository analysis
        setMode('analyze');
        break;
      case 'revive':
        // Launch agent revival in builder mode with special context
        setMode('agentRevival' as AppMode);
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
    // Override mode based on props for squad commands
    const effectiveMode = (command === 'squad') ? 'squad' : mode;
    const effectiveQuery = (command === 'squad') ? query : '';
    
    if (process.env.DEBUG_GRAPHYN) {
      console.log('📺 Rendering with mode:', effectiveMode, 'query:', effectiveQuery || '');
      console.log('  - original mode from store:', mode);
      console.log('  - command prop:', command);
    }
    
    // For direct agent commands, skip store state and render directly
    if (isDirectAgentCommand && !selectedAgent) {
      return <AgentContext agent={initialAgent} query={initialQuery} />;
    }
    
    switch (effectiveMode) {
      case 'menu':
        return <MainMenu onSelect={handleMenuSelect} />;
      case 'agent':
        return <AgentContext agent={selectedAgent} query={query || ''} />;
      case 'auth':
        // Auth is disabled - redirect to menu immediately
        return <MainMenu onSelect={handleMenuSelect} />;
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
      
      case 'agentRevival':
        // Agent revival flow
        return <AgentRevival onComplete={() => setMode('menu')} />;
      
      case 'analyze':
        // Repository analysis flow
        return <RepositoryAnalysis onComplete={() => setMode('menu')} />;
      
      case 'squad':
        // Enhanced Mission Control for natural language queries - optimized for customer demonstrations
        if (process.env.DEBUG_GRAPHYN) {
          console.log('✓ Rendering EnhancedMissionControl with query:', effectiveQuery);
        }
        return <EnhancedMissionControl query={effectiveQuery || ''} onComplete={() => setMode('menu')} />;
      
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