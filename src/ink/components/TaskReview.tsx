import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { Task } from '../../services/claude-task-generator.js';
import { AgentConfig } from '../../services/squad-storage.js';
import chalk from 'chalk';

interface TaskReviewProps {
  tasks: Task[];
  agents: AgentConfig[];
  onApprove: (tasks: Task[]) => void;
  onRegenerate: () => void;
  onCancel: () => void;
}

type ViewMode = 'list' | 'detail' | 'edit';

export const TaskReview: React.FC<TaskReviewProps> = ({
  tasks: initialTasks,
  agents,
  onApprove,
  onRegenerate,
  onCancel
}) => {
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const { exit } = useApp();

  // Navigation and controls
  useInput((input, key) => {
    if (key.escape) {
      if (viewMode === 'detail' || viewMode === 'edit') {
        setViewMode('list');
        setEditingField(null);
      } else {
        onCancel();
      }
      return;
    }

    if (viewMode === 'list') {
      // List navigation
      if (key.upArrow || input === 'k') {
        setSelectedIndex(Math.max(0, selectedIndex - 1));
      } else if (key.downArrow || input === 'j') {
        setSelectedIndex(Math.min(tasks.length - 1, selectedIndex + 1));
      } else if (key.return || input === 'l' || input === ' ') {
        setViewMode('detail');
      } else if (input === 'a') {
        onApprove(tasks);
      } else if (input === 'r') {
        onRegenerate();
      } else if (input === 'd') {
        // Delete task
        const newTasks = tasks.filter((_, i) => i !== selectedIndex);
        setTasks(newTasks);
        setSelectedIndex(Math.min(selectedIndex, newTasks.length - 1));
      } else if (input === 'e') {
        setViewMode('edit');
        setEditingField('title');
        setEditValue(tasks[selectedIndex].title);
      }
    } else if (viewMode === 'detail') {
      // Detail view navigation
      if (input === 'e') {
        setViewMode('edit');
        setEditingField('title');
        setEditValue(tasks[selectedIndex].title);
      } else if (key.leftArrow || input === 'h') {
        setViewMode('list');
      }
    } else if (viewMode === 'edit') {
      // Edit mode
      if (key.return) {
        // Save edit
        const updatedTasks = [...tasks];
        const task = updatedTasks[selectedIndex];
        
        if (editingField === 'title') {
          task.title = editValue;
        } else if (editingField === 'description') {
          task.description = editValue;
        } else if (editingField === 'agent') {
          task.assigned_agent = editValue;
        }
        
        setTasks(updatedTasks);
        setViewMode('detail');
        setEditingField(null);
      } else if (key.escape) {
        setViewMode('detail');
        setEditingField(null);
      } else if (key.backspace || key.delete) {
        setEditValue(editValue.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        setEditValue(editValue + input);
      }
    }
  });

  const renderTaskList = () => (
    <Box flexDirection="column">
      <Text bold color="cyan">📋 Generated Tasks ({tasks.length})</Text>
      <Box marginTop={1} flexDirection="column">
        {tasks.map((task, index) => {
          const agent = agents.find(a => a.name === task.assigned_agent);
          const isSelected = index === selectedIndex;
          
          return (
            <Box key={task.id} marginBottom={1}>
              <Text color={isSelected ? 'cyan' : 'white'}>
                {isSelected ? '▶' : ' '} {index + 1}. {task.title}
              </Text>
              <Box marginLeft={3}>
                <Text dimColor>
                  {agent?.emoji || '🤖'} {task.assigned_agent} • 
                  {' '}Complexity: {getComplexityColor(task.estimated_complexity)}
                  {task.dependencies.length > 0 && ` • Depends on: ${task.dependencies.join(', ')}`}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );

  const renderTaskDetail = () => {
    const task = tasks[selectedIndex];
    const agent = agents.find(a => a.name === task.assigned_agent);
    
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">📋 Task Details</Text>
        <Box marginTop={1} flexDirection="column">
          <Text bold>Title:</Text>
          <Text>{task.title}</Text>
          
          <Box marginTop={1}>
            <Text bold>Description:</Text>
            <Text wrap="wrap">{task.description}</Text>
          </Box>
          
          <Box marginTop={1}>
            <Text bold>Assigned to:</Text>
            <Text>{agent?.emoji || '🤖'} {task.assigned_agent}</Text>
          </Box>
          
          <Box marginTop={1}>
            <Text bold>Complexity:</Text>
            <Text>{getComplexityColor(task.estimated_complexity)}</Text>
          </Box>
          
          {task.dependencies.length > 0 && (
            <Box marginTop={1}>
              <Text bold>Dependencies:</Text>
              <Text>{task.dependencies.join(', ')}</Text>
            </Box>
          )}
          
          <Box marginTop={1}>
            <Text bold>Acceptance Criteria:</Text>
            {task.acceptance_criteria.map((criterion, i) => (
              <Text key={i}>  • {criterion}</Text>
            ))}
          </Box>
        </Box>
      </Box>
    );
  };

  const renderEditMode = () => {
    const task = tasks[selectedIndex];
    
    return (
      <Box flexDirection="column">
        <Text bold color="yellow">✏️  Edit Task</Text>
        <Box marginTop={1} flexDirection="column">
          <Text>Editing: {editingField}</Text>
          <Box marginTop={1}>
            <Text>{editValue}</Text>
            <Text color="cyan">│</Text>
          </Box>
        </Box>
      </Box>
    );
  };

  const renderControls = () => (
    <Box marginTop={2} flexDirection="column">
      <Text dimColor>{'─'.repeat(60)}</Text>
      {viewMode === 'list' && (
        <Box flexDirection="column">
          <Text dimColor>↑↓/jk: Navigate • ↵/l/Space: View details • e: Edit</Text>
          <Text dimColor>d: Delete task • a: Approve all • r: Regenerate</Text>
          <Text dimColor>ESC: Cancel</Text>
        </Box>
      )}
      {viewMode === 'detail' && (
        <Box flexDirection="column">
          <Text dimColor>e: Edit task • ←/h: Back to list • ESC: Back</Text>
        </Box>
      )}
      {viewMode === 'edit' && (
        <Box flexDirection="column">
          <Text dimColor>Type to edit • ↵: Save • ESC: Cancel</Text>
        </Box>
      )}
    </Box>
  );

  return (
    <Box flexDirection="column" padding={1}>
      {viewMode === 'list' && renderTaskList()}
      {viewMode === 'detail' && renderTaskDetail()}
      {viewMode === 'edit' && renderEditMode()}
      {renderControls()}
    </Box>
  );
};

function getComplexityColor(complexity: string): string {
  switch (complexity) {
    case 'low':
      return chalk.green(complexity);
    case 'medium':
      return chalk.yellow(complexity);
    case 'high':
      return chalk.red(complexity);
    default:
      return complexity;
  }
}