import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import chalk from 'chalk';
// Squad storage is now handled by graphyn.xyz backend only

interface Agent {
  id: string;
  name: string;
  emoji?: string;
}

interface Squad {
  id: string;
  name: string;
  description?: string;
  agents: Agent[];
  created_at: string;
}

interface SquadEditorProps {
  squad: Squad;
  token: string;
  apiUrl: string;
  onBack: () => void;
  onDelete?: () => void;
}

export const SquadEditor: React.FC<SquadEditorProps> = ({
  squad,
  token,
  apiUrl,
  onBack,
  onDelete
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalOptions = squad.agents.length + 1; // +1 for delete option

  useInput((input, key) => {
    if (deleting) return;

    if (showConfirmDelete) {
      if (input === 'y' || input === 'Y') {
        handleDelete();
      } else if (input === 'n' || input === 'N' || key.escape) {
        setShowConfirmDelete(false);
      }
      return;
    }

    if (key.upArrow || input === 'k') {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex(Math.min(totalOptions - 1, selectedIndex + 1));
    } else if (key.return || input === 'l') {
      if (selectedIndex === squad.agents.length) {
        // Delete squad option
        setShowConfirmDelete(true);
      }
    } else if (key.escape || input === 'q') {
      onBack();
    }
  });

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);

    try {
      // Try to delete from API first
      try {
        const response = await fetch(`${apiUrl}/api/squads/${squad.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          // If 404, the squad might only exist locally
          if (response.status !== 404) {
            const errorText = await response.text();
            let errorMessage = 'Failed to delete squad from server';
            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.error || errorData.message || errorMessage;
            } catch {
              // If not JSON, use the text directly
              if (errorText) {
                errorMessage = errorText;
              }
            }
            console.warn('API delete failed:', errorMessage);
          }
        }
      } catch (apiError) {
        console.warn('API delete failed:', apiError);
        // Continue with local delete even if API fails
      }

      // Squad deletion is handled by the API only

      // Only call onDelete, not onBack - they are mutually exclusive
      if (onDelete) {
        onDelete();
      } else {
        onBack();
      }
    } catch (err) {
      console.error('Error deleting squad:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete squad';
      setError(errorMessage);
      setDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  if (deleting) {
    return (
      <Box padding={1}>
        <Text color="red">
          <Spinner type="dots" /> Deleting squad...
        </Text>
      </Box>
    );
  }

  if (showConfirmDelete) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="yellow" bold>
          ⚠️  Confirm Delete
        </Text>
        <Box marginTop={1}>
          <Text>Are you sure you want to delete the squad "{squad.name}"?</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press Y to confirm, N to cancel</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="cyan" bold>
        ✏️  Edit Squad: {squad.name}
      </Text>

      {squad.description && (
        <Box marginTop={1}>
          <Text dimColor>{squad.description}</Text>
        </Box>
      )}

      <Box marginTop={2} flexDirection="column">
        <Text dimColor>Agents in this squad:</Text>
        {squad.agents.map((agent, idx) => (
          <Box key={agent.id} marginTop={1}>
            <Text
              color={idx === selectedIndex ? 'cyan' : 'white'}
              bold={idx === selectedIndex}
            >
              {idx === selectedIndex ? '▶' : ' '} {agent.emoji || '🤖'} {agent.name}
            </Text>
          </Box>
        ))}

        <Box marginTop={2}>
          <Text
            color={selectedIndex === squad.agents.length ? 'red' : 'white'}
            bold={selectedIndex === squad.agents.length}
          >
            {selectedIndex === squad.agents.length ? '▶' : ' '} 🗑️  Delete Squad
          </Text>
        </Box>
      </Box>

      {error && (
        <Box marginTop={2}>
          <Text color="red">❌ {error}</Text>
        </Box>
      )}

      <Box marginTop={2} flexDirection="column">
        <Text dimColor>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text>
        <Text dimColor>↑↓/jk Navigate • ↵/l Select • ESC/q Back</Text>
      </Box>
    </Box>
  );
};