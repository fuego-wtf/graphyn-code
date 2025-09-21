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

// MCP Integration
export { MCPAgentAdapter } from './adapters/MCPAgentAdapter.js';
export { MCPAgentManager } from './managers/MCPAgentManager.js';
export { MCPClient } from './clients/MCPClient.js';
export { FigmaPrototypeAnalyzer } from './analyzers/FigmaPrototypeAnalyzer.js';
export type {
  MCPAgentConfig,
  MCPTask,
  MCPTaskResult
} from './adapters/MCPAgentAdapter.js';
export type {
  MCPManagerConfig,
  AgentInfo
} from './managers/MCPAgentManager.js';
export type {
  MCPClientConfig,
  MCPToolCall,
  MCPToolResult
} from './clients/MCPClient.js';
export type {
  FigmaAnalysisConfig,
  FigmaAnalysisResult,
  FigmaDesignToken,
  FigmaComponent
} from './analyzers/FigmaPrototypeAnalyzer.js';

// Specialized agents
export { BackendAgent } from './specialized/BackendAgent.js';
export { SecurityAgent } from './specialized/SecurityAgent.js';
export { FrontendAgent } from './specialized/FrontendAgent.js';
export { TestAgent } from './specialized/TestAgent.js';
export { FigmaAgent } from './specialized/FigmaAgent.js';
export { DevOpsAgent } from './specialized/DevOpsAgent.js';

// Import for internal use
import { BackendAgent } from './specialized/BackendAgent.js';
import { SecurityAgent } from './specialized/SecurityAgent.js';
import { FrontendAgent } from './specialized/FrontendAgent.js';
import { TestAgent } from './specialized/TestAgent.js';
import { FigmaAgent } from './specialized/FigmaAgent.js';
import { DevOpsAgent } from './specialized/DevOpsAgent.js';
import { ClaudeCodeAgent } from './base/ClaudeCodeAgent.js';

// Agent factory for creating specialized agents
export class AgentFactory {
  static createAgent(type: string, id: string, workspaceDir?: string) {
    switch (type.toLowerCase()) {
      case 'backend':
        return new BackendAgent(id, workspaceDir || process.cwd());
      case 'security':
        return new SecurityAgent(id, workspaceDir || process.cwd());
      case 'frontend':
        return new FrontendAgent(id, workspaceDir || process.cwd());
      case 'test':
      case 'testing':
        return new TestAgent(id, workspaceDir || process.cwd());
      case 'figma':
        return new FigmaAgent(id, workspaceDir || process.cwd());
      case 'devops':
        return new DevOpsAgent(id, workspaceDir || process.cwd());
      default:
        throw new Error(`Unknown agent type: ${type}`);
    }
  }

  static getAvailableTypes(): string[] {
    return ['backend', 'security', 'frontend', 'test', 'figma', 'devops'];
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
