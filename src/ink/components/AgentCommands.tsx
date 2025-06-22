import React, { useEffect, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { GraphynAPIClient } from '../../api-client.js';
import { ConfigManager } from '../../config-manager.js';
import { colors } from '../../ui.js';

interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive';
  created_at: string;
  api_endpoint?: string;
}

interface AgentCommandsProps {
  command: 'list' | 'test' | 'deploy';
  agentId?: string;
}

export const AgentCommands: React.FC<AgentCommandsProps> = ({ command, agentId }) => {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    handleCommand();
  }, [command, agentId]);

  const handleCommand = async () => {
    try {
      const configManager = new ConfigManager();
      const token = await configManager.getAuthToken();
      
      if (!token) {
        throw new Error('Not authenticated. Run "graphyn init" first.');
      }

      const apiClient = new GraphynAPIClient();
      apiClient.setToken(token);

      switch (command) {
        case 'list':
          await listAgents(apiClient);
          break;
        case 'test':
          if (!agentId) throw new Error('Agent ID required for test command');
          await testAgent(apiClient, agentId);
          break;
        case 'deploy':
          if (!agentId) throw new Error('Agent ID required for deploy command');
          await deployAgent(apiClient, agentId);
          break;
      }
    } catch (error: any) {
      setError(error.message);
      setLoading(false);
    }
  };

  const listAgents = async (apiClient: GraphynAPIClient) => {
    const response = await apiClient.get<{ agents: Agent[] }>('/agents');
    setAgents(response.agents);
    setLoading(false);
  };

  const testAgent = async (apiClient: GraphynAPIClient, id: string) => {
    const response = await apiClient.post<{ success: boolean; output: string }>(
      `/agents/${id}/test`,
      { message: 'Hello from CLI!' }
    );
    setResult(response);
    setLoading(false);
  };

  const deployAgent = async (apiClient: GraphynAPIClient, id: string) => {
    const response = await apiClient.post<{ 
      api_key: string; 
      endpoint: string; 
      instructions: string 
    }>(`/agents/${id}/deploy`, {});
    setResult(response);
    setLoading(false);
  };

  if (loading) {
    return (
      <Box>
        <Spinner type="dots" />
        <Text> Loading agents...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">❌ {error}</Text>
      </Box>
    );
  }

  // Render based on command
  if (command === 'list') {
    if (agents.length === 0) {
      return (
        <Box flexDirection="column">
          <Text>No agents found. Create one with:</Text>
          <Text color="cyan">  graphyn thread</Text>
        </Box>
      );
    }

    return (
      <Box flexDirection="column">
        <Text bold color="cyan">🤖 Your Agents</Text>
        <Box marginTop={1} flexDirection="column">
          {agents.map(agent => (
            <Box key={agent.id} marginBottom={1}>
              <Text color="yellow">{agent.id.slice(0, 8)}</Text>
              <Text> - </Text>
              <Text bold>{agent.name}</Text>
              <Text dimColor> ({agent.type}) - {agent.status}</Text>
            </Box>
          ))}
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>Test an agent: graphyn agent test {"<id>"}</Text>
          <Text dimColor>Deploy agent: graphyn agent deploy {"<id>"}</Text>
        </Box>
      </Box>
    );
  }

  if (command === 'test' && result) {
    return (
      <Box flexDirection="column">
        <Text bold color={result.success ? 'green' : 'red'}>
          {result.success ? '✅ Test Successful' : '❌ Test Failed'}
        </Text>
        <Box marginTop={1}>
          <Text>{result.output}</Text>
        </Box>
      </Box>
    );
  }

  if (command === 'deploy' && result) {
    return (
      <Box flexDirection="column">
        <Text bold color="green">✅ Agent Deployed!</Text>
        <Box marginTop={1} flexDirection="column">
          <Text bold>API Endpoint:</Text>
          <Text color="cyan">{result.endpoint}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text bold>API Key:</Text>
          <Text color="yellow">{result.api_key}</Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text bold>Usage:</Text>
          <Text dimColor>{result.instructions}</Text>
        </Box>
      </Box>
    );
  }

  return null;
};