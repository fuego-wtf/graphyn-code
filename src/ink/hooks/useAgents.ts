import { useEffect, useState } from 'react';
import { useStore } from '../store.js';
import { GraphynAPIClient, Agent } from '../../api-client.js';
import { ConfigManager } from '../../config-manager.js';
import { RepositoryDetector } from '../../utils/repository-detector.js';
import { AgentConfigManager } from '../../utils/agent-config-manager.js';

// Fallback agents for offline mode
const FALLBACK_AGENTS: Agent[] = [
  {
    id: 'backend',
    name: 'Backend',
    description: 'Backend development and API design',
    shared: true,
    created_by: 'system',
  },
  {
    id: 'frontend',
    name: 'Frontend',
    description: 'Frontend development and UI/UX',
    shared: true,
    created_by: 'system',
  },
  {
    id: 'architect',
    name: 'Architect',
    description: 'System design and architecture',
    shared: true,
    created_by: 'system',
  },
  {
    id: 'design',
    name: 'Design',
    description: 'Figma to code conversion',
    shared: true,
    created_by: 'system',
  },
  {
    id: 'cli',
    name: 'CLI',
    description: 'CLI development and DevOps',
    shared: true,
    created_by: 'system',
  },
];

export function useAgents() {
  const {
    availableAgents,
    agentsLoading,
    agentsError,
    currentPath,
    setAvailableAgents,
    setAgentsLoading,
    setAgentsError,
  } = useStore();

  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    loadAgents();
  }, [currentPath]);

  async function loadAgents() {
    setAgentsLoading(true);
    setAgentsError(null);

    try {
      const configManager = new ConfigManager();
      const agentConfigManager = new AgentConfigManager();
      
      // Check if we have a valid auth token
      const token = await configManager.getAuthToken();
      
      if (!token) {
        // Use fallback agents if not authenticated
        setAvailableAgents(FALLBACK_AGENTS);
        setIsOffline(true);
        return;
      }

      // Try to load from cache first if configuration exists and is fresh
      const cachedConfig = await agentConfigManager.load();
      if (cachedConfig && !(await agentConfigManager.isStale())) {
        // Get agents for current path from cache
        const agentIds = await agentConfigManager.getAgentsForPath(currentPath);
        
        // For now, map IDs to fallback agents (in real implementation, 
        // we'd have full agent data in cache)
        const agents = FALLBACK_AGENTS.filter(a => agentIds.includes(a.id));
        if (agents.length > 0) {
          setAvailableAgents(agents);
          setIsOffline(false);
          return;
        }
      }

      // Load from API
      const apiClient = new GraphynAPIClient();
      await apiClient.initialize();
      
      // Get repository context
      const repoContext = await RepositoryDetector.getCurrentContext();
      
      // Fetch available agents for this context
      const agents = await apiClient.getAvailableAgents(repoContext);
      
      if (agents.length === 0) {
        // If no agents returned, use fallback
        setAvailableAgents(FALLBACK_AGENTS);
        setIsOffline(true);
      } else {
        setAvailableAgents(agents);
        setIsOffline(false);
        
        // Update local configuration
        const projectInfo = await RepositoryDetector.detectRepository();
        await agentConfigManager.initialize(agents, projectInfo);
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
      setAgentsError(error instanceof Error ? error.message : 'Failed to load agents');
      
      // Use fallback agents on error
      setAvailableAgents(FALLBACK_AGENTS);
      setIsOffline(true);
    } finally {
      setAgentsLoading(false);
    }
  }

  async function refreshAgents() {
    // Force refresh by clearing cache
    const agentConfigManager = new AgentConfigManager();
    const config = await agentConfigManager.load();
    if (config) {
      config.lastUpdated = new Date(0).toISOString(); // Force stale
      await agentConfigManager.save(config);
    }
    
    await loadAgents();
  }

  return {
    agents: availableAgents,
    loading: agentsLoading,
    error: agentsError,
    isOffline,
    refresh: refreshAgents,
  };
}