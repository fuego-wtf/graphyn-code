import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  systemPrompt: string;
  capabilities: string[];
}

interface SquadNamingProps {
  agents: Agent[];
  onSquadNamed: (name: string, description?: string) => void;
  onCancel: () => void;
}

type ViewMode = 'name' | 'description';

export const SquadNaming: React.FC<SquadNamingProps> = ({
  agents,
  onSquadNamed,
  onCancel
}) => {
  const [squadName, setSquadName] = useState('');
  const [description, setDescription] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('name');
  const [error, setError] = useState('');

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  const handleNameSubmit = (value: string) => {
    const trimmedName = value.trim();
    
    if (!trimmedName) {
      setError('Squad name cannot be empty');
      return;
    }
    
    if (trimmedName.length < 3) {
      setError('Squad name must be at least 3 characters');
      return;
    }
    
    if (trimmedName.length > 100) {
      setError('Squad name must be less than 100 characters');
      return;
    }
    
    setSquadName(trimmedName);
    setError('');
    setViewMode('description');
  };

  const handleDescriptionSubmit = (value: string) => {
    onSquadNamed(squadName, value.trim() || undefined);
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text color="green" bold>✅ Squad Configuration Approved!</Text>
      </Box>
      
      <Box marginBottom={2}>
        <Text color="cyan">Your squad includes {agents.length} specialized agents:</Text>
        <Box flexDirection="column" marginLeft={2}>
          {agents.map((agent, idx) => (
            <Box key={agent.id}>
              <Text dimColor>{idx + 1}. {agent.emoji} {agent.name}</Text>
              <Box marginLeft={3}>
                <Text dimColor italic>   {agent.role}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {viewMode === 'name' ? (
        <Box flexDirection="column">
          <Text color="yellow" bold>📝 Name your squad for future use:</Text>
          <Box marginTop={1} marginBottom={1}>
            <Text>Squad name: </Text>
            <TextInput
              value={squadName}
              onChange={setSquadName}
              onSubmit={handleNameSubmit}
              placeholder="e.g., Full-Stack Dev Team, API Builders, Auth Experts..."
            />
          </Box>
          {error && (
            <Box marginBottom={1}>
              <Text color="red">⚠️ {error}</Text>
            </Box>
          )}
          <Text dimColor>This squad configuration can be reused across different repositories</Text>
          <Box marginTop={1}>
            <Text dimColor>Press ENTER to continue • ESC to cancel</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color="green">✓ Squad name: <Text bold>{squadName}</Text></Text>
          </Box>
          
          <Text color="yellow" bold>📄 Add a description (optional):</Text>
          <Box marginTop={1} marginBottom={1}>
            <Text>Description: </Text>
            <TextInput
              value={description}
              onChange={setDescription}
              onSubmit={handleDescriptionSubmit}
              placeholder="What tasks is this squad best suited for?"
            />
          </Box>
          <Text dimColor>Help your future self remember when to use this squad</Text>
          <Box marginTop={1}>
            <Text dimColor>Press ENTER to save • Leave empty to skip • ESC to cancel</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
};