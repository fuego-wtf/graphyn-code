import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { colors, fuegoColors } from '../theme/colors.js';
import { FeedbackSession } from './FeedbackSession.js';

interface Task {
  id: string;
  title: string;
  description: string;
  agentId: string;
  agentName: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress?: number;
  result?: any;
}

interface CockpitProps {
  tasks: Task[];
  onTaskSelect: (taskId: string) => Promise<void>;
  onTaskComplete: (taskId: string, result: any) => void;
  onFeedback: (taskId: string, rating: number, comment: string) => void;
  onExit: () => void;
}

export const Cockpit: React.FC<CockpitProps> = ({
  tasks,
  onTaskSelect,
  onTaskComplete,
  onFeedback,
  onExit
}) => {
  const { exit } = useApp();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showFeedback, setShowFeedback] = useState<string | null>(null);
  const [taskStatuses, setTaskStatuses] = useState<Map<string, Task['status']>>(
    new Map(tasks.map(t => [t.id, t.status]))
  );

  useInput((input, key) => {
    if (key.escape && !showFeedback) {
      onExit();
    }
  });

  // Handle task status updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Check for completed tasks
      tasks.forEach(task => {
        const currentStatus = taskStatuses.get(task.id);
        if (task.status === 'completed' && currentStatus !== 'completed') {
          addNotification(`✅ Task "${task.title}" completed by ${task.agentName}`);
          setTaskStatuses(prev => new Map(prev).set(task.id, 'completed'));
          
          // Check if all tasks are completed
          const allCompleted = tasks.every(t => 
            t.status === 'completed' || taskStatuses.get(t.id) === 'completed'
          );
          
          if (allCompleted && !showFeedback) {
            setShowFeedback('all');
          }
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [tasks, taskStatuses, showFeedback]);

  const addNotification = (message: string) => {
    setNotifications(prev => [...prev, message]);
    // Remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.slice(1));
    }, 5000);
  };

  const handleTaskSelect = useCallback(async (item: { value: string }) => {
    const taskId = item.value;
    setSelectedTaskId(taskId);
    
    try {
      await onTaskSelect(taskId);
      setTaskStatuses(prev => new Map(prev).set(taskId, 'in_progress'));
    } catch (error) {
      console.error('Failed to start task:', error);
      setTaskStatuses(prev => new Map(prev).set(taskId, 'failed'));
    }
  }, [onTaskSelect]);

  const handleFeedback = useCallback((rating: number, comment: string) => {
    if (showFeedback === 'all') {
      // Aggregate feedback for all tasks
      tasks.forEach(task => {
        onFeedback(task.id, rating, comment);
      });
    } else if (showFeedback) {
      onFeedback(showFeedback, rating, comment);
    }
    setShowFeedback(null);
  }, [showFeedback, tasks, onFeedback]);

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'in_progress': return '🔄';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '❓';
    }
  };

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'pending': return fuegoColors.text.secondary;
      case 'in_progress': return colors.warning;
      case 'completed': return colors.success;
      case 'failed': return colors.error;
      default: return fuegoColors.text.primary;
    }
  };

  if (showFeedback) {
    const feedbackTitle = showFeedback === 'all' 
      ? 'All Tasks'
      : tasks.find(t => t.id === showFeedback)?.title || 'Task';
    
    return (
      <FeedbackSession
        taskTitle={feedbackTitle}
        onSubmit={handleFeedback}
        onSkip={() => setShowFeedback(null)}
      />
    );
  }

  const taskItems = tasks.map(task => ({
    label: `${getStatusIcon(taskStatuses.get(task.id) || task.status)} ${task.title} (${task.agentName})`,
    value: task.id
  }));

  const completedCount = Array.from(taskStatuses.values()).filter(s => s === 'completed').length;
  const progressPercentage = Math.round((completedCount / tasks.length) * 100);

  return (
    <Box flexDirection="column" paddingY={1}>
      <Box marginBottom={1}>
        <Text color={fuegoColors.text.primary} bold>
          🚀 Mission Control - Cockpit
        </Text>
      </Box>

      {/* Progress Bar */}
      <Box marginBottom={1}>
        <Text color={fuegoColors.text.primary}>
          Progress: {completedCount}/{tasks.length} tasks ({progressPercentage}%)
        </Text>
      </Box>
      <Box marginBottom={2}>
        <Text>
          [{'█'.repeat(Math.floor(progressPercentage / 5))}{'░'.repeat(20 - Math.floor(progressPercentage / 5))}]
        </Text>
      </Box>

      {/* Notifications */}
      {notifications.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {notifications.map((notif, index) => (
            <Text key={index} color={colors.success}>
              {notif}
            </Text>
          ))}
        </Box>
      )}

      {/* Task List */}
      <Box 
        borderStyle="round" 
        borderColor={fuegoColors.border.subtle} 
        paddingX={2} 
        paddingY={1}
        flexDirection="column"
      >
        <Text color={fuegoColors.text.primary}>
          Select a task to initiate agent execution:
        </Text>
        
        <SelectInput
          items={taskItems}
          onSelect={handleTaskSelect}
          indicatorComponent={({ isSelected }) => (
            <Text color={isSelected ? fuegoColors.text.primary : fuegoColors.text.secondary}>
              {isSelected ? '▶ ' : '  '}
            </Text>
          )}
        />

        {/* Active Task Details */}
        {selectedTaskId && (
          <Box marginTop={2} flexDirection="column">
            <Text color={fuegoColors.text.secondary}>
              Active: {tasks.find(t => t.id === selectedTaskId)?.title}
            </Text>
            {taskStatuses.get(selectedTaskId) === 'in_progress' && (
              <Box marginTop={1}>
                <Text color={colors.warning}>
                  <Spinner type="dots" /> Processing...
                </Text>
              </Box>
            )}
          </Box>
        )}
      </Box>

      <Box marginTop={1}>
        <Text color={fuegoColors.text.dimmed} dimColor>
          Press Enter to start task • ESC to exit cockpit
        </Text>
      </Box>
    </Box>
  );
};