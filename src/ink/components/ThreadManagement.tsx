import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { useStore } from '../store.js';
import { GraphynAPIClient } from '../../api-client.js';
import { ConfigManager } from '../../config-manager.js';

type ViewMode = 'list' | 'create' | 'view' | 'participants';
type SubMode = 'view' | 'add' | 'remove';

interface Thread {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'completed';
  createdAt: string;
  participantCount: number;
}

interface Participant {
  id: string;
  type: 'user' | 'agent';
  name: string;
  role?: string;
  joinedAt: string;
}

export const ThreadManagement: React.FC = () => {
  const { exit } = useApp();
  const { setError, setLoading } = useStore();
  const [mode, setMode] = useState<ViewMode>('list');
  const [subMode, setSubMode] = useState<SubMode>('view');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [newThreadName, setNewThreadName] = useState('');
  const [newThreadDescription, setNewThreadDescription] = useState('');
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [apiClient, setApiClient] = useState<GraphynAPIClient | null>(null);

  // Initialize API client
  useEffect(() => {
    const initClient = async () => {
      const configManager = new ConfigManager();
      const token = await configManager.getAuthToken();
      if (token) {
        const client = new GraphynAPIClient();
        client.setToken(token);
        setApiClient(client);
      }
    };
    initClient();
  }, []);

  // Load threads on mount
  useEffect(() => {
    if (apiClient) {
      loadThreads();
    }
  }, [apiClient]);

  // Navigation
  useInput((input, key) => {
    if (key.escape) {
      if (mode === 'list') {
        // Exit thread management
        const { reset } = useStore.getState();
        reset();
      } else if (mode === 'participants' && subMode !== 'view') {
        // Return to participant view
        setSubMode('view');
      } else {
        // Return to list
        setMode('list');
        setSelectedThread(null);
        setParticipants([]);
      }
    }
  });

  const loadThreads = async () => {
    if (!apiClient) return;
    
    setIsLoadingThreads(true);
    try {
      const response = await apiClient.get<Thread[]>('/api/v1/threads');
      setThreads(response);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load threads');
    } finally {
      setIsLoadingThreads(false);
    }
  };

  const loadParticipants = async (threadId: string) => {
    if (!apiClient) return;
    
    setIsLoadingParticipants(true);
    try {
      const response = await apiClient.get<Participant[]>(`/api/v1/threads/${threadId}/participants`);
      setParticipants(response);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load participants');
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  const createThread = async () => {
    if (!apiClient || !newThreadName.trim()) return;
    
    setLoading(true);
    try {
      const response = await apiClient.post<Thread>('/api/v1/threads', {
        name: newThreadName,
        description: newThreadDescription || undefined
      });
      
      // Reload threads and show the new one
      await loadThreads();
      setSelectedThread(response);
      setMode('view');
      setNewThreadName('');
      setNewThreadDescription('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create thread');
    } finally {
      setLoading(false);
    }
  };

  const handleThreadSelect = async (item: { value: string }) => {
    const thread = threads.find(t => t.id === item.value);
    if (thread) {
      setSelectedThread(thread);
      setMode('view');
      await loadParticipants(thread.id);
    }
  };

  const handleParticipantAction = (item: { value: string }) => {
    switch (item.value) {
      case 'add':
        setSubMode('add');
        break;
      case 'remove':
        setSubMode('remove');
        break;
      case 'back':
        setMode('view');
        break;
    }
  };

  const handleAddParticipant = async (item: { value: string }) => {
    if (!apiClient || !selectedThread) return;
    
    setLoading(true);
    try {
      await apiClient.post(`/api/v1/threads/${selectedThread.id}/participants`, {
        type: 'agent',
        agentId: item.value
      });
      
      // Reload participants
      await loadParticipants(selectedThread.id);
      setSubMode('view');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to add participant');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveParticipant = async (item: { value: string }) => {
    if (!apiClient || !selectedThread) return;
    
    setLoading(true);
    try {
      await apiClient.delete(`/api/v1/threads/${selectedThread.id}/participants/${item.value}`);
      
      // Reload participants
      await loadParticipants(selectedThread.id);
      setSubMode('view');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to remove participant');
    } finally {
      setLoading(false);
    }
  };

  // Render based on mode
  if (isLoadingThreads) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Thread Management</Text>
        <Box marginTop={1}>
          <Spinner type="dots" />
          <Text> Loading threads...</Text>
        </Box>
      </Box>
    );
  }

  switch (mode) {
    case 'list':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>Thread Management</Text>
          <Box marginTop={1}>
            <Text color="gray">{threads.length} thread{threads.length !== 1 ? 's' : ''} found</Text>
          </Box>
          
          <Box marginTop={1}>
            <SelectInput
              items={[
                { label: '➕ Create New Thread', value: 'create' },
                ...threads.map(t => ({
                  label: `📋 ${t.name} (${t.participantCount} participants)`,
                  value: t.id
                })),
                { label: '← Back to Menu', value: 'back' }
              ]}
              onSelect={(item) => {
                if (item.value === 'create') {
                  setMode('create');
                } else if (item.value === 'back') {
                  const { reset } = useStore.getState();
                  reset();
                } else {
                  handleThreadSelect(item);
                }
              }}
            />
          </Box>
          
          <Box marginTop={2}>
            <Text dimColor>Use ↑↓ to navigate, ↵ to select, ESC to go back</Text>
          </Box>
        </Box>
      );

    case 'create':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>Create New Thread</Text>
          
          <Box marginTop={1}>
            <Text>Thread Name:</Text>
          </Box>
          <Box marginLeft={2}>
            <TextInput
              value={newThreadName}
              onChange={setNewThreadName}
              placeholder="My awesome project"
            />
          </Box>
          
          {newThreadName && (
            <>
              <Box marginTop={1}>
                <Text>Description (optional):</Text>
              </Box>
              <Box marginLeft={2}>
                <TextInput
                  value={newThreadDescription}
                  onChange={setNewThreadDescription}
                  placeholder="Brief description..."
                  onSubmit={createThread}
                />
              </Box>
              
              <Box marginTop={1}>
                <Text dimColor>Press Enter to create, ESC to cancel</Text>
              </Box>
            </>
          )}
        </Box>
      );

    case 'view':
      if (!selectedThread) return null;
      
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold>{selectedThread.name}</Text>
          {selectedThread.description && (
            <Text color="gray">{selectedThread.description}</Text>
          )}
          
          <Box marginTop={1}>
            <Text>Status: <Text color={selectedThread.status === 'active' ? 'green' : 'yellow'}>{selectedThread.status}</Text></Text>
          </Box>
          
          <Box marginTop={1}>
            <Text>Created: {new Date(selectedThread.createdAt).toLocaleString()}</Text>
          </Box>
          
          <Box marginTop={2}>
            <SelectInput
              items={[
                { label: '👥 Manage Participants', value: 'participants' },
                { label: '🗨️  View Messages (coming soon)', value: 'messages' },
                { label: '⚙️  Thread Settings (coming soon)', value: 'settings' },
                { label: '← Back to List', value: 'back' }
              ]}
              onSelect={(item) => {
                if (item.value === 'participants') {
                  setMode('participants');
                } else if (item.value === 'back') {
                  setMode('list');
                  setSelectedThread(null);
                }
              }}
            />
          </Box>
        </Box>
      );

    case 'participants':
      if (!selectedThread) return null;
      
      if (isLoadingParticipants) {
        return (
          <Box flexDirection="column" padding={1}>
            <Text bold>Participants - {selectedThread.name}</Text>
            <Box marginTop={1}>
              <Spinner type="dots" />
              <Text> Loading participants...</Text>
            </Box>
          </Box>
        );
      }

      switch (subMode) {
        case 'view':
          return (
            <Box flexDirection="column" padding={1}>
              <Text bold>Participants - {selectedThread.name}</Text>
              <Box marginTop={1}>
                <Text color="gray">{participants.length} participant{participants.length !== 1 ? 's' : ''}</Text>
              </Box>
              
              {participants.length > 0 && (
                <Box marginTop={1} flexDirection="column">
                  {participants.map(p => (
                    <Box key={p.id}>
                      <Text>
                        {p.type === 'agent' ? '🤖' : '👤'} {p.name}
                        {p.role && <Text color="gray"> ({p.role})</Text>}
                      </Text>
                    </Box>
                  ))}
                </Box>
              )}
              
              <Box marginTop={2}>
                <SelectInput
                  items={[
                    { label: '➕ Add Participant', value: 'add' },
                    { label: '➖ Remove Participant', value: 'remove' },
                    { label: '← Back to Thread', value: 'back' }
                  ]}
                  onSelect={handleParticipantAction}
                />
              </Box>
            </Box>
          );

        case 'add':
          return (
            <Box flexDirection="column" padding={1}>
              <Text bold>Add Participant</Text>
              <Text color="gray">Select an agent to add to the thread</Text>
              
              <Box marginTop={1}>
                <SelectInput
                  items={[
                    { label: '🤖 Backend Agent', value: 'backend' },
                    { label: '🤖 Frontend Agent', value: 'frontend' },
                    { label: '🤖 Architect Agent', value: 'architect' },
                    { label: '🤖 Design Agent', value: 'design' },
                    { label: '🤖 CLI Agent', value: 'cli' },
                    { label: '← Cancel', value: 'cancel' }
                  ]}
                  onSelect={(item) => {
                    if (item.value === 'cancel') {
                      setSubMode('view');
                    } else {
                      handleAddParticipant(item);
                    }
                  }}
                />
              </Box>
            </Box>
          );

        case 'remove':
          const agentParticipants = participants.filter(p => p.type === 'agent');
          
          if (agentParticipants.length === 0) {
            return (
              <Box flexDirection="column" padding={1}>
                <Text bold>Remove Participant</Text>
                <Text color="yellow">No agents to remove</Text>
                <Box marginTop={1}>
                  <Text dimColor>Press ESC to go back</Text>
                </Box>
              </Box>
            );
          }
          
          return (
            <Box flexDirection="column" padding={1}>
              <Text bold>Remove Participant</Text>
              <Text color="gray">Select an agent to remove</Text>
              
              <Box marginTop={1}>
                <SelectInput
                  items={[
                    ...agentParticipants.map(p => ({
                      label: `🤖 ${p.name}`,
                      value: p.id
                    })),
                    { label: '← Cancel', value: 'cancel' }
                  ]}
                  onSelect={(item) => {
                    if (item.value === 'cancel') {
                      setSubMode('view');
                    } else {
                      handleRemoveParticipant(item);
                    }
                  }}
                />
              </Box>
            </Box>
          );
      }
      break;

    default:
      return null;
  }
};