import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';

export interface AgentSkill {
  name: string;
  level: number; // 0-10
}

export interface AgentRecommendation {
  name: string;
  role: string;
  skills: Record<string, number>;
  description: string;
  style: string;
  formation: string;
  emoji?: string;
}

export interface SquadRecommendationProps {
  agents: AgentRecommendation[];
  reasoning?: string;
  formation?: string;
}

const SkillBar: React.FC<{ skill: string; level: number }> = ({ skill, level }) => {
  const maxBars = 10;
  const filledBars = Math.round(level);
  const emptyBars = maxBars - filledBars;
  
  const bars = '█'.repeat(filledBars) + '░'.repeat(emptyBars);
  
  return (
    <Box>
      <Text>     {skill}: </Text>
      <Text color={level >= 8 ? 'green' : level >= 5 ? 'yellow' : 'red'}>{bars}</Text>
      <Text> {level}/10</Text>
    </Box>
  );
};

const AgentCard: React.FC<{ agent: AgentRecommendation; index: number }> = ({ agent, index }) => {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="cyan" bold>
        {`${index + 1}. ${agent.emoji || '🤖'} ${agent.name} (${agent.formation})`}
      </Text>
      <Box marginLeft={3} flexDirection="column">
        <Text>Role: {agent.role}</Text>
        <Text>Style: {agent.style}</Text>
        <Text>Description: {agent.description}</Text>
        {Object.keys(agent.skills).length > 0 && (
          <>
            <Text>Skills:</Text>
            {Object.entries(agent.skills).map(([skill, level]) => (
              <SkillBar key={skill} skill={skill} level={level} />
            ))}
          </>
        )}
      </Box>
    </Box>
  );
};

export const SquadPresentation: React.FC<SquadRecommendationProps> = ({ agents, reasoning, formation }) => {
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box borderStyle="single" paddingX={2} paddingY={1} flexDirection="column">
        <Text color="yellow" bold>
          {`Your Dev Squad for ${formation || 'Custom'} Formation`}
        </Text>
        {reasoning && (
          <Box marginTop={1}>
            <Text color="gray">{reasoning}</Text>
          </Box>
        )}
        <Box marginTop={1} flexDirection="column">
          {agents.map((agent, index) => (
            <AgentCard key={index} agent={agent} index={index} />
          ))}
        </Box>
      </Box>
    </Box>
  );
};

// Football Manager style presentation
export const FootballSquadPresentation: React.FC<SquadRecommendationProps> = ({ agents }) => {
  const header = `┌─────────────────────── Your Dev Squad ───────────────────────┐`;
  const footer = `└──────────────────────────────────────────────────────────────┘`;
  
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text>{header}</Text>
      <Box flexDirection="column" paddingX={1}>
        {agents.map((agent, index) => (
          <Box key={index} flexDirection="column" marginY={1}>
            <Text color="cyan" bold>
              {`  ${agent.emoji || '⚡'} ${agent.name} (${agent.formation})`}
            </Text>
            <Box flexDirection="column" marginLeft={5}>
              <Box>
                <Text>Skills: </Text>
                {Object.entries(agent.skills).slice(0, 3).map(([skill, level], idx) => (
                  <React.Fragment key={skill}>
                    {idx > 0 && <Text> | </Text>}
                    <Text>{skill} </Text>
                    <Text color={level >= 8 ? 'green' : level >= 5 ? 'yellow' : 'red'}>
                      {'█'.repeat(Math.round(level)) + '░'.repeat(10 - Math.round(level))}
                    </Text>
                  </React.Fragment>
                ))}
              </Box>
              <Text>Role: {agent.role}</Text>
              <Text>Style: {agent.style}</Text>
            </Box>
          </Box>
        ))}
      </Box>
      <Text>{footer}</Text>
    </Box>
  );
};