import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { GraphynAPIClient } from '../../api-client.js';
import { TaskExecutor } from '../../services/task-executor.js';
import { colors, fuegoColors } from '../theme/colors.js';
import chalk from 'chalk';

interface Task {
  id: string;
  title: string;
  description: string;
  agentId: string;
  agentName: string;
  agent?: any;
  status?: 'pending' | 'in_progress' | 'completed' | 'failed';
  result?: any;
  error?: any;
}

interface TaskExecutionResult {
  taskId: string;
  success: boolean;
  output?: string;
  error?: string;
  status?: string;
}

interface ParallelCockpitProps {
  tasks: Task[];
  apiClient: GraphynAPIClient;
  repoPath?: string;
  sessionId: string;
  onComplete: (results: Map<string, TaskExecutionResult>) => void;
  onExit: () => void;
}

interface AgentStatus {
  taskId: string;
  agentName: string;
  status: 'waiting' | 'working' | 'completed' | 'failed';
  progress: number;
  output: string[];
  error?: string;
  startTime?: number;
  endTime?: number;
}

export const ParallelCockpit: React.FC<ParallelCockpitProps> = ({
  tasks,
  apiClient,
  repoPath = process.cwd(),
  sessionId,
  onComplete,
  onExit
}) => {
  const { exit } = useApp();
  const [taskExecutor] = useState(() => new TaskExecutor(apiClient));
  const [agentStatuses, setAgentStatuses] = useState<Map<string, AgentStatus>>(new Map());
  const [selectedAgentIndex, setSelectedAgentIndex] = useState(0);
  const [isExecuting, setIsExecuting] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  // Initialize agent statuses
  useEffect(() => {
    const initialStatuses = new Map<string, AgentStatus>();
    tasks.forEach((task) => {
      initialStatuses.set(task.agentId, {
        taskId: task.id,
        agentName: task.agentName,
        status: 'waiting',
        progress: 0,
        output: []
      });
    });
    setAgentStatuses(initialStatuses);
  }, [tasks]);

  // Start task execution
  useEffect(() => {
    if (!isExecuting && agentStatuses.size > 0) {
      setIsExecuting(true);
      executeTasks();
    }
  }, [agentStatuses]);

  const executeTasks = async () => {
    // Execute all tasks in parallel
    const promises = tasks.map(async (task) => {
      // Update status to working
      setAgentStatuses(prev => {
        const newMap = new Map(prev);
        const status = newMap.get(task.agentId);
        if (status) {
          status.status = 'working';
          status.startTime = Date.now();
          status.output.push(`🚀 Starting task: ${task.title}`);
        }
        return newMap;
      });

      try {
        // Create a task prompt for the agent
        const taskPrompt = `
Task: ${task.title}
Description: ${task.description}
Repository Path: ${repoPath}
Session ID: ${sessionId}

Please complete this task and provide a detailed summary of what you did.
`;

        // Execute the task
        await new Promise<void>((resolve, reject) => {
          let outputBuffer = '';
          
          // Set up event listeners
          taskExecutor.on('taskProgress', (taskId: string, progress: number) => {
            if (taskId === task.id) {
              setAgentStatuses(prev => {
                const newMap = new Map(prev);
                const status = newMap.get(task.agentId);
                if (status) {
                  status.progress = progress;
                }
                return newMap;
              });
            }
          });

          taskExecutor.on('taskComplete', (taskId: string, result: string) => {
            if (taskId === task.id) {
              setAgentStatuses(prev => {
                const newMap = new Map(prev);
                const status = newMap.get(task.agentId);
                if (status) {
                  status.status = 'completed';
                  status.endTime = Date.now();
                  status.output.push('✅ Task completed successfully');
                  status.output.push(result);
                  status.progress = 100;
                }
                return newMap;
              });
              setCompletedCount(prev => prev + 1);
              resolve();
            }
          });

          taskExecutor.on('taskFailed', (taskId: string, error: Error) => {
            if (taskId === task.id) {
              setAgentStatuses(prev => {
                const newMap = new Map(prev);
                const status = newMap.get(task.agentId);
                if (status) {
                  status.status = 'failed';
                  status.endTime = Date.now();
                  status.error = error.message;
                  status.output.push('❌ Task failed');
                  status.output.push(error.message);
                }
                return newMap;
              });
              setCompletedCount(prev => prev + 1);
              reject(error);
            }
          });

          // Execute the task using the old signature
          (taskExecutor as any).executeTaskOld(task.id, task.agentId, taskPrompt)
            .catch(reject);
        });

        return { taskId: task.id, success: true };
      } catch (error: any) {
        return { taskId: task.id, success: false, error: error.message || 'Unknown error' };
      }
    });

    // Wait for all tasks to complete
    const results = await Promise.allSettled(promises);
    
    // Prepare results map
    const resultsMap = new Map<string, TaskExecutionResult>();
    results.forEach((result, index) => {
      const task = tasks[index];
      if (result.status === 'fulfilled') {
        resultsMap.set(task.id, result.value);
      } else {
        resultsMap.set(task.id, {
          taskId: task.id,
          success: false,
          error: result.reason?.message || 'Unknown error'
        });
      }
    });

    // Call onComplete after a short delay
    setTimeout(() => {
      onComplete(resultsMap);
    }, 2000);
  };

  // Handle input
  useInput((input, key) => {
    if (key.escape) {
      onExit();
    } else if (key.upArrow || input === 'k') {
      setSelectedAgentIndex(Math.max(0, selectedAgentIndex - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedAgentIndex(Math.min(agentStatuses.size - 1, selectedAgentIndex + 1));
    }
  });

  const getStatusIcon = (status: AgentStatus['status']) => {
    switch (status) {
      case 'waiting':
        return '⏳';
      case 'working':
        return <Text color={colors.info}><Spinner type="dots" /></Text>;
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '•';
    }
  };

  const getStatusColor = (status: AgentStatus['status']) => {
    switch (status) {
      case 'waiting':
        return fuegoColors.text.dimmed;
      case 'working':
        return colors.info;
      case 'completed':
        return colors.success;
      case 'failed':
        return colors.error;
      default:
        return fuegoColors.text.secondary;
    }
  };

  const formatDuration = (startTime?: number, endTime?: number) => {
    if (!startTime) return '';
    const end = endTime || Date.now();
    const duration = Math.floor((end - startTime) / 1000);
    return `${duration}s`;
  };

  const agentArray = Array.from(agentStatuses.values());
  const selectedAgent = agentArray[selectedAgentIndex];

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text color={fuegoColors.text.primary} bold>
          🎯 Parallel Task Execution Cockpit
        </Text>
        <Text color={fuegoColors.text.secondary}>
          {' '}• {completedCount}/{tasks.length} tasks completed
        </Text>
      </Box>

      <Box flexDirection="row" marginBottom={1}>
        <Box flexDirection="column" marginRight={4} minWidth={40}>
          <Text color={fuegoColors.text.secondary} bold>
            Agent Status
          </Text>
          <Box marginTop={1} flexDirection="column">
            {agentArray.map((agent, index) => {
              const isSelected = index === selectedAgentIndex;
              const task = tasks.find(t => t.agentId === agent.taskId);
              
              return (
                <Box key={agent.taskId} marginBottom={1}>
                  <Text color={isSelected ? fuegoColors.text.primary : fuegoColors.text.secondary}>
                    {isSelected ? '▶' : ' '} {getStatusIcon(agent.status)} {agent.agentName}
                  </Text>
                  <Box marginLeft={4}>
                    <Text color={getStatusColor(agent.status)} dimColor>
                      {agent.status === 'working' && `Progress: ${agent.progress}%`}
                      {(agent.status === 'completed' || agent.status === 'failed') && 
                        `Duration: ${formatDuration(agent.startTime, agent.endTime)}`}
                    </Text>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        <Box flexDirection="column" flexGrow={1}>
          <Text color={fuegoColors.text.secondary} bold>
            Agent Output: {selectedAgent?.agentName}
          </Text>
          <Box 
            marginTop={1} 
            borderStyle="round"
            borderColor={fuegoColors.border.subtle}
            paddingX={1}
            height={15}
            flexDirection="column"
          >
            {selectedAgent?.output.map((line, index) => (
              <Text key={index} wrap="wrap">
                {line}
              </Text>
            ))}
            {selectedAgent?.error && (
              <Text color={colors.error}>
                Error: {selectedAgent.error}
              </Text>
            )}
          </Box>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color={fuegoColors.text.dimmed}>
          ↑↓/jk: Navigate agents • ESC: Exit
        </Text>
      </Box>
    </Box>
  );
};