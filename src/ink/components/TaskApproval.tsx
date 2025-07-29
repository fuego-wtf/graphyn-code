import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { colors, fuegoColors } from '../theme/colors.js';
import { PromptInput } from './PromptInput.js';

interface Task {
  id: string;
  title: string;
  description: string;
  agentId: string;
  agentName: string;
  estimatedTime?: string;
  dependencies?: string[];
}

interface TaskApprovalProps {
  tasks: Task[];
  onApprove: (approvedTasks: Task[]) => void;
  onRequestChanges: (feedback: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const TaskApproval: React.FC<TaskApprovalProps> = ({
  tasks,
  onApprove,
  onRequestChanges,
  onCancel,
  isLoading = false
}) => {
  const [mode, setMode] = useState<'review' | 'feedback'>('review');
  const [feedback, setFeedback] = useState('');
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(0);

  useInput((input, key) => {
    if (mode === 'review') {
      if (key.escape) {
        onCancel();
      } else if (key.return) {
        onApprove(tasks);
      } else if (input === 'r' || input === 'R') {
        setMode('feedback');
      } else if (key.upArrow) {
        setSelectedTaskIndex(Math.max(0, selectedTaskIndex - 1));
      } else if (key.downArrow) {
        setSelectedTaskIndex(Math.min(tasks.length - 1, selectedTaskIndex + 1));
      }
    }
  });

  const handleFeedbackSubmit = useCallback((value: string) => {
    onRequestChanges(value);
    setMode('review');
    setFeedback('');
  }, [onRequestChanges]);

  const getSuggestions = async (prompt: string): Promise<string[]> => {
    // Mock suggestions - in real implementation, this would call the API
    return [
      `${prompt} and ensure proper error handling`,
      `${prompt} with comprehensive test coverage`,
      `${prompt} following our coding standards`,
      `${prompt} and add documentation`,
      `${prompt} with performance optimizations`
    ];
  };

  if (isLoading) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Text color={colors.warning}>
          <Spinner type="dots" /> Generating task list based on your requirements...
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      <Box marginBottom={1}>
        <Text color={fuegoColors.text.primary} bold>
          📋 Task List for Squad Execution
        </Text>
      </Box>

      {mode === 'review' ? (
        <>
          <Box 
            borderStyle="round" 
            borderColor={fuegoColors.border.subtle} 
            paddingX={2} 
            paddingY={1}
            marginBottom={1}
          >
            <Box flexDirection="column">
              {tasks.map((task, index) => (
                <Box 
                  key={task.id} 
                  marginBottom={index < tasks.length - 1 ? 1 : 0}
                  paddingLeft={selectedTaskIndex === index ? 0 : 2}
                >
                  {selectedTaskIndex === index && (
                    <Text color={fuegoColors.text.primary}>▶ </Text>
                  )}
                  <Box flexDirection="column">
                    <Text 
                      color={selectedTaskIndex === index ? fuegoColors.text.primary : fuegoColors.text.secondary}
                      bold={selectedTaskIndex === index}
                    >
                      {index + 1}. {task.title}
                    </Text>
                    <Text color={fuegoColors.text.dimmed} dimColor>
                      Agent: {task.agentName}
                      {task.estimatedTime && ` • Est: ${task.estimatedTime}`}
                    </Text>
                    {selectedTaskIndex === index && (
                      <Box marginTop={1} paddingLeft={2}>
                        <Text color={fuegoColors.text.secondary}>
                          {task.description}
                        </Text>
                        {task.dependencies && task.dependencies.length > 0 && (
                          <Text color={fuegoColors.text.dimmed} dimColor>
                            Dependencies: {task.dependencies.join(', ')}
                          </Text>
                        )}
                      </Box>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>

          <Box flexDirection="row" gap={2}>
            <Box>
              <Text color={colors.success} bold>✓ Accept</Text>
              <Text color={fuegoColors.text.dimmed}> (Enter)</Text>
            </Box>
            <Box>
              <Text color={colors.warning} bold>↻ Request Changes</Text>
              <Text color={fuegoColors.text.dimmed}> (R)</Text>
            </Box>
            <Box>
              <Text color={colors.error} bold>✗ Cancel</Text>
              <Text color={fuegoColors.text.dimmed}> (ESC)</Text>
            </Box>
          </Box>

          <Box marginTop={1}>
            <Text color={fuegoColors.text.dimmed} dimColor>
              Use ↑/↓ to navigate tasks and see details
            </Text>
          </Box>
        </>
      ) : (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={fuegoColors.text.primary}>
              What changes would you like to the task list?
            </Text>
          </Box>
          
          <PromptInput
            value={feedback}
            onChange={setFeedback}
            onSubmit={handleFeedbackSubmit}
            placeholder="Describe the changes you'd like..."
            getSuggestions={getSuggestions}
          />
        </Box>
      )}
    </Box>
  );
};