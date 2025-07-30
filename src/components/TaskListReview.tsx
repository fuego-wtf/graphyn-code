import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { SquadTask, AgentConfig } from '../types/squad.js';

interface TaskListReviewProps {
  sessionId: string;
  squadId: string;
  userQuery: string;
  threadId: string;
  agents: AgentConfig[];
  token: string;
  apiUrl: string;
  onTasksApproved: (tasks: SquadTask[]) => void;
  onTasksRejected: () => void;
}

type ViewMode = 'loading' | 'list' | 'detail' | 'error';

export const TaskListReview: React.FC<TaskListReviewProps> = ({
  sessionId,
  squadId,
  userQuery,
  threadId,
  agents,
  token,
  apiUrl,
  onTasksApproved,
  onTasksRejected
}) => {
  const [tasks, setTasks] = useState<SquadTask[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('loading');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastKeyPress, setLastKeyPress] = useState<string>('');

  useEffect(() => {
    generateTasks();
  }, []);

  const generateTasks = async () => {
    try {
      setViewMode('loading');
      
      // Call task generation endpoint
      const response = await fetch(`${apiUrl}/api/squads/${squadId}/generate-tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userQuery,
          threadId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate tasks: ${response.statusText}`);
      }

      const data = await response.json() as { tasks: SquadTask[] };
      
      if (data.tasks && data.tasks.length > 0) {
        setTasks(data.tasks);
        setViewMode('list');
      } else {
        throw new Error('No tasks generated');
      }
    } catch (err) {
      console.error('Error generating tasks:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setViewMode('error');
    }
  };

  const handleApproval = async () => {
    try {
      // Save tasks to the session
      const response = await fetch(`${apiUrl}/api/squads/sessions/${sessionId}/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tasks })
      });

      if (!response.ok) {
        throw new Error(`Failed to save tasks: ${response.statusText}`);
      }

      const data = await response.json() as { tasks: SquadTask[] };
      onTasksApproved(data.tasks);
    } catch (err) {
      console.error('Error saving tasks:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setViewMode('error');
    }
  };

  // Keyboard navigation
  useInput((input, key) => {
    if (viewMode === 'list') {
      if (key.upArrow || input === 'k') {
        setSelectedIndex(Math.max(0, selectedIndex - 1));
        setLastKeyPress('');
      } else if (key.downArrow || input === 'j') {
        setSelectedIndex(Math.min(tasks.length - 1, selectedIndex + 1));
        setLastKeyPress('');
      } else if (input === 'g') {
        if (lastKeyPress === 'g') {
          setSelectedIndex(0);
          setLastKeyPress('');
        } else {
          setLastKeyPress('g');
        }
      } else if (input === 'G') {
        setSelectedIndex(Math.max(0, tasks.length - 1));
        setLastKeyPress('');
      } else if (key.return || input === 'l') {
        setViewMode('detail');
      } else if (input === 'a' || input === 'A') {
        handleApproval();
      } else if (input === 'r' || input === 'R') {
        setViewMode('loading');
        generateTasks();
      } else if (key.escape || input === 'q') {
        onTasksRejected();
      } else if (input !== 'g') {
        setLastKeyPress('');
      }
    } else if (viewMode === 'detail') {
      if (key.escape || input === 'h') {
        setViewMode('list');
      }
    } else if (viewMode === 'error') {
      if (input === 'r' || input === 'R') {
        setViewMode('loading');
        generateTasks();
      } else if (key.escape || input === 'q') {
        onTasksRejected();
      }
    }
  });

  const getAgentName = (agentId: string): string => {
    const agent = agents.find(a => a.id === agentId);
    return agent ? `${agent.emoji} ${agent.name}` : agentId;
  };

  const renderLoading = () => (
    <Box flexDirection="column">
      <Text color="cyan" bold>
        <Spinner type="dots" /> Generating task list from your query...
      </Text>
      <Text dimColor>This may take a few seconds...</Text>
    </Box>
  );

  const renderError = () => (
    <Box flexDirection="column">
      <Text color="red" bold>❌ Error generating tasks</Text>
      <Text>{error}</Text>
      <Box marginTop={1}>
        <Text dimColor>R Retry • ESC/q Cancel</Text>
      </Box>
    </Box>
  );

  const renderListView = () => (
    <Box flexDirection="column">
      <Text color="cyan" bold>📋 Generated Task List:</Text>
      <Text dimColor>Query: "{userQuery}"</Text>
      
      <Box marginTop={1} flexDirection="column">
        {tasks.map((task, idx) => (
          <Box key={idx} marginBottom={1}>
            <Text
              color={idx === selectedIndex ? 'cyan' : 'white'}
              bold={idx === selectedIndex}
            >
              {idx === selectedIndex ? '▶' : ' '} {idx + 1}. {task.title}
            </Text>
            <Box marginLeft={4}>
              <Text dimColor>Assigned to: {getAgentName(task.assigned_agent_id)}</Text>
              {task.dependencies.length > 0 && (
                <Text dimColor>Depends on: {task.dependencies.join(', ')}</Text>
              )}
            </Box>
          </Box>
        ))}
      </Box>
      
      <Box marginTop={2} flexDirection="column">
        <Text dimColor>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text>
        <Text dimColor>↑↓/jk Navigate • ↵/l View Details</Text>
        <Text dimColor>A Approve Tasks • R Regenerate • ESC/q Cancel</Text>
      </Box>
    </Box>
  );

  const renderDetailView = () => {
    const task = tasks[selectedIndex];
    if (!task) return null;

    return (
      <Box flexDirection="column">
        <Text color="cyan" bold>📋 Task Details</Text>
        
        <Box marginTop={1} borderStyle="single" padding={1} flexDirection="column">
          <Text bold>Title:</Text>
          <Text>{task.title}</Text>
          
          {task.description && (
            <Box marginTop={1}>
              <Text bold>Description:</Text>
              <Text wrap="wrap">{task.description}</Text>
            </Box>
          )}
          
          <Box marginTop={1}>
            <Text bold>Assigned to:</Text>
            <Text>{getAgentName(task.assigned_agent_id)}</Text>
          </Box>
          
          {task.dependencies.length > 0 && (
            <Box marginTop={1}>
              <Text bold>Dependencies:</Text>
              <Text>{task.dependencies.map(dep => `Task ${dep}`).join(', ')}</Text>
            </Box>
          )}
          
          <Box marginTop={1}>
            <Text bold>Status:</Text>
            <Text color="yellow">{task.status}</Text>
          </Box>
        </Box>
        
        <Box marginTop={1}>
          <Text dimColor>ESC/h Back to List</Text>
        </Box>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      {viewMode === 'loading' && renderLoading()}
      {viewMode === 'error' && renderError()}
      {viewMode === 'list' && renderListView()}
      {viewMode === 'detail' && renderDetailView()}
    </Box>
  );
};