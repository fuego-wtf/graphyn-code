/**
 * Enhanced Mission Control for Customer Demonstrations
 * Features:
 * 1. Scrollable History Panel
 * 2. Real-time Progress Display
 * 3. Task Decomposition Interface
 * 4. Approval Workflow
 * 5. Claude Code Agent Launcher
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { spawn, ChildProcess } from 'child_process';

interface TaskDecomposition {
  id: string;
  title: string;
  description: string;
  assignedAgent: string;
  estimatedTime: string;
  dependencies: string[];
  status: 'pending' | 'approved' | 'executing' | 'completed' | 'failed';
}

interface ConversationMessage {
  id: string;
  timestamp: Date;
  type: 'user' | 'system' | 'claude' | 'agent' | 'task';
  content: string;
  author?: string;
  metadata?: any;
}

interface AgentSession {
  id: string;
  name: string;
  taskId: string;
  status: 'starting' | 'running' | 'completed' | 'failed';
  output: string;
  process?: ChildProcess;
}

interface EnhancedMissionControlProps {
  query: string;
  onComplete?: () => void;
}

export const EnhancedMissionControl: React.FC<EnhancedMissionControlProps> = ({ 
  query, 
  onComplete 
}) => {
  // Core State
  const [currentQuery, setCurrentQuery] = useState(query);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [systemStatus, setSystemStatus] = useState<'initializing' | 'analyzing' | 'decomposed' | 'approved' | 'executing' | 'completed' | 'error'>('initializing');
  const [error, setError] = useState<string | null>(null);

  // Task Decomposition State
  const [taskDecomposition, setTaskDecomposition] = useState<TaskDecomposition[]>([]);
  const [approvalMode, setApprovalMode] = useState(false);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(0);

  // Agent Execution State
  const [agentSessions, setAgentSessions] = useState<AgentSession[]>([]);
  const [activeAgents, setActiveAgents] = useState<string[]>([]);

  // UI State
  const [inputMode, setInputMode] = useState<'none' | 'query' | 'approval' | 'modification'>('none');
  const [newQuery, setNewQuery] = useState('');
  const [scrollPosition, setScrollPosition] = useState(0);
  const [maxHistoryVisible, setMaxHistoryVisible] = useState(10);
  
  // Real-time Progress
  const [currentProgress, setCurrentProgress] = useState('');
  const [progressTokens, setProgressTokens] = useState(0);
  const [streamingOutput, setStreamingOutput] = useState('');

  // Add initial message to history
  useEffect(() => {
    addMessage('user', query, 'User');
    addMessage('system', 'Mission Control initialized. Analyzing query...', 'System');
    setSystemStatus('analyzing');
    analyzeAndDecomposeQuery(query);
  }, [query]);

  // Utility Functions
  const addMessage = useCallback((type: ConversationMessage['type'], content: string, author?: string, metadata?: any) => {
    const message: ConversationMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      type,
      content,
      author,
      metadata
    };
    setConversationHistory(prev => [...prev, message]);
  }, []);

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Core Analysis Function
  const analyzeAndDecomposeQuery = async (queryText: string) => {
    setSystemStatus('analyzing');
    setCurrentProgress('Starting query analysis...');
    addMessage('system', `Analyzing query: "${queryText}"`, 'Mission Control');

    try {
      // Simulate real analysis process with progress updates
      setCurrentProgress('Building repository context...');
      addMessage('system', 'Building repository context and project structure', 'Analyzer');
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setCurrentProgress('Identifying task components...');
      addMessage('system', 'Identifying required tasks and dependencies', 'Analyzer');
      
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock task decomposition based on query analysis
      const tasks = await generateTaskDecomposition(queryText);
      setTaskDecomposition(tasks);
      
      setCurrentProgress('Task decomposition complete');
      addMessage('task', `Decomposed into ${tasks.length} tasks`, 'Mission Control');
      
      tasks.forEach((task, index) => {
        addMessage('task', `Task ${index + 1}: ${task.title} [Agent: ${task.assignedAgent}]`, 'Planner');
      });

      setSystemStatus('decomposed');
      setApprovalMode(true);
      setCurrentProgress('Ready for approval');
      addMessage('system', 'Plan ready for review. Commands: [A]pprove [M]odify [C]ancel', 'Mission Control');

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Analysis failed');
      setSystemStatus('error');
      addMessage('system', `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'Error');
    }
  };

  // Generate task decomposition based on query
  const generateTaskDecomposition = async (queryText: string): Promise<TaskDecomposition[]> => {
    // This would normally use Claude API to generate real task breakdown
    // For demo purposes, we'll create relevant tasks based on common patterns
    
    const baseTask = {
      id: `task_${Date.now()}`,
      dependencies: [],
      status: 'pending' as const
    };

    if (queryText.toLowerCase().includes('auth') || queryText.toLowerCase().includes('login')) {
      return [
        { ...baseTask, id: 'task_1', title: 'Authentication System Design', description: 'Design OAuth 2.0 PKCE flow architecture', assignedAgent: 'Security Architect', estimatedTime: '45min' },
        { ...baseTask, id: 'task_2', title: 'Backend Auth Service', description: 'Implement authentication endpoints and middleware', assignedAgent: 'Backend Developer', estimatedTime: '2hr', dependencies: ['task_1'] },
        { ...baseTask, id: 'task_3', title: 'Frontend Auth Flow', description: 'Build login/logout UI components and state management', assignedAgent: 'Frontend Developer', estimatedTime: '1.5hr', dependencies: ['task_2'] },
        { ...baseTask, id: 'task_4', title: 'Security Testing', description: 'Test authentication flows and security vulnerabilities', assignedAgent: 'Security Tester', estimatedTime: '1hr', dependencies: ['task_3'] }
      ];
    } else if (queryText.toLowerCase().includes('api') || queryText.toLowerCase().includes('endpoint')) {
      return [
        { ...baseTask, id: 'task_1', title: 'API Design', description: 'Design RESTful API endpoints and data models', assignedAgent: 'API Architect', estimatedTime: '30min' },
        { ...baseTask, id: 'task_2', title: 'Backend Implementation', description: 'Implement API endpoints with validation and error handling', assignedAgent: 'Backend Developer', estimatedTime: '2hr', dependencies: ['task_1'] },
        { ...baseTask, id: 'task_3', title: 'API Documentation', description: 'Generate OpenAPI specs and usage documentation', assignedAgent: 'Technical Writer', estimatedTime: '45min', dependencies: ['task_2'] },
        { ...baseTask, id: 'task_4', title: 'Integration Testing', description: 'Create comprehensive API test suite', assignedAgent: 'QA Engineer', estimatedTime: '1hr', dependencies: ['task_2'] }
      ];
    } else {
      return [
        { ...baseTask, id: 'task_1', title: 'Requirements Analysis', description: 'Analyze and clarify project requirements', assignedAgent: 'Business Analyst', estimatedTime: '30min' },
        { ...baseTask, id: 'task_2', title: 'Architecture Planning', description: 'Design system architecture and component structure', assignedAgent: 'Solution Architect', estimatedTime: '45min', dependencies: ['task_1'] },
        { ...baseTask, id: 'task_3', title: 'Implementation', description: 'Develop core functionality based on requirements', assignedAgent: 'Full-Stack Developer', estimatedTime: '2hr', dependencies: ['task_2'] },
        { ...baseTask, id: 'task_4', title: 'Testing & Validation', description: 'Test implementation and validate against requirements', assignedAgent: 'QA Engineer', estimatedTime: '1hr', dependencies: ['task_3'] }
      ];
    }
  };

  // Execute approved plan
  const executeApprovedPlan = async () => {
    setSystemStatus('executing');
    setApprovalMode(false);
    setCurrentProgress('Launching Claude Code agents...');
    addMessage('system', 'Plan approved! Launching agent execution...', 'Mission Control');

    // Update all tasks to approved status
    setTaskDecomposition(prev => prev.map(task => ({ ...task, status: 'approved' })));

    // Launch agents for each task
    for (const task of taskDecomposition) {
      await launchAgentForTask(task);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Stagger launches
    }
  };

  // Launch Claude Code agent for specific task
  const launchAgentForTask = async (task: TaskDecomposition) => {
    const sessionId = `agent_${task.id}_${Date.now()}`;
    
    addMessage('agent', `Launching ${task.assignedAgent} for: ${task.title}`, task.assignedAgent);
    setCurrentProgress(`Starting ${task.assignedAgent}...`);

    const agentSession: AgentSession = {
      id: sessionId,
      name: task.assignedAgent,
      taskId: task.id,
      status: 'starting',
      output: ''
    };

    setAgentSessions(prev => [...prev, agentSession]);
    setActiveAgents(prev => [...prev, sessionId]);

    try {
      // Find Claude Code executable
      const { findClaude } = await import('../../utils/claude-detector.js');
      const claudeResult = await findClaude();
      
      if (!claudeResult.found || !claudeResult.path) {
        throw new Error('Claude Code not found');
      }

      // Build context prompt for the specific task
      const taskPrompt = buildTaskPrompt(task, currentQuery);
      
      // Launch Claude Code with task-specific context
      const claude: ChildProcess = spawn(claudeResult.path, ['-p', taskPrompt], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false
      });

      // Update agent session with process
      setAgentSessions(prev => prev.map(session => 
        session.id === sessionId 
          ? { ...session, status: 'running', process: claude }
          : session
      ));

      // Handle Claude output
      claude.stdout?.on('data', (data: any) => {
        const text = data.toString();
        setAgentSessions(prev => prev.map(session => 
          session.id === sessionId 
            ? { ...session, output: session.output + text }
            : session
        ));
        addMessage('claude', text.slice(0, 100) + (text.length > 100 ? '...' : ''), task.assignedAgent);
        setProgressTokens(prev => prev + text.split(' ').length);
      });

      claude.stderr?.on('data', (data: any) => {
        const errorText = data.toString();
        addMessage('system', `Agent error: ${errorText}`, 'Error');
      });

      claude.on('close', (code: any) => {
        setAgentSessions(prev => prev.map(session => 
          session.id === sessionId 
            ? { ...session, status: code === 0 ? 'completed' : 'failed' }
            : session
        ));
        
        setActiveAgents(prev => prev.filter(id => id !== sessionId));
        
        if (code === 0) {
          addMessage('agent', `Task completed successfully`, task.assignedAgent);
          setTaskDecomposition(prev => prev.map(t => 
            t.id === task.id ? { ...t, status: 'completed' } : t
          ));
        } else {
          addMessage('agent', `Task failed with exit code ${code}`, task.assignedAgent);
          setTaskDecomposition(prev => prev.map(t => 
            t.id === task.id ? { ...t, status: 'failed' } : t
          ));
        }

        // Check if all tasks are complete
        if (activeAgents.length === 1) { // This agent is about to be removed
          setSystemStatus('completed');
          setCurrentProgress('All tasks completed');
          addMessage('system', 'Mission accomplished! All agents have completed their tasks.', 'Mission Control');
        }
      });

    } catch (error) {
      setAgentSessions(prev => prev.map(session => 
        session.id === sessionId 
          ? { ...session, status: 'failed' }
          : session
      ));
      setActiveAgents(prev => prev.filter(id => id !== sessionId));
      addMessage('system', `Failed to launch ${task.assignedAgent}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'Error');
    }
  };

  // Build task-specific prompt for Claude Code
  const buildTaskPrompt = (task: TaskDecomposition, originalQuery: string) => {
    return `# Claude Code Agent Task Assignment

## Original User Query
"${originalQuery}"

## Your Role
You are a **${task.assignedAgent}** working as part of a coordinated team.

## Your Specific Task
**Title**: ${task.title}
**Description**: ${task.description}
**Estimated Time**: ${task.estimatedTime}
**Dependencies**: ${task.dependencies.length > 0 ? task.dependencies.join(', ') : 'None'}

## Context
- You are working in a team environment with other specialized agents
- This is task ${taskDecomposition.findIndex(t => t.id === task.id) + 1} of ${taskDecomposition.length} in the overall plan
- Focus specifically on your assigned responsibility
- Provide clear, actionable deliverables

## Instructions
1. Focus ONLY on your assigned task
2. Provide concrete, implementable solutions
3. Consider integration with other team members' work
4. Include clear next steps or deliverables
5. Be thorough but stay within your role boundaries

Please proceed with your specialized task now.`;
  };

  // Input Handling
  useInput((input, key) => {
    if (key.escape) {
      if (inputMode !== 'none') {
        setInputMode('none');
        setNewQuery('');
      } else {
        // Exit mission control
        if (onComplete) onComplete();
      }
      return;
    }

    // Approval workflow shortcuts
    if (approvalMode && inputMode === 'none') {
      if (input === 'a' || input === 'A') {
        executeApprovedPlan();
        return;
      }
      if (input === 'm' || input === 'M') {
        setInputMode('modification');
        addMessage('system', 'Modification mode - Enter changes or press ESC to cancel', 'Mission Control');
        return;
      }
      if (input === 'c' || input === 'C') {
        setApprovalMode(false);
        setSystemStatus('initializing');
        addMessage('system', 'Plan cancelled. Ready for new query.', 'Mission Control');
        return;
      }
    }

    // Scrolling controls
    if (key.upArrow) {
      setScrollPosition(prev => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow) {
      setScrollPosition(prev => Math.min(conversationHistory.length - maxHistoryVisible, prev + 1));
      return;
    }

    // Regular input handling
    if (key.return) {
      if (inputMode === 'query' && newQuery.trim()) {
        const trimmedQuery = newQuery.trim();
        setCurrentQuery(trimmedQuery);
        setInputMode('none');
        setNewQuery('');
        setConversationHistory([]);
        setTaskDecomposition([]);
        setAgentSessions([]);
        setActiveAgents([]);
        analyzeAndDecomposeQuery(trimmedQuery);
      } else if (inputMode === 'none' && systemStatus === 'completed') {
        setInputMode('query');
      }
      return;
    }

    // Text input
    if (inputMode === 'query' || inputMode === 'modification') {
      if (key.backspace || key.delete) {
        setNewQuery(prev => prev.slice(0, -1));
      } else if (input && input.length === 1) {
        setNewQuery(prev => prev + input);
      }
    }
  });

  // Render scrollable conversation history
  const renderConversationHistory = () => {
    const visibleMessages = conversationHistory.slice(
      Math.max(0, scrollPosition),
      Math.min(conversationHistory.length, scrollPosition + maxHistoryVisible)
    );

    return (
      <Box flexDirection="column">
        {visibleMessages.map((message) => (
          <Box key={message.id} flexDirection="row" marginBottom={0}>
            <Text color="gray">[{formatTimestamp(message.timestamp)}]</Text>
            <Text color={
              message.type === 'user' ? 'cyan' :
              message.type === 'claude' ? 'green' :
              message.type === 'agent' ? 'yellow' :
              message.type === 'task' ? 'magenta' :
              message.type === 'system' ? 'blue' : 'white'
            }> {message.author || message.type}: </Text>
            <Text>{message.content}</Text>
          </Box>
        ))}
        {conversationHistory.length > maxHistoryVisible && (
          <Text color="gray">
            ↑↓ Scroll | {scrollPosition + 1}-{Math.min(scrollPosition + maxHistoryVisible, conversationHistory.length)} of {conversationHistory.length} messages
          </Text>
        )}
      </Box>
    );
  };

  // Render task decomposition
  const renderTaskDecomposition = () => {
    if (taskDecomposition.length === 0) return null;

    return (
      <Box flexDirection="column">
        <Text bold color="magenta">📋 Task Decomposition:</Text>
        {taskDecomposition.map((task, index) => (
          <Box key={task.id} flexDirection="row">
            <Text color={
              task.status === 'completed' ? 'green' :
              task.status === 'executing' ? 'yellow' :
              task.status === 'failed' ? 'red' :
              task.status === 'approved' ? 'blue' : 'gray'
            }>
              {task.status === 'completed' ? '✅' :
               task.status === 'executing' ? '🔄' :
               task.status === 'failed' ? '❌' :
               task.status === 'approved' ? '👍' : '⏸️'} 
            </Text>
            <Text> {index + 1}. {task.title} [{task.assignedAgent}] ({task.estimatedTime})</Text>
          </Box>
        ))}
      </Box>
    );
  };

  // Render active agents
  const renderActiveAgents = () => {
    if (agentSessions.length === 0) return null;

    return (
      <Box flexDirection="column">
        <Text bold color="yellow">🤖 Active Agents: {activeAgents.length}</Text>
        {agentSessions.slice(-3).map((session) => (
          <Text key={session.id} color={
            session.status === 'completed' ? 'green' :
            session.status === 'running' ? 'yellow' :
            session.status === 'failed' ? 'red' : 'gray'
          }>
            {session.status === 'completed' ? '✅' :
             session.status === 'running' ? '🔄' :
             session.status === 'failed' ? '❌' : '⏸️'} {session.name}
          </Text>
        ))}
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box borderStyle="round" paddingX={1} paddingY={0}>
        <Box justifyContent="space-between" width="100%">
          <Text bold color="cyan">🚀 Enhanced Mission Control</Text>
          <Text color="gray">
            {systemStatus.toUpperCase()} | Agents: {activeAgents.length} | Tokens: {progressTokens}
          </Text>
        </Box>
      </Box>

      {/* Status Panel */}
      <Box borderStyle="single" paddingX={1} paddingY={0}>
        <Box justifyContent="space-between" width="100%">
          <Text bold>
            Status: {systemStatus === 'initializing' ? <Text color="blue">🤖 INITIALIZING</Text> :
                     systemStatus === 'analyzing' ? <Text color="yellow">🔍 ANALYZING</Text> :
                     systemStatus === 'decomposed' ? <Text color="magenta">📋 PLAN READY</Text> :
                     systemStatus === 'approved' ? <Text color="blue">👍 APPROVED</Text> :
                     systemStatus === 'executing' ? <Text color="yellow">🚀 EXECUTING</Text> :
                     systemStatus === 'completed' ? <Text color="green">✅ COMPLETED</Text> :
                     systemStatus === 'error' ? <Text color="red">❌ ERROR</Text> :
                     <Text color="gray">⏸️ STANDBY</Text>}
          </Text>
          <Text color="cyan">{currentProgress || 'Ready'}</Text>
        </Box>
      </Box>

      {/* Scrollable Conversation History */}
      <Box borderStyle="single" paddingX={1} paddingY={0} height={10}>
        <Box flexDirection="column" width="100%">
          <Text bold color="cyan">💬 Conversation History:</Text>
          {renderConversationHistory()}
        </Box>
      </Box>

      {/* Task Decomposition Panel */}
      {taskDecomposition.length > 0 && (
        <Box borderStyle="single" paddingX={1} paddingY={0} height={6}>
          <Box flexDirection="column" width="100%">
            {renderTaskDecomposition()}
          </Box>
        </Box>
      )}

      {/* Active Agents Panel */}
      {agentSessions.length > 0 && (
        <Box borderStyle="single" paddingX={1} paddingY={0} height={5}>
          <Box flexDirection="column" width="100%">
            {renderActiveAgents()}
          </Box>
        </Box>
      )}

      {/* Error Panel */}
      {error && (
        <Box borderStyle="single" paddingX={1} paddingY={0}>
          <Text bold color="red">❌ Error: </Text>
          <Text color="red">{error}</Text>
        </Box>
      )}

      {/* Input Panel */}
      {inputMode !== 'none' && (
        <Box borderStyle="single" paddingX={1} paddingY={0}>
          <Text bold color="cyan">
            {inputMode === 'query' ? '💬 New Query: ' : 
             inputMode === 'modification' ? '✏️ Modify Plan: ' : 
             '💭 Input: '}
          </Text>
          <Text color="green">&gt; {newQuery}</Text>
          <Text color="yellow">█</Text>
        </Box>
      )}

      {/* Controls */}
      <Box borderStyle="single" paddingX={1} paddingY={0}>
        <Box justifyContent="space-between" width="100%">
          <Text color="gray">Controls:</Text>
          {approvalMode && inputMode === 'none' ? (
            <Text color="gray">[A]pprove | [M]odify | [C]ancel | ESC: Exit</Text>
          ) : inputMode !== 'none' ? (
            <Text color="gray">ENTER: Submit | ESC: Cancel</Text>
          ) : systemStatus === 'completed' ? (
            <Text color="gray">ENTER: New Query | ↑↓: Scroll | ESC: Exit</Text>
          ) : (
            <Text color="gray">↑↓: Scroll History | ESC: Exit</Text>
          )}
        </Box>
      </Box>
    </Box>
  );
};