/**
 * Clyde Mission Control Bridge
 * Integrates ClydeOrchestrator with Mission Control UI
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { ClydeOrchestrator } from '../../clyde/index.js';

interface ClydeMissionControlBridgeProps {
  query: string;
  onComplete?: () => void;
}

export const ClydeMissionControlBridge: React.FC<ClydeMissionControlBridgeProps> = ({ 
  query, 
  onComplete 
}) => {
  const [clyde] = useState(() => new ClydeOrchestrator());
  const [isInitialized, setIsInitialized] = useState(false);
  const [claudeOutput, setClaudeOutput] = useState('');
  const [systemLogs, setSystemLogs] = useState<string[]>([]);
  const [activeStage, setActiveStage] = useState<string>('initialization');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Input handling for new queries
  const [inputMode, setInputMode] = useState(false);
  const [newQuery, setNewQuery] = useState('');
  const [queryHistory, setQueryHistory] = useState<string[]>([query]);
  const [currentQuery, setCurrentQuery] = useState(query);

  // Initialize Clyde on mount
  useEffect(() => {
    const initClyde = async () => {
      try {
        setSystemLogs(prev => [...prev, '🤖 Initializing Clyde orchestrator...']);
        await clyde.initialize();
        setIsInitialized(true);
        setSystemLogs(prev => [...prev, '✅ Clyde initialized successfully']);
        setActiveStage('ready');
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to initialize Clyde');
        setSystemLogs(prev => [...prev, `❌ Clyde initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
        setActiveStage('error');
      }
    };

    initClyde();
  }, []);

  // Execute query when initialized
  useEffect(() => {
    if (isInitialized && query && !isRunning) {
      executeQuery(query);
    }
  }, [isInitialized, query]);

  /**
   * Execute query through Clyde with repository context
   */
  const executeQuery = async (queryText: string) => {
    setIsRunning(true);
    setError(null);
    setClaudeOutput('');
    setSystemLogs(prev => [...prev, `🚀 Executing query through Clyde: "${queryText}"`]);
    setActiveStage('execution');

    try {
      // Route directly through Clyde's executeCommand - this will handle context building,
      // intent parsing, and routing to the appropriate engine with Mission Control support
      setSystemLogs(prev => [...prev, '🧠 Processing through Clyde smart coordinator...']);
      
      // Store original stdout for capturing output
      const originalStdout = process.stdout.write;
      let capturedOutput = '';
      
      // Capture output from Clyde execution
      process.stdout.write = function(chunk: any, encoding?: any, callback?: any) {
        if (typeof chunk === 'string') {
          capturedOutput += chunk;
          setClaudeOutput(prev => prev + chunk);
        }
        return originalStdout.call(this, chunk, encoding, callback);
      };

      try {
        // Execute through Clyde - this will route to Mission Control execution if it's a natural language query
        await clyde.executeCommand(queryText);
        
        setSystemLogs(prev => [...prev, '✅ Clyde execution completed successfully']);
        setActiveStage('complete');
        
      } finally {
        // Restore original stdout
        process.stdout.write = originalStdout;
      }

      setIsRunning(false);

    } catch (error) {
      setIsRunning(false);
      setError(error instanceof Error ? error.message : 'Unknown error');
      setSystemLogs(prev => [...prev, `❌ Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
      setActiveStage('error');
    }
  };


  // Handle keyboard input
  useInput((input, key) => {
    if (key.escape) {
      if (inputMode) {
        setInputMode(false);
        setNewQuery('');
      } else {
        // Shutdown Clyde gracefully
        clyde.shutdown().finally(() => {
          if (onComplete) onComplete();
        });
      }
      return;
    }
    
    if (key.return) {
      if (inputMode && newQuery.trim()) {
        const trimmedQuery = newQuery.trim();
        setQueryHistory(prev => [...prev, trimmedQuery]);
        setCurrentQuery(trimmedQuery);
        setInputMode(false);
        setNewQuery('');
        setClaudeOutput('');
        setSystemLogs([]);
        executeQuery(trimmedQuery);
      } else if (!isRunning && !inputMode) {
        setInputMode(true);
      }
      return;
    }
    
    if (inputMode) {
      if (key.backspace || key.delete) {
        setNewQuery(prev => prev.slice(0, -1));
      } else if (input && input.length === 1) {
        setNewQuery(prev => prev + input);
      }
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box borderStyle="round" paddingX={2} paddingY={1} marginBottom={1}>
        <Box flexDirection="column">
          <Text bold color="cyan">🚀 Mission Control - Powered by Clyde</Text>
          <Text color="gray">Repository: {process.cwd().split('/').pop()}</Text>
          <Text color="gray">
            Mode: {clyde['modeManager']?.getCurrentMode() || 'initializing'} | 
            Session: {queryHistory.length} queries
          </Text>
        </Box>
      </Box>

      {/* Status Panel */}
      <Box borderStyle="single" paddingX={2} paddingY={1} marginBottom={1}>
        <Box justifyContent="space-between" width="100%">
          <Box flexDirection="column">
            <Text bold>
              Stage: {activeStage === 'initialization' ? <Text color="yellow">🤖 INITIALIZING</Text> : 
                     activeStage === 'ready' ? <Text color="green">💫 READY</Text> :
                     activeStage === 'execution' ? <Text color="blue">🚀 EXECUTING</Text> :
                     activeStage === 'complete' ? <Text color="green">✅ COMPLETE</Text> :
                     activeStage === 'error' ? <Text color="red">❌ ERROR</Text> :
                     <Text color="gray">⏸️ STANDBY</Text>}
            </Text>
            <Text color="gray">Query: {currentQuery}</Text>
          </Box>
          <Box flexDirection="column" alignItems="flex-end">
            <Text color="cyan">🤖 CLYDE ORCHESTRATOR</Text>
            <Text color="gray">Enhanced with context preservation</Text>
          </Box>
        </Box>
      </Box>

      {/* Claude Output Panel */}
      <Box borderStyle="single" paddingX={2} paddingY={1} marginBottom={1} flexGrow={1}>
        <Box flexDirection="column" width="100%">
          <Text bold color="cyan">🧠 Claude Output:</Text>
          <Box marginTop={1} flexDirection="column">
            {claudeOutput ? (
              <Text>{claudeOutput}</Text>
            ) : isRunning ? (
              <Text color="yellow">⏳ Waiting for Claude response...</Text>
            ) : activeStage === 'ready' ? (
              <Text color="gray">Ready to process your query through Clyde...</Text>
            ) : (
              <Text color="gray">Initializing Clyde orchestrator...</Text>
            )}
          </Box>
        </Box>
      </Box>

      {/* System Logs */}
      <Box borderStyle="single" paddingX={2} paddingY={1} marginBottom={1} height={6}>
        <Box flexDirection="column" width="100%">
          <Text bold color="cyan">📋 System Log:</Text>
          <Box marginTop={1} flexDirection="column">
            {systemLogs.slice(-3).map((line, index) => (
              <Text key={index} color="gray">{line}</Text>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Error Panel */}
      {error && (
        <Box borderStyle="single" paddingX={2} paddingY={1} marginBottom={1}>
          <Box flexDirection="column">
            <Text bold color="red">❌ Error:</Text>
            <Text color="red">{error}</Text>
          </Box>
        </Box>
      )}

      {/* Query Input */}
      {inputMode && (
        <Box borderStyle="single" paddingX={2} paddingY={1} marginBottom={1}>
          <Box flexDirection="column" width="100%">
            <Text bold color="cyan">💬 New Query:</Text>
            <Box marginTop={1}>
              <Text color="green">&gt; {newQuery}</Text>
              <Text color="yellow">█</Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* Controls */}
      <Box borderStyle="single" paddingX={2} paddingY={1}>
        <Box justifyContent="space-between" width="100%">
          <Text color="gray">Controls:</Text>
          {inputMode ? (
            <Text color="gray">ENTER: Submit | ESC: Cancel</Text>
          ) : !isRunning && isInitialized ? (
            <Text color="gray">ENTER: New Query | ESC: Exit</Text>
          ) : (
            <Text color="gray">ESC: Exit</Text>
          )}
        </Box>
      </Box>
    </Box>
  );
};