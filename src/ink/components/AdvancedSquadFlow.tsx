import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
// Note: SquadFindings requires different props structure
// For now, we'll use a simplified version
import { TaskApproval } from './TaskApproval.js';
import { Cockpit } from './Cockpit.js';
import { FeedbackSession } from './FeedbackSession.js';
import { TaskExecutor } from '../../services/task-executor.js';
import { GraphynAPIClient } from '../../api-client.js';
import { colors, fuegoColors } from '../theme/colors.js';

type FlowStage = 'squad-findings' | 'task-approval' | 'task-execution' | 'feedback' | 'complete';

interface AdvancedSquadFlowProps {
  initialQuery: string;
  apiClient: GraphynAPIClient;
  organizationId: string;
}

export const AdvancedSquadFlow: React.FC<AdvancedSquadFlowProps> = ({
  initialQuery,
  apiClient,
  organizationId
}) => {
  const { exit } = useApp();
  const [stage, setStage] = useState<FlowStage>('squad-findings');
  const [threadId, setThreadId] = useState<string>('');
  const [squadRecommendation, setSquadRecommendation] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [taskExecutor, setTaskExecutor] = useState<TaskExecutor | null>(null);

  // Handle squad findings completion
  const handleSquadFindingsComplete = useCallback((threadId: string, squad: any) => {
    setThreadId(threadId);
    setSquadRecommendation(squad);
    
    // Transform squad recommendation into tasks
    const generatedTasks = squad.agents.map((agent: any, index: number) => ({
      id: `task-${index}`,
      title: `${agent.role}: ${agent.name}`,
      description: agent.description,
      agentId: agent.id || `agent-${index}`,
      agentName: agent.name,
      status: 'pending',
      agent: agent
    }));
    
    setTasks(generatedTasks);
    setStage('task-approval');
  }, []);

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
    
    setStage('task-execution');
  }, [apiClient, threadId]);

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

  // Handle feedback submission
  const handleFeedback = useCallback(async (rating: number, comment: string) => {
    if (threadId) {
      // Send feedback to the thread
      const feedbackMessage = `Task Feedback - Rating: ${rating}/5${comment ? `\nComment: ${comment}` : ''}`;
      await apiClient.sendMessage(threadId, { content: feedbackMessage, role: 'user' });
    }
    
    // Clean up
    // Note: TaskExecutor handles cleanup automatically
    
    setStage('complete');
  }, [apiClient, threadId, taskExecutor]);

  // Handle input for squad findings stage
  useInput((input, key) => {
    if (stage === 'squad-findings' && key.return) {
      // Simulate squad creation
      const mockSquad = {
        agents: [
          {
            id: 'agent-1',
            name: 'Lead Developer',
            role: 'Full Stack Development',
            description: 'Handles implementation of core features',
            skills: { coding: 9, architecture: 7, testing: 8 },
            style: 'Pragmatic and efficient'
          },
          {
            id: 'agent-2',
            name: 'UI/UX Specialist',
            role: 'Frontend & Design',
            description: 'Ensures great user experience',
            skills: { design: 9, frontend: 8, accessibility: 8 },
            style: 'User-focused and detail-oriented'
          }
        ]
      };
      handleSquadFindingsComplete('mock-thread-123', mockSquad);
    }
  }, { isActive: stage === 'squad-findings' });

  // Render based on current stage
  switch (stage) {
    case 'squad-findings':
      return (
        // TODO: Integrate SquadFindings with proper data flow
        <Box flexDirection="column" padding={1}>
          <Text color={colors.info}>🔍 Analyzing your request...</Text>
          <Text color={fuegoColors.text.secondary}>{initialQuery}</Text>
          {/* Simulate squad creation for now */}
          <Box marginTop={2}>
            <Text color={colors.success}>Press Enter to continue with squad creation...</Text>
          </Box>
        </Box>
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
      return (
        <Cockpit
          tasks={tasks}
          onTaskSelect={handleTaskSelect}
          onTaskComplete={handleTaskComplete}
          onFeedback={(taskId, rating, comment) => {
            // Store feedback for later submission
          }}
          onExit={() => exit()}
        />
      );
    
    case 'feedback':
      return (
        <FeedbackSession
          taskTitle="Squad Performance"
          onSubmit={handleFeedback}
          onSkip={() => setStage('complete')}
        />
      );
    
    case 'complete':
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
              {completedTasks.size} tasks completed successfully
            </Text>
          </Box>
        </Box>
      );
    
    default:
      return null;
  }
};