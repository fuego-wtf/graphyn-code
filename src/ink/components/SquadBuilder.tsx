import React, { useEffect, useState } from 'react';
import { Box, Text, useApp } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { useAPI, useAuth } from '../hooks/useAPI.js';
import { useStore } from '../store.js';
import { ConfigManager } from '../../config-manager.js';
import { useClaude } from '../hooks/useClaude.js';
import { getAccentColor, getDimColor, getErrorColor, getSuccessColor } from '../theme/colors.js';
import { Team, Squad, Agent } from '../../api-client.js';

type BuilderStep = 'loading' | 'team-check' | 'squad-create' | 'agent-select' | 'launching';

interface SquadBuilderProps {
  query: string;
}

export const SquadBuilder: React.FC<SquadBuilderProps> = ({ query }) => {
  const { exit } = useApp();
  const api = useAPI();
  const { isAuthenticated } = useAuth();
  const { setMode } = useStore();
  const { launchClaude } = useClaude();
  const [step, setStep] = useState<BuilderStep>('loading');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [squadName, setSquadName] = useState('');
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only redirect to auth if we're done initializing and not authenticated
    if (!isAuthenticated && api.client) {
      setMode('auth');
      return;
    }
    
    if (isAuthenticated) {
      checkTeamAndProceed();
    }
  }, [isAuthenticated, api.client]);

  const checkTeamAndProceed = async () => {
    try {
      setLoading(true);
      const configManager = new ConfigManager();
      const savedTeam = await configManager.get('auth.team') as Team | null;
      
      if (savedTeam) {
        setSelectedTeam(savedTeam);
        setStep('squad-create');
      } else {
        // No team selected, redirect to auth to select team
        setMode('auth');
      }
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team');
      setLoading(false);
    }
  };

  const handleSquadNameSubmit = async (name: string) => {
    if (!name.trim() || !selectedTeam) return;
    
    setSquadName(name);
    setLoading(true);
    setError(null);
    
    try {
      // Get repository context
      const repoUrl = await getRepositoryUrl();
      
      // Get available agents for this repository
      const agents = await api.getAvailableAgents({
        url: repoUrl,
        path: process.cwd()
      });
      
      if (agents.length === 0) {
        // No agents available, create squad and launch Claude
        await createSquadAndLaunch(name, [], repoUrl);
      } else {
        setAvailableAgents(agents);
        setStep('agent-select');
      }
      
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get agents');
      setLoading(false);
    }
  };

  const handleAgentToggle = (agentId: string) => {
    setSelectedAgents(prev => 
      prev.includes(agentId) 
        ? prev.filter(id => id !== agentId)
        : [...prev, agentId]
    );
  };

  const handleAgentSelectionComplete = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const repoUrl = await getRepositoryUrl();
      await createSquadAndLaunch(squadName, selectedAgents, repoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create squad');
      setLoading(false);
    }
  };

  const createSquadAndLaunch = async (name: string, agentIds: string[], repoUrl?: string) => {
    if (!selectedTeam) throw new Error('No team selected');
    
    setStep('launching');
    
    // Create the squad
    const squad = await api.createSquad({
      name,
      team_id: selectedTeam.id,
      repository_url: repoUrl,
      agents: agentIds
    });
    
    // Store squad info for later use
    const configManager = new ConfigManager();
    await configManager.set('current.squad', squad);
    
    // Generate context for Claude
    const context = generateSquadContext(squad, selectedTeam, query);
    
    // Launch Claude with the context
    await launchClaude({
      content: context,
      agent: 'squad',
      saveToHistory: true
    });
    
    // Exit will be handled by launchClaude
  };

  const getRepositoryUrl = async (): Promise<string | undefined> => {
    try {
      const { execSync } = await import('child_process');
      const url = execSync('git config --get remote.origin.url', { encoding: 'utf-8' }).trim();
      return url;
    } catch {
      return undefined;
    }
  };

  const generateSquadContext = (squad: Squad, team: Team, userQuery: string): string => {
    const agentList = selectedAgents.length > 0 
      ? `with ${selectedAgents.length} agents configured`
      : 'with no agents yet';
    
    return `# Graphyn Squad Context

**Team**: ${team.name}
**Squad**: ${squad.name}
**Repository**: ${squad.repository_url || 'Not connected'}
**Status**: Squad created ${agentList}

## User Request
${userQuery}

## Next Steps
The user has requested help with the above task. They've created a new squad for this project.
${selectedAgents.length === 0 ? 'No agents have been added yet - you may want to suggest relevant agents based on their request.' : ''}

Please help them with their request while keeping in mind the squad context.`;
  };

  // Render loading state
  if (loading && step === 'loading') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box>
          <Spinner type="dots" />
          <Text> Initializing squad builder...</Text>
        </Box>
      </Box>
    );
  }

  // Render based on current step
  switch (step) {
    case 'squad-create':
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold color="cyan">🚀 Create Squad for {selectedTeam?.name}</Text>
          
          <Box marginTop={1}>
            <Text>Name your squad (e.g., "Backend API", "Frontend UI"):</Text>
          </Box>
          
          <Box marginTop={1}>
            <Text color={getAccentColor()}>› </Text>
            <TextInput
              value={squadName}
              onChange={setSquadName}
              onSubmit={handleSquadNameSubmit}
              placeholder="My Development Squad"
            />
          </Box>
          
          {error && (
            <Box marginTop={1}>
              <Text color="red">❌ {error}</Text>
            </Box>
          )}
          
          <Box marginTop={2}>
            <Text color={getDimColor()}>Press Enter to continue, ESC to cancel</Text>
          </Box>
        </Box>
      );

    case 'agent-select':
      const agentItems = availableAgents.map(agent => ({
        label: `${selectedAgents.includes(agent.id) ? '✓' : '○'} ${agent.name} - ${agent.description}`,
        value: agent.id
      }));
      
      agentItems.push({ label: '→ Continue without agents', value: 'continue' });
      
      return (
        <Box flexDirection="column" padding={1}>
          <Text bold color="cyan">🤖 Select Agents for Squad</Text>
          
          <Box marginTop={1}>
            <Text>Choose agents to add to your squad:</Text>
          </Box>
          
          <Box marginTop={1}>
            <SelectInput
              items={agentItems}
              onSelect={(item) => {
                if (item.value === 'continue') {
                  handleAgentSelectionComplete();
                } else {
                  handleAgentToggle(item.value);
                }
              }}
            />
          </Box>
          
          {selectedAgents.length > 0 && (
            <Box marginTop={1}>
              <Text color={getSuccessColor()}>
                Selected: {selectedAgents.length} agent{selectedAgents.length !== 1 ? 's' : ''}
              </Text>
            </Box>
          )}
          
          {error && (
            <Box marginTop={1}>
              <Text color="red">❌ {error}</Text>
            </Box>
          )}
          
          <Box marginTop={2}>
            <Text color={getDimColor()}>Space to toggle, Enter to select, ESC to cancel</Text>
          </Box>
        </Box>
      );

    case 'launching':
      return (
        <Box flexDirection="column" padding={1}>
          <Box>
            <Spinner type="dots" />
            <Text color="cyan"> Creating squad and launching Claude...</Text>
          </Box>
          <Box marginTop={1}>
            <Text color={getDimColor()}>Your squad is being created with context about your request.</Text>
          </Box>
        </Box>
      );

    default:
      return null;
  }
};