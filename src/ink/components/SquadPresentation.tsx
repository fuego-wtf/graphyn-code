import React from 'react';
import { Box, Text } from 'ink';
import { AgentRecommendation, SquadRecommendation } from '../../api/teams.js';

interface SquadPresentationProps {
  squad: SquadRecommendation;
  message: string;
}

const SkillBar: React.FC<{ skill: string; level: number }> = ({ skill, level }) => {
  const filled = '█'.repeat(Math.floor(level));
  const empty = '░'.repeat(10 - Math.floor(level));
  
  return (
    <Text>
      {skill} {filled}{empty}
    </Text>
  );
};

const AgentCard: React.FC<{ agent: AgentRecommendation }> = ({ agent }) => {
  return (
    <Box flexDirection="column" marginY={1}>
      <Text bold color="yellow">
        {agent.emoji || '⚡'} {agent.name} ({agent.formation})
      </Text>
      <Box marginLeft={5} flexDirection="column">
        <Text>Skills: {Object.entries(agent.skills).map(([skill, level], i) => (
          <SkillBar key={i} skill={skill} level={level} />
        )).join(' | ')}</Text>
        <Text>Role: {agent.role}</Text>
        <Text>Style: {agent.style}</Text>
      </Box>
    </Box>
  );
};

export const SquadPresentation: React.FC<SquadPresentationProps> = ({ squad, message }) => {
  return (
    <Box flexDirection="column" paddingX={2}>
      <Box borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1} marginY={1}>
        <Text bold color="cyan">Your Dev Squad for {message}</Text>
      </Box>
      
      {squad.agents.map((agent, index) => (
        <AgentCard key={index} agent={agent} />
      ))}
      
      {squad.reasoning && (
        <Box marginTop={1} paddingX={2}>
          <Text italic color="gray">{squad.reasoning}</Text>
        </Box>
      )}
    </Box>
  );
};