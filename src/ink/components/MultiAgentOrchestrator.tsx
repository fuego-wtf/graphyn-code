import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { LocalOrchestrator, type OrchestratorResult, type LocalTask } from '../../orchestrator/local-orchestrator.js';
import { queryAnalyzer } from '../../utils/query-analyzer.js';

interface MultiAgentOrchestratorProps {
  query: string;
  onComplete?: () => void;
  useGraphMode?: boolean;
}

export const MultiAgentOrchestrator: React.FC<MultiAgentOrchestratorProps> = ({ 
  query, 
  onComplete
}) => {
  // Enhanced orchestration state
  const [orchestrator] = useState(() => new LocalOrchestrator());
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<OrchestratorResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string[]>([]);
  const [currentQuery, setCurrentQuery] = useState(query);
  const [queryHistory, setQueryHistory] = useState<string[]>([query]);
  const [analysis, setAnalysis] = useState<any>(null);
  
  // Input handling state
  const [inputMode, setInputMode] = useState(false);
  const [newQuery, setNewQuery] = useState('');
  
  // Task output tracking
  const [taskOutputs, setTaskOutputs] = useState<Record<string, string>>({});
  const [activeStage, setActiveStage] = useState<string>('initialization');

  // Execute orchestration with smart analysis
  const executeOrchestration = async (queryText: string) => {
    setIsRunning(true);
    setError(null);
    setOutput(prev => [...prev, `🔍 Analyzing query: "${queryText}"`]);
    setActiveStage('analysis');
    
    try {
      // 1. Analyze the query to determine orchestration strategy
      const queryAnalysis = queryAnalyzer.analyze(queryText);
      setAnalysis(queryAnalysis);
      
      setOutput(prev => [...prev, 
        `📊 Query Analysis:`,
        `   • Complexity: ${queryAnalysis.complexity}`,
        `   • Orchestration needed: ${queryAnalysis.needsOrchestration ? 'YES' : 'NO'}`,
        `   • Suggested agents: ${queryAnalysis.suggestedAgents.join(', ')}`,
        `   • Execution mode: ${queryAnalysis.executionMode}`,
        `   • Confidence: ${(queryAnalysis.confidence * 100).toFixed(0)}%`
      ]);

      if (!queryAnalysis.needsOrchestration) {
        // Simple query - use single Claude execution
        setOutput(prev => [...prev, `🎯 Simple query detected - using direct Claude execution`]);
        await executeSingleAgent(queryText, queryAnalysis.suggestedAgents[0]);
        return;
      }

      // 2. Complex query - use orchestration
      setOutput(prev => [...prev, `🎺 Complex query detected - starting orchestration`]);
      setActiveStage('orchestration');

      const taskId = await orchestrator.orchestrate({
        repository: process.cwd(),
        query: queryText,
        mode: queryAnalysis.executionMode
      });

      setCurrentTaskId(taskId);
      
      // 3. Monitor orchestration progress
      await monitorOrchestration(taskId);

    } catch (error) {
      setIsRunning(false);
      setError(error instanceof Error ? error.message : 'Unknown error');
      setOutput(prev => [...prev, `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`]);
      setActiveStage('error');
    }
  };

  // Execute simple single-agent query
  const executeSingleAgent = async (queryText: string, agent: string) => {
    setOutput(prev => [...prev, `🤖 Executing with ${agent} agent`]);
    setActiveStage('execution');
    
    try {
      // Build repository context
      const fs = await import('fs');
      const path = await import('path');
      const { spawn } = await import('child_process');
      const { findClaude } = await import('../../utils/claude-detector.js');
      
      const repoPath = process.cwd();
      let contextPrompt = `# ${agent.toUpperCase()} Agent - Repository Analysis\n\n`;
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
      
      contextPrompt += `\n## Task\nAs a ${agent} agent, help with: "${queryText}"\n`;
      contextPrompt += `Provide practical guidance and actionable recommendations.\n`;
      
      // Execute Claude
      const claudeResult = await findClaude();
      if (!claudeResult.found || !claudeResult.path) {
        throw new Error('Claude Code not found');
      }
      
      setOutput(prev => [...prev, `✅ Found Claude at: ${claudeResult.path}`]);
      
      await new Promise<void>((resolve, reject) => {
        const claudePath = claudeResult.path as string;
        const claude: any = spawn(claudePath, ['-p', contextPrompt], {
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false
        });
        
        claude.stdout?.on('data', (data: any) => {
          const text = data.toString();
          setTaskOutputs(prev => ({ ...prev, [agent]: (prev[agent] || '') + text }));
        });
        
        claude.stderr?.on('data', (data: any) => {
          const text = data.toString();
          setOutput(prev => [...prev, `⚠️ ${text}`]);
        });
        
        claude.on('close', (code: any) => {
          setIsRunning(false);
          if (code === 0) {
            setActiveStage('complete');
            setOutput(prev => [...prev, `✅ ${agent} agent completed successfully`]);
            resolve();
          } else {
            setActiveStage('error');
            setError(`Claude exited with code ${code}`);
            reject(new Error(`Claude exited with code ${code}`));
          }
        });
        
        claude.on('error', (error: any) => {
          setIsRunning(false);
          setActiveStage('error');
          setError(error.message);
          reject(error);
        });
      });

    } catch (error) {
      setIsRunning(false);
      setActiveStage('error');
      setError(error instanceof Error ? error.message : 'Unknown error');
      setOutput(prev => [...prev, `❌ ${agent} agent failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    }
  };

  // Monitor orchestration progress
  const monitorOrchestration = async (taskId: string) => {
    const updateStatus = () => {
      const currentStatus = orchestrator.getStatus(taskId);
      if (currentStatus) {
        setStatus(currentStatus);
        setActiveStage(currentStatus.progress.currentStage);
        
        if (currentStatus.status === 'completed') {
          setIsRunning(false);
          setOutput(prev => [...prev, `🎉 Orchestration completed successfully!`]);
          setActiveStage('complete');
        } else if (currentStatus.status === 'failed') {
          setIsRunning(false);
          setError(currentStatus.errors.join('; '));
          setActiveStage('error');
        }
      }
    };

    // Set up event listeners
    orchestrator.on('task_started', (data) => {
      setOutput(prev => [...prev, `🔄 Started: ${data.task.title}`]);
    });

    orchestrator.on('task_completed', (data) => {
      setOutput(prev => [...prev, `✅ Completed: ${data.task.title}`]);
    });

    orchestrator.on('task_failed', (data) => {
      setOutput(prev => [...prev, `❌ Failed: ${data.task.title} - ${data.error}`]);
    });

    orchestrator.on('task_output', (data) => {
      setTaskOutputs(prev => ({
        ...prev,
        [data.taskId || data.sessionId]: (prev[data.taskId || data.sessionId] || '') + data.chunk
      }));
    });

    // Poll for status updates
    const pollInterval = setInterval(updateStatus, 1000);
    
    // Wait for completion
    while (true) {
      const currentStatus = orchestrator.getStatus(taskId);
      if (!currentStatus || currentStatus.status !== 'running') {
        clearInterval(pollInterval);
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  };

  // Initialize orchestration on mount
  useEffect(() => {
    if (query && !isRunning) {
      executeOrchestration(query);
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
        // Cancel running orchestration if any
        if (currentTaskId && isRunning) {
          orchestrator.cancel(currentTaskId);
        }
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
        setTaskOutputs({}); // Clear previous outputs
        setOutput([]); // Clear previous logs
        executeOrchestration(trimmedQuery);
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

  // Render the enhanced Flight Cockpit UI
  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box borderStyle="round" paddingX={2} paddingY={1} marginBottom={1}>
        <Box flexDirection="column">
          <Text bold color="cyan">🚀 Graphyn Orchestrator</Text>
          <Text color="gray">Repository: {process.cwd().split('/').pop()}</Text>
        </Box>
      </Box>

      {/* Status Panel */}
      <Box borderStyle="single" paddingX={2} paddingY={1} marginBottom={1}>
        <Box justifyContent="space-between" width="100%">
          <Box flexDirection="column">
            <Text bold>
              Stage: {activeStage === 'analysis' ? <Text color="yellow">🔍 ANALYZING</Text> : 
                     activeStage === 'orchestration' ? <Text color="blue">🎺 ORCHESTRATING</Text> :
                     activeStage === 'execution' ? <Text color="blue">🤖 EXECUTING</Text> :
                     activeStage === 'complete' ? <Text color="green">✅ COMPLETE</Text> :
                     activeStage === 'error' ? <Text color="red">❌ ERROR</Text> :
                     <Text color="gray">💫 READY</Text>}
            </Text>
            <Text color="gray">Query: {currentQuery}</Text>
          </Box>
          <Box flexDirection="column" alignItems="flex-end">
            <Text color="cyan">
              Mode: {analysis?.needsOrchestration ? '🎺 ORCHESTRATION' : '🤖 SINGLE AGENT'}
            </Text>
            <Text color="gray">Session: {queryHistory.length} queries</Text>
          </Box>
        </Box>
      </Box>

      {/* Task Progress Panel (for orchestration) */}
      {status && (
        <Box borderStyle="single" paddingX={2} paddingY={1} marginBottom={1}>
          <Box flexDirection="column" width="100%">
            <Text bold color="cyan">📋 Task Progress:</Text>
            <Text color="gray">
              {status.progress.completed}/{status.progress.total} tasks completed
            </Text>
            <Box marginTop={1}>
              {status.tasks.slice(0, 3).map((task) => (
                <Text key={task.id} color={
                  task.status === 'completed' ? 'green' :
                  task.status === 'in_progress' ? 'yellow' :
                  task.status === 'failed' ? 'red' : 'gray'
                }>
                  {task.status === 'completed' ? '✅' : 
                   task.status === 'in_progress' ? '🔄' :
                   task.status === 'failed' ? '❌' : '⏸️'} {task.title}
                </Text>
              ))}
              {status.tasks.length > 3 && (
                <Text color="gray">... and {status.tasks.length - 3} more</Text>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {/* Output Panel */}
      <Box borderStyle="single" paddingX={2} paddingY={1} marginBottom={1} flexGrow={1}>
        <Box flexDirection="column" width="100%">
          <Text bold color="cyan">📺 Agent Output:</Text>
          <Box marginTop={1} flexDirection="column">
            {Object.keys(taskOutputs).length > 0 ? (
              Object.entries(taskOutputs).map(([agentOrTaskId, output]) => (
                <Box key={agentOrTaskId} marginBottom={1}>
                  <Box flexDirection="column">
                    <Text color="cyan" bold>📝 {agentOrTaskId}:</Text>
                    <Text>{output}</Text>
                  </Box>
                </Box>
              ))
            ) : isRunning ? (
              <Text color="yellow">⏳ Waiting for agent output...</Text>
            ) : activeStage === 'initialization' ? (
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
            <Text color="gray">ESC: Cancel & Exit</Text>
          )}
        </Box>
      </Box>
    </Box>
  );
};
