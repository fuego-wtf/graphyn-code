/**
 * @graphyn/agents - AI Agent implementations with Claude Code integration
 *
 * Provides specialized AI agents with real Claude CLI integration,
 * process management, and task orchestration capabilities
 */
// Base agent classes
export { ClaudeCodeAgent } from './base/ClaudeCodeAgent.js';
// Specialized agents
export { BackendAgent } from './specialized/BackendAgent.js';
export { SecurityAgent } from './specialized/SecurityAgent.js';
// Import for internal use
import { BackendAgent } from './specialized/BackendAgent.js';
import { SecurityAgent } from './specialized/SecurityAgent.js';
// Agent factory for creating specialized agents
export class AgentFactory {
    static createAgent(type, id, workspaceDir) {
        switch (type.toLowerCase()) {
            case 'backend':
                return new BackendAgent(id, workspaceDir);
            case 'security':
                return new SecurityAgent(id, workspaceDir);
            default:
                throw new Error(`Unknown agent type: ${type}`);
        }
    }
    static getAvailableTypes() {
        return ['backend', 'security'];
    }
}
// Agent registry for managing multiple agents
export class AgentRegistry {
    agents = new Map();
    register(agent) {
        this.agents.set(agent.config.id, agent);
    }
    get(id) {
        return this.agents.get(id);
    }
    getAll() {
        return Array.from(this.agents.values());
    }
    getAvailable() {
        return this.getAll().filter(agent => agent.getStatus().status === 'idle');
    }
    findBestAgentForTask(task) {
        const availableAgents = this.getAvailable();
        return availableAgents.find(agent => agent.canHandleTask(task)) || null;
    }
    async cleanup() {
        const cleanupPromises = this.getAll().map(agent => agent.cleanup());
        await Promise.all(cleanupPromises);
        this.agents.clear();
    }
}
//# sourceMappingURL=index.js.map