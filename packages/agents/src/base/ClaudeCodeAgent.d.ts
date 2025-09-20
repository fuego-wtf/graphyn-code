/**
 * Base Claude Code Agent - Foundation for all specialized agents
 * Provides real Claude CLI integration with process spawning and session management
 */
import { EventEmitter } from 'events';
import type { Agent, Task } from '@graphyn/core';
export interface AgentConfig {
    id: string;
    type: string;
    specialization: string;
    capabilities: string[];
    tools?: string[];
    workspaceDir?: string;
    timeout?: number;
    maxRetries?: number;
}
export interface TaskExecution {
    taskId: string;
    agentId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime?: Date;
    endTime?: Date;
    output?: string;
    error?: string;
    metrics?: {
        tokensUsed?: number;
        duration?: number;
        toolsUsed?: string[];
    };
}
export interface ClaudeMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}
export interface ClaudeResponse {
    success: boolean;
    content?: string;
    error?: string;
    tokensUsed?: number;
    toolsUsed?: string[];
    duration?: number;
}
/**
 * Base Claude Code Agent class
 * Handles real Claude CLI integration with proper process management
 */
export declare class ClaudeCodeAgent extends EventEmitter {
    readonly config: AgentConfig;
    private currentTask;
    private claudeProcess;
    private messageHistory;
    private sessionId;
    private workspaceReady;
    constructor(config: AgentConfig);
    /**
     * Initialize the agent workspace and prepare for task execution
     */
    initialize(): Promise<void>;
    /**
     * Execute a task using Claude Code CLI
     */
    executeTask(task: Task): Promise<TaskExecution>;
    /**
     * Execute streaming task with real-time output
     */
    executeTaskStream(task: Task): AsyncGenerator<{
        type: 'progress' | 'output' | 'error' | 'completed';
        data: any;
    }>;
    /**
     * Execute prompt with Claude CLI using single-shot mode
     */
    private executeWithClaudeCLI;
    /**
     * Execute streaming Claude CLI with real-time output
     */
    private executeStreamingClaudeCLI;
    /**
     * Build a specialized prompt for the task
     */
    private buildTaskPrompt;
    /**
     * Generate agent-specific context for Claude
     */
    private generateAgentContext;
    /**
     * Get current agent status
     */
    getStatus(): Agent;
    /**
     * Clean up agent resources
     */
    cleanup(): Promise<void>;
    /**
     * Check if agent can handle a specific task
     */
    canHandleTask(task: Task): boolean;
}
//# sourceMappingURL=ClaudeCodeAgent.d.ts.map