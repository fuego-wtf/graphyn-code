import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { colors, fuegoColors } from '../theme/colors.js';
import { PromptInput } from './PromptInput.js';
import { AgentDetail } from './AgentDetail.js';

interface Finding {
  agentId: string;
  agentName: string;
  recommendation: string;
  reasoning: string;
  capabilities: string[];
  confidence: number;
}

interface SquadFindingsProps {
  query: string;
  findings: Finding[];
  onAccept: (selectedFindings: Finding[]) => void;
  onRequestMore: (additionalDirectives: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
  threadId?: string;
}

export const SquadFindings: React.FC<SquadFindingsProps> = ({
  query,
  findings,
  onAccept,
  onRequestMore,
  onCancel,
  isLoading = false,
  threadId
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [showDirectives, setShowDirectives] = useState(false);
  const [directives, setDirectives] = useState('');

  useInput((input, key) => {
    if (!selectedAgentId && !showDirectives) {
      if (key.escape) {
        onCancel();
      } else if (key.return) {
        onAccept(findings);
      } else if (input === 'm' || input === 'M') {
        setShowDirectives(true);
      }
    }
  });

  const handleAgentSelect = useCallback((item: { value: string }) => {
    setSelectedAgentId(item.value);
  }, []);

  const handleAgentBack = useCallback(() => {
    setSelectedAgentId(null);
  }, []);

  const handleDirectivesSubmit = useCallback((value: string) => {
    onRequestMore(value);
    setShowDirectives(false);
    setDirectives('');
  }, [onRequestMore]);

  const handleAgentFeedback = useCallback((agentId: string, feedback: string) => {
    // In a real implementation, this would update the finding
    console.log(`Feedback for agent ${agentId}: ${feedback}`);
  }, []);

  const getSuggestions = async (prompt: string): Promise<string[]> => {
    return [
      `${prompt} with focus on security`,
      `${prompt} prioritizing performance`,
      `${prompt} emphasizing scalability`,
      `${prompt} with better error handling`,
      `${prompt} including monitoring capabilities`
    ];
  };

  if (isLoading) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Text color={colors.warning}>
          <Spinner type="dots" /> Team builder agent is analyzing your requirements...
        </Text>
        {threadId && (
          <Text color={fuegoColors.text.dimmed} dimColor>
            Thread ID: {threadId}
          </Text>
        )}
      </Box>
    );
  }

  // Show agent detail view
  if (selectedAgentId) {
    const finding = findings.find(f => f.agentId === selectedAgentId);
    if (!finding) return null;

    const agent = {
      id: finding.agentId,
      name: finding.agentName,
      description: finding.recommendation,
      currentPrompt: query,
      reasoning: finding.reasoning,
      capabilities: finding.capabilities,
      status: 'idle' as const
    };

    return (
      <AgentDetail
        agent={agent}
        onFeedback={handleAgentFeedback}
        onBack={handleAgentBack}
      />
    );
  }

  // Show directives input
  if (showDirectives) {
    return (
      <Box flexDirection="column" paddingY={1}>
        <Box marginBottom={1}>
          <Text color={fuegoColors.text.primary} bold>
            Additional Requirements
          </Text>
        </Box>
        
        <Box marginBottom={1}>
          <Text color={fuegoColors.text.secondary}>
            What additional criteria should the team builder consider?
          </Text>
        </Box>
        
        <PromptInput
          value={directives}
          onChange={setDirectives}
          onSubmit={handleDirectivesSubmit}
          placeholder="e.g., prioritize agents with X capability..."
          getSuggestions={getSuggestions}
        />
      </Box>
    );
  }

  const agentItems = findings.map(f => ({
    label: `${f.agentName} (${Math.round(f.confidence * 100)}% match)`,
    value: f.agentId
  }));

  return (
    <Box flexDirection="column" paddingY={1}>
      <Box marginBottom={1}>
        <Text color={fuegoColors.text.primary} bold>
          🔍 Squad Recommendations
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text color={fuegoColors.text.secondary}>
          Query: "{query}"
        </Text>
        {threadId && (
          <Text color={fuegoColors.text.dimmed} dimColor>
            Thread: {threadId}
          </Text>
        )}
      </Box>

      <Box 
        borderStyle="round" 
        borderColor={fuegoColors.border.subtle} 
        paddingX={2} 
        paddingY={1}
        marginBottom={1}
      >
        <Box flexDirection="column">
          <Text color={fuegoColors.text.primary}>
            Recommended Agents ({findings.length}):
          </Text>
          <Box marginBottom={1} />
          
          <SelectInput
            items={agentItems}
            onSelect={handleAgentSelect}
            indicatorComponent={({ isSelected }) => (
              <Text color={isSelected ? fuegoColors.text.primary : fuegoColors.text.secondary}>
                {isSelected ? '▶ ' : '  '}
              </Text>
            )}
          />
          
          <Box marginTop={1}>
            <Text color={fuegoColors.text.dimmed} dimColor>
              Press Enter on an agent to see details
            </Text>
          </Box>
        </Box>
      </Box>

      <Box flexDirection="row" gap={2}>
        <Box>
          <Text color={colors.success} bold>✓ Accept Squad</Text>
          <Text color={fuegoColors.text.dimmed}> (Enter)</Text>
        </Box>
        <Box>
          <Text color={colors.warning} bold>+ More Research</Text>
          <Text color={fuegoColors.text.dimmed}> (M)</Text>
        </Box>
        <Box>
          <Text color={colors.error} bold>✗ Cancel</Text>
          <Text color={fuegoColors.text.dimmed}> (ESC)</Text>
        </Box>
      </Box>
    </Box>
  );
};