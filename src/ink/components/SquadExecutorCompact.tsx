import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp, Spacer } from 'ink';
import { colors, fuegoColors } from '../theme/colors.js';
import type { Task } from '../../services/claude-task-generator.js';
import type { AgentConfig } from '../../services/squad-storage.js';
import type { TaskStatus } from './SquadExecutorV3.js';
import {
  AnimatedStatusIcon,
  EnhancedProgressBar,
  MetricsDisplay,
  GlassBox,
  NotificationToast
} from './SquadExecutorUI.js';

// Compact Agent Card - Single line with essential info
const CompactAgentCard: React.FC<{
  task: TaskStatus;
  taskDetails: Task;
  agent?: AgentConfig;
  isSelected: boolean;
  index: number;
  width: number;
}> = ({ task, taskDetails, agent, isSelected, index, width }) => {
  const maxActivityWidth = width - 50; // Reserve space for other elements
  
  // Truncate activity to fit
  const truncateActivity = (text: string, maxWidth: number) => {
    if (text.length <= maxWidth) return text;
    return text.substring(0, maxWidth - 3) + '...';
  };
  
  return (
    <Box
      width={width}
      paddingLeft={1}
    >
      {/* Selection indicator */}
      <Text color={isSelected ? fuegoColors.accent.cyan : 'gray'}>
        {isSelected ? '▶' : ' '}
      </Text>
      
      {/* Status Icon */}
      <Box marginRight={1}>
        <AnimatedStatusIcon status={task.status} />
      </Box>
      
      {/* Agent Number & Emoji */}
      <Box width={4}>
        <Text color={isSelected ? 'white' : 'gray'}>{index + 1}.</Text>
      </Box>
      
      {/* Agent Name */}
      <Box width={20} marginRight={1}>
        <Text color={isSelected ? fuegoColors.accent.cyan : 'white'} wrap="truncate">
          {agent?.emoji || '🤖'} {task.agentName}
        </Text>
      </Box>
      
      {/* Progress or Status */}
      <Box width={12} marginRight={1}>
        {task.status === 'running' ? (
          <EnhancedProgressBar value={task.progress} width={10} showPercentage={false} />
        ) : (
          <Text color={getStatusColor(task.status)} wrap="truncate">
            {task.status}
          </Text>
        )}
      </Box>
      
      {/* Current Activity */}
      <Box flexGrow={1} marginRight={1}>
        <Text color={fuegoColors.text.dimmed} wrap="truncate">
          {truncateActivity(task.currentActivity || 'Waiting...', maxActivityWidth)}
        </Text>
      </Box>
      
      {/* Metrics */}
      {task.stats && (task.stats.filesModified || task.stats.linesAdded || task.stats.linesRemoved) ? (
        <Box>
          {task.stats.filesModified && (
            <Text color="blue">📄{task.stats.filesModified} </Text>
          )}
          {task.stats.linesAdded && (
            <Text color="green">+{task.stats.linesAdded} </Text>
          )}
          {task.stats.linesRemoved && (
            <Text color="red">-{task.stats.linesRemoved}</Text>
          )}
        </Box>
      ) : null}
    </Box>
  );
};

// Detailed view for selected agent
const AgentDetailPanel: React.FC<{
  task: TaskStatus;
  taskDetails: Task;
  agent?: AgentConfig;
}> = ({ task, taskDetails, agent }) => {
  return (
    <GlassBox borderColor={fuegoColors.accent.cyan}>
      <Box flexDirection="column" width="100%">
        <Box marginBottom={1}>
          <Text bold color={fuegoColors.accent.cyan}>
            {agent?.emoji || '🤖'} {task.agentName} - {taskDetails.title}
          </Text>
          <Spacer />
          <AnimatedStatusIcon status={task.status} />
          <Text> {task.status}</Text>
        </Box>
        
        {/* Progress */}
        {task.status === 'running' && (
          <Box marginBottom={1}>
            <EnhancedProgressBar value={task.progress} width={50} color="cyan" />
          </Box>
        )}
        
        {/* Acceptance Criteria */}
        <Box flexDirection="column" marginBottom={1}>
          <Text color="gray" dimColor>Acceptance Criteria:</Text>
          {taskDetails.acceptance_criteria.slice(0, 2).map((criterion, i) => (
            <Text key={i} color={fuegoColors.text.secondary}>
              • {criterion}
            </Text>
          ))}
          {taskDetails.acceptance_criteria.length > 2 && (
            <Text color="gray">  ...and {taskDetails.acceptance_criteria.length - 2} more</Text>
          )}
        </Box>
        
        {/* Recent Activity */}
        <Box flexDirection="column">
          <Text color="gray" dimColor>Recent Activity:</Text>
          {task.output.slice(-3).map((line, i) => (
            <Text key={i} color={fuegoColors.text.dimmed} wrap="truncate">
              └ {line}
            </Text>
          ))}
        </Box>
      </Box>
    </GlassBox>
  );
};

// Main compact layout component
export const SquadExecutorCompactView: React.FC<{
  tasks: Task[];
  agents: AgentConfig[];
  taskStatuses: Map<string, TaskStatus>;
  selectedIndex: number;
  squadName: string;
  notifications: Array<{ id: string; type: 'success' | 'error' | 'warning' | 'info'; message: string }>;
  isPaused: boolean;
  onNavigate: (direction: 'up' | 'down') => void;
  onSelectAgent: (index: number) => void;
  onAction: (action: string) => void;
}> = ({
  tasks,
  agents,
  taskStatuses,
  selectedIndex,
  squadName,
  notifications,
  isPaused,
  onNavigate,
  onSelectAgent,
  onAction
}) => {
  const [terminalWidth, setTerminalWidth] = useState(process.stdout.columns || 80);
  const [terminalHeight, setTerminalHeight] = useState(process.stdout.rows || 24);
  
  useEffect(() => {
    const handleResize = () => {
      setTerminalWidth(process.stdout.columns || 80);
      setTerminalHeight(process.stdout.rows || 24);
    };
    
    process.stdout.on('resize', handleResize);
    return () => {
      process.stdout.off('resize', handleResize);
    };
  }, []);
  
  const taskArray = Array.from(taskStatuses.values());
  const selectedTask = taskArray[selectedIndex];
  const selectedTaskDetails = tasks.find(t => t.id === selectedTask?.taskId);
  const selectedAgent = agents.find(a => a.id === selectedTask?.agentId);
  
  const completedCount = taskArray.filter(t => t.status === 'completed').length;
  const runningCount = taskArray.filter(t => t.status === 'running').length;
  const failedCount = taskArray.filter(t => t.status === 'failed').length;
  
  // Calculate available space
  const headerHeight = 3;
  const detailPanelHeight = 12;
  const menuHeight = 2;
  const notificationHeight = notifications.length * 3;
  const availableHeight = terminalHeight - headerHeight - detailPanelHeight - menuHeight - notificationHeight - 2;
  const maxVisibleAgents = Math.max(3, availableHeight);
  
  // Calculate visible range
  const startIndex = Math.max(0, selectedIndex - Math.floor(maxVisibleAgents / 2));
  const endIndex = Math.min(taskArray.length, startIndex + maxVisibleAgents);
  const visibleTasks = taskArray.slice(startIndex, endIndex);
  
  return (
    <Box flexDirection="column" width={terminalWidth}>
      {/* Notifications */}
      {notifications.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {notifications.map(notif => (
            <NotificationToast
              key={notif.id}
              type={notif.type}
              message={notif.message}
              onDismiss={() => onAction(`dismiss-notification-${notif.id}`)}
            />
          ))}
        </Box>
      )}
      
      {/* Compact Header */}
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text bold color={fuegoColors.accent.cyan}>🎯 {squadName}</Text>
        <Spacer />
        <Text color="green">✓{completedCount}</Text>
        <Text> </Text>
        <Text color="yellow">⚡{runningCount}</Text>
        <Text> </Text>
        <Text color="red">✗{failedCount}</Text>
        <Text color="gray">/{tasks.length}</Text>
        {isPaused && <Text color="yellow"> [PAUSED]</Text>}
      </Box>
      
      {/* Agent List */}
      <Box flexDirection="column" height={maxVisibleAgents}>
        {startIndex > 0 && (
          <Text color="gray" dimColor>  ↑ {startIndex} more agents above</Text>
        )}
        {visibleTasks.map((task, i) => {
          const actualIndex = startIndex + i;
          const agent = agents.find(a => a.id === task.agentId);
          const taskDetails = tasks.find(t => t.id === task.taskId);
          
          return taskDetails ? (
            <CompactAgentCard
              key={task.taskId}
              task={task}
              taskDetails={taskDetails}
              agent={agent}
              isSelected={actualIndex === selectedIndex}
              index={actualIndex}
              width={terminalWidth}
            />
          ) : null;
        })}
        {endIndex < taskArray.length && (
          <Text color="gray" dimColor>  ↓ {taskArray.length - endIndex} more agents below</Text>
        )}
      </Box>
      
      {/* Selected Agent Details */}
      {selectedTask && selectedTaskDetails && (
        <Box marginTop={1}>
          <AgentDetailPanel
            task={selectedTask}
            taskDetails={selectedTaskDetails}
            agent={selectedAgent}
          />
        </Box>
      )}
      
      {/* Compact Menu */}
      <Box borderStyle="single" borderColor="gray" paddingX={1} marginTop={1}>
        <Text dimColor>
          <Text bold>[↑↓]</Text> Nav • 
          <Text bold>[Enter]</Text> Full • 
          <Text bold>[a/A]</Text> Attach • 
          <Text bold>[{isPaused ? 'r' : 'p'}]</Text> {isPaused ? 'Resume' : 'Pause'} • 
          <Text bold>[q]</Text> Quit
        </Text>
      </Box>
    </Box>
  );
};

function getStatusColor(status: TaskStatus['status']) {
  switch (status) {
    case 'pending': return 'gray';
    case 'launching': return 'yellow';
    case 'running': return 'cyan';
    case 'completed': return 'green';
    case 'failed': return 'red';
    case 'paused': return 'yellow';
    default: return 'white';
  }
}