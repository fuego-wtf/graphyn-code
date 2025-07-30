import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import type { Task } from '../../services/claude-task-generator.js';

interface SquadFeedbackProps {
  tasks: Task[];
  onSubmit: (feedback: SquadFeedbackData) => void;
  onCancel: () => void;
}

export interface SquadFeedbackData {
  overallRating: number;
  taskRatings: Map<string, number>;
  comments: string;
}

const SquadFeedback: React.FC<SquadFeedbackProps> = ({ tasks, onSubmit, onCancel }) => {
  const { exit } = useApp();
  const [currentStep, setCurrentStep] = useState<'overall' | 'tasks' | 'comments'>('overall');
  const [overallRating, setOverallRating] = useState(5);
  const [taskRatings, setTaskRatings] = useState<Map<string, number>>(new Map());
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [comments, setComments] = useState('');
  const [isTypingComments, setIsTypingComments] = useState(false);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (currentStep === 'overall') {
      if (input >= '1' && input <= '5') {
        setOverallRating(parseInt(input));
      } else if (key.return) {
        setCurrentStep('tasks');
      }
    } else if (currentStep === 'tasks') {
      if (input >= '1' && input <= '5') {
        const currentTask = tasks[currentTaskIndex];
        const newRatings = new Map(taskRatings);
        newRatings.set(currentTask.id, parseInt(input));
        setTaskRatings(newRatings);
        
        if (currentTaskIndex < tasks.length - 1) {
          setCurrentTaskIndex(currentTaskIndex + 1);
        } else {
          setCurrentStep('comments');
          setIsTypingComments(true);
        }
      } else if (key.leftArrow && currentTaskIndex > 0) {
        setCurrentTaskIndex(currentTaskIndex - 1);
      } else if (key.rightArrow && currentTaskIndex < tasks.length - 1) {
        setCurrentTaskIndex(currentTaskIndex + 1);
      } else if (key.return) {
        setCurrentStep('comments');
        setIsTypingComments(true);
      }
    } else if (currentStep === 'comments' && !isTypingComments) {
      if (key.return) {
        onSubmit({
          overallRating,
          taskRatings,
          comments
        });
      }
    }
  });

  const handleCommentSubmit = (value: string) => {
    setComments(value);
    setIsTypingComments(false);
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">📝 Squad Session Feedback</Text>
      </Box>

      {currentStep === 'overall' && (
        <Box flexDirection="column">
          <Text>How would you rate the overall squad performance?</Text>
          <Box marginTop={1}>
            {[1, 2, 3, 4, 5].map(rating => (
              <Text key={rating} color={overallRating === rating ? 'green' : 'gray'}>
                {rating === overallRating ? '▶ ' : '  '}{rating} - {'⭐'.repeat(rating)}
              </Text>
            ))}
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press 1-5 to select, Enter to continue</Text>
          </Box>
        </Box>
      )}

      {currentStep === 'tasks' && (
        <Box flexDirection="column">
          <Text>Rate individual task completion:</Text>
          <Box marginTop={1} marginBottom={1}>
            <Text bold>Task {currentTaskIndex + 1}/{tasks.length}: {tasks[currentTaskIndex].title}</Text>
          </Box>
          <Box>
            {[1, 2, 3, 4, 5].map(rating => {
              const currentRating = taskRatings.get(tasks[currentTaskIndex].id);
              return (
                <Text key={rating} color={currentRating === rating ? 'green' : 'gray'}>
                  {currentRating === rating ? '▶ ' : '  '}{rating} - {'⭐'.repeat(rating)}
                </Text>
              );
            })}
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press 1-5 to rate, ← → to navigate, Enter to skip to comments</Text>
          </Box>
        </Box>
      )}

      {currentStep === 'comments' && (
        <Box flexDirection="column">
          <Text>Any additional comments? (optional)</Text>
          <Box marginTop={1}>
            {isTypingComments ? (
              <TextInput
                value={comments}
                onChange={setComments}
                onSubmit={handleCommentSubmit}
                placeholder="Type your feedback here..."
              />
            ) : (
              <Box flexDirection="column">
                <Text color="green">Comments: {comments || '(none)'}</Text>
                <Box marginTop={1}>
                  <Text dimColor>Press Enter to submit feedback</Text>
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      )}

      <Box marginTop={2}>
        <Text dimColor>Press Esc to cancel</Text>
      </Box>
    </Box>
  );
};

export default SquadFeedback;