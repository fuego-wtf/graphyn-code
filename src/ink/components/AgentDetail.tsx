import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { colors, fuegoColors } from '../theme/colors.js';
import { PromptInput } from './PromptInput.js';

interface Agent {
  id: string;
  name: string;
  description: string;
  currentPrompt: string;
  reasoning?: string;
  capabilities: string[];
  status: 'idle' | 'thinking' | 'executing';
}

interface AgentDetailProps {
  agent: Agent;
  onFeedback: (agentId: string, feedback: string) => void;
  onBack: () => void;
}

export const AgentDetail: React.FC<AgentDetailProps> = ({
  agent,
  onFeedback,
  onBack
}) => {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');

  useInput((input, key) => {
    if (key.escape) {
      if (showFeedback) {
        setShowFeedback(false);
        setFeedback('');
      } else {
        onBack();
      }
    } else if (input === 'f' || input === 'F') {
      setShowFeedback(true);
    }
  });

  const handleFeedbackSubmit = useCallback((value: string) => {
    onFeedback(agent.id, value);
    setShowFeedback(false);
    setFeedback('');
  }, [agent.id, onFeedback]);

  const getSuggestions = async (prompt: string): Promise<string[]> => {
    // Context-aware suggestions based on agent type
    return [
      `${prompt} but focus more on performance`,
      `${prompt} and include error handling`,
      `${prompt} with better user experience`,
      `${prompt} following best practices`,
      `${prompt} with more detailed analysis`
    ];
  };

  const getStatusIcon = (status: Agent['status']) => {
    switch (status) {
      case 'idle': return '⏸️';
      case 'thinking': return '🤔';
      case 'executing': return '⚡';
      default: return '❓';
    }
  };

  return (
    <Box flexDirection="column" paddingY={1}>
      <Box marginBottom={1} flexDirection="row" justifyContent="space-between">
        <Text color={fuegoColors.text.primary} bold>
          🤖 {agent.name} {getStatusIcon(agent.status)}
        </Text>
        <Text color={fuegoColors.text.dimmed}>
          ID: {agent.id.slice(0, 8)}
        </Text>
      </Box>

      <Box 
        borderStyle="round" 
        borderColor={fuegoColors.border.subtle} 
        paddingX={2} 
        paddingY={1}
        marginBottom={1}
        flexDirection="column"
      >
        <Box marginBottom={1}>
          <Text color={fuegoColors.text.secondary}>
            {agent.description}
          </Text>
        </Box>

        <Box marginBottom={1}>
          <Text color={fuegoColors.text.primary} bold>
            Capabilities:
          </Text>
          {agent.capabilities.map((cap, index) => (
            <Text key={index} color={fuegoColors.text.secondary}>
              • {cap}
            </Text>
          ))}
        </Box>

        <Box marginBottom={1}>
          <Text color={fuegoColors.text.primary} bold>
            Current Prompt:
          </Text>
          <Box 
            borderStyle="single" 
            borderColor={fuegoColors.border.subtle}
            padding={1}
            marginTop={1}
          >
            <Text color={fuegoColors.text.secondary}>
              {agent.currentPrompt}
            </Text>
          </Box>
        </Box>

        {agent.reasoning && (
          <Box>
            <Text color={fuegoColors.text.primary} bold>
              Agent's Reasoning:
            </Text>
            <Box 
              borderStyle="single" 
              borderColor={fuegoColors.border.subtle}
              padding={1}
              marginTop={1}
            >
              <Text color={fuegoColors.text.dimmed} italic>
                {agent.reasoning}
              </Text>
            </Box>
          </Box>
        )}
      </Box>

      {showFeedback ? (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={fuegoColors.text.primary}>
              Provide feedback for {agent.name}:
            </Text>
          </Box>
          
          <PromptInput
            value={feedback}
            onChange={setFeedback}
            onSubmit={handleFeedbackSubmit}
            placeholder="Your feedback for this agent..."
            getSuggestions={getSuggestions}
          />
        </Box>
      ) : (
        <Box flexDirection="row" gap={2}>
          <Box>
            <Text color={colors.warning} bold>F</Text>
            <Text color={fuegoColors.text.dimmed}> - Provide Feedback</Text>
          </Box>
          <Box>
            <Text color={colors.error} bold>ESC</Text>
            <Text color={fuegoColors.text.dimmed}> - Back to Squad</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};