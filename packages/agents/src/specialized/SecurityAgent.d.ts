/**
 * Security Agent - Real Claude CLI Integration
 *
 * Specializes in security analysis, vulnerability assessment, and secure code implementation
 * Uses real Claude Code CLI for actual security analysis and code generation
 */
import { ClaudeCodeAgent, TaskExecution } from '../base/ClaudeCodeAgent.js';
import type { Task } from '@graphyn/core';
export declare class SecurityAgent extends ClaudeCodeAgent {
    constructor(id: string, workspaceDir?: string);
    /**
     * Execute security analysis task with Claude CLI
     */
    execute(task: string): Promise<string>;
    /**
     * Build specialized security prompt for Claude
     */
    protected buildTaskPrompt(task: Task): string;
    /**
     * Parse security requirements from task description
     */
    private parseSecurityRequirements;
    /**
     * Format Claude's output for security context with appropriate severity indicators
     */
    private formatSecurityOutput;
    /**
     * Check if security analysis is currently running
     */
    isRunning(): boolean;
    /**
     * Get current security task status
     */
    getCurrentTask(): TaskExecution | null;
}
//# sourceMappingURL=SecurityAgent.d.ts.map