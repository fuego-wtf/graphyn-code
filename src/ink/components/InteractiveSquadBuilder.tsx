import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { AgentRecommendation, SquadRecommendation } from '../../api/squads.js';
import { colors } from '../theme/colors.js';

interface InteractiveSquadBuilderProps {
  threadId: string;
  initialSquad?: SquadRecommendation;
  onAccept: (squad: SquadRecommendation) => void;
  onRequestChanges: (feedback: string) => void;
  onBack: () => void;
}

type ViewMode = 'overview' | 'agent-detail' | 'feedback';

export const InteractiveSquadBuilder: React.FC<InteractiveSquadBuilderProps> = ({
  threadId,
  initialSquad,
  onAccept,
  onRequestChanges,
  onBack
}) => {
  const [squad, setSquad] = useState<SquadRecommendation | undefined>(initialSquad);
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedAgentIndex, setSelectedAgentIndex] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [agentFeedback, setAgentFeedback] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);

  useInput((input, key) => {
    if (loading) return;

    if (key.escape) {
      if (viewMode === 'agent-detail') {
        setViewMode('overview');
      } else if (viewMode === 'feedback') {
        setViewMode('overview');
      } else {
        onBack();
      }
    }

    if (viewMode === 'overview') {
      if (key.upArrow) {
        setSelectedAgentIndex(prev => 
          prev > 0 ? prev - 1 : (squad?.agents.length || 0) - 1
        );
      } else if (key.downArrow) {
        setSelectedAgentIndex(prev => 
          prev < (squad?.agents.length || 0) - 1 ? prev + 1 : 0
        );
      } else if (key.return) {
        setViewMode('agent-detail');
      } else if (input === 'a' || input === 'A') {
        handleAccept();
      } else if (input === 'f' || input === 'F') {
        setViewMode('feedback');
      }
    }
  });

  const handleAccept = () => {
    if (squad) {
      onAccept(squad);
    }
  };

  const handleSubmitFeedback = () => {
    if (feedback.trim()) {
      setLoading(true);
      
      // Combine general feedback with agent-specific feedback
      let fullFeedback = feedback;
      if (Object.keys(agentFeedback).length > 0) {
        fullFeedback += '\n\nAgent-specific feedback:\n';
        Object.entries(agentFeedback).forEach(([index, fb]) => {
          const agent = squad?.agents[parseInt(index)];
          if (agent && fb) {
            fullFeedback += `- ${agent.name}: ${fb}\n`;
          }
        });
      }
      
      onRequestChanges(fullFeedback);
    }
  };

  if (!squad) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box>
          <Spinner type="dots" />
          <Text> Waiting for squad recommendations...</Text>
        </Box>
        <Box marginTop={1}>
          <Text color={colors.dim}>Thread ID: {threadId}</Text>
        </Box>
      </Box>
    );
  }

  if (viewMode === 'agent-detail' && squad.agents[selectedAgentIndex]) {
    const agent = squad.agents[selectedAgentIndex];
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">Agent Details</Text>
        
        <Box marginTop={1} borderStyle="round" borderColor="cyan" padding={1}>
          <Box flexDirection="column">
            <Text bold>{agent.emoji || '🤖'} {agent.name}</Text>
            <Text color="gray">Formation: {agent.formation || 'Flexible'}</Text>
            
            <Box marginTop={1}>
              <Text bold>Role:</Text>
              <Text>{agent.role}</Text>
            </Box>
            
            <Box marginTop={1}>
              <Text bold>Style:</Text>
              <Text>{agent.style}</Text>
            </Box>
            
            <Box marginTop={1}>
              <Text bold>Description:</Text>
              <Text>{agent.description}</Text>
            </Box>
            
            {agent.skills && Object.keys(agent.skills).length > 0 && (
              <Box marginTop={1} flexDirection="column">
                <Text bold>Skills:</Text>
                {Object.entries(agent.skills).map(([skill, level]) => {
                  const bars = '█'.repeat(Number(level)) + '░'.repeat(10 - Number(level));
                  return (
                    <Box key={skill}>
                      <Text>{skill}: </Text>
                      <Text color="green">{bars}</Text>
                      <Text> {level}/10</Text>
                    </Box>
                  );
                })}
              </Box>
            )}
            
            <Box marginTop={2}>
              <Text bold>Provide feedback for this agent:</Text>
              <TextInput
                value={agentFeedback[selectedAgentIndex] || ''}
                onChange={(value) => setAgentFeedback(prev => ({
                  ...prev,
                  [selectedAgentIndex]: value
                }))}
                placeholder="e.g., needs more testing expertise..."
              />
            </Box>
          </Box>
        </Box>
        
        <Box marginTop={1}>
          <Text color={colors.dim}>Press ESC to go back</Text>
        </Box>
      </Box>
    );
  }

  if (viewMode === 'feedback') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="yellow">Squad Feedback</Text>
        
        <Box marginTop={1}>
          <Text>What changes would you like to make to the squad?</Text>
        </Box>
        
        <Box marginTop={1}>
          <TextInput
            value={feedback}
            onChange={setFeedback}
            placeholder="e.g., Add a DevOps specialist, remove the UI designer..."
            onSubmit={handleSubmitFeedback}
          />
        </Box>
        
        {Object.keys(agentFeedback).length > 0 && (
          <Box marginTop={1} flexDirection="column">
            <Text bold>Agent-specific feedback:</Text>
            {Object.entries(agentFeedback).map(([index, fb]) => {
              const agent = squad.agents[parseInt(index)];
              return agent && fb ? (
                <Text key={index} color="gray">• {agent.name}: {fb}</Text>
              ) : null;
            })}
          </Box>
        )}
        
        <Box marginTop={2}>
          <Text color={colors.dim}>Press Enter to submit, ESC to cancel</Text>
        </Box>
      </Box>
    );
  }

  // Overview mode
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="green">✅ Squad Recommendation Ready!</Text>
      
      <Box marginTop={1} borderStyle="round" borderColor="green" padding={1}>
        <Box flexDirection="column">
          <Text bold>Formation: <Text color="cyan">{squad.formation}</Text></Text>
          {squad.reasoning && (
            <Box marginTop={1}>
              <Text>Strategy: {squad.reasoning}</Text>
            </Box>
          )}
        </Box>
      </Box>
      
      <Box marginTop={1}>
        <Text bold>Recommended Agents ({squad.agents.length}):</Text>
      </Box>
      
      {squad.agents.map((agent, index) => (
        <Box
          key={index}
          marginTop={1}
          paddingLeft={1}
          borderStyle={index === selectedAgentIndex ? 'round' : undefined}
          borderColor={index === selectedAgentIndex ? 'cyan' : undefined}
        >
          <Text color={index === selectedAgentIndex ? 'cyan' : undefined}>
            {index === selectedAgentIndex ? '▶ ' : '  '}
            {agent.emoji || '🤖'} {agent.name}
          </Text>
          {agentFeedback[index] && (
            <Text color="yellow"> (has feedback)</Text>
          )}
        </Box>
      ))}
      
      <Box marginTop={2} flexDirection="column">
        <Text bold>Actions:</Text>
        <Text color="green">[A] Accept squad composition</Text>
        <Text color="yellow">[F] Request changes</Text>
        <Text color="cyan">[↑↓] Navigate agents</Text>
        <Text color="cyan">[Enter] View agent details</Text>
        <Text color={colors.dim}>[ESC] Go back</Text>
      </Box>
      
      {loading && (
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> Processing feedback...</Text>
        </Box>
      )}
    </Box>
  );
};