import fs from 'fs';
import path from 'path';
import { Agent } from '../api-client.js';
import { ConfigManager } from '../config-manager.js';
import { RepositoryDetector, ProjectInfo } from './repository-detector.js';

export interface AgentMapping {
  agents: string[]; // Agent IDs
  context?: Record<string, any>;
}

export interface AgentConfiguration {
  version: string;
  repository?: string;
  organization?: string;
  mappings: Record<string, AgentMapping>; // path -> agent mapping
  globalAgents?: string[]; // Agent IDs available everywhere
  teamPreferences?: Record<string, any>;
  lastUpdated?: string;
}

export class AgentConfigManager {
  private configPath: string;
  private configManager: ConfigManager;
  
  constructor() {
    this.configManager = new ConfigManager();
    this.configPath = path.join(process.cwd(), '.graphyn', 'agents.json');
  }

  /**
   * Initialize agent configuration for current repository
   */
  async initialize(agents: Agent[], projectInfo: ProjectInfo): Promise<AgentConfiguration> {
    // Ensure .graphyn directory exists
    const graphynDir = path.dirname(this.configPath);
    if (!fs.existsSync(graphynDir)) {
      fs.mkdirSync(graphynDir, { recursive: true });
    }

    // Create initial configuration
    const config: AgentConfiguration = {
      version: '1.0',
      repository: projectInfo.gitUrl,
      organization: await this.configManager.get('organization.id'),
      mappings: {},
      globalAgents: [],
      teamPreferences: {},
      lastUpdated: new Date().toISOString(),
    };

    // Auto-detect mappings based on agent applicable paths
    if (projectInfo.projects) {
      for (const project of projectInfo.projects) {
        const applicableAgents = agents.filter(agent => {
          if (!agent.applicablePaths) return false;
          
          return agent.applicablePaths.some(pattern => {
            // Simple pattern matching (can be enhanced)
            const regex = pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
            return new RegExp(`^${regex}$`).test(project.path);
          });
        });

        if (applicableAgents.length > 0) {
          config.mappings[project.path] = {
            agents: applicableAgents.map(a => a.id),
            context: {
              framework: project.framework,
              language: project.language,
            },
          };
        }
      }
    }

    // Save configuration
    await this.save(config);
    return config;
  }

  /**
   * Load agent configuration
   */
  async load(): Promise<AgentConfiguration | null> {
    if (!fs.existsSync(this.configPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to load agent configuration:', error);
      return null;
    }
  }

  /**
   * Save agent configuration
   */
  async save(config: AgentConfiguration): Promise<void> {
    config.lastUpdated = new Date().toISOString();
    
    const graphynDir = path.dirname(this.configPath);
    if (!fs.existsSync(graphynDir)) {
      fs.mkdirSync(graphynDir, { recursive: true });
    }

    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Get agents for current working directory
   */
  async getAgentsForPath(currentPath?: string): Promise<string[]> {
    const config = await this.load();
    if (!config) return [];

    const cwd = currentPath || process.cwd();
    const projectInfo = await RepositoryDetector.detectRepository();
    const relativePath = path.relative(projectInfo.root, cwd);

    // Find the most specific mapping
    let bestMatch: { path: string; agents: string[] } | null = null;
    let bestMatchLength = -1;

    for (const [mappingPath, mapping] of Object.entries(config.mappings)) {
      const normalizedMappingPath = mappingPath.startsWith('/') ? mappingPath.slice(1) : mappingPath;
      
      if (relativePath.startsWith(normalizedMappingPath)) {
        const matchLength = normalizedMappingPath.length;
        if (matchLength > bestMatchLength) {
          bestMatch = { path: mappingPath, agents: mapping.agents };
          bestMatchLength = matchLength;
        }
      }
    }

    // Return agents for best match, or global agents if no match
    if (bestMatch) {
      return [...bestMatch.agents, ...(config.globalAgents || [])];
    }

    return config.globalAgents || [];
  }

  /**
   * Add agent mapping for a path
   */
  async addMapping(path: string, agentIds: string[]): Promise<void> {
    const config = await this.load() || {
      version: '1.0',
      mappings: {},
    } as AgentConfiguration;

    config.mappings[path] = {
      agents: agentIds,
    };

    await this.save(config);
  }

  /**
   * Update team preferences
   */
  async updatePreferences(preferences: Record<string, any>): Promise<void> {
    const config = await this.load() || {
      version: '1.0',
      mappings: {},
    } as AgentConfiguration;

    config.teamPreferences = {
      ...config.teamPreferences,
      ...preferences,
    };

    await this.save(config);
  }

  /**
   * Check if configuration exists
   */
  exists(): boolean {
    return fs.existsSync(this.configPath);
  }

  /**
   * Get configuration age in milliseconds
   */
  async getAge(): Promise<number> {
    const config = await this.load();
    if (!config || !config.lastUpdated) return Infinity;

    return Date.now() - new Date(config.lastUpdated).getTime();
  }

  /**
   * Check if configuration is stale (older than 24 hours)
   */
  async isStale(): Promise<boolean> {
    const age = await this.getAge();
    return age > 24 * 60 * 60 * 1000; // 24 hours
  }
}