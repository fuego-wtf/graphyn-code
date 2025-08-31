import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

interface MultiAgentOrchestratorProps {
  query: string;
  onComplete?: () => void;
  useGraphMode?: boolean;
}

export const MultiAgentOrchestrator: React.FC<MultiAgentOrchestratorProps> = ({ 
  query, 
  onComplete
}) => {
  // Simplified Mission Control state
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string[]>([]);
  const [currentQuery, setCurrentQuery] = useState(query);
  const [queryHistory, setQueryHistory] = useState<string[]>([query]);
  const [claudeOutput, setClaudeOutput] = useState<string>('');
  const [status, setStatus] = useState<'ready' | 'analyzing' | 'complete' | 'error'>('ready');
  
  // Input handling state
  const [inputMode, setInputMode] = useState(false);
  const [newQuery, setNewQuery] = useState('');

  // Simple Claude execution function
  const executeClaudeQuery = async (queryText: string) => {
    setStatus('analyzing');
    setIsRunning(true);
    setError(null);
    setClaudeOutput(''); // Clear previous output
    setOutput(prev => [...prev, `🚀 Processing: "${queryText}"`]);
    
    try {
      // Build repository context (same as fallback CLI)
      const fs = await import('fs');
      const path = await import('path');
      const { spawn } = await import('child_process');
      const { findClaude } = await import('../../utils/claude-detector.js');
      
      const repoPath = process.cwd();
      let contextPrompt = `# Repository Analysis Request\n\n`;
      contextPrompt += `**User Query**: ${queryText}\n\n`;
      contextPrompt += `**Repository**: ${path.basename(repoPath)}\n`;
      contextPrompt += `**Location**: ${repoPath}\n\n`;
      
      // Add package.json context
      const packageJsonPath = path.join(repoPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          contextPrompt += `## Project Details\n`;
          contextPrompt += `- **Name**: ${packageJson.name || 'Unknown'}\n`;
          if (packageJson.description) {
            contextPrompt += `- **Description**: ${packageJson.description}\n`;
          }
          if (packageJson.version) {
            contextPrompt += `- **Version**: ${packageJson.version}\n`;
          }
        } catch (error) {
          contextPrompt += `## Project Details\nPackage.json exists but could not be parsed\n`;
        }
      }
      
      contextPrompt += `\n## Task\nPlease help the user understand this repository based on their query: "${queryText}"\n`;
      contextPrompt += `Focus on explaining the project's purpose, architecture, and how to get started.\n`;
      
      // Execute Claude
      const claudeResult = await findClaude();
      if (!claudeResult.found || !claudeResult.path) {
        throw new Error('Claude Code not found');
      }
      
      setOutput(prev => [...prev, `✅ Found Claude at: ${claudeResult.path}`]);
      
      return new Promise<void>((resolve, reject) => {
        const claude = spawn(claudeResult.path, ['-p', contextPrompt], {
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false
        });
        
        claude.stdout?.on('data', (data) => {
          const text = data.toString();
          setClaudeOutput(prev => prev + text);
        });
        
        claude.stderr?.on('data', (data) => {
          const text = data.toString();
          setOutput(prev => [...prev, `⚠️ ${text}`]);
        });
        
        claude.on('close', (code) => {
          setIsRunning(false);
          if (code === 0) {
            setStatus('complete');
            setOutput(prev => [...prev, `✅ Analysis complete`]);
            setOutput(prev => [...prev, `💫 Ready for next query...`]);
            resolve();
          } else {
            setStatus('error');
            setError(`Claude exited with code ${code}`);
            reject(new Error(`Claude exited with code ${code}`));
          }
        });
        
        claude.on('error', (error) => {
          setIsRunning(false);
          setStatus('error');
          setError(error.message);
          reject(error);
        });
      });
      
    } catch (error) {
      setIsRunning(false);
      setStatus('error');
      setError(error instanceof Error ? error.message : 'Unknown error');
      setOutput(prev => [...prev, `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    }
  };

  useEffect(() => {
    if (query && status === 'ready') {
      executeClaudeQuery(query);
    }
  }, [query]);

  // Handle keyboard input for new queries
  useInput((input, key) => {
    if (key.escape) {
      if (inputMode) {
        // Exit input mode
        setInputMode(false);
        setNewQuery('');
      } else {
        // Exit mission control
        if (onComplete) onComplete();
      }
      return;
    }
    
    if (key.return) {
      if (inputMode && newQuery.trim()) {
        // Submit new query
        const trimmedQuery = newQuery.trim();
        setQueryHistory(prev => [...prev, trimmedQuery]);
        setCurrentQuery(trimmedQuery);
        setInputMode(false);
        setNewQuery('');
        executeClaudeQuery(trimmedQuery);
      } else if (!isRunning && !inputMode) {
        // Enter input mode
        setInputMode(true);
      }
      return;
    }
    
    if (inputMode) {
      // Handle text input
      if (key.backspace || key.delete) {
        setNewQuery(prev => prev.slice(0, -1));
      } else if (input && input.length === 1) {
        setNewQuery(prev => prev + input);
      }
    }
  });

  // Flight Cockpit UI Render
  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box borderStyle="round" paddingX={2} paddingY={1} marginBottom={1}>
        <Box flexDirection="column">
          <Text bold color="cyan">🚀 Graphyn Mission Control</Text>
          <Text color="gray">Repository: {process.cwd().split('/').pop()}</Text>
        </Box>
      </Box>

      {/* Status Panel */}
      <Box borderStyle="single" paddingX={2} paddingY={1} marginBottom={1}>
        <Box justifyContent="space-between" width="100%">
          <Box flexDirection="column">
            <Text bold>Status: {status === 'analyzing' ? <Text color="yellow">🔄 ANALYZING</Text> : 
                              status === 'complete' ? <Text color="green">✅ COMPLETE</Text> :
                              status === 'error' ? <Text color="red">❌ ERROR</Text> :
                              <Text color="blue">💫 READY</Text>}</Text>
            <Text color="gray">Query: {currentQuery}</Text>
          </Box>
          <Box flexDirection="column" alignItems="flex-end">
            <Text color="cyan">Claude: {isRunning ? '🟢 ACTIVE' : inputMode ? '🟡 WAITING' : '🔴 IDLE'}</Text>
            <Text color="gray">Session: {queryHistory.length} queries</Text>
          </Box>
        </Box>
      </Box>

      {/* Claude Output Panel */}
      <Box borderStyle="single" paddingX={2} paddingY={1} marginBottom={1} flexGrow={1}>
        <Box flexDirection="column" width="100%">
          <Text bold color="cyan">📺 Claude Analysis:</Text>
          <Box marginTop={1} flexDirection="column">
            {claudeOutput ? (
              <Text>{claudeOutput}</Text>
            ) : isRunning ? (
              <Text color="yellow">⏳ Waiting for Claude response...</Text>
            ) : status === 'ready' ? (
              <Text color="gray">Ready to process your query...</Text>
            ) : null}
          </Box>
        </Box>
      </Box>

      {/* System Logs */}
      <Box borderStyle="single" paddingX={2} paddingY={1} marginBottom={1} height={6}>
        <Box flexDirection="column" width="100%">
          <Text bold color="cyan">📋 System Log:</Text>
          <Box marginTop={1} flexDirection="column">
            {output.slice(-3).map((line, index) => (
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
          ) : !isRunning ? (
            <Text color="gray">ENTER: New Query | ESC: Exit</Text>
          ) : (
            <Text color="gray">ESC: Exit (after completion)</Text>
          )}
        </Box>
      </Box>
    </Box>
  );
};