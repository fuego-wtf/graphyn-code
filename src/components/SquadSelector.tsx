import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import chalk from 'chalk';
import { ConfigManager } from '../config-manager.js';

interface Squad {
  id: string;
  name: string;
  description?: string;
  agents: Array<{
    id?: string;
    name: string;
    emoji?: string;
    // The API returns the full agent_config object
    agent_id?: string;
    role?: string;
    capabilities?: string[];
  }>;
  created_at: string;
}

interface SquadSelectorProps {
  token: string;
  apiUrl: string;
  onSquadSelected: (squad: Squad) => void;
  onCreateNew: () => void;
  onEditSquad?: (squad: Squad) => void;
  onExit?: () => void;
}

export const SquadSelector: React.FC<SquadSelectorProps> = ({
  token,
  apiUrl,
  onSquadSelected,
  onCreateNew,
  onEditSquad,
  onExit
}) => {
  const [squads, setSquads] = useState<Squad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Helper function to safely get agent display info
  const getAgentDisplay = (agent: any) => {
    if (!agent) {
      return { name: 'Unknown Agent', emoji: '🤖' };
    }
    
    // If agent is a JSON string, parse it first
    if (typeof agent === 'string') {
      try {
        // Check if it's a JSON string
        if (agent.startsWith('{')) {
          const parsed = JSON.parse(agent);
          return {
            name: parsed.name || 'Unknown Agent',
            emoji: parsed.emoji || '🤖'
          };
        }
        // Otherwise treat as ID
        return { name: `Agent ${agent}`, emoji: '🤖' };
      } catch (e) {
        console.error('[DEBUG] Failed to parse agent string:', e);
        return { name: `Agent ${agent}`, emoji: '🤖' };
      }
    }
    
    // Handle different possible agent data structures
    const name = agent.name || 
                 agent.agent_name || 
                 agent.agent_config?.name || 
                 agent.metadata?.name ||
                 agent.agentName ||
                 'Unknown Agent';
    
    const emoji = agent.emoji || 
                  agent.agent_config?.emoji || 
                  agent.metadata?.emoji ||
                  agent.agentEmoji ||
                  '🤖';
    
    return { name, emoji };
  };

  // Fetch existing squads
  useEffect(() => {
    const fetchSquads = async () => {
      try {
        // Get the current user's organization from config
        const configManager = new ConfigManager();
        await configManager.load();
        const currentUser = await configManager.get('auth.user');
        
        console.log('Current user from config:', currentUser);
        
        if (!currentUser?.orgID) {
          console.error('No orgID found in user config:', currentUser);
          setError('No organization found. Please re-authenticate.');
          setLoading(false);
          return;
        }

        // Try fetching squads - backend should filter by user's organization automatically
        console.log(`Fetching squads from: ${apiUrl}/api/squads`);
        const response = await fetch(`${apiUrl}/api/squads`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Squad fetch error: ${response.status} ${response.statusText}`, errorText);
          
          // Check for authentication errors
          if (response.status === 401 || response.status === 403 || 
              (response.status === 500 && errorText.includes('OAuth token'))) {
            setError('Authentication expired. Please run "graphyn logout" then "graphyn login" to re-authenticate.');
            setLoading(false);
            return;
          }
          
          throw new Error(`Failed to fetch squads: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as { squads: Squad[] };
        setSquads(data.squads || []);
      } catch (err) {
        console.error('Error fetching squads:', err);
        setError('Failed to load existing squads');
      } finally {
        setLoading(false);
      }
    };

    fetchSquads();
  }, [token, apiUrl]);

  // Keyboard navigation
  useInput((input, key) => {
    if (loading) return;

    if (key.upArrow || input === 'k') {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedIndex(Math.min(squads.length, selectedIndex + 1)); // +1 for "Create New" option
    } else if (key.return || input === 'l') {
      if (selectedIndex === squads.length) {
        // Create new squad selected
        onCreateNew();
      } else {
        // Existing squad selected
        onSquadSelected(squads[selectedIndex]);
      }
    } else if (input === 'e' || input === 'E') {
      // Edit squad
      if (selectedIndex < squads.length && onEditSquad) {
        onEditSquad(squads[selectedIndex]);
      }
    } else if (key.escape || input === 'q') {
      onExit?.();
    }
  });

  if (loading) {
    return (
      <Box padding={1}>
        <Text color="cyan">
          <Spinner type="dots" /> Loading existing squads...
        </Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red">❌ {error}</Text>
        {error.includes('Authentication expired') ? (
          <Box marginTop={1} flexDirection="column">
            <Text color="yellow">To fix this issue:</Text>
            <Text color="cyan">1. Exit this command (press ESC)</Text>
            <Text color="cyan">2. Run: graphyn logout</Text>
            <Text color="cyan">3. Run: graphyn login</Text>
            <Text color="cyan">4. Try the squad command again</Text>
          </Box>
        ) : (
          <Box marginTop={1}>
            <Text dimColor>Press Enter to create a new squad, or ESC to exit</Text>
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text color="cyan" bold>
        🎯 Select a Squad or Create New
      </Text>
      
      <Box marginTop={1} flexDirection="column">
        {squads.length === 0 ? (
          <Text dimColor>No existing squads found</Text>
        ) : (
          <>
            <Text dimColor>Existing Squads:</Text>
            {squads.map((squad, idx) => (
              <Box key={squad.id} marginTop={1}>
                <Text
                  color={idx === selectedIndex ? 'cyan' : 'white'}
                  bold={idx === selectedIndex}
                >
                  {idx === selectedIndex ? '▶' : ' '} {squad.name}
                </Text>
                <Box marginLeft={3} flexDirection="column">
                  {squad.description && (
                    <Text dimColor>{squad.description}</Text>
                  )}
                  <Text dimColor>
                    {squad.agents?.length || 0} agents • Created {new Date(squad.created_at).toLocaleDateString()}
                  </Text>
                  {idx === selectedIndex && squad.agents && squad.agents.length > 0 && (
                    <Box marginTop={1} flexDirection="column">
                      <Text dimColor>Agents:</Text>
                      <Box marginLeft={2} flexDirection="column">
                        {squad.agents.map((agent, agentIdx) => {
                          const { name, emoji } = getAgentDisplay(agent);
                          return (
                            <Box key={agentIdx}>
                              <Text dimColor>{emoji} {name}</Text>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  )}
                </Box>
              </Box>
            ))}
          </>
        )}
        
        <Box marginTop={2}>
          <Text
            color={selectedIndex === squads.length ? 'green' : 'white'}
            bold={selectedIndex === squads.length}
          >
            {selectedIndex === squads.length ? '▶' : ' '} ✨ Create New Squad
          </Text>
          {selectedIndex === squads.length && (
            <Box marginLeft={3}>
              <Text dimColor>Build a custom squad with AI recommendations</Text>
            </Box>
          )}
        </Box>
      </Box>

      <Box marginTop={2} flexDirection="column">
        <Text dimColor>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text>
        <Text dimColor>↑↓/jk Navigate • ↵/l Select • e Edit • ESC/q Exit</Text>
      </Box>
    </Box>
  );
};