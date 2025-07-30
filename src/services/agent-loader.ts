import fetch from 'node-fetch';
import type { AgentConfig } from './squad-storage.js';
import chalk from 'chalk';

export interface GraphynAgent {
  id: string;
  name: string;
  role: string;
  emoji?: string;
  system_prompt?: string;
  capabilities?: string[];
  skills?: Record<string, number>;
  metadata?: Record<string, any>;
}

export class AgentLoader {
  private apiUrl: string;
  private token: string;

  constructor(apiUrl: string, token: string) {
    this.apiUrl = apiUrl;
    this.token = token;
  }

  async loadAgentConfigs(agentIds: string[]): Promise<AgentConfig[]> {
    console.log(chalk.gray('📥 Loading agent configurations from Graphyn...'));
    
    const configs: AgentConfig[] = [];
    
    for (const agentId of agentIds) {
      try {
        const agent = await this.loadAgent(agentId);
        if (agent) {
          configs.push(agent);
        }
      } catch (error) {
        console.error(chalk.red(`❌ Failed to load agent ${agentId}:`), error);
      }
    }
    
    if (configs.length === 0) {
      throw new Error('Failed to load any agent configurations');
    }
    
    console.log(chalk.green(`✓ Loaded ${configs.length} agent configurations`));
    return configs;
  }

  private async loadAgent(agentId: string): Promise<AgentConfig | null> {
    try {
      const response = await fetch(`${this.apiUrl}/api/agents/${agentId}`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json() as GraphynAgent;
      
      // Transform Graphyn agent to local AgentConfig
      const config: AgentConfig = {
        id: data.id,
        name: data.name,
        role: data.role,
        emoji: data.emoji,
        systemPrompt: data.system_prompt,
        capabilities: data.capabilities,
        skills: data.skills,
        metadata: data.metadata
      };
      
      return config;
    } catch (error) {
      console.error(chalk.yellow(`⚠️  Failed to load agent ${agentId}, using fallback`));
      // Return a fallback configuration
      return this.createFallbackAgent(agentId);
    }
  }

  private createFallbackAgent(agentId: string): AgentConfig {
    // Create a basic fallback agent configuration
    return {
      id: agentId,
      name: `Agent ${agentId}`,
      role: 'General Developer',
      emoji: '🤖',
      systemPrompt: 'You are a helpful AI assistant that can help with various development tasks.',
      capabilities: ['coding', 'debugging', 'testing'],
      skills: {
        'programming': 8,
        'problem-solving': 8,
        'communication': 7
      }
    };
  }

  async loadSquadAgents(squad: { agents: Array<{ id: string }> }): Promise<AgentConfig[]> {
    const agentIds = squad.agents.map(a => a.id);
    return this.loadAgentConfigs(agentIds);
  }
}