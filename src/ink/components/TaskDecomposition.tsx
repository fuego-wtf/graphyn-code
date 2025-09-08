import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { fuegoColors, colors } from '../theme/colors.js';

interface Task {
  id: string;
  title: string;
  description: string;
  agentType: '@backend' | '@frontend' | '@architect' | '@tester' | '@mobile';
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'failed';
  priority: 'high' | 'medium' | 'low';
  estimatedTime?: string;
  dependencies?: string[];
  output?: string[];
  error?: string;
  startTime?: number;
  endTime?: number;
}

interface TaskDecompositionProps {
  tasks: Task[];
  selectedIndex: number;
  showDetailView: boolean;
  onTaskSelect: (index: number) => void;
  maxHeight?: number;
}

export const TaskDecomposition: React.FC<TaskDecompositionProps> = ({
  tasks,
  selectedIndex,
  showDetailView,
  onTaskSelect,
  maxHeight = 20
}) => {
  const [scrollOffset, setScrollOffset] = useState(0);

  // Auto-scroll to keep selected task visible
  useEffect(() => {
    const visibleHeight = showDetailView ? Math.floor(maxHeight / 2) : maxHeight - 2;
    
    if (selectedIndex < scrollOffset) {
      setScrollOffset(selectedIndex);
    } else if (selectedIndex >= scrollOffset + visibleHeight) {
      setScrollOffset(Math.max(0, selectedIndex - visibleHeight + 1));
    }
  }, [selectedIndex, showDetailView, maxHeight]);

  // Get status icon and color
  const getStatusDisplay = (task: Task) => {
    switch (task.status) {
      case 'pending':
        return { icon: '⏳', color: fuegoColors.text.dimmed };
      case 'in_progress':
        return { icon: <Spinner type="dots" />, color: colors.info };
      case 'completed':
        return { icon: '✅', color: colors.success };
      case 'blocked':
        return { icon: '🚧', color: colors.warning };
      case 'failed':
        return { icon: '❌', color: colors.error };
      default:
        return { icon: '•', color: fuegoColors.text.secondary };
    }
  };

  // Get agent type styling
  const getAgentTypeColor = (agentType: Task['agentType']) => {
    switch (agentType) {
      case '@backend':
        return colors.info;
      case '@frontend':
        return fuegoColors.accent.magenta;
      case '@architect':
        return colors.warning;
      case '@tester':
        return colors.success;
      case '@mobile':
        return fuegoColors.accent.cyan;
      default:
        return fuegoColors.text.secondary;
    }
  };

  // Get priority indicator
  const getPriorityIcon = (priority: Task['priority']) => {
    switch (priority) {
      case 'high':
        return <Text color={colors.error}>🔥</Text>;
      case 'medium':
        return <Text color={colors.warning}>⚡</Text>;
      case 'low':
        return <Text color={fuegoColors.text.dimmed}>•</Text>;
      default:
        return null;
    }
  };

  // Calculate task duration
  const getTaskDuration = (task: Task) => {
    if (!task.startTime) return null;
    const endTime = task.endTime || Date.now();
    const duration = Math.floor((endTime - task.startTime) / 1000);
    return `${duration}s`;
  };

  // Group tasks by agent type
  const tasksByAgent = tasks.reduce((groups, task) => {
    if (!groups[task.agentType]) {
      groups[task.agentType] = [];
    }
    groups[task.agentType].push(task);
    return groups;
  }, {} as Record<string, Task[]>);

  // Get visible tasks based on scroll
  const visibleHeight = showDetailView ? Math.floor(maxHeight / 2) : maxHeight - 2;
  const visibleTasks = tasks.slice(scrollOffset, scrollOffset + visibleHeight);

  // Get task statistics
  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    failed: tasks.filter(t => t.status === 'failed').length
  };

  return (
    <Box flexDirection="column" height={maxHeight}>
      {/* Task statistics header */}
      <Box borderBottom marginBottom={1} paddingBottom={1}>
        <Box justifyContent="space-between" width="100%">
          <Box flexDirection="row" gap={2}>
            <Text color={colors.success}>✅ {stats.completed}</Text>
            <Text color={colors.info}>⚡ {stats.inProgress}</Text>
            <Text color={colors.warning}>🚧 {stats.blocked}</Text>
            {stats.failed > 0 && <Text color={colors.error}>❌ {stats.failed}</Text>}
          </Box>
          <Text color={fuegoColors.text.dimmed} dimColor>
            {stats.completed}/{stats.total}
          </Text>
        </Box>
      </Box>

      {/* Task list */}
      <Box flexDirection="column" flexGrow={1}>
        {tasks.length === 0 ? (
          <Box justifyContent="center" alignItems="center" height="100%">
            <Text color={fuegoColors.text.dimmed} dimColor>
              🤖 No tasks generated yet
            </Text>
          </Box>
        ) : (
          <Box flexDirection="column">
            {/* Scroll indicator - more tasks above */}
            {scrollOffset > 0 && (
              <Box justifyContent="center" marginBottom={1}>
                <Text color={fuegoColors.text.dimmed} dimColor>
                  ⋯ {scrollOffset} more tasks above ⋯
                </Text>
              </Box>
            )}

            {/* Visible tasks */}
            {visibleTasks.map((task, visibleIndex) => {
              const actualIndex = scrollOffset + visibleIndex;
              const isSelected = actualIndex === selectedIndex;
              const statusDisplay = getStatusDisplay(task);
              
              return (
                <Box key={task.id} marginBottom={1}>
                  <Box flexDirection="row" alignItems="center">
                    {/* Selection indicator */}
                    <Text color={isSelected ? fuegoColors.text.primary : 'transparent'}>
                      ▶{' '}
                    </Text>
                    
                    {/* Status icon */}
                    <Box marginRight={1} minWidth={2}>
                      <Text color={statusDisplay.color}>
                        {typeof statusDisplay.icon === 'string' ? statusDisplay.icon : statusDisplay.icon}
                      </Text>
                    </Box>
                    
                    {/* Priority indicator */}
                    <Box marginRight={1}>
                      {getPriorityIcon(task.priority)}
                    </Box>
                    
                    {/* Task title */}
                    <Box flexGrow={1}>
                      <Text 
                        color={isSelected ? fuegoColors.text.primary : fuegoColors.text.secondary}
                        bold={isSelected}
                      >
                        {actualIndex + 1}. {task.title}
                      </Text>
                    </Box>
                  </Box>

                  {/* Agent type and metadata */}
                  <Box marginLeft={4} marginTop={0}>
                    <Box flexDirection="row" gap={2}>
                      <Text color={getAgentTypeColor(task.agentType)} bold>
                        {task.agentType}
                      </Text>
                      {task.estimatedTime && (
                        <Text color={fuegoColors.text.dimmed} dimColor>
                          ~{task.estimatedTime}
                        </Text>
                      )}
                      {getTaskDuration(task) && (
                        <Text color={fuegoColors.text.dimmed} dimColor>
                          ({getTaskDuration(task)})
                        </Text>
                      )}
                    </Box>
                  </Box>

                  {/* Dependencies */}
                  {task.dependencies && task.dependencies.length > 0 && (
                    <Box marginLeft={4} marginTop={1}>
                      <Text color={colors.warning} dimColor>
                        ⚡ Depends on: {task.dependencies.map(depId => {
                          const depTask = tasks.find(t => t.id === depId);
                          return depTask ? depTask.title : depId;
                        }).join(', ')}
                      </Text>
                    </Box>
                  )}

                  {/* Error display */}
                  {task.error && (
                    <Box marginLeft={4} marginTop={1}>
                      <Text color={colors.error}>
                        💥 {task.error}
                      </Text>
                    </Box>
                  )}
                </Box>
              );
            })}

            {/* Scroll indicator - more tasks below */}
            {scrollOffset + visibleHeight < tasks.length && (
              <Box justifyContent="center" marginTop={1}>
                <Text color={fuegoColors.text.dimmed} dimColor>
                  ⋯ {tasks.length - (scrollOffset + visibleHeight)} more tasks below ⋯
                </Text>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Detail view for selected task */}
      {showDetailView && selectedIndex >= 0 && selectedIndex < tasks.length && (
        <Box 
          borderTop 
          marginTop={1} 
          paddingTop={1}
          borderColor={fuegoColors.border.accent}
        >
          <Box flexDirection="column">
            <Text color={fuegoColors.text.primary} bold>
              📝 Task Details
            </Text>
            <Box marginTop={1} marginLeft={2}>
              <Text color={fuegoColors.text.secondary} wrap="wrap">
                {tasks[selectedIndex].description}
              </Text>
            </Box>
            
            {/* Recent output */}
            {tasks[selectedIndex].output && tasks[selectedIndex].output!.length > 0 && (
              <Box marginTop={1}>
                <Text color={fuegoColors.text.dimmed} dimColor>
                  Recent output:
                </Text>
                <Box marginLeft={2} marginTop={1}>
                  {tasks[selectedIndex].output!.slice(-3).map((line, index) => (
                    <Text key={index} color={fuegoColors.text.dimmed} dimColor>
                      {line}
                    </Text>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};