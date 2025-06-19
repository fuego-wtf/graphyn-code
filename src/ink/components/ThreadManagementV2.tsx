import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { useStore } from '../store.js';
import { useThreads, useParticipants } from '../hooks/useAPI.js';
import { ThreadStream } from './ThreadStream.js';
import { useErrorHandler } from '../hooks/useErrorHandler.js';
import { ErrorFallback } from './ErrorFallback.js';

type ViewMode = 'list' | 'create' | 'view' | 'participants' | 'stream';
type SubMode = 'view' | 'add' | 'remove';

// Use Thread from API client and extend if needed
import { Thread as APIThread } from '../../api-client.js';

interface ThreadExtended extends APIThread {
  description?: string;
  status?: 'active' | 'paused' | 'completed';
  participantCount?: number;
}

type Thread = ThreadExtended;

export const ThreadManagementV2: React.FC = () => {
  const { exit } = useApp();
  const { reset } = useStore();
  const [mode, setMode] = useState<ViewMode>('list');
  const [subMode, setSubMode] = useState<SubMode>('view');
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [newThreadName, setNewThreadName] = useState('');
  const { error: errorState, handleError, clearError } = useErrorHandler();
  const [newThreadDescription, setNewThreadDescription] = useState('');

  // Use API hooks
  const { threads, loading: loadingThreads, error: threadsError, refetch, createThread, deleteThread, creating, deleting } = useThreads();
  const { participants, loading: loadingParticipants, addParticipant, removeParticipant, adding, removing } = useParticipants(selectedThread?.id || null);

  // Navigation
  useInput((input, key) => {
    if (key.escape) {
      if (mode === 'list') {
        reset();
      } else if (mode === 'participants' && subMode !== 'view') {
        setSubMode('view');
      } else {
        setMode('list');
        setSelectedThread(null);
      }
    }
  });

  const handleCreateThread = async () => {
    if (!newThreadName.trim()) return;
    
    try {
      const newThread = await createThread({ name: newThreadName });
      await refetch();
      setSelectedThread(newThread);
      setMode('view');
      setNewThreadName('');
      setNewThreadDescription('');
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const handleThreadSelect = async (item: { value: string }) => {
    const thread = threads.find(t => t.id === item.value);
    if (thread) {
      setSelectedThread(thread);
      setMode('view');
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
    if (!selectedThread) return;
    
    try {
      await addParticipant({
        threadId: selectedThread.id,
        type: 'agent',
        agentId: item.value
      });
      setSubMode('view');
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleRemoveParticipant = async (item: { value: string }) => {
    if (!selectedThread) return;
    
    try {
      await removeParticipant({
        threadId: selectedThread.id,
        participantId: item.value
      });
      setSubMode('view');
    } catch (error) {
      // Error handled by hook
    }
  };

  // Loading state
  if (loadingThreads && mode === 'list') {
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

  // Error state
  if (threadsError) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Thread Management</Text>
        <Box marginTop={1}>
          <Text color="red">❌ Error: {threadsError}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press ESC to go back</Text>
        </Box>
      </Box>
    );
  }

  // Render based on mode
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
                ...threads.map((t: any) => ({
                  label: `📋 ${t.name}${t.participantCount ? ` (${t.participantCount} participants)` : ''}`,
                  value: t.id
                })),
                { label: '← Back to Menu', value: 'back' }
              ]}
              onSelect={(item) => {
                if (item.value === 'create') {
                  setMode('create');
                } else if (item.value === 'back') {
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
              onSubmit={handleCreateThread}
            />
          </Box>
          
          {creating && (
            <Box marginTop={1}>
              <Spinner type="dots" />
              <Text> Creating thread...</Text>
            </Box>
          )}
          
          <Box marginTop={1}>
            <Text dimColor>Press Enter to create, ESC to cancel</Text>
          </Box>
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
            <Text>Status: <Text color={selectedThread.status === 'active' ? 'green' : 'yellow'}>{selectedThread.status || 'active'}</Text></Text>
          </Box>
          
          <Box marginTop={1}>
            <Text>Created: {new Date(selectedThread.created_at).toLocaleString()}</Text>
          </Box>
          
          <Box marginTop={2}>
            <SelectInput
              items={[
                { label: '💬 Open Conversation', value: 'stream' },
                { label: '👥 Manage Participants', value: 'participants' },
                { label: '⚙️  Thread Settings (coming soon)', value: 'settings' },
                { label: '🗑️  Delete Thread', value: 'delete' },
                { label: '← Back to List', value: 'back' }
              ]}
              onSelect={async (item) => {
                if (item.value === 'stream') {
                  setMode('stream');
                } else if (item.value === 'participants') {
                  setMode('participants');
                } else if (item.value === 'back') {
                  setMode('list');
                  setSelectedThread(null);
                } else if (item.value === 'delete') {
                  await deleteThread(selectedThread.id);
                  await refetch();
                  setMode('list');
                  setSelectedThread(null);
                }
              }}
            />
          </Box>
          
          {deleting && (
            <Box marginTop={1}>
              <Spinner type="dots" />
              <Text> Deleting thread...</Text>
            </Box>
          )}
        </Box>
      );

    case 'participants':
      if (!selectedThread) return null;
      
      if (loadingParticipants) {
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
                  {participants.map((p: any) => (
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
              
              {(adding || removing) && (
                <Box marginTop={1}>
                  <Spinner type="dots" />
                  <Text> {adding ? 'Adding' : 'Removing'} participant...</Text>
                </Box>
              )}
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
          const agentParticipants = participants.filter((p: any) => p.type === 'agent');
          
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
                    ...agentParticipants.map((p: any) => ({
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

    case 'stream':
      if (!selectedThread) return null;
      return <ThreadStream threadId={selectedThread.id} threadName={selectedThread.name} />;

    default:
      return null;
  }
};

// Export wrapped component with error boundary
export const ThreadManagementV2WithErrorBoundary: React.FC = () => {
  const { error, clearError } = useErrorHandler();
  
  if (error) {
    return <ErrorFallback error={error} resetError={clearError} />;
  }
  
  return <ThreadManagementV2 />;
};