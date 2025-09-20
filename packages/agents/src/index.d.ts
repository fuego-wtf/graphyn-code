/**
 * @graphyn/agents - AI Agent implementations with Claude Code integration
 *
 * Provides specialized AI agents with real Claude CLI integration,
 * process management, and task orchestration capabilities
 */
export { ClaudeCodeAgent } from './base/ClaudeCodeAgent.js';
export type { AgentConfig, TaskExecution, ClaudeMessage, ClaudeResponse } from './base/ClaudeCodeAgent.js';
export { BackendAgent } from './specialized/BackendAgent.js';
export { SecurityAgent } from './specialized/SecurityAgent.js';
import { BackendAgent } from './specialized/BackendAgent.js';
import { SecurityAgent } from './specialized/SecurityAgent.js';
import { ClaudeCodeAgent } from './base/ClaudeCodeAgent.js';
export declare class AgentFactory {
    static createAgent(type: string, id: string, workspaceDir?: string): BackendAgent | SecurityAgent;
    static getAvailableTypes(): string[];
}
export declare class AgentRegistry {
    private agents;
    register(agent: ClaudeCodeAgent): void;
    get(id: string): ClaudeCodeAgent | undefined;
    getAll(): ClaudeCodeAgent[];
    getAvailable(): ClaudeCodeAgent[];
    findBestAgentForTask(task: any): ClaudeCodeAgent | null;
    cleanup(): Promise<void>;
}
//# sourceMappingURL=index.d.ts.map