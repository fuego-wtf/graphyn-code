import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { AgentRevivalService } from '../../services/agent-revival.js';
import { ParsedAgent } from '../../services/agent-parser.js';
import chalk from 'chalk';

interface AgentRevivalProps {
  onComplete: () => void;
}

export const AgentRevival: React.FC<AgentRevivalProps> = ({ onComplete }) => {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<ParsedAgent[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviving, setReviving] = useState(false);
  const [results, setResults] = useState<any>(null);
  
  const revivalService = new AgentRevivalService();
  
  useEffect(() => {
    const discoverAgents = async () => {
      try {
        const discovered = await revivalService.discoverAgents();
        setAgents(discovered);
        setLoading(false);
      } catch (error) {
        console.error('Failed to discover agents:', error);
        setLoading(false);
      }
    };
    
    discoverAgents();
  }, []);
  
  useInput((input, key) => {
    if (key.escape) {
      onComplete();
    }
    
    if (!reviving && agents.length > 0) {
      if (key.upArrow) {
        setCurrentIndex(prev => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        setCurrentIndex(prev => Math.min(agents.length - 1, prev + 1));
      } else if (input === ' ') {
        // Toggle selection
        const agent = agents[currentIndex];
        const newSelected = new Set(selectedAgents);
        if (newSelected.has(agent.name)) {
          newSelected.delete(agent.name);
        } else {
          newSelected.add(agent.name);
        }
        setSelectedAgents(newSelected);
      } else if (input === 'a') {
        // Select all
        setSelectedAgents(new Set(agents.map(a => a.name)));
      } else if (input === 'n') {
        // Select none
        setSelectedAgents(new Set());
      } else if (key.return && selectedAgents.size > 0) {
        // Start revival
        handleRevive();
      }
    }
  });
  
  const handleRevive = async () => {
    setReviving(true);
    
    const selected = agents.filter(a => selectedAgents.has(a.name));
    const result = await revivalService.reviveAgents({ 
      interactive: false,
      select: selected.map(a => a.name)
    });
    
    setResults(result);
    
    // Show results for 3 seconds then return
    setTimeout(() => {
      onComplete();
    }, 3000);
  };
  
  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text color="cyan">
            <Spinner type="dots" /> Discovering static agents...
          </Text>
        </Box>
      </Box>
    );
  }
  
  if (agents.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow">No static agents found in .claude/agents</Text>
        <Text color="gray">Create agent definitions in .claude/agents/*.md to get started!</Text>
        <Box marginTop={1}>
          <Text color="gray">Press ESC to return to menu</Text>
        </Box>
      </Box>
    );
  }
  
  if (results) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="green" bold>✨ Agent Revival Complete!</Text>
        <Box marginTop={1}>
          <Text>Successfully revived {results.succeeded} of {results.total} agents</Text>
        </Box>
        {results.agents.map((agent: any) => (
          <Box key={agent.name} marginLeft={2}>
            <Text color={agent.status === 'success' ? 'green' : 'red'}>
              {agent.status === 'success' ? '✓' : '✗'} {agent.name}
            </Text>
          </Box>
        ))}
      </Box>
    );
  }
  
  if (reviving) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text color="cyan">
            <Spinner type="dots" /> Bringing agents to life...
          </Text>
        </Box>
      </Box>
    );
  }
  
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text color="yellow" bold>🔥 AGENT REVIVAL SYSTEM</Text>
      </Box>
      
      <Box marginBottom={1}>
        <Text>Found {agents.length} static agents that can be brought to life!</Text>
      </Box>
      
      <Box flexDirection="column" marginBottom={1}>
        {agents.map((agent, index) => {
          const isSelected = selectedAgents.has(agent.name);
          const isCurrent = index === currentIndex;
          
          return (
            <Box key={agent.name}>
              <Text color={isCurrent ? 'cyan' : 'white'}>
                {isCurrent ? '>' : ' '} [{isSelected ? 'x' : ' '}] {agent.name} - {agent.description.substring(0, 50)}...
              </Text>
            </Box>
          );
        })}
      </Box>
      
      <Box flexDirection="column" marginTop={1}>
        <Text color="gray">SPACE: Toggle | A: All | N: None | ENTER: Revive | ESC: Cancel</Text>
      </Box>
    </Box>
  );
};