import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { spawn, ChildProcess } from 'child_process';

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
        const claude: ChildProcess = spawn(claudeResult.path || 'claude', ['-p', contextPrompt], {
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false
        });
        
        claude.stdout?.on('data', (data: any) => {
          const text = data.toString();
          setClaudeOutput(prev => prev + text);
        });
        
        claude.stderr?.on('data', (data: any) => {
          const text = data.toString();
          setOutput(prev => [...prev, `⚠️ ${text}`]);
        });
        
        claude.on('close', (code: any) => {
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
        
        claude.on('error', (error: any) => {
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

  // Flight Cockpit UI Render (Compact Version)
  return (
    <Box flexDirection="column">
      {/* Header - Compact */}
      <Box borderStyle="round" paddingX={1} paddingY={0}>
        <Box justifyContent="space-between" width="100%">
          <Text bold color="cyan">🚀 Mission Control</Text>
          <Text color="gray">{process.cwd().split('/').pop()}</Text>
        </Box>
      </Box>

      {/* Status Panel - Compact */}
      <Box borderStyle="single" paddingX={1} paddingY={0}>
        <Box justifyContent="space-between" width="100%">
          <Text bold>Status: {status === 'analyzing' ? <Text color="yellow">🔄 ANALYZING</Text> : 
                            status === 'complete' ? <Text color="green">✅ COMPLETE</Text> :
                            status === 'error' ? <Text color="red">❌ ERROR</Text> :
                            <Text color="blue">💫 READY</Text>} | Query: {currentQuery}</Text>
          <Text color="cyan">Claude: {isRunning ? '🟢 ACTIVE' : inputMode ? '🟡 WAITING' : '🔴 IDLE'} | Session: {queryHistory.length}</Text>
        </Box>
      </Box>

      {/* Claude Output Panel - Compact */}
      <Box borderStyle="single" paddingX={1} paddingY={0} flexGrow={1}>
        <Box flexDirection="column" width="100%">
          <Text bold color="cyan">📺 Claude Analysis:</Text>
          {claudeOutput ? (
            <Text>{claudeOutput}</Text>
          ) : isRunning ? (
            <Text color="yellow">⏳ Waiting for Claude response...</Text>
          ) : status === 'ready' ? (
            <Text color="gray">Ready to process your query...</Text>
          ) : null}
        </Box>
      </Box>

      {/* System Logs - Dynamic Height */}
      <Box borderStyle="single" paddingX={1} paddingY={0} height={3}>
        <Box flexDirection="column" width="100%">
          <Text bold color="cyan">📋 System Log:</Text>
          {output.slice(-2).map((line, index) => (
            <Text key={index} color="gray">{line}</Text>
          ))}
        </Box>
      </Box>

      {/* Error Panel - Compact */}
      {error && (
        <Box borderStyle="single" paddingX={1} paddingY={0}>
          <Text bold color="red">❌ Error: </Text>
          <Text color="red">{error}</Text>
        </Box>
      )}

      {/* Query Input - Compact */}
      {inputMode && (
        <Box borderStyle="single" paddingX={1} paddingY={0}>
          <Text bold color="cyan">💬 New Query: </Text>
          <Text color="green">&gt; {newQuery}</Text>
          <Text color="yellow">█</Text>
        </Box>
      )}

      {/* Controls - Compact */}
      <Box borderStyle="single" paddingX={1} paddingY={0}>
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