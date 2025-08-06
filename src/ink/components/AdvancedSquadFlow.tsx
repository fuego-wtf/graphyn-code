import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { SquadFindings } from './SquadFindings.js';
import { TaskApproval } from './TaskApproval.js';
import { ParallelCockpit } from './ParallelCockpit.js';
import { SquadExecutorV3 } from './SquadExecutorV3.js';
import { FeedbackSession } from './FeedbackSession.js';
import { TaskExecutor } from '../../services/task-executor.js';
import { GraphynAPIClient } from '../../api-client.js';
import { colors, fuegoColors } from '../theme/colors.js';
import { SquadStorage, type LocalSquad, type AgentConfig } from '../../services/squad-storage.js';
import { RepositoryAnalyzerService } from '../../services/repository-analyzer.js';
import type { RepositoryContext } from '../../services/claude-task-generator.js';
import { SquadsAPI } from '../../api/squads.js';
import { buildAskRequest, detectRepository, contextBuilders } from '../../services/request-builder.js';

interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  output?: string;
  error?: string;
  status?: string;
}

type FlowStage = 'squad-findings' | 'task-approval' | 'task-execution' | 'feedback' | 'complete';

interface AdvancedSquadFlowProps {
  initialQuery: string;
  apiClient: GraphynAPIClient;
  organizationId: string;
  repoPath?: string;
}

export const AdvancedSquadFlow: React.FC<AdvancedSquadFlowProps> = ({
  initialQuery,
  apiClient,
  organizationId,
  repoPath = process.cwd()
}) => {
  const { exit } = useApp();
  const [stage, setStage] = useState<FlowStage>('squad-findings');
  const [threadId, setThreadId] = useState<string>('');
  const [squadRecommendation, setSquadRecommendation] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [taskExecutor, setTaskExecutor] = useState<TaskExecutor | null>(null);
  const [sessionId] = useState<string>(() => `session-${Date.now()}`);
  const [taskResults, setTaskResults] = useState<Map<string, TaskExecutionResult>>(new Map());
  const [useSquadExecutor, setUseSquadExecutor] = useState(false);
  const [localSquad, setLocalSquad] = useState<LocalSquad | null>(null);
  const [agentConfigs, setAgentConfigs] = useState<AgentConfig[]>([]);
  const [repoContext, setRepoContext] = useState<RepositoryContext | null>(null);
  const [isLoadingFindings, setIsLoadingFindings] = useState(true);
  const [squadFindings, setSquadFindings] = useState<any[]>([]);
  const [apiToken, setApiToken] = useState<string>('');

  // Handle squad findings completion
  const handleSquadFindingsComplete = useCallback(async (threadId: string, squad: any) => {
    setThreadId(threadId);
    setSquadRecommendation(squad);
    
    // Transform squad recommendation into tasks
    const generatedTasks = squad.agents.map((agent: any, index: number) => ({
      id: `task-${index}`,
      title: `${agent.role}: ${agent.name}`,
      description: agent.description,
      agentId: agent.id || `agent-${index}`,
      agentName: agent.name,
      assigned_agent: agent.name,
      status: 'pending',
      agent: agent
    }));
    
    // Create agent configs from squad agents
    const configs: AgentConfig[] = squad.agents.map((agent: any, index: number) => ({
      id: agent.id || `agent-${index}`,
      name: agent.name,
      role: agent.role,
      emoji: agent.emoji || '🤖',
      systemPrompt: agent.systemPrompt,
      capabilities: agent.capabilities || [],
      skills: agent.skills || {},
      metadata: agent.metadata || {}
    }));
    
    setAgentConfigs(configs);
    
    // Create a local squad
    const squad_: LocalSquad = {
      id: `squad-${Date.now()}`,
      name: squad.name || 'Task Squad',
      description: squad.description || 'Auto-generated squad for tasks',
      agents: configs,
      created_at: new Date().toISOString(),
      workspace: repoPath
    };
    
    setLocalSquad(squad_);
    
    // Get repository context
    try {
      const analyzer = new RepositoryAnalyzerService(apiClient);
      const analysisResult = await analyzer.analyze(repoPath, 'summary');
      setRepoContext(analysisResult.context);
    } catch (error) {
      console.error('Failed to analyze repository:', error);
      // Create a minimal context if analysis fails
      setRepoContext({
        detected_stack: [],
        patterns: [],
        framework: 'unknown',
        language: 'unknown'
      });
    }
    
    setTasks(generatedTasks);
    setStage('task-approval');
  }, [repoPath, apiClient]);

  // Handle task approval
  const handleTaskApproval = useCallback(async (approvedTasks: any[], feedback?: string) => {
    setTasks(approvedTasks);
    
    // Initialize task executor
    const executor = new TaskExecutor(apiClient);
    setTaskExecutor(executor);
    
    // If feedback provided, send it to the thread
    if (feedback && threadId) {
      await apiClient.sendMessage(threadId, { content: feedback, role: 'user' });
    }
    
    // Determine whether to use SquadExecutor or ParallelCockpit
    // Use SquadExecutor if we have local agents and proper task structure
    const hasLocalAgents = agentConfigs.length > 0 && approvedTasks.every(t => t.assigned_agent);
    setUseSquadExecutor(hasLocalAgents);
    
    setStage('task-execution');
  }, [apiClient, threadId, agentConfigs]);

  // Handle task execution
  const handleTaskSelect = useCallback(async (taskId: string) => {
    if (!taskExecutor) return;
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Mark task as in progress
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, status: 'in_progress' } : t
    ));
    
    try {
      // Execute the task
      const result = await taskExecutor.executeTask(task, threadId, organizationId);
      
      // Mark task as completed
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: 'completed', result } : t
      ));
      
      setCompletedTasks(prev => new Set([...prev, taskId]));
      
      // Check if all tasks are completed
      if (completedTasks.size + 1 === tasks.length) {
        setTimeout(() => setStage('feedback'), 2000);
      }
    } catch (error) {
      // Mark task as failed
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: 'failed', error } : t
      ));
    }
  }, [taskExecutor, tasks, completedTasks]);

  // Handle task completion
  const handleTaskComplete = useCallback((taskId: string, result: any) => {
    // Already handled in handleTaskSelect
  }, []);

  // Handle parallel task completion
  const handleParallelTasksComplete = useCallback((results: Map<string, TaskExecutionResult>) => {
    setTaskResults(results);
    setStage('feedback');
  }, []);

  // Handle feedback submission
  const handleFeedback = useCallback(async (rating: number, comment: string) => {
    if (threadId) {
      // Send feedback to the thread
      const feedbackMessage = `Task Feedback - Rating: ${rating}/5${comment ? `\nComment: ${comment}` : ''}`;
      await apiClient.sendMessage(threadId, { content: feedbackMessage, role: 'user' });
    }
    
    setStage('complete');
  }, [apiClient, threadId]);

  // Fetch squad findings on mount
  useEffect(() => {
    const fetchSquadFindings = async () => {
      try {
        setIsLoadingFindings(true);
        
        // Get token from API client
        const token = apiClient.currentToken;
        if (!token) {
          throw new Error('No authentication token available');
        }
        setApiToken(token);
        
        // Build repository context
        const contextBuilder = contextBuilders.basic;
        const context = await contextBuilder(repoPath);
        setRepoContext(context);
        
        // Build request
        const repoInfo = await detectRepository(repoPath);
        const request = {
          user_message: initialQuery,
          context,
          repo_url: repoInfo.url,
          repo_branch: repoInfo.branch
        };
        
        // Call API
        const squadsAPI = new SquadsAPI(token);
        const response = await squadsAPI.askForSquad(request);
        
        setThreadId(response.thread_id);
        
        // Transform squad agents to findings format
        if (response.squad && response.squad.agents) {
          const findings = response.squad.agents.map((agent: any) => ({
            agentId: agent.id || `agent-${Date.now()}-${Math.random()}`,
            agentName: agent.name,
            recommendation: agent.description,
            reasoning: agent.style,
            capabilities: agent.skills ? Object.keys(agent.skills) : [],
            confidence: 0.8
          }));
          setSquadFindings(findings);
          setSquadRecommendation(response.squad);
        }
        
        setIsLoadingFindings(false);
      } catch (error) {
        console.error('Failed to fetch squad findings:', error);
        setIsLoadingFindings(false);
        exit();
      }
    };
    
    if (stage === 'squad-findings') {
      fetchSquadFindings();
    }
  }, [stage, initialQuery, apiClient, repoPath, exit]);

  // Render based on current stage
  switch (stage) {
    case 'squad-findings':
      return (
        <SquadFindings
          query={initialQuery}
          findings={squadFindings}
          onAccept={(selectedFindings) => {
            // Transform findings back to squad format
            const squad = {
              ...squadRecommendation,
              agents: selectedFindings.map(finding => ({
                id: finding.agentId,
                name: finding.agentName,
                description: finding.recommendation,
                role: finding.agentName,
                style: finding.reasoning,
                skills: finding.capabilities.reduce((acc, cap) => ({...acc, [cap]: 8}), {}),
                emoji: '🤖'
              }))
            };
            handleSquadFindingsComplete(threadId, squad);
          }}
          onRequestMore={(directives) => {
            // TODO: Implement request for more findings with additional directives
            console.log('Request more findings with:', directives);
          }}
          onCancel={() => exit()}
          isLoading={isLoadingFindings}
          threadId={threadId}
        />
      );
    
    case 'task-approval':
      return (
        <TaskApproval
          tasks={tasks}
          onApprove={(approvedTasks) => handleTaskApproval(approvedTasks)}
          onRequestChanges={(feedback) => handleTaskApproval(tasks, feedback)}
          onCancel={() => setStage('complete')}
        />
      );
    
    case 'task-execution':
      if (useSquadExecutor && localSquad && repoContext) {
        return (
          <SquadExecutorV3
            tasks={tasks}
            agents={agentConfigs}
            squad={localSquad}
            repoContext={repoContext}
            workDir={repoPath}
            onComplete={handleParallelTasksComplete}
          />
        );
      } else {
        return (
          <ParallelCockpit
            tasks={tasks}
            apiClient={apiClient}
            repoPath={repoPath}
            sessionId={sessionId}
            onComplete={handleParallelTasksComplete}
            onExit={() => exit()}
          />
        );
      }
    
    case 'feedback':
      return (
        <FeedbackSession
          taskTitle="Squad Performance"
          onSubmit={handleFeedback}
          onSkip={() => setStage('complete')}
        />
      );
    
    case 'complete':
      const successfulTasks = Array.from(taskResults.values()).filter(r => r.status === 'success').length;
      const failedTasks = Array.from(taskResults.values()).filter(r => r.status === 'failed').length;
      
      return (
        <Box flexDirection="column" padding={1}>
          <Text color={colors.success} bold>
            ✅ Squad mission complete!
          </Text>
          <Box marginTop={1}>
            <Text color={fuegoColors.text.primary}>
              Thread ID: {threadId}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color={fuegoColors.text.secondary}>
              {successfulTasks} tasks completed successfully
              {failedTasks > 0 && <Text color={colors.error}> | {failedTasks} failed</Text>}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color={fuegoColors.text.dimmed}>
              Session: {sessionId}
            </Text>
          </Box>
        </Box>
      );
    
    default:
      return null;
  }
};