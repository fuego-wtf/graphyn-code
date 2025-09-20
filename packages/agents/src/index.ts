/**
 * @graphyn/agents - AI Agent implementations with Claude Code integration
 * 
 * Provides specialized AI agents with real Claude CLI integration,
 * process management, and task orchestration capabilities
 */

// Base agent classes
export { ClaudeCodeAgent } from './base/ClaudeCodeAgent.js';
export type { 
  AgentConfig, 
  TaskExecution, 
  ClaudeMessage, 
  ClaudeResponse 
} from './base/ClaudeCodeAgent.js';

// Specialized agents
export { BackendAgent } from './specialized/BackendAgent';
export { SecurityAgent } from './specialized/SecurityAgent';
export { FrontendAgent } from './specialized/FrontendAgent';
export { TestAgent } from './specialized/TestAgent';
export { FigmaAgent } from './specialized/FigmaAgent';

// Import for internal use
import { BackendAgent } from './specialized/BackendAgent.js';
import { SecurityAgent } from './specialized/SecurityAgent.js';
import { ClaudeCodeAgent } from './base/ClaudeCodeAgent.js';

// Agent factory for creating specialized agents
export class AgentFactory {
  static createAgent(type: string, id: string, workspaceDir?: string) {
    switch (type.toLowerCase()) {
      case 'backend':
        return new BackendAgent(id, workspaceDir);
      case 'security':
        return new SecurityAgent(id, workspaceDir);
      default:
        throw new Error(`Unknown agent type: ${type}`);
    }
  }

  static getAvailableTypes(): string[] {
    return ['backend', 'security'];
  }
}

// Agent registry for managing multiple agents
export class AgentRegistry {
  private agents = new Map<string, ClaudeCodeAgent>();

  register(agent: ClaudeCodeAgent): void {
    this.agents.set(agent.config.id, agent);
  }

  get(id: string): ClaudeCodeAgent | undefined {
    return this.agents.get(id);
  }

  getAll(): ClaudeCodeAgent[] {
    return Array.from(this.agents.values());
  }

  getAvailable(): ClaudeCodeAgent[] {
    return this.getAll().filter(agent => agent.getStatus().status === 'idle');
  }

  findBestAgentForTask(task: any): ClaudeCodeAgent | null {
    const availableAgents = this.getAvailable();
    return availableAgents.find(agent => agent.canHandleTask(task)) || null;
  }

  async cleanup(): Promise<void> {
    const cleanupPromises = this.getAll().map(agent => agent.cleanup());
    await Promise.all(cleanupPromises);
    this.agents.clear();
  }
}
