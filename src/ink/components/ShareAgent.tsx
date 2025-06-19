import React, { useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { useStore } from '../store.js';
import { useAgents, useAPI } from '../hooks/useAPI.js';

type ShareMode = 'select' | 'sharing' | 'success' | 'error';

export const ShareAgent: React.FC = () => {
  const { reset } = useStore();
  const { agents, loading, error: loadError } = useAgents();
  const api = useAPI();
  
  const [mode, setMode] = useState<ShareMode>('select');
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [shareUrl, setShareUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleAgentSelect = async (item: { value: string }) => {
    if (item.value === 'back') {
      reset();
      return;
    }

    const agent = agents.find(a => a.id === item.value);
    if (!agent) return;

    setSelectedAgent(agent);
    setMode('sharing');
    setError(null);

    try {
      const response = await api.post<{shareUrl: string}>(`/api/v1/agents/${agent.id}/share`, {
        shareWith: 'organization'
      });
      setShareUrl(response.shareUrl);
      setMode('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share agent');
      setMode('error');
    }
  };

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Share Agent</Text>
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> Loading agents...</Text>
        </Box>
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Share Agent</Text>
        <Box marginTop={1}>
          <Text color="red">❌ Error: {loadError}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press ESC to go back</Text>
        </Box>
      </Box>
    );
  }

  switch (mode) {
    case 'select':
      const shareableAgents = agents.filter(a => !a.shared);
      
      if (shareableAgents.length === 0) {
        return (
          <Box flexDirection="column" padding={1}>
            <Text bold>Share Agent</Text>
            <Box marginTop={1}>
              <Text color="yellow">No agents available to share</Text>
              <Text color="gray">All your agents are already shared or you have no agents yet.</Text>
            </Box>
            <Box marginTop={2}>
              <Text dimColor>Press ESC to go back</Text>
            </Box>
          </Box>
        );
      }

      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>Share Agent</Text>
          <Box marginTop={1}>
            <Text>Select an agent to share with your organization:</Text>
          </Box>
          
          <Box marginTop={1}>
            <SelectInput
              items={[
                ...shareableAgents.map(agent => ({
                  label: `${agent.name} - ${agent.description}`,
                  value: agent.id
                })),
                { label: '← Back to Menu', value: 'back' }
              ]}
              onSelect={handleAgentSelect}
            />
          </Box>
          
          <Box marginTop={2}>
            <Text dimColor>Shared agents can be used by your entire organization</Text>
          </Box>
        </Box>
      );

    case 'sharing':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>Sharing Agent</Text>
          <Box marginTop={1}>
            <Spinner type="dots" />
            <Text> Sharing {selectedAgent?.name}...</Text>
          </Box>
        </Box>
      );

    case 'success':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold color="green">✅ Agent Shared Successfully!</Text>
          
          <Box marginTop={1} flexDirection="column">
            <Text>Agent: {selectedAgent?.name}</Text>
            <Text color="gray">Share URL: {shareUrl}</Text>
          </Box>
          
          <Box marginTop={2} borderStyle="single" borderColor="green" padding={1}>
            <Box flexDirection="column">
              <Text>Your agent is now available to your organization!</Text>
              <Text color="gray">Team members can access it through the platform.</Text>
            </Box>
          </Box>
          
          <Box marginTop={2}>
            <Text dimColor>Press any key to continue</Text>
          </Box>
        </Box>
      );

    case 'error':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold color="red">❌ Failed to Share Agent</Text>
          
          <Box marginTop={1}>
            <Text color="red">{error}</Text>
          </Box>
          
          <Box marginTop={2}>
            <Text dimColor>Press ESC to go back</Text>
          </Box>
        </Box>
      );

    default:
      return null;
  }
};