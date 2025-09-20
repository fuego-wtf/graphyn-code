/**
 * Backend Agent - Real Claude CLI Integration
 *
 * Specializes in backend development: APIs, databases, authentication, server-side logic
 * Uses real Claude Code CLI for actual code generation
 */
import { ClaudeCodeAgent, TaskExecution } from '../base/ClaudeCodeAgent.js';
import type { Task } from '@graphyn/core';
export declare class BackendAgent extends ClaudeCodeAgent {
    constructor(id: string, workspaceDir?: string);
    /**
     * Execute backend development task with Claude CLI
     */
    execute(task: string): Promise<string>;
    /**
     * Build specialized backend prompt for Claude
     */
    protected buildTaskPrompt(task: Task): string;
    /**
     * Parse task requirements from natural language
     */
    private parseTaskRequirements;
    /**
     * Format Claude's output for backend context
     */
    private formatBackendOutput;
    /**
     * Check if agent is currently running a task
     */
    isRunning(): boolean;
    /**
     * Get current task status
     */
    getCurrentTask(): TaskExecution | null;
}
//# sourceMappingURL=BackendAgent.d.ts.map